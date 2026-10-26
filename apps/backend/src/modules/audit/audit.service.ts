import type { FastifyRequest } from "fastify";

/**
 * Auditoria desativada conforme solicitação (não registra o que cada pessoa fez).
 * Mantido como no-op para preservar a compatibilidade de chamada nos serviços/rotas.
 */
export async function recordAudit(
  _request: FastifyRequest,
  _action: string,
  _entityType: string,
  _entityId?: string | null,
  _metadata?: unknown
): Promise<void> {
  // Auditoria de ações por pessoa desativada
  return;
}

export async function listAuditLogs(_limit = 200) {
  return [];
}

/**
 * Mantido como no-op para preservar a compatibilidade de chamada.
 */
export async function recordParticipantAudit(
  _request: FastifyRequest,
  _action: string,
  _entityType: string,
  _entityId: string | null,
  _actorEmail: string,
  _metadata?: unknown
): Promise<void> {
  // Auditoria desativada
  return;
}
