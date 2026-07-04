"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, NAV_GROUPS } from "@/lib/nav";

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-elevated md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">
          S
        </span>
        <span className="font-semibold tracking-tight">SOIE</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="mb-5">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
              {group}
            </p>
            {NAV.filter((n) => n.group === group).map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-foreground/80 hover:bg-border/50"
                  }`}
                >
                  <span className="w-4 text-center text-muted">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
