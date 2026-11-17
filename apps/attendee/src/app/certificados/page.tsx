"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPublicCertificate, type PublicCertificate } from "@/lib/api";
import { PortalShell } from "@/components/portal/PortalShell";
import estilos from "@/components/portal/portal.module.css";

export default function CertificadosPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CertificadoValidador />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <PortalShell aba={null}>
      <div className={estilos.cartao} style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: "var(--texto-fraco)", margin: 0 }}>Carregando validação...</p>
      </div>
    </PortalShell>
  );
}

function CertificadoValidador() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") ?? "";

  const [code, setCode] = useState(initialCode);
  const [inputCode, setInputCode] = useState(initialCode);
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!code.trim()) {
      setCertificate(null);
      setNotFound(false);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setNotFound(false);
    setErrorMessage(null);

    getPublicCertificate(code.trim())
      .then((data) => {
        if (!mounted) return;
        setCertificate(data);
        setNotFound(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setCertificate(null);
        setNotFound(true);
        setErrorMessage(err instanceof Error ? err.message : "Certificado não localizado.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [code]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputCode.trim()) {
      setCode(inputCode.trim());
    }
  }

  return (
    <PortalShell aba={null}>
      <div className={estilos.cartao} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Topo do validador */}
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", color: "var(--texto)" }}>
            Validação de Certificados
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--texto-fraco)", lineHeight: 1.5 }}>
            Consulte a autenticidade e a validade oficial de certificados e comprovantes emitidos pela plataforma LSPK Eventos.
          </p>
        </div>

        {/* Campo para busca ou troca de código */}
        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Digite o código (ex: ABC12345)"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--borda, rgba(255, 255, 255, 0.15))",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              color: "var(--texto, #ffffff)",
              fontSize: 14,
              fontFamily: "var(--fonte-mono, monospace)",
              letterSpacing: "0.04em",
            }}
          />
          <button
            type="submit"
            className="btn"
            style={{
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: "#4459f5",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Verificar
          </button>
        </form>

        {/* Estado: Carregando */}
        {loading && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--texto-fraco)" }}>
            <p style={{ margin: 0 }}>Consultando registro oficial do certificado...</p>
          </div>
        )}

        {/* Estado: Não Encontrado */}
        {!loading && notFound && (
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "inline-block",
                alignSelf: "center",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Certificado Não Encontrado
            </span>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--texto-fraco)", lineHeight: 1.5 }}>
              Não existe nenhum certificado emitido com o código informado (<code>{code}</code>). Verifique se o código foi digitado corretamente ou se o documento é autêntico.
            </p>
          </div>
        )}

        {/* Estado: Revogado */}
        {!loading && certificate && certificate.revoked && (
          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "inline-block",
                alignSelf: "center",
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                color: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Certificado Revogado
            </span>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--texto-fraco)", lineHeight: 1.5 }}>
              Este certificado foi revogado pela organização do evento e não possui validade legal.
            </p>
          </div>
        )}

        {/* Estado: Válido */}
        {!loading && certificate && certificate.valid && !certificate.revoked && (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px solid rgba(34, 197, 94, 0.35)",
              backgroundColor: "rgba(34, 197, 94, 0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 14px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#22c55e",
                  backgroundColor: "rgba(34, 197, 94, 0.16)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    boxShadow: "0 0 6px #22c55e",
                  }}
                />
                Certificado Autêntico e Válido
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
              <DetailField label="Participante" value={certificate.participantName} highlight />
              <DetailField label="Evento" value={certificate.eventName} />
              <DetailField
                label="Período do Evento"
                value={formatDateRange(certificate.eventStartDate, certificate.eventEndDate)}
              />
              {certificate.eventLocation && (
                <DetailField label="Local" value={certificate.eventLocation} />
              )}
              {certificate.workloadHours !== null && certificate.workloadHours !== undefined && (
                <DetailField label="Carga Horária" value={`${certificate.workloadHours} horas`} />
              )}
              <DetailField label="Código de Autenticidade" value={certificate.code} mono />
              {certificate.issuedAt && (
                <DetailField label="Emitido em" value={formatDateTime(certificate.issuedAt)} />
              )}
            </div>
          </div>
        )}

        {/* Rodapé com link para início */}
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: "var(--texto-fraco)",
              textDecoration: "none",
            }}
          >
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}

function DetailField({
  label,
  value,
  highlight = false,
  mono = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--texto-fraco, rgba(255, 255, 255, 0.5))",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: highlight ? 17 : 14,
          fontWeight: highlight ? 700 : 500,
          color: highlight ? "#ffffff" : "var(--texto, rgba(255, 255, 255, 0.9))",
          fontFamily: mono ? "var(--fonte-mono, monospace)" : "inherit",
          letterSpacing: mono ? "0.06em" : "normal",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatDateRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "long",
      year: "numeric",
    };
    const startLabel = new Intl.DateTimeFormat("pt-BR", opts).format(start);
    const endLabel = new Intl.DateTimeFormat("pt-BR", opts).format(end);
    return startLabel === endLabel ? startLabel : `${startLabel} a ${endLabel}`;
  } catch {
    return "";
  }
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}
