import { Prisma, type CheckIn, type CheckInSource } from "@prisma/client";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { prisma } from "../../database/prisma.js";
import * as participantsRepository from "../participants/participants.repository.js";
import * as checkinsRepository from "./checkins.repository.js";
import { OutsideEventPeriodError, eventDays, resolveEventDay, type EventDay } from "./event-day.js";
import { attendeeEventBus } from "../attendee/attendee.events.js";
import { adminCheckInBus } from "../admin/adminMonitor.events.js";
import { resolveEmailSettings } from "../../lib/email/email-settings.js";
import { enviarComprovantePorEmail } from "../certificates/certificate-mailer.js";

export interface CheckInParticipantInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
}

/** `day` só vem em evento com credenciamento por dia (Event.multiDayCheckIn);
 * nos demais é `null` e o resultado é o mesmo de sempre. */
export type CheckInOutcome =
  | { status: "CONFIRMED"; checkIn: CheckIn; participant: CheckInParticipantInfo; day: EventDay | null }
  | { status: "ALREADY_CHECKED_IN"; checkIn: CheckIn; participant: CheckInParticipantInfo; day: EventDay | null };

export interface PerformCheckInParams {
  eventId: string;
  qrToken: string;
  terminalId: string | null;
  terminalName?: string | null;
  source: CheckInSource;
  checkedInAt?: Date;
  localCheckInId?: string;
}

function isUniqueConflictOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}

/**
 * Regra central de check-in, compartilhada pelo endpoint online
 * (POST /events/:eventId/checkins) e pela sincronização offline
 * (POST /terminals/sync). A duplicidade é resolvida pela constraint
 * UNIQUE(eventId, participantId, dayIndex) do banco — mesmo sob concorrência
 * real entre dois terminais/câmeras, apenas um INSERT vence; o outro cai no
 * catch abaixo e é tratado como ALREADY_CHECKED_IN, não como erro.
 *
 * Evento comum tem dayIndex 0 (um check-in só). Evento por dia
 * (multiDayCheckIn, o COPOL) tem dayIndex 1, 2, 3…, calculado AQUI no
 * servidor pelo horário da leitura e pelas datas do evento — nunca pelo
 * navegador. Na sincronização offline o horário é o da leitura, não o da
 * sincronização.
 */
export async function performCheckIn(params: PerformCheckInParams): Promise<CheckInOutcome> {
  const { eventId, qrToken, terminalId, source, localCheckInId } = params;
  const checkedInAt = params.checkedInAt ?? new Date();

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { multiDayCheckIn: true, startDate: true, endDate: true, timezone: true },
  });
  const dayAt = (instant: Date): EventDay | null => (event?.multiDayCheckIn ? resolveEventDay(event, instant) : null);

  // Idempotência de reenvio: se este exato registro offline já foi
  // sincronizado antes (retry de rede, por exemplo), devolve o resultado
  // já conhecido sem revalidar nada.
  if (terminalId && localCheckInId) {
    const existingByLocalId = await checkinsRepository.findByTerminalAndLocalId(terminalId, localCheckInId);
    if (existingByLocalId) {
      const participant = await participantsRepository.findParticipantById(eventId, existingByLocalId.participantId);
      return {
        status: "CONFIRMED",
        checkIn: existingByLocalId,
        participant: { id: participant!.id, name: participant!.name, email: participant!.email, phone: participant!.phone, document: participant!.document },
        day: dayAt(existingByLocalId.checkedInAt),
      };
    }
  }

  const participant = await participantsRepository.findParticipantByQrToken(qrToken);
  if (!participant || participant.eventId !== eventId || participant.revokedAt) {
    throw new NotFoundError("Credencial inválida");
  }
  if (participant.status !== "ACTIVE") {
    throw new ForbiddenError("Credencial inativa");
  }

  // Evento por dia: o dia sai do horário da leitura. Fora do primeiro e do
  // último dia não existe dia correspondente — recusa em vez de gravar
  // numa data que não é a da presença.
  const day = dayAt(checkedInAt);
  if (event?.multiDayCheckIn && !day) {
    throw new OutsideEventPeriodError(event);
  }
  const dayIndex = day?.index ?? 0;

  try {
    const checkIn = await checkinsRepository.createCheckIn({
      eventId,
      participantId: participant.id,
      terminalId,
      source,
      checkedInAt,
      localCheckInId: localCheckInId ?? null,
      dayIndex,
    });

    // Comprovante de presença por e-mail, se o evento pedir.
    //
    // Em segundo plano e sem `await`: o terminal precisa liberar a
    // catraca em milissegundos, e gerar PDF + falar com o Resend leva
    // segundos. Amarrar as duas coisas faria a fila de credenciamento
    // parar por causa de um e-mail.
    //
    // Erro aqui não invalida o check-in — a presença já está gravada, e
    // o comprovante continua disponível para download e reenvio.
    void enviarComprovanteSeConfigurado(eventId, participant.id);

    // Publish check-in event for SSE subscribers
    attendeeEventBus.publish(participant.id, {
      type: 'check_in',
      participantId: participant.id,
      participantName: participant.name,
      status: 'CONFIRMED',
      checkedInAt: checkedInAt.toISOString(),
    });

    // Publish to admin monitor bus
    adminCheckInBus.publish(eventId, {
      type: 'check_in',
      eventId,
      participantId: participant.id,
      participantName: participant.name,
      participantEmail: participant.email,
      participantPhone: participant.phone,
      participantDocument: participant.document,
      status: 'CONFIRMED',
      checkedInAt: checkedInAt.toISOString(),
      terminalName: params.terminalName ?? null,
      terminalId: params.terminalId ?? null,
      source: params.source,
    });

    return { status: "CONFIRMED", checkIn, participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document }, day };
  } catch (error) {
    if (isUniqueConflictOn(error, "participantId")) {
      const existing = await checkinsRepository.findByEventParticipantAndDay(eventId, participant.id, dayIndex);
      if (existing) {
        // Publish already checked in event for SSE subscribers
        attendeeEventBus.publish(participant.id, {
          type: 'check_in',
          participantId: participant.id,
          participantName: participant.name,
          status: 'ALREADY_CHECKED_IN',
          checkedInAt: existing.checkedInAt.toISOString(),
        });

        // Publish to admin monitor bus
        adminCheckInBus.publish(eventId, {
          type: 'check_in',
          eventId,
          participantId: participant.id,
          participantName: participant.name,
          participantEmail: participant.email,
          participantPhone: participant.phone,
          participantDocument: participant.document,
          status: 'ALREADY_CHECKED_IN',
          checkedInAt: existing.checkedInAt.toISOString(),
          terminalName: params.terminalName ?? null,
          terminalId: params.terminalId ?? null,
          source: params.source,
        });

        // Também grava em checkin_attempts — sem isso, a duplicidade só
        // existia como evento ao vivo e sumia se o admin não estivesse
        // com o monitor aberto naquele instante exato (ver
        // getRecentCheckInsForMonitor). Não precisa de await bloqueante
        // aqui: createCheckInAttempt nunca lança e o resultado do
        // check-in em si já está decidido.
        void checkinsRepository.createCheckInAttempt({
          eventId,
          participantId: participant.id,
          participantName: participant.name,
          participantEmail: participant.email,
          participantPhone: participant.phone,
          participantDocument: participant.document,
          terminalId: params.terminalId ?? null,
          terminalName: params.terminalName ?? null,
          status: "ALREADY_CHECKED_IN",
          source: params.source,
        });

        return {
          status: "ALREADY_CHECKED_IN",
          checkIn: existing,
          participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document },
          day,
        };
      }
    }
    if (isUniqueConflictOn(error, "localCheckInId") && terminalId && localCheckInId) {
      const existing = await checkinsRepository.findByTerminalAndLocalId(terminalId, localCheckInId);
      if (existing) {
        return { status: "CONFIRMED", checkIn: existing, participant: { id: participant.id, name: participant.name, email: participant.email, phone: participant.phone, document: participant.document }, day };
      }
    }
    throw new ConflictError("CHECKIN_CONFLICT", "Não foi possível registrar a presença. Tente novamente.");
  }
}

/**
 * Preenche o monitor ao vivo com o histórico recente assim que o admin
 * conecta — sem isso, o monitor (adminCheckInBus) só mostra o que
 * acontece DEPOIS da conexão SSE abrir; qualquer coisa que já tinha
 * acontecido (ou aconteceu enquanto a aba estava fechada/em outra aba)
 * ficava invisível pra sempre, porque o bus é só em memória, sem replay.
 * Junta as duas fontes que alimentam o monitor: check-ins confirmados
 * (tabela checkins) e tentativas rejeitadas/duplicadas (checkin_attempts)
 * — pega os `limit` mais recentes de cada uma e depois corta pro total
 * certo, pra um evento com muita duplicidade não engolir todo o espaço
 * só com isso.
 */
export async function getRecentCheckInsForMonitor(eventId: string, limit = 50) {
  const [checkIns, attempts] = await Promise.all([
    checkinsRepository.listRecentCheckInsByEvent(eventId, limit),
    checkinsRepository.listRecentCheckInAttempts(eventId, limit),
  ]);

  const confirmed = checkIns.map((c) => ({
    type: "check_in" as const,
    eventId,
    participantId: c.participantId,
    participantName: c.participant.name,
    participantEmail: c.participant.email,
    participantPhone: c.participant.phone,
    participantDocument: c.participant.document,
    status: "CONFIRMED" as const,
    checkedInAt: c.checkedInAt.toISOString(),
    terminalName: c.terminal?.name ?? null,
    terminalId: c.terminalId,
    source: c.source,
  }));

  const rejectedOrDuplicated = attempts.map((a) => ({
    type: "check_in" as const,
    eventId,
    participantId: a.participantId ?? "",
    participantName: a.participantName ?? "—",
    participantEmail: a.participantEmail,
    participantPhone: a.participantPhone,
    participantDocument: a.participantDocument,
    status: a.status,
    checkedInAt: a.attemptedAt.toISOString(),
    terminalName: a.terminalName,
    terminalId: a.terminalId,
    source: a.source,
    errorMessage: a.errorMessage ?? undefined,
  }));

  return [...confirmed, ...rejectedOrDuplicated]
    .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime())
    .slice(-limit);
}

export async function getEventStatistics(eventId: string) {
  const [event, totalParticipants, presentPeople, byTerminal] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: { multiDayCheckIn: true, startDate: true, endDate: true, timezone: true },
    }),
    participantsRepository.listParticipantsByEvent(eventId).then((rows) => rows.length),
    // Pessoas, não linhas: em evento por dia a mesma pessoa tem uma linha por dia.
    checkinsRepository.countPresentParticipants(eventId),
    checkinsRepository.countByEventAndTerminal(eventId),
  ]);

  const attendancePercentage = totalParticipants > 0 ? (presentPeople / totalParticipants) * 100 : 0;

  const stats = {
    totalRegistered: totalParticipants,
    totalCheckedIn: presentPeople,
    totalAbsent: totalParticipants - presentPeople,
    attendancePercentage: Number(attendancePercentage.toFixed(2)),
    checkInsByTerminal: byTerminal.map((row) => ({
      terminalId: row.terminalId,
      count: row._count._all,
    })),
  };

  // Evento comum não ganha nenhum campo novo.
  if (!event?.multiDayCheckIn) return stats;

  const byDay = await checkinsRepository.countByDay(eventId);
  const days = eventDays(event);
  const perDay = days.map((d) => ({ index: d.index, date: d.date, checkedIn: byDay.get(d.index) ?? 0 }));
  const todayInfo = resolveEventDay(event, new Date());
  return {
    ...stats,
    multiDay: {
      total: days.length,
      // null fora dos dias do evento (antes do início ou depois do fim).
      today: todayInfo ? { index: todayInfo.index, date: todayInfo.date, checkedIn: byDay.get(todayInfo.index) ?? 0 } : null,
      perDay,
    },
  };
}

export async function getEventReport(eventId: string) {
  const [event, checkIns, totalParticipants] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { name: true, location: true } }),
    checkinsRepository.listCheckInsByEvent(eventId),
    participantsRepository.listParticipantsByEvent(eventId).then((rows) => rows.length),
  ]);

  return {
    eventName: event?.name ?? "Evento",
    eventLocation: event?.location ?? "",
    totalRegistered: totalParticipants,
    // Pessoas, não linhas (em evento por dia há uma linha por dia).
    totalCheckedIn: new Set(checkIns.map((c) => c.participantId)).size,
    checkIns: checkIns.map((c) => ({
      dayIndex: c.dayIndex,
      participantName: c.participant.name,
      participantEmail: c.participant.email,
      participantPhone: c.participant.phone,
      participantDocument: c.participant.document,
      terminalName: c.terminal?.name ?? null,
      source: c.source,
      checkedInAt: c.checkedInAt.toISOString(),
    })),
  };
}

/**
 * Dispara o comprovante de presença quando o evento tem o envio
 * automático ligado.
 *
 * A configuração é lida do evento a cada check-in, e não guardada em
 * memória: o organizador pode ligar isso no meio do credenciamento, e
 * um valor em cache faria a mudança só valer depois de reiniciar.
 */
async function enviarComprovanteSeConfigurado(eventId: string, participantId: string): Promise<void> {
  try {
    const evento = await prisma.event.findUnique({
      where: { id: eventId },
      select: { emailSettings: true },
    });
    if (!resolveEmailSettings(evento?.emailSettings).autoSendAttendanceProof) return;

    const r = await enviarComprovantePorEmail(eventId, participantId);
    if (!r.enviado) {
      console.warn(`[CheckIns] Comprovante não enviado (${participantId}): ${r.motivo ?? "sem motivo"}`);
    }
  } catch (erro) {
    console.error("[CheckIns] Falha ao enviar comprovante de presença:", erro);
  }
}
