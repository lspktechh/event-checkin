import type { FastifyRequest } from "fastify";
import * as auditRepository from "./audit.repository.js";

/**
 * Registra uma ação administrativa — SÓ se o perfil de quem agiu estiver com a
 * auditoria ligada (Role.auditEnabled, escolhido na tela de Perfis). Perfil
 * desligado não gera registro nenhum.
 *
 * Nunca lança: auditoria não pode derrubar a ação principal se a escrita do
 * log falhar (loga o erro e segue). Exige request.admin (preenchido por
 * requireAdmin/requirePermission), então só deve ser chamado depois desses
 * middlewares.
 */
export async function recordAudit(
  request: FastifyRequest,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: unknown
): Promise<void> {
  const admin = request.admin;
  if (!admin || !admin.auditEnabled) return;

  try {
    await auditRepository.createAuditLog({
      actorId: admin.userId,
      actorEmail: admin.email,
      action,
      entityType,
      entityId,
      metadata,
    });
  } catch (error) {
    request.log.error({ error, action, entityType }, "Falha ao gravar log de auditoria");
  }
}

export async function listAuditLogs(limit = 200) {
  return auditRepository.listAuditLogs(Math.min(limit, 500));
}

/**
 * Ações disparadas pelo próprio participante (portal do participante) não
 * pertencem a nenhum perfil, e a auditoria é escolhida por perfil — então
 * continuam SEM registro. Mantido como no-op para preservar a compatibilidade
 * de chamada em certificates.routes.ts.
 */
export async function recordParticipantAudit(
  _request: FastifyRequest,
  _action: string,
  _entityType: string,
  _entityId: string | null,
  _actorEmail: string,
  _metadata?: unknown
): Promise<void> {
  return;
}
