"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

interface Memory {
  id: string;
  scope: "org" | "project" | "brand" | "client";
  scopeId: string;
  kind: string;
  content: string;
  createdAt: string;
}
interface Deliverable { id: string; title: string; type: string; channel: string; status: string; createdAt: string }
interface Strategy { id: string; positioning?: string | null; createdAt: string; editorialLines?: { id: string; name: string }[] }

const KIND_SUGGESTIONS = [
  "diretriz",
  "linguagem",
  "tom_de_voz",
  "linha_editorial",
  "preferência",
  "restrição",
  "referência",
];

export function MemoryClient() {
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<Memory[] | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // add form
  const [scope, setScope] = useState<"project" | "org">("project");
  const [kind, setKind] = useState("diretriz");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!projectId) return;
    try {
      const [mem, dels, strats] = await Promise.all([
        api<Memory[]>(`/memory?projectId=${projectId}`),
        api<Deliverable[]>(`/deliverables?projectId=${projectId}`).catch(() => []),
        api<Strategy[]>(`/editorial?projectId=${projectId}`).catch(() => []),
      ]);
      setItems(mem);
      setDeliverables(dels);
      setStrategies(strats);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true); setErr(null);
    try {
      await api("/memory", {
        method: "POST",
        body: JSON.stringify({ scope, projectId: scope === "project" ? projectId : undefined, kind, content }),
      });
      setContent("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setItems((prev) => prev?.filter((m) => m.id !== id) ?? prev);
    try { await api(`/memory/${id}`, { method: "DELETE" }); } catch { await load(); }
  }

  async function save(id: string, patch: { kind?: string; content?: string }) {
    try {
      const updated = await api<Memory>(`/memory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setItems((prev) => prev?.map((m) => (m.id === id ? updated : m)) ?? prev);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  const global = items?.filter((m) => m.scope === "org" && m.kind !== "framework") ?? [];
  const project = items?.filter((m) => m.scope === "project" && m.kind !== "framework") ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Memória"
        subtitle="Framework, diretrizes e histórico do cliente que a IA sempre consulta antes de gerar."
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      <FrameworkEditor
        projectId={projectId}
        items={items ?? []}
        onSaved={load}
      />

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="mb-1 text-sm font-semibold">Adicionar à memória</p>
        <p className="mb-3 text-xs text-muted">
          Regras, preferências e o jeito de falar da marca. Tudo entra no contexto de toda geração
          de IA — persona, DNA da marca, linha editorial e roteiros.
        </p>
        <form onSubmit={add} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              <button type="button" onClick={() => setScope("project")} className={`rounded-md px-3 py-1.5 font-medium ${scope === "project" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}>
                Este projeto
              </button>
              <button type="button" onClick={() => setScope("org")} className={`rounded-md px-3 py-1.5 font-medium ${scope === "org" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}>
                Global (organização)
              </button>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">Tipo</span>
              <input
                list="mem-kinds"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="w-44 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <datalist id="mem-kinds">
                {KIND_SUGGESTIONS.map((k) => <option key={k} value={k} />)}
              </datalist>
            </label>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Ex.: Sempre falar em 'você'. Evitar jargão técnico. Linha editorial foca em educação + prova social. Nunca prometer resultado garantido."
            className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={busy || !content.trim() || (scope === "project" && !projectId)}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Salvando…" : "Salvar na memória"}
            </button>
          </div>
        </form>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Selecione um projeto para ver a memória.</p>
      ) : (
        <div className="space-y-6">
          <MemGroup title="Global (toda a organização)" items={global} onSave={save} onRemove={remove} />
          <MemGroup title="Deste projeto" items={project} onSave={save} onRemove={remove} />
        </div>
      )}

      <EditorialHistory strategies={strategies} />
      <ClientDeliverables deliverables={deliverables} />
    </div>
  );
}

/** Framework ("como penso pra fazer"): the method every copy is based on.
 * Stored as a memory entry of kind "framework" so it flows into every prompt. */
function FrameworkEditor({ projectId, items, onSaved }: { projectId: string; items: Memory[]; onSaved: () => void }) {
  const [fwScope, setFwScope] = useState<"project" | "org">("org");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const current = useMemo(
    () => items.find((m) => m.kind === "framework" && m.scope === fwScope) ?? null,
    [items, fwScope],
  );

  useEffect(() => {
    if (!dirty) setDraft(current?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, fwScope]);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      if (current) {
        await api(`/memory/${current.id}`, { method: "PATCH", body: JSON.stringify({ content: draft }) });
      } else {
        await api("/memory", {
          method: "POST",
          body: JSON.stringify({ scope: fwScope, projectId: fwScope === "project" ? projectId : undefined, kind: "framework", content: draft }),
        });
      }
      setDirty(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand/40 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold">Framework — como você pensa e produz</p>
        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">base de toda copy</span>
        <div className="ml-auto inline-flex rounded-lg border border-border p-0.5 text-xs">
          <button type="button" onClick={() => { setFwScope("org"); setDirty(false); }} className={`rounded-md px-3 py-1 font-medium ${fwScope === "org" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}>Global</button>
          <button type="button" onClick={() => { setFwScope("project"); setDirty(false); }} className={`rounded-md px-3 py-1 font-medium ${fwScope === "project" ? "bg-brand text-white" : "text-muted hover:text-foreground"}`}>Projeto</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Descreva seu método: como você estrutura o pensamento, os passos, a fórmula de copy, o que
        toda peça precisa ter. A IA usa isso como base prioritária em cada geração.
      </p>
      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
        rows={7}
        placeholder={"Ex.: 1) Toda copy começa por uma tensão real da persona.\n2) Estrutura: gancho → contexto → virada → prova → CTA.\n3) Sempre conectar ao objetivo de negócio.\n4) Tom: direto, sem jargão, com autoridade."}
        className="mt-3 w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted">{fwScope === "project" && !projectId ? "Selecione um projeto para salvar no escopo do projeto." : ""}</span>
        <button
          onClick={save}
          disabled={busy || !draft.trim() || (fwScope === "project" && !projectId)}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Salvando…" : current ? "Atualizar framework" : "Salvar framework"}
        </button>
      </div>
    </div>
  );
}

function EditorialHistory({ strategies }: { strategies: Strategy[] }) {
  if (strategies.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Histórico de linhas editoriais <span className="text-muted">({strategies.length})</span></h2>
      <p className="mb-2 text-xs text-muted">A IA evolui a linha editorial a partir destas — sem recomeçar do zero.</p>
      <ul className="space-y-2">
        {strategies.map((s) => (
          <li key={s.id} className="rounded-lg border border-border bg-elevated p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{s.positioning || "Linha editorial"}</span>
              <span className="text-xs text-muted">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
            {s.editorialLines && s.editorialLines.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.editorialLines.map((l) => <span key={l.id} className="rounded-md border border-border px-2 py-0.5 text-xs">{l.name}</span>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ClientDeliverables({ deliverables }: { deliverables: Deliverable[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Entregas anteriores do cliente <span className="text-muted">({deliverables.length})</span></h2>
      <p className="mb-2 text-xs text-muted">Repertório usado pela IA para não repetir ângulos e evitar erros já apontados.</p>
      {deliverables.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">Nenhuma entrega ainda.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-elevated">
          {deliverables.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{d.title}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <span>{d.channel} · {d.type}</span>
                <span className="rounded-full bg-border/60 px-2 py-0.5">{d.status}</span>
                <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemGroup({
  title, items, onSave, onRemove,
}: {
  title: string;
  items: Memory[];
  onSave: (id: string, patch: { kind?: string; content?: string }) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{title} <span className="text-muted">({items.length})</span></h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted">Nada aqui ainda.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((m) => <MemRow key={m.id} m={m} onSave={onSave} onRemove={onRemove} />)}
        </ul>
      )}
    </section>
  );
}

function MemRow({
  m, onSave, onRemove,
}: {
  m: Memory;
  onSave: (id: string, patch: { kind?: string; content?: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);

  return (
    <li className="rounded-lg border border-border bg-elevated p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{m.kind}</span>
        <div className="ml-auto flex gap-2 text-xs">
          {editing ? (
            <>
              <button onClick={() => { onSave(m.id, { content: draft }); setEditing(false); }} className="font-medium text-brand hover:underline">Salvar</button>
              <button onClick={() => { setDraft(m.content); setEditing(false); }} className="text-muted hover:underline">Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-muted hover:text-foreground hover:underline">Editar</button>
              <button onClick={() => onRemove(m.id)} className="text-rose-500 hover:underline">Excluir</button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-border bg-surface p-2 text-sm outline-none focus:border-brand"
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>
      )}
    </li>
  );
}
