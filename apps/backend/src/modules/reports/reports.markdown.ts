/**
 * Relatório geral de eventos em Markdown.
 *
 * Funções puras (sem banco): recebem os números já apurados de cada evento e
 * montam o texto. Ficam separadas do serviço para o formato — que vai para um
 * documento que a organização repassa — ser testado sozinho.
 */

export interface EventSummaryRow {
  eventId: string;
  name: string;
  startDate: string;
  endDate: string;
  /** Fuso do evento: as datas do relatório são as do calendário dele, não as de UTC. */
  timezone: string;
  status: string;
  inscriptions: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    /** Cortesias confirmadas. */
    courtesy: number;
    /** Soma das inscrições CONFIRMADAS (pendente e cancelada não entram). */
    revenue: number;
  };
  /** Participantes ATIVOS (cancelado fica de fora). */
  participants: number;
  /** PESSOAS com ao menos uma presença (em evento por dia a mesma pessoa tem várias linhas). */
  present: number;
  certificates: { generated: number; eligible: number; revoked: number };
  /** Trabalhos submetidos (rascunho não conta). */
  submissions: number;
}

export interface EventsSummaryTotals {
  events: number;
  inscriptions: EventSummaryRow["inscriptions"];
  participants: number;
  present: number;
  certificates: EventSummaryRow["certificates"];
  submissions: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalsOf(rows: EventSummaryRow[]): EventsSummaryTotals {
  const sum = (pick: (r: EventSummaryRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0);
  return {
    events: rows.length,
    inscriptions: {
      total: sum((r) => r.inscriptions.total),
      confirmed: sum((r) => r.inscriptions.confirmed),
      pending: sum((r) => r.inscriptions.pending),
      cancelled: sum((r) => r.inscriptions.cancelled),
      courtesy: sum((r) => r.inscriptions.courtesy),
      revenue: round2(sum((r) => r.inscriptions.revenue)),
    },
    participants: sum((r) => r.participants),
    present: sum((r) => r.present),
    certificates: {
      generated: sum((r) => r.certificates.generated),
      eligible: sum((r) => r.certificates.eligible),
      revoked: sum((r) => r.certificates.revoked),
    },
    submissions: sum((r) => r.submissions),
  };
}

/** "1.234,50" — padrão brasileiro. */
function brl(value: number): string {
  const [int, dec] = value.toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/** Presença em % com vírgula; "—" quando não há participantes (nada de NaN). */
function percent(present: number, participants: number): string {
  if (participants <= 0) return "—";
  return `${((present / participants) * 100).toFixed(1).replace(".", ",")}%`;
}

function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

function generatedAtLabel(date: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Nome dentro de célula de tabela: `|` e quebra de linha desmontariam as colunas. */
function cell(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", CLOSED: "Encerrado" };

export function buildEventsSummaryMarkdown(rows: EventSummaryRow[], generatedAt: Date): string {
  const t = totalsOf(rows);
  const sorted = [...rows].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name));

  const lines: string[] = [
    "# Relatório geral de eventos",
    "",
    `Gerado em: ${generatedAtLabel(generatedAt)} (Brasília)`,
    "",
    `Escopo: ${t.events} evento(s) selecionado(s) na plataforma. Dados lidos direto do banco, sem estimativas.`,
    "",
    "## Resumo geral",
    "",
    "| Indicador | Total |",
    "|---|---:|",
    `| Eventos | ${t.events} |`,
    `| Inscrições (todas) | ${t.inscriptions.total} |`,
    `| Inscrições confirmadas | ${t.inscriptions.confirmed} |`,
    `| Inscrições pendentes | ${t.inscriptions.pending} |`,
    `| Inscrições canceladas | ${t.inscriptions.cancelled} |`,
    `| Cortesias confirmadas | ${t.inscriptions.courtesy} |`,
    `| Participantes ativos | ${t.participants} |`,
    `| Presentes (pessoas com check-in) | ${t.present} |`,
    `| Taxa de presença | ${percent(t.present, t.participants)} |`,
    `| Certificados emitidos | ${t.certificates.generated} |`,
    `| Certificados aptos (ainda não gerados) | ${t.certificates.eligible} |`,
    `| Certificados revogados | ${t.certificates.revoked} |`,
    `| Trabalhos submetidos | ${t.submissions} |`,
    `| Receita confirmada (R$) | ${brl(t.inscriptions.revenue)} |`,
    "",
    "## Por evento",
    "",
    "| Evento | Período | Situação | Inscritos | Confirmados | Pendentes | Cancelados | Participantes | Presentes | Presença | Certificados emitidos | Trabalhos |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const r of sorted) {
    lines.push(
      `| ${cell(r.name)} | ${localDate(r.startDate, r.timezone)} a ${localDate(r.endDate, r.timezone)} | ${STATUS_LABEL[r.status] ?? r.status} | ` +
        `${r.inscriptions.total} | ${r.inscriptions.confirmed} | ${r.inscriptions.pending} | ${r.inscriptions.cancelled} | ` +
        `${r.participants} | ${r.present} | ${percent(r.present, r.participants)} | ${r.certificates.generated} | ${r.submissions} |`,
    );
  }

  return lines.join("\n") + "\n";
}
