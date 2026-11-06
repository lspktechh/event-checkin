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

/**
 * Períodos de credenciamento de cada dia (COPOL): Manhã a partir das 07:30 e
 * Noite a partir das 18:00. Cada um é um credenciamento independente — o mesmo
 * QR entra uma vez em cada.
 *
 * O período vem da hora LOCAL (fuso do evento) da leitura: vale o último que já
 * começou. Antes das 07:30 ainda é Manhã (ninguém é barrado por chegar cedo) e a
 * Noite vai até a meia-noite, quando o dia seguinte começa na Manhã.
 *
 * Os horários também estão na migração que classificou os check-ins antigos
 * (add_checkin_period); mudar aqui exige atualizar lá.
 */
export interface EventPeriodInfo {
  /** 1 = Manhã, 2 = Noite. (0 é "sem período", dos eventos comuns.) */
  index: number;
  label: string;
  /** Horário de início, "HH:MM", no fuso do evento. */
  startsAt: string;
}

export const CHECKIN_PERIODS: readonly EventPeriodInfo[] = [
  { index: 1, label: "Manhã", startsAt: "07:30" },
  { index: 2, label: "Noite", startsAt: "18:00" },
];

const minutesOfDay = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Período em que `instant` cai, pela hora local no fuso do evento. */
export function resolveEventPeriod(instant: Date, timeZone: string): EventPeriodInfo {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const now = hour * 60 + minute;
  // O último período que já começou; antes do primeiro, vale o primeiro.
  const started = CHECKIN_PERIODS.filter((p) => minutesOfDay(p.startsAt) <= now);
  return started.length > 0 ? started[started.length - 1] : CHECKIN_PERIODS[0];
}

/** O dia do evento da leitura, já com o período em que ela caiu. */
export interface EventDayWithPeriod extends EventDay {
  period: EventPeriodInfo;
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
