import { prisma } from "../../database/prisma.js";
import type { CheckInAttemptStatus, CheckInSource } from "@prisma/client";

export interface CreateCheckInParams {
  eventId: string;
  participantId: string;
  terminalId: string | null;
  source: CheckInSource;
  checkedInAt: Date;
  localCheckInId?: string | null;
  /** Dia do evento (1, 2, 3…); 0 em evento sem credenciamento por dia. */
  dayIndex: number;
  /** Período do dia (1 = Manhã, 2 = Noite); 0 em evento sem credenciamento por dia. */
  period: number;
}

export function createCheckIn(params: CreateCheckInParams) {
  return prisma.checkIn.create({ data: params });
}

/** A presença de um participante NAQUELE dia e período (0/0 = evento sem dia). */
export function findByEventParticipantDayAndPeriod(eventId: string, participantId: string, dayIndex: number, period: number) {
  return prisma.checkIn.findUnique({
    where: { eventId_participantId_dayIndex_period: { eventId, participantId, dayIndex, period } },
  });
}

export function findByTerminalAndLocalId(terminalId: string, localCheckInId: string) {
  return prisma.checkIn.findUnique({
    where: { terminalId_localCheckInId: { terminalId, localCheckInId } },
  });
}

/** Quantas PESSOAS têm ao menos uma presença no evento. Em evento por dia
 * a mesma pessoa tem uma linha por dia; contar linhas daria 3 presentes para
 * 1 pessoa (e "ausentes" negativo). */
export async function countPresentParticipants(eventId: string): Promise<number> {
  const rows = await prisma.checkIn.groupBy({ by: ["participantId"], where: { eventId } });
  return rows.length;
}

/** Pessoas presentes em cada dia do evento (dayIndex → quantas pessoas). A
 * mesma pessoa tem até uma linha por período; aqui ela conta uma vez no dia. */
export async function countByDay(eventId: string): Promise<Map<number, number>> {
  const rows = await prisma.checkIn.groupBy({ by: ["dayIndex", "participantId"], where: { eventId } });
  const perDay = new Map<number, number>();
  for (const r of rows) perDay.set(r.dayIndex, (perDay.get(r.dayIndex) ?? 0) + 1);
  return perDay;
}

/** Pessoas presentes em cada período de cada dia (chave "dia:período"). Há no
 * máximo uma linha por pessoa em cada um, então contar linhas conta pessoas. */
export async function countByDayAndPeriod(eventId: string): Promise<Map<string, number>> {
  const rows = await prisma.checkIn.groupBy({ by: ["dayIndex", "period"], where: { eventId }, _count: { _all: true } });
  return new Map(rows.map((r) => [`${r.dayIndex}:${r.period}`, r._count._all]));
}

export function countByEventAndTerminal(eventId: string) {
  return prisma.checkIn.groupBy({
    by: ["terminalId"],
    where: { eventId },
    _count: { _all: true },
  });
}

export function listCheckInsByEvent(eventId: string) {
  return prisma.checkIn.findMany({
    where: { eventId },
    include: {
      participant: { select: { name: true, email: true, phone: true, document: true } },
      terminal: { select: { name: true } },
    },
    orderBy: { checkedInAt: "asc" },
  });
}

/** Os `limit` check-ins mais recentes do evento — usado só para preencher
 * o histórico do monitor ao vivo quando um admin conecta (ver
 * checkins.routes.ts). Devolve do mais antigo pro mais novo (mesma ordem
 * em que os eventos apareceriam se o admin tivesse assistido ao vivo). */
export function listRecentCheckInsByEvent(eventId: string, limit: number) {
  return prisma.checkIn
    .findMany({
      where: { eventId },
      include: {
        participant: { select: { name: true, email: true, phone: true, document: true } },
        terminal: { select: { name: true } },
      },
      orderBy: { checkedInAt: "desc" },
      take: limit,
    })
    .then((rows) => rows.reverse());
}

export interface CreateCheckInAttemptParams {
  eventId: string;
  participantId?: string | null;
  participantName?: string | null;
  participantEmail?: string | null;
  participantPhone?: string | null;
  participantDocument?: string | null;
  terminalId?: string | null;
  terminalName?: string | null;
  status: CheckInAttemptStatus;
  source: CheckInSource;
  errorMessage?: string | null;
}

/** Registra uma tentativa de check-in que não virou um CheckIn de verdade
 * — duplicidade ou rejeição (ver comentário do model no schema.prisma).
 * Nunca lança: uma falha aqui não pode derrubar o check-in em si, que já
 * foi resolvido (a mesma postura de recordAudit em audit.service.ts). */
export async function createCheckInAttempt(params: CreateCheckInAttemptParams): Promise<void> {
  try {
    await prisma.checkInAttempt.create({ data: params });
  } catch (error) {
    console.error("Falha ao gravar tentativa de check-in (checkin_attempts)", error);
  }
}

/** Os `limit` registros mais recentes de checkin_attempts do evento —
 * mesmo papel de listRecentCheckInsByEvent, mas para duplicidade/rejeição. */
export async function listRecentCheckInAttempts(eventId: string, limit: number) {
  const rows = await prisma.checkInAttempt.findMany({
    where: { eventId },
    orderBy: { attemptedAt: "desc" },
    take: limit,
  });
  return rows.reverse();
}
