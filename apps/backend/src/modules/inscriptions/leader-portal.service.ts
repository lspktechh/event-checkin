import crypto from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/passwords.js";
import { emailService } from "../../lib/email/email.service.js";

/**
 * Resolução do evento por slug ou id
 */
async function getEventBySlugOrId(slugOrId: string) {
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(slugOrId);
  const event = await prisma.event.findFirst({
    where: isUuid ? { OR: [{ id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId },
  });
  if (!event) {
    throw new NotFoundError("Evento não encontrado");
  }
  return event;
}

/**
 * Busca a inscrição do líder da equipe pelo e-mail
 */
async function findLeaderInscription(eventId: string, rawEmail: string) {
  const emailNorm = rawEmail.trim().toLowerCase();

  // 1. Busca direta por e-mail da inscrição com equipe definida
  const ins = await prisma.inscription.findFirst({
    where: {
      eventId,
      email: { equals: emailNorm, mode: "insensitive" },
      teamName: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (ins && ins.teamName && ins.teamName.trim() !== "") {
    return ins;
  }

  // 2. Fallback: busca onde o e-mail consta como líder dentro de `notes`
  const allTeamInscriptions = await prisma.inscription.findMany({
    where: {
      eventId,
      teamName: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const item of allTeamInscriptions) {
    if (!item.teamName || item.teamName.trim() === "") continue;
    try {
      const notes = JSON.parse(item.notes || "{}");
      const liderEmail = (
        notes.payload_completo?.lider?.email ||
        notes.membros_detalhes?.[0]?.email ||
        ""
      ).trim().toLowerCase();

      if (liderEmail === emailNorm) {
        return item;
      }
    } catch {
      // Ignora erro de parse em item pontual
    }
  }

  return null;
}

export async function checkLeaderLogin(slugOrId: string, email: string) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    return {
      exists: false,
      message: "Nenhuma equipe encontrada com este e-mail de líder. Verifique se digitou o mesmo e-mail utilizado na inscrição da equipe.",
    };
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const leaderAuth = notes.leader_auth || {};
  const hasPassword = Boolean(leaderAuth.passwordHash);

  if (hasPassword) {
    return {
      exists: true,
      hasPassword: true,
      teamName: inscription.teamName,
      email: inscription.email,
      name: inscription.name,
      message: "Por favor, digite sua senha de acesso.",
    };
  }

  // Não tem senha -> Gera token mágico e envia por e-mail
  const token = crypto.randomBytes(24).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas

  notes.leader_auth = {
    ...leaderAuth,
    verifyToken: token,
    tokenExpiresAt,
    requestedAt: new Date().toISOString(),
  };

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { notes: JSON.stringify(notes) },
  });

  // Monta link de verificação
  const baseUrl = process.env.PUBLIC_SITE_URL || "https://superinteligencia.tec.br";
  const verificationUrl = `${baseUrl}/editar-inscricao?token=${token}&email=${encodeURIComponent(inscription.email)}`;

  const sendResult = await emailService.sendLeaderVerificationEmail(event, {
    to: inscription.email,
    leaderName: inscription.name,
    teamName: inscription.teamName || "Sua Equipe",
    verificationUrl,
  });

  return {
    exists: true,
    hasPassword: false,
    emailSent: sendResult.success,
    teamName: inscription.teamName,
    email: inscription.email,
    name: inscription.name,
    message: sendResult.success
      ? "Enviamos um link de verificação para o seu e-mail com instruções para criar sua senha."
      : "Link de verificação gerado. Se o e-mail não chegar em instantes, entre em contato com a organização.",
  };
}

export async function requestMagicLink(slugOrId: string, email: string) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Nenhuma equipe encontrada com este e-mail.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const token = crypto.randomBytes(24).toString("hex");
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  notes.leader_auth = {
    ...(notes.leader_auth || {}),
    verifyToken: token,
    tokenExpiresAt,
    requestedAt: new Date().toISOString(),
  };

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { notes: JSON.stringify(notes) },
  });

  const baseUrl = process.env.PUBLIC_SITE_URL || "https://superinteligencia.tec.br";
  const verificationUrl = `${baseUrl}/editar-inscricao?token=${token}&email=${encodeURIComponent(inscription.email)}`;

  const sendResult = await emailService.sendLeaderVerificationEmail(event, {
    to: inscription.email,
    leaderName: inscription.name,
    teamName: inscription.teamName || "Sua Equipe",
    verificationUrl,
  });

  return {
    success: true,
    emailSent: sendResult.success,
    teamName: inscription.teamName,
    email: inscription.email,
    message: "Enviamos um novo link de acesso para o seu e-mail.",
  };
}

export async function loginWithPassword(slugOrId: string, email: string, passwordPlain: string) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Equipe não encontrada para este e-mail.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const leaderAuth = notes.leader_auth || {};
  if (!leaderAuth.passwordHash) {
    throw new BadRequestError("Esta equipe ainda não configurou uma senha. Solicite o link de verificação por e-mail.");
  }

  const isMatch = await verifyPassword(passwordPlain, leaderAuth.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError("Senha incorreta. Verifique e tente novamente.");
  }

  // Gera token de sessão seguro
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 dias

  notes.leader_auth = {
    ...leaderAuth,
    sessionToken,
    sessionExpiresAt,
    lastLoginAt: new Date().toISOString(),
  };

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { notes: JSON.stringify(notes) },
  });

  return {
    success: true,
    sessionToken,
    inscriptionId: inscription.id,
    teamName: inscription.teamName,
    email: inscription.email,
    name: inscription.name,
    data: formatTeamData(inscription, notes),
  };
}

export async function verifyMagicLink(slugOrId: string, email: string, token: string) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Inscrição não encontrada.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const auth = notes.leader_auth || {};
  if (!auth.verifyToken || auth.verifyToken !== token) {
    throw new UnauthorizedError("Link de verificação inválido ou já utilizado.");
  }

  if (auth.tokenExpiresAt && new Date(auth.tokenExpiresAt) < new Date()) {
    throw new UnauthorizedError("O link de verificação expirou. Por favor, solicite um novo link.");
  }

  return {
    success: true,
    verified: true,
    teamName: inscription.teamName,
    email: inscription.email,
    name: inscription.name,
    hasPassword: Boolean(auth.passwordHash),
  };
}

export async function setLeaderPassword(slugOrId: string, email: string, token: string, newPasswordPlain: string) {
  if (!newPasswordPlain || newPasswordPlain.length < 6) {
    throw new BadRequestError("A senha deve ter no mínimo 6 caracteres.");
  }

  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Inscrição não encontrada.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const auth = notes.leader_auth || {};
  if (!auth.verifyToken || auth.verifyToken !== token) {
    throw new UnauthorizedError("Token de verificação inválido ou expirado.");
  }

  if (auth.tokenExpiresAt && new Date(auth.tokenExpiresAt) < new Date()) {
    throw new UnauthorizedError("O token expirou. Solicite um novo link.");
  }

  const passwordHash = await hashPassword(newPasswordPlain);
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  notes.leader_auth = {
    passwordHash,
    sessionToken,
    sessionExpiresAt,
    lastLoginAt: new Date().toISOString(),
    verifyToken: null,
    tokenExpiresAt: null,
  };

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: { notes: JSON.stringify(notes) },
  });

  return {
    success: true,
    sessionToken,
    inscriptionId: inscription.id,
    teamName: inscription.teamName,
    email: inscription.email,
    name: inscription.name,
    data: formatTeamData(inscription, notes),
  };
}

export async function getTeamDataBySession(slugOrId: string, email: string, sessionToken: string) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Inscrição não encontrada.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const auth = notes.leader_auth || {};
  if (!auth.sessionToken || auth.sessionToken !== sessionToken) {
    throw new UnauthorizedError("Sessão inválida. Por favor, faça login novamente.");
  }

  if (auth.sessionExpiresAt && new Date(auth.sessionExpiresAt) < new Date()) {
    throw new UnauthorizedError("Sessão expirada. Por favor, faça login novamente.");
  }

  return formatTeamData(inscription, notes);
}

export async function updateTeamData(
  slugOrId: string,
  email: string,
  sessionToken: string,
  newData: any,
  meta: { ip: string; userAgent?: string }
) {
  const event = await getEventBySlugOrId(slugOrId);
  const inscription = await findLeaderInscription(event.id, email);

  if (!inscription) {
    throw new NotFoundError("Inscrição não encontrada.");
  }

  let notes: any = {};
  try {
    notes = JSON.parse(inscription.notes || "{}");
  } catch {
    notes = {};
  }

  const auth = notes.leader_auth || {};
  if (!auth.sessionToken || auth.sessionToken !== sessionToken) {
    throw new UnauthorizedError("Sessão inválida. Por favor, faça login novamente.");
  }

  // Prepara histórico de auditoria
  const alteracoes: string[] = [];
  if (newData.teamName && newData.teamName.trim() !== inscription.teamName) {
    alteracoes.push(`Nome da Equipe: '${inscription.teamName}' -> '${newData.teamName.trim()}'`);
  }
  if (newData.empatizar) alteracoes.push("Etapa Empatizar (Dor e Beneficiário)");
  if (newData.definir) alteracoes.push("Etapa Definir (Problema e Eixo)");
  if (newData.idear) alteracoes.push("Etapa Idear (Solução e Passos)");
  if (newData.escopo) alteracoes.push("Etapa Escopo (É / Não É / Faz / Não Faz)");
  if (newData.fechamento) alteracoes.push("Etapa Fechamento & Métricas");
  if (newData.membros) alteracoes.push(`Composição de Integrantes (${Array.isArray(newData.membros) ? newData.membros.length : 0} pessoas)`);
  if (newData.trabalho_entregue) alteracoes.push("Artefatos / Links de Trabalho");

  const historico = notes.historico_edicoes || [];
  const logItem = {
    timestamp: new Date().toISOString(),
    ip: meta.ip,
    userAgent: meta.userAgent || "Browser",
    autor: email,
    alteracoes,
  };
  historico.unshift(logItem);

  // Mescla dados atualizados
  const updatedNotes = {
    ...notes,
    ...(newData.empatizar ? { empatizar: newData.empatizar } : {}),
    ...(newData.definir ? { definir: newData.definir } : {}),
    ...(newData.idear ? { idear: newData.idear } : {}),
    ...(newData.escopo ? { escopo: newData.escopo } : {}),
    ...(newData.fechamento ? { fechamento: newData.fechamento } : {}),
    ...(newData.trabalho_entregue ? { trabalho_entregue: newData.trabalho_entregue } : {}),
    ...(newData.membros ? { membros_detalhes: newData.membros } : {}),
    historico_edicoes: historico,
    ultima_edicao_em: new Date().toISOString(),
  };

  // Se houver alteração de nome da equipe
  const newTeamName = (newData.teamName && newData.teamName.trim()) || inscription.teamName;

  await prisma.inscription.update({
    where: { id: inscription.id },
    data: {
      teamName: newTeamName,
      notes: JSON.stringify(updatedNotes),
    },
  });

  // Grava também na tabela formal de AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: email,
        action: "leader.edit_team_data",
        entityType: "Inscription",
        entityId: inscription.id,
        metadata: {
          teamName: newTeamName,
          alteracoes,
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      },
    });
  } catch (auditErr) {
    console.warn("Aviso ao salvar AuditLog:", auditErr);
  }

  return {
    success: true,
    message: "Dados da equipe atualizados com sucesso!",
    data: formatTeamData(
      { ...inscription, teamName: newTeamName },
      updatedNotes
    ),
  };
}

function formatTeamData(inscription: any, notes: any) {
  return {
    id: inscription.id,
    teamName: inscription.teamName,
    liderNome: inscription.name,
    liderEmail: inscription.email,
    liderTelefone: inscription.phone,
    membros: notes.membros_detalhes || notes.payload_completo?.membros || [],
    empatizar: notes.empatizar || {},
    definir: notes.definir || {},
    idear: notes.idear || {},
    escopo: notes.escopo || {},
    fechamento: notes.fechamento || {},
    ficha_prototipo: notes.ficha_prototipo || {},
    trabalho_entregue: notes.trabalho_entregue || {},
    historico_edicoes: notes.historico_edicoes || [],
  };
}
