"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/logo";
import { ThemeContent } from "@/components/editorial-doc";
import "../../globals.css";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Asset { id: string; version: number; kind: string; url: string; name: string | null }
interface Piece { id: string; title: string; type: string; channel: string; spec: any; productionStatus: string; assets: Asset[] }

const API = "/api/v1";

/** Portal público de aprovação da produção. O cliente vê cada peça (conteúdo +
 * arquivos), comenta e aprova ou pede ajuste — peça por peça. Sem login. */
export function ProductionPortalClient({ token }: { token: string }) {
  const [data, setData] = useState<{ client: string; version: number; productionStage: string; pieces: Piece[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function load() {
    setErr(null);
    try {
      const r = await fetch(`${API}/public/production/${token}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message ?? "Portal não encontrado");
      setData(await r.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  if (err) return <Shell><p className="text-sm text-crit">{err}</p></Shell>;
  if (!data) return <Shell><p className="text-sm text-muted">Carregando…</p></Shell>;

  const total = data.pieces.length;
  const approved = data.pieces.filter((p) => p.productionStatus === "aprovada").length;

  return (
    <Shell>
      <div className="mb-6">
        <p className="label-caps text-muted">Aprovação de produção</p>
        <h1 className="text-2xl font-bold">{data.client}</h1>
        <p className="mt-1 text-sm text-muted">
          Linha editorial V{data.version} · {approved}/{total} peça(s) aprovada(s).
          Aprove cada peça ou peça ajuste individualmente.
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Seu nome (opcional)"
          className="mt-3 w-full max-w-xs rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div className="space-y-4">
        {data.pieces.map((p, i) => (
          <PieceCard key={p.id} p={p} index={i} token={token} authorName={name} onChanged={load} />
        ))}
      </div>
    </Shell>
  );
}

function PieceCard({ p, index, token, authorName, onChanged }: {
  p: Piece; index: number; token: string; authorName: string; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const decided = p.productionStatus === "aprovada";
  const inChange = p.productionStatus === "em_producao" || p.productionStatus === "produzida" || p.productionStatus === "aprovada_interna";

  async function approve() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/public/production/${token}/pieces/${p.id}/approve`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ authorName: authorName || undefined }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message ?? "Erro");
      onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function requestChanges() {
    if (!comment.trim()) { setErr("Descreva o ajuste."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/public/production/${token}/pieces/${p.id}/request-changes`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ comment, authorName: authorName || undefined }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error?.message ?? "Erro");
      setComment(""); setAsking(false); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }

  return (
    <article className={`rounded-xl border bg-elevated p-4 ${decided ? "border-ok/50" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold"><span className="text-muted">#{String(index + 1).padStart(2, "0")}</span> {p.title}</h3>
          <p className="text-xs text-muted">{p.channel} · {p.type}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          decided ? "bg-ok/15 text-ok" : inChange ? "bg-warn/15 text-warn" : "bg-border/60 text-muted"
        }`}>{decided ? "Aprovada" : inChange ? "Em ajuste" : "Aguardando você"}</span>
      </div>

      {p.assets.length > 0 && (
        <div className="mt-3">
          <p className="label-caps text-muted">Arquivos</p>
          <div className="mt-1 space-y-2">
            {p.assets.filter((a) => a.version === p.assets[0].version).map((a) => <AssetView key={a.id} a={a} />)}
          </div>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">Ver conteúdo/roteiro</summary>
        <div className="mt-2 border-t border-border pt-2"><ThemeContent theme={p.spec} /></div>
      </details>

      {err && <p className="mt-2 text-sm text-crit">{err}</p>}

      {!decided && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button onClick={approve} disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
            {busy ? "…" : "✓ OK"}
          </button>
          {!asking ? (
            <button onClick={() => setAsking(true)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">✎ Alterar</button>
          ) : (
            <div className="flex w-full items-center gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que você quer alterar nesta peça?" className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand" />
              <button onClick={requestChanges} disabled={busy} className="rounded-md bg-warn px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Enviar</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function AssetView({ a }: { a: Asset }) {
  const label = a.name || a.url;
  if (a.kind === "image") return <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={label} className="max-h-64 rounded-lg border border-border" /></a>;
  if (a.kind === "video") return <video src={a.url} controls className="max-h-64 w-full rounded-lg border border-border" />;
  return <a href={a.url} target="_blank" rel="noreferrer" className="block truncate rounded-md border border-border bg-surface px-3 py-2 text-sm text-brand-strong hover:bg-elevated dark:text-brand">{label} ↗</a>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-elevated">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <LogoMark className="h-10 w-10" />
          <span className="text-sm font-semibold">Aprovação de produção</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
    </div>
  );
}
