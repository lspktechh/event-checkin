export interface EventoAberto {
  slug: string;
  name: string;
  startDate?: string;
  endDate?: string;
  location?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
}

/**
 * Eventos com inscrição aberta, buscados do servidor.
 * Buscados dinamicamente do backend da VPS.
 * O COPOL fica de fora porque tem site e fluxo próprios.
 */
export async function buscarEventosAbertos(): Promise<EventoAberto[]> {
  try {
    const r = await fetch("/api/publico/eventos-abertos");
    if (!r.ok) return [];
    const corpo = await r.json();
    const lista = Array.isArray(corpo?.data) ? corpo.data : [];
    return lista
      .filter((e: any) => {
        if (!e.slug && !e.name) return false;
        const slug = (e.slug || "").toLowerCase();
        const nome = (e.name || "").toLowerCase();
        return !slug.includes("copol") && !nome.includes("copol");
      })
      .map((e: any) => ({
        slug: e.slug,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location ?? null,
        description: e.description ?? null,
        bannerUrl: e.bannerUrl ?? null,
      }));
  } catch {
    return [];
  }
}
