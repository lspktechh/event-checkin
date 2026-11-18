import { useEffect, useState } from "react";

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
}

export interface AlertOptions {
  title?: string;
  buttonText?: string;
}

interface DialogState {
  isOpen: boolean;
  type: "alert" | "confirm";
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "warning";
  resolve: (value: boolean) => void;
}

type DialogListener = (state: DialogState | null) => void;
let activeListener: DialogListener | null = null;

export function registerDialogListener(listener: DialogListener) {
  activeListener = listener;
  return () => {
    if (activeListener === listener) {
      activeListener = null;
    }
  };
}

export function showConfirm(message: string, options?: ConfirmOptions): Promise<boolean> {
  if (!activeListener) {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    activeListener!({
      isOpen: true,
      type: "confirm",
      message,
      title: options?.title,
      confirmText: options?.confirmText || "OK",
      cancelText: options?.cancelText || "Cancelar",
      variant: options?.variant || "primary",
      resolve: (val) => {
        if (activeListener) activeListener(null);
        resolve(val);
      },
    });
  });
}

export function showAlert(message: string, options?: AlertOptions): Promise<void> {
  if (!activeListener) {
    window.alert(message);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    activeListener!({
      isOpen: true,
      type: "alert",
      message,
      title: options?.title,
      confirmText: options?.buttonText || "OK",
      resolve: () => {
        if (activeListener) activeListener(null);
        resolve();
      },
    });
  });
}

export function DialogModal() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    const unregister = registerDialogListener((state) => {
      setDialog(state);
    });

    // Intercepta window.alert nativo para que qualquer chamada em código de terceiros
    // ou componentes existentes use o modal interno do sistema
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      void showAlert(typeof message === "string" ? message : String(message ?? ""));
    };

    return () => {
      unregister();
      window.alert = originalAlert;
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dialog?.resolve(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  if (!dialog || !dialog.isOpen) return null;

  const isDanger = dialog.variant === "danger";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
      }}
      onClick={() => dialog.resolve(false)}
    >
      <div
        className="card stack"
        style={{
          width: 440,
          maxWidth: "100%",
          gap: 16,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            color: isDanger ? "var(--danger)" : "var(--text)",
          }}
        >
          {dialog.title || (dialog.type === "confirm" ? "Confirmar ação" : "Atenção")}
        </h3>

        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {dialog.message}
        </p>

        <div
          className="row"
          style={{
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 8,
          }}
        >
          {dialog.type === "confirm" && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => dialog.resolve(false)}
            >
              {dialog.cancelText || "Cancelar"}
            </button>
          )}
          <button
            type="button"
            className={isDanger ? "btn btn-danger btn-sm" : "btn btn-sm"}
            onClick={() => dialog.resolve(true)}
            autoFocus
          >
            {dialog.confirmText || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
