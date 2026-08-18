"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { OnboardingWizard } from "./onboarding-wizard";
import { DossierView } from "./dossier-view";
import { EditorialTab } from "./editorial-tab";
import { ProductionTab } from "./production-tab";
import { KnowledgeTab } from "./knowledge-tab";

interface Client { id: string; name: string; industry?: string; website?: string; createdAt: string }
interface Onboarding { id: string; status: string; step: number; payload: Record<string, unknown> }
interface Dossier { id: string; status: string; version: number; summary: Record<string, unknown>; generatedAt?: string | null; createdAt: string }

type Tab = "onboarding" | "dossier" | "editorial" | "production" | "knowledge";

/** V2 — Detalhe do cliente com o fluxo linear em abas.
 *
 * A primeira aba (Onboarding) é o único ponto de entrada manual da V2. O
 * resto (Dossiê, Linha Editorial, Produção) é o resultado da IA sobre esse
 * onboarding. As abas Linha Editorial e Produção entram nas Fases 2 e 3.
 */
export function ClientDetail({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [tab, setTab] = useState<Tab>("onboarding");
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    setErr(null);
    try {
      const [cs, ob, dv] = await Promise.all([
        api<Client[]>("/clients"),
        api<{ onboarding: Onboarding; isComplete: boolean }>(`/clients/${clientId}/onboarding`),
        api<{ dossier: Dossier | null }>(`/clients/${clientId}/dossier`),
      ]);
      const c = cs.find((x) => x.id === clientId) ?? null;
      setClient(c);
      setOnboarding(ob.onboarding);
      setIsComplete(ob.isComplete);
      setDossier(dv.dossier);
      if (dv.dossier && ob.isComplete) setTab("dossier");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { loadAll(); }, [clientId]);

  const tabs: Array<{ id: Tab; label: string; hint?: string; disabled?: boolean }> = [
    { id: "onboarding", label: "Onboarding", hint: onboarding?.status === "completed" ? "✓" : undefined },
    { id: "dossier", label: "Dossiê Estratégico", hint: dossier?.status === "ready" ? "✓" : dossier?.status === "generating" ? "…" : undefined, disabled: !dossier },
    { id: "editorial", label: "Linha Editorial", disabled: !dossier || dossier.status !== "ready" },
    { id: "production", label: "Produção", disabled: !dossier || dossier.status !== "ready" },
    // Sempre disponível: o operador pode alimentar a base do cliente a qualquer momento.
    { id: "knowledge", label: "Base de Conhecimento" },
  ];

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/clients" className="label-caps text-muted hover:text-foreground">← Clientes</Link>
          <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-[-0.03em]">
            {client?.name ?? "Cliente"}
          </h1>
          {client?.industry && <p className="text-sm text-muted">{client.industry}</p>}
        </div>
      </div>

      {err && <p className="text-sm text-crit">{err}</p>}

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={t.disabled}
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-2 text-sm transition-colors ${
              t.disabled ? "text-muted/60 cursor-not-allowed" :
              tab === t.id ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {t.hint && <span className="ml-1.5 text-xs text-brand">{t.hint}</span>}
            {tab === t.id && !t.disabled && (
              <span className="absolute -bottom-px left-0 h-0.5 w-full bg-brand" />
            )}
          </button>
        ))}
      </div>

      {tab === "onboarding" && onboarding && (
        <OnboardingWizard
          clientId={clientId}
          initial={onboarding}
          isComplete={isComplete}
          onSaved={(next) => { setOnboarding(next.onboarding); setIsComplete(next.isComplete); }}
          onFinalized={(d) => { setDossier(d); setTab("dossier"); loadAll(); }}
        />
      )}
      {tab === "dossier" && (
        dossier ? <DossierView dossier={dossier} /> :
        <p className="text-sm text-muted">Nenhum dossiê ainda. Finalize o onboarding para gerar.</p>
      )}
      {tab === "editorial" && (
        <EditorialTab clientId={clientId} />
      )}
      {tab === "production" && <ProductionTab clientId={clientId} />}
      {tab === "knowledge" && <KnowledgeTab clientId={clientId} />}
    </div>
  );
}
