import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError, ConflictError, ForbiddenError } from "../../shared/errors.js";
import { getEventOrThrow } from "../events/events.service.js";
import * as batchesService from "../batches/batches.service.js";
import { EMAIL_REGEX, parseCsvRows, type ImportReport, type ImportRowResult } from "../participants/participants.import.js";
import * as inscriptionsRepository from "./inscriptions.repository.js";
import { confirmInscriptionPayment } from "./inscriptions.service.js";
import type { CreateManualInscriptionInput } from "./inscriptions.schema.js";

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
 * cancelada pode ser readmitido pela organização. */
export async function isAlreadyInEvent(
  db: Prisma.TransactionClient | typeof prisma,
  eventId: string,
  candidate: { email?: string | null; document?: string | null },
): Promise<boolean> {
  const email = normalizeEmail(candidate.email);
  const document = onlyDigits(candidate.document);
  if (!email && !document) return false;

  const ativos = await db.participant.findMany({
    where: { eventId, status: "ACTIVE" },
    select: { email: true, document: true },
  });
  return ativos.some(
    (p) => (email && normalizeEmail(p.email) === email) || (document && onlyDigits(p.document) === document),
  );
}

/**
 * Inscrição lançada pela organização no painel.
 *
 * Cortesia = valor zero, MAS ocupa vaga do lote ativo (decisão do
 * produto: convidado também senta). Sem cortesia é uma inscrição paga
 * por fora (dinheiro, Pix direto): preço do lote, provedor MANUAL.
 *
 * Difere da inscrição pública de propósito: ignora "inscrições
 * encerradas" (é quando a organização mais adiciona convidados) e não
 * tem aceite de termo — quem preenche é a organização, não a pessoa.
 *
 * A confirmação passa pelo MESMO `confirmInscriptionPayment` do
 * pagamento aprovado: participante, QR Code, comprovante por e-mail e
 * aviso em tempo real saem de um caminho só.
 */
export async function createManualInscription(eventId: string, input: CreateManualInscriptionInput) {
  await getEventOrThrow(eventId);

  const { activeBatch, currentBatch } = await batchesService.resolveActiveBatch(eventId);
  if (!activeBatch) {
    if (currentBatch && currentBatch.maxQuantity !== null) {
      throw new batchesService.LoteEsgotadoError(currentBatch.name);
    }
    throw new ForbiddenError("Todos os lotes de inscrição para este evento foram encerrados");
  }

  const amount = input.cortesia ? 0 : Number(activeBatch.price);

  const inscription = await prisma.$transaction(async (tx) => {
    // Primeiro a vaga (que trava o lote), depois a conferência de
    // duplicado: assim duas requisições iguais não passam juntas pela
    // conferência antes de qualquer uma ter criado a inscrição.
    await batchesService.reservarVaga(tx, activeBatch.id);

    if (await isAlreadyInEvent(tx, eventId, input)) {
      throw new ConflictError("JA_INSCRITO", `${input.name} já está inscrito(a) neste evento`);
    }

    return inscriptionsRepository.createInscription(tx, {
      eventId,
      name: input.name,
      email: input.email,
      document: input.document,
      phone: input.phone,
      institution: input.institution,
      category: activeBatch.name,
      amount,
      batchId: activeBatch.id,
      notes: input.notes,
      isCourtesy: input.cortesia,
      paymentProvider: input.cortesia ? null : "MANUAL",
      consentVersion: null,
      consentAcceptedAt: null,
    });
  });

  const confirmada = await confirmInscriptionPayment(inscription.id);

  return {
    id: confirmada.id,
    status: confirmada.status,
    amount,
    category: confirmada.category,
    isCourtesy: confirmada.isCourtesy,
    participantId: confirmada.participantId,
  };
}

export interface InscriptionImportReport extends ImportReport {
  imported: number;
  /** Linhas que a análise aceitou mas que falharam ao gravar (ex.: o lote
   * encheu entre o preview e a confirmação). */
  failed: { row: number; reason: string }[];
}

/**
 * Analisa o CSV sem gravar nada: valida, detecta duplicados (no arquivo
 * e entre quem já está no evento) e reparte as vagas do lote ativo na
 * ordem do arquivo — o que passa do teto vira "sem vaga" já no preview,
 * para a confirmação nunca entregar menos do que ele prometeu.
 *
 * Diferente da importação de participantes, e-mail e CPF são
 * obrigatórios: a inscrição exige os dois.
 */
async function analyzeInscriptionImport(eventId: string, csvContent: string): Promise<ImportReport> {
  const candidates = parseCsvRows(csvContent);

  const ativos = await prisma.participant.findMany({
    where: { eventId, status: "ACTIVE" },
    select: { email: true, document: true },
  });
  const emailsNoEvento = new Set(ativos.map((p) => normalizeEmail(p.email)).filter(Boolean));
  const documentosNoEvento = new Set(ativos.map((p) => onlyDigits(p.document)).filter(Boolean));

  const { activeBatch, countMap } = await batchesService.resolveActiveBatch(eventId);
  let vagas = !activeBatch
    ? 0
    : activeBatch.maxQuantity === null
      ? Number.POSITIVE_INFINITY
      : Math.max(0, activeBatch.maxQuantity - (countMap.get(activeBatch.id) ?? 0));
  const motivoSemVaga = activeBatch ? `Sem vaga no ${activeBatch.name}` : "Nenhum lote ativo com vaga";

  const emailsNoArquivo = new Set<string>();
  const documentosNoArquivo = new Set<string>();
  const rows: ImportRowResult[] = [];

  for (const c of candidates) {
    if (!c.name) {
      rows.push({ ...c, status: "invalid", reason: "Nome é obrigatório" });
      continue;
    }
    if (!c.email) {
      rows.push({ ...c, status: "invalid", reason: "E-mail é obrigatório" });
      continue;
    }
    if (!EMAIL_REGEX.test(c.email)) {
      rows.push({ ...c, status: "invalid", reason: "E-mail inválido" });
      continue;
    }
    if (!c.document) {
      rows.push({ ...c, status: "invalid", reason: "CPF é obrigatório" });
      continue;
    }

    const jaNoEvento = emailsNoEvento.has(c.email) || documentosNoEvento.has(c.document);
    const repetidoNoArquivo = emailsNoArquivo.has(c.email) || documentosNoArquivo.has(c.document);
    if (jaNoEvento || repetidoNoArquivo) {
      rows.push({
        ...c,
        status: "duplicate",
        reason: jaNoEvento ? "Já cadastrado neste evento" : "Duplicado dentro do próprio arquivo",
      });
      continue;
    }

    if (vagas <= 0) {
      rows.push({ ...c, status: "invalid", reason: motivoSemVaga });
      continue;
    }

    vagas -= 1;
    emailsNoArquivo.add(c.email);
    documentosNoArquivo.add(c.document);
    rows.push({ ...c, status: "valid" });
  }

  return {
    totalRows: rows.length,
    validCount: rows.filter((r) => r.status === "valid").length,
    invalidCount: rows.filter((r) => r.status === "invalid").length,
    duplicateCount: rows.filter((r) => r.status === "duplicate").length,
    rows,
  };
}

/**
 * Importação de inscritos por CSV: `confirm=false` só analisa (preview);
 * `confirm=true` grava as linhas válidas, uma a uma, pelo MESMO caminho
 * da inscrição manual (vaga do lote, participante, QR, comprovante).
 * `cortesia` vale para o arquivo inteiro.
 */
export async function importInscriptions(
  eventId: string,
  csv: string,
  confirm: boolean,
  cortesia: boolean,
): Promise<InscriptionImportReport> {
  const report = await analyzeInscriptionImport(eventId, csv);
  if (!confirm) return { ...report, imported: 0, failed: [] };

  let imported = 0;
  const failed: InscriptionImportReport["failed"] = [];
  for (const row of report.rows) {
    if (row.status !== "valid") continue;
    try {
      await createManualInscription(eventId, {
        name: row.name!,
        email: row.email!,
        document: row.document!,
        phone: row.phone,
        cortesia,
      });
      imported += 1;
    } catch (err) {
      // Só o que é regra de negócio (lote cheio, duplicado de última hora)
      // vira "falhou"; erro inesperado sobe e aparece como 500.
      if (!(err instanceof AppError)) throw err;
      failed.push({ row: row.row, reason: err.message });
    }
  }
  return { ...report, imported, failed };
}
