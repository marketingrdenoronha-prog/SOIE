"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, clearToken, isLoggedIn } from "@/lib/api";

/** Topbar: global search, section tabs (Work/Intelligence/AI/Admin),
 * notifications, help and account. */
const TABS: { label: string; href: string; match: string[] }[] = [
  { label: "Work", href: "/dashboard", match: ["/dashboard", "/clients", "/deliverables", "/calendar"] },
  { label: "Intelligence", href: "/market", match: ["/market", "/audience", "/brand-dna", "/editorial", "/memory", "/library"] },
  { label: "AI", href: "/ai", match: ["/ai", "/reports"] },
  { label: "Admin", href: "/settings", match: ["/settings", "/import"] },
];

export function Topbar() {
  const [dark, setDark] = useState(false);
  const [authed, setAuthed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Default to the light "Cyber-Editorial" look; honor a saved preference.
    const saved = localStorage.getItem("soie.theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
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
    localStorage.setItem("soie.theme", next ? "dark" : "light");
  }

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-elevated px-5">
      {authed && <Search />}
      <nav className="hidden items-center gap-5 lg:flex">
        {TABS.map((t) => {
          const active = t.match.some((m) => pathname.startsWith(m));
          return (
            <Link key={t.label} href={t.href}
              className={`relative py-1 text-sm transition-colors ${active ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}`}>
              {t.label}
              {active && <span className="absolute -bottom-[21px] left-0 h-0.5 w-full bg-brand" />}
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={toggleTheme}
          className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-brand/5 hover:text-foreground"
          aria-label="Alternar tema">{dark ? "☀" : "☾"}</button>
        {authed && <Bell />}
        <span className="hidden text-muted sm:block" aria-hidden>?</span>
        {authed ? (
          <button onClick={logout} title="Sair"
            className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-sm font-semibold text-brand-strong dark:text-brand">
            ⏻
          </button>
        ) : (
          <a href="/login" className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
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
  const router = useRouter();

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
    function onClick(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={box} className="relative hidden w-72 sm:block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">⌕</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Buscar operações, clientes, inteligência…"
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-brand"
      />
      {open && (
        <div className="absolute left-0 z-50 mt-1 max-h-80 w-96 overflow-auto rounded-lg border border-border bg-elevated shadow-lg">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted">Nada encontrado.</p>
          ) : results.map((r) => (
            <button key={`${r.kind}-${r.id}`} onClick={() => { setOpen(false); router.push(r.href); }}
              className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-brand/5">
              <span className="min-w-0"><span className="block truncate font-medium">{r.label}</span>{r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}</span>
              <span className="label-caps shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{r.kind}</span>
            </button>
          ))}
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
      .then((r) => { setItems(r.items); setUnread(r.unread); }).catch(() => {});
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open; setOpen(next);
    if (next && unread > 0) { try { await api("/notifications", { method: "POST" }); setUnread(0); load(); } catch { /* ignore */ } }
  }

  return (
    <div ref={box} className="relative">
      <button onClick={toggle} className="relative grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-brand/5 hover:text-foreground" aria-label="Notificações">
        🔔
        {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-crit px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 max-h-96 w-80 overflow-auto rounded-lg border border-border bg-elevated shadow-lg">
          <p className="label-caps border-b border-border px-3 py-2 text-[10px] text-muted">Notificações</p>
          {items.length === 0 ? <p className="p-3 text-sm text-muted">Nenhuma notificação.</p> : items.map((n) => (
            <div key={n.id} className={`border-b border-border px-3 py-2.5 last:border-b-0 ${n.readAt ? "" : "bg-brand/5"}`}>
              <p className="text-sm font-medium">{n.title}</p>
              {n.body && <p className="text-xs text-muted">{n.body}</p>}
              <p className="label-caps mt-1 text-[10px] text-muted">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
