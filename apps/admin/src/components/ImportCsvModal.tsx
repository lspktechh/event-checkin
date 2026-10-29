import { useState } from "react";
import type { ImportReport } from "../api/client";

interface Props {
  title: string;
  /** Texto de apoio abaixo do título (colunas esperadas, regras do arquivo). */
  hint?: React.ReactNode;
  /** Descrição do interruptor de cortesia, específica de cada aba. */
  courtesyHint: string;
  /** `confirm=false` só analisa (preview); `confirm=true` grava. */
  run: (csv: string, confirm: boolean, cortesia: boolean) => Promise<ImportReport>;
  onClose: () => void;
  onImported: () => void;
}

/**
 * Importação via CSV — seção 20 da especificação: validar, normalizar,
 * detectar duplicados, mostrar preview, só então confirmar. Nunca importa
 * "cegamente": o preview (confirm=false) roda primeiro, e só grava
 * quando o operador confirma explicitamente.
 *
 * Serve às abas Participantes e Inscrições; cada uma passa o seu `run`.
 */
export function ImportCsvModal({ title, hint, courtesyHint, run, onClose, onImported }: Props) {
  const [csv, setCsv] = useState("");
  const [cortesia, setCortesia] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  // Resultado de uma confirmação que gravou, mas deixou linhas para trás.
  const [outcome, setOutcome] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setError(null);
    setLoading(true);
    try {
      setReport(await run(csv, false, cortesia));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar CSV");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      const result = await run(csv, true, cortesia);
      // Se alguma linha caiu na gravação, o operador precisa ver quais —
      // fechar o modal agora esconderia isso.
      if (result.failed && result.failed.length > 0) {
        setOutcome(result);
      } else {
        onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao importar");
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file: File) {
    file.text().then((text) => {
      setCsv(text);
      setReport(null);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal
      style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <div className="card stack" style={{ width: 640, maxHeight: "85vh", overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {outcome ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>{outcome.imported}</strong> importado(s). <strong>{outcome.failed!.length}</strong> linha(s) não foram
              gravadas:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {outcome.failed!.map((f) => (
                <li key={f.row}>
                  Linha {f.row}: {f.reason}
                </li>
              ))}
            </ul>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" onClick={onImported}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            {hint ? (
              <p className="muted" style={{ margin: 0 }}>
                {hint}
              </p>
            ) : null}

            <label className="switch-row">
              <span className="switch-text">
                <strong>Importar como cortesia</strong>
                <small>{courtesyHint}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="switch"
                checked={cortesia}
                onChange={(e) => setCortesia(e.target.checked)}
                disabled={loading}
              />
            </label>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <textarea
              rows={6}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setReport(null);
              }}
              placeholder="nome,email,telefone,documento&#10;João,joao@email.com,43999999999,123456789"
            />

            {error ? <p className="error-text">{error}</p> : null}

            {report ? (
              <div className="stack">
                <div className="row">
                  <span className="badge badge-success">{report.validCount} válidos</span>
                  <span className="badge badge-danger">{report.invalidCount} inválidos</span>
                  <span className="badge badge-warning">{report.duplicateCount} duplicados</span>
                </div>
                <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Status</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.rows.map((row) => (
                        <tr key={row.row}>
                          <td>{row.row}</td>
                          <td>{row.name ?? "—"}</td>
                          <td className="muted">{row.email ?? "—"}</td>
                          <td>
                            <span
                              className={`badge ${
                                row.status === "valid"
                                  ? "badge-success"
                                  : row.status === "duplicate"
                                    ? "badge-warning"
                                    : "badge-danger"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="muted">{row.reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              {!report ? (
                <button className="btn" onClick={handlePreview} disabled={loading || !csv.trim()}>
                  {loading ? "Processando..." : "Pré-visualizar"}
                </button>
              ) : (
                <button className="btn" onClick={handleConfirm} disabled={loading || report.validCount === 0}>
                  {loading ? "Importando..." : `Confirmar importação (${report.validCount})`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
