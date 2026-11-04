import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

/** COPOL de 3 dias em que "agora" é o dia 2 (começou ontem, termina amanhã). */
async function copolNoDia2() {
  const start = new Date(Date.now() - DAY);
  const end = new Date(Date.now() + DAY);
  const event = await createTestEvent({ name: "3º COPOL", startDate: start, endDate: end });
  await prisma.event.update({ where: { id: event.id }, data: { multiDayCheckIn: true } });
  await prisma.eventBatch.create({
    data: { eventId: event.id, batchNumber: 1, name: "1º Lote", price: 150, isActive: true },
  });
  return event;
}

async function loginAsAdmin(): Promise<string> {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
  return res.json().data.token as string;
}

/** O que a câmera ao vivo do painel faz ao ler um QR de participante. */
function credenciar(eventId: string, adminToken: string, qrToken: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/checkins/admin`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { qrToken },
  });
}

/** O que a câmera faz ao ler o QR de um Hands On. */
function credenciarHandsOn(eventId: string, adminToken: string, qrToken: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/hands-on/checkin`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { qrToken },
  });
}

const pessoa = (n: number) => ({
  name: `Convidado ${n}`,
  email: `convidado${n}@exemplo.com`,
  document: `000.000.000-0${n}`,
});

describe("quem está como cortesia também é credenciado — COPOL", () => {
  it("cortesia lançada pelo painel: o QR credencia e entra na contagem do dia", async () => {
    // Pega: a cortesia nascer como participante que a leitura recusa (inativo)
    // ou fora da contagem de presentes.
    const event = await copolNoDia2();
    const admin = await loginAsAdmin();
    const criada = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/manual`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { ...pessoa(1), cortesia: true },
    });
    expect(criada.statusCode).toBe(201);
    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });

    const leitura = await credenciar(event.id, admin, participante.qrToken);

    expect(leitura.statusCode).toBe(201);
    expect(leitura.json().data.status).toBe("CONFIRMED");
    expect(leitura.json().data.day.index).toBe(2);
    const stats = await app.inject({
      method: "GET",
      url: `/events/${event.id}/statistics`,
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(stats.json().data).toMatchObject({ totalRegistered: 1, totalCheckedIn: 1, totalAbsent: 0 });
    expect(stats.json().data.multiDay.today.checkedIn).toBe(1);
  });

  it("cortesia importada por CSV: cada uma tem QR e é credenciada", async () => {
    // Pega: a importação em lote gravar a inscrição sem gerar o participante/QR.
    const event = await copolNoDia2();
    const admin = await loginAsAdmin();
    const csv = ["nome,email,telefone,documento", ...[1, 2, 3].map((n) => `${pessoa(n).name},${pessoa(n).email},,${pessoa(n).document}`)].join("\n");
    const importacao = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/import`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { csv, confirm: true, cortesia: true },
    });
    expect(importacao.json().data.imported).toBe(3);

    const participantes = await prisma.participant.findMany({ where: { eventId: event.id } });
    expect(participantes).toHaveLength(3);
    for (const p of participantes) {
      const leitura = await credenciar(event.id, admin, p.qrToken);
      expect(leitura.statusCode, `${p.name} deveria ser credenciado`).toBe(201);
    }
  });

  it("participante marcado como cortesia na aba Participantes (sem inscrição) é credenciado", async () => {
    // Pega: tratar "cortesia" como motivo para não credenciar quem não veio
    // de uma inscrição.
    const event = await copolNoDia2();
    const admin = await loginAsAdmin();
    const criado = await app.inject({
      method: "POST",
      url: `/events/${event.id}/participants`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: "Convidado da Mesa", cortesia: true },
    });
    expect(criado.json().data.isCourtesy).toBe(true);

    const leitura = await credenciar(event.id, admin, criado.json().data.qrToken);

    expect(leitura.statusCode).toBe(201);
    expect(leitura.json().data.status).toBe("CONFIRMED");
  });

  it("quem era cortesia e passou a pagante (e o contrário) continua com o mesmo QR e é credenciado", async () => {
    // Pega: a troca de forma de pagamento mexer no participante de um jeito que
    // invalide o QR que a pessoa já tem.
    const event = await copolNoDia2();
    const admin = await loginAsAdmin();
    await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/manual`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { ...pessoa(1), cortesia: true },
    });
    const inscricao = await prisma.inscription.findFirstOrThrow({ where: { eventId: event.id } });
    const antes = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });

    await app.inject({
      method: "PATCH",
      url: `/events/${event.id}/inscriptions/${inscricao.id}`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { pagamento: { forma: "PIX", valor: 150 } },
    });

    const depois = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });
    expect(depois.qrToken).toBe(antes.qrToken);
    const leitura = await credenciar(event.id, admin, antes.qrToken);
    expect(leitura.statusCode).toBe(201);
  });

  it("inscrição de valor zero que ficou PENDENTE (sem QR) passa a ser credenciável quando confirmada", async () => {
    // O caso do botão "Confirmar Inscrição Gratuita": enquanto pendente não
    // existe participante, então não há QR para ler. Pega a confirmação que
    // não cria o participante.
    const event = await copolNoDia2();
    const admin = await loginAsAdmin();
    const pendente = await prisma.inscription.create({
      data: {
        eventId: event.id,
        ...pessoa(7),
        category: "1º Lote",
        amount: 0,
        status: "PENDING",
        paymentExpiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const antes = await app.inject({ method: "GET", url: `/inscriptions/${pendente.id}/payment-status` });
    expect(antes.json().data.qrToken).toBeNull();

    const confirmar = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/${pendente.id}/confirm`,
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(confirmar.statusCode).toBe(200);

    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });
    const leitura = await credenciar(event.id, admin, participante.qrToken);
    expect(leitura.statusCode).toBe(201);
  });
});

describe("quem está como cortesia também é credenciado — Hands On", () => {
  const workshop = {
    handsOnId: "ho-1",
    title: "Resinas Compostas na Prática",
    speaker: "Dra. Helena",
    date: "06/11/2026",
    time: "09:00",
  };

  it("Hands On isento (cortesia) lançado pelo painel nasce confirmado e entra pela porta", async () => {
    // Pega: o isento nascer pendente — com a regra "só confirmada tem QR de
    // acesso", ele ficaria sem QR e seria recusado na porta.
    const event = await createTestEvent();
    const admin = await loginAsAdmin();
    const criada = await app.inject({
      method: "POST",
      url: `/events/${event.id}/hands-on/inscriptions/manual`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { ...workshop, ...pessoa(1), amount: 0, status: "CONFIRMED", notes: "Isento (cortesia)" },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json().data.status).toBe("CONFIRMED");

    const porta = await credenciarHandsOn(event.id, admin, criada.json().data.qrToken);

    expect(porta.statusCode).toBe(200);
    expect(porta.json().data.alreadyCheckedIn).toBe(false);
  });

  it("Hands On gratuito pelo site de inscrição (valor 0) nasce confirmado, mostra o QR e entra pela porta", async () => {
    // Pega: a inscrição gratuita pública ficar "Aguardando Pix" para sempre.
    const event = await createTestEvent();
    // As inscrições públicas do Hands On abrem e fecham por uma opção do evento.
    await prisma.event.update({ where: { id: event.id }, data: { siteContent: { handsOnOpen: true } } });
    const admin = await loginAsAdmin();
    const criada = await app.inject({
      method: "POST",
      url: `/events/${event.id}/hands-on/inscriptions`,
      payload: { ...workshop, ...pessoa(2), amount: 0 },
    });
    expect(criada.statusCode).toBe(201);
    expect(criada.json().data.status).toBe("CONFIRMED");

    const publica = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${criada.json().data.id}` });
    expect(publica.json().data.qrToken).toBe(criada.json().data.qrToken);
    const porta = await credenciarHandsOn(event.id, admin, criada.json().data.qrToken);
    expect(porta.statusCode).toBe(200);
  });
});
