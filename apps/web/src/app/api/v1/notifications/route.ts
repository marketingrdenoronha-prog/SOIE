import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The logged-in user's notifications (newest first) + unread count. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { organizationId: org, userId: sub },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { organizationId: org, userId: sub, readAt: null },
      }),
    ]);
    return ok({ items, unread });
  });
}

/** Mark all of the user's notifications as read. */
export async function POST(req: Request) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    await prisma.notification.updateMany({
      where: { organizationId: org, userId: sub, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ ok: true });
  });
}
