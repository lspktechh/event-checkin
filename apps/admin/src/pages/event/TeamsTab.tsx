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
} from "../../components/Icons";
import { formatPhone } from "../../utils/formatters";

interface TeamsTabProps {
  eventId: string;
  eventName?: string;
}

interface TeamMemberDetail {
  id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  curso?: string;
  vinculo?: string;
  papel?: string;
  competencias?: string[];
  isLeader?: boolean;
}

interface TeamRecord {
  id: string;
  teamName: string;
  status: "CONFIRMED" | "PENDING" | "CANCELLED";
  lider: TeamMemberDetail;
  integrantes: TeamMemberDetail[];
  totalIntegrantes: number;
  ideia: string;
  eixo: string;
  dor?: string;
  usuario?: string;
  faltaNaEquipe: string[];
  competenciasEquipe: string[];
  abertaANovos: boolean;
  vagasRestantes: number;
  createdAt: string;
  rawInscription: api.InscriptionReportItem;
}

export function TeamsTab({ eventId }: TeamsTabProps) {
  const [inscriptions, setInscriptions] = useState<api.InscriptionReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroEixo, setFiltroEixo] = useState("TODOS");
  const [selectedTeam, setSelectedTeam] = useState<TeamRecord | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

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

  // Processa as inscrições para extrair as equipes formadas reais
  const teams: TeamRecord[] = useMemo(() => {
    const list: TeamRecord[] = [];

    for (const ins of inscriptions) {
      // Ignora submissões de trabalho duplicadas
      if (ins.name?.startsWith("[TRABALHO]") || ins.category?.includes("Trabalho")) {
        continue;
      }

      let parsedNotes: any = null;
      try {
        if (ins.notes) {
          parsedNotes = JSON.parse(ins.notes);
        }
      } catch {
        parsedNotes = null;
      }

      if (parsedNotes?.tipo_registro === "SUBMISSAO_TRABALHO") {
        continue;
      }

      // Verifica se é equipe formada (possui teamName ou trilha com ideia ou membros cadastrados)
      const trilha = parsedNotes?.trilha;
      const teamNameRaw =
        ins.teamName?.trim() ||
        parsedNotes?.equipeNome?.trim() ||
        parsedNotes?.payload_completo?.equipeNome?.trim();

      const hasTeam = Boolean(
        teamNameRaw ||
        (ins.teamMembers && ins.teamMembers.length > 0) ||
        (trilha && trilha !== "sem_ideia")
      );

      if (!hasTeam) {
        continue;
      }

      const teamName = teamNameRaw || `Equipe de ${ins.name}`;

      // Monta detalhes do Líder
      const liderNotes = parsedNotes?.lider || parsedNotes?.membros_detalhes?.[0];
      const lider: TeamMemberDetail = {
        nome: ins.name,
        email: ins.email,
        telefone: ins.phone || liderNotes?.telefone,
        curso: ins.institution || liderNotes?.curso,
        vinculo: liderNotes?.vinculo || "Líder",
        papel: liderNotes?.papel || "Líder da equipe",
        competencias: liderNotes?.competencias || [],
        isLeader: true,
      };

      // Monta integrantes secundários
      const integrantes: TeamMemberDetail[] = [];
      const membrosDetalhes = parsedNotes?.membros_detalhes || parsedNotes?.payload_completo?.membros;

      if (Array.isArray(membrosDetalhes) && membrosDetalhes.length > 0) {
        membrosDetalhes.forEach((m: any, idx: number) => {
          // Pula o líder caso venha no array
          if (m.isLeader || (idx === 0 && m.nome === ins.name)) return;
          integrantes.push({
            nome: m.nome,
            email: m.email,
            telefone: m.telefone,
            curso: m.curso,
            vinculo: m.vinculo,
            papel: m.papel || "Integrante",
            competencias: m.competencias || [],
            isLeader: false,
          });
        });
      } else if (ins.teamMembers && ins.teamMembers.length > 0) {
        ins.teamMembers.forEach((mName) => {
          if (mName !== ins.name) {
            integrantes.push({
              nome: mName,
              papel: "Integrante",
              isLeader: false,
            });
          }
        });
      }

      const totalIntegrantes = 1 + integrantes.length;
      const fp = parsedNotes?.ficha_prototipo;
      const ideia =
        fp?.funcao ||
        parsedNotes?.idear?.nome_solucao ||
        parsedNotes?.definir?.frase?.o_que ||
        "Solução inovadora desenvolvida para a maratona";
      const eixo =
        fp?.eixo ||
        parsedNotes?.definir?.eixo ||
        "Eixo Temático Geral";

      const abertaANovos = parsedNotes?.fechamento?.aberta_a_novos !== false;
      const vagasRestantes = abertaANovos ? Math.max(0, 6 - totalIntegrantes) : 0;

      list.push({
        id: ins.id,
        teamName,
        status: ins.status,
        lider,
        integrantes,
        totalIntegrantes,
        ideia,
        eixo,
        dor: fp?.dor || parsedNotes?.empatizar?.o_que_perde,
        usuario: fp?.usuario || parsedNotes?.empatizar?.quem_vive,
        faltaNaEquipe: fp?.falta_na_equipe || [],
        competenciasEquipe: fp?.competencias_equipe || [],
        abertaANovos,
        vagasRestantes,
        createdAt: ins.createdAt,
        rawInscription: ins,
      });
    }

    return list;
  }, [inscriptions]);

  // Lista de eixos únicos para o filtro
  const eixosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    teams.forEach((t) => {
      if (t.eixo) set.add(t.eixo);
    });
    return Array.from(set);
  }, [teams]);

  // Filtragem
  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const matchEixo = filtroEixo === "TODOS" || t.eixo === filtroEixo;
      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        t.teamName.toLowerCase().includes(searchLower) ||
        t.lider.nome.toLowerCase().includes(searchLower) ||
        t.ideia.toLowerCase().includes(searchLower) ||
        t.integrantes.some((i) => i.nome.toLowerCase().includes(searchLower));
      return matchEixo && matchSearch;
    });
  }, [teams, search, filtroEixo]);

  // Totalizadores
  const totalMembrosAlocados = useMemo(() => {
    return teams.reduce((acc, t) => acc + t.totalIntegrantes, 0);
  }, [teams]);

  function copiarContatosDaEquipe(team: TeamRecord) {
    const contatos = [
      `Equipe: ${team.teamName}`,
      `Líder: ${team.lider.nome} (${team.lider.email || "Sem e-mail"} - ${team.lider.telefone || "Sem telefone"})`,
      ...team.integrantes.map(
        (i) => `Integrante: ${i.nome} (${i.email || "Sem e-mail"} - ${i.telefone || "Sem telefone"})`
      ),
    ].join("\n");

    navigator.clipboard.writeText(contatos);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  }

  function getWhatsAppUrl(phone?: string) {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    if (!clean) return null;
    const full = clean.startsWith("55") ? clean : `55${clean}`;
    return `https://wa.me/${full}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* ──── CABEÇALHO E ESTATÍSTICAS ──── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
            Equipes Formadas no INOVA SAÚDE
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
            Visualize todas as equipes montadas, seus integrantes, ideias e contatos diretos. Clique em uma equipe para abrir a ficha completa.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTeams}
          className="btn btn-secondary btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <RefreshIcon size={14} />
          <span>Atualizar</span>
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
              Equipes Formadas
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
              Pessoas em Equipes
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800 }}>{totalMembrosAlocados}</div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayersIcon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Média por Equipe
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800 }}>
              {teams.length > 0 ? (totalMembrosAlocados / teams.length).toFixed(1) : 0}
            </div>
          </div>
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
            placeholder="Buscar por equipe, líder ou integrante..."
            style={{ paddingLeft: "36px", width: "100%" }}
          />
        </div>

        {eixosDisponiveis.length > 0 && (
          <select
            className="input"
            value={filtroEixo}
            onChange={(e) => setFiltroEixo(e.target.value)}
            style={{ width: "auto", minWidth: "200px" }}
          >
            <option value="TODOS">Todos os Eixos ({teams.length})</option>
            {eixosDisponiveis.map((eixo) => (
              <option key={eixo} value={eixo}>
                {eixo}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ──── ESTADOS DE CARREGAMENTO / ERRO ──── */}
      {loading && (
        <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          Carregando equipes do evento...
        </div>
      )}

      {error && (
        <div className="badge badge-danger" style={{ padding: "12px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* ──── GRADE DE EQUIPES ──── */}
      {!loading && filteredTeams.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
          <UsersIcon size={44} style={{ opacity: 0.4, marginBottom: "8px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "var(--text)" }}>Nenhuma equipe encontrada</h3>
          <p style={{ margin: 0, fontSize: "13px" }}>Nenhuma equipe corresponde aos filtros informados.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="card"
              onClick={() => setSelectedTeam(team)}
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

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
                  <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                    👥 {team.totalIntegrantes} integrante(s)
                  </span>
                  <span className="badge badge-muted" style={{ fontSize: "11px" }}>
                    {team.eixo.split(" ")[0]}...
                  </span>
                  {team.vagasRestantes > 0 && (
                    <span className="badge badge-amber" style={{ fontSize: "11px" }}>
                      {team.vagasRestantes} vaga(s) aberta(s)
                    </span>
                  )}
                </div>

                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  "{team.ideia}"
                </p>

                {/* Resumo dos Integrantes */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>
                    👑 Líder: {team.lider.nome}
                  </div>
                  {team.integrantes.length > 0 && (
                    <div style={{ color: "var(--text-muted)" }}>
                      <span style={{ fontWeight: 500 }}>Demais membros:</span>{" "}
                      {team.integrantes.map((i) => i.nome).join(", ")}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                  Clique para ver detalhes →
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  {new Date(team.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──── MODAL DE DETALHES DA EQUIPE SELECIONADA ──── */}
      {selectedTeam && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setSelectedTeam(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "680px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => setSelectedTeam(null)}
              style={{
                position: "absolute",
                right: "16px",
                top: "16px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: "6px",
                borderRadius: "8px",
              }}
            >
              <XIcon size={20} />
            </button>

            {/* Cabeçalho da Equipe */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span className="badge badge-cyan" style={{ fontSize: "11px" }}>
                  Equipe Oficial INOVA SAÚDE
                </span>
                <span className={`badge ${selectedTeam.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                  {selectedTeam.status === "CONFIRMED" ? "Inscrição Confirmada" : "Pendente"}
                </span>
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0" }}>
                {selectedTeam.teamName}
              </h2>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Protocolo: <code>{selectedTeam.id}</code> · Cadastrada em{" "}
                {new Date(selectedTeam.createdAt).toLocaleString("pt-BR")}
              </div>
            </div>

            {/* Ações Rápidas de Contato */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => copiarContatosDaEquipe(selectedTeam)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <IdCardIcon size={14} />
                <span>{copiedToast ? "Contatos Copiados!" : "Copiar Contatos da Equipe"}</span>
              </button>

              {getWhatsAppUrl(selectedTeam.lider.telefone) && (
                <a
                  href={getWhatsAppUrl(selectedTeam.lider.telefone)!}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#10b981" }}
                >
                  <MessageIcon size={14} />
                  <span>WhatsApp do Líder</span>
                </a>
              )}
            </div>

            {/* ──── INTEGRANTES DA EQUIPE ──── */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 12px" }}>
                Integrantes da Equipe ({selectedTeam.totalIntegrantes})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Card do Líder */}
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    background: "rgba(45, 212, 191, 0.08)",
                    border: "1px solid rgba(45, 212, 191, 0.25)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--text)" }}>
                      👑 {selectedTeam.lider.nome}
                    </div>
                    <span className="badge badge-cyan" style={{ fontSize: "10px" }}>
                      Líder Responsável
                    </span>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "6px" }}>
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
                  </div>

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

                {/* Cards dos Demais Integrantes */}
                {selectedTeam.integrantes.map((membro, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "12px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text)" }}>
                        👤 {membro.nome}
                      </div>
                      <span className="badge badge-muted" style={{ fontSize: "10px" }}>
                        {membro.papel || "Integrante"}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "4px" }}>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ──── DETALHES DO PROJETO / FICHA ──── */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "18px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--accent)", margin: "0 0 12px" }}>
                Ficha do Projeto e Ideia
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>Eixo Temático: </span>
                  <span style={{ color: "var(--text-muted)" }}>{selectedTeam.eixo}</span>
                </div>

                <div>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>Proposta / Função da Solução: </span>
                  <p style={{ margin: "4px 0 0", color: "var(--text-muted)", lineHeight: 1.5, background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    {selectedTeam.ideia}
                  </p>
                </div>

                {selectedTeam.dor && (
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Dor / Problema que Resolve: </span>
                    <p style={{ margin: "4px 0 0", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {selectedTeam.dor}
                    </p>
                  </div>
                )}

                {selectedTeam.faltaNaEquipe.length > 0 && (
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Habilidades que Faltam na Equipe: </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      {selectedTeam.faltaNaEquipe.map((f, i) => (
                        <span key={i} className="badge badge-amber" style={{ fontSize: "11px" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedTeam(null)}
                className="btn btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
