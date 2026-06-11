---
description: Inicia o projeto FinFlow do zero, delegando a Fase 1 (infra) ao agent-infra
---
Leia `FINFLOW_PLANO_IMPLEMENTACAO_v2.md` por completo. Em seguida, delegue ao
subagente **agent-infra** a execução da Fase F1 (seção 2 + 11): docker-compose,
UV/pyproject, settings split, pytest/ruff/mypy e apps Django vazios.

Ao final, valide você mesmo (orquestrador):
- `docker compose up -d` sobe db/backend/frontend
- `uv run pytest` exit 0
- não existe nenhum requirements.txt no repositório
Reporte o status e só então pergunte se pode seguir para a F2.
