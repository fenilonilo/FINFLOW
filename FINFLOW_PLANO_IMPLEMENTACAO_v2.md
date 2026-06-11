# FINFLOW — Sistema Web/Mobile de Controle Financeiro Pessoal
## Documento Mestre de Planejamento e Implementação (v2) — para execução via Claude Code

> **INSTRUÇÃO MESTRA:** Este documento é a fonte única de verdade. Implemente EXATAMENTE conforme especificado. Não invente campos, endpoints ou comportamentos. Ambiguidades: escolha a opção mais simples, registre em `DECISIONS.md` e prossiga.
>
> **PARALELIZAÇÃO:** O documento está dividido em WORKSTREAMS independentes (seção 1). Cada agente recebe este arquivo inteiro como contexto, mas executa APENAS seu workstream, respeitando os contratos das seções 5 (tabelas) e 6 (objetos de API), que são as INTERFACES entre os agentes e NÃO podem ser alteradas unilateralmente.

---

# 1. WORKSTREAMS PARA AGENTES PARALELOS

| Agente | Escopo | Seções deste doc | Depende de | Entrega |
|---|---|---|---|---|
| **AGENT-INFRA** | Docker, UV, pyproject, settings, CI de testes | 2, 3.1 | — | Ambiente sobe com `docker compose up`; `pytest` roda vazio |
| **AGENT-DB** | Models Django + migrações + factories (factory_boy) | 5 | INFRA | Todas as tabelas migradas; factories para 100% dos models |
| **AGENT-DOMAIN** | Camada de serviços, repositórios, strategies, ports (TDD puro) | 4, 7, 8 | DB | Services com testes unitários ≥ 90% cobertura |
| **AGENT-API** | Serializers, ViewSets, routers, auth, OpenAPI | 3.3, 6 | DOMAIN | Todos os endpoints da seção 6 passando testes de API |
| **AGENT-SEED** | Management command com dados da planilha | 10 | DB | `seed_data` idempotente; summaries batem com a tabela 10.3 |
| **AGENT-FRONT-CORE** | Setup Vite/TS/Tailwind, types, client HTTP, auth flow, layout | 9.1–9.4 | seção 6 (contratos) | Login + shell navegável com dados mockados via MSW |
| **AGENT-FRONT-PAGES** | Páginas e gráficos | 9.5–9.9 | FRONT-CORE + API | Todas as telas funcionais contra a API real |

**Grafo de dependências:** INFRA → DB → {DOMAIN, SEED} → API → FRONT-PAGES. FRONT-CORE roda em paralelo a tudo (mocka a API com MSW usando os contratos da seção 6).

**Regra de ouro entre agentes:** as seções 5 (DDL) e 6 (objetos JSON) são contratos congelados. Mudanças exigem atualizar este documento primeiro.

---

# 2. STACK E TOOLING

## 2.1 Backend
| Item | Escolha |
|---|---|
| Linguagem | Python 3.12 |
| Gerenciador | **UV** (`uv init`, `uv add`, `uv run`) — SEM requirements.txt, SEM pip. Dependências em `pyproject.toml`, lock em `uv.lock` |
| Framework | Django 5 + Django REST Framework 3.15 |
| Auth | `djangorestframework-simplejwt` com **rotação de refresh + blacklist** (mobile-ready) |
| Docs | `drf-spectacular` → OpenAPI 3 em `/api/schema/` + swagger-ui |
| Testes | `pytest`, `pytest-django`, `pytest-cov`, `factory_boy`, `freezegun` |
| Filtros | `django-filter` |
| Qualidade | `ruff` (lint+format), `mypy` (strict nos módulos `domain/`) |
| Banco | PostgreSQL 16 |

```toml
# pyproject.toml (núcleo)
[project]
name = "finflow-backend"
requires-python = ">=3.12"
dependencies = [
  "django>=5.0", "djangorestframework>=3.15", "djangorestframework-simplejwt>=5.3",
  "drf-spectacular>=0.27", "django-filter>=24.0", "psycopg[binary]>=3.1",
  "python-dateutil>=2.9", "django-cors-headers>=4.3",
]
[dependency-groups]
dev = ["pytest>=8", "pytest-django>=4.8", "pytest-cov>=5", "factory-boy>=3.3", "freezegun>=1.4", "ruff>=0.4", "mypy>=1.10"]
```

Comandos padrão: `uv sync` · `uv run python manage.py migrate` · `uv run pytest` · `uv run ruff check .`

## 2.2 Frontend (web)
React 18 + Vite + TypeScript · TailwindCSS 3 · Recharts · TanStack Query + Axios · React Router v6 · React Hook Form + Zod · MSW (mocks para desenvolvimento paralelo) · Vitest + Testing Library.

## 2.3 Infra
`docker-compose.yml` com serviços `db` (postgres:16), `backend` (imagem com UV: `ghcr.io/astral-sh/uv` como base ou instalação no Dockerfile), `frontend`. Env vars: `DATABASE_URL`, `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, `JWT_ACCESS_LIFETIME_MIN=15`, `JWT_REFRESH_LIFETIME_DAYS=30`.

---

# 3. ARQUITETURA DO BACKEND

## 3.1 Estrutura de pastas (camadas explícitas)

```
backend/
├── pyproject.toml / uv.lock
├── manage.py
├── config/                      # settings (base/dev/prod), urls, asgi
└── apps/
    ├── accounts/
    ├── core/                    # categorias, formas de pagamento (configuráveis)
    ├── transactions/
    ├── investments/
    ├── cards/
    ├── acquisitions/            # simulação de impacto de aquisição de bens
    └── analytics/
        # CADA app segue esta anatomia interna:
        ├── models.py            # SÓ persistência. Zero regra de negócio.
        ├── repositories.py      # acesso a dados (único lugar com queries ORM)
        ├── services.py          # regras de negócio (recebem/retornam DTOs)
        ├── dtos.py              # dataclasses de entrada/saída dos services
        ├── strategies.py        # quando aplicável (ex.: amortização)
        ├── api/
        │   ├── serializers.py   # tradução DTO/model ↔ JSON
        │   ├── views.py         # FINAS: validam, chamam service, retornam
        │   └── urls.py
        └── tests/
            ├── unit/            # services + strategies (sem banco quando possível)
            ├── integration/     # repositories (com banco)
            └── api/             # endpoints (APIClient)
└── apps/common/
    ├── ports.py                 # interfaces (Protocol) p/ serviços externos
    ├── adapters/                # implementações concretas dos ports
    └── exceptions.py            # DomainError, NotFoundError, ValidationDomainError
```

## 3.2 Padrões de projeto (OBRIGATÓRIOS — reduzem acoplamento)

1. **Service Layer:** toda regra de negócio vive em `services.py`. Views NUNCA contêm lógica; apenas: deserializar → chamar service → serializar resposta. Services não conhecem HTTP/DRF.
2. **Repository:** services não tocam o ORM diretamente; usam repositórios (`TransactionRepository.list_by_month(user_id, year, month)`). Facilita teste unitário com fakes e troca futura de persistência.
3. **DTOs (dataclasses):** comunicação entre camadas via objetos tipados (`CreateTransactionDTO`, `MonthSummaryDTO`), nunca dicts soltos nem models vazando para a view.
4. **Strategy:** cálculos de amortização da aquisição (`PriceStrategy`, `SacStrategy`, `NoInterestStrategy`, `CashStrategy`) implementam a interface `AmortizationStrategy.build_schedule(dto) -> list[InstallmentDTO]`. Selecionadas via **Factory** (`AmortizationFactory.for_type(acquisition_type, system)`).
5. **Ports & Adapters (Hexagonal-lite):** dependências externas e futuras entram por interfaces em `common/ports.py` usando `typing.Protocol`:
   ```python
   class AIAdvisorPort(Protocol):
       def analyze_spending(self, summary: YearSummaryDTO) -> AdviceDTO: ...
       def plan_budget(self, goal: BudgetGoalDTO) -> BudgetPlanDTO: ...

   class NotificationPort(Protocol):
       def notify(self, user_id: int, title: str, body: str) -> None: ...
   ```
   Implementações atuais: `NullAIAdvisor` (retorna vazio) e `ConsoleNotifier`. Quando o agente de IA chegar (LangChain/MCP), cria-se só um novo adapter — **zero mudança nos services**. Injeção via construtor dos services com default nos adapters concretos (`AnalyticsService(advisor: AIAdvisorPort = NullAIAdvisor())`).
6. **Resultado de domínio:** services levantam exceções de `common/exceptions.py`; um exception handler global do DRF converte para o envelope de erro padrão (seção 6.0). Views não fazem try/except de negócio.

## 3.3 Autenticação e API mobile-ready

- **Versionamento:** TODA a API sob `/api/v1/`. Breaking changes futuras → `/api/v2/` (URLPathVersioning).
- **JWT puro em header** (`Authorization: Bearer`) — sem cookies/sessão, funciona idêntico para web (SPA) e app (React Native/Flutter).
- **Access token:** 15 min. **Refresh token:** 30 dias, com `ROTATE_REFRESH_TOKENS=True` + `BLACKLIST_AFTER_ROTATION=True` (app instalado `token_blacklist`). Cada refresh devolve um novo par; o antigo morre — seguro para dispositivos móveis.
- **Sessões de dispositivo:** login aceita `device_name` opcional; tabela `accounts_devicesession` registra dispositivos ativos; endpoint para listar/revogar (revogação = blacklist dos refresh do device).
- **Logout:** `POST /api/v1/auth/logout/` com `{ "refresh" }` → blacklist.
- **Throttling:** `AnonRateThrottle` 20/min em auth; `UserRateThrottle` 300/min geral.
- O OpenAPI gerado é o contrato consumido por web E mobile — o app futuro gera seu client a partir dele.

---

# 4. MÓDULOS DE SERVIÇO (catálogo da camada de domínio)

> AGENT-DOMAIN implementa nesta ordem, sempre em TDD (seção 7). Assinaturas são contrato.

| Service | Métodos principais | Responsabilidade |
|---|---|---|
| `CategoryService` | create, update, archive, list | CRUD com proteção de defaults (arquiva, nunca deleta se houver transações) |
| `PaymentMethodService` | create, update, archive, list | idem, para formas de pagamento configuráveis |
| `RecurringExpenseService` | create_template, update_template, pause, generate_for_month(user, y, m) → GenerationResultDTO | RN-01: replicação idempotente |
| `TransactionService` | create, update, toggle_paid, delete, list_filtered | validações RN-05 |
| `MonthSummaryService` | get_summary(user, y, m) → MonthSummaryDTO | RN-02: agregações do mês |
| `InvestmentService` | record, set_goals_bulk, year_overview | aportes + metas |
| `DebtService` | create, advance_installment | parcelamentos avulsos |
| `CardService` | CRUD cards/invoices | faturas informativas (RN-04) |
| `AnalyticsService` | yearly, category_trend, detect_anomalies, heatmap, health_score | agregações p/ gráficos; ponto de acoplamento futuro do `AIAdvisorPort` |
| `AcquisitionSimulationService` | simulate(dto) → SimulationResultDTO; activate(simulation_id) | seção 8 (núcleo financeiro) |
| `FinancialHealthService` | baseline(user) → BaselineDTO; project_with_commitment(user, schedule) → ImpactDTO | métricas de saúde usadas pela simulação |

**Regra:** `AnalyticsService` e `FinancialHealthService` retornam DTOs serializáveis — exatamente o formato que um agente de IA consumirá depois via `AIAdvisorPort`. Nenhum desses services importa nada de `api/`.

---

# 5. BANCO DE DADOS — TABELAS (contrato do AGENT-DB)

> Implementar como Django Models. Nome de tabela = padrão `app_model`. Todos os models de domínio têm `user FK`, `created_at`, `updated_at`. Valores monetários: `DecimalField(max_digits=12, decimal_places=2)`.

## 5.1 Enums que PERMANECEM enums (estruturais, não configuráveis)
```python
class TransactionType(TextChoices): INCOME="income"; EXPENSE="expense"
class TransactionKind(TextChoices): FIXED="fixed"; VARIABLE="variable"
class RecurringStatus(TextChoices): ACTIVE="active"; PAUSED="paused"
class AcquisitionType(TextChoices): CASH="cash"; INSTALLMENT="installment"; FINANCING="financing"; CONSORTIUM="consortium"
class AmortizationSystem(TextChoices): PRICE="price"; SAC="sac"; NONE="none"
class AcquisitionStatus(TextChoices): SIMULATION="simulation"; ACTIVE="active"; COMPLETED="completed"; CANCELLED="cancelled"
```

## 5.2 Tabelas

**`accounts_user`** — AbstractUser custom, login por email (`USERNAME_FIELD="email"`).

**`accounts_devicesession`** — id, user FK, device_name varchar(80), last_seen_at, created_at, revoked bool.

**`core_category`** ⭐ totalmente configurável pelo usuário:
| Campo | Tipo | Regras |
|---|---|---|
| user FK, name varchar(50) | | unique(user, name) case-insensitive |
| icon varchar(30), color varchar(7) | | livres |
| parent FK self NULL | | permite SUBCATEGORIAS (1 nível: validar parent.parent is null) |
| monthly_budget decimal NULL | | teto de gasto mensal opcional (alimenta alertas) |
| is_default bool, is_archived bool | | default: arquivável, nunca deletável; custom: deletável se sem transações |

**`core_paymentmethod`** ⭐ deixa de ser enum — tabela configurável:
| Campo | Tipo |
|---|---|
| user FK, name varchar(40), icon varchar(30), color varchar(7), is_default bool, is_archived bool |
Seeds default por usuário: Pix, Débito, Crédito, Dinheiro, Boleto. Usuário cria quantas quiser (ex.: "Vale-refeição", "Cripto").

**`transactions_recurringexpense`** (template de gasto fixo):
| Campo | Tipo | Regras |
|---|---|---|
| user, category FK(core_category, PROTECT), description varchar(100) | | |
| payment_method FK(core_paymentmethod, PROTECT) | | |
| default_amount decimal, due_day smallint 1–28 | | |
| status enum RecurringStatus | | |
| total_occurrences smallint NULL | | NULL = infinito; N = encerra após N gerações (usado por aquisições parceladas) |
| generated_count smallint default 0 | | incrementa a cada geração; ao atingir total → status muda p/ paused |
| acquisition FK(acquisitions_acquisition) NULL | | vínculo quando criado por uma aquisição |

**`transactions_transaction`**:
| Campo | Tipo | Regras |
|---|---|---|
| user, type enum, kind enum | | |
| category FK NULL | | obrigatória se expense; NULL se income |
| description varchar(100), amount decimal (>0) | | |
| date date; year int; month int | | year/month derivados no save(); index (user, year, month) |
| payment_method FK NULL | | |
| is_paid bool | | income força true |
| recurring_source FK(recurringexpense, SET_NULL) NULL | | |
| installment_current/installment_total smallint NULL | | current ≤ total |
| **Constraint** | | `unique(user, recurring_source, year, month)` quando recurring_source not null |

**`investments_investmentgoal`** — user, year, month, target_amount. unique(user, year, month).
**`investments_investment`** — user, year, month, date, location varchar(100), amount.
**`cards_card`** — user, name, color, closing_day, due_day.
**`cards_cardinvoice`** — card FK, year, month, amount, due_date, is_paid. unique(card, year, month). NUNCA soma em saídas.
**`transactions_debt`** — user, debt_type varchar(20), creditor, payment_method FK NULL, installment_current/total, installment_amount, total_amount, start_date, is_settled.

**`acquisitions_acquisition`** ⭐ (módulo de impacto de bens):
| Campo | Tipo | Regras |
|---|---|---|
| user, name varchar(100) | | ex.: "Notebook Dell" |
| total_value decimal | | preço do bem |
| acquisition_type enum AcquisitionType | | |
| down_payment decimal default 0 | | entrada |
| installments_count smallint NULL | | exigido se installment/financing/consortium |
| monthly_interest_rate decimal(7,4) NULL | | % a.m. (ex.: 1.9900). NULL ⇒ 0 p/ installment; obrigatório p/ financing |
| amortization_system enum | | price/sac p/ financing; none p/ demais |
| extra_monthly_cost decimal default 0 | | seguro/taxas mensais embutidas |
| start_date date | | 1ª parcela |
| status enum AcquisitionStatus | | simulation → active (gera recorrente) |
| category FK(core_category) NULL | | onde os lançamentos cairão (default: "Outros") |
| recurring_expense FK NULL (OneToOne) | | criado na ativação |
| result_snapshot JSONB NULL | | SimulationResultDTO congelado na ativação (auditoria) |

**`acquisitions_acquisitioninstallment`** — schedule materializado da simulação ativa:
| Campo | Tipo |
|---|---|
| acquisition FK, number smallint, due_date date, amount decimal, interest_portion decimal, principal_portion decimal, remaining_balance decimal |

---

# 6. OBJETOS DA API — CONTRATOS JSON (interface AGENT-API ↔ AGENT-FRONT)

## 6.0 Convenções inegociáveis (anti-ruído)
1. Dinheiro = **string** decimal `"1234.56"` (nunca float). 2. Datas `"YYYY-MM-DD"`; timestamps ISO UTC. 3. Mês = par `year`+`month` (int). 4. snake_case em tudo; front NÃO renomeia. 5. Percentuais = string decimal `"43.30"` (já em %). 6. Erros: `{ "detail": str, "errors": { campo: [msg] } }`. 7. Paginação DRF padrão `{count,next,previous,results}` page_size=50. 8. Base: **`/api/v1/`**. 9. Types TS gerados do OpenAPI (`npx openapi-typescript http://localhost:8000/api/schema/ -o src/types/api.ts`) — proibido divergir manualmente.

## 6.1 Auth (`/api/v1/auth/`)
| Método/Rota | Request | Response 200 |
|---|---|---|
| POST `register/` | `{email, password, first_name}` | `{id, email, first_name}` |
| POST `token/` | `{email, password, device_name?}` | `{access, refresh}` |
| POST `token/refresh/` | `{refresh}` | `{access, refresh}` (rotação) |
| POST `logout/` | `{refresh}` | 205 |
| GET `me/` | — | `{id, email, first_name}` |
| GET `sessions/` · DELETE `sessions/{id}/` | — | lista/revoga DeviceSession |

## 6.2 Objeto `Category`
```json
{ "id": 1, "name": "Saúde", "icon": "heart-pulse", "color": "#ef4444",
  "parent": null, "monthly_budget": "500.00",
  "is_default": true, "is_archived": false, "transaction_count": 14 }
```
CRUD em `/api/v1/categories/` (`?include_archived=true`). DELETE: 204 se sem transações; senão 409 com `detail` sugerindo arquivar.

## 6.3 Objeto `PaymentMethod` — `/api/v1/payment-methods/` (CRUD igual a categorias)
```json
{ "id": 2, "name": "Pix", "icon": "zap", "color": "#34d399", "is_default": true, "is_archived": false }
```

## 6.4 Objeto `RecurringExpense` — `/api/v1/recurring-expenses/`
```json
{ "id": 3, "description": "Unimed",
  "category": 1, "category_detail": { "id": 1, "name": "Saúde", "icon": "heart-pulse", "color": "#ef4444" },
  "payment_method": 2, "payment_method_detail": { "id": 2, "name": "Pix", "icon": "zap", "color": "#34d399" },
  "default_amount": "380.00", "due_day": 12, "status": "active",
  "total_occurrences": null, "generated_count": 5, "acquisition": null }
```

## 6.5 Objeto `Transaction` — `/api/v1/transactions/`
```json
{ "id": 42, "type": "expense", "kind": "fixed",
  "category": 1, "category_detail": { "...": "como acima" },
  "description": "Unimed", "amount": "416.09", "date": "2025-01-12",
  "year": 2025, "month": 1,
  "payment_method": 2, "payment_method_detail": { "...": "..." },
  "is_paid": true, "recurring_source": 3,
  "installment_current": null, "installment_total": null }
```
Filtros GET: `year, month, type, kind, category, payment_method, is_paid, search`. POST body usa apenas IDs (`category: 1`), nunca os `_detail`.

## 6.6 `MonthSummary` — GET `/api/v1/months/{year}/{month}/summary/`
```json
{ "year": 2025, "month": 1,
  "total_income": "11007.16", "total_expense": "3283.06",
  "total_fixed": "3283.06", "total_variable": "0.00",
  "total_invested": "5000.00", "balance": "2724.10",
  "pending_count": 1, "investment_goal": "0.00",
  "by_category": [ { "category_id": 1, "category_name": "Saúde", "color": "#ef4444", "total": "474.09", "budget": "500.00", "budget_used_pct": "94.82" } ],
  "by_payment_method": [ { "payment_method_id": 2, "name": "Pix", "total": "3260.06" } ] }
```

## 6.7 Geração de fixos — POST `/api/v1/months/{year}/{month}/generate-fixed/` → `{ "created": 9, "skipped": 1, "completed_templates": [12] }` (templates que atingiram total_occurrences).

## 6.8 Analytics — `/api/v1/analytics/`
| Rota | Response |
|---|---|
| `yearly/?year=` | `{ year, months: [ {month, total_income, total_expense, total_invested, balance} x12 ] }` |
| `category-trend/?category=&months=6` | `{ category_id, category_name, average, points: [ {year, month, total} ] }` |
| `anomalies/?year=&month=` | `[ { category_id, category_name, current, average_6m, variation_pct } ]` (variação > 30%) |
| `heatmap/?year=` | `[ { "date": "2025-01-12", "total": "416.09" } ]` |
| `health-score/?year=&month=` | objeto `FinancialHealth` (6.10) |

## 6.9 Investimentos, cartões, dívidas
Iguais à estrutura padrão CRUD: `Investment {id, year, month, date, location, amount}` · `InvestmentGoal` (+ `PUT /investment-goals/bulk/` body `{year, goals:[{month, target_amount}]}`) · `Card {id, name, color, closing_day, due_day}` · `CardInvoice {id, card, year, month, amount, due_date, is_paid}` em `/cards/{id}/invoices/` · `Debt {...}` + action `POST /debts/{id}/advance/`.

## 6.10 Objeto `FinancialHealth` (usado por health-score e simulação)
```json
{ "avg_monthly_income": "8245.37", "avg_monthly_expense": "3490.58",
  "avg_monthly_invested": "2697.31", "avg_balance": "2057.48",
  "fixed_commitment_pct": "42.33", "savings_rate_pct": "32.71",
  "score": 78, "score_label": "Saudável" }
```
`score` 0–100 calculado por: savings_rate (40%), fixed_commitment invertido (30%), regularidade de saldo positivo (30%). `score_label`: 0–39 "Crítico", 40–59 "Atenção", 60–79 "Saudável", 80–100 "Excelente".

## 6.11 ⭐ Simulação de aquisição — `/api/v1/acquisitions/`

**POST `/api/v1/acquisitions/simulate/`** (stateless, NÃO persiste) — Request:
```json
{ "name": "Notebook Dell", "total_value": "10000.00",
  "acquisition_type": "financing", "down_payment": "2000.00",
  "installments_count": 24, "monthly_interest_rate": "1.9900",
  "amortization_system": "price", "extra_monthly_cost": "0.00",
  "start_date": "2026-07-01" }
```
**Response 200 — objeto `SimulationResult`:**
```json
{ "input": { "...": "eco do request" },
  "financed_amount": "8000.00",
  "monthly_payment_first": "422.94", "monthly_payment_last": "422.94",
  "total_paid": "12150.56", "total_interest": "2150.56",
  "effective_cost_pct": "21.51",
  "schedule": [ { "number": 1, "due_date": "2026-07-01", "amount": "422.94", "interest_portion": "159.20", "principal_portion": "263.74", "remaining_balance": "7736.26" } ],
  "impact": {
    "baseline": { "...objeto FinancialHealth atual..." },
    "projected": { "...FinancialHealth com a parcela embutida..." },
    "monthly_income_impact_pct": "5.13",
    "balance_reduction_pct": "20.56",
    "score_delta": -9,
    "months_negative_balance": 0,
    "opportunity_cost": "1893.40",
    "timeline": [ { "year": 2026, "month": 7, "projected_balance": "1634.54", "cumulative_paid": "422.94" } ],
    "verdict": "moderate",
    "verdict_message": "Compromete 5,1% da sua renda média por 24 meses e reduz seu saldo médio em 20,6%. Impacto moderado." } }
```
`verdict` ∈ `"safe" | "moderate" | "risky" | "critical"` — regras na RN-08.

**POST `/api/v1/acquisitions/`** (persiste como `status=simulation`): body = mesmo do simulate + `category`. Response = objeto `Acquisition` (input + `id`, `status`, `result_snapshot`).
**POST `/api/v1/acquisitions/{id}/activate/`** → executa RN-09, response = `Acquisition` com `status=active` e `recurring_expense` preenchido.
**GET `/api/v1/acquisitions/`** lista · **GET `{id}/`** detalhe com `installments` (schedule materializado + flag paga por mês via transações vinculadas) · **POST `{id}/cancel/`**.

---

# 7. TDD — PROCESSO OBRIGATÓRIO DE DESENVOLVIMENTO

> AGENT-DOMAIN e AGENT-API seguem Red → Green → Refactor. O teste vem ANTES do código de produção, sempre.

## 7.1 Ciclo por funcionalidade
1. **RED:** escrever o teste que descreve o comportamento (ele DEVE falhar). Commit: `test: <comportamento>`.
2. **GREEN:** implementação mínima que passa. Commit: `feat: <comportamento>`.
3. **REFACTOR:** limpar mantendo verde. Commit: `refactor: ...`.

## 7.2 Pirâmide e metas
| Nível | Alvo | Ferramentas | Cobertura mínima |
|---|---|---|---|
| Unit | services, strategies, DTOs — repositórios substituídos por fakes em memória | pytest puro (sem `@pytest.mark.django_db` quando possível), freezegun | **90% em services/ e strategies/** |
| Integration | repositories contra Postgres real | pytest-django, factory_boy | repositórios 100% dos métodos |
| API | endpoints (status code, shape do JSON, permissões, filtros) | APIClient | 1 teste feliz + 1 de erro por endpoint no mínimo |

## 7.3 Testes nomeados que DEVEM existir (especificação executável)
```
test_generate_fixed_is_idempotent
test_generate_fixed_skips_paused_templates
test_generate_fixed_respects_total_occurrences_and_pauses_template
test_editing_instance_does_not_change_template
test_income_forces_is_paid_true_and_null_category
test_expense_requires_category
test_summary_matches_seed_january_exactly
test_card_invoice_never_counts_as_expense
test_category_delete_with_transactions_returns_conflict
test_price_schedule_total_equals_pv_plus_interest
test_sac_installments_are_decreasing
test_zero_interest_installment_divides_evenly_with_rounding_adjustment
test_cash_acquisition_generates_single_variable_expense_plan
test_simulation_verdict_critical_when_balance_goes_negative
test_activate_creates_recurring_with_total_occurrences
test_refresh_token_rotation_blacklists_old_token
```
`conftest.py` global com fixtures: `user`, `auth_client`, `categories_default`, `payment_methods_default`. Factories para todos os models.

## 7.4 CI local
`uv run pytest --cov=apps --cov-fail-under=85` deve passar antes de qualquer merge de fase. `ruff check` e `mypy apps/*/services.py apps/*/strategies.py` limpos.

---

# 8. NÚCLEO FINANCEIRO — SIMULAÇÃO DE AQUISIÇÃO (especificação matemática)

> Tudo em `Decimal` com `ROUND_HALF_UP`, 2 casas no resultado final, 6 casas em cálculos intermediários. `i` = monthly_interest_rate/100.

## RN-06 — Strategies de pagamento
**`CashStrategy`** (à vista): schedule = 1 item, amount = total_value − (não há down_payment separado). Impacto: despesa variável única no mês de start_date + efeito no saldo daquele mês e no colchão médio.

**`NoInterestStrategy`** (parcelado sem juros): `PV = total_value − down_payment`; parcela = `PV / n` arredondada; **ajuste de centavos na última parcela** para que Σ = PV exato.

**`PriceStrategy`** (financiamento Tabela Price): parcela fixa
`PMT = PV × i / (1 − (1+i)^−n)`
Por parcela k: `interest_k = saldo_{k−1} × i`; `principal_k = PMT − interest_k`; `saldo_k = saldo_{k−1} − principal_k`. Última parcela ajusta para zerar saldo.

**`SacStrategy`** (SAC): `amortização = PV / n` constante; `interest_k = saldo_{k−1} × i`; `parcela_k = amort + interest_k` (decrescente).

**`ConsortiumStrategy`** (consórcio, simplificado): parcela = `(total_value × (1 + taxa_adm_total/100)) / n`, onde monthly_interest_rate é reinterpretado como taxa de administração TOTAL do plano. Documentar no DECISIONS.md.

Todas somam `extra_monthly_cost` em cada parcela. Output: `list[InstallmentDTO(number, due_date, amount, interest_portion, principal_portion, remaining_balance)]`. `due_date` avança mês a mês a partir de start_date (dateutil.relativedelta, clamp dia 28).

## RN-07 — Baseline de saúde financeira (`FinancialHealthService.baseline`)
Janela: últimos 6 meses com movimento (ignora meses 100% zerados). Calcula médias de income/expense/invested, `avg_balance`, `fixed_commitment_pct = total_fixed_médio / income_médio × 100`, `savings_rate_pct = invested_médio / income_médio × 100` e o `score` (pesos da seção 6.10).

## RN-08 — Projeção de impacto (`project_with_commitment`)
Para cada mês do schedule: `projected_balance_m = avg_balance − parcela_m` (mais o down_payment subtraído integralmente no mês 1, e o valor à vista no caso cash). Métricas:
- `monthly_income_impact_pct = PMT_média / avg_monthly_income × 100`
- `balance_reduction_pct = PMT_média / avg_balance × 100`
- `months_negative_balance` = nº de meses com projected_balance < 0
- `opportunity_cost` = valor futuro das parcelas se investidas a 0,9% a.m. (constante `OPPORTUNITY_RATE = Decimal("0.009")`, configurável em settings) MENOS o total pago — informa "quanto renderia se investisse".
- `score_delta` = score projetado − score baseline.
- **Verdict:** `critical` se months_negative_balance > 0 OU income_impact > 30%; `risky` se income_impact > 15% OU score_delta ≤ −15; `moderate` se income_impact > 5%; senão `safe`. `verdict_message` gerada por template em pt-BR com os números.

## RN-09 — Ativação (`activate`)
Transação atômica: (1) materializa `AcquisitionInstallment` com o schedule; (2) cria `RecurringExpense(description=name, default_amount=PMT média — Price; para SAC cria com amount da 1ª parcela e flag de revisão mensal documentada, total_occurrences=n, due_day=start_date.day clamp 28, acquisition=self, category=dto.category)`; (3) se down_payment > 0 → cria `Transaction` variável paga no mês inicial; (4) se cash → só a Transaction única, sem recorrente; (5) congela `result_snapshot`; (6) status=active. Cancelar: pausa o recorrente e marca cancelled (transações passadas permanecem).

## RN-01..05 (herdadas da v1, inalteradas)
RN-01 geração idempotente de fixos (agora decrementando total_occurrences quando aplicável) · RN-02 fórmulas do summary · RN-03 edição de instância nunca propaga · RN-04 faturas informativas · RN-05 validações de Transaction.

---

# 9. FRONTEND — ESTRUTURA COMPLETA (AGENT-FRONT-CORE + AGENT-FRONT-PAGES)

## 9.1 Estrutura de pastas
```
frontend/src/
├── api/            # client.ts (axios + interceptors), 1 arquivo de hooks por recurso
├── types/api.ts    # GERADO do OpenAPI — não editar à mão
├── mocks/          # MSW handlers espelhando a seção 6 (dev paralelo sem backend)
├── lib/            # currency.ts (string→R$), date.ts, constants.ts
├── contexts/       # AuthContext, PeriodContext (year/month global)
├── components/ui/  # KpiCard, MoneyText, CategoryBadge, PaymentMethodBadge, MonthPicker,
│                   # ConfirmDialog, EmptyState, Skeleton, Toast, IconPicker, ColorPicker
├── components/features/<dominio>/
├── layouts/        # AppLayout (sidebar+topbar), AuthLayout
└── pages/
```

## 9.2 Auth flow (espelha 3.3)
Tokens em memória + refresh persistido (localStorage). Interceptor: 401 → tenta refresh (fila única de retry) → falhou → redirect /login. Rotas protegidas via `<RequireAuth>`.

## 9.3 Design System "Midnight Finance" (dark default)
Tokens Tailwind: `bg-base #0a0f1a` · `bg-surface #111827` · `bg-elevated #1b2434` · `border-subtle #243044` · `accent #34d399` · `danger #f87171` · `warning #fbbf24` · `info #60a5fa` · `text-primary #f1f5f9` · `text-muted #94a3b8`. Fonte Inter, números `tabular-nums`. Cards `rounded-2xl` com borda sutil; transições 200ms; count-up nos KPIs; ícones lucide-react.

## 9.4 Layout
Sidebar 240px colapsável (bottom-nav < 768px): Dashboard, Lançamentos, Gastos Fixos, **Aquisições**, Investimentos, Cartões, Dívidas, Análises, Configurações. Topbar com `MonthPicker` global (PeriodContext) + avatar.

## 9.5 Páginas (rotas)
| Rota | Página |
|---|---|
| `/login` | Login |
| `/` | Dashboard: 5 KPI cards (entradas/saídas/investido/saldo/pendências) com variação vs mês anterior; banner "gerar fixos"; donut categorias (com anel de budget quando definido); linha evolução anual; barras formas de pagamento; lista próximos vencimentos com toggle pago; chips de anomalias; card `health-score` com gauge 0–100 |
| `/transactions` | filtros (tipo/categoria/forma/pago/busca), tabela, modal criar com tabs entrada/saída e autocomplete de descrição, suporte a parcelas |
| `/recurring` | tabela de templates + coluna "este mês" (✅/⏳/—) + badge "N/total" quando total_occurrences; CRUD em modal |
| `/acquisitions` ⭐ | ver 9.6 |
| `/investments` | metas vs realizado (progress bars), histórico, gráfico de área acumulado |
| `/cards` | cards visuais com cor da bandeira, faturas por mês, alerta de vencimento |
| `/debts` | lista com barra de progresso parcelas, botão "avançar parcela" |
| `/analytics` | heatmap anual estilo GitHub, tendência por categoria com linha de média, comparativo anual em barras agrupadas, ranking top 8 categorias |
| `/settings` | **gestão total de categorias** (criar/editar/arquivar, IconPicker + ColorPicker, subcategoria, budget mensal) · **gestão de formas de pagamento** (mesmo padrão) · sessões de dispositivos (lista + revogar) · tema dark/light · perfil |

## 9.6 Página Aquisições (a feature estrela)
- **Simulador** (form à esquerda, resultado à direita, atualização ao clicar "Simular"): nome, valor total, tipo (cards selecionáveis: À vista / Parcelado / Financiamento / Consórcio), entrada, nº parcelas (slider 1–120), juros % a.m., sistema (Price/SAC radio — só para financiamento), custo mensal extra, data início.
- **Painel de resultado:** parcela (primeira/última), total pago, total de juros, custo efetivo %; **comparador visual baseline vs projetado** (dois gauges de score lado a lado com delta); badge gigante do `verdict` colorido (safe=accent, moderate=warning, risky=orange, critical=danger) com `verdict_message`; gráfico de linha `impact.timeline` (saldo projetado mês a mês, zona vermelha abaixo de 0); gráfico de área empilhada juros×amortização por parcela; card "custo de oportunidade".
- Botões: "Salvar simulação" e "Ativar aquisição" (ConfirmDialog explicando que criará o gasto fixo automático).
- **Lista de aquisições:** cards com progresso (parcelas pagas/total via transações geradas), status, ação cancelar.

## 9.7 Camada de dados
Hooks React Query por recurso; mutações invalidam `["summary"]`, `["yearly"]`, `["health"]` do período. MSW liga quando `VITE_API_MOCK=true` — handlers retornam exatamente os exemplos da seção 6 (permite FRONT-PAGES começar antes da API real).

## 9.8 Testes do front
Vitest + Testing Library: `lib/currency` e `lib/date` 100%; smoke test de render por página com MSW; teste do fluxo de refresh do interceptor.

## 9.9 Exemplo de type gerado (referência de fidelidade)
```ts
export interface SimulationResult {
  input: AcquisitionInput;
  financed_amount: string;
  monthly_payment_first: string;
  monthly_payment_last: string;
  total_paid: string;
  total_interest: string;
  effective_cost_pct: string;
  schedule: Installment[];
  impact: ImpactAnalysis;  // baseline/projected: FinancialHealth; verdict: "safe"|"moderate"|"risky"|"critical"
}
```

---

# 10. DADOS DE SEED (planilha real — AGENT-SEED)

> Command `uv run python manage.py seed_data --email felipe@finflow.app`. Idempotente (get_or_create). Ano de referência do histórico: **2025**.

## 10.1 Categorias default (20) — `(name, icon, color)`
Bobeira/candy/#f472b6 · Alimentação/utensils/#fb923c · Saúde/heart-pulse/#ef4444 · Beleza/sparkles/#e879f9 · Roupa/shirt/#a78bfa · Lazer/gamepad-2/#818cf8 · Uber/transporte/car/#60a5fa · Mercado/shopping-cart/#38bdf8 · Aluguel/home/#2dd4bf · Assinaturas/repeat/#34d399 · Essencial/plug-zap/#4ade80 · Outros/circle-ellipsis/#94a3b8 · Contas/receipt/#facc15 · Casa/sofa/#fbbf24 · Filhos/baby/#fb7185 · Educação/graduation-cap/#c084fc · Pet/paw-print/#f59e0b · Presentes/gift/#ec4899 · Viagem/plane/#22d3ee · Imposto/landmark/#f87171

## 10.2 Formas de pagamento default — `(name, icon, color)`
Pix/zap/#34d399 · Débito/credit-card/#60a5fa · Crédito/credit-card/#a78bfa · Dinheiro/banknote/#4ade80 · Boleto/barcode/#facc15

## 10.3 Gastos fixos (templates)
| description | category | payment | default_amount | due_day |
|---|---|---|---|---|
| Unimed | Saúde | Pix | 380.00 | 12 |
| QLaira | Saúde | Pix | 58.00 | 13 |
| Fatura Inter | Contas | Pix | 700.00 | 14 |
| Fatura Nubank | Uber/transporte | Pix | 650.00 | 15 |
| Internet | Essencial | Pix | 155.84 | 16 |
| Spotify | Lazer | Débito | 23.00 | 17 |
| Crunchyroll | Lazer | Pix | 8.00 | 18 |
| Contabilizei | Imposto | Débito | 230.00 | 15 |
| Faculdade | Educação | Pix | 569.62 | 6 |
| Cabelo | Beleza | Pix | 40.00 | 1 |

## 10.4 Resumos mensais 2025 (os summaries DEVEM bater exatamente)
| Mês | income | expense | invested | balance |
|---|---|---|---|---|
| 1 | 11007.16 | 3283.06 | 5000.00 | 2724.10 |
| 2 | 8000.00 | 3391.66 | 0.00 | 4608.34 |
| 3 | 8000.00 | 4435.29 | 0.00 | 3564.71 |
| 4 | 8000.00 | 4601.85 | 0.00 | 3398.15 |
| 5 | 8000.00 | 3786.86 | 4000.00 | 213.14 |
| 6 | 8000.00 | 4636.58 | 0.00 | 3363.42 |
| 7 | 0.00 | 0.00 | 0.00 | 0.00 |
| 8 | 12867.76 | 0.00 | 12867.76 | 0.00 |
| 9 | 8554.73 | 3122.01 | 4000.00 | 1432.72 |
| 10 | 8000.00 | 3686.22 | 3000.00 | 1313.78 |
| 11 | 7167.75 | 1963.02 | 3500.00 | 1704.73 |
| 12 | 7353.02 | 2999.22 | 0.00 | 4353.80 |

## 10.5 Janeiro/2025 detalhado (mês-exemplo com transações reais)
Entradas: 10/01 fixed Salário 8000.00 · 05/01 variable Perfil Software 2000.00 · 02/01 variable Natal Sandra 322.00 · 02/01 variable Natal Evelin 97.04 · 02/01 variable Natal Marilisa 388.12 · 03/01 variable Natal Vo 200.00.
Saídas (kind=fixed): 12/01 Saúde Unimed Pix 416.09 pago · 13/01 Saúde QLaira Pix 58.00 pago · 14/01 Contas Inter Pix 346.11 pago · 15/01 Uber/transporte Nubank Pix 1298.76 pago · 16/01 Essencial Internet Pix 155.84 pago · 17/01 Lazer Spotify Débito 23.00 pago · 18/01 Lazer CRUNCHYROLL Pix 8.00 pago · 19/01 Beleza Cabelo Pix 40.00 NÃO pago · 15/01 Imposto Contabilizei Pix 221.60 pago · 12/01 Imposto Contabilizei Pix 715.66 pago.

## 10.6 Setembro/2025 detalhado (mês com variáveis)
Entradas: 10/09 fixed Salário 8000.00 · 05/09 variable Pix Faculdade 542.00 · 02/09 variable Saldo Mês Passado 12.73.
Fixos: UNIMED 366.05 Boleto · CONTABILIZEI 825.98 Pix (Imposto) · SPOTIFY 22.00 Débito (Assinaturas) · QLAIRA 56.00 Pix · FACULDADE 541.82 Boleto NÃO pago · CABELO 40.00 Pix · CRUNCHYROLL 7.48 Pix NÃO pago.
Variáveis: CARONA 76.00 Pix Uber/transporte · INTERNET 155.78 Pix Essencial · UBER-Nubank 357.10 Pix Uber/transporte · INTER 480.69 Débito Contas · DOCE E MÃE 150.00 Pix Alimentação · GC 5.00 Pix Lazer · IFOOD 26.40 Pix Alimentação · CHICLETE 2.50 Débito Bobeira · CRUNCHYROLL 10.00 Pix Assinaturas · CINEMA 46.07 Pix Lazer · COCA/CERVEJA 34.50 Débito Bobeira · CUECAS 120.00 Pix Roupa · COCA 12.00 Débito Bobeira · AMERICANAS 44.00 Pix Bobeira · RODIZIO PIZZA 159.94 Débito Lazer · COCA 12.00 Débito Bobeira · BANHO/TOZA 120.00 Pix Pet.
> Demais meses: 1 entrada agregada + saídas agregadas por categoria de modo que os totais de 10.4 batam exatamente.

## 10.7 Investimentos e metas
Aportes: 2025-01 FUNDO INTER FIRF CP 5000.00 · 2025-05 CDI 4000.00 · 2025-08 Investimentos Anteriores 12867.76 · 2025-09 FUNDO INTER FIRF CP 4000.00 · 2025-10 Apartamento 3000.00 · 2025-11 Renda Fixa 3500.00.
Metas: Ago 12867.76; Set–Dez 4000.00 cada (total anual 28867.76).

## 10.8 Cartões e dívidas
Cartões: Nubank #820ad1 (venc 12) · Inter #ff7a00 (venc 12) · PicPay #21c25e · Santander #ec0000 · C6 Bank #1a1a1a.
Dívidas (installment): HotPark 2/10 × 39.80 (total 390.80, início 2024-07-03) · Felipe L. 2/6 × 316.17 (1900.00, 2024-07-02) · Carlos Mec. 2/4 × 125.00 (500.00, 2024-07-02).

---

# 11. FASES DE EXECUÇÃO

**F1 INFRA** → docker compose + UV + settings + pytest configurado.
**F2 DB** → models 5.2 + migrações + factories (testes de constraint passando).
**F3 DOMAIN (TDD)** → services na ordem da tabela da seção 4; strategies da seção 8 com os testes nomeados de 7.3.
**F4 API** → auth completo (3.3) → CRUDs → summary/generate-fixed → analytics → acquisitions. Smoke no swagger.
**F5 SEED** → seed_data; validar `summary 2025/1` contra 10.4.
**F6 FRONT-CORE** → setup + types gerados + MSW + auth + layout. (pode iniciar junto com F2)
**F7 FRONT-PAGES** → Dashboard → Lançamentos → Fixos → Aquisições → demais → Configurações.
**F8 POLIMENTO** → responsivo, count-up, empty states, tema persistido, README.

---

# 12. CHECKLIST FINAL DE ACEITAÇÃO

- [ ] `docker compose up` → front :5173, API :8000, swagger ok; **nenhum requirements.txt no repo** — só pyproject/uv.lock.
- [ ] `uv run pytest --cov=apps --cov-fail-under=85` verde; todos os testes de 7.3 existem e passam.
- [ ] Refresh token rotaciona e o antigo é rejeitado (401) — testado.
- [ ] Dashboard Jan/2025: R$ 11.007,16 / R$ 3.283,06 / R$ 5.000,00 / R$ 2.724,10.
- [ ] Mês futuro vazio → gerar fixos → 10 pendências; repetir → `skipped=10`.
- [ ] Usuário cria categoria "Games" (ícone+cor+budget) e forma de pagamento "VR" e ambas aparecem em lançamentos e gráficos.
- [ ] Simulação financing 10000, entrada 2000, 24×, 1,99% a.m. Price → PMT ≈ R$ 422,94, juros totais ≈ R$ 2.150, schedule fecha saldo em zero, verdict coerente com RN-08.
- [ ] Ativar aquisição → RecurringExpense com total_occurrences=24 criado → gerar fixos do mês → parcela aparece como pendente → após 24 gerações o template pausa sozinho.
- [ ] Views sem regra de negócio (revisão: nenhuma view com mais de ~15 linhas); services sem imports de DRF; repositórios são o único lugar com ORM.
- [ ] Trocar `NullAIAdvisor` por um adapter fake em testes não exige mudar nenhum service (prova do desacoplamento por ports).
- [ ] Zero floats monetários na API; types TS gerados do OpenAPI sem edição manual.

# 13. INSTRUÇÕES FINAIS PARA OS AGENTES
1. Execute APENAS seu workstream; trate as seções 5 e 6 como contratos imutáveis.
2. TDD não é opcional: PR/commit de feature sem teste antecedente será rejeitado.
3. Commits convencionais (`test:`, `feat:`, `refactor:`, `chore:`); um commit por ciclo red-green-refactor.
4. Toda decisão fora do documento vai para `DECISIONS.md` com justificativa de 1 linha.
5. Ao concluir uma fase, rode lint + mypy + pytest antes de declarar pronto.
