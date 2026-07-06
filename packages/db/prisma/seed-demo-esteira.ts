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

// Rótulos oficiais e copy estruturada por formato (espelha lib/editorial-format).
type FormatLabel = "Vídeo" | "Motion" | "Carrossel" | "Estático";
interface ThemeSpec {
  title: string;
  channel: string;
  format: FormatLabel;
  strategicObjective: string;
  hook: string;
  cta: string;
  productionNotes: string;
  copy: unknown;
}

function structuredCopy(format: FormatLabel, title: string, brand: string, cta: string): unknown {
  if (format === "Carrossel") {
    return {
      format: "carrossel",
      slides: [
        { title: "Headline", text: title },
        { title: "Slide 2", text: `A maioria acredita que basta aparecer mais — mas sem estrutura, volume só amplifica o erro.` },
        { title: "Slide 3", text: `Pilar 1 — Clareza: o cliente precisa entender em segundos o que você resolve.` },
        { title: "Slide 4", text: `Pilar 2 — Prova: cases e bastidores valem mais que promessa.` },
        { title: "Slide 5", text: `Pilar 3 — Consistência: aparecer com método, na frequência certa.` },
        { title: "Conclusão + CTA", text: `Junte os três e o resultado deixa de ser sorte. A ${brand} constrói isso com você. ${cta}` },
      ],
    };
  }
  if (format === "Estático") {
    return {
      format: "estatico",
      static: {
        headline: title,
        subheadline: `O que separa quem cresce de quem estagna.`,
        body: `Não é sorte, é estrutura. Empresas que comunicam resultado com clareza e prova constroem autoridade e vendem com previsibilidade. A ${brand} organiza estratégia, conteúdo e prova para a sua marca ser a escolha óbvia.`,
        cta,
        designNotes: "Alto contraste, headline no topo, corpo com respiro, logo e CTA no rodapé.",
      },
    };
  }
  return {
    format: format === "Motion" ? "motion" : "video",
    estimatedDuration: "55s",
    sections: [
      { label: "Gancho", text: `${title}? Presta atenção nos próximos segundos.` },
      { label: "Conexão", text: `Se você vive isso no dia a dia, sabe o quanto custa. A gente entende — e tem solução.` },
      { label: "Desenvolvimento", text: `O problema raramente é o produto: é a estrutura por trás. Com processo, comunicação e prova, o jogo vira. Na ${brand} aplicamos isso passo a passo.` },
      { label: "Virada", text: `O insight: não é trabalhar mais, é trabalhar com método.` },
      { label: "CTA", text: cta },
    ],
  };
}

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

  // Onboarding + dossiê prontos para habilitar a aba "Linha Editorial" na UI.
  await prisma.strategicOnboarding.create({
    data: { organizationId, clientId: client.id, status: "completed", step: 5, completedAt: new Date() },
  });
  await prisma.strategicDossier.create({
    data: { organizationId, clientId: client.id, version: 1, status: "ready", generatedAt: new Date(), summary: { resumo: `Dossiê estratégico de ${opts.clientName}.` } },
  });

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
            themes: { create: opts.themes.map((t, i) => ({
          organizationId, title: t.title, channel: t.channel, format: t.format, copy: t.copy as never,
          strategicObjective: t.strategicObjective, hook: t.hook, cta: t.cta, productionNotes: t.productionNotes,
          priority: i,
        })) },
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
    const typeFor = (f?: string | null) =>
      f === "Motion" ? "motion_script" : f === "Carrossel" ? "carousel" : f === "Estático" ? "design_brief" : "video_script";
    const themes = strategy.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes));
    for (const t of themes) {
      const d = await prisma.deliverable.create({
        data: {
          organizationId, projectId: project.id, themeId: t.id,
          channel: t.channel ?? "instagram", type: typeFor(t.format),
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

  const brand = "a marca";
  const T = (title: string, format: FormatLabel = "Vídeo", cta = "Chame no direct e solicite uma avaliação."): ThemeSpec => ({
    title,
    channel: "instagram",
    format,
    strategicObjective: "Autoridade — educar e gerar confiança",
    hook: title,
    cta,
    productionNotes:
      format === "Vídeo" ? "Roteiro gravável de 30s a 1min20s, vertical, legenda queimada."
      : format === "Motion" ? "Animar as 5 partes com ritmo; texto sincronizado; trilha upbeat."
      : format === "Carrossel" ? "1 ideia por slide; headline forte no slide 1; CTA no último."
      : "Peça de feed 1080x1350; headline forte; identidade da marca.",
    copy: structuredCopy(format, title, brand, cta),
  });

  await makeLine({
    organizationId, clientName: "Beam 360", industry: "SaaS de agências", lineName: "Autoridade & Educação",
    status: "pending_client", productionStage: "client_review", produce: false, withReviewLink: true,
    themes: [T("Como escalar sua agência sem perder qualidade"), T("3 erros que travam o crescimento", "Carrossel"), T("O framework Beam 360 explicado", "Estático")],
    history: [{ from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" }],
  });

  await makeLine({
    organizationId, clientName: "Shark Bot", industry: "Automação / IA", lineName: "Prova Social",
    status: "approved", productionStage: "approved", produce: false, approvedComment: true,
    themes: [T("Cases de clientes que automatizaram o atendimento"), T("Antes e depois com o Shark Bot", "Carrossel")],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
    ],
  });

  await makeLine({
    organizationId, clientName: "Clocker", industry: "Produtividade", lineName: "Ganho de Tempo",
    status: "approved", productionStage: "design", produce: true, approvedComment: true,
    themes: [T("Rotina produtiva com o Clocker"), T("Bloqueio de foco na prática", "Carrossel"), T("Integração com seu calendário", "Estático")],
    history: [
      { from: null, to: "client_review", byName: "Demo User", note: "Enviado para o cliente" },
      { from: "client_review", to: "approved", byName: "Cliente", note: "Cliente aprovou a linha editorial V1" },
      { from: "approved", to: "design", byName: "Demo User", note: "Produção iniciada" },
    ],
  });

  await makeLine({
    organizationId, clientName: "Nova Skin", industry: "Beleza / Skincare", lineName: "Rotina de Skincare",
    status: "approved", productionStage: "final_review", produce: true, approvedComment: true,
    themes: [T("Rotina de skincare para pele oleosa"), T("Ingredientes que funcionam", "Carrossel")],
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
    themes: [T("Bastidores do encontro mensal"), T("Corrida de faturamento — como participar", "Estático")],
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
