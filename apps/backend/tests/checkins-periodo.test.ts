import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import {
  createActiveTerminalWithToken,
  createTestAdmin,
  createTestEvent,
  createTestParticipant,
  resetDatabase,
} from "./helpers.js";

const app = buildApp();

// COPOL 2026: 05/11 07:30 a 07/11 22:00, horário de Brasília (UTC-3).
const COPOL_INICIO = new Date("2026-11-05T10:30:00Z");
const COPOL_FIM = new Date("2026-11-08T01:00:00Z");

// Dia 2 (06/11) em Brasília.
const DIA2_ANTES_DAS_730 = "2026-11-06T10:00:00Z"; // 07:00
const DIA2_MANHA = "2026-11-06T13:00:00Z"; // 10:00
const DIA2_MANHA_TARDE = "2026-11-06T14:00:00Z"; // 11:00
const DIA2_17_59_59 = "2026-11-06T20:59:59Z";
const DIA2_18_00_00 = "2026-11-06T21:00:00Z";
const DIA2_NOITE = "2026-11-06T21:30:00Z"; // 18:30
const DIA2_20H = "2026-11-06T23:00:00Z"; // 20:00
const DIA2_23_59_59 = "2026-11-07T02:59:59Z";
const DIA3_00_00_00 = "2026-11-07T03:00:00Z";

/** Congela só o relógio (Date) — o resto do runtime segue normal. */
function agora(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(async () => {
  vi.useRealTimers();
  await resetDatabase();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

async function copol() {
  const event = await createTestEvent({ name: "3º COPOL", startDate: COPOL_INICIO, endDate: COPOL_FIM });
  await prisma.event.update({ where: { id: event.id }, data: { multiDayCheckIn: true } });
  return event;
}

type Conta = { email: string; password: string };

/** Conta de administrador. O token dura 1h nos testes, então cada instante
 * simulado entra de novo (ver `entrarEm`). */
async function criarConta(): Promise<Conta> {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  return { email: user.email, password };
}

/** Põe o relógio no instante e entra: devolve um token válido NESSE instante. */
async function entrarEm(conta: Conta, iso: string): Promise<string> {
  agora(iso);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: conta });
  return res.json().data.token as string;
}

function ler(eventId: string, adminToken: string, qrToken: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/checkins/admin`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { qrToken },
  });
}

/** A câmera lê o QR naquele instante (relógio simulado + login do instante). */
async function lerEm(eventId: string, conta: Conta, iso: string, qrToken: string) {
  return ler(eventId, await entrarEm(conta, iso), qrToken);
}

const linhas = (eventId: string) =>
  prisma.checkIn.findMany({ where: { eventId }, orderBy: [{ dayIndex: "asc" }, { period: "asc" }] });

const MANHA = { index: 1, label: "Manhã", startsAt: "07:30" };
const NOITE = { index: 2, label: "Noite", startsAt: "18:00" };

describe("credenciamento por período — manhã e noite de cada dia", () => {
  it("o mesmo QR entra de manhã e de novo à noite no mesmo dia, cada um com o seu registro", async () => {
    // Pega: a regra de um credenciamento por dia, que faria a noite
    // responder "já credenciado" para quem entrou de manhã.
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const manha = await lerEm(event.id, conta, DIA2_MANHA, pessoa.qrToken);
    const noite = await lerEm(event.id, conta, DIA2_NOITE, pessoa.qrToken);

    expect(manha.statusCode).toBe(201);
    expect(manha.json().data.day).toEqual({ index: 2, total: 3, date: "2026-11-06", period: MANHA });
    expect(noite.statusCode).toBe(201);
    expect(noite.json().data.status).toBe("CONFIRMED");
    expect(noite.json().data.day).toEqual({ index: 2, total: 3, date: "2026-11-06", period: NOITE });
    expect((await linhas(event.id)).map((l) => [l.dayIndex, l.period])).toEqual([
      [2, 1],
      [2, 2],
    ]);
  });

  it("repetir na mesma manhã (ou na mesma noite) dá 'já credenciado' com o horário da primeira leitura", async () => {
    // Pega: a duplicidade deixar de existir dentro do período, ou devolver o
    // horário da segunda leitura.
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const primeira = await lerEm(event.id, conta, DIA2_MANHA, pessoa.qrToken);
    const segunda = await lerEm(event.id, conta, DIA2_MANHA_TARDE, pessoa.qrToken);

    expect(segunda.statusCode).toBe(200);
    expect(segunda.json().data.status).toBe("ALREADY_CHECKED_IN");
    expect(segunda.json().data.checkedInAt).toBe(primeira.json().data.checkedInAt);
    expect(segunda.json().data.day.period).toEqual(MANHA);

    await lerEm(event.id, conta, DIA2_NOITE, pessoa.qrToken);
    const repetidaNaNoite = await lerEm(event.id, conta, DIA2_20H, pessoa.qrToken);
    expect(repetidaNaNoite.json().data.status).toBe("ALREADY_CHECKED_IN");
    expect(repetidaNaNoite.json().data.day.period).toEqual(NOITE);
    expect(await linhas(event.id)).toHaveLength(2);
  });

  it("a borda das 18:00: 17:59:59 conta como manhã e 18:00:00 já é a noite", async () => {
    // Pega: errar o limite por um segundo (> em vez de >=) ou por uma hora de fuso.
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const antes = await lerEm(event.id, conta, DIA2_17_59_59, pessoa.qrToken);
    const depois = await lerEm(event.id, conta, DIA2_18_00_00, pessoa.qrToken);

    expect(antes.json().data.day.period).toEqual(MANHA);
    expect(depois.statusCode).toBe(201);
    expect(depois.json().data.day.period).toEqual(NOITE);
  });

  it("antes das 07:30 a leitura é aceita como manhã (ninguém é barrado por chegar cedo)", async () => {
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const res = await lerEm(event.id, conta, DIA2_ANTES_DAS_730, pessoa.qrToken);

    expect(res.statusCode).toBe(201);
    expect(res.json().data.day.period).toEqual(MANHA);
  });

  it("a virada da meia-noite: 23:59:59 é a noite do dia 2 e 00:00:00 é a manhã do dia 3", async () => {
    // Pega: o dia só virar depois do período, ou a noite "vazar" para o dia seguinte.
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const noiteDia2 = await lerEm(event.id, conta, DIA2_23_59_59, pessoa.qrToken);
    const manhaDia3 = await lerEm(event.id, conta, DIA3_00_00_00, pessoa.qrToken);

    expect(noiteDia2.json().data.day).toMatchObject({ index: 2, period: NOITE });
    expect(manhaDia3.statusCode).toBe(201);
    expect(manhaDia3.json().data.day).toMatchObject({ index: 3, period: MANHA });
    expect((await linhas(event.id)).map((l) => [l.dayIndex, l.period])).toEqual([
      [2, 2],
      [3, 1],
    ]);
  });

  it("duas câmeras lendo o mesmo QR ao mesmo tempo na mesma noite: só uma leitura entra", async () => {
    // Pega: a duplicidade conferida só no código, que deixa as duas passarem.
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();
    const admin = await entrarEm(conta, DIA2_NOITE);

    const [a, b] = await Promise.all([ler(event.id, admin, pessoa.qrToken), ler(event.id, admin, pessoa.qrToken)]);

    expect([a.json().data.status, b.json().data.status].sort()).toEqual(["ALREADY_CHECKED_IN", "CONFIRMED"]);
    expect(await linhas(event.id)).toHaveLength(1);
  });

  it("sincronização offline classifica pelo horário da LEITURA, não pelo da sincronização", async () => {
    // Pega: usar a hora em que o terminal sincronizou (tudo viraria noite).
    const event = await copol();
    const pessoa = await createTestParticipant(event.id);
    agora("2026-11-07T01:00:00Z"); // 22:00 de 06/11, a hora da sincronização
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const res = await app.inject({
      method: "POST",
      url: "/terminals/sync",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        checkIns: [
          { localCheckInId: "off-1", qrToken: pessoa.qrToken, checkedInAt: DIA2_MANHA },
          { localCheckInId: "off-2", qrToken: pessoa.qrToken, checkedInAt: DIA2_NOITE },
        ],
      },
    });

    expect(res.json().data.results.map((r: { status: string }) => r.status)).toEqual(["CONFIRMED", "CONFIRMED"]);
    expect((await linhas(event.id)).map((l) => [l.dayIndex, l.period])).toEqual([
      [2, 1],
      [2, 2],
    ]);
  });
});

describe("evento comum fica exatamente como era", () => {
  it("não tem período: um check-in por pessoa no evento e nenhuma informação de dia", async () => {
    // Pega: o período vazando para os outros eventos (segunda leitura à
    // noite deixaria de ser "já credenciado").
    const event = await createTestEvent({ name: "Congresso de Odontologia", startDate: COPOL_INICIO, endDate: COPOL_FIM });
    const pessoa = await createTestParticipant(event.id);
    const conta = await criarConta();

    const manha = await lerEm(event.id, conta, DIA2_MANHA, pessoa.qrToken);
    const noite = await lerEm(event.id, conta, DIA2_NOITE, pessoa.qrToken);

    expect(manha.statusCode).toBe(201);
    expect(manha.json().data.day ?? null).toBeNull();
    expect(noite.json().data.status).toBe("ALREADY_CHECKED_IN");
    const gravadas = await linhas(event.id);
    expect(gravadas).toHaveLength(1);
    expect([gravadas[0].dayIndex, gravadas[0].period]).toEqual([0, 0]);
  });
});

describe("números e relatório por dia e por período", () => {
  /** A: manhã e noite do dia 2. B: só a manhã do dia 2. "Agora" = noite. */
  async function cenario() {
    const event = await copol();
    const a = await createTestParticipant(event.id, { name: "Pessoa A" });
    const b = await createTestParticipant(event.id, { name: "Pessoa B" });
    const conta = await criarConta();
    await lerEm(event.id, conta, DIA2_MANHA, a.qrToken);
    await lerEm(event.id, conta, DIA2_MANHA, b.qrToken);
    const admin = await entrarEm(conta, DIA2_NOITE);
    await ler(event.id, admin, a.qrToken);
    return { event, admin, conta };
  }

  it("estatísticas: pessoas no dia, e quantas em cada período (hoje e por dia)", async () => {
    // Pega: contar linhas como pessoas (A apareceria duas vezes no dia) e o
    // leitor sem o contador do período.
    const { event, admin } = await cenario();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/statistics`,
      headers: { authorization: `Bearer ${admin}` },
    });

    const d = res.json().data;
    expect(d).toMatchObject({ totalRegistered: 2, totalCheckedIn: 2, totalAbsent: 0 });
    expect(d.multiDay.today).toMatchObject({ index: 2, checkedIn: 2, period: { ...NOITE, checkedIn: 1 } });
    expect(d.multiDay.today.periods).toEqual([
      { ...MANHA, checkedIn: 2 },
      { ...NOITE, checkedIn: 1 },
    ]);
    const dia2 = d.multiDay.perDay.find((x: { index: number }) => x.index === 2);
    expect(dia2).toMatchObject({ checkedIn: 2 });
    expect(dia2.periods).toEqual([
      { ...MANHA, checkedIn: 2 },
      { ...NOITE, checkedIn: 1 },
    ]);
    const dia1 = d.multiDay.perDay.find((x: { index: number }) => x.index === 1);
    expect(dia1.periods.map((p: { checkedIn: number }) => p.checkedIn)).toEqual([0, 0]);
  });

  it("relatório: cada linha diz o dia e o período, e traz a lista de dias e de períodos", async () => {
    // Pega: linhas sem período (a mesma pessoa duas vezes no dia sem dar para
    // saber qual é qual) e a tela sem como montar os botões por dia.
    const { event, admin } = await cenario();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/report`,
      headers: { authorization: `Bearer ${admin}` },
    });

    const d = res.json().data;
    expect(d.totalCheckedIn).toBe(2);
    expect(d.checkIns.map((r: { dayIndex: number; period: number }) => [r.dayIndex, r.period]).sort()).toEqual([
      [2, 1],
      [2, 1],
      [2, 2],
    ]);
    expect(d.days).toEqual([
      { index: 1, date: "2026-11-05" },
      { index: 2, date: "2026-11-06" },
      { index: 3, date: "2026-11-07" },
    ]);
    expect(d.periods).toEqual([MANHA, NOITE]);
  });

  it("relatório de evento comum não ganha dias nem períodos", async () => {
    // Pega: o bloco do modo por dia aparecendo em todo evento.
    const event = await createTestEvent({ name: "Congresso de Odontologia", startDate: COPOL_INICIO, endDate: COPOL_FIM });
    const conta = await criarConta();
    const admin = await entrarEm(conta, DIA2_MANHA);

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/report`,
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.json().data.days).toBeUndefined();
    expect(res.json().data.periods).toBeUndefined();
  });
});
