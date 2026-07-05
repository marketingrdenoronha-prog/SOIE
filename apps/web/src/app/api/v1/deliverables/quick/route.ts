import { z } from "zod";
import { prisma } from "@soie/db";
import { Channel, DeliverableType } from "@soie/contracts";
import { FORMAT_CATALOG } from "@soie/ai";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { produceInline } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z
  .object({
    /** Generate for an existing project (preferred): reuses its persona, brand
     * voice and editorial line as context. */
    projectId: z.string().uuid().optional(),
    /** Or provision a fresh client → brand → project from a name (demo flow). */
    clientName: z.string().min(1).max(200).optional(),
    brandName: z.string().min(1).max(200).optional(),
    channel: Channel,
    type: DeliverableType,
    brief: z.string().max(2000).optional(),
    /** Theme dropped from an editorial line — anchors the roteiro. */
    theme: z.string().max(300).optional(),
  })
  .refine((v) => Boolean(v.projectId) || Boolean(v.clientName), {
    message: "Informe um projeto existente (projectId) ou um nome de cliente (clientName).",
  });

/** Produce a deliverable's roteiro inline and open a client review link.
 *
 * Two modes:
 *  - `projectId`: generate against an existing project, feeding the persona,
 *    brand voice and editorial line as context (Constitution P1: contexto antes
 *    de conteúdo).
 *  - `clientName`: one-call demo that provisions client → brand → project first.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const input = body.parse(await req.json());

    let projectId: string;
    let context: Record<string, unknown> = {};

    if (input.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, organizationId: org },
      });
      if (!project) throw Errors.notFound("Projeto");
      projectId = project.id;
      context = await assembleProjectContext(org, project.id);
    } else {
      const client = await prisma.client.create({
        data: { organizationId: org, name: input.clientName! },
      });
      const brand = await prisma.brand.create({
        data: { organizationId: org, clientId: client.id, name: input.brandName ?? input.clientName! },
      });
      const project = await prisma.project.create({
        data: { organizationId: org, brandId: brand.id, name: "Projeto inicial", status: "production" },
      });
      projectId = project.id;
    }

    const format = FORMAT_CATALOG[input.type];
    const deliverable = await prisma.deliverable.create({
      data: {
        organizationId: org,
        projectId,
        channel: input.channel,
        type: input.type,
        title: input.theme ? `${format.label(input.channel)} · ${input.theme}` : format.label(input.channel),
        brief: input.theme ?? input.brief,
        status: "generating",
        createdBy: sub,
      },
    });

    let produced;
    try {
      produced = await produceInline(deliverable.id, input.type, input.channel, input.brief, context, input.theme);
    } catch (err) {
      // Don't leave the deliverable stuck on "generating" if generation fails.
      await prisma.deliverable.update({
        where: { id: deliverable.id },
        data: { status: "draft" },
      });
      throw err;
    }

    // Para em REVISÃO INTERNA — a equipe revisa e só então libera o link do
    // cliente (POST /deliverables/[id]/approve). Isso evita mandar o primeiro
    // rascunho direto ao cliente.
    const updated = await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        spec: produced.spec as object,
        confidence: produced.confidence,
        evaluationScore: produced.evaluationScore,
        status: "internal_review",
      },
    });

    void sub;
    return ok({ deliverable: updated }, 201);
  });
}
