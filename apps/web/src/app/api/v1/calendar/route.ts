import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("projectId");
    const projectId = raw && z.string().uuid().safeParse(raw).success ? raw : undefined;
    const calendars = await prisma.calendar.findMany({
      where: { organizationId: org, ...(projectId ? { projectId } : {}) },
      include: {
        entries: { orderBy: { date: "asc" } },
        project: { select: { name: true, brand: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(calendars);
  });
}

const body = z.object({
  projectId: z.string().uuid(),
  postsPerWeek: z.number().int().min(1).max(7).optional(),
  weeks: z.number().int().min(1).max(12).optional(),
});

/**
 * Generates (or refreshes) a content calendar for a project from its latest
 * editorial strategy: every theme of every editorial line becomes a scheduled
 * post, distributed across the coming weeks on fixed weekdays. Deterministic —
 * no AI needed — so it always populates.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = body.parse(await req.json());

    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: org },
      include: { brand: { select: { name: true } } },
    });
    if (!project) throw Errors.notFound("Projeto");

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { organizationId: org, projectId: input.projectId },
      orderBy: { createdAt: "desc" },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
      },
    });
    if (!strategy || strategy.editorialLines.length === 0) {
      throw Errors.badRequest("Gere a linha editorial deste projeto antes de montar o calendário.");
    }

    // Flatten themes, keeping the line's platform for each.
    const slots: { title: string; platform: string }[] = [];
    for (const line of strategy.editorialLines) {
      const platform = (line.platforms as string[])?.[0] ?? "instagram";
      for (const cat of line.categories) {
        for (const theme of cat.themes) {
          slots.push({ title: `${cat.name}: ${theme.title}`, platform });
        }
      }
    }
    if (slots.length === 0) throw Errors.badRequest("A linha editorial não tem temas para agendar.");

    const perWeek = input.postsPerWeek ?? 3;
    const weekdays = [1, 3, 5, 2, 4, 0, 6].slice(0, perWeek); // seg, qua, sex, ...
    const weeks = input.weeks ?? Math.min(8, Math.ceil(slots.length / perWeek));

    // Build the dated schedule starting next Monday.
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const day = start.getDay();
    const daysToMonday = ((8 - day) % 7) || 7;
    start.setDate(start.getDate() + daysToMonday);

    const dates: Date[] = [];
    for (let w = 0; w < weeks; w++) {
      for (const wd of weekdays.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const d = new Date(start);
        const monday = new Date(start);
        monday.setDate(start.getDate() + w * 7);
        const offset = (wd + 6) % 7; // monday=0
        d.setTime(monday.getTime());
        d.setDate(monday.getDate() + offset);
        dates.push(new Date(d));
      }
    }

    // Fresh calendar per generation (replace the project's previous one).
    await prisma.calendar.deleteMany({ where: { organizationId: org, projectId: input.projectId } });
    const calendar = await prisma.calendar.create({
      data: {
        organizationId: org,
        projectId: input.projectId,
        name: `Calendário — ${project.brand?.name ?? project.name}`,
      },
    });

    const entries = slots.slice(0, dates.length).map((s, i) => ({
      organizationId: org,
      calendarId: calendar.id,
      title: s.title,
      date: dates[i]!,
      time: "09:00",
      status: "planned",
      platform: s.platform,
      dragOrder: i,
    }));
    await prisma.calendarEntry.createMany({ data: entries });

    return ok({ calendarId: calendar.id, scheduled: entries.length, totalThemes: slots.length }, 201);
  });
}
