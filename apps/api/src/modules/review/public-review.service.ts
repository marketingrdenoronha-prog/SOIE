import { Injectable, NotFoundException, GoneException } from "@nestjs/common";
import { prisma } from "@soie/db";
import type {
  ApproveInput,
  PublicReviewView,
  RequestChangesInput,
} from "@soie/contracts";

/**
 * Public, unauthenticated review flow. Possession of the token is the
 * authorization: the client opens the link, sees the deliverable, and either
 * approves (OK) or requests changes with a comment. Both actions write a
 * ReviewComment and a Notification so the feedback surfaces inside the owning
 * organization. Runs outside tenant scope by design (the client has no login),
 * so every query is keyed by the token → deliverable → its organizationId.
 */
@Injectable()
export class PublicReviewService {
  async getByToken(token: string): Promise<PublicReviewView> {
    const link = await this.loadLink(token);
    const d = link.deliverable;
    await prisma.reviewLink.update({ where: { id: link.id }, data: { lastViewedAt: new Date() } });

    const comments = await prisma.reviewComment.findMany({
      where: { deliverableId: d.id },
      orderBy: { createdAt: "asc" },
    });

    return {
      token,
      status: d.status,
      brand: d.project.brand.name,
      project: d.project.name,
      deliverable: { title: d.title, channel: d.channel, type: d.type, spec: d.spec },
      history: comments.map((c) => ({
        decision: c.decision,
        comment: c.comment,
        at: c.createdAt.toISOString(),
        author: c.authorName,
      })),
    };
  }

  async approve(token: string, input: ApproveInput) {
    const link = await this.loadLink(token);
    const d = link.deliverable;
    await prisma.$transaction([
      prisma.reviewComment.create({
        data: {
          organizationId: d.organizationId,
          deliverableId: d.id,
          reviewLinkId: link.id,
          decision: "approve",
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.deliverable.update({ where: { id: d.id }, data: { status: "approved" } }),
      prisma.reviewLink.update({ where: { id: link.id }, data: { status: "decided" } }),
      prisma.notification.create({
        data: {
          organizationId: d.organizationId,
          userId: d.createdBy ?? d.organizationId,
          type: "deliverable_approved",
          title: `Cliente aprovou: ${d.title}`,
          body: `${d.project.brand.name} · ${d.project.name}`,
          data: { deliverableId: d.id },
        },
      }),
    ]);
    return { status: "approved" as const };
  }

  async requestChanges(token: string, input: RequestChangesInput) {
    const link = await this.loadLink(token);
    const d = link.deliverable;
    await prisma.$transaction([
      prisma.reviewComment.create({
        data: {
          organizationId: d.organizationId,
          deliverableId: d.id,
          reviewLinkId: link.id,
          decision: "request_changes",
          comment: input.comment,
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.deliverable.update({ where: { id: d.id }, data: { status: "changes_requested" } }),
      prisma.notification.create({
        data: {
          organizationId: d.organizationId,
          userId: d.createdBy ?? d.organizationId,
          type: "deliverable_changes_requested",
          title: `Cliente pediu ajuste: ${d.title}`,
          body: input.comment.slice(0, 160),
          data: { deliverableId: d.id },
        },
      }),
    ]);
    return { status: "changes_requested" as const };
  }

  private async loadLink(token: string) {
    const link = await prisma.reviewLink.findUnique({
      where: { token },
      include: { deliverable: { include: { project: { include: { brand: true } } } } },
    });
    if (!link || link.status === "revoked") throw new NotFoundException("Link inválido");
    if (link.expiresAt && link.expiresAt < new Date()) throw new GoneException("Link expirado");
    return link;
  }
}
