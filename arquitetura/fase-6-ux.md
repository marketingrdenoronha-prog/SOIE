# Fase 6 — UX e Navegação

Design system: TailwindCSS + shadcn/ui + Radix, dark mode nativo, acessível (WCAG AA). App shell com sidebar fixa, topbar com contexto de tenant/projeto e área de conteúdo.

## 6.1 Estrutura de navegação (app shell)

```
┌────────────────────────────────────────────────────────────────┐
│ Topbar: [Org ▾] [Cliente ▾] [Projeto ▾]   🔍 busca global  🔔 👤 │
├───────────┬────────────────────────────────────────────────────┤
│ Sidebar   │  Breadcrumb: Org / Cliente / Projeto / Módulo        │
│           │                                                      │
│ Dashboard │  ┌──────────────────────────────────────────────┐   │
│ Clientes  │  │                                              │   │
│ Mercado   │  │             Área de conteúdo                 │   │
│ Audiência │  │        (cards, tabelas, editores)            │   │
│ DNA       │  │                                              │   │
│ Biblioteca│  └──────────────────────────────────────────────┘   │
│ Linha Ed. │                                                      │
│ Calendário│                                                      │
│ IA        │                                                      │
│ Relatórios│                                                      │
│ Config    │                                                      │
└───────────┴────────────────────────────────────────────────────┘
```

## 6.2 Sidebar

- **Navegação primária** pelos módulos da Fase 3, com ícones e agrupamento (Trabalho / Inteligência / IA / Admin).
- **Colapsável** (ícones apenas) para telas menores.
- **Indicadores**: badge de aprovações pendentes, ponto de "execução em andamento".
- **Seletor de contexto** no topo (org → cliente → projeto) define o escopo de tudo.

## 6.3 Seletor de contexto (tenant/cliente/projeto)

Componente crítico no multi-tenant: três dropdowns encadeados na topbar. Trocar a organização reemite o token (novo escopo/RBAC); trocar cliente/projeto refiltra o app. O contexto atual é persistido por usuário e refletido no breadcrumb e nas URLs (`/o/:org/c/:client/p/:project/...`).

## 6.4 Dashboard e cards

- **Cards de KPI** (número + tendência + sparkline): projetos ativos, conteúdos por status, custo de IA no mês vs. orçamento, aprovações pendentes.
- **Card de custo de IA** com barra de orçamento e alerta quando próximo do teto.
- **Feed de últimas execuções** (status, custo, confiança) com link para o detalhe.
- **Cards de insight** gerados por IA, acionáveis (ex.: "gerar linha editorial para a persona X").
- Padrão visual de charts segue o guia de dataviz (paleta acessível, legível em light/dark).

## 6.5 Modais e drawers

- **Modais** para ações focadas: criar cliente/projeto, iniciar pesquisa, confirmar gasto de IA, convidar membro.
- **Drawers laterais** para detalhe sem perder contexto: ver execução de IA, editar persona, revisar conteúdo.
- **Command palette** (⌘K) para navegação e ações rápidas.
- Toda ação de IA mostra **estimativa de custo** antes de confirmar.

## 6.6 Filtros

- Barra de filtros consistente em listas (Calendário, Conteúdos, Execuções): por status, plataforma, linha editorial, responsável, período.
- Filtros refletidos na URL (compartilháveis) e persistidos como "visões salvas".

## 6.7 Busca global

- Campo na topbar (⌘K) que busca **cross-módulo** dentro do escopo atual: clientes, projetos, conteúdos, personas, itens da biblioteca.
- Backend: Postgres FTS no início → Meilisearch em escala; sempre escopado por tenant.
- Resultados agrupados por tipo, com navegação por teclado.

## 6.8 Breadcrumb

- Reflete o caminho `Org / Cliente / Projeto / Módulo / Item`, cada nível clicável.
- Sincronizado com o seletor de contexto e a URL.

## 6.9 Editor de Calendário (drag-and-drop)

- Visão **mensal** e **semanal**; arrastar `calendar_entries` entre dias/horários.
- Cores por plataforma/status; badges de linha editorial e funil.
- Ação "gerar calendário com IA" abre drawer com preview antes de aplicar.

## 6.10 Chat / Assistente de IA

- Painel de chat contextual (por projeto) para pedir ajustes, gerar variações e tirar dúvidas.
- Mostra **fonte** (citations), **custo** da resposta e permite "salvar como memória".

## 6.11 Dark mode

- Alternância clara/escura com preferência do sistema como padrão; persistida por usuário.
- Tokens de tema (cores, superfícies, bordas) definidos no design system; ambos os modos testados.

## 6.12 Notificações

- **In-app** (sino): execuções concluídas/falhas, aprovações solicitadas, teto de custo, convites.
- **E-mail** (digest e transacionais).
- **Realtime** via WebSocket para progresso de jobs; fallback para polling.
- Central de notificações com filtro lido/não lido.

## 6.13 Estados de carregamento e assíncrono

- **Skeletons** em listas e cards.
- **Progresso passo a passo** para missões de IA (mostra o DAG: Cliente ✓ → Mercado ⏳ → …).
- **Optimistic UI** em ações rápidas (drag no calendário, aprovação).
- **Empty states** instrutivos com CTA (ex.: "Nenhuma persona ainda — rode a pesquisa").
- **Estados de erro** com causa e ação (re-tentar, ver logs).

## 6.14 Responsividade

- **Desktop-first** (ferramenta de trabalho), mas responsiva: sidebar vira drawer no mobile; tabelas viram cards; calendário mensal cai para lista/semana no celular.
- Breakpoints Tailwind padrão; toque com alvos ≥ 44px.
- Ações críticas (aprovar, revisar, acompanhar execução) plenamente utilizáveis no mobile.

## 6.15 Acessibilidade

- Componentes Radix (foco, teclado, ARIA por padrão).
- Contraste AA em ambos os temas; navegação por teclado completa; `prefers-reduced-motion` respeitado.
