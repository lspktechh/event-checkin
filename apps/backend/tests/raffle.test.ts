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

async function login(email: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data.token as string;
}

async function adminToken() {
  const { user, password } = await createTestAdmin(`admin_${Math.random().toString(36).slice(2, 8)}@teste.com`);
  return login(user.email, password);
}

function device() {
  return `dev_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function claim(eventId: string, deviceKey: string) {
  return app.inject({ method: "POST", url: `/public/events/${eventId}/raffle/number`, payload: { deviceKey } });
}

describe("Sorteio por QR Code", () => {
  it("abrir o QR gera um número de 4 dígitos e salva no banco", async () => {
    const event = await createTestEvent();
    const res = await claim(event.id, device());
    expect(res.statusCode).toBe(200);
    const { number } = res.json().data;
    expect(number).toBeGreaterThanOrEqual(1000);
    expect(number).toBeLessThanOrEqual(9999);
    expect(await prisma.raffleEntry.count({ where: { eventId: event.id, number } })).toBe(1);
  });

  it("o mesmo celular escaneando de novo recebe o mesmo número", async () => {
    const event = await createTestEvent();
    const key = device();
    const a = (await claim(event.id, key)).json().data.number;
    const b = (await claim(event.id, key)).json().data.number;
    expect(b).toBe(a);
    expect(await prisma.raffleEntry.count({ where: { eventId: event.id } })).toBe(1);
  });

  it("números são únicos dentro do evento", async () => {
    const event = await createTestEvent();
    const numbers = new Set<number>();
    for (let i = 0; i < 40; i++) numbers.add((await claim(event.id, device())).json().data.number);
    expect(numbers.size).toBe(40);
  });

  it("evento inexistente responde 404 e deviceKey inválido é recusado", async () => {
    const missing = await claim("00000000-0000-4000-8000-000000000000", device());
    expect(missing.statusCode).toBe(404);
    const event = await createTestEvent();
    const bad = await claim(event.id, "x");
    expect(bad.statusCode).toBeGreaterThanOrEqual(400);
    expect(bad.statusCode).toBeLessThan(500);
  });

  it("sorteia um número cadastrado e não repete ganhador por padrão", async () => {
    const event = await createTestEvent();
    const token = await adminToken();
    const mine = new Set<number>();
    for (let i = 0; i < 3; i++) mine.add((await claim(event.id, device())).json().data.number);

    const drawn: number[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: `/events/${event.id}/raffle/draw`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(res.statusCode).toBe(201);
      drawn.push(res.json().data.number);
    }
    expect(new Set(drawn).size).toBe(3);
    drawn.forEach((n) => expect(mine.has(n)).toBe(true));

    const empty = await app.inject({
      method: "POST",
      url: `/events/${event.id}/raffle/draw`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(empty.statusCode).toBe(409);
    expect(empty.json().error.code).toBe("RAFFLE_EMPTY");

    const state = await app.inject({
      method: "GET",
      url: `/events/${event.id}/raffle`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(state.json().data.entries).toHaveLength(3);
    expect(state.json().data.draws).toHaveLength(3);
  });

  it("desfazer um sorteio e zerar tudo", async () => {
    const event = await createTestEvent();
    const token = await adminToken();
    await claim(event.id, device());
    const draw = (
      await app.inject({
        method: "POST",
        url: `/events/${event.id}/raffle/draw`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
    ).json().data;

    const undo = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/raffle/draws/${draw.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(undo.statusCode).toBe(200);
    expect(await prisma.raffleDraw.count({ where: { eventId: event.id } })).toBe(0);

    const reset = await app.inject({
      method: "DELETE",
      url: `/events/${event.id}/raffle`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(reset.statusCode).toBe(200);
    expect(await prisma.raffleEntry.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("quem só visualiza não consegue sortear", async () => {
    const event = await createTestEvent();
    await claim(event.id, device());
    const role = await createTestRole("Somente leitura", ["participants.view"]);
    const { user, password } = await createTestUserWithRole(role.id, "leitor@teste.com");
    const token = await login(user.email, password);

    const list = await app.inject({
      method: "GET",
      url: `/events/${event.id}/raffle`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);

    const draw = await app.inject({
      method: "POST",
      url: `/events/${event.id}/raffle/draw`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(draw.statusCode).toBe(403);
  });
});
