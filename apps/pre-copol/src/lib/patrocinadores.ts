/**
 * Patrocinadores do COPOL, por cota. Aparecem na página de Parcerias (em
 * destaque, acima de quem apoia) e no rodapé de todas as páginas.
 *
 * `logo` fica vazio até a marca chegar em arquivo: sem ele, o nome sai
 * escrito na cor da empresa — nunca uma imagem quebrada.
 */
export interface Patrocinador {
  nome: string;
  descricao: string;
  cota: "Diamante" | "Esmeralda" | "Ouro" | "Prata" | "Bronze";
  url: string;
  /** Cor do nome enquanto não há logo. */
  cor: string;
  logo?: { src: string; largura: number; altura: number };
}

export const PATROCINADORES: Patrocinador[] = [
  {
    nome: "Integrale",
    descricao: "Centro de Educação Continuada em Odontologia",
    cota: "Diamante",
    url: "https://www.instagram.com/integrale_londrina",
    cor: "#d7261e",
    // Recortado do post de divulgação do COPOL, sem o fundo creme.
    logo: { src: "/partners/integrale.png", largura: 859, altura: 187 },
  },
  {
    nome: "Dental DSL",
    descricao: "Dental DSL Londrina",
    cota: "Diamante",
    url: "https://www.instagram.com/dentaldsllondrina",
    cor: "#e06a2b",
    // Recortado do post do COPOL, sem o fundo verde-petróleo.
    logo: { src: "/partners/dental-dsl.png", largura: 936, altura: 306 },
  },
  {
    nome: "Radiotech Smart",
    descricao: "Radiotech Smart",
    cota: "Diamante",
    url: "https://www.instagram.com/radiotech.imagem",
    cor: "#b08850",
    // Recortado do post do COPOL, sem o fundo creme.
    logo: { src: "/partners/radiotech.png", largura: 912, altura: 252 },
  },
  {
    nome: "MagDente",
    descricao: "Prótese Odontológica",
    cota: "Esmeralda",
    url: "https://www.instagram.com/laboratorio_magdente",
    cor: "#3f97b5",
    // Recortado do post do COPOL; a placa azul faz parte da marca.
    logo: { src: "/partners/magdente.png", largura: 674, altura: 223 },
  },
  {
    nome: "Ateliê Oral",
    descricao: "Por Gilberto Filho e Felipe Araújo",
    cota: "Esmeralda",
    url: "https://www.instagram.com/atelieoral.gilbertofilho",
    cor: "#111111",
    // Recortado do post do COPOL; a placa preta faz parte da marca.
    logo: { src: "/partners/atelie.png", largura: 596, altura: 237 },
  },
];

/**
 * Apoiadores do COPOL (empresas que apoiam o congresso, sem cota de
 * patrocínio). Diferentes de Realização e Apoio institucional
 * (Universidade Positivo, Ecohub, LSPK), que ficam à parte.
 * Logos recortados dos posts de divulgação do COPOL.
 */
export interface Apoiador {
  nome: string;
  url: string;
  logo: { src: string; largura: number; altura: number };
}

export const APOIADORES: Apoiador[] = [
  {
    nome: "By Jaleco",
    url: "https://www.instagram.com/byjaleco",
    logo: { src: "/partners/byjaleco.png", largura: 364, altura: 182 },
  },
  {
    nome: "Cleber Livros",
    url: "https://www.instagram.com/cleberlivros",
    logo: { src: "/partners/cleber-livros.png", largura: 339, altura: 187 },
  },
  {
    nome: "Dental Press",
    url: "https://www.instagram.com/dental_press",
    logo: { src: "/partners/dentalpress.png", largura: 269, altura: 275 },
  },
  {
    nome: "Dentalclean",
    url: "https://www.instagram.com/dentalclean",
    logo: { src: "/partners/dentalclean.png", largura: 498, altura: 95 },
  },
  {
    nome: "OdontoFarma",
    url: "https://www.instagram.com/farmaciaodontofarma",
    logo: { src: "/partners/odontofarma.png", largura: 299, altura: 295 },
  },
  {
    nome: "Vite",
    url: "https://www.instagram.com/vitejalecos",
    logo: { src: "/partners/vite.png", largura: 375, altura: 179 },
  },
];
