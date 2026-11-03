import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createAttendeeToken, createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const PESSOA = { name: "Ana Souza", email: "ana@exemplo.com", document: "123.456.789-01" };

async function cenario() {
  const event = await createTestEvent();
  const participant = await prisma.participant.create({
    data: { eventId: event.id, ...PESSOA, qrToken: `evt_${Math.random().toString(36).slice(2)}` },
  });
  const attendeeToken = await createAttendeeToken(app, participant);
  return { event, participant, attendeeToken };
}

let seq = 0;
function inscricao(eventId: string, status: "PENDING" | "CONFIRMED" | "CANCELLED", handsOnId: string) {
  seq += 1;
  return prisma.handsOnRegistration.create({
    data: {
      eventId,
      handsOnId,
      title: `Workshop ${handsOnId}`,
      speaker: "Dra. Helena",
      date: "06/11/2026",
      time: "09:00",
      amount: 100,
      ...PESSOA,
      status,
      qrToken: `HO-token-${status.toLowerCase()}-${seq}-${Math.random().toString(36).slice(2, 8)}`,
    },
  });
}

async function loginAsAdmin(): Promise<string> {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
  return res.json().data.token as string;
}

function lerNaPorta(eventId: string, adminToken: string, idOuToken: { qrToken?: string; id?: string }) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/hands-on/checkin`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: idOuToken,
  });
}

describe("Hands On cancelado não entrega QR", () => {
  it("portal do participante: a cancelada continua na lista, mas sem QR; a confirmada mantém o QR", async () => {
    // Pega: o token de uma inscrição cancelada saindo da API para o site,
    // que o desenharia como QR válido de acesso à sala.
    const { event, attendeeToken } = await cenario();
    const confirmada = await inscricao(event.id, "CONFIRMED", "ho-a");
    const cancelada = await inscricao(event.id, "CANCELLED", "ho-b");

    const res = await app.inject({
      method: "GET",
      url: "/attendee/hands-on",
      headers: { authorization: `Bearer ${attendeeToken}` },
    });

    expect(res.statusCode).toBe(200);
    const itens = res.json().data as { id: string; status: string; qrToken: string | null }[];
    expect(itens.find((i) => i.id === confirmada.id)).toMatchObject({ status: "CONFIRMED", qrToken: confirmada.qrToken });
    expect(itens.find((i) => i.id === cancelada.id)).toMatchObject({ status: "CANCELLED", qrToken: null });
    // O token não pode vazar por nenhum outro campo da resposta.
    expect(res.body).not.toContain(cancelada.qrToken);
  });

  it("consulta pública por e-mail também não entrega o QR da cancelada", async () => {
    // Pega: proteger só o portal e deixar o mesmo token sair pela consulta
    // pública, que usa a mesma lista.
    const { event } = await cenario();
    const cancelada = await inscricao(event.id, "CANCELLED", "ho-b");

    const res = await app.inject({
      method: "GET",
      url: `/public/attendee/hands-on?email=${encodeURIComponent(PESSOA.email)}&eventId=${event.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).toMatchObject({ status: "CANCELLED", qrToken: null });
    expect(res.body).not.toContain(cancelada.qrToken);
  });

  it("consulta da inscrição pelo id (tela de pagamento): cancelada sem QR, confirmada com QR", async () => {
    // Pega: a terceira via que devolve o token (acompanhamento de pagamento).
    const { event } = await cenario();
    const confirmada = await inscricao(event.id, "CONFIRMED", "ho-a");
    const cancelada = await inscricao(event.id, "CANCELLED", "ho-b");

    const c = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${cancelada.id}` });
    const ok = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${confirmada.id}` });

    expect(c.json().data).toMatchObject({ status: "CANCELLED", qrToken: null });
    expect(c.body).not.toContain(cancelada.qrToken);
    expect(ok.json().data.qrToken).toBe(confirmada.qrToken);
  });
});

describe("porta do Hands On: inscrição cancelada não entra", () => {
  it("recusa o QR (e o id) de uma inscrição cancelada e ela continua cancelada", async () => {
    // Pega: o check-in aceitar o cancelado E regravar a inscrição como
    // CONFIRMED (recordCheckin grava CONFIRMED sempre) — quem perdeu a vaga
    // (workshop lotou, duplicidade) entraria e ainda ressuscitaria a inscrição.
    const { event } = await cenario();
    const cancelada = await inscricao(event.id, "CANCELLED", "ho-b");
    const admin = await loginAsAdmin();

    const porToken = await lerNaPorta(event.id, admin, { qrToken: cancelada.qrToken });
    const porId = await lerNaPorta(event.id, admin, { id: cancelada.id });

    for (const res of [porToken, porId]) {
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toMatch(/cancelad/i);
    }
    const depois = await prisma.handsOnRegistration.findUniqueOrThrow({ where: { id: cancelada.id } });
    expect(depois.status).toBe("CANCELLED");
    expect(depois.checkedInAt).toBeNull();
  });

  it("a inscrição confirmada continua entrando, e ler de novo avisa que já entrou", async () => {
    // Pega: a recusa pegar também quem está confirmado (quebraria a porta).
    const { event } = await cenario();
    const confirmada = await inscricao(event.id, "CONFIRMED", "ho-a");
    const admin = await loginAsAdmin();

    const primeira = await lerNaPorta(event.id, admin, { qrToken: confirmada.qrToken });
    const segunda = await lerNaPorta(event.id, admin, { qrToken: confirmada.qrToken });

    expect(primeira.statusCode).toBe(200);
    expect(primeira.json().data.alreadyCheckedIn).toBe(false);
    expect(segunda.json().data.alreadyCheckedIn).toBe(true);
    expect((await prisma.handsOnRegistration.findUniqueOrThrow({ where: { id: confirmada.id } })).checkedInAt).not.toBeNull();
  });
});
