"use client";

import { useEffect, useState } from "react";
import { SpecView } from "@/components/spec-view";
import { ErrorBoundary } from "@/components/error-boundary";

interface ReviewData {
  token: string;
  status: string;
  brand: string;
  project: string;
  deliverable: { title: string; channel: string; type: string; spec: unknown };
  history: { decision: string; comment: string | null; at: string; author: string | null }[];
}

const API = "/api/v1";

export function ReviewClient({ token }: { token: string }) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API}/public/review/${token}`);
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
    await fetch(`${API}/public/review/${token}/approve`, {
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
    await fetch(`${API}/public/review/${token}/request-changes`, {
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
            {done === "approved" ? "Aprovado! Obrigado." : "Ajuste enviado."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {done === "approved"
              ? "A equipe foi notificada e seguirá com a entrega."
              : "Seu comentário foi enviado para a equipe, que fará os ajustes."}
          </p>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-elevated">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white">S</span>
          <div>
            <p className="text-sm font-semibold leading-tight">{data.brand}</p>
            <p className="text-xs text-muted">{data.project}</p>
          </div>
          <span className="ml-auto rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            Revisão do cliente
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {channelLabel(data.deliverable.channel)} · {typeLabel(data.deliverable.type)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{data.deliverable.title}</h1>
        <p className="mt-2 text-sm text-muted">
          Revise o material abaixo. Se estiver tudo certo, aprove. Se quiser mudar algo, peça ajuste e descreva o que precisa.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-elevated p-5">
          <ErrorBoundary>
            <SpecView type={data.deliverable.type} spec={data.deliverable.spec} />
          </ErrorBoundary>
        </div>

        {data.history.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Histórico</p>
            <ul className="space-y-2">
              {data.history.map((h, i) => (
                <li key={i} className="rounded-lg border border-border bg-elevated p-3 text-sm">
                  <span className={h.decision === "approve" ? "text-emerald-500" : "text-amber-500"}>
                    {h.decision === "approve" ? "Aprovado" : "Ajuste solicitado"}
                  </span>
                  {h.comment && <p className="mt-1 text-muted">{h.comment}</p>}
                  <p className="mt-1 text-xs text-muted">{h.author ?? "Cliente"}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {/* Sticky action bar */}
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
              Aprovar
            </button>
          </div>
        </div>
      </div>

      {/* Adjust modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setAdjusting(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-elevated p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Solicitar ajuste</h2>
            <p className="mt-1 text-sm text-muted">Descreva o que precisa mudar. A equipe recebe seu comentário na hora.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              autoFocus
              placeholder="Ex.: trocar o gancho da abertura, deixar o CTA mais direto…"
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

function channelLabel(c: string): string {
  const m: Record<string, string> = {
    instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn",
    blog: "Blog", email: "E-mail", meta_ads: "Meta Ads", google_ads: "Google Ads",
  };
  return m[c] ?? c;
}
function typeLabel(t: string): string {
  const m: Record<string, string> = {
    video_script: "Roteiro de vídeo", motion_script: "Roteiro de motion", design_brief: "Briefing de design",
    carousel: "Carrossel", copy: "Copy", article: "Artigo", email_sequence: "Sequência de e-mail", ad: "Anúncio",
  };
  return m[t] ?? t;
}
