import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createAttendeeToken, createTestEvent, createTestParticipant, resetDatabase } from "./helpers.js";
import { isEligible } from "../src/modules/certificates/certificate-eligibility.service.js";
import { ensureEvaluationsTable, syncParticipantsFromEvaluations } from "../src/modules/evaluations/evaluations.service.js";

/**
 * Certificado liberado pela avaliação pós-evento (INOVA SAÚDE 2026): sem
 * check-in, quem respondeu a avaliação com o mesmo e-mail da inscrição
 * baixa o certificado de 8h ou 16h. Ver certificate-por-avaliacao.ts.
 */

const app = buildApp();
const SLUG = "inova-saude-2026";

beforeEach(async () => {
  await resetDatabase();
  await ensureEvaluationsTable();
  await prisma.$executeRawUnsafe(`DELETE FROM event_evaluations`);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM event_evaluations`);
  await app.close();
  await prisma.$disconnect();
});

async function criarEventoInova() {
  // Evento ainda NÃO encerrado de propósito: a avaliação libera mesmo assim.
  const event = await createTestEvent();
  return prisma.event.update({ where: { id: event.id }, data: { slug: SLUG } });
}

async function criarParticipante(eventId: string, email: string) {
  const p = await createTestParticipant(eventId, { name: "Maria Eduarda Oliveira" });
  return prisma.participant.update({ where: { id: p.id }, data: { email } });
}

async function criarAvaliacao(eventId: string, email: string, horas: 8 | 16, criadaEm = new Date()) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO event_evaluations (event_id, nome, email, curso_periodo, nps, mentoria_nota,
       aprendizado, continuar_ecohub, depoimento, autoriza_depoimento, esteve_demoday,
       horas_certificado, created_at)
     VALUES ($1, 'Maria', $2, 'ADS 3º', 10, 'otima', 'muito', 'sim', 'top', 'sim', $3, $4, $5)`,
    eventId,
    email,
    horas === 16,
    horas,
    criadaEm,
  );
}

async function baixar(event: { id: string }, participant: { id: string; eventId: string }) {
  const token = await createAttendeeToken(app, participant);
  return app.inject({
    method: "GET",
    url: `/events/${event.id}/certificates/download`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("regra de elegibilidade por avaliação (unidade)", () => {
  const future = new Date("2999-01-01T00:00:00Z");

  it("elegível com avaliação, mesmo sem check-in e com o evento em andamento", () => {
    expect(isEligible({ event: { endDate: future }, hasCheckIn: false, exigeAvaliacao: true, temAvaliacao: true })).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it("não elegível sem avaliação, mesmo com check-in", () => {
    expect(isEligible({ event: { endDate: future }, hasCheckIn: true, exigeAvaliacao: true, temAvaliacao: false })).toEqual({
      eligible: false,
      reason: "NO_EVALUATION",
    });
  });

  it("liberação manual continua valendo por cima da avaliação", () => {
    const r = isEligible({ event: { endDate: future }, hasCheckIn: false, manuallyReleased: true, exigeAvaliacao: true, temAvaliacao: false });
    expect(r.eligible).toBe(true);
  });
});

describe("download do certificado por avaliação", () => {
  it("403 com mensagem clara para quem não respondeu a avaliação", async () => {
    const event = await criarEventoInova();
    const participant = await criarParticipante(event.id, "maria@teste.com");

    const res = await baixar(event, participant);
    expect(res.statusCode).toBe(403);
    expect(res.body).toContain("avaliação");
  });

  it("8h para quem respondeu sem Demoday, sem precisar de check-in", async () => {
    const event = await criarEventoInova();
    const participant = await criarParticipante(event.id, "maria@teste.com");
    await criarAvaliacao(event.id, "maria@teste.com", 8);

    const res = await baixar(event, participant);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");

    const cert = await prisma.certificate.findFirstOrThrow({ where: { eventId: event.id, participantId: participant.id } });
    expect(cert.status).toBe("GENERATED");
    expect(cert.workloadHours).toBe(8);
  });

  it("16h para quem marcou Demoday; e-mail casa sem diferenciar maiúsculas", async () => {
    const event = await criarEventoInova();
    const participant = await criarParticipante(event.id, "Maria@Teste.com ");
    await criarAvaliacao(event.id, "maria@teste.com", 16);

    const res = await baixar(event, participant);
    expect(res.statusCode).toBe(200);
    const cert = await prisma.certificate.findFirstOrThrow({ where: { eventId: event.id, participantId: participant.id } });
    expect(cert.workloadHours).toBe(16);
  });

  it("vale a avaliação mais recente e o PDF é regerado quando as horas mudam", async () => {
    const event = await criarEventoInova();
    const participant = await criarParticipante(event.id, "maria@teste.com");
    await criarAvaliacao(event.id, "maria@teste.com", 8, new Date("2026-11-10T10:00:00Z"));
    expect((await baixar(event, participant)).statusCode).toBe(200);

    await criarAvaliacao(event.id, "maria@teste.com", 16, new Date("2026-11-11T10:00:00Z"));
    expect((await baixar(event, participant)).statusCode).toBe(200);

    const cert = await prisma.certificate.findFirstOrThrow({ where: { eventId: event.id, participantId: participant.id } });
    expect(cert.workloadHours).toBe(16);
  });

  it("/my-documents mostra o motivo NO_EVALUATION e libera após a avaliação", async () => {
    const event = await criarEventoInova();
    const participant = await criarParticipante(event.id, "maria@teste.com");
    const token = await createAttendeeToken(app, participant);
    const get = () =>
      app.inject({ method: "GET", url: `/events/${event.id}/my-documents`, headers: { authorization: `Bearer ${token}` } });

    const antes = (await get()).json().data.certificate;
    expect(antes).toMatchObject({ status: "LOCKED", canDownload: false, reason: "NO_EVALUATION" });

    await criarAvaliacao(event.id, "maria@teste.com", 8);
    const depois = (await get()).json().data.certificate;
    expect(depois).toMatchObject({ status: "ELIGIBLE", canDownload: true, reason: null });
  });

  it("evento sem configuração por avaliação continua exigindo check-in", async () => {
    const event = await createTestEvent();
    const participant = await criarParticipante(event.id, "maria@teste.com");
    await criarAvaliacao(event.id, "maria@teste.com", 8);

    const res = await baixar(event, participant);
    expect(res.statusCode).toBe(403);
  });
});

describe("quem avalia vira participante do evento", () => {
  const avaliacao = (email: string, esteveDemoday = false) => ({
    nome: "Carla Avaliadora",
    email,
    cursoPeriodo: "ADS 3º",
    nps: 9,
    oQueAjudou: ["mentoria"],
    mentoriaNota: "otima",
    aprendizado: "muito",
    continuarEcohub: "sim",
    depoimento: "top",
    autorizaDepoimento: "sim",
    esteveDemoday,
    ...(esteveDemoday
      ? {
          papelDemoday: "plateia",
          demodayOrganizacao: 5,
          demodayHorario: 5,
          demodayFeedbackBanca: 5,
          demodayApresentacao: "Equipe 3",
          demodayGravarVideo: "sim",
        }
      : {}),
  });

  it("sem inscrição prévia: avaliar cadastra, o e-mail encontra o INOVA (com slug) e o certificado sai", async () => {
    const event = await criarEventoInova();

    const envio = await app.inject({
      method: "POST",
      url: `/public/events/${SLUG}/avaliacao`,
      payload: avaliacao("Carla@Teste.com", true),
    });
    expect(envio.statusCode).toBe(200);

    const participantes = await prisma.participant.findMany({ where: { eventId: event.id } });
    expect(participantes).toHaveLength(1);
    expect(participantes[0]).toMatchObject({ email: "carla@teste.com", name: "Carla Avaliadora", status: "ACTIVE" });

    const login = await app.inject({ method: "POST", url: "/attendee/login", payload: { email: "carla@teste.com" } });
    expect(login.statusCode).toBe(200);
    const corpo = login.json().data;
    expect(corpo.participant.event).toMatchObject({ id: event.id, slug: SLUG });

    const res = await baixar(event, participantes[0]);
    expect(res.statusCode).toBe(200);
    const cert = await prisma.certificate.findFirstOrThrow({ where: { eventId: event.id } });
    expect(cert.workloadHours).toBe(16);
  });

  it("já inscrito com o mesmo e-mail: não duplica o participante", async () => {
    const event = await criarEventoInova();
    await criarParticipante(event.id, "maria@teste.com");

    await app.inject({ method: "POST", url: `/public/events/${SLUG}/avaliacao`, payload: avaliacao("MARIA@teste.com") });
    await app.inject({ method: "POST", url: `/public/events/${SLUG}/avaliacao`, payload: avaliacao("maria@teste.com") });

    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("sincronização cadastra quem avaliou antes do cadastro automático, sem duplicar", async () => {
    const event = await criarEventoInova();
    await criarParticipante(event.id, "ja@teste.com");
    await criarAvaliacao(event.id, "ja@teste.com", 8);
    await criarAvaliacao(event.id, "nova@teste.com", 8);
    await criarAvaliacao(event.id, "Nova@Teste.com", 16);

    expect(await syncParticipantsFromEvaluations()).toBe(1);
    expect(await syncParticipantsFromEvaluations()).toBe(0);
    const emails = (await prisma.participant.findMany({ where: { eventId: event.id } })).map((p) => p.email).sort();
    expect(emails).toEqual(["ja@teste.com", "nova@teste.com"]);
  });
});
