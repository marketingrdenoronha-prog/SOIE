"use client";

import { useEffect, useState } from "react";
import { clearToken, isLoggedIn } from "@/lib/api";

/** Topbar: tenant/client/project context selectors, global search, theme. */
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

function Selector({ label, value }: { label: string; value: string }) {
  return (
    <button className="rounded-md px-2 py-1 hover:bg-border/50" title={label}>
      {value} <span className="text-xs">▾</span>
    </button>
  );
}
