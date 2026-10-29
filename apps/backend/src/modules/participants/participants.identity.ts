import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Já existe participante ATIVO neste evento com o mesmo e-mail ou CPF?
 *
 * Compara CPF só pelos dígitos ("123.456.789-01" e "12345678901" são a
 * mesma pessoa) e ignora participante cancelado — quem teve a inscrição
 * cancelada pode ser readmitido pela organização.
 *
 * `ignoreParticipantId`: ao EDITAR alguém, ele mesmo não conta como
 * duplicado de si. */
export async function isAlreadyInEvent(
  db: Prisma.TransactionClient | typeof prisma,
  eventId: string,
  candidate: { email?: string | null; document?: string | null },
  opts: { ignoreParticipantId?: string } = {},
): Promise<boolean> {
  const email = normalizeEmail(candidate.email);
  const document = onlyDigits(candidate.document);
  if (!email && !document) return false;

  const ativos = await db.participant.findMany({
    where: {
      eventId,
      status: "ACTIVE",
      ...(opts.ignoreParticipantId ? { id: { not: opts.ignoreParticipantId } } : {}),
    },
    select: { email: true, document: true },
  });
  return ativos.some(
    (p) => (email && normalizeEmail(p.email) === email) || (document && onlyDigits(p.document) === document),
  );
}
