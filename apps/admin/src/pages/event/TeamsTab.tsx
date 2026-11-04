import { useEffect, useMemo, useState } from "react";
import * as api from "../../api/client";
import {
  UsersIcon,
  SearchIcon,
  MailIcon,
  PhoneIcon,
  MessageIcon,
  XIcon,
  IdCardIcon,
  GradCapIcon,
  LayersIcon,
  RefreshIcon,
  CheckIcon,
  DownloadIcon,
  ArrowRightIcon,
  CopyIcon,
  WhatsAppIcon,
} from "../../components/Icons";
import { formatPhone, formatDocument } from "../../utils/formatters";
import { PhoneWhatsAppPopover } from "../../components/PhoneWhatsAppPopover";
import {
  isParticipantSemEquipe,
  generateInscriptionMarkdown,
  getWhatsAppInviteUrl,
  parseInscriptionNotes,
} from "../../utils/inscriptionMarkdown";
import { copyTextToClipboard, downloadTextAsFile } from "../../utils/clipboard";
import {
  exportTeamsEvaluationZip,
  generateAnonymousTeamPdf,
} from "../../utils/teamAnonymousPdf";

interface TeamsTabProps {
  eventId: string;
  eventName?: string;
}

// ──── REGISTRO OFICIAL DAS ODS DA ONU ────
const ODS_MAP: Record<number, { nome: string; cor: string; resumo?: string }> = {
  1: { nome: "Erradicação da Pobreza", cor: "#E5243B" },
  2: { nome: "Fome Zero e Agricultura Sustentável", cor: "#DDA63A" },
  3: { nome: "Saúde e Bem-Estar", cor: "#4C9F38", resumo: "Soluções para dores reais da rotina de saúde e assistência." },
  4: { nome: "Educação de Qualidade", cor: "#C5192D" },
  5: { nome: "Igualdade de Gênero", cor: "#FF3A21" },
  6: { nome: "Água Potável e Saneamento", cor: "#26BDE2" },
  7: { nome: "Energia Limpa e Acessível", cor: "#FCC30B" },
  8: { nome: "Trabalho Decente e Crescimento Econômico", cor: "#A21942" },
  9: { nome: "Indústria, Inovação e Infraestrutura", cor: "#FD6925", resumo: "Prototipagem, tecnologia e infraestrutura para inovar no cuidado." },
  10: { nome: "Redução das Desigualdades", cor: "#DD1367", resumo: "Acesso justo e equitativo à saúde no SUS e na rede regional." },
  11: { nome: "Cidades e Comunidades Sustentáveis", cor: "#FD9D24", resumo: "Acessibilidade, logística urbana e descarte ecológico hospitalar." },
  12: { nome: "Consumo e Produção Responsáveis", cor: "#BF8B2E", resumo: "Uso racional de insumos, redução de desperdício e reciclagem." },
  13: { nome: "Ação Contra a Mudança Global do Clima", cor: "#3F7E44" },
  14: { nome: "Vida na Água", cor: "#0A97D9" },
  15: { nome: "Vida Terrestre", cor: "#56C02B" },
  16: { nome: "Paz, Justiça e Instituições Eficazes", cor: "#00689D" },
  17: { nome: "Parcerias e Meios de Implementação", cor: "#19486A", resumo: "Universidade, Ecohub, poder público e comunidade construindo juntos." },
};

// ──── MAPA DE FORMAS DE PROTÓTIPO ────
const FORMAS_MAP: Record<string, { titulo: string; badge: string; cor: string }> = {
  forma_a: { titulo: "Software / Aplicação Digital", badge: "Software", cor: "#3b82f6" },
  forma_b: { titulo: "Peça Física para Impressão 3D", badge: "Peça 3D", cor: "#f59e0b" },
  forma_c: { titulo: "Serviço, Protocolo ou Fluxo Assistencial", badge: "Serviço / Fluxo", cor: "#10b981" },
  forma_d: { titulo: "Espaço, Sinalização ou Comunicação Visual", badge: "Comunicação", cor: "#ec4899" },
};

export interface TeamMemberDetail {
  id?: string;
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  curso?: string;
  vinculo?: string;
  papel?: string;
  competencias: string[];
  disponibilidade: string[];
  isLeader?: boolean;
}

export function getValidExternalUrl(url?: string): string {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (
    !trimmed ||
    trimmed === "#" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "null"
  ) {
    return "";
  }
  // Se for caminho relativo para o backend
  if (
    trimmed.startsWith("/api/") ||
    trimmed.startsWith("/inscriptions/") ||
    trimmed.startsWith("/uploads/") ||
    trimmed.startsWith("/trabalhos/")
  ) {
    const apiBase = (import.meta.env.VITE_API_URL ?? "https://137-131-233-254.sslip.io").replace(/\/$/, "");
    return `${apiBase}${trimmed}`;
  }
  // Se já tiver protocolo http/https
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  // Se for domínio sem protocolo (ex: drive.google.com, figma.com, youtube.com)
  return `https://${trimmed}`;
}

export interface TrabalhoItem {
  origem: "inscricao" | "submissao_posterior";
  data: string;
  protocoloEnvio?: string;
  videoUrl?: string;
  prototipoUrl?: string;
  itens?: Array<{ tipo: string; titulo: string; linkUrl?: string; url?: string; arquivoNome?: string }>;
  observacoes?: string;
  acessoLiberado?: boolean;
}

export interface TeamAvaliacao {
  nota: number; // 1 a 10
  posicao?: string;
  comentario?: string;
  avaliadorNome?: string;
  atualizadoEm?: string;
}

export interface TeamRecord {
  id: string;
  teamName: string;
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  trilha: string;
  trilhaLabel: string;
  lider: TeamMemberDetail;
  integrantes: TeamMemberDetail[];
  totalIntegrantes: number;
  // Etapa 1 - Empatizar
  empatizar: {
    quem_vive?: string;
    o_que_perde?: string;
    como_sabe: string[];
  };
  // Etapa 2 - Definir
  definir: {
    eixo: string;
    frequencia?: string;
    como_resolvem_hoje?: string;
    por_que_nao_resolve?: string;
    frase: {
      quem?: string;
      o_que?: string;
      por_que?: string;
      o_que_atrapalha?: string;
    };
  };
  // Etapa 3 - Idear
  idear: {
    nome_solucao: string;
    categoria: string;
    tres_passos: string[];
    frase: {
      quem?: string;
      necessidade?: string;
      nome?: string;
      categoria?: string;
      beneficio?: string;
      alternativa?: string;
      diferencial?: string;
    };
  };
  // Etapa 4 - Escopo
  escopo: {
    e?: string;
    nao_e?: string;
    faz: string[];
    nao_faz: string[];
  };
  // Etapa 5 - Forma & Prototipagem
  forma: {
    formas: string[];
    peca_3d?: {
      pecaEncaixaEm?: string;
      medida_mm?: number | null;
      folga_mm?: number | null;
      envelope_mm?: number[];
      cabe_na_mesa?: boolean;
      material?: string;
      material_sugerido_por?: string;
      requisitos?: string[];
      quantidade?: number;
      montagem?: boolean;
    };
    software?: Array<{ nome?: string; acao?: string }>;
    servico?: {
      quem_executa_hoje?: string;
      passo_a_passo_atual?: string[];
      o_que_muda?: string;
      artefato?: string[];
      quem_valida?: string;
    };
    trava_sanitaria: {
      acionada: boolean;
      motivos: string[];
      restricao?: string;
      contato_paciente?: boolean;
    };
  };
  // Etapa 6 - Fechamento & ODS
  fechamento: {
    como_saberemos?: string;
    maior_duvida?: string;
    aberta_a_novos: boolean;
    aceites: string[];
    ods: number[];
  };
  faltaNaEquipe: string[];
  competenciasEquipe: string[];
  vagasRestantes: number;
  trabalhos: TrabalhoItem[];
  createdAt: string;
  rawInscription: api.InscriptionReportItem;
  avaliacao?: TeamAvaliacao;
}

type ModalSubTab = "todos" | "integrantes" | "problema" | "solucao" | "escopo" | "prototipo" | "ods" | "entregas";

export function TeamsTab({ eventId, eventName = "INOVA SAÚDE 2026" }: TeamsTabProps) {
  const [inscriptions, setInscriptions] = useState<api.InscriptionReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEixo, setFiltroEixo] = useState("TODOS");
  const [filtroForma, setFiltroForma] = useState("TODAS");
  const [selectedTeam, setSelectedTeam] = useState<TeamRecord | null>(null);
  const [modalTab, setModalTab] = useState<ModalSubTab>("todos");
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [mainView, setMainView] = useState<"equipes" | "talentos">("equipes");

  // Estado de Exportação de ZIP Anônimo para a Banca
  const [exportingZip, setExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  // Estado da Avaliação da Ideia / Banca
  const [evaluatingTeam, setEvaluatingTeam] = useState<TeamRecord | null>(null);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [evaluationNota, setEvaluationNota] = useState<number | null>(null);
  const [evaluationPosicao, setEvaluationPosicao] = useState<string>("");
  const [evaluationComentario, setEvaluationComentario] = useState<string>("");
  const [evaluationAvaliadorNome, setEvaluationAvaliadorNome] = useState<string>("");

  // Estado do Modal de Adição/Edição de Trabalho da Equipe
  const [editingWorkTeam, setEditingWorkTeam] = useState<TeamRecord | null>(null);
  const [workTitulo, setWorkTitulo] = useState("");
  const [workTeamName, setWorkTeamName] = useState("");
  const [workPrototipoUrl, setWorkPrototipoUrl] = useState("");
  const [workVideoUrl, setWorkVideoUrl] = useState("");
  const [workObservacoes, setWorkObservacoes] = useState("");
  const [workAcessoLiberado, setWorkAcessoLiberado] = useState(true);
  const [workArtefatos, setWorkArtefatos] = useState<
    Array<{ tipo: string; titulo: string; linkUrl: string }>
  >([]);
  const [savingWork, setSavingWork] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Estado do Modal de Visualização / Exportação de Markdown
  const [markdownModal, setMarkdownModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    copied: boolean;
  } | null>(null);

  useEffect(() => {
    loadTeams();
  }, [eventId]);

  async function loadTeams() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInscriptionsReport(eventId);
      setInscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar equipes");
    } finally {
      setLoading(false);
    }
  }

  // Processa as inscrições e une os dados completos submetidos pelos líderes
  const teams: TeamRecord[] = useMemo(() => {
    // 1. Mapeia submissões de trabalho posteriores
    const workMap: Record<string, TrabalhoItem[]> = {};

    for (const ins of inscriptions) {
      let parsedNotes: any = null;
      try {
        if (ins.notes) parsedNotes = JSON.parse(ins.notes);
      } catch {}

      const isWork =
        ins.name?.startsWith("[TRABALHO]") ||
        ins.category?.includes("Trabalho") ||
        parsedNotes?.tipo_registro === "SUBMISSAO_TRABALHO";

      if (isWork) {
        const keyProto = parsedNotes?.protocolo_inscricao;
        const keyTeam = (parsedNotes?.equipe_nome || ins.teamName || "").toLowerCase().trim();
        const keyEmail = (parsedNotes?.email_lider || ins.email || "").toLowerCase().trim();

        const item: TrabalhoItem = {
          origem: "submissao_posterior",
          data: parsedNotes?.data_envio || ins.createdAt,
          protocoloEnvio: parsedNotes?.protocolo_envio,
          itens: Array.isArray(parsedNotes?.itens)
            ? parsedNotes.itens.map((it: any) => ({
                tipo: it.tipo || "link",
                titulo: it.titulo || "Artefato Complementar",
                linkUrl: it.linkUrl || it.url || it.link || "",
                url: it.url || it.linkUrl || it.link || "",
                arquivoNome: it.arquivoNome || it.name || "",
              }))
            : [],
          observacoes: parsedNotes?.observacoes,
          acessoLiberado: parsedNotes?.acesso_liberado,
        };

        if (keyProto) {
          workMap[keyProto] = workMap[keyProto] || [];
          workMap[keyProto].push(item);
        }
        if (keyTeam) {
          workMap[keyTeam] = workMap[keyTeam] || [];
          workMap[keyTeam].push(item);
        }
        if (keyEmail) {
          workMap[keyEmail] = workMap[keyEmail] || [];
          workMap[keyEmail].push(item);
        }
      }
    }

    // 2. Processa as equipes oficiais
    const list: TeamRecord[] = [];

    for (const ins of inscriptions) {
      if (ins.name?.startsWith("[TRABALHO]") || ins.category?.includes("Trabalho")) {
        continue;
      }

      let parsedNotes: any = null;
      try {
        if (ins.notes) parsedNotes = JSON.parse(ins.notes);
      } catch {
        parsedNotes = null;
      }

      if (parsedNotes?.tipo_registro === "SUBMISSAO_TRABALHO") {
        continue;
      }

      const payload = parsedNotes?.payload_completo || parsedNotes || {};
      const trilha = payload.trilha || parsedNotes?.trilha || "equipe_com_ideia";
      const teamNameRaw =
        ins.teamName?.trim() ||
        payload.equipeNome?.trim() ||
        parsedNotes?.equipeNome?.trim() ||
        parsedNotes?.teamName?.trim();

      const hasTeam = Boolean(
        teamNameRaw ||
        (ins.teamMembers && ins.teamMembers.length > 0) ||
        (trilha && trilha !== "sem_ideia")
      );

      if (!hasTeam) {
        continue;
      }

      const teamName = teamNameRaw || `Equipe de ${ins.name}`;

      // Rótulo amigável da Trilha
      let trilhaLabel = "Equipe com Ideia Própria";
      if (trilha === "desafio_real") trilhaLabel = "Desafio Real de Saúde (HU/UEL)";
      else if (trilha === "sem_ideia") trilhaLabel = "Banco de Talentos Individual";

      // ─── Dados do Líder ───
      const liderObj = payload.lider || parsedNotes?.lider || parsedNotes?.membros_detalhes?.[0];
      const lider: TeamMemberDetail = {
        nome: liderObj?.nome?.trim() || ins.name,
        cpf: liderObj?.cpf || ins.document,
        email: liderObj?.email?.trim() || ins.email,
        telefone: liderObj?.telefone || ins.phone || undefined,
        curso: liderObj?.curso || ins.institution || undefined,
        vinculo: liderObj?.vinculo || "Líder da Equipe",
        papel: liderObj?.papel || "Líder e Coordenação",
        competencias: Array.isArray(liderObj?.competencias) ? liderObj.competencias : [],
        disponibilidade: Array.isArray(liderObj?.disponibilidade) ? liderObj.disponibilidade : [],
        isLeader: true,
      };

      // ─── Demais Integrantes ───
      const integrantes: TeamMemberDetail[] = [];
      const rawMembers = payload.membros || parsedNotes?.membros_detalhes?.slice(1) || [];

      if (Array.isArray(rawMembers) && rawMembers.length > 0) {
        rawMembers.forEach((m: any, idx: number) => {
          if (m.isLeader || m.nome?.trim() === lider.nome.trim()) return;
          integrantes.push({
            id: m.id || `m-${idx}`,
            nome: m.nome?.trim() || "Integrante",
            cpf: m.cpf || undefined,
            email: m.email?.trim() || undefined,
            telefone: m.telefone || undefined,
            curso: m.curso || m.instituicao || undefined,
            vinculo: m.vinculo || "Integrante",
            papel: m.papel || "Construir a solução",
            competencias: Array.isArray(m.competencias) ? m.competencias : [],
            disponibilidade: Array.isArray(m.disponibilidade) ? m.disponibilidade : [],
            isLeader: false,
          });
        });
      } else if (ins.teamMembers && ins.teamMembers.length > 0) {
        ins.teamMembers.forEach((mName, idx) => {
          if (mName.trim() !== lider.nome.trim()) {
            integrantes.push({
              id: `leg-${idx}`,
              nome: mName.trim(),
              papel: "Integrante",
              competencias: [],
              disponibilidade: [],
              isLeader: false,
            });
          }
        });
      }

      const totalIntegrantes = 1 + integrantes.length;

      // ─── Etapa 1 - Empatizar ───
      const empatizarRaw = payload.empatizar || parsedNotes?.empatizar || {};
      const empatizar = {
        quem_vive: empatizarRaw.quem_vive || payload.ficha_prototipo?.usuario,
        o_que_perde: empatizarRaw.o_que_perde || payload.ficha_prototipo?.dor,
        como_sabe: Array.isArray(empatizarRaw.como_sabe)
          ? empatizarRaw.como_sabe
          : empatizarRaw.como_sabe
          ? [empatizarRaw.como_sabe]
          : [],
      };

      // ─── Etapa 2 - Definir ───
      const definirRaw = payload.definir || parsedNotes?.definir || {};
      const definir = {
        eixo: definirRaw.eixo || payload.ficha_prototipo?.eixo || "Eixo Geral de Saúde",
        frequencia: definirRaw.frequencia,
        como_resolvem_hoje: definirRaw.como_resolvem_hoje,
        por_que_nao_resolve: definirRaw.por_que_nao_resolve,
        frase: definirRaw.frase || {},
      };

      // ─── Etapa 3 - Idear ───
      const idearRaw = payload.idear || parsedNotes?.idear || {};
      const idear = {
        nome_solucao: idearRaw.nome_solucao || payload.ficha_prototipo?.funcao || teamName,
        categoria: idearRaw.categoria || "Dispositivo / Solução em Saúde",
        tres_passos: Array.isArray(idearRaw.tres_passos) ? idearRaw.tres_passos : [],
        frase: idearRaw.frase || {},
      };

      // ─── Etapa 4 - Escopo ───
      const escopoRaw = payload.escopo || parsedNotes?.escopo || {};
      const escopo = {
        e: escopoRaw.e,
        nao_e: escopoRaw.nao_e,
        faz: Array.isArray(escopoRaw.faz) ? escopoRaw.faz : escopoRaw.faz ? [escopoRaw.faz] : [],
        nao_faz: Array.isArray(escopoRaw.nao_faz) ? escopoRaw.nao_faz : escopoRaw.nao_faz ? [escopoRaw.nao_faz] : [],
      };

      // ─── Etapa 5 - Forma & Ficha Protótipo ───
      const formaRaw = payload.forma || parsedNotes?.forma || {};
      const fichaRaw = payload.ficha_prototipo || parsedNotes?.ficha_prototipo || {};
      const formas = formaRaw.formas || fichaRaw.formas || [];

      const peca3dRaw = formaRaw.campos_forma?.peca_3d || fichaRaw.peca_3d || {};
      const peca_3d = {
        pecaEncaixaEm: peca3dRaw.pecaEncaixaEm || peca3dRaw.encaixe?.em,
        medida_mm: peca3dRaw.encaixe?.medida_mm,
        folga_mm: peca3dRaw.encaixe?.folga_mm,
        envelope_mm: peca3dRaw.pecaEnvelope || peca3dRaw.envelope_mm,
        cabe_na_mesa: peca3dRaw.cabe_na_mesa,
        material: peca3dRaw.pecaMaterial || peca3dRaw.material,
        material_sugerido_por: peca3dRaw.material_sugerido_por,
        requisitos: peca3dRaw.requisitos,
        quantidade: peca3dRaw.quantidade,
        montagem: peca3dRaw.montagem,
      };

      const software = formaRaw.campos_forma?.software || fichaRaw.software || [];
      const servico = formaRaw.campos_forma?.servico || fichaRaw.servico || {};
      const travaSanitariaRaw = formaRaw.trava_sanitaria || fichaRaw.trava_sanitaria || {};
      const trava_sanitaria = {
        acionada: Boolean(travaSanitariaRaw.acionada),
        motivos: Array.isArray(travaSanitariaRaw.motivos) ? travaSanitariaRaw.motivos : [],
        restricao: travaSanitariaRaw.restricao,
        contato_paciente: fichaRaw.contato_paciente,
      };

      // ─── Etapa 6 - Fechamento & ODS ───
      const fechamentoRaw = payload.fechamento || parsedNotes?.fechamento || {};
      const odsList = Array.isArray(fechamentoRaw.ods)
        ? fechamentoRaw.ods
        : Array.isArray(fichaRaw.ods)
        ? fichaRaw.ods
        : [];

      const fechamento = {
        como_saberemos: fechamentoRaw.como_saberemos,
        maior_duvida: fechamentoRaw.maior_duvida,
        aberta_a_novos: fechamentoRaw.aberta_a_novos !== false,
        aceites: Array.isArray(fechamentoRaw.aceites) ? fechamentoRaw.aceites : [],
        ods: odsList,
      };

      const faltaNaEquipe = fichaRaw.falta_na_equipe || [];
      const competenciasEquipe = fichaRaw.competencias_equipe || [];
      const abertaANovos = fechamento.aberta_a_novos;
      const vagasRestantes = abertaANovos ? Math.max(0, 6 - totalIntegrantes) : 0;

      // ─── Entregas de Trabalhos / Protótipos ───
      const trabalhos: TrabalhoItem[] = [];
      if (payload.trabalho_entregue) {
        trabalhos.push({
          origem: "inscricao",
          data: payload.trabalho_entregue.enviado_em || ins.createdAt,
          videoUrl: payload.trabalho_entregue.video_url,
          prototipoUrl: payload.trabalho_entregue.prototipo_url,
          itens: Array.isArray(payload.trabalho_entregue.artefatos_adicionais)
            ? payload.trabalho_entregue.artefatos_adicionais.map((it: any) => ({
                tipo: it.tipo || "link",
                titulo: it.titulo || "Artefato / Documento Complementar",
                linkUrl: it.linkUrl || it.url || it.link || "",
                url: it.url || it.linkUrl || it.link || "",
                arquivoNome: it.arquivoNome || it.name || "",
              }))
            : [],
          observacoes: payload.trabalho_entregue.observacoes,
          acessoLiberado: payload.trabalho_entregue.acesso_liberado,
        });
      }

      const extraWorks = [
        ...(workMap[ins.id] || []),
        ...(workMap[teamName.toLowerCase().trim()] || []),
        ...(workMap[ins.email.toLowerCase().trim()] || []),
      ];
      extraWorks.forEach((ew) => trabalhos.push(ew));

      // ─── Avaliação da Ideia / Banca ───
      const avaliacaoRaw = payload.avaliacao || parsedNotes?.avaliacao;
      const avaliacao: TeamAvaliacao | undefined =
        avaliacaoRaw && typeof avaliacaoRaw.nota === "number"
          ? {
              nota: avaliacaoRaw.nota,
              posicao: avaliacaoRaw.posicao || undefined,
              comentario: avaliacaoRaw.comentario || undefined,
              avaliadorNome: avaliacaoRaw.avaliadorNome || undefined,
              atualizadoEm: avaliacaoRaw.atualizadoEm || undefined,
            }
          : undefined;

      list.push({
        id: ins.id,
        teamName,
        status: ins.status,
        trilha,
        trilhaLabel,
        lider,
        integrantes,
        totalIntegrantes,
        empatizar,
        definir,
        idear,
        escopo,
        forma: {
          formas,
          peca_3d,
          software,
          servico,
          trava_sanitaria,
        },
        fechamento,
        faltaNaEquipe,
        competenciasEquipe,
        vagasRestantes,
        trabalhos,
        createdAt: ins.createdAt,
        rawInscription: ins,
        avaliacao,
      });
    }

    return list;
  }, [inscriptions]);

  // Lista de eixos únicos
  const eixosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.definir.eixo) set.add(t.definir.eixo);
    });
    return Array.from(set);
  }, [teams]);

  // Filtragem
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const matchEixo = filtroEixo === "TODOS" || t.definir.eixo === filtroEixo;
      const matchForma =
        filtroForma === "TODAS" ||
        t.forma.formas.includes(filtroForma);

      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        t.teamName.toLowerCase().includes(searchLower) ||
        t.lider.nome.toLowerCase().includes(searchLower) ||
        (t.lider.cpf && t.lider.cpf.includes(searchLower.replace(/\D/g, ""))) ||
        t.idear.nome_solucao.toLowerCase().includes(searchLower) ||
        t.integrantes.some((i) => i.nome.toLowerCase().includes(searchLower));

      return matchEixo && matchForma && matchSearch;
    });
  }, [teams, search, filtroEixo, filtroForma]);

  // Totalizadores
  const totalMembrosAlocados = useMemo(() => {
    return teams.reduce((acc, t) => acc + t.totalIntegrantes, 0);
  }, [teams]);

  const totalComPrototipo3D = useMemo(() => {
    return teams.filter((t) => t.forma.formas.includes("forma_b")).length;
  }, [teams]);

  const bancoDeTalentos = useMemo(() => {
    return inscriptions.filter((ins) => isParticipantSemEquipe(ins));
  }, [inscriptions]);

  const filteredTalentos = useMemo(() => {
    if (!search.trim()) return bancoDeTalentos;
    const term = search.toLowerCase().trim();
    return bancoDeTalentos.filter((ins) => {
      const notes = parseInscriptionNotes(ins);
      const member = notes?.membros_detalhes?.[0] || notes?.payload_completo?.lider;
      const curso = (member?.curso || ins.institution || "").toLowerCase();
      const competencias = Array.isArray(member?.competencias) ? member.competencias.join(" ").toLowerCase() : "";
      return (
        ins.name.toLowerCase().includes(term) ||
        ins.email.toLowerCase().includes(term) ||
        (ins.phone && ins.phone.includes(term.replace(/\D/g, ""))) ||
        curso.includes(term) ||
        competencias.includes(term)
      );
    });
  }, [bancoDeTalentos, search]);

  // Ações de Contato e Exportação
  function getWhatsAppUrl(phone?: string, nomeLider?: string) {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    if (!clean) return null;
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    const saudacao = nomeLider
      ? encodeURIComponent(`Olá, ${nomeLider.split(" ")[0]}! Aqui é da organização do INOVA SAÚDE 2026.`)
      : encodeURIComponent("Olá! Aqui é da organização do INOVA SAÚDE 2026.");
    return `https://wa.me/${full}?text=${saudacao}`;
  }

  function showToast(msg: string) {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 3500);
  }

  /**
   * Empacota todas as equipes da maratona em um único arquivo ZIP com os PDFs
   * de avaliação anônimos (sem dados de contato ou nomes pessoais).
   */
  async function handleExportZipAvaliadores() {
    if (teams.length === 0) {
      alert("Nenhuma equipe encontrada para exportar.");
      return;
    }

    try {
      setExportingZip(true);
      setExportProgress("Iniciando geração dos PDFs...");

      const blob = await exportTeamsEvaluationZip(
        teams,
        eventName || "INOVA SAÚDE 2026",
        (_curr, _total, msg) => {
          setExportProgress(msg);
        }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanEventName = (eventName || "inova-saude")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-");
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `equipes_${cleanEventName}_avaliacoes_sigilo_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`ZIP gerado com sucesso contendo ${teams.length} equipes para avaliação com sigilo! 📦`);
    } catch (err: any) {
      console.error("Erro ao gerar ZIP de avaliações:", err);
      alert("Erro ao gerar arquivo ZIP: " + (err.message || String(err)));
    } finally {
      setExportingZip(false);
      setExportProgress("");
    }
  }

  /**
   * Baixa a ficha técnica anônima de uma equipe individual em PDF
   */
  function handleDownloadSingleTeamPdf(team: TeamRecord) {
    try {
      const idx = teams.findIndex((t) => t.id === team.id);
      const teamIdx = idx >= 0 ? idx : 0;
      const pdfBytes = generateAnonymousTeamPdf(team, teamIdx, eventName || "INOVA SAÚDE 2026");
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const projCode = `Projeto_${String(teamIdx + 1).padStart(2, "0")}`;
      const safeName = (team.idear?.nome_solucao || team.teamName || "Equipe")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${projCode}_${safeName}_Avaliacao_Sigilo.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`PDF anônimo da equipe "${team.teamName}" baixado com sucesso! 📄`);
    } catch (err: any) {
      console.error("Erro ao gerar PDF individual:", err);
      alert("Erro ao gerar PDF da equipe: " + (err.message || String(err)));
    }
  }

  async function copiarContatosDaEquipe(team: TeamRecord) {
    const contatos = [
      `EQUIPE: ${team.teamName}`,
      `Eixo: ${team.definir.eixo}`,
      `Líder: ${team.lider.nome} (E-mail: ${team.lider.email || "—"} | Tel: ${formatPhone(team.lider.telefone)})`,
      ...team.integrantes.map(
        (i) => `Integrante: ${i.nome} (E-mail: ${i.email || "—"} | Tel: ${formatPhone(i.telefone)} | Papel: ${i.papel || "—"})`
      ),
    ].join("\n");

    const success = await copyTextToClipboard(contatos);
    if (success) {
      showToast("Contatos copiados para a área de transferência!");
    } else {
      setMarkdownModal({
        isOpen: true,
        title: `Contatos da Equipe: ${team.teamName}`,
        content: contatos,
        copied: false,
      });
    }
  }

  function gerarMarkdownDaEquipe(team: TeamRecord): string {
    const md = [
      `# FICHA OFICIAL DA EQUIPE - INOVA SAÚDE 2026`,
      `**Equipe:** ${team.teamName}`,
      `**Protocolo / ID:** ${team.id}`,
      `**Status:** ${team.status === "CONFIRMED" ? "Confirmada" : "Pendente"}`,
      `**Trilha:** ${team.trilhaLabel}`,
      `**Eixo Temático:** ${team.definir.eixo}`,
      `**Data de Cadastro:** ${new Date(team.createdAt).toLocaleString("pt-BR")}`,
      ``,
      `---`,
      `## 1. INTEGRANTES DA EQUIPE (${team.totalIntegrantes})`,
      `### 👑 Líder: ${team.lider.nome}`,
      `- **CPF:** ${formatDocument(team.lider.cpf)}`,
      `- **E-mail:** ${team.lider.email || "—"}`,
      `- **Telefone / WhatsApp:** ${formatPhone(team.lider.telefone)}`,
      `- **Vínculo:** ${team.lider.vinculo || "—"} (${team.lider.curso || "—"})`,
      `- **Papel Declarado:** ${team.lider.papel || "—"}`,
      `- **Disponibilidade:** ${team.lider.disponibilidade.join("; ") || "Total"}`,
      `- **Competências:** ${team.lider.competencias.join(", ") || "Nenhuma informada"}`,
      ``,
      ...team.integrantes.map((i, idx) => [
        `### 👤 Integrante ${idx + 1}: ${i.nome}`,
        `- **CPF:** ${formatDocument(i.cpf)}`,
        `- **E-mail:** ${i.email || "—"}`,
        `- **Telefone / WhatsApp:** ${formatPhone(i.telefone)}`,
        `- **Vínculo:** ${i.vinculo || "—"} (${i.curso || "—"})`,
        `- **Papel Declarado:** ${i.papel || "—"}`,
        `- **Disponibilidade:** ${i.disponibilidade.join("; ") || "Total"}`,
        `- **Competências:** ${i.competencias.join(", ") || "Nenhuma informada"}`,
        ``,
      ].join("\n")),
      `---`,
      `## 2. EMPATIZAR (O USUÁRIO E A DOR)`,
      `- **Quem vive o problema:** ${team.empatizar.quem_vive || "—"}`,
      `- **O que perde / impacto:** ${team.empatizar.o_que_perde || "—"}`,
      `- **Como sabe disso:** ${team.empatizar.como_sabe.join(", ") || "—"}`,
      ``,
      `---`,
      `## 3. DEFINIR (O PROBLEMA E O CONTEXTO)`,
      `- **Eixo Temático:** ${team.definir.eixo}`,
      `- **Frequência com que ocorre:** ${team.definir.frequencia || "—"}`,
      `- **Como resolvem hoje:** ${team.definir.como_resolvem_hoje || "—"}`,
      `- **Por que a forma atual não resolve:** ${team.definir.por_que_nao_resolve || "—"}`,
      `- **Frase do Desafio:**`,
      `  - Quem: ${team.definir.frase.quem || "—"}`,
      `  - Precisa de: ${team.definir.frase.o_que || "—"}`,
      `  - Para que: ${team.definir.frase.por_que || "—"}`,
      `  - O que atrapalha: ${team.definir.frase.o_que_atrapalha || "—"}`,
      ``,
      `---`,
      `## 4. IDEAR (A SOLUÇÃO PROPOSTA)`,
      `- **Nome da Solução:** ${team.idear.nome_solucao}`,
      `- **Categoria:** ${team.idear.categoria}`,
      `- **3 Passos de Funcionamento:**`,
      ...team.idear.tres_passos.map((p, idx) => `  ${idx + 1}. ${p}`),
      ``,
      `---`,
      `## 5. ESCOPO (É, NÃO É, FAZ, NÃO FAZ)`,
      `- **O que É:** ${team.escopo.e || "—"}`,
      `- **O que NÃO É:** ${team.escopo.nao_e || "—"}`,
      `- **O que FAZ:**`,
      ...team.escopo.faz.map((f) => `  - ${f}`),
      `- **O que NÃO FAZ:**`,
      ...team.escopo.nao_faz.map((nf) => `  - ${nf}`),
      ``,
      `---`,
      `## 6. PROTOTIPAGEM & ESPECIFICAÇÕES TÉCNICAS`,
      `- **Formas de Protótipo:** ${team.forma.formas.map((f) => FORMAS_MAP[f]?.titulo || f).join(", ") || "—"}`,
      team.forma.peca_3d?.envelope_mm ? `- **Dimensões Envelope 3D:** ${team.forma.peca_3d.envelope_mm.join(" × ")} mm` : "",
      team.forma.peca_3d?.pecaEncaixaEm ? `- **Encaixe da Peça 3D:** ${team.forma.peca_3d.pecaEncaixaEm}` : "",
      team.forma.peca_3d?.material ? `- **Material Sugerido:** ${team.forma.peca_3d.material}` : "",
      `- **Trava Sanitária:** ${team.forma.trava_sanitaria.acionada ? "⚠️ ACIONADA (" + team.forma.trava_sanitaria.motivos.join(", ") + ")" : "✅ Não acionada"}`,
      `- **Habilidades que Faltam na Equipe:** ${team.faltaNaEquipe.join(", ") || "Nenhuma informada"}`,
      ``,
      `---`,
      `## 7. IMPACTO, VALIDAÇÃO & ODS DA ONU`,
      `- **Como saberemos se deu certo:** ${team.fechamento.como_saberemos || "—"}`,
      `- **Maior dúvida da equipe para a Maratona:** ${team.fechamento.maior_duvida || "—"}`,
      `- **ODS Vinculadas:** ${team.fechamento.ods.map((o) => `ODS ${o} - ${ODS_MAP[o]?.nome || ""}`).join("; ") || "Nenhuma"}`,
      `- **Aceites Legais:** ${team.fechamento.aceites.join("; ") || "—"}`,
      ...(team.avaliacao
        ? [
            `---`,
            `## 8. AVALIAÇÃO DA BANCA EXAMINADORA`,
            `- **Nota da Ideia:** ${team.avaliacao.nota}/10 ⭐`,
            team.avaliacao.posicao ? `- **Posição / Colocação:** ${team.avaliacao.posicao} 🏆` : "",
            team.avaliacao.comentario ? `- **Comentário / Parecer:** ${team.avaliacao.comentario}` : "",
            team.avaliacao.avaliadorNome ? `- **Avaliador(a):** ${team.avaliacao.avaliadorNome}` : "",
            team.avaliacao.atualizadoEm ? `- **Data da Avaliação:** ${new Date(team.avaliacao.atualizadoEm).toLocaleString("pt-BR")}` : "",
          ]
        : []),
      ...(team.trabalhos.length > 0
        ? [
            `---`,
            `## 9. ENTREGAS E LINKS DO PROTÓTIPO`,
            `- **Total de Entregas Cadastradas:** ${team.trabalhos.length}`,
            ...team.trabalhos.flatMap((t, idx) => [
              `### 📦 Entrega ${idx + 1} (${t.origem === "inscricao" ? "Inscrição" : "Envio Posterior"})`,
              t.data ? `- **Data de Envio:** ${new Date(t.data).toLocaleString("pt-BR")}` : "",
              t.videoUrl ? `- **Vídeo Pitch:** ${t.videoUrl}` : "",
              t.prototipoUrl ? `- **Protótipo / Apresentação:** ${t.prototipoUrl}` : "",
              t.observacoes ? `- **Observações:** ${t.observacoes}` : "",
              t.itens && t.itens.length > 0
                ? `- **Artefatos Complementares:**\n${t.itens.map((it: any) => `  - [${it.tipo}] ${it.titulo}: ${getValidExternalUrl(it.linkUrl || it.url || it.link)}`).join("\n")}`
                : "",
              "",
            ]),
          ]
        : []),
    ]
      .filter((l) => l !== "")
      .join("\n");

    return md;
  }

  async function copiarFichaMarkdownCompleta(team: TeamRecord) {
    const md = gerarMarkdownDaEquipe(team);
    const success = await copyTextToClipboard(md);
    if (success) {
      showToast("Ficha Completa em Markdown copiada com sucesso!");
    } else {
      setMarkdownModal({
        isOpen: true,
        title: `Ficha Completa - ${team.teamName}`,
        content: md,
        copied: false,
      });
    }
  }

  function abrirModalAvaliacao(team: TeamRecord) {
    setEvaluatingTeam(team);
    setEvaluationNota(team.avaliacao?.nota ?? null);
    setEvaluationPosicao(team.avaliacao?.posicao ?? "");
    setEvaluationComentario(team.avaliacao?.comentario ?? "");
    const storedAvaliador = typeof window !== "undefined" ? localStorage.getItem("inova_avaliador_nome") || "" : "";
    setEvaluationAvaliadorNome(team.avaliacao?.avaliadorNome ?? storedAvaliador);
  }

  async function salvarAvaliacao() {
    if (!evaluatingTeam) return;
    if (evaluationNota === null || evaluationNota < 1 || evaluationNota > 10) {
      alert("Por favor, selecione uma nota de 1 a 10 para a ideia da equipe.");
      return;
    }

    setSavingEvaluation(true);
    try {
      let baseNotesObj: any = {};
      try {
        if (evaluatingTeam.rawInscription.notes) {
          baseNotesObj = JSON.parse(evaluatingTeam.rawInscription.notes);
        }
      } catch {
        baseNotesObj = {};
      }

      const novaAvaliacao: TeamAvaliacao = {
        nota: evaluationNota,
        posicao: evaluationPosicao.trim() || undefined,
        comentario: evaluationComentario.trim() || undefined,
        avaliadorNome: evaluationAvaliadorNome.trim() || undefined,
        atualizadoEm: new Date().toISOString(),
      };

      baseNotesObj.avaliacao = novaAvaliacao;

      if (evaluationAvaliadorNome.trim() && typeof window !== "undefined") {
        localStorage.setItem("inova_avaliador_nome", evaluationAvaliadorNome.trim());
      }

      await api.updateInscription(eventId, evaluatingTeam.id, {
        notes: JSON.stringify(baseNotesObj),
      });

      showToast(`Avaliação da equipe "${evaluatingTeam.teamName}" salva com sucesso! ⭐ ${evaluationNota}/10`);

      if (selectedTeam && selectedTeam.id === evaluatingTeam.id) {
        setSelectedTeam({
          ...selectedTeam,
          avaliacao: novaAvaliacao,
          rawInscription: {
            ...selectedTeam.rawInscription,
            notes: JSON.stringify(baseNotesObj),
          },
        });
      }

      setEvaluatingTeam(null);
      await loadTeams();
    } catch (err) {
      alert("Erro ao salvar avaliação: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEvaluation(false);
    }
  }

  async function removerAvaliacao() {
    if (!evaluatingTeam) return;
    if (!confirm(`Deseja remover a avaliação da equipe "${evaluatingTeam.teamName}"?`)) return;

    setSavingEvaluation(true);
    try {
      let baseNotesObj: any = {};
      try {
        if (evaluatingTeam.rawInscription.notes) {
          baseNotesObj = JSON.parse(evaluatingTeam.rawInscription.notes);
        }
      } catch {
        baseNotesObj = {};
      }

      delete baseNotesObj.avaliacao;

      await api.updateInscription(eventId, evaluatingTeam.id, {
        notes: JSON.stringify(baseNotesObj),
      });

      showToast(`Avaliação removida com sucesso.`);

      if (selectedTeam && selectedTeam.id === evaluatingTeam.id) {
        setSelectedTeam({
          ...selectedTeam,
          avaliacao: undefined,
          rawInscription: {
            ...selectedTeam.rawInscription,
            notes: JSON.stringify(baseNotesObj),
          },
        });
      }

      setEvaluatingTeam(null);
      await loadTeams();
    } catch (err) {
      alert("Erro ao remover avaliação: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEvaluation(false);
    }
  }

  // ──── FUNÇÕES DE GERENCIAMENTO DE TRABALHO ENTREGUE ────
  function abrirModalTrabalho(team: TeamRecord) {
    setEditingWorkTeam(team);
    setWorkTeamName(team.teamName);

    const existing = team.trabalhos[0];
    let tituloExistente = "";
    try {
      const parsed = JSON.parse(team.rawInscription.notes || "{}");
      tituloExistente =
        parsed.trabalho_entregue?.titulo ||
        parsed.payload_completo?.trabalho_entregue?.titulo ||
        "";
    } catch {}

    setWorkTitulo(tituloExistente || team.idear.nome_solucao || team.teamName);
    setWorkPrototipoUrl(existing?.prototipoUrl || "");
    setWorkVideoUrl(existing?.videoUrl || "");
    setWorkObservacoes(existing?.observacoes || "");
    setWorkAcessoLiberado(existing?.acessoLiberado !== false);
    setWorkArtefatos(
      Array.isArray(existing?.itens)
        ? existing.itens.map((it: any) => ({
            tipo: it.tipo || "Arquivo",
            titulo: it.titulo || "",
            linkUrl: it.linkUrl || it.url || it.link || "",
          }))
        : []
    );
    setUploadError(null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingWorkTeam) return;

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("O arquivo excede o limite máximo de 20 MB.");
      return;
    }

    setUploadingFile(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataBase64 = await base64Promise;

      const res = await api.uploadTeamWorkFile(
        eventId,
        editingWorkTeam.id,
        file.name,
        dataBase64
      );

      // Se o campo do protótipo estiver vazio ou for link de PDF anterior, define a URL enviada
      if (!workPrototipoUrl.trim() || workPrototipoUrl.toLowerCase().endsWith(".pdf")) {
        setWorkPrototipoUrl(res.url);
      }

      // Adiciona como artefato complementar na lista
      const ext = file.name.split(".").pop()?.toUpperCase() || "PDF";
      setWorkArtefatos((prev) => [
        ...prev,
        {
          tipo: ext,
          titulo: file.name,
          linkUrl: res.url,
        },
      ]);

      showToast(`Arquivo "${file.name}" anexado com sucesso! 📄`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar arquivo");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  }

  async function salvarTrabalhoEquipe() {
    if (!editingWorkTeam) return;

    if (!workPrototipoUrl.trim() && !workVideoUrl.trim() && workArtefatos.length === 0) {
      alert(
        "Por favor, informe ao menos um link (Protótipo/Apresentação/Figma, Vídeo Pitch ou Arquivo anexado)."
      );
      return;
    }

    setSavingWork(true);
    try {
      let baseNotesObj: any = {};
      try {
        if (editingWorkTeam.rawInscription.notes) {
          baseNotesObj = JSON.parse(editingWorkTeam.rawInscription.notes);
        }
      } catch {
        baseNotesObj = {};
      }

      const novoTrabalho = {
        titulo: workTitulo.trim() || editingWorkTeam.teamName,
        prototipo_url: workPrototipoUrl.trim() || undefined,
        video_url: workVideoUrl.trim() || undefined,
        observacoes: workObservacoes.trim() || undefined,
        acesso_liberado: workAcessoLiberado,
        artefatos_adicionais: workArtefatos
          .filter((a) => a.linkUrl.trim())
          .map((a) => ({
            tipo: a.tipo.trim() || "Link",
            titulo: a.titulo.trim() || a.linkUrl.trim(),
            linkUrl: a.linkUrl.trim(),
            url: a.linkUrl.trim(),
          })),
        enviado_em: new Date().toISOString(),
      };

      baseNotesObj.trabalho_entregue = novoTrabalho;
      if (baseNotesObj.payload_completo) {
        baseNotesObj.payload_completo.trabalho_entregue = novoTrabalho;
      }

      const novoNomeEquipe = workTeamName.trim() || editingWorkTeam.teamName;
      if (novoNomeEquipe !== editingWorkTeam.teamName) {
        baseNotesObj.equipeNome = novoNomeEquipe;
        if (baseNotesObj.payload_completo) {
          baseNotesObj.payload_completo.equipeNome = novoNomeEquipe;
        }
      }

      await api.updateInscription(eventId, editingWorkTeam.id, {
        teamName: novoNomeEquipe,
        notes: JSON.stringify(baseNotesObj),
      });

      showToast(`Trabalho da equipe "${novoNomeEquipe}" salvo com sucesso! 📦`);

      setEditingWorkTeam(null);
      await loadTeams();

      if (selectedTeam && selectedTeam.id === editingWorkTeam.id) {
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                teamName: novoNomeEquipe,
                trabalhos: [
                  {
                    origem: "inscricao",
                    data: novoTrabalho.enviado_em,
                    videoUrl: novoTrabalho.video_url,
                    prototipoUrl: novoTrabalho.prototipo_url,
                    observacoes: novoTrabalho.observacoes,
                    acessoLiberado: novoTrabalho.acesso_liberado,
                    itens: novoTrabalho.artefatos_adicionais,
                  },
                ],
              }
            : null
        );
      }
    } catch (err) {
      alert("Erro ao salvar trabalho: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingWork(false);
    }
  }

  async function removerTrabalhoEquipe() {
    if (!editingWorkTeam) return;
    if (
      !confirm(
        `Deseja realmente remover o trabalho entregue da equipe "${editingWorkTeam.teamName}"?`
      )
    ) {
      return;
    }

    setSavingWork(true);
    try {
      let baseNotesObj: any = {};
      try {
        if (editingWorkTeam.rawInscription.notes) {
          baseNotesObj = JSON.parse(editingWorkTeam.rawInscription.notes);
        }
      } catch {
        baseNotesObj = {};
      }

      delete baseNotesObj.trabalho_entregue;
      if (baseNotesObj.payload_completo) {
        delete baseNotesObj.payload_completo.trabalho_entregue;
      }

      await api.updateInscription(eventId, editingWorkTeam.id, {
        notes: JSON.stringify(baseNotesObj),
      });

      showToast(`Trabalho entregue da equipe "${editingWorkTeam.teamName}" removido.`);
      setEditingWorkTeam(null);
      await loadTeams();

      if (selectedTeam && selectedTeam.id === editingWorkTeam.id) {
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                trabalhos: [],
              }
            : null
        );
      }
    } catch (err) {
      alert("Erro ao remover trabalho: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingWork(false);
    }
  }

  function imprimirFicha() {
    window.print();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ──── ESTILOS DE IMPRESSÃO EMBUTIDOS ──── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #inova-printable-team-sheet,
          #inova-printable-team-sheet * {
            visibility: visible !important;
          }
          #inova-printable-team-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 24px !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: 1px solid #ccc !important;
            padding: 12px !important;
            margin-bottom: 14px !important;
            background: #fdfdfd !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* ──── TOAST FEEDBACK FLUTUANTE ──── */}
      {copiedToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 10000,
            background: "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            fontWeight: 600,
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckIcon size={18} />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* ──── CABEÇALHO E ESTATÍSTICAS ──── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
            Equipes Formadas no INOVA SAÚDE
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
            Acesso completo a todas as informações cadastradas pelas líderes para conferência e mentoria no dia do evento.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTeams}
          className="btn btn-secondary btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshIcon size={14} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(45, 212, 191, 0.15)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UsersIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Equipes Registradas
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800 }}>{teams.length}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IdCardIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Integrantes Confirmados
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800 }}>{totalMembrosAlocados}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayersIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Projetos com Peça 3D
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800 }}>{totalComPrototipo3D}</div>
          </div>
        </div>

        <div
          className="card"
          onClick={() => setMainView("talentos")}
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            cursor: "pointer",
            border: mainView === "talentos" ? "1.5px solid #ffb340" : "1px solid var(--border)",
            background: mainView === "talentos" ? "rgba(234, 179, 8, 0.08)" : undefined,
            transition: "all 0.15s ease",
          }}
          title="Clique para ver todos os participantes sem equipe"
        >
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(234, 179, 8, 0.15)", color: "#ffb340", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UsersIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Banco de Talentos (Sem Equipe)
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: "#ffb340" }}>{bancoDeTalentos.length}</div>
          </div>
        </div>
      </div>

      {/* ──── SELETOR DE VISUALIZAÇÃO: EQUIPES OU BANCO DE TALENTOS & AÇÕES DE EXPORTAÇÃO ──── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setMainView("equipes")}
            className={`btn btn-sm ${mainView === "equipes" ? "" : "btn-secondary"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <UsersIcon size={14} />
            <span>Equipes Formadas ({teams.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMainView("talentos")}
            className={`btn btn-sm ${mainView === "talentos" ? "" : "btn-secondary"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: mainView === "talentos" ? "rgba(234, 179, 8, 0.2)" : undefined,
              color: mainView === "talentos" ? "#ffb340" : undefined,
              borderColor: mainView === "talentos" ? "#ffb340" : undefined,
            }}
          >
            <span>⚠️ Banco de Talentos / Sem Equipe ({bancoDeTalentos.length})</span>
          </button>
        </div>

        {/* ──── BOTÃO BAIXAR ZIP COM TODAS AS EQUIPES PARA OS AVALIADORES (SIGILO) ──── */}
        <div>
          <button
            type="button"
            onClick={handleExportZipAvaliadores}
            disabled={exportingZip || teams.length === 0}
            className="btn btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "linear-gradient(135deg, #0E3634 0%, #165b57 100%)",
              color: "#ffffff",
              border: "1px solid #C8A261",
              fontWeight: 700,
              padding: "7px 14px",
              borderRadius: "8px",
              boxShadow: "0 2px 6px rgba(14, 54, 52, 0.25)",
              cursor: exportingZip || teams.length === 0 ? "not-allowed" : "pointer",
              opacity: exportingZip || teams.length === 0 ? 0.7 : 1,
            }}
            title="Compacta todas as equipes em um único arquivo ZIP com os PDFs de avaliação anônimos (sem nomes e contatos pessoais)."
          >
            <DownloadIcon size={15} />
            <span>
              {exportingZip
                ? (exportProgress || "Gerando ZIP com Sigilo...")
                : `Baixar ZIP das Equipes para Avaliadores (Com Sigilo) [${teams.length}]`}
            </span>
          </button>
        </div>
      </div>

      {/* ──── FILTROS E BUSCA ──── */}
      <div className="card" style={{ padding: "14px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", flex: "1 1 280px" }}>
          <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
            <SearchIcon size={16} />
          </span>
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por equipe, líder, CPF ou integrante..."
            style={{ paddingLeft: "36px", width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          {eixosDisponiveis.length > 0 && (
            <select
              className="input"
              value={filtroEixo}
              onChange={(e) => setFiltroEixo(e.target.value)}
              style={{ width: "auto", minWidth: "180px" }}
            >
              <option value="TODOS">Todos os Eixos ({teams.length})</option>
              {eixosDisponiveis.map((eixo) => (
                <option key={eixo} value={eixo}>
                  {eixo}
                </option>
              ))}
            </select>
          )}

          <select
            className="input"
            value={filtroForma}
            onChange={(e) => setFiltroForma(e.target.value)}
            style={{ width: "auto", minWidth: "160px" }}
          >
            <option value="TODAS">Todas as Formas</option>
            <option value="forma_b">Peça 3D</option>
            <option value="forma_a">Software</option>
            <option value="forma_c">Serviço / Fluxo</option>
            <option value="forma_d">Comunicação Visual</option>
          </select>
        </div>
      </div>

      {/* ──── ESTADOS DE CARREGAMENTO / ERRO ──── */}
      {loading && (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Carregando informações completas das equipes...
        </div>
      )}

      {error && (
        <div className="badge badge-danger" style={{ padding: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* ──── GRADE DE EQUIPES OU BANCO DE TALENTOS ──── */}
      {mainView === "talentos" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "rgba(234, 179, 8, 0.12)",
              border: "1px solid rgba(234, 179, 8, 0.4)",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <strong style={{ color: "#ffb340", fontSize: 14 }}>
                  Banco de Talentos Individual ({filteredTalentos.length} participantes sem equipe)
                </strong>
                <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                  Estes participantes se inscreveram no evento individualmente. Utilize as ações de WhatsApp para chamá-los ou copie a ficha em Markdown para alocá-los nas equipes.
                </p>
              </div>
            </div>
          </div>

          {!loading && filteredTalentos.length === 0 ? (
            <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
              <UsersIcon size={44} style={{ opacity: 0.4, marginBottom: "8px" }} />
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--text)" }}>Nenhum participante sem equipe encontrado</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>Nenhum participante do Banco de Talentos corresponde à busca informada.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
              {filteredTalentos.map((ins) => {
                const notes = parseInscriptionNotes(ins);
                const member = notes?.membros_detalhes?.[0] || notes?.payload_completo?.lider || {};
                const ficha = notes?.ficha_prototipo || notes?.payload_completo?.ficha_prototipo || {};
                const curso = member.curso?.trim() || ins.institution?.trim();
                const vinculo = member.vinculo?.trim();
                const papel = member.papel?.trim();
                const competencias = Array.isArray(member.competencias) ? member.competencias : [];
                const faltaNaEquipe = Array.isArray(ficha.falta_na_equipe) ? ficha.falta_na_equipe : [];
                const inviteUrl = getWhatsAppInviteUrl(ins, "INOVA SAÚDE 2026");

                return (
                  <div
                    key={ins.id}
                    className="card"
                    style={{
                      padding: "20px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px",
                      border: "1px solid rgba(234, 179, 8, 0.35)",
                      background: "rgba(28, 28, 30, 0.65)",
                    }}
                  >
                    <div>
                      {/* Topo do Card */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text)" }}>
                            {ins.name}
                          </h3>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                            {ins.email}
                          </div>
                        </div>
                        <span className={`badge ${ins.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                          {ins.status === "CONFIRMED" ? "Confirmado" : "Pendente"}
                        </span>
                      </div>

                      {/* Informações de Curso e Vínculo */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                        <span className="badge" style={{ background: "rgba(234, 179, 8, 0.2)", color: "#ffb340", borderColor: "rgba(234, 179, 8, 0.4)", fontSize: "11px", fontWeight: 700 }}>
                          Banco de Talentos
                        </span>
                        {curso && (
                          <span className="badge badge-purple" style={{ fontSize: "11px" }}>
                            🎓 {curso}
                          </span>
                        )}
                        {vinculo && (
                          <span className="badge" style={{ fontSize: "11px" }}>
                            💼 {vinculo}
                          </span>
                        )}
                        {papel && papel !== "Ainda nao sei" && (
                          <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                            ⚡ {papel}
                          </span>
                        )}
                      </div>

                      {/* Telefone com Popover */}
                      <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="muted" style={{ fontSize: 12 }}>Telefone:</span>
                        <PhoneWhatsAppPopover
                          item={ins}
                          eventName="INOVA SAÚDE 2026"
                          onNotify={(msg) => showToast(msg)}
                        />
                      </div>

                      {/* Competências Declaradas */}
                      {competencias.length > 0 && (
                        <div style={{ marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
                            Competências & Habilidades ({competencias.length}):
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {competencias.map((c: string) => (
                              <span
                                key={c}
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "rgba(255, 255, 255, 0.08)",
                                  color: "var(--text)",
                                  border: "1px solid rgba(255, 255, 255, 0.12)",
                                }}
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Eixo de Preferência */}
                      {(ficha.eixo || notes?.definir?.eixo) && (
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
                          <strong style={{ color: "var(--text)" }}>Eixo de Interesse:</strong> {ficha.eixo || notes?.definir?.eixo}
                        </div>
                      )}

                      {/* O que busca em equipe */}
                      {faltaNaEquipe.length > 0 && (
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          <strong style={{ color: "var(--text)" }}>Busca em equipe:</strong> {faltaNaEquipe.join(", ")}
                        </div>
                      )}
                    </div>

                    {/* Barra de Ações Rápidas */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {inviteUrl && (
                          <a
                            href={inviteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm"
                            style={{
                              flex: 1,
                              background: "#25D366",
                              color: "#000",
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              fontSize: "12px",
                              textDecoration: "none",
                              padding: "6px 10px",
                            }}
                          >
                            <WhatsAppIcon size={14} color="#000" />
                            <span>Convidar no WhatsApp</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            const md = generateInscriptionMarkdown(ins, "INOVA SAÚDE 2026");
                            const ok = await copyTextToClipboard(md);
                            if (ok) {
                              showToast(`Ficha completa de ${ins.name} copiada!`);
                            } else {
                              setMarkdownModal({
                                isOpen: true,
                                title: `Ficha de ${ins.name}`,
                                content: md,
                                copied: false,
                              });
                            }
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            padding: "6px 10px",
                          }}
                          title="Copiar Ficha Completa em Markdown"
                        >
                          <CopyIcon size={13} />
                          <span>Ficha MD</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      /* ──── GRADE DE EQUIPES ──── */
      !loading && filteredTeams.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
          <UsersIcon size={44} style={{ opacity: 0.4, marginBottom: "8px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--text)" }}>Nenhuma equipe encontrada</h3>
          <p style={{ margin: 0, fontSize: "13px" }}>Nenhuma equipe corresponde aos filtros informados.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "16px" }}>
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="card"
              onClick={() => {
                setSelectedTeam(team);
                setModalTab("todos");
              }}
              style={{
                padding: "20px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                border: selectedTeam?.id === team.id ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "14px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>
                    {team.teamName}
                  </h3>
                  <span className={`badge ${team.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                    {team.status === "CONFIRMED" ? "Confirmada" : "Pendente"}
                  </span>
                </div>

                {/* Badges de Destaque */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                    👥 {team.totalIntegrantes} integrante(s)
                  </span>
                  {team.trabalhos.length > 0 ? (
                    <span
                      className="badge badge-success"
                      style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      title="Esta equipe já possui trabalho/protótipo entregue"
                    >
                      📦 Trabalho Entregue ({team.trabalhos.length})
                    </span>
                  ) : (
                    <span
                      className="badge badge-muted"
                      style={{ fontSize: "11px", opacity: 0.75 }}
                      title="Aguardando envio do trabalho ou protótipo"
                    >
                      ⏳ Sem Trabalho
                    </span>
                  )}
                  {team.forma.formas.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        background: `${FORMAS_MAP[f]?.cor || "#6b7280"}25`,
                        color: FORMAS_MAP[f]?.cor || "#9ca3af",
                        fontWeight: 600,
                      }}
                    >
                      {FORMAS_MAP[f]?.badge || f}
                    </span>
                  ))}
                  {team.fechamento.ods.slice(0, 2).map((odsNum) => (
                    <span
                      key={odsNum}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: ODS_MAP[odsNum]?.cor || "#333",
                        color: "#ffffff",
                        fontWeight: 700,
                      }}
                    >
                      ODS {odsNum}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600, marginBottom: "6px" }}>
                  🎯 {team.definir.eixo}
                </div>

                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  "{team.empatizar.o_que_perde || team.idear.nome_solucao}"
                </p>

                {/* Resumo de Integrantes */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                    👑 Líder: {team.lider.nome} {team.lider.curso ? `(${team.lider.curso})` : ""}
                  </div>
                  {team.integrantes.length > 0 && (
                    <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      <span style={{ fontWeight: 500 }}>Demais membros:</span>{" "}
                      {team.integrantes.map((i) => i.nome).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Avaliação da Ideia & Nota ─── */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }} onClick={(e) => e.stopPropagation()}>
                {team.avaliacao ? (
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.08)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderRadius: "8px",
                      padding: "6px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span
                        style={{
                          background:
                            team.avaliacao.nota >= 9
                              ? "#10b981"
                              : team.avaliacao.nota >= 7
                              ? "#06b6d4"
                              : team.avaliacao.nota >= 5
                              ? "#f59e0b"
                              : "#ef4444",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: "11px",
                          padding: "2px 7px",
                          borderRadius: "6px",
                        }}
                      >
                        ⭐ {team.avaliacao.nota}/10
                      </span>
                      {team.avaliacao.posicao && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24" }}>
                          🏆 {team.avaliacao.posicao}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "2px 8px", fontSize: "11px", height: "auto" }}
                      onClick={() => abrirModalAvaliacao(team)}
                    >
                      Editar Nota
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: "100%",
                      padding: "5px 10px",
                      fontSize: "11px",
                      height: "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                      color: "#fbbf24",
                      background: "rgba(245, 158, 11, 0.06)",
                    }}
                    onClick={() => abrirModalAvaliacao(team)}
                  >
                    ⭐ Avaliar Ideia & Nota (1-10)
                  </button>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  Ver ficha completa <ArrowRightIcon size={12} />
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {new Date(team.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ──── MODAL DE DETALHES COMPLETOS DA EQUIPE ──── */}
      {selectedTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setSelectedTeam(null)}
        >
          <div
            id="inova-printable-team-sheet"
            className="card"
            style={{
              maxWidth: "850px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "28px",
              position: "relative",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar (Oculto na impressão) */}
            <button
              type="button"
              className="no-print"
              onClick={() => setSelectedTeam(null)}
              style={{
                position: "absolute",
                right: "16px",
                top: "16px",
                background: "rgba(255,255,255,0.08)",
                border: "none",
                cursor: "pointer",
                color: "var(--text)",
                padding: "8px",
                borderRadius: "8px",
              }}
            >
              <XIcon size={20} />
            </button>

            {/* Cabeçalho da Equipe */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                  {selectedTeam.trilhaLabel}
                </span>
                <span className={`badge ${selectedTeam.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                  {selectedTeam.status === "CONFIRMED" ? "Inscrição Confirmada" : "Pendente"}
                </span>
                {selectedTeam.fechamento.aberta_a_novos ? (
                  <span className="badge badge-amber" style={{ fontSize: "11px" }}>
                    {selectedTeam.vagasRestantes} vaga(s) aberta(s)
                  </span>
                ) : (
                  <span className="badge badge-muted" style={{ fontSize: "11px" }}>
                    Equipe Completa / Fechada
                  </span>
                )}
              </div>

              <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "6px 0", color: "var(--text)" }}>
                {selectedTeam.teamName}
              </h1>

              <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <span>Protocolo: <code>{selectedTeam.id}</code></span>
                <span>•</span>
                <span>Eixo: <strong>{selectedTeam.definir.eixo}</strong></span>
                <span>•</span>
                <span>Inscrito em {new Date(selectedTeam.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            {/* ──── BARRA DE AÇÕES RÁPIDAS (OCULTO NA IMPRESSÃO) ──── */}
            <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
              {getWhatsAppUrl(selectedTeam.lider.telefone, selectedTeam.lider.nome) && (
                <a
                  href={getWhatsAppUrl(selectedTeam.lider.telefone, selectedTeam.lider.nome)!}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}
                >
                  <MessageIcon size={14} />
                  <span>WhatsApp do Líder</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => copiarContatosDaEquipe(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <PhoneIcon size={14} />
                <span>Copiar Todos os Contatos</span>
              </button>

              <button
                type="button"
                onClick={() => copiarFichaMarkdownCompleta(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <CopyIcon size={14} />
                <span>Copiar Ficha Completa (Markdown)</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMarkdownModal({
                    isOpen: true,
                    title: `Ficha Oficial da Equipe: ${selectedTeam.teamName}`,
                    content: gerarMarkdownDaEquipe(selectedTeam),
                    copied: false,
                  })
                }
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <DownloadIcon size={14} />
                <span>Ver / Baixar Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadSingleTeamPdf(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#0E3634",
                  borderColor: "#C8A261",
                  fontWeight: 600,
                  backgroundColor: "rgba(200, 162, 97, 0.12)",
                }}
                title="Gera o PDF formatado desta equipe para os avaliadores, com todas as informações técnicas e artefatos, mantendo o sigilo de dados pessoais e de contato."
              >
                <DownloadIcon size={14} />
                <span>PDF de Avaliação (Com Sigilo)</span>
              </button>

              <button
                type="button"
                onClick={imprimirFicha}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <LayersIcon size={14} />
                <span>🖨️ Imprimir Ficha</span>
              </button>

              <button
                type="button"
                onClick={() => abrirModalTrabalho(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: selectedTeam.trabalhos.length > 0 ? "#10b981" : "#38bdf8",
                  borderColor:
                    selectedTeam.trabalhos.length > 0
                      ? "rgba(16, 185, 129, 0.4)"
                      : "rgba(56, 189, 248, 0.4)",
                  background:
                    selectedTeam.trabalhos.length > 0
                      ? "rgba(16, 185, 129, 0.08)"
                      : "rgba(56, 189, 248, 0.08)",
                }}
              >
                <span>
                  📦{" "}
                  {selectedTeam.trabalhos.length > 0
                    ? `Trabalho Entregue (${selectedTeam.trabalhos.length})`
                    : "Adicionar Trabalho Entregue"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => abrirModalAvaliacao(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#fbbf24",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                  background: "rgba(245, 158, 11, 0.1)",
                }}
              >
                <span>
                  ⭐{" "}
                  {selectedTeam.avaliacao
                    ? `Nota: ${selectedTeam.avaliacao.nota}/10 (${selectedTeam.avaliacao.posicao || "Editar"})`
                    : "Avaliar Ideia da Equipe"}
                </span>
              </button>
            </div>

            {/* ──── BANNER DE AVALIAÇÃO DA BANCA ──── */}
            {selectedTeam.avaliacao ? (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background:
                          selectedTeam.avaliacao.nota >= 9
                            ? "#10b981"
                            : selectedTeam.avaliacao.nota >= 7
                            ? "#06b6d4"
                            : selectedTeam.avaliacao.nota >= 5
                            ? "#f59e0b"
                            : "#ef4444",
                        color: "#ffffff",
                        fontWeight: 800,
                        fontSize: "14px",
                        padding: "4px 12px",
                        borderRadius: "8px",
                      }}
                    >
                      ⭐ Nota da Ideia: {selectedTeam.avaliacao.nota}/10
                    </span>
                    {selectedTeam.avaliacao.posicao && (
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "#fbbf24" }}>
                        🏆 {selectedTeam.avaliacao.posicao}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm no-print"
                    onClick={() => abrirModalAvaliacao(selectedTeam)}
                  >
                    ✏️ Editar Avaliação
                  </button>
                </div>

                {selectedTeam.avaliacao.comentario && (
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text)",
                      lineHeight: 1.5,
                      background: "rgba(0,0,0,0.18)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      borderLeft: "3px solid #10b981",
                    }}
                  >
                    <strong style={{ color: "#10b981" }}>Parecer do Avaliador:</strong> {selectedTeam.avaliacao.comentario}
                  </div>
                )}

                <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {selectedTeam.avaliacao.avaliadorNome && (
                    <span>Avaliador: <strong>{selectedTeam.avaliacao.avaliadorNome}</strong></span>
                  )}
                  {selectedTeam.avaliacao.atualizadoEm && (
                    <span>Avaliado em {new Date(selectedTeam.avaliacao.atualizadoEm).toLocaleString("pt-BR")}</span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="no-print"
                style={{
                  marginBottom: "20px",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: "rgba(245, 158, 11, 0.05)",
                  border: "1px dashed rgba(245, 158, 11, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  ⭐ Esta equipe ainda não possui nota atribuída por um avaliador.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.4)" }}
                  onClick={() => abrirModalAvaliacao(selectedTeam)}
                >
                  ⭐ Avaliar Ideia & Nota
                </button>
              </div>
            )}

            {/* ──── NAVEGAÇÃO POR ABAS INTERNAS NO MODAL (OCULTO NA IMPRESSÃO) ──── */}
            <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "22px", background: "rgba(255,255,255,0.04)", padding: "4px", borderRadius: "10px" }}>
              {[
                { id: "todos", label: "📋 Visão Completa" },
                { id: "integrantes", label: `👥 Integrantes (${selectedTeam.totalIntegrantes})` },
                { id: "problema", label: "🎯 Problema & Contexto" },
                { id: "solucao", label: "💡 Solução & Escopo" },
                { id: "prototipo", label: "🛠️ Prototipagem & 3D" },
                { id: "ods", label: "🌍 Impacto & ODS" },
                { id: "entregas", label: `📦 Entregas (${selectedTeam.trabalhos.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setModalTab(tab.id as ModalSubTab)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    background: modalTab === tab.id ? "var(--accent)" : "transparent",
                    color: modalTab === tab.id ? "#000000" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ──── CONTEÚDO DAS SEÇÕES ──── */}

            {/* 1. SEÇÃO DE INTEGRANTES */}
            {(modalTab === "todos" || modalTab === "integrantes") && (
              <div className="print-card" style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <UsersIcon size={16} /> 1. Integrantes da Equipe ({selectedTeam.totalIntegrantes})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Card do Líder */}
                  <div
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "rgba(45, 212, 191, 0.08)",
                      border: "1px solid rgba(45, 212, 191, 0.25)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                      <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)" }}>
                        👑 {selectedTeam.lider.nome}
                      </div>
                      <span className="badge badge-cyan" style={{ fontSize: "10px" }}>
                        Líder Responsável
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "6px" }}>
                      {selectedTeam.lider.cpf && (
                        <span>
                          <strong>CPF:</strong> {formatDocument(selectedTeam.lider.cpf)}
                        </span>
                      )}
                      {selectedTeam.lider.email && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <MailIcon size={13} /> {selectedTeam.lider.email}
                        </span>
                      )}
                      {selectedTeam.lider.telefone && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <PhoneIcon size={13} /> {formatPhone(selectedTeam.lider.telefone)}
                        </span>
                      )}
                      {selectedTeam.lider.curso && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <GradCapIcon size={13} /> {selectedTeam.lider.curso}
                        </span>
                      )}
                      {selectedTeam.lider.vinculo && (
                        <span>
                          <strong>Vínculo:</strong> {selectedTeam.lider.vinculo}
                        </span>
                      )}
                    </div>

                    {selectedTeam.lider.papel && (
                      <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text)" }}>
                        <strong>Papel na equipe:</strong> {selectedTeam.lider.papel}
                      </div>
                    )}

                    {selectedTeam.lider.disponibilidade && selectedTeam.lider.disponibilidade.length > 0 && (
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                        <strong>Disponibilidade informada:</strong> {selectedTeam.lider.disponibilidade.join("; ")}
                      </div>
                    )}

                    {selectedTeam.lider.competencias && selectedTeam.lider.competencias.length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {selectedTeam.lider.competencias.map((c, i) => (
                          <span key={i} className="badge badge-muted" style={{ fontSize: "10px" }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Demais Membros */}
                  {selectedTeam.integrantes.map((membro, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "14px",
                        borderRadius: "12px",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "4px" }}>
                        <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text)" }}>
                          👤 {membro.nome}
                        </div>
                        <span className="badge badge-muted" style={{ fontSize: "10px" }}>
                          {membro.papel || "Integrante"}
                        </span>
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "4px" }}>
                        {membro.cpf && (
                          <span>
                            <strong>CPF:</strong> {formatDocument(membro.cpf)}
                          </span>
                        )}
                        {membro.email && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <MailIcon size={13} /> {membro.email}
                          </span>
                        )}
                        {membro.telefone && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <PhoneIcon size={13} /> {formatPhone(membro.telefone)}
                          </span>
                        )}
                        {membro.curso && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <GradCapIcon size={13} /> {membro.curso}
                          </span>
                        )}
                        {membro.vinculo && (
                          <span>
                            <strong>Vínculo:</strong> {membro.vinculo}
                          </span>
                        )}
                      </div>

                      {membro.disponibilidade && membro.disponibilidade.length > 0 && (
                        <div style={{ marginTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                          <strong>Disponibilidade:</strong> {membro.disponibilidade.join("; ")}
                        </div>
                      )}

                      {membro.competencias && membro.competencias.length > 0 && (
                        <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {membro.competencias.map((c, i) => (
                            <span key={i} className="badge badge-muted" style={{ fontSize: "10px" }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. SEÇÃO EMPATIZAR & DEFINIR (PROBLEMA E CONTEXTO) */}
            {(modalTab === "todos" || modalTab === "problema") && (
              <div className="print-card" style={{ marginBottom: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  🎯 2. Empatizar e Definir (O Problema e o Contexto)
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                      👤 Quem vive o problema (Usuário / Paciente / Profissional):
                    </div>
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedTeam.empatizar.quem_vive || "Não informado"}
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                      ⚠️ O que perde / Dor e impacto do problema:
                    </div>
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedTeam.empatizar.o_que_perde || "Não informado"}
                    </div>
                  </div>

                  {selectedTeam.empatizar.como_sabe.length > 0 && (
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Como a equipe sabe disso: </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {selectedTeam.empatizar.como_sabe.join(", ")}
                      </span>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Frequência do problema: </span>
                      <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                        {selectedTeam.definir.frequencia || "Não informado"}
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Eixo Temático: </span>
                      <div style={{ color: "var(--accent)", fontWeight: 600, marginTop: "2px" }}>
                        {selectedTeam.definir.eixo}
                      </div>
                    </div>
                  </div>

                  {selectedTeam.definir.como_resolvem_hoje && (
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                        🔄 Como as pessoas resolvem ou contornam hoje:
                      </div>
                      <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {selectedTeam.definir.como_resolvem_hoje}
                      </div>
                    </div>
                  )}

                  {selectedTeam.definir.por_que_nao_resolve && (
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                        ❌ Por que a solução atual não resolve:
                      </div>
                      <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {selectedTeam.definir.por_que_nao_resolve}
                      </div>
                    </div>
                  )}

                  {/* Frase Estruturada do Desafio */}
                  {(selectedTeam.definir.frase.quem || selectedTeam.definir.frase.o_que) && (
                    <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.2)", padding: "14px", borderRadius: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: "8px", fontSize: "12px", textTransform: "uppercase" }}>
                        📝 Frase Estruturada do Problema
                      </div>
                      <div style={{ lineHeight: 1.6, color: "var(--text)" }}>
                        {selectedTeam.definir.frase.quem && <span><strong>Para:</strong> {selectedTeam.definir.frase.quem} </span>}
                        {selectedTeam.definir.frase.o_que && <span><strong>Que precisa de:</strong> {selectedTeam.definir.frase.o_que} </span>}
                        {selectedTeam.definir.frase.por_que && <span><strong>Para que:</strong> {selectedTeam.definir.frase.por_que} </span>}
                        {selectedTeam.definir.frase.o_que_atrapalha && <span><strong>Mas hoje:</strong> {selectedTeam.definir.frase.o_que_atrapalha}</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. SEÇÃO IDEAR & ESCOPO */}
            {(modalTab === "todos" || modalTab === "solucao" || modalTab === "escopo") && (
              <div className="print-card" style={{ marginBottom: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  💡 3. Idear e Escopo (A Solução e Seus Limites)
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Nome da Solução: </span>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent)", marginTop: "4px" }}>
                        {selectedTeam.idear.nome_solucao}
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Categoria do Produto: </span>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text)", marginTop: "4px" }}>
                        {selectedTeam.idear.categoria}
                      </div>
                    </div>
                  </div>

                  {/* 3 Passos de Funcionamento */}
                  {selectedTeam.idear.tres_passos.length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "14px", borderRadius: "10px", border: "1px solid var(--border)" }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>
                        ⚙️ Como a Solução Funciona (3 Passos):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedTeam.idear.tres_passos.map((passo, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                            <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--accent)", color: "#000", fontWeight: 800, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>{passo}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matriz É, NÃO É, FAZ, NÃO FAZ */}
                  <div style={{ marginTop: "4px" }}>
                    <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "8px", fontSize: "14px" }}>
                      📐 Matriz de Escopo (O que é e o que não é)
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                      <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", padding: "12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 700, color: "#10b981", marginBottom: "4px" }}>✅ É</div>
                        <div style={{ color: "var(--text)", lineHeight: 1.4 }}>{selectedTeam.escopo.e || "Não informado"}</div>
                      </div>

                      <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: "4px" }}>❌ NÃO É</div>
                        <div style={{ color: "var(--text)", lineHeight: 1.4 }}>{selectedTeam.escopo.nao_e || "Não informado"}</div>
                      </div>

                      <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", padding: "12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: "4px" }}>⚙️ FAZ</div>
                        {selectedTeam.escopo.faz.length > 0 ? (
                          <ul style={{ margin: "4px 0 0", paddingLeft: "18px", color: "var(--text)", lineHeight: 1.4 }}>
                            {selectedTeam.escopo.faz.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ color: "var(--text-muted)" }}>Não informado</div>
                        )}
                      </div>

                      <div style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "12px", borderRadius: "8px" }}>
                        <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>🚫 NÃO FAZ</div>
                        {selectedTeam.escopo.nao_faz.length > 0 ? (
                          <ul style={{ margin: "4px 0 0", paddingLeft: "18px", color: "var(--text)", lineHeight: 1.4 }}>
                            {selectedTeam.escopo.nao_faz.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <div style={{ color: "var(--text-muted)" }}>Não informado</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SEÇÃO PROTOTIPAGEM & ESPECIFICAÇÃO TÉCNICA */}
            {(modalTab === "todos" || modalTab === "prototipo") && (
              <div className="print-card" style={{ marginBottom: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  🛠️ 4. Prototipagem, Especificações e Trava Sanitária
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                  {/* Formas Escolhidas */}
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Formas de Protótipo Escolhidas: </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {selectedTeam.forma.formas.map((f) => (
                        <span
                          key={f}
                          className="badge"
                          style={{
                            background: `${FORMAS_MAP[f]?.cor || "#6b7280"}25`,
                            color: FORMAS_MAP[f]?.cor || "var(--text)",
                            border: `1px solid ${FORMAS_MAP[f]?.cor || "#6b7280"}50`,
                            fontSize: "12px",
                            padding: "4px 10px",
                          }}
                        >
                          {FORMAS_MAP[f]?.titulo || f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Detalhes de Peça 3D */}
                  {selectedTeam.forma.peca_3d && (selectedTeam.forma.formas.includes("forma_b") || selectedTeam.forma.peca_3d.envelope_mm) && (
                    <div style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.25)", padding: "14px", borderRadius: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: "8px", fontSize: "13px" }}>
                        🖨️ Especificações para Impressão 3D
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                        <div>
                          <strong>Envelope Máximo [X, Y, Z]:</strong>{" "}
                          <span style={{ color: "var(--text)" }}>
                            {selectedTeam.forma.peca_3d.envelope_mm
                              ? `${selectedTeam.forma.peca_3d.envelope_mm.join(" × ")} mm`
                              : "Não informado"}
                          </span>
                        </div>

                        <div>
                          <strong>Encaixe / Apoio:</strong>{" "}
                          <span style={{ color: "var(--text)" }}>
                            {selectedTeam.forma.peca_3d.pecaEncaixaEm || "Peça independente"}
                          </span>
                        </div>

                        <div>
                          <strong>Material Sugerido:</strong>{" "}
                          <span style={{ color: "var(--text)", textTransform: "uppercase" }}>
                            {selectedTeam.forma.peca_3d.material || "PLA (padrão)"}
                          </span>
                        </div>

                        <div>
                          <strong>Cabe na mesa de impressão?</strong>{" "}
                          <span style={{ color: selectedTeam.forma.peca_3d.cabe_na_mesa !== false ? "#10b981" : "#ef4444" }}>
                            {selectedTeam.forma.peca_3d.cabe_na_mesa !== false ? "Sim (dimensões válidas)" : "Atenção: excede limites"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Telas de Software */}
                  {selectedTeam.forma.software && selectedTeam.forma.software.length > 0 && (
                    <div style={{ background: "rgba(59, 130, 246, 0.05)", border: "1px solid rgba(59, 130, 246, 0.25)", padding: "14px", borderRadius: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#60a5fa", marginBottom: "8px", fontSize: "13px" }}>
                        💻 Telas e Ações Planejadas para o Software
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {selectedTeam.forma.software.map((t, idx) => (
                          <div key={idx} style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                            <strong style={{ color: "var(--text)" }}>Tela {idx + 1}:</strong> {t.nome || "Não nomeada"} —{" "}
                            <em>{t.acao || "Sem ação descrita"}</em>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trava Sanitária */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: selectedTeam.forma.trava_sanitaria.acionada
                        ? "1px solid #ef4444"
                        : "1px solid rgba(16, 185, 129, 0.3)",
                      background: selectedTeam.forma.trava_sanitaria.acionada
                        ? "rgba(239, 68, 68, 0.08)"
                        : "rgba(16, 185, 129, 0.05)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: selectedTeam.forma.trava_sanitaria.acionada ? "#ef4444" : "#10b981", marginBottom: "4px" }}>
                      {selectedTeam.forma.trava_sanitaria.acionada ? "⚠️ Trava Sanitária Acionada" : "✅ Trava Sanitária Liberada"}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                      {selectedTeam.forma.trava_sanitaria.acionada
                        ? `Motivos: ${selectedTeam.forma.trava_sanitaria.motivos.join(", ") || "Requer validação comissão clínica"}`
                        : "O dispositivo não possui contato invasivo direto com fluidos ou pele lesionada."}
                    </div>
                  </div>

                  {/* Competências e Faltas */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Competências na Equipe: </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        {selectedTeam.competenciasEquipe.length > 0 ? (
                          selectedTeam.competenciasEquipe.map((c, i) => (
                            <span key={i} className="badge badge-muted" style={{ fontSize: "10px" }}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Nenhuma declarada</span>
                        )}
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>Habilidades que Faltam: </span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                        {selectedTeam.faltaNaEquipe.length > 0 ? (
                          selectedTeam.faltaNaEquipe.map((f, i) => (
                            <span key={i} className="badge badge-amber" style={{ fontSize: "10px" }}>
                              {f}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Equipe autossuficiente</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. SEÇÃO IMPACTO, ODS & VALIDAÇÃO */}
            {(modalTab === "todos" || modalTab === "ods") && (
              <div className="print-card" style={{ marginBottom: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  🌍 5. Impacto, ODS e Validação
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                      📈 Como saberemos se deu certo (Métrica de Sucesso):
                    </div>
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedTeam.fechamento.como_saberemos || "Não informado"}
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                      ❓ Maior dúvida ou desafio da equipe para o dia da maratona:
                    </div>
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedTeam.fechamento.maior_duvida || "Nenhuma dúvida registrada"}
                    </div>
                  </div>

                  {/* ODS da ONU com Cores Oficiais */}
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
                      Objetivos de Desenvolvimento Sustentável (ODS ONU):
                    </div>
                    {selectedTeam.fechamento.ods.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {selectedTeam.fechamento.ods.map((odsNum) => {
                          const info = ODS_MAP[odsNum];
                          return (
                            <div
                              key={odsNum}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                background: "rgba(255,255,255,0.04)",
                                border: `1px solid ${info?.cor || "var(--border)"}`,
                                borderRadius: "8px",
                                padding: "6px 12px",
                              }}
                            >
                              <div
                                style={{
                                  background: info?.cor || "#333",
                                  color: "#ffffff",
                                  fontWeight: 800,
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                }}
                              >
                                {odsNum}
                              </div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>
                                {info?.nome || `ODS ${odsNum}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ color: "var(--text-muted)" }}>Nenhuma ODS vinculada</div>
                    )}
                  </div>

                  {/* Termos e Aceites */}
                  {selectedTeam.fechamento.aceites.length > 0 && (
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      <strong>Termos aceitos:</strong> {selectedTeam.fechamento.aceites.join(" • ")}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. SEÇÃO DE ENTREGAS & TRABALHOS */}
            {(modalTab === "todos" || modalTab === "entregas") && (
              <div className="print-card" style={{ marginBottom: "24px", borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    📦 6. Entregas e Links do Protótipo ({selectedTeam.trabalhos.length})
                  </h3>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm no-print"
                    onClick={() => abrirModalTrabalho(selectedTeam)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: selectedTeam.trabalhos.length > 0 ? "var(--accent)" : "#38bdf8",
                      borderColor: selectedTeam.trabalhos.length > 0 ? "var(--accent)" : "rgba(56, 189, 248, 0.4)",
                      background: selectedTeam.trabalhos.length > 0 ? "rgba(45, 212, 191, 0.08)" : "rgba(56, 189, 248, 0.08)",
                    }}
                  >
                    <span>{selectedTeam.trabalhos.length > 0 ? "✏️ Editar Trabalho / Links" : "+ Adicionar Trabalho / Anexo"}</span>
                  </button>
                </div>

                {selectedTeam.trabalhos.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "8px" }}>
                    Nenhum link de trabalho ou protótipo enviado ainda. Os links podem ser enviados até o pitch final.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {selectedTeam.trabalhos.map((trab, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "14px",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                            {trab.origem === "inscricao" ? "Enviado na Inscrição" : "Envio Posterior de Trabalho"}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            {trab.data}
                          </span>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "6px" }}>
                          {trab.videoUrl && (() => {
                            const validUrl = getValidExternalUrl(trab.videoUrl);
                            return validUrl ? (
                              <a
                                href={validUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                ▶️ Assistir Vídeo Pitch
                              </a>
                            ) : null;
                          })()}

                          {trab.prototipoUrl && (() => {
                            const validUrl = getValidExternalUrl(trab.prototipoUrl);
                            return validUrl ? (
                              <a
                                href={validUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                🔗 Abrir Protótipo / Figma
                              </a>
                            ) : null;
                          })()}

                          {trab.itens &&
                            trab.itens.map((it: any, iIdx) => {
                              const rawUrl = it.linkUrl || it.url || it.link || "";
                              const validUrl = getValidExternalUrl(rawUrl);

                              if (!validUrl) {
                                return (
                                  <button
                                    key={iIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      alert(
                                        `O artefato "${it.titulo || "Artefato / Documento Complementar"}" não possui um link cadastrado pela equipe.`
                                      );
                                    }}
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      opacity: 0.75,
                                      cursor: "not-allowed",
                                    }}
                                    title="Link não informado pela equipe"
                                  >
                                    📄 {it.titulo || "Artefato / Documento Complementar"} (Sem link)
                                  </button>
                                );
                              }

                              return (
                                <a
                                  key={iIdx}
                                  href={validUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📄 {it.titulo || "Artefato / Documento Complementar"}
                                </a>
                              );
                            })}
                        </div>

                        {trab.observacoes && (
                          <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)" }}>
                            <strong>Observações da equipe:</strong> {trab.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rodapé do Modal (Oculto na impressão) */}
            <div className="no-print" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="btn btn-secondary"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL DE AVALIAÇÃO DA IDEIA (BANCA EXAMINADORA) ──── */}
      {evaluatingTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => !savingEvaluation && setEvaluatingTeam(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "580px",
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              padding: "24px",
              position: "relative",
              boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "14px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fbbf24",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  ⭐ Banca Examinadora / Avaliador
                </span>
                <h2 style={{ margin: "4px 0 2px", fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>
                  Avaliação da Ideia da Equipe
                </h2>
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Equipe: <strong style={{ color: "var(--text)" }}>{evaluatingTeam.teamName}</strong> • Solução:{" "}
                  <em>{evaluatingTeam.idear.nome_solucao}</em>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !savingEvaluation && setEvaluatingTeam(null)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text)",
                  padding: "6px",
                  borderRadius: "6px",
                }}
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* 1. SELEÇÃO DA NOTA (1 A 10) */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>
                  1. Nota da Ideia (Selecione de 1 a 10) *
                </label>
                {evaluationNota !== null && (
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      color: "#ffffff",
                      background:
                        evaluationNota >= 9
                          ? "#10b981"
                          : evaluationNota >= 7
                          ? "#06b6d4"
                          : evaluationNota >= 5
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                  >
                    ⭐ {evaluationNota}/10 -{" "}
                    {evaluationNota >= 9
                      ? "Excelente / Destaque"
                      : evaluationNota >= 7
                      ? "Boa Solução"
                      : evaluationNota >= 5
                      ? "Regular"
                      : "Inicial / Insuficiente"}
                  </span>
                )}
              </div>

              {/* Botões de 1 a 10 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "5px" }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isSelected = evaluationNota === num;
                  const cor =
                    num >= 9 ? "#10b981" : num >= 7 ? "#06b6d4" : num >= 5 ? "#f59e0b" : "#ef4444";
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setEvaluationNota(num)}
                      style={{
                        height: "44px",
                        borderRadius: "8px",
                        border: isSelected ? `2px solid ${cor}` : "1px solid var(--border)",
                        background: isSelected ? cor : "rgba(255,255,255,0.03)",
                        color: isSelected ? "#ffffff" : "var(--text)",
                        fontWeight: isSelected ? 800 : 600,
                        fontSize: "15px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. POSIÇÃO / COLOCAÇÃO */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>
                2. Posição / Classificação da Equipe
              </label>

              {/* Pílulas rápidas */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                {[
                  "🥇 1º Lugar",
                  "🥈 2º Lugar",
                  "🥉 3º Lugar",
                  "4º Lugar",
                  "5º Lugar",
                  "Finalista",
                  "Menção Honrosa",
                  "Destaque Inovação",
                ].map((pos) => {
                  const isSelected = evaluationPosicao === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setEvaluationPosicao(pos)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: isSelected ? 700 : 500,
                        border: isSelected ? "1px solid #fbbf24" : "1px solid var(--border)",
                        background: isSelected ? "rgba(251, 191, 36, 0.2)" : "rgba(255,255,255,0.04)",
                        color: isSelected ? "#fbbf24" : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                className="input"
                placeholder="Ou digite a colocação (ex: 1º Lugar Geral, 2º Lugar Eixo Saúde...)"
                value={evaluationPosicao}
                onChange={(e) => setEvaluationPosicao(e.target.value)}
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            {/* 3. COMENTÁRIO SOBRE A NOTA E POSIÇÃO */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                3. Comentário do Avaliador (Parecer & Justificativa da Nota e Posição)
              </label>
              <textarea
                className="input"
                rows={4}
                placeholder="Escreva aqui seu comentário detalhado sobre a ideia da equipe, os pontos fortes, pontos a melhorar e o motivo da nota e da posição alcançada..."
                value={evaluationComentario}
                onChange={(e) => setEvaluationComentario(e.target.value)}
                style={{ width: "100%", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            {/* 4. NOME DO AVALIADOR */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                4. Nome do Avaliador / Integrante da Banca
              </label>
              <input
                type="text"
                className="input"
                placeholder="Seu nome ou identificação (ex: Prof. Avaliador / Banca Oficial)"
                value={evaluationAvaliadorNome}
                onChange={(e) => setEvaluationAvaliadorNome(e.target.value)}
                style={{ width: "100%", fontSize: "13px" }}
              />
            </div>

            {/* RODAPÉ E AÇÕES */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                borderTop: "1px solid var(--border)",
                paddingTop: "14px",
                marginTop: "4px",
              }}
            >
              {evaluatingTeam.avaliacao ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removerAvaliacao}
                  disabled={savingEvaluation}
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  🗑️ Remover Nota
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEvaluatingTeam(null)}
                  disabled={savingEvaluation}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={salvarAvaliacao}
                  disabled={savingEvaluation || evaluationNota === null}
                  style={{ minWidth: "140px" }}
                >
                  {savingEvaluation ? "Salvando..." : "💾 Salvar Avaliação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL DE GERENCIAMENTO DE TRABALHO ENTREGUE ──── */}
      {editingWorkTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => {
            if (!savingWork && !uploadingFile) setEditingWorkTeam(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "650px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fechar */}
            <button
              type="button"
              onClick={() => {
                if (!savingWork && !uploadingFile) setEditingWorkTeam(null);
              }}
              style={{
                position: "absolute",
                right: "16px",
                top: "16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "6px",
                borderRadius: "6px",
              }}
            >
              <XIcon size={18} />
            </button>

            {/* Cabeçalho */}
            <div style={{ marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "20px" }}>📦</span>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>
                  Trabalho Entregue da Equipe
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Cadastre ou atualize a apresentação, links do protótipo, vídeo pitch ou faça upload de PDF/slides para <strong>{editingWorkTeam.teamName}</strong>.
              </p>
            </div>

            {/* Formulário */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Nome da Equipe e Título */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                    Nome da Equipe:
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={workTeamName}
                    onChange={(e) => setWorkTeamName(e.target.value)}
                    placeholder="Ex: Dose Certa"
                    style={{ width: "100%", fontSize: "13px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                    Título do Trabalho / Solução:
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={workTitulo}
                    onChange={(e) => setWorkTitulo(e.target.value)}
                    placeholder="Ex: Dose Certa - O Assistente de Medicação"
                    style={{ width: "100%", fontSize: "13px" }}
                  />
                </div>
              </div>

              {/* Upload de Arquivo Direto */}
              <div
                style={{
                  background: "rgba(45, 212, 191, 0.05)",
                  border: "1px dashed rgba(45, 212, 191, 0.35)",
                  borderRadius: "10px",
                  padding: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                    <DownloadIcon size={14} /> Upload de Arquivo (PDF, Slides, DOCX, ZIP até 20MB):
                  </label>
                  {uploadingFile && (
                    <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                      ⏳ Enviando arquivo...
                    </span>
                  )}
                </div>

                <p style={{ margin: "0 0 10px", fontSize: "11px", color: "var(--text-muted)" }}>
                  Selecione o arquivo da apresentação em PDF ou slides do seu computador. O sistema irá armazená-lo e gerar o link acessível automaticamente.
                </p>

                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.zip"
                  onChange={handleFileUpload}
                  disabled={uploadingFile || savingWork}
                  style={{
                    fontSize: "12px",
                    color: "var(--text)",
                    width: "100%",
                  }}
                />

                {uploadError && (
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#ef4444" }}>
                    ⚠️ {uploadError}
                  </div>
                )}
              </div>

              {/* URL do Protótipo / Apresentação / PDF */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                  Link do Protótipo / Apresentação (URL do PDF, Slides, Figma ou Drive):
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="input"
                    value={workPrototipoUrl}
                    onChange={(e) => setWorkPrototipoUrl(e.target.value)}
                    placeholder="https://... ou caminho gerado no upload"
                    style={{ flex: 1, fontSize: "13px" }}
                  />
                  {workPrototipoUrl.trim() && (
                    <a
                      href={workPrototipoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "0 10px", display: "inline-flex", alignItems: "center", fontSize: "11px" }}
                    >
                      🔗 Abrir
                    </a>
                  )}
                </div>
              </div>

              {/* URL do Vídeo Pitch */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                  Link do Vídeo Pitch (YouTube, Vimeo, Google Drive ou Loom):
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="input"
                    value={workVideoUrl}
                    onChange={(e) => setWorkVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... ou similar"
                    style={{ flex: 1, fontSize: "13px" }}
                  />
                  {workVideoUrl.trim() && (
                    <a
                      href={workVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "0 10px", display: "inline-flex", alignItems: "center", fontSize: "11px" }}
                    >
                      ▶️ Assistir
                    </a>
                  )}
                </div>
              </div>

              {/* Observações da Equipe / Descrição da Solução */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                  Observações / Resumo da Solução:
                </label>
                <textarea
                  className="input"
                  rows={3}
                  value={workObservacoes}
                  onChange={(e) => setWorkObservacoes(e.target.value)}
                  placeholder="Descreva brevemente a solução, tecnologias utilizadas, detalhes do hardware ou protótipo..."
                  style={{ width: "100%", fontSize: "12px", resize: "vertical" }}
                />
              </div>

              {/* Acesso Liberado para Banca */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="workAcessoLiberado"
                  checked={workAcessoLiberado}
                  onChange={(e) => setWorkAcessoLiberado(e.target.checked)}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <label htmlFor="workAcessoLiberado" style={{ fontSize: "12px", color: "var(--text)", cursor: "pointer", userSelect: "none" }}>
                  Acesso liberado para a banca examinadora e jurados
                </label>
              </div>

              {/* Artefatos Complementares Adicionais */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", margin: 0 }}>
                    Artefatos e Links Complementares ({workArtefatos.length}):
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setWorkArtefatos((prev) => [
                        ...prev,
                        { tipo: "Link", titulo: "", linkUrl: "" },
                      ])
                    }
                    style={{ fontSize: "11px", padding: "2px 8px" }}
                  >
                    + Adicionar Link
                  </button>
                </div>

                {workArtefatos.length === 0 ? (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Nenhum artefato adicional. Você pode adicionar repositório Git, documentação técnica, etc.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {workArtefatos.map((art, aIdx) => (
                      <div key={aIdx} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr auto", gap: "6px", alignItems: "center" }}>
                        <input
                          type="text"
                          className="input"
                          value={art.tipo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWorkArtefatos((prev) =>
                              prev.map((item, i) => (i === aIdx ? { ...item, tipo: val } : item))
                            );
                          }}
                          placeholder="Tipo"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                        <input
                          type="text"
                          className="input"
                          value={art.titulo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWorkArtefatos((prev) =>
                              prev.map((item, i) => (i === aIdx ? { ...item, titulo: val } : item))
                            );
                          }}
                          placeholder="Título do artefato"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                        <input
                          type="text"
                          className="input"
                          value={art.linkUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setWorkArtefatos((prev) =>
                              prev.map((item, i) => (i === aIdx ? { ...item, linkUrl: val } : item))
                            );
                          }}
                          placeholder="URL / Link"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                        <button
                          type="button"
                          onClick={() => setWorkArtefatos((prev) => prev.filter((_, i) => i !== aIdx))}
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                          title="Remover artefato"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ações do Rodapé */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                borderTop: "1px solid var(--border)",
                paddingTop: "16px",
                marginTop: "18px",
              }}
            >
              {editingWorkTeam.trabalhos.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={removerTrabalhoEquipe}
                  disabled={savingWork || uploadingFile}
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  🗑️ Remover Trabalho
                </button>
              ) : (
                <div />
              )}

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingWorkTeam(null)}
                  disabled={savingWork || uploadingFile}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={salvarTrabalhoEquipe}
                  disabled={savingWork || uploadingFile}
                  style={{ minWidth: "150px" }}
                >
                  {savingWork ? "Salvando..." : "💾 Salvar Trabalho Entregue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL DE VISUALIZAÇÃO E CÓPIA DE MARKDOWN ──── */}
      {markdownModal && markdownModal.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.8)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setMarkdownModal(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "750px",
              width: "100%",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "24px",
              position: "relative",
              boxShadow: "0 25px 50px rgba(0,0,0,0.7)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Exportação de Ficha Completa (Markdown)
                </span>
                <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>
                  {markdownModal.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setMarkdownModal(null)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text)",
                  padding: "6px",
                  borderRadius: "6px",
                }}
              >
                <XIcon size={18} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
              O texto abaixo está no formato Markdown oficial do evento. Você pode copiar com 1 clique ou baixar como arquivo <code>.md</code>.
            </p>

            {/* Textarea com o conteúdo */}
            <textarea
              readOnly
              rows={14}
              value={markdownModal.content}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "12px",
                fontFamily: "var(--font-mono, monospace)",
                background: "rgba(0,0,0,0.25)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                lineHeight: 1.5,
                resize: "vertical",
              }}
            />

            {/* Ações */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "8px",
                borderTop: "1px solid var(--border)",
                paddingTop: "14px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => downloadTextAsFile(`ficha-${new Date().getTime()}.md`, markdownModal.content)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <DownloadIcon size={14} />
                <span>Baixar arquivo .md</span>
              </button>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMarkdownModal(null)}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const ok = await copyTextToClipboard(markdownModal.content);
                    if (ok) {
                      setMarkdownModal({ ...markdownModal, copied: true });
                      showToast("Ficha em Markdown copiada para a área de transferência!");
                      setTimeout(() => {
                        setMarkdownModal((prev) => (prev ? { ...prev, copied: false } : null));
                      }, 2500);
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    minWidth: "130px",
                    justifyContent: "center",
                  }}
                >
                  {markdownModal.copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                  <span>{markdownModal.copied ? "Copiado!" : "Copiar Markdown"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
