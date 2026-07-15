export interface NavItem {
  label: string;
  href: string;
  group: "Trabalho" | "Admin";
  icon: string;
}

/**
 * Nav V2 — a operação diária acontece dentro do detalhe do Cliente. A barra
 * lateral só tem 3 destinos: visão geral, lista de clientes e configurações.
 *
 * Módulos V1 (Mercado, Audiência, DNA, Editorial, Memória, Biblioteca,
 * Calendário, Agentes, Relatórios, Import) foram absorvidos pelo fluxo linear
 * — as rotas continuam existindo por compatibilidade, mas somem do menu.
 */
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", group: "Trabalho", icon: "◱" },
  { label: "Clientes", href: "/clients", group: "Trabalho", icon: "◫" },
  { label: "Estoque Editorial", href: "/editorial-stock", group: "Trabalho", icon: "▦" },
  { label: "Produção", href: "/production", group: "Trabalho", icon: "▤" },
  { label: "Aprovações", href: "/approvals", group: "Trabalho", icon: "✓" },
  { label: "Ajustes", href: "/adjustments", group: "Trabalho", icon: "✎" },
  { label: "Configurações", href: "/settings", group: "Admin", icon: "⚙" },
];

export const NAV_GROUPS = ["Trabalho", "Admin"] as const;
