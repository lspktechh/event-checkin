/**
 * Data curta no formato do portal: DD.MM.AAAA.
 *
 * Sempre no fuso de São Paulo, e não no do aparelho: o evento acontece
 * lá, e quem abre o site de outro fuso (ou de um servidor em UTC) não
 * pode ver o dia anterior ou o seguinte.
 */
export function dataCurta(iso?: string | null): string {
  if (!iso) return "A confirmar";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "A confirmar";
  return d
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    })
    .replace(/\//g, ".");
}
