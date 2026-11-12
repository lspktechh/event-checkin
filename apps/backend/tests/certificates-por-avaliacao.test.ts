import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createAttendeeToken, createTestEvent, createTestParticipant, resetDatabase } from "./helpers.js";
import { isEligible } from "../src/modules/certificates/certificate-eligibility.service.js";
import { ensureEvaluationsTable } from "../src/modules/evaluations/evaluations.service.js";

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
