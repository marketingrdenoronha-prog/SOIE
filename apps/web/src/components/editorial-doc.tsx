/* eslint-disable @typescript-eslint/no-explicit-any */
import { arr, text } from "@/lib/render";
import { isStructuredCopy, type StructuredCopy } from "@/lib/editorial-format";

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
 * Renders an editorial line as the finished, production-ready document the client
 * approves: numbered contents, each with format, objetivo estratégico, copy
 * completa (roteiro / slides / peça estática), gancho, CTA e observações de
 * produção. Compatível com copy legada (string ou array de strings).
 */
export function EditorialDoc({ lines }: { lines: Line[] | undefined }) {
  const themes = flattenThemes(lines);
  if (themes.length === 0) {
    return <p className="text-sm text-muted">Esta versão ainda não tem conteúdos com copy.</p>;
  }
  return (
    <div className="space-y-6">
      {themes.map((t, i) => (
        <article key={i} className="rounded-xl border border-border bg-elevated p-4">
          <h3 className="text-base font-semibold">
            <span className="text-muted">#{String(i + 1).padStart(2, "0")}</span> | {text(t?.title)}
          </h3>
          <ThemeContent theme={t} />
        </article>
      ))}
    </div>
  );
}

/** Renders one content's standard output (reused by the editorial doc, the
 * client review page and the production side panel). */
export function ThemeContent({ theme }: { theme: any }) {
  const format = text(theme?.format);
  const channel = text(theme?.channel);
  return (
    <div className="space-y-3">
      {(format || channel) && (
        <p className="mt-1 text-xs text-muted">
          {format && <span className="font-medium">Formato: {format}</span>}
          {format && channel ? " · " : ""}
          {channel}
        </p>
      )}
      {text(theme?.strategicObjective) && (
        <Block label="Objetivo estratégico">{text(theme.strategicObjective)}</Block>
      )}

      <div>
        <p className="label-caps mb-1 text-muted">Copy completa</p>
        <CopyBody copy={theme?.copy} hook={theme?.hook} cta={theme?.cta} />
      </div>

      {text(theme?.productionNotes) && (
        <Block label="Observações para produção">{text(theme.productionNotes)}</Block>
      )}
    </div>
  );
}

/** Exibe todas as telas do carrossel (a quantidade é definida pelo usuário,
 * 2–8). Mantém um teto de segurança de 8 para dados manipulados/legados. */
function capSlides<T>(arr: T[]): T[] {
  return arr.length > 8 ? arr.slice(0, 8) : arr;
}

function CopyBody({ copy, hook, cta }: { copy: unknown; hook?: unknown; cta?: unknown }) {
  if (isStructuredCopy(copy)) return <StructuredCopyView copy={copy} hook={hook} cta={cta} />;

  // Legado: array = carrossel (uma tela por item); string = bloco único.
  if (Array.isArray(copy)) {
    return (
      <div className="space-y-2">
        {capSlides(copy).map((screen, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-3">
            <p className="label-caps text-brand">Tela {String(i + 1).padStart(2, "0")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{text(screen)}</p>
          </div>
        ))}
      </div>
    );
  }
  if (text(copy)) return <p className="whitespace-pre-wrap text-sm">{text(copy)}</p>;
  return <p className="text-sm text-muted">Sem copy gerada para este conteúdo.</p>;
}

function StructuredCopyView({ copy, hook, cta }: { copy: StructuredCopy; hook?: unknown; cta?: unknown }) {
  if (copy.format === "carrossel") {
    const slides = capSlides(copy.slides ?? []);
    const count = typeof (copy as { slideCount?: number }).slideCount === "number" ? (copy as { slideCount?: number }).slideCount : slides.length;
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-muted">{count} tela{(count ?? 0) === 1 ? "" : "s"}</p>
        {slides.map((s, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-3">
            <p className="label-caps text-brand">{s.title?.trim() ? s.title : `Tela ${String(i + 1).padStart(2, "0")}`}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{text(s.text)}</p>
          </div>
        ))}
      </div>
    );
  }

  if (copy.format === "estatico") {
    const s = copy.static;
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface p-3 text-sm">
        {s?.headline && (
          <div>
            <p className="label-caps text-brand">Headline</p>
            <p className="mt-0.5 text-base font-semibold">{text(s.headline)}</p>
          </div>
        )}
        {s?.subheadline && (
          <div>
            <p className="label-caps text-brand">Subheadline</p>
            <p className="mt-0.5 text-muted">{text(s.subheadline)}</p>
          </div>
        )}
        {s?.body && (
          <div>
            <p className="label-caps text-brand">Corpo</p>
            <p className="mt-0.5 whitespace-pre-wrap">{text(s.body)}</p>
          </div>
        )}
        {s?.cta && (
          <div>
            <p className="label-caps text-brand">CTA</p>
            <p className="mt-0.5 font-medium text-brand">{text(s.cta)}</p>
          </div>
        )}
        {s?.caption && (
          <div className="border-t border-border pt-2">
            <p className="label-caps text-brand">Legenda (post)</p>
            <p className="mt-0.5 whitespace-pre-wrap">{text(s.caption)}</p>
          </div>
        )}
        {s?.designNotes && <p className="border-t border-border pt-2 text-xs text-muted">🎨 {text(s.designNotes)}</p>}
      </div>
    );
  }

  // vídeo / motion
  const sections = copy.sections ?? [];
  return (
    <div className="space-y-2">
      {copy.estimatedDuration && (
        <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
          Duração estimada: {text(copy.estimatedDuration)}
        </span>
      )}
      <div className="space-y-2">
        {sections.map((sec, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-3">
            <p className="label-caps text-brand">{text(sec.label)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{text(sec.text)}</p>
          </div>
        ))}
      </div>
      {sections.length === 0 && Boolean(text(hook) || text(cta)) ? (
        <p className="whitespace-pre-wrap text-sm">{[text(hook), text(cta)].filter(Boolean).join("\n\n")}</p>
      ) : null}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps text-muted">{label}</p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}
