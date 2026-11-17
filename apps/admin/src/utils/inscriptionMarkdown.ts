import * as api from "../api/client";
import { formatPhone, formatDocument } from "./formatters";

/**
 * Faz parse seguro do campo JSON `notes` da inscrição.
 */
export function parseInscriptionNotes(item: api.InscriptionReportItem): any {
  if (!item.notes) return null;
  try {
    return JSON.parse(item.notes);
  } catch {
    return null;
  }
}

/**
 * Identifica se o evento possui foco em equipes (ex: INOVA SAÚDE).
 * Eventos como COPOL (Congresso Odontológico) são individuais com Hands On, sem equipes nem banco de talentos.
 */
export function isTeamEvent(eventName?: string, eventId?: string): boolean {
  if (eventId === "e7b5f120-4a81-4993-9c5e-85a265da4168") return true;
  if (eventId === "f1b36d08-e85d-459b-8606-69119ab05a78") return false;
  if (!eventName) return false;
  const lower = eventName.toLowerCase();
  return lower.includes("inova");
}

/**
 * Identifica se o participante está cadastrado SEM EQUIPE (Banco de Talentos).
 * ATENÇÃO: Banco de Talentos e Equipes pertencem EXCLUSIVAMENTE ao INOVA SAÚDE.
 * Em eventos individuais como COPOL, participantes não possuem equipe e NUNCA são do banco de talentos.
 */
export function isParticipantSemEquipe(
  item: api.InscriptionReportItem,
  eventName?: string,
  eventId?: string
): boolean {
  // Se recebemos informações do evento, verifica se é evento de equipes (ex: INOVA SAÚDE)
  if (eventName || eventId) {
    if (!isTeamEvent(eventName, eventId)) {
      return false;
    }
  }

  // Ignora submissões de trabalho / artigo
  if (item.name?.startsWith("[TRABALHO]") || item.category?.includes("Trabalho")) {
    return false;
  }
  const notes = parseInscriptionNotes(item);
  if (notes?.tipo_registro === "SUBMISSAO_TRABALHO") {
    return false;
  }

  const payload = notes?.payload_completo || notes || {};
  const trilha = payload.trilha || notes?.trilha;

  // Se não foi fornecido eventName/eventId, só consideramos banco de talentos se houver
  // marcas explícitas do fluxo do Inova Saúde (ex: trilha definida, ficha_prototipo, etc.)
  if (!eventName && !eventId) {
    const hasInovaMarkers = Boolean(
      trilha ||
      notes?.soloParaSorteio ||
      payload?.soloParaSorteio ||
      payload?.ficha_prototipo ||
      notes?.ficha_prototipo ||
      payload?.membros_detalhes
    );
    if (!hasInovaMarkers) {
      return false;
    }
  }

  if (trilha === "sem_ideia" || notes?.soloParaSorteio || payload?.soloParaSorteio) {
    return true;
  }

  const teamNameRaw =
    item.teamName?.trim() ||
    payload.equipeNome?.trim() ||
    notes?.equipeNome?.trim() ||
    notes?.teamName?.trim();

  const hasTeam = Boolean(
    teamNameRaw ||
    (item.teamMembers && item.teamMembers.length > 0) ||
    (trilha && trilha !== "sem_ideia")
  );

  return !hasTeam;
}

/**
 * Limpa e formata o telefone para o padrão do WhatsApp internacional (55 + DDD + Número).
 */
export function getCleanWhatsAppPhone(phone?: string | null): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return `55${digits}`;
}

/**
 * Gera a mensagem pré-formatada para chamar participantes no WhatsApp.
 */
export function getWhatsAppInviteMessage(item: api.InscriptionReportItem, eventName = "INOVA SAÚDE 2026"): string {
  const firstName = item.name.trim().split(" ")[0] || "Participante";
  const isTeam = isTeamEvent(eventName);

  if (!isTeam) {
    return `Olá, ${firstName}! Tudo bem? Aqui é da organização do ${eventName}.\n\nEstamos entrando em contato sobre a sua inscrição no evento. Se tiver alguma dúvida ou precisar de qualquer informação, estamos à disposição!`;
  }

  const notes = parseInscriptionNotes(item);
  const member = notes?.membros_detalhes?.[0] || notes?.payload_completo?.lider;
  const curso = member?.curso?.trim() || item.institution?.trim();

  let msg = `Olá, ${firstName}! Tudo bem? Aqui é da organização do ${eventName}. 🏥✨\n\n`;
  msg += `Vimos que você se inscreveu no evento pelo Banco de Talentos (sem equipe definida)`;
  if (curso) {
    msg += ` na área de *${curso}*`;
  }
  msg += `.\n\n`;
  msg += `Temos equipes em formação buscando pessoas com o seu perfil e suas competências! 🚀\n\n`;
  msg += `Você teria interesse em entrar em uma equipe para participar da maratona?`;

  return msg;
}

/**
 * Gera o link `https://wa.me/...` com a mensagem pré-formatada codificada.
 */
export function getWhatsAppInviteUrl(item: api.InscriptionReportItem, eventName = "INOVA SAÚDE 2026"): string | null {
  const phone = item.phone || parseInscriptionNotes(item)?.membros_detalhes?.[0]?.telefone;
  const cleanPhone = getCleanWhatsAppPhone(phone);
  if (!cleanPhone) return null;
  const message = getWhatsAppInviteMessage(item, eventName);
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Gera o Markdown completo e estruturado da ficha do participante/equipe.
 */
export function generateInscriptionMarkdown(item: api.InscriptionReportItem, eventName = "INOVA SAÚDE 2026"): string {
  const notes = parseInscriptionNotes(item);
  const payload = notes?.payload_completo || notes || {};
  const member = notes?.membros_detalhes?.[0] || payload.lider || {};
  const ficha = notes?.ficha_prototipo || payload.ficha_prototipo || {};
  const isTeam = isTeamEvent(eventName);
  const isSemEquipe = isTeam && isParticipantSemEquipe(item, eventName);
  const cleanPhone = getCleanWhatsAppPhone(item.phone || member.telefone);
  const waDirectUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : "";

  // Competências e disponibilidade
  const competencias: string[] = Array.isArray(member.competencias)
    ? member.competencias
    : Array.isArray(ficha.competencias_equipe)
      ? ficha.competencias_equipe
      : [];
  const disponibilidade: string[] = Array.isArray(member.disponibilidade) ? member.disponibilidade : [];
  const faltaNaEquipe: string[] = Array.isArray(ficha.falta_na_equipe) ? ficha.falta_na_equipe : [];

  const meioPagamento =
    item.paymentMethod === "CARD"
      ? "Cartão de Crédito"
      : item.paymentMethod === "PIX"
        ? "Pix"
        : item.isCourtesy
          ? "Cortesia (Isento)"
          : item.amount === 0
            ? "Gratuito"
            : "Manual / Não informado";

  const statusLabel =
    item.status === "CONFIRMED"
      ? "✅ Confirmada (Ativa)"
      : item.status === "CANCELLED"
        ? "❌ Cancelada"
        : "⏳ Aguardando Pagamento (Pendente)";

  const lines: string[] = [
    `# FICHA OFICIAL DE INSCRIÇÃO - ${eventName.toUpperCase()}`,
    `**Participante:** ${item.name}`,
    `**Protocolo / ID:** \`${item.id}\``,
    `**Status da Inscrição:** ${statusLabel}`,
    `**Lote / Categoria:** ${item.category}`,
    `**Valor:** R$ ${item.amount.toFixed(2).replace(".", ",")} (${meioPagamento})`,
    `**Data de Cadastro:** ${new Date(item.createdAt).toLocaleString("pt-BR")}`,
  ];

  if (isTeam) {
    lines.push(
      `**Situação no Evento:** ${isSemEquipe ? "⚠️ Banco de Talentos Individual (Sem Equipe)" : `👥 Equipe: ${item.teamName || "Equipe Registrada"}`}`
    );
  }

  lines.push(
    ``,
    `---`,
    `## 👤 1. DADOS DE CONTATO & IDENTIFICAÇÃO`,
    `- **Nome Completo:** ${item.name}`,
    `- **E-mail:** ${item.email}`,
    `- **Telefone:** ${formatPhone(item.phone || member.telefone)}`,
    waDirectUrl ? `- **WhatsApp Direto:** ${waDirectUrl}` : `- **WhatsApp:** Não informado`,
    `- **CPF:** ${formatDocument(item.document || member.cpf)}`,
    `- **Instituição / Faculdade:** ${item.institution || member.instituicao || "—"}`
  );

  if (member.curso || isTeam) {
    lines.push(`- **Curso / Área:** ${member.curso || item.institution || "—"}`);
  }
  if (member.vinculo || isTeam) {
    lines.push(`- **Vínculo:** ${member.vinculo || "—"}`);
  }

  if (isTeam) {
    lines.push(
      ``,
      `---`,
      `## 🎯 2. PERFIL NO HACKATHON & HABILIDADES`,
      `- **Modalidade:** ${isSemEquipe ? "Banco de Talentos Individual (Buscando Equipe)" : "Inscrição com Equipe"}`,
      `- **Papel de Atuação:** ${member.papel || "Não especificado"}`,
      `- **Disponibilidade Declarada:** ${disponibilidade.length > 0 ? disponibilidade.join("; ") : "Total / Sem restrição informada"}`,
      `- **Competências & Habilidades:** ${competencias.length > 0 ? competencias.join(", ") : "Nenhuma competência marcada"}`,
      ``
    );

    if (isSemEquipe) {
      lines.push(
        `---`,
        `## 💡 3. SITUAÇÃO NO BANCO DE TALENTOS`,
        `- **Status:** Sem equipe definida (Disponível para convocação e alocação)`,
        `- **Eixo Temático de Preferência:** ${ficha.eixo || payload.definir?.eixo || "Infraestrutura em Saúde Digital"}`,
        `- **Interesse em Solução:** ${ficha.funcao || "Solução inovadora para a área da saúde"}`,
        `- **Público / Usuário Alvo:** ${ficha.usuario || "Profissionais e pacientes"}`,
        `- **Dor ou Problema que Quer Resolver:** ${ficha.dor || "Ineficiência ou sobrecarga no atendimento"}`,
        `- **Habilidades que Busca em Integrantes:** ${faltaNaEquipe.length > 0 ? faltaNaEquipe.join(", ") : "Aberto a integrar equipes multidisciplinares"}`,
        `- **Disponível para Convites:** Sim (Aberto para ser contatado via WhatsApp)`
      );
    } else {
      // Equipe formada
      const teamMembers: string[] = item.teamMembers && item.teamMembers.length > 0
        ? item.teamMembers
        : (notes?.membros_detalhes || []).slice(1).map((m: any) => m.nome);

      lines.push(
        `---`,
        `## 👥 3. DADOS DA EQUIPE`,
        `- **Nome da Equipe:** ${item.teamName || payload.equipeNome || "Não informado"}`,
        `- **Líder:** ${member.nome || item.name}`,
        `- **Total de Integrantes:** ${1 + teamMembers.length}`,
        `- **Demais Integrantes:** ${teamMembers.length > 0 ? teamMembers.join(", ") : "Nenhum adicional cadastrado"}`
      );

      if (payload.idear?.nome_solucao || ficha.funcao) {
        lines.push(
          ``,
          `---`,
          `## 🚀 4. PROPOSTA DE PROJETO / SOLUÇÃO`,
          `- **Nome da Solução:** ${payload.idear?.nome_solucao || "Em definição"}`,
          `- **Eixo Temático:** ${ficha.eixo || payload.definir?.eixo || "—"}`,
          `- **Problema / Dor Alvo:** ${ficha.dor || payload.empatizar?.o_que_perde || "—"}`,
          `- **Público-Alvo:** ${ficha.usuario || payload.empatizar?.quem_vive || "—"}`,
          `- **Habilidades Faltantes na Equipe:** ${faltaNaEquipe.length > 0 ? faltaNaEquipe.join(", ") : "Equipe completa"}`
        );
      }
    }
  }

  lines.push(
    ``,
    `---`,
    `*Ficha gerada via Painel Administrativo ${eventName} em ${new Date().toLocaleString("pt-BR")}*`
  );

  return lines.join("\n");
}
