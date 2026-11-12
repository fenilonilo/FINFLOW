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
| Pós-F8 | Cartões integrados via PaymentMethod (card FK + card_function); fatura = soma automática por ciclo de fechamento; parcelado crédito gera Debt + N transações com competência da fatura | Spec não previa integração cartões↔lançamentos↔dívidas; Transaction como fonte única evita contagem dupla; detalhes em docs/superpowers/specs/2026-06-12-cards-credit-integration-design.md |
| Infra | Anonymous volume `/app/.venv` no backend + `.dockerignore` (backend e frontend) | Bind-mount `./backend:/app` sobrescrevia o `.venv` Linux do container com o `.venv` Windows do host (binarios incompativeis) -> backend crashava com `ModuleNotFoundError: No module named 'django.core'`. Volume anonimo protege em runtime; `.dockerignore` impede `COPY . .` de copiar `.venv`/`node_modules` do host na imagem em build-time. Mesmo padrao do guard `node_modules` que o frontend ja tinha |
| Refat-2026-11 | Refatoração simplificada (5 abas, fixos entrada/saída, importação Inter/Nubank) sobrepõe seções 5/6 | Pedido explícito do usuário; detalhes em docs/superpowers/specs/2026-11-11-refatoracao-simplificada.md |
| Refat-2026-11 | Fixos começam em 2026-11 (mês atual); Inter fecha 7/vence 14, Nubank fecha 8/vence 15; Apartamento/Leo dia 10; Trampo via Pix | Planilha não traz ano coerente nem ciclo dos cartões; vencimento = dia da planilha, fechamento = 7 dias antes |
| Refat-2026-11 | Sem testes novos nesta rodada | Usuário dispensou testes; validação feita rodando o sistema |

- Front: types/api.ts (gerado, sem aliases) não exporta mais Transaction/Card etc.; aliases manuais restaurados em frontend/src/types/models.ts (+ is_fixed, RecurringExpense.type/card/start_date, ImportResult) e imports repontados.
- Front: aba Cartões em Configurações reaproveita a página Cards.tsx inteira (CRUD + limite) em vez de duplicar o formulário.
- Front: Lançamentos mantém paginação do backend (50/página); seções Entradas/Saídas dividem a página atual.
- Front: edição de lançamento limitada ao valor (PATCH amount), com aviso para fixos.
| MCP | SDK `mcp<2` (FastMCP 1.x) em vez de 2.x | mcp 2.x renomeou FastMCP para MCPServer e mudou APIs; 1.30 é estável e é o `FastMCP` pedido |
| MCP | Auth bearer via middleware ASGI próprio (`hmac.compare_digest`) em vez do AuthSettings/OAuth do SDK | Token estático de dono único; OAuth seria over-engineering |
| MCP | `CreateTransactionDTO.import_key` + `TransactionRepository.get_by_import_key` | Idempotência do `add_transaction` reaproveitando `Transaction.import_key` (`mcp:<sha1>`), sem schema novo |
| MCP | `UserRepository.get_id_by_email` e `RecurringExpenseRepository.create` | ORM só em repositories; add_fixed não tinha service de criação (view usava serializer) |
| Import | Categorização de fatura via LLM local (llama-server, `/v1/chat/completions`) com `json_schema` enum das categorias do usuário; ordem palavra-chave → LLM → categoria do banco → Outros | Uma chamada por importação, saída restrita às categorias cadastradas; falha/desligado cai silenciosamente no fallback (só log warning) |
| Import | Importação aceita PDF da fatura Inter (pypdf) | Inter não exporta CSV de fatura |
| Cartões | Card.bank (enum) e Card.is_active; PMs de cartão inativo somem das listagens (exceto include_archived) e importação é bloqueada | Permite desativar cartão sem perder histórico |
| Cartões | Fatura de cartão deixa de ser gasto fixo; R3/R4 removidos, só itens importados contam. Campo RecurringExpense.card mantido sem uso | Evita duplicação fixo×itens da fatura |
| Import | POST /imports/statement/ aceita dry_run e categories (JSON indice -> id; null = fallback "Outros" sem LLM); itens ganham index/category_id; dry-run responde 200, nao persiste e nunca cria "Outros" (category_id null se ainda nao existe) | Previa na tela Importar sem duplicar a logica (atomic + set_rollback); confirmar reenviando o mapa devolvido e consistente |
| Import | Model StatementImport (historico de importacoes reais) e GET /imports/ (12 mais recentes do usuario) | Tela Importar exibe historico; gravado no mesmo atomic, fora do dry-run |
| Conta | User.avatar (FileField, media/avatars/), PATCH /auth/me/ e POST/DELETE /auth/me/avatar/; avatar_url relativo; so JPEG/PNG por assinatura, max 2 MB; /media servido por Django em DEBUG | Tela Conta → Perfil; URL relativa funciona atras do proxy do Vite |
| Conta | JWT carrega claim `sid` (DeviceSession.id); login sempre cria sessao nova ("Dispositivo" por padrao); auth/refresh recusam `sid` revogado (401), token sem `sid` segue valido; DELETE auth/sessions/{id}/ e logout revogam de verdade; last_seen_at atualizado no max. 1x/min; DeviceSession ganha `is_current` | Tela Conta → Dispositivos marca a sessao atual e encerra as outras de fato |
| Redesign | Sem `motion`: leque e flip usam integrador de mola próprio (`lib/spring.ts`); única dependência nova de animação é `three` (touro) | Integrador do protótipo já verificado (~20 linhas); evita lib extra |
| Redesign | Gráfico da Visão em SVG próprio; `recharts` removido | Protótipo usa SVG; recharts ficou sem uso |
| Redesign | Projeção do próximo mês: fixos = soma dos fixos ativos; variáveis = mesmo mês do ano anterior, senão média dos últimos 6 meses | Estimativa simples sem modelo estatístico |
| Redesign | Linha de receita tracejada por mês (degrau), não uma linha única | Receita muda por mês; degrau não sugere interpolação |
| Redesign | Fontes auto-hospedadas via `@fontsource` | Sem dependência do Google Fonts em runtime |
| Redesign | Rotas: `/` Lançamentos, `/import`, `/overview`, `/settings/:tab`, `/account/:tab`, `/login`; rotas antigas removidas (qualquer outra vai para `/`) | Cinco abas do protótipo; páginas legadas apagadas |
| Redesign | Botão "Esconder interface" do protótipo não entra no produto | Era só recurso de demonstração |
| Redesign | Chips de fixos alternam pago com um clique; linha de movimentação abre edição no sheet | Fluxo do protótipo |
| Redesign | Mês/ano do cartão de perfil e das telas seguem o mês selecionado (`PeriodContext`) | Fonte única do período |
| Redesign | Fatura paga ganha controle em Faturas abertas e em Ajustes → Cartões | Sem isso o limite usado fica errado |
| Redesign | Fixos vencidos e não pagos continuam em Próximos vencimentos com etiqueta "vencido" | Não esconder pendência atrasada |
| Redesign | Movimentações mantém busca, filtros extras e pago por linha | Nenhuma função em uso se perde |
| Redesign | Celular fora de escopo: abaixo de 1100px as grades viram uma coluna, sem navegação mobile nem ajuste do touro | Foco desktop nesta versão |
