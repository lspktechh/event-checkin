import { prisma } from "../../database/prisma.js";
import { ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { buildEventsSummaryMarkdown, totalsOf, type EventSummaryRow } from "./reports.markdown.js";

/**
 * Relatório geral dos eventos escolhidos. SÓ LEITURA: lê contagens agrupadas
 * por evento (uma consulta por tabela, não uma por evento) e não grava nada.
 *
 * Conta restrita a eventos (User.allowedEventIds) só pode pedir os seus. A
 * checagem vem ANTES de procurar os eventos, para o erro não revelar se um
 * evento alheio existe.
 */
export async function getEventsSummary(eventIds: string[], allowedEventIds: string[]) {
  const ids = [...new Set(eventIds)];
  if (allowedEventIds.length > 0 && ids.some((id) => !allowedEventIds.includes(id))) {
    throw new ForbiddenError("Sua conta não tem acesso a este evento");
  }

  const events = await prisma.event.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, startDate: true, endDate: true, timezone: true, status: true },
  });
  if (events.length !== ids.length) throw new NotFoundError("Evento não encontrado");

  const where = { eventId: { in: ids } };
  const [inscriptions, participants, presences, certificates, submissions] = await Promise.all([
    prisma.inscription.groupBy({
      by: ["eventId", "status", "isCourtesy"],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.participant.groupBy({ by: ["eventId", "status"], where, _count: { _all: true } }),
    // Pessoas, não linhas: em evento por dia a mesma pessoa tem uma presença por dia.
    prisma.checkIn.groupBy({ by: ["eventId", "participantId"], where }),
    prisma.certificate.groupBy({ by: ["eventId", "status"], where, _count: { _all: true } }),
    prisma.submission.groupBy({ by: ["eventId", "status"], where, _count: { _all: true } }),
  ]);

  const rows: EventSummaryRow[] = events.map((e) => {
    const ins = inscriptions.filter((r) => r.eventId === e.id);
    const insCount = (status?: string, courtesyOnly = false) =>
      ins
        .filter((r) => (status ? r.status === status : true) && (courtesyOnly ? r.isCourtesy : true))
        .reduce((acc, r) => acc + r._count._all, 0);
    const certCount = (status: string) =>
      certificates.filter((r) => r.eventId === e.id && r.status === status).reduce((acc, r) => acc + r._count._all, 0);

    return {
      eventId: e.id,
      name: e.name,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate.toISOString(),
      timezone: e.timezone,
      status: e.status,
      inscriptions: {
        total: insCount(),
        confirmed: insCount("CONFIRMED"),
        pending: insCount("PENDING"),
        cancelled: insCount("CANCELLED"),
        courtesy: ins.filter((r) => r.status === "CONFIRMED" && r.isCourtesy).reduce((acc, r) => acc + r._count._all, 0),
        revenue: ins
          .filter((r) => r.status === "CONFIRMED")
          .reduce((acc, r) => acc + Number(r._sum.amount ?? 0), 0),
      },
      participants: participants
        .filter((r) => r.eventId === e.id && r.status === "ACTIVE")
        .reduce((acc, r) => acc + r._count._all, 0),
      present: presences.filter((r) => r.eventId === e.id).length,
      certificates: { generated: certCount("GENERATED"), eligible: certCount("ELIGIBLE"), revoked: certCount("REVOKED") },
      // Rascunho não é trabalho submetido.
      submissions: submissions
        .filter((r) => r.eventId === e.id && r.status !== "DRAFT")
        .reduce((acc, r) => acc + r._count._all, 0),
    };
  });

  const generatedAt = new Date();
  return {
    generatedAt: generatedAt.toISOString(),
    events: rows,
    totals: totalsOf(rows),
    markdown: buildEventsSummaryMarkdown(rows, generatedAt),
  };
}
