const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://137.131.233.254:3000";

export interface ParticipantData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  document: string | null;
  qrToken: string;
  status: string;
  event: {
    id: string;
    name: string;
    location: string | null;
    startDate: string;
    endDate: string;
  };
  lastCheckIn: {
    id: string;
    checkedInAt: string;
    terminal: { name: string } | null;
  } | null;
  checkedIn: boolean;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token?: string;
    participant?: ParticipantData;
    requiresEventSelection?: boolean;
    events?: ParticipantData[];
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export async function loginAttendee(
  email: string
): Promise<LoginResponse> {
  const res = await fetch("/api/attendee/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Erro ao fazer login");
  }

  return data;
}

export async function selectEvent(
  participantId: string
): Promise<LoginResponse> {
  const res = await fetch("/api/attendee/select-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participantId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Erro ao selecionar evento");
  }

  return data;
}

export async function getParticipantMe(
  token: string
): Promise<ApiResponse<ParticipantData>> {
  const res = await fetch("/api/attendee/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.json();
}

// --- Meus documentos (certificado / comprovante) ---

export type CertificateDisplayStatus = "LOCKED" | "ELIGIBLE" | "GENERATED" | "REVOKED";

export interface MyDocuments {
  qrCode: { available: boolean };
  attendanceProof: { available: boolean };
  certificate: {
    status: CertificateDisplayStatus;
    canDownload: boolean;
    reason: "EVENT_NOT_ENDED" | "NOT_PRESENT" | null;
    generatedAt: string | null;
  };
}

export async function getMyDocuments(token: string, eventId: string): Promise<ApiResponse<MyDocuments>> {
  const res = await fetch(`/api/attendee/my-documents?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// --- Hands On ---

export interface AttendeeHandsOn {
  id: string;
  handsOnId: string;
  title: string;
  speaker: string;
  date: string;
  time: string;
  location: string | null;
  sponsor: string | null;
  amount: number;
  name: string;
  email: string;
  document: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  qrToken: string;
  checkedInAt: string | null;
  checkedInBy?: string | null;
}

export async function getAttendeeHandsOn(token: string): Promise<ApiResponse<AttendeeHandsOn[]>> {
  const res = await fetch("/api/attendee/hands-on", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function downloadPdf(path: string, token: string, eventId: string, filename: string): Promise<void> {
  const res = await fetch(`${path}?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "Não foi possível baixar o arquivo");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadCertificate(token: string, eventId: string, participantName: string): Promise<void> {
  return downloadPdf("/api/attendee/certificate", token, eventId, `certificado-${participantName.replace(/\s+/g, "_")}.pdf`);
}

export function downloadAttendanceProof(token: string, eventId: string, participantName: string): Promise<void> {
  return downloadPdf(
    "/api/attendee/attendance-proof",
    token,
    eventId,
    `comprovante-${participantName.replace(/\s+/g, "_")}.pdf`
  );
}

export function connectSSE(
  token: string,
  onEvent: (event: any) => void,
  onError?: (error: Event) => void
): () => void {
  const eventSource = new EventSource(
    `/api/attendee/checkin-status?token=${encodeURIComponent(token)}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onEvent(data);
    } catch {
      // Ignore parse errors (heartbeat comments, etc.)
    }
  };

  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}

// --- Consulta e Reenvio de Trabalhos ---

export interface PublicAuthor {
  id?: string;
  name: string;
  email: string;
  institution: string | null;
  isPresenter: boolean;
  position?: number;
}

export interface PublicFile {
  id: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  position: number;
}

export interface PublicSubmission {
  id: string;
  code: string;
  title: string;
  abstract: string;
  keywords: string[];
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "APPROVED_WITH_RESERVATIONS"
    | "RESUBMITTED"
    | "REJECTED"
    | "WITHDRAWN";
  decisionReason: string | null;
  modality: { id: string; name: string } | null;
  topic: { id: string; name: string } | null;
  authors: PublicAuthor[];
  files: PublicFile[];
  paymentStatus: string;
  submittedAt: string | null;
  decidedAt: string | null;
  updatedAt: string;
}

export interface SearchSubmissionsResponse {
  event: { id: string; name: string; slug: string | null };
  submissions: PublicSubmission[];
}

export interface SubmissionEditDetailsResponse {
  event: { id: string; name: string; slug: string | null };
  submission: PublicSubmission;
  modalities: { id: string; name: string }[];
  topics: { id: string; name: string }[];
}

export interface ResubmitInput {
  authorEmail: string;
  title: string;
  abstract: string;
  keywords: string[];
  modalityId?: string | null;
  topicId?: string | null;
  authors: {
    name: string;
    email: string;
    institution?: string | null;
    isPresenter?: boolean;
  }[];
  keepFileIds: string[];
  newFiles: {
    fileName: string;
    dataBase64: string;
  }[];
  correctionsNotes?: string;
}

export async function searchSubmissionsByEmail(
  slug: string,
  email: string
): Promise<SearchSubmissionsResponse> {
  const res = await fetch(
    `/api/publico/trabalhos/${encodeURIComponent(slug)}?email=${encodeURIComponent(email)}`
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message ?? "Falha ao buscar trabalhos");
  }
  return data.data;
}

export async function getSubmissionEditDetails(
  slug: string,
  submissionId: string,
  email: string
): Promise<SubmissionEditDetailsResponse> {
  const res = await fetch(
    `/api/publico/trabalhos/${encodeURIComponent(slug)}/${encodeURIComponent(submissionId)}?email=${encodeURIComponent(email)}`
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message ?? "Falha ao carregar trabalho");
  }
  return data.data;
}

export async function resubmitSubmission(
  slug: string,
  submissionId: string,
  input: ResubmitInput
): Promise<PublicSubmission> {
  const res = await fetch(
    `/api/publico/trabalhos/${encodeURIComponent(slug)}/${encodeURIComponent(submissionId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message ?? "Falha ao enviar correções");
  }
  return data.data;
}
