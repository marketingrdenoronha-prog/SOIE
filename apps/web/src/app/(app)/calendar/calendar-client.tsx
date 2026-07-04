"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Calendar = any;

export function CalendarClient() {
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Calendar[]>("/calendar").then(setCalendars).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Calendário" subtitle="Planejamento editorial no tempo." />
      {err && <p className="text-sm text-rose-500">{err}</p>}
      {calendars === null ? <p className="text-sm text-muted">Carregando…</p> :
        calendars.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Sem calendários ainda. Eles são criados junto com a linha editorial.</p> :
        calendars.map((cal) => (
          <div key={cal.id} className="rounded-xl border border-border bg-elevated p-5">
            <p className="font-medium">{cal.name}</p>
            <p className="text-xs text-muted">{cal.project?.brand?.name} · {cal.project?.name}</p>
            {cal.entries?.length === 0 ? <p className="mt-2 text-sm text-muted">Sem posts agendados.</p> :
              <ul className="mt-3 divide-y divide-border">
                {cal.entries?.slice(0, 20).map((e: {
                  id: string; date: string; platform?: string; status: string;
                }) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{new Date(e.date).toLocaleDateString("pt-BR")} · {e.platform ?? "—"}</span>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{e.status}</span>
                  </li>
                ))}
              </ul>}
          </div>
        ))}
    </div>
  );
}
