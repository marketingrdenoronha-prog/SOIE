import { prisma } from "@soie/db";

/**
 * SOIE V2 — Resolvedor de "projeto default" por cliente.
 *
 * A V2 colapsa a hierarquia visível em `Client` (o operador só vê clientes).
 * Internamente, os módulos V1 ainda pendem em `Project` (linhas editoriais,
 * personas, pesquisa, deliverables, memory). Este helper resolve o Project
 * default do cliente — auto-provisionando Brand + Project se ainda não existir
 * (compatibilidade com clientes criados antes desta migração).
 *
 * Idempotente e seguro para chamada concorrente do mesmo cliente: usa transação
 * curta e devolve o primeiro Project existente se houver mais de um.
 */
export async function resolveDefaultProjectId(
  clientId: string,
  organizationId: string,
): Promise<string> {
  // Fast path: já existe pelo menos 1 project na cadeia Client→Brand→Project.
  const existing = await prisma.project.findFirst({
    where: { organizationId, brand: { clientId } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Provisiona Brand + Project default. Idempotente: se outro request criar
  // antes, refazemos o findFirst dentro da transação para não duplicar.
  return prisma.$transaction(async (tx) => {
    const already = await tx.project.findFirst({
      where: { organizationId, brand: { clientId } },
      select: { id: true },
    });
    if (already) return already.id;

    const client = await tx.client.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true, name: true },
    });
    if (!client) {
      throw new Error(`Client ${clientId} não encontrado na organização ${organizationId}`);
    }

    // Reusa uma Brand existente se houver (ex.: cliente importado da Beam com
    // BrandVoice, mas sem Project). Só cria se nenhuma existir.
    let brand = await tx.brand.findFirst({
      where: { organizationId, clientId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!brand) {
      brand = await tx.brand.create({
        data: { organizationId, clientId, name: client.name },
        select: { id: true },
      });
    }

    const project = await tx.project.create({
      data: {
        organizationId,
        brandId: brand.id,
        name: "default",
        status: "onboarding",
        platforms: [],
      },
      select: { id: true },
    });
    return project.id;
  });
}
