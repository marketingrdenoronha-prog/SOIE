"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { arr, text } from "@/lib/render";

type Strategy = any;

export function EditorialTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Strategy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [brief, setBrief] = useState("");

  async function load() {
    setErr(null);
    try {
      setItems(await api<Strategy[]>(`/clients/${clientId}/editorial-strategies`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  async function generate() {
    setBusy(true); setErr(null);
    try {
      await api(`/clients/${clientId}/editorial-strategies`, {
        method: "POST",
        body: JSON.stringify({ brief: brief || undefined }),
      });
      setBrief("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao gerar linha editorial");
    } finally {
      setBusy(false);
    }
  }

  async function submit(id: string) {
    setSubmitBusy(id); setErr(null);
    try {
      await api(`/editorial-strategies/${id}/submit`, { method: "POST" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar para aprovação");
    } finally {
      setSubmitBusy(null);
    }
  }

  const latest = items?.[0];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Nova versão da linha editorial</p>
            <p className="mt-1 text-xs text-muted">
              A IA usa onboarding, dossiê, framework, memória, histórico e feedbacks para evoluir a comunicação.
            </p>
          </div>
          {latest && (
            <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs text-muted">
              Última: V{latest.version} · {labelStatus(latest.status)}
            </span>
          )}
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Direção opcional para esta versão (ex.: foco em prova social, Black Friday, reposicionamento, evitar repetir temas anteriores…)."
          className="mt-3 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
        />
        <div className="mt-3 flex items-center justify-between">
          {err ? <p className="text-sm text-crit">{err}</p> : <span />}
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
          >
            {busy ? "Gerando…" : latest ? `Gerar V${(latest.version ?? 0) + 1}` : "Gerar V1"}
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Carregando linhas editoriais…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma linha editorial ainda. Gere a primeira versão para enviar ao cliente.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <StrategyCard
              key={s.id}
              s={s}
              submitBusy={submitBusy === s.id}
              onSubmit={() => submit(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyCard({ s, submitBusy, onSubmit }: { s: any; submitBusy: boolean; onSubmit: () => void }) {
  const [copied, setCopied] = useState(false);
  const openLink = s.reviewLinks?.find((l: any) => l.status === "open") ?? s.reviewLinks?.[0];
  const reviewUrl = openLink && typeof window !== "undefined" ? `${window.location.origin}/editorial-review/${openLink.token}` : null;
  const requested = s.reviewComments?.filter((c: any) => c.decision === "request_changes") ?? [];

  return (
    <article className="rounded-xl border border-border bg-elevated p-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <p className="font-semibold">Linha Editorial V{s.version}</p>
        <StatusBadge status={s.status} />
        {s.approvedAt && <span className="text-xs text-muted">aprovada em {new Date(s.approvedAt).toLocaleDateString("pt-BR")}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {reviewUrl && (
            <>
              <a href={reviewUrl} target="_blank" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
                Abrir link ↗
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
              >
                {copied ? "Copiado!" : "Copiar link"}
              </button>
            </>
          )}
          {s.status !== "approved" && (
            <button
              onClick={onSubmit}
              disabled={submitBusy}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
            >
              {submitBusy ? "Enviando…" : s.status === "draft" ? "Enviar para aprovação" : "Reenviar"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {text(s.positioning) && (
          <div>
            <p className="label-caps text-muted">Posicionamento</p>
            <p className="mt-1 text-sm">{text(s.positioning)}</p>
          </div>
        )}
        {arr(s.pillars).length > 0 && (
          <div>
            <p className="label-caps text-muted">Pilares</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {arr(s.pillars).map((p: unknown, i: number) => <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{text(p)}</span>)}
            </div>
          </div>
        )}
        {requested.length > 0 && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
            <p className="text-xs font-semibold text-warn">Feedback do cliente</p>
            <ul className="mt-1 space-y-1 text-sm">
              {requested.map((c: any) => <li key={c.id}>“{text(c.comment)}”</li>)}
            </ul>
          </div>
        )}
        <div className="space-y-3">
          {s.editorialLines?.map((line: any) => (
            <div key={line.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{text(line.name)}</p>
                <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{text(line.objective)}</span>
                <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{text(line.funnelStage)}</span>
              </div>
              {line.categories?.map((c: any) => (
                <div key={c.id} className="mt-2">
                  <p className="text-sm font-medium">{text(c.name)}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.themes?.map((t: any) => (
                      <span key={t.id} className="rounded-md border border-border px-2 py-0.5 text-xs">
                        {text(t.title)}
                        {(t.channel || t.format) ? <span className="text-muted"> · {text(t.channel)} {text(t.format)}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ["Rascunho", "bg-border/60 text-muted"],
    pending_client: ["Aguardando cliente", "bg-warn/15 text-warn"],
    approved: ["Aprovada", "bg-ok/15 text-ok"],
    changes_requested: ["Ajuste pedido", "bg-crit/15 text-crit"],
  };
  const [label, cls] = map[status] ?? [status, "bg-border/60 text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
function labelStatus(status: string) {
  return ({ draft: "rascunho", pending_client: "aguardando", approved: "aprovada", changes_requested: "ajuste" } as Record<string, string>)[status] ?? status;
}
