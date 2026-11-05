import { useEffect, useState, useMemo, useCallback } from "react";
import * as api from "../../api/client";
import {
  RefreshIcon,
  XIcon,
} from "../../components/Icons";
import { TeamCriterionInfoBox } from "./TeamCriterionInfoBox";

export interface CriteriosBanca {
  problema: number; // 1 a 5
  inovacao: number; // 1 a 5
  viabilidade: number; // 1 a 5
  impacto: number; // 1 a 5
  prototipoApresentacao: number; // 1 a 5
}

export interface TeamBancaEvaluation {
  id?: string;
  teamNumber: number;
  teamName: string;
  ideaDescription?: string;
  leaderName?: string;
  criterios: CriteriosBanca;
  total: number; // 5 a 25
  anotacoesDeliberacao: string;
  avaliadorNome: string;
  atualizadoEm?: string;
  hasInscription: boolean;
  teamData?: any;
}

function normalizeTeamText(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function findMatchingInscription(
  officialName: string,
  insList: api.InscriptionReportItem[]
): api.InscriptionReportItem | undefined {
  const normOfficial = normalizeTeamText(officialName);

  return insList.find((ins) => {
    let parsedNotes: any = {};
    if (ins.notes) {
      try {
        parsedNotes = JSON.parse(ins.notes);
      } catch {}
    }

    const candidates = [
      ins.teamName,
      parsedNotes.teamName,
      parsedNotes.payload_completo?.equipeNome,
      parsedNotes.idear?.nome_solucao,
      parsedNotes.payload_completo?.idear?.nome_solucao,
      parsedNotes.ficha_prototipo?.funcao,
      parsedNotes.payload_completo?.ficha_prototipo?.funcao,
    ].filter(Boolean) as string[];

    for (const cand of candidates) {
      const normCand = normalizeTeamText(cand);
      if (!normCand) continue;
      if (normOfficial === normCand) return true;
      if (normOfficial.includes(normCand) || normCand.includes(normOfficial)) return true;
    }

    // Heurísticas específicas para as 10 equipes oficiais do INOVA SAÚDE
    if (normOfficial.includes("burncare") && candidates.some((c) => normalizeTeamText(c).includes("burncare"))) return true;
    if (
      normOfficial.includes("comunidade") &&
      candidates.some((c) => normalizeTeamText(c).includes("vida") || normalizeTeamText(c).includes("academic"))
    ) return true;
    if (normOfficial.includes("dosecerta") && candidates.some((c) => normalizeTeamText(c).includes("dosecerta"))) return true;
    if (normOfficial.includes("ecomix") && candidates.some((c) => normalizeTeamText(c).includes("ecomix"))) return true;
    if (normOfficial.includes("emergencia") && candidates.some((c) => normalizeTeamText(c).includes("emergencia"))) return true;
    if (normOfficial.includes("infofast") && candidates.some((c) => normalizeTeamText(c).includes("infofast"))) return true;
    if (normOfficial.includes("kinetiq") && candidates.some((c) => normalizeTeamText(c).includes("kinetiq"))) return true;
    if (
      normOfficial.includes("orthotrack") &&
      candidates.some((c) => normalizeTeamText(c).includes("orthotrack") || normalizeTeamText(c).includes("ortho"))
    ) return true;
    if (normOfficial.includes("prontuario") && candidates.some((c) => normalizeTeamText(c).includes("prontuario"))) return true;
    if (normOfficial.includes("fisioterapia") && candidates.some((c) => normalizeTeamText(c).includes("fisioterapia"))) return true;

    return false;
  });
}

export const INOVA_SAUDE_OFFICIAL_TEAMS = [
  "BurnCare CTQ-HU",
  "Comunidade acadêmica pela vida",
  "Dose Certa",
  "Ecomix",
  "Emergência em Foco",
  "InfoFast",
  "Kinetiq",
  "Ortho Track",
  "Prontuário prático",
  "Sistema de Fisioterapia",
];

export const BANCA_CRITERIOS_DEF = [
  {
    key: "problema" as keyof CriteriosBanca,
    numero: 1,
    nome: "Problema",
    pergunta: "A dor é real e foi verificada com quem a vive?",
    nivel1: "Problema genérico ou suposto",
    nivel3: "Problema claro, com algum contato com quem vive",
    nivel5: "Dor concreta, com evidência: conversa, dado ou observação no serviço",
    peso: "Peso 2 (igual)",
    desempate: "1º Critério de Desempate",
  },
  {
    key: "inovacao" as keyof CriteriosBanca,
    numero: 2,
    nome: "Inovação",
    pergunta: "O que a solução faz de diferente do que já existe?",
    nivel1: "Repete o que já existe",
    nivel3: "Adapta algo conhecido a um contexto novo",
    nivel5: "Muda a forma de resolver o problema",
    peso: "Peso 2 (igual)",
    desempate: null,
  },
  {
    key: "viabilidade" as keyof CriteriosBanca,
    numero: 3,
    nome: "Viabilidade",
    pergunta: "Dá para construir e manter com recursos realistas?",
    nivel1: "Depende de algo fora do alcance",
    nivel3: "Caminho possível, mas com lacunas importantes",
    nivel5: "Próximo passo claro, recursos realistas e quem manteria",
    peso: "Peso 2 (igual)",
    desempate: "2º Critério de Desempate",
  },
  {
    key: "impacto" as keyof CriteriosBanca,
    numero: 4,
    nome: "Impacto",
    pergunta: "Quanto melhora a saúde de quem é atendido na região?",
    nivel1: "Benefício pequeno ou incerto",
    nivel3: "Benefício claro para um grupo definido",
    nivel5: "Benefício frequente, mensurável e com potencial de crescer",
    peso: "Peso 2 (igual)",
    desempate: null,
  },
  {
    key: "prototipoApresentacao" as keyof CriteriosBanca,
    numero: 5,
    nome: "Protótipo e apresentação",
    pergunta: "O protótipo mostra a ideia e o pitch convence?",
    nivel1: "Sem protótipo ou pitch confuso",
    nivel3: "Protótipo mostra parte da ideia, pitch compreensível",
    nivel5: "Protótipo demonstra a ideia e o pitch é claro e no tempo",
    peso: "Peso 2 (igual)",
    desempate: null,
  },
];

interface EvaluationTabProps {
  eventId: string;
  eventName?: string;
}

export function EvaluationTab({ eventId, eventName = "INOVA SAÚDE 2026" }: EvaluationTabProps) {
  const [loading, setLoading] = useState(true);
  const [inscriptions, setInscriptions] = useState<api.InscriptionReportItem[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, TeamBancaEvaluation>>({});
  const [deliberationGeneralNotes, setDeliberationGeneralNotes] = useState("");
  const [avaliadorNome, setAvaliadorNome] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"tabela" | "ranking" | "criterios">("tabela");
  const [evaluatingTeam, setEvaluatingTeam] = useState<TeamBancaEvaluation | null>(null);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carrega nome do avaliador salvo no navegador
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedAvaliador = localStorage.getItem("inova_avaliador_nome") || "";
      if (storedAvaliador) setAvaliadorNome(storedAvaliador);

      const storedGeneralNotes = localStorage.getItem(`inova_deliberacao_geral_${eventId}`) || "";
      if (storedGeneralNotes) setDeliberationGeneralNotes(storedGeneralNotes);
    }
  }, [eventId]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Carrega dados de inscrições e avaliações do evento
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const insList = await api.getInscriptionsReport(eventId);
      setInscriptions(insList);

      // LocalStorage backup
      let localBackup: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(`inova_banca_evaluations_${eventId}`);
        if (raw) localBackup = JSON.parse(raw);
      } catch {}

      // Mapeia inscrições que contêm notas salvas
      const initialMap: Record<string, TeamBancaEvaluation> = {};

      INOVA_SAUDE_OFFICIAL_TEAMS.forEach((officialName, idx) => {
        const teamNumber = idx + 1;
        // Tenta achar inscrição correspondente
        const matchingIns = findMatchingInscription(officialName, insList);

        let parsedNotes: any = null;
        if (matchingIns?.notes) {
          try {
            parsedNotes = JSON.parse(matchingIns.notes);
          } catch {}
        }

        const avaliacaoServer = parsedNotes?.avaliacao || parsedNotes?.banca_avaliacao;
        const avaliacaoLocal = localBackup[officialName];
        const source = avaliacaoServer || avaliacaoLocal;

        let criterios: CriteriosBanca = {
          problema: 0,
          inovacao: 0,
          viabilidade: 0,
          impacto: 0,
          prototipoApresentacao: 0,
        };

        let total = 0;
        let anotacoes = "";
        let avaliador = "";
        let atualizadoEm: string | undefined = undefined;

        if (source) {
          if (source.criterios) {
            criterios = {
              problema: Number(source.criterios.problema) || 0,
              inovacao: Number(source.criterios.inovacao) || 0,
              viabilidade: Number(source.criterios.viabilidade) || 0,
              impacto: Number(source.criterios.impacto) || 0,
              prototipoApresentacao: Number(source.criterios.prototipoApresentacao) || 0,
            };
            total =
              criterios.problema +
              criterios.inovacao +
              criterios.viabilidade +
              criterios.impacto +
              criterios.prototipoApresentacao;
          } else if (typeof source.nota === "number") {
            // Nota legada de 1 a 10 ou direta
            total = source.nota;
          }

          anotacoes = source.anotacoesDeliberacao || source.comentario || "";
          avaliador = source.avaliadorNome || "";
          atualizadoEm = source.atualizadoEm;
        }

        // Descrição da ideia a partir dos dados da inscrição (se houver)
        let ideaDesc = "";
        if (parsedNotes?.payload_completo?.idear?.nome_solucao) {
          ideaDesc = parsedNotes.payload_completo.idear.nome_solucao;
        } else if (parsedNotes?.idear?.nome_solucao) {
          ideaDesc = parsedNotes.idear.nome_solucao;
        } else if (parsedNotes?.payload_completo?.ficha_prototipo?.funcao) {
          ideaDesc = parsedNotes.payload_completo.ficha_prototipo.funcao;
        }

        const rawPayload = parsedNotes?.payload_completo || {};
        const teamData = {
          teamName: officialName,
          definir: parsedNotes?.definir || rawPayload.definir,
          empatizar: parsedNotes?.empatizar || rawPayload.empatizar,
          idear: parsedNotes?.idear || rawPayload.idear,
          escopo: parsedNotes?.escopo || rawPayload.escopo,
          forma: parsedNotes?.forma || rawPayload.forma,
          fechamento: parsedNotes?.fechamento || rawPayload.fechamento,
          competenciasEquipe: parsedNotes?.competenciasEquipe || rawPayload.competenciasEquipe || [],
          faltaNaEquipe: parsedNotes?.faltaNaEquipe || rawPayload.faltaNaEquipe || parsedNotes?.habilidadesFaltam || [],
          trabalhos: Array.isArray(parsedNotes?.trabalhos)
            ? parsedNotes.trabalhos
            : parsedNotes?.trabalho_entregue
            ? [parsedNotes.trabalho_entregue]
            : rawPayload.trabalho_entregue
            ? [rawPayload.trabalho_entregue]
            : [],
        };

        const leaderName = matchingIns
          ? `${matchingIns.name}${matchingIns.teamName ? ` (${matchingIns.teamName})` : ""}`
          : undefined;

        initialMap[officialName] = {
          id: matchingIns?.id,
          teamNumber,
          teamName: officialName,
          ideaDescription: ideaDesc,
          leaderName,
          criterios,
          total,
          anotacoesDeliberacao: anotacoes,
          avaliadorNome: avaliador,
          atualizadoEm,
          hasInscription: Boolean(matchingIns),
          teamData,
        };
      });

      setEvaluations(initialMap);
    } catch (err) {
      console.error("Erro ao carregar avaliações da banca:", err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Atualiza nome do avaliador
  function handleAvaliadorChange(nome: string) {
    setAvaliadorNome(nome);
    if (typeof window !== "undefined") {
      localStorage.setItem("inova_avaliador_nome", nome);
    }
  }

  // Atualiza anotações gerais de deliberação
  function handleGeneralNotesChange(text: string) {
    setDeliberationGeneralNotes(text);
    if (typeof window !== "undefined") {
      localStorage.setItem(`inova_deliberacao_geral_${eventId}`, text);
    }
  }

  // Salva avaliação de uma equipe
  async function salvarAvaliacaoEquipe(teamData: TeamBancaEvaluation) {
    setSavingEvaluation(true);
    try {
      const soma =
        teamData.criterios.problema +
        teamData.criterios.inovacao +
        teamData.criterios.viabilidade +
        teamData.criterios.impacto +
        teamData.criterios.prototipoApresentacao;

      const evalToSave: TeamBancaEvaluation = {
        ...teamData,
        total: soma,
        avaliadorNome: avaliadorNome.trim() || teamData.avaliadorNome || "Banca Oficial",
        atualizadoEm: new Date().toISOString(),
      };

      // 1. Atualiza estado em memória
      const nextMap = { ...evaluations, [teamData.teamName]: evalToSave };
      setEvaluations(nextMap);

      // 2. Salva em LocalStorage (backup instantâneo offline-safe)
      if (typeof window !== "undefined") {
        localStorage.setItem(`inova_banca_evaluations_${eventId}`, JSON.stringify(nextMap));
      }

      // 3. Se tiver inscrição vinculada, persiste no banco de dados via API
      if (teamData.id) {
        const ins = inscriptions.find((i) => i.id === teamData.id);
        let baseNotes: any = {};
        if (ins?.notes) {
          try {
            baseNotes = JSON.parse(ins.notes);
          } catch {}
        }
        baseNotes.avaliacao = {
          nota: soma, // total de 5 a 25
          criterios: evalToSave.criterios,
          anotacoesDeliberacao: evalToSave.anotacoesDeliberacao,
          avaliadorNome: evalToSave.avaliadorNome,
          atualizadoEm: evalToSave.atualizadoEm,
          metodologia: "INOVA_SAUDE_2026_5_CRITERIOS",
        };

        await api.updateInscription(eventId, teamData.id, {
          notes: JSON.stringify(baseNotes),
        });
      }

      showToast(`Avaliação de "${teamData.teamName}" salva! Total: ${soma}/25 ⭐`);
      setEvaluatingTeam(null);
    } catch (err) {
      alert("Erro ao salvar avaliação: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEvaluation(false);
    }
  }

  // Remove avaliação
  async function removerAvaliacaoEquipe(teamName: string) {
    if (!confirm(`Deseja remover as notas da equipe "${teamName}"?`)) return;

    setSavingEvaluation(true);
    try {
      const current = evaluations[teamName];
      const resetEval: TeamBancaEvaluation = {
        ...current,
        criterios: {
          problema: 0,
          inovacao: 0,
          viabilidade: 0,
          impacto: 0,
          prototipoApresentacao: 0,
        },
        total: 0,
        anotacoesDeliberacao: "",
        atualizadoEm: undefined,
      };

      const nextMap = { ...evaluations, [teamName]: resetEval };
      setEvaluations(nextMap);

      if (typeof window !== "undefined") {
        localStorage.setItem(`inova_banca_evaluations_${eventId}`, JSON.stringify(nextMap));
      }

      if (current.id) {
        const ins = inscriptions.find((i) => i.id === current.id);
        let baseNotes: any = {};
        if (ins?.notes) {
          try {
            baseNotes = JSON.parse(ins.notes);
          } catch {}
        }
        delete baseNotes.avaliacao;
        delete baseNotes.banca_avaliacao;

        await api.updateInscription(eventId, current.id, {
          notes: JSON.stringify(baseNotes),
        });
      }

      showToast(`Avaliação de "${teamName}" removida.`);
      setEvaluatingTeam(null);
    } catch (err) {
      alert("Erro ao remover: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEvaluation(false);
    }
  }

  // Lista ordenada com o critério oficial de desempate
  // "Desempate: maior nota em Problema. Se continuar empatado, maior nota em Viabilidade."
  const rankedTeams = useMemo(() => {
    const list = Object.values(evaluations);
    return [...list].sort((a, b) => {
      // 1. Total descrescente
      if (b.total !== a.total) return b.total - a.total;
      // 2. Desempate 1: maior nota em Problema
      if (b.criterios.problema !== a.criterios.problema) return b.criterios.problema - a.criterios.problema;
      // 3. Desempate 2: maior nota em Viabilidade
      if (b.criterios.viabilidade !== a.criterios.viabilidade) return b.criterios.viabilidade - a.criterios.viabilidade;
      // 4. Inovação
      if (b.criterios.inovacao !== a.criterios.inovacao) return b.criterios.inovacao - a.criterios.inovacao;
      // 5. Impacto
      if (b.criterios.impacto !== a.criterios.impacto) return b.criterios.impacto - a.criterios.impacto;
      // 6. Número original
      return a.teamNumber - b.teamNumber;
    });
  }, [evaluations]);

  // Estatísticas da banca
  const stats = useMemo(() => {
    const list = Object.values(evaluations);
    const avaliadas = list.filter((t) => t.total > 0);
    const somaTotal = avaliadas.reduce((acc, t) => acc + t.total, 0);
    const media = avaliadas.length > 0 ? (somaTotal / avaliadas.length).toFixed(1) : "0.0";
    const maior = rankedTeams[0]?.total > 0 ? rankedTeams[0] : null;

    return {
      totalEquipes: list.length,
      avaliadasCount: avaliadas.length,
      media,
      maior,
    };
  }, [evaluations, rankedTeams]);

  // Navegação entre equipes dentro do modal de avaliação
  function navegarEquipeModal(direcao: "anterior" | "proxima") {
    if (!evaluatingTeam) return;
    const currentIndex = INOVA_SAUDE_OFFICIAL_TEAMS.indexOf(evaluatingTeam.teamName);
    if (currentIndex === -1) return;

    const nextIndex =
      direcao === "proxima"
        ? (currentIndex + 1) % INOVA_SAUDE_OFFICIAL_TEAMS.length
        : (currentIndex - 1 + INOVA_SAUDE_OFFICIAL_TEAMS.length) % INOVA_SAUDE_OFFICIAL_TEAMS.length;

    const nextName = INOVA_SAUDE_OFFICIAL_TEAMS[nextIndex];
    if (evaluations[nextName]) {
      setEvaluatingTeam(evaluations[nextName]);
    }
  }

  // Impressão da Ficha da Banca Oficial
  function imprimirFicha() {
    window.print();
  }

  return (
    <div className="banca-eval-container stack" style={{ gap: "20px" }}>
      {/* Toast flutuante */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            backgroundColor: "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            fontWeight: 700,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ──── CABEÇALHO OFICIAL DA FICHA DA BANCA ──── */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, rgba(14, 54, 52, 0.4) 0%, rgba(3, 105, 161, 0.2) 100%)",
          borderColor: "rgba(56, 189, 248, 0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "24px" }}>📋</span>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>
                Ficha da banca {eventName || "INOVA SAÚDE 2026"}
              </h1>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(56, 189, 248, 0.2)",
                  color: "#38bdf8",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                }}
              >
                Oficial Demoday
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
              <strong>5 de nov. de 2026</strong> · Avaliação oficial e deliberação da banca examinadora das 10 equipes
              concorrentes.
            </p>
          </div>

          {/* Botões de Ação */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={imprimirFicha}
              title="Gera a versão formatada para impressão física da ficha da banca"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>🖨️</span>
              <span>Imprimir Ficha da Banca</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadData}
              disabled={loading}
              title="Recarrega as notas e inscrições"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshIcon size={14} className={loading ? "spin" : ""} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Campo do Avaliador & Regras Rápidas */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <div>
            <label
              htmlFor="nome-avaliador"
              style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#38bdf8", marginBottom: "4px" }}
            >
              👤 Avaliador(a) / Membro da Banca:
            </label>
            <input
              id="nome-avaliador"
              type="text"
              className="input"
              value={avaliadorNome}
              onChange={(e) => handleAvaliadorChange(e.target.value)}
              placeholder="Digite seu nome (ex: Dr. Carlos Silva - Avaliador)"
              style={{
                width: "100%",
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                borderColor: "rgba(56, 189, 248, 0.4)",
              }}
            />
          </div>

          {/* Resumo de Regras */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "12px",
              lineHeight: 1.4,
              color: "var(--text-muted)",
            }}
          >
            <div>
              ⭐ <strong>Notas:</strong> 1 a 5 em cada critério (use 2 e 4 para intermediários). Máximo:{" "}
              <strong style={{ color: "#10b981" }}>25 pontos</strong>.
            </div>
            <div style={{ marginTop: "4px" }}>
              ⚖️ <strong>Desempate:</strong> Maior nota em <strong>Problema</strong>. Se persistir, maior em{" "}
              <strong>Viabilidade</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* ──── BOX DE INSTRUÇÃO E REGULAMENTO DA BANCA ──── */}
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "10px",
          backgroundColor: "rgba(251, 191, 36, 0.08)",
          border: "1px solid rgba(251, 191, 36, 0.3)",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
        }}
      >
        <span style={{ fontSize: "22px", lineHeight: 1 }}>💡</span>
        <div style={{ fontSize: "12.5px", lineHeight: 1.5, color: "var(--text)" }}>
          <strong style={{ color: "#fbbf24", fontSize: "13px" }}>Como avaliar as equipes:</strong>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)" }}>
            Dê uma nota de <strong>1 a 5</strong> em cada critério. Use 2 e 4 para os casos entre as descrições. Os cinco
            têm o mesmo peso (2, como no edital), então basta somar: <strong>máximo 25</strong>. Todas as equipes começam
            do zero hoje.
          </p>
          <p style={{ margin: "4px 0 0", fontStyle: "italic", color: "#fef08a" }}>
            "Acabamento não conta. Um protótipo de papel testado com usuários vale mais que um app bonito nunca testado."
          </p>
        </div>
      </div>

      {/* ──── BARRA DE ESTATÍSTICAS RÁPIDAS ──── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        <div className="card" style={{ padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "8px",
              backgroundColor: "rgba(56, 189, 248, 0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            👥
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Progresso da Banca
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>
              {stats.avaliadasCount} / {stats.totalEquipes}{" "}
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)" }}>avaliadas</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "8px",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            📊
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Média da Banca
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#10b981" }}>
              {stats.media} <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>/ 25 pts</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "8px",
              backgroundColor: "rgba(251, 191, 36, 0.15)",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🏆
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              1º Lugar Provisório
            </div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#fbbf24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px" }}>
              {stats.maior ? `${stats.maior.teamName} (${stats.maior.total} pts)` : "Aguardando notas"}
            </div>
          </div>
        </div>
      </div>

      {/* ──── NAVEGAÇÃO DE SUB-ABAS ──── */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <button
          type="button"
          className={`btn ${activeSubTab === "tabela" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveSubTab("tabela")}
          style={{ fontSize: "13px", padding: "8px 16px" }}
        >
          📋 Ficha Completa da Banca ({stats.totalEquipes} Equipes)
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === "ranking" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveSubTab("ranking")}
          style={{ fontSize: "13px", padding: "8px 16px" }}
        >
          🏆 Ranking Oficial & Deliberação
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === "criterios" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveSubTab("criterios")}
          style={{ fontSize: "13px", padding: "8px 16px" }}
        >
          📖 Guia dos 5 Critérios
        </button>
      </div>

      {/* ──── ABA 1: TABELA COMPLETA DA BANCA ──── */}
      {activeSubTab === "tabela" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", borderBottom: "2px solid var(--border)" }}>
                  <th style={{ padding: "12px 14px", width: "40px", textAlign: "center" }}>#</th>
                  <th style={{ padding: "12px 14px", minWidth: "220px" }}>Equipe e Ideia</th>
                  <th style={{ padding: "12px 10px", textAlign: "center", minWidth: "90px" }}>
                    <div style={{ fontWeight: 700 }}>Problema</div>
                    <div style={{ fontSize: "10px", color: "#38bdf8" }}>(1 a 5) *desemp. 1</div>
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", minWidth: "90px" }}>
                    <div style={{ fontWeight: 700 }}>Inovação</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>(1 a 5)</div>
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", minWidth: "90px" }}>
                    <div style={{ fontWeight: 700 }}>Viabilidade</div>
                    <div style={{ fontSize: "10px", color: "#38bdf8" }}>(1 a 5) *desemp. 2</div>
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", minWidth: "90px" }}>
                    <div style={{ fontWeight: 700 }}>Impacto</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>(1 a 5)</div>
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", minWidth: "120px" }}>
                    <div style={{ fontWeight: 700 }}>Protótipo & Pitch</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>(1 a 5)</div>
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "center", minWidth: "100px", backgroundColor: "rgba(16, 185, 129, 0.08)" }}>
                    <div style={{ fontWeight: 800, color: "#10b981", fontSize: "14px" }}>Total</div>
                    <div style={{ fontSize: "10px", color: "#10b981" }}>(máx 25)</div>
                  </th>
                  <th style={{ padding: "12px 14px", textAlign: "right", minWidth: "130px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {INOVA_SAUDE_OFFICIAL_TEAMS.map((teamName, index) => {
                  const evalData = evaluations[teamName] || {
                    teamNumber: index + 1,
                    teamName,
                    criterios: { problema: 0, inovacao: 0, viabilidade: 0, impacto: 0, prototipoApresentacao: 0 },
                    total: 0,
                    anotacoesDeliberacao: "",
                    avaliadorNome: "",
                    hasInscription: false,
                  };

                  const isEvaluated = evalData.total > 0;

                  return (
                    <tr
                      key={teamName}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        backgroundColor: isEvaluated ? "rgba(16, 185, 129, 0.02)" : "transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* # Número */}
                      <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, color: "var(--text-muted)" }}>
                        {index + 1}
                      </td>

                      {/* Equipe e Ideia */}
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "14px" }}>
                          {teamName}
                        </div>
                        {evalData.leaderName && (
                          <div style={{ fontSize: "11px", color: "var(--accent)", marginTop: "2px", fontWeight: 600 }}>
                            👤 {evalData.leaderName}
                          </div>
                        )}
                        {evalData.ideaDescription && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            💡 {evalData.ideaDescription}
                          </div>
                        )}
                        {evalData.anotacoesDeliberacao && (
                          <div style={{ fontSize: "11px", color: "#fbbf24", marginTop: "3px", fontStyle: "italic" }}>
                            💬 {evalData.anotacoesDeliberacao.slice(0, 70)}
                            {evalData.anotacoesDeliberacao.length > 70 ? "..." : ""}
                          </div>
                        )}
                      </td>

                      {/* 1. Problema */}
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "13px",
                            backgroundColor: evalData.criterios.problema > 0 ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.04)",
                            color: evalData.criterios.problema > 0 ? "#38bdf8" : "var(--text-muted)",
                            border: evalData.criterios.problema > 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                          }}
                        >
                          {evalData.criterios.problema > 0 ? evalData.criterios.problema : "—"}
                        </span>
                      </td>

                      {/* 2. Inovação */}
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "13px",
                            backgroundColor: evalData.criterios.inovacao > 0 ? "rgba(168, 85, 247, 0.15)" : "rgba(255,255,255,0.04)",
                            color: evalData.criterios.inovacao > 0 ? "#c084fc" : "var(--text-muted)",
                            border: evalData.criterios.inovacao > 0 ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid transparent",
                          }}
                        >
                          {evalData.criterios.inovacao > 0 ? evalData.criterios.inovacao : "—"}
                        </span>
                      </td>

                      {/* 3. Viabilidade */}
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "13px",
                            backgroundColor: evalData.criterios.viabilidade > 0 ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.04)",
                            color: evalData.criterios.viabilidade > 0 ? "#38bdf8" : "var(--text-muted)",
                            border: evalData.criterios.viabilidade > 0 ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                          }}
                        >
                          {evalData.criterios.viabilidade > 0 ? evalData.criterios.viabilidade : "—"}
                        </span>
                      </td>

                      {/* 4. Impacto */}
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "13px",
                            backgroundColor: evalData.criterios.impacto > 0 ? "rgba(236, 72, 153, 0.15)" : "rgba(255,255,255,0.04)",
                            color: evalData.criterios.impacto > 0 ? "#f472b6" : "var(--text-muted)",
                            border: evalData.criterios.impacto > 0 ? "1px solid rgba(236, 72, 153, 0.3)" : "1px solid transparent",
                          }}
                        >
                          {evalData.criterios.impacto > 0 ? evalData.criterios.impacto : "—"}
                        </span>
                      </td>

                      {/* 5. Protótipo e Apresentação */}
                      <td style={{ padding: "12px 10px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "13px",
                            backgroundColor: evalData.criterios.prototipoApresentacao > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(255,255,255,0.04)",
                            color: evalData.criterios.prototipoApresentacao > 0 ? "#fbbf24" : "var(--text-muted)",
                            border: evalData.criterios.prototipoApresentacao > 0 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid transparent",
                          }}
                        >
                          {evalData.criterios.prototipoApresentacao > 0 ? evalData.criterios.prototipoApresentacao : "—"}
                        </span>
                      </td>

                      {/* TOTAL */}
                      <td style={{ padding: "12px 14px", textAlign: "center", backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: 900,
                            color: isEvaluated ? "#10b981" : "var(--text-muted)",
                          }}
                        >
                          {isEvaluated ? `${evalData.total} pts` : "—"}
                        </span>
                        {isEvaluated && (
                          <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                            de 25 máx
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "12px 14px", textAlign: "right" }}>
                        <button
                          type="button"
                          className={`btn ${isEvaluated ? "btn-secondary" : "btn-primary"}`}
                          onClick={() => setEvaluatingTeam(evalData)}
                          style={{ fontSize: "12px", padding: "6px 12px" }}
                        >
                          {isEvaluated ? "✏️ Editar Notas" : "⭐ Avaliar Equipe"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──── ABA 2: RANKING OFICIAL & DELIBERAÇÃO ──── */}
      {activeSubTab === "ranking" && (
        <div className="stack" style={{ gap: "20px" }}>
          {/* Tabela do Ranking com Critérios de Desempate */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                  Classificação Oficial da Banca (com Desempate)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  Ordenação automática: <strong>1º Maior Total (máx 25)</strong> &gt; <strong>2º Maior Problema</strong> &gt; <strong>3º Maior Viabilidade</strong>.
                </p>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", borderBottom: "2px solid var(--border)" }}>
                    <th style={{ padding: "12px 14px", width: "70px", textAlign: "center" }}>Posição</th>
                    <th style={{ padding: "12px 14px" }}>Equipe</th>
                    <th style={{ padding: "12px 10px", textAlign: "center" }}>Problema (Desempate 1)</th>
                    <th style={{ padding: "12px 10px", textAlign: "center" }}>Viabilidade (Desempate 2)</th>
                    <th style={{ padding: "12px 10px", textAlign: "center" }}>Inovação</th>
                    <th style={{ padding: "12px 10px", textAlign: "center" }}>Impacto</th>
                    <th style={{ padding: "12px 10px", textAlign: "center" }}>Protótipo</th>
                    <th style={{ padding: "12px 14px", textAlign: "center", backgroundColor: "rgba(16, 185, 129, 0.1)" }}>
                      <span style={{ color: "#10b981", fontWeight: 800 }}>Pontuação Final</span>
                    </th>
                    <th style={{ padding: "12px 14px" }}>Anotações da Deliberação</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedTeams.map((team, rankIndex) => {
                    const pos = rankIndex + 1;
                    const isMedal = pos <= 3 && team.total > 0;
                    const medalEmoji = pos === 1 ? "🥇 1º" : pos === 2 ? "🥈 2º" : pos === 3 ? "🥉 3º" : `${pos}º`;

                    return (
                      <tr
                        key={team.teamName}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          backgroundColor:
                            pos === 1 && team.total > 0
                              ? "rgba(251, 191, 36, 0.08)"
                              : isMedal
                              ? "rgba(56, 189, 248, 0.04)"
                              : "transparent",
                        }}
                      >
                        {/* Posição */}
                        <td style={{ padding: "12px 14px", textAlign: "center", fontWeight: 800, fontSize: "14px" }}>
                          <span
                            style={{
                              color: pos === 1 && team.total > 0 ? "#fbbf24" : pos === 2 ? "#94a3b8" : pos === 3 ? "#d97706" : "var(--text-muted)",
                            }}
                          >
                            {medalEmoji}
                          </span>
                        </td>

                        {/* Equipe */}
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 800, fontSize: "14px", color: "var(--text)" }}>
                            {team.teamName}
                          </div>
                          {team.avaliadorNome && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Avaliado por: {team.avaliadorNome}
                            </div>
                          )}
                        </td>

                        {/* Problema (Desempate 1) */}
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <strong style={{ color: team.criterios.problema >= 4 ? "#10b981" : "var(--text)" }}>
                            {team.criterios.problema || "—"}
                          </strong>
                        </td>

                        {/* Viabilidade (Desempate 2) */}
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          <strong style={{ color: team.criterios.viabilidade >= 4 ? "#10b981" : "var(--text)" }}>
                            {team.criterios.viabilidade || "—"}
                          </strong>
                        </td>

                        {/* Inovação */}
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          {team.criterios.inovacao || "—"}
                        </td>

                        {/* Impacto */}
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          {team.criterios.impacto || "—"}
                        </td>

                        {/* Protótipo */}
                        <td style={{ padding: "12px 10px", textAlign: "center" }}>
                          {team.criterios.prototipoApresentacao || "—"}
                        </td>

                        {/* Total */}
                        <td style={{ padding: "12px 14px", textAlign: "center", backgroundColor: "rgba(16, 185, 129, 0.08)" }}>
                          <span style={{ fontSize: "17px", fontWeight: 900, color: team.total > 0 ? "#10b981" : "var(--text-muted)" }}>
                            {team.total > 0 ? `${team.total} pts` : "Sem nota"}
                          </span>
                        </td>

                        {/* Anotações */}
                        <td style={{ padding: "12px 14px", color: "var(--text-muted)", fontSize: "12px" }}>
                          {team.anotacoesDeliberacao || (
                            <span style={{ fontStyle: "italic", opacity: 0.5 }}>Nenhuma anotação</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Anotações Gerais para a Deliberação da Banca */}
          <div className="card">
            <h3 style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>
              📝 Anotações Gerais para a Deliberação da Banca
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--text-muted)" }}>
              Espaço reservado para o consenso final dos jurados, considerações de desempate, destaques especiais e
              justificativas de premiação.
            </p>
            <textarea
              className="input"
              rows={5}
              placeholder="Digite aqui as considerações gerais da banca para a deliberação dos vencedores do INOVA SAÚDE 2026..."
              value={deliberationGeneralNotes}
              onChange={(e) => handleGeneralNotesChange(e.target.value)}
              style={{ width: "100%", fontSize: "13px", resize: "vertical" }}
            />
          </div>
        </div>
      )}

      {/* ──── ABA 3: GUIA COMPLETO DOS 5 CRITÉRIOS ──── */}
      {activeSubTab === "criterios" && (
        <div className="stack" style={{ gap: "16px" }}>
          {BANCA_CRITERIOS_DEF.map((c) => (
            <div
              key={c.key}
              className="card"
              style={{
                borderLeft: c.desempate ? "4px solid #38bdf8" : "1px solid var(--border)",
              }}
            >
              <div className="spread" style={{ marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      backgroundColor: "rgba(56, 189, 248, 0.2)",
                      color: "#38bdf8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "14px",
                    }}
                  >
                    {c.numero}
                  </span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "var(--text)" }}>
                    {c.nome}
                  </h3>
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {c.peso}
                  </span>
                  {c.desempate && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        backgroundColor: "rgba(56, 189, 248, 0.2)",
                        color: "#38bdf8",
                      }}
                    >
                      ⚖️ {c.desempate}
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#38bdf8",
                  marginBottom: "14px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(56, 189, 248, 0.08)",
                }}
              >
                ❓ A pergunta: "{c.pergunta}"
              </div>

              {/* Escala de Pontuação 1, 3 e 5 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#ef4444", fontSize: "12px", marginBottom: "4px" }}>
                    Nota 1 (Mínima)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>{c.nivel1}</div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#f59e0b", fontSize: "12px", marginBottom: "4px" }}>
                    Nota 3 (Intermediária)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>{c.nivel3}</div>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#10b981", fontSize: "12px", marginBottom: "4px" }}>
                    Nota 5 (Excelente / Plena)
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text)" }}>{c.nivel5}</div>
                </div>
              </div>
              <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
                * Use notas 2 e 4 para avaliações intermediárias entre os níveis descritos acima.
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──── MODAL DE AVALIAÇÃO INTERATIVA DA EQUIPE ──── */}
      {evaluatingTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(5px)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => {
            if (!savingEvaluation) setEvaluatingTeam(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "1150px",
              width: "95vw",
              maxHeight: "92vh",
              overflowY: "auto",
              overflowX: "hidden",
              padding: "24px",
              position: "relative",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => {
                if (!savingEvaluation) setEvaluatingTeam(null);
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

            {/* Cabeçalho do Modal */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", paddingRight: "30px" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                    Ficha de Avaliação da Equipe #{evaluatingTeam.teamNumber}
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>
                    {evaluatingTeam.teamName}
                  </h2>
                </div>

                {/* Seletor Rápido de Equipe Anterior / Próxima */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navegarEquipeModal("anterior")}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                    title="Avaliar equipe anterior"
                  >
                    ◀ Anterior
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navegarEquipeModal("proxima")}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                    title="Avaliar próxima equipe"
                  >
                    Próxima ▶
                  </button>
                </div>
              </div>

              {/* Totalizador ao Vivo */}
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                  Soma dos 5 critérios:
                </div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#10b981" }}>
                  {evaluatingTeam.criterios.problema +
                    evaluatingTeam.criterios.inovacao +
                    evaluatingTeam.criterios.viabilidade +
                    evaluatingTeam.criterios.impacto +
                    evaluatingTeam.criterios.prototipoApresentacao}{" "}
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>/ 25 máx</span>
                </div>
              </div>
            </div>

            {/* ──── OS 5 CRITÉRIOS DE AVALIAÇÃO ──── */}
            <div className="stack" style={{ gap: "16px", marginBottom: "20px" }}>
              {BANCA_CRITERIOS_DEF.map((critDef) => {
                const valorAtual = evaluatingTeam.criterios[critDef.key] || 0;

                return (
                  <div
                    key={critDef.key}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      backgroundColor: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* Topo do Critério */}
                    <div className="spread" style={{ marginBottom: "4px", flexWrap: "wrap", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 800, color: "#38bdf8", fontSize: "14px" }}>
                          {critDef.numero}. {critDef.nome}
                        </span>
                        {critDef.desempate && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(56, 189, 248, 0.2)",
                              color: "#38bdf8",
                            }}
                          >
                            {critDef.desempate}
                          </span>
                        )}
                      </div>

                      {valorAtual > 0 && (
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 800,
                            color:
                              valorAtual >= 4 ? "#10b981" : valorAtual === 3 ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          Nota Atribuída: {valorAtual}/5
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px", fontStyle: "italic" }}>
                      "{critDef.pergunta}"
                    </div>

                    {/* Layout Lado a Lado Responsivo (O que a equipe colocou + Avaliação da Banca) */}
                    <div className="banca-criterion-split">
                      {/* Coluna Esquerda: Informações Declaradas pela Equipe */}
                      <div
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.22)",
                          borderRadius: "8px",
                          padding: "14px",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                      >
                        <TeamCriterionInfoBox critKey={critDef.key} team={evaluatingTeam.teamData} />
                      </div>

                      {/* Coluna Direita: Avaliação da Banca e Guia Oficial */}
                      <div
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.22)",
                          borderRadius: "8px",
                          padding: "14px",
                          border: "1px solid rgba(255, 255, 255, 0.07)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "12px",
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#fbbf24", letterSpacing: "0.5px" }}>
                              ⭐ NOTA DA BANCA (1 A 5):
                            </span>
                            {valorAtual > 0 && (
                              <span
                                style={{
                                  fontSize: "11.5px",
                                  fontWeight: 800,
                                  color: valorAtual >= 4 ? "#10b981" : valorAtual === 3 ? "#f59e0b" : "#ef4444",
                                }}
                              >
                                {valorAtual === 1 ? "1 - Crítico" : valorAtual === 2 ? "2 - Fraco" : valorAtual === 3 ? "3 - Médio" : valorAtual === 4 ? "4 - Bom" : "5 - Excelente"}
                              </span>
                            )}
                          </div>

                          {/* 5 Botões de Nota com largura 100% responsiva */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "6px", width: "100%" }}>
                            {[1, 2, 3, 4, 5].map((nota) => {
                              const isSelected = valorAtual === nota;
                              return (
                                <button
                                  key={nota}
                                  type="button"
                                  onClick={() => {
                                    setEvaluatingTeam({
                                      ...evaluatingTeam,
                                      criterios: {
                                        ...evaluatingTeam.criterios,
                                        [critDef.key]: nota,
                                      },
                                    });
                                  }}
                                  style={{
                                    padding: "10px 2px",
                                    borderRadius: "8px",
                                    border: isSelected ? "2px solid #38bdf8" : "1px solid var(--border)",
                                    backgroundColor: isSelected ? "#0284c7" : "rgba(255, 255, 255, 0.04)",
                                    color: isSelected ? "#ffffff" : "var(--text)",
                                    cursor: "pointer",
                                    textAlign: "center",
                                    transition: "all 0.15s ease",
                                    minWidth: 0,
                                  }}
                                >
                                  <div style={{ fontSize: "18px", fontWeight: 900, lineHeight: 1 }}>{nota}</div>
                                  <div
                                    style={{
                                      fontSize: "9px",
                                      fontWeight: 600,
                                      opacity: 0.85,
                                      marginTop: "4px",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {nota === 1 ? "Crítico" : nota === 2 ? "Fraco" : nota === 3 ? "Médio" : nota === 4 ? "Bom" : "Excelente"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Guia de Pontuação Oficial deste Critério */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "12px" }}>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                              Guia de Avaliação deste Critério:
                            </div>

                            <div
                              onClick={() => {
                                setEvaluatingTeam({
                                  ...evaluatingTeam,
                                  criterios: {
                                    ...evaluatingTeam.criterios,
                                    [critDef.key]: 1,
                                  },
                                });
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                cursor: "pointer",
                                border: valorAtual === 1 ? "1.5px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.06)",
                                background: valorAtual === 1 ? "rgba(239, 68, 68, 0.18)" : "rgba(255, 255, 255, 0.02)",
                                transition: "all 0.15s ease",
                                lineHeight: 1.35,
                              }}
                              title="Clique para atribuir Nota 1"
                            >
                              <strong style={{ color: "#ef4444" }}>Nota 1:</strong>{" "}
                              <span style={{ color: "var(--text)" }}>{critDef.nivel1}</span>
                            </div>

                            <div
                              onClick={() => {
                                setEvaluatingTeam({
                                  ...evaluatingTeam,
                                  criterios: {
                                    ...evaluatingTeam.criterios,
                                    [critDef.key]: 3,
                                  },
                                });
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                cursor: "pointer",
                                border: valorAtual === 3 ? "1.5px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.06)",
                                background: valorAtual === 3 ? "rgba(245, 158, 11, 0.18)" : "rgba(255, 255, 255, 0.02)",
                                transition: "all 0.15s ease",
                                lineHeight: 1.35,
                              }}
                              title="Clique para atribuir Nota 3"
                            >
                              <strong style={{ color: "#f59e0b" }}>Nota 3:</strong>{" "}
                              <span style={{ color: "var(--text)" }}>{critDef.nivel3}</span>
                            </div>

                            <div
                              onClick={() => {
                                setEvaluatingTeam({
                                  ...evaluatingTeam,
                                  criterios: {
                                    ...evaluatingTeam.criterios,
                                    [critDef.key]: 5,
                                  },
                                });
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                cursor: "pointer",
                                border: valorAtual === 5 ? "1.5px solid #10b981" : "1px solid rgba(255, 255, 255, 0.06)",
                                background: valorAtual === 5 ? "rgba(16, 185, 129, 0.18)" : "rgba(255, 255, 255, 0.02)",
                                transition: "all 0.15s ease",
                                lineHeight: 1.35,
                              }}
                              title="Clique para atribuir Nota 5"
                            >
                              <strong style={{ color: "#10b981" }}>Nota 5:</strong>{" "}
                              <span style={{ color: "var(--text)" }}>{critDef.nivel5}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "4px" }}>
                          💡 Clique nos botões 1 a 5 ou diretamente na descrição acima. Use 2 e 4 para intermediários.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ──── ANOTAÇÕES PARA A DELIBERAÇÃO DA EQUIPE ──── */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: "6px",
                }}
              >
                💬 Anotações para a deliberação desta equipe:
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Pontos fortes, pontos a melhorar, feedback do pitch e notas para a discussão final da banca..."
                value={evaluatingTeam.anotacoesDeliberacao}
                onChange={(e) =>
                  setEvaluatingTeam({
                    ...evaluatingTeam,
                    anotacoesDeliberacao: e.target.value,
                  })
                }
                style={{ width: "100%", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            {/* ──── RODAPÉ DO MODAL ──── */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                borderTop: "1px solid var(--border)",
                paddingTop: "14px",
              }}
            >
              {evaluatingTeam.total > 0 ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => removerAvaliacaoEquipe(evaluatingTeam.teamName)}
                  disabled={savingEvaluation}
                  style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
                >
                  🗑️ Limpar Notas
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
                  onClick={() => salvarAvaliacaoEquipe(evaluatingTeam)}
                  disabled={savingEvaluation}
                  style={{ minWidth: "150px" }}
                >
                  {savingEvaluation ? "Salvando..." : "💾 Salvar Notas"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── CSS DE IMPRESSÃO LIMPA E PROFISSIONAL ──── */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, nav, .tab-bar, .btn, .banca-eval-container button {
            display: none !important;
          }
          .banca-eval-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          .card {
            box-shadow: none !important;
            border: 1px solid #cccccc !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          table {
            color: #000000 !important;
            border: 1px solid #000000 !important;
          }
          th, td {
            border: 1px solid #cccccc !important;
            color: #000000 !important;
          }
        }
      `}</style>
    </div>
  );
}
