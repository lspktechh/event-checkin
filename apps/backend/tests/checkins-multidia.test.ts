import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

/**
 * Evento de `days` dias começando daqui a `startOffsetDays` dias (pode ser
 * negativo). Início e fim têm o MESMO horário do dia, então o dia de
 * calendário de cada ponto é exato. Com `startOffsetDays: -1` e `days: 3`,
 * "agora" cai no dia 2 — dá para testar a leitura ao vivo sem mexer no
 * relógio; os dias 1 e 3 são lidos pela sincronização, que informa o
 * horário da leitura.
 */
async function criarEvento(opts: { startOffsetDays: number; days: number; multiDay: boolean }) {
  const start = new Date(Date.now() + opts.startOffsetDays * DAY);
  const end = new Date(start.getTime() + (opts.days - 1) * DAY);
  const event = await createTestEvent({ startDate: start, endDate: end });
  await prisma.event.update({ where: { id: event.id }, data: { multiDayCheckIn: opts.multiDay } });
  return { event, start };
}

const diaN = (start: Date, n: number) => new Date(start.getTime() + (n - 1) * DAY);

async function loginAsAdmin(): Promise<string> {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: user.email, password } });
  return res.json().data.token as string;
}

function lerNoTerminal(eventId: string, terminalToken: string, qrToken: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/checkins`,
    headers: { authorization: `Bearer ${terminalToken}` },
    payload: { qrToken },
  });
}

function lerNoPainel(eventId: string, adminToken: string, qrToken: string) {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/checkins/admin`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { qrToken },
  });
}

/** Leituras com horário informado (é o que a sincronização faz). */
function sincronizar(terminalToken: string, itens: { qrToken: string; quando: Date }[]) {
  return app.inject({
    method: "POST",
    url: "/terminals/sync",
    headers: { authorization: `Bearer ${terminalToken}` },
    payload: {
      checkIns: itens.map((i, n) => ({
        localCheckInId: `local-${Date.now()}-${n}-${Math.random().toString(36).slice(2, 6)}`,
        qrToken: i.qrToken,
        checkedInAt: i.quando.toISOString(),
      })),
    },
  });
}

const linhas = (eventId: string) => prisma.checkIn.findMany({ where: { eventId }, orderBy: { dayIndex: "asc" } });

describe("credenciamento por dia — evento com multiDayCheckIn", () => {
  it("o mesmo QR vale nos três dias, cada dia com o seu registro", async () => {
    // Pega: a regra antiga (um check-in por pessoa no evento inteiro), que
    // faria o dia 2 e o dia 3 responderem "já credenciado".
    const { event, start } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const dia1 = await sincronizar(token, [{ qrToken: pessoa.qrToken, quando: diaN(start, 1) }]);
    const dia2 = await lerNoTerminal(event.id, token, pessoa.qrToken); // agora = dia 2
    const dia3 = await sincronizar(token, [{ qrToken: pessoa.qrToken, quando: diaN(start, 3) }]);

    expect(dia1.json().data.results[0].status).toBe("CONFIRMED");
    expect(dia2.statusCode).toBe(201);
    expect(dia2.json().data.status).toBe("CONFIRMED");
    expect(dia3.json().data.results[0].status).toBe("CONFIRMED");
    expect((await linhas(event.id)).map((l) => [l.participantId, l.dayIndex])).toEqual([
      [pessoa.id, 1],
      [pessoa.id, 2],
      [pessoa.id, 3],
    ]);
  });

  it("repetir no mesmo dia dá 'já credenciado' com o horário da primeira leitura", async () => {
    // Pega: a duplicidade deixar de existir, ou devolver o horário da
    // segunda leitura em vez do da primeira.
    const { event } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const primeira = await lerNoTerminal(event.id, token, pessoa.qrToken);
    const segunda = await lerNoTerminal(event.id, token, pessoa.qrToken);

    expect(primeira.statusCode).toBe(201);
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json().data.status).toBe("ALREADY_CHECKED_IN");
    expect(segunda.json().data.checkedInAt).toBe(primeira.json().data.checkedInAt);
    expect(await linhas(event.id)).toHaveLength(1);
  });

  it("a resposta informa o dia (índice, total e data) para o leitor mostrar", async () => {
    // Pega: o leitor sem como mostrar "Dia 2 de 3".
    const { event } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const res = await lerNoTerminal(event.id, token, pessoa.qrToken);

    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    expect(res.json().data.day).toEqual({ index: 2, total: 3, date: hoje });
  });

  it("a câmera ao vivo do painel (rota admin) também registra por dia", async () => {
    // É o caminho que o COPOL usa de verdade. Pega: ajustar só a rota do
    // terminal e esquecer a do painel.
    const { event, start } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const admin = await loginAsAdmin();
    const { token } = await createActiveTerminalWithToken(app, event.id);
    await sincronizar(token, [{ qrToken: pessoa.qrToken, quando: diaN(start, 1) }]); // dia 1 já feito

    const hojeDia2 = await lerNoPainel(event.id, admin, pessoa.qrToken);
    const repetida = await lerNoPainel(event.id, admin, pessoa.qrToken);

    expect(hojeDia2.statusCode).toBe(201);
    expect(hojeDia2.json().data.day.index).toBe(2);
    expect(repetida.statusCode).toBe(200);
    expect(repetida.json().data.status).toBe("ALREADY_CHECKED_IN");
    expect((await linhas(event.id)).map((l) => l.dayIndex)).toEqual([1, 2]);
  });

  it("duas câmeras lendo o mesmo QR ao mesmo tempo: só uma leitura entra", async () => {
    // Pega: duplicidade só conferida no código (checar e depois gravar), que
    // deixa as duas passarem sob leitura simultânea.
    const { event } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const admin = await loginAsAdmin();

    const [a, b] = await Promise.all([
      lerNoPainel(event.id, admin, pessoa.qrToken),
      lerNoPainel(event.id, admin, pessoa.qrToken),
    ]);

    expect([a.json().data.status, b.json().data.status].sort()).toEqual(["ALREADY_CHECKED_IN", "CONFIRMED"]);
    expect(await linhas(event.id)).toHaveLength(1);
  });

  it("fora do período do evento: recusa, não grava e deixa registro da tentativa", async () => {
    // Pega: gravar a leitura num dia que não existe (ou no dia mais
    // próximo) quando alguém lê o QR antes do início ou depois do fim.
    const { event } = await criarEvento({ startOffsetDays: -8, days: 3, multiDay: true }); // acabou há 6 dias
    const pessoa = await createTestParticipant(event.id);
    const admin = await loginAsAdmin();
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const painel = await lerNoPainel(event.id, admin, pessoa.qrToken);
    const terminal = await lerNoTerminal(event.id, token, pessoa.qrToken);

    for (const res of [painel, terminal]) {
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("FORA_DO_PERIODO");
    }
    expect(await linhas(event.id)).toHaveLength(0);
    await vi.waitFor(async () => {
      const tentativas = await prisma.checkInAttempt.findMany({ where: { eventId: event.id } });
      expect(tentativas).toHaveLength(2);
      expect(tentativas[0].status).toBe("REJECTED");
      expect(tentativas[0].errorMessage).toMatch(/período/i);
    });
  });

  it("QR inexistente continua sendo 'credencial inválida', mesmo fora do período", async () => {
    // Pega: a checagem de período rodando antes da do QR e trocando a
    // mensagem que o operador entende.
    const { event } = await criarEvento({ startOffsetDays: -8, days: 3, multiDay: true });
    const admin = await loginAsAdmin();

    const res = await lerNoPainel(event.id, admin, "evt_nao-existe");

    expect(res.statusCode).toBe(404);
  });

  it("sincronização com horário fora do período é rejeitada item a item", async () => {
    // Pega: um item fora do período derrubando o lote inteiro, ou sendo
    // gravado num dia qualquer.
    const { event, start } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const dentro = await createTestParticipant(event.id, { name: "Dentro" });
    const fora = await createTestParticipant(event.id, { name: "Fora" });
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const res = await sincronizar(token, [
      { qrToken: dentro.qrToken, quando: diaN(start, 1) },
      { qrToken: fora.qrToken, quando: new Date(start.getTime() - 2 * DAY) },
    ]);

    const [a, b] = res.json().data.results;
    expect(a.status).toBe("CONFIRMED");
    expect(b.status).toBe("REJECTED");
    expect(b.code).toBe("FORA_DO_PERIODO");
    expect(await linhas(event.id)).toHaveLength(1);
  });
});

describe("evento comum (sem multiDayCheckIn) fica exatamente como era", () => {
  it("um check-in por pessoa no evento todo, em qualquer dia", async () => {
    // Pega: o modo por dia vazando para os outros eventos.
    const { event, start } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: false });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const hoje = await lerNoTerminal(event.id, token, pessoa.qrToken);
    const amanha = await sincronizar(token, [{ qrToken: pessoa.qrToken, quando: diaN(start, 3) }]);

    expect(hoje.statusCode).toBe(201);
    expect(hoje.json().data.day ?? null).toBeNull();
    expect(amanha.json().data.results[0].status).toBe("ALREADY_CHECKED_IN");
    const gravadas = await linhas(event.id);
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0].dayIndex).toBe(0);
  });

  it("não aplica a checagem de período: evento comum já encerrado ainda aceita leitura", async () => {
    // Pega: levar a recusa de "fora do período" para todos os eventos.
    const { event } = await criarEvento({ startOffsetDays: -20, days: 1, multiDay: false });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);

    const res = await lerNoTerminal(event.id, token, pessoa.qrToken);

    expect(res.statusCode).toBe(201);
  });
});

describe("números e documentos contam pessoas, não linhas de presença", () => {
  /** A presente nos dias 1 e 2; B presente só no dia 2 → 3 linhas, 2 pessoas. */
  async function cenario() {
    const { event, start } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: true });
    const a = await createTestParticipant(event.id, { name: "Pessoa A" });
    const b = await createTestParticipant(event.id, { name: "Pessoa B" });
    const { token } = await createActiveTerminalWithToken(app, event.id);
    await sincronizar(token, [{ qrToken: a.qrToken, quando: diaN(start, 1) }]);
    await lerNoTerminal(event.id, token, a.qrToken);
    await lerNoTerminal(event.id, token, b.qrToken);
    return { event, a, b, token };
  }

  it("estatísticas: presentes = pessoas, e traz o dia de hoje e o total por dia", async () => {
    // Pega: "presentes" contando linhas (3 de 2 inscritos → ausentes -1) ou
    // o leitor sem o contador do dia.
    const { event } = await cenario();
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/statistics`,
      headers: { authorization: `Bearer ${admin}` },
    });

    const d = res.json().data;
    expect(d).toMatchObject({ totalRegistered: 2, totalCheckedIn: 2, totalAbsent: 0, attendancePercentage: 100 });
    expect(d.multiDay.total).toBe(3);
    expect(d.multiDay.today).toMatchObject({ index: 2, checkedIn: 2 });
    expect(d.multiDay.perDay.map((x: { index: number; checkedIn: number }) => [x.index, x.checkedIn])).toEqual([
      [1, 1],
      [2, 2],
      [3, 0],
    ]);
  });

  it("estatísticas de evento comum não ganham nada novo", async () => {
    // Pega: o bloco do modo por dia aparecendo em todo evento.
    const { event } = await criarEvento({ startOffsetDays: -1, days: 3, multiDay: false });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);
    await lerNoTerminal(event.id, token, pessoa.qrToken);
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/statistics`,
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.json().data.multiDay).toBeUndefined();
    expect(res.json().data).toMatchObject({ totalRegistered: 1, totalCheckedIn: 1, totalAbsent: 0 });
  });

  it("relatório: presentes = pessoas; cada linha diz o dia", async () => {
    // Pega: "presentes" duplicado e linhas sem dia (a mesma pessoa aparece
    // duas vezes sem dar para saber qual é qual).
    const { event } = await cenario();
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/report`,
      headers: { authorization: `Bearer ${admin}` },
    });

    const d = res.json().data;
    expect(d.totalCheckedIn).toBe(2);
    expect(d.checkIns).toHaveLength(3);
    expect(d.checkIns.map((r: { dayIndex: number }) => r.dayIndex).sort()).toEqual([1, 2, 2]);
  });

  it("estatísticas do portal do participante: ausentes nunca fica negativo", async () => {
    // Pega: o contador do portal somando linhas (3 presenças em 2 inscritos).
    const { event } = await cenario();

    const res = await app.inject({ method: "GET", url: `/attendee/events/${event.id}/stats` });

    expect(res.json().data).toMatchObject({ total: 2, checkedIn: 2, absent: 0, percentage: 100 });
  });

  it("liberação de certificados em massa não duplica quem veio em mais de um dia", async () => {
    // Pega: a lista de presentes vir com a mesma pessoa 2x e o createMany
    // estourar a regra de um certificado por pessoa.
    const { event, start } = await criarEvento({ startOffsetDays: -10, days: 3, multiDay: true }); // já terminou
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);
    await sincronizar(token, [
      { qrToken: pessoa.qrToken, quando: diaN(start, 1) },
      { qrToken: pessoa.qrToken, quando: diaN(start, 2) },
    ]);
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/certificates/release`,
      headers: { authorization: `Bearer ${admin}` },
    });
    const stats = await app.inject({
      method: "GET",
      url: `/events/${event.id}/certificates/stats`,
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.createdCount).toBe(1);
    expect(await prisma.certificate.count({ where: { eventId: event.id } })).toBe(1);
    expect(stats.json().data.present).toBe(1);
  });

  it("certificado: presença em só um dia (o 2º) já conta como presente", async () => {
    // Pega: exigir a presença do dia 1 (ou travar quando há mais de uma linha).
    const { event, start } = await criarEvento({ startOffsetDays: -10, days: 3, multiDay: true });
    const pessoa = await createTestParticipant(event.id);
    const { token } = await createActiveTerminalWithToken(app, event.id);
    await sincronizar(token, [{ qrToken: pessoa.qrToken, quando: diaN(start, 2) }]);
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "GET",
      url: `/events/${event.id}/participants/certificates`,
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.json().data.find((r: { participantId: string }) => r.participantId === pessoa.id).hasCheckIn).toBe(true);
  });
});
