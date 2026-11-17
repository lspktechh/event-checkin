import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SmartphoneIcon, TrashIcon } from "../components/Icons";

const STATUS_LABEL: Record<api.EventRecord["status"], string> = {
  ACTIVE: "Ativo",
  CLOSED: "Encerrado",
};
const STATUS_BADGE: Record<api.EventRecord["status"], string> = {
  ACTIVE: "badge-success",
  CLOSED: "badge-warning",
};

export function EventsPage() {
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission("events.create");
  const canDelete = hasPermission("events.delete") || hasPermission("events.edit");
  const [events, setEvents] = useState<api.EventRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<api.EventRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function reload() {
    api
      .listEvents()
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar eventos"));
  }

  useEffect(reload, []);

  async function handleConfirmDelete() {
    if (!eventToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteEvent(eventToDelete.id);
      const deletedName = eventToDelete.name;
      setEventToDelete(null);
      setSuccessMessage(`Evento "${deletedName}" excluído com sucesso.`);
      setTimeout(() => setSuccessMessage(null), 5000);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Falha ao excluir evento");
    } finally {
      setDeleting(false);
    }
  }

  // Conta restrita a um único evento (ex.: organizador que só acompanha o
  // próprio congresso): a lista teria uma linha só — abre direto nele.
  const unicoEvento = user?.allowedEventIds?.length === 1 ? user.allowedEventIds[0] : null;
  if (unicoEvento) return <Navigate to={`/eventos/${unicoEvento}`} replace />;

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Eventos</h1>
        {canCreate ? (
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Novo evento"}
          </button>
        ) : null}
      </div>

      {showForm && canCreate ? (
        <CreateEventForm
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      ) : null}

      {successMessage ? (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid #22c55e",
            color: "#86efac",
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            fontSize: 14,
          }}
        >
          {successMessage}
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {!events ? (
        <p className="muted">Carregando...</p>
      ) : events.length === 0 ? (
        <p className="muted">Nenhum evento cadastrado ainda.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Local</th>
                <th>Início</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <Link to={`/eventos/${event.id}`} style={{ fontWeight: 600 }}>{event.name}</Link>
                  </td>
                  <td className="muted">{event.location ?? "—"}</td>
                  <td className="muted">{new Date(event.startDate).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[event.status]}`}>{STATUS_LABEL[event.status]}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <Link
                        to={`/eventos/${event.id}/credenciamento`}
                        className="btn btn-sm"
                        style={{
                          textDecoration: "none",
                          background: "#16a34a",
                          color: "#ffffff",
                          fontSize: 12,
                          padding: "5px 10px",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Abrir leitor de QR Code para este evento"
                      >
                        <SmartphoneIcon size="1.1em" /> Credenciamento
                      </Link>
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            background: "transparent",
                            border: "1px solid var(--danger)",
                            color: "var(--danger)",
                            fontSize: 12,
                            padding: "5px 10px",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                            borderRadius: 6,
                          }}
                          onClick={() => {
                            setDeleteError(null);
                            setEventToDelete(event);
                          }}
                          title={`Excluir evento ${event.name}`}
                        >
                          <TrashIcon size={14} color="var(--danger)" /> Excluir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {eventToDelete ? (
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
          onClick={() => !deleting && setEventToDelete(null)}
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
                onClick={() => !deleting && setEventToDelete(null)}
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
              Tem certeza de que deseja excluir o evento <strong>{eventToDelete.name}</strong>?
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
                onClick={() => setEventToDelete(null)}
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

function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createEvent({
        name,
        location: location || undefined,
        description: description || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label htmlFor="name">Nome do evento</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="row">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="startDate">Início</label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="endDate">Fim</label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="location">Local</label>
        <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "Criando..." : "Criar evento"}
      </button>
    </form>
  );
}
