# Relatório de Migração — SOIE V1 → V2

> Entregável obrigatório do plano de migração. Documenta o que a V2 manteve,
> removeu e unificou, o novo fluxo operacional, as mudanças de banco/rotas e o
> impacto na experiência do operador.

## 1. Visão geral

A V1 era uma "agência editorial completa": ~14 módulos independentes, hierarquia
`Cliente → Marca → Projeto` exposta na UI, e o operador precisava percorrer 5+
telas na ordem certa para produzir 1 peça (virava um Social Media manual).

A V2 muda o eixo para um **fluxo linear único**, cliente-cêntrico. O operador
executa poucas ações manuais; o resto é automático. O ativo da plataforma é o
**conhecimento acumulado por cliente**: cada nova linha editorial evolui a
comunicação a partir de TODO o histórico, sem reiniciar do zero.

A migração foi entregue em fases com deploy independente:

- **Fase 1** — Onboarding + Dossiê Estratégico + colapso da hierarquia (cliente-cêntrico), com auto-provisionamento de Brand/Project default.
- **Fase 2** — Linha editorial versionada + aprovação pública do cliente + histórico/anti-repetição.
- **Fase 3** — Produção automática (`produce-all`), vínculo Theme→Deliverable, Kanban e entrega final (`delivered`).
- **Fase 4** — Consolidação da UI (remoção das telas V1 superadas) + este relatório.

## 2. Funcionalidades mantidas e justificativa

| Peça | Situação na V2 | Razão |
|---|---|---|
| Assembler de contexto (`server/project-context.ts`) | Mantido e ampliado | Ponto único que alimenta os agentes; ganhou `framework`, `editorialHistory`, `contentMemory`, repertório do cliente inteiro |
| Runtime de IA serverless (`server/ai-runtime.ts`) | Mantido | `runAgent`/`produceInline` são o motor de toda geração |
| Gateway multi-provider (`packages/ai/gateway/*`) | Mantido | Fallback entre provedores + stubs offline |
| Producer de peça (`packages/ai/deliverables/*`) | Mantido | Pipeline specialist→evaluator→critic reusado no `produce-all` |
| Revisão pública com token (`public/review/[token]/*`) | Mantido | Padrão replicado para aprovação editorial |
| Aprovar/regenerar deliverable | Mantido | Reusado no Kanban da Fase 3 |
| Memória curada (`Memory` + `/memory`) | Mantido | Continua injetada como "regras obrigatórias"; framework mora aqui |
| Notificações (`/api/v1/notifications`) | Mantido | Alimenta o sino; aprovação editorial notifica a equipe |
| Renderer de spec (`components/spec-view.tsx`) | Mantido | Renderiza roteiros no Kanban, com ErrorBoundary |
| `lib/render.ts` (`text`/`arr`) | Mantido | Renderização tolerante do JSON da IA |
| Tabelas de dados V1 (MarketAnalysis, Persona, BrandVoice, Competitor, etc.) | Mantidas | Populadas automaticamente pela pesquisa; alimentam o contexto |
| Rotas de API V1 (`/market`, `/personas`, `/brand-dna`, `/editorial`, `/library`, `/calendar`, `/reports`, `/import`) | Mantidas em disco | Sem consumo de UI, mas preservadas por compatibilidade/dados; sem custo de runtime |

## 3. Funcionalidades removidas e justificativa

**Telas (UI) removidas na Fase 4** — cada uma foi absorvida pela automação do fluxo:

| Tela removida | Absorvida por |
|---|---|
| `(app)/market` | Pesquisa automática no onboarding → Dossiê Estratégico |
| `(app)/audience` | Geração de persona no onboarding → Dossiê |
| `(app)/brand-dna` | Extração de voz da marca no onboarding → Dossiê |
| `(app)/library` | Repertório/biblioteca agora é contexto da IA, não tela |
| `(app)/reports` | Métricas não faziam parte do fluxo linear (trilha futura) |
| `(app)/ai` | Página estática/decorativa, sem valor operacional |
| `(app)/calendar` | Fora do fluxo linear atual (trilha futura: ligar ao `Content`) |
| `(app)/import` | Importação passa a ser via script/seed, fora da UI diária |

As **rotas de API correspondentes foram preservadas** (dead code reversível, sem
custo de runtime) para não arriscar regressões e manter os dados acessíveis à IA.
A navegação lateral já havia sido reduzida na Fase 1 a **Dashboard, Clientes,
Configurações**.

## 4. Funcionalidades unificadas

- **Pesquisa (Mercado + Concorrência + Persona + Voz da Marca)** → viraram um único passo automático dentro do **Onboarding → Dossiê Estratégico**.
- **Linha Editorial + Aprovação + Histórico** → uma aba dentro do detalhe do Cliente, com versionamento (`V1 → V2 → …`) e link público de aprovação.
- **Produção de peças** → 1 clique (`produce-all`) a partir da linha editorial aprovada, com Kanban por status dentro do Cliente.
- **Hierarquia Cliente→Marca→Projeto** → colapsada para `Cliente` na UI; Brand/Project viram defaults auto-provisionados internamente (`server/client-scope.ts`).

## 5. Novo fluxo operacional (linear)

```
[Operador] Cadastra Cliente            → auto-provisiona Brand/Project default
[Operador] Completa Onboarding (wizard)
[Auto]     Pesquisa (market/competition/persona/language) + Dossiê Estratégico
[Operador] Gera Linha Editorial (Vn)   → agente "planning" com histórico + anti-repetição
[Operador] Envia para aprovação        → link público /editorial-review/:token
[Cliente]  Aprova ou pede ajuste       → aprovado seta Client.activeStrategyId
[Operador] "Produzir todos"            → 1 peça por tema (Theme↔Deliverable), concorrência 3
[Operador] Aprova interno → cliente    → link público /review/:token
[Cliente]  Aprova a peça
[Operador] "Marcar entregue"           → status=delivered, deliveredAt
[Loop]     Nova Linha Editorial evolui a partir de TODO o histórico
```

## 6. Modelo de dados — diff

**Novos models (adicionados nas fases anteriores):** `StrategicOnboarding`,
`StrategicDossier`, `EditorialReviewLink`, `EditorialReviewComment`.

**Alterações em models existentes:**
- `Client`: `activeStrategyId`, relações `onboarding`, `dossiers`.
- `EditorialStrategy`: `clientId`, `version`, `parentStrategyId`, `submittedAt`, `approvedAt`, `changesRequestedAt`, transições de `status` (`draft → pending_client → approved | changes_requested`), relações de review.
- `Theme`: `channel`, `format`, `deliverableId` (FK 1:1 para a peça produzida).
- `Deliverable`: `themeId`, `deliveredAt`.

**Nenhum drop.** Tabelas de módulos descontinuados permanecem no schema.

## 7. Alterações de rotas e componentes (Fase 4)

**Removido (UI):** `apps/web/src/app/(app)/{market,audience,brand-dna,library,reports,ai,calendar,import}/`.

**Mantido e ainda ativo na V2:** `(app)/clients/[id]/*` (onboarding, dossiê,
editorial, produção), `(app)/deliverables`, `(app)/editorial`, `(app)/memory`,
`(app)/dashboard`, `(app)/settings`, e todas as rotas `api/v1/*`.

**Pontos de entrada principais do fluxo V2:**
- `apps/web/src/app/(app)/clients/[id]/client-detail.tsx` — abas do cliente.
- `apps/web/src/app/api/v1/clients/[id]/editorial-strategies/route.ts` — versões.
- `apps/web/src/app/api/v1/editorial-strategies/[id]/submit/route.ts` — envio p/ aprovação.
- `apps/web/src/app/api/v1/public/editorial-review/[token]/*` — aprovação pública.
- `apps/web/src/app/api/v1/editorial-strategies/[id]/produce-all/route.ts` — produção em lote.
- `apps/web/src/app/api/v1/deliverables/[id]/deliver/route.ts` — entrega final.
- `apps/web/src/server/project-context.ts` — contexto/anti-repetição.

## 8. Impacto na experiência do usuário (before/after)

| Métrica | V1 | V2 |
|---|---|---|
| Telas visitadas p/ produzir 1 peça | 5+ (Mercado, Audiência, DNA, Editorial, Entregas) | 1 (detalhe do Cliente) |
| Ações manuais até a produção | selecionar projeto e disparar cada módulo, tema a tema | Onboarding → Gerar linha → Aprovar → "Produzir todos" |
| Decisão estratégica | manual, repetida por peça | automática, baseada no histórico acumulado |
| Anti-repetição entre campanhas | inexistente | `contentMemory` de temas/categorias aprovados no prompt |
| Navegação | ~10 módulos no menu | 3 destinos (Dashboard, Clientes, Configurações) |

## 9. Próximas melhorias recomendadas

1. **Relocar a Memória** para uma aba dentro do Cliente e então remover a página `(app)/memory` de topo.
2. **Remover as rotas de API V1** de fato (após confirmar zero consumo em produção com smoke test por `curl`).
3. **RLS no fluxo web** (hoje só no `apps/api` NestJS) como backstop de tenant.
4. **Contrato Zod runtime** para o mapeamento Theme→Deliverable (`channel`/`format`).
5. **Streaming de progresso (SSE)** no Kanban durante `produce-all`.
6. **Ligar o model `Content`** como camada de post agendado + métricas pós-publicação (reaproveita o antigo Calendário).
