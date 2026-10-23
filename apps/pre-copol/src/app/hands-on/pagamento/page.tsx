"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  getHandsOnInscription,
  saveHandsOnInscription,
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
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) {
      setCarregando(false);
      return;
    }
    const record = getHandsOnInscription(id);
    if (record) {
      setInscricao(record);
      setCarregando(false);
    }

    // Se não encontrou no localStorage local, busca da API central pública
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://137-131-233-254.sslip.io";
    fetch(`${apiUrl}/public/hands-on/inscriptions/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          setInscricao((prev) => {
            const merged: HandsOnInscription = {
              id: d.id,
              handsOnId: d.handsOnId,
              handsOnTitulo: d.title,
              ministrante: d.speaker,
              diaSemana: d.date === "2026-11-05" ? "Quinta-feira, 05/11/2026" : "Sexta-feira, 06/11/2026",
              horario: d.time,
              preco: Number(d.amount),
              local: d.location ?? undefined,
              nome: d.name,
              email: d.email,
              documento: d.document,
              telefone: prev?.telefone || "",
              status: d.status === "CONFIRMED" ? "CONFIRMADO" : "PENDENTE",
              pixKey: "",
              pixReceiverName: "COPOL 2026",
              pixCode: d.pixCode || prev?.pixCode || "",
              pixQrCodeBase64: d.pixQrCodeBase64 || prev?.pixQrCodeBase64,
              mercadoPagoPaymentId: d.paymentId || prev?.mercadoPagoPaymentId,
              qrToken: d.qrToken,
              createdAt: prev?.createdAt || new Date().toISOString(),
            };
            saveHandsOnInscription(merged);
            return merged;
          });
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [id]);

  // Polling para detectar pagamento confirmado via Pix em tempo real
  useEffect(() => {
    if (!id || !inscricao || inscricao.status === "CONFIRMADO") return;

    let cancelado = false;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://137-131-233-254.sslip.io";

    async function checarStatus() {
      try {
        const res = await fetch(`${apiUrl}/public/hands-on/inscriptions/${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json?.data && (json.data.status === "CONFIRMED" || json.data.status === "CONFIRMADO")) {
          if (!cancelado) {
            setInscricao((prev) => {
              if (!prev) return prev;
              const atualizado: HandsOnInscription = {
                ...prev,
                status: "CONFIRMADO",
                qrToken: json.data.qrToken || prev.qrToken,
              };
              saveHandsOnInscription(atualizado);
              return atualizado;
            });
          }
        }
      } catch {
        // Ignora erros transitórios no loop de polling
      }
    }

    const timer = setInterval(checarStatus, 3500);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, [id, inscricao?.status]);

  function handleCopyPix() {
    if (!inscricao?.pixCode) return;
    navigator.clipboard.writeText(inscricao.pixCode).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
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
                  {inscricao.preco === 0 ? "Inscrição Confirmada · Gratuita" : "Pagamento Confirmado · Vaga Garantida"}
                </div>
                <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, margin: "14px 0 8px" }}>
                  Sua vaga está garantida!
                </h1>
                <p style={{ color: "var(--muted-foreground)", fontSize: 15, margin: 0 }}>
                  {inscricao.preco === 0
                    ? "Parabéns! Sua participação no Hands On gratuito foi registrada com sucesso."
                    : "Pagamento via Pix confirmado pelo Mercado Pago com sucesso. Apresente este QR Code na entrada do workshop."}
                </p>
              </div>

              {/* Card de Detalhes da Inscrição e Credenciamento */}
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

                {/* QR Code de Acesso / Credenciamento */}
                <div
                  style={{
                    textAlign: "center",
                    margin: "18px 0",
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: 12,
                    border: "1px dashed var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--muted-foreground)",
                      display: "block",
                      marginBottom: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    QR Code de Entrada / Credenciamento
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      inscricao.qrToken || `HO-${inscricao.id}`
                    )}`}
                    alt="QR Code de Credenciamento"
                    width={180}
                    height={180}
                    style={{
                      width: 180,
                      height: 180,
                      background: "#fff",
                      padding: 8,
                      borderRadius: 10,
                      display: "inline-block",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--primary)",
                      display: "block",
                      marginTop: 8,
                      fontFamily: "monospace",
                      fontWeight: 700,
                    }}
                  >
                    {inscricao.qrToken || `HO-${inscricao.id}`}
                  </span>
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
                  {inscricao.local && (
                    <div>
                      <span style={{ color: "var(--muted-foreground)", display: "block", fontSize: 12 }}>Local:</span>
                      <span style={{ color: "var(--foreground)" }}>{inscricao.local}</span>
                    </div>
                  )}
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

              {/* Aviso Crucial sobre Confirmação da Vaga */}
              <div
                style={{
                  width: "100%",
                  padding: "16px 18px",
                  borderRadius: 12,
                  background: "rgba(212, 168, 83, 0.12)",
                  border: "1.5px solid var(--gold)",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  textAlign: "left",
                }}
              >
                <AlertTriangleIcon size={24} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--foreground)" }}>
                  <strong style={{ color: "var(--gold)", display: "block", marginBottom: 3, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Atenção: Confirmação de Vaga
                  </strong>
                  A inscrição só será confirmada após a realização do pagamento. Enquanto o pagamento estiver pendente, a vaga continuará disponível para outros participantes, podendo ser preenchida a qualquer momento.
                </div>
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
                  {inscricao.pixQrCodeBase64 ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={`data:image/png;base64,${inscricao.pixQrCodeBase64}`}
                      alt="QR Code Pix Mercado Pago"
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
                  ) : inscricao.pixCode ? (
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
                  ) : null}

                  {/* Informação de Pagamento Automático */}
                  <div
                    style={{
                      width: "100%",
                      background: "rgba(34, 197, 94, 0.08)",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <span style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 600 }}>
                      Pix com confirmação automática e imediata no sistema
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

                  {/* Botão de Cópia Pix Copia e Cola */}
                  <div style={{ width: "100%" }}>
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="btn-primary"
                      style={{
                        width: "100%",
                        padding: 16,
                        fontSize: 15,
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
                          <CheckIcon size={20} /> Código Pix Copiado com Sucesso!
                        </>
                      ) : (
                        <>
                          <CopyIcon size={20} /> Copiar Código Pix Copia e Cola
                        </>
                      )}
                    </button>
                  </div>

                  {/* Orientações */}
                  <div
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "14px 18px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border)",
                      textAlign: "left",
                    }}
                  >
                    <strong style={{ fontSize: 13, color: "var(--foreground)", display: "block", marginBottom: 6 }}>
                      Instruções para pagamento:
                    </strong>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.6 }}>
                      <li>Abra o aplicativo do seu banco e acesse a área <strong>Pix</strong>.</li>
                      <li>Selecione <strong>Pix Copia e Cola</strong> ou aponte a câmera para o <strong>QR Code</strong> acima.</li>
                      <li>Confira o valor de <strong>{formatarReais(inscricao.preco)}</strong> e confirme o pagamento.</li>
                      <li>Assim que você pagar, esta tela será atualizada automaticamente e sua vaga estará confirmada!</li>
                    </ol>
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
