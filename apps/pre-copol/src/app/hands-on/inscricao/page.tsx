"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  HANDS_ON_LIST,
  getHandsOnById,
  type HandsOnItem,
  saveHandsOnInscription,
  generatePixPayload,
  formatarReais,
  type HandsOnInscription,
  PIX_CONFIG,
} from "@/lib/hands-on-data";
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  AlertTriangleIcon,
  CheckIcon,
  ArrowRightIcon,
  MapPinIcon,
} from "@/components/Icons";
import { VERSAO_TERMOS } from "@/lib/termos";

export default function HandsOnInscricaoPage() {
  return (
    <Suspense fallback={<InscricaoFallback />}>
      <HandsOnInscricaoContent />
    </Suspense>
  );
}

function InscricaoFallback() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1, padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Carregando formulário…</p>
      </main>
      <SiteFooter />
    </div>
  );
}

function HandsOnInscricaoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idFromQuery = searchParams.get("id") ?? "";

  const [selectedId, setSelectedId] = useState<string>(
    idFromQuery || HANDS_ON_LIST[0]?.id || ""
  );

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [categoria, setCategoria] = useState("Aluno da Universidade Positivo");
  const [instituicao, setInstituicao] = useState("");
  const [aceitou, setAceitou] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (idFromQuery && HANDS_ON_LIST.some((h) => h.id === idFromQuery)) {
      setSelectedId(idFromQuery);
    }
  }, [idFromQuery]);

  const workshop: HandsOnItem =
    getHandsOnById(selectedId) || HANDS_ON_LIST[0]!;

  function formatCPF(val: string): string {
    const clean = val.replace(/\D/g, "").slice(0, 11);
    return clean
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(val: string): string {
    const clean = val.replace(/\D/g, "").slice(0, 11);
    if (clean.length <= 10) {
      return clean
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return clean
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }

  function isValidCPF(cpf: string): boolean {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += Number(clean.charAt(i)) * (10 - i);
    }
    let rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== Number(clean.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(clean.charAt(i)) * (11 - i);
    }
    rev = (sum * 10) % 11;
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== Number(clean.charAt(10))) return false;

    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();
    const docClean = documento.replace(/\D/g, "");

    if (!nomeTrim || nomeTrim.length < 3) {
      setErro("Informe seu nome completo (ao menos 3 letras).");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailTrim)) {
      setErro("Por favor, digite um e-mail válido.");
      return;
    }

    const typoTldRegex = /\.(ckm|con|cpm|cmo|gmai\.com|hotmai\.com|outloo\.com)$/i;
    if (typoTldRegex.test(emailTrim)) {
      setErro("O domínio do seu e-mail parece ter um erro de digitação (ex: .com). Revise antes de continuar.");
      return;
    }

    if (!isValidCPF(docClean)) {
      setErro("CPF inválido. Por favor, confira os 11 dígitos informados.");
      return;
    }

    if (!telefone.trim() || telefone.replace(/\D/g, "").length < 10) {
      setErro("Informe um telefone/WhatsApp válido com DDD.");
      return;
    }

    if (!aceitou) {
      setErro("Você precisa aceitar os termos de inscrição para continuar.");
      return;
    }

    setEnviando(true);

    try {
      // Gera ID único da inscrição
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      let inscriptionId = `HO-2026-${randSuffix}`;
      let finalQrToken = `HO-${randSuffix}-${Date.now()}`;

      // Envia ao backend central para persistência e controle de presença
      const targetEventId = "f1b36d08-e85d-459b-8606-69119ab05a78";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://137-131-233-254.sslip.io";

      try {
        const resp = await fetch(`${apiUrl}/events/${targetEventId}/hands-on/inscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handsOnId: workshop.id,
            title: workshop.titulo,
            speaker: workshop.ministrante,
            date: workshop.data,
            time: workshop.horario,
            location: workshop.local,
            sponsor: workshop.patrocinio,
            amount: workshop.preco,
            name: nomeTrim,
            email: emailTrim,
            document: docClean,
            phone: telefone,
            category: categoria,
            institution: instituicao.trim() || undefined,
          }),
        });

        if (resp.ok) {
          const json = await resp.json();
          if (json.data?.id) {
            inscriptionId = json.data.id;
            finalQrToken = json.data.qrToken;
          }
        }
      } catch (apiErr) {
        console.warn("Falha de conexão com a API central, prosseguindo com contingência local:", apiErr);
      }

      // Monta código Pix Copia e Cola
      const pixCode =
        workshop.preco > 0
          ? generatePixPayload({
              amount: workshop.preco,
              txid: inscriptionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25),
            })
          : "";

      const record: HandsOnInscription = {
        id: inscriptionId,
        handsOnId: workshop.id,
        handsOnTitulo: workshop.titulo,
        ministrante: workshop.ministrante,
        diaSemana: workshop.diaSemana,
        horario: workshop.horario,
        preco: workshop.preco,
        local: workshop.local,
        patrocinio: workshop.patrocinio,
        nome: nomeTrim,
        email: emailTrim,
        documento: documento,
        telefone: telefone,
        categoria: categoria,
        instituicao: instituicao.trim() || undefined,
        status: workshop.preco === 0 ? "CONFIRMADO" : "PENDENTE",
        pixKey: PIX_CONFIG.chave,
        pixReceiverName: PIX_CONFIG.titular,
        pixCode: pixCode,
        createdAt: new Date().toISOString(),
      };

      saveHandsOnInscription(record);

      // Redireciona para a tela de pagamento e confirmação
      router.push(`/hands-on/pagamento/?id=${encodeURIComponent(inscriptionId)}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao gerar inscrição.");
      setEnviando(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    background: "var(--background)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 15,
    color: "var(--foreground)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
    color: "var(--foreground)",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <main style={{ flex: 1, position: "relative" }}>
        <div className="wave-bg" style={{ opacity: 0.4 }} />

        <div className="container-page" style={{ position: "relative", padding: "40px 24px 72px", maxWidth: 720 }}>
          {/* Navegação de Volta */}
          <div style={{ marginBottom: 20 }}>
            <Link
              href="/hands-on/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                color: "var(--gold)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Ver todos os Hands On
            </Link>
          </div>

          <h1 style={{ fontSize: "clamp(24px, 3.5vw, 32px)", fontWeight: 800, margin: "0 0 8px" }}>
            Inscrição no Hands On
          </h1>
          <p style={{ color: "var(--muted-foreground)", margin: "0 0 28px", fontSize: 15 }}>
            Preencha seus dados para reservar sua vaga no workshop escolhido. O pagamento é realizado diretamente via Pix.
          </p>

          {/* Card de Resumo do Workshop Selecionado */}
          <div
            className="card"
            style={{
              padding: "22px 24px",
              marginBottom: 28,
              border: "1px solid rgba(212, 168, 83, 0.35)",
              background: "linear-gradient(180deg, var(--muted) 0%, rgba(21, 75, 76, 0.6) 100%)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Seletor do Hands On caso o usuário queira trocar */}
              <label style={{ ...labelStyle, fontSize: 13, color: "var(--gold)" }}>
                <span>WORKSHOP SELECIONADO:</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  style={{
                    ...inputStyle,
                    background: "var(--background-deep)",
                    borderColor: "var(--gold)",
                    color: "var(--foreground)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <optgroup label="Quinta-feira (05/11)">
                    {HANDS_ON_LIST.filter((h) => h.diaId === "quinta").map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.titulo} — {h.ministrante} ({formatarReais(h.preco)})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sexta-feira (06/11)">
                    {HANDS_ON_LIST.filter((h) => h.diaId === "sexta").map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.titulo} — {h.ministrante} ({formatarReais(h.preco)})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              {/* Informações detalhadas do workshop */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--gold)" }}>
                    <CalendarIcon size={14} /> {workshop.diaSemana}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--muted-foreground)" }}>
                    <ClockIcon size={14} /> {workshop.horario}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--primary)" }}>
                    <UserIcon size={14} /> {workshop.ministrante}
                  </span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", display: "block" }}>
                    Investimento
                  </span>
                  <strong style={{ fontSize: 18, color: workshop.preco === 0 ? "var(--primary)" : "var(--gold)" }}>
                    {formatarReais(workshop.preco)}
                  </strong>
                </div>
              </div>

              {workshop.patrocinio && (
                <div style={{ fontSize: 12, color: "var(--gold-soft)", fontWeight: 600 }}>
                  Patrocínio Oficial: <strong>{workshop.patrocinio}</strong>
                </div>
              )}

              {workshop.vagasTexto && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--primary)",
                    background: "rgba(45, 212, 191, 0.1)",
                    padding: "6px 12px",
                    borderRadius: 6,
                  }}
                >
                  {workshop.vagasTexto}
                </div>
              )}
            </div>
          </div>

          {/* Mensagem de Erro (se houver) */}
          {erro && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 10,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              <AlertTriangleIcon size={20} color="var(--destructive)" />
              <span>{erro}</span>
            </div>
          )}

          {/* Formulário de Inscrição */}
          <form
            onSubmit={handleSubmit}
            className="card"
            style={{
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
              Dados do Congressista
            </h2>

            {/* Nome Completo */}
            <label style={labelStyle}>
              Nome Completo *
              <input
                type="text"
                required
                style={inputStyle}
                placeholder="Ex: Dra. Mariana Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>

            {/* E-mail */}
            <label style={labelStyle}>
              E-mail *
              <input
                type="email"
                required
                style={inputStyle}
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <small style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>
                Usaremos este e-mail para enviar a confirmação da sua vaga.
              </small>
            </label>

            {/* CPF e Telefone (Grid 2 colunas) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <label style={labelStyle}>
                CPF *
                <input
                  type="text"
                  required
                  style={inputStyle}
                  placeholder="000.000.000-00"
                  value={documento}
                  onChange={(e) => setDocumento(formatCPF(e.target.value))}
                  maxLength={14}
                />
              </label>

              <label style={labelStyle}>
                WhatsApp / Celular com DDD *
                <input
                  type="tel"
                  required
                  style={inputStyle}
                  placeholder="(43) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(formatPhone(e.target.value))}
                  maxLength={15}
                />
              </label>
            </div>

            {/* Categoria / Vínculo e Instituição */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              <label style={labelStyle}>
                Categoria / Perfil *
                <select
                  style={inputStyle}
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="Aluno da Universidade Positivo">Aluno Universidade Positivo</option>
                  <option value="Aluno de outra instituição">Aluno de outra instituição</option>
                  <option value="Cirurgião-Dentista">Cirurgião-Dentista / Clínico</option>
                  <option value="Especialista / Pós-graduando">Especialista / Pós-graduando</option>
                  <option value="Professor">Professor / Docente</option>
                </select>
              </label>

              <label style={labelStyle}>
                Faculdade / Instituição (opcional)
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="Ex: Universidade Positivo, UEL, etc."
                  value={instituicao}
                  onChange={(e) => setInstituicao(e.target.value)}
                />
              </label>
            </div>

            {/* Aviso importante sobre confirmação de vaga */}
            <div
              style={{
                marginTop: 6,
                padding: "16px 18px",
                borderRadius: 12,
                background: "rgba(212, 168, 83, 0.12)",
                border: "1.5px solid var(--gold)",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangleIcon size={22} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--foreground)" }}>
                <strong style={{ color: "var(--gold)", display: "block", marginBottom: 2 }}>
                  AVISO IMPORTANTE SOBRE A SUA VAGA:
                </strong>
                A inscrição só será confirmada após a realização do pagamento. Enquanto o pagamento estiver pendente, a vaga continuará disponível para outros participantes, podendo ser preenchida a qualquer momento.
              </div>
            </div>

            {/* Aceite dos Termos */}
            <div
              style={{
                marginTop: 6,
                padding: "16px 18px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border)",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <input
                id="aceite-termos"
                type="checkbox"
                checked={aceitou}
                onChange={(e) => setAceitou(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 2,
                  accentColor: "var(--primary)",
                  cursor: "pointer",
                }}
              />
              <label
                htmlFor="aceite-termos"
                style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5, cursor: "pointer" }}
              >
                Declaro que li e concordo com o{" "}
                <Link
                  href="/termos/"
                  target="_blank"
                  style={{ color: "var(--gold)", textDecoration: "underline", fontWeight: 600 }}
                >
                  Regulamento e Termo de Inscrição (v{VERSAO_TERMOS})
                </Link>{" "}
                do 3º COPOL, e estou ciente de que as vagas para o Hands On são nominais e limitadas.
              </label>
            </div>

            {/* Botão de Envio */}
            <div style={{ marginTop: 10 }}>
              <button
                type="submit"
                disabled={enviando || !aceitou}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  fontSize: 16,
                  fontWeight: 800,
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  cursor: enviando || !aceitou ? "not-allowed" : "pointer",
                  opacity: enviando || !aceitou ? 0.6 : 1,
                  boxShadow: "0 4px 16px rgba(45, 212, 191, 0.3)",
                }}
              >
                {enviando ? (
                  "Processando inscrição…"
                ) : workshop.preco === 0 ? (
                  <>
                    <span>Confirmar Inscrição Gratuita</span>
                    <ArrowRightIcon size={18} />
                  </>
                ) : (
                  <>
                    <span>Prosseguir para o Pagamento via Pix ({formatarReais(workshop.preco)})</span>
                    <ArrowRightIcon size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
