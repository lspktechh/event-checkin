import type { CheckInDay } from "../api/client";

/** "2026-11-06" → "06/11". Fatia o texto em vez de criar um Date, que
 * deslocaria o dia conforme o fuso do navegador. */
export function shortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

/** "Dia 2 de 3 · 06/11" */
export function dayLabel(day: Pick<CheckInDay, "index" | "total" | "date">): string {
  return `Dia ${day.index} de ${day.total} · ${shortDate(day.date)}`;
}
