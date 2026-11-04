import { useState, useCallback } from "react";
import * as api from "../api/client.js";

const COMMON_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cpm": "gmail.com",
  "gmail.com.br": "gmail.com",
  "gmai.com.br": "gmail.com",
  "gmil.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.co": "outlook.com",
  "yaoo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "bol.com": "bol.com.br",
  "uol.com": "uol.com.br",
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
};

export function getQuickEmailSuggestion(email: string): string | null {
  if (!email || !email.includes("@")) return null;
  const parts = email.trim().split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  const d = domain.toLowerCase();

  if (COMMON_TYPOS[d]) {
    return `${local}@${COMMON_TYPOS[d]}`;
  }

  if (d.endsWith(".con")) {
    return `${local}@${d.replace(/\.con$/, ".com")}`;
  }

  return null;
}

export function useEmailVerifier(initialValue = "") {
  const [email, setEmail] = useState(initialValue);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);

  const checkEmail = useCallback(async (value: string, checkMx = true) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setSuggestion(null);
      setError(null);
      setIsValid(null);
      return true;
    }

    // Sugestão instantânea de digitação
    const quickSuggestion = getQuickEmailSuggestion(trimmed);
    if (quickSuggestion) {
      setSuggestion(quickSuggestion);
      setError(`Você quis dizer ${quickSuggestion}?`);
      setIsValid(false);
      return false;
    }

    setIsValidating(true);
    try {
      const res = await api.verifyEmail(trimmed, checkMx);
      if (!res.valid) {
        setSuggestion(res.suggestion || null);
        setError(res.reason || "E-mail inválido ou inexistente.");
        setIsValid(false);
        return false;
      } else {
        setSuggestion(null);
        setError(null);
        setIsValid(true);
        return true;
      }
    } catch {
      // Se a rota falhar por problema de rede transitório, não bloqueia a interface
      setSuggestion(null);
      setError(null);
      setIsValid(null);
      return true;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (suggestion) {
      setEmail(suggestion);
      setSuggestion(null);
      setError(null);
      setIsValid(true);
    }
  }, [suggestion]);

  return {
    email,
    setEmail,
    suggestion,
    error,
    isValidating,
    isValid,
    checkEmail,
    acceptSuggestion,
    clearError: () => {
      setError(null);
      setSuggestion(null);
    },
  };
}
