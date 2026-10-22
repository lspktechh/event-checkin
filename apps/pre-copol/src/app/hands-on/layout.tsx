import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hands On — Workshops Práticos | COPOL 2026",
  description:
    "Inscreva-se nos Hands On práticos do 3º COPOL (05 e 06 de Novembro). Vagas limitadas, pagamento facilitado via Pix.",
  openGraph: {
    title: "Hands On — Workshops Práticos | COPOL 2026",
    description:
      "Garanta sua vaga nos workshops práticos de Odontologia do COPOL 2026. Turmas reduzidas e imersão prática.",
  },
};

export default function HandsOnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
