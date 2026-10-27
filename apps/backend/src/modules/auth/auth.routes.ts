import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { prisma } from "../../database/prisma.js";
import { requireAdmin } from "../../middleware/auth.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { ok } from "../../shared/response.js";
import { authenticateAdmin } from "./auth.service.js";
import { loginSchema } from "./auth.schema.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await authenticateAdmin(email, password);

    const token = await reply.jwtSign(
      { sub: user.id, role: user.role.key, type: "admin" as const },
      { expiresIn: env.JWT_ADMIN_EXPIRES_IN }
    );

    return ok({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        allowedEventIds: user.allowedEventIds,
      },
    });
  });

  // Retorna os dados atualizados do usuário autenticado e renova o token (refresh silencioso)
  app.get("/auth/me", { preHandler: requireAdmin }, async (request, reply) => {
    const admin = request.admin!;
    const user = await prisma.user.findUnique({
      where: { id: admin.userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Sessão inválida ou usuário desativado");
    }

    const permissionKeys = user.useCustomPermissions
      ? user.customPermissions
      : user.role.isSystem
        ? "ALL"
        : user.role.permissions.map((rp) => rp.permission.key);

    const token = await reply.jwtSign(
      { sub: user.id, role: user.role.key, type: "admin" as const },
      { expiresIn: env.JWT_ADMIN_EXPIRES_IN }
    );

    return ok({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: { id: user.role.id, key: user.role.key, name: user.role.name, isSystem: user.role.isSystem },
        permissions: permissionKeys,
        allowedEventIds: user.allowedEventIds,
      },
    });
  });
}
