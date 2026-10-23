/**
 * Catálogo Oficial dos Hands On — COPOL 2026 (05/11 e 06/11)
 *
 * 12 workshops práticos simultâneos no período da tarde (14:00 às 18:00):
 * - Quinta-feira (05/11/2026): 6 workshops
 * - Sexta-feira (06/11/2026): 6 workshops
 */

export interface HandsOnItem {
  id: string;
  slug: string;
  titulo: string;
  ministrante: string;
  preco: number;
  vagas: number;
  vagasTexto?: string;
  diaSemana: string;
  diaId: "quinta" | "sexta";
  data: "2026-11-05" | "2026-11-06";
  horario: string;
  patrocinio?: string | null;
  patrocinioLogo?: string | null;
  descricao: string;
  publicoAlvo?: string;
  local?: string;
}

export const HANDS_ON_LIST: HandsOnItem[] = [
  // ==========================================
  // QUINTA-FEIRA — 05/11/2026
  // ==========================================
  {
    id: "clareamento-dental-caseiro",
    slug: "clareamento-dental-caseiro",
    titulo: "Clareamento dental caseiro, do molde ao produto",
    ministrante: "Profª Marcela Moreira",
    preco: 20.0,
    vagas: 10,
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "14:00 às 15:30",
    patrocinio: null,
    descricao:
      "Abordagem clínica prática do clareamento dental caseiro supervisionado. Técnicas de moldagem de precisão, confecção e individualização de moldeiras flexíveis de acetato, seleção criteriosa do gel clareador (peróxido de carbamida vs. peróxido de hidrogênio) e orientações ao paciente para evitar sensibilidade.",
    local: "Universidade Positivo — Laboratório de Odontologia",
  },
  {
    id: "fechamento-diastema-manequim",
    slug: "fechamento-diastema-manequim",
    titulo: "Fechamento de diastema no manequim",
    ministrante: "Profª Marcela Moreira",
    preco: 20.0,
    vagas: 12,
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "15:30 às 17:30",
    patrocinio: null,
    descricao:
      "Treinamento prático direto em manequim odontológico focado no fechamento harmônico de diastemas em dentes anteriores. Proporções áureas, planejamento estético, seleção de cor, estratificação com resinas compostas, uso de matrizes individualizadas e acabamento e polimento de alto brilho.",
    local: "Universidade Positivo — Laboratório de Dentística",
  },
  {
    id: "preenchimento-labial",
    slug: "preenchimento-labial",
    titulo: "Preenchimento labial",
    ministrante: "Profª Ana Paula Pereira",
    preco: 50.0,
    vagas: 12,
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "13:30 às 15:00",
    patrocinio: null,
    descricao:
      "Fundamentos científicos e práticos do preenchimento labial com ácido hialurônico na Harmonização Orofacial. Anatomia vascular crítica, análise do contorno e tubérculos labiais, técnicas com agulha e cânula, escultura do arco de cupido, hidratação, volumização e protocolo de segurança contra intercorrências.",
    local: "Universidade Positivo — Clínica / Sala HOF",
  },
  {
    id: "cirurgia-guiada-implantodontia",
    slug: "cirurgia-guiada-implantodontia",
    titulo: "Cirurgia Guiada em Implantodontia",
    ministrante: "Prof. Marcos Guskuma",
    preco: 20.0,
    vagas: 12,
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "16:00 às 17:30",
    patrocinio: "Straumann",
    descricao:
      "Imersão prática nos protocolos de cirurgia guiada com o sistema Straumann. Do fluxo digital (escaneamento intraoral + tomografia) ao posicionamento tridimensional do implante guiado por computador, kit cirúrgico guiado e instrumentação prática em biomodelos.",
    local: "Universidade Positivo — Laboratório de Cirurgia",
  },
  {
    id: "resina-injetada-dvo",
    slug: "resina-injetada-dvo",
    titulo: "Resina composta injetada para aumento de DVO: dicas clínicas",
    ministrante: "Prof. Carlos Archangelo",
    preco: 20.0,
    vagas: 12,
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "14:00 às 15:30",
    patrocinio: null,
    descricao:
      "Técnica restauradora injetada passo a passo para restabelecimento da Dimensão Vertical de Oclusão (DVO). Planejamento funcional com enceramento diagnóstico, confecção e adaptação de guias transparentes de silicone, dicas clínicas operatórias e injeção com resina fluida de alta carga com mínima necessidade de ajustes.",
    local: "Universidade Positivo — Laboratório Multidisciplinar",
  },
  {
    id: "radiotech-tomografia-visita",
    slug: "radiotech-tomografia-visita",
    titulo: "Palestra e Hands on na Radiotech (Visita Técnica)",
    ministrante: "Mariana Paião",
    preco: 0.0,
    vagas: 12,
    vagasTexto: "12 vagas no Hands On na Radiotech (às 18:30) / Palestra às 15:00 (vagas ilimitadas)",
    diaSemana: "Quinta-feira, 05/11/2026",
    diaId: "quinta",
    data: "2026-11-05",
    horario: "Palestra às 15:00 · Hands On às 18:30",
    patrocinio: "Radiotech",
    patrocinioLogo: "/partners/radiotech.png",
    descricao:
      "Palestra especial às 15:00: “Tomografia sem mistérios: princípios, indicações e aplicação na prática odontológica” ministrada por Mariana Paião (participação livre e ilimitada na palestra) e Hands On prático exclusivo às 18:30 na clínica Radiotech com visita técnica e manuseio de tomógrafo e softwares diagnósticos (restrito a 12 participantes).",
    local: "Auditório Positivo (Palestra) & Radiotech Londrina (Hands On)",
  },

  // ==========================================
  // SEXTA-FEIRA — 06/11/2026
  // ==========================================
  {
    id: "toxina-botulinica-hof",
    slug: "toxina-botulinica-hof",
    titulo: "Toxina Botulínica: como iniciar na Harmonização facial com segurança",
    ministrante: "Profª Marcia Palla",
    preco: 30.0,
    vagas: 14,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "14:30 às 16:30",
    patrocinio: null,
    descricao:
      "Treinamento preparatório essencial para odontologistas que desejam ingressar com total segurança na aplicação da toxina botulínica. Dinâmica muscular facial (terço superior), diluição, reconstituição, cálculo de unidades por ponto anatômico e prevenção de assimetrias e ptoses.",
    local: "Universidade Positivo — Clínica HOF",
  },
  {
    id: "simplificando-resina-composta",
    slug: "simplificando-resina-composta",
    titulo: "Simplificando o dia a dia com Resina Composta",
    ministrante: "Dr. Paulo Chagas",
    preco: 20.0,
    vagas: 18,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "13:30 às 16:30",
    patrocinio: "Dental Shop",
    patrocinioLogo: "/partners/dental-dsl.png",
    descricao:
      "Técnicas diretas, práticas e desmistificadas para o clínico geral alcançar excelência estética e funcional com resina composta. Dicas de escultura rápida, controle de espessura de camada, textura e polimento simplificado que economizam tempo clínico na rotina do consultório.",
    local: "Universidade Positivo — Laboratório de Dentística",
  },
  {
    id: "fotografia-smartphone",
    slug: "fotografia-smartphone",
    titulo: "Hands on de fotografia com smartphone",
    ministrante: "Dra. Herica Delalíbera",
    preco: 15.0,
    vagas: 12,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "15:30 às 16:30",
    patrocinio: null,
    descricao:
      "Prática de fotografia odontológica com o próprio smartphone. Iluminação acessível (ring lights e flashes portáteis), enquadramentos padronizados para casos clínicos, fotos de sorriso e face, e noções fundamentais de edição rápida e comunicação ética em mídias sociais.",
    local: "Universidade Positivo — Estúdio / Sala Multimídia",
  },
  {
    id: "integrale-cirurgia-implante-protetico",
    slug: "integrale-cirurgia-implante-protetico",
    titulo: "Hands on Integrale: cirurgia de implante e componente protético",
    ministrante: "Prof. Alessandro Batistella e Paulo Lucchese",
    preco: 20.0,
    vagas: 20,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "17:00 às 18:00",
    patrocinio: "Integrale",
    patrocinioLogo: "/partners/integrale.png",
    descricao:
      "Workshop prático com a metodologia e componentes Integrale. Protocolo cirúrgico para instalação de implantes e seleção criteriosa de componentes protéticos com foco em previsibilidade biológica e funcional.",
    local: "Universidade Positivo — Laboratório Integrale",
  },
  {
    id: "cimentacao-pino-fibra",
    slug: "cimentacao-pino-fibra",
    titulo: "Hands on de Cimentações de Pino de Fibra de Vidro",
    ministrante: "Prof. Lucas",
    preco: 20.0,
    vagas: 20,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "15:30 às 16:30",
    patrocinio: "Angelus",
    descricao:
      "Técnica adesiva rigorosa e cimentação de pinos de fibra de vidro com produtos e tecnologias Angelus. Preparo radicular conservador, silanização, seleção de cimento resinoso e reconstrução de núcleo de preenchimento para máxima retenção estrutural.",
    local: "Universidade Positivo — Laboratório de Prótese",
  },
  {
    id: "lprf-poder-regenerativo",
    slug: "lprf-poder-regenerativo",
    titulo: "Hands on L-PRF: O PODER REGENERATIVO DO PRÓPRIO SANGUE",
    ministrante: "Prof. João Rozante",
    preco: 20.0,
    vagas: 12,
    diaSemana: "Sexta-feira, 06/11/2026",
    diaId: "sexta",
    data: "2026-11-06",
    horario: "16:00 às 17:00",
    patrocinio: null,
    descricao:
      "Técnica completa de obtenção e manuseio clínico da Fibrina Rica em Plaquetas e Leucócitos (L-PRF). Parâmetros de centrifugação sanguínea, confecção de membranas, plugue de fibrina, 'sticky bone' e suas aplicações em enxertias ósseas, periodontia e implantodontia.",
    local: "Universidade Positivo — Laboratório Cirúrgico",
  },
];

export function getHandsOnById(id: string): HandsOnItem | undefined {
  return HANDS_ON_LIST.find(
    (item) =>
      item.id === id ||
      item.slug === id ||
      (id === "reabilitacao-resina-composta" && item.id === "integrale-cirurgia-implante-protetico")
  );
}

// ============================================================
// DADOS OFICIAIS DO PAGAMENTO PIX
// ============================================================

export const PIX_CONFIG = {
  chave: "",
  tipoChave: "Chave Dinâmica",
  titular: "3º COPOL 2026",
  cidade: "Londrina",
  instituicao: "3º COPOL — Congresso Odontológico Positivo Londrinense",
  emailContato: "terceirocopol@gmail.com",
};

/**
 * Monta o Payload oficial do Pix EMV (BR Code)
 * Formato compatível com todos os bancos e instituições financeiras brasileiras
 */
function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixPayload({
  key = PIX_CONFIG.chave,
  name = PIX_CONFIG.titular,
  city = PIX_CONFIG.cidade,
  amount,
  txid = "***",
}: {
  key?: string;
  name?: string;
  city?: string;
  amount?: number;
  txid?: string;
}): string {
  const cleanKey = key.trim();
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 25)
    .toUpperCase();
  const cleanCity = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 15)
    .toUpperCase();

  const merchantAccount =
    formatField("00", "br.gov.bcb.pix") + formatField("01", cleanKey);

  let payload =
    formatField("00", "01") +
    formatField("26", merchantAccount) +
    formatField("52", "0000") +
    formatField("53", "986");

  if (amount !== undefined && amount > 0) {
    payload += formatField("54", amount.toFixed(2));
  }

  payload +=
    formatField("58", "BR") +
    formatField("59", cleanName) +
    formatField("60", cleanCity);

  const cleanTxid = (txid || "***").replace(/[^a-zA-Z0-9*]/g, "").slice(0, 25);
  payload += formatField("62", formatField("05", cleanTxid || "***"));

  payload += "6304";
  const crc = crc16Ccitt(payload);
  return payload + crc;
}

// ============================================================
// MODELO DE INSCRIÇÃO EM HANDS ON
// ============================================================

export interface HandsOnInscription {
  id: string; // Ex: HO-2026-X8412
  handsOnId: string;
  handsOnTitulo: string;
  ministrante: string;
  diaSemana: string;
  horario: string;
  preco: number;
  local?: string;
  patrocinio?: string | null;

  nome: string;
  email: string;
  documento: string; // CPF
  telefone: string;
  instituicao?: string;
  categoria?: string;
  status: "PENDENTE" | "CONFIRMADO" | "CANCELADO" | "ESGOTADO";

  pixKey: string;
  pixReceiverName: string;
  pixCode: string;
  pixQrCodeBase64?: string;
  mercadoPagoPaymentId?: string;
  qrToken?: string;
  createdAt: string;
}

const STORAGE_KEY = "copol_handson_inscriptions";

export function saveHandsOnInscription(record: HandsOnInscription): void {
  if (typeof window === "undefined") return;
  try {
    const list = listHandsOnInscriptions();
    const existingIdx = list.findIndex((i) => i.id === record.id);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("Erro ao salvar inscrição no localStorage:", err);
  }
}

export function getHandsOnInscription(id: string): HandsOnInscription | null {
  if (typeof window === "undefined") return null;
  try {
    const list = listHandsOnInscriptions();
    return list.find((i) => i.id === id) || null;
  } catch {
    return null;
  }
}

export function listHandsOnInscriptions(): HandsOnInscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function formatarReais(valor: number): string {
  if (valor === 0) return "Gratuito";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
