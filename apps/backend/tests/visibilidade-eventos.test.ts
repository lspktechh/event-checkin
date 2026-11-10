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

describe("visibilidade do evento", () => {
  it("evento privado NÃO aparece na listagem pública", async () => {
    // Era o bug: o painel oferecia "Privado — só quem tem o link direto"
    // e a opção não fazia nada. Com o COPOL encerrado, o site dele passou
    // a exibir o único evento ativo — a Semantix.
    const e = await createTestEvent({ name: "Privado" });
    await prisma.event.update({ where: { id: e.id }, data: { visibility: "PRIVATE" } });

    const res = await app.inject({ method: "GET", url: "/events/active" });
    expect(res.json().data).toHaveLength(0);
  });

  it("evento público aparece", async () => {
    const e = await createTestEvent({ name: "Público" });
    await prisma.event.update({ where: { id: e.id }, data: { visibility: "PUBLIC" } });

    const res = await app.inject({ method: "GET", url: "/events/active" });
    expect(res.json().data.map((x: { name: string }) => x.name)).toEqual(["Público"]);
  });

  it("privado continua acessível por link direto", async () => {
    // "Privado" significa não anuncie, e não bloqueie: o link divulgado
    // precisa continuar funcionando.
    const e = await createTestEvent({ name: "Semantix" });
    await prisma.event.update({
      where: { id: e.id },
      data: { visibility: "PRIVATE", slug: "semantix" },
    });

    const res = await app.inject({ method: "GET", url: "/public/events/semantix" });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe("Semantix");
  });

  it("o portal continua listando quem tem inscrição aberta, mesmo privado", async () => {
    // Pergunta diferente: a listagem pública é "o que este site divulga";
    // esta é "onde há inscrição aberta".
    const e = await createTestEvent({ name: "Semantix" });
    await prisma.event.update({
      where: { id: e.id },
      data: { visibility: "PRIVATE", slug: "semantix", registrationInPortal: true },
    });

    const res = await app.inject({ method: "GET", url: "/public/events/open-registration" });
    expect(res.json().data.map((x: { slug: string }) => x.slug)).toEqual(["semantix"]);
  });

  it("evento sem slug fica fora do portal — não há para onde mandar", async () => {
    await createTestEvent({ name: "Sem endereço", registrationInPortal: true });
    const res = await app.inject({ method: "GET", url: "/public/events/open-registration" });
    expect(res.json().data).toHaveLength(0);
  });

  it("inscrições encerradas somem do portal", async () => {
    const e = await createTestEvent({ name: "Encerrado" });
    await prisma.event.update({
      where: { id: e.id },
      data: { slug: "encerrado", registrationsClosedAt: new Date(), registrationInPortal: true },
    });

    const res = await app.inject({ method: "GET", url: "/public/events/open-registration" });
    expect(res.json().data).toHaveLength(0);
  });

  it("com endereço e inscrição aberta, mas SEM a opção do site, não aparece — quem escolhe é o organizador", async () => {
    // A aba "Inscrição" do portal só oferece o que o organizador ligou no
    // painel ("Inscrição pelo site"). Antes, qualquer evento Ativo com
    // endereço entrava sozinho na lista.
    const e = await createTestEvent({ name: "Evento sem a opção" });
    await prisma.event.update({ where: { id: e.id }, data: { slug: "sem-opcao" } });

    const res = await app.inject({ method: "GET", url: "/public/events/open-registration" });
    expect(res.json().data).toEqual([]);
  });

  it("a página de inscrição recebe a opção, para o site saber se o evento aceita inscrição por ele", async () => {
    const ligado = await createTestEvent({ name: "Ligado", registrationInPortal: true });
    await prisma.event.update({ where: { id: ligado.id }, data: { slug: "ligado" } });
    const desligado = await createTestEvent({ name: "Desligado" });
    await prisma.event.update({ where: { id: desligado.id }, data: { slug: "desligado" } });

    const a = await app.inject({ method: "GET", url: "/public/events/ligado" });
    const b = await app.inject({ method: "GET", url: "/public/events/desligado" });

    expect(a.json().data.registrationInPortal).toBe(true);
    expect(b.json().data.registrationInPortal).toBe(false);
  });
});
