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

const csv = ["nome,email,telefone,documento", "Ana Lima,ana@exemplo.com,43911112222,111.111.111-11", "Beto Reis,beto@exemplo.com,,"].join(
  "\n",
);

describe("cortesia na aba Participantes", () => {
  it("participante criado com cortesia fica marcado e a listagem devolve a marca", async () => {
    // Pega: o zod descartando o campo `cortesia` em silêncio (chave
    // desconhecida é ignorada) e todo mundo virando participante comum.
    const evento = await createTestEvent();
    const token = await loginAsAdmin();

    const criado = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/participants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Convidado Especial", cortesia: true },
    });
    expect(criado.statusCode).toBe(201);
    expect(criado.json().data.isCourtesy).toBe(true);

    const lista = await app.inject({
      method: "GET",
      url: `/events/${evento.id}/participants`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(lista.json().data).toHaveLength(1);
    expect(lista.json().data[0].isCourtesy).toBe(true);
  });

  it("sem cortesia, o participante continua comum", async () => {
    // Pega: o padrão virando `true` (todo cadastro manual vira cortesia).
    const evento = await createTestEvent();
    const token = await loginAsAdmin();

    const criado = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/participants`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Participante Comum" },
    });

    expect(criado.statusCode).toBe(201);
    expect(criado.json().data.isCourtesy).toBe(false);
  });

  it("importação CSV com cortesia marca todas as linhas gravadas", async () => {
    // Pega: a marca sendo aplicada só na pré-visualização, ou só na
    // primeira linha, ou nunca chegando ao createMany.
    const evento = await createTestEvent();
    const token = await loginAsAdmin();

    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/participants/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: { csv, confirm: true, cortesia: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.imported).toBe(2);
    const gravados = await prisma.participant.findMany({ where: { eventId: evento.id } });
    expect(gravados).toHaveLength(2);
    expect(gravados.every((p) => p.isCourtesy)).toBe(true);
  });

  it("importação CSV sem cortesia grava participantes comuns", async () => {
    const evento = await createTestEvent();
    const token = await loginAsAdmin();

    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/participants/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: { csv, confirm: true },
    });

    expect(res.statusCode).toBe(200);
    const gravados = await prisma.participant.findMany({ where: { eventId: evento.id } });
    expect(gravados).toHaveLength(2);
    expect(gravados.some((p) => p.isCourtesy)).toBe(false);
  });

  it("pré-visualização com cortesia não grava nada", async () => {
    // Pega: o preview ganhando efeito colateral ao receber a opção nova
    // (a regra da seção 20: nunca importar às cegas).
    const evento = await createTestEvent();
    const token = await loginAsAdmin();

    const res = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/participants/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: { csv, confirm: false, cortesia: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.validCount).toBe(2);
    expect(await prisma.participant.count({ where: { eventId: evento.id } })).toBe(0);
  });
});
