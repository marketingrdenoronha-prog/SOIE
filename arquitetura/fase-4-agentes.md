# Fase 4 — Sistema de Agentes

Implementa a **Hierarquia Interna** da Constituição: um conselho executivo onde nenhum especialista trabalha sozinho e toda decisão passa por compreensão → pesquisa → análise → síntese → crítica → refino → aprovação. Cada agente é **independente** e se comunica **através de um Orchestrator**.

## 4.1 Princípios do sistema de agentes

1. **Agente = unidade autônoma** com papel, contrato de I/O (schema), política de modelo e ferramentas próprias. Não chama outro agente diretamente — só o Orchestrator coordena.
2. **Contrato antes de conversa**: cada agente declara `inputSchema` e `outputSchema` (Zod). O Orchestrator valida entradas e saídas.
3. **Sem estado oculto**: o contexto que um agente precisa é montado pelo Orchestrator (via RAG/memória), não guardado no agente.
4. **Tudo é execução rastreável**: cada chamada de agente gera `ai_executions` (custo/tokens) e faz parte de um `orchestration_run`.
5. **Confiança explícita**: todo output carrega `confidence` e `missing_data[]` (Princípio 8 da Constituição).

## 4.2 Catálogo de agentes

| Agente | `key` | Responsabilidade | Entrada principal | Saída principal |
|--------|-------|------------------|-------------------|-----------------|
| **Cliente** | `client` | Consolidar contexto do negócio a partir de briefing/documentos | briefing, arquivos | contexto do negócio estruturado |
| **Mercado** | `market` | Analisar tamanho, tendências, oportunidades, ameaças | dados de conectores | `market_analyses` |
| **Concorrência** | `competition` | Mapear e analisar concorrentes | domínio, dados coletados | `competitors`, benchmark |
| **Persona** | `persona` | Construir personas com dores/objeções/desejos | audiência + negócio | `personas` + itens |
| **Linguagem** | `language` | Extrair DNA verbal e linguagem da audiência | comentários, marca | `brand_voices`, `vocabularies` |
| **Copy** | `copy` | Redigir peças/variações usando frameworks e DNA | tema, DNA, framework | `contents`/`copies` |
| **SEO** | `seo` | Otimizar para busca (keywords, estrutura) | tema, conteúdo | recomendações + metadados |
| **Social Media** | `social` | Adaptar por plataforma, definir formato/cadência | conteúdo, plataforma | `posts` |
| **Calendário** | `calendar` | Distribuir temas no tempo respeitando funil/cadência | linha editorial, período | `calendar_entries` |
| **Avaliador** | `evaluator` | Pontuar qualidade/aderência de saídas (rubrica) | saída de outro agente | score + gaps |
| **Crítico** | `critic` | Autocrítica adversarial (Seção 9 da Constituição) | qualquer artefato | objeções, riscos, correções |
| **Planejamento** | `planning` | Sintetizar estratégia e linha editorial | mercado+audiência+DNA | `editorial_strategies`, `editorial_lines` |
| **Orchestrator** | `orchestrator` | Coordenar o pipeline (não é um LLM-agente; é o motor) | missão | `orchestration_run` |

Os agentes têm definição no banco (`agents` + `agent_versions`) e são versionados (Fase 8). Os do sistema vêm no seed; a org pode sobrescrever config e prompt.

## 4.3 O Orchestrator

O Orchestrator é o motor que executa uma **missão** (um `orchestration_run`) como um **DAG de passos**. Cada passo invoca um agente. Ele:

1. **Resolve o pipeline** a partir do `kind` da missão (ver 4.5).
2. **Monta o contexto** de cada passo: puxa memória (`memories`), faz RAG na Knowledge Base, injeta DNA da marca e saídas de passos anteriores.
3. **Chama o agente** via `AgentRunner` (que fala com o `AI Gateway`), respeitando a política de modelo e o `CostGuard`.
4. **Valida a saída** contra o `outputSchema`; se inválida, re-tenta com feedback (self-heal) até N vezes.
5. **Aplica o loop de qualidade**: passos de produção são seguidos por **Avaliador** e **Crítico**; se abaixo do limiar, re-executa com as correções (refino).
6. **Persiste** artefatos nas entidades de domínio e o custo em `ai_executions`.
7. **Emite eventos** de progresso (WebSocket) e trata falhas (retry/fallback/partial).

### Modo de execução

- Passos **independentes rodam em paralelo** (ex.: Mercado e Concorrência); passos **dependentes** aguardam (Persona depende de Cliente).
- Cada passo é um **job BullMQ** na fila `ai:agent`; o run é coordenado na fila `ai:orchestrate`.
- **Idempotência**: reexecutar um run parte do último passo bem-sucedido (checkpoint em `orchestration_runs.steps`).

## 4.4 Protocolo de mensagens (contrato Orchestrator ↔ Agente)

```jsonc
// Requisição para um agente
{
  "runId": "uuid",
  "step": "persona",
  "agentKey": "persona",
  "agentVersion": 3,
  "context": {
    "business": { /* saída do Agente Cliente */ },
    "audienceSignals": { /* dados coletados */ },
    "brandVoice": { /* DNA */ },
    "retrieved": [ /* chunks de RAG com fonte */ ],
    "memories": [ /* fatos consolidados */ ]
  },
  "input": { /* validado por inputSchema do agente */ },
  "constraints": { "maxCostUsd": 0.50, "model": "auto", "locale": "pt-BR" }
}
```

```jsonc
// Resposta do agente
{
  "runId": "uuid",
  "step": "persona",
  "status": "ok",              // ok | needs_more_data | error
  "output": { /* validado por outputSchema */ },
  "confidence": "medium",       // high | medium | low
  "missingData": ["dados de idade da audiência"],
  "rationale": "por que estas personas...",   // Princípio 7: justificativa
  "citations": [{ "source": "doc:123", "quote": "..." }],
  "usage": { "provider": "anthropic", "model": "...", "inputTokens": 0, "outputTokens": 0, "costUsd": 0 }
}
```

- **`rationale` e `citations` são obrigatórios** em saídas estratégicas — refletem os princípios da Constituição (justificativa + pesquisa antes de opinião).
- Conteúdo externo no `context.retrieved` é **delimitado e tratado como não confiável** (defesa contra prompt injection).

## 4.5 Pipelines por tipo de missão

**Missão: Pesquisa completa (`kind=research`)**
```
[Cliente] ──┬──> [Mercado] ─────┐
            └──> [Concorrência] ─┼──> [Avaliador] ──> [Crítico] ──> consolida market_analyses
      (Persona e Linguagem em paralelo com Mercado)
            ├──> [Persona] ──────┤
            └──> [Linguagem] ────┘
```

**Missão: Estratégia + Linha Editorial (`kind=strategy`/`editorial_line`)**
```
(usa saídas de research) ──> [Planejamento] ──> [Crítico] ──> [Avaliador]
                                    └── refino se score < limiar ──┘
                          => editorial_strategies + editorial_lines + categories + themes
```

**Missão: Calendário (`kind=calendar`)**
```
[Calendário] (distribui themes no período, respeita funil/cadência) ──> [Crítico] ──> calendar_entries
```

**Missão: Conteúdo (`kind=content`)**
```
[Copy] ──> [SEO] ──> [Social] ──> [Avaliador] ──> [Crítico]
   └────────── refino (loop até aprovar ou N tentativas) ──────────┘
                => contents + copies + posts
```

Em todos, o par **Avaliador + Crítico** implementa o mecanismo de autocrítica antes de entregar (Seção 9 da Constituição).

## 4.6 Ferramentas (tools) dos agentes

Agentes podem invocar ferramentas expostas pelo runner (function calling):
- `search_knowledge(query)` → RAG na KB do escopo.
- `get_memory(scope)` → fatos consolidados.
- `fetch_connector(source, params)` → dados externos (só agentes de pesquisa; assíncrono).
- `save_artifact(type, payload)` → persistir saída estruturada.
- `score_rubric(artifact, rubric)` → usado pelo Avaliador.

Cada tool tem schema, é auditada em `ai_executions.request_ref` e respeita permissões do tenant.

## 4.7 Qualidade, avaliação e refino

- **Rubricas** por tipo de artefato (ex.: persona: especificidade, evidência, acionabilidade; copy: aderência ao DNA, gancho, CTA, originalidade).
- **Avaliador** pontua (0–100) por critério; **Crítico** gera objeções adversariais ("isso serviria para qualquer empresa?" — Seção 9).
- **Limiar** configurável por org; abaixo dele → refino automático com o feedback anexado.
- **Limite de refinos** para conter custo; se não atingir o limiar, entrega com `confidence: low` e lista de lacunas em vez de forçar.

## 4.8 Observabilidade dos agentes

Cada passo emite: início/fim, tokens, custo, modelo usado, fallback aplicado, score do Avaliador, veredito do Crítico. Tudo visível no módulo **IA** (Fase 3.10) e em métricas (taxa de refino, custo médio por missão, agentes com mais falha).
