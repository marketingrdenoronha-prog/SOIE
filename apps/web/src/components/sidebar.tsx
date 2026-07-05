"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NAV_GROUPS } from "@/lib/nav";
import { Logo } from "@/components/logo";

/** Left navigation — Cyber-Editorial OS shell. Fixed 260px, tonal-layered on the
 * elevated surface with a pinned "New Execution" action at the foot. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-elevated md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo className="h-7 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group} className="mb-5">
            {gi > 0 && <p className="label-caps px-2 pb-1.5 text-[10px] text-muted">{group}</p>}
            {NAV.filter((n) => n.group === group && n.href !== "/settings").map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-brand/10 font-semibold text-brand-strong dark:text-brand"
                      : "text-foreground/75 hover:bg-brand/5 hover:text-foreground"
                  }`}
                >
                  <span className={`w-4 text-center ${active ? "text-brand-strong dark:text-brand" : "text-muted"}`}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <Link
          href="/deliverables"
          className="mb-1 flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong dark:text-[#00390d]"
        >
          <span>＋</span> New Execution
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-brand/10 font-semibold text-brand-strong dark:text-brand"
              : "text-foreground/75 hover:bg-brand/5"
          }`}
        >
          <span className="w-4 text-center text-muted">⚙</span> Configurações
        </Link>
      </div>
    </aside>
  );
}
