/* eslint-disable @typescript-eslint/no-explicit-any */

/** Renders a deliverable's roteiro (spec) per its type. Kept tolerant of
 * partial/stub specs so it degrades gracefully during production. */
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function VideoScript({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      {s.hook && <Field label="Gancho (0–3s)"><b>{s.hook}</b></Field>}
      <div className="space-y-3">
        {(s.scenes ?? []).map((sc: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">Cena {sc.n ?? i + 1}</span>
              {sc.seconds != null && <span className="text-xs text-muted">{sc.seconds}s</span>}
            </div>
            {sc.visual && <p className="mt-1 text-sm"><span className="text-muted">Visual: </span>{sc.visual}</p>}
            {sc.voiceover && <p className="text-sm"><span className="text-muted">Narração: </span>{sc.voiceover}</p>}
            {sc.onScreenText && <p className="text-sm"><span className="text-muted">Texto na tela: </span>{sc.onScreenText}</p>}
            {sc.brollNotes && <p className="text-sm text-muted">B-roll: {sc.brollNotes}</p>}
          </div>
        ))}
      </div>
      {s.cta && <Field label="CTA">{s.cta}</Field>}
      {s.caption && <Field label="Legenda">{s.caption}</Field>}
      {s.hashtags?.length ? <Field label="Hashtags">{s.hashtags.map((h: string) => `#${h}`).join(" ")}</Field> : null}
    </div>
  );
}

function MotionScript({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {(s.scenes ?? []).map((sc: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">Cena {sc.n ?? i + 1}</span>
              <span className="text-xs text-muted">{sc.timing}</span>
            </div>
            {sc.elements && <p className="mt-1 text-sm"><span className="text-muted">Elementos: </span>{sc.elements}</p>}
            {sc.onScreenText && <p className="text-sm"><span className="text-muted">Texto: </span>{sc.onScreenText}</p>}
            {sc.transition && <p className="text-sm text-muted">Transição: {sc.transition}</p>}
            {sc.motionNotes && <p className="text-sm text-muted">Animação: {sc.motionNotes}</p>}
          </div>
        ))}
      </div>
      {s.soundtrackMood && <Field label="Trilha">{s.soundtrackMood}</Field>}
      {s.palette?.length ? <Palette colors={s.palette} /> : null}
    </div>
  );
}

function Carousel({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {(s.slides ?? []).map((sl: any, i: number) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <span className="text-xs font-semibold text-brand">Slide {sl.n ?? i + 1}</span>
            {sl.title && <p className="mt-1 font-medium">{sl.title}</p>}
            {sl.body && <p className="text-sm text-muted">{sl.body}</p>}
            {sl.designNote && <p className="mt-1 text-xs text-muted">🎨 {sl.designNote}</p>}
          </div>
        ))}
      </div>
      {s.caption && <Field label="Legenda">{s.caption}</Field>}
      {s.cta && <Field label="CTA">{s.cta}</Field>}
    </div>
  );
}

function DesignBrief({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      {s.format && <Field label="Formato">{s.format}{s.dimensions ? ` · ${s.dimensions}` : ""}</Field>}
      {s.objective && <Field label="Objetivo">{s.objective}</Field>}
      {s.visualDirection && <Field label="Direção visual">{s.visualDirection}</Field>}
      {s.copyOnArt?.length ? (
        <Field label="Textos na arte">
          <ul className="list-disc pl-4">
            {s.copyOnArt.map((c: any, i: number) => <li key={i}><span className="text-muted">{c.slot}: </span>{c.text}</li>)}
          </ul>
        </Field>
      ) : null}
      {s.palette?.length ? <Palette colors={s.palette} /> : null}
      {s.references?.length ? <Field label="Referências">{s.references.join(", ")}</Field> : null}
    </div>
  );
}

function Copy({ s }: { s: any }) {
  return (
    <div className="space-y-3">
      {(s.variants ?? []).map((v: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">{v.label ?? `Variação ${i + 1}`}</span>
          {v.headline && <p className="mt-1 font-medium">{v.headline}</p>}
          {v.body && <p className="text-sm text-muted">{v.body}</p>}
          {v.cta && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{v.cta}</p>}
        </div>
      ))}
    </div>
  );
}

function Article({ s }: { s: any }) {
  return (
    <div className="space-y-4">
      {s.title && <h3 className="text-lg font-semibold">{s.title}</h3>}
      <ol className="space-y-2">
        {(s.outline ?? []).map((o: any, i: number) => (
          <li key={i}>
            <p className="font-medium">{o.heading}</p>
            {o.points?.length ? <ul className="list-disc pl-5 text-sm text-muted">{o.points.map((p: string, j: number) => <li key={j}>{p}</li>)}</ul> : null}
          </li>
        ))}
      </ol>
      {s.seo && <Field label="SEO">{s.seo.keyword} — {s.seo.meta}</Field>}
    </div>
  );
}

function EmailSeq({ s }: { s: any }) {
  return (
    <div className="space-y-3">
      {(s.emails ?? []).map((e: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">E-mail {i + 1}</span>
          {e.subject && <p className="mt-1 font-medium">{e.subject}</p>}
          {e.body && <p className="text-sm text-muted">{e.body}</p>}
          {e.cta && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{e.cta}</p>}
        </div>
      ))}
    </div>
  );
}

function Ad({ s }: { s: any }) {
  return (
    <div className="space-y-3">
      {s.platform && <Field label="Plataforma">{s.platform}</Field>}
      {(s.variants ?? []).map((v: any, i: number) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <span className="text-xs font-semibold text-brand">Variação {i + 1}</span>
          {v.headline && <p className="mt-1 font-medium">{v.headline}</p>}
          {v.primaryText && <p className="text-sm text-muted">{v.primaryText}</p>}
          {v.cta && <p className="mt-1 text-sm"><span className="text-muted">CTA: </span>{v.cta}</p>}
        </div>
      ))}
    </div>
  );
}

function Palette({ colors }: { colors: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Paleta</p>
      <div className="mt-1 flex gap-2">
        {colors.map((c, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <span className="h-3 w-3 rounded-sm" style={{ background: c }} />
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
      {JSON.stringify(s, null, 2)}
    </pre>
  );
}
