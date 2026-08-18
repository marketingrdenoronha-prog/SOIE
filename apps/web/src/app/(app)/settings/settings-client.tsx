"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Org { id: string; name: string; slug: string; status: string; createdAt: string; byokEnabled: boolean }
interface Role { id: string; name: string; permissions: string[]; isSystem: boolean }
interface Member {
  id: string;
  status: string;
  user: { id: string; name: string; email: string; lastLoginAt: string | null };
  role: { id: string; name: string; permissions: string[] };
}
interface Data {
  organization: Org;
  memberships: Member[];
  roles: Role[];
  canManageMembers: boolean;
  meId: string;
}

export function SettingsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try { setData(await api<Data>("/settings")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Configurações" subtitle="Administração da organização, equipe e da sua conta." />
      {err && <p className="text-sm text-rose-500">{err}</p>}
      {!data ? <p className="text-sm text-muted">Carregando…</p> : (
        <>
          <OrgCard org={data.organization} onSaved={(o) => setData({ ...data, organization: o })} />
          <TeamCard data={data} reload={load} />
          <PasswordCard />
          <RolesCard data={data} reload={load} />
        </>
      )}
    </div>
  );
}

/* ── Equipe ──────────────────────────────────────────────────────────────── */

function TeamCard({ data, reload }: { data: Data; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const canManage = data.canManageMembers;

  return (
    <Card
      title={`Equipe (${data.memberships.length})`}
      action={canManage ? (
        <button onClick={() => setAdding((v) => !v)} className={btnSmall}>
          {adding ? "Fechar" : "+ Adicionar membro"}
        </button>
      ) : undefined}
    >
      {adding && canManage && (
        <AddMemberForm roles={data.roles} onDone={() => { setAdding(false); reload(); }} />
      )}

      <ul className="divide-y divide-border">
        {data.memberships.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            roles={data.roles}
            canManage={canManage}
            isSelf={m.user.id === data.meId}
            reload={reload}
          />
        ))}
      </ul>
      {!canManage && (
        <p className="mt-2 text-xs text-muted">
          Só quem tem permissão de gestão (dono/admin) pode adicionar ou editar a equipe.
        </p>
      )}
    </Card>
  );
}

function AddMemberForm({ roles, onDone }: { roles: Role[]; onDone: () => void }) {
  const nonOwner = roles.filter((r) => !r.permissions.includes("*"));
  const pick = nonOwner[0] ?? roles[0];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(pick?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await api("/settings/members", {
        method: "POST",
        body: JSON.stringify({ name, email, password, roleId }),
      });
      onDone();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputC} /></Field>
        <Field label="E-mail"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputC} /></Field>
        <Field label="Senha inicial (mín. 8)"><input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputC} /></Field>
        <Field label="Papel">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputC}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted">
        A pessoa entra com esse e-mail e senha e troca a senha depois em Configurações.
      </p>
      {err && <p className="text-sm text-rose-500">{err}</p>}
      <button type="submit" disabled={busy || !roleId} className={btnPrimary}>
        {busy ? "Adicionando…" : "Adicionar à equipe"}
      </button>
    </form>
  );
}

function MemberRow({ member, roles, canManage, isSelf, reload }: {
  member: Member; roles: Role[]; canManage: boolean; isSelf: boolean; reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function patch(patchBody: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try { await api(`/settings/members/${member.id}`, { method: "PATCH", body: JSON.stringify(patchBody) }); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Remover ${member.user.name} da equipe?`)) return;
    setBusy(true); setErr(null);
    try { await api(`/settings/members/${member.id}`, { method: "DELETE" }); reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }

  const suspended = member.status === "disabled";
  return (
    <li className="py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{member.user.name}{isSelf && <span className="ml-1 text-xs text-muted">(você)</span>}</p>
          <p className="truncate text-xs text-muted">{member.user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage ? (
            <select
              value={member.role.id}
              disabled={busy}
              onChange={(e) => patch({ roleId: e.target.value })}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-brand"
            >
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          ) : (
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand">{member.role.name}</span>
          )}
          <span className={`text-xs ${suspended ? "text-amber-500" : "text-emerald-500"}`}>
            {suspended ? "suspenso" : "ativo"}
          </span>
          {canManage && (
            <div className="flex gap-1">
              <button
                onClick={() => patch({ status: suspended ? "active" : "disabled" })}
                disabled={busy}
                title={suspended ? "Reativar" : "Suspender"}
                className="grid h-7 w-7 place-items-center rounded-md border border-border text-xs hover:bg-surface disabled:opacity-50"
              >
                {suspended ? "▶" : "⏸"}
              </button>
              <button
                onClick={remove}
                disabled={busy}
                title="Remover"
                className="grid h-7 w-7 place-items-center rounded-md border border-border text-xs text-rose-500 hover:bg-surface disabled:opacity-50"
              >
                🗑
              </button>
            </div>
          )}
        </div>
      </div>
      {err && <p className="mt-1 text-xs text-rose-500">{err}</p>}
    </li>
  );
}

/* ── Papéis ──────────────────────────────────────────────────────────────── */

const ALL_PERMS: Array<{ key: string; label: string }> = [
  { key: "members:manage", label: "Gerir equipe" },
  { key: "clients:manage", label: "Gerir clientes" },
  { key: "editorial:manage", label: "Linha editorial" },
  { key: "production:manage", label: "Produção" },
  { key: "review", label: "Aprovar (cliente)" },
];

function RolesCard({ data, reload }: { data: Data; reload: () => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await api("/settings/roles", { method: "POST", body: JSON.stringify({ name, permissions: perms }) });
      setName(""); setPerms([]); setCreating(false); reload();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro"); }
    finally { setBusy(false); }
  }
  const toggle = (k: string) => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <Card
      title="Papéis"
      action={data.canManageMembers ? (
        <button onClick={() => setCreating((v) => !v)} className={btnSmall}>{creating ? "Fechar" : "+ Novo papel"}</button>
      ) : undefined}
    >
      {creating && data.canManageMembers && (
        <form onSubmit={create} className="mb-4 space-y-3 rounded-lg border border-border bg-surface p-4">
          <Field label="Nome do papel"><input required value={name} onChange={(e) => setName(e.target.value)} className={inputC} /></Field>
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted">Permissões</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_PERMS.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  className={`rounded-full border px-3 py-1 text-xs ${perms.includes(p.key) ? "border-brand bg-brand/10 text-brand" : "border-border text-muted"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-rose-500">{err}</p>}
          <button type="submit" disabled={busy || !name.trim() || perms.length === 0} className={btnPrimary}>
            {busy ? "Criando…" : "Criar papel"}
          </button>
        </form>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.roles.map((r) => (
          <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="ml-2 text-xs text-muted">
              {r.permissions.includes("*") ? "acesso total" : r.permissions.length + " permissões"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ── Organização / Senha ─────────────────────────────────────────────────── */

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

/* ── UI base ─────────────────────────────────────────────────────────────── */

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-elevated p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
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
const btnSmall = "rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface";
