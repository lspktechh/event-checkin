import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/response.js";
import { requirePermission } from "../../middleware/auth.js";
import { raffleService } from "./raffle.service.js";

const eventIdParams = z.object({ eventId: z.string().uuid("eventId inválido") });
const drawParams = eventIdParams.extend({ drawId: z.string().uuid("drawId inválido") });

// Identificador aleatório criado no celular (crypto.randomUUID ou similar).
const claimBody = z.object({
  deviceKey: z
    .string()
    .trim()
    .min(16, "deviceKey inválido")
    .max(64, "deviceKey inválido")
    .regex(/^[A-Za-z0-9_-]+$/, "deviceKey inválido"),
});

const DEVICE_COOKIE = "raffle_device";
const DEVICE_KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Lê o cookie do aparelho sem depender de plugin (o projeto não usa @fastify/cookie). */
function readDeviceCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === DEVICE_COOKIE) {
      const value = decodeURIComponent(v.join("="));
      return DEVICE_KEY_RE.test(value) ? value : null;
    }
  }
  return null;
}

const drawBody = z.object({ excludeWinners: z.boolean().optional().default(true) }).optional();

export async function raffleRoutes(app: FastifyInstance) {
  /**
   * POST /public/events/:eventId/raffle/number
   * Público — aberto pelo QR Code. Gera (ou devolve) o número deste aparelho.
   */
  app.post(
    "/public/events/:eventId/raffle/number",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const body = claimBody.parse(request.body);
      // O cookie gravado pelo servidor vale mais que a chave do navegador:
      // ele sobrevive em casos em que o localStorage é apagado, e assim o
      // mesmo celular continua recebendo o mesmo número.
      const deviceKey = readDeviceCookie(request.headers.cookie) ?? body.deviceKey;
      const secure = request.protocol === "https" ? "; Secure" : "";
      reply.header(
        "Set-Cookie",
        `${DEVICE_COOKIE}=${encodeURIComponent(deviceKey)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`
      );
      const result = await raffleService.claimNumber(eventId, deviceKey);
      return ok({ ...result, deviceKey });
    }
  );

  /** GET /events/:eventId/raffle — números gerados e histórico de sorteios. */
  app.get(
    "/events/:eventId/raffle",
    { preHandler: requirePermission("participants.view") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      return ok(await raffleService.getState(eventId));
    }
  );

  /** POST /events/:eventId/raffle/draw — sorteia um número. */
  app.post(
    "/events/:eventId/raffle/draw",
    { preHandler: requirePermission("participants.edit") },
    async (request, reply) => {
      const { eventId } = eventIdParams.parse(request.params);
      const body = drawBody.parse(request.body ?? undefined);
      const draw = await raffleService.draw(eventId, {
        excludeWinners: body?.excludeWinners ?? true,
        drawnBy: request.admin?.email ?? null,
      });
      return reply.status(201).send(ok(draw));
    }
  );

  /** DELETE /events/:eventId/raffle/draws/:drawId — desfaz um sorteio. */
  app.delete(
    "/events/:eventId/raffle/draws/:drawId",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId, drawId } = drawParams.parse(request.params);
      await raffleService.deleteDraw(eventId, drawId);
      return ok({ deletedId: drawId });
    }
  );

  /** DELETE /events/:eventId/raffle — apaga todos os números e sorteios. */
  app.delete(
    "/events/:eventId/raffle",
    { preHandler: requirePermission("participants.edit") },
    async (request) => {
      const { eventId } = eventIdParams.parse(request.params);
      await raffleService.reset(eventId);
      return ok({ reset: true });
    }
  );
}
