"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Project { id: string; name: string; brand?: { name: string; client?: { name: string } } }

/** Small project selector used by the AI-driven modules (Mercado, Audiência,
 * DNA, Editorial, Calendário). Loads projects on mount and calls onChange. */
export function ProjectPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Project[]>("/projects").then((p) => { setProjects(p); setLoading(false); if (p[0] && !value) onChange(p[0].id); }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <span className="text-sm text-muted">Carregando…</span>;
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nenhum projeto ainda. Crie um cliente → marca → projeto primeiro.
      </p>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm outline-none focus:border-brand">
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.brand?.client?.name ? `${p.brand.client.name} · ` : ""}
          {p.brand?.name ? `${p.brand.name} · ` : ""}
          {p.name}
        </option>
      ))}
    </select>
  );
}
