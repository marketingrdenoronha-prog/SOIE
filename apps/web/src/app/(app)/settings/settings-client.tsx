"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Org { id: string; name: string; slug: string; status: string; createdAt: string; byokEnabled: boolean }
interface Data {
  organization: Org;
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
      <PageHeader title="Configurações" subtitle="Administração da organização e da sua conta." />
      {err && <p className="text-sm text-rose-500">{err}</p>}
      {!data ? <p className="text-sm text-muted">Carregando…</p> : (
        <>
          <OrgCard org={data.organization} onSaved={(o) => setData({ ...data, organization: o })} />

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

          <PasswordCard />

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

function OrgCard({ org, onSaved }: { org: Org; onSaved: (o: Org) => void }) {
  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const o = await api<Org>("/settings", { method: "PATCH", body: JSON.stringify({ name }) });
      onSaved(o); setMsg("Salvo.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <Card title="Organização">
      <label className="block">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">Nome</span>
        <div className="mt-1 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputC} />
          <button onClick={save} disabled={busy || name === org.name || !name.trim()} className={btnPrimary}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </label>
      <div className="mt-2 space-y-1">
        <Row label="Slug" value={org.slug} />
        <Row label="Status" value={org.status} />
        <Row label="BYOK (chaves próprias de IA)" value={org.byokEnabled ? "Ativo" : "Inativo"} />
        <Row label="Criada em" value={new Date(org.createdAt).toLocaleDateString("pt-BR")} />
      </div>
      {msg && <p className="mt-2 text-sm text-emerald-500">{msg}</p>}
      {err && <p className="mt-2 text-sm text-rose-500">{err}</p>}
    </Card>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErr(null);
    if (nw !== confirm) { setErr("A confirmação não confere."); return; }
    setBusy(true);
    try {
      await api("/settings/password", { method: "POST", body: JSON.stringify({ currentPassword: cur, newPassword: nw }) });
      setMsg("Senha alterada com sucesso.");
      setCur(""); setNw(""); setConfirm("");
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <Card title="Trocar senha">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Senha atual"><input type="password" required value={cur} onChange={(e) => setCur(e.target.value)} className={inputC} /></Field>
        <Field label="Nova senha (mín. 8)"><input type="password" required minLength={8} value={nw} onChange={(e) => setNw(e.target.value)} className={inputC} /></Field>
        <Field label="Confirmar nova senha"><input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputC} /></Field>
        {msg && <p className="text-sm text-emerald-500">{msg}</p>}
        {err && <p className="text-sm text-rose-500">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Salvando…" : "Alterar senha"}</button>
      </form>
    </Card>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span><div className="mt-1">{children}</div></label>;
}
const inputC = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const btnPrimary = "shrink-0 rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
