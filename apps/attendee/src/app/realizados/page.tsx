"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dataCurta } from "@/lib/datas";
import { PortalShell } from "@/components/portal/PortalShell";
import { Seta } from "@/components/portal/Seta";
import estilos from "@/components/portal/portal.module.css";

export const dynamic = "force-dynamic";

interface EventoRealizado {
  slug: string | null;
  name: string;
  location: string | null;
  startDate: string;
}

/**
 * Eventos que já aconteceram.
 *
 * Quem decide o que aparece aqui é o organizador, no painel: o evento
 * precisa estar Encerrado e marcado para o site. O portal só mostra o que
 * o servidor devolve.
 */
export default function RealizadosPage() {
  const [eventos, setEventos] = useState<EventoRealizado[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    fetch("/api/publico/eventos-realizados")
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok) throw new Error("falha");
        setEventos(Array.isArray(corpo?.data) ? corpo.data : []);
      })
      .catch(() => setFalhou(true));
  }, []);

  return (
    <PortalShell aba="realizados" larga>
      <section>
        <h1 className={estilos.titulo} style={{ marginBottom: 12 }}>
          Eventos realizados
        </h1>

        {falhou ? (
          <p className={estilos.estado} role="alert">
            Não consegui carregar a lista agora. Tente de novo em instantes.
          </p>
        ) : eventos === null ? (
          <p className={estilos.estado}>Carregando…</p>
        ) : eventos.length === 0 ? (
          <p className={estilos.estado}>Ainda não há eventos realizados por aqui.</p>
        ) : (
          <ul className={estilos.lista}>
            {eventos.map((ev) => (
              <li key={`${ev.slug ?? ev.name}-${ev.startDate}`} className={estilos.linha}>
                <span className={estilos.linhaData}>{dataCurta(ev.startDate)}</span>
                <div className={estilos.linhaInfo}>
                  <span className={estilos.linhaNome}>{ev.name}</span>
                  {ev.location && <span className={estilos.linhaLocal}>{ev.location}</span>}
                </div>
                <Link href="/?certificado=1" className={estilos.acao}>
                  Certificado
                  <Seta />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
