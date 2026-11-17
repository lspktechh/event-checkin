import { useEffect, useState } from "react";
import * as api from "../api/client";

const ACTION_LABELS: Record<string, string> = {
  "user.create": "Criou usuário",
  "user.update": "Editou usuário",
  "user.activate": "Ativou usuário",
  "user.deactivate": "Desativou usuário",
  "user.delete": "Excluiu usuário",
  "role.create": "Criou perfil",
  "role.update": "Editou perfil",
  "role.delete": "Excluiu perfil",
  "role.update_permissions": "Alterou permissões do perfil",
  "event.create": "Criou evento",
  "event.update": "Editou evento",
  "event.close_registrations": "Encerrou inscrições",
  "event.reopen_registrations": "Reabriu inscrições",
  "participant.create": "Cadastrou participante",
  "participant.update": "Editou participante",
  "participant.delete": "Excluiu participante",
  "participant.rotate_qr_token": "Gerou novo QR Code",
  "participant.import": "Importou participantes",
  "terminal.create": "Criou terminal",
  "terminal.delete": "Excluiu terminal",
  "event.configure": "Configurou o evento",
  "event.delete": "Excluiu evento",
  "inscription.cancel": "Cancelou inscrição",
  "inscription.confirm": "Confirmou inscrição",
  "inscription.create_manual": "Lançou inscrição manual",
  "inscription.delete": "Excluiu inscrição",
  "inscription.import": "Importou inscritos",
  "inscription.sortear_equipes": "Sorteou equipes",
  "inscription.update": "Editou inscrição",
  "certificate.generated": "Gerou certificado",
  "certificate.released": "Liberou certificados",
  "certificate.manually_released": "Liberou certificado manualmente",
  "certificate.manual_release_undone": "Cancelou a liberação manual de certificado",
  "certificate.revoked": "Revogou certificado",
  "certificate.reinstated": "Restaurou certificado",
  "certificate.emailed": "Enviou certificado por e-mail",
  "certificate.emailed_bulk": "Enviou certificados em lote",
  "certificate.downloaded_by_admin": "Baixou certificado (administração)",
  "certificate.preview_generated": "Gerou prévia de certificado",
  "certificate.signature_image_uploaded": "Enviou imagem de assinatura",
  "certificate_template.created": "Criou modelo de certificado",
  "certificate_template.updated": "Editou modelo de certificado",
  "certificate_template.deleted": "Excluiu modelo de certificado",
  "attendance_proof.emailed": "Enviou comprovante de presença por e-mail",
  "attendance_proof.emailed_bulk": "Enviou comprovantes de presença em lote",
  "submissions.admin_edit": "Editou trabalho (administração)",
  "submissions.create": "Criou trabalho",
  "submissions.submit": "Submeteu trabalho",
  "submissions.resubmit": "Reenviou trabalho",
  "submissions.withdraw": "Retirou trabalho",
  "submissions.decide": "Decidiu sobre trabalho",
  "submissions.delete": "Excluiu trabalho",
  "submissions.file_upload": "Enviou arquivo de trabalho",
  "submissions.file_remove": "Removeu arquivo de trabalho",
  "submissions.send_receipt": "Enviou comprovante de trabalho",
  "submissions.settings_update": "Alterou as configurações da chamada de trabalhos",
  "submissions.modality_create": "Criou modalidade",
  "submissions.modality_delete": "Excluiu modalidade",
  "submissions.topic_create": "Criou área temática",
  "submissions.topic_delete": "Excluiu área temática",
  "team_work.upload_file": "Enviou arquivo de trabalho da equipe",
};

export function AuditPage() {
  const [logs, setLogs] = useState<api.AuditLogRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAuditLogs()
      .then(setLogs)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar auditoria"));
  }, []);

  return (
    <div className="stack">
      <div>
        <h1 style={{ margin: 0 }}>Auditoria</h1>
        <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Quem fez o quê e quando — só das pessoas dos perfis com a auditoria ligada (tela Perfis).
        </p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {!logs ? (
        <p className="muted">Carregando...</p>
      ) : logs.length === 0 ? (
        <p className="muted">Nenhum registro ainda.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Quem</th>
                  <th>Ação</th>
                  <th>Entidade</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="muted">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                    <td>{log.actorEmail}</td>
                    <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="muted">
                      {log.entityType}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
