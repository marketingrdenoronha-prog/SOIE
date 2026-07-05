import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Global search across clients, brands, projects and deliverables (name/title,
 * case-insensitive). Scoped to the caller's organization. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return ok({ q, results: [] });

    const contains = { contains: q, mode: "insensitive" as const };
    const [clients, brands, projects, deliverables] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId: org, deletedAt: null, name: contains },
        select: { id: true, name: true }, take: 6,
      }),
      prisma.brand.findMany({
        where: { organizationId: org, name: contains },
        select: { id: true, name: true }, take: 6,
      }),
      prisma.project.findMany({
        where: { organizationId: org, name: contains },
        select: { id: true, name: true }, take: 6,
      }),
      prisma.deliverable.findMany({
        where: { organizationId: org, title: contains },
        select: { id: true, title: true, channel: true, type: true }, take: 6,
      }),
    ]);

    const results = [
      ...clients.map((c) => ({ kind: "Cliente", id: c.id, label: c.name, href: "/clients" })),
      ...brands.map((b) => ({ kind: "Marca", id: b.id, label: b.name, href: "/clients" })),
      ...projects.map((p) => ({ kind: "Projeto", id: p.id, label: p.name, href: "/clients" })),
      ...deliverables.map((d) => ({
        kind: "Entrega", id: d.id, label: d.title, sub: `${d.channel} · ${d.type}`, href: "/deliverables",
      })),
    ];
    return ok({ q, results });
  });
}
