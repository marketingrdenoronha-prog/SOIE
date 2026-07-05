"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, clearToken, isLoggedIn } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace";

interface Client { id: string; name: string }
interface Project {
  id: string;
  name: string;
  brand?: { name?: string; client?: { id?: string; name?: string } };
}

/** Topbar: tenant/client/project context selectors, global search,
 * notifications, theme. The Cliente/Projeto selectors write to the shared
 * workspace so every module page (Mercado, Audiência, DNA, Editorial, Memória,
 * Entregas) follows them. */
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
        {authed && <Search />}
        <button
          onClick={toggleTheme}
          className="grid h-8 w-8 place-items-center rounded-md border border-border text-sm hover:bg-border/50"
          aria-label="Alternar tema"
        >
          {dark ? "☀" : "☾"}
        </button>
        {authed && <Bell />}
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

interface Result { kind: string; id: string; label: string; sub?: string; href: string }

function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      api<{ results: Result[] }>(`/search?q=${encodeURIComponent(q)}`)
        .then((r) => { setResults(r.results); setOpen(true); })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={box} className="relative hidden sm:block">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Buscar clientes, marcas, entregas…"
        className="w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-brand"
      />
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-80 w-80 overflow-auto rounded-lg border border-border bg-elevated shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted">Nada encontrado.</p>
          ) : (
            results.map((r) => (
              <a key={`${r.kind}-${r.id}`} href={r.href}
                className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-surface">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.label}</p>
                  {r.sub && <p className="truncate text-xs text-muted">{r.sub}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-xs text-muted">{r.kind}</span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface Notif { id: string; title: string; body: string | null; readAt: string | null; createdAt: string }

function Bell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  function load() {
    api<{ items: Notif[]; unread: number }>("/notifications")
      .then((r) => { setItems(r.items); setUnread(r.unread); })
      .catch(() => {});
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try { await api("/notifications", { method: "POST" }); setUnread(0); load(); } catch { /* ignore */ }
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
        className="relative grid h-8 w-8 place-items-center rounded-md border border-border text-sm hover:bg-border/50"
        aria-label="Notificações"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-96 w-80 overflow-auto rounded-lg border border-border bg-elevated shadow-lg">
          <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">Notificações</p>
          {items.length === 0 ? (
            <p className="p-3 text-sm text-muted">Nenhuma notificação.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`border-b border-border px-3 py-2.5 last:border-b-0 ${n.readAt ? "" : "bg-brand/5"}`}>
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="text-xs text-muted">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
