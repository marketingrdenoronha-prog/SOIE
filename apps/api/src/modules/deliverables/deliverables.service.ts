import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { QUEUES, enqueue } from "@soie/queue";
import { CHANNEL_DEFAULTS, FORMAT_CATALOG } from "@soie/ai";
import type { Channel, DeliverableType, RequestDeliverablesInput } from "@soie/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { TenantStore } from "../../common/tenant/tenant-context.js";

/**
 * Deliverables are channel/format-specific production units. Requesting them
 * creates one Deliverable per (channel, type) in `queued` and enqueues a
 * production job; the worker fills the roteiro and moves it through the
 * pipeline. `expand` lets a caller ask for a channel's full default asset set.
 */
@Injectable()
export class DeliverablesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(projectId?: string) {
    const { organizationId } = TenantStore.require();
    return this.prisma.forTenant(organizationId, (tx) =>
      tx.deliverable.findMany({
        where: { organizationId, ...(projectId ? { projectId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { comments: { orderBy: { createdAt: "desc" } }, reviewLinks: true },
      }),
    );
  }

  async get(id: string) {
    const { organizationId } = TenantStore.require();
    const d = await this.prisma.forTenant(organizationId, (tx) =>
      tx.deliverable.findFirst({
        where: { id, organizationId },
        include: { comments: { orderBy: { createdAt: "desc" } }, reviewLinks: true },
      }),
    );
    if (!d) throw new NotFoundException("Deliverable not found");
    return d;
  }

  /** Requests deliverables and enqueues production for each. */
  async request(input: RequestDeliverablesInput) {
    const { organizationId, userId } = TenantStore.require();

    const created = await this.prisma.forTenant(organizationId, async (tx) => {
      const rows = [] as { id: string; channel: string; type: string }[];
      for (const item of input.items) {
        const format = FORMAT_CATALOG[item.type as DeliverableType];
        const d = await tx.deliverable.create({
          data: {
            organizationId,
            projectId: input.projectId,
            channel: item.channel,
            type: item.type,
            title: format.label(item.channel as Channel),
            brief: item.brief,
            status: "queued",
            createdBy: userId,
          },
        });
        rows.push({ id: d.id, channel: d.channel, type: d.type });
      }
      return rows;
    });

    for (const d of created) {
      await enqueue(
        QUEUES.agent,
        {
          kind: "deliverable",
          deliverableId: d.id,
          organizationId,
          projectId: input.projectId,
          channel: d.channel,
          type: d.type,
        },
        { jobId: `deliverable:${d.id}` },
      );
    }

    return { count: created.length, deliverables: created };
  }

  /** Expands a channel to its default deliverable set (helper for the UI). */
  defaultsFor(channel: Channel): DeliverableType[] {
    return CHANNEL_DEFAULTS[channel];
  }

  /** Creates an open, tokenized review link for the client. */
  async createReviewLink(deliverableId: string) {
    const { organizationId, userId } = TenantStore.require();
    const d = await this.prisma.forTenant(organizationId, (tx) =>
      tx.deliverable.findFirst({ where: { id: deliverableId, organizationId } }),
    );
    if (!d) throw new NotFoundException("Deliverable not found");

    const token = randomBytes(24).toString("base64url");
    await this.prisma.forTenant(organizationId, (tx) =>
      tx.$transaction([
        tx.reviewLink.create({
          data: { organizationId, deliverableId, token, createdBy: userId },
        }),
        tx.deliverable.update({
          where: { id: deliverableId },
          data: { status: "client_review" },
        }),
      ]),
    );
    return { token, url: `/review/${token}` };
  }
}
