import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { createTestEvent, resetDatabase } from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function eventoComInscricaoGratuita() {
  const evento = await prisma.event.create({
    data: {
      name: "Congresso Inova 2026",
      slug: "inova-2026",
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });
  await prisma.eventBatch.create({
    data: {
      eventId: evento.id,
      batchNumber: 1,
      name: "Inscrição gratuita",
      price: 0,
      isActive: true,
    },
  });
  return evento;
}

describe("Banco de Talentos e cancelamento público de inscrição", () => {
  it("lista equipes com vagas e candidatos solo separados corretamente", async () => {
    const evento = await eventoComInscricaoGratuita();

    // 1. Criar inscrição em equipe (ex: Ecosorriso)
    const resEquipe = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: {
        name: "Monique Fernandes",
        email: "monique@teste.com",
        document: "11122233344",
        phone: "43999991111",
        teamName: "Ecosorriso",
        teamMembers: ["Glenda Ponciano", "Mirela Aparecida"],
        consentVersion: "1.0",
        notes: JSON.stringify({
          trilha: "equipe_com_ideia",
          equipeNome: "Ecosorriso",
          ficha_prototipo: {
            funcao: "Ecoponto para escovas dentais",
            eixo: "Logística",
            competencias_equipe: ["odontologia"],
            falta_na_equipe: ["CAD", "Design"],
          },
          fechamento: {
            aberta_a_novos: true,
          },
        }),
      },
    });
    expect(resEquipe.statusCode).toBe(201);

    // 2. Criar inscrição solo (candidato)
    const resSolo = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: {
        name: "Carlos Desenvolvedor",
        email: "carlos@teste.com",
        document: "55566677788",
        phone: "43999992222",
        soloParaSorteio: true,
        consentVersion: "1.0",
        notes: JSON.stringify({
          trilha: "sem_ideia",
          lider: {
            nome: "Carlos Desenvolvedor",
            competencias: ["frontend", "backend"],
            papel: "Construir software",
            curso: "Engenharia de Software",
            vinculo: "Aluno",
            bio: "Quero somar com código",
          },
        }),
      },
    });
    expect(resSolo.statusCode).toBe(201);

    // 3. Consultar Banco de Talentos pelo slug do evento
    const resTalent = await app.inject({
      method: "GET",
      url: `/public/events/${evento.slug}/talent-pool`,
    });
    expect(resTalent.statusCode).toBe(200);
    const data = resTalent.json().data;

    expect(data.equipes).toHaveLength(1);
    expect(data.equipes[0].nome).toBe("Ecosorriso");
    expect(data.equipes[0].ideia).toBe("Ecoponto para escovas dentais");
    expect(data.equipes[0].totalMembros).toBe(3); // Monique + Glenda + Mirela
    expect(data.equipes[0].membros).toContain("Glenda Ponciano");
    expect(data.equipes[0].membros).toContain("Mirela Aparecida");

    expect(data.candidatos).toHaveLength(1);
    expect(data.candidatos[0].nome).toBe("Carlos Desenvolvedor");
    expect(data.candidatos[0].competencias).toContain("frontend");
  });

  it("permite cancelar inscrição criada por engano validando o e-mail do titular", async () => {
    const evento = await eventoComInscricaoGratuita();

    const resInsc = await app.inject({
      method: "POST",
      url: `/events/${evento.id}/inscriptions`,
      payload: {
        name: "Usuario Engano",
        email: "engano@teste.com",
        document: "99988877766",
        phone: "43999993333",
        teamName: "Grupo Criado Sem Querer",
        consentVersion: "1.0",
      },
    });
    const inscId = resInsc.json().data.id;

    // Tentativa com e-mail incorreto deve falhar
    const resErr = await app.inject({
      method: "POST",
      url: `/public/events/${evento.slug}/inscriptions/${inscId}/cancel`,
      payload: { email: "outro@teste.com" },
    });
    expect(resErr.statusCode).toBe(403);

    // Com e-mail correto deve suceder e excluir
    const resOk = await app.inject({
      method: "POST",
      url: `/public/events/${evento.slug}/inscriptions/${inscId}/cancel`,
      payload: { email: "engano@teste.com" },
    });
    expect(resOk.statusCode).toBe(200);

    // Verifica que sumiu do banco de talentos
    const resTalent = await app.inject({
      method: "GET",
      url: `/public/events/${evento.slug}/talent-pool`,
    });
    expect(resTalent.json().data.equipes).toHaveLength(0);
  });
});
