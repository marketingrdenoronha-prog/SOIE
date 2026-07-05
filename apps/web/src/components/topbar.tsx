"use client";

import { useEffect, useMemo, useState } from "react";
import { api, clearToken, isLoggedIn } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Client { id: string; name: string }
interface Project {
  id: string;
  name: string;
  brand?: { name?: string; client?: { id?: string; name?: string } };
}

/** Topbar: tenant/client/project context selectors, global search, theme.
 * The Cliente/Projeto selectors write to the shared workspace so every module
 * page (Mercado, Audiência, DNA, Editorial, Memória, Entregas) follows them. */
export function Topbar() {
  const { clientId, projectId, setClientId, setProjectId } = useWorkspace();
  const [dark, setDark] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [orgName, setOrgName] = useState("Minha Agência");
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(prefers);
    document.documentElement.classList.toggle("dark", prefers);

    const loggedIn = isLoggedIn();
    setAuthed(loggedIn);
    if (!loggedIn) return;

    api<{ organization?: { name?: string } }>("/settings")
      .then((d) => { if (d.organization?.name) setOrgName(d.organization.name); })
      .catch(() => {});
    api<Client[]>("/clients").then(setClients).catch(() => {});
    api<Project[]>("/projects").then(setProjects).catch(() => {});
  }, []);

  // Projects available for the selected client (or all when none selected).
  const clientProjects = useMemo(
    () => projects.filter((p) => !clientId || p.brand?.client?.id === clientId),
    [projects, clientId],
  );

  function onClientChange(id: string) {
    setClientId(id);
    // Keep the project consistent with the new client.
    const belongs = projects.some((p) => p.id === projectId && p.brand?.client?.id === id);
    if (!belongs) {
      const first = projects.find((p) => !id || p.brand?.client?.id === id);
      setProjectId(first?.id ?? "");
    }
  }

  function logout() {
    clearToken();
    window.location.href = "/login";
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-elevated px-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="rounded-md px-2 py-1 font-medium text-foreground/80" title="Organização">
          {orgName}
        </span>
        <span className="text-border">/</span>
        <ContextSelect
          label="Cliente"
          value={clientId}
          onChange={onClientChange}
          placeholder="Todos os clientes"
          options={clients.map((c) => [c.id, c.name] as const)}
        />
        <span className="text-border">/</span>
        <ContextSelect
          label="Projeto"
          value={projectId}
          onChange={setProjectId}
          placeholder="Selecione"
          options={clientProjects.map((p) => [p.id, p.brand?.name ? `${p.brand.name} · ${p.name}` : p.name] as const)}
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <input
          placeholder="Buscar…  ⌘K"
          className="hidden w-56 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-brand sm:block"
        />
        <button
          onClick={toggleTheme}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-sm hover:bg-border/50"
          aria-label="Alternar tema"
        >
          {dark ? "☀" : "☾"}
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-md border border-border text-sm hover:bg-border/50">
          🔔
        </button>
        {authed ? (
          <button onClick={logout} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-border/50">
            Sair
          </button>
        ) : (
          <a href="/login" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
            Entrar
          </a>
        )}
      </div>
    </header>
  );
}

function ContextSelect({
  label, value, onChange, placeholder, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <select
      title={label}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={options.length === 0}
      className="max-w-[12rem] truncate rounded-md bg-transparent px-2 py-1 text-foreground/80 outline-none hover:bg-border/50 focus:bg-border/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}
