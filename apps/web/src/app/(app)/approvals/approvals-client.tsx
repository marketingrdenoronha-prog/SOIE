"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface EditorialItem {
  id: string;
  version: number;
  status: string;
  positioning: string | null;
  clientId: string | null;
  clientName: string;
  token: string | null;
  submittedAt: string | null;
}
interface DeliverableItem {
  id: string;
  title: string;
  channel: string;
  type: string;
  status: string;
  clientId: string | null;
  clientName: string;
  token: string | null;
}
interface Data { editorial: EditorialItem[]; deliverables: DeliverableItem[] }

/** Aprovações — tudo aguardando decisão (cliente ou equipe), de todos os clientes. */
export function ApprovalsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try { setData(await api<Data>("/approvals")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); }, []);

  async function approveInternal(id: string) {
    try { await api(`/deliverables/${id}/approve`, { method: "POST" }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }

  const internal = data?.deliverables.filter((d) => d.status === "internal_review") ?? [];
  const withClient = data?.deliverables.filter((d) => d.status === "client_review") ?? [];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Aprovações</h1>
        <p className="text-sm text-muted">Linhas editoriais e entregas aguardando aprovação, de todos os clientes.</p>
      </div>

      {err && <p className="text-sm text-crit">{err}</p>}
      {data === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : (
        <>
          <Section title="Linha editorial — aguardando cliente" count={data.editorial.length}>
            {data.editorial.length === 0 ? <Empty /> : data.editorial.map((s) => (
              <Row
                key={s.id}
                client={s.clientName}
                clientId={s.clientId}
                label={`V${s.version} · ${s.positioning ?? "Linha editorial"}`}
                badge={s.status === "changes_requested" ? "Ajuste pedido" : "Aguardando cliente"}
                token={s.token}
                linkBase="editorial-review"
              />
            ))}
          </Section>

          <Section title="Entregas — revisão interna" count={internal.length}>
            {internal.length === 0 ? <Empty /> : internal.map((d) => (
              <Row
                key={d.id}
                client={d.clientName}
                clientId={d.clientId}
                label={`${d.title} · ${d.channel}/${d.type}`}
                badge="Revisar e liberar"
                action={{ label: "Aprovar → cliente", onClick: () => approveInternal(d.id) }}
              />
            ))}
          </Section>

          <Section title="Entregas — com o cliente" count={withClient.length}>
            {withClient.length === 0 ? <Empty /> : withClient.map((d) => (
              <Row
                key={d.id}
                client={d.clientName}
                clientId={d.clientId}
                label={`${d.title} · ${d.channel}/${d.type}`}
                badge="Aguardando cliente"
                token={d.token}
                linkBase="review"
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title} <span className="text-muted">({count})</span></h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Empty() {
  return <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">Nada aguardando aqui.</p>;
}

function Row({
  client, clientId, label, badge, token, linkBase, action,
}: {
  client: string;
  clientId: string | null;
  label: string;
  badge: string;
  token?: string | null;
  linkBase?: "editorial-review" | "review";
  action?: { label: string; onClick: () => void };
}) {
  const [copied, setCopied] = useState(false);
  const url = token && linkBase && typeof window !== "undefined" ? `${window.location.origin}/${linkBase}/${token}` : null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-elevated p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">
          {clientId ? <Link href={`/clients/${clientId}`} className="hover:text-brand">{client}</Link> : client}
        </p>
      </div>
      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs text-warn">{badge}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {action && (
          <button onClick={action.onClick} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            {action.label}
          </button>
        )}
        {url && (
          <>
            <a href={url} target="_blank" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">Abrir ↗</a>
            <button
              onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </>
        )}
        {clientId && (
          <Link href={`/clients/${clientId}`} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
            Abrir cliente
          </Link>
        )}
      </div>
    </div>
  );
}
