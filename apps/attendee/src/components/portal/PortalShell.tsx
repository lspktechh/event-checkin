import Link from "next/link";
import type { ReactNode } from "react";
import { CreditosParceiros } from "@/components/CreditosParceiros";
import estilos from "./portal.module.css";

export type AbaDoPortal = "acessar" | "inscricao" | "realizados";

/**
 * Cada aba é uma página de verdade (link), e não um estado local: o
 * endereço de "Inscrição" e de "Realizados" pode ser divulgado, e o botão
 * voltar do celular precisa funcionar entre elas.
 */
const ABAS: { id: AbaDoPortal; rotulo: string; href: string }[] = [
  { id: "acessar", rotulo: "Acessar", href: "/" },
  { id: "inscricao", rotulo: "Inscrição", href: "/inscricao" },
  { id: "realizados", rotulo: "Realizados", href: "/realizados" },
];

/** A marca da LSPK: o "L" sobre fundo claro com o quadrado azul. */
function Marca() {
  return (
    <svg
      className={estilos.marca}
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="8" fill="#f2f0ea" />
      <rect x="11" y="10" width="5" height="20" fill="#111111" />
      <rect x="11" y="25" width="18" height="5" fill="#111111" />
      <rect x="22" y="10" width="7" height="7" rx="1" fill="#4459f5" />
    </svg>
  );
}

/**
 * Moldura das telas públicas do portal: marca, abas e créditos.
 *
 * `larga` abre a coluna para as telas de lista (Realizados, eventos
 * encontrados); os formulários ficam na coluna estreita.
 */
export function PortalShell({
  aba,
  larga = false,
  children,
}: {
  aba: AbaDoPortal;
  larga?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={estilos.pagina}>
      <div className={`${estilos.coluna} ${larga ? estilos.larga : ""}`}>
        <Link href="/" className={estilos.cabecalho} aria-label="LSPK Eventos — início">
          <Marca />
          <span className={estilos.nomes}>
            <span className={estilos.nomeMarca}>LSPK Eventos</span>
            <span className={estilos.rotuloMono}>LSPK Technology</span>
          </span>
        </Link>

        <nav aria-label="Seções" className={estilos.abas}>
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              aria-current={a.id === aba ? "page" : undefined}
              className={`${estilos.aba} ${a.id === aba ? estilos.abaAtiva : ""}`}
            >
              {a.rotulo}
            </Link>
          ))}
        </nav>

        <main className={estilos.conteudo}>{children}</main>

        <footer className={estilos.rodape}>
          <CreditosParceiros align="start" />
        </footer>
      </div>
    </div>
  );
}
