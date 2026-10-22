"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  HANDS_ON_LIST,
  type HandsOnItem,
  formatarReais,
} from "@/lib/hands-on-data";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ArrowRightIcon,
  SparkleIcon,
  ShieldCheckIcon,
} from "@/components/Icons";

export default function HandsOnPage() {
  return (
    <Suspense fallback={<HandsOnFallback />}>
      <HandsOnContent />
    </Suspense>
  );
}

function HandsOnFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Carregando Hands On…</p>
      </main>
      <SiteFooter />
    </div>
  );
}

function HandsOnContent() {
  const searchParams = useSearchParams();
  const initialDia = searchParams.get("dia");

  const [activeTab, setActiveTab] = useState<"todos" | "quinta" | "sexta">(
    initialDia === "quinta" ? "quinta" : initialDia === "sexta" ? "sexta" : "todos"
  );

  useEffect(() => {
    if (initialDia === "quinta" || initialDia === "sexta") {
      setActiveTab(initialDia);
    }
  }, [initialDia]);

  const quintaItems = HANDS_ON_LIST.filter((h) => h.diaId === "quinta");
  const sextaItems = HANDS_ON_LIST.filter((h) => h.diaId === "sexta");

  const displayedItems =
    activeTab === "quinta"
      ? quintaItems
      : activeTab === "sexta"
      ? sextaItems
      : HANDS_ON_LIST;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.45 }} />

        <div className="container-page" style={{ position: "relative", padding: "48px 24px 80px" }}>
          {/* Hero Header */}
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                background: "rgba(212, 168, 83, 0.12)",
                border: "1px solid rgba(212, 168, 83, 0.3)",
                color: "var(--gold)",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 16,
              }}
            >
              <SparkleIcon size={14} color="var(--gold)" />
              Workshops Práticos · 3º COPOL 2026
            </div>

            <h1
              style={{
                fontSize: "clamp(28px, 4.5vw, 42px)",
                fontWeight: 800,
                lineHeight: 1.15,
                margin: "0 0 16px",
                letterSpacing: "-0.02em",
              }}
            >
              Hands On Odontologia
            </h1>

            <p
              style={{
                fontSize: "clamp(15px, 2vw, 17px)",
                color: "var(--muted-foreground)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Experiência prática intensiva em manequins, biomodelos e equipamentos modernos.
              Turmas com <strong style={{ color: "var(--foreground)" }}>vagas limitadas</strong> para
              máximo aproveitamento individual. Pagamento 100% facilitado via{" "}
              <strong style={{ color: "var(--gold)" }}>Pix</strong>.
            </p>

            {/* Badges explicativas */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 24,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(45, 212, 191, 0.08)",
                  border: "1px solid rgba(45, 212, 191, 0.25)",
                  fontSize: 13,
                  color: "var(--primary)",
                  fontWeight: 600,
                }}
              >
                <ClockIcon size={15} /> Período da tarde (ver horários abaixo)
              </div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: "rgba(212, 168, 83, 0.08)",
                  border: "1px solid rgba(212, 168, 83, 0.25)",
                  fontSize: 13,
                  color: "var(--gold)",
                  fontWeight: 600,
                }}
              >
                <ShieldCheckIcon size={15} /> Pagamento direto via Pix
              </div>
            </div>
          </div>

          {/* Banner de Inscrições Pausadas */}
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto 32px",
              padding: "16px 20px",
              borderRadius: 12,
              background: "rgba(239, 68, 68, 0.12)",
              border: "1.5px solid rgba(239, 68, 68, 0.5)",
              color: "#fca5a5",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 18 }}>🔒</span>
            <span>Inscrições temporariamente pausadas pela organização do COPOL 2026.</span>
          </div>

          {/* Abas de Navegação dos Dias */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginBottom: 36,
              flexWrap: "wrap",
            }}
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "todos"}
              onClick={() => setActiveTab("todos")}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s ease",
                border:
                  activeTab === "todos"
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
                background:
                  activeTab === "todos" ? "var(--gold)" : "var(--muted)",
                color: activeTab === "todos" ? "#0B2928" : "var(--foreground)",
                boxShadow:
                  activeTab === "todos"
                    ? "0 4px 14px rgba(212, 168, 83, 0.25)"
                    : "none",
              }}
            >
              Todos os Hands On ({HANDS_ON_LIST.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "quinta"}
              onClick={() => setActiveTab("quinta")}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s ease",
                border:
                  activeTab === "quinta"
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
                background:
                  activeTab === "quinta" ? "var(--gold)" : "var(--muted)",
                color: activeTab === "quinta" ? "#0B2928" : "var(--foreground)",
                boxShadow:
                  activeTab === "quinta"
                    ? "0 4px 14px rgba(212, 168, 83, 0.25)"
                    : "none",
              }}
            >
              Quinta 05/11 ({quintaItems.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "sexta"}
              onClick={() => setActiveTab("sexta")}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s ease",
                border:
                  activeTab === "sexta"
                    ? "1px solid var(--gold)"
                    : "1px solid var(--border)",
                background:
                  activeTab === "sexta" ? "var(--gold)" : "var(--muted)",
                color: activeTab === "sexta" ? "#0B2928" : "var(--foreground)",
                boxShadow:
                  activeTab === "sexta"
                    ? "0 4px 14px rgba(212, 168, 83, 0.25)"
                    : "none",
              }}
            >
              Sexta 06/11 ({sextaItems.length})
            </button>
          </div>

          {/* Grid de Cards dos Hands On */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 22,
            }}
          >
            {displayedItems.map((item) => (
              <HandsOnCard key={item.id} item={item} />
            ))}
          </div>

          {/* Seção Informativa de Apoio / Dúvidas */}
          <div
            className="card"
            style={{
              marginTop: 56,
              padding: "32px 28px",
              background: "linear-gradient(180deg, var(--muted) 0%, var(--background-deep) 100%)",
              border: "1px solid rgba(212, 168, 83, 0.25)",
            }}
          >
            <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 12px" }}>
                Informações Importantes sobre as Inscrições
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 18,
                  marginTop: 24,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: 18,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                >
                  <strong style={{ color: "var(--gold)", display: "block", marginBottom: 6, fontSize: 15 }}>
                    Horários dos Workshops
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Cada Hands On possui seu horário individual de início e término indicado no card. Atente-se aos horários para não haver sobreposição de atividades no mesmo dia.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: 18,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                >
                  <strong style={{ color: "var(--primary)", display: "block", marginBottom: 6, fontSize: 15 }}>
                    Pagamento via Pix
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    Ao submeter o formulário de cada Hands On, a tela gera instantaneamente o QR Code e o código Pix
                    Copia e Cola com baixa do valor exato.
                  </p>
                </div>

                <div
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: 18,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                >
                  <strong style={{ color: "var(--foreground)", display: "block", marginBottom: 6, fontSize: 15 }}>
                    Vagas Limitadas
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                    As vagas são estritamente limitadas para garantir manequins, biomodelos e kits individuais a todos os inscritos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function HandsOnCard({ item }: { item: HandsOnItem }) {
  const isGratuito = item.preco === 0;

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "24px 22px",
        borderRadius: 16,
        background: "var(--muted)",
        border: "1px solid var(--border)",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <div>
        {/* Cabeçalho do Card: Dia & Vagas */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--gold)",
              background: "rgba(212, 168, 83, 0.12)",
              padding: "4px 10px",
              borderRadius: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <CalendarIcon size={12} />
            {item.diaId === "quinta" ? "Quinta 05/11" : "Sexta 06/11"} · 14h–18h
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--primary)",
              background: "rgba(45, 212, 191, 0.12)",
              padding: "4px 10px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--primary)",
              }}
            />
            {item.vagas} vagas
          </span>
        </div>

        {/* Patrocínio (se houver) */}
        {item.patrocinio && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              padding: "3px 10px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "var(--gold-soft)",
              marginBottom: 10,
            }}
          >
            Patrocínio: {item.patrocinio}
          </div>
        )}

        {/* Título do Hands On */}
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.35,
            margin: "0 0 10px",
            color: "var(--foreground)",
          }}
        >
          {item.titulo}
        </h3>

        {/* Ministrante / Professor */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: "var(--gold)",
            fontSize: 14,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          <UserIcon size={15} />
          <span>{item.ministrante}</span>
        </div>

        {/* Descrição resumida */}
        <p
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            lineHeight: 1.55,
            margin: "0 0 18px",
          }}
        >
          {item.descricao}
        </p>
      </div>

      {/* Rodapé do Card: Preço e Botão de Ação */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 16,
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Investimento
          </span>
          <strong
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: isGratuito ? "var(--primary)" : "var(--gold)",
            }}
          >
            {formatarReais(item.preco)}
          </strong>
        </div>

        <button
          type="button"
          disabled
          style={{
            padding: "10px 18px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255, 255, 255, 0.08)",
            color: "var(--muted-foreground)",
            border: "1px solid var(--border)",
            cursor: "not-allowed",
            whiteSpace: "nowrap",
            opacity: 0.8,
          }}
        >
          <span>🔒 Inscrições Pausadas</span>
        </button>
      </div>
    </div>
  );
}
