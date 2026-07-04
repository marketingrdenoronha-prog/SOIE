/* eslint-disable @typescript-eslint/no-explicit-any */

/** Renders a deliverable's roteiro (spec) per its type. Kept tolerant of
 * partial/stub specs AND of the richer, less predictable JSON that a live model
 * (gpt-4o) returns: every value is coerced to a safe string and every list is
 * coerced to an array before rendering, so a nested object/array never reaches
 * React as a child (which would throw a client-side exception). */
export function SpecView({ type, spec }: { type: string; spec: unknown }) {
  const s = (spec ?? {}) as any;

  if (type === "video_script") return <VideoScript s={s} />;
  if (type === "motion_script") return <MotionScript s={s} />;
  if (type === "carousel") return <Carousel s={s} />;
  if (type === "design_brief") return <DesignBrief s={s} />;
  if (type === "copy") return <Copy s={s} />;
  if (type === "article") return <Article s={s} />;
  if (type === "email_sequence") return <EmailSeq s={s} />;
  if (type === "ad") return <Ad s={s} />;
  return <Raw s={s} />;
}

/** Coerces any value into something safe to render as text. Objects/arrays are
 * flattened rather than handed to React (which only accepts strings/numbers). */
function text(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(", ");
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.value === "string") return v.value;
    if (typeof v.description === "string") return v.description;
    if (typeof v.content === "string") return v.content;
    if (typeof v.label === "string") return v.label;
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/** Coerces any value into an array so `.map` is always safe. */
function arr(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

/** First present, truthy value among several possible keys. */
function pick(o: any, ...keys: string[]): any {
  for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k];
  return undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function VideoScript({ s }: { s: any }) {
  const scenes = arr(pick(s, "scenes", "cenas"));
  const hashtags = arr(pick(s, "hashtags"));
  return (
    <div className="space-y-4">
      {pick(s, "theme", "tema") && <Field label="Tema"><b>{text(pick(s, "theme", "tema"))}</b></Field>}
      {pick(s, "hook", "gancho") && <Field label="Gancho (0–3s)"><b>{text(pick(s, "hook", "gancho"))}</b></Field>}
      <div className="space-y-3">
        {scenes.map((sc: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">Cena {text(pick(sc, "n", "numero")) || i + 1}</span>
              {pick(sc, "seconds", "duracao", "duration") != null && (
                <span className="text-xs text-muted">{text(pick(sc, "seconds", "duracao", "duration"))}</span>
              )}
            </div>
            {pick(sc, "visual") && <p className="mt-1 text-sm"><span className="text-muted">Visual: </span>{text(pick(sc, "visual"))}</p>}
            {pick(sc, "voiceover", "narracao", "fala") && <p className="text-sm"><span className="text-muted">Narração: </span>{text(pick(sc, "voiceover", "narracao", "fala"))}</p>}
            {pick(sc, "onScreenText", "textoTela", "texto") && <p className="text-sm"><span className="text-muted">Texto na tela: </span>{text(pick(sc, "onScreenText", "textoTela", "texto"))}</p>}
            {pick(sc, "brollNotes", "broll") && <p className="text-sm text-muted">B-roll: {text(pick(sc, "brollNotes", "broll"))}</p>}
          </div>
        ))}
      </div>
      {pick(s, "cta") && <Field label="CTA">{text(pick(s, "cta"))}</Field>}
      {pick(s, "caption", "legenda") && <Field label="Legenda">{text(pick(s, "caption", "legenda"))}</Field>}
      {hashtags.length ? <Field label="Hashtags">{hashtags.map((h: any) => `#${text(h).replace(/^#/, "")}`).join(" ")}</Field> : null}
    </div>
  );
}

function MotionScript({ s }: { s: any }) {
  const scenes = arr(pick(s, "scenes", "cenas"));
  const palette = arr(pick(s, "palette", "paleta"));
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {scenes.map((sc: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">Cena {text(pick(sc, "n", "numero")) || i + 1}</span>
              <span className="text-xs text-muted">{text(pick(sc, "timing"))}</span>
            </div>
            {pick(sc, "elements", "elementos") && <p className="mt-1 text-sm"><span className="text-muted">Elementos: </span>{text(pick(sc, "elements", "elementos"))}</p>}
            {pick(sc, "onScreenText", "texto") && <p className="text-sm"><span className="text-muted">Texto: </span>{text(pick(sc, "onScreenText", "texto"))}</p>}
            {pick(sc, "transition", "transicao") && <p className="text-sm text-muted">Transição: {text(pick(sc, "transition", "transicao"))}</p>}
            {pick(sc, "motionNotes", "animacao") && <p className="text-sm text-muted">Animação: {text(pick(sc, "motionNotes", "animacao"))}</p>}
          </div>
        ))}
      </div>
      {pick(s, "soundtrackMood", "trilha") && <Field label="Trilha">{text(pick(s, "soundtrackMood", "trilha"))}</Field>}
      {palette.length ? <Palette colors={palette.map(text)} /> : null}
    </div>
  );
}

function Carousel({ s }: { s: any }) {
  const slides = arr(pick(s, "slides", "telas", "cards"));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {slides.map((sl: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <span className="text-xs font-semibold text-brand">Slide {text(pick(sl, "n", "numero")) || i + 1}</span>
            {pick(sl, "title", "titulo") && <p className="mt-1 font-medium">{text(pick(sl, "title", "titulo"))}</p>}
            {pick(sl, "body", "corpo", "copy", "texto") && <p className="text-sm text-muted">{text(pick(sl, "body", "corpo", "copy", "texto"))}</p>}
            {pick(sl, "designNote", "design", "nota") && <p className="mt-1 text-xs text-muted">🎨 {text(pick(sl, "designNote", "design", "nota"))}</p>}
          </div>
        ))}
      </div>
      {pick(s, "caption", "legenda") && <Field label="Legenda">{text(pick(s, "caption", "legenda"))}</Field>}
      {pick(s, "cta") && <Field label="CTA">{text(pick(s, "cta"))}</Field>}
    </div>
  );
}

function DesignBrief({ s }: { s: any }) {
  const copyOnArt = arr(pick(s, "copyOnArt", "textos"));
  const palette = arr(pick(s, "palette", "paleta"));
  const references = arr(pick(s, "references", "referencias"));
  return (
    <div className="space-y-4">
      {pick(s, "format", "formato") && <Field label="Formato">{text(pick(s, "format", "formato"))}{pick(s, "dimensions", "dimensoes") ? ` · ${text(pick(s, "dimensions", "dimensoes"))}` : ""}</Field>}
      {pick(s, "objective", "objetivo") && <Field label="Objetivo">{text(pick(s, "objective", "objetivo"))}</Field>}
      {pick(s, "visualDirection", "direcaoVisual") && <Field label="Direção visual">{text(pick(s, "visualDirection", "direcaoVisual"))}</Field>}
      {copyOnArt.length ? (
        <Field label="Textos na arte">
          <ul className="list-disc pl-4">
            {copyOnArt.map((c: any, i: number) => (
              <li key={i}>{pick(c, "slot") ? <span className="text-muted">{text(pick(c, "slot"))}: </span> : null}{text(pick(c, "text", "texto") ?? c)}</li>
            ))}
          </ul>
        </Field>
      ) : null}
      {palette.length ? <Palette colors={palette.map(text)} /> : null}
      {references.length ? <Field label="Referências">{references.map(text).join(", ")}</Field> : null}
    </div>
  );
}

function Copy({ s }: { s: any }) {
  const variants = arr(pick(s, "variants", "variacoes"));
  return (
    <div className="space-y-3">
      {variants.map((v: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">{text(pick(v, "label", "rotulo")) || `Variação ${i + 1}`}</span>
          {pick(v, "headline", "titulo") && <p className="mt-1 font-medium">{text(pick(v, "headline", "titulo"))}</p>}
          {pick(v, "body", "corpo", "texto") && <p className="text-sm text-muted">{text(pick(v, "body", "corpo", "texto"))}</p>}
          {pick(v, "cta") && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{text(pick(v, "cta"))}</p>}
        </div>
      ))}
    </div>
  );
}

function Article({ s }: { s: any }) {
  const outline = arr(pick(s, "outline", "estrutura"));
  const seo = pick(s, "seo");
  return (
    <div className="space-y-4">
      {pick(s, "title", "titulo") && <h3 className="text-lg font-semibold">{text(pick(s, "title", "titulo"))}</h3>}
      <ol className="space-y-2">
        {outline.map((o: any, i: number) => {
          const points = arr(pick(o, "points", "pontos"));
          return (
            <li key={i}>
              <p className="font-medium">{text(pick(o, "heading", "titulo", "secao") ?? o)}</p>
              {points.length ? <ul className="list-disc pl-5 text-sm text-muted">{points.map((p: any, j: number) => <li key={j}>{text(p)}</li>)}</ul> : null}
            </li>
          );
        })}
      </ol>
      {seo && <Field label="SEO">{text(pick(seo, "keyword", "palavraChave"))}{pick(seo, "meta", "metaDescription") ? ` — ${text(pick(seo, "meta", "metaDescription"))}` : ""}</Field>}
    </div>
  );
}

function EmailSeq({ s }: { s: any }) {
  const emails = arr(pick(s, "emails", "sequencia"));
  return (
    <div className="space-y-3">
      {emails.map((e: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">E-mail {i + 1}</span>
          {pick(e, "subject", "assunto") && <p className="mt-1 font-medium">{text(pick(e, "subject", "assunto"))}</p>}
          {pick(e, "body", "corpo") && <p className="text-sm text-muted">{text(pick(e, "body", "corpo"))}</p>}
          {pick(e, "cta") && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{text(pick(e, "cta"))}</p>}
        </div>
      ))}
    </div>
  );
}

function Ad({ s }: { s: any }) {
  const variants = arr(pick(s, "variants", "variacoes"));
  return (
    <div className="space-y-3">
      {pick(s, "platform", "plataforma") && <Field label="Plataforma">{text(pick(s, "platform", "plataforma"))}</Field>}
      {variants.map((v: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">Variação {i + 1}</span>
          {pick(v, "headline", "titulo") && <p className="mt-1 font-medium">{text(pick(v, "headline", "titulo"))}</p>}
          {pick(v, "primaryText", "textoPrincipal", "body") && <p className="text-sm text-muted">{text(pick(v, "primaryText", "textoPrincipal", "body"))}</p>}
          {pick(v, "cta") && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{text(pick(v, "cta"))}</p>}
        </div>
      ))}
    </div>
  );
}

function Palette({ colors }: { colors: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Paleta</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <span className="h-3 w-3 rounded-sm" style={{ background: /^#|^rgb|^hsl/i.test(c) ? c : "transparent" }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function Raw({ s }: { s: any }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-surface p-3 text-xs text-muted">
      {(() => { try { return JSON.stringify(s, null, 2); } catch { return String(s); } })()}
    </pre>
  );
}
