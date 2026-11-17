import { describe, expect, it } from "vitest";

import { CHECKIN_PERIODS, resolveEventPeriod } from "../src/modules/checkins/event-day.js";

const BRASILIA = "America/Sao_Paulo";
// 06/11/2026 em Brasília (UTC-3) → UTC = hora + 3.
const em = (hhmmss: string, tz = BRASILIA, dia = "2026-11-06") => {
  const offset = tz === BRASILIA ? "-03:00" : "-04:00"; // Manaus
  return new Date(`${dia}T${hhmmss}${offset}`);
};

describe("períodos do dia: Manhã (a partir das 07:30) e Noite (a partir das 18:00)", () => {
  it("o dia tem dois períodos, com nome e horário de início", () => {
    expect(CHECKIN_PERIODS).toEqual([
      { index: 1, label: "Manhã", startsAt: "07:30" },
      { index: 2, label: "Noite", startsAt: "18:00" },
    ]);
  });

  it("07:30 é Manhã", () => {
    expect(resolveEventPeriod(em("07:30:00"), BRASILIA)).toEqual({ index: 1, label: "Manhã", startsAt: "07:30" });
  });

  it("antes das 07:30 ainda é Manhã: ninguém é barrado na porta por chegar cedo", () => {
    // Pega: tratar a leitura de 07:29 (ou da meia-noite) como "fora do
    // credenciamento" ou como Noite.
    expect(resolveEventPeriod(em("07:29:59"), BRASILIA)?.index).toBe(1);
    expect(resolveEventPeriod(em("00:00:00"), BRASILIA)?.index).toBe(1);
  });

  it("a borda das 18:00: 17:59:59 é Manhã, 18:00:00 é Noite", () => {
    // Pega: comparar com > em vez de >= (18:00 em ponto cairia na manhã) ou
    // errar por uma hora de fuso.
    expect(resolveEventPeriod(em("17:59:59"), BRASILIA)?.index).toBe(1);
    expect(resolveEventPeriod(em("18:00:00"), BRASILIA)).toEqual({ index: 2, label: "Noite", startsAt: "18:00" });
  });

  it("a Noite vai até a meia-noite: 23:59:59 ainda é Noite", () => {
    expect(resolveEventPeriod(em("23:59:59"), BRASILIA)?.index).toBe(2);
  });

  it("usa o horário do FUSO do evento, não o de UTC", () => {
    // 20:30Z de 06/11 = 17:30 em Brasília (Manhã), mas em UTC já passou das
    // 18:00. Pega: ler a hora em UTC.
    expect(resolveEventPeriod(new Date("2026-11-06T20:30:00Z"), BRASILIA)?.index).toBe(1);
    // 21:30Z = 18:30 em Brasília (Noite).
    expect(resolveEventPeriod(new Date("2026-11-06T21:30:00Z"), BRASILIA)?.index).toBe(2);
  });

  it("respeita o fuso configurado no evento (Manaus é UTC-4)", () => {
    // 21:30Z = 17:30 em Manaus (Manhã) e 18:30 em Brasília (Noite).
    const instante = new Date("2026-11-06T21:30:00Z");
    expect(resolveEventPeriod(instante, "America/Manaus")?.index).toBe(1);
    expect(resolveEventPeriod(instante, BRASILIA)?.index).toBe(2);
  });
});
