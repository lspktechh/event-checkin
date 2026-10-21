"use client";

import { useState } from "react";
import {
  searchSubmissionsByEmail,
  getSubmissionEditDetails,
  resubmitSubmission,
  type PublicSubmission,
  type PublicAuthor,
  type SubmissionEditDetailsResponse,
} from "@/lib/api";

function lerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.slice(r.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Não consegui ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

function formatarBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  DRAFT: {
    label: "Rascunho",
    bg: "rgba(161, 161, 161, 0.15)",
    color: "#9a968d",
    border: "rgba(161, 161, 161, 0.3)",
  },
  SUBMITTED: {
    label: "Enviado à comissão",
    bg: "rgba(245, 158, 11, 0.15)",
    color: "#facc15",
    border: "rgba(245, 158, 11, 0.3)",
  },
  UNDER_REVIEW: {
    label: "Em avaliação",
    bg: "rgba(245, 158, 11, 0.15)",
    color: "#facc15",
    border: "rgba(245, 158, 11, 0.3)",
  },
  APPROVED_WITH_RESERVATIONS: {
    label: "Aprovado com ressalva",
    bg: "rgba(245, 158, 11, 0.22)",
    color: "#fbbf24",
    border: "#f59e0b",
  },
  RESUBMITTED: {
    label: "Corrigido pelo autor",
    bg: "rgba(59, 130, 246, 0.22)",
    color: "#60a5fa",
    border: "#3b82f6",
  },
  APPROVED: {
    label: "Aprovado",
    bg: "rgba(34, 197, 94, 0.2)",
    color: "#4ade80",
    border: "#22c55e",
  },
  REJECTED: {
    label: "Recusado",
    bg: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    border: "#ef4444",
  },
  WITHDRAWN: {
    label: "Retirado",
    bg: "rgba(161, 161, 161, 0.15)",
    color: "#9a968d",
    border: "rgba(161, 161, 161, 0.3)",
  },
};

export function TrabalhosCliente({ slug }: { slug: string }) {
  const [email, setEmail] = useState("");
  const [pesquisado, setPesquisado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [nomeEvento, setNomeEvento] = useState<string | null>(null);
  const [trabalhos, setTrabalhos] = useState<PublicSubmission[]>([]);

  // Estado de edição do trabalho selecionado
  const [editDetails, setEditDetails] =
    useState<SubmissionEditDetailsResponse | null>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);

  // Campos do formulário de edição
  const [formTitulo, setFormTitulo] = useState("");
  const [formResumo, setFormResumo] = useState("");
  const [formPalavras, setFormPalavras] = useState("");
  const [formModalidade, setFormModalidade] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formAutores, setFormAutores] = useState<PublicAuthor[]>([]);
  const [formKeepFiles, setFormKeepFiles] = useState<string[]>([]);
  const [formNovosArquivos, setFormNovosArquivos] = useState<File[]>([]);
  const [formNotas, setFormNotas] = useState("");
  const [enviandoCorrecao, setEnviandoCorrecao] = useState(false);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setCarregando(true);
    setErro(null);
    setSucesso(null);
    setEditDetails(null);

    try {
      const res = await searchSubmissionsByEmail(slug, email.trim());
      setNomeEvento(res.event.name);
      setTrabalhos(res.submissions);
      setPesquisado(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao buscar trabalhos.");
    } finally {
      setCarregando(false);
    }
  }

  async function handleIniciarEdicao(sub: PublicSubmission) {
    setCarregandoEdicao(true);
    setErro(null);
    setSucesso(null);

    try {
      const details = await getSubmissionEditDetails(slug, sub.id, email.trim());
      setEditDetails(details);

      // Preenche exatamente o que a pessoa enviou primeiro
      setFormTitulo(details.submission.title);
      setFormResumo(details.submission.abstract);
      setFormPalavras(details.submission.keywords.join(", "));
      setFormModalidade(details.submission.modality?.id || "");
      setFormArea(details.submission.topic?.id || "");
      setFormAutores(
        details.submission.authors.map((a) => ({
          name: a.name,
          email: a.email,
          institution: a.institution,
          isPresenter: a.isPresenter,
        }))
      );
      setFormKeepFiles(details.submission.files.map((f) => f.id));
      setFormNovosArquivos([]);
      setFormNotas("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro ao carregar detalhes do trabalho."
      );
    } finally {
      setCarregandoEdicao(false);
    }
  }

  function handleAddAutor() {
    setFormAutores([
      ...formAutores,
      {
        name: "",
        email: "",
        institution: "",
        isPresenter: formAutores.length === 0,
      },
    ]);
  }

  function handleUpdateAutor(index: number, campo: keyof PublicAuthor, valor: any) {
    setFormAutores((prev) =>
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

  function handleRemoverAutor(index: number) {
    if (formAutores.length <= 1) {
      alert("O trabalho precisa ter pelo menos um autor.");
      return;
    }
    const autorRemovido = formAutores[index];
    const novaLista = formAutores.filter((_, i) => i !== index);
    if (autorRemovido.isPresenter && novaLista.length > 0) {
      novaLista[0].isPresenter = true;
    }
    setFormAutores(novaLista);
  }

  function toggleKeepFile(fileId: string) {
    setFormKeepFiles((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  }

  async function handleSalvarCorrecao(e: React.FormEvent) {
    e.preventDefault();
    if (!editDetails) return;

    if (!formTitulo.trim()) {
      setErro("Informe o título do trabalho.");
      return;
    }
    if (!formResumo.trim() || formResumo.trim().length < 50) {
      setErro("O resumo precisa ter no mínimo 50 caracteres.");
      return;
    }
    const palavras = formPalavras
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (palavras.length === 0) {
      setErro("Informe pelo menos uma palavra-chave.");
      return;
    }

    if (formKeepFiles.length === 0 && formNovosArquivos.length === 0) {
      setErro("O trabalho precisa ter pelo menos um arquivo anexado.");
      return;
    }

    setEnviandoCorrecao(true);
    setErro(null);

    try {
      const novosConvertidos = await Promise.all(
        formNovosArquivos.map(async (file) => ({
          fileName: file.name,
          dataBase64: await lerBase64(file),
        }))
      );

      const atualizado = await resubmitSubmission(slug, editDetails.submission.id, {
        authorEmail: email.trim(),
        title: formTitulo.trim(),
        abstract: formResumo.trim(),
        keywords: palavras,
        modalityId: formModalidade || null,
        topicId: formArea || null,
        authors: formAutores,
        keepFileIds: formKeepFiles,
        newFiles: novosConvertidos,
        correctionsNotes: formNotas.trim() || undefined,
      });

      setSucesso(
        `Trabalho "${atualizado.code}" corrigido e reenviado com sucesso! O corretor já poderá avaliar a nova versão no painel.`
      );
      setEditDetails(null);

      // Atualiza a lista na tela
      setTrabalhos((prev) =>
        prev.map((t) => (t.id === atualizado.id ? atualizado : t))
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setErro(
        err instanceof Error ? err.message : "Erro ao enviar correções do trabalho."
      );
    } finally {
      setEnviandoCorrecao(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-8">
        {/* Cabeçalho */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lspk-symbol.svg" alt="LSPK Technology" className="h-14 w-14" />
          </div>
          <p className="mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[var(--primary)]">
            LSPK Eventos · {nomeEvento ?? "Portal de Trabalhos"}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {editDetails ? "Editar e Enviar Correções" : "Consulta de Trabalhos"}
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[var(--muted-foreground)]">
            {editDetails
              ? `Editando protocolo ${editDetails.submission.code}. Altere os dados ou anexe novos arquivos conforme solicitado pela comissão.`
              : "Consulte os trabalhos enviados, confira o parecer e correções solicitadas pela comissão avaliadora e reenvie as alterações."}
          </p>
        </div>

        {/* Mensagens de Sucesso ou Erro */}
        {erro && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {sucesso}
          </div>
        )}

        {/* MODO 1: Formulário de Busca por E-mail (se não estiver editando) */}
        {!editDetails && (
          <form onSubmit={handleBuscar} className="cartao space-y-4 p-6">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-[var(--foreground)]"
              >
                E-mail de qualquer autor do trabalho
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@universidade.edu.br"
                  autoComplete="email"
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-base text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={carregando}
                  className="rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {carregando ? "Buscando..." : "Buscar Trabalhos"}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                💡 Dica: Você pode consultar informando o e-mail do autor principal ou
                de qualquer coautor cadastrado na submissão.
              </p>
            </div>
          </form>
        )}

        {/* MODO 2: Lista de Trabalhos Encontrados */}
        {!editDetails && pesquisado && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Trabalhos encontrados ({trabalhos.length})
              </h2>
              <span className="mono text-xs text-[var(--muted-foreground)]">
                Filtro: {email}
              </span>
            </div>

            {trabalhos.length === 0 ? (
              <div className="cartao p-8 text-center">
                <p className="text-[var(--muted-foreground)]">
                  Nenhum trabalho encontrado para este e-mail no evento.
                </p>
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  Verifique se o e-mail digitado foi exatamente o mesmo preenchido na
                  submissão.
                </p>
              </div>
            ) : (
              trabalhos.map((sub) => {
                const statusStyle =
                  STATUS_CONFIG[sub.status] || STATUS_CONFIG.SUBMITTED;
                const podeEditar =
                  sub.status === "APPROVED_WITH_RESERVATIONS" ||
                  sub.status === "RESUBMITTED" ||
                  sub.status === "SUBMITTED";

                return (
                  <div key={sub.id} className="cartao space-y-4 p-6">
                    {/* Cabeçalho do Card */}
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <span className="mono text-xs font-semibold text-[var(--primary)]">
                          {sub.code}
                        </span>
                        <h3 className="mt-1 text-lg font-bold text-[var(--foreground)]">
                          {sub.title}
                        </h3>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {sub.modality ? sub.modality.name : "Sem modalidade"}
                          {sub.topic ? ` · ${sub.topic.name}` : ""}
                        </p>
                      </div>

                      <div
                        className="inline-flex items-center self-start rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                          border: `1px solid ${statusStyle.border}`,
                        }}
                      >
                        {statusStyle.label}
                      </div>
                    </div>

                    {/* Bloco de Ressalvas / Correções Solicitadas */}
                    {sub.decisionReason && (
                      <div
                        className="rounded-xl p-4 text-sm"
                        style={{
                          backgroundColor:
                            sub.status === "APPROVED_WITH_RESERVATIONS"
                              ? "rgba(245, 158, 11, 0.12)"
                              : "rgba(239, 68, 68, 0.1)",
                          borderLeft: `4px solid ${
                            sub.status === "APPROVED_WITH_RESERVATIONS"
                              ? "#f59e0b"
                              : "#ef4444"
                          }`,
                        }}
                      >
                        <strong
                          className="block text-xs font-bold uppercase tracking-wider"
                          style={{
                            color:
                              sub.status === "APPROVED_WITH_RESERVATIONS"
                                ? "#fbbf24"
                                : "#f87171",
                          }}
                        >
                          ⚠️ Parecer da comissão / O que precisa ser corrigido:
                        </strong>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--foreground)]">
                          {sub.decisionReason}
                        </p>
                      </div>
                    )}

                    {/* Resumo */}
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                        Resumo:
                      </span>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)] line-clamp-3">
                        {sub.abstract}
                      </p>
                    </div>

                    {/* Autores */}
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                        Autores:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {sub.authors.map((a) => (
                          <span
                            key={a.id || a.email}
                            className="rounded-lg bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground)]"
                          >
                            {a.name} ({a.email})
                            {a.isPresenter ? " ⭐ [Apresentador]" : ""}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Arquivos */}
                    {sub.files && sub.files.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                          Arquivos enviados:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {sub.files.map((f) => (
                            <a
                              key={f.id}
                              href={`/api/publico/trabalhos/arquivo/${encodeURIComponent(sub.id)}/${encodeURIComponent(f.id)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)]/80 px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--primary)]"
                            >
                              📎 {f.fileName ?? "Arquivo"}
                              {f.fileSizeBytes && (
                                <span className="text-[var(--muted-foreground)]">
                                  ({formatarBytes(f.fileSizeBytes)})
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botão de Ação / Edição */}
                    <div className="pt-2">
                      {podeEditar ? (
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicao(sub)}
                          disabled={carregandoEdicao}
                          className="flex items-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/40 px-5 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30"
                        >
                          ✏️ {sub.status === "APPROVED_WITH_RESERVATIONS"
                            ? "Enviar Correções Solicitadas"
                            : "Editar Trabalho"}
                        </button>
                      ) : sub.status === "APPROVED" ? (
                        <div className="text-xs text-emerald-400 font-medium">
                          ✓ Trabalho aprovado em definitivo pela comissão.
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* MODO 3: Formulário de Edição em Cima do que já foi enviado */}
        {editDetails && (
          <form
            onSubmit={handleSalvarCorrecao}
            className="cartao space-y-6 p-6 sm:p-8"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <span className="mono text-xs font-semibold text-[var(--primary)]">
                  Protocolo: {editDetails.submission.code}
                </span>
                <h2 className="text-xl font-bold">Edição e Reenvio de Trabalho</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditDetails(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-white"
              >
                Voltar
              </button>
            </div>

            {/* Parecer do Corretor em Destaque no Topo do Formulário */}
            {editDetails.submission.decisionReason && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
                <strong className="block text-xs font-bold uppercase tracking-wider text-amber-400">
                  ⚠️ Parecer da comissão — O que você precisa corrigir:
                </strong>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                  {editDetails.submission.decisionReason}
                </p>
              </div>
            )}

            {/* Título */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Título do Trabalho <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Modalidade e Área Temática */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Modalidade
                </label>
                <select
                  value={formModalidade}
                  onChange={(e) => setFormModalidade(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="">Selecione uma modalidade</option>
                  {editDetails.modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Área Temática
                </label>
                <select
                  value={formArea}
                  onChange={(e) => setFormArea(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="">Selecione uma área</option>
                  {editDetails.topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resumo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Resumo do Trabalho <span className="text-red-400">*</span>
                </label>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formResumo.length} caracteres (mínimo 50)
                </span>
              </div>
              <textarea
                rows={6}
                required
                value={formResumo}
                onChange={(e) => setFormResumo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Palavras-chave */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Palavras-chave (separadas por vírgula){" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formPalavras}
                onChange={(e) => setFormPalavras(e.target.value)}
                placeholder="ex: Ortodontia, Cirurgia, Saúde Bucal"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Autores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  Autores do Trabalho
                </label>
                <button
                  type="button"
                  onClick={handleAddAutor}
                  className="rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/20"
                >
                  + Adicionar Coautor
                </button>
              </div>

              <div className="space-y-3">
                {formAutores.map((autor, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        required
                        placeholder="Nome completo"
                        value={autor.name}
                        onChange={(e) =>
                          handleUpdateAutor(idx, "name", e.target.value)
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <input
                        type="email"
                        required
                        placeholder="E-mail"
                        value={autor.email}
                        onChange={(e) =>
                          handleUpdateAutor(idx, "email", e.target.value)
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        placeholder="Instituição (opcional)"
                        value={autor.institution ?? ""}
                        onChange={(e) =>
                          handleUpdateAutor(idx, "institution", e.target.value)
                        }
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--foreground)] focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer">
                        <input
                          type="radio"
                          name="apresentador"
                          checked={autor.isPresenter}
                          onChange={() => handleUpdateAutor(idx, "isPresenter", true)}
                        />
                        Apresentador
                      </label>

                      {formAutores.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoverAutor(idx)}
                          className="text-xs text-red-400 hover:text-red-300"
                          title="Remover autor"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Arquivos Existentes e Novos Arquivos */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Arquivos do Trabalho (PDF, DOCX, PPTX)
              </label>

              {/* Lista dos arquivos que já estavam salvos */}
              {editDetails.submission.files.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Arquivos enviados anteriormente:
                  </span>
                  <div className="flex flex-col gap-2">
                    {editDetails.submission.files.map((file) => {
                      const mantido = formKeepFiles.includes(file.id);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span>{mantido ? "📎" : "❌"}</span>
                            <span
                              className={
                                mantido
                                  ? "font-medium text-[var(--foreground)]"
                                  : "line-through text-red-400"
                              }
                            >
                              {file.fileName ?? "Arquivo"}
                            </span>
                            <span className="text-[var(--muted-foreground)]">
                              ({formatarBytes(file.fileSizeBytes)})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleKeepFile(file.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              mantido
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            {mantido ? "Remover" : "Manter arquivo"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload de Novos Arquivos */}
              <div className="rounded-xl border border-dashed border-[var(--border)] p-4">
                <span className="block text-xs font-medium text-[var(--foreground)] mb-2">
                  Adicionar novos arquivos corrigidos:
                </span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx"
                  onChange={(e) => {
                    if (e.target.files) {
                      setFormNovosArquivos(Array.from(e.target.files));
                    }
                  }}
                  className="block w-full text-xs text-[var(--muted-foreground)] file:mr-4 file:rounded-xl file:border-0 file:bg-[var(--primary)]/15 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[var(--primary)] hover:file:bg-[var(--primary)]/25"
                />
                {formNovosArquivos.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Novos arquivos selecionados:
                    </span>
                    {formNovosArquivos.map((f, i) => (
                      <p key={i} className="text-xs text-[var(--muted-foreground)]">
                        • {f.name} ({formatarBytes(f.size)})
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* O que foi corrigido (parecer do autor) */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--foreground)]">
                Explicação das correções realizadas (opcional)
              </label>
              <textarea
                rows={3}
                value={formNotas}
                onChange={(e) => setFormNotas(e.target.value)}
                placeholder="Exemplo: Ajustei as referências bibliográficas para normas ABNT e expandi a seção de resultados conforme solicitado pelo corretor."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none"
              />
            </div>

            {/* Botões do Formulário */}
            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditDetails(null)}
                className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--border)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviandoCorrecao}
                className="rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {enviandoCorrecao
                  ? "Enviando Trabalho Corrigido..."
                  : "Salvar e Enviar Trabalho Corrigido"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
