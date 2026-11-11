import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { TrashIcon } from "../../components/Icons";

/**
 * Configuração do evento: endereço público, fuso, idioma, visibilidade e
 * quais módulos estão ligados.
 *
 * É a primeira aba que o organizador usa num evento novo — sem ligar um
 * módulo aqui, as abas dele nem aparecem.
 */
export function ConfigTab({ eventId }: { eventId: string }) {
  const [config, setConfig] = useState<api.EventConfig | null>(null);
  const [event, setEvent] = useState<api.EventRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE");
  const [showInPortal, setShowInPortal] = useState(false);
  const [registrationInPortal, setRegistrationInPortal] = useState(false);

  // Configurações de Pagamento PIX (Manual)
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("EMAIL");
  const [pixReceiverName, setPixReceiverName] = useState("");
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [avisoPix, setAvisoPix] = useState<string | null>(null);
  const [errorPix, setErrorPix] = useState<string | null>(null);

  // Configurações da API Mercado Pago (Pix Automático)
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [mpWebhookSecret, setMpWebhookSecret] = useState("");
  const [salvandoMp, setSalvandoMp] = useState(false);
  const [avisoMp, setAvisoMp] = useState<string | null>(null);
  const [errorMp, setErrorMp] = useState<string | null>(null);

  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("events.delete") || hasPermission("events.edit");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (!event) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteEvent(eventId);
      setShowDeleteModal(false);
      navigate("/eventos");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Falha ao excluir evento");
    } finally {
      setDeleting(false);
    }
  }

  function carregar() {
    api
      .getEventConfig(eventId)
      .then((c) => {
        setConfig(c);
        setSlug(c.slug ?? "");
        setTimezone(c.timezone);
        setVisibility(c.visibility);
        setShowInPortal(c.showInPortal);
        setRegistrationInPortal(c.registrationInPortal);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao carregar a configuração")
      );

    api
      .getEvent(eventId)
      .then((ev) => {
        setEvent(ev);
        setPixKey(ev.pixKey ?? "");
        setPixKeyType(ev.pixKeyType ?? "EMAIL");
        setPixReceiverName(ev.pixReceiverName ?? "");
        setMpAccessToken(ev.mpAccessToken ?? "");
        setMpPublicKey(ev.mpPublicKey ?? "");
        setMpWebhookSecret(ev.mpWebhookSecret ?? "");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Falha ao carregar dados do evento")
      );
  }

  useEffect(carregar, [eventId]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setSalvando(true);
    try {
      await api.updateEventConfig(eventId, {
        slug: slug.trim() === "" ? null : slug.trim(),
        timezone,
        visibility,
        showInPortal,
        registrationInPortal,
      });
      setAviso("Configuração salva.");
      carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarPix(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setErrorPix(null);
    setAvisoPix(null);
    setSalvandoPix(true);
    try {
      await api.updateEvent(event.id, {
        pixKey: pixKey.trim(),
        pixKeyType,
        pixReceiverName: pixReceiverName.trim(),
      });
      setAvisoPix("Configurações de PIX salvas com sucesso.");
      carregar();
    } catch (err) {
      setErrorPix(err instanceof Error ? err.message : "Falha ao salvar configurações de PIX");
    } finally {
      setSalvandoPix(false);
    }
  }

  async function salvarMercadoPago(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setErrorMp(null);
    setAvisoMp(null);
    setSalvandoMp(true);
    try {
      await api.updateEvent(event.id, {
        mpAccessToken: mpAccessToken.trim() === "" ? null : mpAccessToken.trim(),
        mpPublicKey: mpPublicKey.trim() === "" ? null : mpPublicKey.trim(),
        mpWebhookSecret: mpWebhookSecret.trim() === "" ? null : mpWebhookSecret.trim(),
      });
      setAvisoMp("Credenciais do Mercado Pago salvas com sucesso.");
      carregar();
    } catch (err) {
      setErrorMp(
        err instanceof Error
          ? err.message
          : "Falha ao salvar credenciais do Mercado Pago"
      );
    } finally {
      setSalvandoMp(false);
    }
  }

  async function alternarModulo(m: api.EventModuleInfo) {
    setError(null);
    setAviso(null);
    setMexendo(m.key);
    try {
      const r = await api.toggleEventModule(eventId, m.key, !m.enabled);
      // Desligar um módulo pode arrastar quem depende dele. Sem este aviso,
      // ver outra aba sumir sozinha pareceria defeito.
      if (r.alsoDisabled.length > 0) {
        const nomes = r.alsoDisabled
          .map((k) => config?.modules.find((x) => x.key === k)?.name ?? k)
          .join(", ");
        setAviso(`${m.name} desligado. ${nomes} foi desligado junto, porque depende dele.`);
      } else {
        setAviso(`${m.name} ${r.enabled ? "ligado" : "desligado"}.`);
      }
      carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao mudar o módulo");
    } finally {
      setMexendo(null);
    }
  }

  if (error && !config) return <p className="error-text">{error}</p>;
  if (!config) return <p className="muted">Carregando…</p>;

  return (
    <div className="stack">
      {error && <p className="error-text">{error}</p>}
      {aviso && <p className="muted">{aviso}</p>}

      <section className="card">
        <h3>Dados de acesso</h3>
        <p className="muted">
          O endereço público é como o evento aparece num link divulgado. Deixe em
          branco enquanto não quiser divulgar.
        </p>

        <form onSubmit={salvar} className="stack">
          <label>
            Endereço público
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="copol-2026"
            />
            <small className="muted">
              Só letras minúsculas, números e hífen.
              {slug.trim() && ` O evento ficará em /e/${slug.trim()}`}
            </small>
          </label>

          <label>
            Fuso horário
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Sao_Paulo"
            />
            <small className="muted">
              Define como as datas aparecem para o organizador e nos e-mails.
            </small>
          </label>

          <label>
            Visibilidade
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
            >
              <option value="PRIVATE">Privado — só quem tem o link direto</option>
              <option value="PUBLIC">Público — aparece nos sites</option>
            </select>
            <small className="muted">
              É isto que liga e desliga o evento dos sites públicos. <strong>Público</strong>{" "}
              faz o evento aparecer nas listagens — e o site institucional mostra o primeiro
              evento público da lista, então dois públicos ao mesmo tempo disputam esse
              lugar. <strong>Privado</strong> tira das listagens sem bloquear nada: quem tem
              o link de inscrição continua entrando normalmente, e o evento segue aparecendo
              no portal de credenciamento enquanto as inscrições estiverem abertas.
            </small>
          </label>

          <label className="inline">
            <input
              type="checkbox"
              checked={registrationInPortal}
              onChange={(e) => setRegistrationInPortal(e.target.checked)}
            />
            Inscrição pelo site LSPK Eventos
          </label>
          <small className="muted">
            Liga a inscrição pelo site: o evento aparece na aba <strong>Inscrição</strong> e o
            formulário do site passa a aceitar inscrições dele. Precisa de um{" "}
            <strong>endereço</strong> (campo acima) e de inscrições abertas; o botão de
            encerrar inscrições continua valendo. Desligado, o evento não é oferecido pelo
            site.
          </small>

          <label className="inline">
            <input
              type="checkbox"
              checked={showInPortal}
              onChange={(e) => setShowInPortal(e.target.checked)}
            />
            Mostrar na aba “Realizados” do site LSPK Eventos
          </label>
          <small className="muted">
            O evento só aparece ali quando estiver <strong>Encerrado</strong> (o seletor de
            status no topo desta página). Enquanto estiver Ativo, nada muda no site. Esta opção é
            independente da Visibilidade acima.
          </small>

          <button type="submit" className="btn" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Configurações de Pagamento PIX (Manual)</h3>
        <p className="muted">
          Defina as informações de pagamento via PIX exibidas aos participantes no ato da inscrição.
          O pagador utilizará estes dados para transferir o valor e encaminhar o comprovante.
        </p>

        {errorPix && <p className="error-text">{errorPix}</p>}
        {avisoPix && <p style={{ color: "var(--success)" }}>{avisoPix}</p>}

        <form onSubmit={salvarPix} className="stack">
          <label>
            Chave PIX
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="ex: terceirocopol@gmail.com ou 12345678000199"
            />
            <small className="muted">
              Chave PIX cadastrada na instituição bancária do evento.
            </small>
          </label>

          <label>
            Tipo de Chave
            <select
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
            >
              <option value="EMAIL">E-mail</option>
              <option value="CPF_CNPJ">CPF/CNPJ</option>
              <option value="PHONE">Telefone</option>
              <option value="RANDOM">Chave Aleatória</option>
            </select>
            <small className="muted">
              Formato da chave cadastrada para facilitar a identificação pelo pagador.
            </small>
          </label>

          <label>
            Nome do Titular / Beneficiário
            <input
              type="text"
              value={pixReceiverName}
              onChange={(e) => setPixReceiverName(e.target.value)}
              placeholder="ex: 3º COPOL — Congresso Odontológico Positivo Londrinense"
            />
            <small className="muted">
              Nome do favorecido exibido na tela de pagamento para validação do pagador.
            </small>
          </label>

          <button type="submit" className="btn" disabled={salvandoPix || !event}>
            {salvandoPix ? "Salvando…" : "Salvar Configurações de PIX"}
          </button>
        </form>
      </section>

      <section className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Integração Mercado Pago (PIX Automático & Webhook)</h3>
          {mpAccessToken ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.12)",
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              ● Conectado / Ativo
            </span>
          ) : (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--muted)",
                background: "rgba(255, 255, 255, 0.08)",
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              ○ Não configurado
            </span>
          )}
        </div>

        <p className="muted">
          Com as credenciais cadastradas, o sistema gera cobranças Pix transparentes em tempo real
          para inscrições e Hands On, exibindo QR Code dinâmico, código Copia e Cola e realizando
          a baixa automática imediata via webhook.
        </p>

        {errorMp && <p className="error-text">{errorMp}</p>}
        {avisoMp && <p style={{ color: "var(--success)" }}>{avisoMp}</p>}

        <form onSubmit={salvarMercadoPago} className="stack">
          <label>
            Access Token (Produção)
            <input
              type="password"
              value={mpAccessToken}
              onChange={(e) => setMpAccessToken(e.target.value)}
              placeholder="APP_USR-..."
            />
            <small className="muted">
              Token de acesso da sua aplicação no painel Mercado Pago Developers.
            </small>
          </label>

          <label>
            Public Key
            <input
              type="text"
              value={mpPublicKey}
              onChange={(e) => setMpPublicKey(e.target.value)}
              placeholder="APP_USR-..."
            />
            <small className="muted">
              Chave pública correspondente da mesma aplicação.
            </small>
          </label>

          <label>
            Webhook Secret
            <input
              type="password"
              value={mpWebhookSecret}
              onChange={(e) => setMpWebhookSecret(e.target.value)}
              placeholder="Assinatura secreta do Webhook"
            />
            <small className="muted">
              Chave secreta obtida ao configurar o endpoint de Notificações / Webhooks no Mercado Pago.
            </small>
          </label>

          <button type="submit" className="btn" disabled={salvandoMp || !event}>
            {salvandoMp ? "Salvando…" : "Salvar Credenciais do Mercado Pago"}
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Módulos</h3>
        <p className="muted">
          Ligue o que este evento vai usar. Desligar esconde a aba —{" "}
          <strong>nenhum dado é apagado</strong>, e religar traz tudo de volta.
        </p>

        <div className="stack">
          {config.modules.map((m) => {
            const bloqueado = m.requires.some(
              (r) => !config.modules.find((x) => x.key === r)?.enabled
            );
            return (
              <div key={m.key} className="spread">
                <div>
                  <strong>{m.name}</strong>
                  <div className="muted">{m.description}</div>
                  {m.requires.length > 0 && (
                    <div className="muted">
                      Depende de:{" "}
                      {m.requires
                        .map((r) => config.modules.find((x) => x.key === r)?.name ?? r)
                        .join(", ")}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={m.enabled ? "btn btn-danger btn-sm" : "btn btn-sm"}
                  disabled={mexendo === m.key || (!m.enabled && bloqueado)}
                  title={
                    !m.enabled && bloqueado
                      ? "Ligue primeiro o módulo de que este depende"
                      : undefined
                  }
                  onClick={() => alternarModulo(m)}
                >
                  {mexendo === m.key ? "…" : m.enabled ? "Desligar" : "Ligar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {canDelete ? (
        <section
          className="card"
          style={{
            border: "1px solid var(--danger)",
            background: "rgba(239, 68, 68, 0.05)",
            marginTop: 20,
          }}
        >
          <h3 style={{ color: "var(--danger)", margin: "0 0 8px 0" }}>Zona de Perigo</h3>
          <p className="muted" style={{ margin: "0 0 16px 0", fontSize: 14 }}>
            Excluir este evento removerá permanentemente todos os seus dados vinculados (inscrições, presenças, credenciais de check-in, certificados gerados, lotes e programações). Esta ação não pode ser desfeita.
          </p>
          <button
            type="button"
            className="btn btn-danger"
            style={{
              width: "fit-content",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
            }}
            onClick={() => {
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
          >
            <TrashIcon size={16} color="#ffffff" /> Excluir Evento
          </button>
        </section>
      ) : null}

      {showDeleteModal && event ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="card stack"
            style={{
              width: "100%",
              maxWidth: 480,
              gap: 16,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spread" style={{ alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18, color: "var(--danger)", fontWeight: 700 }}>
                Excluir Evento
              </h3>
              <button
                type="button"
                onClick={() => !deleting && setShowDeleteModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 20,
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
                disabled={deleting}
              >
                ✕
              </button>
            </div>

            {deleteError ? (
              <div
                className="error-text"
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  background: "rgba(239, 68, 68, 0.1)",
                  borderRadius: 6,
                }}
              >
                {deleteError}
              </div>
            ) : null}

            <p style={{ margin: 0, fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>
              Tem certeza de que deseja excluir o evento <strong>{event.name}</strong>?
            </p>

            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid var(--danger)",
                borderRadius: 8,
                padding: 14,
                fontSize: 13,
                lineHeight: 1.5,
                color: "#fca5a5",
              }}
            >
              <strong style={{ color: "#ef4444", display: "block", marginBottom: 4 }}>
                Atenção: Os dados serão perdidos!
              </strong>
              Ao excluir este evento, todos os dados vinculados serão permanentemente perdidos e não poderão ser recuperados. Isso inclui inscrições, presenças, credenciais de check-in, certificados gerados, lotes e programações.
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--danger)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  cursor: deleting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {deleting ? (
                  "Excluindo..."
                ) : (
                  <>
                    <TrashIcon size={14} color="#ffffff" /> Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
