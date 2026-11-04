import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../shared/response.js";
import {
  checkLeaderLogin,
  loginWithPassword,
  verifyMagicLink,
  setLeaderPassword,
  getTeamDataBySession,
  updateTeamData,
} from "./leader-portal.service.js";

const slugOrIdParamsSchema = z.object({
  slugOrId: z.string().min(1),
});

const checkLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

const loginPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const verifyMagicLinkSchema = z.object({
  email: z.string().email("E-mail inválido"),
  token: z.string().min(1, "Token de verificação obrigatório"),
});

const setPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
  token: z.string().min(1, "Token de verificação obrigatório"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export async function leaderPortalRoutes(app: FastifyInstance) {
  // 1. Checa o e-mail: se tem senha ou se dispara o e-mail de verificação
  app.post("/public/events/:slugOrId/leader/check-login", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const { email } = checkLoginSchema.parse(request.body);

    const result = await checkLeaderLogin(slugOrId, email);
    return ok(result);
  });

  // 2. Login com senha existente
  app.post("/public/events/:slugOrId/leader/login-password", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const { email, password } = loginPasswordSchema.parse(request.body);

    const result = await loginWithPassword(slugOrId, email, password);
    return ok(result);
  });

  // 3. Validação do link mágico enviado por e-mail
  app.post("/public/events/:slugOrId/leader/verify-magic-link", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const { email, token } = verifyMagicLinkSchema.parse(request.body);

    const result = await verifyMagicLink(slugOrId, email, token);
    return ok(result);
  });

  // 4. Criação / definição da senha inicial ou reset
  app.post("/public/events/:slugOrId/leader/set-password", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const { email, token, password } = setPasswordSchema.parse(request.body);

    const result = await setLeaderPassword(slugOrId, email, token, password);
    return ok(result);
  });

  // 5. Consulta dos dados completos da equipe do líder autenticado
  app.get("/public/events/:slugOrId/leader/team-data", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const query = (request.query || {}) as { email?: string; sessionToken?: string };
    const authHeader = request.headers.authorization;

    const email = query.email;
    const sessionToken = query.sessionToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

    if (!email || !sessionToken) {
      return ok({
        error: "UNAUTHORIZED",
        message: "E-mail e token de sessão são obrigatórios",
      });
    }

    const data = await getTeamDataBySession(slugOrId, email, sessionToken);
    return ok(data);
  });

  // 6. Atualização dos dados da equipe pelo líder com LOG DE AUDITORIA
  app.put("/public/events/:slugOrId/leader/team-data", async (request) => {
    const { slugOrId } = slugOrIdParamsSchema.parse(request.params);
    const body = request.body as any;
    const authHeader = request.headers.authorization;

    const email = body.email;
    const sessionToken = body.sessionToken || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);

    if (!email || !sessionToken) {
      return ok({
        error: "UNAUTHORIZED",
        message: "E-mail e token de sessão são obrigatórios",
      });
    }

    const result = await updateTeamData(
      slugOrId,
      email,
      sessionToken,
      body.data || body,
      {
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      }
    );

    return ok(result);
  });
}
