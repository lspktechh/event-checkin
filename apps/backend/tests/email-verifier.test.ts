import { describe, expect, it } from "vitest";
import {
  checkDomainTypo,
  checkEmailSyntax,
  normalizeEmail,
  verifyEmail,
  assertValidEmail,
} from "../src/shared/email-verifier.js";
import { ValidationError } from "../src/shared/errors.js";
import { buildApp } from "../src/app.js";

describe("Email Verifier", () => {
  describe("normalizeEmail", () => {
    it("remove espaços extras e coloca o domínio em minúsculo", () => {
      expect(normalizeEmail("  Usuario@GMAIL.COM  ")).toBe("Usuario@gmail.com");
      expect(normalizeEmail("maria.silva@Usp.BR")).toBe("maria.silva@usp.br");
    });
  });

  describe("checkEmailSyntax", () => {
    it("aprova e-mails válidos", () => {
      expect(checkEmailSyntax("usuario@gmail.com").valid).toBe(true);
      expect(checkEmailSyntax("contato.empresa@sub.dominio.com.br").valid).toBe(true);
    });

    it("reprova e-mails com sintaxe incorreta", () => {
      expect(checkEmailSyntax("").valid).toBe(false);
      expect(checkEmailSyntax("usuario").valid).toBe(false);
      expect(checkEmailSyntax("usuario@").valid).toBe(false);
      expect(checkEmailSyntax("@gmail.com").valid).toBe(false);
      expect(checkEmailSyntax("usuario com espaco@gmail.com").valid).toBe(false);
      expect(checkEmailSyntax("usuario..duplo@gmail.com").valid).toBe(false);
      expect(checkEmailSyntax("usuario@gmail..com").valid).toBe(false);
      expect(checkEmailSyntax("usuario@dominio").valid).toBe(false);
    });
  });

  describe("checkDomainTypo", () => {
    it("detecta erros clássicos de digitação do Gmail e sugere o correto", () => {
      const r1 = checkDomainTypo("gmai.com", "pedro");
      expect(r1.isTypo).toBe(true);
      expect(r1.suggestedEmail).toBe("pedro@gmail.com");

      const r2 = checkDomainTypo("gnail.com", "pedro");
      expect(r2.isTypo).toBe(true);
      expect(r2.suggestedEmail).toBe("pedro@gmail.com");

      const r3 = checkDomainTypo("gmail.com.br", "pedro");
      expect(r3.isTypo).toBe(true);
      expect(r3.suggestedEmail).toBe("pedro@gmail.com");
    });

    it("detecta erros comuns de Hotmail e Outlook", () => {
      const rHotmail = checkDomainTypo("hotmial.com", "ana");
      expect(rHotmail.isTypo).toBe(true);
      expect(rHotmail.suggestedEmail).toBe("ana@hotmail.com");

      const rOutlook = checkDomainTypo("outlok.com", "ana");
      expect(rOutlook.isTypo).toBe(true);
      expect(rOutlook.suggestedEmail).toBe("ana@outlook.com");
    });

    it("detecta terminação .con em vez de .com", () => {
      const r = checkDomainTypo("minhaempresa.con", "contato");
      expect(r.isTypo).toBe(true);
      expect(r.suggestedEmail).toBe("contato@minhaempresa.com");
    });

    it("não marca como erro domínios válidos", () => {
      expect(checkDomainTypo("gmail.com", "pedro").isTypo).toBe(false);
      expect(checkDomainTypo("hotmail.com", "pedro").isTypo).toBe(false);
      expect(checkDomainTypo("outlook.com", "pedro").isTypo).toBe(false);
      expect(checkDomainTypo("usp.br", "pedro").isTypo).toBe(false);
    });
  });

  describe("verifyEmail", () => {
    it("aprova e-mails válidos reais", async () => {
      const res = await verifyEmail("adriano@gmail.com");
      expect(res.valid).toBe(true);
      expect(res.details.hasMx).toBe(true);
    });

    it("aprova domínios de teste do ambiente test", async () => {
      const res = await verifyEmail("usuario@teste.com");
      expect(res.valid).toBe(true);
    });

    it("bloqueia e-mails descartáveis/temporários", async () => {
      const res = await verifyEmail("alguem@mailinator.com");
      expect(res.valid).toBe(false);
      expect(res.details.disposable).toBe(true);
      expect(res.reason).toContain("temporários");
    });

    it("bloqueia e sugere correção para erros de digitação", async () => {
      const res = await verifyEmail("contato@gmai.com");
      expect(res.valid).toBe(false);
      expect(res.details.typo).toBe(true);
      expect(res.suggestion).toBe("contato@gmail.com");
      expect(res.reason).toContain("Você quis dizer");
    });

    it("bloqueia domínios inexistentes que não possuem DNS/MX", async () => {
      const res = await verifyEmail("teste@dominio-certamente-inexistente-123456789.com.br");
      expect(res.valid).toBe(false);
      expect(res.details.hasMx).toBe(false);
      expect(res.reason).toContain("não existe na internet");
    });
  });

  describe("assertValidEmail", () => {
    it("retorna o e-mail normalizado quando válido", async () => {
      const normalized = await assertValidEmail("  Suporte@GMAIL.COM ");
      expect(normalized).toBe("Suporte@gmail.com");
    });

    it("lança ValidationError com mensagem clara quando inválido", async () => {
      await expect(assertValidEmail("contato@gmai.com")).rejects.toThrow(ValidationError);
      await expect(assertValidEmail("contato@mailinator.com")).rejects.toThrow(ValidationError);
      await expect(assertValidEmail("invalido@@")).rejects.toThrow(ValidationError);
    });
  });

  describe("API endpoint /verify-email", () => {
    const app = buildApp();

    it("POST /verify-email valida e-mail e retorna status 200 com resultado", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/verify-email",
        payload: { email: "usuario@teste.com" },
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
      expect(json.data.normalized).toBe("usuario@teste.com");
    });

    it("POST /verify-email detecta erro de digitação e sugere correção", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/verify-email",
        payload: { email: "usuario@gmai.com" },
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(false);
      expect(json.data.suggestion).toBe("usuario@gmail.com");
      expect(json.data.details.typo).toBe(true);
    });

    it("GET /verify-email funciona com query param", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/verify-email?email=usuario@teste.com",
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
    });
  });
});
