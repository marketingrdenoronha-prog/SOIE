import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

/**
 * Base de conhecimento do CLIENTE — informações extras da empresa e do mercado
 * que o operador vai acumulando ao longo do tempo (novidades, contexto, dados,
 * atualidades). Cada item vira uma `Memory` com scope="client": o
 * assembleProjectContext puxa isso automaticamente, então as próximas linhas
 * editoriais saem mais atualizadas e refinadas — sem precisar refazer onboarding.
 */

const createInput = z.object({
  // Categoria livre p/ organizar (empresa, mercado, atualidade, diretriz…).
  kind: z.string().min(1).max(60).default("empresa"),
  content: z.string().min(1).max(10000),
});

async function ownedClient(org: string, id: string) {
  if (!uuid.safeParse(id).success) throw Errors.notFound("Cliente");
  const c = await prisma.client.findFirst({
    where: { id, organizationId: org, deletedAt: null },
    select: { id: true },
  });
  if (!c) throw Errors.notFound("Cliente");
  return c;
}

/** GET /clients/:id/knowledge → informações extras já cadastradas do cliente. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);

    const entries = await prisma.memory.findMany({
      where: { organizationId: org, scope: "client", scopeId: id },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, kind: true, content: true, sourceRef: true, createdAt: true },
    });
    return ok(entries);
  });
}

/** POST /clients/:id/knowledge → adiciona uma informação à base do cliente. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    const input = createInput.parse(await req.json());

    const entry = await prisma.memory.create({
      data: {
        organizationId: org,
        scope: "client",
        scopeId: id,
        kind: input.kind.trim() || "empresa",
        content: input.content.trim(),
        // Marca a origem para diferenciar de memórias geradas por outros fluxos
        // (ex.: feedback_cliente vindo dos ajustes).
        sourceRef: "client_knowledge",
      },
      select: { id: true, kind: true, content: true, sourceRef: true, createdAt: true },
    });
    return ok(entry, 201);
  });
}
