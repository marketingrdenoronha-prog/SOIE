import { SpecView } from "@/components/spec-view";

/** Entregas — the production board. Server-rendered with representative data
 * (the API `GET /deliverables` fills this once the DB is live). Shows each
 * deliverable's pipeline status and any client feedback surfaced from the
 * public review link. */
export default function DeliverablesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="page-head">
        <h1 className="text-xl font-semibold">Entregas</h1>
        <p className="text-sm text-muted">
          Roteiros e criativos por canal, do rascunho à aprovação do cliente.
        </p>
      </div>

      <div className="space-y-4">
        {DEMO.map((d) => (
          <div key={d.id} className="rounded-xl border border-border bg-elevated">
            <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
              <div>
                <p className="font-semibold">{d.title}</p>
                <p className="text-xs text-muted">{d.channel} · {d.type}</p>
              </div>
              <StatusBadge status={d.status} />
              <div className="ml-auto flex items-center gap-2">
                {d.reviewToken ? (
                  <a
                    href={`/review/${d.reviewToken}`}
                    target="_blank"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
                  >
                    Abrir link do cliente ↗
                  </a>
                ) : (
                  <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                    Enviar para o cliente
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-3">
              <div className="p-4 lg:col-span-2">
                <SpecView type={d.type} spec={d.spec} />
              </div>
              <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                  Feedback do cliente
                </p>
                {d.feedback.length === 0 ? (
                  <p className="text-sm text-muted">Nenhum ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {d.feedback.map((f, i) => (
                      <li key={i} className="rounded-lg border border-border p-2.5 text-sm">
                        <span className={f.decision === "approve" ? "text-emerald-500" : "text-amber-500"}>
                          {f.decision === "approve" ? "✓ Aprovado" : "✎ Ajuste"}
                        </span>
                        {f.comment && <p className="mt-1 text-muted">{f.comment}</p>}
                        <p className="mt-1 text-xs text-muted">{f.author}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    generating: ["Gerando", "bg-sky-500/15 text-sky-500"],
    internal_review: ["Revisão interna", "bg-violet-500/15 text-violet-500"],
    client_review: ["Com o cliente", "bg-amber-500/15 text-amber-500"],
    approved: ["Aprovado", "bg-emerald-500/15 text-emerald-500"],
    changes_requested: ["Ajuste pedido", "bg-rose-500/15 text-rose-500"],
    delivered: ["Entregue", "bg-emerald-500/15 text-emerald-500"],
  };
  const [label, cls] = map[status] ?? [status, "bg-border text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

const DEMO = [
  {
    id: "1",
    title: "Roteiro Reels",
    channel: "Instagram",
    type: "video_script",
    status: "client_review",
    reviewToken: "demo",
    spec: {
      hook: "Você está passando o café errado — e o problema não é o pó.",
      scenes: [
        { n: 1, seconds: 3, visual: "Close na água fervendo cedo demais", voiceover: "A água a 100°C queima os aromas.", onScreenText: "ÁGUA MUITO QUENTE" },
        { n: 2, seconds: 5, visual: "Termômetro marcando 92°C", voiceover: "O ponto é entre 90 e 96 graus.", onScreenText: "90–96°C" },
        { n: 3, seconds: 6, visual: "Xícara sendo servida, vapor", voiceover: "Aí sim você sente a origem no copo." },
      ],
      cta: "Salva esse post e testa amanhã. Qual método você usa?",
      caption: "O detalhe que separa o café de padaria do café especial.",
      hashtags: ["cafeespecial", "barista", "coado"],
    },
    feedback: [] as { decision: string; comment: string | null; author: string }[],
  },
  {
    id: "2",
    title: "Carrossel",
    channel: "Instagram",
    type: "carousel",
    status: "changes_requested",
    reviewToken: null,
    spec: {
      slides: [
        { n: 1, title: "3 mitos sobre café especial", body: "Que estão te fazendo gastar mais e beber pior.", designNote: "Capa com alto contraste" },
        { n: 2, title: "Mito 1: quanto mais forte, melhor", body: "Força ≠ qualidade. É extração.", designNote: "Ícone de força" },
        { n: 3, title: "Mito 2: café bom é caro", body: "Origem transparente cabe no bolso.", designNote: "Comparativo de preço" },
      ],
      cta: "Deslize e descubra o mito 3 →",
    },
    feedback: [
      { decision: "request_changes", comment: "Podemos deixar a capa com o nome da marca? E o mito 3 ficou faltando no preview.", author: "Marina (Acme)" },
    ],
  },
  {
    id: "3",
    title: "Roteiro Motion",
    channel: "TikTok",
    type: "motion_script",
    status: "approved",
    reviewToken: "demo2",
    spec: {
      scenes: [
        { n: 1, timing: "0:00–0:03", elements: "Logo animado + grãos caindo", onScreenText: "Do grão à xícara", transition: "Corte seco" },
        { n: 2, timing: "0:03–0:08", elements: "Mapa com origem destacada", onScreenText: "Origem rastreável", motionNotes: "Zoom suave" },
      ],
      soundtrackMood: "Lo-fi acolhedor, 90 BPM",
      palette: ["#3b2417", "#c9a227", "#f4efe6"],
    },
    feedback: [
      { decision: "approve", comment: null, author: "Marina (Acme)" },
    ],
  },
];
