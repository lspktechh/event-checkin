import { ConflictError } from "../../shared/errors.js";

/**
 * Dia de um evento de vários dias (credenciamento por dia do COPOL).
 *
 * O dia é de CALENDÁRIO no fuso do evento (Event.timezone), e vira à
 * meia-noite desse fuso — não à meia-noite de UTC. Em UTC, quem entra às
 * 22h30 do dia 1 em Brasília já seria contado no dia 2, e o credenciamento
 * da manhã seguinte cairia como "já credenciado".
 *
 * A conta usa as datas locais ("2026-11-05") e não diferença de horas: o
 * COPOL vai de 05/11 07:30 a 07/11 22:00, só ~63h, e mesmo assim são 3 dias.
 */

export interface EventPeriod {
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface EventDay {
  /** 1 = primeiro dia do evento. */
  index: number;
  total: number;
  /** Data local do dia, "YYYY-MM-DD". */
  date: string;
}

/** Data local ("YYYY-MM-DD") de um instante, no fuso informado. */
export function localDate(instant: Date, timeZone: string): string {
  // "en-CA" já formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Número de dias desde 1970 de uma data "YYYY-MM-DD". Só para subtrair
 * datas — por isso não sofre com virada de mês nem com horário de verão. */
function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function eventTotalDays(period: EventPeriod): number {
  return dayNumber(localDate(period.endDate, period.timezone)) - dayNumber(localDate(period.startDate, period.timezone)) + 1;
}

/** Dia do evento em que `instant` cai, ou `null` se estiver antes do
 * primeiro dia ou depois do último. */
export function resolveEventDay(period: EventPeriod, instant: Date): EventDay | null {
  const date = localDate(instant, period.timezone);
  const index = dayNumber(date) - dayNumber(localDate(period.startDate, period.timezone)) + 1;
  const total = eventTotalDays(period);
  if (index < 1 || index > total) return null;
  return { index, total, date };
}

/** Cada dia do evento com a sua data local ("YYYY-MM-DD"). */
export function eventDays(period: EventPeriod): { index: number; date: string }[] {
  const first = dayNumber(localDate(period.startDate, period.timezone));
  return Array.from({ length: Math.max(eventTotalDays(period), 0) }, (_, i) => ({
    index: i + 1,
    date: new Date((first + i) * 86_400_000).toISOString().slice(0, 10),
  }));
}

/** "05/11 a 07/11" — para dizer ao operador qual é o período do evento. */
export function eventPeriodLabel(period: EventPeriod): string {
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return `${dm(localDate(period.startDate, period.timezone))} a ${dm(localDate(period.endDate, period.timezone))}`;
}

/** Leitura fora dos dias do evento (antes do primeiro ou depois do último).
 * Em evento por dia não existe dia 0 nem dia 4: recusa, em vez de gravar a
 * presença num dia que não é o dela. */
export class OutsideEventPeriodError extends ConflictError {
  constructor(period: EventPeriod) {
    super("FORA_DO_PERIODO", `Fora do período do evento (${eventPeriodLabel(period)}). O credenciamento só funciona nesses dias.`);
    this.name = "OutsideEventPeriodError";
  }
}
