import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  description: z.string().trim().max(500).optional(),
  // Registrar a auditoria das ações das pessoas deste perfil (padrão: não).
  auditEnabled: z.boolean().optional(),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  auditEnabled: z.boolean().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()).max(200),
});
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

export const roleIdParamsSchema = z.object({
  roleId: z.string().uuid("roleId inválido"),
});
