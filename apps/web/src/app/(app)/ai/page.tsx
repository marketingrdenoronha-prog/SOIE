export default function AiPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Agentes & Execuções</h1>
        <p className="text-sm text-muted">
          Transparência sobre o conselho de agentes e o custo de cada execução.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-elevated p-5">
        <h2 className="mb-3 text-sm font-semibold">Conselho de agentes</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {[
            "Cliente", "Mercado", "Concorrência", "Persona",
            "Linguagem", "Copy", "SEO", "Social Media",
            "Calendário", "Avaliador", "Crítico", "Planejamento",
          ].map((a) => (
            <div key={a} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
              <span className="mr-1.5 text-brand">✦</span>
              {a}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
