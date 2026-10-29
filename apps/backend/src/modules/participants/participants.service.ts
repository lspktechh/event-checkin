import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { generateQrToken } from "../../shared/tokens.js";
import * as participantsRepository from "./participants.repository.js";
import { isAlreadyInEvent, normalizeEmail, onlyDigits } from "./participants.identity.js";
import { analyzeImport, type ImportReport } from "./participants.import.js";
import type { CreateParticipantInput, UpdateParticipantInput } from "./participants.schema.js";

export async function createParticipant(eventId: string, input: CreateParticipantInput) {
  return participantsRepository.createParticipant({
    eventId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    document: input.document,
    qrToken: generateQrToken(),
    isCourtesy: input.cortesia,
  });
}

/** `hasInscription` diz à tela quando a cortesia NÃO pode ser mexida aqui
 * (quem veio de inscrição tem a cortesia definida pela forma de pagamento). */
export async function listParticipants(eventId: string) {
  const [participants, inscribed] = await Promise.all([
    participantsRepository.listParticipantsByEvent(eventId),
    participantsRepository.listInscribedParticipantIds(eventId),
  ]);
  return participants.map((p) => ({ ...p, hasInscription: inscribed.has(p.id) }));
}

export async function listParticipantsForOfflineSync(eventId: string) {
  return participantsRepository.listParticipantsForOfflineSync(eventId);
}

export async function getParticipantOrThrow(eventId: string, participantId: string) {
  const participant = await participantsRepository.findParticipantById(eventId, participantId);
  if (!participant) {
    throw new NotFoundError("Participante não encontrado");
  }
  return participant;
}

/**
 * Edita um participante. Quem veio de uma inscrição tem os dados
 * repetidos nela (o relatório de Inscritos lê de lá), então nome, e-mail,
 * CPF e telefone vão para os dois lugares, juntos.
 *
 * Cortesia: só para quem NÃO veio de inscrição. Com inscrição, quem manda
 * é a forma de pagamento dela (é onde está o dinheiro); permitir mudar só
 * a marca aqui faria participante e inscrição se contradizerem.
 */
export async function updateParticipant(eventId: string, participantId: string, input: UpdateParticipantInput) {
  const atual = await getParticipantOrThrow(eventId, participantId);
  const { cortesia, ...dados } = input;
  const inscricao = await participantsRepository.findLinkedInscription(participantId);

  if (cortesia !== undefined && cortesia !== atual.isCourtesy && inscricao) {
    throw new ConflictError(
      "CORTESIA_PELA_INSCRICAO",
      "Este participante veio de uma inscrição: altere a forma de pagamento na aba Inscritos"
    );
  }

  // Só confere o que mudou — duplicado antigo não impede corrigir um telefone.
  const emailMudou = dados.email !== undefined && normalizeEmail(dados.email) !== normalizeEmail(atual.email);
  const documentoMudou = dados.document !== undefined && onlyDigits(dados.document) !== onlyDigits(atual.document);
  if (emailMudou || documentoMudou) {
    const duplicado = await isAlreadyInEvent(
      prisma,
      eventId,
      { email: emailMudou ? dados.email : undefined, document: documentoMudou ? dados.document : undefined },
      { ignoreParticipantId: participantId }
    );
    if (duplicado) {
      throw new ConflictError("JA_INSCRITO", "Já existe outra pessoa neste evento com esse e-mail ou CPF");
    }
  }

  return participantsRepository.updateParticipantAndInscription(
    participantId,
    { ...dados, ...(cortesia !== undefined ? { isCourtesy: cortesia } : {}) },
    inscricao?.id ?? null,
    { name: dados.name, email: dados.email, document: dados.document, phone: dados.phone }
  );
}

export async function deleteParticipant(eventId: string, participantId: string) {
  await getParticipantOrThrow(eventId, participantId);
  await participantsRepository.deleteParticipant(participantId);
}

/** Revoga o token atual e gera um novo — o QR antigo deixa de validar
 * imediatamente (seção 9: "deve existir possibilidade de gerar um novo token"). */
export async function rotateQrToken(eventId: string, participantId: string) {
  await getParticipantOrThrow(eventId, participantId);
  return participantsRepository.updateParticipant(participantId, {
    qrToken: generateQrToken(),
    revokedAt: null,
  });
}

export async function importParticipants(
  eventId: string,
  csv: string,
  confirm: boolean,
  cortesia = false,
): Promise<ImportReport & { imported: number }> {
  const report = await analyzeImport(eventId, csv);

  if (!confirm) {
    return { ...report, imported: 0 };
  }

  const validRows = report.rows.filter((r) => r.status === "valid");
  if (validRows.length > 0) {
    await participantsRepository.createManyParticipants(
      validRows.map((row) => ({
        eventId,
        name: row.name!,
        email: row.email,
        phone: row.phone,
        document: row.document,
        qrToken: generateQrToken(),
        isCourtesy: cortesia,
      }))
    );
  }

  return { ...report, imported: validRows.length };
}
