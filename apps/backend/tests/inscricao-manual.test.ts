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

async function eventoComLote(opts: { price?: number; maxQuantity?: number | null; registrationsOpen?: boolean } = {}) {
  const evento = await createTestEvent({ name: "3º COPOL" });
  if (opts.registrationsOpen === false) {
    await prisma.event.update({ where: { id: evento.id }, data: { registrationsClosedAt: new Date() } });
  }
  const lote = await prisma.eventBatch.create({
    data: {
      eventId: evento.id,
      batchNumber: 1,
      name: "1º Lote",
      price: opts.price ?? 150,
      maxQuantity: opts.maxQuantity ?? null,
      isActive: true,
    },
  });
  return { evento, lote };
}

function manual(eventId: string, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/inscriptions/manual`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

const pessoa = {
  name: "Dra. Helena Prado",
  email: "helena@exemplo.com",
  document: "123.456.789-01",
  phone: "(43) 99999-0000",
};

describe("inscrição manual pelo painel (cortesia)", () => {
  it("cortesia vira inscrição confirmada de valor zero, com participante e QR", async () => {
    // Pega: cortesia que cobra o preço do lote, que fica PENDING sem QR,
    // ou que não deixa marca de ser cortesia.
    const { evento, lote } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();

    const res = await manual(evento.id, token, { ...pessoa, cortesia: true });

    expect(res.statusCode).toBe(201);
    const ins = await prisma.inscription.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(Number(ins.amount)).toBe(0);
    expect(ins.status).toBe("CONFIRMED");
    expect(ins.isCourtesy).toBe(true);
    expect(ins.batchId).toBe(lote.id);
    expect(ins.paymentMethod).toBeNull();

    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(participante.id).toBe(ins.participantId);
    expect(participante.qrToken).toBeTruthy();
    expect(participante.isCourtesy).toBe(true);
  });

  it("cortesia ocupa vaga do lote: com o lote cheio, a próxima é recusada", async () => {
    // Pega: cortesia criada sem lote (ou sem passar pela reserva de vaga),
    // que deixaria o evento passar do teto sem ninguém perceber.
    const { evento, lote } = await eventoComLote({ maxQuantity: 1 });
    const token = await loginAsAdmin();

    const primeira = await manual(evento.id, token, { ...pessoa, cortesia: true });
    expect(primeira.statusCode).toBe(201);

    const segunda = await manual(evento.id, token, {
      name: "Outro Convidado",
      email: "outro@exemplo.com",
      document: "987.654.321-00",
      cortesia: true,
    });
    expect(segunda.statusCode).toBe(409);
    expect(await prisma.inscription.count({ where: { batchId: lote.id } })).toBe(1);
    expect(await prisma.participant.count({ where: { eventId: evento.id } })).toBe(1);
  });

  it("sem cortesia: confirma pelo preço do lote como pagamento manual", async () => {
    // Pega: o interruptor ignorado (tudo virando cortesia) ou o valor
    // zerado, que sumiria com a receita.
    const { evento, lote } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();

    const res = await manual(evento.id, token, { ...pessoa, cortesia: false });

    expect(res.statusCode).toBe(201);
    const ins = await prisma.inscription.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(Number(ins.amount)).toBe(150);
    expect(ins.status).toBe("CONFIRMED");
    expect(ins.isCourtesy).toBe(false);
    expect(ins.batchId).toBe(lote.id);
    expect(ins.paymentProvider).toBe("MANUAL");

    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(participante.isCourtesy).toBe(false);
  });

  it("funciona com as inscrições públicas encerradas", async () => {
    // Pega: copiar do fluxo público a recusa por "inscrições encerradas" —
    // é justamente quando a organização mais adiciona convidados à mão.
    const { evento } = await eventoComLote({ registrationsOpen: false });
    const token = await loginAsAdmin();

    // Premissa do teste: o fluxo público de fato está fechado.
    const publica = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: { ...pessoa, consentVersion: "1.0" },
    });
    expect(publica.statusCode).toBe(403);

    const res = await manual(evento.id, token, { ...pessoa, cortesia: true });
    expect(res.statusCode).toBe(201);
  });

  it("recusa quem já está no evento, mesmo com CPF escrito de outro jeito", async () => {
    // Pega: duplo clique ou reenvio criando dois participantes (dois QR
    // codes e dois e-mails) para a mesma pessoa.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();

    expect((await manual(evento.id, token, { ...pessoa, cortesia: true })).statusCode).toBe(201);
    const repetida = await manual(evento.id, token, {
      ...pessoa,
      email: "outro-email@exemplo.com",
      document: "12345678901",
      cortesia: true,
    });

    expect(repetida.statusCode).toBe(409);
    expect(await prisma.participant.count({ where: { eventId: evento.id } })).toBe(1);
  });

  it("permite reinscrever quem teve a inscrição cancelada", async () => {
    // Pega: a trava de duplicado olhando participante cancelado, que
    // impediria a organização de readmitir alguém.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    await manual(evento.id, token, { ...pessoa, cortesia: true });
    const ins = await prisma.inscription.findFirstOrThrow({ where: { eventId: evento.id } });
    const cancelamento = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions/${ins.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cancelamento.statusCode).toBe(200);

    const denovo = await manual(evento.id, token, { ...pessoa, cortesia: true });
    expect(denovo.statusCode).toBe(201);
  });

  it("o relatório de inscritos diferencia cortesia de inscrição paga", async () => {
    // Pega: o relatório sem a marca — com lote, ele mostra o nome do lote
    // no lugar da categoria, então a tela não teria como exibir "Cortesia".
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    await manual(evento.id, token, { ...pessoa, cortesia: true });
    await manual(evento.id, token, {
      name: "Quem Pagou",
      email: "pagou@exemplo.com",
      document: "987.654.321-00",
      cortesia: false,
    });

    const res = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/inscriptions/report`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const porNome = Object.fromEntries(
      res.json().data.map((i: { name: string; isCourtesy: boolean; amount: number }) => [i.name, i]),
    );
    expect(porNome["Dra. Helena Prado"].isCourtesy).toBe(true);
    expect(porNome["Dra. Helena Prado"].amount).toBe(0);
    expect(porNome["Quem Pagou"].isCourtesy).toBe(false);
    expect(porNome["Quem Pagou"].amount).toBe(150);
  });

  it("exige participants.create", async () => {
    // Pega: rota sem permissão, abrindo a criação de ingressos de graça
    // para qualquer conta de leitura.
    const { evento } = await eventoComLote();
    const token = await loginWithPermissions(["participants.view"]);

    const res = await manual(evento.id, token, { ...pessoa, cortesia: true });

    expect(res.statusCode).toBe(403);
    expect(await prisma.inscription.count({ where: { eventId: evento.id } })).toBe(0);
  });

  it("recusa e-mail inválido e CPF vazio", async () => {
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();

    for (const ruim of [{ ...pessoa, email: "nao-e-email" }, { ...pessoa, document: "" }]) {
      const res = await manual(evento.id, token, { ...ruim, cortesia: true });
      expect(res.statusCode).toBe(422);
    }
    expect(await prisma.inscription.count({ where: { eventId: evento.id } })).toBe(0);
  });
});
