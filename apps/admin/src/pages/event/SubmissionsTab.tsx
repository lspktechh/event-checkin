import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { MailIcon, XIcon } from "../../components/Icons";

const STATUS_LABEL: Record<api.SubmissionStatus, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Enviado",
  UNDER_REVIEW: "Em avaliação",
  APPROVED: "Aprovado",
  APPROVED_WITH_RESERVATIONS: "Aprovado com ressalva",
  RESUBMITTED: "Corrigido pelo autor",
  REJECTED: "Recusado",
  WITHDRAWN: "Retirado",
};

/** Mesmo desconto que o relatório de inscritos usa para a receita líquida. */
const TAXA_MERCADO_PAGO = 0.0099;

function formatarReais(valor: string | number | null): string {
  return Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// O servidor guarda o instante em UTC; o <input type="datetime-local"> quer
// a hora LOCAL do navegador. Recortar o ISO mostrava 3h a mais — e cada
// "Salvar" empurrava o prazo mais 3h para frente.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** PDF, DOCX, PPTX — o que o servidor aceita (ele confere os bytes, não o nome). */
const ACCEPT_ARQUIVO =
  ".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** "docx", "pptx"... — só o PDF o navegador abre numa aba; o resto baixa. */
function extensao(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

const STATUS_BADGE: Record<api.SubmissionStatus, string> = {
  DRAFT: "badge-muted",
  SUBMITTED: "badge-info",
  UNDER_REVIEW: "badge-purple",
  APPROVED: "badge-success",
  APPROVED_WITH_RESERVATIONS: "badge-amber",
  RESUBMITTED: "badge-cyan",
  REJECTED: "badge-danger",
  WITHDRAWN: "badge-muted",
};

/** "E-mail enviado a 2 autores." — ou o aviso de que algum não saiu. */
function resumoDoAviso(r: { autoresAvisados: number; falhasNoAviso: number }): string {
  const enviados =
    r.autoresAvisados === 1 ? "E-mail enviado a 1 autor." : `E-mail enviado a ${r.autoresAvisados} autores.`;
  if (r.falhasNoAviso === 0) return enviados;
  return `${enviados} ${r.falhasNoAviso} não ${r.falhasNoAviso === 1 ? "saiu" : "saíram"} — avise por outro meio.`;
}

/** Converte o arquivo escolhido em base64 — é assim que o backend recebe. */
function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      // O FileReader devolve "data:application/pdf;base64,XXXX" — o backend
      // quer só o depois da vírgula.
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

export function SubmissionsTab({ eventId }: { eventId: string }) {
  // Configurar a chamada e mexer nos trabalhos exigem permissões próprias
  // no backend; conta só de leitura vê a lista e abre os arquivos.
  const { hasPermission } = useAuth();
  const canConfigure = hasPermission("submissions.configure");
  const canManage = hasPermission("submissions.manage");
  const [settings, setSettings] = useState<api.SubmissionSettings | null>(null);
  const [lista, setLista] = useState<api.SubmissionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [resumo, setResumo] = useState<api.SubmissionFeeSummary | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [ressalvaModal, setRessalvaModal] = useState<{
    submission: api.SubmissionRecord;
    reason: string;
  } | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [s, l] = await Promise.all([
        api.getSubmissionSettings(eventId),
        api.listSubmissions(eventId, {
          search: busca || undefined,
          status: filtroStatus || undefined,
        }),
      ]);
      setSettings(s);
      setLista(l.items);
      setTotal(l.total);
      setResumo(l.resumo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, busca, filtroStatus]);

  async function acao<T>(chave: string, fn: () => Promise<T>, sucesso: string | ((r: T) => string)) {
    setError(null);
    setAviso(null);
    setOcupado(chave);
    try {
      const r = await fn();
      setAviso(typeof sucesso === "function" ? sucesso(r) : sucesso);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na operação");
    } finally {
      setOcupado(null);
    }
  }

  async function anexar(s: api.SubmissionRecord, file: File) {
    await acao(
      `file-${s.id}`,
      async () => api.uploadSubmissionFile(eventId, s.id, file.name, await lerBase64(file)),
      `Arquivo anexado a ${s.code}.`
    );
  }

  async function abrirArquivo(
    s: api.SubmissionRecord,
    file: { id: string; fileName: string | null }
  ) {
    try {
      const blob = await api.fetchSubmissionFile(eventId, s.id, file.id);
      const url = URL.createObjectURL(blob);
      const nome = file.fileName ?? "";
      if (nome && extensao(nome) !== "pdf") {
        // DOCX e PPTX o navegador não abre numa aba — baixa com o nome do autor.
        const a = document.createElement("a");
        a.href = url;
        a.download = nome;
        a.click();
      } else {
        window.open(url, "_blank", "noopener");
      }
      // Libera a memória depois que o navegador já abriu/baixou.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui abrir o arquivo");
    }
  }

  return (
    <div className="stack">
      {error && <p className="error-text">{error}</p>}
      {aviso && <p className="muted">{aviso}</p>}

      {/* ── prazo e taxa ── */}
      {canConfigure && (
      <section className="card">
        <h3>Prazo e taxa da chamada</h3>
        {settings && (
          <div className="stack">
            <div className="row">
              <label className="field">
                Abre em
                <input
                  type="datetime-local"
                  value={settings.opensAt ? toDatetimeLocal(settings.opensAt) : ""}
                  onChange={(e) =>
                    setSettings({ ...settings, opensAt: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                Fecha em
                <input
                  type="datetime-local"
                  value={settings.closesAt ? toDatetimeLocal(settings.closesAt) : ""}
                  onChange={(e) =>
                    setSettings({ ...settings, closesAt: e.target.value || null })
                  }
                />
              </label>
              <label className="field">
                Tamanho máximo do arquivo (MB)
                <input
                  type="number"
                  min={1}
                  // Base64 infla ~34%: 14 MB de arquivo cabem nos 20 MB que a
                  // rota de upload e o proxy aceitam.
                  max={14}
                  value={settings.maxFileSizeMb}
                  onChange={(e) =>
                    setSettings({ ...settings, maxFileSizeMb: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <p className="muted">
              Deixe em branco para não limitar: sem data de abertura a chamada já
              está aberta; sem fechamento, não fecha sozinha. O autor envia em PDF,
              DOCX (Word) ou PPTX (PowerPoint).
            </p>

            <div className="row" style={{ alignItems: "flex-end" }}>
              <label className="row" style={{ gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={settings.authorFeeRequired}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      authorFeeRequired: e.target.checked,
                      // Ligar sem valor não cobra nada — já sugere o valor da chamada.
                      authorFeeAmount:
                        e.target.checked && !Number(settings.authorFeeAmount)
                          ? 11
                          : settings.authorFeeAmount,
                    })
                  }
                />
                Cobrar taxa por trabalho enviado pelo site
              </label>
              {settings.authorFeeRequired && (
                <label className="field" style={{ maxWidth: 180 }}>
                  Valor (R$)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number(settings.authorFeeAmount ?? 0)}
                    onChange={(e) =>
                      setSettings({ ...settings, authorFeeAmount: Number(e.target.value) })
                    }
                  />
                </label>
              )}
            </div>
            {settings.authorFeeRequired && (
              <p className="muted">
                Ao enviar o arquivo pelo site, o autor recebe o Pix (e o link de
                cartão) do Mercado Pago — o mesmo da inscrição. O trabalho só entra
                na fila da comissão depois do pagamento aprovado.
              </p>
            )}

            <button
              type="button"
              className="btn"
              disabled={ocupado === "settings"}
              onClick={() =>
                acao(
                  "settings",
                  () =>
                    api.updateSubmissionSettings(eventId, {
                      opensAt: settings.opensAt
                        ? new Date(settings.opensAt).toISOString()
                        : null,
                      closesAt: settings.closesAt
                        ? new Date(settings.closesAt).toISOString()
                        : null,
                      maxFileSizeMb: settings.maxFileSizeMb,
                      authorFeeRequired: settings.authorFeeRequired,
                      authorFeeAmount: settings.authorFeeRequired
                        ? Number(settings.authorFeeAmount ?? 0)
                        : null,
                    }),
                  "Configuração salva."
                )
              }
            >
              Salvar configuração
            </button>
          </div>
        )}
      </section>
      )}

      {/* ── receita ── */}
      {resumo && (resumo.pagos > 0 || resumo.aguardando > 0 || settings?.authorFeeRequired) && (
        <section className="card">
          <h3>Receita das taxas de submissão</h3>
          <div className="receita-grid">
            <div>
              <div className="muted">Recebido (bruto)</div>
              <strong className="receita-valor">{formatarReais(resumo.receita)}</strong>
              <div className="muted">
                {resumo.pagos} {resumo.pagos === 1 ? "trabalho pago" : "trabalhos pagos"}
              </div>
            </div>
            <div>
              <div className="muted">Líquido estimado</div>
              <strong className="receita-valor" style={{ color: "var(--success)" }}>
                {formatarReais(resumo.receita * (1 - TAXA_MERCADO_PAGO))}
              </strong>
              <div className="muted">Após 0,99% do Mercado Pago</div>
            </div>
            <div>
              <div className="muted">Aguardando pagamento</div>
              <strong className="receita-valor" style={{ color: "var(--warning)" }}>
                {formatarReais(resumo.aguardandoValor)}
              </strong>
              <div className="muted">
                {resumo.aguardando} {resumo.aguardando === 1 ? "trabalho" : "trabalhos"}
                {resumo.liberadosSemPagamento > 0 &&
                  ` · ${resumo.liberadosSemPagamento} liberado${resumo.liberadosSemPagamento === 1 ? "" : "s"} sem pagamento`}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── lista ── */}
      <section className="card">
        <h3>
          Trabalhos {total > 0 && <span className="muted">({total})</span>}
        </h3>

        <div className="row">
          <input
            type="search"
            placeholder="Buscar por título, autor ou protocolo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {carregando ? (
          <p className="muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <p className="muted">
            {busca || filtroStatus
              ? "Nenhum trabalho com esse filtro."
              : "Nenhum trabalho cadastrado ainda."}
          </p>
        ) : (
          <div className="stack">
            {lista.map((s) => (
              <div key={s.id} className="card">
                <div className="spread">
                  <div>
                    <strong>{s.title}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      <span className="monospace" style={{ fontWeight: 600 }}>{s.code}</span>
                      {s.modality ? ` · ${s.modality.name}` : ""}
                      {s.topic ? ` · ${s.topic.name}` : ""}
                    </div>
                    {(() => {
                      const principal = s.authors.find((a) => a.isPresenter) ?? s.authors[0];
                      return principal ? (
                        <div style={{ marginTop: 6, fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span className="muted">Enviado por:</span>
                          <strong style={{ color: "var(--foreground)" }}>{principal.name}</strong>
                          <span
                            style={{
                              background: "rgba(59, 130, 246, 0.12)",
                              color: "#60a5fa",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontFamily: "monospace",
                              fontSize: 12,
                            }}
                            title="E-mail de quem enviou / apresentador"
                          >
                            <MailIcon size="1.1em" /> {principal.email}
                          </span>
                          {s.authors.length > 1 && (
                            <span className="muted" style={{ fontSize: 12 }}>
                              ({s.authors.length} autores)
                            </span>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {s.paymentStatus === "PAID" && (
                      <span className="badge badge-success">
                        Taxa paga · {formatarReais(s.feeAmount)}
                        {s.paymentMethod === "CARD" ? " (cartão)" : " (Pix)"}
                      </span>
                    )}
                    {s.paymentStatus === "PENDING" && (
                      <span className="badge badge-warning">
                        Aguardando pagamento · {formatarReais(s.feeAmount)}
                      </span>
                    )}
                    <span className={`badge ${STATUS_BADGE[s.status]}`}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </div>
                </div>

                <ResumoDoTrabalho s={s} />

                <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
                  {s.files.length > 0
                    ? s.files.map((f, i) => (
                        <button
                          key={f.id}
                          type="button"
                          className="btn btn-sm"
                          onClick={() => abrirArquivo(s, f)}
                          title={f.fileName ?? undefined}
                        >
                          {f.fileName && extensao(f.fileName) === "pdf"
                            ? `Abrir PDF${s.files.length > 1 ? ` ${i + 1}` : ""}`
                            : `Baixar ${f.fileName ? extensao(f.fileName).toUpperCase() : "arquivo"}${s.files.length > 1 ? ` ${i + 1}` : ""}`}
                        </button>
                      ))
                    : !canManage && <span className="muted">Sem arquivo</span>}

                  {canManage && s.status === "DRAFT" && s.files.length < 5 && (
                    <label className="btn btn-sm" style={{ cursor: "pointer" }}>
                      {s.files.length === 0 ? "Anexar arquivo (PDF, DOCX ou PPTX)" : "Anexar mais um"}
                      <input
                        type="file"
                        accept={ACCEPT_ARQUIVO}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) anexar(s, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}

                  {canManage && s.status === "DRAFT" && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={s.files.length === 0 || ocupado === `sub-${s.id}`}
                      title={s.files.length === 0 ? "Anexe o arquivo antes de enviar" : undefined}
                      onClick={() => {
                        // Liberar sem a taxa é decisão consciente (pagou por
                        // fora, isenção) — não pode sair num clique distraído.
                        if (
                          s.paymentStatus === "PENDING" &&
                          !window.confirm(
                            `${s.code} ainda não pagou a taxa de ${formatarReais(s.feeAmount)}. ` +
                              "Enviar para a comissão mesmo assim?"
                          )
                        ) {
                          return;
                        }
                        acao(
                          `sub-${s.id}`,
                          () => api.submitSubmission(eventId, s.id),
                          `${s.code} enviado.`
                        );
                      }}
                    >
                      {s.paymentStatus === "PENDING" ? "Liberar sem pagamento" : "Enviar"}
                    </button>
                  )}

                  {canManage &&
                    (s.status === "SUBMITTED" ||
                      s.status === "UNDER_REVIEW" ||
                      s.status === "APPROVED_WITH_RESERVATIONS" ||
                      s.status === "RESUBMITTED") && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={ocupado === `ap-${s.id}`}
                        onClick={() => {
                          if (!window.confirm(`Aprovar ${s.code}? Os autores recebem o resultado por e-mail.`)) return;
                          acao(
                            `ap-${s.id}`,
                            () => api.decideSubmission(eventId, s.id, "APPROVED"),
                            (r) => `${s.code} aprovado. ${resumoDoAviso(r)}`
                          );
                        }}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{
                          background: "#d97706",
                          color: "#ffffff",
                          borderColor: "#d97706",
                        }}
                        disabled={ocupado === `ressalva-${s.id}`}
                        onClick={() => {
                          setRessalvaModal({
                            submission: s,
                            reason: s.decisionReason || "",
                          });
                        }}
                      >
                        Aprovar com ressalva
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={ocupado === `re-${s.id}`}
                        onClick={() => {
                          // Cancelar o prompt desiste da recusa; em branco recusa sem parecer.
                          const motivo = window.prompt(
                            `Recusar ${s.code}? Os autores recebem o resultado por e-mail.\n\nParecer da comissão (opcional — vai no e-mail):`
                          );
                          if (motivo === null) return;
                          acao(
                            `re-${s.id}`,
                            () => api.decideSubmission(eventId, s.id, "REJECTED", motivo.trim() || undefined),
                            (r) => `${s.code} recusado. ${resumoDoAviso(r)}`
                          );
                        }}
                      >
                        Recusar
                      </button>
                    </>
                  )}

                  {canManage && s.status !== "WITHDRAWN" && s.status !== "APPROVED" && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={ocupado === `wd-${s.id}`}
                      onClick={() =>
                        acao(
                          `wd-${s.id}`,
                          () => api.withdrawSubmission(eventId, s.id),
                          `${s.code} retirado.`
                        )
                      }
                    >
                      Retirar
                    </button>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ background: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
                      disabled={ocupado === `del-${s.id}`}
                      title="Excluir permanentemente este trabalho (testes)"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Excluir permanentemente o trabalho ${s.code} ("${s.title}")?\n\nEsta ação apagará o trabalho do sistema (ideal para limpar testes).`
                          )
                        ) {
                          return;
                        }
                        acao(
                          `del-${s.id}`,
                          () => api.deleteSubmission(eventId, s.id),
                          `${s.code} excluído com sucesso.`
                        );
                      }}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {ressalvaModal && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000aa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={() => setRessalvaModal(null)}
        >
          <div
            className="card stack"
            style={{
              width: 560,
              maxWidth: "100%",
              gap: 16,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spread" style={{ alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: "#f59e0b" }}>
                  Aprovar com Ressalva
                </h3>
                <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  Protocolo: <strong className="monospace">{ressalvaModal.submission.code}</strong> — {ressalvaModal.submission.title}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
                onClick={() => setRessalvaModal(null)}
               aria-label="Fechar">
                <XIcon size="1.1em" />
              </button>
            </div>

            <div
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "var(--radius)",
                padding: 12,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--foreground)",
              }}
            >
              <strong>Instrução aos autores:</strong> Explique o que está errado e o que precisa ser corrigido antes do reenvio. Este parecer será salvo no trabalho e enviado por e-mail a todos os autores.
            </div>

            <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                O que está errado e o que precisa ser corrigido? <span style={{ color: "var(--danger)" }}>*</span>
              </span>
              <textarea
                rows={5}
                value={ressalvaModal.reason}
                placeholder="Exemplo: Ajustar a formatação das referências bibliográficas para normas ABNT; incluir a descrição da amostra na metodologia; corrigir termos na conclusão..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "var(--foreground)",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                  lineHeight: 1.5,
                }}
                onChange={(e) =>
                  setRessalvaModal({ ...ressalvaModal, reason: e.target.value })
                }
              />
              <span className="muted" style={{ fontSize: 12 }}>
                Obrigatório para aprovação com ressalva.
              </span>
            </label>

            <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRessalvaModal(null)}
                disabled={ocupado === `ressalva-${ressalvaModal.submission.id}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: "#d97706",
                  color: "#ffffff",
                  borderColor: "#d97706",
                }}
                disabled={
                  !ressalvaModal.reason.trim() ||
                  ocupado === `ressalva-${ressalvaModal.submission.id}`
                }
                onClick={async () => {
                  const sub = ressalvaModal.submission;
                  const motivo = ressalvaModal.reason.trim();
                  if (!motivo) return;
                  setRessalvaModal(null);
                  await acao(
                    `ressalva-${sub.id}`,
                    () =>
                      api.decideSubmission(
                        eventId,
                        sub.id,
                        "APPROVED_WITH_RESERVATIONS",
                        motivo
                      ),
                    (r) => `${sub.code} aprovado com ressalva. ${resumoDoAviso(r)}`
                  );
                }}
              >
                {ocupado === `ressalva-${ressalvaModal.submission.id}`
                  ? "Enviando..."
                  : "Confirmar Aprovação com Ressalva"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Acima disto o resumo começa recolhido, com o botão para ler inteiro. */
const RESUMO_LONGO = 320;

/**
 * O que a comissão precisa para avaliar sem abrir o arquivo: resumo,
 * palavras-chave e quem são os autores (instituição e apresentador).
 */
function ResumoDoTrabalho({ s }: { s: api.SubmissionRecord }) {
  const [aberto, setAberto] = useState(false);
  const longo = s.abstract.length > RESUMO_LONGO;

  return (
    <div className="resumo-trabalho">
      <div className="resumo-rotulo">Resumo</div>
      <p className={longo && !aberto ? "resumo-texto resumo-recolhido" : "resumo-texto"}>{s.abstract}</p>
      {longo && (
        <button type="button" className="resumo-alternar" onClick={() => setAberto((v) => !v)}>
          {aberto ? "Recolher resumo" : "Ler resumo completo"}
        </button>
      )}

      {s.keywords.length > 0 && (
        <p className="muted" style={{ margin: "10px 0 0" }}>
          <strong>Palavras-chave:</strong> {s.keywords.join(", ")}
        </p>
      )}

      <p className="muted" style={{ margin: "6px 0 0" }}>
        <strong>Autores:</strong>{" "}
        {s.authors
          .map(
            (a) =>
              `${a.name} (${a.email})${a.institution ? ` — ${a.institution}` : ""}${a.isPresenter ? " [Apresentador]" : ""}`
          )
          .join("; ")}
      </p>

      {s.decisionReason && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 8,
            background:
              s.status === "APPROVED_WITH_RESERVATIONS"
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(239, 68, 68, 0.1)",
            borderLeft: `4px solid ${
              s.status === "APPROVED_WITH_RESERVATIONS" ? "#f59e0b" : "#ef4444"
            }`,
          }}
        >
          <strong
            style={{
              display: "block",
              marginBottom: 4,
              color: s.status === "APPROVED_WITH_RESERVATIONS" ? "#f59e0b" : "#f87171",
              fontSize: 13,
            }}
          >
            {s.status === "APPROVED_WITH_RESERVATIONS"
              ? "Ressalvas da comissão para correção:"
              : "Parecer da comissão:"}
          </strong>
          <p
            style={{
              margin: 0,
              whiteSpace: "pre-line",
              fontSize: 13,
              color: "var(--foreground)",
              lineHeight: 1.5,
            }}
          >
            {s.decisionReason}
          </p>
        </div>
      )}
    </div>
  );
}
