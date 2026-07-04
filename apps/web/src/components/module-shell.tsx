/** Consistent module page: title, subtitle and a grid of feature cards. Used
 * by the modules whose full UI is on the roadmap, so the whole app is
 * navigable end-to-end (no dead links) while backends are wired up. */
export function ModuleShell({
  title,
  subtitle,
  features,
}: {
  title: string;
  subtitle: string;
  features: { name: string; desc: string }[];
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          Prévia
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.name} className="rounded-xl border border-border bg-elevated p-4">
            <p className="font-medium">{f.name}</p>
            <p className="mt-1 text-sm text-muted">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
        Este módulo já está modelado no backend (entidades, agentes e fluxo). A
        interface completa entra nas próximas versões — a navegação e a estrutura
        já estão prontas.
      </div>
    </div>
  );
}
