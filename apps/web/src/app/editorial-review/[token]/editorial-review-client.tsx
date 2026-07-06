"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { arr, text } from "@/lib/render";

interface ReviewData {
  token: string;
  status: string;
  client: string;
  brand: string;
  project: string;
  strategy: {
    version: number;
    positioning: unknown;
    pillars: unknown;
    rationale: unknown;
    lines: Array<{
      name: unknown;
      objective: unknown;
      funnelStage: unknown;
      platforms: unknown;
      categories: Array<{ name: unknown; themes: Array<{ title: unknown; channel?: unknown; format?: unknown }> }>;
    }>;
  };
  history: Array<{ decision: string; comment: string | null; at: string; author: string | null }>;
}

const API = "/api/v1";

export function EditorialReviewClient({ token }: { token: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API}/public/editorial-review/${token}`);
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
    await fetch(`${API}/public/editorial-review/${token}/approve`, {
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
    await fetch(`${API}/public/editorial-review/${token}/request-changes`, {
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
          <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full text-2xl ${done === "approved" ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"}`}>
            {done === "approved" ? "✓" : "✎"}
          </div>
          <h1 className="text-lg font-semibold">
            {done === "approved" ? "Linha editorial aprovada!" : "Ajuste enviado."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {done === "approved"
              ? "A equipe foi notificada e seguirá para a produção dos conteúdos."
              : "Seu comentário foi enviado para a equipe, que criará/refinará a próxima versão."}
          </p>
        </div>
      </Centered>
    );
  }

  const decided = data.status === "approved" || data.status === "changes_requested";

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-elevated">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <LogoMark className="h-8 w-8" />
          <div>
            <p className="text-sm font-semibold leading-tight">{data.client}</p>
            <p className="text-xs text-muted">{data.brand} · {data.project}</p>
          </div>
          <span className="ml-auto rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            Revisão da linha editorial
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="label-caps text-muted">Linha editorial V{data.strategy.version}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Estratégia editorial proposta</h1>
        <p className="mt-2 text-sm text-muted">
          Revise a estratégia abaixo. Se estiver tudo certo, aprove para liberar a produção.
          Se quiser mudar algo, peça ajuste e descreva o que precisa.
        </p>

        {decided && (
          <div className={`mt-4 rounded-lg border p-3 text-sm ${data.status === "approved" ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/10 text-warn"}`}>
            {data.status === "approved" ? "Esta linha editorial já foi aprovada." : "Ajuste já solicitado nesta linha editorial."}
          </div>
        )}

        <div className="mt-6 space-y-5 rounded-2xl border border-border bg-elevated p-5">
          {text(data.strategy.positioning) && <Field label="Posicionamento">{text(data.strategy.positioning)}</Field>}
          {arr(data.strategy.pillars).length > 0 && (
            <Field label="Pilares">
              <div className="flex flex-wrap gap-2">
                {arr(data.strategy.pillars).map((p, i) => (
                  <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{text(p)}</span>
                ))}
              </div>
            </Field>
          )}
          {text(data.strategy.rationale) && <Field label="Racional">{text(data.strategy.rationale)}</Field>}

          <Field label="Eixos e temas">
            <div className="space-y-3">
              {data.strategy.lines.map((line, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{text(line.name)}</p>
                    <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{text(line.objective)}</span>
                    <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{text(line.funnelStage)}</span>
                  </div>
                  {line.categories.map((c, j) => (
                    <div key={j} className="mt-2">
                      <p className="text-sm font-medium">{text(c.name)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {c.themes.map((t, k) => (
                          <span key={k} className="rounded-md border border-border px-2 py-0.5 text-xs">
                            {text(t.title)}
                            {(t.channel || t.format) ? <span className="text-muted"> · {text(t.channel)} {text(t.format)}</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Field>

          {data.history.length > 0 && (
            <Field label="Histórico">
              <ul className="space-y-2">
                {data.history.map((h, i) => (
                  <li key={i} className="rounded-lg border border-border p-2 text-sm">
                    <span className={h.decision === "approve" ? "text-ok" : "text-warn"}>
                      {h.decision === "approve" ? "Aprovado" : "Ajuste solicitado"}
                    </span>
                    {h.comment && <p className="mt-1 text-muted">{h.comment}</p>}
                    <p className="mt-1 text-xs text-muted">{h.author ?? "Cliente"} · {new Date(h.at).toLocaleString("pt-BR")}</p>
                  </li>
                ))}
              </ul>
            </Field>
          )}
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
            <button onClick={() => setAdjusting(true)} disabled={busy} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50">
              Solicitar ajuste
            </button>
            <button onClick={approve} disabled={busy} className="rounded-lg bg-ok px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              Aprovar
            </button>
          </div>
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAdjusting(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-elevated p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Solicitar ajuste</h2>
            <p className="mt-1 text-sm text-muted">Descreva o que precisa mudar na estratégia.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: focar mais em prova social; reduzir tom institucional; incluir pilares de bastidores…"
              className="mt-4 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setAdjusting(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface">Cancelar</button>
              <button onClick={sendChanges} disabled={busy || !comment.trim()} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
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
      <p className="label-caps text-muted">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
