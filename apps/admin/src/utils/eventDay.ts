import type { CheckInDay, CheckInPeriod } from "../api/client";

/** "2026-11-06" → "06/11". Fatia o texto em vez de criar um Date, que
 * deslocaria o dia conforme o fuso do navegador. */
export function shortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

/** "Dia 2 de 3 · 06/11", com o período quando há ("Dia 2 de 3 · 06/11 · Noite"). */
export function dayLabel(day: Pick<CheckInDay, "index" | "total" | "date"> & { period?: CheckInPeriod }): string {
  const base = `Dia ${day.index} de ${day.total} · ${shortDate(day.date)}`;
  return day.period ? `${base} · ${day.period.label}` : base;
}

/** "nesta manhã" / "nesta noite" — para frases como "já registrado nesta noite". */
export function periodPhrase(period: Pick<CheckInPeriod, "label">): string {
  return `nesta ${period.label.toLowerCase()}`;
}
