"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Client { id: string; name: string; industry?: string; website?: string; createdAt: string }
interface Brand { id: string; name: string; clientId: string; positioning?: string; client?: { name: string } }
interface Project { id: string; name: string; brandId: string; status: string; brand?: { name: string; client?: { name: string } } }

/**
 * Clients → Brands → Projects — a 3-tier CRUD that gives the user a real
 * project to point the AI modules (Mercado, Audiência, DNA, Editorial) at.
 * Kept in one screen with three columns so the hierarchy is obvious.
 */
export function ClientsClient() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modal, setModal] = useState<null | "client" | "brand" | "project">(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, b, p] = await Promise.all([
        api<Client[]>("/clients"),
        api<Brand[]>("/brands"),
        api<Project[]>("/projects"),
      ]);
      setClients(c); setBrands(b); setProjects(p);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { loadAll(); }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Clientes"
        subtitle="Cliente → Marca → Projeto. Os módulos de IA operam sobre um projeto."
      />
      {err && <p className="mb-3 text-sm text-rose-500">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          title={`Clientes (${clients?.length ?? 0})`}
          onAdd={() => setModal("client")}
        >
          {clients === null ? <p className="text-sm text-muted">…</p> :
            clients.length === 0 ? <Empty text="Cadastre um cliente" /> :
            clients.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{c.name}</p>
                {c.industry && <p className="text-xs text-muted">{c.industry}</p>}
              </div>
            ))}
        </Column>
        <Column
          title={`Marcas (${brands.length})`}
          onAdd={() => clients && clients.length > 0 && setModal("brand")}
          disabled={!clients?.length}
        >
          {brands.length === 0 ? <Empty text={clients?.length ? "Adicione uma marca" : "Crie um cliente antes"} /> :
            brands.map((b) => (
              <div key={b.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{b.name}</p>
                {b.client && <p className="text-xs text-muted">{b.client.name}</p>}
              </div>
            ))}
        </Column>
        <Column
          title={`Projetos (${projects.length})`}
          onAdd={() => brands.length > 0 && setModal("project")}
          disabled={!brands.length}
        >
          {projects.length === 0 ? <Empty text={brands.length ? "Adicione um projeto" : "Crie uma marca antes"} /> :
            projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">{p.name}</p>
                {p.brand && <p className="text-xs text-muted">{p.brand.client?.name ? `${p.brand.client.name} · ` : ""}{p.brand.name}</p>}
                <span className="mt-1 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{p.status}</span>
              </div>
            ))}
        </Column>
      </div>

      {modal === "client" && <ClientModal onClose={() => setModal(null)} onSaved={loadAll} />}
      {modal === "brand" && <BrandModal clients={clients ?? []} onClose={() => setModal(null)} onSaved={loadAll} />}
      {modal === "project" && <ProjectModal brands={brands} onClose={() => setModal(null)} onSaved={loadAll} />}
    </div>
  );
}

function Column({ title, onAdd, disabled, children }: { title: string; onAdd: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-elevated p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button onClick={onAdd} disabled={disabled} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface disabled:opacity-40">
          + Adicionar
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Empty({ text }: { text: string }) { return <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">{text}</p>; }

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
function BrandModal({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ clientId: clients[0]?.id ?? "", name: "", positioning: "", valueProposition: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api("/brands", { method: "POST", body: JSON.stringify({ ...f, positioning: f.positioning || undefined, valueProposition: f.valueProposition || undefined, products: [], objectives: [] })});
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }
  return (
    <Modal title="Nova marca" onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Cliente *"><select required value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} className={inputC}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Nome *"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputC} /></Field>
        <Field label="Posicionamento"><textarea rows={2} value={f.positioning} onChange={(e) => setF({ ...f, positioning: e.target.value })} className={inputC} /></Field>
        <Field label="Proposta de valor"><textarea rows={2} value={f.valueProposition} onChange={(e) => setF({ ...f, valueProposition: e.target.value })} className={inputC} /></Field>
        {err && <p className="text-sm text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
function ProjectModal({ brands, onClose, onSaved }: { brands: Brand[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ brandId: brands[0]?.id ?? "", name: "", goal: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api("/projects", { method: "POST", body: JSON.stringify({ ...f, goal: f.goal || undefined, platforms: [] })});
      onSaved(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); setBusy(false); }
  }
  return (
    <Modal title="Novo projeto" onClose={onClose}>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Marca *"><select required value={f.brandId} onChange={(e) => setF({ ...f, brandId: e.target.value })} className={inputC}>{brands.map((b) => <option key={b.id} value={b.id}>{b.client?.name ? `${b.client.name} · ` : ""}{b.name}</option>)}</select></Field>
        <Field label="Nome *"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputC} /></Field>
        <Field label="Objetivo"><textarea rows={2} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} className={inputC} /></Field>
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
