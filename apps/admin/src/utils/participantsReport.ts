import jsPDF from "jspdf";
import type { ParticipantRecord } from "../api/client";
import { formatDocument, formatPhone } from "./formatters";

/**
 * Relatório de participantes (aba Participantes): CSV e PDF a partir da
 * lista já carregada na tela. Sem QR Code de propósito — o token é a
 * "chave" de entrada da pessoa e não deve circular em arquivo.
 */

const COLUMNS = ["Nome", "E-mail", "Telefone", "CPF", "Status", "Cortesia"] as const;

/** Ordem alfabética do português: "Ângelo" fica junto do "A", não depois
 * do "Z" (que é o que a comparação por código de caractere faria). */
export function sortParticipantsByName(list: ParticipantRecord[]): ParticipantRecord[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

function rowOf(p: ParticipantRecord): string[] {
  return [
    p.name,
    p.email ?? "",
    p.phone ? formatPhone(p.phone) : "",
    p.document ? formatDocument(p.document) : "",
    p.status === "ACTIVE" ? "Ativo" : "Cancelado",
    p.isCourtesy ? "Sim" : "Não",
  ];
}

/** Nome, e-mail etc. vêm de formulários públicos. Uma célula que começa
 * com = + - @ (ou tab/CR) o Excel executa como FÓRMULA ao abrir o arquivo
 * (injeção de CSV); o apóstrofo à frente faz ele tratar como texto. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** CSV com `;` e BOM, para abrir certo no Excel/Sheets em português (o BOM
 * evita "Ângelo" virar "Ã‚ngelo"). */
export function buildParticipantsCsv(list: ParticipantRecord[]): string {
  const lines = [COLUMNS.map(csvCell), ...sortParticipantsByName(list).map((p) => rowOf(p).map(csvCell))];
  return "\uFEFF" + lines.map((cells) => cells.join(";")).join("\r\n");
}

export function reportFileName(eventName: string | undefined, extension: "csv" | "pdf", now = new Date()): string {
  const slug = (eventName || "evento")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `relatorio-participantes-${slug}-${now.toISOString().split("T")[0]}.${extension}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function downloadParticipantsCsv(list: ParticipantRecord[], eventName?: string) {
  const blob = new Blob([buildParticipantsCsv(list)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFileName(eventName, "csv");
  link.click();
  URL.revokeObjectURL(url);
}

/** PDF em A4 paisagem, no mesmo visual do relatório de Inscritos. */
export function downloadParticipantsPdf(list: ParticipantRecord[], eventName?: string) {
  const sorted = sortParticipantsByName(list);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const cols = [margin, margin + 78, margin + 148, margin + 183, margin + 218, margin + 245];

  // Cabeçalho da página
  doc.setFillColor(14, 54, 52);
  doc.rect(0, 0, pageW, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`RELATÓRIO DE PARTICIPANTES — ${(eventName || "EVENTO").toUpperCase()}`, pageW / 2, 12, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const cortesias = sorted.filter((p) => p.isCourtesy).length;
  const cancelados = sorted.filter((p) => p.status !== "ACTIVE").length;
  doc.text(
    `Gerado em: ${new Date().toLocaleString("pt-BR")} | Total: ${sorted.length} | Cortesias: ${cortesias} | Cancelados: ${cancelados}`,
    pageW / 2,
    19,
    { align: "center" }
  );

  // Cabeçalho da tabela (repetido a cada página)
  let y = 32;
  const drawTableHeader = () => {
    doc.setFillColor(240, 245, 245);
    doc.rect(margin, y, pageW - margin * 2, 7, "F");
    doc.setFontSize(8);
    doc.setTextColor(14, 54, 52);
    doc.setFont("helvetica", "bold");
    COLUMNS.forEach((name, i) => doc.text(name, cols[i] + 2, y + 4.8));
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
  };
  drawTableHeader();

  // Máximo de caracteres que cabem em cada coluna (7,5 pt, ~1,3 mm por caractere).
  const widths = [56, 52, 22, 22, 12, 10];
  for (const p of sorted) {
    if (y > 190) {
      doc.addPage();
      y = 16;
      drawTableHeader();
    }
    rowOf(p).forEach((cell, i) => doc.text(truncate(cell, widths[i]), cols[i] + 2, y + 4));
    y += 6;
  }

  doc.save(reportFileName(eventName, "pdf"));
}
