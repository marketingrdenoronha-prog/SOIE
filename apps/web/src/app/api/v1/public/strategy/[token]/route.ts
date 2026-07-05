import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public strategy review view — no auth; the opaque token is the capability. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const strategy = await prisma.editorialStrategy.findUnique({
      where: { reviewToken: token },
      include: {
        project: { include: { brand: true } },
        editorialLines: { include: { categories: { include: { themes: true } } } },
      },
    });
    if (!strategy) throw Errors.notFound("Link");

    return ok({
      token,
      status: strategy.status,
      brand: strategy.project.brand.name,
      project: strategy.project.name,
      clientComment: strategy.clientComment,
      strategy: {
        positioning: strategy.positioning,
        pillars: strategy.pillars,
        rationale: strategy.rationale,
        lines: strategy.editorialLines.map((l) => ({
          name: l.name,
          objective: l.objective,
          funnelStage: l.funnelStage,
          categories: l.categories.map((c) => ({
            name: c.name,
            themes: c.themes.map((t) => t.title),
          })),
        })),
      },
    });
  });
}
