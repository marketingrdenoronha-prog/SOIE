import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET one editorial strategy version with lines, themes and review history. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        reviewLinks: { orderBy: { createdAt: "desc" } },
        reviewComments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    return ok(strategy);
  });
}
