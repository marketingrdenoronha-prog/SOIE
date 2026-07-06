/** One-off: enriquece um cliente demo com persona (dores/desejos) + dossiê e
 * onboarding com conteúdo real, para validar que a geração da Linha Editorial
 * usa o contexto. Run: pnpm --filter @soie/db exec tsx prisma/enrich-demo-context.ts */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({ where: { name: "Shark Bot" }, select: { id: true, organizationId: true } });
  if (!client) throw new Error("Cliente Shark Bot não encontrado — rode o seed da esteira antes.");
  const org = client.organizationId;
  const project = await prisma.project.findFirst({ where: { organizationId: org, brand: { clientId: client.id } }, select: { id: true } });
  if (!project) throw new Error("Projeto não encontrado");

  // Voz da marca / proposta de valor no brand
  await prisma.brand.updateMany({
    where: { organizationId: org, clientId: client.id },
    data: { valueProposition: "Automatiza o atendimento no WhatsApp e recupera vendas perdidas por demora na resposta." },
  });

  // Persona com dores e desejos reais (evita duplicar se já existir)
  const existing = await prisma.persona.findFirst({ where: { organizationId: org, projectId: project.id } });
  if (!existing) {
    await prisma.persona.create({
      data: {
        organizationId: org, projectId: project.id, name: "Dono de e-commerce sobrecarregado",
        awarenessLevel: "problem_aware", channels: ["instagram", "whatsapp"],
        pains: { create: [
          { organizationId: org, description: "perde vendas porque demora horas para responder no WhatsApp", intensity: 5 },
          { organizationId: org, description: "não consegue escalar o atendimento sem contratar mais gente", intensity: 4 },
          { organizationId: org, description: "sente que trabalha o dia inteiro apagando incêndio no atendimento", intensity: 4 },
        ] },
        desires: { create: [
          { organizationId: org, description: "responder cada cliente em segundos, no automático", strength: 5 },
          { organizationId: org, description: "vender enquanto dorme, sem depender de estar online", strength: 5 },
        ] },
      },
    });
  }

  // Dossiê + onboarding com conteúdo (não vazio)
  await prisma.strategicDossier.updateMany({
    where: { organizationId: org, clientId: client.id },
    data: { summary: {
      mercado: "Lojistas digitais que vendem por DM e WhatsApp e perdem receita por lentidão no atendimento.",
      publico: "Donos de e-commerce e infoprodutores de 25 a 45 anos.",
      concorrencia: "Chatbots genéricos que soam robóticos; a Shark Bot se diferencia por parecer humano.",
      vozDaMarca: "Direta, confiante, sem enrolação; foco em resultado e recuperação de vendas.",
    } as object },
  });
  await prisma.strategicOnboarding.updateMany({
    where: { organizationId: org, clientId: client.id },
    data: { payload: {
      negocio: "SaaS de automação de atendimento no WhatsApp para e-commerce.",
      objetivo: "Gerar autoridade e agendar demonstrações do produto.",
      diferencial: "Respostas em segundos, tom humano e recuperação de carrinho abandonado.",
    } as object },
  });

  console.log("Contexto enriquecido para Shark Bot (persona, dossiê, onboarding, proposta de valor).");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
