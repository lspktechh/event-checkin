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

const helena = { name: "Helena Prado", email: "helena@exemplo.com", document: "123.456.789-01", phone: "43999990000" };

/** Cria pela mesma rota que o painel usa e devolve a inscrição já com o participante. */
async function criar(eventId: string, token: string, pessoa: typeof helena, cortesia: boolean) {
  const res = await app.inject({
    method: "POST",
    url: `/events/${eventId}/inscriptions/manual`,
    headers: { authorization: `Bearer ${token}` },
    payload: { ...pessoa, cortesia },
  });
  expect(res.statusCode).toBe(201);
  const inscricao = await prisma.inscription.findUniqueOrThrow({ where: { id: res.json().data.id } });
  return inscricao;
}

function editar(eventId: string, id: string, token: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "PATCH",
    url: `/events/${eventId}/inscriptions/${id}`,
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

describe("editar inscrição: dados da pessoa", () => {
  it("atualiza inscrição e participante juntos, e o login do portal passa a ser o e-mail novo", async () => {
    // Pega: editar só a inscrição. O portal entra pelo e-mail do
    // PARTICIPANTE; se ele ficar com o antigo, a pessoa não consegue
    // mais abrir o próprio QR com o e-mail corrigido.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const res = await editar(evento.id, ins.id, token, {
      name: "Helena Prado Souza",
      email: "helena.souza@exemplo.com",
      document: "987.654.321-00",
      phone: "43911112222",
      institution: "Universidade Positivo",
    });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(i).toMatchObject({
      name: "Helena Prado Souza",
      email: "helena.souza@exemplo.com",
      document: "987.654.321-00",
      phone: "43911112222",
      institution: "Universidade Positivo",
    });
    const p = await prisma.participant.findUniqueOrThrow({ where: { id: ins.participantId! } });
    expect(p).toMatchObject({
      name: "Helena Prado Souza",
      email: "helena.souza@exemplo.com",
      document: "987.654.321-00",
      phone: "43911112222",
    });

    const novo = await app.inject({ method: "POST", url: "/attendee/login", payload: { email: "helena.souza@exemplo.com", eventId: evento.id } });
    expect(novo.statusCode).toBe(200);
    const antigo = await app.inject({ method: "POST", url: "/attendee/login", payload: { email: "helena@exemplo.com", eventId: evento.id } });
    expect(antigo.statusCode).toBe(404);
  });

  it("só muda o que foi enviado", async () => {
    // Pega: campo omitido sendo apagado (telefone virando nulo ao
    // corrigir só o nome).
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const res = await editar(evento.id, ins.id, token, { name: "Helena Corrigida" });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(i.name).toBe("Helena Corrigida");
    expect(i.email).toBe(helena.email);
    expect(i.phone).toBe(helena.phone);
    const p = await prisma.participant.findUniqueOrThrow({ where: { id: ins.participantId! } });
    expect(p.phone).toBe(helena.phone);
  });

  it("recusa e-mail ou CPF de outra pessoa do evento e não muda nada", async () => {
    // Pega: duas pessoas com o mesmo e-mail (o portal abriria a errada)
    // ou o CPF de outra, escrito com outra máscara, passando batido.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    await criar(evento.id, token, { name: "Outro", email: "outro@exemplo.com", document: "111.222.333-44", phone: "" }, true);

    const porEmail = await editar(evento.id, ins.id, token, { email: "OUTRO@exemplo.com" });
    const porCpf = await editar(evento.id, ins.id, token, { document: "11122233344" });

    expect(porEmail.statusCode).toBe(409);
    expect(porCpf.statusCode).toBe(409);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(i.email).toBe(helena.email);
    expect(i.document).toBe(helena.document);
  });

  it("não bloqueia uma edição que não mexe no e-mail só porque já havia duplicado antigo", async () => {
    // Pega: conferir duplicado em todos os campos, mesmo os que não
    // mudaram — a organização ficaria impedida de corrigir um telefone
    // por causa de um duplicado que já existia antes.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    await prisma.participant.create({
      data: { eventId: evento.id, name: "Homônimo", email: helena.email, qrToken: "tok-homonimo" },
    });

    const res = await editar(evento.id, ins.id, token, { phone: "43900000000" });

    expect(res.statusCode).toBe(200);
  });

  it("exige participants.edit", async () => {
    // Pega: rota sem permissão, deixando conta de leitura reescrever dados.
    const { evento } = await eventoComLote();
    const admin = await loginAsAdmin();
    const ins = await criar(evento.id, admin, helena, true);
    const leitor = await loginWithPermissions(["participants.view"]);

    const res = await editar(evento.id, ins.id, leitor, { name: "Invasor" });

    expect(res.statusCode).toBe(403);
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } })).name).toBe(helena.name);
  });

  it("não edita inscrição de outro evento pela URL deste", async () => {
    // Pega: buscar só por id, deixando editar dados de outro evento.
    const { evento } = await eventoComLote();
    const outro = await createTestEvent({ name: "Outro Evento" });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const res = await editar(outro.id, ins.id, token, { name: "Troca" });

    expect(res.statusCode).toBe(404);
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } })).name).toBe(helena.name);
  });
});

describe("editar inscrição: forma de pagamento", () => {
  it("cortesia vira paga por fora pelo preço do lote, entra na receita e mantém a vaga", async () => {
    // O caso do pedido: quem entrou como cortesia e não foi atualizado.
    // Pega: o valor ficando 0 (receita some), a cortesia continuando
    // marcada, ou a vaga do lote sendo perdida na troca.
    const { evento, lote } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const res = await editar(evento.id, ins.id, token, { pagamento: { forma: "MANUAL" } });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(Number(i.amount)).toBe(150);
    expect(i.isCourtesy).toBe(false);
    expect(i.paymentProvider).toBe("MANUAL");
    expect(i.paymentMethod).toBeNull();
    expect(i.status).toBe("CONFIRMED");
    expect(i.batchId).toBe(lote.id);
    const p = await prisma.participant.findUniqueOrThrow({ where: { id: ins.participantId! } });
    expect(p.isCourtesy).toBe(false);

    const relatorio = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/inscriptions/report`,
      headers: { authorization: `Bearer ${token}` },
    });
    const linha = relatorio.json().data.find((r: { id: string }) => r.id === ins.id);
    expect(linha.amount).toBe(150);
    expect(linha.isCourtesy).toBe(false);
  });

  it("aceita valor diferente do lote e registra Pix ou Cartão", async () => {
    // Pega: o valor informado sendo ignorado (desconto perdido) ou a
    // forma não sendo gravada (filtros Pix/Cartão do relatório errados).
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const a = await criar(evento.id, token, helena, true);
    const b = await criar(evento.id, token, { name: "Beto", email: "beto@exemplo.com", document: "222.222.222-22", phone: "" }, true);

    expect((await editar(evento.id, a.id, token, { pagamento: { forma: "PIX", valor: 120 } })).statusCode).toBe(200);
    expect((await editar(evento.id, b.id, token, { pagamento: { forma: "CARD", valor: 150 } })).statusCode).toBe(200);

    const ia = await prisma.inscription.findUniqueOrThrow({ where: { id: a.id } });
    expect(Number(ia.amount)).toBe(120);
    expect(ia.paymentMethod).toBe("PIX");
    expect(ia.paymentProvider).toBe("MANUAL");
    const ib = await prisma.inscription.findUniqueOrThrow({ where: { id: b.id } });
    expect(ib.paymentMethod).toBe("CARD");
  });

  it("trocar só a forma de pagamento mantém o valor já cobrado", async () => {
    // Pega: o valor voltando ao preço do lote quando a organização só
    // corrige "Pix" para "Cartão" numa inscrição que teve desconto.
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    await editar(evento.id, ins.id, token, { pagamento: { forma: "PIX", valor: 120 } });

    const res = await editar(evento.id, ins.id, token, { pagamento: { forma: "CARD" } });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(Number(i.amount)).toBe(120);
    expect(i.paymentMethod).toBe("CARD");
  });

  it("paga por fora vira cortesia: valor zero, marcada, e some da receita", async () => {
    // Pega: o valor antigo ficando na receita depois de virar cortesia,
    // ou a forma de pagamento antiga (Pix) ficando gravada.
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, false);
    await editar(evento.id, ins.id, token, { pagamento: { forma: "PIX" } });

    const res = await editar(evento.id, ins.id, token, { pagamento: { forma: "CORTESIA" } });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(Number(i.amount)).toBe(0);
    expect(i.isCourtesy).toBe(true);
    expect(i.paymentMethod).toBeNull();
    expect(i.paymentProvider).toBeNull();
    const p = await prisma.participant.findUniqueOrThrow({ where: { id: ins.participantId! } });
    expect(p.isCourtesy).toBe(true);
  });

  it("dados e pagamento no mesmo pedido valem juntos ou não valem", async () => {
    // Pega: gravar o nome e deixar o pagamento de fora quando o segundo
    // passo falha, deixando a inscrição pela metade.
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    await criar(evento.id, token, { name: "Outro", email: "outro@exemplo.com", document: "111.222.333-44", phone: "" }, true);

    const conflito = await editar(evento.id, ins.id, token, {
      name: "Nome Novo",
      email: "outro@exemplo.com", // duplicado: a edição inteira tem que cair
      pagamento: { forma: "MANUAL" },
    });

    expect(conflito.statusCode).toBe(409);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(i.name).toBe(helena.name);
    expect(i.isCourtesy).toBe(true);
    expect(Number(i.amount)).toBe(0);
  });

  it("paga sem valor e sem preço de lote exige o valor; valor zero é recusado", async () => {
    // Pega: marcar "paga" com R$ 0 — receita zerada sem aviso, igual a
    // uma cortesia disfarçada.
    const { evento } = await eventoComLote({ price: 0 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const semValor = await editar(evento.id, ins.id, token, { pagamento: { forma: "MANUAL" } });
    const valorZero = await editar(evento.id, ins.id, token, { pagamento: { forma: "PIX", valor: 0 } });

    expect(semValor.statusCode).toBe(422);
    expect(valorZero.statusCode).toBe(422);
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } })).isCourtesy).toBe(true);
  });

  it("inscrição paga pelo gateway: dados editáveis, forma de pagamento travada", async () => {
    // Pega: transformar em cortesia (ou mudar o valor de) uma inscrição
    // paga no Mercado Pago — o dinheiro existe lá e o relatório passaria
    // a dizer que não.
    const { evento } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, false);
    await prisma.inscription.update({
      where: { id: ins.id },
      data: { paymentProvider: "MERCADO_PAGO", paymentMethod: "PIX", paymentId: "mp-123" },
    });

    const pagamento = await editar(evento.id, ins.id, token, { pagamento: { forma: "CORTESIA" } });
    const dados = await editar(evento.id, ins.id, token, { name: "Helena Corrigida" });

    expect(pagamento.statusCode).toBe(409);
    expect(dados.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(Number(i.amount)).toBe(150);
    expect(i.isCourtesy).toBe(false);
    expect(i.paymentProvider).toBe("MERCADO_PAGO");
    expect(i.name).toBe("Helena Corrigida");
  });

  it("inscrição pendente não troca forma de pagamento", async () => {
    // Pega: marcar como paga, pela edição, uma inscrição que ninguém
    // pagou e nem tem participante — confirmar é outro caminho.
    const { evento, lote } = await eventoComLote({ price: 150 });
    const token = await loginAsAdmin();
    const pendente = await prisma.inscription.create({
      data: {
        eventId: evento.id,
        name: "Quem Não Pagou",
        email: "naopagou@exemplo.com",
        document: "555.555.555-55",
        category: lote.name,
        amount: 150,
        batchId: lote.id,
        status: "PENDING",
        paymentExpiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const res = await editar(evento.id, pendente.id, token, { pagamento: { forma: "CORTESIA" } });

    expect(res.statusCode).toBe(409);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(i.status).toBe("PENDING");
    expect(Number(i.amount)).toBe(150);
  });
});

describe("editar participante (aba Participantes)", () => {
  async function patchParticipante(eventId: string, participantId: string, token: string, payload: Record<string, unknown>) {
    return app.inject({
      method: "PATCH",
      url: `/events/${eventId}/participants/${participantId}`,
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  it("corrigir dados de quem veio de inscrição atualiza também a inscrição", async () => {
    // Pega: o relatório de Inscritos continuando com o nome/CPF errados
    // depois da correção feita na aba Participantes.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);

    const res = await patchParticipante(evento.id, ins.participantId!, token, {
      name: "Helena P. Souza",
      email: "nova@exemplo.com",
      document: "999.999.999-99",
      phone: "43933334444",
    });

    expect(res.statusCode).toBe(200);
    const i = await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } });
    expect(i).toMatchObject({
      name: "Helena P. Souza",
      email: "nova@exemplo.com",
      document: "999.999.999-99",
      phone: "43933334444",
    });
  });

  it("recusa e-mail ou CPF de outro participante ativo", async () => {
    // Pega: o PATCH antigo, que deixava criar dois participantes com o
    // mesmo e-mail (o portal abriria o errado).
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    await criar(evento.id, token, { name: "Outro", email: "outro@exemplo.com", document: "111.222.333-44", phone: "" }, true);

    const email = await patchParticipante(evento.id, ins.participantId!, token, { email: "outro@exemplo.com" });
    const cpf = await patchParticipante(evento.id, ins.participantId!, token, { document: "111.222.333-44" });

    expect(email.statusCode).toBe(409);
    expect(cpf.statusCode).toBe(409);
  });

  it("a listagem diz quem veio de uma inscrição", async () => {
    // Pega: a tela sem como saber quando oferecer o interruptor de
    // cortesia (liberado só para quem NÃO veio de inscrição).
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    const avulso = await prisma.participant.create({
      data: { eventId: evento.id, name: "Avulso", qrToken: "tok-avulso-lista" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/participants`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const porId = Object.fromEntries(res.json().data.map((p: { id: string; hasInscription: boolean }) => [p.id, p.hasInscription]));
    expect(porId[ins.participantId!]).toBe(true);
    expect(porId[avulso.id]).toBe(false);
  });

  it("cortesia: livre para participante sem inscrição, travada para quem veio de inscrição", async () => {
    // Pega: marcar/desmarcar cortesia só no participante e deixar a
    // inscrição (onde está o dinheiro) dizendo o contrário.
    const { evento } = await eventoComLote();
    const token = await loginAsAdmin();
    const ins = await criar(evento.id, token, helena, true);
    const avulso = await prisma.participant.create({
      data: { eventId: evento.id, name: "Avulso", qrToken: "tok-avulso" },
    });

    const liga = await patchParticipante(evento.id, avulso.id, token, { cortesia: true });
    expect(liga.statusCode).toBe(200);
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: avulso.id } })).isCourtesy).toBe(true);
    const desliga = await patchParticipante(evento.id, avulso.id, token, { cortesia: false });
    expect(desliga.statusCode).toBe(200);
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: avulso.id } })).isCourtesy).toBe(false);

    const travada = await patchParticipante(evento.id, ins.participantId!, token, { cortesia: false });
    expect(travada.statusCode).toBe(409);
    expect((await prisma.participant.findUniqueOrThrow({ where: { id: ins.participantId! } })).isCourtesy).toBe(true);
    expect((await prisma.inscription.findUniqueOrThrow({ where: { id: ins.id } })).isCourtesy).toBe(true);
  });
});
