"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Data {
  organization: { id: string; name: string; slug: string; status: string; createdAt: string; byokEnabled: boolean };
  memberships: Array<{ id: string; user: { name: string; email: string; lastLoginAt: string | null }; role: { name: string }; status: string }>;
  roles: Array<{ id: string; name: string }>;
}

export function SettingsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Data>("/settings").then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Configurações" subtitle="Administração da organização." />
      {err && <p className="text-sm text-rose-500">{err}</p>}
      {!data ? <p className="text-sm text-muted">Carregando…</p> : (
        <>
          <Card title="Organização">
            <Row label="Nome" value={data.organization.name} />
            <Row label="Slug" value={data.organization.slug} />
            <Row label="Status" value={data.organization.status} />
            <Row label="BYOK (chaves próprias de IA)" value={data.organization.byokEnabled ? "Ativo" : "Inativo"} />
            <Row label="Criada em" value={new Date(data.organization.createdAt).toLocaleDateString("pt-BR")} />
          </Card>

          <Card title={`Equipe (${data.memberships.length})`}>
            <ul className="divide-y divide-border">
              {data.memberships.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-xs text-muted">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{m.role.name}</span>
                    <span className={`text-xs ${m.status === "active" ? "text-emerald-500" : "text-muted"}`}>{m.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Papéis">
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.roles.map((r) => (
                <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">{r.name}</li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-elevated p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-2 text-sm last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
