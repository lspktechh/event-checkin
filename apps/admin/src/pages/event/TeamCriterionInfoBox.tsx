import { type CriteriosBanca } from "./EvaluationTab";

// ──── REGISTRO OFICIAL DAS ODS DA ONU ────
export const ODS_MAP: Record<number, { nome: string; cor: string; resumo?: string }> = {
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
export const FORMAS_MAP: Record<string, { titulo: string; badge: string; cor: string }> = {
  forma_a: { titulo: "Software / Aplicação Digital", badge: "Software", cor: "#3b82f6" },
  forma_b: { titulo: "Peça Física para Impressão 3D", badge: "Peça 3D", cor: "#f59e0b" },
  forma_c: { titulo: "Serviço, Protocolo ou Fluxo Assistencial", badge: "Serviço / Fluxo", cor: "#10b981" },
  forma_d: { titulo: "Espaço, Sinalização ou Comunicação Visual", badge: "Comunicação", cor: "#ec4899" },
};

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
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export interface TeamCriterionData {
  teamName?: string;
  definir?: {
    eixo?: string;
    frequencia?: string;
    como_resolvem_hoje?: string;
    por_que_nao_resolve?: string;
    frase?: {
      quem?: string;
      o_que?: string;
      por_que?: string;
      o_que_atrapalha?: string;
    };
  };
  empatizar?: {
    quem_vive?: string;
    o_que_perde?: string;
    como_sabe?: string[];
  };
  idear?: {
    nome_solucao?: string;
    categoria?: string;
    tres_passos?: string[];
    passos?: Array<{ quem_faz?: string; acao?: string; o_que_acontece?: string }>;
    frase?: {
      nome?: string;
      categoria?: string;
      beneficio?: string;
      alternativa?: string;
      diferencial?: string;
    };
  };
  escopo?: {
    e?: string;
    nao_e?: string;
    faz?: string[];
    nao_faz?: string[];
  };
  forma?: {
    formas?: string[];
    peca_3d?: {
      pecaEncaixaEm?: string;
      pecaMaterial?: string;
      material?: string;
      cabe_na_mesa?: boolean;
      envelope_mm?: number[];
      pecaEnvelope?: number[];
    };
    software?: Array<{ nome?: string; acao?: string }>;
    servico?: {
      quem_executa_hoje?: string;
      passo_a_passo_atual?: string[];
      o_que_muda?: string;
    };
    trava_sanitaria?: {
      acionada?: boolean;
      motivos?: string[];
    };
    dispositivo?: {
      ja_existe?: string;
      alimentacao?: string;
    };
  };
  fechamento?: {
    como_saberemos?: string;
    metrica_sucesso?: string;
    maior_duvida?: string;
    duvida_desafio?: string;
    ods?: number[];
  };
  competenciasEquipe?: string[];
  faltaNaEquipe?: string[];
  habilidadesFaltam?: string[];
  trabalhos?: Array<{
    origem?: string;
    data?: string;
    videoUrl?: string;
    prototipoUrl?: string;
    observacoes?: string;
    itens?: Array<{ tipo?: string; titulo?: string; linkUrl?: string; url?: string; link?: string }>;
  }>;
}

interface TeamCriterionInfoBoxProps {
  critKey: keyof CriteriosBanca;
  team: TeamCriterionData | any;
}

export function TeamCriterionInfoBox({ critKey, team }: TeamCriterionInfoBoxProps) {
  if (!team) {
    return (
      <div style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", padding: "10px" }}>
        Nenhuma informação declarada encontrada para esta equipe.
      </div>
    );
  }

  // Normalização de dados (suporta TeamRecord ou notas brutas de Inscription)
  const data: TeamCriterionData = {
    teamName: team.teamName || team.name,
    definir: team.definir || team.notes?.definir || team.payload_completo?.definir,
    empatizar: team.empatizar || team.notes?.empatizar || team.payload_completo?.empatizar,
    idear: team.idear || team.notes?.idear || team.payload_completo?.idear,
    escopo: team.escopo || team.notes?.escopo || team.payload_completo?.escopo,
    forma: team.forma || team.notes?.forma || team.payload_completo?.forma,
    fechamento: team.fechamento || team.notes?.fechamento || team.payload_completo?.fechamento,
    competenciasEquipe: team.competenciasEquipe || team.notes?.competenciasEquipe,
    faltaNaEquipe: team.faltaNaEquipe || team.habilidadesFaltam || team.notes?.faltaNaEquipe,
    trabalhos: team.trabalhos || team.notes?.trabalhos || [],
  };

  switch (critKey) {
    case "problema": {
      const eixo = data.definir?.eixo;
      const quemVive = data.empatizar?.quem_vive || data.definir?.frase?.quem;
      const oQuePerde = data.empatizar?.o_que_perde || data.definir?.frase?.por_que;
      const comoResolvem = data.definir?.como_resolvem_hoje;
      const porQueNaoResolve = data.definir?.por_que_nao_resolve;
      const frequencia = data.definir?.frequencia;
      const oQueAtrapalha = data.definir?.frase?.o_que_atrapalha;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, overflow: "hidden", wordBreak: "break-word" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 Declarado pela Equipe (Problema):
            </span>
            {eixo && (
              <span className="badge badge-cyan" style={{ fontSize: "10.5px" }}>
                🎯 Eixo: {eixo}
              </span>
            )}
          </div>

          {quemVive && (
            <div style={{ fontSize: "12px", background: "rgba(255,255,255,0.03)", padding: "7px 10px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <strong style={{ color: "#38bdf8" }}>👤 Quem vive a dor (Beneficiário):</strong>
              <div style={{ color: "var(--text)", marginTop: "2px", lineHeight: "1.35" }}>{quemVive}</div>
            </div>
          )}

          {oQuePerde && (
            <div style={{ fontSize: "12px", background: "rgba(239, 68, 68, 0.06)", padding: "7px 10px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
              <strong style={{ color: "#f87171" }}>🩹 A Dor Real / O que perde hoje:</strong>
              <div style={{ color: "var(--text)", marginTop: "2px", lineHeight: "1.35" }}>{oQuePerde}</div>
            </div>
          )}

          {(comoResolvem || porQueNaoResolve) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "6px" }}>
              {comoResolvem && (
                <div style={{ fontSize: "11px", background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <strong style={{ color: "var(--text-muted)" }}>Como resolvem hoje:</strong>
                  <div style={{ color: "var(--text)", marginTop: "2px" }}>{comoResolvem}</div>
                </div>
              )}
              {porQueNaoResolve && (
                <div style={{ fontSize: "11px", background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                  <strong style={{ color: "#f87171" }}>Por que não resolve:</strong>
                  <div style={{ color: "var(--text)", marginTop: "2px" }}>{porQueNaoResolve}</div>
                </div>
              )}
            </div>
          )}

          {(frequencia || oQueAtrapalha) && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
              {frequencia && <span>⏱️ <strong>Frequência:</strong> {frequencia}</span>}
              {oQueAtrapalha && <span>🚧 <strong>O que atrapalha:</strong> {oQueAtrapalha}</span>}
            </div>
          )}
        </div>
      );
    }

    case "inovacao": {
      const nomeSolucao = data.idear?.nome_solucao || data.idear?.frase?.nome;
      const escopoE = data.escopo?.e;
      const escopoNaoE = data.escopo?.nao_e;
      const escopoFaz = Array.isArray(data.escopo?.faz) ? data.escopo?.faz.filter(Boolean) : [];
      const escopoNaoFaz = Array.isArray(data.escopo?.nao_faz) ? data.escopo?.nao_faz.filter(Boolean) : [];
      const passos = Array.isArray(data.idear?.tres_passos) ? data.idear?.tres_passos.filter(Boolean) : [];
      const jaExiste = data.forma?.dispositivo?.ja_existe || data.idear?.frase?.alternativa;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, overflow: "hidden", wordBreak: "break-word" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 Declarado pela Equipe (Inovação):
            </span>
            {nomeSolucao && (
              <span className="badge badge-purple" style={{ fontSize: "11px", fontWeight: 700 }}>
                💡 Solução: {nomeSolucao}
              </span>
            )}
          </div>

          {(escopoE || escopoNaoE) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "6px" }}>
              {escopoE && (
                <div style={{ fontSize: "11.5px", background: "rgba(16, 185, 129, 0.06)", padding: "7px 9px", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                  <strong style={{ color: "#34d399" }}>✨ O que É:</strong>
                  <div style={{ color: "var(--text)", marginTop: "2px" }}>{escopoE}</div>
                </div>
              )}
              {escopoNaoE && (
                <div style={{ fontSize: "11.5px", background: "rgba(239, 68, 68, 0.06)", padding: "7px 9px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.25)" }}>
                  <strong style={{ color: "#f87171" }}>🚫 O que NÃO É:</strong>
                  <div style={{ color: "var(--text)", marginTop: "2px" }}>{escopoNaoE}</div>
                </div>
              )}
            </div>
          )}

          {escopoFaz.length > 0 && (
            <div style={{ fontSize: "11px" }}>
              <strong style={{ color: "#38bdf8" }}>⚡ Diferenciais / O que FAZ:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
                {escopoFaz.map((item, i) => (
                  <span key={i} className="badge badge-cyan" style={{ fontSize: "10px" }}>
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {escopoNaoFaz.length > 0 && (
            <div style={{ fontSize: "11px" }}>
              <strong style={{ color: "var(--text-muted)" }}>⛔ Limites de Escopo / O que NÃO FAZ:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px" }}>
                {escopoNaoFaz.map((item, i) => (
                  <span key={i} className="badge badge-muted" style={{ fontSize: "10px" }}>
                    ✕ {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {passos.length > 0 && (
            <div style={{ fontSize: "11px", background: "rgba(255,255,255,0.02)", padding: "7px 9px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <strong style={{ color: "var(--text)" }}>🪜 Passos de Funcionamento da Ideia:</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "3px" }}>
                {passos.map((p, idx) => (
                  <div key={idx} style={{ color: "var(--text-muted)", fontSize: "10.5px" }}>
                    <span style={{ color: "#38bdf8", fontWeight: 700 }}>Passo {idx + 1}:</span> {p}
                  </div>
                ))}
              </div>
            </div>
          )}

          {jaExiste && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              🔍 <strong>Existe no mercado:</strong> {jaExiste}
            </div>
          )}
        </div>
      );
    }

    case "viabilidade": {
      const formas = Array.isArray(data.forma?.formas) ? data.forma?.formas : [];
      const peca3d = data.forma?.peca_3d;
      const software = Array.isArray(data.forma?.software) ? data.forma?.software : [];
      const trava = data.forma?.trava_sanitaria;
      const comp = Array.isArray(data.competenciasEquipe) ? data.competenciasEquipe : [];
      const faltas = Array.isArray(data.faltaNaEquipe) ? data.faltaNaEquipe : [];
      const duvida = data.fechamento?.maior_duvida || data.fechamento?.duvida_desafio;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, overflow: "hidden", wordBreak: "break-word" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 Declarado pela Equipe (Viabilidade):
            </span>
            {formas.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {formas.map((f) => (
                  <span key={f} className="badge badge-amber" style={{ fontSize: "10.5px" }}>
                    🛠️ {FORMAS_MAP[f]?.badge || f}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Trava Sanitária */}
          {trava && (
            <div
              style={{
                padding: "7px 10px",
                borderRadius: "6px",
                fontSize: "11.5px",
                background: trava.acionada ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                border: `1px solid ${trava.acionada ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              }}
            >
              <div style={{ fontWeight: 700, color: trava.acionada ? "#ef4444" : "#10b981" }}>
                {trava.acionada ? "⚠️ Trava Sanitária Acionada" : "✅ Trava Sanitária Liberada"}
              </div>
              <div style={{ color: "var(--text-muted)", marginTop: "2px", fontSize: "10.5px" }}>
                {trava.acionada
                  ? `Motivos: ${Array.isArray(trava.motivos) && trava.motivos.length > 0 ? trava.motivos.join(", ") : "Requer validação comissão clínica"}`
                  : "O dispositivo não possui contato invasivo direto com fluidos ou pele lesionada."}
              </div>
            </div>
          )}

          {/* Prototipagem 3D */}
          {peca3d && (peca3d.material || peca3d.pecaEnvelope || peca3d.envelope_mm || peca3d.pecaEncaixaEm) && (
            <div style={{ fontSize: "11px", background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <strong style={{ color: "#f59e0b" }}>📐 Especificações Físicas / Impressão 3D:</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "3px", color: "var(--text-muted)" }}>
                {(peca3d.pecaEnvelope || peca3d.envelope_mm) && (
                  <span>Envelope: <strong>{(peca3d.pecaEnvelope || peca3d.envelope_mm)?.join(" x ")} mm</strong></span>
                )}
                <span>Material: <strong>{peca3d.material || peca3d.pecaMaterial || "PLA"}</strong></span>
                {peca3d.cabe_na_mesa !== undefined && (
                  <span style={{ color: peca3d.cabe_na_mesa !== false ? "#10b981" : "#ef4444" }}>
                    {peca3d.cabe_na_mesa !== false ? "✓ Cabe na mesa" : "⚠️ Excede mesa"}
                  </span>
                )}
                {peca3d.pecaEncaixaEm && <span>Encaixe: <strong>{peca3d.pecaEncaixaEm}</strong></span>}
              </div>
            </div>
          )}

          {/* Software */}
          {software.length > 0 && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              💻 <strong>Telas planejadas ({software.length}):</strong>{" "}
              {software.map((s, idx) => s.nome || `Tela ${idx + 1}`).join(", ")}
            </div>
          )}

          {/* Competências e Faltas */}
          {(comp.length > 0 || faltas.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "6px" }}>
              {comp.length > 0 && (
                <div style={{ fontSize: "10.5px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Equipe domina: </span>
                  <span style={{ color: "var(--text)" }}>{comp.join(", ")}</span>
                </div>
              )}
              {faltas.length > 0 && (
                <div style={{ fontSize: "10.5px" }}>
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>Habilidades que faltam: </span>
                  <span style={{ color: "var(--text)" }}>{faltas.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {duvida && (
            <div style={{ fontSize: "11px", background: "rgba(255,255,255,0.02)", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border)" }}>
              <strong style={{ color: "#fbbf24" }}>❓ Maior dúvida ou desafio:</strong>
              <div style={{ color: "var(--text)", marginTop: "2px", fontStyle: "italic" }}>"{duvida}"</div>
            </div>
          )}
        </div>
      );
    }

    case "impacto": {
      const metrica = data.fechamento?.como_saberemos || data.fechamento?.metrica_sucesso;
      const ods = Array.isArray(data.fechamento?.ods) ? data.fechamento?.ods : [];
      const beneficio = data.definir?.frase?.o_que || data.idear?.frase?.beneficio;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, overflow: "hidden", wordBreak: "break-word" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 Declarado pela Equipe (Impacto):
            </span>
          </div>

          {metrica ? (
            <div style={{ fontSize: "12px", background: "rgba(16, 185, 129, 0.06)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
              <strong style={{ color: "#34d399" }}>📈 Métrica de Sucesso (Como saberemos se deu certo):</strong>
              <div style={{ color: "var(--text)", marginTop: "3px", lineHeight: "1.35" }}>{metrica}</div>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
              Nenhuma métrica específica detalhada no formulário.
            </div>
          )}

          {ods.length > 0 && (
            <div style={{ fontSize: "11px" }}>
              <strong style={{ color: "#38bdf8" }}>🌍 Objetivos de Desenvolvimento Sustentável (ODS ONU):</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "4px" }}>
                {ods.map((odsNum) => {
                  const info = ODS_MAP[odsNum] || { nome: `ODS ${odsNum}`, cor: "#3b82f6" };
                  return (
                    <div
                      key={odsNum}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "2px 7px",
                        borderRadius: "5px",
                        backgroundColor: `${info.cor}22`,
                        border: `1px solid ${info.cor}55`,
                        color: "#ffffff",
                        fontSize: "10.5px",
                        fontWeight: 700,
                      }}
                      title={info.resumo || info.nome}
                    >
                      <span style={{ backgroundColor: info.cor, color: "#fff", padding: "1px 4px", borderRadius: "3px", fontSize: "9.5px" }}>
                        {odsNum}
                      </span>
                      <span>{info.nome}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {beneficio && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              🏥 <strong>Benefício na assistência:</strong> {beneficio}
            </div>
          )}
        </div>
      );
    }

    case "prototipoApresentacao": {
      const trabalhos = Array.isArray(data.trabalhos) ? data.trabalhos : [];

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, overflow: "hidden", wordBreak: "break-word" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", color: "#38bdf8", letterSpacing: "0.5px" }}>
              📋 Entregas e Links do Protótipo ({trabalhos.length}):
            </span>
          </div>

          {trabalhos.length === 0 ? (
            <div style={{ fontSize: "11.5px", color: "var(--text-muted)", padding: "8px 10px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px dashed var(--border)" }}>
              ⏳ Nenhum protótipo ou documento foi anexado online pela equipe. Avaliar a apresentação e pitch ao vivo na banca examinadora.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {trabalhos.map((t, idx) => {
                const validVideo = getValidExternalUrl(t.videoUrl);
                const validProto = getValidExternalUrl(t.prototipoUrl);

                return (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                      fontSize: "11.5px",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "4px" }}>
                      {validVideo && (
                        <a
                          href={validVideo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#38bdf8" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          ▶️ Assistir Vídeo Pitch
                        </a>
                      )}

                      {validProto && (
                        <a
                          href={validProto}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#10b981" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          🔗 Abrir Protótipo / Figma
                        </a>
                      )}

                      {Array.isArray(t.itens) &&
                        t.itens.map((it, iIdx) => {
                          const validIt = getValidExternalUrl(it.linkUrl || it.url || it.link);
                          if (!validIt) return null;
                          return (
                            <a
                              key={iIdx}
                              href={validIt}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📄 {it.titulo || "Artefato / Documento"}
                            </a>
                          );
                        })}
                    </div>

                    {t.observacoes && (
                      <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "3px" }}>
                        <strong>Observações da equipe:</strong> {t.observacoes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
