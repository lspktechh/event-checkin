import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import * as api from "../../api/client";
import { shortDate } from "../../utils/eventDay";

/** "all" = o relatório do evento todo; um número = o relatório daquele dia. */
type DayFilter = "all" | number;

/** Pessoas distintas: em evento por dia a mesma pessoa tem uma linha por período. */
function peopleIn(rows: api.ReportCheckIn[]): number {
  return new Set(rows.map((r) => r.participantId)).size;
}

function pct(part: number, total: number): string {
  return total > 0 ? ((part / total) * 100).toFixed(1) : "0";
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dateTimeOf(iso: string): string {
  const dt = new Date(iso);
  return `${dt.toLocaleDateString("pt-BR")} ${timeOf(iso)}`;
}

export function ReportTab({ eventId }: { eventId: string }) {
  const [report, setReport] = useState<api.EventReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");

  useEffect(() => {
    api
      .getReport(eventId)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar relatório"));
  }, [eventId]);

  // Evento por dia (COPOL): o backend manda os dias e os períodos.
  const days = useMemo(() => report?.days ?? [], [report]);
  const periods = useMemo(() => report?.periods ?? [], [report]);
  const hasDays = days.length > 0;

  const view = useMemo(() => {
    if (!report) return null;
    const rows = dayFilter === "all" ? report.checkIns : report.checkIns.filter((r) => r.dayIndex === dayFilter);
    const present = dayFilter === "all" ? report.totalCheckedIn : peopleIn(rows);
    return {
      rows,
      present,
      absent: report.totalRegistered - present,
      perPeriod: periods.map((p) => {
        const inPeriod = rows.filter((r) => r.period === p.index);
        return { period: p, rows: inPeriod, people: peopleIn(inPeriod) };
      }),
    };
  }, [report, dayFilter, periods]);

  const selectedDay = dayFilter === "all" ? null : days.find((d) => d.index === dayFilter) ?? null;
  const scopeLabel = selectedDay ? `Dia ${selectedDay.index} (${shortDate(selectedDay.date)})` : "evento todo";

  function handleDownloadPdf() {
    if (!report || !view) return;
    setGenerating(true);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Header
      doc.setFillColor(14, 54, 52);
      doc.rect(0, 0, pageW, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(
        selectedDay ? `RELATORIO DE PRESENCA - DIA ${selectedDay.index} (${shortDate(selectedDay.date)})` : "RELATORIO DE PRESENCA",
        pageW / 2,
        18,
        { align: "center" },
      );
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(report.eventName, pageW / 2, 25, { align: "center" });

      y = 40;

      // Summary
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo", margin, y);
      y += 7;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Evento: ${report.eventName}`, margin, y); y += 5;
      if (report.eventLocation) {
        doc.text(`Local: ${report.eventLocation}`, margin, y); y += 5;
      }
      if (selectedDay) {
        doc.text(`Dia: ${selectedDay.index} (${shortDate(selectedDay.date)})`, margin, y); y += 5;
      }
      doc.text(`Total de inscritos: ${report.totalRegistered}`, margin, y); y += 5;
      doc.text(`Total de presentes${selectedDay ? " no dia" : ""}: ${view.present}`, margin, y); y += 5;
      if (selectedDay) {
        for (const p of view.perPeriod) {
          doc.text(`Presentes - ${p.period.label} (a partir das ${p.period.startsAt}): ${p.people}`, margin, y); y += 5;
        }
      }
      doc.text(`Ausentes${selectedDay ? " no dia" : ""}: ${view.absent}`, margin, y); y += 5;
      doc.text(`Taxa de presenca: ${pct(view.present, report.totalRegistered)}%`, margin, y); y += 5;
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y); y += 10;

      const cols = [margin, margin + 42, margin + 85, margin + 115, margin + 140, margin + 160];

      function tableHeader() {
        doc.setFillColor(240, 250, 249);
        doc.rect(margin, y, pageW - margin * 2, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text("Participante", cols[0] + 2, y + 5.5);
        doc.text("E-mail", cols[1] + 2, y + 5.5);
        doc.text("CPF", cols[2] + 2, y + 5.5);
        doc.text("Terminal", cols[3] + 2, y + 5.5);
        doc.text("Origem", cols[4] + 2, y + 5.5);
        doc.text(selectedDay ? "Hora" : "Data/Hora", cols[5] + 2, y + 5.5);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(40, 40, 40);
      }

      function tableRows(rows: api.ReportCheckIn[]) {
        for (const row of rows) {
          if (y > 275) {
            doc.addPage();
            y = 20;
          }
          doc.text(truncate(row.participantName, 28), cols[0] + 2, y + 4);
          doc.text(truncate(row.participantEmail ?? "—", 24), cols[1] + 2, y + 4);
          doc.text(truncate(row.participantDocument ?? "—", 14), cols[2] + 2, y + 4);
          doc.text(truncate(row.terminalName ?? "—", 12), cols[3] + 2, y + 4);
          doc.text(row.source === "ONLINE" ? "Online" : "Offline", cols[4] + 2, y + 4);
          // Do dia inteiro: a mesma pessoa tem uma linha por dia e período; o prefixo diz qual.
          const when = selectedDay
            ? timeOf(row.checkedInAt)
            : `${row.dayIndex > 0 ? `D${row.dayIndex} ${periodName(periods, row.period)} ` : ""}${dateTimeOf(row.checkedInAt)}`;
          doc.text(when, cols[5] + 2, y + 4);
          y += 6;
        }
      }

      if (selectedDay) {
        // Um dia: a manhã e a noite em seções separadas.
        for (const section of view.perPeriod) {
          if (y > 255) {
            doc.addPage();
            y = 20;
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(0, 0, 0);
          doc.text(`${section.period.label} (a partir das ${section.period.startsAt}) - ${section.people} presente(s)`, margin, y);
          y += 6;
          if (section.rows.length === 0) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(120, 120, 120);
            doc.text("Nenhum credenciamento neste periodo.", margin, y);
            y += 10;
            continue;
          }
          tableHeader();
          tableRows(section.rows);
          y += 8;
        }
      } else {
        tableHeader();
        tableRows(view.rows);
      }

      // Footer
      y += 5;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Total: ${view.rows.length} presenca(s)`, margin, y);
      y += 5;
      doc.text(`${report.eventName || "Evento"} | LSPK Tecnology`, pageW / 2, y, { align: "center" });

      const suffix = selectedDay ? `-dia-${selectedDay.index}` : "";
      doc.save(`relatorio-${report.eventName.replace(/\s+/g, "_")}${suffix}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!report || !view) return <p className="muted">Carregando...</p>;

  return (
    <div className="stack">
      {hasDays && (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }} role="tablist" aria-label="Relatório por dia">
          <DayChip active={dayFilter === "all"} onClick={() => setDayFilter("all")}>
            Todos os dias
          </DayChip>
          {days.map((d) => (
            <DayChip key={d.index} active={dayFilter === d.index} onClick={() => setDayFilter(d.index)}>
              Dia {d.index} · {shortDate(d.date)}
            </DayChip>
          ))}
        </div>
      )}

      <div className="spread" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 16, flexWrap: "wrap", flex: 1 }}>
          <StatCard label="Inscritos" value={report.totalRegistered} />
          <StatCard label={selectedDay ? "Presentes no dia" : "Presentes"} value={view.present} color="var(--success)" />
          {selectedDay &&
            view.perPeriod.map((p) => (
              <StatCard key={p.period.index} label={`${p.period.label} (${p.period.startsAt})`} value={p.people} color="var(--primary)" />
            ))}
          <StatCard label={selectedDay ? "Ausentes no dia" : "Ausentes"} value={view.absent} color="var(--warning)" />
          <StatCard label="Presenca" value={`${pct(view.present, report.totalRegistered)}%`} color="var(--primary)" />
        </div>
        <button className="btn" onClick={handleDownloadPdf} disabled={generating}>
          {generating ? "Gerando..." : selectedDay ? `Baixar PDF do Dia ${selectedDay.index}` : "Baixar PDF"}
        </button>
      </div>

      {selectedDay ? (
        // Um dia: a manhã e a noite separadas, cada uma com a sua lista.
        view.perPeriod.map((section) => (
          <div key={section.period.index} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="spread" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <strong>
                {section.period.label}{" "}
                <span className="muted" style={{ fontWeight: 400 }}>
                  · a partir das {section.period.startsAt}
                </span>
              </strong>
              <span className="badge badge-info">{section.people} presente(s)</span>
            </div>
            {section.rows.length === 0 ? (
              <p className="muted" style={{ padding: 16, margin: 0 }}>
                Nenhum credenciamento neste período.
              </p>
            ) : (
              <ReportTable rows={section.rows} periods={periods} showDay={false} showPeriod={false} timeOnly />
            )}
          </div>
        ))
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {view.rows.length === 0 ? (
            <p className="muted" style={{ padding: 20, margin: 0 }}>
              Nenhum check-in registrado ainda.
            </p>
          ) : (
            <ReportTable rows={view.rows} periods={periods} showDay={hasDays} showPeriod={hasDays} />
          )}
        </div>
      )}
      {selectedDay ? <p className="muted" style={{ margin: 0, fontSize: 12 }}>Relatório do {scopeLabel}.</p> : null}
    </div>
  );
}

function ReportTable({
  rows,
  periods,
  showDay,
  showPeriod,
  timeOnly = false,
}: {
  rows: api.ReportCheckIn[];
  periods: api.CheckInPeriod[];
  showDay: boolean;
  showPeriod: boolean;
  /** Só a hora (a lista já é de um dia). */
  timeOnly?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {showDay && <th>Dia</th>}
            {showPeriod && <th>Período</th>}
            <th>Participante</th>
            <th>E-mail</th>
            <th>CPF</th>
            <th>Terminal</th>
            <th>Origem</th>
            <th>{timeOnly ? "Hora" : "Data/Hora"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {showDay && (
                <td>
                  <span className="badge badge-info">Dia {row.dayIndex}</span>
                </td>
              )}
              {showPeriod && (
                <td>
                  <span className="badge badge-muted">{periodName(periods, row.period)}</span>
                </td>
              )}
              <td>{row.participantName}</td>
              <td className="muted">{row.participantEmail ?? "—"}</td>
              <td className="muted">{row.participantDocument ?? "—"}</td>
              <td className="muted">{row.terminalName ?? "—"}</td>
              <td>
                <span className={`badge ${row.source === "ONLINE" ? "badge-success" : "badge-muted"}`}>
                  {row.source === "ONLINE" ? "Online" : "Offline"}
                </span>
              </td>
              <td className="muted">{timeOnly ? timeOf(row.checkedInAt) : dateTimeOf(row.checkedInAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="tab" aria-selected={active} className={active ? "btn btn-sm" : "btn btn-secondary btn-sm"} onClick={onClick}>
      {children}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 110, textAlign: "center", padding: 14 }}>
      <p className="muted" style={{ margin: "0 0 6px", fontSize: 12 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: color ?? "var(--text)" }}>{value}</p>
    </div>
  );
}

function periodName(periods: api.CheckInPeriod[], index: number): string {
  return periods.find((p) => p.index === index)?.label ?? "";
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
