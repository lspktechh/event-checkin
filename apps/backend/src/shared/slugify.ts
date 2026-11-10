/**
 * Transforma uma string arbitrária em um slug seguro para URLs.
 * Remove acentuação, caracteres especiais e espaços múltiplos.
 * Exemplo: "Mercado de Sales Force 2026!" -> "mercado-de-sales-force-2026"
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
