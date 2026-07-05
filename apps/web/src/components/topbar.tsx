"use client";

import { useEffect, useRef, useState } from "react";
import { api, clearToken, isLoggedIn } from "@/lib/api";

/** Topbar: tenant/client/project context selectors, global search, notifications, theme. */
export function Topbar() {
  const [dark, setDark] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(prefers);
    document.documentElement.classList.toggle("dark", prefers);
    setAuthed(isLoggedIn());
  }, []);

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
        <Selector label="Organização" value="Minha Agência" />
        <span className="text-border">/</span>
        <Selector label="Cliente" value="Selecione" />
        <span className="text-border">/</span>
        <Selector label="Projeto" value="Selecione" />
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

function Selector({ label, value }: { label: string; value: string }) {
  return (
    <button className="rounded-md px-2 py-1 hover:bg-border/50" title={label}>
      {value} <span className="text-xs">▾</span>
    </button>
  );
}
