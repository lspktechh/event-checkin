import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, createTestRole, createTestUserWithRole, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function loginAsAdmin(): Promise<string> {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
  return res.json().data.token as string;
}

async function loginWithPermissions(permissionKeys: string[]): Promise<string> {
  const role = await createTestRole(`ROLE_${Math.random().toString(36).slice(2, 8)}`, permissionKeys);
  const email = `op_${Math.random().toString(36).slice(2, 8)}@teste.com`;
  const { password } = await createTestUserWithRole(role.id, email);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data.token as string;
}

function pendente(eventId: string, n: number, amount: number, status: "PENDING" | "CANCELLED" = "PENDING") {
  return prisma.inscription.create({
    data: {
      eventId,
      name: `Pessoa ${n}`,
      email: `pessoa${n}@exemplo.com`,
      document: `000.000.000-${String(n).padStart(2, "0")}`,
      category: "1º Lote",
      amount,
      status,
      paymentExpiresAt: new Date(Date.now() + 3600_000),
    },
  });
}

function gerarQr(eventId: string, token: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/inscriptions/confirm-courtesies`,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("COPOL: gerar o QR das cortesias que ficaram pendentes", () => {
  it("confirma só as de valor zero, gera participante com QR e marca como cortesia", async () => {
    // Pega: confirmar o que não é cortesia (quem vai pagar), reativar
    // cancelada, ou confirmar sem criar o participante (e portanto sem QR).
    const event = await createTestEvent({ name: "3º COPOL" });
    const admin = await loginAsAdmin();
    const c1 = await pendente(event.id, 1, 0);
    const c2 = await pendente(event.id, 2, 0);
    const aPagar = await pendente(event.id, 3, 150);
    const cancelada = await pendente(event.id, 4, 0, "CANCELLED");

    const res = await gerarQr(event.id, admin);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.confirmed).toBe(2);
    for (const c of [c1, c2]) {
      const depois = await prisma.inscription.findUniqueOrThrow({ where: { id: c.id } });
      expect(depois).toMatchObject({ status: "CONFIRMED", isCourtesy: true });
      const participante = await prisma.participant.findUniqueOrThrow({ where: { id: depois.participantId! } });
      expect(participante).toMatchObject({ isCourtesy: true, status: "ACTIVE" });
      expect(participante.qrToken).toBeTruthy();
    }
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: aPagar.id } })).status).toBe("PENDING");
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: cancelada.id } })).status).toBe("CANCELLED");
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(2);
  });

  it("o QR gerado credencia a cortesia", async () => {
    // Pega: gerar o participante mas deixar o QR inutilizável na leitura.
    const event = await createTestEvent({ name: "3º COPOL" });
    const admin = await loginAsAdmin();
    await pendente(event.id, 1, 0);
    await gerarQr(event.id, admin);
    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });

    const leitura = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins/admin`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { qrToken: participante.qrToken },
    });

    expect(leitura.statusCode).toBe(201);
    expect(leitura.json().data.status).toBe("CONFIRMED");
  });

  it("não duplica quem já está no evento: pula e informa", async () => {
    // Pega: criar um segundo participante (e um segundo QR/e-mail) para quem
    // já foi credenciado por outra inscrição.
    const event = await createTestEvent({ name: "3º COPOL" });
    const admin = await loginAsAdmin();
    await prisma.participant.create({
      data: { eventId: event.id, name: "Pessoa 1", email: "pessoa1@exemplo.com", qrToken: "evt_ja_existe" },
    });
    const repetida = await pendente(event.id, 1, 0);

    const res = await gerarQr(event.id, admin);

    expect(res.json().data.confirmed).toBe(0);
    expect(res.json().data.skipped).toEqual([expect.objectContaining({ id: repetida.id, reason: expect.stringMatching(/já está/i) })]);
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: repetida.id } })).status).toBe("PENDING");
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("rodar de novo não faz nada (idempotente)", async () => {
    // Pega: o botão clicado duas vezes gerando participantes repetidos.
    const event = await createTestEvent({ name: "3º COPOL" });
    const admin = await loginAsAdmin();
    await pendente(event.id, 1, 0);

    const primeira = await gerarQr(event.id, admin);
    const segunda = await gerarQr(event.id, admin);

    expect(primeira.json().data.confirmed).toBe(1);
    expect(segunda.json().data.confirmed).toBe(0);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("em evento que não é do COPOL não faz nada", async () => {
    // Pega: a ação vazar para os outros eventos, que devem ficar como estão.
    const event = await createTestEvent({ name: "Congresso de Odontologia" });
    const admin = await loginAsAdmin();
    const c1 = await pendente(event.id, 1, 0);

    const res = await gerarQr(event.id, admin);

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("SO_COPOL");
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: c1.id } })).status).toBe("PENDING");
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("exige participants.edit", async () => {
    // Pega: rota sem permissão, deixando uma conta de leitura gerar ingressos.
    const event = await createTestEvent({ name: "3º COPOL" });
    const leitor = await loginWithPermissions(["participants.view"]);
    await pendente(event.id, 1, 0);

    const res = await gerarQr(event.id, leitor);

    expect(res.statusCode).toBe(403);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(0);
  });
});
