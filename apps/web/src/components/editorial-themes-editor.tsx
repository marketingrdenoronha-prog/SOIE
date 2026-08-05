"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { api } from "@/lib/api";
import { flattenThemes, ThemeContent } from "@/components/editorial-doc";

/**
 * Documento editável da linha editorial: cada conteúdo (#01, #02, …) sai pronto
 * (título, formato, objetivo, copy, observações) MAIS o campo obrigatório
 * AJUSTES MANUAIS e o STATUS DO CONTEÚDO. O operador escreve instruções para UM
 * conteúdo e a IA reescreve APENAS aquele — nenhum outro é tocado. Só editável
 * antes da aprovação; aprovada, vira leitura.
 */
export function EditorialThemesEditor({
  strategyId, lines, editable, onChanged,
}: {
  strategyId: string;
  lines: any[] | undefined;
  editable: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const themes = flattenThemes(lines);
  if (themes.length === 0) {
    return <p className="text-sm text-muted">Esta versão ainda não tem conteúdos com copy.</p>;
  }
  return (
    <div className="space-y-6">
      {themes.map((t, i) => (
        <ThemeCard key={t?.id ?? i} strategyId={strategyId} n={i + 1} theme={t} editable={editable} onChanged={onChanged} />
      ))}
    </div>
  );
}

const STATUS: Array<{ key: string; label: string; cls: string }> = [
  { key: "aprovado", label: "Aprovado", cls: "border-ok/50 bg-ok/10 text-ok" },
  { key: "revisar", label: "Revisar", cls: "border-warn/50 bg-warn/10 text-warn" },
  { key: "reescrever", label: "Reescrever", cls: "border-brand/50 bg-brand/10 text-brand-strong dark:text-brand" },
];

function ThemeCard({ strategyId, n, theme, editable, onChanged }: {
  strategyId: string; n: number; theme: any; editable: boolean; onChanged: () => Promise<void> | void;
}) {
  const [note, setNote] = useState<string>(theme?.adjustmentNote ?? "");
  const [status, setStatus] = useState<string>(theme?.contentStatus ?? "");
  const [busy, setBusy] = useState<null | "save" | "rewrite" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const themeId = theme?.id as string | undefined;

  async function saveStatus(next: string) {
    const value = status === next ? "" : next; // clicar de novo desmarca
    setStatus(value);
    if (!themeId) return;
    setBusy("save"); setErr(null); setInfo(null);
    try {
      await api(`/editorial-strategies/${strategyId}/themes/${themeId}`, {
        method: "PATCH",
        body: JSON.stringify({ contentStatus: value || null }),
      });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); }
  }

  async function saveNote() {
    if (!themeId) return;
    setBusy("save"); setErr(null); setInfo(null);
    try {
      await api(`/editorial-strategies/${strategyId}/themes/${themeId}`, {
        method: "PATCH",
        body: JSON.stringify({ adjustmentNote: note.trim() || null }),
      });
      setInfo("Ajustes salvos.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setBusy(null); }
  }

  async function rewrite() {
    if (!note.trim()) { setErr("Escreva as instruções do ajuste manual deste conteúdo."); return; }
    if (!themeId) return;
    setBusy("rewrite"); setErr(null); setInfo(null);
    try {
      const r = await api<{ demo: boolean }>(`/editorial-strategies/${strategyId}/themes/${themeId}/rewrite`, {
        method: "POST",
        body: JSON.stringify({ instructions: note.trim() }),
      });
      setInfo(r.demo ? "Reescrito em modo demo (configure a IA para conteúdo real)." : "Conteúdo reescrito com o ajuste.");
      await onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao reescrever"); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!themeId) return;
    if (typeof window !== "undefined" && !window.confirm("Excluir este conteúdo da linha? Os demais permanecem.")) return;
    setBusy("delete"); setErr(null); setInfo(null);
    try {
      await api(`/editorial-strategies/${strategyId}/themes/${themeId}`, { method: "DELETE" });
      await onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao excluir"); }
    finally { setBusy(null); }
  }

  const currentStatus = STATUS.find((s) => s.key === status);

  return (
    <article className="rounded-xl border border-border bg-elevated p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          <span className="text-muted">#{String(n).padStart(2, "0")}</span> | {String(theme?.title ?? "")}
        </h3>
        {currentStatus && (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${currentStatus.cls}`}>{currentStatus.label}</span>
        )}
      </div>

      <div className="mt-2">
        <ThemeContent theme={theme} />
      </div>

      {editable && themeId ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-caps text-muted">Status do conteúdo</span>
            {STATUS.map((s) => (
              <button
                key={s.key}
                onClick={() => saveStatus(s.key)}
                disabled={busy !== null}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium disabled:opacity-50 ${status === s.key ? s.cls : "border-border text-muted hover:bg-elevated"}`}
              >
                {s.label}
              </button>
            ))}
            <button
              onClick={remove}
              disabled={busy !== null}
              className="rounded-full border border-crit/50 px-2.5 py-0.5 text-[11px] font-medium text-crit hover:bg-crit/10 disabled:opacity-50"
            >
              {busy === "delete" ? "Excluindo…" : "Excluir"}
            </button>
          </div>

          <div>
            <p className="label-caps mb-1 text-muted">Ajustes manuais</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={"Instruções só para ESTE conteúdo. Ex.:\n– Substituir a headline.\n– Modificar o CTA.\n– Deixar a comunicação mais agressiva.\n– Reduzir o texto da segunda seção."}
              className="w-full resize-y rounded-md border border-border bg-elevated px-2.5 py-2 text-sm outline-none focus:border-brand"
            />
            <p className="mt-1 text-[11px] text-muted">A IA reescreve APENAS este conteúdo (nenhum outro muda). Prioridade: ajuste manual → briefing → base → estratégia.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={rewrite}
              disabled={busy !== null || !note.trim()}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
            >
              {busy === "rewrite" ? "Reescrevendo…" : "Reescrever este conteúdo com IA →"}
            </button>
            <button
              onClick={saveNote}
              disabled={busy !== null}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated disabled:opacity-50"
            >
              {busy === "save" ? "Salvando…" : "Salvar ajustes"}
            </button>
            {info && <span className="text-xs text-ok">{info}</span>}
            {err && <span className="text-xs text-crit">{err}</span>}
          </div>
        </div>
      ) : (
        theme?.adjustmentNote && (
          <p className="mt-3 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted">
            <span className="font-medium">Ajuste manual registrado:</span> {String(theme.adjustmentNote)}
          </p>
        )
      )}
    </article>
  );
}
