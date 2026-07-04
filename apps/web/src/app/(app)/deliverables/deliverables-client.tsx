"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SpecView } from "@/components/spec-view";
import { api, isLoggedIn } from "@/lib/api";

interface Deliverable {
  id: string;
  title: string;
  channel: string;
  type: string;
  status: string;
  spec: unknown;
  comments: { decision: string; comment: string | null; authorName: string | null }[];
  reviewLinks: { token: string }[];
}

const CHANNELS = [
  ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"], ["meta_ads", "Meta Ads"], ["blog", "Blog"], ["email", "E-mail"],
] as const;
const TYPES = [
  ["video_script", "Roteiro de vídeo"], ["motion_script", "Roteiro de motion"],
  ["design_brief", "Briefing de design"], ["carousel", "Carrossel"], ["copy", "Copy"],
  ["article", "Artigo"], ["email_sequence", "Sequência de e-mail"], ["ad", "Anúncio"],
] as const;

export function DeliverablesClient() {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  // generate form
  const [clientName, setClientName] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [type, setType] = useState("video_script");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const a = isLoggedIn();
    setAuthed(a);
    if (a) refresh();
    else setLoading(false);
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setItems(await api<Deliverable[]>("/deliverables"));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/deliverables/quick", {
        method: "POST",
        body: JSON.stringify({ clientName, channel, type, brief: brief || undefined }),
      });
      setClientName("");
      setBrief("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-xl font-semibold">Entregas</h1>
        <p className="mt-2 text-sm text-muted">
          Entre na sua organização para gerar roteiros por canal e enviar para o cliente aprovar.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
          Entrar / Criar conta
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Entregas</h1>
        <p className="text-sm text-muted">Gere um roteiro e receba um link para o cliente aprovar.</p>
      </div>

      <form onSubmit={generate} className="rounded-xl border border-border bg-elevated p-4">
        <p className="mb-3 text-sm font-semibold">Gerar entrega</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Cliente" value={clientName} onChange={setClientName} required />
          <Select label="Canal" value={channel} onChange={setChannel} options={CHANNELS} />
          <Select label="Formato" value={type} onChange={setType} options={TYPES} />
          <Input label="Briefing (opcional)" value={brief} onChange={setBrief} />
        </div>
        {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={busy || !clientName}
          className="mt-4 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Gerando…" : "Gerar e criar link do cliente"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma entrega ainda. Gere a primeira acima.</p>
      ) : (
        <div className="space-y-4">
          {items.map((d) => <DeliverableCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}

function DeliverableCard({ d }: { d: Deliverable }) {
  const token = d.reviewLinks[0]?.token;
  const [copied, setCopied] = useState(false);
  const reviewUrl = token && typeof window !== "undefined" ? `${window.location.origin}/review/${token}` : null;

  return (
    <div className="rounded-xl border border-border bg-elevated">
      <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
        <div>
          <p className="font-semibold">{d.title}</p>
          <p className="text-xs text-muted">{d.channel} · {d.type}</p>
        </div>
        <StatusBadge status={d.status} />
        {reviewUrl && (
          <div className="ml-auto flex items-center gap-2">
            <a href={reviewUrl} target="_blank" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
              Abrir link do cliente ↗
            </a>
            <button
              onClick={() => { navigator.clipboard.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-0 lg:grid-cols-3">
        <div className="p-4 lg:col-span-2"><SpecView type={d.type} spec={d.spec} /></div>
        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">Feedback do cliente</p>
          {d.comments.length === 0 ? (
            <p className="text-sm text-muted">Nenhum ainda.</p>
          ) : (
            <ul className="space-y-2">
              {d.comments.map((c, i) => (
                <li key={i} className="rounded-lg border border-border p-2.5 text-sm">
                  <span className={c.decision === "approve" ? "text-emerald-500" : "text-amber-500"}>
                    {c.decision === "approve" ? "✓ Aprovado" : "✎ Ajuste"}
                  </span>
                  {c.comment && <p className="mt-1 text-muted">{c.comment}</p>}
                  <p className="mt-1 text-xs text-muted">{c.authorName ?? "Cliente"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    generating: ["Gerando", "bg-sky-500/15 text-sky-500"],
    internal_review: ["Revisão interna", "bg-violet-500/15 text-violet-500"],
    client_review: ["Com o cliente", "bg-amber-500/15 text-amber-500"],
    approved: ["Aprovado", "bg-emerald-500/15 text-emerald-500"],
    changes_requested: ["Ajuste pedido", "bg-rose-500/15 text-rose-500"],
    delivered: ["Entregue", "bg-emerald-500/15 text-emerald-500"],
  };
  const [label, cls] = map[status] ?? [status, "bg-border text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
