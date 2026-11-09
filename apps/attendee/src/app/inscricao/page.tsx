"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buscarEventosAbertos, type EventoAberto } from "@/lib/eventosAbertos";
import { dataCurta } from "@/lib/datas";
import { PortalShell } from "@/components/portal/PortalShell";
import { Seta } from "@/components/portal/Seta";
import estilos from "@/components/portal/portal.module.css";

export const dynamic = "force-dynamic";

/**
 * A aba "Inscrição".
 *
 * Com um único evento aberto — o caso comum — vai direto para o
 * formulário dele: pedir para escolher entre uma opção só é burocracia.
 * Com vários, lista; sem nenhum, diz que não há.
 */
export default function InscricaoIndexPage() {
  const router = useRouter();
  const [abertos, setAbertos] = useState<EventoAberto[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    buscarEventosAbertos()
      .then((lista) => {
        if (lista.length === 1) {
          router.replace(`/inscricao/${lista[0].slug}`);
          return;
        }
        setAbertos(lista);
      })
      .catch(() => setFalhou(true));
  }, [router]);

  return (
    <PortalShell aba="inscricao" larga={(abertos?.length ?? 0) > 1}>
      <section className={estilos.secao}>
        <div className={estilos.cabecaSecao}>
          <span className={estilos.rotuloMono}>Inscrições</span>
          <h1 className={estilos.titulo}>Inscrições abertas</h1>
        </div>

        {falhou ? (
          <p className={estilos.estado} role="alert">
            Não consegui carregar os eventos agora. Tente de novo em instantes.
          </p>
        ) : abertos === null ? (
          <p className={estilos.estado}>Carregando…</p>
        ) : abertos.length === 0 ? (
          <p className={estilos.estado}>
            Nenhuma inscrição aberta no momento. Já se inscreveu?{" "}
            <Link href="/">Acesse seu QR Code</Link>.
          </p>
        ) : (
          <ul className={estilos.lista}>
            {abertos.map((e) => (
              <li key={e.slug} className={estilos.linha}>
                <span className={estilos.linhaData}>{dataCurta(e.startDate)}</span>
                <div className={estilos.linhaInfo}>
                  <span className={estilos.linhaNome}>{e.name}</span>
                </div>
                <Link href={`/inscricao/${e.slug}`} className={estilos.acao}>
                  Inscrever-se
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
