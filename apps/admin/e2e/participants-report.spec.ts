import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

// Relatório de participantes (aba Participantes): baixa o CSV e o PDF de
// verdade e confere o CONTEÚDO do arquivo, não só que o botão existe.
// Mesmas premissas dos outros specs: painel + backend reais rodando
// (ver apps/admin/e2e/README.md).

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD ?? "troque-esta-senha";

async function criarParticipante(
  page: Page,
  p: { nome: string; email?: string; telefone?: string; documento?: string; cortesia?: boolean }
) {
  await page.getByRole("button", { name: "+ Novo participante" }).click();
  await page.getByLabel("Nome").fill(p.nome);
  if (p.email) await page.getByLabel("E-mail").fill(p.email);
  if (p.telefone) await page.getByLabel("Telefone").fill(p.telefone);
  if (p.documento) await page.getByLabel("Documento").fill(p.documento);
  if (p.cortesia) await page.getByRole("switch").check();
  await page.getByRole("button", { name: "Criar participante" }).click();
  await expect(page.getByRole("cell", { name: p.nome })).toBeVisible();
}

test("baixar o relatório de participantes em CSV e PDF", async ({ page }) => {
  const eventName = `Evento E2E ${Date.now()}`;

  await test.step("login, evento e participantes (fora de ordem alfabética)", async () => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
    await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/eventos$/);

    await page.getByRole("button", { name: "+ Novo evento" }).click();
    await page.getByLabel("Nome do evento").fill(eventName);
    await page.getByLabel("Início").fill("2026-09-01T09:00");
    await page.getByLabel("Fim").fill("2026-09-03T18:00");
    await page.getByLabel("Local").fill("Centro de Convenções");
    await page.getByRole("button", { name: "Criar evento" }).click();
    await page.getByRole("link", { name: eventName }).click();
    await expect(page.getByRole("heading", { name: eventName })).toBeVisible();

    // A aba que abre por padrão é "Inscritos".
    await page.getByRole("button", { name: "Participantes", exact: true }).click();

    // Ordem de cadastro: Zélia, Bruno, Ângelo. O relatório tem que sair
    // Ângelo, Bruno, Zélia — "Â" ordena junto com "A", não depois do "Z".
    await criarParticipante(page, {
      nome: "Zélia Souza",
      email: "zelia@example.com",
      telefone: "43911112222",
      documento: "11122233344",
      cortesia: true,
    });
    await criarParticipante(page, { nome: "Bruno Dias", email: "bruno@example.com" });
    // Nome que o Excel executaria como fórmula ao abrir o CSV.
    await criarParticipante(page, { nome: "=1+1 Fórmula", email: "formula@example.com" });
    await criarParticipante(page, {
      nome: "Ângelo Costa",
      email: "angelo@example.com",
      telefone: "43999990000",
      documento: "12345678901",
    });

    const linhaBruno = page.getByRole("row", { name: /Bruno Dias/ });
    await linhaBruno.getByRole("button", { name: "Revogar" }).click();
    await expect(linhaBruno.getByText("Cancelado")).toBeVisible();
  });

  await test.step("CSV: nome do arquivo, colunas, ordem, acentos, cortesia e status", async () => {
    const botao = page.getByRole("button", { name: "Exportar CSV" });
    await expect(botao).toBeVisible({ timeout: 5000 });

    const [download] = await Promise.all([page.waitForEvent("download"), botao.click()]);
    expect(download.suggestedFilename()).toMatch(/^relatorio-participantes-evento-e2e-\d+-\d{4}-\d{2}-\d{2}\.csv$/);

    const bruto = readFileSync((await download.path())!, "utf8");
    // BOM: sem ele o Excel abre "Ângelo" como "Ã‚ngelo".
    expect(bruto.charCodeAt(0)).toBe(0xfeff);

    const linhas = bruto
      .slice(1)
      .split("\r\n")
      .map((l) => l.split(";").map((c) => c.replace(/^"|"$/g, "")));

    // Sem coluna de QR Code: o token é a "chave" de entrada da pessoa.
    expect(linhas[0]).toEqual(["Nome", "E-mail", "Telefone", "CPF", "Status", "Cortesia"]);
    // Pega: nome começando com "=" virando fórmula no Excel (injeção de CSV).
    // O apóstrofo faz o Excel tratar a célula como texto.
    expect(linhas.slice(1)).toEqual([
      ["'=1+1 Fórmula", "formula@example.com", "", "", "Ativo", "Não"],
      ["Ângelo Costa", "angelo@example.com", "(43) 99999-0000", "123.456.789-01", "Ativo", "Não"],
      ["Bruno Dias", "bruno@example.com", "", "", "Cancelado", "Não"],
      ["Zélia Souza", "zelia@example.com", "(43) 91111-2222", "111.222.333-44", "Ativo", "Sim"],
    ]);
  });

  await test.step("PDF: é um PDF de verdade, com o nome do evento e os participantes", async () => {
    const botao = page.getByRole("button", { name: "Baixar PDF" });
    await expect(botao).toBeVisible({ timeout: 5000 });

    const [download] = await Promise.all([page.waitForEvent("download"), botao.click()]);
    expect(download.suggestedFilename()).toMatch(/^relatorio-participantes-evento-e2e-\d+-\d{4}-\d{2}-\d{2}\.pdf$/);

    const pdf = readFileSync((await download.path())!);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const texto = pdf.toString("latin1");
    // O título sai em maiúsculas, como no relatório de Inscritos.
    for (const esperado of ["Ângelo Costa", "Bruno Dias", "Zélia Souza", eventName.toUpperCase()]) {
      expect(texto, `o PDF deveria conter "${esperado}"`).toContain(esperado);
    }
  });
});
