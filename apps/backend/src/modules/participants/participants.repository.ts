import { prisma } from "../../database/prisma.js";
import type { Prisma } from "@prisma/client";

export function createParticipant(data: Prisma.ParticipantUncheckedCreateInput) {
  return prisma.participant.create({ data });
}

export function createManyParticipants(data: Prisma.ParticipantUncheckedCreateInput[]) {
  return prisma.participant.createMany({ data });
}

export function listParticipantsByEvent(eventId: string) {
  return prisma.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

/** Ids dos participantes do evento que vieram de uma inscrição. */
export async function listInscribedParticipantIds(eventId: string): Promise<Set<string>> {
  const rows = await prisma.inscription.findMany({
    where: { eventId, participantId: { not: null } },
    select: { participantId: true },
  });
  return new Set(rows.map((r) => r.participantId!));
}

export function findParticipantById(eventId: string, participantId: string) {
  return prisma.participant.findFirst({ where: { id: participantId, eventId } });
}

export function findParticipantByQrToken(qrToken: string) {
  return prisma.participant.findUnique({ where: { qrToken } });
}

/** Payload enxuto para o terminal cachear localmente (offline-first —
 * seção 13 da especificação: o terminal precisa dos participantes e QR
 * tokens antes do evento, para validar leituras sem depender da rede). */
export function listParticipantsForOfflineSync(eventId: string) {
  return prisma.participant.findMany({
    where: { eventId },
    select: { id: true, name: true, email: true, phone: true, document: true, qrToken: true, status: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });
}

export function updateParticipant(participantId: string, data: Prisma.ParticipantUpdateInput) {
  return prisma.participant.update({ where: { id: participantId }, data });
}

/** Inscrição de onde o participante veio (confirmação de pagamento ou
 * cortesia lançada pelo painel). Participante criado direto na aba
 * Participantes ou por CSV de participantes não tem. */
export function findLinkedInscription(participantId: string) {
  return prisma.inscription.findFirst({ where: { participantId } });
}

/** Atualiza o participante e, se vier de uma inscrição, os mesmos dados
 * nela — na mesma transação, para os dois nunca divergirem. */
export function updateParticipantAndInscription(
  participantId: string,
  participantData: Prisma.ParticipantUpdateInput,
  inscriptionId: string | null,
  inscriptionData: Prisma.InscriptionUpdateInput
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.update({ where: { id: participantId }, data: participantData });
    if (inscriptionId) {
      await tx.inscription.update({ where: { id: inscriptionId }, data: inscriptionData });
    }
    return participant;
  });
}

/** Apaga o participante. onDelete: Cascade (ver schema.prisma) remove
 * junto qualquer check-in dele — diferente de excluir um terminal, aqui
 * não dá pra preservar histórico porque o próprio dono do registro deixa
 * de existir. */
export function deleteParticipant(participantId: string) {
  return prisma.participant.delete({ where: { id: participantId } });
}

/** Usado na detecção de duplicados durante a importação: participantes já
 * existentes no evento com o mesmo e-mail ou documento informados. */
export function findExistingByEmailOrDocument(eventId: string, emails: string[], documents: string[]) {
  return prisma.participant.findMany({
    where: {
      eventId,
      OR: [
        emails.length ? { email: { in: emails } } : undefined,
        documents.length ? { document: { in: documents } } : undefined,
      ].filter(Boolean) as Prisma.ParticipantWhereInput[],
    },
    select: { email: true, document: true },
  });
}
