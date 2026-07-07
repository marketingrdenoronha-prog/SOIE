"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { text } from "@/lib/render";
import { EditorialDoc } from "@/components/editorial-doc";

interface StockCard {
  id: string;
  clientId: string | null;
  clientName: string;
  version: number;
  positioning: string | null;
  competencia: string | null;
  status: string;
  deliveryMethod: string | null;
  contentCount: number;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
}

/** ESTOQUE EDITORIAL (global, no menu lateral) — acervo permanente de todas as
 * linhas aprovadas + enviadas, agrupado por cliente. Cada cliente tem seu
 * acervo exclusivo. Ao abrir uma linha, mostra o documento congelado exato. */
export function EditorialStockClient() {
  const [items, setItems] = useState<StockCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);

  function reload() {
    setErr(null);
    api<{ items: StockCard[] }>("/editorial-stock")
      .then((r) => setItems(r.items))
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }
  useEffect(() => {
    reload();
    api<Array<{ id: string; name: string }>>("/clients").then(setClients).catch(() => {});
  }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => i.clientName.toLowerCase().includes(q) || text(i.positioning).toLowerCase().includes(q) || (i.competencia ?? "").toLowerCase().includes(q))
      : items;
    const map = new Map<string, { clientId: string; clientName: string; cards: StockCard[] }>();
    for (const it of filtered) {
      const key = it.clientId ?? "—";
      if (!map.has(key)) map.set(key, { clientId: key, clientName: it.clientName, cards: [] });
      map.get(key)!.cards.push(it);
    }
    return [...map.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [items, query]);

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Estoque Editorial</h1>
          <p className="mt-1 text-sm text-muted">
            Acervo permanente das linhas editoriais aprovadas e enviadas — a memória estratégica que a IA usa para
            evoluir a comunicação de cada cliente. Cada cliente tem seu acervo exclusivo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {items && items.length > 0 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente, competência…"
              className="w-56 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
          <button
            onClick={() => setShowImport(true)}
            className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]"
          >
            ＋ Anexar linha antiga
          </button>
        </div>
      </div>

      {err ? (
        <p className="text-sm text-crit">{err}</p>
      ) : items === null ? (
        <p className="text-sm text-muted">Carregando estoque editorial…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
          Nenhuma linha no estoque ainda. Uma linha entra automaticamente aqui quando é aprovada pelo cliente e
          enviada (mensagem ou documento), dentro do cliente na aba <strong>Linha Editorial</strong>.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum resultado para “{query}”.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.clientId}>
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
                <Link href={`/clients/${g.clientId}`} className="text-lg font-semibold hover:text-brand-strong dark:hover:text-brand">
                  {g.clientName}
                </Link>
                <span className="label-caps text-muted">
                  {g.cards.length} linha(s) · {g.cards.reduce((s, c) => s + c.contentCount, 0)} conteúdo(s)
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.cards.map((s) => (
                  <StockCardView key={s.id} s={s} onOpen={() => setOpenId(s.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {openId && <StockDetail strategyId={openId} onClose={() => setOpenId(null)} />}
      {showImport && (
        <ManualImportModal
          clients={clients}
          onClose={() => setShowImport(false)}
          onSaved={() => { setShowImport(false); reload(); }}
        />
      )}
    </div>
  );
}

interface DraftContent { title: string; format: string; hook: string; cta: string; copy: string }
const EMPTY_CONTENT: DraftContent = { title: "", format: "", hook: "", cta: "", copy: "" };
const FORMAT_OPTIONS = ["", "Vídeo", "Motion", "Carrossel", "Estático"];

/** Formulário de anexo manual de uma linha editorial ANTIGA (histórico anterior
 * ao SOIE) — vira acervo e memória da IA. */
function ManualImportModal({ clients, onClose, onSaved }: {
  clients: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [positioning, setPositioning] = useState("");
  const [approvedAt, setApprovedAt] = useState("");
  const [sentAt, setSentAt] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"message" | "document">("document");
  const [contents, setContents] = useState<DraftContent[]>([{ ...EMPTY_CONTENT }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setContent(i: number, patch: Partial<DraftContent>) {
    setContents((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addContent() { setContents((cs) => [...cs, { ...EMPTY_CONTENT }]); }
  function removeContent(i: number) { setContents((cs) => cs.length > 1 ? cs.filter((_, idx) => idx !== i) : cs); }

  const validContents = contents.filter((c) => c.title.trim());
  const canSave = Boolean(clientId) && validContents.length > 0 && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true); setErr(null);
    try {
      await api("/editorial-stock/manual", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          name: name.trim() || undefined,
          competencia: competencia.trim() || undefined,
          positioning: positioning.trim() || undefined,
          approvedAt: approvedAt ? new Date(approvedAt).toISOString() : undefined,
          sentAt: sentAt ? new Date(sentAt).toISOString() : undefined,
          deliveryMethod,
          contents: validContents.map((c) => ({
            title: c.title.trim(),
            format: c.format || undefined,
            hook: c.hook.trim() || undefined,
            cta: c.cta.trim() || undefined,
            copy: c.copy.trim() || undefined,
          })),
        }),
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao anexar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-[720px] rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-semibold">Anexar linha editorial antiga</p>
            <p className="text-xs text-muted">Histórico anterior ao SOIE — entra no acervo e vira memória da IA.</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated">Fechar</button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Cliente *">
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="">Selecione…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Labeled>
            <Labeled label="Competência (ex.: 2026-05)">
              <input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="AAAA-MM" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </Labeled>
            <Labeled label="Nome da linha (opcional)">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Linha de Maio/2026" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </Labeled>
            <Labeled label="Forma de envio original">
              <select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as "message" | "document")} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                <option value="document">Documento</option>
                <option value="message">Mensagem</option>
              </select>
            </Labeled>
            <Labeled label="Data de aprovação (opcional)">
              <input type="date" value={approvedAt} onChange={(e) => setApprovedAt(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </Labeled>
            <Labeled label="Data de envio (opcional)">
              <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </Labeled>
          </div>
          <Labeled label="Posicionamento da linha (opcional)">
            <input value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="Direção estratégica que essa linha seguiu" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
          </Labeled>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label-caps text-muted">Conteúdos ({validContents.length})</p>
              <button onClick={addContent} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-elevated">＋ Adicionar conteúdo</button>
            </div>
            <div className="space-y-3">
              {contents.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-elevated p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="label-caps text-muted">#{String(i + 1).padStart(2, "0")}</span>
                    {contents.length > 1 && (
                      <button onClick={() => removeContent(i)} className="text-xs text-crit hover:underline">remover</button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={c.title} onChange={(e) => setContent(i, { title: e.target.value })} placeholder="Tema / título *" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                    <select value={c.format} onChange={(e) => setContent(i, { format: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                      {FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f || "Formato (opcional)"}</option>)}
                    </select>
                    <input value={c.hook} onChange={(e) => setContent(i, { hook: e.target.value })} placeholder="Gancho (opcional)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                    <input value={c.cta} onChange={(e) => setContent(i, { cta: e.target.value })} placeholder="CTA (opcional)" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                  </div>
                  <textarea value={c.copy} onChange={(e) => setContent(i, { copy: e.target.value })} rows={3} placeholder="Copy / conteúdo completo (cole aqui o texto enviado)" className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                </div>
              ))}
            </div>
          </div>

          {err && <p className="text-sm text-crit">{err}</p>}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-elevated">Cancelar</button>
            <button onClick={save} disabled={!canSave} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
              {busy ? "Anexando…" : "Anexar ao estoque"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function StockCardView({ s, onOpen }: { s: StockCard; onOpen: () => void }) {
  return (
    <article className="rounded-xl border border-border bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">Linha Editorial V{s.version}</p>
          {text(s.positioning) && <p className="truncate text-xs text-muted">{text(s.positioning)}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-medium text-ok">Em estoque</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Competência" value={s.competencia ?? "—"} />
        <Field label="Conteúdos" value={String(s.contentCount)} />
        <Field label="Aprovação" value={fmt(s.approvedAt)} />
        <Field label="Envio" value={fmt(s.sentAt)} />
        <Field label="Forma de envio" value={deliveryLabel(s.deliveryMethod)} />
        <Field label="Status" value={statusLabel(s.status)} />
      </dl>

      <button onClick={onOpen} className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
        Ver conteúdo completo
      </button>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/** Documento congelado exato — carregado sob demanda. Prefere o snapshot; cai
 * para as linhas ao vivo se a linha entrou no estoque antes do congelamento. */
function StockDetail({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null); setErr(null);
    api<any>(`/editorial-strategies/${strategyId}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [strategyId]);

  const lines = data?.contentSnapshot?.lines ?? data?.editorialLines;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-[860px] rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-semibold">Linha Editorial V{data?.version ?? ""} · documento enviado ao cliente</p>
            <p className="text-xs text-muted">Acervo permanente — exatamente como foi enviado, sem alterações.</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated">Fechar</button>
        </div>
        {err ? <p className="text-sm text-crit">{err}</p> :
          data === null ? <p className="text-sm text-muted">Carregando documento…</p> :
          <EditorialDoc lines={lines} />}
      </div>
    </div>
  );
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function deliveryLabel(m: string | null): string {
  return m === "message" ? "Mensagem" : m === "document" ? "Documento" : "—";
}
function statusLabel(s: string): string {
  return ({ approved: "Aprovada", pending_client: "Aguardando", draft: "Rascunho", changes_requested: "Ajuste" } as Record<string, string>)[s] ?? s;
}
