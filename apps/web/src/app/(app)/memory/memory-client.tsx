"use client";
import { useEffect, useState } from "react";
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

const KIND_SUGGESTIONS = [
  "diretriz",
  "linguagem",
  "linha_editorial",
  "tom_de_voz",
  "preferência",
  "restrição",
  "referência",
];

export function MemoryClient() {
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<Memory[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // add form
  const [scope, setScope] = useState<"project" | "org">("project");
  const [kind, setKind] = useState("diretriz");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!projectId) return;
    try {
      setItems(await api<Memory[]>(`/memory?projectId=${projectId}`));
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

  const global = items?.filter((m) => m.scope === "org") ?? [];
  const project = items?.filter((m) => m.scope === "project") ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Memória"
        subtitle="Diretrizes que a IA sempre consulta antes de gerar linha editorial, linguagem e entregas."
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="mb-1 text-sm font-semibold">Adicionar à memória</p>
        <p className="mb-3 text-xs text-muted">
          Escreva regras, preferências e o jeito de falar da marca. Tudo isso entra no contexto de
          toda geração de IA — persona, DNA da marca, linha editorial e roteiros.
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
          <div className="flex items-center justify-between">
            {err ? <p className="text-sm text-rose-500">{err}</p> : <span />}
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
    </div>
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
