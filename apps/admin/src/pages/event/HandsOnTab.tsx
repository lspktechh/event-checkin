import { useEffect, useState, useMemo, useCallback } from "react";
import * as api from "../../api/client";
import { AlertIcon, ClockIcon, BanIcon, BoltIcon, CalendarIcon, CheckIcon, DotIcon, DownloadIcon, FlaskIcon, GradCapIcon, ListIcon, MailIcon, MapPinIcon, MessageIcon, PhoneIcon, PlusIcon, RefreshIcon, SearchIcon, TrashIcon, UserIcon, UsersIcon, WalletIcon } from "../../components/Icons";

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

export type ClassificationFilter = "ALL" | "CONFIRMED_OFFICIAL" | "PENDING" | "EXCEEDED";

export function getRegClassification(
  r: api.HandsOnRegistrationRecord,
  selloutMap: Record<string, any>
): "CONFIRMED_OFFICIAL" | "PENDING" | "EXCEEDED" {
  const targetId =
    r.handsOnId === "reabilitacao-resina-composta"
      ? "integrale-cirurgia-implante-protetico"
      : r.handsOnId;
  const sellout = selloutMap[targetId];
  const orderInfo = sellout?.confirmedOrderMap?.get(r.id);

  if (r.status === "CONFIRMED") {
    if (orderInfo?.isOver) return "EXCEEDED";
    return "CONFIRMED_OFFICIAL";
  }

  if (r.status === "PENDING") {
    if (sellout?.isFull) return "EXCEEDED";
    return "PENDING";
  }

  return "EXCEEDED";
}

export function HandsOnTab({ eventId }: { eventId: string }) {
  const [registrations, setRegistrations] = useState<api.HandsOnRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string | null>(null);
  const [diaFilter, setDiaFilter] = useState<"todos" | "quinta" | "sexta">("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>("ALL");
  const [viewMode, setViewMode] = useState<"WORKSHOPS" | "ALL_PARTICIPANTS">("WORKSHOPS");
  const [allParticipantsWorkshopFilter, setAllParticipantsWorkshopFilter] = useState<string>("ALL");
  const [syncingSoldOut, setSyncingSoldOut] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Capacidades dinâmicas por workshop
  const [capacities, setCapacities] = useState<Record<string, number>>({});

  // Modal de Alteração de Vagas
  const [capacityModalWorkshop, setCapacityModalWorkshop] = useState<WorkshopDef | null>(null);
  const [capacityInput, setCapacityInput] = useState<number>(12);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [capacitySuccess, setCapacitySuccess] = useState<string | null>(null);

  const openCapacityModal = (w: WorkshopDef) => {
    const current = capacities[w.id] ?? w.vagas;
    setCapacityModalWorkshop(w);
    setCapacityInput(current);
    setCapacityError(null);
    setCapacitySuccess(null);
  };

  const handleSaveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!capacityModalWorkshop) return;
    if (!capacityInput || capacityInput < 1) {
      setCapacityError("A capacidade de vagas deve ser um número maior que zero.");
      return;
    }
    try {
      setSavingCapacity(true);
      setCapacityError(null);
      const res = await api.updateHandsOnCapacity(eventId, capacityModalWorkshop.id, capacityInput);
      setCapacities(res.allCapacities);
      setCapacitySuccess(`Vagas do workshop atualizadas para ${capacityInput} com sucesso!`);
      setTimeout(() => {
        setCapacityModalWorkshop(null);
        setCapacitySuccess(null);
        loadData();
      }, 900);
    } catch (err) {
      setCapacityError(err instanceof Error ? err.message : "Erro ao atualizar capacidade de vagas");
    } finally {
      setSavingCapacity(false);
    }
  };

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
  // Cortesia: vaga garantida, valor zero — não entra na receita.
  const [manualExempt, setManualExempt] = useState(false);
  const [manualNotes, setManualNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, settings] = await Promise.all([
        api.listHandsOnRegistrations(eventId),
        api.getHandsOnSettings(eventId).catch(() => ({ open: false, capacities: {} })),
      ]);
      setRegistrations(data);
      setHandsOnOpen(settings.open);
      if (settings.capacities) {
        setCapacities(settings.capacities);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar inscrições de Hands On");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Atualização em tempo real via eventos do monitor SSE
  useEffect(() => {
    const handleRealtimeUpdate = () => {
      loadData();
    };
    window.addEventListener("event-realtime-update", handleRealtimeUpdate);
    return () => {
      window.removeEventListener("event-realtime-update", handleRealtimeUpdate);
    };
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

  // Mapa de informações de esgotamento e ordem de confirmação por workshop
  const workshopSelloutData = useMemo(() => {
    const map: Record<
      string,
      {
        isFull: boolean;
        confirmedCount: number;
        maxVagas: number;
        overCapacityCount: number;
        soldOutAt: Date | null;
        soldOutTimeStr: string | null;
        soldOutDateStr: string | null;
        nthParticipant: api.HandsOnRegistrationRecord | null;
        confirmedOrderMap: Map<string, { rank: number; isOver: boolean }>;
      }
    > = {};

    for (const def of WORKSHOPS_CATALOG) {
      const maxVagas = capacities[def.id] ?? def.vagas;

      const confirmed = registrations
        .filter((r) => {
          const targetId =
            r.handsOnId === "reabilitacao-resina-composta"
              ? "integrale-cirurgia-implante-protetico"
              : r.handsOnId;
          return targetId === def.id && r.status === "CONFIRMED";
        })
        .sort((a, b) => {
          const tA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime();
          const tB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime();
          return tA - tB;
        });

      const confirmedOrderMap = new Map<string, { rank: number; isOver: boolean }>();
      confirmed.forEach((r, idx) => {
        confirmedOrderMap.set(r.id, {
          rank: idx + 1,
          isOver: idx >= maxVagas,
        });
      });

      const isFull = confirmed.length >= maxVagas;
      const nth = isFull && maxVagas > 0 ? confirmed[maxVagas - 1] : null;
      let soldOutAt: Date | null = null;
      let soldOutTimeStr: string | null = null;
      let soldOutDateStr: string | null = null;

      if (nth) {
        soldOutAt = nth.paidAt ? new Date(nth.paidAt) : new Date(nth.createdAt);
        soldOutTimeStr = soldOutAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        soldOutDateStr = soldOutAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      }

      map[def.id] = {
        isFull,
        confirmedCount: confirmed.length,
        maxVagas,
        overCapacityCount: Math.max(0, confirmed.length - maxVagas),
        soldOutAt,
        soldOutTimeStr,
        soldOutDateStr,
        nthParticipant: nth,
        confirmedOrderMap,
      };
    }

    return map;
  }, [registrations, capacities]);

  const totalInscritosGlobal = registrations.length;
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

  const selectedWorkshopVagas = useMemo(() => {
    if (!selectedWorkshop) return 0;
    return capacities[selectedWorkshop.id] ?? selectedWorkshop.vagas;
  }, [selectedWorkshop, capacities]);

  const selectedWorkshopSellout = useMemo(() => {
    if (!selectedWorkshopId) return null;
    return workshopSelloutData[selectedWorkshopId] ?? null;
  }, [selectedWorkshopId, workshopSelloutData]);

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
        if (classificationFilter !== "ALL") {
          const cat = getRegClassification(r, workshopSelloutData);
          if (cat !== classificationFilter) return false;
        }
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
  }, [registrations, selectedWorkshopId, classificationFilter, participantSearch, workshopSelloutData]);

  const selectedWorkshopCounts = useMemo(() => {
    if (!selectedWorkshopId) return { official: 0, pending: 0, exceeded: 0, total: 0 };
    const list = registrations.filter((r) => {
      const targetId =
        r.handsOnId === "reabilitacao-resina-composta"
          ? "integrale-cirurgia-implante-protetico"
          : r.handsOnId;
      return targetId === selectedWorkshopId;
    });

    let official = 0;
    let pending = 0;
    let exceeded = 0;

    for (const r of list) {
      const cat = getRegClassification(r, workshopSelloutData);
      if (cat === "CONFIRMED_OFFICIAL") official++;
      else if (cat === "PENDING") pending++;
      else if (cat === "EXCEEDED") exceeded++;
    }

    return { official, pending, exceeded, total: list.length };
  }, [registrations, selectedWorkshopId, workshopSelloutData]);

  const allFilteredParticipants = useMemo(() => {
    return registrations
      .filter((r) => {
        if (allParticipantsWorkshopFilter !== "ALL") {
          const targetId =
            r.handsOnId === "reabilitacao-resina-composta"
              ? "integrale-cirurgia-implante-protetico"
              : r.handsOnId;
          if (targetId !== allParticipantsWorkshopFilter) return false;
        }
        if (classificationFilter !== "ALL") {
          const cat = getRegClassification(r, workshopSelloutData);
          if (cat !== classificationFilter) return false;
        }
        if (participantSearch.trim()) {
          const q = participantSearch.toLowerCase();
          const docClean = r.document.replace(/\D/g, "");
          const phoneClean = (r.phone || "").replace(/\D/g, "");
          return (
            r.name.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.document.includes(q) ||
            docClean.includes(q) ||
            (r.phone && r.phone.includes(q)) ||
            phoneClean.includes(q)
          );
        }
        return true;
      });
  }, [registrations, allParticipantsWorkshopFilter, classificationFilter, participantSearch, workshopSelloutData]);

  const searchedParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (q.length < 2) return [];

    const docClean = q.replace(/\D/g, "");
    const matchingRegs = registrations.filter((r) => {
      const rDocClean = r.document.replace(/\D/g, "");
      const rPhoneClean = (r.phone || "").replace(/\D/g, "");
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.document.includes(q) ||
        (docClean && rDocClean.includes(docClean)) ||
        (r.phone && r.phone.includes(q)) ||
        (docClean && rPhoneClean.includes(docClean))
      );
    });

    if (matchingRegs.length === 0) return [];

    const grouped = new Map<
      string,
      {
        name: string;
        document: string;
        email: string;
        phone?: string;
        items: api.HandsOnRegistrationRecord[];
      }
    >();

    for (const r of matchingRegs) {
      const key = r.document.replace(/\D/g, "") || r.email.toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, {
          name: r.name,
          document: r.document,
          email: r.email,
          phone: r.phone || undefined,
          items: [],
        });
      }
      grouped.get(key)!.items.push(r);
    }

    return Array.from(grouped.values());
  }, [registrations, participantSearch]);

  const globalCounts = useMemo(() => {
    let official = 0;
    let pending = 0;
    let exceeded = 0;

    for (const r of registrations) {
      const cat = getRegClassification(r, workshopSelloutData);
      if (cat === "CONFIRMED_OFFICIAL") official++;
      else if (cat === "PENDING") pending++;
      else if (cat === "EXCEEDED") exceeded++;
    }

    return { official, pending, exceeded, total: registrations.length };
  }, [registrations, workshopSelloutData]);

  async function handleSyncSoldOut() {
    if (
      !confirm(
        "Deseja verificar todos os workshops com vagas esgotadas e cancelar imediatamente todas as cobranças Pix pendentes no Mercado Pago?\n\nIsso impedirá que novos participantes consigam pagar Pix de vagas que já acabaram."
      )
    ) {
      return;
    }

    try {
      setSyncingSoldOut(true);
      const res = await api.syncHandsOnSoldOut(eventId);
      await loadData();
      if (res.cancelledTotal > 0) {
        alert(
          `Sincronização concluída com sucesso!\n\n${res.cancelledTotal} cobranças Pix pendentes de workshops esgotados foram canceladas no Mercado Pago.`
        );
      } else {
        alert("Nenhuma cobrança pendente precisava ser cancelada. Todos os workshops estão sincronizados!");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao sincronizar workshops esgotados");
    } finally {
      setSyncingSoldOut(false);
    }
  }

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
    setManualExempt(false);
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
        // Isento: valor zero, para não somar na receita do evento.
        amount: manualExempt ? 0 : workshop.preco,
        name: nomeTrim,
        email: emailTrim,
        document: docClean,
        phone: manualPhone.trim() || null,
        category: manualCategory || null,
        institution: manualInstitution.trim() || null,
        // Isento nunca fica pendente: não há pagamento a aguardar.
        status: manualExempt ? "CONFIRMED" : manualStatus,
        notes: manualExempt
          ? ["Isento (cortesia)", manualNotes.trim()].filter(Boolean).join(" · ")
          : manualNotes.trim() || null,
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
    const sellout = workshopSelloutData[workshop.id];
    const effectiveVagas = capacities[workshop.id] ?? workshop.vagas;
    const headers = [
      "Nome",
      "E-mail",
      "CPF",
      "Telefone",
      "Categoria",
      "Instituicao",
      "Status Pagamento",
      "Horario Pix Confirmado",
      "Situacao da Vaga",
      "Check-in Presenca",
      "Data Check-in",
      "Data Inscricao",
      "Codigo Inscrição",
    ];

    const rows = list.map((r) => {
      const orderInfo = sellout?.confirmedOrderMap.get(r.id);
      const isConfirmed = r.status === "CONFIRMED";
      const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
      const pixTimeStr = pixTime ? pixTime.toLocaleString("pt-BR") : "";
      const situacao = isConfirmed
        ? orderInfo?.isOver
          ? `Excedente apos esgotar (${orderInfo.rank}º/${effectiveVagas})`
          : `Dentro das vagas (${orderInfo?.rank || 1}º/${effectiveVagas})`
        : "Aguardando Pagamento";

      return [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.email.replace(/"/g, '""')}"`,
        `"${r.document.replace(/"/g, '""')}"`,
        `"${(r.phone || "").replace(/"/g, '""')}"`,
        `"${(r.category || "").replace(/"/g, '""')}"`,
        `"${(r.institution || "").replace(/"/g, '""')}"`,
        `"${isConfirmed ? "Confirmado" : r.status === "PENDING" ? "Pendente Pix" : r.status}"`,
        `"${pixTimeStr}"`,
        `"${situacao}"`,
        `"${r.checkedInAt ? "Sim" : "Nao"}"`,
        `"${r.checkedInAt ? new Date(r.checkedInAt).toLocaleString("pt-BR") : ""}"`,
        `"${new Date(r.createdAt).toLocaleString("pt-BR")}"`,
        `"${r.qrToken}"`,
      ];
    });

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

  function renderSearchedParticipantsPanel() {
    if (searchedParticipants.length === 0) return null;

    return (
      <div
        className="card"
        style={{
          padding: 18,
          borderRadius: 12,
          background: "rgba(59, 91, 255, 0.05)",
          border: "1.5px solid var(--primary)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}><SearchIcon size="1.1em" /></span>
            <strong style={{ fontSize: 15, color: "var(--text)" }}>
              Inscrições Localizadas para a Busca: &ldquo;{participantSearch}&rdquo;
            </strong>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {searchedParticipants.length} participante(s) encontrado(s)
          </span>
        </div>

        {searchedParticipants.map((p) => {
          const confirmedCount = p.items.filter((i) => i.status === "CONFIRMED").length;
          const pendingCount = p.items.filter((i) => i.status === "PENDING").length;

          return (
            <div
              key={p.document || p.email}
              style={{
                background: "var(--surface)",
                borderRadius: 10,
                border: "1px solid var(--border)",
                padding: 16,
              }}
            >
              {/* Cabeçalho do Participante */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 16, color: "var(--text)" }}>{p.name}</strong>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      CPF: {p.document}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    <span><MailIcon size="1.1em" /> {p.email}</span>
                    {p.phone && <span style={{ marginLeft: 10 }}><PhoneIcon size="1.1em" /> {p.phone}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "var(--success)",
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <CheckIcon size="1.1em" /> {confirmedCount} Confirmado(s)
                  </span>
                  {pendingCount > 0 && (
                    <span
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "var(--warning)",
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      <ClockIcon size="1.1em" /> {pendingCount} Pendente(s)
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Hands On deste participante */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {p.items.map((item) => {
                  const isConfirmed = item.status === "CONFIRMED";
                  const isPending = item.status === "PENDING";
                  const isProcessing = processingId === item.id;

                  const targetId =
                    item.handsOnId === "reabilitacao-resina-composta"
                      ? "integrale-cirurgia-implante-protetico"
                      : item.handsOnId;
                  const wsDef = WORKSHOPS_CATALOG.find((w) => w.id === targetId);
                  const sellout = wsDef ? workshopSelloutData[wsDef.id] : null;
                  const orderInfo = sellout?.confirmedOrderMap.get(item.id);
                  const isOverCapacity = orderInfo ? orderInfo.isOver : false;
                  const maxV = wsDef ? (capacities[wsDef.id] ?? wsDef.vagas) : 12;

                  const pixTime = item.paidAt ? new Date(item.paidAt) : (isConfirmed ? new Date(item.createdAt) : null);
                  const pixTimeStr = pixTime
                    ? pixTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : null;
                  const pixDateStr = pixTime
                    ? pixTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                    : null;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: isConfirmed ? "rgba(34, 197, 94, 0.05)" : "rgba(245, 158, 11, 0.05)",
                        border: isConfirmed ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      }}
                    >
                      <div style={{ flex: "1 1 280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                          <strong style={{ fontSize: 14, color: "var(--text)" }}>{item.title}</strong>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontWeight: 700,
                              background: isConfirmed
                                ? isOverCapacity
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "rgba(34, 197, 94, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                              color: isConfirmed
                                ? isOverCapacity
                                  ? "#ef4444"
                                  : "var(--success)"
                                : "var(--warning)",
                            }}
                          >
                            {isConfirmed
                              ? isOverCapacity
                                ? "Confirmado (Excedente)"
                                : "Pix Confirmado"
                              : "Pendente Pix"}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                          <span><UserIcon size="1.1em" /> {item.speaker}</span>
                          <span style={{ marginLeft: 8 }}><CalendarIcon size="1.1em" /> {item.date} ({item.time})</span>
                          <span style={{ marginLeft: 8 }}><WalletIcon size="1.1em" /> {Number(item.amount) === 0 ? "Isento" : `R$ ${Number(item.amount).toFixed(2).replace(".", ",")}`}</span>
                        </div>

                        {isConfirmed && pixTimeStr && (
                          <div style={{ fontSize: 11, color: isOverCapacity ? "#ef4444" : "var(--success)", fontWeight: 700, marginTop: 4 }}>
                            <BoltIcon size="1.1em" /> Confirmado em {pixDateStr} às {pixTimeStr} {orderInfo ? `(Vaga ${orderInfo.rank}/${maxV})` : ""}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {isPending && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            disabled={isProcessing}
                            onClick={() => handleConfirmPayment(item.id)}
                            style={{
                              background: "var(--success)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 12,
                              padding: "6px 14px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                            title="Confirmar pagamento Pix manualmente (remove automaticamente duplicatas pendentes)"
                          >
                            <CheckIcon size="1.1em" /> Confirmar Pix Manualmente
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedWorkshopId(targetId);
                          }}
                          style={{ fontSize: 11, padding: "5px 10px" }}
                        >
                          Ver Workshop &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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
      "Horario Pix Confirmado",
      "Situacao da Vaga",
      "Check-in Presenca",
      "Data Check-in",
      "Data Inscricao",
      "Codigo Token",
    ];

    const rows = registrations.map((r) => {
      const targetId =
        r.handsOnId === "reabilitacao-resina-composta"
          ? "integrale-cirurgia-implante-protetico"
          : r.handsOnId;
      const wsDef = WORKSHOPS_CATALOG.find((w) => w.id === targetId);
      const sellout = wsDef ? workshopSelloutData[wsDef.id] : null;
      const orderInfo = sellout?.confirmedOrderMap.get(r.id);
      const isConfirmed = r.status === "CONFIRMED";
      const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
      const pixTimeStr = pixTime ? pixTime.toLocaleString("pt-BR") : "";
      const maxV = wsDef ? (capacities[wsDef.id] ?? wsDef.vagas) : 12;
      const situacao = isConfirmed
        ? orderInfo?.isOver
          ? `Excedente apos esgotar (${orderInfo.rank}º/${maxV})`
          : `Dentro das vagas (${orderInfo?.rank || 1}º/${maxV})`
        : "Aguardando Pagamento";

      return [
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
        `"${isConfirmed ? "Confirmado" : r.status === "PENDING" ? "Pendente Pix" : r.status}"`,
        `"${pixTimeStr}"`,
        `"${situacao}"`,
        `"${r.checkedInAt ? "Sim" : "Nao"}"`,
        `"${r.checkedInAt ? new Date(r.checkedInAt).toLocaleString("pt-BR") : ""}"`,
        `"${new Date(r.createdAt).toLocaleString("pt-BR")}"`,
        `"${r.qrToken}"`,
      ];
    });

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
                setClassificationFilter("ALL");
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
              <DownloadIcon size="1.1em" /> Exportar Lista deste Workshop (CSV)
            </button>

            <button
              type="button"
              className="btn btn-sm"
              onClick={() => openCapacityModal(selectedWorkshop)}
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
                border: "none",
              }}
              title="Aumentar ou alterar número de vagas disponíveis deste workshop"
            >
              <span><BoltIcon size="1.1em" /></span> Aumentar / Alterar Vagas ({selectedWorkshopVagas})
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openManualModal(selectedWorkshop.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <PlusIcon size="1.1em" /> Adicionar Inscrito Neste Workshop
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
                  <MapPinIcon size="1.1em" /> <strong>Local:</strong> {selectedWorkshop.local}
                </p>
              </div>

              {/* Indicadores de Vagas e Presença */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                  gap: 12,
                  alignItems: "center",
                  background: "var(--surface-alt)",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  width: "100%",
                  maxWidth: 520,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Total Inscritos
                  </span>
                  <strong style={{ fontSize: 20, color: "var(--text)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.total ?? 0}
                  </strong>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                    de {selectedWorkshopVagas} vagas
                  </span>
                  <button
                    type="button"
                    onClick={() => openCapacityModal(selectedWorkshop)}
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "var(--success)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                    title="Aumentar ou ajustar vagas deste workshop"
                  >
                    <span><BoltIcon size="1.1em" /></span> Alterar Vagas
                  </button>
                </div>

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Confirmados
                  </span>
                  <strong style={{ fontSize: 20, color: "var(--success)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.confirmed ?? 0}
                  </strong>
                </div>

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Pendentes Pix
                  </span>
                  <strong style={{ fontSize: 20, color: "var(--warning)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.pending ?? 0}
                  </strong>
                </div>

                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", display: "block" }}>
                    Check-in (Presentes)
                  </span>
                  <strong style={{ fontSize: 20, color: "var(--primary)" }}>
                    {statsByWorkshop[selectedWorkshop.id]?.checkedIn ?? 0}
                  </strong>
                </div>
              </div>
            </div>

            {/* Alerta de Esgotamento de Vagas com Horário */}
            {selectedWorkshopSellout && selectedWorkshopSellout.isFull && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 18px",
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}><AlertIcon size="1.1em" /></span>
                  <div>
                    <strong style={{ color: "var(--danger)", fontSize: 14, display: "block" }}>
                      Vagas oficiais deste Hands On ESGOTADAS às {selectedWorkshopSellout.soldOutTimeStr} ({selectedWorkshopSellout.soldOutDateStr})
                    </strong>
                    <span style={{ color: "var(--text)", fontSize: 12 }}>
                      A última vaga oficial ({selectedWorkshopVagas}ª vaga) foi preenchida por{" "}
                      <strong>{selectedWorkshopSellout.nthParticipant?.name || "Participante"}</strong>.
                      {selectedWorkshopSellout.overCapacityCount > 0 && (
                        <span style={{ color: "var(--warning)", fontWeight: 700 }}>
                          {" "}· Existem {selectedWorkshopSellout.overCapacityCount} inscrições que confirmaram Pix após as vagas terem esgotado.
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {selectedWorkshopSellout.overCapacityCount > 0 && (
                  <span
                    style={{
                      background: "rgba(245, 158, 11, 0.2)",
                      color: "var(--warning)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    +{selectedWorkshopSellout.overCapacityCount} Excedente(s) após esgotar
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Filtros e Segmentação dos Inscritos no Workshop */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {/* Segmented Filter Buttons */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setClassificationFilter("CONFIRMED_OFFICIAL")}
                  className={`btn btn-sm ${classificationFilter === "CONFIRMED_OFFICIAL" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "CONFIRMED_OFFICIAL" ? "var(--success)" : undefined,
                    borderColor: classificationFilter === "CONFIRMED_OFFICIAL" ? "var(--success)" : undefined,
                    color: classificationFilter === "CONFIRMED_OFFICIAL" ? "#fff" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--success)" /></span> Confirmados Oficiais ({selectedWorkshopCounts.official}/{selectedWorkshopVagas})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("PENDING")}
                  className={`btn btn-sm ${classificationFilter === "PENDING" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "PENDING" ? "var(--warning)" : undefined,
                    borderColor: classificationFilter === "PENDING" ? "var(--warning)" : undefined,
                    color: classificationFilter === "PENDING" ? "#000" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--warning)" /></span> Pendentes Pix ({selectedWorkshopCounts.pending})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("EXCEEDED")}
                  className={`btn btn-sm ${classificationFilter === "EXCEEDED" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "EXCEEDED" ? "#ef4444" : undefined,
                    borderColor: classificationFilter === "EXCEEDED" ? "#ef4444" : undefined,
                    color: classificationFilter === "EXCEEDED" ? "#fff" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--danger)" /></span> Além do Limite ({selectedWorkshopCounts.exceeded})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("ALL")}
                  className={`btn btn-sm ${classificationFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                >
                  <span><ListIcon size="1.1em" /></span> Todos ({selectedWorkshopCounts.total})
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar por Nome, CPF, E-mail..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                style={{ width: "100%", maxWidth: 300, padding: "7px 12px", borderRadius: 6, fontSize: 13 }}
              />
            </div>

            {classificationFilter === "EXCEEDED" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#ef4444",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span><AlertIcon size="1.1em" /></span>
                <span>
                  <strong>Além do Limite Permitido:</strong> Exibindo participantes que foram confirmados após o esgotamento das {selectedWorkshopVagas} vagas oficiais ou cadastros cancelados por esgotamento.
                </span>
              </div>
            )}
          </div>

          {/* Painel de Busca de Participantes */}
          {renderSearchedParticipantsPanel()}

          {/* Tabela Desktop de Inscritos no Workshop */}
          <div className="hands-on-desktop-table card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", width: 45 }}>#</th>
                    <th style={{ padding: "10px 14px" }}>Participante & Contato</th>
                    <th style={{ padding: "10px 14px" }}>Status Pagamento & Vaga</th>
                    <th style={{ padding: "10px 14px", width: 110 }}>Check-in</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 180 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {workshopRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                        Nenhuma pessoa inscrita encontrada para os critérios selecionados.
                      </td>
                    </tr>
                  ) : (
                    workshopRegistrations.map((r, index) => {
                      const isCheckedIn = !!r.checkedInAt;
                      const isConfirmed = r.status === "CONFIRMED";
                      const isPending = r.status === "PENDING";
                      const isProcessing = processingId === r.id;

                      const orderInfo = selectedWorkshop
                        ? workshopSelloutData[selectedWorkshop.id]?.confirmedOrderMap.get(r.id)
                        : null;
                      const isOverCapacity = orderInfo ? orderInfo.isOver : false;
                      const confirmedRank = orderInfo ? orderInfo.rank : null;

                      const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
                      const pixTimeStr = pixTime
                        ? pixTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                        : null;
                      const pixDateStr = pixTime
                        ? pixTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                        : null;
                      const pixDateTimeFull = pixTime ? `${pixDateStr} às ${pixTimeStr}` : null;

                      const createdTimeStr = new Date(r.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

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
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", verticalAlign: "middle" }}>
                            {index + 1}
                          </td>

                          {/* Participante & Contato */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                              <strong style={{ color: "var(--text)", fontSize: 14 }}>{r.name}</strong>

                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(255, 255, 255, 0.06)",
                                  color: "var(--text-muted)",
                                  border: "1px solid var(--border)",
                                }}
                                title="CPF do participante"
                              >
                                CPF: {r.document}
                              </span>

                              {r.status === "CANCELLED" && (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "rgba(239, 68, 68, 0.15)",
                                    color: "#ef4444",
                                    border: "1px solid rgba(239, 68, 68, 0.4)",
                                  }}
                                  title={r.notes || "Inscrição cancelada (vagas esgotadas)"}
                                >
                                  <BanIcon size="1.1em" /> Cancelado (Vagas Esgotadas)
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <a
                                href={`mailto:${r.email}`}
                                style={{ color: "inherit", textDecoration: "none" }}
                                title={`Enviar e-mail para ${r.email}`}
                              >
                                <MailIcon size="1.1em" /> {r.email}
                              </a>
                              {r.phone && (
                                <>
                                  <span>·</span>
                                  {whatsappUrl ? (
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: "var(--success)", textDecoration: "none", fontWeight: 500 }}
                                      title="Conversar no WhatsApp"
                                    >
                                      <MessageIcon size="1.1em" /> {r.phone}
                                    </a>
                                  ) : (
                                    <span><PhoneIcon size="1.1em" /> {r.phone}</span>
                                  )}
                                </>
                              )}
                              {(r.category || r.institution) && (
                                <>
                                  <span>·</span>
                                  <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                    {[r.category, r.institution].filter(Boolean).join(" · ")}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Status Pagamento & Vaga */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                            {isConfirmed ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span
                                    style={{
                                      background: isOverCapacity ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                                      color: isOverCapacity ? "var(--warning)" : "var(--success)",
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    {isOverCapacity ? "Confirmado (Excedente)" : "Confirmado"}
                                  </span>

                                  {confirmedRank && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: isOverCapacity ? "rgba(245, 158, 11, 0.18)" : "rgba(34, 197, 94, 0.1)",
                                        color: isOverCapacity ? "var(--warning)" : "var(--success)",
                                        border: isOverCapacity ? "1px solid rgba(245, 158, 11, 0.4)" : "none",
                                      }}
                                    >
                                      {isOverCapacity ? `Excedente ${confirmedRank}º/${selectedWorkshopVagas}` : `Vaga ${confirmedRank}/${selectedWorkshopVagas}`}
                                    </span>
                                  )}
                                </div>

                                {pixDateTimeFull && (
                                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                    <BoltIcon size="1.1em" /> {pixDateTimeFull}
                                  </span>
                                )}
                              </div>
                            ) : isPending ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span
                                  style={{
                                    background: "rgba(245, 158, 11, 0.15)",
                                    color: "var(--warning)",
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    width: "fit-content",
                                  }}
                                >
                                  <ClockIcon size="1.1em" /> Pendente Pix
                                </span>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                  Criado às {createdTimeStr}
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "var(--danger)",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {r.status}
                              </span>
                            )}
                          </td>

                          {/* Check-in */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {isCheckedIn ? (
                              <div>
                                <span
                                  style={{
                                    background: "rgba(59, 91, 255, 0.15)",
                                    color: "var(--primary)",
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  <CheckIcon size="1.1em" /> Presente
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
                          <td style={{ padding: "10px 14px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
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
                                    fontWeight: 600,
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
                                  style={{ fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
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
                                  fontWeight: 600,
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

          {/* Cards Mobile de Inscritos no Workshop (Exibidos em Telas <= 768px) */}
          <div className="hands-on-mobile-cards">
            {workshopRegistrations.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Nenhuma pessoa inscrita encontrada para os critérios selecionados.
              </div>
            ) : (
              workshopRegistrations.map((r, index) => {
                const isCheckedIn = !!r.checkedInAt;
                const isConfirmed = r.status === "CONFIRMED";
                const isPending = r.status === "PENDING";
                const isProcessing = processingId === r.id;

                const orderInfo = selectedWorkshop
                  ? workshopSelloutData[selectedWorkshop.id]?.confirmedOrderMap.get(r.id)
                  : null;
                const isOverCapacity = orderInfo ? orderInfo.isOver : false;
                const confirmedRank = orderInfo ? orderInfo.rank : null;

                const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
                const pixTimeStr = pixTime
                  ? pixTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : null;
                const pixDateStr = pixTime
                  ? pixTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : null;
                const pixDateTimeFull = pixTime ? `${pixDateStr} às ${pixTimeStr}` : null;

                const cleanPhone = (r.phone || "").replace(/\D/g, "");
                const whatsappUrl = cleanPhone
                  ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                      `Olá ${r.name}, confirmamos seu contato referente ao Hands On ${selectedWorkshop.titulo} no 3º COPOL.`
                    )}`
                  : null;

                return (
                  <div
                    key={r.id}
                    className="card"
                    style={{
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      background: "var(--surface)",
                      border: isOverCapacity ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border)",
                      borderLeft: isConfirmed
                        ? isOverCapacity
                          ? "4px solid #ef4444"
                          : "4px solid var(--success)"
                        : isPending
                        ? "4px solid var(--warning)"
                        : "4px solid var(--danger)",
                    }}
                  >
                    {/* Top row: # + Nome + Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>#{index + 1}</span>
                        <strong style={{ fontSize: 15, color: "var(--text)" }}>{r.name}</strong>
                      </div>

                      <span
                        style={{
                          background: isConfirmed
                            ? isOverCapacity
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(34, 197, 94, 0.15)"
                            : isPending
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          color: isConfirmed
                            ? isOverCapacity
                              ? "var(--warning)"
                              : "var(--success)"
                            : isPending
                            ? "var(--warning)"
                            : "var(--danger)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {isConfirmed
                          ? isOverCapacity
                            ? "Confirmado (Excedente)"
                            : "Confirmado"
                          : isPending
                          ? "Pendente Pix"
                          : r.status}
                      </span>
                    </div>

                    {/* Linha de CPF, Vaga e Horário */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(255, 255, 255, 0.06)",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        CPF: {r.document}
                      </span>

                      {confirmedRank && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isOverCapacity ? "rgba(245, 158, 11, 0.18)" : "rgba(34, 197, 94, 0.1)",
                            color: isOverCapacity ? "var(--warning)" : "var(--success)",
                          }}
                        >
                          {isOverCapacity ? `Excedente ${confirmedRank}º/${selectedWorkshopVagas}` : `Vaga ${confirmedRank}/${selectedWorkshopVagas}`}
                        </span>
                      )}

                      {pixDateTimeFull && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          <BoltIcon size="1.1em" /> {pixDateTimeFull}
                        </span>
                      )}

                      {isCheckedIn && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(59, 91, 255, 0.15)",
                            color: "var(--primary)",
                          }}
                        >
                          <CheckIcon size="1.1em" /> Presente
                        </span>
                      )}
                    </div>

                    {/* Contato e Vínculo */}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <a href={`mailto:${r.email}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                          <MailIcon size="1.1em" /> {r.email}
                        </a>
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--success)", textDecoration: "none", fontWeight: 600 }}
                          >
                            <MessageIcon size="1.1em" /> WhatsApp ({r.phone})
                          </a>
                        )}
                      </div>
                      {(r.category || r.institution) && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          <GradCapIcon size="1.1em" /> {[r.category, r.institution].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>

                    {/* Botões de Ação no Mobile (Toque confortável) */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {isPending && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleConfirmPayment(r.id)}
                          style={{
                            flex: "1 1 140px",
                            background: "var(--success)",
                            color: "#ffffff",
                            fontWeight: 700,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                        >
                          <CheckIcon size="1.1em" /> Confirmar Pix
                        </button>
                      )}

                      {!isCheckedIn && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleCheckIn(r.id)}
                          style={{
                            flex: "1 1 120px",
                            fontWeight: 600,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
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
                          fontWeight: 600,
                          padding: "8px 12px",
                          fontSize: 12,
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
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
                <span><FlaskIcon size="1.1em" /></span> COPOL 2026 · Vagas e Credenciamento
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
                  {handsOnOpen ? "Inscrições ABERTAS no Site" : "Inscrições FECHADAS / PAUSADAS"}
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
                    ? "Fechar / Pausar"
                    : "Liberar no Site"}
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openManualModal()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <PlusIcon size="1.1em" /> Novo Inscrito Manual
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={loadData}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <RefreshIcon size="1.1em" /> Atualizar
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={exportAllWorkshopsCsv}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <DownloadIcon size="1.1em" /> Exportar CSV
              </button>

              <button
                type="button"
                className="btn btn-sm"
                disabled={syncingSoldOut}
                onClick={handleSyncSoldOut}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "var(--warning)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  fontWeight: 600,
                }}
                title="Cancela cobranças Pix pendentes no Mercado Pago para workshops que já atingiram o limite oficial de vagas"
              >
                <BoltIcon size="1.1em" /> {syncingSoldOut ? "Cancelando Pix…" : "Cancelar Pix Esgotados"}
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
                  <TrashIcon size="1.1em" /> Excluir Todos ({registrations.length})
                </button>
              )}
            </div>
          </div>

          {/* Painel de Métricas Rápidas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >
            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Total de Inscrições
              </span>
              <strong style={{ fontSize: 26, color: "var(--text)" }}>{totalInscritosGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                em todos os 12 workshops
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Vagas Oficiais
              </span>
              <strong style={{ fontSize: 26, color: "var(--success)" }}>{globalCounts.official}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                dentro do limite oficial
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Pendentes via Pix
              </span>
              <strong style={{ fontSize: 26, color: "var(--warning)" }}>{globalCounts.pending}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                aguardando pagamento
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px", borderLeft: globalCounts.exceeded > 0 ? "4px solid #ef4444" : undefined }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Além do Limite
              </span>
              <strong style={{ fontSize: 26, color: globalCounts.exceeded > 0 ? "#ef4444" : "var(--text-muted)" }}>
                {globalCounts.exceeded}
              </strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                excedentes / esgotados
              </span>
            </div>

            <div className="card" style={{ padding: "16px 20px" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                Presenças na Sala
              </span>
              <strong style={{ fontSize: 26, color: "var(--primary)" }}>{totalPresentesGlobal}</strong>
              <span style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
                check-ins efetuados
              </span>
            </div>
          </div>

          {/* Alternador de Visualização: Catálogo vs Lista Geral de Inscritos */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              background: "var(--surface)",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === "WORKSHOPS" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setViewMode("WORKSHOPS")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <span><FlaskIcon size="1.1em" /></span> Catálogo por Workshops (12)
              </button>

              <button
                type="button"
                className={`btn btn-sm ${viewMode === "ALL_PARTICIPANTS" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setViewMode("ALL_PARTICIPANTS")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
              >
                <span><UsersIcon size="1.1em" /></span> Auditoria de Todos os Inscritos ({totalInscritosGlobal})
              </button>
            </div>

            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {viewMode === "WORKSHOPS"
                ? "Clique em um workshop para gerenciar suas vagas individualmente"
                : "Visão consolidada para filtrar por Confirmados Oficiais, Pendentes e Excedentes"}
            </span>
          </div>

          {viewMode === "WORKSHOPS" ? (
            <>
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
              gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
              gap: 16,
            }}
          >
            {filteredWorkshops.map((w) => {
              const effectiveVagas = capacities[w.id] ?? w.vagas;
              const wsStats = statsByWorkshop[w.id] ?? { total: 0, confirmed: 0, pending: 0, checkedIn: 0 };
              const percentConfirmed = Math.min(100, Math.round((wsStats.confirmed / effectiveVagas) * 100));
              const sellout = workshopSelloutData[w.id];
              const isFull = sellout ? sellout.isFull : wsStats.confirmed >= effectiveVagas;

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
                      <MapPinIcon size="1.1em" /> {w.local}
                    </p>
                  </div>

                  <div>
                    {/* Barra de Ocupação de Vagas */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "var(--text-muted)" }}>
                            Ocupação ({wsStats.confirmed} de {effectiveVagas} vagas)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCapacityModal(w);
                            }}
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.35)",
                              color: "var(--success)",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 4,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                            title="Aumentar ou ajustar vagas deste workshop"
                          >
                            <span><BoltIcon size="1.1em" /></span> Vagas ({effectiveVagas})
                          </button>
                        </div>
                        <strong style={{ color: isFull ? "var(--danger)" : "var(--text)" }}>
                          {isFull ? "Esgotado" : `${effectiveVagas - wsStats.confirmed} restantes`}
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

                      {/* Alerta de Horário de Esgotamento */}
                      {sellout && sellout.isFull && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "rgba(239, 68, 68, 0.12)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "var(--danger)",
                            fontSize: 11,
                            fontWeight: 600,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span><AlertIcon size="1.1em" /> Esgotou às {sellout.soldOutTimeStr}</span>
                          {sellout.overCapacityCount > 0 && (
                            <span style={{ color: "var(--warning)", fontWeight: 700 }}>
                              +{sellout.overCapacityCount} excedente(s)
                            </span>
                          )}
                        </div>
                      )}
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
        </>
      ) : (
        /* ============================================================== */
        /* AUDITORIA GERAL DE TODOS OS INSCRITOS                           */
        /* ============================================================== */
        <div className="stack" style={{ gap: 16 }}>
          {/* Barra de Filtros e Segmentação */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {/* Segmented Filter Buttons */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setClassificationFilter("CONFIRMED_OFFICIAL")}
                  className={`btn btn-sm ${classificationFilter === "CONFIRMED_OFFICIAL" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "CONFIRMED_OFFICIAL" ? "var(--success)" : undefined,
                    borderColor: classificationFilter === "CONFIRMED_OFFICIAL" ? "var(--success)" : undefined,
                    color: classificationFilter === "CONFIRMED_OFFICIAL" ? "#fff" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--success)" /></span> Confirmados Oficiais ({globalCounts.official})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("PENDING")}
                  className={`btn btn-sm ${classificationFilter === "PENDING" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "PENDING" ? "var(--warning)" : undefined,
                    borderColor: classificationFilter === "PENDING" ? "var(--warning)" : undefined,
                    color: classificationFilter === "PENDING" ? "#000" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--warning)" /></span> Pendentes Pix ({globalCounts.pending})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("EXCEEDED")}
                  className={`btn btn-sm ${classificationFilter === "EXCEEDED" ? "btn-primary" : "btn-secondary"}`}
                  style={{
                    background: classificationFilter === "EXCEEDED" ? "#ef4444" : undefined,
                    borderColor: classificationFilter === "EXCEEDED" ? "#ef4444" : undefined,
                    color: classificationFilter === "EXCEEDED" ? "#fff" : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  <span><DotIcon size="0.7em" color="var(--danger)" /></span> Além do Limite ({globalCounts.exceeded})
                </button>

                <button
                  type="button"
                  onClick={() => setClassificationFilter("ALL")}
                  className={`btn btn-sm ${classificationFilter === "ALL" ? "btn-primary" : "btn-secondary"}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}
                >
                  <span><ListIcon size="1.1em" /></span> Todos ({globalCounts.total})
                </button>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={allParticipantsWorkshopFilter}
                  onChange={(e) => setAllParticipantsWorkshopFilter(e.target.value)}
                  style={{ padding: "7px 10px", borderRadius: 6, fontSize: 13 }}
                >
                  <option value="ALL">Todos os 12 Workshops</option>
                  {WORKSHOPS_CATALOG.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.titulo.slice(0, 32)}… ({capacities[w.id] ?? w.vagas} vagas)
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Buscar por Nome, CPF, Título..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  style={{ width: 230, padding: "7px 12px", borderRadius: 6, fontSize: 13 }}
                />
              </div>
            </div>

            {classificationFilter === "EXCEEDED" && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#ef4444",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span><AlertIcon size="1.1em" /></span>
                <span>
                  <strong>Além do Limite Permitido:</strong> Exibindo participantes que foram confirmados após o esgotamento oficial do workshop ou cadastros com Pix cancelado por falta de vagas. Total: <strong>{allFilteredParticipants.length}</strong> registro(s).
                </span>
              </div>
            )}
          </div>

          {/* Painel de Busca de Participantes */}
          {renderSearchedParticipantsPanel()}

          {/* Tabela Desktop de Todos os Inscritos */}
          <div className="hands-on-desktop-table card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "10px 14px", width: 45 }}>#</th>
                    <th style={{ padding: "10px 14px" }}>Participante & Contato</th>
                    <th style={{ padding: "10px 14px" }}>Workshop Hands On</th>
                    <th style={{ padding: "10px 14px" }}>Status Pagamento & Vaga</th>
                    <th style={{ padding: "10px 14px", width: 100 }}>Check-in</th>
                    <th style={{ padding: "10px 14px", textAlign: "right", width: 170 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allFilteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
                        Nenhum inscrito encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    allFilteredParticipants.map((r, index) => {
                      const isCheckedIn = !!r.checkedInAt;
                      const isConfirmed = r.status === "CONFIRMED";
                      const isPending = r.status === "PENDING";
                      const isProcessing = processingId === r.id;

                      const targetId =
                        r.handsOnId === "reabilitacao-resina-composta"
                          ? "integrale-cirurgia-implante-protetico"
                          : r.handsOnId;
                      const wsDef = WORKSHOPS_CATALOG.find((w) => w.id === targetId);
                      const sellout = wsDef ? workshopSelloutData[wsDef.id] : null;
                      const orderInfo = sellout?.confirmedOrderMap.get(r.id);
                      const isOverCapacity = orderInfo ? orderInfo.isOver : false;
                      const confirmedRank = orderInfo ? orderInfo.rank : null;
                      const maxV = wsDef ? (capacities[wsDef.id] ?? wsDef.vagas) : 12;

                      const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
                      const pixTimeStr = pixTime
                        ? pixTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                        : null;
                      const pixDateStr = pixTime
                        ? pixTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                        : null;
                      const pixDateTimeFull = pixTime ? `${pixDateStr} às ${pixTimeStr}` : null;

                      const createdTimeStr = new Date(r.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });

                      const cleanPhone = (r.phone || "").replace(/\D/g, "");
                      const whatsappUrl = cleanPhone
                        ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                            `Olá ${r.name}, confirmamos seu contato referente ao Hands On ${r.title} no 3º COPOL.`
                          )}`
                        : null;

                      return (
                        <tr
                          key={r.id}
                          style={{
                            borderBottom: "1px solid var(--border)",
                            background: isOverCapacity ? "rgba(239, 68, 68, 0.03)" : index % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                          }}
                        >
                          <td style={{ padding: "10px 14px", color: "var(--text-muted)", verticalAlign: "middle" }}>
                            {index + 1}
                          </td>

                          {/* Participante & Contato */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                              <strong style={{ color: "var(--text)", fontSize: 14 }}>{r.name}</strong>

                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  fontFamily: "monospace",
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "rgba(255, 255, 255, 0.06)",
                                  color: "var(--text-muted)",
                                  border: "1px solid var(--border)",
                                }}
                                title="CPF do participante"
                              >
                                CPF: {r.document}
                              </span>
                            </div>

                            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <a href={`mailto:${r.email}`} style={{ color: "inherit", textDecoration: "none" }}>
                                <MailIcon size="1.1em" /> {r.email}
                              </a>
                              {r.phone && (
                                <>
                                  <span>·</span>
                                  {whatsappUrl ? (
                                    <a
                                      href={whatsappUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: "var(--success)", textDecoration: "none", fontWeight: 500 }}
                                    >
                                      <MessageIcon size="1.1em" /> {r.phone}
                                    </a>
                                  ) : (
                                    <span><PhoneIcon size="1.1em" /> {r.phone}</span>
                                  )}
                                </>
                              )}
                              {(r.category || r.institution) && (
                                <>
                                  <span>·</span>
                                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                    {[r.category, r.institution].filter(Boolean).join(" · ")}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Workshop Hands On */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                            <strong style={{ display: "block", color: "var(--text)", fontSize: 13, marginBottom: 2 }}>
                              {r.title}
                            </strong>
                            <span style={{ fontSize: 11, color: "var(--primary)" }}>
                              {r.speaker} · {r.date} ({r.time})
                            </span>
                          </td>

                          {/* Status Pagamento & Vaga */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>
                            {isConfirmed ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span
                                    style={{
                                      background: isOverCapacity ? "rgba(245, 158, 11, 0.15)" : "rgba(34, 197, 94, 0.15)",
                                      color: isOverCapacity ? "var(--warning)" : "var(--success)",
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {isOverCapacity ? "Confirmado (Excedente)" : "Confirmado"}
                                  </span>

                                  {confirmedRank && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: isOverCapacity ? "rgba(245, 158, 11, 0.18)" : "rgba(34, 197, 94, 0.1)",
                                        color: isOverCapacity ? "var(--warning)" : "var(--success)",
                                        border: isOverCapacity ? "1px solid rgba(245, 158, 11, 0.4)" : "none",
                                      }}
                                    >
                                      {isOverCapacity ? `Excedente ${confirmedRank}º/${maxV}` : `Vaga ${confirmedRank}/${maxV}`}
                                    </span>
                                  )}
                                </div>

                                {pixDateTimeFull && (
                                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                    <BoltIcon size="1.1em" /> {pixDateTimeFull}
                                  </span>
                                )}
                              </div>
                            ) : isPending ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span
                                    style={{
                                      background: "rgba(245, 158, 11, 0.15)",
                                      color: "var(--warning)",
                                      padding: "2px 8px",
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 700,
                                    }}
                                  >
                                    <ClockIcon size="1.1em" /> Pendente Pix
                                  </span>

                                  {sellout?.isFull && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: "rgba(239, 68, 68, 0.15)",
                                        color: "#ef4444",
                                        border: "1px solid rgba(239, 68, 68, 0.35)",
                                      }}
                                    >
                                      <BanIcon size="1.1em" /> Vagas Esgotadas
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                  Criado às {createdTimeStr}
                                </span>
                              </div>
                            ) : (
                              <span
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "var(--danger)",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {r.status === "CANCELLED" ? "Cancelado (Esgotado)" : r.status}
                              </span>
                            )}
                          </td>

                          {/* Check-in */}
                          <td style={{ padding: "10px 14px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {isCheckedIn ? (
                              <span
                                style={{
                                  background: "rgba(59, 91, 255, 0.15)",
                                  color: "var(--primary)",
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                <CheckIcon size="1.1em" /> Presente
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* Ações */}
                          <td style={{ padding: "10px 14px", textAlign: "right", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                              {isPending && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  disabled={isProcessing}
                                  onClick={() => handleConfirmPayment(r.id)}
                                  style={{ background: "var(--success)", color: "#ffffff", fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
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
                                  style={{ fontSize: 11, padding: "4px 8px", fontWeight: 600 }}
                                  title="Registrar presença"
                                >
                                  Check-in
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
                                  fontWeight: 600,
                                }}
                                title="Excluir inscrição"
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

          {/* Cards Mobile de Todos os Inscritos (Exibidos em Telas <= 768px) */}
          <div className="hands-on-mobile-cards">
            {allFilteredParticipants.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                Nenhum inscrito encontrado para os filtros selecionados.
              </div>
            ) : (
              allFilteredParticipants.map((r, index) => {
                const isCheckedIn = !!r.checkedInAt;
                const isConfirmed = r.status === "CONFIRMED";
                const isPending = r.status === "PENDING";
                const isProcessing = processingId === r.id;

                const targetId =
                  r.handsOnId === "reabilitacao-resina-composta"
                    ? "integrale-cirurgia-implante-protetico"
                    : r.handsOnId;
                const wsDef = WORKSHOPS_CATALOG.find((w) => w.id === targetId);
                const sellout = wsDef ? workshopSelloutData[wsDef.id] : null;
                const orderInfo = sellout?.confirmedOrderMap.get(r.id);
                const isOverCapacity = orderInfo ? orderInfo.isOver : false;
                const confirmedRank = orderInfo ? orderInfo.rank : null;
                const maxV = wsDef ? (capacities[wsDef.id] ?? wsDef.vagas) : 12;

                const pixTime = r.paidAt ? new Date(r.paidAt) : (isConfirmed ? new Date(r.createdAt) : null);
                const pixTimeStr = pixTime
                  ? pixTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : null;
                const pixDateStr = pixTime
                  ? pixTime.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                  : null;
                const pixDateTimeFull = pixTime ? `${pixDateStr} às ${pixTimeStr}` : null;

                const cleanPhone = (r.phone || "").replace(/\D/g, "");
                const whatsappUrl = cleanPhone
                  ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                      `Olá ${r.name}, confirmamos seu contato referente ao Hands On ${r.title} no 3º COPOL.`
                    )}`
                  : null;

                return (
                  <div
                    key={r.id}
                    className="card"
                    style={{
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      background: "var(--surface)",
                      border: isOverCapacity ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--border)",
                      borderLeft: isConfirmed
                        ? isOverCapacity
                          ? "4px solid #ef4444"
                          : "4px solid var(--success)"
                        : isPending
                        ? "4px solid var(--warning)"
                        : "4px solid var(--danger)",
                    }}
                  >
                    {/* Top row: # + Nome + Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>#{index + 1}</span>
                        <strong style={{ fontSize: 15, color: "var(--text)" }}>{r.name}</strong>
                      </div>

                      <span
                        style={{
                          background: isConfirmed
                            ? isOverCapacity
                              ? "rgba(245, 158, 11, 0.15)"
                              : "rgba(34, 197, 94, 0.15)"
                            : isPending
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          color: isConfirmed
                            ? isOverCapacity
                              ? "var(--warning)"
                              : "var(--success)"
                            : isPending
                            ? "var(--warning)"
                            : "var(--danger)",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {isConfirmed
                          ? isOverCapacity
                            ? "Confirmado (Excedente)"
                            : "Confirmado"
                          : isPending
                          ? "Pendente Pix"
                          : r.status === "CANCELLED"
                          ? "Cancelado (Esgotado)"
                          : r.status}
                      </span>
                    </div>

                    {/* Workshop Title */}
                    <div style={{ background: "var(--surface-alt)", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                      <strong style={{ fontSize: 13, color: "var(--text)", display: "block" }}>{r.title}</strong>
                      <span style={{ fontSize: 11, color: "var(--primary)" }}>
                        {r.speaker} · {r.date} ({r.time})
                      </span>
                    </div>

                    {/* Linha de CPF, Vaga e Horário */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: "rgba(255, 255, 255, 0.06)",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        CPF: {r.document}
                      </span>

                      {confirmedRank && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isOverCapacity ? "rgba(245, 158, 11, 0.18)" : "rgba(34, 197, 94, 0.1)",
                            color: isOverCapacity ? "var(--warning)" : "var(--success)",
                          }}
                        >
                          {isOverCapacity ? `Excedente ${confirmedRank}º/${maxV}` : `Vaga ${confirmedRank}/${maxV}`}
                        </span>
                      )}

                      {pixDateTimeFull && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          <BoltIcon size="1.1em" /> {pixDateTimeFull}
                        </span>
                      )}

                      {isCheckedIn && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(59, 91, 255, 0.15)",
                            color: "var(--primary)",
                          }}
                        >
                          <CheckIcon size="1.1em" /> Presente
                        </span>
                      )}
                    </div>

                    {/* Contato */}
                    <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <a href={`mailto:${r.email}`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>
                        <MailIcon size="1.1em" /> {r.email}
                      </a>
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--success)", textDecoration: "none", fontWeight: 600 }}
                        >
                          <MessageIcon size="1.1em" /> WhatsApp ({r.phone})
                        </a>
                      )}
                    </div>

                    {/* Botões de Ação no Mobile */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      {isPending && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleConfirmPayment(r.id)}
                          style={{
                            flex: "1 1 140px",
                            background: "var(--success)",
                            color: "#ffffff",
                            fontWeight: 700,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
                        >
                          <CheckIcon size="1.1em" /> Confirmar Pix
                        </button>
                      )}

                      {!isCheckedIn && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleCheckIn(r.id)}
                          style={{
                            flex: "1 1 120px",
                            fontWeight: 600,
                            padding: "8px 12px",
                            fontSize: 12,
                          }}
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
                          fontWeight: 600,
                          padding: "8px 12px",
                          fontSize: 12,
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
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
                <PlusIcon size="1.1em" /> Adicionar Inscrito no Hands On
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

              <label className="switch-row">
                <span className="switch-text">
                  <strong>Inscrição isenta (cortesia)</strong>
                  <small>Garante a vaga sem cobrança e não entra na receita do evento.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={manualExempt}
                  onChange={(e) => setManualExempt(e.target.checked)}
                />
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
                    value={manualExempt ? "CONFIRMED" : manualStatus}
                    disabled={manualExempt}
                    onChange={(e) => setManualStatus(e.target.value as any)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="CONFIRMED">Confirmado (Vaga Garantida)</option>
                    <option value="PENDING">Pendente</option>
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

      {/* Modal de Gerenciamento de Vagas do Workshop */}
      {capacityModalWorkshop && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            zIndex: 1050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingCapacity) {
              setCapacityModalWorkshop(null);
            }
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              border: "1px solid var(--border)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
              background: "var(--surface)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "var(--success)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  <BoltIcon size="1.1em" /> Capacidade de Vagas
                </span>
                <h3 style={{ margin: "6px 0 2px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                  {capacityModalWorkshop.titulo}
                </h3>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Ministrante: {capacityModalWorkshop.ministrante} · {capacityModalWorkshop.diaSemana}
                </span>
              </div>

              <button
                type="button"
                onClick={() => !savingCapacity && setCapacityModalWorkshop(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {capacityError && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  fontSize: 13,
                }}
              >
                {capacityError}
              </div>
            )}

            {capacitySuccess && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid var(--success)",
                  color: "var(--success)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <CheckIcon size="1.1em" /> {capacitySuccess}
              </div>
            )}

            {/* Quadro de Status Atual */}
            {(() => {
              const currentVagas = capacities[capacityModalWorkshop.id] ?? capacityModalWorkshop.vagas;
              const wsStats = statsByWorkshop[capacityModalWorkshop.id] ?? { confirmed: 0, pending: 0, total: 0, checkedIn: 0 };
              const diff = capacityInput - currentVagas;

              return (
                <form onSubmit={handleSaveCapacity}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 10,
                      marginBottom: 18,
                      background: "var(--surface-alt)",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                        Vagas Atuais
                      </span>
                      <strong style={{ fontSize: 18, color: "var(--text)" }}>{currentVagas}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                        Confirmados
                      </span>
                      <strong style={{ fontSize: 18, color: "var(--success)" }}>{wsStats.confirmed}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "block" }}>
                        Pendentes Pix
                      </span>
                      <strong style={{ fontSize: 18, color: "var(--warning)" }}>{wsStats.pending}</strong>
                    </div>
                  </div>

                  {/* Controle de Alteração da Capacidade */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
                      Definir Nova Capacidade de Vagas:
                    </label>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCapacityInput((prev) => Math.max(1, prev - 1))}
                        disabled={savingCapacity || capacityInput <= 1}
                        className="btn btn-secondary"
                        style={{ fontSize: 18, fontWeight: 700, width: 44, height: 44, padding: 0 }}
                      >
                        -
                      </button>

                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={capacityInput}
                        onChange={(e) => setCapacityInput(parseInt(e.target.value) || 1)}
                        disabled={savingCapacity}
                        style={{
                          flex: 1,
                          fontSize: 20,
                          fontWeight: 700,
                          textAlign: "center",
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--text)",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setCapacityInput((prev) => prev + 1)}
                        disabled={savingCapacity}
                        className="btn btn-secondary"
                        style={{ fontSize: 18, fontWeight: 700, width: 44, height: 44, padding: 0 }}
                      >
                        +
                      </button>
                    </div>

                    {/* Botões Rápidos de Incremento */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center", marginRight: 4 }}>
                        Adicionar rápido:
                      </span>
                      {[1, 2, 5, 10].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setCapacityInput(currentVagas + inc)}
                          disabled={savingCapacity}
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            background: capacityInput === currentVagas + inc ? "var(--primary)" : undefined,
                            color: capacityInput === currentVagas + inc ? "#fff" : undefined,
                          }}
                        >
                          +{inc} vaga{inc > 1 ? "s" : ""} ({currentVagas + inc})
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCapacityInput(capacityModalWorkshop.vagas)}
                        disabled={savingCapacity}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11, padding: "3px 8px", color: "var(--text-muted)" }}
                        title="Restaurar padrão inicial do catálogo"
                      >
                        Padrão ({capacityModalWorkshop.vagas})
                      </button>
                    </div>

                    {/* Feedback contextual */}
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 6,
                        fontSize: 12,
                        lineHeight: 1.5,
                        background:
                          diff > 0
                            ? "rgba(16, 185, 129, 0.1)"
                            : diff < 0
                            ? "rgba(245, 158, 11, 0.1)"
                            : "var(--surface-alt)",
                        border:
                          diff > 0
                            ? "1px solid rgba(16, 185, 129, 0.3)"
                            : diff < 0
                            ? "1px solid rgba(245, 158, 11, 0.3)"
                            : "1px solid var(--border)",
                        color: diff > 0 ? "var(--success)" : diff < 0 ? "var(--warning)" : "var(--text-muted)",
                      }}
                    >
                      {diff > 0 ? (
                        <span>
                          <DotIcon size="0.7em" color="var(--success)" /> <strong>Aumentando em +{diff} vaga(s):</strong> O limite passará de {currentVagas} para {capacityInput}.{" "}
                          Novas inscrições serão liberadas no site oficial e pagamentos Pix pendentes que estavam bloqueados poderão ser confirmados.
                        </span>
                      ) : diff < 0 ? (
                        <span>
                          <AlertIcon size="1.1em" /> <strong>Reduzindo capacidade:</strong> O limite passará de {currentVagas} para {capacityInput}.{" "}
                          {capacityInput < wsStats.confirmed ? (
                            <span style={{ color: "#ef4444", fontWeight: 700 }}>
                              Atenção: Já existem {wsStats.confirmed} inscritos confirmados. {wsStats.confirmed - capacityInput} participantes ficarão como excedentes da nova capacidade.
                            </span>
                          ) : (
                            "Nenhum participante confirmado será afetado."
                          )}
                        </span>
                      ) : (
                        <span>Nenhuma alteração de capacidade selecionada ({capacityInput} vagas).</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCapacityModalWorkshop(null)}
                      disabled={savingCapacity}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={savingCapacity || capacityInput === currentVagas}
                      style={{
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        border: "none",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {savingCapacity ? "Salvando..." : "Salvar Novas Vagas"}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
