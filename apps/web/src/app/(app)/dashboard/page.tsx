import { KpiCard } from "@/components/kpi-card";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">
          Visão executiva do trabalho e do custo de IA.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Projetos ativos" value="8" hint="+2 este mês" trend="up" />
        <KpiCard label="Conteúdos em produção" value="34" hint="12 em revisão" trend="flat" />
        <KpiCard label="Aprovações pendentes" value="5" hint="2 atrasadas" trend="down" />
        <KpiCard label="Custo de IA (mês)" value="US$ 42,18" hint="63% do orçamento" trend="up" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-elevated p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Últimas execuções de IA</h2>
          <ul className="divide-y divide-border text-sm">
            {[
              { kind: "Pesquisa completa", project: "Acme / Café Especial", status: "succeeded", cost: "US$ 1,84" },
              { kind: "Linha editorial", project: "Nova / Clínica", status: "partial", cost: "US$ 0,92" },
              { kind: "Conteúdo (carrossel)", project: "Acme / Café Especial", status: "running", cost: "US$ 0,31" },
            ].map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-medium">{r.kind}</p>
                  <p className="text-xs text-muted">{r.project}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={r.status} />
                  <span className="tabular-nums text-muted">{r.cost}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-elevated p-5">
          <h2 className="mb-3 text-sm font-semibold">Insights</h2>
          <ul className="space-y-3 text-sm">
            <li className="rounded-lg border border-border/70 p-3">
              3 personas ainda sem linha editorial associada.
            </li>
            <li className="rounded-lg border border-border/70 p-3">
              Concorrente <b>Origem</b> aumentou a frequência de posts em 40%.
            </li>
            <li className="rounded-lg border border-border/70 p-3">
              Orçamento de IA do projeto <b>Nova</b> a 85% do teto.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: "bg-emerald-500/15 text-emerald-500",
    partial: "bg-amber-500/15 text-amber-500",
    running: "bg-sky-500/15 text-sky-500",
    failed: "bg-rose-500/15 text-rose-500",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
