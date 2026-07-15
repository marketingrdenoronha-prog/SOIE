import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { hasZernio } from "@/server/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** GET /editorial-strategies/:id/schedule
 * Carrega as peças da linha + o agendamento de cada uma + o estado da conexão
 * de redes do cliente. Base da tela de agendamento (aba "A Postar"). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      include: {
        editorialLines: {
          include: {
            categories: {
              include: {
                themes: {
                  orderBy: { priority: "asc" },
                  include: { deliverable: { include: { assets: { orderBy: { version: "desc" } } } } },
                },
              },
            },
          },
        },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    const themes = strategy.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes));
    const deliverableIds = themes.map((t) => t.deliverable?.id).filter((x): x is string => Boolean(x));

    const schedules = deliverableIds.length
      ? await prisma.scheduledPost.findMany({ where: { organizationId: org, deliverableId: { in: deliverableIds } } })
      : [];
    const byDeliverable = new Map(schedules.map((s) => [s.deliverableId, s]));

    const conn = strategy.clientId
      ? await prisma.socialConnection.findUnique({ where: { clientId: strategy.clientId } })
      : null;

    const pieces = themes
      .filter((t) => t.deliverable)
      .map((t) => {
        const d = t.deliverable!;
        const sched = byDeliverable.get(d.id);
        const latest = d.assets.length ? d.assets[0].version : 0;
        return {
          deliverableId: d.id,
          title: d.title,
          channel: d.channel,
          type: d.type,
          brief: d.brief,
          hook: t.hook,
          cta: t.cta,
          assets: d.assets.filter((a) => a.version === latest).map((a) => ({ kind: a.kind, url: a.url, name: a.name })),
          schedule: sched
            ? { channel: sched.channel, caption: sched.caption, scheduledFor: sched.scheduledFor, status: sched.status, externalId: sched.externalId, error: sched.error }
            : null,
        };
      });

    return ok({
      strategyId: strategy.id,
      clientId: strategy.clientId,
      version: strategy.version,
      social: {
        configured: hasZernio(),
        connected: Boolean(conn?.profileId),
        accounts: (conn?.accounts as any[]) ?? [],
      },
      pieces,
    });
  });
}

const putInput = z.object({
  items: z.array(z.object({
    deliverableId: z.string().uuid(),
    channel: z.string().max(60),
    caption: z.string().max(4000).optional(),
    scheduledFor: z.string().datetime().nullable().optional(),
  })).max(200),
});

/** PUT /editorial-strategies/:id/schedule — salva (upsert) o agendamento das peças. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const { items } = putInput.parse(await req.json());

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, clientId: true },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    for (const it of items) {
      await prisma.scheduledPost.upsert({
        where: { deliverableId: it.deliverableId },
        create: {
          organizationId: org,
          clientId: strategy.clientId,
          strategyId: strategy.id,
          deliverableId: it.deliverableId,
          channel: it.channel,
          caption: it.caption ?? null,
          scheduledFor: it.scheduledFor ? new Date(it.scheduledFor) : null,
          status: "draft",
        },
        update: {
          channel: it.channel,
          caption: it.caption ?? null,
          scheduledFor: it.scheduledFor ? new Date(it.scheduledFor) : null,
        },
      });
    }

    return ok({ saved: items.length });
  });
}
