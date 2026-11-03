import { useCallback, useEffect, useState } from "react";
import * as api from "../api/client";

const REFRESH_MS = 60_000;

/**
 * Estatísticas do evento para a tela de credenciamento, atualizadas sozinhas
 * a cada minuto.
 *
 * O refresh periódico importa em evento por dia: a faixa "Dia 2 de 3" vira à
 * meia-noite, e uma tela deixada aberta entre um dia e outro (tablet na
 * recepção) continuaria mostrando o dia anterior até a primeira leitura. Ele
 * também traz as leituras feitas por outras câmeras.
 */
export function useCheckInStats(eventId: string | undefined) {
  const [stats, setStats] = useState<api.EventStatistics | null>(null);

  const refresh = useCallback(() => {
    if (!eventId) return Promise.resolve();
    // Falha aqui não pode atrapalhar o credenciamento: mantém o último valor.
    return api
      .getStatistics(eventId)
      .then(setStats)
      .catch(() => undefined);
  }, [eventId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { stats, refresh };
}
