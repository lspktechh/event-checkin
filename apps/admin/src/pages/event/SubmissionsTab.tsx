import { useEffect, useState } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import {
  AlertIcon,
  CheckIcon,
  DownloadIcon,
  EyeIcon,
  LockIcon,
  MailIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from "../../components/Icons";

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

  // ── Estados para Ficha do Trabalho e Área de Risco ──
  const [trabalhoAberto, setTrabalhoAberto] = useState<api.SubmissionRecord | null>(null);
  const [modalidades, setModalidades] = useState<api.CatalogItem[]>([]);
  const [topicos, setTopicos] = useState<api.CatalogItem[]>([]);
  const [modoEdicaoAtivo, setModoEdicaoAtivo] = useState(false);
  const [mostrandoPromptSenha, setMostrandoPromptSenha] = useState(false);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [validandoSenha, setValidandoSenha] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Campos do formulário de edição
  const [editTitulo, setEditTitulo] = useState("");
  const [editResumo, setEditResumo] = useState("");
  const [editPalavras, setEditPalavras] = useState("");
  const [editModalidade, setEditModalidade] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editStatus, setEditStatus] = useState<api.SubmissionStatus>("SUBMITTED");
  const [editAutores, setEditAutores] = useState<
    Array<{
      id?: string;
      name: string;
      email: string;
      institution: string;
      isPresenter: boolean;
    }>
  >([]);

  function abrirTrabalho(s: api.SubmissionRecord) {
    setTrabalhoAberto(s);
    setModoEdicaoAtivo(false);
    setMostrandoPromptSenha(false);
    setSenhaAdmin("");
    setErroSenha(null);

    setEditTitulo(s.title);
    setEditResumo(s.abstract);
    setEditPalavras(s.keywords.join(", "));
    setEditModalidade(s.modality?.id || "");
    setEditArea(s.topic?.id || "");
    setEditStatus(s.status);
    setEditAutores(
      s.authors.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        institution: a.institution || "",
        isPresenter: a.isPresenter,
      }))
    );
  }

  async function handleDesbloquearEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaAdmin.trim() || !trabalhoAberto) return;

    setValidandoSenha(true);
    setErroSenha(null);

    try {
      const res = await api.verifyAdminPassword(eventId, trabalhoAberto.id, senhaAdmin.trim());
      if (res.valid) {
        setModoEdicaoAtivo(true);
        setMostrandoPromptSenha(false);
        setErroSenha(null);
      } else {
        setErroSenha("Senha incorreta. Apenas administradores podem habilitar o modo de edição.");
      }
    } catch (err) {
      setErroSenha(err instanceof Error ? err.message : "Falha ao validar senha de administrador.");
    } finally {
      setValidandoSenha(false);
    }
  }

  function handleAddAutor() {
    setEditAutores((prev) => [
      ...prev,
      {
        name: "",
        email: "",
        institution: "",
        isPresenter: prev.length === 0,
      },
    ]);
  }

  function handleUpdateAutor(index: number, campo: string, valor: any) {
    setEditAutores((prev) =>
      prev.map((a, i) => {
        if (i === index) {
          return { ...a, [campo]: valor };
        }
        if (campo === "isPresenter" && valor === true) {
          return { ...a, isPresenter: false };
        }
        return a;
      })
    );
  }

  function handleRemoveAutor(index: number) {
    if (editAutores.length <= 1) {
      alert("O trabalho precisa ter pelo menos um integrante/autor.");
      return;
    }
    const removido = editAutores[index];
    const novaLista = editAutores.filter((_, i) => i !== index);
    if (removido.isPresenter && novaLista.length > 0) {
      novaLista[0].isPresenter = true;
    }
    setEditAutores(novaLista);
  }

  async function handleSalvarEdicaoAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!trabalhoAberto) return;

    if (!editTitulo.trim()) {
      alert("Informe o título do trabalho.");
      return;
    }
    if (!editResumo.trim() || editResumo.trim().length < 20) {
      alert("O resumo precisa ter no mínimo 20 caracteres.");
      return;
    }
    if (editAutores.length === 0) {
      alert("Informe pelo menos um integrante/autor.");
      return;
    }
    for (let i = 0; i < editAutores.length; i++) {
      const a = editAutores[i];
      if (!a.name.trim()) {
        alert(`Informe o nome do integrante #${i + 1}.`);
        return;
      }
      if (!a.email.trim() || !a.email.includes("@")) {
        alert(`Informe um e-mail válido para o integrante "${a.name || `#${i + 1}`}".`);
        return;
      }
    }

    const palavras = editPalavras
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);

    setSalvandoEdicao(true);
    setError(null);

    try {
      const atualizado = await api.adminEditSubmission(eventId, trabalhoAberto.id, {
        password: senhaAdmin.trim(),
        title: editTitulo.trim(),
        abstract: editResumo.trim(),
        keywords: palavras.length > 0 ? palavras : undefined,
        modalityId: editModalidade || null,
        topicId: editArea || null,
        status: editStatus,
        authors: editAutores.map((a) => ({
          name: a.name.trim(),
          email: a.email.trim().toLowerCase(),
          institution: a.institution.trim() || null,
          isPresenter: a.isPresenter,
        })),
      });

      setTrabalhoAberto(atualizado);
      setLista((prev) => prev.map((item) => (item.id === atualizado.id ? atualizado : item)));
      setModoEdicaoAtivo(false);
      setAviso(`Trabalho ${atualizado.code} atualizado com sucesso! Novos integrantes e dados gravados.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar alterações do trabalho.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function carregar() {
    setCarregando(true);
    try {
      const [s, l, mods, tops] = await Promise.all([
        api.getSubmissionSettings(eventId),
        api.listSubmissions(eventId, {
          search: busca || undefined,
          status: filtroStatus || undefined,
        }),
        api.listModalities(eventId).catch(() => []),
        api.listTopics(eventId).catch(() => []),
      ]);
      setSettings(s);
      setLista(l.items);
      setTotal(l.total);
      setResumo(l.resumo);
      setModalidades(mods);
      setTopicos(tops);
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
                    <strong
                      style={{ cursor: "pointer", color: "var(--foreground)" }}
                      onClick={() => abrirTrabalho(s)}
                      title="Clique para abrir os detalhes e integrantes deste trabalho"
                    >
                      {s.title}
                    </strong>
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

                <div className="row" style={{ marginTop: 12, flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: "rgba(10, 132, 255, 0.12)",
                      color: "#0a84ff",
                      borderColor: "rgba(10, 132, 255, 0.4)",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    onClick={() => abrirTrabalho(s)}
                    title="Abrir trabalho e gerenciar integrantes / Área de Risco"
                  >
                    <EyeIcon size="1.1em" /> Abrir Trabalho
                  </button>

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

      {/* ── Modal / Ficha do Trabalho Aberto com Área de Risco ── */}
      {trabalhoAberto && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            background: "#000000bb",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            padding: 16,
          }}
          onClick={() => {
            if (
              modoEdicaoAtivo &&
              !window.confirm("Você está no modo de edição. Deseja realmente fechar e perder alterações não salvas?")
            ) {
              return;
            }
            setTrabalhoAberto(null);
            setModoEdicaoAtivo(false);
          }}
        >
          <div
            className="card stack"
            style={{
              width: 780,
              maxWidth: "100%",
              gap: 16,
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
              border: modoEdicaoAtivo ? "2px solid #ff453a" : "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho da Ficha */}
            <div className="spread" style={{ alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span className="monospace" style={{ fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>
                    {trabalhoAberto.code}
                  </span>
                  <span className={`badge ${STATUS_BADGE[trabalhoAberto.status]}`}>
                    {STATUS_LABEL[trabalhoAberto.status]}
                  </span>
                  {trabalhoAberto.modality && (
                    <span className="badge badge-muted">{trabalhoAberto.modality.name}</span>
                  )}
                  {trabalhoAberto.topic && (
                    <span className="badge badge-muted">{trabalhoAberto.topic.name}</span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>
                  {trabalhoAberto.title}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                }}
                onClick={() => {
                  if (modoEdicaoAtivo && !window.confirm("Deseja fechar sem salvar?")) return;
                  setTrabalhoAberto(null);
                  setModoEdicaoAtivo(false);
                }}
                aria-label="Fechar"
              >
                <XIcon size="1.2em" />
              </button>
            </div>

            {/* SEÇÃO 1: MODO VISUALIZAÇÃO */}
            {!modoEdicaoAtivo && (
              <div className="stack" style={{ gap: 16 }}>
                {/* Autores / Integrantes Atuais */}
                <div
                  style={{
                    background: "var(--card-subtle, rgba(255,255,255,0.03))",
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontWeight: 600 }}>
                    <UsersIcon size="1.1em" />
                    <span>Integrantes do Grupo / Autores ({trabalhoAberto.authors.length})</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {trabalhoAberto.authors.map((a, i) => (
                      <div
                        key={a.id || i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          fontSize: 13,
                        }}
                      >
                        <div>
                          <strong style={{ color: "var(--foreground)" }}>{a.name}</strong>
                          <span className="muted" style={{ marginLeft: 8 }}>
                            ({a.email})
                          </span>
                          {a.institution && (
                            <span className="muted" style={{ marginLeft: 6 }}>
                              · {a.institution}
                            </span>
                          )}
                        </div>
                        {a.isPresenter && (
                          <span className="badge badge-amber" style={{ fontSize: 11, fontWeight: 600 }}>
                            ⭐ Apresentador
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumo */}
                <div>
                  <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Resumo:</strong>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--foreground)" }}>
                    {trabalhoAberto.abstract}
                  </p>
                </div>

                {/* Palavras-chave */}
                {trabalhoAberto.keywords && trabalhoAberto.keywords.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Palavras-chave:</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {trabalhoAberto.keywords.map((kw, i) => (
                        <span key={i} className="badge badge-muted" style={{ fontSize: 12 }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Arquivos */}
                {trabalhoAberto.files && trabalhoAberto.files.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Arquivos Anexados:</strong>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {trabalhoAberto.files.map((f, i) => (
                        <button
                          key={f.id}
                          type="button"
                          className="btn btn-sm"
                          onClick={() => abrirArquivo(trabalhoAberto, f)}
                        >
                          <DownloadIcon size="1.1em" /> {f.fileName || `Arquivo ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parecer / Ressalvas se houver */}
                {trabalhoAberto.decisionReason && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background:
                        trabalhoAberto.status === "APPROVED_WITH_RESERVATIONS"
                          ? "rgba(245, 158, 11, 0.12)"
                          : "rgba(239, 68, 68, 0.1)",
                      borderLeft: `4px solid ${
                        trabalhoAberto.status === "APPROVED_WITH_RESERVATIONS" ? "#f59e0b" : "#ef4444"
                      }`,
                      fontSize: 13,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        marginBottom: 4,
                        color: trabalhoAberto.status === "APPROVED_WITH_RESERVATIONS" ? "#f59e0b" : "#f87171",
                      }}
                    >
                      {trabalhoAberto.status === "APPROVED_WITH_RESERVATIONS"
                        ? "Ressalvas da comissão para correção:"
                        : "Parecer da comissão:"}
                    </strong>
                    <p style={{ margin: 0, whiteSpace: "pre-line", lineHeight: 1.5 }}>
                      {trabalhoAberto.decisionReason}
                    </p>
                  </div>
                )}

                {/* ── ÁREA DE RISCO (HABILITAR MODO DE EDIÇÃO) ── */}
                <div
                  style={{
                    marginTop: 8,
                    padding: 16,
                    borderRadius: 12,
                    background: "rgba(255, 69, 58, 0.08)",
                    border: "1px solid rgba(255, 69, 58, 0.35)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ff453a", fontWeight: 700, fontSize: 15 }}>
                    <AlertIcon size="1.2em" />
                    <span>Área de Risco — Edição Administrativa</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--foreground)" }}>
                    Utilize esta área caso o trabalho tenha sido enviado sem o nome de todos os integrantes do grupo,
                    ou seja necessário corrigir autores, título ou dados diretamente no sistema.
                    Por ser uma área crítica, a ativação do modo de edição exige a <strong>senha do administrador</strong>.
                  </p>

                  {!mostrandoPromptSenha ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                      onClick={() => {
                        setMostrandoPromptSenha(true);
                        setErroSenha(null);
                        setSenhaAdmin("");
                      }}
                    >
                      <LockIcon size="1.1em" />
                      Habilitar Modo de Edição (Área de Risco)
                    </button>
                  ) : (
                    <form
                      onSubmit={handleDesbloquearEdicao}
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 8,
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <label style={{ fontSize: 13, fontWeight: 600 }}>
                        Digite a Senha do Administrador para desbloquear:
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                          type="password"
                          autoFocus
                          required
                          placeholder="Senha de administrador"
                          value={senhaAdmin}
                          onChange={(e) => setSenhaAdmin(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 200,
                            padding: "8px 12px",
                            background: "var(--input-bg, #1a1a1a)",
                            color: "var(--foreground)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            fontSize: 14,
                          }}
                        />
                        <button
                          type="submit"
                          disabled={validandoSenha || !senhaAdmin.trim()}
                          className="btn btn-danger btn-sm"
                          style={{ fontWeight: 600 }}
                        >
                          {validandoSenha ? "Verificando..." : "Desbloquear Edição"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setMostrandoPromptSenha(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                      {erroSenha && (
                        <div style={{ color: "var(--danger)", fontSize: 12, fontWeight: 500 }}>
                          {erroSenha}
                        </div>
                      )}
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* SEÇÃO 2: MODO DE EDIÇÃO ATIVO (ÁREA DE RISCO) */}
            {modoEdicaoAtivo && (
              <form onSubmit={handleSalvarEdicaoAdmin} className="stack" style={{ gap: 16 }}>
                {/* Banner Modo Ativo */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(255, 69, 58, 0.18)",
                    border: "1px solid #ff453a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertIcon size="1.2em" color="#ff453a" />
                    <div>
                      <strong style={{ color: "#ff453a", fontSize: 14 }}>Modo de Edição Ativo (Área de Risco)</strong>
                      <div style={{ fontSize: 12, color: "var(--foreground)" }}>
                        Adicione ou altere os integrantes do grupo abaixo e clique em Salvar Alterações ao finalizar.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      if (window.confirm("Deseja sair do modo de edição? Alterações não salvas serão perdidas.")) {
                        setModoEdicaoAtivo(false);
                      }
                    }}
                  >
                    Fechar Edição
                  </button>
                </div>

                {/* BLOCO PRINCIPAL: INTEGRANTES DO GRUPO (AUTORES) */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: "var(--card-subtle, rgba(255,255,255,0.02))",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="spread" style={{ marginBottom: 10, alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                        <UsersIcon size="1.1em" />
                        Integrantes do Grupo / Autores ({editAutores.length})
                      </h4>
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                        Inclua aqui os nomes dos integrantes do grupo que não foram enviados originalmente:
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        background: "rgba(10, 132, 255, 0.15)",
                        color: "#0a84ff",
                        borderColor: "rgba(10, 132, 255, 0.4)",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onClick={handleAddAutor}
                    >
                      <PlusIcon size="1.1em" /> Adicionar Integrante
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {editAutores.map((autor, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div className="spread" style={{ alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                            Integrante #{idx + 1}
                          </span>
                          {editAutores.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              style={{ padding: "2px 8px", fontSize: 12 }}
                              onClick={() => handleRemoveAutor(idx)}
                              title="Remover este integrante"
                            >
                              <TrashIcon size="1em" /> Remover
                            </button>
                          )}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Nome Completo *</span>
                            <input
                              type="text"
                              required
                              placeholder="Nome do integrante"
                              value={autor.name}
                              onChange={(e) => handleUpdateAutor(idx, "name", e.target.value)}
                            />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>E-mail *</span>
                            <input
                              type="email"
                              required
                              placeholder="email@instituicao.edu.br"
                              value={autor.email}
                              onChange={(e) => handleUpdateAutor(idx, "email", e.target.value)}
                            />
                          </label>
                          <label className="field" style={{ margin: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Instituição (Opcional)</span>
                            <input
                              type="text"
                              placeholder="Ex: USP, UNIFESP, etc."
                              value={autor.institution}
                              onChange={(e) => handleUpdateAutor(idx, "institution", e.target.value)}
                            />
                          </label>
                        </div>

                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, marginTop: 4 }}>
                          <input
                            type="checkbox"
                            checked={autor.isPresenter}
                            onChange={(e) => handleUpdateAutor(idx, "isPresenter", e.target.checked)}
                            style={{ width: "auto" }}
                          />
                          <span>Apresentador principal deste trabalho no evento</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* DEMAIS DADOS DO TRABALHO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Título do Trabalho *</span>
                    <input
                      type="text"
                      required
                      value={editTitulo}
                      onChange={(e) => setEditTitulo(e.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Resumo *</span>
                    <textarea
                      rows={5}
                      required
                      value={editResumo}
                      onChange={(e) => setEditResumo(e.target.value)}
                      style={{ resize: "vertical", lineHeight: 1.5 }}
                    />
                  </label>

                  <label className="field">
                    <span style={{ fontWeight: 600 }}>Palavras-chave (separadas por vírgula) *</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: saúde, tecnologia, inovação"
                      value={editPalavras}
                      onChange={(e) => setEditPalavras(e.target.value)}
                    />
                  </label>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                    {modalidades.length > 0 && (
                      <label className="field">
                        <span style={{ fontWeight: 600 }}>Modalidade</span>
                        <select
                          value={editModalidade}
                          onChange={(e) => setEditModalidade(e.target.value)}
                        >
                          <option value="">Sem modalidade</option>
                          {modalidades.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {topicos.length > 0 && (
                      <label className="field">
                        <span style={{ fontWeight: 600 }}>Eixo / Área Temática</span>
                        <select
                          value={editArea}
                          onChange={(e) => setEditArea(e.target.value)}
                        >
                          <option value="">Sem área</option>
                          {topicos.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="field">
                      <span style={{ fontWeight: 600 }}>Status do Trabalho</span>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as api.SubmissionStatus)}
                      >
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* BOTÕES DE SALVAMENTO */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (window.confirm("Deseja cancelar a edição? As alterações feitas serão perdidas.")) {
                        setModoEdicaoAtivo(false);
                      }
                    }}
                    disabled={salvandoEdicao}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ background: "#30d158", borderColor: "#30d158", color: "#ffffff", fontWeight: 700 }}
                    disabled={salvandoEdicao}
                  >
                    <CheckIcon size="1.1em" /> {salvandoEdicao ? "Salvando Alterações..." : "Salvar Alterações (Área de Risco)"}
                  </button>
                </div>
              </form>
            )}
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
