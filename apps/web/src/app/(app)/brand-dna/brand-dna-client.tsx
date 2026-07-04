"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Brand { id: string; name: string; client?: { name: string } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Data { voices: any[]; vocabularies: any[]; archetypes: any[] }

export function BrandDnaClient() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [samples, setSamples] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Brand[]>("/brands").then((b) => { setBrands(b); if (b[0]) setBrandId(b[0].id); }).catch(() => {});
  }, []);
  async function load() {
    if (!brandId) return;
    try { setData(await api<Data>(`/brand-dna?brandId=${brandId}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [brandId]);

  async function generate() {
    if (!brandId) return;
    setBusy(true); setErr(null);
    try {
      await api("/brand-dna", { method: "POST", body: JSON.stringify({ brandId, samples: samples || undefined })});
      setSamples("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const currentVoice = data?.voices?.[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="DNA da Marca" subtitle="Identidade verbal para que todo conteúdo soe como a marca." />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Marca:</span>
        {brands.length === 0 ? <p className="text-sm text-muted">Nenhuma marca ainda.</p> :
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm outline-none focus:border-brand">
            {brands.map((b) => <option key={b.id} value={b.id}>{b.client?.name ? `${b.client.name} · ` : ""}{b.name}</option>)}
          </select>}
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <textarea value={samples} onChange={(e) => setSamples(e.target.value)} rows={4}
          placeholder="Cole exemplos do texto atual da marca (posts, e-mails, página inicial). Opcional."
          className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand" />
        <div className="mt-3 flex justify-end">
          <button onClick={generate} disabled={busy || !brandId} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Analisando…" : "Extrair DNA da marca"}
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      {currentVoice && (
        <div className="rounded-xl border border-border bg-elevated p-5 space-y-3">
          <h3 className="text-sm font-semibold">Voz da marca</h3>
          <Row label="Formalidade" value={currentVoice.formality ?? "—"} />
          <Row label="Confiança" value={currentVoice.confidence} />
          {currentVoice.doList?.length > 0 && <List title="Faça" items={currentVoice.doList} color="text-emerald-500" />}
          {currentVoice.dontList?.length > 0 && <List title="Não faça" items={currentVoice.dontList} color="text-rose-500" />}
        </div>
      )}

      {data && data.archetypes.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated p-5">
          <h3 className="mb-3 text-sm font-semibold">Arquétipos</h3>
          <div className="flex flex-wrap gap-2">
            {data.archetypes.map((a, i) => (
              <span key={i} className="rounded-full bg-brand/10 px-3 py-1 text-sm text-brand">
                {a.archetype} · {(a.weight * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {data && data.vocabularies.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated p-5">
          <h3 className="mb-3 text-sm font-semibold">Vocabulário</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.vocabularies.map((v, i) => (
              <div key={i} className="rounded-lg border border-border p-2 text-sm">
                <span className="text-xs text-muted">{v.kind}: </span><b>{v.term}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted">{label}</span><span className="font-medium">{value}</span></div>;
}
function List({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <p className={`text-xs font-medium uppercase tracking-wider ${color}`}>{title}</p>
      <ul className="mt-1 space-y-1 text-sm">{items.map((it, i) => <li key={i}>• {it}</li>)}</ul>
    </div>
  );
}
