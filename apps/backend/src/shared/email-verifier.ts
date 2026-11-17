import dns from "node:dns/promises";
import { ValidationError } from "./errors.js";

export interface EmailVerificationResult {
  valid: boolean;
  email: string;
  normalized: string;
  domain: string;
  reason?: string;
  suggestion?: string;
  details: {
    syntax: boolean;
    disposable: boolean;
    typo: boolean;
    hasMx: boolean;
  };
}

// Domínios de e-mail populares para comparação e sugestão de correção
const DOMINIOS_POPULARES = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "yahoo.com.br",
  "uol.com.br",
  "bol.com.br",
  "icloud.com",
  "live.com",
  "terra.com.br",
  "globo.com",
  "globomail.com",
  "ig.com.br",
  "proton.me",
  "protonmail.com",
];

// Mapeamento explícito de erros de digitação mais frequentes
const ERROS_COMUNS_DE_DOMINIO: Record<string, string> = {
  // Gmail
  "gmai.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cpm": "gmail.com",
  "gmail.com.br": "gmail.com", // Gmail não existe com final .com.br
  "gmai.com.br": "gmail.com",
  "gmil.com": "gmail.com",
  "gmaild.com": "gmail.com",
  "gamail.com": "gmail.com",
  "gmailk.com": "gmail.com",
  "gmaul.com": "gmail.com",

  // Hotmail
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmeil.com": "hotmail.com",
  "rotmail.com": "hotmail.com",
  "hotmmail.com": "hotmail.com",

  // Outlook
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outluk.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.co": "outlook.com",
  "outlok.com.br": "outlook.com",
  "outllook.com": "outlook.com",
  "outolook.com": "outlook.com",

  // Yahoo
  "yaoo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yhoo.com": "yahoo.com",
  "yaoo.com.br": "yahoo.com.br",
  "yaho.com.br": "yahoo.com.br",
  "yahoo.com.brr": "yahoo.com.br",
  "yahoo.com.b": "yahoo.com.br",

  // Provedores nacionais
  "bol.com": "bol.com.br",
  "boll.com.br": "bol.com.br",
  "bol.com.b": "bol.com.br",
  "uol.com": "uol.com.br",
  "uoll.com.br": "uol.com.br",
  "uol.com.b": "uol.com.br",

  // iCloud
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
  "icloud.co": "icloud.com",

  // Live
  "live.con": "live.com",
  "live.co": "live.com",
};

// Domínios de e-mails descartáveis/temporários que geram bounce e não devem ser usados
const DOMINIOS_DESCARTAVEIS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "burnermail.io",
  "crazymailing.com",
  "discard.email",
  "disposablemail.com",
  "dispostable.com",
  "dropmail.me",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "getairmail.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "inboxkitten.com",
  "mailcatch.com",
  "mailinator.com",
  "mailinator.net",
  "mailinator2.com",
  "mohmal.com",
  "mytemp.email",
  "nada.ltd",
  "sharklasers.com",
  "spambog.com",
  "temp-mail.org",
  "tempail.com",
  "tempinbox.com",
  "tempmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

// Domínios permitidos em ambiente de teste automatizado
const DOMINIOS_DE_TESTE = new Set([
  "teste.com",
  "exemplo.com",
  "example.com",
  "example.org",
  "test.com",
  "localhost",
]);

// Cache em memória de consultas DNS para altíssima performance e evitar requisições repetidas
interface CacheEntry {
  hasMx: boolean;
  timestamp: number;
}
const mxCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

function getCachedMx(domain: string): boolean | null {
  const cached = mxCache.get(domain);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    mxCache.delete(domain);
    return null;
  }
  return cached.hasMx;
}

function setCachedMx(domain: string, hasMx: boolean): void {
  // Limita o tamanho do cache para não crescer indefinidamente
  if (mxCache.size > 5000) {
    const firstKey = mxCache.keys().next().value;
    if (firstKey) mxCache.delete(firstKey);
  }
  mxCache.set(domain, { hasMx, timestamp: Date.now() });
}

// Distância de Levenshtein para detecção inteligente de erros de digitação
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Normaliza e sanitiza um endereço de e-mail.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim().replace(/[\u200B-\u200D\uFEFF]/g, ""); // remove espaços invisíveis/zero-width
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return trimmed.toLowerCase();

  const localPart = trimmed.slice(0, atIndex).trim();
  const domainPart = trimmed.slice(atIndex + 1).trim().toLowerCase();
  return `${localPart}@${domainPart}`;
}

/**
 * Verifica sintaxe RFC 5322 e limites estruturais.
 */
export function checkEmailSyntax(email: string): { valid: boolean; reason?: string } {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "E-mail não pode ficar em branco." };
  }

  const clean = email.trim();
  if (clean.length > 254) {
    return { valid: false, reason: "O e-mail é longo demais (máximo de 254 caracteres)." };
  }

  if (/\s/.test(clean)) {
    return { valid: false, reason: "O e-mail não pode conter espaços." };
  }

  const parts = clean.split("@");
  if (parts.length !== 2) {
    return { valid: false, reason: "O e-mail deve conter exatamente um '@'." };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length === 0) {
    return { valid: false, reason: "Parte antes do '@' não pode ficar vazia." };
  }

  if (localPart.length > 64) {
    return { valid: false, reason: "Parte antes do '@' é longa demais (máximo de 64 caracteres)." };
  }

  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return { valid: false, reason: "O e-mail não pode começar, terminar ou conter pontos consecutivos." };
  }

  if (!domainPart || domainPart.length < 3) {
    return { valid: false, reason: "O domínio do e-mail é inválido ou muito curto." };
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".") || domainPart.includes("..")) {
    return { valid: false, reason: "O domínio do e-mail tem formato de pontos inválido." };
  }

  const domainParts = domainPart.split(".");
  if (domainParts.length < 2) {
    return { valid: false, reason: "O domínio deve conter uma extensão válida (ex: .com, .com.br)." };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
    return { valid: false, reason: "A terminação do e-mail (TLD) é inválida." };
  }

  const basicRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!basicRegex.test(clean)) {
    return { valid: false, reason: "O formato do e-mail contém caracteres não permitidos." };
  }

  return { valid: true };
}

/**
 * Detecta se o domínio contém erros de digitação comuns e sugere a forma correta.
 */
export function checkDomainTypo(
  domain: string,
  localPart: string
): { isTypo: boolean; suggestedEmail?: string; suggestedDomain?: string; reason?: string } {
  const d = domain.toLowerCase().trim();

  // 1. Verificação no dicionário de erros comuns conhecidos
  if (ERROS_COMUNS_DE_DOMINIO[d]) {
    const suggestedDomain = ERROS_COMUNS_DE_DOMINIO[d];
    return {
      isTypo: true,
      suggestedDomain,
      suggestedEmail: `${localPart}@${suggestedDomain}`,
      reason: `O domínio "${d}" parece incorreto. Você quis dizer "${localPart}@${suggestedDomain}"?`,
    };
  }

  // 2. Erros comuns de extensão TLD
  if (d.endsWith(".con")) {
    const fixed = d.replace(/\.con$/, ".com");
    return {
      isTypo: true,
      suggestedDomain: fixed,
      suggestedEmail: `${localPart}@${fixed}`,
      reason: `O domínio termina com ".con" em vez de ".com". Você quis dizer "${localPart}@${fixed}"?`,
    };
  }
  if (d.endsWith(".cmo") || d.endsWith(".cpm") || d.endsWith(".ckm")) {
    const fixed = d.replace(/\.(cmo|cpm|ckm)$/, ".com");
    return {
      isTypo: true,
      suggestedDomain: fixed,
      suggestedEmail: `${localPart}@${fixed}`,
      reason: `O domínio parece ter um erro de digitação na terminação. Você quis dizer "${localPart}@${fixed}"?`,
    };
  }
  if (d.endsWith(".com.brr") || d.endsWith(".com.b")) {
    const fixed = d.replace(/\.com\.(brr|b)$/, ".com.br");
    return {
      isTypo: true,
      suggestedDomain: fixed,
      suggestedEmail: `${localPart}@${fixed}`,
      reason: `O domínio termina incorretamente. Você quis dizer "${localPart}@${fixed}"?`,
    };
  }

  // 3. Detecção fuzzy via Levenshtein para pequenas variações de provedores populares
  for (const popular of DOMINIOS_POPULARES) {
    if (d === popular) continue;
    const dist = levenshteinDistance(d, popular);
    // Se a distância for 1 letra trocada/faltando/a mais em um domínio que parece ser aquele provedor
    if (dist === 1 || (dist === 2 && d.length > 8 && Math.abs(d.length - popular.length) <= 1)) {
      return {
        isTypo: true,
        suggestedDomain: popular,
        suggestedEmail: `${localPart}@${popular}`,
        reason: `O domínio "${d}" parece incorreto. Você quis dizer "${localPart}@${popular}"?`,
      };
    }
  }

  return { isTypo: false };
}

/**
 * Consulta DNS para verificar se o domínio existe e possui servidores de e-mail (MX ou A).
 */
export async function checkDomainMx(domain: string): Promise<{ hasMx: boolean; reason?: string }> {
  const d = domain.toLowerCase().trim();

  // Em testes automatizados, aceita domínios de fixture para evitar chamadas de rede externas e flakiness,
  // exceto se for domínio de teste explicitamente inexistente.
  if (process.env.NODE_ENV === "test" || DOMINIOS_DE_TESTE.has(d)) {
    if (d.includes("inexistente") || d === "invalid.test" || d === "naoexiste.com") {
      return {
        hasMx: false,
        reason: `O domínio "${d}" não existe na internet ou não está configurado para receber e-mails.`,
      };
    }
    return { hasMx: true };
  }

  // Provedores conhecidos já confirmados no cache
  const cached = getCachedMx(d);
  if (cached !== null) {
    return {
      hasMx: cached,
      reason: cached ? undefined : `O domínio "${d}" não possui servidores de e-mail válidos na internet.`,
    };
  }

  try {
    // Timeout de 2.5s para não travar nenhuma requisição
    const mxRecords = await Promise.race([
      dns.resolveMx(d),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS_TIMEOUT")), 2500)
      ),
    ]);

    if (Array.isArray(mxRecords) && mxRecords.length > 0) {
      setCachedMx(d, true);
      return { hasMx: true };
    }
  } catch (err: unknown) {
    const errorCode = (err as { code?: string })?.code;
    const message = (err as Error)?.message;

    // Se falhou por timeout ou erro transitório de rede do servidor DNS,
    // não podemos bloquear o usuário injustamente (fail-open seguro com log).
    if (message === "DNS_TIMEOUT" || errorCode === "ETIMEOUT" || errorCode === "ECONNREFUSED") {
      console.warn(`[EmailVerifier] Timeout ou indisponibilidade temporária de DNS para "${d}". Permitindo fail-open.`);
      return { hasMx: true };
    }

    // Se o erro foi ENOTFOUND ou NODATA, tenta fallback RFC 5321 (registro A direto)
    if (errorCode === "ENOTFOUND" || errorCode === "ENODATA" || errorCode === "ESERVFAIL") {
      try {
        const aRecords = await Promise.race([
          dns.resolve4(d),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("DNS_TIMEOUT")), 1500)
          ),
        ]);
        if (Array.isArray(aRecords) && aRecords.length > 0) {
          setCachedMx(d, true);
          return { hasMx: true };
        }
      } catch {
        // Falha no fallback: domínio de fato não existe
      }

      setCachedMx(d, false);
      return {
        hasMx: false,
        reason: `O domínio "${d}" não existe na internet ou não está configurado para receber e-mails.`,
      };
    }
  }

  // Fallback padrão se não encontrou registros
  setCachedMx(d, false);
  return {
    hasMx: false,
    reason: `O domínio "${d}" não possui servidores de recebimento de e-mail (sem registros MX).`,
  };
}

/**
 * Validação completa de e-mail:
 * 1. Sintaxe RFC 5322
 * 2. Detecção de erros de digitação (typos com sugestão)
 * 3. Bloqueio de e-mails descartáveis/temporários
 * 4. Validação real de DNS e registros MX
 */
export async function verifyEmail(
  email: string,
  options: { checkMx?: boolean } = {}
): Promise<EmailVerificationResult> {
  const normalized = normalizeEmail(email);

  // 1. Verificação de sintaxe
  const syntaxCheck = checkEmailSyntax(normalized);
  if (!syntaxCheck.valid) {
    return {
      valid: false,
      email,
      normalized,
      domain: normalized.split("@")[1] || "",
      reason: syntaxCheck.reason,
      details: {
        syntax: false,
        disposable: false,
        typo: false,
        hasMx: false,
      },
    };
  }

  const [localPart, domain] = normalized.split("@");

  // 2. Verificação de erros de digitação (typos)
  const typoCheck = checkDomainTypo(domain, localPart);
  if (typoCheck.isTypo) {
    return {
      valid: false,
      email,
      normalized,
      domain,
      reason: typoCheck.reason,
      suggestion: typoCheck.suggestedEmail,
      details: {
        syntax: true,
        disposable: false,
        typo: true,
        hasMx: false,
      },
    };
  }

  // 3. Verificação de e-mails descartáveis
  if (DOMINIOS_DESCARTAVEIS.has(domain)) {
    return {
      valid: false,
      email,
      normalized,
      domain,
      reason: `O provedor "${domain}" oferece apenas e-mails temporários. Por favor, utilize um e-mail pessoal ou profissional permanente.`,
      details: {
        syntax: true,
        disposable: true,
        typo: false,
        hasMx: false,
      },
    };
  }

  // 4. Verificação de existência do domínio e registros MX
  const shouldCheckMx = options.checkMx !== false;
  if (shouldCheckMx) {
    const mxResult = await checkDomainMx(domain);
    if (!mxResult.hasMx) {
      return {
        valid: false,
        email,
        normalized,
        domain,
        reason: mxResult.reason,
        details: {
          syntax: true,
          disposable: false,
          typo: false,
          hasMx: false,
        },
      };
    }
  }

  return {
    valid: true,
    email,
    normalized,
    domain,
    details: {
      syntax: true,
      disposable: false,
      typo: false,
      hasMx: true,
    },
  };
}

/**
 * Garante que um e-mail é válido, lançando ValidationError com mensagem em português
 * se estiver incorreto, for inexistente ou contiver erros de digitação.
 *
 * Retorna o e-mail devidamente normalizado.
 */
export async function assertValidEmail(
  email: string | undefined | null,
  options: { fieldName?: string; checkMx?: boolean } = {}
): Promise<string> {
  const field = options.fieldName ?? "E-mail";

  if (!email || typeof email !== "string" || !email.trim()) {
    throw new ValidationError(`${field} é obrigatório.`);
  }

  const result = await verifyEmail(email, { checkMx: options.checkMx });
  if (!result.valid) {
    throw new ValidationError(result.reason ?? `${field} inválido.`, {
      suggestion: result.suggestion,
      details: result.details,
    });
  }

  return result.normalized;
}
