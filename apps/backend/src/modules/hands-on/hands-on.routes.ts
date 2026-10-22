import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { handsOnService } from "./hands-on.service.js";
import {
  createHandsOnInscriptionSchema,
  updateHandsOnStatusSchema,
  handsOnCheckinSchema,
} from "./hands-on.schema.js";
import { ok, fail } from "../../shared/response.js";
import { requirePermission } from "../../middleware/auth.js";
import { attendeeRepository } from "../attendee/attendee.repository.js";

const eventIdParams = z.object({
  eventId: z.string().uuid("eventId inválido"),
});

const inscriptionIdParams = z.object({
  eventId: z.string().uuid("eventId inválido"),
  id: z.string().uuid("id inválido"),
});

export async function handsOnRoutes(app: FastifyInstance) {
  /**
   * GET /events/:eventId/hands-on/settings
   * Public — Retorna se as inscrições de Hands On estão abertas
   */
  app.get("/events/:eventId/hands-on/settings", async (request) => {
    const { eventId } = eventIdParams.parse(request.params);
    const settings = await handsOnService.getSettings(eventId);
    return ok(settings);
  });

  /**
   * PATCH /events/:eventId/hands-on/settings
   * Admin — Altera se as inscrições de Hands On estão abertas ou fechadas
   */
  app.patch(
    "/events/:eventId/hands-on/settings",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const { open } = z.object({ open: z.boolean() }).parse(request.body);
      const result = await handsOnService.updateSettings(eventId, open);
      return ok(result);
    }
  );

  /**
   * POST /events/:eventId/hands-on/inscriptions
   * Public — Cria a inscrição em um workshop Hands On (valida abertura e limite)
   */
  app.post("/events/:eventId/hands-on/inscriptions", async (request, reply) => {
    const { eventId } = eventIdParams.parse(request.params);
    const body = createHandsOnInscriptionSchema.parse(request.body);

    const registration = await handsOnService.register(eventId, {
      ...body,
      amount: body.amount,
      phone: body.phone ?? null,
      location: body.location ?? null,
      sponsor: body.sponsor ?? null,
      category: body.category ?? null,
      institution: body.institution ?? null,
      notes: body.notes ?? null,
    });

    return reply.status(201).send(ok(registration));
  });

  /**
   * POST /events/:eventId/hands-on/inscriptions/manual
   * Admin — Inscreve um participante manualmente pelo painel admin
   */
  app.post(
    "/events/:eventId/hands-on/inscriptions/manual",
    { preHandler: requirePermission("participants.edit") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const manualSchema = createHandsOnInscriptionSchema.extend({
        status: z.enum(["CONFIRMED", "PENDING"]).optional().default("CONFIRMED"),
      });
      const body = manualSchema.parse(request.body);

      const registration = await handsOnService.registerManual(eventId, {
        ...body,
        amount: body.amount,
        phone: body.phone ?? null,
        location: body.location ?? null,
        sponsor: body.sponsor ?? null,
        category: body.category ?? null,
        institution: body.institution ?? null,
        status: body.status,
        notes: body.notes ?? null,
      });

      return reply.status(201).send(ok(registration));
    }
  );

  /**
   * GET /events/:eventId/hands-on/stats
   * Public / Admin — Retorna a contagem de inscritos (total, confirmados, pendentes) por workshop
   */
  app.get("/events/:eventId/hands-on/stats", async (request) => {
    const { eventId } = eventIdParams.parse(request.params);
    const stats = await handsOnService.getWorkshopStats(eventId);
    return ok(stats);
  });

  /**
   * GET /events/:eventId/hands-on/inscriptions
   * Admin — Lista todos os inscritos nos Hands On, com filtro opcional por handsOnId
   */
  app.get(
    "/events/:eventId/hands-on/inscriptions",
    { preHandler: requirePermission("participants.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      const query = request.query as { handsOnId?: string };
      const list = await handsOnService.listRegistrations(eventId, query.handsOnId);
      return ok(list);
    }
  );

  /**
   * PATCH /events/:eventId/hands-on/inscriptions/:id/confirm
   * Admin — Confirma o pagamento/vaga de um inscrito
   */
  app.patch(
    "/events/:eventId/hands-on/inscriptions/:id/confirm",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { id } = inscriptionIdParams.parse(request.params);
      const body = updateHandsOnStatusSchema.partial().parse(request.body || {});
      const updated = await handsOnService.confirmPayment(id, body.notes);
      return ok(updated);
    }
  );

  /**
   * PATCH /events/:eventId/hands-on/inscriptions/:id/cancel
   * Admin — Cancela a inscrição de um participante no Hands On
   */
  app.patch(
    "/events/:eventId/hands-on/inscriptions/:id/cancel",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { id } = inscriptionIdParams.parse(request.params);
      const body = updateHandsOnStatusSchema.partial().parse(request.body || {});
      const updated = await handsOnService.cancelRegistration(id, body.notes);
      return ok(updated);
    }
  );

  /**
   * DELETE /events/:eventId/hands-on/inscriptions
   * Admin — Remove todas as inscrições de Hands On deste evento
   */
  app.delete(
    "/events/:eventId/hands-on/inscriptions",
    { preHandler: requirePermission("participants.edit") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const result = await handsOnService.deleteAllRegistrations(eventId);
      return reply.send(ok({ deletedCount: result.count }));
    }
  );

  /**
   * DELETE /events/:eventId/hands-on/inscriptions/:id
   * Admin — Exclui definitivamente um inscrito do Hands On
   */
  app.delete(
    "/events/:eventId/hands-on/inscriptions/:id",
    { preHandler: requirePermission("participants.edit") },
    async (request, reply) => {
      const { id } = inscriptionIdParams.parse(request.params);
      await handsOnService.deleteRegistration(id);
      return reply.send(ok({ deleted: true }));
    }
  );

  /**
   * POST /events/:eventId/hands-on/checkin
   * Admin / Terminal — Registra presença de credenciamento na porta do Hands On
   */
  app.post(
    "/events/:eventId/hands-on/checkin",
    { preHandler: requirePermission("participants.edit") },
    async (request, reply) => {
      const body = handsOnCheckinSchema.parse(request.body);
      const idOrToken = body.qrToken || (request.body as { id?: string })?.id;
      if (!idOrToken) {
        return reply.status(400).send(fail("BAD_REQUEST", "qrToken ou id é obrigatório"));
      }

      const result = await handsOnService.checkIn(idOrToken, body.checkedInBy);
      return reply.send(ok(result));
    }
  );

  /**
   * GET /attendee/hands-on
   * Attendee JWT — Retorna todos os Hands On do participante logado com seus QR codes
   */
  app.get("/attendee/hands-on", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token não fornecido"));
    }

    try {
      const decoded = app.jwt.verify<{ sub: string; type: string; eventId?: string }>(
        authHeader.slice(7)
      );

      if (decoded.type !== "attendee") {
        return reply.status(403).send(fail("FORBIDDEN", "Token inválido"));
      }

      const participant = await attendeeRepository.getParticipantById(decoded.sub);
      if (!participant) {
        return reply.status(404).send(fail("NOT_FOUND", "Participante não encontrado"));
      }

      const handsOnList = await handsOnService.getAttendeeHandsOn(
        participant.document || "",
        participant.email || "",
        decoded.eventId
      );

      return reply.send(ok(handsOnList));
    } catch {
      return reply.status(401).send(fail("UNAUTHORIZED", "Token inválido ou expirado"));
    }
  });

  /**
   * GET /public/attendee/hands-on
   * Public — Consulta os credenciamentos de Hands On por CPF ou E-mail
   */
  app.get("/public/attendee/hands-on", async (request, reply) => {
    const { document, email, eventId } = request.query as {
      document?: string;
      email?: string;
      eventId?: string;
    };

    if (!document && !email) {
      return reply.status(400).send(fail("BAD_REQUEST", "Informe documento ou e-mail"));
    }

    const list = await handsOnService.getAttendeeHandsOn(
      document || "",
      email || "",
      eventId
    );

    return reply.send(ok(list));
  });

  /**
   * GET /public/hands-on/inscriptions/:id
   * Public — Retorna os dados e status da inscrição em Hands On (usado no polling de pagamento)
   */
  app.get("/public/hands-on/inscriptions/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const reg = await handsOnService.getPublicRegistration(id);
    return reply.send(ok(reg));
  });
}
