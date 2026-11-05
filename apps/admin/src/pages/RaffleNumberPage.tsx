import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import * as api from "../api/client";

/**
 * Página pública aberta pelo QR Code da aba "Sorteios".
 *
 * Ao abrir, gera (ou recupera) o número deste celular e mostra na tela.
 * Não pede nome nem nada: a presença já foi confirmada no credenciamento.
 * O texto não menciona sorteio, a pedido da organização.
 */

const DEVICE_KEY_STORAGE = "raffle_device_key";

/** crypto.getRandomValues funciona mesmo fora de HTTPS (ao contrário de randomUUID). */
function getDeviceKey(): string {
  try {
    const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return stored;
  } catch {
    // navegador sem storage: segue com uma chave só desta visita
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(DEVICE_KEY_STORAGE, key);
  } catch {
    // ignora
  }
  return key;
}

function cacheKey(eventId: string) {
  return `raffle_number_${eventId}`;
}

export function RaffleNumberPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [number, setNumber] = useState<number | null>(() => {
    if (!eventId) return null;
    try {
      const cached = localStorage.getItem(cacheKey(eventId));
      return cached ? Number(cached) : null;
    } catch {
      return null;
    }
  });
  const [eventName, setEventName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .claimRaffleNumber(eventId, getDeviceKey())
      .then((res) => {
        if (cancelled) return;
        setNumber(res.number);
        setEventName(res.eventName);
        try {
          localStorage.setItem(cacheKey(eventId), String(res.number));
        } catch {
          // ignora
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof api.ApiError && err.httpStatus === 404
            ? "Este QR Code não é mais válido."
            : "Não foi possível gerar seu número. Verifique a internet e tente de novo."
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [eventId, attempt]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "32px max(20px, env(safe-area-inset-left)) 32px max(20px, env(safe-area-inset-right))",
        textAlign: "center",
      }}
    >
      {eventName ? (
        <span className="muted" style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {eventName}
        </span>
      ) : null}

      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Seu número</h1>

      <div
        aria-live="polite"
        style={{
          fontSize: "clamp(72px, 28vw, 140px)",
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "0.04em",
          fontVariantNumeric: "tabular-nums",
          color: number !== null ? "var(--text)" : "var(--text-muted)",
          minHeight: "1em",
        }}
      >
        {number !== null ? number : loading ? "····" : "—"}
      </div>

      {error && number === null ? (
        <div className="stack" style={{ alignItems: "center" }}>
          <p className="error-text" style={{ margin: 0 }}>{error}</p>
          <button className="btn" type="button" onClick={() => setAttempt((n) => n + 1)}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, maxWidth: 320 }}>
          Guarde este número. Você pode tirar um print desta tela.
        </p>
      )}
    </main>
  );
}
