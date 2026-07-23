"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Entry {
  id: string;
  kind: string;
  content: string;
  sourceRef?: string | null;
  createdAt: string;
}

/** Categorias sugeridas (o operador pode digitar outra livremente). */
const KINDS = [
  { value: "empresa", label: "Empresa" },
  { value: "mercado", label: "Mercado" },
  { value: "atualidade", label: "Atualidade / novidade" },
  { value: "concorrencia", label: "Concorrência" },
  { value: "produto", label: "Produto / oferta" },
  { value: "diretriz", label: "Diretriz (regra p/ a IA)" },
];

function dt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function kindLabel(k: string): string {
  return KINDS.find((x) => x.value === k)?.label ?? k;
}

/**
 * Base de conhecimento do cliente — o operador adiciona informações extras da
 * empresa/mercado a qualquer momento. Cada item alimenta o contexto da IA
 * (scope="client"), deixando as próximas linhas editoriais mais atualizadas.
 */
export function KnowledgeTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Entry[] | null>(null);
  const [kind, setKind] = useState("empresa");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try { setItems(await api<Entry[]>(`/clients/${clientId}/knowledge`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  async function add() {
    if (!content.trim()) { setErr("Escreva a informação a adicionar."); return; }
    setBusy(true); setErr(null);
    try {
      await api(`/clients/${clientId}/knowledge`, {
        method: "POST",
        body: JSON.stringify({ kind: kind || "empresa", content }),
      });
      setContent("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao adicionar"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await api(`/memory/${id}`, { method: "DELETE" }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao remover"); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-sm font-semibold">Adicionar informação à base do cliente</p>
        <p className="mt-1 text-xs text-muted">
          Novidades da empresa, mudanças de mercado, lançamentos, dados, contexto de atualidade… Tudo que você
          adicionar aqui é lido automaticamente pela IA nas próximas linhas editoriais — sem refazer o onboarding.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
          <label className="block">
            <span className="label-caps text-muted">Categoria</span>
            <input
              list="knowledge-kinds"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <datalist id="knowledge-kinds">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </datalist>
          </label>
          <label className="block">
            <span className="label-caps text-muted">Informação</span>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Ex.: a empresa acabou de lançar uma nova linha de produtos X; o mercado está reagindo à mudança regulatória Y; entrou um concorrente forte na região…"
              className="mt-1 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between">
          {err ? <p className="text-sm text-crit">{err}</p> : <span />}
          <button
            onClick={add}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
          >
            {busy ? "Adicionando…" : "Adicionar à base"}
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Carregando base de conhecimento…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma informação extra ainda. Adicione o que a IA precisa saber para manter as linhas atualizadas.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="label-caps text-muted">Informações da base ({items.length})</p>
          {items.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">{kindLabel(e.kind)}</span>
                  <span className="text-[11px] text-muted">{dt(e.createdAt)}</span>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated hover:text-crit"
                >
                  Remover
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{e.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
