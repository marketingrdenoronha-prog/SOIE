# Fase 3 — Módulos do Sistema

Cada módulo é um bounded context (Fase 1) com sua própria rota, telas, serviços e agentes associados. Aqui descrevemos **o que cada módulo faz, o que mostra e o que dispara**. A navegação e os componentes de UI estão na [Fase 6](fase-6-ux.md).

Padrão comum a todos os módulos:
- **Escopo:** todo módulo opera dentro de `organização → cliente → marca → projeto` (exceto Configurações e Biblioteca, que têm escopo de org).
- **Origem do dado:** manual (usuário) ou gerado por agentes de IA (com nível de confiança e execução rastreável).
- **Ações de IA** retornam job assíncrono; a tela mostra progresso e o resultado quando pronto.

---

## 3.1 Dashboard

**Objetivo:** visão executiva do estado do trabalho e do custo de IA.

Mostra:
- **KPIs**: nº de projetos ativos, conteúdos por status, aprovações pendentes, execuções de IA no período.
- **Custos de IA**: gasto no mês por provedor/modelo/projeto, projeção vs. orçamento, alertas de teto.
- **Últimas execuções**: lista de `orchestration_runs` recentes com status, custo e confiança.
- **Status de projetos**: funil (onboarding → produção → revisão → concluído).
- **Insights**: cards gerados pelo Agente Crítico/Planejamento (ex.: "3 personas sem linha editorial", "concorrente X aumentou frequência").

Dispara: atalhos para iniciar pesquisa, criar conteúdo, revisar aprovações.

---

## 3.2 Clientes

**Objetivo:** cadastro e base de conhecimento do cliente final.

Submódulos:
- **Cadastro**: dados do cliente, indústria, site, contatos, tags, responsável.
- **Documentos / Briefings**: formulário de onboarding estruturado + upload de documentos; o Agente Cliente extrai e estrutura o briefing (`briefings.payload`).
- **Arquivos**: uploads (PDF, imagens, decks) → viram `knowledge_documents` indexáveis para RAG.
- **Marca**: tom de voz, ICP, produtos, objetivos (alimenta o DNA da Marca).

Dispara: indexação na Knowledge Base, execução do Agente Cliente para consolidar contexto.

---

## 3.3 Marca (dentro do Cliente)

**Objetivo:** capturar a proposta e os objetivos que guiam toda a estratégia.

Campos: tom de voz, ICP, produtos/serviços, objetivos de negócio, proposta de valor, diferenciais. Estes dados alimentam `brands` e são insumo obrigatório do Agente Persona e do Agente Copy.

---

## 3.4 Inteligência de Mercado

**Objetivo:** entender o mercado, concorrentes e o momento (Contexto de Mercado e Competitivo da Constituição).

Submódulos:
- **Pesquisa automática**: dispara `research` (type `market`/`full`) → conectores + Agentes Mercado/Concorrência.
- **Concorrentes**: lista, posicionamento, forças/fraquezas, estratégia de conteúdo, benchmark.
- **Benchmark**: comparação de frequência, formatos, temas e engajamento entre concorrentes.
- **Notícias**: `news_items` relevantes com sentimento.
- **Tendências**: agregador multi-fonte:
  - **Google Trends**, **Reddit**, **TikTok**, **Instagram**, **LinkedIn**, **YouTube** — cada um via conector dedicado (worker `connector`), respeitando ToS e com cache/TTL.

Saída: `market_analyses` (SWOT, oportunidades, ameaças) com nível de confiança e lacunas de dados sinalizadas.

---

## 3.5 Inteligência da Audiência

**Objetivo:** compreender profundamente quem compra (Contexto da Audiência).

Submódulos:
- **Persona**: perfil demográfico + psicográfico, canais, nível de consciência.
- **Objeções / Dores / Desejos**: mapeados e priorizados, com evidências.
- **Perguntas**: perguntas reais da audiência → pauta.
- **Comentários / Sentimento**: coleta e análise de sentimento de menções.
- **Linguagem**: como a audiência fala (insumo para o DNA da Marca e o Agente Linguagem).

Dispara: Agente Persona + Agente Linguagem sobre os dados coletados.

---

## 3.6 DNA da Marca

**Objetivo:** codificar a identidade verbal para que todo conteúdo soe como a marca (Contexto Linguístico).

Submódulos: **Vocabulário** (preferido/proibido/jargão), **Expressões**, **Tom**, **Emojis** (política), **Formalidade**, **Arquétipos**.

Saída: `brand_voices` + `vocabularies` + `archetypes`. É injetado como contexto em **todo** agente que produz texto (Copy, Social, SEO), garantindo consistência (Princípio da personalização).

---

## 3.7 Biblioteca

**Objetivo:** repositório reutilizável de estruturas de alta performance.

Submódulos: **Frameworks** (AIDA, PAS, StoryBrand…), **Hooks**, **Storytelling**, **Analogias**, **CTA**, **Scripts**, **Templates**.

Escopo: itens do sistema (seed) + itens da organização + itens por marca. Consumidos pelos agentes de copy e pela criação manual. Cada item guarda "quando usar" e exemplos.

---

## 3.8 Linha Editorial

**Objetivo:** transformar estratégia em estrutura de conteúdo.

Submódulos: **Categorias**, **Subcategorias**, **Temas**, **Microtemas**, **Objetivos** (autoridade, confiança, conversão…), **Funil** (ToFu/MoFu/BoFu), **Plataformas**.

Fluxo: `editorial_strategies` → `editorial_lines` → `categories` → `themes`. Gerado pelo Agente Planejamento a partir de mercado + audiência + DNA, revisado pelo Agente Crítico. Cada linha declara sua função estratégica (Filosofia Editorial: nenhum conteúdo sem razão de existir).

---

## 3.9 Calendário

**Objetivo:** planejar e visualizar a execução no tempo.

Recursos: visão **Mensal** e **Semanal**, **drag-and-drop** de `calendar_entries`, **filtros** (plataforma, status, linha editorial, responsável), **status** por item, geração assistida por **IA** (Agente Calendário distribui temas respeitando cadência e funil).

Saída: `calendars` + `calendar_entries` ligados a `contents`/`posts`.

---

## 3.10 IA

**Objetivo:** transparência e controle sobre o "cérebro" do sistema.

Submódulos:
- **Agentes**: catálogo, versão ativa, configuração.
- **Execuções**: `orchestration_runs` e `ai_executions` com status, DAG de passos, retries/fallback.
- **Histórico**: linha do tempo de execuções por projeto.
- **Custos / Tokens**: por execução, agente, modelo, projeto e período.
- **Logs**: eventos técnicos das execuções (erros de provedor, fallback, cache hit).

Detalhe de funcionamento na [Fase 4](fase-4-agentes.md) e [Fase 8](fase-8-ia.md).

---

## 3.11 Relatórios

**Objetivo:** consolidar resultados para o cliente e para a gestão.

Tipos: **Performance** (posts publicados, métricas), **Conteúdo** (produção por período/linha), **Pesquisa** (síntese de mercado/audiência), **IA** (custo e uso).

Recursos: geração assíncrona (worker `export`), exportação PDF/CSV/deck, agendamento recorrente.

---

## 3.12 Configurações

**Objetivo:** administração do tenant.

Submódulos:
- **Equipe**: membros, convites.
- **Permissões**: papéis e escopos (RBAC).
- **API Keys**: chaves de plataforma do tenant.
- **Chaves de IA (BYOK)**: **OpenAI**, **Claude**, **Gemini**, **DeepSeek** — armazenadas cifradas; usadas pelo AI Gateway quando a org opta por trazer suas chaves.
- **Modelos**: política de modelo por tarefa (qualidade × custo) e ordem de fallback.
- **Prompts**: gestão e versionamento de prompts da org (sobre os do sistema).
- **Geral / Notificações / Segurança**: settings por namespace.

---

## 3.13 Matriz módulo → entidades → agentes

| Módulo | Entidades principais | Agentes acionados |
|--------|----------------------|-------------------|
| Clientes | `clients, brands, briefings, files` | Cliente |
| Inteligência de Mercado | `researches, competitors, market_analyses, trends, news_items` | Mercado, Concorrência |
| Inteligência da Audiência | `personas, pains, objections, desires, sentiment_analyses` | Persona, Linguagem |
| DNA da Marca | `brand_voices, vocabularies, archetypes` | Linguagem |
| Linha Editorial | `editorial_strategies, editorial_lines, categories, themes` | Planejamento, Crítico |
| Calendário | `calendars, calendar_entries` | Calendário |
| Conteúdo | `contents, copies, posts, content_ideas` | Copy, SEO, Social, Avaliador |
| Relatórios | `reports` | Planejamento, Avaliador |
| IA / Config | `agents, prompts, ai_executions, settings` | Orchestrator |
