"use client";

import { useEffect } from "react";

/** Segment error boundary for all authenticated pages. Replaces Next.js's bare
 * "Application error: a client-side exception has occurred" white screen with a
 * recoverable UI, so a single bad render never takes down the whole app. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app segment error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md pt-16 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-rose-500/15 text-2xl text-rose-500">
        !
      </div>
      <h1 className="text-lg font-semibold">Algo deu errado ao exibir esta página</h1>
      <p className="mt-2 text-sm text-muted">
        Ocorreu um erro ao renderizar o conteúdo. Você pode tentar novamente; se
        persistir, tente regenerar o item ou recarregar a página.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Tentar novamente
        </button>
        <button
          onClick={() => location.reload()}
          className="rounded-lg border border-border px-5 py-2 text-sm font-medium hover:bg-surface"
        >
          Recarregar
        </button>
      </div>
    </div>
  );
}
