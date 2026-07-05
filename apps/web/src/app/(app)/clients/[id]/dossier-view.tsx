"use client";
import { ErrorBoundary } from "@/components/error-boundary";

interface Dossier {
  id: string;
  status: string;
  version: number;
  summary: Record<string, any>;
  generatedAt?: string | null;
  createdAt: string;
}

/** V2 — Renderiza o snapshot congelado do Dossiê Estratégico.
 * Não é editável; é apenas leitura. A IA vai consultar as tabelas subjacentes
 * (MarketAnalysis, Persona, BrandVoice) para gerar a linha editorial. */
export function DossierView({ dossier }: { dossier: Dossier }) {
  const s = dossier.summary ?? {};
  const isGenerating = dossier.status === "generating";

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-elevated p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="label-caps text-muted">Dossiê estratégico — versão {dossier.version}</p>
              <p className="text-sm text-muted">
                {isGenerating ? "Gerando pesquisa e consolidando…" :
                 dossier.status === "ready" ? `Congelado em ${new Date(dossier.generatedAt ?? dossier.createdAt).toLocaleString("pt-BR")}` :
                 "Geração falhou parcialmente — reabra o onboarding e finalize de novo."}
              </p>
            </div>
            <span className={`label-caps rounded-full px-3 py-1 text-[10px] ${
              dossier.status === "ready" ? "bg-brand/10 text-brand-strong dark:text-brand" :
              dossier.status === "generating" ? "bg-warn/10 text-warn" : "bg-crit/10 text-crit"
            }`}>{dossier.status}</span>
          </div>
        </div>

        {s.recommendations?.length > 0 && (
          <Card title="Recomendações prioritárias">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {s.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
            </ol>
          </Card>
        )}

        {s.market && (
          <Card title="Mercado">
            {s.market.summary && <p className="text-sm">{s.market.summary}</p>}
            {s.market.swot && <SwotView swot={s.market.swot} />}
            {s.market.opportunities?.length > 0 && <SubList label="Oportunidades" items={s.market.opportunities} />}
            {s.market.threats?.length > 0 && <SubList label="Ameaças" items={s.market.threats} />}
          </Card>
        )}

        {s.competition?.competitors?.length > 0 && (
          <Card title="Concorrência">
            <ul className="space-y-2">
              {s.competition.competitors.slice(0, 8).map((c: any, i: number) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <p className="text-sm font-semibold">{c.name}</p>
                  {c.positioning && <p className="text-xs text-muted">{c.positioning}</p>}
                  {c.strengths?.length > 0 && <p className="mt-1 text-xs"><span className="text-muted">Forças:</span> {c.strengths.join(" · ")}</p>}
                  {c.weaknesses?.length > 0 && <p className="text-xs"><span className="text-muted">Fraquezas:</span> {c.weaknesses.join(" · ")}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {s.persona && (
          <Card title="Persona">
            <p className="text-sm font-semibold">{s.persona.name}</p>
            {s.persona.pains?.length > 0 && <SubList label="Dores" items={s.persona.pains.map((x: any) => x.description ?? x)} />}
            {s.persona.desires?.length > 0 && <SubList label="Desejos" items={s.persona.desires.map((x: any) => x.description ?? x)} />}
            {s.persona.objections?.length > 0 && <SubList label="Objeções" items={s.persona.objections.map((x: any) => x.description ?? x)} />}
          </Card>
        )}

        {s.voice && (
          <Card title="Voz da marca">
            {typeof s.voice.tone === "object" && s.voice.tone?.descricao && <p className="text-sm">{s.voice.tone.descricao}</p>}
            {typeof s.voice.tone === "string" && <p className="text-sm">{s.voice.tone}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {s.voice.do?.length > 0 && <SubList label="Fazer" items={s.voice.do} />}
              {s.voice.dont?.length > 0 && <SubList label="Não fazer" items={s.voice.dont} />}
            </div>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-elevated p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="label-caps mt-2 text-muted">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
        {items.slice(0, 8).map((x, i) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}
      </ul>
    </div>
  );
}

function SwotView({ swot }: { swot: any }) {
  const map: Array<[string, string, string]> = [
    ["Forças", "strengths", "text-ok"],
    ["Fraquezas", "weaknesses", "text-crit"],
    ["Oportunidades", "opportunities", "text-brand-strong dark:text-brand"],
    ["Ameaças", "threats", "text-warn"],
  ];
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      {map.map(([label, key, cls]) => {
        const arr = swot?.[key];
        if (!Array.isArray(arr) || arr.length === 0) return null;
        return (
          <div key={key} className="rounded-md border border-border p-3">
            <p className={`label-caps ${cls}`}>{label}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {arr.slice(0, 6).map((x: any, i: number) => <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
