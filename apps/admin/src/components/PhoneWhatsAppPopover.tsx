import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import * as api from "../api/client";
import { formatPhone } from "../utils/formatters";
import {
  isParticipantSemEquipe,
  isTeamEvent,
  getWhatsAppInviteMessage,
  getWhatsAppInviteUrl,
  generateInscriptionMarkdown,
  parseInscriptionNotes,
} from "../utils/inscriptionMarkdown";
import { CopyIcon, WhatsAppIcon, XIcon, CheckIcon } from "./Icons";
import { copyTextToClipboard } from "../utils/clipboard";

interface PhoneWhatsAppPopoverProps {
  item: api.InscriptionReportItem;
  eventName?: string;
  isTeamEvent?: boolean;
  onNotify?: (message: string) => void;
  /** Variante compacta para células de tabela */
  compact?: boolean;
}

export function PhoneWhatsAppPopover({
  item,
  eventName = "INOVA SAÚDE 2026",
  isTeamEvent: isTeamProp,
  onNotify,
  compact = false,
}: PhoneWhatsAppPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedFicha, setCopiedFicha] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTeam = isTeamProp ?? isTeamEvent(eventName);
  const isSemEquipe = isTeam && isParticipantSemEquipe(item, eventName);
  const notes = parseInscriptionNotes(item);
  const member = notes?.membros_detalhes?.[0] || notes?.payload_completo?.lider;
  const curso = member?.curso?.trim() || item.institution?.trim();
  const vinculo = member?.vinculo?.trim();

  const formattedPhone = formatPhone(item.phone || member?.telefone);
  const inviteMessage = getWhatsAppInviteMessage(item, eventName);
  const inviteUrl = getWhatsAppInviteUrl(item, eventName);

  const updateCoordinates = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 360;
    const estimatedHeight = 340;

    const placeAbove = rect.bottom + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
    const top = placeAbove ? rect.top - 8 : rect.bottom + 8;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - popoverWidth - 12));

    setPopoverCoords({ top, left, placeAbove });
  }, []);

  function handleMouseEnter() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updateCoordinates();
    setIsOpen(true);
  }

  function handleMouseLeave() {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  }

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isOpen) {
      updateCoordinates();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }

  // Fecha com ESC ou clique fora
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updateCoordinates();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updateCoordinates]);

  async function handleCopyMessage(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const ok = await copyTextToClipboard(inviteMessage);
      if (ok) {
        setCopiedMsg(true);
        if (onNotify) onNotify("Mensagem de WhatsApp copiada!");
        setTimeout(() => setCopiedMsg(false), 2000);
      }
    } catch {
      // Falha silenciosa
    }
  }

  async function handleCopyFicha(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const md = generateInscriptionMarkdown(item, eventName);
      const ok = await copyTextToClipboard(md);
      if (ok) {
        setCopiedFicha(true);
        if (onNotify) onNotify(`Ficha completa em Markdown de ${item.name} copiada!`);
        setTimeout(() => setCopiedFicha(false), 2200);
      }
    } catch {
      // Falha silenciosa
    }
  }

  if (!item.phone && !member?.telefone) {
    return <span className="muted">—</span>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={toggleOpen}
        title={
          isSemEquipe
            ? "⚠️ Participante sem equipe. Passe o mouse ou clique para ver convite de WhatsApp e copiar ficha completa."
            : "Passe o mouse ou clique para conversar no WhatsApp e copiar ficha."
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          cursor: "pointer",
          padding: compact ? "2px 6px" : "3px 8px",
          borderRadius: 6,
          background: isSemEquipe ? "rgba(37, 211, 102, 0.12)" : "rgba(255, 255, 255, 0.05)",
          border: isSemEquipe ? "1px solid rgba(37, 211, 102, 0.35)" : "1px solid rgba(255, 255, 255, 0.1)",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
      >
        <span
          style={{
            color: "#25D366",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <WhatsAppIcon size={compact ? 13 : 15} />
        </span>

        <span
          style={{
            fontWeight: 500,
            fontSize: compact ? 12 : 13,
            color: isSemEquipe ? "#4ade80" : "var(--text)",
          }}
        >
          {formattedPhone}
        </span>

        {isSemEquipe && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 4px",
              borderRadius: 4,
              background: "rgba(234, 179, 8, 0.2)",
              color: "#ffb340",
              border: "1px solid rgba(234, 179, 8, 0.4)",
              letterSpacing: 0.2,
            }}
          >
            SEM EQUIPE
          </span>
        )}
      </div>

      {isOpen &&
        popoverCoords &&
        createPortal(
          <div
            ref={popoverRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{
              position: "fixed",
              top: popoverCoords.placeAbove ? undefined : popoverCoords.top,
              bottom: popoverCoords.placeAbove ? window.innerHeight - popoverCoords.top : undefined,
              left: popoverCoords.left,
              width: 360,
              maxWidth: "calc(100vw - 24px)",
              background: "rgba(28, 28, 30, 0.98)",
              border: "1px solid rgba(84, 84, 88, 0.75)",
              borderRadius: 14,
              boxShadow: "0 20px 45px -8px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              padding: "14px 16px",
              zIndex: 99999,
              color: "var(--text, #fff)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              animation: "fadeIn 0.15s ease-out",
            }}
          >
            {/* Cabeçalho do Popover */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: "#25D366",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#000",
                  }}
                >
                  <WhatsAppIcon size={16} color="#000" />
                </span>
                <strong style={{ fontSize: 13, color: "#fff" }}>
                  {isSemEquipe ? "Convidar para Equipe no WhatsApp" : "Chamar no WhatsApp"}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 4,
                  display: "inline-flex",
                  borderRadius: 4,
                }}
                aria-label="Fechar"
              >
                <XIcon size={14} />
              </button>
            </div>

            {/* Identificação do Participante */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.07)",
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{item.name}</span>
                {isTeam ? (
                  isSemEquipe ? (
                    <span
                      className="badge"
                      style={{
                        background: "rgba(234, 179, 8, 0.2)",
                        color: "#ffb340",
                        borderColor: "rgba(234, 179, 8, 0.4)",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      Banco de Talentos
                    </span>
                  ) : (
                    <span className="badge badge-success" style={{ fontSize: 10 }}>
                      {item.teamName || "Com Equipe"}
                    </span>
                  )
                ) : null}
              </div>

              <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>📱 {formattedPhone}</span>
                {curso && <span>🎓 {curso}</span>}
                {isTeam && vinculo && <span>💼 {vinculo}</span>}
              </div>
            </div>

            {/* Mensagem Pré-formatada */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Mensagem Pré-Formatada:</span>
                <span style={{ fontSize: 10, color: "#25D366" }}>Pronta para envio</span>
              </div>

              <div
                style={{
                  background: "rgba(0, 0, 0, 0.5)",
                  border: "1px solid rgba(84, 84, 88, 0.4)",
                  borderRadius: 8,
                  padding: "9px 11px",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--text)",
                  maxHeight: 130,
                  overflowY: "auto",
                  whiteSpace: "pre-line",
                  userSelect: "text",
                }}
              >
                {inviteMessage}
              </div>
            </div>

            {/* Barra de Ações Principais */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {inviteUrl ? (
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{
                      flex: 1,
                      background: "#25D366",
                      color: "#000",
                      fontWeight: 700,
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "7px 10px",
                      fontSize: 12,
                      textDecoration: "none",
                      borderRadius: 6,
                    }}
                  >
                    <WhatsAppIcon size={15} color="#000" />
                    <span>Abrir no WhatsApp</span>
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="btn btn-secondary btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "7px 10px",
                    fontSize: 12,
                  }}
                  title="Copiar texto da mensagem para a área de transferência"
                >
                  {copiedMsg ? <CheckIcon size={14} color="#30d158" /> : <CopyIcon size={14} />}
                  <span>{copiedMsg ? "Copiado!" : "Copiar Texto"}</span>
                </button>
              </div>

              {/* Botão de Copiar Ficha Completa em Markdown */}
              <button
                type="button"
                onClick={handleCopyFicha}
                className="btn btn-secondary btn-sm"
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "7px 10px",
                  fontSize: 12,
                  background: copiedFicha ? "rgba(48, 209, 88, 0.15)" : undefined,
                  borderColor: copiedFicha ? "#30d158" : undefined,
                  color: copiedFicha ? "#30d158" : undefined,
                }}
                title="Copia todos os dados cadastrais e respostas do participante em formato Markdown"
              >
                {copiedFicha ? <CheckIcon size={14} color="#30d158" /> : <CopyIcon size={14} />}
                <span>{copiedFicha ? "Ficha Markdown Copiada! ✓" : "Copiar Ficha Completa (Markdown)"}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
