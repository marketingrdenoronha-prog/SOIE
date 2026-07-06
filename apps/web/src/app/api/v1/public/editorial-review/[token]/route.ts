import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public editorial-strategy review view — no auth; token is the capability. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const link = await prisma.editorialReviewLink.findUnique({
      where: { token },
      include: {
        strategy: {
          include: {
            project: { include: { brand: { include: { client: true } } } },
            editorialLines: { include: { categories: { include: { themes: true } } } },
            reviewComments: { orderBy: { createdAt: "asc" } },
          },
        },
      },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    if (link.expiresAt && link.expiresAt < new Date()) throw Errors.gone("Link expirado");

    await prisma.editorialReviewLink.update({
      where: { id: link.id },
      data: { lastViewedAt: new Date() },
    });

    const s = link.strategy;
    return ok({
      token,
      status: s.status,
      client: s.project.brand.client.name,
      brand: s.project.brand.name,
      project: s.project.name,
      strategy: {
        id: s.id,
        version: s.version,
        positioning: s.positioning,
        pillars: s.pillars,
        rationale: s.rationale,
        lines: s.editorialLines.map((l) => ({
          name: l.name,
          objective: l.objective,
          funnelStage: l.funnelStage,
          platforms: l.platforms,
          categories: l.categories.map((c) => ({
            name: c.name,
            themes: c.themes.map((t) => ({ title: t.title, channel: t.channel, format: t.format, copy: t.copy })),
          })),
        })),
      },
      history: s.reviewComments.map((c) => ({
        decision: c.decision,
        comment: c.comment,
        at: c.createdAt.toISOString(),
        author: c.authorName,
      })),
    });
  });
}
