"use client";

import { useEffect } from "react";

export default function RedirecionarTrabalhosCopol() {
  useEffect(() => {
    window.location.replace("https://lspkeventos.vercel.app/copol/trabalhos");
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "12px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#334155",
      }}
    >
      <p>Redirecionando para a consulta e reenvio de trabalhos do Copol...</p>
      <a
        href="https://lspkeventos.vercel.app/copol/trabalhos"
        style={{ color: "#2563eb", textDecoration: "underline" }}
      >
        Clique aqui caso não seja redirecionado automaticamente
      </a>
    </div>
  );
}
