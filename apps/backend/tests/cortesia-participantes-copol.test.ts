import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

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

async function copol(maxQuantity: number | null = null) {
  const event = await createTestEvent({ name: "3º COPOL" });
  await prisma.eventBatch.create({
    data: { eventId: event.id, batchNumber: 1, name: "1º Lote", price: 150, isActive: true, maxQuantity },
  });
  return event;
}

async function outroEvento() {
  const event = await createTestEvent({ name: "Congresso de Odontologia" });
  await prisma.eventBatch.create({
    data: { eventId: event.id, batchNumber: 1, name: "1º Lote", price: 150, isActive: true },
  });
  return event;
}

function criar(eventId: string, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/participants`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

function importar(eventId: string, token: string, csv: string, confirm: boolean, cortesia: boolean) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/participants/import`,
    headers: { authorization: `Bearer ${token}` },
    payload: { csv, confirm, cortesia },
  });
}

function relatorioInscritos(eventId: string, token: string) {
  return app.inject({
    method: "GET",
    url: `/events/${eventId}/inscriptions/report`,
    headers: { authorization: `Bearer ${token}` },
  });
}

const convidado = { name: "Convidada da Mesa", email: "convidada@exemplo.com", document: "111.222.333-44" };

describe("COPOL: cortesia criada na aba Participantes também entra em Inscritos", () => {
  it("cria a inscrição (confirmada, valor zero, cortesia) e o participante com QR, e aparece em Inscritos", async () => {
    // Pega: continuar criando só o participante solto, que nunca aparece na
    // aba Inscritos (o relatório lê das inscrições).
    const event = await copol();
    const admin = await loginAsAdmin();

    const res = await criar(event.id, admin, { ...convidado, cortesia: true });

    expect(res.statusCode).toBe(201);
    const participante = await prisma.participant.findFirstOrThrow({ where: { eventId: event.id } });
    expect(res.json().data).toMatchObject({ id: participante.id, qrToken: participante.qrToken, isCourtesy: true });
    expect(participante.qrToken).toBeTruthy();
    const inscricao = await prisma.inscription.findFirstOrThrow({ where: { eventId: event.id } });
    expect(inscricao).toMatchObject({ status: "CONFIRMED", isCourtesy: true, participantId: participante.id });
    expect(Number(inscricao.amount)).toBe(0);

    const relatorio = await relatorioInscritos(event.id, admin);
    const linha = relatorio.json().data.find((r: { email: string }) => r.email === convidado.email);
    expect(linha).toMatchObject({ isCourtesy: true, status: "CONFIRMED" });
  });

  it("o QR dessa cortesia credencia", async () => {
    // Pega: gerar o par inscrição/participante mas deixar o QR inutilizável.
    const event = await copol();
    const admin = await loginAsAdmin();
    const res = await criar(event.id, admin, { ...convidado, cortesia: true });

    const leitura = await app.inject({
      method: "POST",
      url: `/events/${event.id}/checkins/admin`,
      headers: { authorization: `Bearer ${admin}` },
      payload: { qrToken: res.json().data.qrToken },
    });

    expect(leitura.statusCode).toBe(201);
    expect(leitura.json().data.status).toBe("CONFIRMED");
  });

  it("ocupa vaga do lote (cortesia conta como vaga)", async () => {
    // Pega: contornar o teto do lote só por entrar pela aba Participantes.
    const event = await copol(1);
    const admin = await loginAsAdmin();
    await criar(event.id, admin, { ...convidado, cortesia: true });

    const segunda = await criar(event.id, admin, {
      name: "Outra Pessoa",
      email: "outra@exemplo.com",
      document: "555.666.777-88",
      cortesia: true,
    });

    expect(segunda.statusCode).toBe(409);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("exige e-mail e CPF, porque a inscrição precisa dos dois", async () => {
    // Pega: aceitar cortesia sem e-mail/CPF e criar inscrição incompleta
    // (ou voltar ao participante solto escondido).
    const event = await copol();
    const admin = await loginAsAdmin();

    const semEmail = await criar(event.id, admin, { name: "Sem Email", document: "111.222.333-44", cortesia: true });
    const semCpf = await criar(event.id, admin, { name: "Sem Cpf", email: "semcpf@exemplo.com", cortesia: true });

    expect(semEmail.statusCode).toBe(422);
    expect(semCpf.statusCode).toBe(422);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("não duplica quem já está no evento", async () => {
    // Pega: gerar um segundo QR para a mesma pessoa.
    const event = await copol();
    const admin = await loginAsAdmin();
    await criar(event.id, admin, { ...convidado, cortesia: true });

    const repetida = await criar(event.id, admin, { ...convidado, name: "Mesma Pessoa", cortesia: true });

    expect(repetida.statusCode).toBe(409);
    expect(repetida.json().error.code).toBe("JA_INSCRITO");
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("participante comum (sem cortesia) continua sendo só participante", async () => {
    // Pega: o desvio pegar também quem não é cortesia.
    const event = await copol();
    const admin = await loginAsAdmin();

    const res = await criar(event.id, admin, { name: "Pessoa Comum" });

    expect(res.statusCode).toBe(201);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("COPOL: cortesia importada na aba Participantes também entra em Inscritos", () => {
  const csv = ["nome,email,telefone,documento", "Ana Souza,ana@exemplo.com,,111.111.111-11", "Bia Lima,bia@exemplo.com,,222.222.222-22"].join("\n");

  it("grava inscrição + participante com QR para cada linha", async () => {
    // Pega: importar só participantes soltos, que não aparecem em Inscritos.
    const event = await copol();
    const admin = await loginAsAdmin();

    const res = await importar(event.id, admin, csv, true, true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data.imported).toBe(2);
    const inscricoes = await prisma.inscription.findMany({ where: { eventId: event.id } });
    expect(inscricoes).toHaveLength(2);
    for (const i of inscricoes) {
      expect(i).toMatchObject({ status: "CONFIRMED", isCourtesy: true });
      expect(i.participantId).toBeTruthy();
    }
    const participantes = await prisma.participant.findMany({ where: { eventId: event.id } });
    expect(participantes).toHaveLength(2);
    for (const p of participantes) expect(p.qrToken).toBeTruthy();
  });

  it("a prévia não grava nada e já aponta linha sem CPF", async () => {
    // Pega: gravar na prévia, ou deixar passar linha que a inscrição recusaria.
    const event = await copol();
    const admin = await loginAsAdmin();
    const semCpf = ["nome,email,telefone,documento", "Ana Souza,ana@exemplo.com,,111.111.111-11", "Sem Cpf,semcpf@exemplo.com,,"].join("\n");

    const res = await importar(event.id, admin, semCpf, false, true);

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ imported: 0, validCount: 1, invalidCount: 1 });
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("importação sem cortesia continua gravando só participantes", async () => {
    // Pega: o desvio pegar também a importação comum.
    const event = await copol();
    const admin = await loginAsAdmin();

    const res = await importar(event.id, admin, csv, true, false);

    expect(res.json().data.imported).toBe(2);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(2);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("outros eventos continuam exatamente como estão", () => {
  it("cortesia criada na aba Participantes: só o participante, sem inscrição e sem exigir e-mail/CPF", async () => {
    // Pega: a regra do COPOL vazar para os outros eventos.
    const event = await outroEvento();
    const admin = await loginAsAdmin();

    const res = await criar(event.id, admin, { name: "Convidado da Mesa", cortesia: true });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.isCourtesy).toBe(true);
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(1);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("cortesia importada na aba Participantes: só participantes, sem inscrição", async () => {
    const event = await outroEvento();
    const admin = await loginAsAdmin();
    const semCpf = ["nome,email,telefone,documento", "Ana Souza,,,", "Bia Lima,,,"].join("\n");

    const res = await importar(event.id, admin, semCpf, true, true);

    expect(res.json().data.imported).toBe(2);
    expect(await prisma.participant.count({ where: { eventId: event.id, isCourtesy: true } })).toBe(2);
    expect(await prisma.inscription.count({ where: { eventId: event.id } })).toBe(0);
  });
});
