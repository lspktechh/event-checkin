"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  getHandsOnInscription,
  formatarReais,
  type HandsOnInscription,
  PIX_CONFIG,
} from "@/lib/hands-on-data";
import {
  CheckIcon,
  CopyIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  AlertTriangleIcon,
  MailIcon,
  ShieldCheckIcon,
  ExternalLinkIcon,
} from "@/components/Icons";

export default function HandsOnPagamentoPage() {
  return (
    <Suspense fallback={<PagamentoFallback />}>
      <PagamentoContent />
    </Suspense>
  );
}

function PagamentoFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Carregando dados do pagamento…</p>
      </main>
      <SiteFooter />
    </div>
  );
}

function PagamentoContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [inscricao, setInscricao] = useState<HandsOnInscription | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) {
      setCarregando(false);
      return;
    }
    const record = getHandsOnInscription(id);
    if (record) {
      setInscricao(record);
    }
    setCarregando(false);
  }, [id]);

  function handleCopyPix() {
    if (!inscricao?.pixCode) return;
    navigator.clipboard.writeText(inscricao.pixCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    });
  }

  function handleCopyChave() {
    navigator.clipboard.writeText(PIX_CONFIG.chave).then(() => {
      setCopiadoChave(true);
      setTimeout(() => setCopiadoChave(false), 3000);
    });
  }

  if (carregando) {
    return <PagamentoFallback />;
  }

  if (!id || !inscricao) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <SiteHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="card" style={{ maxWidth: 460, padding: 32, textAlign: "center" }}>
            <AlertTriangleIcon size={36} color="var(--destructive)" />
            <h1 style={{ fontSize: 20, margin: "14px 0 8px" }}>Inscrição não encontrada</h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: 14, margin: "0 0 20px" }}>
              Não encontramos os dados desta inscrição neste navegador. Caso deseje se inscrever,
              acesse o catálogo de Hands On.
            </p>
            <Link href="/hands-on/" className="btn-primary" style={{ display: "inline-block" }}>
              Ver Hands On Disponíveis
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isGratuito = inscricao.preco === 0 || inscricao.status === "CONFIRMADO";

  // Monta texto de envio para o e-mail / WhatsApp da organização
  const mensagemComprovante = encodeURIComponent(
    `Olá! Acabei de me inscrever no Hands On do 3º COPOL:\n\n` +
      `Workshop: ${inscricao.handsOnTitulo}\n` +
      `Código de Inscrição: ${inscricao.id}\n` +
      `Participante: ${inscricao.nome}\n` +
      `CPF: ${inscricao.documento}\n` +
      `Valor: ${formatarReais(inscricao.preco)}\n\n` +
      `Segue meu comprovante de pagamento via Pix para confirmação da vaga.`
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.45 }} />

        <div
          className="container-page"
          style={{
            position: "relative",
            padding: "48px 24px 80px",
            maxWidth: 620,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            textAlign: "center",
          }}
        >
          {isGratuito ? (
            /* ---------- CONFIRMAÇÃO GRATUITA (RADIOTECH) ---------- */
            <>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(45, 212, 191, 0.15)",
                  border: "2px solid var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
                <CheckIcon size={42} />
              </div>

              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 14px",
                    borderRadius: 999,
                    background: "rgba(45, 212, 191, 0.12)",
                    color: "var(--primary)",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Inscrição Confirmada · Gratuita
                </div>
                <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, margin: "14px 0 8px" }}>
                  Sua vaga está garantida!
                </h1>
                <p style={{ color: "var(--muted-foreground)", fontSize: 15, margin: 0 }}>
                  Parabéns! Sua participação no Hands On gratuito foi registrada com sucesso.
                </p>
              </div>

              {/* Card de Detalhes da Inscrição */}
              <div className="card" style={{ padding: 26, width: "100%", textAlign: "left" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingBottom: 14,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Código da Inscrição:</span>
                  <strong style={{ fontFamily: "monospace", color: "var(--primary)", fontSize: 15 }}>
                    {inscricao.id}
                  </strong>
                </div>

                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 12 }}>Workshop:</span>
                    <strong style={{ color: "var(--foreground)", fontSize: 16 }}>{inscricao.handsOnTitulo}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 12 }}>Ministrante:</span>
                    <span style={{ color: "var(--gold)", fontWeight: 600 }}>{inscricao.ministrante}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                    <span>
                      <strong style={{ color: "var(--foreground)" }}>Data:</strong> {inscricao.diaSemana}
                    </span>
                    <span>
                      <strong style={{ color: "var(--foreground)" }}>Horário:</strong> {inscricao.horario}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 12 }}>Participante:</span>
                    <span style={{ color: "var(--foreground)" }}>
                      {inscricao.nome} (CPF: {inscricao.documento})
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap" }}>
                <Link href="/hands-on/" className="btn-secondary" style={{ flex: 1, textAlign: "center" }}>
                  ← Ver outros Hands On
                </Link>
                <Link href="/" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  Página Inicial
                </Link>
              </div>
            </>
          ) : (
            /* ---------- AGUARDANDO PAGAMENTO VIA PIX ---------- */
            <>
              <div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(212, 168, 83, 0.12)",
                    color: "var(--gold)",
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  Aguardando Pagamento via Pix
                </div>

                <h1 style={{ margin: "14px 0 8px", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800 }}>
                  Quase lá! Realize o Pix
                </h1>
                <p style={{ margin: 0, fontSize: 15, color: "var(--muted-foreground)" }}>
                  Sua pré-reserva foi criada. Escaneie o QR Code ou copie o código Pix abaixo para concluir o pagamento.
                </p>
              </div>

              {/* Card de Pagamento */}
              <div
                className="card"
                style={{
                  padding: 28,
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  border: "1px solid rgba(212, 168, 83, 0.35)",
                }}
              >
                {/* Resumo do Workshop e Valor */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 16,
                    textAlign: "left",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase", display: "block" }}>
                      Hands On
                    </span>
                    <strong style={{ fontSize: 15, color: "var(--foreground)", display: "block" }}>
                      {inscricao.handsOnTitulo}
                    </strong>
                    <span style={{ fontSize: 12, color: "var(--gold)" }}>
                      {inscricao.ministrante} · {inscricao.diaSemana}
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase", display: "block" }}>
                      Valor a Pagar
                    </span>
                    <strong style={{ fontSize: 24, color: "var(--gold)" }}>
                      {formatarReais(inscricao.preco)}
                    </strong>
                  </div>
                </div>

                {/* QR Code Pix */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                  {inscricao.pixCode && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                        inscricao.pixCode
                      )}`}
                      alt="QR Code Pix para pagamento"
                      width={220}
                      height={220}
                      style={{
                        width: 220,
                        height: 220,
                        background: "#fff",
                        padding: 10,
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                      }}
                    />
                  )}

                  {/* Informação do Titular / Beneficiário */}
                  <div
                    style={{
                      width: "100%",
                      background: "rgba(212, 168, 83, 0.08)",
                      border: "1px solid rgba(212, 168, 83, 0.25)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                      Nome do favorecido no app do seu banco:
                    </span>
                    <strong style={{ fontSize: 16, color: "var(--gold)" }}>
                      {PIX_CONFIG.titular}
                    </strong>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      Chave Pix: <strong>{PIX_CONFIG.chave}</strong> (E-mail oficial COPOL)
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", textAlign: "center" }}>
                    No app do seu banco, escolha <strong>Pix</strong> &rarr; <strong>Ler QR Code</strong>, ou
                    use o código copia e cola abaixo:
                  </p>

                  {/* Código Pix Copia e Cola */}
                  <div
                    style={{
                      width: "100%",
                      background: "var(--background)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontFamily: "monospace",
                      fontSize: 12,
                      color: "var(--foreground)",
                      wordBreak: "break-all",
                      textAlign: "left",
                      maxHeight: 90,
                      overflowY: "auto",
                    }}
                  >
                    {inscricao.pixCode}
                  </div>

                  {/* Botões de Cópia */}
                  <div style={{ display: "flex", gap: 10, width: "100%", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        padding: 14,
                        fontSize: 14,
                        fontWeight: 700,
                        background: copiado ? "var(--success)" : "var(--primary)",
                        color: "var(--primary-foreground)",
                        transition: "all 0.2s ease",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        borderRadius: 10,
                      }}
                    >
                      {copiado ? (
                        <>
                          <CheckIcon size={18} /> Código Pix Copiado!
                        </>
                      ) : (
                        <>
                          <CopyIcon size={18} /> Copiar Código Pix Copia e Cola
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyChave}
                      className="btn-secondary"
                      style={{
                        padding: "14px 18px",
                        fontSize: 14,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        cursor: "pointer",
                        borderRadius: 10,
                      }}
                    >
                      {copiadoChave ? (
                        <>
                          <CheckIcon size={16} /> Chave Copiada!
                        </>
                      ) : (
                        <>
                          <CopyIcon size={16} /> Copiar Chave E-mail
                        </>
                      )}
                    </button>
                  </div>

                  {/* Instruções de Envio do Comprovante */}
                  <div
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: "16px 18px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      textAlign: "left",
                    }}
                  >
                    <strong style={{ fontSize: 14, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                      Como confirmar sua vaga:
                    </strong>
                    <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                      <li>Efetue o pagamento Pix no valor de {formatarReais(inscricao.preco)}.</li>
                      <li>
                        Envie o comprovante para o e-mail oficial{" "}
                        <a href={`mailto:${PIX_CONFIG.emailContato}?subject=Comprovante%20Hands%20On%20${inscricao.id}&body=${mensagemComprovante}`} style={{ color: "var(--gold)", fontWeight: 600 }}>
                          {PIX_CONFIG.emailContato}
                        </a>{" "}
                        informando seu código <strong>{inscricao.id}</strong>.
                      </li>
                      <li>A comissão organizadora confirmará sua vaga e enviará as orientações de acesso.</li>
                    </ol>

                    <div style={{ marginTop: 14 }}>
                      <a
                        href={`mailto:${PIX_CONFIG.emailContato}?subject=Comprovante%20Hands%20On%20${inscricao.id}&body=${mensagemComprovante}`}
                        className="btn-secondary"
                        style={{
                          width: "100%",
                          padding: 12,
                          fontSize: 13,
                          fontWeight: 700,
                          textAlign: "center",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          textDecoration: "none",
                        }}
                      >
                        <MailIcon size={16} /> Enviar Comprovante por E-mail
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Retorno */}
              <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
                <Link href="/hands-on/" className="btn-secondary" style={{ flex: 1, textAlign: "center" }}>
                  ← Ver todos os Hands On
                </Link>
                <Link href="/" className="btn-primary" style={{ flex: 1, textAlign: "center" }}>
                  Página Inicial
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
