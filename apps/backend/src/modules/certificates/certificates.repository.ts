import { prisma } from "../../database/prisma.js";
import type { CertificateStatus } from "@prisma/client";
import { generateVerificationCode } from "../../shared/tokens.js";

export function findEventById(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

export function findParticipantInEvent(eventId: string, participantId: string) {
  return prisma.participant.findFirst({ where: { id: participantId, eventId } });
}

/** A primeira presença do participante no evento. Em evento por dia pode
 * haver uma por dia; para elegibilidade e comprovante basta a primeira
 * (presença em QUALQUER dia conta), e a ordem torna a escolha estável. */
export function findCheckIn(eventId: string, participantId: string) {
  return prisma.checkIn.findFirst({
    where: { eventId, participantId },
    orderBy: { checkedInAt: "asc" },
    include: { terminal: { select: { name: true } } },
  });
}

export function findCertificate(eventId: string, participantId: string) {
  return prisma.certificate.findUnique({ where: { eventId_participantId: { eventId, participantId } } });
}

export function findCertificateById(certificateId: string) {
  return prisma.certificate.findUnique({ where: { id: certificateId } });
}

export function findCertificateByVerificationCode(verificationCode: string) {
  return prisma.certificate.findUnique({
    where: { verificationCode },
    include: {
      event: { select: { name: true, location: true, startDate: true, endDate: true } },
      participant: { select: { name: true } },
    },
  });
}

/** Garante que existe uma linha Certificate para este par (evento,
 * participante), criando com status LOCKED se ainda não existir. É
 * idempotente e nunca sobrescreve um status já mais avançado — só existe
 * pra garantir que o verificationCode (usado no QR) já esteja estável
 * antes de qualquer geração de PDF. */
export async function ensureCertificate(eventId: string, participantId: string) {
  const existing = await findCertificate(eventId, participantId);
  if (existing) return existing;
  return prisma.certificate.create({
    data: { eventId, participantId, status: "LOCKED", verificationCode: generateVerificationCode("cert") },
  });
}

export function markCertificateGenerated(
  certificateId: string,
  fileKey: string,
  workloadHours: number,
  settingsSnapshotHash: string
) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "GENERATED", fileKey, workloadHours, settingsSnapshotHash, generatedAt: new Date() },
  });
}

export function markCertificateRevoked(certificateId: string) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
}

export function markCertificateReinstated(certificateId: string) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "GENERATED", revokedAt: null },
  });
}

export function markCertificateManuallyReleased(certificateId: string, releasedByUserId: string) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { manuallyReleasedAt: new Date(), manuallyReleasedBy: releasedByUserId },
  });
}

/** Desfaz a liberação manual. Não mexe em `status`: se o participante já
 * chegou a baixar (GENERATED), quem tira o acesso é a revogação — este
 * caminho só remove o "atalho" que tornava a pessoa elegível sem
 * cumprir a regra automática. */
export function clearCertificateManualRelease(certificateId: string) {
  return prisma.certificate.update({
    where: { id: certificateId },
    data: { manuallyReleasedAt: null, manuallyReleasedBy: null },
  });
}

/** Participantes do evento + o certificado de cada um (quando existe) e
 * se têm check-in. Alimenta a coluna "Certificado" da aba de
 * participantes do admin, que precisa mostrar o estado de TODO mundo —
 * inclusive de quem não tem linha em Certificate ainda, que é
 * exatamente quem costuma precisar da liberação manual. */
export function listParticipantsWithCertificate(eventId: string) {
  return prisma.participant.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      // Para casar com a avaliação pós-evento (ver certificate-por-avaliacao.ts).
      email: true,
      certificates: {
        where: { eventId },
        select: {
          id: true,
          status: true,
          generatedAt: true,
          manuallyReleasedAt: true,
        },
        take: 1,
      },
      checkIns: { where: { eventId }, select: { id: true }, take: 1 },
    },
  });
}

export function listCertificatesByEvent(eventId: string) {
  return prisma.certificate.findMany({
    where: { eventId },
    include: { participant: { select: { name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export function countCertificatesByStatus(eventId: string, status: CertificateStatus) {
  return prisma.certificate.count({ where: { eventId, status } });
}

export function countParticipants(eventId: string) {
  return prisma.participant.count({ where: { eventId, status: "ACTIVE" } });
}

/** Pessoas presentes (não linhas): em evento por dia a mesma pessoa tem uma
 * presença por dia e não pode contar três vezes. */
export async function countCheckIns(eventId: string) {
  const rows = await prisma.checkIn.groupBy({ by: ["participantId"], where: { eventId } });
  return rows.length;
}

/** Cria (idempotente) uma linha Certificate LOCKED para todo participante
 * presente que ainda não tem uma — usado pela liberação em massa do admin
 * (POST /events/:eventId/certificates/release). Não gera PDF nenhum aqui;
 * só garante que a linha existe pra aparecer na listagem/estatística do
 * admin antes do primeiro download. Ver certificates.service.ts pra por
 * que o status real (LOCKED/ELIGIBLE) é sempre recalculado, não gravado
 * por esta função. */
export async function ensureCertificatesForPresentParticipants(eventId: string) {
  // distinct: em evento por dia a mesma pessoa tem várias presenças, e
  // sem isso o createMany abaixo tentaria criar o mesmo certificado 2x.
  const present = await prisma.checkIn.findMany({
    where: { eventId },
    select: { participantId: true },
    distinct: ["participantId"],
  });
  const existing = await prisma.certificate.findMany({ where: { eventId }, select: { participantId: true } });
  const existingIds = new Set(existing.map((c) => c.participantId));
  const toCreate = present.filter((c) => !existingIds.has(c.participantId));

  if (toCreate.length === 0) return 0;

  await prisma.certificate.createMany({
    data: toCreate.map((c) => ({
      eventId,
      participantId: c.participantId,
      status: "LOCKED" as const,
      verificationCode: generateVerificationCode("cert"),
    })),
    skipDuplicates: true,
  });
  return toCreate.length;
}

// --- Comprovante de presença ---

export function findAttendanceProof(eventId: string, participantId: string) {
  return prisma.attendanceProof.findUnique({ where: { eventId_participantId: { eventId, participantId } } });
}

export async function ensureAttendanceProof(eventId: string, participantId: string) {
  const existing = await findAttendanceProof(eventId, participantId);
  if (existing) return existing;
  return prisma.attendanceProof.create({
    data: { eventId, participantId, verificationCode: generateVerificationCode("att") },
  });
}

export function markAttendanceProofGenerated(id: string, fileKey: string) {
  return prisma.attendanceProof.update({ where: { id }, data: { fileKey, generatedAt: new Date() } });
}
