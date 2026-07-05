export interface NavItem {
  label: string;
  href: string;
  group: "Trabalho" | "Inteligência" | "IA" | "Admin";
  icon: string;
}

/** Sidebar navigation (Architecture Phase 6.2 / modules of Phase 3). */
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", group: "Trabalho", icon: "◱" },
  { label: "Clientes", href: "/clients", group: "Trabalho", icon: "◫" },
  { label: "Entregas", href: "/deliverables", group: "Trabalho", icon: "✎" },
  { label: "Calendário", href: "/calendar", group: "Trabalho", icon: "▦" },
  { label: "Mercado", href: "/market", group: "Inteligência", icon: "◈" },
  { label: "Audiência", href: "/audience", group: "Inteligência", icon: "◉" },
  { label: "DNA da Marca", href: "/brand-dna", group: "Inteligência", icon: "❖" },
  { label: "Linha Editorial", href: "/editorial", group: "Inteligência", icon: "☰" },
  { label: "Memória", href: "/memory", group: "Inteligência", icon: "❋" },
  { label: "Biblioteca", href: "/library", group: "Inteligência", icon: "▤" },
  { label: "Agentes & Execuções", href: "/ai", group: "IA", icon: "✦" },
  { label: "Relatórios", href: "/reports", group: "IA", icon: "◭" },
  { label: "Importar base", href: "/import", group: "Admin", icon: "⇪" },
  { label: "Configurações", href: "/settings", group: "Admin", icon: "⚙" },
];

export const NAV_GROUPS = ["Trabalho", "Inteligência", "IA", "Admin"] as const;
