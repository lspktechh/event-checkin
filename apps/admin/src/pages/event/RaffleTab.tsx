import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { copyTextToClipboard } from "../../utils/clipboard";

interface Props {
  eventId: string | undefined;
}

const POLL_MS = 3000;

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function randomFrom<T>(list: T[]): T {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return list[a[0] % list.length];
}

/**
 * Aba "Sorteios": mostra um QR Code na tela; quem escaneia recebe um número
 * aleatório de 4 dígitos (salvo no banco da VPS) e o organizador sorteia um
 * desses números aqui. O número sorteado é escolhido no servidor; a
 * animação só embaralha números na tela antes de mostrar o resultado.
 */
export function RaffleTab({ eventId }: Props) {
  const { hasPermission } = useAuth();
  const canDraw = hasPermission("participants.edit");

  const [state, setState] = useState<api.RaffleState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [excludeWinners, setExcludeWinners] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [display, setDisplay] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projector, setProjector] = useState(false);
  const [copied, setCopied] = useState(false);
  const spinningRef = useRef(false);

  const joinUrl = useMemo(() => (eventId ? `${window.location.origin}/numero/${eventId}` : ""), [eventId]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const next = await api.getRaffle(eventId);
      setState(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar os números.");
    }
  }, [eventId]);

  useEffect(() => {
    load();
    const id = window.setInterval(() => {
      if (!document.hidden && !spinningRef.current) load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const entries = useMemo(() => state?.entries ?? [], [state]);
  const draws = useMemo(() => state?.draws ?? [], [state]);
  const lastDraw = draws[0] ?? null;
  const winnerIds = useMemo(() => new Set(draws.map((d) => d.entryId)), [draws]);
  const pool = excludeWinners ? entries.filter((e) => !winnerIds.has(e.id)) : entries;
  const shown = spinning ? display : (lastDraw?.number ?? null);

  async function handleDraw() {
    if (!eventId || spinning || pool.length === 0) return;
    setActionError(null);
    setSpinning(true);
    spinningRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const numbers = pool.map((e) => e.number);
    let result: api.RaffleDrawRecord | null = null;
    try {
      const request = api.drawRaffle(eventId, excludeWinners);
      if (!reduce && numbers.length > 1) {
        let delay = 45;
        while (delay < 300) {
          setDisplay(randomFrom(numbers));
          await new Promise((r) => setTimeout(r, delay));
          delay *= 1.14;
        }
      }
      result = await request;
      setDisplay(result.number);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível sortear.");
    } finally {
      spinningRef.current = false;
      setSpinning(false);
      await load();
    }
  }

  async function handleUndo(drawId: string) {
    if (!eventId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.undoRaffleDraw(eventId, drawId);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível desfazer.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!eventId) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.resetRaffle(eventId);
      setConfirmReset(false);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível zerar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (await copyTextToClipboard(joinUrl)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  if (!eventId) return null;

  const bigNumberStyle: React.CSSProperties = {
    fontSize: "clamp(64px, 12vw, 128px)",
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: "0.04em",
    fontVariantNumeric: "tabular-nums",
    opacity: spinning ? 0.75 : 1,
  };

  // Modo telão: só o QR e o último número, em tela cheia, para projetar.
  if (projector) {
    return (
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "var(--bg)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "6vw",
          padding: 24,
        }}
      >
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <div style={{ background: "#fff", padding: 20, borderRadius: 16, lineHeight: 0 }}>
            <QRCodeSVG value={joinUrl} size={Math.min(window.innerHeight * 0.6, 520)} />
          </div>
          <strong style={{ fontSize: 28 }}>Escaneie para receber seu número</strong>
        </div>
        {shown !== null ? (
          <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="muted" style={{ fontSize: 20 }}>{spinning ? "Sorteando…" : "Número sorteado"}</span>
            <div style={{ ...bigNumberStyle, fontSize: "clamp(96px, 16vw, 220px)" }}>{shown}</div>
          </div>
        ) : null}
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
          {canDraw ? (
            <button className="btn" type="button" onClick={handleDraw} disabled={spinning || pool.length === 0}>
              Sortear
            </button>
          ) : null}
          <button className="btn btn-secondary" type="button" onClick={() => setProjector(false)}>
            Sair do telão
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* QR Code */}
        <div className="card stack" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="muted" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Aponte a câmera do celular
          </span>
          <div style={{ background: "#fff", padding: 14, borderRadius: 12, lineHeight: 0 }}>
            <QRCodeSVG value={joinUrl} size={240} />
          </div>
          <strong>Escaneie para receber seu número</strong>
          <div className="row" style={{ width: "100%", gap: 8, flexWrap: "nowrap" }}>
            <code
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12,
                background: "var(--surface-alt)",
                padding: "8px 10px",
                borderRadius: 8,
                textAlign: "left",
                userSelect: "all",
              }}
            >
              {joinUrl}
            </code>
            <button className="btn btn-secondary btn-sm" type="button" onClick={handleCopy}>
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => setProjector(true)}>
            Abrir modo telão
          </button>
        </div>

        {/* Sorteio */}
        <div className="card stack" style={{ gap: 16 }}>
          <span className="muted" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {spinning ? "Sorteando…" : lastDraw ? `Último sorteado · ${fmtTime(lastDraw.drawnAt)}` : "Nenhum sorteio ainda"}
          </span>
          <div aria-live="polite" style={bigNumberStyle}>
            {shown ?? "—"}
          </div>
          {canDraw ? (
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="btn"
                type="button"
                onClick={handleDraw}
                disabled={spinning || pool.length === 0}
                style={{ fontSize: 17, padding: "12px 28px" }}
              >
                Sortear número
              </button>
              <label className="row" style={{ gap: 6, fontSize: 14 }}>
                <input
                  id="raffle-exclude-winners"
                  type="checkbox"
                  checked={excludeWinners}
                  onChange={(e) => setExcludeWinners(e.target.checked)}
                />
                Não repetir números já sorteados
              </label>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Seu perfil pode acompanhar, mas não sortear.</p>
          )}
          {pool.length === 0 && entries.length > 0 && canDraw ? (
            <p className="muted" style={{ margin: 0 }}>Todos os números já foram sorteados.</p>
          ) : null}
          {actionError ? <p className="error-text" style={{ margin: 0 }}>{actionError}</p> : null}

          {draws.length > 0 ? (
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 14 }}>Histórico</strong>
              {draws.map((d) => (
                <div key={d.id} className="spread" style={{ gap: 8, fontSize: 14 }}>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span className="muted">{fmtTime(d.drawnAt)}</span>{" "}
                    <strong style={{ fontSize: 17, marginLeft: 6 }}>{d.number}</strong>
                  </span>
                  {canDraw ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={busy || spinning}
                      onClick={() => handleUndo(d.id)}
                    >
                      Desfazer
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Números gerados */}
      <div className="card stack">
        <div className="spread" style={{ flexWrap: "wrap", gap: 8 }}>
          <div>
            <strong style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}>{entries.length}</strong>{" "}
            <span className="muted">{entries.length === 1 ? "número gerado" : "números gerados"}</span>
          </div>
          {canDraw ? (
            confirmReset ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14 }}>Apagar todos os números e sorteios?</span>
                <button className="btn btn-danger btn-sm" type="button" disabled={busy} onClick={handleReset}>
                  Apagar tudo
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setConfirmReset(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={entries.length === 0 && draws.length === 0}
                onClick={() => setConfirmReset(true)}
              >
                Zerar números
              </button>
            )
          ) : null}
        </div>
        {loadError ? <p className="error-text" style={{ margin: 0 }}>{loadError}</p> : null}
        {!state && !loadError ? <p className="muted" style={{ margin: 0 }}>Carregando…</p> : null}
        {state && entries.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nenhum número ainda. Cada pessoa que escanear o QR Code recebe um número, que aparece aqui na hora.
          </p>
        ) : null}
        {entries.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {entries.map((e) => (
              <span
                key={e.id}
                className={winnerIds.has(e.id) ? "badge badge-success" : "badge badge-muted"}
                style={{ fontVariantNumeric: "tabular-nums", fontSize: 14, padding: "4px 10px" }}
                title={`Gerado às ${fmtTime(e.createdAt)}`}
              >
                {e.number}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
