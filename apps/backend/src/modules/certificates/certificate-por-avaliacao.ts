import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "../../database/prisma.js";
import { certificateLayoutSchema, resolveCertificateLayout, type CertificateLayout } from "./certificate-layout.js";

/**
 * Certificado liberado pela AVALIAÇÃO pós-evento, e não pelo check-in.
 *
 * Existe para eventos sem credenciamento presencial (ex.: INOVA SAÚDE 2026):
 * quem respondeu a avaliação (tabela event_evaluations, ver
 * modules/evaluations) com o MESMO e-mail da inscrição pode baixar o
 * certificado, e a arte/carga horária saem das horas que a avaliação
 * calculou (8 = só online, 16 = online + Demoday).
 *
 * A configuração mora em assets/certificates/certificados-por-avaliacao.json,
 * indexada pelo slug do evento — vai junto com as artes no deploy e não
 * depende de editar o banco nem é apagada quando alguém salva o
 * certificateSettings pelo painel.
 */

const currentDir = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(currentDir, "..", "..", "..", "assets", "certificates", "certificados-por-avaliacao.json");

const modeloSchema = z.object({
  templateAssetKey: z.string().trim().min(1).max(60),
  layout: certificateLayoutSchema,
});

const configSchema = z.object({
  modelos: z.record(z.string().regex(/^\d+$/), modeloSchema),
});

export type ConfigPorAvaliacao = z.infer<typeof configSchema>;

let cache: Record<string, ConfigPorAvaliacao> | null = null;

async function carregarTudo(): Promise<Record<string, ConfigPorAvaliacao>> {
  if (cache) return cache;
  const lidos: Record<string, ConfigPorAvaliacao> = {};
  try {
    const bruto = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Record<string, unknown>;
    for (const [slug, valor] of Object.entries(bruto)) {
      if (slug.startsWith("_")) continue;
      const parsed = configSchema.safeParse(valor);
      if (parsed.success) {
        lidos[slug] = parsed.data;
      } else {
        // Configuração quebrada não pode derrubar os certificados de todos
        // os eventos — só esse evento volta para a regra padrão (check-in).
        console.error(`[Certificados] Configuração por avaliação inválida para "${slug}":`, parsed.error.issues);
      }
    }
  } catch (err) {
    console.error("[Certificados] Não foi possível ler certificados-por-avaliacao.json:", err);
  }
  cache = lidos;
  return lidos;
}

/** Configuração do evento, ou null se ele usa a regra padrão (check-in). */
export async function configPorAvaliacao(event: { slug?: string | null }): Promise<ConfigPorAvaliacao | null> {
  if (!event.slug) return null;
  const tudo = await carregarTudo();
  return tudo[event.slug] ?? null;
}

/**
 * Horas da avaliação mais recente deste e-mail no evento, ou null se a
 * pessoa não respondeu. E-mail comparado sem diferenciar maiúsculas — a
 * avaliação já grava em minúsculas, a inscrição pode não gravar.
 */
export async function horasDaAvaliacao(eventId: string, email: string | null | undefined): Promise<number | null> {
  const mapa = await horasPorEmail(eventId, [email]);
  return mapa.get(normalizarEmail(email)) ?? null;
}

/** Mesma consulta em lote, para as telas do admin (evita 1 query por linha). */
export async function horasPorEmail(
  eventId: string,
  emails: (string | null | undefined)[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const normalizados = [...new Set(emails.map(normalizarEmail).filter(Boolean))];
  if (normalizados.length === 0) return mapa;
  try {
    const linhas = await prisma.$queryRawUnsafe<{ email: string; horas: number }[]>(
      `SELECT DISTINCT ON (lower(trim(email))) lower(trim(email)) AS email, horas_certificado AS horas
         FROM event_evaluations
        WHERE event_id = $1 AND lower(trim(email)) = ANY($2::text[])
        ORDER BY lower(trim(email)), created_at DESC`,
      eventId,
      normalizados,
    );
    for (const l of linhas) mapa.set(l.email, Number(l.horas));
  } catch (err) {
    // Tabela ainda não criada (nenhuma avaliação enviada) = ninguém avaliou.
    console.warn("[Certificados] Falha ao consultar avaliações:", err);
  }
  return mapa;
}

/** Arte e layout para as horas da avaliação. Lança se as horas não têm modelo. */
export function modeloParaHoras(
  config: ConfigPorAvaliacao,
  horas: number,
): { templateAssetKey: string; layout: CertificateLayout } {
  const modelo = config.modelos[String(horas)];
  if (!modelo) {
    throw new Error(`Nenhum modelo de certificado configurado para ${horas} horas`);
  }
  return { templateAssetKey: modelo.templateAssetKey, layout: resolveCertificateLayout(modelo.layout) };
}

/** E-mail no formato em que a avaliação grava (para comparar com o mapa). */
export function normalizarEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}
