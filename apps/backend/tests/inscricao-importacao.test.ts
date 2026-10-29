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

async function eventoComLote(opts: { price?: number; maxQuantity?: number | null } = {}) {
  const evento = await createTestEvent({ name: "3º COPOL" });
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

function importar(eventId: string, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/inscriptions/import`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

const csv = (...linhas: string[]) => ["nome,email,telefone,documento", ...linhas].join("\n");

describe("importação de inscrições por CSV", () => {
  it("pré-visualização classifica as linhas e não grava nada", async () => {
    // Pega: o preview gravando (regra da seção 20: nunca importar às
    // cegas) ou classificando errado o que a pessoa vai ver antes de confirmar.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    // Quem já está no evento (participante ativo, cadastrado em outra aba).
    await prisma.participant.create({
      data: { eventId: evento.id, name: "Já Está", email: "ja@exemplo.com", document: "999.999.999-99", qrToken: "tok-ja-esta" },
    });

    const res = await importar(evento.id, token, {
      csv: csv(
        "Ana Lima,ana@exemplo.com,43911112222,111.111.111-11", // ok
        "Sem Email,,43900000000,222.222.222-22", // sem e-mail
        "Sem Cpf,semcpf@exemplo.com,43900000001,", // sem CPF
        "Ana De Novo,ANA@exemplo.com,43900000002,333.333.333-33", // e-mail repetido no arquivo
        "Outro Nome,outro@exemplo.com,43900000003,11111111111", // CPF repetido no arquivo (outra máscara)
        "Já Está De Novo,novo-email@exemplo.com,43900000004,99999999999", // já no evento (CPF)
      ),
      confirm: false,
    });

    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    expect(d.totalRows).toBe(6);
    expect(d.validCount).toBe(1);
    expect(d.invalidCount).toBe(2);
    expect(d.duplicateCount).toBe(3);
    expect(d.imported).toBe(0);
    expect(d.rows.map((r: { status: string }) => r.status)).toEqual([
      "valid",
      "invalid",
      "invalid",
      "duplicate",
      "duplicate",
      "duplicate",
    ]);
    expect(await prisma.inscription.count({ where: { eventId: evento.id } })).toBe(0);
  });

  it("confirmar com cortesia grava inscrições de valor zero, com participante e QR", async () => {
    // Pega: a opção "cortesia" ignorada na hora de gravar, ou a linha
    // gravada sem passar pela confirmação (sem participante/QR).
    const { evento, lote } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();

    const res = await importar(evento.id, token, {
      csv: csv("Ana Lima,ana@exemplo.com,43911112222,111.111.111-11", "Beto Reis,beto@exemplo.com,,222.222.222-22"),
      confirm: true,
      cortesia: true,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.imported).toBe(2);
    const inscricoes = await prisma.inscription.findMany({ where: { eventId: evento.id } });
    expect(inscricoes).toHaveLength(2);
    for (const ins of inscricoes) {
      expect(Number(ins.amount)).toBe(0);
      expect(ins.status).toBe("CONFIRMED");
      expect(ins.isCourtesy).toBe(true);
      expect(ins.batchId).toBe(lote.id);
      expect(ins.participantId).not.toBeNull();
    }
    const participantes = await prisma.participant.findMany({ where: { eventId: evento.id } });
    expect(participantes).toHaveLength(2);
    expect(participantes.every((p) => p.isCourtesy && p.qrToken)).toBe(true);
  });

  it("confirmar sem cortesia cobra o preço do lote como pagamento manual", async () => {
    // Pega: a importação tratando tudo como cortesia por padrão e
    // sumindo com a receita.
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();

    const res = await importar(evento.id, token, {
      csv: csv("Ana Lima,ana@exemplo.com,43911112222,111.111.111-11"),
      confirm: true,
    });

    expect(res.json().data.imported).toBe(1);
    const ins = await prisma.inscription.findFirstOrThrow({ where: { eventId: evento.id } });
    expect(Number(ins.amount)).toBe(150);
    expect(ins.isCourtesy).toBe(false);
    expect(ins.paymentProvider).toBe("MANUAL");
  });

  it("não passa do limite do lote: as linhas sem vaga ficam de fora e o preview já avisa", async () => {
    // Pega: a importação estourando o teto do lote (cortesia também ocupa
    // vaga), ou o preview prometendo mais do que a confirmação entrega.
    const { evento, lote } = await eventoComLote({ maxQuantity: 2 });
    const token = await loginAsAdmin();
    const arquivo = csv(
      "Um,um@exemplo.com,,111.111.111-11",
      "Dois,dois@exemplo.com,,222.222.222-22",
      "Tres,tres@exemplo.com,,333.333.333-33",
    );

    const preview = await importar(evento.id, token, { csv: arquivo, confirm: false, cortesia: true });
    expect(preview.json().data.validCount).toBe(2);
    expect(preview.json().data.rows[2].status).toBe("invalid");
    expect(preview.json().data.rows[2].reason).toMatch(/vaga/i);

    const confirmado = await importar(evento.id, token, { csv: arquivo, confirm: true, cortesia: true });
    expect(confirmado.statusCode).toBe(200);
    expect(confirmado.json().data.imported).toBe(2);
    expect(await prisma.inscription.count({ where: { batchId: lote.id } })).toBe(2);
    expect(await prisma.participant.count({ where: { eventId: evento.id } })).toBe(2);
  });

  it("importar o mesmo arquivo duas vezes não duplica ninguém", async () => {
    // Pega: reimportação (clique repetido, arquivo reenviado) criando
    // segundo participante, segundo QR e segundo e-mail para cada pessoa.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const arquivo = csv("Ana Lima,ana@exemplo.com,43911112222,111.111.111-11");

    await importar(evento.id, token, { csv: arquivo, confirm: true, cortesia: true });
    const segunda = await importar(evento.id, token, { csv: arquivo, confirm: true, cortesia: true });

    expect(segunda.json().data.imported).toBe(0);
    expect(segunda.json().data.duplicateCount).toBe(1);
    expect(await prisma.participant.count({ where: { eventId: evento.id } })).toBe(1);
  });

  it("exige participants.create", async () => {
    // Pega: rota sem permissão, deixando uma conta de leitura criar
    // ingressos em lote.
    const { evento } = await eventoComLote();
    const token = await loginWithPermissions(["participants.view"]);

    const res = await importar(evento.id, token, {
      csv: csv("Ana Lima,ana@exemplo.com,,111.111.111-11"),
      confirm: true,
      cortesia: true,
    });

    expect(res.statusCode).toBe(403);
    expect(await prisma.inscription.count({ where: { eventId: evento.id } })).toBe(0);
  });
});
