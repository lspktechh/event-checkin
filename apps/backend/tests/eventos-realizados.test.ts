import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function realizados() {
  const res = await app.inject({ method: "GET", url: "/public/events/closed" });
  return res;
}

/**
 * Aba "Realizados" do portal do participante.
 *
 * Duas decisões do organizador, no painel, levam um evento até ali:
 *   1. marcar o evento como Encerrado (status CLOSED);
 *   2. deixar ligada a opção "mostrar no site" (showInPortal).
 *
 * Nenhuma delas depende da data. Um evento que já passou mas segue Ativo
 * não é listado como acabado, e um Encerrado sem a marca não é divulgado
 * por tabela — o COPOL, por exemplo, tem site próprio.
 */
describe("GET /public/events/closed — eventos realizados", () => {
  it("Encerrado + marcado para o site aparece, com o mínimo para a lista", async () => {
    await createTestEvent({
      name: "INOVA SAÚDE 2026",
      status: "CLOSED",
      showInPortal: true,
      startDate: new Date("2026-10-17T12:00:00Z"),
      endDate: new Date("2026-10-17T22:00:00Z"),
    });

    const res = await realizados();

    expect(res.statusCode).toBe(200);
    const [evento] = res.json().data;
    expect(evento).toMatchObject({
      name: "INOVA SAÚDE 2026",
      startDate: "2026-10-17T12:00:00.000Z",
      endDate: "2026-10-17T22:00:00.000Z",
    });
    // Lista pública: nada de configuração interna (PIX, e-mail, certificado…).
    expect(Object.keys(evento).sort()).toEqual(
      ["endDate", "location", "name", "slug", "startDate"].sort(),
    );
  });

  it("Encerrado SEM a marca não aparece — quem escolhe é o organizador", async () => {
    await createTestEvent({ name: "Encerrado, mas não divulgar", status: "CLOSED" });

    expect((await realizados()).json().data).toEqual([]);
  });

  it("Ativo NÃO aparece, mesmo marcado e mesmo com a data já passada", async () => {
    await createTestEvent({
      name: "Passou mas segue ativo",
      status: "ACTIVE",
      showInPortal: true,
      startDate: new Date("2020-01-10T09:00:00Z"),
      endDate: new Date("2020-01-11T18:00:00Z"),
    });
    await createTestEvent({ name: "Futuro ativo", status: "ACTIVE", showInPortal: true });

    expect((await realizados()).json().data).toEqual([]);
  });

  it("o mais recente vem primeiro", async () => {
    await createTestEvent({
      name: "Antigo",
      status: "CLOSED",
      showInPortal: true,
      startDate: new Date("2025-03-01T12:00:00Z"),
      endDate: new Date("2025-03-01T20:00:00Z"),
    });
    await createTestEvent({
      name: "Recente",
      status: "CLOSED",
      showInPortal: true,
      startDate: new Date("2026-10-17T12:00:00Z"),
      endDate: new Date("2026-10-17T20:00:00Z"),
    });

    expect((await realizados()).json().data.map((e: { name: string }) => e.name)).toEqual([
      "Recente",
      "Antigo",
    ]);
  });

  it("não exige slug: a lista só mostra o que aconteceu", async () => {
    await createTestEvent({ name: "Sem endereço", status: "CLOSED", showInPortal: true });

    expect((await realizados()).json().data.map((e: { name: string }) => e.name)).toEqual([
      "Sem endereço",
    ]);
  });

  it("não atrapalha a rota por slug: /public/events/:slug segue funcionando", async () => {
    const e = await createTestEvent({ name: "Com slug" });
    await prisma.event.update({ where: { id: e.id }, data: { slug: "com-slug" } });

    const res = await app.inject({ method: "GET", url: "/public/events/com-slug" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Com slug");
  });
});
