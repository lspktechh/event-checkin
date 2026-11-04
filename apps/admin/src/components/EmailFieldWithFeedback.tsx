import React, { useState } from "react";
import { getQuickEmailSuggestion } from "../utils/emailValidator.js";
import * as api from "../api/client.js";

interface EmailFieldWithFeedbackProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function EmailFieldWithFeedback({
  label = "E-mail",
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "exemplo@dominio.com",
  className = "",
  id,
}: EmailFieldWithFeedbackProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleBlur() {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(null);
      setSuggestion(null);
      return;
    }

    // 1. Checagem imediata de erros comuns
    const quickSuggestion = getQuickEmailSuggestion(trimmed);
    if (quickSuggestion) {
      setSuggestion(quickSuggestion);
      setError(`Você quis dizer ${quickSuggestion}?`);
      return;
    }

    // 2. Validação profunda no backend (DNS, MX, Descartável)
    setLoading(true);
    try {
      const res = await api.verifyEmail(trimmed, true);
      if (!res.valid) {
        setSuggestion(res.suggestion || null);
        setError(res.reason || "E-mail inválido ou inexistente.");
      } else {
        setSuggestion(null);
        setError(null);
      }
    } catch {
      // Falha de rede: não impede o usuário de prosseguir
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptSuggestion() {
    if (suggestion) {
      onChange(suggestion);
      setSuggestion(null);
      setError(null);
    }
  }

  return (
    <div className={`email-feedback-wrapper ${className}`} style={{ marginBottom: "0.75rem" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 500,
            marginBottom: "0.25rem",
          }}
        >
          {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="email"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            if (error || suggestion) {
              setError(null);
              setSuggestion(null);
            }
          }}
          onBlur={handleBlur}
          style={{
            width: "100%",
            borderColor: error ? "#ef4444" : undefined,
          }}
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.75rem",
              color: "#9ca3af",
            }}
          >
            Verificando...
          </span>
        )}
      </div>

      {suggestion && (
        <div
          style={{
            marginTop: "0.35rem",
            padding: "0.4rem 0.6rem",
            backgroundColor: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: "0.375rem",
            fontSize: "0.8rem",
            color: "#92400e",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            Você quis dizer <strong>{suggestion}</strong>?
          </span>
          <button
            type="button"
            onClick={handleAcceptSuggestion}
            style={{
              marginLeft: "0.5rem",
              padding: "0.2rem 0.5rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
            }}
          >
            Corrigir
          </button>
        </div>
      )}

      {error && !suggestion && (
        <p
          style={{
            marginTop: "0.25rem",
            fontSize: "0.8rem",
            color: "#ef4444",
            lineHeight: 1.3,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
