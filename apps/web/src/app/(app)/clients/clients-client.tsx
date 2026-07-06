"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Client { id: string; name: string; industry?: string; website?: string; createdAt: string }

/**
 * Lista de clientes (V2). A hierarquia Marca/Projeto é interna e automática —
 * o operador só enxerga o Cliente; toda a operação acontece dentro do detalhe.
 */
export function ClientsClient() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [modal, setModal] = useState<null | "client">(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function archiveClient(c: Client) {
    if (!confirm(`Arquivar o cliente "${c.name}"? Ele some das listas, mas o histórico é preservado.`)) return;
    try { await api(`/clients/${c.id}`, { method: "DELETE" }); loadAll(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }

  async function loadAll() {
    try {
      setClients(await api<Client[]>("/clients"));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { loadAll(); }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Clientes"
        subtitle="Cadastre o cliente e faça o onboarding — o resto do fluxo acontece dentro dele."
        action={
          <button onClick={() => setModal("client")} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            + Novo cliente
          </button>
        }
      />
      {err && <p className="mb-3 text-sm text-rose-500">{err}</p>}

      <div className="space-y-2">
        {clients === null ? <p className="text-sm text-muted">Carregando…</p> :
          clients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
              Nenhum cliente ainda. Clique em “Novo cliente” para começar.
            </p>
          ) :
          clients.map((c) => (
            <div key={c.id} className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-elevated p-3 transition hover:border-brand/50">
              <Link href={`/clients/${c.id}`} className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                {c.industry && <p className="text-xs text-muted">{c.industry}</p>}
              </Link>
              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => setEditing(c)} title="Editar" className="grid h-7 w-7 place-items-center rounded-md border border-border text-xs hover:bg-surface">✎</button>
                <button onClick={() => archiveClient(c)} title="Arquivar" className="grid h-7 w-7 place-items-center rounded-md border border-border text-xs hover:bg-surface">🗄</button>
              </div>
            </div>
          ))}
      </div>

      {editing && <ClientEditModal client={editing} onClose={() => setEditing(null)} onSaved={loadAll} />}
      {modal === "client" && <ClientModal onClose={() => setModal(null)} onSaved={loadAll} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-elevated p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", industry: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api("/clients", { method: "POST", body: JSON.stringify({ name: f.name, industry: f.industry || undefined, website: f.website || undefined, tags: [] })});
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }
  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Nome *"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputC} /></Field>
        <Field label="Indústria"><input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={inputC} /></Field>
        <Field label="Site"><input type="url" placeholder="https://…" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className={inputC} /></Field>
        {err && <p className="text-sm text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
function ClientEditModal({ client, onClose, onSaved }: { client: Client; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: client.name, industry: client.industry ?? "", website: client.website ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api(`/clients/${client.id}`, { method: "PATCH", body: JSON.stringify({ name: f.name, industry: f.industry || null, website: f.website || null }) });
      onSaved(); onClose();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro"); setBusy(false); }
  }
  return (
    <Modal title="Editar cliente" onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Nome *"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputC} /></Field>
        <Field label="Indústria"><input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={inputC} /></Field>
        <Field label="Site"><input type="url" placeholder="https://…" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className={inputC} /></Field>
        {err && <p className="text-sm text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span><div className="mt-1">{children}</div></label>;
}
const inputC = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const btnPrimary = "rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";
const btnGhost = "rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface";
