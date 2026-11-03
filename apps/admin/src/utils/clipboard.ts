/**
 * Utilitário universal para copiar texto para a área de transferência.
 * Funciona tanto em contextos seguros (HTTPS) quanto em HTTP (ex: http://137.131.233.254:3011).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  // 1. Tenta a API moderna navigator.clipboard se disponível e em contexto seguro
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText falhou, tentando fallback via execCommand:", err);
    }
  }

  // 2. Fallback cross-browser usando textarea temporário + document.execCommand('copy')
  // Funciona perfeitamente em HTTP (ex: http://137.131.233.254:3011) e em qualquer navegador moderno
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Mantém o textarea invisível na tela mas selecionável pelo navegador
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      textArea.style.opacity = "0.01";
      textArea.setAttribute("readonly", "");

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        return true;
      }
    } catch (err) {
      console.error("Falha no fallback de cópia via document.execCommand:", err);
    }
  }

  return false;
}

/**
 * Faz download de um texto diretamente como arquivo (ex: .md ou .txt)
 */
export function downloadTextAsFile(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  try {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Erro ao fazer download do arquivo:", err);
  }
}
