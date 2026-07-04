# Fase 5 — Fluxo End-to-End

O caminho completo do usuário, do cadastro à exportação, com os estados de `projects` e os gatilhos de orquestração.

## 5.1 Fluxo macro

```
Cadastro ─> Onboarding ─> Pesquisa ─> Cliente ─> Mercado ─> Concorrência ─>
Persona ─> Linguagem ─> Estratégia ─> Linha Editorial ─> Calendário ─>
Conteúdo ─> Aprovação ─> Exportação
```

Cada etapa mapeia para um estado do projeto, uma ou mais missões do Orchestrator (Fase 4) e artefatos no banco (Fase 2).

## 5.2 Etapas detalhadas

| # | Etapa | Estado do `project` | Gatilho | Missão / Ação | Artefatos gerados |
|---|-------|---------------------|---------|---------------|-------------------|
| 1 | **Cadastro** | — | Usuário cria conta e organização | Seed do tenant (papéis, biblioteca base, settings) | `organizations`, `memberships` |
| 2 | **Onboarding** | `onboarding` | Cria cliente + marca + projeto; preenche briefing e sobe documentos | Indexação na KB; Agente **Cliente** consolida contexto | `clients`, `brands`, `projects`, `briefings`, `knowledge_documents` |
| 3 | **Pesquisa** | `research` | Botão "Iniciar pesquisa" | Missão `research`: conectores + Agentes **Mercado/Concorrência/Persona/Linguagem** | `researches`, `orchestration_run` |
| 4 | **Cliente** | `research` | (dentro da pesquisa) | Agente **Cliente** estrutura negócio/proposta | contexto de negócio |
| 5 | **Mercado** | `research` | (paralelo) | Agente **Mercado** | `market_analyses`, `trends`, `news_items` |
| 6 | **Concorrência** | `research` | (paralelo) | Agente **Concorrência** | `competitors`, benchmark |
| 7 | **Persona** | `research` | depende de Cliente | Agente **Persona** | `personas`, `pains`, `objections`, `desires` |
| 8 | **Linguagem** | `research` | depende de audiência | Agente **Linguagem** | `brand_voices`, `vocabularies`, `archetypes` |
| 9 | **Estratégia** | `strategy` | Pesquisa aprovada | Missão `strategy`: Agente **Planejamento** + **Crítico** | `editorial_strategies` |
| 10 | **Linha Editorial** | `strategy` | (segue estratégia) | Agente **Planejamento** | `editorial_lines`, `categories`, `themes`, `content_ideas` |
| 11 | **Calendário** | `production` | Linha editorial aprovada | Missão `calendar`: Agente **Calendário** + **Crítico** | `calendars`, `calendar_entries` |
| 12 | **Conteúdo** | `production` | Item do calendário / botão gerar | Missão `content`: **Copy → SEO → Social → Avaliador → Crítico** | `contents`, `copies`, `posts` |
| 13 | **Aprovação** | `review` | Conteúdo pronto | Workflow de `approvals` (humano) | `approvals` |
| 14 | **Exportação** | `done` | Aprovado | Worker `export` gera PDF/CSV/deck; opcional publish/integração | `reports`, `files`, `posts.published` |

## 5.3 Máquina de estados do projeto

```
onboarding ──> research ──> strategy ──> production ──> review ──> done
     │             │            │            │            │
     └─────────────┴────────────┴────────────┴────────────┴──> archived (a qualquer momento)
```

Regras:
- Avançar de `research` para `strategy` exige pesquisa com confiança mínima **ou** confirmação explícita do usuário (quando há lacunas de dados).
- `review` pode voltar para `production` em "changes requested".
- Transições são registradas em `audit_logs`.

## 5.4 Gatilhos e natureza (síncrono × assíncrono)

- **Síncronos** (resposta imediata): CRUD de cadastro, edição manual, navegação, aprovações.
- **Assíncronos** (job + progresso): toda etapa que envolve IA ou conectores (3, 5–12). O front recebe `jobId`, assina o WebSocket e mostra progresso passo a passo do DAG.
- **Recorrentes** (cron/scheduler): re-pesquisa de tendências, atualização de concorrentes, digests, agregação de custos.

## 5.5 Ciclo de feedback e melhoria contínua

O fluxo não é linear-único: resultados de performance (posts publicados → métricas) retroalimentam:
- **Memória** (`memories`): decisões e aprendizados por marca/projeto.
- **Insights** no Dashboard: o Agente Planejamento sugere ajustes na linha editorial.
- **Rubricas**: o que performou informa o Avaliador em execuções futuras.

Isso fecha o ciclo científico da Constituição (confirmar/refutar hipóteses) sobre dados reais.

## 5.6 Estados de erro e degradação

- Conector externo indisponível → a etapa segue com dados parciais e marca `confidence: low`, sinalizando lacunas (não bloqueia o fluxo).
- Provedor de IA falha → fallback entre modelos (Fase 8); se todos falham → run `partial`, usuário decide re-tentar.
- Estouro de orçamento (CostGuard) → pausa a missão e pede aprovação de gasto.
