import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

import { certificateLayoutSchema } from "../src/modules/certificates/certificate-layout.js";
import { formatCpf, loadBackground, renderCertificatePdf } from "../src/modules/certificates/certificate-template.js";

const base = {
  imagemLargura: 1491,
  imagemAltura: 1055,
  paragrafo: null,
  chipData: null,
  assinaturas: null,
  qr: null,
};

async function render(nome: Record<string, unknown>) {
  const layout = certificateLayoutSchema.parse({
    ...base,
    nome: { xEsquerda: 478, xDireita: 1351, yBase: 372, ...nome },
  });
  return renderCertificatePdf({
    participantName: "Ana Lívia Conceição",
    eventName: "3º COPOL",
    locationLabel: "Universidade Positivo",
    eventStartDate: new Date("2026-11-05T10:30:00Z"),
    eventEndDate: new Date("2026-11-07T22:00:00Z"),
    workloadHours: 20,
    paragraphSegments: [],
    verificationUrl: "https://exemplo.test/v/abc",
    backgroundBytes: await loadBackground("copol-2026"),
    layout,
    signatories: [],
    primaryColor: "#044544",
    textColor: "#1A1A1A",
  });
}

/** Nomes das fontes embutidas e todo o conteúdo desenhado, descomprimido. */
async function inspecionar(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const fontes: string[] = [];
  let conteudo = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFRawStream ? obj.dict : obj instanceof PDFDict ? obj : null;
    if (dict?.get(PDFName.of("Type")) === PDFName.of("Font")) {
      fontes.push(String(dict.get(PDFName.of("BaseFont"))));
    }
    if (obj instanceof PDFRawStream && !dict?.get(PDFName.of("Subtype"))) {
      try {
        conteudo += inflateSync(Buffer.from(obj.contents)).toString("latin1");
      } catch {
        conteudo += Buffer.from(obj.contents).toString("latin1");
      }
    }
  }
  return { fontes, conteudo };
}

describe("fonte e cor do nome", () => {
  it("aceita a fonte cursiva e uma cor própria para o nome", () => {
    const r = certificateLayoutSchema.safeParse({
      ...base,
      nome: { xEsquerda: 1, xDireita: 2, yBase: 3, fonte: "cursiva", cor: "#B8934A" },
    });
    expect(r.success).toBe(true);
  });

  it("recusa cor fora do formato #RRGGBB", () => {
    const r = certificateLayoutSchema.safeParse({
      ...base,
      nome: { xEsquerda: 1, xDireita: 2, yBase: 3, cor: "dourado" },
    });
    expect(r.success).toBe(false);
  });

  it("embute a Great Vibes quando a fonte é cursiva, com acentos", async () => {
    const { fontes, conteudo } = await inspecionar(await render({ fonte: "cursiva", cor: "#B8934A" }));
    expect(fontes.some((f) => f.includes("GreatVibes"))).toBe(true);
    // A cor do nome vai para o operador de cor do PDF (0.722 0.576 0.290).
    expect(conteudo).toMatch(/0\.72\d* 0\.57\d* 0\.29\d* rg/);
  });

  it("sem cursiva, não embute TTF nenhuma (fontes padrão do PDF)", async () => {
    const { fontes, conteudo } = await inspecionar(await render({ fonte: "serifada" }));
    expect(fontes.some((f) => f.includes("GreatVibes"))).toBe(false);
    expect(fontes).toContain("/Times-Bold");
    // Sem cor própria, o nome sai na cor de destaque (#044544).
    expect(conteudo).toMatch(/0\.01\d* 0\.27\d* 0\.26\d* rg/);
  });
});

describe("Figtree e CPF (SafeTeen)", () => {
  it("aceita a fonte figtree e a caixa do CPF", () => {
    const r = certificateLayoutSchema.safeParse({
      ...base,
      nome: { xEsquerda: 1, xDireita: 2, yBase: 3, fonte: "figtree", alinhamento: "centro" },
      cpf: { xEsquerda: 1, yBase: 40, tamanho: 30, cor: "#4D5E70" },
    });
    expect(r.success).toBe(true);
  });

  it("embute a Figtree no nome e no CPF e escreve o CPF formatado", async () => {
    const layout = certificateLayoutSchema.parse({
      ...base,
      nome: { xEsquerda: 478, xDireita: 1351, yBase: 372, fonte: "figtree", alinhamento: "centro" },
      cpf: { xEsquerda: 478, yBase: 410, tamanho: 30 },
    });
    const bytes = await renderCertificatePdf({
      participantName: "João Conceição",
      participantDocument: "12345678909",
      eventName: "SafeTeen",
      locationLabel: "UP",
      eventStartDate: new Date("2026-11-11T13:00:00Z"),
      eventEndDate: new Date("2026-11-11T22:00:00Z"),
      workloadHours: 8,
      paragraphSegments: [],
      verificationUrl: "https://exemplo.test/v/abc",
      backgroundBytes: await loadBackground("copol-2026"),
      layout,
      signatories: [],
      primaryColor: "#072F56",
      textColor: "#4D5E70",
    });
    const { fontes } = await inspecionar(bytes);
    expect(fontes.some((f) => /Figtree.*-ExtraBold/.test(f))).toBe(true);
    expect(fontes.some((f) => /Figtree.*-SemiBold/.test(f))).toBe(true);
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });

  it("sem a caixa do CPF, não desenha CPF nem embute a Figtree SemiBold", async () => {
    const { fontes } = await inspecionar(await render({ fonte: "figtree" }));
    expect(fontes.some((f) => /Figtree.*-ExtraBold/.test(f))).toBe(true);
    expect(fontes.some((f) => /Figtree.*-SemiBold/.test(f))).toBe(false);
  });
});
