import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifyEmail } from "../../shared/email-verifier.js";
import { ok } from "../../shared/response.js";

const verifyEmailBodySchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório"),
  checkMx: z.boolean().optional(),
});

const verifyEmailQuerySchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório"),
  checkMx: z.enum(["true", "false"]).optional(),
});

export async function emailVerificationRoutes(app: FastifyInstance) {
  app.post("/verify-email", async (request) => {
    const { email, checkMx } = verifyEmailBodySchema.parse(request.body);
    const result = await verifyEmail(email, { checkMx: checkMx ?? true });
    return ok(result);
  });

  app.get("/verify-email", async (request) => {
    const { email, checkMx } = verifyEmailQuerySchema.parse(request.query);
    const result = await verifyEmail(email, {
      checkMx: checkMx !== undefined ? checkMx === "true" : true,
    });
    return ok(result);
  });
}
