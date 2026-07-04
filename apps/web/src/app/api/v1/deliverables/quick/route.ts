import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@soie/db";
import { Channel, DeliverableType } from "@soie/contracts";
import { FORMAT_CATALOG } from "@soie/ai";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { produceInline } from "@/server/ai-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  clientName: z.string().min(1).max(200),
  brandName: z.string().min(1).max(200).optional(),
  channel: Channel,
  type: DeliverableType,
  brief: z.string().max(2000).optional(),
});

/** One-call demo flow: provision client → brand → project, produce the roteiro
 * inline, and open a client review link. Returns the deliverable + review URL. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const input = body.parse(await req.json());

    const client = await prisma.client.create({
      data: { organizationId: org, name: input.clientName },
    });
    const brand = await prisma.brand.create({
      data: { organizationId: org, clientId: client.id, name: input.brandName ?? input.clientName },
    });
    const project = await prisma.project.create({
      data: { organizationId: org, brandId: brand.id, name: "Projeto inicial", status: "production" },
    });

    const format = FORMAT_CATALOG[input.type];
    const deliverable = await prisma.deliverable.create({
      data: {
        organizationId: org,
        projectId: project.id,
        channel: input.channel,
        type: input.type,
        title: format.label(input.channel),
        brief: input.brief,
        status: "generating",
        createdBy: sub,
      },
    });

    const produced = await produceInline(deliverable.id, input.type, input.channel, input.brief);

    const token = randomBytes(24).toString("base64url");
    const updated = await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        spec: produced.spec as object,
        confidence: produced.confidence,
        evaluationScore: produced.evaluationScore,
        status: "client_review",
      },
    });
    await prisma.reviewLink.create({
      data: { organizationId: org, deliverableId: updated.id, token, createdBy: sub },
    });

    return ok({ deliverable: updated, token, reviewUrl: `/review/${token}` }, 201);
  });
}
