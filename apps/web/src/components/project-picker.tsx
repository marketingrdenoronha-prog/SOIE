"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Project { id: string; name: string; brand?: { name?: string; client?: { id?: string; name?: string } } }

/** Small project selector used by the AI-driven modules (Mercado, Audiência,
 * DNA, Editorial, Calendário, Memória). Backed by the shared workspace so it
 * stays in sync with the topbar's Cliente/Projeto selectors in both directions:
 * changing it here updates the topbar, and vice-versa. */
export function ProjectPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { clientId, projectId: ctxProject, setProjectId: setCtx } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Project[]>("/projects")
      .then((p) => {
        setProjects(p);
        setLoading(false);
        // Prefer the globally-selected project when it's valid; else keep the
        // page value; else fall back to the first project.
        const initial =
          (ctxProject && p.some((x) => x.id === ctxProject) && ctxProject) ||
          (value && p.some((x) => x.id === value) && value) ||
          p[0]?.id ||
          "";
        if (initial && initial !== value) onChange(initial);
        if (initial && initial !== ctxProject) setCtx(initial);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow topbar changes to the global project.
  useEffect(() => {
    if (ctxProject && ctxProject !== value) onChange(ctxProject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxProject]);

  function handle(id: string) {
    onChange(id);
    setCtx(id);
  }

  if (loading) return <span className="text-sm text-muted">Carregando…</span>;
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nenhum projeto ainda. Crie um cliente → marca → projeto primeiro.
      </p>
    );
  }

  // Show projects of the selected client first, but never hide the current one.
  const visible = clientId
    ? projects.filter((p) => p.brand?.client?.id === clientId || p.id === value)
    : projects;

  return (
    <select value={value} onChange={(e) => handle(e.target.value)} className="rounded-lg border border-border bg-elevated px-3 py-2 text-sm outline-none focus:border-brand">
      {visible.map((p) => (
        <option key={p.id} value={p.id}>
          {p.brand?.client?.name ? `${p.brand.client.name} · ` : ""}
          {p.brand?.name ? `${p.brand.name} · ` : ""}
          {p.name}
        </option>
      ))}
    </select>
  );
}
