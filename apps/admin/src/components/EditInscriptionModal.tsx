import { useState, type FormEvent } from "react";
import * as api from "../api/client";

interface Props {
  eventId: string;
  item: api.InscriptionReportItem;
  onClose: () => void;
  /** Recebe a mensagem de sucesso para a aba exibir. */
  onSaved: (message: string) => void;
}

const FORM_LABEL: Record<api.PaymentForm, string> = {
  CORTESIA: "Cortesia (sem pagamento)",
  MANUAL: "Pago por fora (dinheiro ou outro)",
  PIX: "Pix (pago por fora)",
  CARD: "Cartão (pago por fora)",
};

function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function paidByGateway(item: api.InscriptionReportItem) {
  return item.paymentProvider === "MERCADO_PAGO" || item.paymentProvider === "PICPAY";
}

function describeCurrent(item: api.InscriptionReportItem) {
  if (item.isCourtesy) return "Cortesia";
  const how = item.paymentMethod === "CARD" ? "Cartão" : item.paymentMethod === "PIX" ? "Pix" : null;
  if (paidByGateway(item)) return `Pago online (${how ?? "gateway"}) — ${brl(item.amount)}`;
  if (item.amount === 0) return "Gratuita";
  return `${how ?? "Pago por fora"} — ${brl(item.amount)}`;
}

/** "120", "120,50" e "1.200,00" viram número; vazio vira undefined. */
function parseMoney(text: string): number | undefined | null {
  const clean = text.trim();
  if (!clean) return undefined;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Edita uma inscrição: dados da pessoa e/ou forma de pagamento.
 *
 * Só envia o que mudou. Os dados valem também para o participante ligado
 * (o portal entra pelo e-mail dele). A forma de pagamento serve para
 * acertar quem entrou como cortesia (ou o contrário) sem apagar e refazer
 * a inscrição — por isso mantém a vaga e o QR Code.
 */
export function EditInscriptionModal({ eventId, item, onClose, onSaved }: Props) {
  const [name, setName] = useState(item.name);
  const [email, setEmail] = useState(item.email);
  const [document, setDocument] = useState(item.document);
  const [phone, setPhone] = useState(item.phone ?? "");
  const [institution, setInstitution] = useState(item.institution ?? "");
  const [forma, setForma] = useState<api.PaymentForm | "">("");
  const [valor, setValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedReason =
    item.status !== "CONFIRMED"
      ? "A forma de pagamento só pode ser alterada em inscrições confirmadas."
      : paidByGateway(item)
        ? "Esta inscrição foi paga online (gateway): a forma de pagamento não pode ser alterada aqui."
        : null;

  const payload: api.UpdateInscriptionInput = {};
  if (name.trim() !== item.name) payload.name = name.trim();
  if (email.trim() !== item.email) payload.email = email.trim();
  if (document.trim() !== item.document) payload.document = document.trim();
  if (phone.trim() !== (item.phone ?? "")) payload.phone = phone.trim() || null;
  if (institution.trim() !== (item.institution ?? "")) payload.institution = institution.trim() || null;
  const money = parseMoney(valor);
  if (forma) payload.pagamento = { forma, valor: forma === "CORTESIA" ? undefined : (money ?? undefined) };
  const dirty = Object.keys(payload).length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (money === null) {
      setError("Valor inválido. Use números, por exemplo 120 ou 120,50.");
      return;
    }
    setSaving(true);
    try {
      await api.updateInscription(eventId, item.id, payload);
      onSaved(
        payload.pagamento
          ? `Inscrição de ${name.trim()} atualizada. Forma de pagamento: ${FORM_LABEL[payload.pagamento.forma]}.`
          : `Dados de ${name.trim()} atualizados.`
      );
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
      <form onSubmit={handleSubmit} className="card stack" style={{ width: 560, maxHeight: "90vh", overflow: "auto" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Editar inscrição</h2>

        <div className="field">
          <label htmlFor="ei-name">Nome completo *</label>
          <input id="ei-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ei-email">E-mail *</label>
            <input id="ei-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ei-doc">CPF *</label>
            <input id="ei-doc" value={document} onChange={(e) => setDocument(e.target.value)} required />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ei-phone">Telefone</label>
            <input id="ei-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="ei-inst">Instituição</label>
            <input id="ei-inst" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
        </div>
        {email.trim() !== item.email && item.participantId ? (
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            O e-mail novo passa a ser o login da pessoa no portal. O comprovante não é reenviado automaticamente.
          </p>
        ) : null}

        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          <strong style={{ fontSize: 14 }}>Forma de pagamento</strong>
          {lockedReason ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Atual: <strong>{describeCurrent(item)}</strong>. {lockedReason}
            </p>
          ) : (
            <>
              <div className="field">
                <label htmlFor="ei-forma">Alterar para</label>
                <select id="ei-forma" value={forma} onChange={(e) => setForma(e.target.value as api.PaymentForm | "")} disabled={saving}>
                  <option value="">Manter como está ({describeCurrent(item)})</option>
                  {(Object.keys(FORM_LABEL) as api.PaymentForm[]).map((f) => (
                    <option key={f} value={f}>
                      {FORM_LABEL[f]}
                    </option>
                  ))}
                </select>
              </div>
              {forma && forma !== "CORTESIA" ? (
                <div className="field">
                  <label htmlFor="ei-valor">Valor pago (R$)</label>
                  <input
                    id="ei-valor"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder={item.amount > 0 ? `${item.amount} (valor atual)` : "vazio = preço do lote"}
                  />
                </div>
              ) : null}
              {forma === "CORTESIA" ? (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  O valor passa a zero e sai da receita. A vaga no lote continua ocupada.
                </p>
              ) : forma ? (
                <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                  Entra na receita pelo valor informado. A vaga e o QR Code continuam os mesmos.
                </p>
              ) : null}
            </>
          )}
        </div>

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
