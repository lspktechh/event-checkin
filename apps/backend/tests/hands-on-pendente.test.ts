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

let seq = 0;
function inscricao(eventId: string, status: "PENDING" | "CONFIRMED", handsOnId: string, valor = 100) {
  seq += 1;
  return prisma.handsOnRegistration.create({
    data: {
      eventId,
      handsOnId,
      title: `Workshop ${handsOnId}`,
      speaker: "Dra. Helena",
      date: "06/11/2026",
      time: "09:00",
      amount: valor,
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

describe("Hands On aguardando Pix não tem QR de acesso", () => {
  it("portal do participante: a pendente aparece, mas sem QR; a confirmada mantém o QR", async () => {
    // Pega: o QR de acesso à sala aparecer para quem ainda não pagou. O QR
    // que a pessoa vê em "Aguardando Pix" no site de inscrição é o do
    // PAGAMENTO — outra coisa, e continua existindo.
    const event = await createTestEvent();
    const participant = await prisma.participant.create({
      data: { eventId: event.id, ...PESSOA, qrToken: "evt_ana_portal" },
    });
    const attendeeToken = await createAttendeeToken(app, participant);
    const confirmada = await inscricao(event.id, "CONFIRMED", "ho-a");
    const pendente = await inscricao(event.id, "PENDING", "ho-b");

    const res = await app.inject({
      method: "GET",
      url: "/attendee/hands-on",
      headers: { authorization: `Bearer ${attendeeToken}` },
    });

    const itens = res.json().data as { id: string; status: string; qrToken: string | null }[];
    expect(itens.find((i) => i.id === confirmada.id)).toMatchObject({ status: "CONFIRMED", qrToken: confirmada.qrToken });
    expect(itens.find((i) => i.id === pendente.id)).toMatchObject({ status: "PENDING", qrToken: null });
    expect(res.body).not.toContain(pendente.qrToken);
  });

  it("consulta pública (por e-mail e pelo id) também não entrega o QR da pendente", async () => {
    // Pega: proteger só o portal e deixar o token sair por outra via.
    const event = await createTestEvent();
    const pendente = await inscricao(event.id, "PENDING", "ho-b");

    const porEmail = await app.inject({
      method: "GET",
      url: `/public/attendee/hands-on?email=${encodeURIComponent(PESSOA.email)}&eventId=${event.id}`,
    });
    const porId = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${pendente.id}` });

    expect(porEmail.json().data[0]).toMatchObject({ status: "PENDING", qrToken: null });
    expect(porId.json().data).toMatchObject({ status: "PENDING", qrToken: null });
    expect(porEmail.body).not.toContain(pendente.qrToken);
    expect(porId.body).not.toContain(pendente.qrToken);
  });

  it("depois de confirmada, a consulta pelo id passa a entregar o QR (a tela de pagamento depende disso)", async () => {
    // Pega: esconder o QR para sempre — o site de inscrição consulta esta
    // rota até o pagamento ser aprovado e então mostra o QR de acesso.
    const event = await createTestEvent();
    const reg = await inscricao(event.id, "PENDING", "ho-b");
    const antes = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${reg.id}` });
    await prisma.handsOnRegistration.update({ where: { id: reg.id }, data: { status: "CONFIRMED" } });

    const depois = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${reg.id}` });

    expect(antes.json().data.qrToken).toBeNull();
    expect(depois.json().data.qrToken).toBe(reg.qrToken);
  });
});

describe("porta do Hands On: QR de inscrição pendente", () => {
  it("o QR lido de uma pendente é recusado, e ela continua pendente", async () => {
    // Pega: quem ainda não pagou entrar (e ser marcado como CONFIRMADO pelo
    // recordCheckin) só por ter o token — que o site de inscrição devolve
    // no momento em que a pessoa se inscreve.
    const event = await createTestEvent();
    const pendente = await inscricao(event.id, "PENDING", "ho-b");
    const admin = await loginAsAdmin();

    const res = await lerNaPorta(event.id, admin, { qrToken: pendente.qrToken });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.message).toMatch(/pendente/i);
    const depois = await prisma.handsOnRegistration.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(depois.status).toBe("PENDING");
    expect(depois.checkedInAt).toBeNull();
  });

  it("o 'Fazer Check-in' do painel (pelo id) continua valendo para a equipe", async () => {
    // Pega: quebrar a rotina da equipe (pagou na hora, check-in manual) ao
    // endurecer a leitura do QR. O id só chega aqui pelo painel, com
    // permissão de admin — é uma decisão de uma pessoa, não um QR apresentado.
    const event = await createTestEvent();
    const pendente = await inscricao(event.id, "PENDING", "ho-b");
    const admin = await loginAsAdmin();

    const res = await lerNaPorta(event.id, admin, { id: pendente.id });

    expect(res.statusCode).toBe(200);
    const depois = await prisma.handsOnRegistration.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(depois.status).toBe("CONFIRMED");
    expect(depois.checkedInAt).not.toBeNull();
  });

  it("a confirmada continua entrando pelo QR", async () => {
    // Pega: a recusa da pendente pegar também quem pagou.
    const event = await createTestEvent();
    const confirmada = await inscricao(event.id, "CONFIRMED", "ho-a");
    const admin = await loginAsAdmin();

    const res = await lerNaPorta(event.id, admin, { qrToken: confirmada.qrToken });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.alreadyCheckedIn).toBe(false);
  });
});

describe("Hands On de valor zero (cortesia) ainda pendente tem acesso", () => {
  it("portal: a cortesia pendente mostra o QR; quem vai pagar (pendente com valor) continua sem", async () => {
    // Pega: a regra "só confirmada tem QR" deixar sem QR quem é cortesia e
    // ficou com status pendente. Cortesia não paga nada, então não há Pix a
    // aguardar; já quem tem valor a pagar segue sem acesso até confirmar.
    const event = await createTestEvent();
    const participant = await prisma.participant.create({
      data: { eventId: event.id, ...PESSOA, qrToken: "evt_ana_cortesia" },
    });
    const attendeeToken = await createAttendeeToken(app, participant);
    const cortesia = await inscricao(event.id, "PENDING", "ho-a", 0);
    const aPagar = await inscricao(event.id, "PENDING", "ho-b", 100);

    const res = await app.inject({
      method: "GET",
      url: "/attendee/hands-on",
      headers: { authorization: `Bearer ${attendeeToken}` },
    });

    const itens = res.json().data as { id: string; qrToken: string | null }[];
    expect(itens.find((i) => i.id === cortesia.id)?.qrToken).toBe(cortesia.qrToken);
    expect(itens.find((i) => i.id === aPagar.id)?.qrToken).toBeNull();
    expect(res.body).not.toContain(aPagar.qrToken);
  });

  it("porta: o QR de uma cortesia pendente entra e a inscrição vira confirmada", async () => {
    // Pega: a cortesia ser recusada na porta por estar "pendente", mesmo sem
    // nada a pagar.
    const event = await createTestEvent();
    const cortesia = await inscricao(event.id, "PENDING", "ho-a", 0);
    const admin = await loginAsAdmin();

    const res = await lerNaPorta(event.id, admin, { qrToken: cortesia.qrToken });

    expect(res.statusCode).toBe(200);
    const depois = await prisma.handsOnRegistration.findUniqueOrThrow({ where: { id: cortesia.id } });
    expect(depois.status).toBe("CONFIRMED");
    expect(depois.checkedInAt).not.toBeNull();
  });

  it("a consulta pelo id (tela de pagamento) também entrega o QR da cortesia pendente", async () => {
    // Pega: proteger o portal e esquecer a terceira via que devolve o token.
    const event = await createTestEvent();
    const cortesia = await inscricao(event.id, "PENDING", "ho-a", 0);

    const res = await app.inject({ method: "GET", url: `/public/hands-on/inscriptions/${cortesia.id}` });

    expect(res.json().data.qrToken).toBe(cortesia.qrToken);
  });
});

describe("COPOL: inscrição aguardando Pix não tem QR de acesso", () => {
  it("quem só tem inscrição pendente não entra no portal e não recebe QR no status do pagamento", async () => {
    // Trava o que já funcionava: o participante (dono do QR) só nasce na
    // confirmação do pagamento. Pega uma mudança futura que crie o
    // participante antes de pagar.
    const event = await createTestEvent();
    const pendente = await prisma.inscription.create({
      data: {
        eventId: event.id,
        name: PESSOA.name,
        email: PESSOA.email,
        document: PESSOA.document,
        category: "1º Lote",
        amount: 150,
        status: "PENDING",
        paymentExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const login = await app.inject({ method: "POST", url: "/attendee/login", payload: { email: PESSOA.email, eventId: event.id } });
    const status = await app.inject({ method: "GET", url: `/inscriptions/${pendente.id}/payment-status` });

    expect(login.statusCode).toBe(400);
    expect(login.json().error.code).toBe("PAYMENT_PENDING");
    expect(status.json().data.status).toBe("PENDING");
    expect(status.json().data.qrToken).toBeNull();
    expect(await prisma.participant.count({ where: { eventId: event.id } })).toBe(0);
  });
});
