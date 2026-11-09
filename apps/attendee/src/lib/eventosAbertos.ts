export interface EventoAberto {
  slug: string;
  name: string;
  startDate?: string;
}

/**
 * Eventos com inscrição aberta, buscados do servidor.
 *
 * Buscados, e não cravados no código: um evento novo aparece sozinho.
 * O COPOL fica de fora porque tem site e inscrição próprios.
 */
export async function buscarEventosAbertos(): Promise<EventoAberto[]> {
  const r = await fetch("/api/publico/eventos-abertos");
  const corpo = await r.json();
  const lista: EventoAberto[] = Array.isArray(corpo?.data) ? corpo.data : [];
  return lista
    .filter((e) => {
      if (!e.slug) return false;
      const slug = e.slug.toLowerCase();
      const nome = (e.name || "").toLowerCase();
      return !slug.includes("copol") && !nome.includes("copol");
    })
    .map((e) => ({ slug: e.slug, name: e.name, startDate: e.startDate }));
}
