"use client";

import { useEffect } from "react";

/** Root error boundary — catches errors thrown in the root layout itself.
 * Must render its own <html>/<body>. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("global error", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Algo deu errado</h1>
          <p style={{ marginTop: 8, color: "#71717a", fontSize: 14 }}>
            Ocorreu um erro inesperado. Tente novamente.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 24, padding: "8px 20px", borderRadius: 8, background: "#4f46e5", color: "#fff", border: 0, fontWeight: 600, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
