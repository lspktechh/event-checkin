import { useEffect, useState, useMemo, useCallback } from "react";
import * as api from "../../api/client";

interface WorkshopDef {
  id: string;
  diaId: "quinta" | "sexta";
  diaSemana: string;
  data: string;
  horario: string;
  titulo: string;
  ministrante: string;
  preco: number;
  vagas: number;
  local: string;
  patrocinio?: string;
  observacao?: string;
}

const WORKSHOPS_CATALOG: WorkshopDef[] = [
  // QUINTA-FEIRA (05/11)
  {
    id: "clareamento-dental-caseiro",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "14:00 às 15:30",
    titulo: "Clareamento dental caseiro, do molde ao produto",
    ministrante: "Profª Marcela Moreira",
    preco: 20,
    vagas: 10,
    local: "Clínica Odontológica Positivo",
  },
  {
    id: "fechamento-diastema-manequim",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "15:30 às 17:30",
    titulo: "Fechamento de diastema no manequim",
    ministrante: "Profª Marcela Moreira",
    preco: 20,
    vagas: 12,
    local: "Laboratório de Dentística Positivo",
  },
  {
    id: "preenchimento-labial",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "13:30 às 15:00",
    titulo: "Preenchimento labial",
    ministrante: "Profª Ana Paula Pereira",
    preco: 50,
    vagas: 12,
    local: "Clínica de HOF Positivo",
  },
  {
    id: "cirurgia-guiada-implantodontia",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "16:00 às 17:30",
    titulo: "Cirurgia Guiada em Implantodontia",
    ministrante: "Prof. Marcos Guskuma",
    preco: 20,
    vagas: 12,
    patrocinio: "Straumann",
    local: "Sala de Cirurgia / Centro Clínico Positivo",
  },
  {
    id: "resina-injetada-dvo",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "14:00 às 15:30",
    titulo: "Resina composta injetada para aumento de DVO: dicas clínicas",
    ministrante: "Prof. Carlos Archangelo",
    preco: 20,
    vagas: 12,
    local: "Laboratório Multidisciplinar Positivo",
  },
  {
    id: "radiotech-tomografia-visita",
    diaId: "quinta",
    diaSemana: "Quinta-feira",
    data: "05/11/2026",
    horario: "Palestra às 15:00 · Hands On às 18:30",
    titulo: "Palestra: “Tomografia sem mistérios” e Hands On na Radiotech",
    ministrante: "Dra. Mariana Paião",
    preco: 0,
    vagas: 12,
    local: "Auditório Positivo & Radiotech Londrina",
    observacao: "Visita técnica (12 vagas às 18:30) com palestra prévia às 15:00",
  },

  // SEXTA-FEIRA (06/11)
  {
    id: "toxina-botulinica-hof",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "14:30 às 16:30",
    titulo: "Toxina Botulínica: como iniciar na Harmonização facial com segurança",
    ministrante: "Profª Marcia Palla",
    preco: 30,
    vagas: 14,
    local: "Clínica de HOF Positivo",
  },
  {
    id: "simplificando-resina-composta",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "13:30 às 16:30",
    titulo: "Simplificando o dia a dia com Resina Composta",
    ministrante: "Dr. Paulo Chagas",
    preco: 20,
    vagas: 18,
    patrocinio: "Dental Shop",
    local: "Clínica Odontológica Positivo",
  },
  {
    id: "fotografia-smartphone",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "15:30 às 16:30",
    titulo: "Hands on de fotografia com smartphone",
    ministrante: "Dra. Herica Delalíbera",
    preco: 15,
    vagas: 12,
    local: "Sala Fotográfica / Auditório Positivo",
  },
  {
    id: "integrale-cirurgia-implante-protetico",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "17:00 às 18:00",
    titulo: "Hands on Integrale: cirurgia de implante e componente protético",
    ministrante: "Prof. Alessandro Batistella e Paulo Lucchese",
    preco: 20,
    vagas: 20,
    patrocinio: "Integrale",
    local: "Laboratório de Prótese / Clínica Positivo",
  },
  {
    id: "cimentacao-pino-fibra",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "15:30 às 16:30",
    titulo: "Hands on de Cimentações de Pino de Fibra de Vidro",
    ministrante: "Prof. Lucas",
    preco: 20,
    vagas: 20,
    patrocinio: "Angelus",
    local: "Laboratório Integrado Positivo",
  },
  {
    id: "lprf-poder-regenerativo",
    diaId: "sexta",
    diaSemana: "Sexta-feira",
    data: "06/11/2026",
    horario: "16:00 às 17:00",
    titulo: "Hands on L-PRF: O PODER REGENERATIVO DO PRÓPRIO SANGUE",
    ministrante: "Prof. João Rozante",
    preco: 20,
    vagas: 12,
    local: "Centro Cirúrgico Positivo",
  },
];

export function HandsOnTab({ eventId }: { eventId: string }) {
  const [registrations, setRegistrations] = useState<api.HandsOnRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [diaFilter, setDiaFilter] = useState<"todos" | "quinta" | "sexta">("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CONFIRMED" | "PENDING">("ALL");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Controle de liberação das inscrições no site
  const [handsOnOpen, setHandsOnOpen] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);

  // Modal de Inscrição Manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualWorkshopId, setManualWorkshopId] = useState(WORKSHOPS_CATALOG[0]?.id || "");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualDocument, setManualDocument] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCategory, setManualCategory] = useState("Estudante");
  const [manualInstitution, setManualInstitution] = useState("");
  const [manualStatus, setManualStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, settings] = await Promise.all([
        api.listHandsOnRegistrations(eventId),
        api.getHandsOnSettings(eventId).catch(() => ({ open: false })),
      ]);
      setRegistrations(data);
      setHandsOnOpen(settings.open);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar inscrições de Hands On");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Estatísticas agregadas
  const statsByWorkshop = useMemo(() => {
    const map: Record<string, { total: number; confirmed: number; pending: number; checkedIn: number }> = {};
    for (const def of WORKSHOPS_CATALOG) {
      map[def.id] = { total: 0, confirmed: 0, pending: 0, checkedIn: 0 };
    }
    for (const reg of registrations) {
      const targetId =
        reg.handsOnId === "reabilitacao-resina-composta"
          ? "integrale-cirurgia-implante-protetico"
          : reg.handsOnId;
      if (!map[targetId]) {
        map[targetId] = { total: 0, confirmed: 0, pending: 0, checkedIn: 0 };
      }
      map[targetId].total += 1;
      if (reg.status === "CONFIRMED") map[targetId].confirmed += 1;
      if (reg.status === "PENDING") map[targetId].pending += 1;
      if (reg.checkedInAt) map[targetId].checkedIn += 1;
    }
    return map;
  }, [registrations]);

  const totalInscritosGlobal = registrations.length;
  const totalConfirmadosGlobal = registrations.filter((r) => r.status === "CONFIRMED").length;
  const totalPendentesGlobal = registrations.filter((r) => r.status === "PENDING").length;
  const totalPresentesGlobal = registrations.filter((r) => !!r.checkedInAt).length;

  const filteredWorkshops = useMemo(() => {
    return WORKSHOPS_CATALOG.filter((w) => {
      if (diaFilter !== "todos" && w.diaId !== diaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return w.titulo.toLowerCase().includes(q) || w.ministrante.toLowerCase().includes(q);
      }
      return true;
    });
  }, [diaFilter, searchQuery]);

  const selectedWorkshop = useMemo(() => {
    if (!selectedWorkshopId) return null;
    return WORKSHOPS_CATALOG.find((w) => w.id === selectedWorkshopId) ?? null;
  }, [selectedWorkshopId]);

  const workshopRegistrations = useMemo(() => {
    if (!selectedWorkshopId) return [];
    return registrations
      .filter((r) => {
        const targetId =
          r.handsOnId === "reabilitacao-resina-composta"
            ? "integrale-cirurgia-implante-protetico"
            : r.handsOnId;
        return targetId === selectedWorkshopId;
      })
      .filter((r) => {
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
        if (participantSearch.trim()) {
          const q = participantSearch.toLowerCase();
          const docClean = r.document.replace(/\D/g, "");
          const phoneClean = (r.phone || "").replace(/\D/g, "");
          return (
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.document.includes(q) ||
            docClean.includes(q) ||
            (r.phone && r.phone.includes(q)) ||
            phoneClean.includes(q)
          );
        }
        return true;
      });
  }, [registrations, selectedWorkshopId, statusFilter, participantSearch]);

  async function handleConfirmPayment(id: string) {
    if (!confirm("Deseja confirmar o pagamento Pix desta inscrição?")) return;
    try {
      setProcessingId(id);
      await api.confirmHandsOnPayment(eventId, id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao confirmar pagamento");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleCheckIn(idOrToken: string) {
    try {
      setProcessingId(idOrToken);
      const res = await api.checkInHandsOn(eventId, idOrToken);
      if (res.alreadyCheckedIn) {
        alert("Check-in deste participante já foi registrado anteriormente!");
      }
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao realizar check-in");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteRegistration(reg: api.HandsOnRegistrationRecord) {
    if (
      !confirm(
        `Tem certeza que deseja EXCLUIR a inscrição de "${reg.name}" no Hands On "${selectedWorkshop?.titulo || reg.title}"?\n\nEsta ação removerá definitivamente o registro e liberará a vaga. Deseja prosseguir?`
      )
    ) {
      return;
    }
    try {
      setProcessingId(reg.id);
      await api.deleteHandsOnRegistration(eventId, reg.id);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir inscrição");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteAllRegistrations() {
    if (registrations.length === 0) {
      alert("Não há nenhum inscrito cadastrado nos Hands On.");
      return;
    }
    const conf = prompt(
      `ATENÇÃO: Deseja EXCLUIR MANUALMENTE todos os ${registrations.length} inscritos dos workshops Hands On?\n\nAs inscrições oficiais do congresso COPOL NÃO serão afetadas.\n\nPara confirmar esta exclusão, digite EXCLUIR abaixo:`
    );
    if (conf !== "EXCLUIR") {
      alert("Operação cancelada. Nenhuma inscrição foi excluída.");
      return;
    }
    try {
      setLoading(true);
      const res = await api.deleteAllHandsOnRegistrations(eventId);
      await loadData();
      alert(`${res.deletedCount} inscrições de Hands On foram excluídas com sucesso!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir inscrições de Hands On");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleOpen() {
    const nextState = !handsOnOpen;
    const msg = nextState
      ? "Deseja LIBERAR as inscrições dos Hands On no site público do COPOL?\n\nOs participantes poderão se inscrever e efetuar pagamentos via Pix normalmente."
      : "Deseja FECHAR / PAUSAR as inscrições dos Hands On no site público?\n\nO público não conseguirá mais enviar inscrições até que você reabra.";
    if (!confirm(msg)) return;

    try {
      setTogglingOpen(true);
      const res = await api.updateHandsOnSettings(eventId, nextState);
      setHandsOnOpen(res.open);
      alert(
        res.open
          ? "Inscrições dos Hands On LIBERADAS com sucesso no site!"
          : "Inscrições dos Hands On FECHADAS / PAUSADAS com sucesso!"
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao alterar status das inscrições");
    } finally {
      setTogglingOpen(false);
    }
  }

  function openManualModal(workshopId?: string) {
    setManualWorkshopId(workshopId || selectedWorkshopId || WORKSHOPS_CATALOG[0]?.id || "");
    setManualName("");
    setManualEmail("");
    setManualDocument("");
    setManualPhone("");
    setManualCategory("Estudante");
    setManualInstitution("");
    setManualStatus("CONFIRMED");
    setManualNotes("Inscrição manual via painel");
    setManualError(null);
    setIsManualModalOpen(true);
  }

  async function handleSaveManual(e: React.FormEvent) {
    e.preventDefault();
    setManualError(null);

    const nomeTrim = manualName.trim();
    const emailTrim = manualEmail.trim().toLowerCase();
    const docClean = manualDocument.replace(/\D/g, "");

    if (!nomeTrim || nomeTrim.length < 3) {
      setManualError("Informe o nome completo do participante (ao menos 3 letras).");
      return;
    }
    if (!emailTrim || !emailTrim.includes("@")) {
      setManualError("Informe um e-mail válido.");
      return;
    }
    if (!docClean || docClean.length < 11) {
      setManualError("Informe um CPF válido (11 dígitos).");
      return;
    }

    const workshop = WORKSHOPS_CATALOG.find((w) => w.id === manualWorkshopId);
    if (!workshop) {
      setManualError("Workshop selecionado não encontrado.");
      return;
    }

    try {
      setSavingManual(true);
      await api.createManualHandsOnRegistration(eventId, {
        handsOnId: workshop.id,
        title: workshop.titulo,
        speaker: workshop.ministrante,
        date: workshop.data === "05/11/2026" ? "2026-11-05" : "2026-11-06",
        time: workshop.horario,
        location: workshop.local,
        sponsor: workshop.patrocinio || null,
        amount: workshop.preco,
        name: nomeTrim,
        email: emailTrim,
        document: docClean,
        phone: manualPhone.trim() || null,
        category: manualCategory || null,
        institution: manualInstitution.trim() || null,
        status: manualStatus,
        notes: manualNotes.trim() || null,
      });

      await loadData();
      setIsManualModalOpen(false);
      alert(
        `Inscrição de "${nomeTrim}" adicionada com sucesso no Hands On "${workshop.titulo}"!`
      );
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Erro ao adicionar inscrição manual");
    } finally {
      setSavingManual(false);
    }
  }

  function exportWorkshopCsv(workshop: WorkshopDef, list: api.HandsOnRegistrationRecord[]) {
    const headers = [
      "Nome",
      "E-mail",
      "CPF",
      "Telefone",
      "Categoria",
      "Instituicao",
      "Status Pagamento",
      "Check-in Presenca",
      "Data Check-in",
      "Data Inscricao",
      "Codigo Inscrição",
    ];

    const rows = list.map((r) => [
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${r.document.replace(/"/g, '""')}"`,
      `"${(r.phone || "").replace(/"/g, '""')}"`,
      `"${(r.category || "").replace(/"/g, '""')}"`,
      `"${(r.institution || "").replace(/"/g, '""')}"`,
      `"${r.status === "CONFIRMED" ? "Confirmado" : r.status === "PENDING" ? "Pendente Pix" : r.status}"`,
      `"${r.checkedInAt ? "Sim" : "Nao"}"`,
      `"${r.checkedInAt ? new Date(r.checkedInAt).toLocaleString("pt-BR") : ""}"`,
      `"${new Date(r.createdAt).toLocaleString("pt-BR")}"`,
      `"${r.qrToken}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hands-on-${workshop.id}-inscritos.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportAllWorkshopsCsv() {
    const headers = [
      "Workshop ID",
      "Workshop Titulo",
      "Ministrante",
      "Data Workshop",
      "Horario",
      "Nome Participante",
      "E-mail",
      "CPF",
      "Telefone",
      "Categoria",
      "Instituicao",
      "Valor (R$)",
      "Status Pagamento",
      "Check-in Presenca",
      "Data Check-in",
      "Codigo Token",
    ];

    const rows = registrations.map((r) => [
      `"${r.handsOnId}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.speaker.replace(/"/g, '""')}"`,
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.email.replace(/"/g, '""')}"`,
      `"${r.document.replace(/"/g, '""')}"`,
      `"${(r.phone || "").replace(/"/g, '""')}"`,
      `"${(r.category || "").replace(/"/g, '""')}"`,
      `"${(r.institution || "").replace(/"/g, '""')}"`,
      `"${r.amount.toFixed(2)}"`,
      `"${r.status === "CONFIRMED" ? "Confirmado" : r.status === "PENDING" ? "Pendente Pix" : r.status}"`,
      `"${r.checkedInAt ? "Sim" : "Nao"}"`,
      `"${r.checkedInAt ? new Date(r.checkedInAt).toLocaleString("pt-BR") : ""}"`,
      `"${r.qrToken}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hands-on-copol-todos-inscritos.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (loading && registrations.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p className="muted">Carregando dados dos Hands On...</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {error && (
        <div
          className="card"
          style={{
            padding: 14,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* ============================================================== */}
      {/* VISTA DETALHADA DE UM WORKSHOP ESPECÍFICO                      */}
      {/* ============================================================== */}
      {selectedWorkshop ? (
        <div className="stack" style={{ gap: 18 }}>
          {/* Barra de Navegação de Volta */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedWorkshopId(null);
                setParticipantSearch("");
                setStatusFilter("ALL");
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              &larr; Voltar para Todos os Hands On
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportWorkshopCsv(selectedWorkshop, workshopRegistrations)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              📥 Exportar Lista deste Workshop (CSV)
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openManualModal(selectedWorkshop.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              ➕ Adicionar Inscrito Neste Workshop
            </button>
          </div>

          {/* Card Resumo do Workshop Selecionado */}
          <div
            className="card"
            style={{
              padding: 24,
              borderLeft: "4px solid var(--primary)",
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div style={{ flex: "1 1 300px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(59, 91, 255, 0.15)",
                      color: "var(--primary)",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedWorkshop.diaSemana} · {selectedWorkshop.horario}
                  </span>
                  <span
                    style={{
                      background: selectedWorkshop.preco === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: selectedWorkshop.preco === 0 ? "var(--success)" : "var(--warning)",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {selectedWorkshop.preco === 0 ? "Gratuito" : `R$ ${selectedWorkshop.preco.toFixed(2).replace(".", ",")}`}
                  </span>
                  {selectedWorkshop.patrocinio && (
                    <span
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        color: "var(--text-muted)",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                      }}
                    >
                      Patrocínio: <strong>{selectedWorkshop.patrocinio}</strong>
                    </span>
                  )}
                </div>

                <h2 style={{ margin: "4px 0 6px", fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
                  {selectedWorkshop.titulo}
                </h2>
                <p style={{ margin: "0 0 10px", fontSize: 15, color: "var(--primary)", fontWeight: 600 }}>
                  Ministrante: {selectedWorkshop.ministrante}
                </p>

                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  📍 <strong>Local:</strong> {selectedWorkshop.local}
                </p>
              </div>

              {/* Indicadores de Vagas e Presença */}
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  background: "var(--surface-alt)",
                  padding: "14px 20px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Total Inscritos
                  </span>
                  <strong style={{ fontSize: 22, color: "var(--text)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.total ?? 0}
                  </strong>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                    de {selectedWorkshop.vagas} vagas
                  </span>
                </div>

                <div style={{ width: 1, height: 36, background: "var(--border)" }} />

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Confirmados
                  </span>
                  <strong style={{ fontSize: 22, color: "var(--success)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.confirmed ?? 0}
                  </strong>
                </div>

                <div style={{ width: 1, height: 36, background: "var(--border)" }} />

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Pendentes Pix
                  </span>
                  <strong style={{ fontSize: 22, color: "var(--warning)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.pending ?? 0}
                  </strong>
                </div>

                <div style={{ width: 1, height: 36, background: "var(--border)" }} />

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Check-in (Presentes)
                  </span>
                  <strong style={{ fontSize: 22, color: "var(--primary)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.checkedIn ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros e Busca de Participantes */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: "1 1 300px" }}>
              <input
                type="text"
                placeholder="Buscar por Nome, E-mail, CPF ou Telefone..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 380, padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
              >
                <option value="ALL">Todos os status</option>
                <option value="CONFIRMED">Apenas Confirmados</option>
                <option value="PENDING">Apenas Pendentes Pix</option>
              </select>
            </div>

            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Exibindo <strong>{workshopRegistrations.length}</strong> pessoas inscritas
            </span>
          </div>

          {/* Tabela de Inscritos no Workshop */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", width: 45 }}>#</th>
                  <th style={{ padding: "12px 16px" }}>Nome do Participante</th>
                  <th style={{ padding: "12px 16px" }}>E-mail</th>
                  <th style={{ padding: "12px 16px" }}>CPF</th>
                  <th style={{ padding: "12px 16px" }}>Telefone</th>
                  <th style={{ padding: "12px 16px" }}>Status Pagamento</th>
                  <th style={{ padding: "12px 16px" }}>Check-in</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {workshopRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                      Nenhuma pessoa inscrita encontrada para os critérios selecionados.
                    </td>
                  </tr>
                ) : (
                  workshopRegistrations.map((r, index) => {
                    const isCheckedIn = !!r.checkedInAt;
                    const isConfirmed = r.status === "CONFIRMED";
                    const isPending = r.status === "PENDING";
                    const isProcessing = processingId === r.id;

                    const cleanPhone = (r.phone || "").replace(/\D/g, "");
                    const whatsappUrl = cleanPhone
                      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                          `Olá ${r.name}, confirmamos seu contato referente ao Hands On ${selectedWorkshop.titulo} no 3º COPOL.`
                        )}`
                      : null;

                    return (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: index % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                        }}
                      >
                        <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{index + 1}</td>

                        {/* Nome */}
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ display: "block", color: "var(--text)", fontSize: 14 }}>{r.name}</strong>
                          {(r.category || r.institution) && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {[r.category, r.institution].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </td>

                        {/* E-mail */}
                        <td style={{ padding: "12px 16px" }}>
                          <a
                            href={`mailto:${r.email}`}
                            style={{ color: "var(--text-muted)", textDecoration: "none" }}
                            title={`Enviar e-mail para ${r.email}`}
                          >
                            {r.email}
                          </a>
                        </td>

                        {/* CPF */}
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 13, color: "var(--text)" }}>
                          {r.document}
                        </td>

                        {/* Telefone */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {r.phone ? (
                            whatsappUrl ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "var(--success)",
                                  textDecoration: "none",
                                  fontWeight: 500,
                                }}
                                title="Abrir conversa no WhatsApp"
                              >
                                💬 {r.phone}
                              </a>
                            ) : (
                              <span>{r.phone}</span>
                            )
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>

                        {/* Status Pagamento */}
                        <td style={{ padding: "12px 16px" }}>
                          {isConfirmed ? (
                            <span
                              style={{
                                background: "rgba(34, 197, 94, 0.15)",
                                color: "var(--success)",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ✓ Confirmado
                            </span>
                          ) : isPending ? (
                            <span
                              style={{
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "var(--warning)",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              ⏳ Pendente Pix
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "var(--danger)",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {r.status}
                            </span>
                          )}
                        </td>

                        {/* Presença / Check-in */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {isCheckedIn ? (
                            <div>
                              <span
                                style={{
                                  background: "rgba(59, 91, 255, 0.15)",
                                  color: "var(--primary)",
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                ✓ Presente
                              </span>
                              <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                                {new Date(r.checkedInAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            {isPending && (
                              <button
                                type="button"
                                className="btn btn-sm"
                                disabled={isProcessing}
                                onClick={() => handleConfirmPayment(r.id)}
                                style={{
                                  background: "var(--success)",
                                  color: "#ffffff",
                                  fontSize: 11,
                                  padding: "4px 8px",
                                }}
                                title="Confirmar pagamento Pix desta inscrição"
                              >
                                Confirmar Pix
                              </button>
                            )}

                            {!isCheckedIn && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={isProcessing}
                                onClick={() => handleCheckIn(r.id)}
                                style={{ fontSize: 11, padding: "4px 8px" }}
                                title="Registrar presença na porta do workshop"
                              >
                                Fazer Check-in
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={isProcessing}
                              onClick={() => handleDeleteRegistration(r)}
                              style={{
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#ef4444",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                                fontSize: 11,
                                padding: "4px 8px",
                              }}
                              title="Excluir este inscrito definitivamente do Hands On"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* CATÁLOGO GERAL DOS WORKSHOPS HANDS ON                         */
        /* ============================================================== */
        <div className="stack" style={{ gap: 20 }}>
          {/* Cabeçalho Geral & KPI Cards */}
          <div
            className="card"
            style={{
              padding: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              background: "var(--surface)",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(59, 91, 255, 0.15)",
                  color: "var(--primary)",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                <span>🧪</span> COPOL 2026 · Vagas e Credenciamento
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Workshops Hands On</h1>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
                Gerencie todos os 12 workshops, acompanhe as vagas em tempo real, confirme pagamentos Pix e audite a lista de inscritos.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {/* Controle de Liberação no Site */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: handsOnOpen ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  border: `1px solid ${handsOnOpen ? "rgba(34, 197, 94, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: handsOnOpen ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {handsOnOpen ? "🟢 Inscrições ABERTAS no Site" : "🔴 Inscrições FECHADAS / PAUSADAS"}
                </span>

                <button
                  type="button"
                  className={handsOnOpen ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
                  disabled={togglingOpen}
                  onClick={handleToggleOpen}
                  style={{ fontSize: 11, padding: "3px 8px" }}
                >
                  {togglingOpen
                    ? "Salvando…"
                    : handsOnOpen
                    ? "🔒 Fechar / Pausar"
                    : "🔓 Liberar no Site"}
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openManualModal()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                ➕ Novo Inscrito Manual
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadData}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                🔄 Atualizar
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={exportAllWorkshopsCsv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                📥 Exportar CSV
              </button>

              {registrations.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleDeleteAllRegistrations}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "#ef4444",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                  }}
                  title="Excluir manualmente todas as inscrições dos Hands On"
                >
                  🗑️ Excluir Todos ({registrations.length})
                </button>
              )}
            </div>
          </div>

          {/* Painel de Métricas Rápidas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
            }}
          >
            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Total de Inscrições
              </span>
              <strong style={{ fontSize: 28, color: "var(--text)" }}>{totalInscritosGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                em todos os 12 workshops
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Vagas Confirmadas
              </span>
              <strong style={{ fontSize: 28, color: "var(--success)" }}>{totalConfirmadosGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                pagamentos confirmados
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Pendentes via Pix
              </span>
              <strong style={{ fontSize: 28, color: "var(--warning)" }}>{totalPendentesGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                aguardando comprovante
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Presenças na Sala
              </span>
              <strong style={{ fontSize: 28, color: "var(--primary)" }}>{totalPresentesGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                check-ins efetuados
              </span>
            </div>
          </div>

          {/* Filtros por Dia e Busca */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${diaFilter === "todos" ? "" : "btn-secondary"}`}
                onClick={() => setDiaFilter("todos")}
              >
                Todos os Dias (12)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${diaFilter === "quinta" ? "" : "btn-secondary"}`}
                onClick={() => setDiaFilter("quinta")}
              >
                Quinta-feira · 05/11 (6)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${diaFilter === "sexta" ? "" : "btn-secondary"}`}
                onClick={() => setDiaFilter("sexta")}
              >
                Sexta-feira · 06/11 (6)
              </button>
            </div>

            <input
              type="text"
              placeholder="Filtrar por título ou ministrante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", maxWidth: 320, padding: "8px 12px", borderRadius: 6, fontSize: 13 }}
            />
          </div>

          {/* Grid dos Cards de Workshops */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {filteredWorkshops.map((w) => {
              const wsStats = statsByWorkshop[w.id] ?? { total: 0, confirmed: 0, pending: 0, checkedIn: 0 };
              const percentConfirmed = Math.min(100, Math.round((wsStats.confirmed / w.vagas) * 100));
              const isFull = wsStats.confirmed >= w.vagas;

              return (
                <div
                  key={w.id}
                  className="card"
                  onClick={() => setSelectedWorkshopId(w.id)}
                  style={{
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 14,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    border: isFull ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isFull ? "rgba(239, 68, 68, 0.4)" : "var(--border)";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div>
                    {/* Header do Card */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span
                        style={{
                          background: "var(--surface-alt)",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {w.diaSemana} · {w.horario}
                      </span>

                      <span
                        style={{
                          background: w.preco === 0 ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: w.preco === 0 ? "var(--success)" : "var(--warning)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {w.preco === 0 ? "Gratuito" : `R$ ${w.preco.toFixed(2).replace(".", ",")}`}
                      </span>
                    </div>

                    {/* Título & Ministrante */}
                    <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>
                      {w.titulo}
                    </h3>
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                      {w.ministrante}
                    </p>

                    {w.patrocinio && (
                      <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--text-muted)" }}>
                        Patrocínio: <strong style={{ color: "var(--text)" }}>{w.patrocinio}</strong>
                      </p>
                    )}

                    <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
                      📍 {w.local}
                    </p>
                  </div>

                  <div>
                    {/* Barra de Ocupação de Vagas */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          Ocupação ({wsStats.confirmed} de {w.vagas} vagas)
                        </span>
                        <strong style={{ color: isFull ? "var(--danger)" : "var(--text)" }}>
                          {isFull ? "Esgotado" : `${w.vagas - wsStats.confirmed} restantes`}
                        </strong>
                      </div>

                      <div
                        style={{
                          width: "100%",
                          height: 6,
                          borderRadius: 3,
                          background: "var(--surface-alt)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentConfirmed}%`,
                            height: "100%",
                            background: isFull ? "var(--danger)" : percentConfirmed > 70 ? "var(--warning)" : "var(--success)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Badges de Contagem */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: 10,
                        borderTop: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ color: "var(--text-muted)" }}>
                          Total: <strong style={{ color: "var(--text)" }}>{wsStats.total}</strong>
                        </span>
                        {wsStats.pending > 0 && (
                          <span style={{ color: "var(--warning)" }}>
                            ({wsStats.pending} pendente)
                          </span>
                        )}
                      </div>

                      <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: 12 }}>
                        Ver Inscritos &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Inscrição Manual */}
      {isManualModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 540,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              border: "1px solid var(--border)",
              boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                ➕ Adicionar Inscrito no Hands On
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                &times;
              </button>
            </div>

            {manualError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {manualError}
              </div>
            )}

            <form onSubmit={handleSaveManual} className="stack" style={{ gap: 12 }}>
              <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                <span>Workshop Hands On *</span>
                <select
                  value={manualWorkshopId}
                  onChange={(e) => setManualWorkshopId(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  required
                >
                  <optgroup label="Quinta-feira (05/11)">
                    {WORKSHOPS_CATALOG.filter((w) => w.diaId === "quinta").map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.titulo} — {w.ministrante} (R$ {w.preco})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sexta-feira (06/11)">
                    {WORKSHOPS_CATALOG.filter((w) => w.diaId === "sexta").map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.titulo} — {w.ministrante} (R$ {w.preco})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                <span>Nome Completo do Participante *</span>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  required
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>E-mail *</span>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                    required
                  />
                </label>

                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>CPF (apenas números) *</span>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={manualDocument}
                    onChange={(e) => setManualDocument(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                    required
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>Telefone / WhatsApp</span>
                  <input
                    type="tel"
                    placeholder="(43) 99999-9999"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  />
                </label>

                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>Categoria</span>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="Estudante">Estudante de Graduação</option>
                    <option value="Profissional">Cirurgião-Dentista / Profissional</option>
                    <option value="Pós-Graduando">Pós-Graduando / Especializando</option>
                    <option value="Docente">Docente / Palestrante</option>
                    <option value="Cortesia / VIP">Cortesia / VIP / Patrocinador</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>Faculdade / Instituição</span>
                  <input
                    type="text"
                    placeholder="Ex: Universidade Positivo / UEL"
                    value={manualInstitution}
                    onChange={(e) => setManualInstitution(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  />
                </label>

                <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                  <span>Status da Inscrição *</span>
                  <select
                    value={manualStatus}
                    onChange={(e) => setManualStatus(e.target.value as any)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="CONFIRMED">✓ Confirmado (Vaga Garantida)</option>
                    <option value="PENDING">⏳ Pendente</option>
                  </select>
                </label>
              </div>

              <label className="stack" style={{ gap: 4, fontSize: 12, fontWeight: 600 }}>
                <span>Observações Internas (opcional)</span>
                <input
                  type="text"
                  placeholder="Ex: Pago em dinheiro / Cortesia comissão"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsManualModalOpen(false)}
                  disabled={savingManual}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingManual}
                >
                  {savingManual ? "Salvando…" : "Salvar Inscrição"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
