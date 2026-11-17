import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/database/prisma.js";
import { recordAudit, recordParticipantAudit } from "../src/modules/audit/audit.service.js";
import { PERMISSIONS } from "../src/shared/permissions.js";
import {
  createTestAdmin,
  createTestEvent,
  createTestRole,
  createTestUserWithRole,
  resetDatabase,
} from "./helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const rand = () => Math.random().toString(36).slice(2, 8);

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return res.json().data.token as string;
}

async function loginAsAdmin() {
  const { user, password } = await createTestAdmin(`admin_${rand()}@teste.com`);
  return { token: await login(user.email, password), user };
}

/** Conta com um perfil de permissões exatas; `audit` liga a auditoria desse perfil. */
async function loginWith(permissionKeys: string[], opts: { audit?: boolean; custom?: string[] } = {}) {
  const role = await createTestRole(`ROLE_${rand()}`, permissionKeys);
  if (opts.audit) await prisma.role.update({ where: { id: role.id }, data: { auditEnabled: true } });
  const { user, password } = await createTestUserWithRole(role.id, `op_${rand()}@teste.com`);
  if (opts.custom) {
    await prisma.user.update({ where: { id: user.id }, data: { useCustomPermissions: true, customPermissions: opts.custom } });
  }
  return { token: await login(user.email, password), role, user };
}

/** Uma ação que a auditoria registra: cadastrar participante. */
function cadastrarParticipante(token: string, eventId: string, name = "Fulano de Tal") {
  return app.inject({
    method: "POST",
    url: `/events/${eventId}/participants`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  });
}

const logs = () => prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } });

describe("auditoria só nos perfis marcados", () => {
  it("perfil sem a opção: a ação acontece e nada é registrado", async () => {
    // Pega: religar a auditoria para todo mundo, que é o oposto do pedido.
    const event = await createTestEvent();
    const { token } = await loginWith(["participants.create"]);

    const res = await cadastrarParticipante(token, event.id);

    expect(res.statusCode).toBe(201);
    expect(await logs()).toHaveLength(0);
  });

  it("perfil com a opção ligada: registra quem fez, o que fez e em quê", async () => {
    // Pega: gravar sem o autor, ou sem o alvo da ação.
    const event = await createTestEvent();
    const { token, user } = await loginWith(["participants.create"], { audit: true });

    const res = await cadastrarParticipante(token, event.id);

    expect(res.statusCode).toBe(201);
    const [log] = await logs();
    expect(log).toMatchObject({
      actorId: user.id,
      actorEmail: user.email,
      action: "participant.create",
      entityType: "Participant",
      entityId: res.json().data.id,
      metadata: { eventId: event.id },
    });
  });

  it("ligar e desligar pela API vale na hora, sem a pessoa entrar de novo", async () => {
    // Pega: guardar a opção no token (só mudaria no próximo login) ou em cache.
    const event = await createTestEvent();
    const admin = await loginAsAdmin();
    const { token, role } = await loginWith(["participants.create"]);
    const alterar = (auditEnabled: boolean) =>
      app.inject({
        method: "PATCH",
        url: `/roles/${role.id}`,
        headers: { authorization: `Bearer ${admin.token}` },
        payload: { auditEnabled },
      });

    await cadastrarParticipante(token, event.id, "Antes de ligar");
    const ligar = await alterar(true);
    await cadastrarParticipante(token, event.id, "Com auditoria");
    const desligar = await alterar(false);
    await cadastrarParticipante(token, event.id, "Depois de desligar");

    expect(ligar.statusCode).toBe(200);
    expect(ligar.json().data.auditEnabled).toBe(true);
    expect(desligar.json().data.auditEnabled).toBe(false);
    const participantes = await logs().then((l) => l.filter((x) => x.action === "participant.create"));
    expect(participantes).toHaveLength(1);
  });

  it("o perfil ADMINISTRADOR também pode ser marcado", async () => {
    // Pega: tratar o perfil protegido como caso à parte e impedir a opção nele.
    const event = await createTestEvent();
    const admin = await loginAsAdmin();

    const ligar = await app.inject({
      method: "PATCH",
      url: `/roles/${admin.user.roleId}`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { auditEnabled: true },
    });
    await cadastrarParticipante(admin.token, event.id);

    expect(ligar.statusCode).toBe(200);
    expect((await logs()).map((l) => l.action)).toContain("participant.create");
  });

  it("usuário com permissões personalizadas segue a opção do perfil dele", async () => {
    // Pega: ignorar a opção quando a conta usa permissões próprias.
    const event = await createTestEvent();
    const ligado = await loginWith(["events.view"], { audit: true, custom: ["participants.create"] });
    const desligado = await loginWith(["events.view"], { custom: ["participants.create"] });

    await cadastrarParticipante(desligado.token, event.id, "Sem auditoria");
    expect(await logs()).toHaveLength(0);
    await cadastrarParticipante(ligado.token, event.id, "Com auditoria");

    expect(await logs()).toHaveLength(1);
  });
});

describe("a opção nos perfis (API)", () => {
  it("vem desligada por padrão e aparece na lista", async () => {
    const admin = await loginAsAdmin();
    const criar = await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { name: "Novo Perfil" },
    });

    const lista = await app.inject({ method: "GET", url: "/roles", headers: { authorization: `Bearer ${admin.token}` } });

    expect(criar.statusCode).toBe(201);
    expect(criar.json().data.auditEnabled).toBe(false);
    const doNovo = lista.json().data.find((r: { id: string }) => r.id === criar.json().data.id);
    expect(doNovo.auditEnabled).toBe(false);
  });

  it("dá para criar o perfil já com a auditoria ligada", async () => {
    const admin = await loginAsAdmin();

    const criar = await app.inject({
      method: "POST",
      url: "/roles",
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { name: "Perfil Auditado", auditEnabled: true },
    });

    expect(criar.json().data.auditEnabled).toBe(true);
    expect((await prisma.role.findUniqueOrThrow({ where: { id: criar.json().data.id } })).auditEnabled).toBe(true);
  });

  it("só quem pode editar perfis liga a opção", async () => {
    // Pega: deixar qualquer conta com acesso a Perfis ligar ou desligar a auditoria.
    const alvo = await createTestRole("Alvo");
    const leitor = await loginWith(["roles.view"]);

    const res = await app.inject({
      method: "PATCH",
      url: `/roles/${alvo.id}`,
      headers: { authorization: `Bearer ${leitor.token}` },
      payload: { auditEnabled: true },
    });

    expect(res.statusCode).toBe(403);
    expect((await prisma.role.findUniqueOrThrow({ where: { id: alvo.id } })).auditEnabled).toBe(false);
  });

  it("valor que não é verdadeiro/falso é recusado", async () => {
    const alvo = await createTestRole("Alvo");
    const admin = await loginAsAdmin();

    const res = await app.inject({
      method: "PATCH",
      url: `/roles/${alvo.id}`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: { auditEnabled: "sim" },
    });

    expect(res.statusCode).toBe(422);
  });
});

describe("ver o registro de auditoria", () => {
  it("a permissão audit.view existe no catálogo para ser dada a um perfil", async () => {
    const admin = await loginAsAdmin();

    const res = await app.inject({ method: "GET", url: "/permissions", headers: { authorization: `Bearer ${admin.token}` } });

    expect(res.json().data.map((p: { key: string }) => p.key)).toContain("audit.view");
    // A tabela de permissões nunca perde linhas, então confere o catálogo do
    // CÓDIGO também: é dele que o banco é preenchido no boot.
    expect(PERMISSIONS.map((p) => p.key)).toContain("audit.view");
  });

  it("só lê quem tem audit.view; o mais recente vem primeiro", async () => {
    // Pega: o registro (com e-mail e ações de todo mundo) aberto para qualquer perfil.
    const event = await createTestEvent();
    const auditado = await loginWith(["participants.create"], { audit: true });
    await cadastrarParticipante(auditado.token, event.id, "Primeiro");
    await cadastrarParticipante(auditado.token, event.id, "Segundo");
    const comPermissao = await loginWith(["audit.view"]);
    const semPermissao = await loginWith(["events.view"]);
    const admin = await loginAsAdmin();
    const ler = (token: string | null) =>
      app.inject({ method: "GET", url: "/audit-logs", headers: token ? { authorization: `Bearer ${token}` } : {} });

    const a = await ler(comPermissao.token);
    const b = await ler(admin.token);

    expect(a.statusCode).toBe(200);
    expect(a.json().data).toHaveLength(2);
    expect(new Date(a.json().data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(a.json().data[1].createdAt).getTime());
    expect(b.statusCode).toBe(200);
    expect((await ler(semPermissao.token)).statusCode).toBe(403);
    expect((await ler(null)).statusCode).toBe(401);
  });
});

describe("o que a auditoria guarda", () => {
  it("a importação de participantes grava só as contagens, nunca nome nem e-mail", async () => {
    // Pega: o relatório da importação inteiro no log, com dados pessoais de terceiros.
    const event = await createTestEvent();
    const { token } = await loginWith(["participants.create"], { audit: true });
    const csv = ["nome,email,telefone,documento", "Ana Souza,ana.souza@exemplo.com,,111.222.333-44", "Bia Lima,bia.lima@exemplo.com,,555.666.777-88"].join("\n");

    const res = await app.inject({
      method: "POST",
      url: `/events/${event.id}/participants/import`,
      headers: { authorization: `Bearer ${token}` },
      payload: { csv, confirm: true },
    });

    expect(res.json().data.imported).toBe(2);
    const log = (await logs()).find((l) => l.action === "participant.import")!;
    expect(log.metadata).toMatchObject({ eventId: event.id, totalRows: 2, validCount: 2, imported: 2 });
    const texto = JSON.stringify(log.metadata);
    expect(texto).not.toMatch(/ana\.souza|bia\.lima|Ana Souza|Bia Lima|111\.222|555\.666/);
  });

  it("ações do próprio participante (sem perfil) continuam sem registro", async () => {
    // Pega: ligar a auditoria de quem não pertence a nenhum perfil.
    const req = { log: { error: vi.fn() } } as unknown as FastifyRequest;

    await recordParticipantAudit(req, "certificate.downloaded", "Certificate", null, "participante@exemplo.com");

    expect(await logs()).toHaveLength(0);
  });

  it("falha ao gravar o log não derruba a ação: não lança e avisa no log do servidor", async () => {
    // Pega: o erro de gravação subir e fazer a ação principal falhar.
    const error = vi.fn();
    const req = {
      admin: { userId: "u", email: "a@b.c", auditEnabled: true },
      log: { error },
    } as unknown as FastifyRequest;

    // Estrutura circular: não há como virar JSON, então a gravação falha de verdade.
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(recordAudit(req, "x.y", "Algo", null, circular)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    expect(await logs()).toHaveLength(0);
  });

  it("sem sessão de admin não grava nem lança", async () => {
    const req = { log: { error: vi.fn() } } as unknown as FastifyRequest;

    await expect(recordAudit(req, "x.y", "Algo")).resolves.toBeUndefined();

    expect(await logs()).toHaveLength(0);
  });
});
