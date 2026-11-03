import type { InscriptionReportItem, HandsOnRegistrationRecord } from "../api/client";
import { formatPhone, formatDocument, stripEmoji } from "./formatters";

function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

export interface PrintInscriptionsReportOptions {
  eventName?: string;
  inscriptions: InscriptionReportItem[];
}

export function printInscriptionsReport({ eventName = "COPOL 2026", inscriptions }: PrintInscriptionsReportOptions) {
  // Ordena por ordem alfabética de nome em português (com acentuação correta)
  const sorted = [...inscriptions].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

  const total = sorted.length;
  const confirmados = sorted.filter((i) => i.status === "CONFIRMED");
  const pendentes = sorted.filter((i) => i.status === "PENDING");
  const cancelados = sorted.filter((i) => i.status === "CANCELLED");
  const presentes = sorted.filter((i) => Boolean(i.checkedInAt)).length;

  const nowStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const rowsHtml = sorted
    .map((item, index) => {
      const isConfirmed = item.status === "CONFIRMED";
      const isPending = item.status === "PENDING";
      const isCancelled = item.status === "CANCELLED";

      // Método de pagamento legível
      let metodoStr = "—";
      if (item.isCourtesy || item.amount === 0) {
        metodoStr = "Cortesia / VIP";
      } else if (item.paymentMethod === "CARD") {
        metodoStr = "Cartão de Crédito";
      } else if (item.paymentMethod === "PIX") {
        if (item.paymentProvider === "MANUAL" || item.notes?.toLowerCase().includes("manual")) {
          metodoStr = "Pix (Manual)";
        } else {
          metodoStr = "Pix (Mercado Pago)";
        }
      } else if (item.notes?.toLowerCase().includes("manual")) {
        metodoStr = "Pix (Manual)";
      } else if (isConfirmed) {
        metodoStr = "Pix";
      } else {
        metodoStr = "Aguardando Pagamento";
      }

      // Situação e Apto a Entrar
      let statusBadge = "";
      if (isConfirmed) {
        statusBadge = `<span class="badge badge-apto">✓ APTO (CONFIRMADO)</span>`;
      } else if (isPending) {
        statusBadge = `<span class="badge badge-pendente">⏳ PENDENTE</span>`;
      } else if (isCancelled) {
        statusBadge = `<span class="badge badge-cancelado">❌ NÃO APTO (CANCELADO)</span>`;
      } else {
        statusBadge = `<span class="badge">${escapeHtml(item.status)}</span>`;
      }

      // Check-in
      const checkinStr = item.checkedInAt
        ? `<span class="badge badge-presente">✓ Presente às ${new Date(item.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>`
        : `<span style="color:#94a3b8;">—</span>`;

      // Data de confirmação
      const confirmacaoStr = isConfirmed
        ? formatDateTime(item.confirmedAt || item.paidAt || item.updatedAt || item.createdAt)
        : `<span style="color:#d97706;font-weight:600;">Pendente</span>`;

      const categoriaStr = stripEmoji(item.category) || "Participante";

      return `
        <tr data-status="${item.status}">
          <td style="text-align:center;font-weight:700;color:#64748b;">${index + 1}</td>
          <td>
            <strong style="color:#0f172a;font-size:10.5px;">${escapeHtml(item.name)}</strong>
            ${item.institution ? `<div style="color:#64748b;font-size:9px;">${escapeHtml(item.institution)}</div>` : ""}
          </td>
          <td class="doc-badge">${escapeHtml(formatDocument(item.document))}</td>
          <td><span style="color:#2563eb;">${escapeHtml(item.email)}</span></td>
          <td>${escapeHtml(formatPhone(item.phone))}</td>
          <td><strong>${escapeHtml(categoriaStr)}</strong></td>
          <td class="datetime">${formatDateTime(item.createdAt)}</td>
          <td class="datetime">${confirmacaoStr}</td>
          <td>${escapeHtml(metodoStr)}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="text-align:center;">${checkinStr}</td>
        </tr>
      `;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Inscrições e Credenciamento — ${escapeHtml(eventName)}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 12px 14px;
      color: #0f172a;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.35;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      gap: 12px;
      flex-wrap: wrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .no-print .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 13px;
      padding: 7px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-print {
      background: #10b981;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #059669;
    }
    .btn-close {
      background: #475569;
      color: #ffffff;
    }
    .btn-close:hover {
      background: #334155;
    }
    .btn-filter {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
      font-size: 12px;
      padding: 5px 10px;
    }
    .btn-filter.active {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: 0 !important;
      }
    }
    .report-header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .report-title {
      font-size: 16px;
      font-weight: 800;
      color: #0f766e;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      margin: 0;
    }
    .report-meta {
      font-size: 9.5px;
      color: #64748b;
      text-align: right;
    }
    .summary-boxes {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .summary-box {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .summary-box strong {
      font-size: 12px;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
      page-break-after: auto;
    }
    thead {
      display: table-header-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      page-break-after: auto;
    }
    th {
      background: #0f766e !important;
      color: #ffffff !important;
      font-weight: 700;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #0d655e;
      white-space: nowrap;
    }
    td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 8.5px;
      white-space: nowrap;
    }
    .badge-apto {
      background: #dcfce7 !important;
      color: #15803d !important;
      border: 1px solid #86efac;
    }
    .badge-pendente {
      background: #fef9c3 !important;
      color: #854d0e !important;
      border: 1px solid #fde047;
    }
    .badge-cancelado {
      background: #fee2e2 !important;
      color: #b91c1c !important;
      border: 1px solid #fca5a5;
    }
    .badge-presente {
      background: #e0f2fe !important;
      color: #0369a1 !important;
      border: 1px solid #7dd3fc;
    }
    .doc-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }
    .datetime {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5px;
      color: #475569;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <!-- Barra de controle na tela (oculta na impressão) -->
  <div class="no-print">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-weight:700;font-size:14px;color:#34d399;">🖨️ Modo Impressão / Paisagem (Deitado)</span>
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn btn-filter active" onclick="filterRows('ALL', this)">Todos (${total})</button>
        <button type="button" class="btn btn-filter" onclick="filterRows('CONFIRMED', this)">Apenas Aptos / Confirmados (${confirmados.length})</button>
        <button type="button" class="btn btn-filter" onclick="filterRows('PENDING', this)">Apenas Pendentes (${pendentes.length})</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-print" onclick="window.print()">🖨️ Imprimir Agora</button>
      <button type="button" class="btn btn-close" onclick="window.close()">❌ Fechar Janela</button>
    </div>
  </div>

  <!-- Cabeçalho Oficial do Relatório -->
  <div class="report-header">
    <div>
      <h1 class="report-title">${escapeHtml(eventName)} — RELATÓRIO OFICIAL DE CREDENCIAMENTO</h1>
      <p class="report-subtitle">Lista Geral de Inscritos e Controle de Acesso aos Portões</p>
    </div>
    <div class="report-meta">
      <div><strong>Emissão:</strong> ${nowStr}</div>
      <div><strong>Orientação:</strong> Paisagem (Deitado / Horizontal)</div>
    </div>
  </div>

  <!-- Quadro de Indicadores -->
  <div class="summary-boxes">
    <div class="summary-box">
      <span>Total Inscritos:</span>
      <strong>${total}</strong>
    </div>
    <div class="summary-box" style="border-color:#86efac;background:#f0fdf4;">
      <span style="color:#166534;">🟢 Aptos a Entrar (Confirmados):</span>
      <strong style="color:#15803d;">${confirmados.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#fde047;background:#fefce8;">
      <span style="color:#854d0e;">🟡 Pendentes via Pix:</span>
      <strong style="color:#a16207;">${pendentes.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#fca5a5;background:#fef2f2;">
      <span style="color:#991b1b;">🔴 Cancelados:</span>
      <strong style="color:#b91c1c;">${cancelados.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#7dd3fc;background:#f0f9ff;">
      <span style="color:#0369a1;">✓ Check-ins Efetuados:</span>
      <strong style="color:#0284c7;">${presentes}</strong>
    </div>
  </div>

  <!-- Tabela com Todas as Inscrições -->
  <table>
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">#</th>
        <th style="width:18%;">Nome do Participante</th>
        <th style="width:11%;">CPF</th>
        <th style="width:17%;">E-mail</th>
        <th style="width:11%;">Telefone</th>
        <th style="width:11%;">Lote / Categoria</th>
        <th style="width:9%;">Inscrição</th>
        <th style="width:9%;">Pagamento</th>
        <th style="width:9%;">Método</th>
        <th style="width:10%;text-align:center;">Situação / Apto</th>
        <th style="width:7%;text-align:center;">Entrada</th>
      </tr>
    </thead>
    <tbody id="report-table-body">
      ${rowsHtml}
    </tbody>
  </table>

  <div style="margin-top:14px;border-top:1px solid #cbd5e1;padding-top:6px;display:flex;justify-content:space-between;font-size:8.5px;color:#64748b;">
    <span>LSPK Tecnology · Sistema de Credenciamento e Controle de Portões</span>
    <span>Documento oficial gerado para auditoria e controle de entrada · Página com orientação Paisagem (Deitado)</span>
  </div>

  <script>
    function filterRows(status, btn) {
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const rows = document.querySelectorAll('#report-table-body tr');
      rows.forEach(tr => {
        if (status === 'ALL') {
          tr.style.display = '';
        } else {
          tr.style.display = tr.getAttribute('data-status') === status ? '' : 'none';
        }
      });
    }

    // Aciona a tela nativa de impressão automaticamente ao carregar
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 350);
    });
  </script>
</body>
</html>`;

  openReportWindow(html, `Relatorio-Inscritos-${eventName.replace(/\s+/g, "_")}`);
}

export interface PrintHandsOnReportOptions {
  eventName?: string;
  workshopTitle?: string;
  registrations: HandsOnRegistrationRecord[];
  workshopSelloutData?: Record<string, any>;
  workshopCapacities?: Record<string, number>;
}

export function printHandsOnReport({
  eventName = "COPOL 2026",
  workshopTitle,
  registrations,
  workshopSelloutData = {},
  workshopCapacities = {},
}: PrintHandsOnReportOptions) {
  // Ordena por Workshop e depois por Nome
  const sorted = [...registrations].sort((a, b) => {
    const compWorkshop = a.title.localeCompare(b.title, "pt-BR");
    if (compWorkshop !== 0) return compWorkshop;
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });

  const total = sorted.length;
  const confirmados = sorted.filter((r) => r.status === "CONFIRMED");
  const pendentes = sorted.filter((r) => r.status === "PENDING");
  const cancelados = sorted.filter((r) => r.status === "CANCELLED");
  const presentes = sorted.filter((r) => Boolean(r.checkedInAt)).length;

  const nowStr = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const rowsHtml = sorted
    .map((r, index) => {
      const isConfirmed = r.status === "CONFIRMED";
      const isPending = r.status === "PENDING";
      const isCancelled = r.status === "CANCELLED";

      const targetId =
        r.handsOnId === "reabilitacao-resina-composta"
          ? "integrale-cirurgia-implante-protetico"
          : r.handsOnId;
      const sellout = workshopSelloutData[targetId];
      const maxVagas = workshopCapacities[targetId] ?? 12;
      const orderInfo = sellout?.confirmedOrderMap?.get(r.id);
      const isOverCapacity = orderInfo ? orderInfo.isOver : false;
      const rank = orderInfo ? orderInfo.rank : null;

      // Método de pagamento legível
      let metodoStr = "—";
      if (r.amount === 0) {
        metodoStr = "Gratuito / Palestra";
      } else if (r.notes?.toLowerCase().includes("mercado pago")) {
        metodoStr = "Pix (Mercado Pago)";
      } else if (r.notes?.toLowerCase().includes("manual")) {
        metodoStr = "Pix (Manual)";
      } else if (r.notes?.toLowerCase().includes("cortesia") || r.notes?.toLowerCase().includes("vip")) {
        metodoStr = "Cortesia / VIP";
      } else if (isConfirmed) {
        metodoStr = "Pix";
      } else {
        metodoStr = "Aguardando Pix";
      }

      // Situação e Apto a Entrar
      let statusBadge = "";
      let rowCategory: string = r.status;
      if (isConfirmed) {
        if (isOverCapacity) {
          rowCategory = "EXCEEDED";
          statusBadge = `<span class="badge badge-excedente">⚠️ EXCEDENTE (${rank}º/${maxVagas})</span>`;
        } else {
          rowCategory = "CONFIRMED_OFFICIAL";
          statusBadge = `<span class="badge badge-apto">✓ APTO (Vaga ${rank || 1}/${maxVagas})</span>`;
        }
      } else if (isPending) {
        rowCategory = "PENDING";
        statusBadge = `<span class="badge badge-pendente">⏳ PENDENTE PIX</span>`;
      } else if (isCancelled) {
        rowCategory = "CANCELLED";
        statusBadge = `<span class="badge badge-cancelado">🚫 CANCELADO (Esgotado)</span>`;
      } else {
        statusBadge = `<span class="badge">${escapeHtml(r.status)}</span>`;
      }

      // Check-in
      const checkinStr = r.checkedInAt
        ? `<span class="badge badge-presente">✓ Presente (${new Date(r.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})</span>`
        : `<span style="color:#94a3b8;">—</span>`;

      // Data de confirmação
      const confirmacaoStr = isConfirmed
        ? formatDateTime(r.paidAt || r.createdAt)
        : `<span style="color:#d97706;font-weight:600;">Pendente</span>`;

      return `
        <tr data-status="${rowCategory}">
          <td style="text-align:center;font-weight:700;color:#64748b;">${index + 1}</td>
          <td>
            <strong style="color:#0f766e;font-size:9.5px;display:block;">${escapeHtml(r.title)}</strong>
            <span style="color:#64748b;font-size:8.5px;">${escapeHtml(r.speaker)} · ${escapeHtml(r.date)} ${escapeHtml(r.time)}</span>
          </td>
          <td>
            <strong style="color:#0f172a;font-size:10px;">${escapeHtml(r.name)}</strong>
            ${r.category ? `<div style="color:#64748b;font-size:8.5px;">${escapeHtml(r.category)}</div>` : ""}
          </td>
          <td class="doc-badge">${escapeHtml(formatDocument(r.document))}</td>
          <td><span style="color:#2563eb;">${escapeHtml(r.email)}</span></td>
          <td>${escapeHtml(formatPhone(r.phone))}</td>
          <td class="datetime">${formatDateTime(r.createdAt)}</td>
          <td class="datetime">${confirmacaoStr}</td>
          <td>${escapeHtml(metodoStr)}</td>
          <td style="text-align:center;">${statusBadge}</td>
          <td style="text-align:center;">${checkinStr}</td>
        </tr>
      `;
    })
    .join("");

  const pageTitle = workshopTitle
    ? `Controle de Acesso — Hands On: ${workshopTitle}`
    : `Controle Geral — Workshops Hands On · ${eventName}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 12px 14px;
      color: #0f172a;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.35;
    }
    .no-print {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #f8fafc;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      gap: 12px;
      flex-wrap: wrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .no-print .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 13px;
      padding: 7px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-print {
      background: #10b981;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #059669;
    }
    .btn-close {
      background: #475569;
      color: #ffffff;
    }
    .btn-close:hover {
      background: #334155;
    }
    .btn-filter {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #475569;
      font-size: 12px;
      padding: 5px 10px;
    }
    .btn-filter.active {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: 0 !important;
      }
    }
    .report-header {
      border-bottom: 2px solid #0f766e;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .report-title {
      font-size: 15px;
      font-weight: 800;
      color: #0f766e;
      margin: 0 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .report-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      margin: 0;
    }
    .report-meta {
      font-size: 9.5px;
      color: #64748b;
      text-align: right;
    }
    .summary-boxes {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .summary-box {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .summary-box strong {
      font-size: 12px;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5px;
      page-break-after: auto;
    }
    thead {
      display: table-header-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      page-break-after: auto;
    }
    th {
      background: #0f766e !important;
      color: #ffffff !important;
      font-weight: 700;
      text-align: left;
      padding: 5px 6px;
      border: 1px solid #0d655e;
      white-space: nowrap;
    }
    td {
      padding: 4px 5px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 8px;
      white-space: nowrap;
    }
    .badge-apto {
      background: #dcfce7 !important;
      color: #15803d !important;
      border: 1px solid #86efac;
    }
    .badge-pendente {
      background: #fef9c3 !important;
      color: #854d0e !important;
      border: 1px solid #fde047;
    }
    .badge-cancelado {
      background: #fee2e2 !important;
      color: #b91c1c !important;
      border: 1px solid #fca5a5;
    }
    .badge-excedente {
      background: #ffedd5 !important;
      color: #c2410c !important;
      border: 1px solid #fdba74;
    }
    .badge-presente {
      background: #e0f2fe !important;
      color: #0369a1 !important;
      border: 1px solid #7dd3fc;
    }
    .doc-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }
    .datetime {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8px;
      color: #475569;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <!-- Barra de controle na tela (oculta na impressão) -->
  <div class="no-print">
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span style="font-weight:700;font-size:14px;color:#34d399;">🖨️ Modo Impressão / Paisagem (Deitado)</span>
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn btn-filter active" onclick="filterRows('ALL', this)">Todos (${total})</button>
        <button type="button" class="btn btn-filter" onclick="filterRows('CONFIRMED_OFFICIAL', this)">Apenas Aptos / Vagas Oficiais</button>
        <button type="button" class="btn btn-filter" onclick="filterRows('PENDING', this)">Apenas Pendentes (${pendentes.length})</button>
        <button type="button" class="btn btn-filter" onclick="filterRows('EXCEEDED', this)">Excedentes / Cancelados</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button type="button" class="btn btn-print" onclick="window.print()">🖨️ Imprimir Agora</button>
      <button type="button" class="btn btn-close" onclick="window.close()">❌ Fechar Janela</button>
    </div>
  </div>

  <!-- Cabeçalho Oficial do Relatório -->
  <div class="report-header">
    <div>
      <h1 class="report-title">${escapeHtml(eventName)} — WORKSHOPS HANDS ON</h1>
      <p class="report-subtitle">${workshopTitle ? `Controle de Acesso: <strong>${escapeHtml(workshopTitle)}</strong>` : "Controle Geral de Inscritos e Presença em Sala"}</p>
    </div>
    <div class="report-meta">
      <div><strong>Emissão:</strong> ${nowStr}</div>
      <div><strong>Orientação:</strong> Paisagem (Deitado / Horizontal)</div>
    </div>
  </div>

  <!-- Quadro de Indicadores -->
  <div class="summary-boxes">
    <div class="summary-box">
      <span>Total Inscritos:</span>
      <strong>${total}</strong>
    </div>
    <div class="summary-box" style="border-color:#86efac;background:#f0fdf4;">
      <span style="color:#166534;">🟢 Vagas Confirmadas:</span>
      <strong style="color:#15803d;">${confirmados.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#fde047;background:#fefce8;">
      <span style="color:#854d0e;">🟡 Pendentes via Pix:</span>
      <strong style="color:#a16207;">${pendentes.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#fca5a5;background:#fef2f2;">
      <span style="color:#991b1b;">🔴 Cancelados / Esgotados:</span>
      <strong style="color:#b91c1c;">${cancelados.length}</strong>
    </div>
    <div class="summary-box" style="border-color:#7dd3fc;background:#f0f9ff;">
      <span style="color:#0369a1;">✓ Check-ins em Sala:</span>
      <strong style="color:#0284c7;">${presentes}</strong>
    </div>
  </div>

  <!-- Tabela com Todas as Inscrições -->
  <table>
    <thead>
      <tr>
        <th style="width:26px;text-align:center;">#</th>
        <th style="width:20%;">Workshop Hands On</th>
        <th style="width:16%;">Nome do Participante</th>
        <th style="width:10%;">CPF</th>
        <th style="width:14%;">E-mail</th>
        <th style="width:10%;">Telefone</th>
        <th style="width:8%;">Inscrição</th>
        <th style="width:8%;">Pagamento</th>
        <th style="width:8%;">Método</th>
        <th style="width:10%;text-align:center;">Situação / Vaga</th>
        <th style="width:6%;text-align:center;">Sala</th>
      </tr>
    </thead>
    <tbody id="report-table-body">
      ${rowsHtml}
    </tbody>
  </table>

  <div style="margin-top:14px;border-top:1px solid #cbd5e1;padding-top:6px;display:flex;justify-content:space-between;font-size:8px;color:#64748b;">
    <span>LSPK Tecnology · Sistema de Credenciamento e Workshops Hands On COPOL</span>
    <span>Documento de conferência de sala e portaria · Página com orientação Paisagem (Deitado)</span>
  </div>

  <script>
    function filterRows(status, btn) {
      document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const rows = document.querySelectorAll('#report-table-body tr');
      rows.forEach(tr => {
        if (status === 'ALL') {
          tr.style.display = '';
        } else if (status === 'EXCEEDED') {
          const rowCat = tr.getAttribute('data-status');
          tr.style.display = (rowCat === 'EXCEEDED' || rowCat === 'CANCELLED') ? '' : 'none';
        } else {
          tr.style.display = tr.getAttribute('data-status') === status ? '' : 'none';
        }
      });
    }

    // Aciona a tela nativa de impressão automaticamente ao carregar
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 350);
    });
  </script>
</body>
</html>`;

  openReportWindow(html, `Relatorio-Hands-On-${(workshopTitle || eventName).replace(/\s+/g, "_")}`);
}

function openReportWindow(html: string, windowTitle: string) {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");
    if (!win) {
      alert("O navegador bloqueou a abertura da janela de impressão. Por favor, permita pop-ups para este site para abrir a tela de impressão.");
      return;
    }
    win.focus();
  } catch {
    // Fallback para document.write
    const win = window.open("", "_blank");
    if (!win) {
      alert("O navegador bloqueou a abertura da janela de impressão. Por favor, permita pop-ups para este site para abrir a tela de impressão.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.title = windowTitle;
    win.document.close();
    win.focus();
  }
}
