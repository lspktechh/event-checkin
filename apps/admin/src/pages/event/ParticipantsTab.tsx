import { useEffect, useState, type FormEvent } from "react";
import * as api from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { QrCodeModal } from "../../components/QrCodeModal";
import { ImportCsvModal } from "../../components/ImportCsvModal";
import { EditParticipantModal } from "../../components/EditParticipantModal";
import { downloadParticipantsCsv, downloadParticipantsPdf } from "../../utils/participantsReport";

const CERT_LABEL: Record<api.CertificateRowStatus, string> = {
  LOCKED: "Bloqueado",
  ELIGIBLE: "Liberado",
  GENERATED: "Emitido",
  REVOKED: "Revogado",
};

const CERT_BADGE_CLASS: Record<api.CertificateRowStatus, string> = {
  LOCKED: "badge",
  ELIGIBLE: "badge badge-success",
  GENERATED: "badge badge-success",
  REVOKED: "badge badge-danger",
};

export function ParticipantsTab({
  eventId,
  eventName,
  isCopol = false,
}: {
  eventId: string;
  eventName?: string;
  /** Evento do COPOL: a cortesia daqui também entra em Inscritos (e-mail e CPF obrigatórios). */
  isCopol?: boolean;
}) {
  const { hasPermission } = useAuth();
  const canIssue = hasPermission("certificates.issue");
  // Botão que o perfil não pode usar não aparece — antes aparecia e dava
  // erro de permissão ao clicar (conta só de leitura, por exemplo).
  const canCreate = hasPermission("participants.create");
  const canEdit = hasPermission("participants.edit");
  const canDelete = hasPermission("participants.delete");
  const canViewCertificates = hasPermission("certificates.view");

  const [participants, setParticipants] = useState<api.ParticipantRecord[] | null>(null);
  const [certificates, setCertificates] = useState<Record<string, api.ParticipantCertificateStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [qrTarget, setQrTarget] = useState<api.ParticipantRecord | null>(null);
  const [editTarget, setEditTarget] = useState<api.ParticipantRecord | null>(null);
  const [busyCertId, setBusyCertId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // COPOL: cortesia que só existe como participante (criada quando esta aba
  // não gerava inscrição) não aparece em Inscritos.
  const cortesiasForaDeInscritos = isCopol
    ? (participants ?? []).filter((p) => p.isCourtesy && !p.hasInscription && p.status === "ACTIVE").length
    : 0;

  function reload() {
    api
      .listParticipants(eventId)
      .then(setParticipants)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar participantes"));

    if (!canViewCertificates) return;
    api
      .listParticipantCertificates(eventId)
      .then((rows) => setCertificates(Object.fromEntries(rows.map((r) => [r.participantId, r]))))
      // Falha só na coluna de certificado não deve esconder a lista de
      // participantes — a coluna cai para "—" e o resto da aba segue.
      .catch(() => setCertificates({}));
  }

  useEffect(reload, [eventId, canViewCertificates]);

  async function handleReleaseCertificate(participant: api.ParticipantRecord) {
    const cert = certificates[participant.id];
    // Sem check-in a liberação contradiz a regra automática, então o
    // aviso é explícito — é exatamente o caso em que se quer ter certeza.
    const warning = cert && !cert.hasCheckIn ? "\n\nAtenção: esta pessoa NÃO tem check-in registrado neste evento." : "";
    if (!window.confirm(`Liberar o certificado de "${participant.name}"?${warning}`)) return;

    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.releaseParticipantCertificate(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao liberar certificado");
    } finally {
      setBusyCertId(null);
    }
  }

  async function handleUndoRelease(participant: api.ParticipantRecord) {
    if (!window.confirm(`Cancelar a liberação manual do certificado de "${participant.name}"?`)) return;

    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.undoReleaseParticipantCertificate(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar liberação");
    } finally {
      setBusyCertId(null);
    }
  }

  async function handleDownloadCertificate(participant: api.ParticipantRecord) {
    setError(null);
    setBusyCertId(participant.id);
    try {
      await api.downloadParticipantCertificate(eventId, participant.id);
      // O primeiro download é o que gera o PDF (status vira "Emitido"),
      // então recarrega para a coluna refletir isso.
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao baixar certificado");
    } finally {
      setBusyCertId(null);
    }
  }

  async function handleLinkCourtesies() {
    if (
      !window.confirm(
        `Incluir ${cortesiasForaDeInscritos} cortesia(s) na lista de Inscritos?\n\nO QR de cada pessoa continua o mesmo. Elas aparecem em Inscritos como cortesia, sem ocupar vaga do lote. Quem não tem e-mail e CPF é avisado para completar.`,
      )
    ) {
      return;
    }
    setError(null);
    setNotice(null);
    setLinking(true);
    try {
      const result = await api.linkCourtesiesToInscriptions(eventId);
      const puladas = result.skipped.length;
      setNotice(
        `${result.linked} cortesia(s) incluída(s) em Inscritos.` +
          (puladas > 0 ? ` ${puladas} não incluída(s): ${result.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}.` : ""),
      );
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao incluir as cortesias em Inscritos");
    } finally {
      setLinking(false);
    }
  }

  async function handleToggleStatus(participant: api.ParticipantRecord) {
    setError(null);
    try {
      const nextStatus = participant.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
      await api.updateParticipant(eventId, participant.id, { status: nextStatus });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status do participante");
    }
  }

  async function handleRotateToken(participant: api.ParticipantRecord) {
    setError(null);
    try {
      await api.rotateQrToken(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar novo QR Code");
    }
  }

  async function handleDelete(participant: api.ParticipantRecord) {
    const confirmed = window.confirm(
      `Excluir "${participant.name}"? O QR Code dele deixa de funcionar e o histórico de presença dele neste evento é apagado. Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    setError(null);
    try {
      await api.deleteParticipant(eventId, participant.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir participante");
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted" style={{ margin: 0 }}>
          {participants ? `${participants.length} participante(s)` : "Carregando..."}
        </p>
        <div className="row">
          {/* O relatório vale para quem enxerga a aba: são os mesmos dados da lista. */}
          <button
            className="btn btn-secondary"
            onClick={() => participants && downloadParticipantsCsv(participants, eventName)}
            disabled={!participants || participants.length === 0}
          >
            Exportar CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => participants && downloadParticipantsPdf(participants, eventName)}
            disabled={!participants || participants.length === 0}
          >
            Baixar PDF
          </button>
          {canCreate && cortesiasForaDeInscritos > 0 ? (
            <button
              className="btn"
              onClick={handleLinkCourtesies}
              disabled={linking}
              title="Estas cortesias só existem como participante. Isto as inclui também na lista de Inscritos."
            >
              {linking ? "Incluindo..." : `Incluir cortesias em Inscritos (${cortesiasForaDeInscritos})`}
            </button>
          ) : null}
          {canCreate ? (
            <>
              <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
                Importar CSV
              </button>
              <button className="btn" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Cancelar" : "+ Novo participante"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showForm ? (
        <CreateParticipantForm
          eventId={eventId}
          isCopol={isCopol}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {notice ? (
        <p
          role="status"
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid var(--success)",
            borderRadius: "var(--radius)",
            padding: "10px 14px",
            margin: 0,
            fontSize: 13,
          }}
        >
          {notice}
        </p>
      ) : null}

      {participants && participants.length > 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Status</th>
                {canViewCertificates && <th>Certificado</th>}
                <th>QR Code</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    {p.isCourtesy ? (
                      <span className="badge badge-purple" style={{ marginLeft: 8 }} title="Convidado da organização, sem pagamento">
                        Cortesia
                      </span>
                    ) : null}
                  </td>
                  <td className="muted">{p.email ?? "—"}</td>
                  <td>
                    <span className={`badge ${p.status === "ACTIVE" ? "badge-success" : "badge-danger"}`}>
                      {p.status === "ACTIVE" ? "Ativo" : "Cancelado"}
                    </span>
                  </td>
                  {canViewCertificates && (
                    <td>
                      <CertificateCell
                        cert={certificates[p.id]}
                        busy={busyCertId === p.id}
                        canIssue={canIssue}
                        onRelease={() => handleReleaseCertificate(p)}
                        onUndoRelease={() => handleUndoRelease(p)}
                        onDownload={() => handleDownloadCertificate(p)}
                      />
                    </td>
                  )}
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setQrTarget(p)}>
                      Ver QR
                    </button>
                  </td>
                  <td>
                    <div className="row">
                      {canEdit ? (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditTarget(p)}>
                            Editar
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleRotateToken(p)}>
                            Gerar novo QR
                          </button>
                          <button
                            className={`btn btn-sm ${p.status === "ACTIVE" ? "btn-danger" : ""}`}
                            onClick={() => handleToggleStatus(p)}
                          >
                            {p.status === "ACTIVE" ? "Revogar" : "Reativar"}
                          </button>
                        </>
                      ) : null}
                      {canDelete ? (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)}>
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : participants ? (
        <p className="muted">Nenhum participante cadastrado ainda.</p>
      ) : null}

      {qrTarget ? (
        <QrCodeModal participantName={qrTarget.name} qrToken={qrTarget.qrToken} onClose={() => setQrTarget(null)} />
      ) : null}
      {editTarget ? (
        <EditParticipantModal
          eventId={eventId}
          participant={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            reload();
          }}
        />
      ) : null}
      {showImport ? (
        <ImportCsvModal
          title="Importar participantes (CSV)"
          hint={
            <>
              Colunas esperadas: <code>nome,email,telefone,documento</code>
            </>
          }
          courtesyHint={
            isCopol
              ? "Cortesia do COPOL: cada pessoa também entra em Inscritos, ocupa uma vaga do lote e recebe QR. E-mail e CPF passam a ser obrigatórios."
              : "Marca todos os participantes do arquivo como convidados da organização."
          }
          run={(csv, confirm, cortesia) => api.importParticipants(eventId, csv, confirm, cortesia)}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

/** Coluna "Certificado" de um participante: o estado atual + as ações
 * que fazem sentido para esse estado.
 *
 * "Liberar" existe para o caso em que a regra automática (evento
 * encerrado + check-in) não cobre a realidade — a pessoa participou mas
 * o check-in não foi registrado, por exemplo. "Baixar" serve para o
 * admin reenviar o PDF por e-mail/WhatsApp quando a pessoa não consegue
 * baixar sozinha; o arquivo é idêntico ao que ela receberia. */
function CertificateCell({
  cert,
  busy,
  canIssue,
  onRelease,
  onUndoRelease,
  onDownload,
}: {
  cert: api.ParticipantCertificateStatus | undefined;
  busy: boolean;
  canIssue: boolean;
  onRelease: () => void;
  onUndoRelease: () => void;
  onDownload: () => void;
}) {
  if (!cert) return <span className="muted">—</span>;

  return (
    <div className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
      <span className={CERT_BADGE_CLASS[cert.status]}>{CERT_LABEL[cert.status]}</span>
      {cert.manuallyReleased && (
        <span className="muted" style={{ fontSize: 11 }}>
          liberado manualmente
        </span>
      )}
      {canIssue && (
        <div className="row" style={{ gap: 4 }}>
          {cert.canDownload && (
            <button className="btn btn-secondary btn-sm" onClick={onDownload} disabled={busy}>
              {busy ? "..." : "Baixar"}
            </button>
          )}
          {/* Revogado sai daqui de propósito: restaurar é ação da aba
              Certificados, para não haver dois caminhos divergentes. */}
          {cert.status !== "REVOKED" &&
            (cert.manuallyReleased ? (
              <button className="btn btn-secondary btn-sm" onClick={onUndoRelease} disabled={busy}>
                {busy ? "..." : "Cancelar liberação"}
              </button>
            ) : (
              !cert.canDownload && (
                <button className="btn btn-sm" onClick={onRelease} disabled={busy}>
                  {busy ? "..." : "Liberar"}
                </button>
              )
            ))}
        </div>
      )}
    </div>
  );
}

function CreateParticipantForm({
  eventId,
  isCopol,
  onCreated,
}: {
  eventId: string;
  isCopol: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [cortesia, setCortesia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // No COPOL a cortesia vira inscrição, e a inscrição exige e-mail e CPF.
  const exigeContato = isCopol && cortesia;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createParticipant(eventId, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        document: document || undefined,
        cortesia,
      });
      setName("");
      setEmail("");
      setPhone("");
      setDocument("");
      setCortesia(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar participante");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="row">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="p-name">Nome</label>
          <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="p-email">E-mail</label>
          <input id="p-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={exigeContato} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="p-phone">Telefone</label>
          <input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="p-doc">Documento</label>
          <input id="p-doc" value={document} onChange={(e) => setDocument(e.target.value)} required={exigeContato} />
        </div>
      </div>
      <label className="switch-row" style={{ margin: "12px 0" }}>
        <span className="switch-text">
          <strong>Cortesia</strong>
          <small>
            {isCopol
              ? "Convidado da organização, sem pagamento. Entra também em Inscritos, ocupa uma vaga do lote e recebe QR (e-mail e CPF obrigatórios)."
              : "Convidado da organização, sem pagamento. Fica marcado na lista."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          checked={cortesia}
          onChange={(e) => setCortesia(e.target.checked)}
        />
      </label>
      {error ? <p className="error-text">{error}</p> : null}
      <button className="btn" type="submit" disabled={saving}>
        {saving ? "Criando..." : "Criar participante"}
      </button>
    </form>
  );
}
