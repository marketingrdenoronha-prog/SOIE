"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Result {
  stats: { total: number; clients: number; brands: number; projects: number; voices: number; vocabularies: number; skipped: number };
  errors: string[];
}

/** Importa a base "clientes-beam" (JSON completo) para dentro da organização.
 * Cria Cliente → Marca → Projeto + DNA da marca por cliente, pulando quem já
 * existe (idempotente por nome). */
export function ImportClient() {
  const [json, setJson] = useState("");
  const [file, setFile] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f.name);
    f.text().then(setJson);
  }

  async function submit(dryRun: boolean) {
    setBusy(true); setErr(null); setResult(null);
    try {
      let base: unknown;
      try { base = JSON.parse(json); }
      catch { throw new Error("O texto não é um JSON válido."); }
      // Envolve num objeto { base } se ele colar o JSON direto.
      const body = base && typeof base === "object" && "clientes" in (base as object)
        ? { base, dryRun }
        : { base: { clientes: base }, dryRun };
      const r = await api<Result>("/import/beam", { method: "POST", body: JSON.stringify(body) });
      setResult(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Importar base" subtitle="Cole o JSON da sua base de clientes (ex.: clientes-beam) para preencher o SOIE de uma vez." />

      <div className="rounded-xl border border-border bg-elevated p-5">
        <label className="block text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Arquivo (.json)</span>
          <input type="file" accept="application/json,.json" onChange={onFile}
            className="mt-2 block w-full rounded-lg border border-border bg-surface p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" />
          {file && <span className="mt-1 block text-xs text-muted">{file}</span>}
        </label>

        <label className="mt-4 block text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">…ou cole o JSON aqui</span>
          <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={8}
            placeholder='{"clientes": [...]}' className="mt-2 w-full resize-none rounded-lg border border-border bg-surface p-3 font-mono text-xs outline-none focus:border-brand" />
        </label>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={() => submit(true)} disabled={busy || !json} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50">
            {busy ? "…" : "Simular"}
          </button>
          <button onClick={() => submit(false)} disabled={busy || !json} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>

      {err && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-500">{err}</div>}

      {result && (
        <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            ✅ Importação concluída
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Total no JSON" value={result.stats.total} />
            <Stat label="Clientes criados" value={result.stats.clients} />
            <Stat label="Marcas" value={result.stats.brands} />
            <Stat label="Projetos" value={result.stats.projects} />
            <Stat label="Vozes de marca" value={result.stats.voices} />
            <Stat label="Pilares" value={result.stats.vocabularies} />
            <Stat label="Já existentes (skip)" value={result.stats.skipped} />
          </div>
          {result.errors.length > 0 && (
            <div className="mt-2 rounded-lg border border-border bg-elevated p-3 text-xs">
              <p className="font-medium text-rose-500">Alguns erros:</p>
              <ul className="mt-1 space-y-0.5 text-muted">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted">Vá em <b>Clientes</b> para ver a lista importada. Cada cliente já vem com marca, projeto e voz configurados.</p>
        </div>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-elevated p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>;
}
