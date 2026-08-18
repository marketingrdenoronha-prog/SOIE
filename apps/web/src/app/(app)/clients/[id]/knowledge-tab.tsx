"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiUpload } from "@/lib/api";

interface Source {
  id: string;
  type: string;
  title: string;
  url?: string | null;
  domain?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  fetchedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  status: string;
  enabled: boolean;
  tags?: string[];
  priority?: number;
  summary?: string | null;
  meta?: any;
}

const TYPES: Record<string, { label: string; cls: string }> = {
  manual: { label: "Nota", cls: "bg-brand/10 text-brand" },
  document: { label: "Documento", cls: "bg-brand/10 text-brand" },
  article: { label: "Artigo", cls: "bg-brand/10 text-brand" },
  news: { label: "Notícia", cls: "bg-warn/15 text-warn" },
  webpage: { label: "Página", cls: "bg-brand/10 text-brand" },
};
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Na fila", cls: "bg-border/60 text-muted" },
  processing: { label: "Processando…", cls: "bg-warn/15 text-warn" },
  ready: { label: "Pronto", cls: "bg-ok/15 text-ok" },
  failed: { label: "Falhou", cls: "bg-crit/15 text-crit" },
  disabled: { label: "Desativado", cls: "bg-border/60 text-muted" },
};

function dt(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * Base de Conhecimento (V3) — camada ativa que alimenta a geração da Linha
 * Editorial. O operador adiciona notas, links (artigos/notícias/páginas) e
 * documentos; o SOIE extrai, indexa e recupera na hora de gerar.
 */
export function KnowledgeTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Source[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"nota" | "link" | "arquivo">("nota");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(silent?: boolean) {
    if (!silent) setErr(null);
    try {
      setItems(await api<Source[]>(`/clients/${clientId}/knowledge-sources`));
    } catch (e) {
      if (!silent) setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Enquanto houver fontes processando, atualiza sozinho até concluírem.
  const processing = (items ?? []).some((s) => s.status === "processing" || s.status === "pending");
  useEffect(() => {
    if (processing && !pollRef.current) {
      pollRef.current = setInterval(() => load(true), 4000);
    } else if (!processing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing]);

  const filtered = useMemo(() => {
    let list = items ?? [];
    if (typeFilter) list = list.filter((s) => s.type === typeFilter);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((s) => s.title.toLowerCase().includes(t) || (s.domain ?? "").toLowerCase().includes(t) || (s.tags ?? []).some((tag) => tag.toLowerCase().includes(t)));
    }
    return list;
  }, [items, typeFilter, q]);

  const ready = (items ?? []).filter((s) => s.status === "ready" && s.enabled).length;

  return (
    <div className="space-y-5">
      <AddPanel clientId={clientId} mode={mode} setMode={setMode} onAdded={() => load()} />

      {/* Barra de busca e filtros */}
      {items && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, domínio ou tag…"
            className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
            <option value="">Todos os tipos</option>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-muted">{ready} fonte(s) ativa(s) alimentando a IA</span>
        </div>
      )}

      {err && <p className="text-sm text-crit">{err}</p>}

      {items === null ? (
        <p className="text-sm text-muted">Carregando base de conhecimento…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          {items.length === 0
            ? "Nenhuma fonte ainda. Adicione notas, links e documentos — a IA usa tudo isso para gerar linhas editoriais mais atualizadas e específicas."
            : "Nenhuma fonte corresponde ao filtro."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SourceCard key={s.id} clientId={clientId} source={s} onChanged={() => load()} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddPanel({ clientId, mode, setMode, onAdded }: {
  clientId: string; mode: "nota" | "link" | "arquivo"; setMode: (m: "nota" | "link" | "arquivo") => void; onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [urlV, setUrlV] = useState("");
  const [linkType, setLinkType] = useState<"article" | "news" | "webpage">("article");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedTags = () => tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);

  function reset() { setTitle(""); setContent(""); setUrlV(""); setTags(""); setPriority(0); }

  async function submit() {
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "nota") {
        if (!content.trim()) { setErr("Escreva o conteúdo da nota."); setBusy(false); return; }
        const r = await api<{ error: string | null }>(`/clients/${clientId}/knowledge-sources`, {
          method: "POST",
          body: JSON.stringify({ type: "manual", title: title || undefined, content, tags: parsedTags(), priority }),
        });
        if (r.error) setErr(r.error); else setInfo("Nota adicionada.");
      } else if (mode === "link") {
        if (!urlV.trim()) { setErr("Cole a URL pública."); setBusy(false); return; }
        const r = await api<{ error: string | null }>(`/clients/${clientId}/knowledge-sources`, {
          method: "POST",
          body: JSON.stringify({ type: linkType, url: urlV.trim(), title: title || undefined, tags: parsedTags(), priority }),
        });
        if (r.error) setErr(`Não foi possível importar: ${r.error}`); else setInfo("Link importado e indexado.");
      }
      reset();
      onAdded();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null); setInfo(null);
    try {
      // Reusa a extração já existente (PDF/DOCX/texto) e cria a fonte.
      const ext = await apiUpload<{ title: string; text: string }>(`/editorial-stock/extract`, file);
      const r = await api<{ error: string | null }>(`/clients/${clientId}/knowledge-sources`, {
        method: "POST",
        body: JSON.stringify({ type: "document", title: ext.title || file.name, content: ext.text, tags: parsedTags(), priority }),
      });
      if (r.error) setErr(r.error); else setInfo(`Documento "${ext.title || file.name}" adicionado.`);
      reset();
      onAdded();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Erro ao ler o arquivo"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <p className="text-sm font-semibold">Adicionar conhecimento</p>
      <p className="mt-1 text-xs text-muted">
        Tudo que você adicionar é extraído, indexado e recuperado pela IA na geração das linhas editoriais — sem refazer o onboarding.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {([["nota", "Criar nota"], ["link", "Adicionar link"], ["arquivo", "Enviar arquivo"]] as const).map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setErr(null); setInfo(null); }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${mode === m ? "border-brand bg-brand/10 text-brand-strong dark:text-brand" : "border-border hover:bg-surface"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {mode === "link" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label className="block"><span className="label-caps text-muted">URL pública</span>
              <input value={urlV} onChange={(e) => setUrlV(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <label className="block"><span className="label-caps text-muted">Tipo</span>
              <select value={linkType} onChange={(e) => setLinkType(e.target.value as any)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="article">Artigo</option><option value="news">Notícia</option><option value="webpage">Página</option>
              </select>
            </label>
          </div>
        )}
        {mode === "nota" && (
          <label className="block"><span className="label-caps text-muted">Conteúdo da nota</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="Ex.: a empresa lançou a linha X; o mercado reage à mudança regulatória Y; entrou um concorrente forte na região…" className="mt-1 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand" />
          </label>
        )}
        {mode === "arquivo" ? (
          <div>
            <span className="label-caps text-muted">Arquivo (PDF, DOCX ou texto)</span>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.csv" onChange={onFile} disabled={busy} className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
            <label className="block"><span className="label-caps text-muted">Título (opcional)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <label className="block"><span className="label-caps text-muted">Tags (vírgula)</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="mercado, lançamento" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <label className="block"><span className="label-caps text-muted">Prioridade</span>
              <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? "Normal" : `Alta ${n}`}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs">{err ? <span className="text-crit">{err}</span> : info ? <span className="text-ok">{info}</span> : <span className="text-muted">Conteúdo externo é tratado como dado — nunca como instrução para a IA.</span>}</div>
          {mode !== "arquivo" && (
            <button onClick={submit} disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
              {busy ? "Processando…" : mode === "link" ? "Importar link" : "Adicionar nota"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ clientId, source, onChanged }: { clientId: string; source: Source; onChanged: () => void }) {
  const [busy, setBusy] = useState<null | "reprocess" | "toggle" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const t = TYPES[source.type] ?? { label: source.type, cls: "bg-border/60 text-muted" };
  const st = STATUS[source.enabled ? source.status : "disabled"] ?? STATUS.pending;
  const chunks = source.meta?.chunks as number | undefined;
  const errMsg = source.meta?.error as string | undefined;
  const errCode = source.meta?.errorCode as string | undefined;
  const errHint =
    errCode === "JS_RENDER_REQUIRED"
      ? "Dica: este site monta o conteúdo por JavaScript. Copie o texto da página e adicione como nota."
      : errCode === "HTTP_403"
        ? "Dica: o site bloqueia leitura automática. Copie o texto e adicione como nota, ou tente outra URL do mesmo conteúdo."
        : errCode === "HTTP_404" || errCode === "DNS_ERROR"
          ? "Dica: confira se o endereço está correto e acessível."
          : errCode === "INSUFFICIENT_CONTENT"
            ? "Dica: aponte para a página específica do conteúdo (artigo/serviço) ou cole o texto como nota."
            : undefined;

  async function reprocess() {
    setBusy("reprocess"); setErr(null);
    try { await api(`/clients/${clientId}/knowledge-sources/${source.id}/reprocess`, { method: "POST" }); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(null); }
  }
  async function toggle() {
    setBusy("toggle"); setErr(null);
    try { await api(`/clients/${clientId}/knowledge-sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) }); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(null); }
  }
  async function remove() {
    if (typeof window !== "undefined" && !window.confirm("Excluir esta fonte da base?")) return;
    setBusy("delete"); setErr(null);
    try { await api(`/clients/${clientId}/knowledge-sources/${source.id}`, { method: "DELETE" }); onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(null); }
  }

  return (
    <div className={`rounded-lg border border-border bg-surface p-3 ${!source.enabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.cls}`}>{t.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
            {(source.priority ?? 0) > 0 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">Prioridade {source.priority}</span>}
          </div>
          <p className="mt-1.5 truncate text-sm font-medium">{source.title}</p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
            {source.domain && <span>{source.domain}</span>}
            {source.author && <span>· {source.author}</span>}
            {source.publishedAt && <span>· publicado {dt(source.publishedAt)}</span>}
            <span>· importado {dt(source.fetchedAt ?? source.createdAt)}</span>
            {typeof chunks === "number" && <span>· {chunks} trecho(s)</span>}
          </p>
          {(source.tags ?? []).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(source.tags ?? []).map((tag) => <span key={tag} className="rounded bg-border/50 px-1.5 py-0.5 text-[10px] text-muted">{tag}</span>)}
            </div>
          )}
          {source.status === "failed" && errMsg && (
            <>
              <p className="mt-1 text-[11px] text-crit">Falha: {errMsg}</p>
              {errHint && <p className="mt-0.5 text-[11px] text-muted">{errHint}</p>}
            </>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated">Abrir ↗</a>}
            <button onClick={() => setOpen((v) => !v)} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated">{open ? "Fechar" : "Ver"}</button>
          </div>
          <div className="flex gap-1">
            <button onClick={reprocess} disabled={busy !== null} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated disabled:opacity-50">{busy === "reprocess" ? "…" : "Atualizar"}</button>
            <button onClick={toggle} disabled={busy !== null} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated disabled:opacity-50">{source.enabled ? "Desativar" : "Ativar"}</button>
            <button onClick={remove} disabled={busy !== null} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:bg-elevated hover:text-crit disabled:opacity-50">{busy === "delete" ? "…" : "Excluir"}</button>
          </div>
        </div>
      </div>
      {err && <p className="mt-1 text-[11px] text-crit">{err}</p>}
      {open && (source.summary || source.status === "ready") && (
        <div className="mt-2 rounded-md border border-border bg-elevated/50 p-2.5">
          {source.summary && <p className="text-xs text-muted">{source.summary}</p>}
          <SourcePreview clientId={clientId} sourceId={source.id} />
        </div>
      )}
    </div>
  );
}

function SourcePreview({ clientId, sourceId }: { clientId: string; sourceId: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ content?: string | null }>(`/clients/${clientId}/knowledge-sources/${sourceId}`)
      .then((d) => { if (alive) setText((d.content ?? "").slice(0, 1200)); })
      .catch(() => { if (alive) setText(""); });
    return () => { alive = false; };
  }, [clientId, sourceId]);
  if (text === null) return <p className="mt-1 text-[11px] text-muted">Carregando prévia…</p>;
  if (!text) return null;
  return <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted">{text}{text.length >= 1200 ? "…" : ""}</p>;
}
