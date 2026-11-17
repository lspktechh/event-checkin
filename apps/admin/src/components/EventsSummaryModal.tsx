import { useMemo, useState } from "react";
import * as api from "../api/client";

interface Props {
  events: api.EventRecord[];
  onClose: () => void;
}

/** COPOL e Pré-COPOL (nome ou endereço com "copol"): ficam desmarcados de
 * início, porque costumam ser relatados à parte. A pessoa pode marcar. */
function isCopol(event: api.EventRecord): boolean {
  return /copol/i.test(`${event.name} ${event.slug ?? ""}`);
}

/**
 * Escolhe os eventos e baixa o relatório geral em Markdown (.md): inscrições,
 * participantes, presentes, certificados, trabalhos e receita, no total e por
 * evento. Os números vêm do servidor, direto do banco.
 */
export function EventsSummaryModal({ events, onClose }: Props) {
  const ordered = useMemo(
    () => [...events].sort((a, b) => b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name)),
    [events],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ordered.filter((e) => !isCopol(e)).map((e) => e.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    setError(null);
    setBusy(true);
    try {
      const report = await api.getEventsSummary([...selected]);
      const blob = new Blob([report.markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-geral-eventos-${report.generatedAt.slice(0, 10)}.md`;
      link.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o relatório");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Relatório geral de eventos"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000aa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div className="card stack" style={{ width: "min(560px, 100%)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Relatório geral de eventos</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Escolha os eventos. O arquivo (.md) traz inscrições, participantes, presentes, certificados, trabalhos e
            receita, no total e por evento.
          </p>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set(ordered.map((e) => e.id)))}>
            Marcar todos
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
            Desmarcar todos
          </button>
        </div>

        <div style={{ overflowY: "auto", maxHeight: "50vh", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {ordered.map((event) => (
            <label
              key={event.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" checked={selected.has(event.id)} onChange={() => toggle(event.id)} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, wordBreak: "break-word" }}>{event.name}</span>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>
                  {new Date(event.startDate).toLocaleDateString("pt-BR")}
                  {isCopol(event) ? " · COPOL (desmarcado por padrão)" : ""}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={handleDownload} disabled={busy || selected.size === 0}>
            {busy ? "Gerando..." : `Baixar relatório (.md) — ${selected.size} evento(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
