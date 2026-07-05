import { z } from "zod";
import { prisma } from "@soie/db";
import { onboardingPatchInput, isOnboardingComplete } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

async function ownedClient(org: string, id: string) {
  if (!uuid.safeParse(id).success) throw Errors.notFound("Cliente");
  const c = await prisma.client.findFirst({
    where: { id, organizationId: org, deletedAt: null },
    select: { id: true },
  });
  if (!c) throw Errors.notFound("Cliente");
  return c;
}

/**
 * GET /api/v1/clients/:id/onboarding
 * Devolve o rascunho corrente do wizard (cria vazio se não existir), com
 * `isComplete` marcando se o payload já pode ser finalizado.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    const existing = await prisma.strategicOnboarding.findUnique({ where: { clientId: id } });
    const onboarding = existing ?? await prisma.strategicOnboarding.create({
      data: { organizationId: org, clientId: id },
    });
    return ok({ onboarding, isComplete: isOnboardingComplete(onboarding.payload) });
  });
}

/**
 * PATCH /api/v1/clients/:id/onboarding
 * Salva um step do wizard (payload merge shallow por step + posição corrente).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    const input = onboardingPatchInput.parse(await req.json());

    const current = await prisma.strategicOnboarding.findUnique({ where: { clientId: id } });
    const currentPayload = (current?.payload ?? {}) as Record<string, unknown>;
    const mergedPayload = { ...currentPayload, ...input.payload };

    const saved = await prisma.strategicOnboarding.upsert({
      where: { clientId: id },
      create: {
        organizationId: org,
        clientId: id,
        step: input.step ?? 0,
        payload: mergedPayload as object,
      },
      update: {
        step: input.step ?? current?.step ?? 0,
        payload: mergedPayload as object,
      },
    });
    return ok({ onboarding: saved, isComplete: isOnboardingComplete(saved.payload) });
  });
}
