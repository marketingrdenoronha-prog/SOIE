"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";

interface Line {
  name: string;
  objective: string;
  funnelStage: string;
  categories: { name: string; themes: string[] }[];
}
interface ReviewData {
  token: string;
  status: string;
  brand: string;
  project: string;
  clientComment: string | null;
  strategy: {
    positioning: string | null;
    pillars: unknown;
    rationale: string | null;
    lines: Line[];
  };
}

const API = "/api/v1";

export function StrategyReviewClient({ token }: { token: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API}/public/strategy/${token}`);
      if (!res.ok) throw new Error("Link inválido ou expirado.");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function approve() {
    setBusy(true);
    await fetch(`${API}/public/strategy/${token}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorName: author || undefined }),
    });
    setBusy(false);
    setDone("approved");
  }

  async function sendChanges() {
    if (!comment.trim()) return;
    setBusy(true);
    await fetch(`${API}/public/strategy/${token}/request-changes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comment, authorName: author || undefined }),
    });
    setBusy(false);
    setDone("changes_requested");
  }

  if (error) return <Centered><p className="text-muted">{error}</p></Centered>;
  if (!data) return <Centered><p className="text-muted">Carregando…</p></Centered>;

  if (done) {
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border border-border bg-elevated p-8 text-center">
          <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full text-2xl ${done === "approved" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>
            {done === "approved" ? "✓" : "✎"}
          </div>
          <h1 className="text-lg font-semibold">
            {done === "approved" ? "Linha editorial aprovada!" : "Ajuste enviado."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {done === "approved"
              ? "A equipe foi notificada e vai seguir para a produção dos conteúdos."
              : "Seu comentário foi enviado para a equipe, que fará os ajustes na estratégia."}
          </p>
        </div>
      </Centered>
    );
  }

  const alreadyDecided = data.status === "approved" || data.status === "changes_requested";
  const pillars = Array.isArray(data.strategy.pillars) ? data.strategy.pillars : [];

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-elevated">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <LogoMark className="h-8 w-8" />
          <div>
            <p className="text-sm font-semibold leading-tight">{data.brand}</p>
            <p className="text-xs text-muted">{data.project}</p>
          </div>
          <span className="ml-auto rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            Aprovação da linha editorial
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Linha editorial proposta</h1>
        <p className="mt-2 text-sm text-muted">
          Revise a estratégia editorial abaixo. Se estiver de acordo, aprove — a equipe segue para a
          produção. Se quiser mudar algo, peça ajuste e descreva o que precisa.
        </p>

        {alreadyDecided && (
          <div className={`mt-4 rounded-lg border p-3 text-sm ${data.status === "approved" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : "border-amber-500/40 bg-amber-500/10 text-amber-600"}`}>
            {data.status === "approved" ? "Esta linha editorial já foi aprovada." : "Ajuste já solicitado nesta linha editorial."}
            {data.clientComment && <p className="mt-1 text-muted">“{data.clientComment}”</p>}
          </div>
        )}

        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-elevated p-5">
          {data.strategy.positioning && (
            <Field label="Posicionamento"><p className="text-sm">{data.strategy.positioning}</p></Field>
          )}
          {pillars.length > 0 && (
            <Field label="Pilares">
              <div className="flex flex-wrap gap-2">
                {pillars.map((p, i) => (
                  <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">
                    {typeof p === "string" ? p : JSON.stringify(p)}
                  </span>
                ))}
              </div>
            </Field>
          )}
          {data.strategy.rationale && (
            <Field label="Racional"><p className="text-sm text-muted">{data.strategy.rationale}</p></Field>
          )}

          <Field label="Eixos de conteúdo">
            <div className="space-y-3">
              {data.strategy.lines.map((line, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{line.name}</p>
                    <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{line.objective}</span>
                    <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{line.funnelStage}</span>
                  </div>
                  {line.categories.map((c, j) => (
                    <div key={j} className="mt-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {c.themes.map((t, k) => (
                          <span key={k} className="rounded-md border border-border px-2 py-0.5 text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Field>
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-border bg-elevated/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Seu nome (opcional)"
            className="hidden w-44 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand sm:block"
          />
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setAdjusting(true)}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
            >
              Solicitar ajuste
            </button>
            <button
              onClick={approve}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Aprovar linha editorial
            </button>
          </div>
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAdjusting(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-elevated p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Solicitar ajuste</h2>
            <p className="mt-1 text-sm text-muted">Descreva o que precisa mudar na linha editorial. A equipe recebe seu comentário na hora.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: focar menos em institucional e mais em prova social; incluir um pilar sobre bastidores…"
              className="mt-4 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAdjusting(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface">
                Cancelar
              </button>
              <button
                onClick={sendChanges}
                disabled={busy || !comment.trim()}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Enviar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-surface p-4">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
