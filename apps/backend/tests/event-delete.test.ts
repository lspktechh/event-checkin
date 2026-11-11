import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestAdmin, createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();
let token: string;
let eventId: string;

async function loginAdmin(email = "admin-delete@teste.com", password = "senha-forte-123") {
  await createTestAdmin(email, password);
  const res = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  return res.json().data.token as string;
}

beforeEach(async () => {
  await resetDatabase();
  token = await loginAdmin();
  const event = await createTestEvent({ name: "Evento Para Excluir" });
  eventId = event.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

function auth() {
  return { authorization: `Bearer ${token}` };
}

describe("exclusão de evento (DELETE /events/:eventId)", () => {
  it("exclui o evento e seus dados vinculados com sucesso", async () => {
    // Cria dependências para verificar deleção em cascata
    const participant = await prisma.participant.create({
      data: {
        eventId,
        name: "Participante Teste",
        email: "participante@teste.com",
        qrToken: "token-teste-12345678",
      },
    });

    await prisma.checkIn.create({
      data: {
        eventId,
        participantId: participant.id,
        checkedInAt: new Date(),
      },
    });

    await prisma.eventBatch.create({
      data: {
        eventId,
        batchNumber: 1,
        name: "Lote 1",
        price: 100.0,
      },
    });

    await prisma.eventModule.create({
      data: {
        eventId,
        module: "checkin",
      },
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/events/${eventId}`,
      headers: auth(),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(eventId);
    expect(body.data.name).toBe("Evento Para Excluir");

    // Confirma que o evento não existe mais no banco
    const deletedEvent = await prisma.event.findUnique({ where: { id: eventId } });
    expect(deletedEvent).toBeNull();

    // Confirma que os registros vinculados foram excluídos
    const participants = await prisma.participant.findMany({ where: { eventId } });
    expect(participants).toHaveLength(0);

    const checkIns = await prisma.checkIn.findMany({ where: { eventId } });
    expect(checkIns).toHaveLength(0);

    const batches = await prisma.eventBatch.findMany({ where: { eventId } });
    expect(batches).toHaveLength(0);

    const modules = await prisma.eventModule.findMany({ where: { eventId } });
    expect(modules).toHaveLength(0);
  });

  it("retorna 404 ao tentar excluir evento inexistente", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/events/a0000000-0000-0000-0000-000000000000",
      headers: auth(),
    });

    expect(res.statusCode).toBe(404);
  });

  it("retorna 401 sem autenticação", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/events/${eventId}`,
    });

    expect(res.statusCode).toBe(401);
  });
});
