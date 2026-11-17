import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "./passwords.js";

/**
 * Bootstrap de usuários essenciais do sistema:
 * - Admin global (admin@admin.com / admin@lspk.com) com senha 12345678
 * - Usuária Janaina (jcsantilli@gmail.com) restrita para avaliação do evento
 *
 * Roda de forma idempotente no boot do backend.
 */
export async function bootstrapUsers(prisma: PrismaClient): Promise<void> {
  try {
    const adminRole = await prisma.role.findFirst({
      where: { key: "ADMINISTRADOR" },
    });
    if (!adminRole) return;

    const passwordHash = await hashPassword("12345678");

    // 1. Admin Global (admin@admin.com)
    await prisma.user.upsert({
      where: { email: "admin@admin.com" },
      create: {
        name: "Admin Global",
        email: "admin@admin.com",
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        allowedEventIds: [],
        customPermissions: [],
        useCustomPermissions: false,
      },
      update: {
        passwordHash,
        isActive: true,
        roleId: adminRole.id,
        allowedEventIds: [],
        useCustomPermissions: false,
      },
    });

    // 2. Admin LSPK (admin@lspk.com)
    await prisma.user.upsert({
      where: { email: "admin@lspk.com" },
      create: {
        name: "Admin LSPK",
        email: "admin@lspk.com",
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        allowedEventIds: [],
        customPermissions: [],
        useCustomPermissions: false,
      },
      update: {
        passwordHash,
        isActive: true,
        roleId: adminRole.id,
        allowedEventIds: [],
        useCustomPermissions: false,
      },
    });

    // 3. Janaina (jcsantilli@gmail.com)
    const inovaEvents = await prisma.event.findMany({
      where: {
        OR: [
          { name: { contains: "inova", mode: "insensitive" } },
          { id: "e7b5f120-4a81-4993-9c5e-85a265da4168" },
          { id: "db2d17ca-6034-46af-9bf6-dd145130518b" },
        ],
      },
      select: { id: true },
    });
    const inovaEventIds = inovaEvents.map((e) => e.id);

    await prisma.user.upsert({
      where: { email: "jcsantilli@gmail.com" },
      create: {
        name: "Janaina",
        email: "jcsantilli@gmail.com",
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
        allowedEventIds: inovaEventIds,
        customPermissions: ["events.view", "participants.view", "participants.edit"],
        useCustomPermissions: true,
      },
      update: {
        passwordHash,
        isActive: true,
        ...(inovaEventIds.length > 0 ? { allowedEventIds: inovaEventIds } : {}),
        customPermissions: ["events.view", "participants.view", "participants.edit"],
        useCustomPermissions: true,
      },
    });
  } catch (err) {
    console.error("Erro no bootstrapUsers:", err);
  }
}
