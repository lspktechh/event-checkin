import { useState, type FormEvent } from "react";
import * as api from "../api/client";

interface Props {
  eventId: string;
  onClose: () => void;
  /** Recebe a mensagem de sucesso para a aba exibir. */
  onCreated: (message: string) => void;
}

/**
 * Inscrição lançada pela organização. Já nasce confirmada, com
 * participante e QR (e comprovante por e-mail).
 *
 * Com "Cortesia" ligada: valor zero e fora da receita, mas OCUPA uma vaga
 * do lote ativo. Desligada: vale o preço do lote, como pagamento feito
 * fora do sistema (dinheiro, Pix direto na chave).
 */
export function ManualInscriptionModal({ eventId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [institution, setInstitution] = useState("");
  const [notes, setNotes] = useState("");
  const [cortesia, setCortesia] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createManualInscription(eventId, {
        name,
        email,
        document,
        phone: phone || undefined,
        institution: institution || undefined,
        notes: notes || undefined,
        cortesia,
      });
      onCreated(
        cortesia
          ? `${name} adicionado(a) como cortesia. Ingresso e credencial gerados.`
          : `Inscrição de ${name} lançada como paga por fora. Ingresso e credencial gerados.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar inscrição");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      style={{ position: "fixed", inset: 0, background: "#000000aa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <form onSubmit={handleSubmit} className="card stack" style={{ width: 560, maxHeight: "90vh", overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Nova inscrição</h2>

        <label className="switch-row">
          <span className="switch-text">
            <strong>Cortesia</strong>
            <small>
              {cortesia
                ? "Valor zero e fora da receita, mas ocupa uma vaga do lote."
                : "Cobra o valor do lote ativo, como pagamento feito fora do sistema."}
            </small>
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

        <div className="field">
          <label htmlFor="mi-name">Nome completo *</label>
          <input id="mi-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="mi-email">E-mail *</label>
            <input id="mi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="mi-doc">CPF *</label>
            <input id="mi-doc" value={document} onChange={(e) => setDocument(e.target.value)} required />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="mi-phone">Telefone</label>
            <input id="mi-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="mi-inst">Instituição</label>
            <input id="mi-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="mi-notes">Observação</label>
          <textarea id="mi-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Criando..." : cortesia ? "Adicionar cortesia" : "Lançar inscrição"}
          </button>
        </div>
      </form>
    </div>
  );
}
