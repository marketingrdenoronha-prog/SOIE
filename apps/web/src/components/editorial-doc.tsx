/* eslint-disable @typescript-eslint/no-explicit-any */
import { arr, text } from "@/lib/render";

interface Line {
  name?: unknown;
  categories?: Array<{ name?: unknown; themes?: any[] }>;
}

/** Flattens an editorial strategy's lines→categories→themes into the numbered
 * sequence the client reviews (#01, #02, …). */
export function flattenThemes(lines: Line[] | undefined): any[] {
  return arr(lines).flatMap((l) => arr(l?.categories).flatMap((c) => arr(c?.themes)));
}

/**
 * Renders an editorial line as the finished document the client approves:
 * numbered themes, each with its format and the ready copy (a single block for
 * static/reels, or one "TELA" per screen for carousel).
 */
export function EditorialDoc({ lines }: { lines: Line[] | undefined }) {
  const themes = flattenThemes(lines);
  if (themes.length === 0) {
    return <p className="text-sm text-muted">Esta versão ainda não tem temas com copy.</p>;
  }
  return (
    <div className="space-y-6">
      {themes.map((t, i) => (
        <ThemeBlock key={i} n={i + 1} theme={t} />
      ))}
    </div>
  );
}

function ThemeBlock({ n, theme }: { n: number; theme: any }) {
  const num = String(n).padStart(2, "0");
  const format = text(theme?.format);
  const copy = theme?.copy;
  const isCarousel = Array.isArray(copy);

  return (
    <article className="rounded-xl border border-border bg-elevated p-4">
      <h3 className="text-base font-semibold">
        <span className="text-muted">#{num}</span> | {text(theme?.title)}
      </h3>
      {(format || text(theme?.channel)) && (
        <p className="mt-1 text-xs text-muted">
          {format && <span className="font-medium">Formato: {format}</span>}
          {format && text(theme?.channel) ? " · " : ""}
          {text(theme?.channel)}
        </p>
      )}

      {isCarousel ? (
        <div className="mt-3 space-y-2">
          {(copy as any[]).map((screen, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <p className="label-caps text-brand">Tela {String(i + 1).padStart(2, "0")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{text(screen)}</p>
            </div>
          ))}
        </div>
      ) : text(copy) ? (
        <p className="mt-3 whitespace-pre-wrap text-sm">{text(copy)}</p>
      ) : (
        <p className="mt-3 text-sm text-muted">Sem copy gerada para este tema.</p>
      )}
    </article>
  );
}
