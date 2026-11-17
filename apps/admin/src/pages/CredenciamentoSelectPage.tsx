import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SmartphoneIcon, SignOutIcon, SearchIcon } from "../components/Icons";

export function CredenciamentoSelectPage() {
  const { user, logout } = useAuth();
  const [events, setEvents] = useState<api.EventRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .listEvents()
      .then((list) => {
        if (!mounted) return;
        setEvents(list);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar eventos para credenciamento");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Se o usuário tem acesso a apenas 1 evento, direciona direto para o credenciamento dele
  if (!loading && events && events.length === 1) {
    return <Navigate to={`/eventos/${events[0].id}/credenciamento`} replace />;
  }

  const filteredEvents = (events || []).filter((e) =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header com identificação do operador e logout */}
      <header
        style={{
          padding: "14px 20px",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SmartphoneIcon size="1.2em" />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: "var(--text)" }}>
              Módulo de Credenciamento
            </h1>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {user?.email} · Perfil: {user?.role?.name || "Credenciamento"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="btn btn-secondary"
          style={{
            fontSize: 13,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
          title="Encerrar sessão"
        >
          <SignOutIcon size="1.1em" /> Sair
        </button>
      </header>

      {/* Conteúdo principal */}
      <main
        style={{
          flex: 1,
          maxWidth: 720,
          width: "100%",
          margin: "0 auto",
          padding: "24px 16px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px", color: "var(--text)" }}>
            Selecione o Evento
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
            Escolha abaixo o evento em que você realizará o check-in e validação de participantes:
          </p>
        </div>

        {events && events.length > 3 && (
          <div className="field" style={{ margin: 0, position: "relative" }}>
            <input
              type="text"
              placeholder="Buscar evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                fontSize: 14,
              }}
            />
            <span
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
                display: "flex",
              }}
            >
              <SearchIcon size="1.1em" />
            </span>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            Carregando eventos disponíveis...
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{
              padding: 20,
              borderLeft: "4px solid var(--danger)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--danger)" }}>Erro ao carregar eventos</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{error}</p>
          </div>
        )}

        {!loading && !error && events && events.length === 0 && (
          <div
            className="card"
            style={{
              padding: 32,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--text)" }}>Nenhum evento atribuído</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", maxWidth: 440 }}>
              Sua conta ainda não possui eventos liberados para credenciamento. Solicite ao administrador do sistema a liberação do evento para seu usuário.
            </p>
            <button
              type="button"
              onClick={logout}
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
            >
              <SignOutIcon size="1.1em" /> Trocar de conta
            </button>
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredEvents.map((ev) => (
              <Link
                key={ev.id}
                to={`/eventos/${ev.id}/credenciamento`}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                  gap: 16,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                      {ev.name}
                    </span>
                    <span
                      className={`badge ${ev.status === "ACTIVE" ? "badge-success" : "badge-warning"}`}
                      style={{ fontSize: 11 }}
                    >
                      {ev.status === "ACTIVE" ? "Ativo" : "Encerrado"}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatDateRange(ev.startDate, ev.endDate)}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </span>
                </div>

                <span
                  className="btn btn-primary"
                  style={{
                    fontSize: 13,
                    padding: "8px 16px",
                    flexShrink: 0,
                    pointerEvents: "none",
                  }}
                >
                  Abrir Credenciamento
                </span>
              </Link>
            ))}
          </div>
        )}

        {!loading && !error && events && events.length > 0 && filteredEvents.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 14 }}>
            Nenhum evento corresponde à busca "{searchTerm}".
          </div>
        )}
      </main>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
    const startLabel = new Intl.DateTimeFormat("pt-BR", opts).format(start);
    const endLabel = new Intl.DateTimeFormat("pt-BR", opts).format(end);
    return startLabel === endLabel ? startLabel : `${startLabel} a ${endLabel}`;
  } catch {
    return "";
  }
}
