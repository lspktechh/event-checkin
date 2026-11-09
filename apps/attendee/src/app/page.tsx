"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAttendee, selectEvent, type ParticipantData } from "@/lib/api";
import { dataCurta } from "@/lib/datas";
import { PortalShell } from "@/components/portal/PortalShell";
import { Seta } from "@/components/portal/Seta";
import estilos from "@/components/portal/portal.module.css";

export const dynamic = "force-dynamic";

export default function AcessarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ParticipantData[] | null>(null);
  const [singleEventSession, setSingleEventSession] = useState<{
    token: string;
    participant: ParticipantData;
  } | null>(null);
  // Vindo de "Certificado →" na aba Realizados: a pessoa precisa saber que
  // é por aqui, com o e-mail da inscrição, que o certificado é baixado.
  const [dicaCertificado, setDicaCertificado] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) setEmail(emailParam);
    if (params.get("certificado") === "1") setDicaCertificado(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const response = await loginAttendee(cleanEmail);

      const foundEvents: ParticipantData[] =
        response.data.events && response.data.events.length > 0
          ? response.data.events
          : response.data.participant
          ? [response.data.participant]
          : [];

      if (foundEvents.length === 0) {
        setError("Nenhum evento encontrado para este e-mail.");
        setLoading(false);
        return;
      }

      setEvents(foundEvents);

      if (response.data.token && response.data.participant) {
        setSingleEventSession({
          token: response.data.token,
          participant: response.data.participant,
        });
      } else {
        setSingleEventSession(null);
      }
    } catch (err: any) {
      setError(err.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleAccessEvent = async (p: ParticipantData) => {
    setError(null);
    setLoading(true);

    try {
      if (singleEventSession && singleEventSession.participant.id === p.id) {
        localStorage.setItem("attendee_token", singleEventSession.token);
        localStorage.setItem(
          "attendee_data",
          JSON.stringify(singleEventSession.participant)
        );
        router.push("/checkin");
        return;
      }

      const response = await selectEvent(p.id);
      localStorage.setItem("attendee_token", response.data.token!);
      localStorage.setItem(
        "attendee_data",
        JSON.stringify(response.data.participant)
      );
      router.push("/checkin");
    } catch (err: any) {
      setError(err.message ?? "Erro ao acessar credencial do evento");
    } finally {
      setLoading(false);
    }
  };

  if (events) {
    return (
      <PortalShell aba="acessar" larga>
        <section className={estilos.secao}>
          <div className={estilos.cabecaSecao}>
            <span className={estilos.rotuloMono}>Inscrições encontradas</span>
            <h1 className={estilos.titulo}>
              {events.length === 1 ? "Seu evento" : "Selecione o evento"}
            </h1>
            <p className={estilos.lead}>
              {events.length === 1 ? "Evento vinculado" : `${events.length} eventos vinculados`} ao
              e-mail <strong>{email}</strong>
            </p>
          </div>

          {error && (
            <p role="alert" className={estilos.erro}>
              {error}
            </p>
          )}

          <ul className={estilos.lista}>
            {events.map((p) => (
              <li key={p.id} className={estilos.linha}>
                <span className={estilos.linhaData}>{dataCurta(p.event.startDate)}</span>
                <div className={estilos.linhaInfo}>
                  <span className={estilos.linhaNome}>{p.event.name}</span>
                  <span className={estilos.linhaLocal}>
                    {[p.event.location, p.checkedIn ? "Check-in realizado" : "Inscrição confirmada"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleAccessEvent(p)}
                  className={estilos.acao}
                >
                  {loading ? "Acessando…" : "Ver QR Code"}
                  <Seta />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              setEvents(null);
              setSingleEventSession(null);
              setError(null);
            }}
            className={estilos.acao}
          >
            ← Buscar outro e-mail
          </button>
        </section>
      </PortalShell>
    );
  }

  return (
    <PortalShell aba="acessar">
      <section className={estilos.secao}>
        <div className={estilos.cabecaSecao}>
          <h1 className={estilos.titulo}>Acesse sua conta</h1>
          <p className={estilos.lead}>QR Code, comprovante de presença e certificado.</p>
        </div>

        {dicaCertificado && (
          <p className={estilos.dica}>
            Entre com o e-mail da inscrição para baixar seu certificado.
          </p>
        )}

        <form onSubmit={handleSubmit} className={estilos.form}>
          {error && (
            <p role="alert" className={estilos.erro}>
              {error}
            </p>
          )}

          <div className={estilos.campo}>
            <label htmlFor="email">E-mail cadastrado</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              autoCapitalize="none"
            />
          </div>

          <button type="submit" disabled={loading} className={estilos.botao}>
            {loading ? "Buscando…" : "Entrar"}
          </button>
        </form>

        <p className={estilos.centro}>
          Ainda não se inscreveu? <Link href="/inscricao">Fazer inscrição</Link>
        </p>
      </section>
    </PortalShell>
  );
}
