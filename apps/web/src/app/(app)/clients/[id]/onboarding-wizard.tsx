"use client";
import { useState } from "react";
import { api } from "@/lib/api";

interface OB { id: string; status: string; step: number; payload: Record<string, any> }
interface Props {
  clientId: string;
  initial: OB;
  isComplete: boolean;
  onSaved: (next: { onboarding: OB; isComplete: boolean }) => void;
  onFinalized: (dossier: any) => void;
}

const STEPS = [
  { key: "identity",    label: "Identidade" },
  { key: "goals",       label: "Objetivos" },
  { key: "offer",       label: "Oferta" },
  { key: "icp",         label: "Cliente ideal" },
  { key: "competition", label: "Concorrência" },
  { key: "voice",       label: "Tom de voz" },
  { key: "materials",   label: "Materiais" },
] as const;

/** Wizard multi-step do onboarding V2. Salva um step por vez (PATCH parcial).
 * O componente é intencionalmente simples: 1 form por step, campos guiados. */
export function OnboardingWizard({ clientId, initial, isComplete, onSaved, onFinalized }: Props) {
  const [current, setCurrent] = useState(initial.step ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [payload, setPayload] = useState<Record<string, any>>(initial.payload ?? {});

  const stepKey = STEPS[current]?.key ?? "identity";
  const isLast = current === STEPS.length - 1;
  const isCompleted = initial.status === "completed";

  function updateStep(key: string, values: Record<string, any>) {
    setPayload((p) => ({ ...p, [key]: { ...(p[key] ?? {}), ...values } }));
  }

  async function saveAndNext() {
    setBusy(true); setErr(null);
    try {
      const nextStep = Math.min(current + 1, STEPS.length - 1);
      const res = await api<{ onboarding: OB; isComplete: boolean }>(`/clients/${clientId}/onboarding`, {
        method: "PATCH",
        body: JSON.stringify({ step: nextStep, payload: { [stepKey]: payload[stepKey] ?? {} } }),
      });
      onSaved(res);
      if (!isLast) setCurrent(nextStep);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function finalize() {
    setFinalizing(true); setErr(null);
    try {
      const r = await api<{ dossier: any; errors: string[] }>(`/clients/${clientId}/onboarding/finalize`, { method: "POST" });
      onFinalized(r.dossier);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setFinalizing(false); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="space-y-1">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setCurrent(i)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${
              i === current ? "bg-brand/10 font-semibold text-brand-strong dark:text-brand" :
              payload[s.key] ? "text-foreground/80 hover:bg-brand/5" : "text-muted hover:bg-brand/5"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold ${
              payload[s.key] ? "border-brand bg-brand text-white dark:text-[#00390d]" : "border-border text-muted"
            }`}>{payload[s.key] ? "✓" : i + 1}</span>
            {s.label}
          </button>
        ))}
      </aside>

      <div className="min-w-0 space-y-4 rounded-xl border border-border bg-elevated p-6">
        {isCompleted && (
          <div className="rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-xs text-brand-strong dark:text-brand">
            Onboarding concluído. Você pode revisar ou reabrir editando os campos e reenviando.
          </div>
        )}
        {stepKey === "identity" && <IdentityStep p={payload.identity ?? {}} onChange={(v) => updateStep("identity", v)} />}
        {stepKey === "goals" && <GoalsStep p={payload.goals ?? {}} onChange={(v) => updateStep("goals", v)} />}
        {stepKey === "offer" && <OfferStep p={payload.offer ?? {}} onChange={(v) => updateStep("offer", v)} />}
        {stepKey === "icp" && <IcpStep p={payload.icp ?? {}} onChange={(v) => updateStep("icp", v)} />}
        {stepKey === "competition" && <CompStep p={payload.competition ?? {}} onChange={(v) => updateStep("competition", v)} />}
        {stepKey === "voice" && <VoiceStep p={payload.voice ?? {}} onChange={(v) => updateStep("voice", v)} />}
        {stepKey === "materials" && <MaterialsStep p={payload.materials ?? {}} onChange={(v) => updateStep("materials", v)} />}

        {err && <p className="text-sm text-crit">{err}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-brand/5 disabled:opacity-40"
          >← Anterior</button>
          <div className="flex flex-wrap gap-2">
            {!isLast && (
              <button onClick={saveAndNext} disabled={busy}
                className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong dark:text-[#00390d] disabled:opacity-50">
                {busy ? "Salvando…" : "Salvar e continuar →"}
              </button>
            )}
            {isLast && (
              <>
                <button onClick={saveAndNext} disabled={busy}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-brand/5 disabled:opacity-50">
                  {busy ? "Salvando…" : "Salvar rascunho"}
                </button>
                <button onClick={finalize} disabled={finalizing || !isComplete}
                  className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-strong dark:text-[#00390d] disabled:opacity-50">
                  {finalizing ? "Gerando dossiê…" : isComplete ? "Finalizar e gerar dossiê" : "Preencha os campos obrigatórios"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────
type StepProps<T> = { p: T; onChange: (v: Partial<T>) => void };
const label = "text-xs font-semibold uppercase tracking-wider text-muted";
const input = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const req = <span className="text-crit">*</span>;

function IdentityStep({ p, onChange }: StepProps<any>) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Identidade e presença digital</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>Nome público {req}</span><input className={input} value={p.displayName ?? ""} onChange={(e) => onChange({ displayName: e.target.value })} /></label>
        <label className="block"><span className={label}>Tagline</span><input className={input} value={p.tagline ?? ""} onChange={(e) => onChange({ tagline: e.target.value })} /></label>
        <label className="block"><span className={label}>Site</span><input className={input} placeholder="https://…" value={p.website ?? ""} onChange={(e) => onChange({ website: e.target.value })} /></label>
        <label className="block"><span className={label}>Instagram</span><input className={input} placeholder="@handle" value={p.instagram ?? ""} onChange={(e) => onChange({ instagram: e.target.value })} /></label>
        <label className="block sm:col-span-2"><span className={label}>Localização</span><input className={input} value={p.location ?? ""} onChange={(e) => onChange({ location: e.target.value })} /></label>
      </div>
    </div>
  );
}

function GoalsStep({ p, onChange }: StepProps<any>) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Objetivos estratégicos</h2>
      <label className="block"><span className={label}>Objetivo principal {req}</span><textarea rows={2} className={input} value={p.primaryObjective ?? ""} onChange={(e) => onChange({ primaryObjective: e.target.value })} /></label>
      <label className="block"><span className={label}>Objetivos secundários (1 por linha)</span>
        <textarea rows={3} className={input} value={(p.secondaryObjectives ?? []).join("\n")} onChange={(e) => onChange({ secondaryObjectives: e.target.value.split("\n").filter(Boolean) })} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>Horizonte</span>
          <select className={input} value={p.horizon ?? ""} onChange={(e) => onChange({ horizon: e.target.value || undefined })}>
            <option value="">—</option><option value="30d">30 dias</option><option value="90d">90 dias</option><option value="6m">6 meses</option><option value="12m">12 meses</option>
          </select>
        </label>
        <label className="block"><span className={label}>Métricas de sucesso</span><input className={input} value={p.successMetrics ?? ""} onChange={(e) => onChange({ successMetrics: e.target.value })} /></label>
      </div>
    </div>
  );
}

function OfferStep({ p, onChange }: StepProps<any>) {
  const items: any[] = p.products ?? [{ name: "", pitch: "" }];
  function set(idx: number, key: string, v: string) {
    const next = items.slice(); next[idx] = { ...next[idx], [key]: v }; onChange({ products: next });
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Produtos e serviços</h2>
      {items.map((it, i) => (
        <div key={i} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_2fr_120px]">
          <label className="block"><span className={label}>Nome</span><input className={input} value={it.name ?? ""} onChange={(e) => set(i, "name", e.target.value)} /></label>
          <label className="block"><span className={label}>Descrição curta</span><input className={input} value={it.pitch ?? ""} onChange={(e) => set(i, "pitch", e.target.value)} /></label>
          <label className="block"><span className={label}>Preço</span><input className={input} value={it.price ?? ""} onChange={(e) => set(i, "price", e.target.value)} /></label>
        </div>
      ))}
      <button onClick={() => onChange({ products: [...items, { name: "" }] })}
        className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted hover:bg-brand/5">+ Adicionar produto/serviço</button>
    </div>
  );
}

function IcpStep({ p, onChange }: StepProps<any>) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Cliente ideal (ICP)</h2>
      <label className="block"><span className={label}>Descrição do cliente ideal {req}</span><textarea rows={3} className={input} value={p.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} /></label>
      <label className="block"><span className={label}>Perfil demográfico</span><textarea rows={2} className={input} value={p.demographics ?? ""} onChange={(e) => onChange({ demographics: e.target.value })} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>Dores (1 por linha)</span><textarea rows={3} className={input} value={(p.painPoints ?? []).join("\n")} onChange={(e) => onChange({ painPoints: e.target.value.split("\n").filter(Boolean) })} /></label>
        <label className="block"><span className={label}>Desejos (1 por linha)</span><textarea rows={3} className={input} value={(p.desires ?? []).join("\n")} onChange={(e) => onChange({ desires: e.target.value.split("\n").filter(Boolean) })} /></label>
      </div>
      <label className="block"><span className={label}>Canais onde estão (separados por vírgula)</span>
        <input className={input} value={(p.channelsWhereTheyAre ?? []).join(", ")} onChange={(e) => onChange({ channelsWhereTheyAre: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </label>
    </div>
  );
}

function CompStep({ p, onChange }: StepProps<any>) {
  const items: any[] = p.competitors ?? [{ name: "", url: "", note: "" }];
  function set(idx: number, key: string, v: string) {
    const next = items.slice(); next[idx] = { ...next[idx], [key]: v }; onChange({ competitors: next });
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Concorrência conhecida</h2>
      {items.map((it, i) => (
        <div key={i} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
          <label className="block"><span className={label}>Nome</span><input className={input} value={it.name ?? ""} onChange={(e) => set(i, "name", e.target.value)} /></label>
          <label className="block"><span className={label}>Site/perfil</span><input className={input} value={it.url ?? ""} onChange={(e) => set(i, "url", e.target.value)} /></label>
          <label className="block"><span className={label}>Nota</span><input className={input} value={it.note ?? ""} onChange={(e) => set(i, "note", e.target.value)} /></label>
        </div>
      ))}
      <button onClick={() => onChange({ competitors: [...items, { name: "" }] })}
        className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted hover:bg-brand/5">+ Adicionar concorrente</button>
      <label className="block"><span className={label}>Seus diferenciais (1 por linha)</span>
        <textarea rows={3} className={input} value={(p.differentiators ?? []).join("\n")} onChange={(e) => onChange({ differentiators: e.target.value.split("\n").filter(Boolean) })} />
      </label>
    </div>
  );
}

function VoiceStep({ p, onChange }: StepProps<any>) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tom de voz e referências</h2>
      <label className="block"><span className={label}>Como a marca fala {req}</span><textarea rows={3} className={input} placeholder="Ex.: próxima, direta, sem jargão…" value={p.tone ?? ""} onChange={(e) => onChange({ tone: e.target.value })} /></label>
      <label className="block"><span className={label}>Formalidade</span>
        <select className={input} value={p.formalityLevel ?? ""} onChange={(e) => onChange({ formalityLevel: e.target.value || undefined })}>
          <option value="">—</option><option value="low">Informal</option><option value="medium">Neutra</option><option value="high">Formal</option>
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>Fazer (1 por linha)</span><textarea rows={3} className={input} value={(p.doList ?? []).join("\n")} onChange={(e) => onChange({ doList: e.target.value.split("\n").filter(Boolean) })} /></label>
        <label className="block"><span className={label}>Não fazer (1 por linha)</span><textarea rows={3} className={input} value={(p.dontList ?? []).join("\n")} onChange={(e) => onChange({ dontList: e.target.value.split("\n").filter(Boolean) })} /></label>
      </div>
      <label className="block"><span className={label}>Perfis de referência (@handle, 1 por linha)</span>
        <textarea rows={2} className={input} value={(p.referenceProfiles ?? []).join("\n")} onChange={(e) => onChange({ referenceProfiles: e.target.value.split("\n").filter(Boolean) })} />
      </label>
      <label className="block"><span className={label}>Cole textos de exemplo do próprio cliente (opcional)</span>
        <textarea rows={3} className={input} value={p.referenceExamples ?? ""} onChange={(e) => onChange({ referenceExamples: e.target.value })} />
      </label>
    </div>
  );
}

function MaterialsStep({ p, onChange }: StepProps<any>) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Materiais e observações finais</h2>
      <label className="block"><span className={label}>Links (1 por linha)</span>
        <textarea rows={3} className={input} value={(p.materialLinks ?? []).join("\n")} onChange={(e) => onChange({ materialLinks: e.target.value.split("\n").filter(Boolean) })} />
      </label>
      <label className="block"><span className={label}>Observações livres</span>
        <textarea rows={5} className={input} placeholder="Restrições legais, palavras proibidas, contexto de mercado, sensibilidades…" value={p.observations ?? ""} onChange={(e) => onChange({ observations: e.target.value })} />
      </label>
    </div>
  );
}
