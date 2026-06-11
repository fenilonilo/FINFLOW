---
description: Executa uma fase específica do FinFlow delegando ao agente correto. Uso /finflow-phase <numero>
argument-hint: <numero-da-fase 1-8>
---
Fase solicitada: $ARGUMENTS

Consulte a seção 11 (Fases) e a seção 1 (Workstreams) de
`FINFLOW_PLANO_IMPLEMENTACAO_v2.md` e delegue ao subagente responsável:
- F1 → agent-infra
- F2 → agent-db
- F3 → agent-domain (TDD estrito)
- F4 → agent-api
- F5 → agent-seed
- F6 → agent-front-core
- F7 → agent-front-pages
- F8 → polimento (coordene front-core + front-pages)

Antes de delegar, confirme que as dependências da fase (grafo da seção 1) já
estão concluídas. Depois da entrega do subagente, rode os critérios da seção 12
relevantes à fase e reporte verde/vermelho item a item.
