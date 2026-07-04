"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Data { frameworks: any[]; hooks: any[]; templates: any[]; scripts: any[] }

export function LibraryClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"frameworks"|"hooks"|"templates"|"scripts">("frameworks");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Data>("/library").then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Biblioteca" subtitle="Estruturas reutilizáveis de alta performance." />
      {err && <p className="mb-3 text-sm text-rose-500">{err}</p>}

      <div className="mb-4 flex gap-2 border-b border-border">
        {(["frameworks","hooks","templates","scripts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground"}`}>
            {t === "frameworks" ? "Frameworks" : t === "hooks" ? "Hooks" : t === "templates" ? "Templates" : "Scripts"}
            {data && <span className="ml-1.5 text-xs">({data[t].length})</span>}
          </button>
        ))}
      </div>

      {!data ? <p className="text-sm text-muted">Carregando…</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data[tab].length === 0 && <p className="text-sm text-muted">Vazio.</p>}
          {data[tab].map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-elevated p-4">
              <p className="font-medium">{item.name ?? item.text ?? item.title ?? "Item"}</p>
              {item.kind && <p className="mt-1 text-xs text-muted">{item.kind}</p>}
              {item.category && <p className="mt-1 text-xs text-muted">{item.category}</p>}
              {item.format && <p className="mt-1 text-xs text-muted">{item.format}</p>}
              {item.whenToUse && <p className="mt-2 text-sm text-muted">{item.whenToUse}</p>}
              {item.structure && (
                <p className="mt-2 text-xs text-muted">
                  {Array.isArray(item.structure.steps) ? item.structure.steps.join(" → ") : ""}
                </p>
              )}
              {item.isSystem && <span className="mt-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Sistema</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
