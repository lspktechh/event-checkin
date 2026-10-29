import { useState, type FormEvent } from "react";
import * as api from "../api/client";

interface Props {
  eventId: string;
  participant: api.ParticipantRecord;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Edita um participante (nome, e-mail, telefone, CPF e, quando permitido,
 * cortesia). Só envia o que mudou.
 *
 * Quem veio de uma inscrição tem os mesmos dados nela, e o servidor
 * atualiza os dois juntos. A cortesia desse participante NÃO se mexe
 * aqui: vem da forma de pagamento da inscrição (aba Inscritos).
 */
export function EditParticipantModal({ eventId, participant, onClose, onSaved }: Props) {
  const [name, setName] = useState(participant.name);
  const [email, setEmail] = useState(participant.email ?? "");
  const [phone, setPhone] = useState(participant.phone ?? "");
  const [document, setDocument] = useState(participant.document ?? "");
  const [cortesia, setCortesia] = useState(participant.isCourtesy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload: Parameters<typeof api.updateParticipant>[2] = {};
  if (name.trim() !== participant.name) payload.name = name.trim();
  // O e-mail não pode ser apagado por aqui: só trocado por outro válido.
  if (email.trim() && email.trim() !== (participant.email ?? "")) payload.email = email.trim();
  if (phone.trim() !== (participant.phone ?? "")) payload.phone = phone.trim();
  if (document.trim() !== (participant.document ?? "")) payload.document = document.trim();
  if (!participant.hasInscription && cortesia !== participant.isCourtesy) payload.cortesia = cortesia;
  const dirty = Object.keys(payload).length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.updateParticipant(eventId, participant.id, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <form onSubmit={handleSubmit} className="card stack" style={{ width: 520, maxHeight: "90vh", overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Editar participante</h2>

        <div className="field">
          <label htmlFor="ep-name">Nome</label>
          <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="ep-email">E-mail</label>
          <input id="ep-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-phone">Telefone</label>
            <input id="ep-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ep-doc">CPF / Documento</label>
            <input id="ep-doc" value={document} onChange={(e) => setDocument(e.target.value)} />
          </div>
        </div>
        {email.trim() && email.trim() !== (participant.email ?? "") ? (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            O e-mail novo passa a ser o login da pessoa no portal.
          </p>
        ) : null}

        {participant.hasInscription ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {participant.isCourtesy ? "Cortesia" : "Pagante"}: definido pela inscrição. Para mudar, use <strong>Editar</strong> na aba Inscritos.
          </p>
        ) : (
          <label className="switch-row">
            <span className="switch-text">
              <strong>Cortesia</strong>
              <small>Convidado da organização, sem pagamento. Fica marcado na lista.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={cortesia}
              onChange={(e) => setCortesia(e.target.checked)}
              disabled={saving}
            />
          </label>
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving || !dirty}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
