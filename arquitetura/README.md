# SOIE — Arquitetura da Plataforma

Este diretório contém a **engenharia completa** da plataforma SaaS SOIE (Sistema Operacional de Inteligência Editorial), produzida **antes de qualquer linha de código de aplicação**, conforme o princípio do sistema: _contexto e projeto vêm antes da execução_.

O SOIE é uma plataforma multiempresa (multi-tenant) que automatiza todo o processo de inteligência editorial com IA, projetada para atender centenas de clientes simultaneamente com custo de IA controlado e observável.

## Índice das fases

| Fase | Documento | Escopo |
|------|-----------|--------|
| 0 | [Visão geral e decisões de stack](00-visao-geral.md) | Sumário executivo, princípios de arquitetura, stack tecnológica e ADRs |
| 1 | [Engenharia do Sistema](fase-1-engenharia.md) | Arquitetura completa, camadas, serviços, filas, cache, auth, multi-tenancy, observabilidade, custos de IA, segurança, escalabilidade |
| 2 | [Modelagem do Banco de Dados](fase-2-banco-de-dados.md) | Entidades, relacionamentos, ERD, isolamento por tenant, `pgvector` |
| 3 | [Módulos do Sistema](fase-3-modulos.md) | Dashboard, Clientes, Marca, Inteligência de Mercado/Audiência, DNA, Biblioteca, Linha Editorial, Calendário, IA, Relatórios, Configurações |
| 4 | [Sistema de Agentes](fase-4-agentes.md) | Orchestrator, catálogo de agentes, protocolo de mensagens, contratos de I/O |
| 5 | [Fluxo end-to-end](fase-5-fluxo.md) | Do cadastro à exportação, máquina de estados e gatilhos |
| 6 | [UX e Navegação](fase-6-ux.md) | Sidebar, cards, modais, filtros, busca global, breadcrumb, dark mode, notificações, responsividade |
| 7 | [Estrutura do Backend](fase-7-backend.md) | Controllers, services, repositories, use cases, entities, DTOs, middlewares, workers, queues, cron, events, webhooks |
| 8 | [Subsistema de IA](fase-8-ia.md) | Versionamento de prompts/agentes, memória, contexto, cache, embeddings, RAG, KB, prompt builder/validator, fallback, custos |

## Como ler

1. Comece pela [Visão geral](00-visao-geral.md) para entender as decisões de stack e a topologia.
2. As fases 1, 2 e 7 formam o núcleo técnico (arquitetura, dados e organização do código).
3. As fases 3, 5 e 6 descrevem o produto (o que o usuário vê e faz).
4. As fases 4 e 8 detalham o "cérebro": agentes e infraestrutura de IA.

## Relação com a Constituição

A camada de produto e engenharia descrita aqui **implementa** as regras definidas na [Constituição do Sistema](../sistema/parte-1-constituicao/). As sete camadas de contexto viram entidades e módulos; a hierarquia interna de agentes vira o orquestrador; o mecanismo de autocrítica vira o Agente Crítico/Avaliador no pipeline.

> **Status de entrega:** apenas documentação de arquitetura (Fase 1 do pedido). Nenhum código de aplicação foi implementado ainda, por decisão explícita.
