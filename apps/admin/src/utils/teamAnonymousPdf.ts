import jsPDF from "jspdf";
import JSZip from "jszip";
import type { TeamRecord } from "../pages/event/TeamsTab";

// ──── MAPA OFICIAL DE ODS DA ONU ────
const ODS_MAP: Record<number, { nome: string }> = {
  1: { nome: "Erradicação da Pobreza" },
  2: { nome: "Fome Zero e Agricultura Sustentável" },
  3: { nome: "Saúde e Bem-Estar" },
  4: { nome: "Educação de Qualidade" },
  5: { nome: "Igualdade de Gênero" },
  6: { nome: "Água Potável e Saneamento" },
  7: { nome: "Energia Limpa e Acessível" },
  8: { nome: "Trabalho Decente e Crescimento Econômico" },
  9: { nome: "Indústria, Inovação e Infraestrutura" },
  10: { nome: "Redução das Desigualdades" },
  11: { nome: "Cidades e Comunidades Sustentáveis" },
  12: { nome: "Consumo e Produção Responsáveis" },
  13: { nome: "Ação Contra a Mudança Global do Clima" },
  14: { nome: "Vida na Água" },
  15: { nome: "Vida Terrestre" },
  16: { nome: "Paz, Justiça e Instituições Eficazes" },
  17: { nome: "Parcerias e Meios de Implementação" },
};

// ──── MAPA DE FORMAS DE PROTÓTIPO ────
const FORMAS_MAP: Record<string, string> = {
  forma_a: "Software / Aplicação Digital",
  forma_b: "Peça Física para Impressão 3D",
  forma_c: "Serviço, Protocolo ou Fluxo Assistencial",
  forma_d: "Espaço, Sinalização ou Comunicação Visual",
};

/**
 * Sanitiza texto para nome de arquivo seguro
 */
function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 45);
}

/**
 * Desenha o cabeçalho superior padrão em cada página
 */
function drawPageHeader(doc: jsPDF, pageW: number, projectTitle: string, eventName: string = "INOVA SAÚDE 2026") {
  // Barra de fundo do cabeçalho
  doc.setFillColor(14, 54, 52); // #0E3634
  doc.rect(0, 0, pageW, 20, "F");

  // Faixa de destaque dourada
  doc.setFillColor(200, 162, 97); // #C8A261
  doc.rect(0, 20, pageW, 1.2, "F");

  // Título e subtítulo
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`${eventName.toUpperCase()} — BANCA DE AVALIADORES`, 14, 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(200, 220, 218);
  doc.text(`FICHA TÉCNICA DO PROJETO · AVALIAÇÃO EM SIGILO · ${projectTitle}`, 14, 15);

  // Badge de Sigilo no canto direito
  doc.setFillColor(234, 179, 8);
  doc.roundedRect(pageW - 68, 5, 54, 10, 1.5, 1.5, "F");
  doc.setTextColor(20, 30, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SIGILO RIGOROSO", pageW - 41, 9.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("SEM NOMES / CONTATOS", pageW - 41, 13, { align: "center" });
}

/**
 * Desenha o rodapé com paginação
 */
function drawPageFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, totalPages?: number) {
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 12, pageW - 14, pageH - 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 130, 140);
  doc.text(
    "Inova Saúde 2026 · Maratona de Inovação em Saúde · Material Confidencial para Avaliação às Cegas",
    14,
    pageH - 7
  );

  const pagStr = totalPages ? `Página ${pageNum} de ${totalPages}` : `Página ${pageNum}`;
  doc.text(pagStr, pageW - 14, pageH - 7, { align: "right" });
}

/**
 * Garante quebra de página automática quando o cursor ultrapassa o limite
 */
function ensureSpace(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  pageW: number,
  pageH: number,
  projectTitle: string,
  pageCounter: { current: number },
  eventName: string = "INOVA SAÚDE 2026"
): number {
  if (currentY + neededHeight > pageH - 18) {
    drawPageFooter(doc, pageW, pageH, pageCounter.current);
    doc.addPage();
    pageCounter.current += 1;
    drawPageHeader(doc, pageW, projectTitle, eventName);
    return 27;
  }
  return currentY;
}

/**
 * Desenha título de seção com barra lateral colorida
 */
function drawSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  pageW: number,
  color: [number, number, number] = [14, 54, 52]
): number {
  doc.setFillColor(242, 246, 246);
  doc.roundedRect(14, y, pageW - 28, 7.5, 1.2, 1.2, "F");

  doc.setFillColor(...color);
  doc.rect(14, y, 3, 7.5, "F");

  doc.setTextColor(...color);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 20, y + 5.2);

  return y + 10.5;
}

/**
 * Desenha um campo com rótulo em negrito e valor com quebra de linha
 */
function drawField(
  doc: jsPDF,
  label: string,
  value: string | undefined | null,
  startY: number,
  pageW: number,
  pageH: number,
  projectTitle: string,
  pageCounter: { current: number },
  eventName: string = "INOVA SAÚDE 2026"
): number {
  const content = value?.trim() || "—";
  const usableW = pageW - 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  let y = ensureSpace(doc, startY, 7, pageW, pageH, projectTitle, pageCounter, eventName);
  doc.text(label, 14, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const lines = doc.splitTextToSize(content, usableW);
  for (const line of lines) {
    y = ensureSpace(doc, y, 4.5, pageW, pageH, projectTitle, pageCounter, eventName);
    doc.text(line, 14, y);
    y += 4;
  }

  return y + 1.5;
}

/**
 * Gera o PDF individual de uma equipe com sigilo total de dados pessoais
 */
export function generateAnonymousTeamPdf(
  team: TeamRecord,
  index: number,
  eventName: string = "INOVA SAÚDE 2026"
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCounter = { current: 1 };

  const projectCode = `PROJ-${String(index + 1).padStart(2, "0")}`;
  const solutionName = team.idear?.nome_solucao || team.teamName || `Projeto ${index + 1}`;
  const projectHeaderTitle = `${projectCode} · ${solutionName}`;

  // Página 1: Cabeçalho
  drawPageHeader(doc, pageW, projectHeaderTitle, eventName);
  let y = 26;

  // ──── BOX PRINCIPAL DE IDENTIFICAÇÃO ANÔNIMA ────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, pageW - 28, 38, 2, 2, "FD");

  // Código do Projeto em destaque
  doc.setFillColor(14, 54, 52);
  doc.roundedRect(18, y + 4, 26, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(projectCode, 31, y + 8.8, { align: "center" });

  // Nome da Solução
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const truncatedSolution = solutionName.length > 40 ? `${solutionName.substring(0, 38)}…` : solutionName;
  doc.text(truncatedSolution, 48, y + 9.5);

  // Eixo Temático e Trilha
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const eixoTexto = team.definir?.eixo || "Eixo Geral de Saúde";
  doc.text(`Eixo Temático: ${eixoTexto}`, 18, y + 17);
  doc.text(`Trilha de Inovação: ${team.trilhaLabel}`, 18, y + 22);

  // Formas de Prototipagem
  const formasNomes = (team.forma?.formas || []).map((f) => FORMAS_MAP[f] || f);
  const formasTexto = formasNomes.length > 0 ? formasNomes.join(" • ") : "Protótipo em Definição";
  doc.text(`Forma de Protótipo: ${formasTexto}`, 18, y + 27);

  // Composição Multidisciplinar Anônima da Equipe
  const totalMembros = team.totalIntegrantes || 1 + (team.integrantes?.length || 0);
  const liderPapel = team.lider?.papel || "Líder e Coordenação";
  const competencias = [
    ...(team.lider?.competencias || []),
    ...(team.competenciasEquipe || []),
  ];
  const compUnicas = Array.from(new Set(competencias)).slice(0, 8);
  const compTexto = compUnicas.length > 0 ? ` [Habilidades: ${compUnicas.join(", ")}]` : "";

  doc.setFont("helvetica", "bold");
  doc.setTextColor(11, 66, 121);
  doc.text(
    `Equipe Multidisciplinar (${totalMembros} participantes): 1x Líder (${liderPapel}) + ${totalMembros - 1}x Integrantes${compTexto}`,
    18,
    y + 33
  );

  y += 42;

  // ──── SEÇÃO 1: O PROBLEMA & EMPATIA (EMPATIZAR) ────
  y = drawSectionHeader(doc, "1. O Problema & Empatia (Empatizar)", y, pageW, [180, 83, 9]);
  y = drawField(doc, "Quem vive o problema (Público-alvo / Usuário final):", team.empatizar?.quem_vive, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawField(doc, "O que essas pessoas perdem com esse problema (Dores e prejuízos reais):", team.empatizar?.o_que_perde, y, pageW, pageH, projectHeaderTitle, pageCounter);
  const comoSabe = team.empatizar?.como_sabe?.length ? team.empatizar.como_sabe.join(", ") : undefined;
  y = drawField(doc, "Como a equipe validou a existência do problema:", comoSabe, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y += 2;

  // ──── SEÇÃO 2: DEFINIÇÃO DO PROBLEMA (DEFINIR) ────
  y = ensureSpace(doc, y, 20, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "2. Definição do Problema (Definir)", y, pageW, [180, 83, 9]);

  // Frase estruturada do problema se existir
  const fraseDef = team.definir?.frase;
  if (fraseDef?.quem || fraseDef?.o_que) {
    const fraseCompleta = `Para ${fraseDef.quem || "o público"}, o problema é ${fraseDef.o_que || "a dor identificada"}, porque ${fraseDef.por_que || "ocorre a complicação"}, mas é atrapalhado por ${fraseDef.o_que_atrapalha || "obstáculos atuais"}.`;
    y = drawField(doc, "Frase Síntese do Problema:", fraseCompleta, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }

  y = drawField(doc, "Frequência com que o problema ocorre:", team.definir?.frequencia, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawField(doc, "Como as pessoas/profissionais tentam resolver hoje:", team.definir?.como_resolvem_hoje, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawField(doc, "Por que a alternativa atual não resolve adequadamente:", team.definir?.por_que_nao_resolve, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y += 2;

  // ──── SEÇÃO 3: A SOLUÇÃO & PROPOSTA DE VALOR (IDEAR) ────
  y = ensureSpace(doc, y, 25, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "3. A Solução Proposta & Proposta de Valor (Idear)", y, pageW, [14, 116, 144]);
  y = drawField(doc, "Nome e Categoria da Solução:", `${team.idear?.nome_solucao || solutionName} — ${team.idear?.categoria || "Solução em Saúde"}`, y, pageW, pageH, projectHeaderTitle, pageCounter);

  // 3 Passos de funcionamento
  if (team.idear?.tres_passos && team.idear.tres_passos.length > 0) {
    y = ensureSpace(doc, y, 15, pageW, pageH, projectHeaderTitle, pageCounter);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("Como a solução funciona em 3 passos:", 14, y);
    y += 4;

    team.idear.tres_passos.forEach((passo, pIdx) => {
      if (!passo.trim()) return;
      y = ensureSpace(doc, y, 8, pageW, pageH, projectHeaderTitle, pageCounter);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(14, 116, 144);
      doc.text(`Passo ${pIdx + 1}:`, 16, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      const pLines = doc.splitTextToSize(passo, pageW - 46);
      doc.text(pLines, 30, y);
      y += pLines.length * 4 + 1.5;
    });
    y += 1;
  }

  // Frase de Pitch (Metodologia MIT)
  const fraseIdear = team.idear?.frase;
  if (fraseIdear && (fraseIdear.beneficio || fraseIdear.diferencial)) {
    const pitchTexto = `Para ${fraseIdear.quem || "os clientes"} que necessitam de ${fraseIdear.necessidade || "uma solução eficaz"}, o ${fraseIdear.nome || solutionName} é um(a) ${fraseIdear.categoria || "inovação"} que ${fraseIdear.beneficio || "traz grande impacto"}. Diferente de ${fraseIdear.alternativa || "outras opções"}, nosso diferencial é ${fraseIdear.diferencial || "exclusivo"}.`;
    y = drawField(doc, "Declaração de Posicionamento e Valor (Pitch MIT):", pitchTexto, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }
  y += 2;

  // ──── SEÇÃO 4: ESCOPO DO PRODUTO (ESCOPO) ────
  y = ensureSpace(doc, y, 22, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "4. Escopo & Limites da Solução (Escopo)", y, pageW, [79, 70, 229]);

  const escopoE = team.escopo?.e;
  const escopoNaoE = team.escopo?.nao_e;
  if (escopoE || escopoNaoE) {
    if (escopoE) y = drawField(doc, "O que a solução É:", escopoE, y, pageW, pageH, projectHeaderTitle, pageCounter);
    if (escopoNaoE) y = drawField(doc, "O que a solução NÃO É:", escopoNaoE, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }

  const fazItens = (team.escopo?.faz || []).filter(Boolean);
  const naoFazItens = (team.escopo?.nao_faz || []).filter(Boolean);
  if (fazItens.length > 0) {
    y = drawField(doc, "O que a solução FAZ:", fazItens.join(" • "), y, pageW, pageH, projectHeaderTitle, pageCounter);
  }
  if (naoFazItens.length > 0) {
    y = drawField(doc, "O que a solução NÃO FAZ (Fora do escopo):", naoFazItens.join(" • "), y, pageW, pageH, projectHeaderTitle, pageCounter);
  }
  y += 2;

  // ──── SEÇÃO 5: FORMA & PROTOTIPAGEM TÉCNICA ────
  y = ensureSpace(doc, y, 22, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "5. Prototipagem & Especificações Técnicas (Forma)", y, pageW, [16, 185, 129]);

  // Software
  if (team.forma?.software && Array.isArray(team.forma.software) && team.forma.software.length > 0) {
    const swInfo = team.forma.software.map((s: any) => `${s.nome || "Módulo"}: ${s.acao || s.descricao || "funcionalidade"}`).join(" | ");
    y = drawField(doc, "Especificações do Software / Plataforma:", swInfo, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }

  // Peça 3D
  if (team.forma?.peca_3d && (team.forma.peca_3d.material || team.forma.peca_3d.envelope_mm)) {
    const p3d = team.forma.peca_3d;
    const envDim = Array.isArray(p3d.envelope_mm) ? `${p3d.envelope_mm.join("x")} mm` : "Não informado";
    const info3d = `Material: ${p3d.material || "PLA/PETG"} | Dimensões (Envelope): ${envDim} | Cabe na mesa: ${p3d.cabe_na_mesa ? "Sim" : "Não"}${p3d.pecaEncaixaEm ? ` | Encaixa em: ${p3d.pecaEncaixaEm}` : ""}`;
    y = drawField(doc, "Especificações da Peça 3D:", info3d, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }

  // Trava Sanitária
  const ts = team.forma?.trava_sanitaria;
  const travaStatus = ts?.acionada ? `⚠️ Acionada (${ts.motivos?.join(", ") || ts.restricao || "Atenção a normas sanitárias"})` : "✅ Não acionada / Sem restrições impeditivas";
  y = drawField(doc, "Avaliação de Trava Sanitária (Regulação ANVISA / SUS):", travaStatus, y, pageW, pageH, projectHeaderTitle, pageCounter);
  y += 2;

  // ──── SEÇÃO 6: ALINHAMENTO COM AS ODS & MÉTRICAS DE SUCESSO ────
  y = ensureSpace(doc, y, 20, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "6. Impacto Social & Alinhamento com as ODS da ONU", y, pageW, [225, 29, 72]);

  const odsNumeros = team.fechamento?.ods || [];
  const odsNomes = odsNumeros.map((num) => `ODS ${num} - ${ODS_MAP[num]?.nome || `Meta ${num}`}`).join("; ");
  y = drawField(doc, "Objetivos de Desenvolvimento Sustentável (ODS) Impactados:", odsNomes || "ODS 3 - Saúde e Bem-Estar", y, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawField(doc, "Métrica de Sucesso (Como saberemos se a ideia funcionou):", team.fechamento?.como_saberemos, y, pageW, pageH, projectHeaderTitle, pageCounter);
  if (team.fechamento?.maior_duvida) {
    y = drawField(doc, "Maior dúvida ou desafio enfrentado pela equipe:", team.fechamento.maior_duvida, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }
  y += 2;

  // ──── SEÇÃO 7: ARTEFATOS ENTREGUES & LINKS DE AVALIAÇÃO ────
  y = ensureSpace(doc, y, 25, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "7. Artefatos Entregues & Materiais para Teste", y, pageW, [15, 118, 110]);

  // Consolida trabalhos entregues
  const todosTrabalhos = team.trabalhos || [];
  let prototipoLink = "";
  let videoLink = "";
  const arquivosLinks: Array<{ tipo: string; titulo: string; linkUrl: string; tamanho?: string }> = [];
  let observacoesBanca = "";

  todosTrabalhos.forEach((trab) => {
    if (trab.prototipoUrl && !prototipoLink) prototipoLink = trab.prototipoUrl;
    if (trab.videoUrl && !videoLink) videoLink = trab.videoUrl;
    if (trab.observacoes && !observacoesBanca) observacoesBanca = trab.observacoes;

    if (Array.isArray(trab.itens)) {
      trab.itens.forEach((it: any) => {
        const url = it.linkUrl || it.url;
        if (url) {
          const tamStr = it.tamanhoBytes ? ` (${(it.tamanhoBytes / (1024 * 1024)).toFixed(2)} MB)` : "";
          arquivosLinks.push({
            tipo: it.tipo || "Arquivo",
            titulo: it.titulo || it.originalName || it.arquivoNome || "Material entregue",
            linkUrl: url,
            tamanho: tamStr,
          });
        }
      });
    }
  });

  // Link do Protótipo
  if (prototipoLink) {
    y = ensureSpace(doc, y, 8, pageW, pageH, projectHeaderTitle, pageCounter);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("Link do Protótipo / Aplicação:", 14, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(11, 66, 121);
    doc.textWithLink(prototipoLink, 14, y, { url: prototipoLink });
    y += 5.5;
  } else {
    y = drawField(doc, "Link do Protótipo / Aplicação:", "Não informado no momento da entrega", y, pageW, pageH, projectHeaderTitle, pageCounter);
  }

  // Link do Vídeo
  if (videoLink) {
    y = ensureSpace(doc, y, 8, pageW, pageH, projectHeaderTitle, pageCounter);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("Link do Vídeo Demonstrativo:", 14, y);
    y += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.textWithLink(videoLink, 14, y, { url: videoLink });
    y += 5.5;
  }

  // Arquivos Anexados
  if (arquivosLinks.length > 0) {
    y = ensureSpace(doc, y, 10, pageW, pageH, projectHeaderTitle, pageCounter);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text("Documentos e Arquivos Anexados (PDF, DOCX, Slides):", 14, y);
    y += 4.5;

    arquivosLinks.forEach((arq) => {
      y = ensureSpace(doc, y, 6.5, pageW, pageH, projectHeaderTitle, pageCounter);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 118, 110);
      doc.text(`[${arq.tipo.toUpperCase()}] ${arq.titulo}${arq.tamanho || ""}:`, 16, y);
      y += 3.8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(11, 66, 121);
      doc.textWithLink(arq.linkUrl, 20, y, { url: arq.linkUrl });
      y += 4.5;
    });
  }

  if (observacoesBanca) {
    y = drawField(doc, "Observações e Orientações Técnicas para a Banca:", observacoesBanca, y, pageW, pageH, projectHeaderTitle, pageCounter);
  }
  y += 2;

  // ──── SEÇÃO 8: GRADE DE AVALIAÇÃO DA BANCA (RUBRICA OFICIAL) ────
  y = ensureSpace(doc, y, 55, pageW, pageH, projectHeaderTitle, pageCounter);
  y = drawSectionHeader(doc, "8. Grade de Avaliação do Projeto (Banca Examinadora)", y, pageW, [14, 54, 52]);

  doc.setFillColor(250, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, y, pageW - 28, 48, 1.5, 1.5, "FD");

  // Cabeçalho da Grade
  doc.setFillColor(235, 240, 243);
  doc.rect(14, y, pageW - 28, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("CRITÉRIO DE AVALIAÇÃO (FICHA DA BANCA INOVA SAÚDE 2026)", 18, y + 4.5);
  doc.text("PESO", pageW - 55, y + 4.5, { align: "center" });
  doc.text("NOTA (1 a 5)", pageW - 25, y + 4.5, { align: "center" });

  const criterios = [
    { nome: "1. Problema (1º Critério de Desempate)", desc: "A dor é real e foi verificada com quem a vive?", peso: "Peso 2" },
    { nome: "2. Inovação", desc: "O que a solução faz de diferente do que já existe?", peso: "Peso 2" },
    { nome: "3. Viabilidade (2º Critério de Desempate)", desc: "Dá para construir e manter com recursos realistas?", peso: "Peso 2" },
    { nome: "4. Impacto", desc: "Quanto melhora a saúde de quem é atendido na região?", peso: "Peso 2" },
    { nome: "5. Protótipo e apresentação", desc: "O protótipo mostra a ideia e o pitch convence?", peso: "Peso 2" },
  ];

  let gridY = y + 6.5;
  criterios.forEach((crit) => {
    doc.setDrawColor(226, 232, 240);
    doc.line(14, gridY, pageW - 14, gridY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(crit.nome, 18, gridY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(crit.desc, 18, gridY + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(crit.peso, pageW - 55, gridY + 6, { align: "center" });

    // Caixa para preenchimento da nota
    doc.setDrawColor(148, 163, 184);
    doc.rect(pageW - 32, gridY + 2.5, 14, 5.5);

    gridY += 10;
  });

  // Linha final de nota total
  doc.setDrawColor(203, 213, 225);
  doc.line(14, gridY, pageW - 14, gridY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(14, 54, 52);
  doc.text("SOMA TOTAL (MÁXIMO 25 PONTOS — NOTAS DE 1 A 5):", 18, gridY + 5);

  doc.setDrawColor(14, 54, 52);
  doc.setLineWidth(0.6);
  doc.rect(pageW - 32, gridY + 1.5, 14, 6.5);

  // Rodapé da última página
  drawPageFooter(doc, pageW, pageH, pageCounter.current);

  // Segunda passada para atualizar total de páginas em todas
  const totalPagesCount = doc.getNumberOfPages();
  for (let p = 1; p <= totalPagesCount; p++) {
    doc.setPage(p);
    drawPageFooter(doc, pageW, pageH, p, totalPagesCount);
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/**
 * Gera o documento de índice e guia de avaliação para os 3 avaliadores
 */
export function generateEvaluationIndexPdf(
  teams: TeamRecord[],
  eventName: string = "INOVA SAÚDE 2026"
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCounter = { current: 1 };

  drawPageHeader(doc, pageW, "ÍNDICE GERAL DE PROJETOS E GUIA DA BANCA", eventName);
  let y = 26;

  // Box de Boas-vindas à Banca
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, y, pageW - 28, 30, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(3, 105, 161);
  doc.text("GUIA DE AVALIAÇÃO DA BANCA EXAMINADORA — INOVA SAÚDE 2026", 18, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const guiaIntro =
    "Como avaliar: Dê uma nota de 1 a 5 em cada critério. Use 2 e 4 para os casos entre as descrições. Os cinco critérios têm o mesmo peso (2, como no edital), então basta somar as notas: pontuação máxima 25. Todas as equipes começam do zero hoje.\n\nRegra de Ouro: Acabamento não conta. Um protótipo de papel testado com usuários vale mais que um app bonito nunca testado.\n\nCritérios de Desempate: 1º maior nota em Problema. Se continuar empatado, 2º maior nota em Viabilidade.";
  const introLines = doc.splitTextToSize(guiaIntro, pageW - 36);
  doc.text(introLines, 18, y + 12);

  y += introLines.length * 3.8 + 14;

  // Tabela com os Critérios Oficiais de Avaliação
  y = drawSectionHeader(doc, "Critérios Oficiais de Avaliação (1 a 5 — Máximo 25)", y, pageW, [3, 105, 161]);

  const criterios = [
    {
      criterio: "1. Problema (1º Critério de Desempate) — 'A dor é real e foi verificada com quem a vive?'",
      desc: "Nota 1: Problema genérico ou suposto | Nota 3: Problema claro, com algum contato com quem vive | Nota 5: Dor concreta, com evidência: conversa, dado ou observação no serviço.",
    },
    {
      criterio: "2. Inovação — 'O que a solução faz de diferente do que já existe?'",
      desc: "Nota 1: Repete o que já existe | Nota 3: Adapta algo conhecido a um contexto novo | Nota 5: Muda a forma de resolver o problema.",
    },
    {
      criterio: "3. Viabilidade (2º Critério de Desempate) — 'Dá para construir e manter com recursos realistas?'",
      desc: "Nota 1: Depende de algo fora do alcance | Nota 3: Caminho possível, mas com lacunas importantes | Nota 5: Próximo passo claro, recursos realistas e quem manteria.",
    },
    {
      criterio: "4. Impacto — 'Quanto melhora a saúde de quem é atendido na região?'",
      desc: "Nota 1: Benefício pequeno ou incerto | Nota 3: Benefício claro para um grupo definido | Nota 5: Benefício frequente, mensurável e com potencial de crescer.",
    },
    {
      criterio: "5. Protótipo e apresentação — 'O protótipo mostra a ideia e o pitch convence?'",
      desc: "Nota 1: Sem protótipo ou pitch confuso | Nota 3: Protótipo mostra parte da ideia, pitch compreensível | Nota 5: Protótipo demonstra a ideia e o pitch é claro e no tempo.",
    },
  ];

  criterios.forEach((c) => {
    y = ensureSpace(doc, y, 14, pageW, pageH, "ÍNDICE GERAL DE PROJETOS", pageCounter);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(14, 54, 52);
    doc.text(c.criterio, 16, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const dLines = doc.splitTextToSize(c.desc, pageW - 34);
    doc.text(dLines, 16, y);
    y += dLines.length * 3.8 + 2;
  });

  y += 3;

  // Tabela / Índice dos Projetos Concorrentes
  y = ensureSpace(doc, y, 20, pageW, pageH, "ÍNDICE GERAL DE PROJETOS", pageCounter);
  y = drawSectionHeader(doc, `Índice Geral de Projetos Concorrentes (${teams.length} Projetos)`, y, pageW, [14, 54, 52]);

  teams.forEach((team, idx) => {
    y = ensureSpace(doc, y, 16, pageW, pageH, "ÍNDICE GERAL DE PROJETOS", pageCounter);

    const code = `PROJ-${String(idx + 1).padStart(2, "0")}`;
    const solName = team.idear?.nome_solucao || team.teamName || `Projeto ${idx + 1}`;
    const eixo = team.definir?.eixo || "Eixo Geral de Saúde";
    const formas = (team.forma?.formas || []).map((f) => FORMAS_MAP[f] || f).join(", ") || "Em definição";

    // Item Card
    doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(14, y, pageW - 28, 14, 1, 1, "FD");

    // Badge do código
    doc.setFillColor(14, 54, 52);
    doc.roundedRect(16, y + 2.5, 18, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(code, 25, y + 6, { align: "center" });

    // Nome do Projeto
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(solName, 37, y + 6.2);

    // Eixo e formas
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Eixo: ${eixo}  |  Forma: ${formas}`, 16, y + 11.5);

    // Status do trabalho
    const hasWork = team.trabalhos && team.trabalhos.length > 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    if (hasWork) {
      doc.setTextColor(16, 185, 129);
      doc.text("● Protótipo Entregue", pageW - 18, y + 6.5, { align: "right" });
    } else {
      doc.setTextColor(245, 158, 11);
      doc.text("○ Em Desenvolvimento", pageW - 18, y + 6.5, { align: "right" });
    }

    y += 16;
  });

  // Atualiza rodapés
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, pageW, pageH, p, totalPages);
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/**
 * Empacota todas as equipes em um único arquivo ZIP com os PDFs anônimos
 */
export async function exportTeamsEvaluationZip(
  teams: TeamRecord[],
  eventName: string = "INOVA SAÚDE 2026",
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Blob> {
  const zip = new JSZip();

  // 1. Gera o índice geral e guia de avaliação
  if (onProgress) onProgress(0, teams.length, "Gerando guia e índice geral da banca...");
  const indexPdf = generateEvaluationIndexPdf(teams, eventName);
  zip.file("00_INDICE_E_GUIA_DE_AVALIACAO.pdf", indexPdf);

  // 2. Gera os PDFs individuais de cada equipe
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i]!;
    const projectCode = `Projeto_${String(i + 1).padStart(2, "0")}`;
    const cleanName = sanitizeFileName(team.idear?.nome_solucao || team.teamName || `Equipe_${i + 1}`);
    const fileName = `${projectCode}_${cleanName}.pdf`;

    if (onProgress) {
      onProgress(i + 1, teams.length, `Gerando PDF ${i + 1} de ${teams.length}: ${team.teamName || team.idear?.nome_solucao}...`);
    }

    // Pequeno yield para o loop de eventos atualizar a interface visual
    await new Promise((resolve) => setTimeout(resolve, 10));

    const teamPdf = generateAnonymousTeamPdf(team, i, eventName);
    zip.file(fileName, teamPdf);
  }

  if (onProgress) onProgress(teams.length, teams.length, "Compactando arquivo ZIP final...");

  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
