# Fase 7 — Estrutura do Backend

Arquitetura em camadas com NestJS, seguindo Clean Architecture pragmática: o domínio não conhece o framework; a infraestrutura (Prisma, Redis, provedores de IA) fica nas bordas.

## 7.1 Camadas e fluxo de uma requisição

```
HTTP/WS ─> Middleware ─> Controller ─> Use Case ─> Domain Service ─> Repository ─> DB
                              │            │
                          (DTO in)     (Entities / VOs)
                              │            │
                          (DTO out) <── (resultado)              Events ─> Queue ─> Worker
```

- **Controller**: adapta HTTP/WS; valida DTO (Zod); chama um Use Case. Sem lógica de negócio.
- **Use Case**: orquestra um caso de uso (transação, autorização, chamadas a serviços e repositórios). Um caso de uso = uma intenção do usuário.
- **Domain Service / Entity**: regras de negócio puras (ex.: transição de estado do projeto, cálculo de custo).
- **Repository**: acesso a dados, esconde o Prisma; sempre recebe `TenantContext`.
- **Events / Workers**: efeitos assíncronos (IA, e-mail, export) fora do request.

## 7.2 Estrutura de um módulo (bounded context)

```
apps/api/src/modules/editorial/
├── editorial.module.ts
├── controllers/
│   ├── editorial-line.controller.ts
│   └── calendar.controller.ts
├── use-cases/
│   ├── create-editorial-line.use-case.ts
│   ├── generate-calendar.use-case.ts        # dispara job de IA
│   └── approve-content.use-case.ts
├── services/
│   ├── editorial-line.service.ts
│   └── calendar.service.ts
├── repositories/
│   ├── editorial-line.repository.ts
│   └── calendar.repository.ts
├── entities/                                 # ou em packages/domain
│   └── editorial-line.entity.ts
├── dtos/
│   ├── create-editorial-line.dto.ts          # schema Zod + tipo
│   └── ...
├── events/
│   └── content-approved.event.ts
└── editorial.errors.ts
```

Repetido para cada domínio da Fase 1 (identity, clients, market, audience, brand, editorial, library, ai, billing, platform).

## 7.3 Controllers

- Um controller por recurso; rotas REST versionadas (`/api/v1/...`).
- Responsabilidades: autenticação (guard), extração do `TenantContext`, validação de DTO, mapeamento de erros → HTTP.
- Endpoints de IA retornam `202 { jobId }`; nunca bloqueiam no LLM.

## 7.4 Services

- **Domain Services**: regras que não pertencem a uma única entidade (ex.: `EditorialLineService.deriveFromStrategy`).
- **Application Services** (plataforma): `AuthService`, `RbacService`, `NotificationService`, `BillingService`, `SecretsService`, `UsageMeteringService`.
- Serviços são injetáveis (DI do Nest), testáveis isoladamente.

## 7.5 Repositories

- Interface no domínio (`EditorialLineRepository`), implementação Prisma na infra.
- **Toda query recebe e aplica `organization_id`** (defesa em profundidade com RLS).
- Sem lógica de negócio; apenas persistência e mapeamento entidade ↔ registro.
- Transações expostas via unit-of-work para use cases que escrevem em várias tabelas.

## 7.6 Use Cases

- Um arquivo por caso de uso, com método `execute(input, ctx)`.
- Fazem: autorização (CASL), validação de invariantes, orquestração de serviços/repos, emissão de eventos, retorno do DTO.
- São o ponto natural de teste de comportamento (dado X, então Y).

## 7.7 Entities e Value Objects

- **Entities**: objetos de domínio com identidade e regras (ex.: `Project` com máquina de estados; `AIExecution` com cálculo de custo).
- **Value Objects**: `Money`, `Confidence`, `FunnelStage`, `Email`, `TenantId` — imutáveis, com validação no construtor.
- Ficam em `packages/domain`, sem dependência de framework.

## 7.8 DTOs

- Definidos com **Zod** em `packages/contracts`, compartilhados entre API e Web (tipos ponta a ponta).
- DTO de entrada valida e sanitiza; DTO de saída controla o que sai (nunca expõe segredos/campos internos).
- Versionados junto com a API.

## 7.9 Middlewares e Guards

- **RequestContext**: gera `traceId`, popula `TenantContext` (org, user, roles) e o logger com esses campos.
- **AuthGuard**: valida JWT/refresh e API keys.
- **RbacGuard / PolicyGuard**: CASL por recurso.
- **RateLimit**: token bucket por tenant/usuário (Redis).
- **Idempotency**: cache de `Idempotency-Key` para POSTs que disparam jobs.
- **ErrorFilter**: converte exceções de domínio em envelope `{ error }` com `traceId`.

## 7.10 Workers

- Entrypoint `apps/worker` consome filas BullMQ (Fase 1.8). Reusa os mesmos use cases/serviços de domínio — a lógica não é duplicada.
- Um processor por fila: `AiOrchestrationProcessor`, `AiAgentProcessor`, `ConnectorProcessor`, `EmbeddingProcessor`, `ExportProcessor`, `EmailProcessor`, `BillingProcessor`.
- Cada processor: valida payload, executa, persiste, emite evento de progresso, trata erro (retry/fallback/DLQ).

## 7.11 Queues

- Definição centralizada de filas, prioridades e políticas de retry em `packages/ai` (para IA) e `packages/config`.
- Produtores (use cases) só conhecem a interface `QueueService.enqueue(queue, payload, opts)`.
- Observabilidade: métricas de profundidade, latência e falha por fila (Prometheus).

## 7.12 Cron Jobs (scheduler)

- Processo `scheduler` com lock de líder (Redlock) para não duplicar em réplicas.
- Jobs: re-pesquisa de tendências, atualização de concorrentes, agregação diária de `usage_records`/custos, expiração de memórias, limpeza de uploads órfãos, digests de notificação, verificação de assinaturas Stripe.
- Cada cron apenas **enfileira** trabalho; a execução acontece nos workers.

## 7.13 Events

- **Domain events** internos (ex.: `ContentApproved`, `ResearchCompleted`, `BudgetThresholdReached`) via event bus (in-process no início; NATS/Redis Streams quando distribuir).
- Consumidores: notificações, auditoria, medição de uso, disparo de próximos passos do fluxo (Fase 5).
- Desacopla efeitos colaterais do caminho principal.

## 7.14 Webhooks

- **Entrada**: Stripe (billing), provedores de dados externos, integrações de publicação. Verificação de assinatura (HMAC), idempotência por `event_id`, fila para processamento.
- **Saída**: webhooks do tenant (ex.: "conteúdo aprovado") com retry e assinatura, configuráveis nas Settings.

## 7.15 Tratamento de erros e validação

- Erros de domínio tipados (`DomainError` → código estável); nunca vazar stack para o cliente.
- Validação nos limites (DTO) + invariantes no domínio; falha cedo, com mensagem acionável.
- Correlação por `traceId` em log, resposta e Sentry.

## 7.16 Testes

- **Unitários**: domínio e use cases (rápidos, sem I/O).
- **Integração**: repositórios contra Postgres de teste (Testcontainers); processors de fila.
- **Contrato**: schemas Zod garantem API ↔ Web e Orchestrator ↔ Agentes.
- **E2E**: fluxos críticos (onboarding → pesquisa → conteúdo) com IA mockada.
- **Avaliação de IA**: suíte de "evals" para prompts/agentes (Fase 8), rodada no CI com custo controlado.
