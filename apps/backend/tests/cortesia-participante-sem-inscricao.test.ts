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

/** Cortesia "antiga": criada na aba Participantes quando ela só gravava o
 * participante, sem inscrição — por isso não aparece em Inscritos. */
function cortesiaAntiga(
  eventId: string,
  n: number,
  extra: Partial<{ email: string | null; document: string | null; status: "ACTIVE" | "CANCELLED"; isCourtesy: boolean }> = {},
) {
  return prisma.participant.create({
    data: {
      eventId,
      name: `Convidado ${n}`,
      email: extra.email === undefined ? `convidado${n}@exemplo.com` : extra.email,
      document: extra.document === undefined ? `000.000.000-0${n}` : extra.document,
      qrToken: `evt_antigo_${n}`,
      isCourtesy: extra.isCourtesy ?? true,
      status: extra.status ?? "ACTIVE",
    },
  });
}

function incluir(eventId: string, token: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/participants/courtesies-to-inscriptions`,
    headers: { authorization: `Bearer ${token}` },
  });
}

async function copol() {
  const event = await createTestEvent({ name: "3º COPOL" });
  await prisma.eventBatch.create({
    data: { eventId: event.id, batchNumber: 1, name: "1º Lote", price: 150, isActive: true, maxQuantity: 1 },
  });
  return event;
}

describe("COPOL: cortesia que só existe como participante passa a constar em Inscritos", () => {
  it("cria a inscrição de cortesia ligada ao MESMO participante, e ela aparece no relatório de Inscritos", async () => {
    // Pega: continuar só no Participantes, ou criar um segundo participante
    // (e um segundo QR) para a mesma pessoa.
    const event = await copol();
    const admin = await loginAsAdmin();
    const antiga = await cortesiaAntiga(event.id, 1);

    const res = await incluir(event.id, admin);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.linked).toBe(1);
    const inscricao = await prisma.inscription.findFirstOrThrow({ where: { eventId: event.id } });
    expect(inscricao).toMatchObject({
      status: "CONFIRMED",
      isCourtesy: true,
      participantId: antiga.id,
      name: antiga.name,
      email: antiga.email,
      document: antiga.document,
    });
    expect(Number(inscricao.amount)).toBe(0);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: antiga.id } })).qrToken).toBe("evt_antigo_1");

    const relatorio = await app.inject({
      method: "GET",
      url: `/events/${event.id}/inscriptions/report`,
      headers: { authorization: `Bearer ${admin}` },
    });
    const linha = relatorio.json().data.find((r: { participantId: string }) => r.participantId === antiga.id);
    expect(linha).toMatchObject({ isCourtesy: true, status: "CONFIRMED", amount: 0, email: antiga.email });

    const lista = await app.inject({
      method: "GET",
      url: `/events/${event.id}/participants`,
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(lista.json().data.find((p: { id: string }) => p.id === antiga.id).hasInscription).toBe(true);
  });

  it("o QR que a pessoa já tinha continua credenciando", async () => {
    // Pega: mexer no participante (rotacionar QR, desativar) ao ligá-lo à inscrição.
    const event = await copol();
    const admin = await loginAsAdmin();
    await cortesiaAntiga(event.id, 1);
    await incluir(event.id, admin);

    const leitura = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins/admin`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { qrToken: "evt_antigo_1" },
    });

    expect(leitura.statusCode).toBe(201);
  });

  it("não consome vaga do lote: quem já estava no evento não passa a fechar as vendas", async () => {
    // Pega: o lote (teto de 1 vaga) encher só por trazer a cortesia antiga
    // para a lista, bloqueando a venda de ingressos.
    const event = await copol();
    const admin = await loginAsAdmin();
    await cortesiaAntiga(event.id, 1);

    await incluir(event.id, admin);

    const inscricao = await prisma.inscription.findFirstOrThrow({ where: { eventId: event.id } });
    expect(inscricao.batchId).toBeNull();
    const nova = await app.inject({
      method: "POST",
      url: `/events/${event.id}/inscriptions/manual`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: "Nova Pessoa", email: "nova@exemplo.com", document: "555.666.777-88", cortesia: false },
    });
    expect(nova.statusCode).toBe(201);
  });

  it("só pega cortesia ativa e sem inscrição: pagante, cancelada e já inscrita ficam como estão", async () => {
    // Pega: criar inscrição para quem não é cortesia, reativar cancelada, ou
    // duplicar a inscrição de quem já tem uma.
    const event = await copol();
    const admin = await loginAsAdmin();
    await cortesiaAntiga(event.id, 1, { isCourtesy: false });
    await cortesiaAntiga(event.id, 2, { status: "CANCELLED" });
    const jaInscrita = await cortesiaAntiga(event.id, 3);
    await prisma.inscription.create({
      data: {
        eventId: event.id,
        name: jaInscrita.name,
        email: jaInscrita.email!,
        document: jaInscrita.document!,
        category: "Cortesia",
        amount: 0,
        status: "CONFIRMED",
        isCourtesy: true,
        participantId: jaInscrita.id,
      },
    });

    const res = await incluir(event.id, admin);

    expect(res.json().data.linked).toBe(0);
    // Quem não é candidato nem aparece como "pulado": o aviso só lista o que
    // a organização precisa resolver.
    expect(res.json().data.skipped).toEqual([]);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("sem e-mail ou CPF não dá para criar a inscrição: pula, avisa o motivo e segue com as outras", async () => {
    // Pega: gravar inscrição com contato em branco, ou abortar tudo por causa
    // de uma pessoa.
    const event = await copol();
    const admin = await loginAsAdmin();
    const semEmail = await cortesiaAntiga(event.id, 1, { email: null });
    const semCpf = await cortesiaAntiga(event.id, 2, { document: null });
    await cortesiaAntiga(event.id, 3);

    const res = await incluir(event.id, admin);

    expect(res.json().data.linked).toBe(1);
    const puladas = res.json().data.skipped as { id: string; reason: string }[];
    expect(puladas.map((p) => p.id).sort()).toEqual([semEmail.id, semCpf.id].sort());
    for (const p of puladas) expect(p.reason).toMatch(/e-mail|CPF/i);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("não duplica quem já consta no evento com outra inscrição", async () => {
    // Pega: duas linhas para a mesma pessoa em Inscritos.
    const event = await copol();
    const admin = await loginAsAdmin();
    const antiga = await cortesiaAntiga(event.id, 1);
    await prisma.inscription.create({
      data: {
        eventId: event.id,
        name: "Mesma Pessoa",
        email: antiga.email!,
        document: "999.999.999-99",
        category: "1º Lote",
        amount: 150,
        status: "PENDING",
        paymentExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const res = await incluir(event.id, admin);

    expect(res.json().data.linked).toBe(0);
    expect(res.json().data.skipped).toEqual([expect.objectContaining({ id: antiga.id })]);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("rodar de novo não faz nada (idempotente)", async () => {
    // Pega: o botão clicado duas vezes criando inscrições repetidas.
    const event = await copol();
    const admin = await loginAsAdmin();
    await cortesiaAntiga(event.id, 1);

    const primeira = await incluir(event.id, admin);
    const segunda = await incluir(event.id, admin);

    expect(primeira.json().data.linked).toBe(1);
    expect(segunda.json().data.linked).toBe(0);
    expect(segunda.json().data.skipped).toEqual([]);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("em evento que não é do COPOL não faz nada", async () => {
    // Pega: a ação vazar para os outros eventos, que devem ficar como estão.
    const event = await createTestEvent({ name: "Congresso de Odontologia" });
    const admin = await loginAsAdmin();
    await cortesiaAntiga(event.id, 1);

    const res = await incluir(event.id, admin);

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("SO_COPOL");
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("exige participants.create", async () => {
    // Pega: rota sem permissão, deixando conta de leitura criar inscrições.
    const event = await copol();
    const leitor = await loginWithPermissions(["participants.view"]);
    await cortesiaAntiga(event.id, 1);

    const res = await incluir(event.id, leitor);

    expect(res.statusCode).toBe(403);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });
});
