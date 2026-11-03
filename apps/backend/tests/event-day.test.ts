import { describe, expect, it } from "vitest";

import { eventDays, eventTotalDays, resolveEventDay } from "../src/modules/checkins/event-day.js";

// COPOL 2026: 05/11 07:30 até 07/11 22:00, horário de Brasília (UTC-3).
const copol = {
  startDate: new Date("2026-11-05T10:30:00Z"),
  endDate: new Date("2026-11-08T01:00:00Z"),
  timezone: "America/Sao_Paulo",
};

describe("total de dias do evento", () => {
  it("conta dias do calendário no fuso do evento, não horas", () => {
    // Pega: contar por diferença de horas (05/11 07:30 → 07/11 22:00 são
    // ~63h, o que daria 2 dias, e não 3).
    expect(eventTotalDays(copol)).toBe(3);
  });

  it("evento de um dia só tem 1 dia", () => {
    expect(
      eventTotalDays({ ...copol, startDate: new Date("2026-11-05T11:00:00Z"), endDate: new Date("2026-11-05T21:00:00Z") })
    ).toBe(1);
  });

  it("atravessa a virada do mês sem errar", () => {
    // Pega: subtrair o "dia do mês" (31 → 2 daria -29).
    expect(
      eventTotalDays({ ...copol, startDate: new Date("2026-10-31T11:00:00Z"), endDate: new Date("2026-11-02T21:00:00Z") })
    ).toBe(3);
  });

  it("usa o fuso do evento: 23h em Brasília já é o dia seguinte em UTC", () => {
    // Termina às 23:30 de 07/11 em Brasília = 08/11 02:30 UTC. Em UTC
    // pareceriam 4 dias.
    expect(eventTotalDays({ ...copol, endDate: new Date("2026-11-08T02:30:00Z") })).toBe(3);
  });
});

describe("lista de dias do evento", () => {
  it("um item por dia, com a data local de cada um", () => {
    expect(eventDays(copol)).toEqual([
      { index: 1, date: "2026-11-05" },
      { index: 2, date: "2026-11-06" },
      { index: 3, date: "2026-11-07" },
    ]);
  });

  it("atravessa a virada do mês", () => {
    // Pega: somar dias ao "dia do mês" (31 + 1 = 32).
    const virada = { ...copol, startDate: new Date("2026-10-31T11:00:00Z"), endDate: new Date("2026-11-02T21:00:00Z") };
    expect(eventDays(virada).map((d) => d.date)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("dia do evento de uma leitura", () => {
  const dia = (iso: string, period = copol) => resolveEventDay(period, new Date(iso));

  it("primeiro instante do evento é o dia 1", () => {
    expect(dia("2026-11-05T10:30:00Z")).toEqual({ index: 1, total: 3, date: "2026-11-05" });
  });

  it("22:30 de 05/11 em Brasília ainda é o dia 1, mesmo sendo 06/11 em UTC", () => {
    // Pega: calcular o dia em UTC — quem entra à noite no dia 1 seria
    // contado no dia 2 e o dia 2 da manhã daria "já credenciado".
    expect(dia("2026-11-06T01:30:00Z")).toEqual({ index: 1, total: 3, date: "2026-11-05" });
  });

  it("a virada acontece à meia-noite de Brasília: 23:59:59 é dia 1, 00:00:00 é dia 2", () => {
    expect(dia("2026-11-06T02:59:59.999Z")?.index).toBe(1);
    expect(dia("2026-11-06T03:00:00.000Z")).toEqual({ index: 2, total: 3, date: "2026-11-06" });
  });

  it("dia 3, inclusive depois do horário de término (o dia é de calendário)", () => {
    expect(dia("2026-11-07T15:00:00Z")?.index).toBe(3);
    // 23:59:59 de 07/11 em Brasília: depois das 22:00 de término, mas ainda dia 3.
    expect(dia("2026-11-08T02:59:59Z")).toEqual({ index: 3, total: 3, date: "2026-11-07" });
  });

  it("fora do período devolve null: um segundo antes do dia 1 e à meia-noite depois do dia 3", () => {
    expect(dia("2026-11-05T02:59:59Z")).toBeNull(); // 23:59:59 de 04/11
    expect(dia("2026-11-08T03:00:00Z")).toBeNull(); // 00:00 de 08/11
    expect(dia("2026-10-01T12:00:00Z")).toBeNull();
  });

  it("respeita o fuso configurado no evento", () => {
    // Manaus é UTC-4. 03:30 UTC de 06/11 = 23:30 de 05/11 lá → dia 1.
    const manaus = { ...copol, timezone: "America/Manaus", startDate: new Date("2026-11-05T11:30:00Z"), endDate: new Date("2026-11-08T02:00:00Z") };
    expect(dia("2026-11-06T03:30:00Z", manaus)).toEqual({ index: 1, total: 3, date: "2026-11-05" });
    expect(dia("2026-11-06T04:00:00Z", manaus)?.index).toBe(2);
  });
});
