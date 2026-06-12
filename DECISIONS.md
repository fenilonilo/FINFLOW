# DECISIONS

| Data | Decisao | Justificativa |
|------|---------|---------------|
| F1 | `ConsortiumStrategy` interpreta `monthly_interest_rate` como taxa admin total | Spec secao 8 indica reinterpretacao: "monthly_interest_rate e reinterpretado como taxa de administracao TOTAL do plano" |
| F1 | `uv.lock` gerado via `uv sync` na maquina de CI; ausente no repositorio inicial | Lock file e gerado pelo ambiente de execucao; sera commitado apos primeiro `uv sync` bem-sucedido |
| F2 | `config/settings/test.py` adicionado com SQLite in-memory | Docker nao disponivel localmente; SQLite permite rodar testes de constraint sem PostgreSQL; prod/dev continuam com PostgreSQL |
| F2 | Ruff per-file-ignores para `*/migrations/*.py` (E501) | Migrations sao codigo gerado pelo Django; violacoes de linha sao inevitaveis e fora do controle do dev |
| F3 | PRICE PMT para 8000/24/1.99% a.m. = 422.49 (nao 422.94 do plano sec. 8) | Calculo exato pela formula PMT=PV*i/(1-(1+i)^-n) resulta 422.49; "422.94" no plano e provavel inversao de digitos; juros totais ~2140 ficam dentro do "~2150" esperado |
| F5 | Setembro/2025 expense seeded = 3671.31, nao 3122.01 como em 10.4 | Secao 10.6 lista transacoes cujo total e 3671.31 (pagas+pendentes). A diferenca de 549.30 = FACULDADE 541.82 + CRUNCHYROLL 7.48 (is_paid=False). A tabela 10.4 foi calculada excluindo is_paid=False; porem sum_by_type conta todas. Incluir apenas is_paid=True no calculo mudaria Janeiro de 3283.06 para 3243.06, contradizendo o teste obrigatorio. Reportado ao orquestrador; parametrize usa valores reais do seed. |
| F4 | `User.objects.create_user` nao aceita email como username | `AbstractUser` com `username=None` ainda usa o `UserManager` base; solucao: instanciar `User` diretamente e chamar `set_password` |
| F4 | Cards invoices via URLs manuais em vez de drf-nested-routers | drf-nested-routers nao estava listado nas dependencias; URLs `path()` manuais com `card_pk` kwarg sao equivalentes e evitam dependencia nova |
| F4 | `filterset_fields` em TransactionViewSet usa lista multiline | Linha unica excedia 88 chars; multiline preserva legibilidade sem `# noqa` |
| F6 | parseMoney reescreve logica pt-BR: remove separadores de milhar (.) antes de trocar virgula por ponto | Regex original preservava o ponto dos milhares, causando parseFloat("1.234.56")=1.234 em vez de 1234.56; nova logica detecta virgula decimal e remove pontos primeiro |
| F6 | tsconfig.json inclui "types": ["vite/client"] | import.meta.env nao reconhecido sem o tipo Vite; skipLibCheck insuficiente para ImportMeta |
| F7 | AuthContext exportado como named export | Smoke tests precisam do Context diretamente para wrapper sem provocar fetch real |
| F7 | Analytics: category-trend lookup usa apenas month (sem year) | YearlyData.months nao carrega campo year; lookup por mes suficiente para dados do mesmo ano |
| F7 | HeatmapGrid usa grade 7×53 computada localmente | Endpoint retorna dados esparsos; cliente constroi grade completa do ano para consistencia visual |
| F7 | BarChart top-categories: fill por Cell nao suportado nativamente no Bar sem Cell children | Recharts Bar aceita fill inline por entrada via `Cell`; implementado como workaround com rect override no MSW (cor fixa aceitavel para smoke tests) |
| F7 | Endpoints analytics/heatmap, analytics/category-trends, analytics/top-categories adicionados ao MSW | Backend nao implementado ainda; MSW retorna dados mock validos para dev/test |
| Infra | Anonymous volume `/app/.venv` no backend + `.dockerignore` (backend e frontend) | Bind-mount `./backend:/app` sobrescrevia o `.venv` Linux do container com o `.venv` Windows do host (binarios incompativeis) -> backend crashava com `ModuleNotFoundError: No module named 'django.core'`. Volume anonimo protege em runtime; `.dockerignore` impede `COPY . .` de copiar `.venv`/`node_modules` do host na imagem em build-time. Mesmo padrao do guard `node_modules` que o frontend ja tinha |
