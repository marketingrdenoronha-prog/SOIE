# Fase 8 — Subsistema de IA

O "cérebro" do SOIE, empacotado em `packages/ai`. Fornece: gateway multi-provedor com fallback, versionamento de prompts e agentes, memória, contexto, cache, embeddings, RAG, Knowledge Base, prompt builder/validator e controle de custos.

## 8.1 AI Gateway (abstração multi-provedor)

Interface única sobre **OpenAI, Anthropic (Claude), Gemini e DeepSeek**.

```ts
interface AIGateway {
  complete(req: CompletionRequest): Promise<CompletionResult>   // chat/completions
  embed(req: EmbeddingRequest): Promise<EmbeddingResult>
  stream(req: CompletionRequest): AsyncIterable<Chunk>
}
```

- **Adapters por provedor** normalizam parâmetros, tool-calling e formato de resposta.
- **BYOK**: usa a chave da org (cifrada em `settings`) quando disponível; senão, a chave da plataforma (com medição para cobrança).
- **Toda chamada grava `ai_executions`** (tokens, custo, latência, provider, model, cache_hit, fallback).
- **Timeouts, retries e circuit breaker** por provedor.

## 8.2 Roteamento e fallback entre modelos

- **Política de modelo por tarefa** (`model_policy` em `agent_versions` e nas Settings): cada tipo de trabalho tem um modelo preferido por qualidade/custo (ex.: pesquisa densa → modelo forte; classificação simples → modelo barato).
- **`model: "auto"`** deixa o roteador escolher pela política + orçamento restante (CostGuard).
- **Cadeia de fallback**: se o provedor preferido falha (erro, rate limit, timeout), tenta o próximo da cadeia configurada. O `ai_executions` registra `fallback_from` para auditoria.
- **Degradação**: se todos falham, o passo retorna erro tratável e o Orchestrator marca o run como `partial`.

## 8.3 Versionamento de prompts

- `prompts` (template nomeado) + `prompt_versions` (imutável, com `version`, `template`, `variables`, `validator_report`).
- A entidade aponta a **versão ativa**; execuções gravam a `prompt_version_id` usada → reprodutibilidade e A/B.
- Fluxo: editar prompt → nova versão (draft) → validar → avaliar (evals) → promover a ativa.

## 8.4 Versionamento de agentes

- `agents` + `agent_versions` (system prompt via `prompt_version`, `tools`, `model_policy`, `changelog`).
- Trocar a versão ativa é atômico; execuções antigas permanecem rastreáveis à versão que as gerou.
- Permite evoluir um agente sem quebrar histórico nem comparação de performance.

## 8.5 Memória

Camadas (Constituição: contexto antes de conteúdo):
- **Curto prazo**: contexto do run atual (passos anteriores), efêmero.
- **Longo prazo** (`memories`): fatos, preferências e decisões consolidados por escopo (`org|client|brand|project`), vetorizados para recuperação.
- **Consolidação**: ao fim de missões, um passo resume aprendizados e grava memórias com `confidence` e `expires_at`.
- **Recuperação**: o Orchestrator injeta memórias relevantes no `context` de cada agente (por escopo + similaridade).

## 8.6 Contexto (context assembly)

Para cada chamada de agente, o Orchestrator monta a janela de contexto de forma orçamentada:
1. Instruções do sistema (agent version) + DNA da marca (sempre).
2. Saídas de passos dependentes.
3. **RAG**: top-k chunks da Knowledge Base do escopo.
4. Memórias relevantes.
5. Input específico do passo.

- **Orçamento de tokens** por chamada; se exceder, prioriza por relevância e **resume** o excedente (map-reduce) em vez de truncar cegamente.
- Conteúdo externo é **delimitado e marcado como não confiável** (anti prompt-injection).

## 8.7 Cache

- **Cache de resposta**: chave = hash(`provider` + `model` + `prompt_version` + `variables` + `params`). Hit → retorna sem custo e marca `cache_hit=true`. TTL por tipo de tarefa; determinístico (temperature 0) tem cache mais agressivo.
- **Cache de embeddings**: por hash do texto → evita re-embeddar conteúdo idêntico.
- **Cache de RAG**: resultados de recuperação por (KB, query) com TTL curto.
- Invalidação por mudança de prompt/version ou de documento-fonte.

## 8.8 Embeddings

- Geração via `AIGateway.embed` (worker `embedding`, em lote).
- Armazenados em `embeddings.embedding` (`vector(1536)`), com `content`, `tokens` e `meta`.
- Índice **HNSW/IVFFlat** no pgvector, sempre filtrado por `organization_id` + `knowledge_base_id`.
- Reprocessamento quando o modelo de embedding muda (migração versionada do índice).

## 8.9 RAG (Retrieval-Augmented Generation)

Pipeline:
```
documento ─> chunking ─> embedding ─> index (pgvector)
query ─> embedding ─> busca vetorial (top-k, filtro por escopo) ─> rerank ─> contexto do agente
```
- **Chunking** com sobreposição, respeitando estrutura do documento.
- **Rerank** opcional (cross-encoder) para precisão.
- **Citações**: cada chunk recuperado carrega fonte → o agente cita (`citations`), cumprindo "pesquisa antes de opinião".
- **Escopo estrito**: recuperação nunca cruza tenants (filtro obrigatório + RLS).

## 8.10 Knowledge Base

- `knowledge_bases` por escopo (`org|client|brand|project`) com `knowledge_documents` (uploads, URLs, briefings, pesquisas).
- Estados: `pending → chunked → indexed → failed`.
- Alimenta o RAG e é a base factual dos agentes. Gestão pela UI (módulo Clientes/IA).

## 8.11 Prompt Builder

- Monta o prompt final a partir de: template (`prompt_version`) + variáveis validadas (schema) + contexto assemblado (8.6).
- Suporta blocos condicionais, few-shot examples da biblioteca e formatação por provedor (chat vs. completon).
- Saída inspecionável (o prompt final é logado por referência em `ai_executions.request_ref`).

## 8.12 Prompt Validator

- Antes de promover uma versão de prompt: verifica variáveis obrigatórias, tamanho estimado (orçamento), presença de instruções anti-injection, e roda **evals** (conjunto de casos com métricas/rubricas).
- Gera `validator_report` armazenado na `prompt_version`. Reprova versões que regridem em relação à ativa.

## 8.13 Controle de custos (CostGuard)

Peça central (liga-se à Fase 1.17 e ao Billing):
- **Precificação**: `ai_price_book` (preço por 1k tokens, por modelo/provedor, com vigência) calcula `cost_usd` de cada execução.
- **Orçamentos**: teto por org, por projeto e por missão. Antes de cada chamada, o CostGuard verifica orçamento restante.
- **Ações**: avisar ao aproximar do teto; **bloquear ou exigir aprovação** ao estourar; preferir modelo mais barato quando o orçamento aperta (roteamento sensível a custo).
- **Medição**: agrega em `usage_records` para cotas de plano e faturamento por uso (Stripe).
- **Transparência**: custo estimado exibido na UI antes de confirmar ações caras; relatórios de custo por período/agente/modelo.

## 8.14 Segurança e governança de IA

- Chaves de provedor cifradas (envelope encryption); nunca em log/front.
- Conteúdo externo tratado como não confiável; ferramentas dos agentes com permissões escopadas.
- **Auditoria total**: cada execução é rastreável a agente+versão, prompt+versão, modelo, custo e run.
- **Reprodutibilidade**: com a versão de prompt/agente e o input, uma execução pode ser re-simulada.
- **Evals no CI**: mudanças em prompts/agentes passam por suíte de avaliação antes do merge, com teto de custo.

## 8.15 Resumo dos contratos-chave de IA

| Contrato | Onde vive | Papel |
|----------|-----------|-------|
| `CompletionRequest/Result` | `packages/ai` | Interface do gateway |
| `AgentRequest/Response` | `packages/contracts` | Protocolo Orchestrator ↔ Agente (Fase 4.4) |
| `ModelPolicy` | agent_versions / settings | Escolha e fallback de modelo |
| `PromptTemplate + variables_schema` | prompts | Prompt builder/validator |
| `VectorStore` | `packages/ai` | Abstração pgvector → Qdrant |
| `CostGuardPolicy` | settings / billing | Orçamentos e bloqueios |
