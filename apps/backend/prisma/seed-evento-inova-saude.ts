import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Configura o evento INOVA SAÚDE 2026 para receber inscrições e credenciamento.
 *
 * Cria ou atualiza o evento:
 *   1. Define slug "inova-saude-2026";
 *   2. Define datas oficiais: Inscrições de 17/10 a 23/10, evento de 31/10 (Oficina) a 05/11 (Pitch Final);
 *   3. Cria e ativa o lote gratuito "Inscrição Gratuita" (R$ 0,00);
 *   4. Define o siteContent com os eixos temáticos e marcas oficiais;
 *   5. Habilita os módulos inscription, checkin e certificate.
 *
 * Idempotente: pode ser rodado múltiplas vezes sem duplicar dados.
 *
 * Execução: `npm run seed:inova-saude --workspace=apps/backend`
 */

const prisma = new PrismaClient();

const SLUG = "inova-saude-2026";
const NOME = "INOVA SAÚDE 2026";
const LOTE_GRATUITO = "Inscrição Gratuita";

const CONTEUDO_DO_SITE = {
  tema: {
    primaria: "#0B4279",
    primaria2: "#316195",
    primariaFundo: "#072F56",
    acento: "#F8C412",
    acao: "#0B8161",
    espectro: ["#F8C412", "#B9CC0D", "#259E38", "#33A2A4", "#0B8161", "#5A3088"],
  },
  heroBadge: "2ª edição · Londrina",
  heroTitulo: "INOVA SAÚDE 2026",
  heroSubtitulo: "Transforme uma dor real da saúde em solução.",
  heroTexto:
    "Equipes de 3 a 6 pessoas, de qualquer curso. Você traz o problema que viu acontecer; a gente ajuda a transformar em projeto até o Pitch Final.",
  local: "Universidade Positivo — Campus Londrina",
  cargaHoraria: "20 horas de atividades complementares",
  eixosTematicos: [
    "Infraestrutura em Saúde Digital",
    "Saúde Mental e Bem-Estar",
    "Logística e Gestão de Serviços de Saúde",
    "Capacitação e Formação Profissional",
    "Sustentabilidade e Responsabilidade Digital",
  ],
  equipe: {
    tamanhoMin: 3,
    tamanhoMax: 6,
  },
  datas: {
    inscricoesAbertura: "2026-10-17T00:00:00.000Z",
    inscricoesEncerramento: "2026-10-23T23:59:59.000Z",
    oficina: "2026-10-31T09:30:00.000Z",
    avaliacaoClassificatoria: "2026-11-03T23:59:59.000Z",
    pitchFinal: "2026-11-05T19:00:00.000Z",
  },
  marcas: {
    realizacao: ["Instituto Cruzeiro do Sul", "ecohub", "Universidade Positivo"],
    apoioFinanceiro: ["Fundação Araucária", "Governo do Paraná e SETI"],
    fraseApoio:
      "Realização: Instituto Cruzeiro do Sul, com o ecohub Londrina, em parceria com a Universidade Positivo, nos termos do Termo de Cooperação Técnico-Científica. Apoio: Instituto Cruzeiro do Sul, Fundação Araucária e Secretaria de Ciência, Tecnologia e Ensino Superior do Paraná.",
  },
};

async function main() {
  let evento = await prisma.event.findFirst({
    where: {
      OR: [
        { slug: SLUG },
        { slug: "inova-saude" },
        { name: { contains: "INOVA SA", mode: "insensitive" } },
      ],
    },
  });

  const startDate = new Date("2026-10-31T09:30:00.000Z");
  const endDate = new Date("2026-11-05T22:00:00.000Z");
  const registrationDeadline = new Date("2026-10-23T23:59:59.000Z");

  if (!evento) {
    evento = await prisma.event.create({
      data: {
        name: NOME,
        slug: SLUG,
        description: "Hackathon / Maratona de Inovação em Saúde - Edição 2026",
        location: "Universidade Positivo — Londrina",
        startDate,
        endDate,
        registrationDeadline,
        status: "ACTIVE",
        visibility: "PUBLIC",
        siteContent: CONTEUDO_DO_SITE,
      },
    });
    console.log(`✓ Evento criado: ${evento.name} (${evento.id}) com slug ${SLUG}`);
  } else {
    evento = await prisma.event.update({
      where: { id: evento.id },
      data: {
        name: NOME,
        slug: SLUG,
        startDate,
        endDate,
        registrationDeadline,
        registrationsClosedAt: null, // garante inscrições abertas
        status: "ACTIVE",
        visibility: "PUBLIC",
        siteContent: CONTEUDO_DO_SITE,
      },
    });
    console.log(`✓ Evento atualizado: ${evento.name} (${evento.id}) com slug ${SLUG}`);
  }

  // Lote gratuito e ativo
  const loteGratuito = await prisma.eventBatch.findFirst({
    where: { eventId: evento.id, price: 0 },
  });

  if (!loteGratuito) {
    await prisma.eventBatch.create({
      data: {
        eventId: evento.id,
        batchNumber: 1,
        name: LOTE_GRATUITO,
        price: 0,
        isActive: true,
        isClosed: false,
      },
    });
    console.log(`✓ Lote gratuito criado e ativado: ${LOTE_GRATUITO}`);
  } else {
    await prisma.eventBatch.update({
      where: { id: loteGratuito.id },
      data: { isActive: true, isClosed: false, name: LOTE_GRATUITO },
    });
    console.log(`✓ Lote gratuito existente confirmado e ativado`);
  }

  // Módulos do evento
  for (const modulo of ["inscription", "checkin", "certificate"]) {
    await prisma.eventModule.upsert({
      where: { eventId_module: { eventId: evento.id, module: modulo } },
      create: { eventId: evento.id, module: modulo, enabledBy: null },
      update: {},
    });
  }
  console.log(`✓ Módulos inscription, checkin e certificate habilitados`);

  console.log(`\nConfiguração concluída com sucesso para o INOVA SAÚDE 2026!`);
  console.log(`Event ID: ${evento.id}`);
  console.log(`Slug: ${SLUG}`);
}

main()
  .catch((e) => {
    console.error("Falha ao configurar INOVA SAÚDE 2026:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
