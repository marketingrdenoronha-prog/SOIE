/**
 * Test-data seed for the Produção esteira demo. Creates several editorial lines
 * (one per client) spread across the 5 Kanban columns, producing peças
 * (Deliverables) with a canned roteiro where the stage implies production.
 * Idempotent by client name. Run:
 *   pnpm --filter @soie/db exec tsx prisma/seed-demo-esteira.ts
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SPEC = {
  hook: "Você sabia que 80% dos sellers perdem venda por pagamento recusado?",
  scenes: [
    { scene: "Abertura", narration: "Mostre o problema com um número forte na tela." },
    { scene: "Desenvolvimento", narration: "Apresente a solução com prova social." },
    { scene: "Fechamento", narration: "Chamada para ação clara e direta." },
  ],
  cta: "Fale com a gente hoje e ative em minutos.",
};

interface ThemeSpec { title: string; channel: string; format: string; copy: unknown }

async function makeLine(opts: {
  organizationId: string;
  clientName: string;
  industry: string;
  lineName: string;
  status: string;
  productionStage: string | null;
  themes: ThemeSpec[];
  produce: boolean;
  withReviewLink?: boolean;
  history: Array<{ from: string | null; to: string; byName: string | null; note: string }>;
  approvedComment?: boolean;
}) {
  const { organizationId } = opts;
  const existing = await prisma.client.findFirst({ where: { organizationId, name: opts.clientName } });
  if (existing) { console.log(`- ${opts.clientName}: já existe, pulando`); return; }

  const client = await prisma.client.create({ data: { organizationId, name: opts.clientName, industry: opts.industry, status: "active" } });
  const brand = await prisma.brand.create({ data: { organizationId, clientId: client.id, name: opts.clientName } });
  const project = await prisma.project.create({ data: { organizationId, brandId: brand.id, name: "default", status: "production", platforms: ["instagram"] } });

  const now = Date.now();
  const stageHistory = opts.history.map((h, i) => ({
    from: h.from, to: h.to,
    at: new Date(now - (opts.history.length - i) * 3600_000).toISOString(),
    byId: null, byName: h.byName, note: h.note,
  }));

  const strategy = await prisma.editorialStrategy.create({
    data: {
      organizationId, clientId: client.id, projectId: project.id, version: 1,
      status: opts.status,
      productionStage: opts.productionStage,
      submittedAt: opts.productionStage ? new Date(now - 6 * 3600_000) : null,
      approvedAt: ["approved", "design", "final_review", "to_post"].includes(opts.productionStage ?? "") ? new Date(now - 5 * 3600_000) : null,
      positioning: `${opts.clientName} — autoridade e confiança no seu mercado.`,
      pillars: ["Confiança", "Prova social", "Educação"],
      confidence: "high",
      stageHistory,
      editorialLines: {
        create: [{
          organizationId, name: opts.lineName, objective: "authority", funnelStage: "tofu", platforms: ["instagram"],
          categories: { create: [{
            organizationId, name: "Conteúdo",
            themes: { create: opts.themes.map((t, i) => ({ organizationId, title: t.title, channel: t.channel, format: t.format, copy: t.copy as never, priority: i })) },
          }] },
        }],
      },
    },
    include: { editorialLines: { include: { categories: { include: { themes: true } } } } },
  });

  if (opts.withReviewLink) {
    await prisma.editorialReviewLink.create({ data: { organizationId, strategyId: strategy.id, token: randomBytes(24).toString("base64url") } });
  }
  if (opts.approvedComment) {
    await prisma.editorialReviewComment.create({ data: { organizationId, strategyId: strategy.id, decision: "approve", authorName: "Cliente" } });
  }

  if (opts.produce) {
    const themes = strategy.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes));
    for (const t of themes) {
      const d = await prisma.deliverable.create({
        data: {
          organizationId, projectId: project.id, themeId: t.id,
          channel: t.channel ?? "instagram", type: t.format ?? "video_script",
          title: `${t.title}`, brief: t.title, spec: SPEC as object, status: "internal_review", createdBy: null,
        },
      });
      await prisma.theme.update({ where: { id: t.id }, data: { deliverableId: d.id } });
    }
  }
  console.log(`+ ${opts.clientName}: ${opts.productionStage ?? "draft"} (${opts.themes.length} temas${opts.produce ? ", peças produzidas" : ""})`);
}

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("Nenhuma organização — registre uma conta primeiro.");
  const organizationId = org.id;

  const T = (title: string, format = "video_script", copy: unknown = "Copy pronta para o cliente aprovar."): ThemeSpec => ({ title, channel: "instagram", format, copy });

  await makeLine({
    organizationId, clientName: "Beam 360", industry: "SaaS de agências", lineName: "Autoridade & Educação",
    status: "pending_client", productionStage: "client_review", produce: false, withReviewLink: true,
    themes: [T("Como escalar sua agência sem perder qualidade"), T("3 erros que travam o crescimento", "carousel", ["Erro 1", "Erro 2", "Erro 3"]), T("O framework Beam 360 explicado", "design_brief")],
    history: [{ from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" }],
  });

  await makeLine({
    organizationId, clientName: "Shark Bot", industry: "Automação / IA", lineName: "Prova Social",
    status: "approved", productionStage: "approved", produce: false, approvedComment: true,
    themes: [T("Cases de clientes que automatizaram o atendimento"), T("Antes e depois com o Shark Bot", "carousel", ["Antes", "Depois"])],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
    ],
  });

  await makeLine({
    organizationId, clientName: "Clocker", industry: "Produtividade", lineName: "Ganho de Tempo",
    status: "approved", productionStage: "design", produce: true, approvedComment: true,
    themes: [T("Rotina produtiva com o Clocker"), T("Bloqueio de foco na prática", "carousel", ["Passo 1", "Passo 2", "Passo 3"]), T("Integração com seu calendário", "design_brief")],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
      { from: "approved", to: "design", byName: "Demo User", note: "Produção iniciada" },
    ],
  });

  await makeLine({
    organizationId, clientName: "Nova Skin", industry: "Beleza / Skincare", lineName: "Rotina de Skincare",
    status: "approved", productionStage: "final_review", produce: true, approvedComment: true,
    themes: [T("Rotina de skincare para pele oleosa"), T("Ingredientes que funcionam", "carousel", ["Vitamina C", "Ácido hialurônico", "Niacinamida"])],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
      { from: "approved", to: "design", byName: "Demo User", note: "Produção iniciada" },
      { from: "design", to: "final_review", byName: "Demo User", note: "Movida para Em Aprovação Final" },
    ],
  });

  await makeLine({
    organizationId, clientName: "Porsche Club", industry: "Automotivo", lineName: "Lifestyle & Comunidade",
    status: "approved", productionStage: "to_post", produce: true, approvedComment: true,
    themes: [T("Bastidores do encontro mensal"), T("Corrida de faturamento — como participar", "design_brief")],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
      { from: "approved", to: "design", byName: "Demo User", note: "Produção iniciada" },
      { from: "design", to: "final_review", byName: "Demo User", note: "Movida para Em Aprovação Final" },
      { from: "final_review", to: "to_post", byName: "Demo User", note: "Aprovada na revisão final" },
    ],
  });

  console.log("Board de demonstração pronto.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
