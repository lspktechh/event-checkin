import type { CSSProperties, ReactNode } from "react";
import { AlertIcon, CheckIcon, XIcon } from "../Icons";
import type { CheckInFeedbackStatus } from "../../utils/audioFeedback";
import type { CheckInDay } from "../../api/client";
import { dayLabel } from "../../utils/eventDay";

export interface FeedbackData {
  status: CheckInFeedbackStatus;
  participantName?: string | null;
  checkedInAt?: string | null;
  message?: string | null;
  /** Dia do evento (só em evento com credenciamento por dia). */
  day?: CheckInDay | null;
  /** Troca o título padrão do status (ex.: "FORA DO PERÍODO"). */
  title?: string;
}

interface Props {
  data: FeedbackData;
  onDismiss?: () => void;
}

const PRESETS: Record<
  CheckInFeedbackStatus,
  { symbol: ReactNode; title: string; background: string }
> = {
  CONFIRMED: {
    symbol: <CheckIcon size={64} strokeWidth={3} />,
    title: "PRESENÇA CONFIRMADA",
    background: "#16a34a", // Verde vibrante
  },
  ALREADY_CHECKED_IN: {
    symbol: <AlertIcon size={60} strokeWidth={2.5} />,
    title: "PRESENÇA JÁ REGISTRADA",
    background: "#d97706", // Laranja/Âmbar atenção
  },
  INVALID_TOKEN: {
    symbol: <XIcon size={60} strokeWidth={3} />,
    title: "CREDENCIAL INVÁLIDA",
    background: "#dc2626", // Vermelho erro
  },
  PARTICIPANT_INACTIVE: {
    symbol: <XIcon size={60} strokeWidth={3} />,
    title: "CREDENCIAL INATIVA",
    background: "#dc2626", // Vermelho erro
  },
  ERROR: {
    symbol: <XIcon size={60} strokeWidth={3} />,
    title: "ERRO NA LEITURA",
    background: "#dc2626",
  },
};

function formatTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

export function FeedbackOverlay({ data, onDismiss }: Props) {
  const preset = PRESETS[data.status] ?? PRESETS.ERROR;

  return (
    <div
      onClick={onDismiss}
      style={
        {
          position: "absolute",
          inset: 0,
          backgroundColor: preset.background,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px 20px",
          color: "#ffffff",
          animation: "fadeIn 0.18s ease-out",
          cursor: "pointer",
          userSelect: "none",
        } as CSSProperties
      }
    >
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 76,
          fontWeight: 800,
          marginBottom: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        {preset.symbol}
      </div>

      <h2
        style={{
          fontSize: "clamp(22px, 5vw, 32px)",
          fontWeight: 800,
          letterSpacing: "1px",
          margin: "0 0 10px",
          textTransform: "uppercase",
          textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        {data.title ?? preset.title}
      </h2>

      {data.day ? (
        <p
          style={{
            margin: "0 0 12px",
            padding: "4px 14px",
            borderRadius: 999,
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            fontSize: "clamp(15px, 3.5vw, 19px)",
            fontWeight: 800,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          {dayLabel(data.day)}
        </p>
      ) : null}

      {data.participantName ? (
        <p
          style={{
            fontSize: "clamp(20px, 4.5vw, 28px)",
            fontWeight: 700,
            margin: "0 0 10px",
            maxWidth: "90%",
            wordBreak: "break-word",
          }}
        >
          {data.participantName}
        </p>
      ) : null}

      {data.status === "ALREADY_CHECKED_IN" && data.checkedInAt ? (
        <p
          style={{
            fontSize: "clamp(16px, 3.5vw, 20px)",
            color: "rgba(255, 255, 255, 0.9)",
            margin: "4px 0 0",
          }}
        >
          Já registrado {data.day ? "neste dia " : ""}às <strong>{formatTime(data.checkedInAt)}</strong>
        </p>
      ) : null}

      {data.status === "CONFIRMED" && data.checkedInAt ? (
        <p
          style={{
            fontSize: "clamp(16px, 3.5vw, 20px)",
            color: "rgba(255, 255, 255, 0.9)",
            margin: "4px 0 0",
          }}
        >
          Registrado às <strong>{formatTime(data.checkedInAt)}</strong>
        </p>
      ) : null}

      {data.message ? (
        <p
          style={{
            fontSize: "15px",
            color: "rgba(255, 255, 255, 0.85)",
            marginTop: 8,
            maxWidth: "85%",
          }}
        >
          {data.message}
        </p>
      ) : null}

      <span
        style={{
          marginTop: 24,
          fontSize: "12px",
          opacity: 0.75,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Toque para avançar
      </span>
    </div>
  );
}
