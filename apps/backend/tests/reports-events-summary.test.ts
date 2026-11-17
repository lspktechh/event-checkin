import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createTestAdmin,
  createTestEvent,
  createTestParticipant,
  createTestRole,
  createTestUserWithRole,
  resetDatabase,
} from "./helpers.js";

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

async function loginWith(permissionKeys: string[], allowedEventIds: string[] = []): Promise<string> {
  const role = await createTestRole(`ROLE_${Math.random().toString(36).slice(2, 8)}`, permissionKeys);
  const email = `op_${Math.random().toString(36).slice(2, 8)}@teste.com`;
  const { user, password } = await createTestUserWithRole(role.id, email);
  if (allowedEventIds.length > 0) await prisma.user.update({ where: { id: user.id }, data: { allowedEventIds } });
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data.token as string;
}

function resumo(token: string | null, eventIds: unknown) {
  return app.inject({
    method: "POST",
    url: "/reports/events-summary",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: { eventIds },
  });
}

let n = 0;
const inscricao = (eventId: string, status: "PENDING" | "CONFIRMED" | "CANCELLED", amount: number, isCourtesy = false) => {
  n += 1;
  return prisma.inscription.create({
    data: {
      eventId,
      name: `Pessoa ${n}`,
      email: `pessoa${n}@exemplo.com`,
      document: `000.000.000-${String(n).padStart(2, "0")}`,
      category: "1º Lote",
      amount,
      status,
      isCourtesy,
    },
  });
};

/** Evento com números conhecidos: tudo o que o relatório conta. */
async function eventoComDados(name: string) {
  const event = await createTestEvent({ name });
  await inscricao(event.id, "CONFIRMED", 150);
  await inscricao(event.id, "CONFIRMED", 100.5);
  await inscricao(event.id, "CONFIRMED", 0, true);
  await inscricao(event.id, "PENDING", 150); // pendente não entra na receita
  await inscricao(event.id, "CANCELLED", 150); // cancelada não entra na receita
  const p1 = await createTestParticipant(event.id, { name: "P1" });
  const p2 = await createTestParticipant(event.id, { name: "P2" });
  await createTestParticipant(event.id, { name: "P3" });
  await createTestParticipant(event.id, { name: "P4 cancelado", status: "CANCELLED" });
  // p1 veio em dois dias (duas linhas de presença) e conta UMA vez; p2 veio uma vez.
  const base = { eventId: event.id, source: "ONLINE" as const, checkedInAt: new Date("2026-11-05T13:00:00Z") };
  await prisma.checkIn.create({ data: { ...base, participantId: p1.id, dayIndex: 1 } });
  await prisma.checkIn.create({ data: { ...base, participantId: p1.id, dayIndex: 2 } });
  await prisma.checkIn.create({ data: { ...base, participantId: p2.id, dayIndex: 1 } });
  for (const [i, status] of (["GENERATED", "ELIGIBLE", "REVOKED"] as const).entries()) {
    const p = await createTestParticipant(event.id, { name: `Cert ${i}` });
    await prisma.certificate.create({
      data: { eventId: event.id, participantId: p.id, status, verificationCode: `cod-${event.id.slice(0, 6)}-${i}` },
    });
  }
  for (const [i, status] of (["SUBMITTED", "APPROVED", "DRAFT"] as const).entries()) {
    await prisma.submission.create({
      data: { eventId: event.id, code: `T-${event.id.slice(0, 6)}-${i}`, title: `Trabalho ${i}`, abstract: "resumo", status },
    });
  }
  return event;
}

describe("POST /reports/events-summary — relatório geral de eventos", () => {
  it("conta inscrições, pessoas, presentes, certificados, trabalhos e receita de cada evento", async () => {
    // Pega: contar linhas de presença como pessoas, somar receita de pendente/cancelada,
    // contar participante cancelado como ativo ou rascunho como trabalho submetido.
    const a = await eventoComDados("Evento Dados");
    const vazio = await createTestEvent({ name: "Evento Vazio" });
    const admin = await loginAsAdmin();

    const res = await resumo(admin, [a.id, vazio.id]);

    expect(res.statusCode).toBe(200);
    const d = res.json().data;
    const linhaA = d.events.find((e: { eventId: string }) => e.eventId === a.id);
    expect(linhaA).toMatchObject({
      name: "Evento Dados",
      status: "ACTIVE",
      inscriptions: { total: 5, confirmed: 3, pending: 1, cancelled: 1, courtesy: 1, revenue: 250.5 },
      // P1, P2, P3 + 3 com certificado = 6 ativos; o cancelado fica de fora.
      participants: 6,
      present: 2,
      certificates: { generated: 1, eligible: 1, revoked: 1 },
      submissions: 2,
    });
    const linhaVazio = d.events.find((e: { eventId: string }) => e.eventId === vazio.id);
    expect(linhaVazio).toMatchObject({
      inscriptions: { total: 0, confirmed: 0, pending: 0, cancelled: 0, courtesy: 0, revenue: 0 },
      participants: 0,
      present: 0,
      certificates: { generated: 0, eligible: 0, revoked: 0 },
      submissions: 0,
    });
    expect(d.totals).toMatchObject({ events: 2, participants: 6, present: 2, submissions: 2 });
    expect(d.totals.inscriptions.revenue).toBe(250.5);
  });

  it("devolve o Markdown pronto, coerente com os números", async () => {
    const a = await eventoComDados("Evento Dados");
    const admin = await loginAsAdmin();

    const res = await resumo(admin, [a.id]);

    const md = res.json().data.markdown as string;
    expect(md).toContain("# Relatório geral de eventos");
    expect(md).toContain("| Receita confirmada (R$) | 250,50 |");
    expect(md).toContain("| Evento Dados |");
    expect(md).toContain("| Taxa de presença | 33,3% |");
  });

  it("só entram os eventos pedidos", async () => {
    // Pega: devolver todos os eventos do banco (o COPOL entraria sem querer).
    const incluido = await eventoComDados("Evento Incluído");
    const fora = await eventoComDados("Evento de Fora");
    const admin = await loginAsAdmin();

    const res = await resumo(admin, [incluido.id]);

    const d = res.json().data;
    expect(d.events.map((e: { eventId: string }) => e.eventId)).toEqual([incluido.id]);
    expect(d.markdown).not.toContain("Evento de Fora");
    expect(d.totals.events).toBe(1);
    expect(fora.id).not.toBe(incluido.id);
  });

  it("não aceita lista vazia nem ids inválidos", async () => {
    const admin = await loginAsAdmin();

    expect((await resumo(admin, [])).statusCode).toBe(422);
    expect((await resumo(admin, ["nao-e-uuid"])).statusCode).toBe(422);
    expect((await resumo(admin, undefined)).statusCode).toBe(422);
  });

  it("evento que não existe responde 404 e não gera relatório parcial", async () => {
    const a = await createTestEvent({ name: "Existe" });
    const admin = await loginAsAdmin();

    const res = await resumo(admin, [a.id, "00000000-0000-4000-8000-000000000000"]);

    expect(res.statusCode).toBe(404);
  });

  it("repetir o mesmo evento na lista não conta duas vezes", async () => {
    // Pega: somar o mesmo evento duas vezes nos totais.
    const a = await eventoComDados("Evento Dados");
    const admin = await loginAsAdmin();

    const res = await resumo(admin, [a.id, a.id]);

    expect(res.json().data.totals.events).toBe(1);
    expect(res.json().data.totals.inscriptions.total).toBe(5);
  });

  it("exige login e a permissão reports.view", async () => {
    // Pega: rota aberta, ou liberada para quem só tem outras permissões.
    const a = await createTestEvent({ name: "Evento" });
    const semPermissao = await loginWith(["events.view", "participants.view"]);
    const comPermissao = await loginWith(["reports.view"]);

    expect((await resumo(null, [a.id])).statusCode).toBe(401);
    expect((await resumo(semPermissao, [a.id])).statusCode).toBe(403);
    expect((await resumo(comPermissao, [a.id])).statusCode).toBe(200);
  });

  it("conta restrita a eventos só pode pedir os seus", async () => {
    // Pega: o relatório vazar números de evento a que a conta não tem acesso.
    const meu = await createTestEvent({ name: "Meu Evento" });
    const alheio = await createTestEvent({ name: "Evento Alheio" });
    const restrito = await loginWith(["reports.view"], [meu.id]);

    const ok = await resumo(restrito, [meu.id]);
    const negado = await resumo(restrito, [meu.id, alheio.id]);

    expect(ok.statusCode).toBe(200);
    expect(negado.statusCode).toBe(403);
    expect(negado.body).not.toContain("Evento Alheio");
  });
});
