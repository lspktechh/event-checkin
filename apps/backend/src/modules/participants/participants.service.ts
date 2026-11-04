import { prisma } from "../../database/prisma.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { eventIsCopol } from "../../shared/copol.js";
import { generateQrToken } from "../../shared/tokens.js";
import { createManualInscriptionSchema } from "../inscriptions/inscriptions.schema.js";
import { createManualInscription, importInscriptions } from "../inscriptions/inscriptions.manual.js";
import * as participantsRepository from "./participants.repository.js";
import { isAlreadyInEvent, normalizeEmail, onlyDigits } from "./participants.identity.js";
import { analyzeImport, type ImportReport } from "./participants.import.js";
import type { CreateParticipantInput, UpdateParticipantInput } from "./participants.schema.js";

/**
 * COPOL: cortesia lançada na aba Participantes entra pelo MESMO caminho da
 * cortesia da aba Inscritos — inscrição confirmada de valor zero (ocupa vaga
 * do lote) + participante com QR. Assim ela aparece nas duas abas e no
 * relatório de Inscritos, que lê das inscrições. A inscrição exige e-mail e
 * CPF, então aqui eles também são obrigatórios.
 */
async function createCopolCourtesy(eventId: string, input: CreateParticipantInput) {
  const dados = createManualInscriptionSchema.safeParse({
    name: input.name,
    email: input.email ?? "",
    document: input.document ?? "",
    phone: input.phone || null,
    cortesia: true,
  });
  if (!dados.success) {
    throw new ValidationError(
      `No COPOL a cortesia também entra em Inscritos: ${dados.error.issues[0]?.message ?? "dados inválidos"}`,
    );
  }
  const inscricao = await createManualInscription(eventId, dados.data);
  return getParticipantOrThrow(eventId, inscricao.participantId!);
}

export async function createParticipant(eventId: string, input: CreateParticipantInput) {
  if (input.cortesia && (await eventIsCopol(eventId))) return createCopolCourtesy(eventId, input);
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

export interface LinkCourtesiesResult {
  linked: number;
  /** Cortesias que ficaram de fora, com o motivo. */
  skipped: { id: string; name: string; reason: string }[];
}

/**
 * COPOL: traz para a lista de Inscritos as cortesias que só existem como
 * participante.
 *
 * Antes, a aba Participantes gravava a cortesia só como participante, sem
 * inscrição — e o relatório de Inscritos lê das inscrições, então ela nunca
 * aparecia lá. Isto cria, para cada uma, a inscrição de cortesia (valor
 * zero, confirmada) LIGADA ao mesmo participante: o QR que a pessoa já tem
 * continua o mesmo.
 *
 * Não ocupa vaga do lote (batchId vazio): são pessoas que já estavam no
 * evento, e fazê-las contar agora poderia esgotar o lote e fechar as vendas.
 * As cortesias novas, lançadas depois, ocupam vaga normalmente.
 *
 * A inscrição exige e-mail e CPF; quem não tem os dois é pulado e avisado
 * (complete em "Editar" e rode de novo). Só pega participante ATIVO,
 * cortesia e sem inscrição; quem já consta no evento por outra inscrição
 * ou participante é pulado, para não haver duas linhas da mesma pessoa.
 * Pode rodar de novo sem efeito.
 */
export async function linkCourtesiesToInscriptions(eventId: string): Promise<LinkCourtesiesResult> {
  if (!(await eventIsCopol(eventId))) {
    throw new ConflictError("SO_COPOL", "Esta ação só existe para o evento do COPOL");
  }

  const [candidatos, inscritos, inscricoes] = await Promise.all([
    prisma.participant.findMany({
      where: { eventId, isCourtesy: true, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    }),
    participantsRepository.listInscribedParticipantIds(eventId),
    // Inscrição viva (não cancelada) que ainda não tem participante, p.ex. a
    // pendente de Pix: se for da mesma pessoa, a cortesia não pode duplicá-la.
    prisma.inscription.findMany({
      where: { eventId, status: { not: "CANCELLED" } },
      select: { email: true, document: true, participantId: true },
    }),
  ]);
  const emailsInscritos = new Set(inscricoes.map((i) => normalizeEmail(i.email)).filter(Boolean));
  const documentosInscritos = new Set(inscricoes.map((i) => onlyDigits(i.document)).filter(Boolean));

  const result: LinkCourtesiesResult = { linked: 0, skipped: [] };
  for (const p of candidatos) {
    if (inscritos.has(p.id)) continue;

    const email = p.email?.trim() ?? "";
    const document = p.document?.trim() ?? "";
    if (!email || !document) {
      result.skipped.push({
        id: p.id,
        name: p.name,
        reason: "Sem e-mail ou CPF: complete em Editar e tente de novo",
      });
      continue;
    }

    const outroParticipante = await isAlreadyInEvent(prisma, eventId, { email, document }, { ignoreParticipantId: p.id });
    if (outroParticipante || emailsInscritos.has(normalizeEmail(email)) || documentosInscritos.has(onlyDigits(document))) {
      result.skipped.push({ id: p.id, name: p.name, reason: "Já consta no evento com outra inscrição" });
      continue;
    }

    const criou = await prisma.$transaction(async (tx) => {
      // Trava o participante: dois cliques juntos não criam duas inscrições.
      await tx.$queryRaw`SELECT id FROM participants WHERE id = ${p.id} FOR UPDATE`;
      if (await tx.inscription.findFirst({ where: { participantId: p.id }, select: { id: true } })) return false;
      await tx.inscription.create({
        data: {
          eventId,
          participantId: p.id,
          name: p.name,
          email,
          document,
          phone: p.phone,
          category: "Cortesia",
          amount: 0,
          status: "CONFIRMED",
          isCourtesy: true,
          paymentProvider: null,
        },
      });
      return true;
    });
    if (criou) result.linked += 1;
  }
  return result;
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
  // COPOL + cortesia: cada linha vira inscrição (e participante com QR), como
  // na importação da aba Inscritos — com e-mail/CPF obrigatórios e vaga no lote.
  if (cortesia && (await eventIsCopol(eventId))) {
    return importInscriptions(eventId, csv, confirm, true);
  }

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
