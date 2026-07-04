"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Strategy = any;

/** Channels and formats offered when "dropping" a theme into a deliverable.
 * The format list is the production-capacity screen: the requester chooses what
 * they can actually produce (vídeo, estático, motion, …). */
const CHANNELS = [
  ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"], ["meta_ads", "Meta Ads"], ["blog", "Blog"], ["email", "E-mail"],
] as const;
const FORMATS = [
  ["video_script", "Vídeo (roteiro)"], ["motion_script", "Motion"],
  ["design_brief", "Estático (arte)"], ["carousel", "Carrossel"], ["copy", "Copy"],
  ["article", "Artigo"], ["email_sequence", "Sequência de e-mail"], ["ad", "Anúncio"],
] as const;

export function EditorialClient() {
  const [projectId, setProjectId] = useState("");
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dropTheme, setDropTheme] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    try { setStrategies(await api<Strategy[]>(`/editorial?projectId=${projectId}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function generate() {
    if (!projectId) return;
    setBusy(true); setErr(null);
    try {
      await api("/editorial", { method: "POST", body: JSON.stringify({ projectId })});
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Linha Editorial"
        subtitle="Estratégia traduzida em eixos de conteúdo, com objetivo e funil."
        action={<button onClick={generate} disabled={busy || !projectId} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Gerando…" : "Gerar linha editorial"}
        </button>}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      {strategies === null ? <p className="text-sm text-muted">Carregando…</p> :
        strategies.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Sem estratégia ainda.</p> :
        strategies.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-elevated p-5 space-y-4">
            {s.positioning && <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Posicionamento</p><p className="mt-1 text-sm">{s.positioning}</p></div>}
            {s.pillars?.length > 0 && <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Pilares</p><div className="mt-1 flex flex-wrap gap-2">{s.pillars.map((p: string, i: number) => <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{p}</span>)}</div></div>}
            {s.editorialLines?.map((line: {
              id: string; name: string; objective: string; funnelStage: string; platforms?: string[];
              categories?: { id: string; name: string; themes?: { id: string; title: string }[] }[]
            }) => (
              <div key={line.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{line.name}</p>
                  <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{line.objective}</span>
                  <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{line.funnelStage}</span>
                  {line.platforms?.map((p, i) => <span key={i} className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{p}</span>)}
                </div>
                {line.categories?.map((c) => (
                  <div key={c.id} className="mt-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.themes?.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setDropTheme(t.title)}
                          title="Dropar este tema em uma entrega"
                          className="group inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs hover:border-brand hover:text-brand"
                        >
                          {t.title}
                          <span className="text-muted group-hover:text-brand">↓</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

      {dropTheme && (
        <DropModal
          theme={dropTheme}
          projectId={projectId}
          onClose={() => setDropTheme(null)}
        />
      )}
    </div>
  );
}

/** The "tela antes": pick channel + format (production capacity) for a theme,
 * then generate the deliverable (Tema + Formato + Copy) with full project
 * context. Carousel yields copy per slide; each format follows its own rules. */
function DropModal({ theme, projectId, onClose }: { theme: string; projectId: string; onClose: () => void }) {
  const [channel, setChannel] = useState("instagram");
  const [type, setType] = useState("video_script");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  async function drop() {
    setBusy(true); setErr(null);
    try {
      const res = await api<{ reviewUrl: string }>("/deliverables/quick", {
        method: "POST",
        body: JSON.stringify({ projectId, channel, type, theme }),
      });
      setReviewUrl(res.reviewUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-elevated p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Dropar tema em entrega</p>
        <h2 className="mt-1 text-base font-semibold">{theme}</h2>

        {reviewUrl ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-emerald-600">Entrega gerada com sucesso.</p>
            <div className="flex gap-2">
              <a href="/deliverables" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Ver em Entregas</a>
              <a href={reviewUrl} target="_blank" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">Abrir link do cliente ↗</a>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Escolha o canal e o formato de acordo com a sua capacidade produtiva. O roteiro é
              gerado usando persona, DNA da marca, linha editorial e o repertório já produzido.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Select label="Canal" value={channel} onChange={setChannel} options={CHANNELS} />
              <Select label="Formato" value={type} onChange={setType} options={FORMATS} />
            </div>
            {err && <p className="mt-3 text-sm text-rose-500">{err}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface">Cancelar</button>
              <button onClick={drop} disabled={busy} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {busy ? "Gerando…" : "Gerar entrega"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
