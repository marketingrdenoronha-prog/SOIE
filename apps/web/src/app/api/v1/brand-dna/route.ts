import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const generateInput = z.object({
  brandId: z.string().uuid(),
  samples: z.string().max(4000).optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId") ?? undefined;
    const voices = await prisma.brandVoice.findMany({
      where: { organizationId: org, ...(brandId ? { brandId } : {}) },
      include: { brand: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const vocabs = brandId
      ? await prisma.vocabulary.findMany({ where: { organizationId: org, brandId } })
      : [];
    const archetypes = brandId
      ? await prisma.archetype.findMany({ where: { organizationId: org, brandId } })
      : [];
    return ok({ voices, vocabularies: vocabs, archetypes });
  });
}

/** Extract brand DNA from writing samples via the Language agent. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = generateInput.parse(await req.json());
    const brand = await prisma.brand.findFirst({
      where: { id: input.brandId, organizationId: org },
    });
    if (!brand) throw new Error("Marca não encontrada");

    // Voice extraction benefits from the audience/market already mapped: pull
    // context from the brand's most recent project, when there is one.
    const recentProject = await prisma.project.findFirst({
      where: { organizationId: org, brandId: input.brandId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    const context = recentProject ? await assembleProjectContext(org, recentProject.id) : {};

    const result = await runAgent("language", {
      brand: brand.name, positioning: brand.positioning, samples: input.samples,
    }, context, { organizationId: org });

    const voice = await prisma.brandVoice.create({
      data: {
        organizationId: org,
        brandId: input.brandId,
        tone: result.tone ?? {},
        formality: result.formality,
        emojisPolicy: result.emojisPolicy ?? {},
        doList: result.do ?? [],
        dontList: result.dont ?? [],
        examples: result.examples ?? [],
        confidence: (result.confidence as "high" | "medium" | "low") ?? "medium",
      },
    });

    if (result.archetypes?.length) {
      await prisma.archetype.createMany({
        data: result.archetypes.map((a: { archetype: string; weight?: number; rationale?: string }) => ({
          organizationId: org, brandId: input.brandId, archetype: a.archetype,
          weight: a.weight ?? 0.5, rationale: a.rationale,
        })),
      });
    }
    if (result.vocabulary?.length) {
      await prisma.vocabulary.createMany({
        data: result.vocabulary.map((v: { kind: string; term: string; note?: string }) => ({
          organizationId: org, brandId: input.brandId, kind: v.kind, term: v.term, note: v.note,
        })),
      });
    }
    return ok(voice, 201);
  });
}
