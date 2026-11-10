import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import * as api from "../../api/client";
import { CheckIcon, CopyIcon, ClockIcon, MapPinIcon } from "../../components/Icons";

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromDatetimeLocal(value: string): string {
  if (!value) return "";
  return new Date(value).toISOString();
}

export function InscricoesTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [, setConfig] = useState<api.EventConfig | null>(null);

  // Estados dos campos configuráveis
  const [eventStatus, setEventStatus] = useState<"ACTIVE" | "CLOSED">("ACTIVE");
  const [registrationInPortal, setRegistrationInPortal] = useState(false);
  const [slug, setSlug] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [local, setLocal] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  // Campos do formulário
  const [campoNome, setCampoNome] = useState(true);
  const [campoEmail, setCampoEmail] = useState(true);
  const [campoCpf, setCampoCpf] = useState(true);
  const [campoTelefone, setCampoTelefone] = useState(false);

  function carregarDados() {
    setLoading(true);
    setError(null);

    Promise.all([api.getEvent(eventId), api.getEventConfig(eventId)])
      .then(([ev, cfg]) => {
        setEvent(ev);
        setConfig(cfg);

        setEventStatus(ev.status || "ACTIVE");
        setRegistrationInPortal(ev.status === "CLOSED" ? false : cfg.registrationInPortal);
        setSlug(cfg.slug || "");

        const siteContent = ev.siteContent as any;
        const regForm = siteContent?.registrationForm;

        setTitulo(regForm?.customTitle || ev.name || "");
        setDescricao(regForm?.customDescription || ev.description || "");
        setDataInicio(toDatetimeLocal(ev.startDate));
        setDataFim(toDatetimeLocal(ev.endDate));
        setLocal(ev.location || "");
        setBannerUrl(regForm?.bannerUrl || siteContent?.bannerUrl || siteContent?.imageUrl || "");

        // Configuração de campos
        const campos = regForm?.fields;
        setCampoNome(campos?.name !== false);
        setCampoEmail(campos?.email !== false);
        setCampoCpf(campos?.cpf !== false);
        setCampoTelefone(Boolean(campos?.phone));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao carregar configurações de inscrição");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    carregarDados();
  }, [eventId]);

  const publicUrl = slug.trim()
    ? `https://lspkeventos.com.br/${slug.trim()}`
    : "https://lspkeventos.com.br/nomedoevento";

  function copiarLink() {
    if (!slug.trim()) return;
    navigator.clipboard.writeText(`https://lspkeventos.com.br/${slug.trim()}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBannerUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!event) return;

    setError(null);
    setSucesso(null);
    setSalvando(true);

    try {
      const cleanSlug = slug.trim() === "" ? null : slug.trim().toLowerCase();
      const finalRegistrationInPortal = eventStatus === "CLOSED" ? false : registrationInPortal;

      // 1. Atualiza configuração de slug e se a inscrição está ligada no site
      await api.updateEventConfig(eventId, {
        slug: cleanSlug,
        registrationInPortal: finalRegistrationInPortal,
      });

      // 2. Monta o payload de siteContent preservando o que já existe
      const existingContent = (event.siteContent || {}) as any;
      const updatedSiteContent = {
        ...existingContent,
        bannerUrl: bannerUrl.trim() || null,
        registrationForm: {
          fields: {
            name: campoNome,
            email: campoEmail,
            cpf: campoCpf,
            phone: campoTelefone,
          },
          customTitle: titulo.trim() || null,
          customDescription: descricao.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
        },
      };

      // 3. Atualiza os dados do evento
      await api.updateEvent(eventId, {
        name: titulo.trim() || event.name,
        status: eventStatus,
        description: descricao.trim() || null,
        location: local.trim() || null,
        ...(dataInicio ? { startDate: fromDatetimeLocal(dataInicio) } : {}),
        ...(dataFim ? { endDate: fromDatetimeLocal(dataFim) } : {}),
        siteContent: updatedSiteContent as any,
        registrationInPortal: finalRegistrationInPortal,
      });

      setSucesso("Configurações de inscrição salvas com sucesso!");
      carregarDados();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configurações de inscrição");
    } finally {
      setSalvando(false);
    }
  }

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Carregando configurações de inscrição…</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "24px" }}>
      {/* CABEÇALHO */}
      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px" }}>Página de Inscrições do Evento</h2>
            <p className="muted" style={{ margin: 0, fontSize: "14px" }}>
              Configure as informações exibidas ao público, o link de divulgação e quais campos os participantes devem preencher.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {registrationInPortal ? (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 10 }}>●</span> Inscrições Ativas no Site
              </span>
            ) : (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ef4444",
                  background: "rgba(239, 68, 68, 0.12)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 10 }}>○</span> Inscrições Desativadas
              </span>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="card" style={{ borderLeft: "4px solid #ef4444", background: "rgba(239, 68, 68, 0.05)" }}>
          <p style={{ color: "#ef4444", margin: 0, fontWeight: 500 }}>{error}</p>
        </div>
      )}

      {sucesso && (
        <div className="card" style={{ borderLeft: "4px solid #10b981", background: "rgba(16, 185, 129, 0.05)" }}>
          <p style={{ color: "#10b981", margin: 0, fontWeight: 500 }}>{sucesso}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="stack" style={{ gap: "24px" }}>
        {/* CARD 1: STATUS E LINK BONITO */}
        <section className="card stack">
          <h3 style={{ margin: "0 0 4px" }}>1. Ativação e Link de Divulgação</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "14px" }}>
            Escolha se este evento deve receber inscrições pelo site e defina o endereço amigável na web.
          </p>

          <div style={{ marginBottom: "16px" }}>
            <label>
              Status do Evento
              <select
                value={eventStatus}
                onChange={(e) => {
                  const novo = e.target.value as "ACTIVE" | "CLOSED";
                  setEventStatus(novo);
                  if (novo === "CLOSED") {
                    setRegistrationInPortal(false);
                  }
                }}
                style={{ marginTop: "6px" }}
              >
                <option value="ACTIVE">Ativo (visível no painel e apto para inscrições)</option>
                <option value="CLOSED">Encerrado (inscrições bloqueadas e removido do site de credenciamento)</option>
              </select>
              <small className="muted">
                {eventStatus === "CLOSED"
                  ? "Evento encerrado: a página de inscrições está desativada e oculta para o público."
                  : "Evento ativo: você pode habilitar ou desabilitar o formulário de inscrições abaixo."}
              </small>
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: eventStatus === "CLOSED" ? "not-allowed" : "pointer",
              opacity: eventStatus === "CLOSED" ? 0.6 : 1,
              background: "rgba(255,255,255,0.03)",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <input
              type="checkbox"
              disabled={eventStatus === "CLOSED"}
              checked={eventStatus === "CLOSED" ? false : registrationInPortal}
              onChange={(e) => setRegistrationInPortal(e.target.checked)}
              style={{ width: 18, height: 18, cursor: eventStatus === "CLOSED" ? "not-allowed" : "pointer" }}
            />
            <div>
              <strong>Habilitar inscrições públicas no site LSPK Eventos</strong>
              <div className="muted" style={{ fontSize: "13px" }}>
                {eventStatus === "CLOSED"
                  ? "Bloqueado automaticamente porque o evento está Encerrado."
                  : "Quando desmarcado, o formulário fica fechado e não aceita novos cadastros."}
              </div>
            </div>
          </label>

          <div style={{ marginTop: "12px" }}>
            <label>
              Identificador na URL (slug)
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
                <span className="muted" style={{ fontSize: "14px", whiteSpace: "nowrap" }}>
                  https://lspkeventos.com.br/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="nomedoevento"
                  style={{ flex: 1, fontFamily: "monospace" }}
                />
              </div>
              <small className="muted">
                Use apenas letras minúsculas, números e traços. Exemplo: <code>inova-saude</code> ou <code>eti-summit-2026</code>.
              </small>
            </label>
          </div>

          {slug.trim() && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(45, 212, 191, 0.08)", border: "1px solid rgba(45, 212, 191, 0.25)", padding: "12px 16px", borderRadius: "8px", marginTop: "10px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#2dd4bf", fontSize: "14px" }}>Link Oficial:</span>
                <strong style={{ fontSize: "14px", color: "var(--foreground)", wordBreak: "break-all" }}>{publicUrl}</strong>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" onClick={copiarLink} className="btn btn-sm btn-secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {copiado ? <CheckIcon size={14} color="#10b981" /> : <CopyIcon size={14} />}
                  {copiado ? "Copiado!" : "Copiar Link"}
                </button>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary" style={{ textDecoration: "none" }}>
                  Abrir Página ↗
                </a>
              </div>
            </div>
          )}
        </section>

        {/* CARD 2: SELEÇÃO DE CAMPOS */}
        <section className="card stack">
          <h3 style={{ margin: "0 0 4px" }}>2. Campos do Formulário de Inscrição</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "14px" }}>
            Selecione quais informações os participantes deverão preencher para concluir a inscrição:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            {/* Campo Nome */}
            <div style={{ padding: "14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={campoNome}
                  onChange={(e) => setCampoNome(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong>Nome Completo</strong>
                  <div className="muted" style={{ fontSize: "12px", marginTop: 2 }}>
                    Nome e sobrenome para emissão de credenciais e certificados.
                  </div>
                </div>
              </label>
            </div>

            {/* Campo E-mail */}
            <div style={{ padding: "14px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={campoEmail}
                  onChange={(e) => setCampoEmail(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong>E-mail</strong>
                  <div className="muted" style={{ fontSize: "12px", marginTop: 2 }}>
                    Essencial para receber a confirmação, QR Code e login no portal.
                  </div>
                </div>
              </label>
            </div>

            {/* Campo CPF */}
            <div style={{ padding: "14px", borderRadius: 8, border: campoCpf ? "1px solid rgba(45, 212, 191, 0.3)" : "1px solid var(--border)", background: campoCpf ? "rgba(45, 212, 191, 0.04)" : "rgba(255,255,255,0.02)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={campoCpf}
                  onChange={(e) => setCampoCpf(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong>CPF (Documento)</strong>
                  <div className="muted" style={{ fontSize: "12px", marginTop: 2 }}>
                    Validação com dígitos verificadores na página pública.
                  </div>
                </div>
              </label>
            </div>

            {/* Campo Telefone */}
            <div style={{ padding: "14px", borderRadius: 8, border: campoTelefone ? "1px solid rgba(45, 212, 191, 0.3)" : "1px solid var(--border)", background: campoTelefone ? "rgba(45, 212, 191, 0.04)" : "rgba(255,255,255,0.02)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={campoTelefone}
                  onChange={(e) => setCampoTelefone(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2 }}
                />
                <div>
                  <strong>Celular / WhatsApp</strong>
                  <div className="muted" style={{ fontSize: "12px", marginTop: 2 }}>
                    Coleta de telefone de contato com máscara automática.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        {/* CARD 3: INFORMAÇÕES DO EVENTO */}
        <section className="card stack">
          <h3 style={{ margin: "0 0 4px" }}>3. Informações de Exibição do Evento</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "14px" }}>
            Estes dados aparecem com destaque no topo da página de inscrição:
          </p>

          <label>
            Título de Exibição
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: INOVA SAÚDE 2026"
              required
            />
          </label>

          <label>
            Descrição do Evento
            <textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva sobre o que é o evento, temas abordados, público-alvo ou programação..."
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            <label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <ClockIcon size={16} />
                <span>Horário de Início</span>
              </div>
              <input
                type="datetime-local"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                required
              />
            </label>

            <label>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <ClockIcon size={16} />
                <span>Horário de Término</span>
              </div>
              <input
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                required
              />
            </label>
          </div>

          <label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <MapPinIcon size={16} />
              <span>Local do Evento</span>
            </div>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Auditório Principal — Universidade Positivo, Londrina/PR"
            />
          </label>
        </section>

        {/* CARD 4: BANNER / IMAGEM */}
        <section className="card stack">
          <h3 style={{ margin: "0 0 4px" }}>4. Imagem / Banner do Evento</h3>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: "14px" }}>
            Adicione uma imagem de capa para enriquecer o visual da sua página de inscrições.
          </p>

          <label>
            URL da Imagem (ou faça upload abaixo)
            <input
              type="url"
              value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://exemplo.com/banner-evento.jpg"
            />
          </label>

          <div>
            <label className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <span>📁 Selecionar Imagem do Computador</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
              />
            </label>
            <small className="muted" style={{ marginLeft: 10 }}>Formatos JPG, PNG ou WebP até 2 MB.</small>
          </div>

          {bannerUrl && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>Pré-visualização do Banner:</div>
              <div style={{ maxWidth: 540, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", background: "rgba(0,0,0,0.1)" }}>
                <img
                  src={bannerUrl}
                  alt="Banner do Evento"
                  style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                />
              </div>
              <button
                type="button"
                onClick={() => setBannerUrl("")}
                className="btn btn-sm btn-danger"
                style={{ marginTop: 8 }}
              >
                Remover Imagem
              </button>
            </div>
          )}
        </section>

        {/* BOTÃO SALVAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="submit" className="btn btn-primary" disabled={salvando} style={{ minWidth: 200, padding: "12px 24px", fontSize: 15 }}>
            {salvando ? "Salvando Configurações…" : "Salvar Configurações de Inscrição"}
          </button>
        </div>
      </form>
    </div>
  );
}
