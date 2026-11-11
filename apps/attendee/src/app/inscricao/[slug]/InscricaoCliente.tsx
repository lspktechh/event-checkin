"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAttendee, verifyEmail } from "@/lib/api";
import { PortalShell } from "@/components/portal/PortalShell";
import { CalendarIcon, ClockIcon, MapPinIcon, CheckCircleIcon } from "@/components/Icons";
import estilos from "@/components/portal/portal.module.css";

/**
 * Página pública de inscrição.
 *
 * O evento vem pelo SLUG, e não por um id cravado aqui: id no código
 * sobrevive ao evento e aponta para o lugar errado no ano seguinte.
 *
 * Depois de inscrever, a pessoa é levada direto para o QR Code — sem
 * pedir que "entre de novo com o e-mail". Ela acabou de digitar o
 * e-mail; pedir outra vez seria burocracia inventada.
 */

const VERSAO_DO_TERMO = "1.0";

interface Evento {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string;
  registrationsOpen: boolean;
  registrationInPortal?: boolean;
  siteContent: Conteudo | null;
}

interface Tema {
  primaria?: string;
  primariaEscura?: string;
  primariaClara?: string;
  acento?: string;
  gradiente?: string[];
}

interface RegistrationFormConfig {
  fields?: {
    name?: boolean;
    email?: boolean;
    cpf?: boolean;
    phone?: boolean;
  };
  customTitle?: string | null;
  customDescription?: string | null;
  bannerUrl?: string | null;
}

interface Conteudo {
  tema?: Tema;
  heroTitulo?: string;
  heroSubtitulo?: string;
  heroTexto?: string;
  local?: string;
  cargaHoraria?: string;
  realizacao?: string[];
  destaques?: { titulo: string; texto: string }[];
  /** Inscrição em equipe (ex.: maratonas de programação). Ausente = individual. */
  equipe?: { tamanho: number };
  bannerUrl?: string | null;
  imageUrl?: string | null;
  registrationForm?: RegistrationFormConfig;
}

/** Máscara de CPF, aplicada enquanto digita. */
function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function formatarTelefone(v: string): string {
  const clean = v.replace(/^\+55\s*/, "");
  let d = clean.replace(/\D/g, "");
  if ((d.length >= 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }
  d = d.slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Valida o CPF pelos dígitos verificadores.
 *
 * Contar 11 dígitos não basta: "11111111111" tem onze. Um CPF inválido só
 * apareceria no dia do credenciamento, quando não dá mais para corrigir.
 */
function cpfValido(bruto: string): boolean {
  const cpf = bruto.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export function InscricaoCliente({ slug }: { slug: string }) {
  const router = useRouter();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroDaPagina, setErroDaPagina] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aceite, setAceite] = useState(false);

  async function handleEmailBlur() {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailSuggestion(null);
      setEmailError(null);
      return;
    }
    try {
      const res = await verifyEmail(trimmed);
      if (!res.valid) {
        setEmailSuggestion(res.suggestion || null);
        setEmailError(res.reason || "E-mail inválido ou inexistente.");
      } else {
        setEmailSuggestion(null);
        setEmailError(null);
      }
    } catch {
      // Ignora erro de rede no blur
    }
  }

  // Inscrição em equipe (ver Conteudo.equipe): nomeEquipe + o nome de cada
  // integrante ALÉM do líder (que já é a pessoa preenchendo o formulário
  // acima). Fica vazio/sem efeito em qualquer evento sem inscrição em equipe.
  const [nomeEquipe, setNomeEquipe] = useState("");
  const [integrantes, setIntegrantes] = useState<string[]>([]);
  const [semEquipe, setSemEquipe] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/publico/evento/${encodeURIComponent(slug)}`)
      .then(async (r) => {
        const corpo = await r.json();
        if (!r.ok || !corpo?.data) throw new Error(corpo?.error?.message ?? "Evento não encontrado");
        setEvento(corpo.data);
        const tamanho = corpo.data?.siteContent?.equipe?.tamanho;
        if (typeof tamanho === "number" && tamanho > 1) {
          setIntegrantes(Array.from({ length: tamanho - 1 }, () => ""));
        }
      })
      .catch((e) => setErroDaPagina(e instanceof Error ? e.message : "Não consegui carregar o evento"))
      .finally(() => setCarregando(false));
  }, [slug]);

  const c: Conteudo = evento?.siteContent ?? {};
  const equipeConfig = c.equipe;

  const formFields = c.registrationForm?.fields ?? { name: true, email: true, cpf: true, phone: false };
  const exigeNome = formFields.name !== false;
  const exigeEmail = formFields.email !== false;
  const exigeCpf = formFields.cpf !== false;
  const exigeTelefone = formFields.phone === true;

  const banner = c.bannerUrl || c.registrationForm?.bannerUrl || c.imageUrl;
  const tituloExibicao = c.registrationForm?.customTitle || c.heroTitulo || evento?.name || "";
  const descricaoExibicao = c.registrationForm?.customDescription || c.heroTexto || evento?.description || null;

  const dataFormatada = evento
    ? new Date(evento.startDate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const horaInicioFormatada = evento
    ? new Date(evento.startDate).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const horaFimFormatada = evento?.endDate
    ? new Date(evento.endDate).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const horarioFormatado =
    horaFimFormatada && horaFimFormatada !== horaInicioFormatada
      ? `${horaInicioFormatada} às ${horaFimFormatada}`
      : horaInicioFormatada;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!evento) return;
    setErro(null);

    if (exigeNome && !nome.trim()) {
      setErro("Informe seu nome completo.");
      return;
    }
    if (exigeEmail && !email.trim()) {
      setErro("Informe seu e-mail.");
      return;
    }
    if (exigeCpf && !cpfValido(cpf)) {
      setErro("Confira o CPF — os dígitos não batem.");
      return;
    }
    if (exigeTelefone && !telefone.trim()) {
      setErro("Informe seu número de celular / WhatsApp.");
      return;
    }
    if (!aceite) {
      setErro("É preciso aceitar o uso dos seus dados para concluir a inscrição.");
      return;
    }
    if (equipeConfig && !semEquipe) {
      if (!nomeEquipe.trim()) {
        setErro("Informe o nome da equipe.");
        return;
      }
      if (integrantes.some((i) => !i.trim())) {
        setErro(`Informe o nome dos ${integrantes.length} outros integrantes da equipe.`);
        return;
      }
    }

    setEnviando(true);
    try {
      const r = await fetch("/api/publico/inscricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: evento.id,
          name: nome.replace(/\s+/g, " ").trim(),
          email: email.trim().toLowerCase(),
          document: exigeCpf ? cpf.replace(/\D/g, "") : null,
          phone: telefone.replace(/\D/g, "") || null,
          consentVersion: VERSAO_DO_TERMO,
          ...(equipeConfig
            ? semEquipe
              ? { soloParaSorteio: true }
              : { teamName: nomeEquipe.trim(), teamMembers: integrantes.map((i) => i.trim()) }
            : {}),
        }),
      });

      const corpo = await r.json();
      if (!r.ok) {
        const detalhe =
          corpo?.error?.details?.fieldErrors &&
          Object.values(corpo.error.details.fieldErrors).flat().filter(Boolean).join(" ");
        throw new Error(detalhe || corpo?.error?.message || "Não consegui concluir a inscrição.");
      }

      // Já entra na área do participante: o QR Code aparece na sequência,
      // sem pedir para digitar o e-mail de novo.
      try {
        const login = await loginAttendee(email.trim().toLowerCase());
        if (login.data.token) {
          localStorage.setItem("attendee_token", login.data.token);
          localStorage.setItem("attendee_data", JSON.stringify(login.data.participant));
          router.push("/checkin");
          return;
        }
      } catch {
        // A inscrição JÁ está feita. Falhar aqui não pode parecer que
        // nada aconteceu — a tela abaixo explica o que fazer.
      }
      router.push(`/?inscrito=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui concluir a inscrição.");
    } finally {
      setEnviando(false);
    }
  }


  if (carregando) {
    return (
      <PortalShell aba="inscricao">
        <p className={estilos.estado}>Carregando…</p>
      </PortalShell>
    );
  }

  if (erroDaPagina || !evento) {
    return (
      <PortalShell aba="inscricao">
        <section className={estilos.secao}>
          <h1 className={estilos.titulo}>Inscrições Indisponíveis</h1>
          <p className={estilos.lead}>
            Este evento não está disponível para inscrição ou já foi encerrado.
          </p>
          <p className={estilos.centro}>
            <Link href="/inscricao">Ver outras inscrições abertas</Link>
          </p>
        </section>
      </PortalShell>
    );
  }

  const isEcohub = slug.toLowerCase().includes("ecohub");

  // Evento que já começou deixa de ser "o próximo".
  const jaComecou = new Date(evento.startDate).getTime() < Date.now();

  // Linha de apoio sob a data: quem realiza, o certificado e o formato.
  const detalhes = [
    c.realizacao?.join(" · "),
    c.cargaHoraria ?? "Com certificado",
    equipeConfig ? `Em equipe · ${equipeConfig.tamanho} pessoas` : null,
  ].filter(Boolean);

  return (
    <PortalShell aba="inscricao">
      <div style={{ marginBottom: "16px" }}>
        <Link
          href="/inscricao"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
            color: "var(--link)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Ver todos os eventos
        </Link>
      </div>

      <div className={estilos.layoutInscricao}>
        {/* Painel com detalhes do evento */}
        <section className={`${estilos.cartaoModerno} ${estilos.painelDetalhes}`}>
          {banner && (
            <div className={estilos.bannerHero}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={banner} alt={tituloExibicao} />
            </div>
          )}
          {isEcohub && (
            <div className={estilos.logoParceiro}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/partners/ecohub-rodape.png"
                alt="Ecohub — ecossistema de inovação"
                className={estilos.logoParceiroImg}
              />
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span className={estilos.badgeAberto}>
              <span className={estilos.pontoAberto}></span>
              {jaComecou ? "Inscrições abertas" : "Próximo evento"}
            </span>
            <h1 className={estilos.titulo} style={{ marginTop: "4px" }}>{tituloExibicao}</h1>
            {c.heroSubtitulo && <p className={estilos.subtituloEvento}>{c.heroSubtitulo}</p>}
          </div>

          <div className={estilos.chipsContainer}>
            {dataFormatada && (
              <span className={estilos.chip} title="Data do evento">
                <CalendarIcon size={14} color="#3b5bff" />
                {dataFormatada}
              </span>
            )}
            {horarioFormatado && (
              <span className={estilos.chip} title="Horário">
                <ClockIcon size={14} color="#3b5bff" />
                {horarioFormatado}
              </span>
            )}
            {(c.local || evento.location) && (
              <span className={estilos.chip} title="Local">
                <MapPinIcon size={14} color="#3b5bff" />
                {c.local ?? evento.location}
              </span>
            )}
            <span className={`${estilos.chip} notranslate`} translate="no" title="Certificado">
              <CheckCircleIcon size={14} color="#10b981" />
              {c.cargaHoraria ?? "Com certificado"}
            </span>
          </div>

          {descricaoExibicao && (
            <p className={estilos.lead} style={{ margin: "4px 0 0", fontSize: "14px", lineHeight: "1.6" }}>
              {descricaoExibicao}
            </p>
          )}

          {c.destaques && c.destaques.length > 0 && (
            <div className={estilos.destaques}>
              {c.destaques.map((d) => (
                <article key={d.titulo} className={estilos.destaque}>
                  <h2>{d.titulo}</h2>
                  <p>{d.texto}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Formulário de Inscrição */}
        <section className={estilos.cartaoModerno}>
          <div style={{ marginBottom: "20px" }}>
            <h2
              className="notranslate"
              translate="no"
              style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px", color: "var(--tinta)" }}
            >
              Formulário de Inscrição
            </h2>
            <p className={estilos.lead} style={{ fontSize: "14px", margin: 0 }}>
              Preencha seus dados para receber o QR Code de acesso e certificado.
            </p>
          </div>

          {(!evento.registrationsOpen || evento.registrationInPortal === false) ? (
            <div style={{ textAlign: "center", padding: "28px 16px", background: "rgba(255,255,255,0.02)", borderRadius: "14px", border: "1px solid var(--linha)" }}>
              <p className={estilos.fechado} style={{ fontSize: "15px", fontWeight: 600, margin: "0 0 10px" }}>
                As inscrições para este evento estão encerradas.
              </p>
              <p className={estilos.lead} style={{ fontSize: "14px", margin: "0 0 18px" }}>
                Novas inscrições não estão sendo aceitas no momento.
              </p>
              <Link href="/" className={estilos.botao} style={{ display: "inline-flex", textDecoration: "none", width: "auto", padding: "0 20px" }}>
                Já é inscrito? Acesse seu QR Code
              </Link>
            </div>
          ) : (
            <form onSubmit={enviar} className={estilos.form} noValidate id="inscricao">
            {exigeNome && (
              <label className={estilos.campo}>
                Nome completo
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Seu nome completo"
                />
                <small>O nome sairá exatamente como você escrever no certificado.</small>
              </label>
            )}

            {exigeEmail && (
              <label className={estilos.campo}>
                E-mail
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError || emailSuggestion) {
                      setEmailError(null);
                      setEmailSuggestion(null);
                    }
                  }}
                  onBlur={handleEmailBlur}
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                />
                <small>É por ele que você acessa seu QR Code e o certificado.</small>
                {emailSuggestion && (
                  <div className={estilos.sugestao}>
                    <span>
                      Você quis dizer <strong>{emailSuggestion}</strong>?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(emailSuggestion);
                        setEmailSuggestion(null);
                        setEmailError(null);
                      }}
                    >
                      Corrigir
                    </button>
                  </div>
                )}
                {emailError && !emailSuggestion && (
                  <span role="alert" className={estilos.erroCampo}>
                    {emailError}
                  </span>
                )}
              </label>
            )}

            {exigeCpf && (
              <label className={estilos.campo}>
                CPF
                <input
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  required
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                />
              </label>
            )}

            {exigeTelefone && (
              <label className={estilos.campo}>
                Celular / WhatsApp
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                />
              </label>
            )}

            {equipeConfig && (
              <>
                <label className={estilos.aceite}>
                  <input
                    type="checkbox"
                    checked={semEquipe}
                    onChange={(e) => setSemEquipe(e.target.checked)}
                  />
                  <span>
                    Não tenho equipe formada — quero ser alocado(a) em uma equipe sorteada pela
                    organização.
                  </span>
                </label>

                {!semEquipe && (
                  <>
                    <label className={estilos.campo}>
                      Nome da equipe
                      <input
                        value={nomeEquipe}
                        onChange={(e) => setNomeEquipe(e.target.value)}
                        required
                        placeholder="Nome da sua equipe"
                      />
                      <small>
                        Você é o líder/representante da equipe. Informe abaixo o nome dos outros{" "}
                        {integrantes.length} integrantes — cada um recebe certificado individual.
                      </small>
                    </label>

                    {integrantes.map((valor, i) => (
                      <label className={estilos.campo} key={i}>
                        {`Integrante ${i + 2} — nome completo`}
                        <input
                          value={valor}
                          onChange={(e) => {
                            const proximos = [...integrantes];
                            proximos[i] = e.target.value;
                            setIntegrantes(proximos);
                          }}
                          required
                          placeholder="Nome completo"
                        />
                      </label>
                    ))}
                  </>
                )}
              </>
            )}

            <label className={estilos.aceite}>
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
              <span>
                Autorizo o uso dos meus dados para credenciamento, controle de presença e emissão
                do certificado deste evento.
              </span>
            </label>

            {erro && (
              <p role="alert" className={estilos.erro}>
                {erro}
              </p>
            )}

            <button type="submit" className={`${estilos.botao} ${estilos.espaco}`} disabled={enviando}>
              {enviando ? "Enviando…" : "Confirmar inscrição"}
            </button>

            <p className={estilos.centro}>
              Já se inscreveu? <Link href="/">Acesse seu QR Code</Link>
            </p>
          </form>
        )}
        </section>
      </div>
    </PortalShell>
  );
}
