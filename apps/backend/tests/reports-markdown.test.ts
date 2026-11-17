import { describe, expect, it } from "vitest";

import { buildEventsSummaryMarkdown, totalsOf, type EventSummaryRow } from "../src/modules/reports/reports.markdown.js";

function row(over: Partial<EventSummaryRow> = {}): EventSummaryRow {
  return {
    eventId: "e-1",
    name: "Workshop A",
    startDate: "2026-11-03T12:00:00.000Z",
    endDate: "2026-11-05T21:00:00.000Z",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
    inscriptions: { total: 10, confirmed: 6, pending: 3, cancelled: 1, courtesy: 2, revenue: 1234.5 },
    participants: 8,
    present: 4,
    certificates: { generated: 3, eligible: 1, revoked: 0 },
    submissions: 5,
    ...over,
  };
}

// 17/11/2026 08:58 em Brasília (UTC-3).
const GERADO_EM = new Date("2026-11-17T11:58:00Z");

describe("totais do relatório geral", () => {
  it("somam os eventos selecionados, sem contar nada duas vezes", () => {
    // Pega: o resumo divergir da tabela por evento.
    const totals = totalsOf([
      row(),
      row({
        eventId: "e-2",
        name: "Workshop B",
        inscriptions: { total: 4, confirmed: 2, pending: 1, cancelled: 1, courtesy: 0, revenue: 100 },
        participants: 2,
        present: 1,
        certificates: { generated: 0, eligible: 2, revoked: 1 },
        submissions: 0,
      }),
    ]);

    expect(totals).toEqual({
      events: 2,
      inscriptions: { total: 14, confirmed: 8, pending: 4, cancelled: 2, courtesy: 2, revenue: 1334.5 },
      participants: 10,
      present: 5,
      certificates: { generated: 3, eligible: 3, revoked: 1 },
      submissions: 5,
    });
  });

  it("sem eventos, tudo zero", () => {
    expect(totalsOf([]).events).toBe(0);
    expect(totalsOf([]).inscriptions.revenue).toBe(0);
  });
});

describe("Markdown do relatório geral", () => {
  it("cabeçalho com a data de geração no horário de Brasília e o escopo", () => {
    // Pega: data em UTC (17/11 11:58) em vez de Brasília (08:58).
    const md = buildEventsSummaryMarkdown([row()], GERADO_EM);

    expect(md).toContain("# Relatório geral de eventos");
    expect(md).toContain("Gerado em: 17/11/2026 08:58 (Brasília)");
    expect(md).toContain("1 evento(s) selecionado(s)");
  });

  it("resumo geral com os números somados, receita e taxa no padrão brasileiro", () => {
    // Pega: receita "1,234.50" (formato americano) e taxa "50.0%" (ponto).
    const md = buildEventsSummaryMarkdown([row()], GERADO_EM);

    expect(md).toContain("## Resumo geral");
    expect(md).toContain("| Eventos | 1 |");
    expect(md).toContain("| Inscrições (todas) | 10 |");
    expect(md).toContain("| Inscrições confirmadas | 6 |");
    expect(md).toContain("| Inscrições pendentes | 3 |");
    expect(md).toContain("| Inscrições canceladas | 1 |");
    expect(md).toContain("| Cortesias confirmadas | 2 |");
    expect(md).toContain("| Participantes ativos | 8 |");
    expect(md).toContain("| Presentes (pessoas com check-in) | 4 |");
    expect(md).toContain("| Taxa de presença | 50,0% |");
    expect(md).toContain("| Certificados emitidos | 3 |");
    expect(md).toContain("| Certificados aptos (ainda não gerados) | 1 |");
    expect(md).toContain("| Certificados revogados | 0 |");
    expect(md).toContain("| Trabalhos submetidos | 5 |");
    expect(md).toContain("| Receita confirmada (R$) | 1.234,50 |");
  });

  it("tabela por evento: período em Brasília, situação em português e presença", () => {
    const md = buildEventsSummaryMarkdown([row()], GERADO_EM);

    expect(md).toContain("## Por evento");
    expect(md).toContain("| Workshop A | 03/11/2026 a 05/11/2026 | Ativo | 10 | 6 | 3 | 1 | 8 | 4 | 50,0% | 3 | 5 |");
  });

  it("evento encerrado aparece como Encerrado", () => {
    expect(buildEventsSummaryMarkdown([row({ status: "CLOSED" })], GERADO_EM)).toContain("| Encerrado |");
  });

  it("sem participantes a presença é '—', nunca 'NaN' ou 'Infinity'", () => {
    // Pega: divisão por zero.
    const md = buildEventsSummaryMarkdown([row({ participants: 0, present: 0 })], GERADO_EM);

    expect(md).not.toMatch(/NaN|Infinity/);
    expect(md).toContain("| Taxa de presença | — |");
    expect(md).toMatch(/\| 0 \| 0 \| — \|/);
  });

  it("eventos do mais recente para o mais antigo", () => {
    const md = buildEventsSummaryMarkdown(
      [
        row({ eventId: "a", name: "Antigo", startDate: "2026-01-10T12:00:00.000Z", endDate: "2026-01-11T12:00:00.000Z" }),
        row({ eventId: "b", name: "Recente", startDate: "2026-10-10T12:00:00.000Z", endDate: "2026-10-11T12:00:00.000Z" }),
      ],
      GERADO_EM,
    );

    expect(md.indexOf("| Recente |")).toBeGreaterThan(-1);
    expect(md.indexOf("| Recente |")).toBeLessThan(md.indexOf("| Antigo |"));
  });

  it("nome de evento com '|' ou quebra de linha não quebra a tabela", () => {
    // Pega: o nome virar colunas extras (ou linha nova) e desalinhar tudo.
    const md = buildEventsSummaryMarkdown([row({ name: "Feira | Inovação\nTech" })], GERADO_EM);

    const linha = md.split("\n").find((l) => l.includes("Feira"))!;
    expect(linha).toContain("Feira \\| Inovação Tech");
    // Mesmo número de colunas do cabeçalho (12 colunas = 13 barras).
    expect((linha.replace(/\\\|/g, "").match(/\|/g) ?? []).length).toBe(13);
  });

  it("usa o fuso de cada evento para as datas", () => {
    // 01:00 UTC de 06/11 = 22:00 de 05/11 em Brasília, mas 21:00 de 05/11 em Manaus: mesmo dia.
    // Já 02:00 UTC de 06/11 é 23:00 (Brasília) e 22:00 (Manaus) de 05/11. Pega: formatar em UTC.
    const md = buildEventsSummaryMarkdown(
      [row({ startDate: "2026-11-06T02:00:00.000Z", endDate: "2026-11-06T02:30:00.000Z" })],
      GERADO_EM,
    );

    expect(md).toContain("05/11/2026 a 05/11/2026");
  });
});
