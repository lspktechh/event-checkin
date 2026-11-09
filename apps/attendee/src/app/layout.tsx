import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

/**
 * As fontes da marca LSPK: Space Grotesk e a fonte de dados.
 *
 * Servidas pelo próprio Next (`next/font` baixa e hospeda junto do site),
 * e não pelo Google em tempo de execução: sem chamada externa no
 * carregamento, sem depender de um terceiro estar no ar, e sem o salto de
 * layout que acontece quando a fonte chega depois do texto.
 *
 * O portal (Acessar / Inscrição / Realizados) usa JetBrains Mono nos
 * rótulos e datas; as telas mais antigas seguem com IBM Plex Mono.
 */
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fonte-titulo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--fonte-mono",
  display: "swap",
});

const monoPortal = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fonte-mono-portal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LSPK Eventos",
  description: "Acesse seu QR Code, comprovante de presença e certificado, ou faça sua inscrição.",
};

// Quase todo acesso é pelo celular, na fila da entrada. A barra do
// navegador na mesma cor do fundo evita a faixa branca em cima do site.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1115",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${grotesk.variable} ${mono.variable} ${monoPortal.variable}`}>
      <body>{children}</body>
    </html>
  );
}
