# FinFlow — Controle Financeiro Pessoal

Sistema web/mobile de controle financeiro pessoal com simulador de impacto de aquisições.

## Stack

| Camada | Tech |
|--------|------|
| Backend | Python 3.12 · Django 5 · DRF · UV |
| Banco | PostgreSQL 16 |
| Frontend | React 18 · Vite · TypeScript · TailwindCSS |
| Auth | JWT (simplejwt) com rotação de refresh |
| Docs | OpenAPI 3 via drf-spectacular |

## Inicio rapido

```bash
# Sobe tudo (db + backend + frontend)
docker compose up -d

# Seed com dados reais de 2025
docker compose exec backend uv run python manage.py seed_data

# Acesse
# Frontend: http://localhost:5173
# API:      http://localhost:8000/api/v1/
# Swagger:  http://localhost:8000/api/schema/swagger-ui/
```

Login padrao apos seed: `felipe@finflow.app` / `finflow123`

## Desenvolvimento local (sem Docker)

```bash
# Backend
cd backend
uv sync
uv run python manage.py migrate
uv run python manage.py runserver

# Frontend (com mocks MSW -- sem backend)
cd frontend
npm install
VITE_API_MOCK=true npm run dev
```

## Comandos uteis

```bash
# Backend -- testes + cobertura
uv run pytest --cov=apps --cov-fail-under=85

# Backend -- lint
uv run ruff check .

# Backend -- type check
uv run mypy apps/*/services.py apps/*/strategies.py

# Frontend -- build
npm run build

# Frontend -- testes
npm test

# Frontend -- regenerar types do OpenAPI (backend rodando)
npm run generate-types
```

## Arquitetura

```
backend/apps/
|-- accounts/     # auth JWT + sessoes de dispositivo
|-- core/         # categorias e formas de pagamento configuráveis
|-- transactions/ # lancamentos, gastos fixos, dividas
|-- investments/  # aportes e metas de investimento
|-- cards/        # cartoes e faturas informativas
|-- acquisitions/ # simulador de impacto de aquisicao de bens
|-- analytics/    # health score, heatmap, tendencias
|-- common/       # DTOs, exceptions, ports & adapters
```

Camadas por app: `models` -> `repositories` -> `services` (TDD) -> `api/views` (thin)

Regras inegociaveis: dinheiro como string decimal `"1234.56"` (nunca float) · UV (nunca pip/requirements.txt) · TDD red->green->refactor
