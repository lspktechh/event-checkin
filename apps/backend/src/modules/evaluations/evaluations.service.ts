import crypto from "crypto";
import { prisma } from "../../database/prisma.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../../shared/errors.js";
import { generateQrToken } from "../../shared/tokens.js";
import { env } from "../../config/env.js";

const ADMIN_EMAIL = "admin@inova.com.br";
const ADMIN_PASSWORD = "admin26";

// Sessão do admin das avaliações: token ASSINADO (HMAC com JWT_SECRET), sem
// estado no servidor. Antes ficava num Map em memória e todo deploy/reinício
// derrubava a sessão — o painel do INOVA mostrava "[object Object]" e 0 respostas.
const ADMIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_TOKEN_PREFIX = "inova-adm";

function signAdminToken(expiresAt: number): string {
  const sig = crypto.createHmac("sha256", env.JWT_SECRET).update(`${ADMIN_TOKEN_PREFIX}:${expiresAt}`).digest("hex");
  return `${ADMIN_TOKEN_PREFIX}.${expiresAt}.${sig}`;
}

let tableInitialized = false;

export async function ensureEvaluationsTable() {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS event_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id VARCHAR(100) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        curso_periodo VARCHAR(255) NOT NULL,
        nps INT NOT NULL,
        o_que_ajudou TEXT[] DEFAULT '{}',
        mentoria_nota VARCHAR(50) NOT NULL,
        aprendizado TEXT NOT NULL,
        mudancas TEXT,
        continuar_ecohub VARCHAR(100) NOT NULL,
        depoimento TEXT NOT NULL,
        autoriza_depoimento VARCHAR(100) NOT NULL,
        esteve_demoday BOOLEAN NOT NULL DEFAULT false,
        papel_demoday VARCHAR(50),
        demoday_organizacao INT,
        demoday_horario INT,
        demoday_feedback_banca INT,
        demoday_apresentacao TEXT,
        demoday_gravar_video VARCHAR(10),
        horas_certificado INT NOT NULL DEFAULT 8,
        respostas JSONB NOT NULL DEFAULT '{}',
        meta JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    // Um comando por chamada: o Postgres recusa vários comandos num
    // prepared statement ("cannot insert multiple commands"), e o erro
    // era engolido abaixo — a tabela nunca era criada num banco novo.
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_evaluations_event_id ON event_evaluations(event_id)`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS idx_evaluations_email ON event_evaluations(email)`
    );
    tableInitialized = true;
  } catch (err) {
    console.error("Erro ao inicializar tabela event_evaluations:", err);
  }
}

/**
 * Garante que quem respondeu a avaliação é participante do evento.
 *
 * O portal (lspkeventos.com.br) encontra o evento e libera o certificado a
 * partir do PARTICIPANTE com aquele e-mail. Quem não se inscreveu antes (ou
 * se inscreveu com outro e-mail) respondia a avaliação e não via o evento
 * nem o certificado. Idempotente: se já existe participante com o e-mail
 * (sem diferenciar maiúsculas), não cria outro. Devolve true se criou.
 */
export async function ensureParticipantForEvaluation(eventId: string, nome: string, email: string): Promise<boolean> {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return false;

  const existing = await prisma.participant.findFirst({
    where: { eventId, email: { equals: cleanEmail, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.participant.create({
    data: {
      eventId,
      name: (nome || "").trim() || cleanEmail,
      email: cleanEmail,
      qrToken: generateQrToken(),
      status: "ACTIVE",
    },
  });
  return true;
}

/**
 * Cadastra como participante todo mundo que já respondeu alguma avaliação e
 * ainda não é participante do evento. Roda na subida do backend (server.ts):
 * corrige quem avaliou antes de existir o cadastro automático. Idempotente.
 */
export async function syncParticipantsFromEvaluations(): Promise<number> {
  await ensureEvaluationsTable();
  let rows: { event_id: string; nome: string; email: string }[] = [];
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (event_id, lower(trim(email))) event_id, nome, lower(trim(email)) AS email
         FROM event_evaluations
        ORDER BY event_id, lower(trim(email)), created_at DESC`
    );
  } catch (err) {
    console.error("[Avaliações] Falha ao listar avaliações para sincronizar participantes:", err);
    return 0;
  }

  let created = 0;
  for (const row of rows) {
    try {
      const eventExists = await prisma.event.findUnique({ where: { id: row.event_id }, select: { id: true } });
      if (!eventExists) continue;
      if (await ensureParticipantForEvaluation(row.event_id, row.nome, row.email)) created++;
    } catch (err) {
      console.error(`[Avaliações] Falha ao cadastrar participante (${row.event_id}):`, err);
    }
  }
  return created;
}

async function getEventBySlugOrId(slugOrId: string) {
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(slugOrId);
  const event = await prisma.event.findFirst({
    where: isUuid ? { OR: [{ id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId },
  });
  if (!event) {
    throw new NotFoundError("Evento não encontrado.");
  }
  return event;
}

export interface EvaluationInput {
  nome: string;
  email: string;
  cursoPeriodo: string;
  nps: number;
  oQueAjudou: string[];
  mentoriaNota: string;
  aprendizado: string;
  mudancas?: string;
  continuarEcohub: string;
  depoimento: string;
  autorizaDepoimento: string;
  esteveDemoday: boolean;
  papelDemoday?: string;
  demodayOrganizacao?: number;
  demodayHorario?: number;
  demodayFeedbackBanca?: number;
  demodayApresentacao?: string;
  demodayGravarVideo?: string;
}

export async function submitEvaluation(
  slugOrId: string,
  data: EvaluationInput,
  meta: { ip: string; userAgent?: string }
) {
  await ensureEvaluationsTable();
  const event = await getEventBySlugOrId(slugOrId);

  if (!data.nome || !data.nome.trim()) {
    throw new BadRequestError("O nome completo é obrigatório.");
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new BadRequestError("E-mail inválido.");
  }
  if (!data.cursoPeriodo || !data.cursoPeriodo.trim()) {
    throw new BadRequestError("Curso e período são obrigatórios.");
  }
  if (typeof data.nps !== "number" || data.nps < 0 || data.nps > 10) {
    throw new BadRequestError("A nota de recomendação (NPS) deve ser de 0 a 10.");
  }
  if (!Array.isArray(data.oQueAjudou) || data.oQueAjudou.length === 0) {
    throw new BadRequestError("Selecione o que mais ajudou sua equipe.");
  }
  if (data.oQueAjudou.length > 3) {
    throw new BadRequestError("Você pode selecionar no máximo 3 opções em 'O que mais ajudou'.");
  }
  if (!data.mentoriaNota) {
    throw new BadRequestError("Avaliação da mentoria é obrigatória.");
  }
  if (!data.aprendizado || !data.aprendizado.trim()) {
    throw new BadRequestError("Conte o que aprendeu que não aprenderia em sala.");
  }
  if (!data.continuarEcohub) {
    throw new BadRequestError("Indique se deseja continuar com a ideia no ecohub.");
  }
  if (!data.depoimento || !data.depoimento.trim()) {
    throw new BadRequestError("O depoimento é obrigatório.");
  }
  if (!data.autorizaDepoimento) {
    throw new BadRequestError("A autorização de uso do depoimento é obrigatória.");
  }

  const esteveDemoday = Boolean(data.esteveDemoday);
  const horasCertificado = esteveDemoday ? 16 : 8;

  let demodayOrg: number | null = null;
  let demodayHor: number | null = null;
  let demodayBanca: number | null = null;

  if (esteveDemoday) {
    if (!data.papelDemoday) {
      throw new BadRequestError("Informe se estava em equipe finalista ou na plateia do Demoday.");
    }
    if (data.demodayOrganizacao) demodayOrg = Number(data.demodayOrganizacao);
    if (data.demodayHorario) demodayHor = Number(data.demodayHorario);
    if (data.demodayFeedbackBanca) demodayBanca = Number(data.demodayFeedbackBanca);
    if (!data.demodayApresentacao || !data.demodayApresentacao.trim()) {
      throw new BadRequestError("Informe qual apresentação mais chamou sua atenção no Demoday.");
    }
    if (!data.demodayGravarVideo) {
      throw new BadRequestError("Informe se topa gravar vídeo de 30 segundos.");
    }
  }

  const cleanEmail = data.email.trim().toLowerCase();
  const cleanNome = data.nome.trim();

  const id = crypto.randomUUID();
  const respostasJson = JSON.stringify(data);
  const metaJson = JSON.stringify(meta);

  await prisma.$executeRawUnsafe(
    `INSERT INTO event_evaluations (
      id, event_id, nome, email, curso_periodo, nps, o_que_ajudou,
      mentoria_nota, aprendizado, mudancas, continuar_ecohub, depoimento,
      autoriza_depoimento, esteve_demoday, papel_demoday, demoday_organizacao,
      demoday_horario, demoday_feedback_banca, demoday_apresentacao, demoday_gravar_video,
      horas_certificado, respostas, meta, created_at, updated_at
    ) VALUES (
      $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb, NOW(), NOW()
    )`,
    id,
    event.id,
    cleanNome,
    cleanEmail,
    data.cursoPeriodo.trim(),
    data.nps,
    data.oQueAjudou,
    data.mentoriaNota,
    data.aprendizado.trim(),
    data.mudancas?.trim() || null,
    data.continuarEcohub,
    data.depoimento.trim(),
    data.autorizaDepoimento,
    esteveDemoday,
    data.papelDemoday || null,
    demodayOrg,
    demodayHor,
    demodayBanca,
    data.demodayApresentacao?.trim() || null,
    data.demodayGravarVideo || null,
    horasCertificado,
    respostasJson,
    metaJson
  );

  // Quem avaliou vira participante do evento (se ainda não for), para o
  // evento e o certificado aparecerem no portal ao consultar pelo e-mail.
  // A avaliação já está salva: uma falha aqui é recuperada na próxima
  // subida do backend (syncParticipantsFromEvaluations), não perde nada.
  try {
    await ensureParticipantForEvaluation(event.id, cleanNome, cleanEmail);
  } catch (err) {
    console.error("[Avaliações] Avaliação salva, mas falhou ao cadastrar o participante:", err);
  }

  return {
    id,
    nome: cleanNome,
    email: cleanEmail,
    horasCertificado,
    esteveDemoday,
    message: "Avaliação registrada com sucesso!",
  };
}

export async function adminLogin(emailInput: string, passwordInput: string) {
  const email = (emailInput || "").trim().toLowerCase();
  const password = (passwordInput || "").trim();

  if (email !== ADMIN_EMAIL.toLowerCase() || password !== ADMIN_PASSWORD) {
    throw new UnauthorizedError("Credenciais inválidas. Verifique o e-mail e senha.");
  }

  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS; // 7 dias
  const token = signAdminToken(expiresAt);

  return {
    token,
    email: ADMIN_EMAIL,
    role: "ADMIN",
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function verifyAdminToken(token?: string): boolean {
  if (!token) return false;
  const clean = token.replace(/^Bearer\s+/i, "").trim();

  const parts = clean.split(".");
  if (parts.length !== 3 || parts[0] !== ADMIN_TOKEN_PREFIX) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expected = Buffer.from(signAdminToken(expiresAt));
  const given = Buffer.from(clean);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export async function getEvaluationsReport(slugOrId: string, token?: string) {
  if (!verifyAdminToken(token)) {
    throw new UnauthorizedError("Acesso não autorizado. Faça login como administrador.");
  }

  await ensureEvaluationsTable();
  const event = await getEventBySlugOrId(slugOrId);

  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM event_evaluations WHERE event_id = $1 ORDER BY created_at DESC`,
    event.id
  );

  const total = rows.length;
  let somaNps = 0;
  let promotores = 0;
  let neutros = 0;
  let detratores = 0;
  let horas8h = 0;
  let horas16h = 0;
  let demodayTotal = 0;
  let somaDemodayOrg = 0;
  let countDemodayOrg = 0;
  let somaDemodayHor = 0;
  let countDemodayHor = 0;
  let somaDemodayBanca = 0;
  let countDemodayBanca = 0;
  let continuarPreIncubadora = 0;
  let continuarMaker = 0;
  let continuarNaoAgora = 0;
  let gravarVideoSim = 0;
  let gravarVideoNao = 0;
  const oQueAjudouCount: Record<string, number> = {};

  const itens = rows.map((r) => {
    const nps = Number(r.nps);
    somaNps += nps;
    if (nps >= 9) promotores++;
    else if (nps >= 7) neutros++;
    else detratores++;

    const horas = Number(r.horas_certificado);
    if (horas === 16) horas16h++;
    else horas8h++;

    if (r.esteve_demoday) {
      demodayTotal++;
      if (r.demoday_organizacao) {
        somaDemodayOrg += Number(r.demoday_organizacao);
        countDemodayOrg++;
      }
      if (r.demoday_horario) {
        somaDemodayHor += Number(r.demoday_horario);
        countDemodayHor++;
      }
      if (r.demoday_feedback_banca) {
        somaDemodayBanca += Number(r.demoday_feedback_banca);
        countDemodayBanca++;
      }
      if (r.demoday_gravar_video === "Sim") gravarVideoSim++;
      else if (r.demoday_gravar_video === "Não") gravarVideoNao++;
    }

    const eco = (r.continuar_ecohub || "").toLowerCase();
    if (eco.includes("pré-incubadora") || eco.includes("incubadora")) continuarPreIncubadora++;
    else if (eco.includes("maker")) continuarMaker++;
    else continuarNaoAgora++;

    if (Array.isArray(r.o_que_ajudou)) {
      for (const opt of r.o_que_ajudou) {
        oQueAjudouCount[opt] = (oQueAjudouCount[opt] || 0) + 1;
      }
    }

    return {
      id: r.id,
      nome: r.nome,
      email: r.email,
      cursoPeriodo: r.curso_periodo,
      nps: Number(r.nps),
      oQueAjudou: r.o_que_ajudou || [],
      mentoriaNota: r.mentoria_nota,
      aprendizado: r.aprendizado,
      mudancas: r.mudancas,
      continuarEcohub: r.continuar_ecohub,
      depoimento: r.depoimento,
      autorizaDepoimento: r.autoriza_depoimento,
      esteveDemoday: Boolean(r.esteve_demoday),
      papelDemoday: r.papel_demoday,
      demodayOrganizacao: r.demoday_organizacao ? Number(r.demoday_organizacao) : null,
      demodayHorario: r.demoday_horario ? Number(r.demoday_horario) : null,
      demodayFeedbackBanca: r.demoday_feedback_banca ? Number(r.demoday_feedback_banca) : null,
      demodayApresentacao: r.demoday_apresentacao,
      demodayGravarVideo: r.demoday_gravar_video,
      horasCertificado: Number(r.horas_certificado),
      createdAt: r.created_at,
    };
  });

  const npsMedio = total > 0 ? Number((somaNps / total).toFixed(1)) : 0;
  const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0;

  return {
    evento: {
      id: event.id,
      nome: event.name,
      slug: event.slug,
    },
    metricas: {
      total,
      npsMedio,
      npsScore,
      npsDistribuicao: {
        promotores,
        neutros,
        detratores,
      },
      horasCertificados: {
        horas8h,
        horas16h,
      },
      demoday: {
        totalPresentes: demodayTotal,
        mediaOrganizacao: countDemodayOrg > 0 ? Number((somaDemodayOrg / countDemodayOrg).toFixed(1)) : null,
        mediaHorario: countDemodayHor > 0 ? Number((somaDemodayHor / countDemodayHor).toFixed(1)) : null,
        mediaFeedbackBanca: countDemodayBanca > 0 ? Number((somaDemodayBanca / countDemodayBanca).toFixed(1)) : null,
        gravarVideoSim,
        gravarVideoNao,
      },
      continuarEcohub: {
        preIncubadora: continuarPreIncubadora,
        espacoMaker: continuarMaker,
        naoAgora: continuarNaoAgora,
      },
      oQueAjudouRanking: Object.entries(oQueAjudouCount)
        .map(([opcao, contagem]) => ({ opcao, contagem }))
        .sort((a, b) => b.contagem - a.contagem),
    },
    itens,
  };
}

export async function deleteEvaluation(slugOrId: string, id: string, token?: string) {
  if (!verifyAdminToken(token)) {
    throw new UnauthorizedError("Acesso não autorizado.");
  }
  await ensureEvaluationsTable();
  const event = await getEventBySlugOrId(slugOrId);

  await prisma.$executeRawUnsafe(
    `DELETE FROM event_evaluations WHERE id = $1::uuid AND event_id = $2`,
    id,
    event.id
  );

  return { success: true, message: "Avaliação removida com sucesso." };
}
