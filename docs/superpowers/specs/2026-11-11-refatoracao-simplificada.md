# Refatoração simplificada — FinFlow (2026-11-11)

Pedido do usuário: sistema o mais simples possível. Esta spec SOBREPÕE as seções 5/6 do plano onde houver conflito.
O usuário dispensou testes nesta rodada: NÃO escreva testes novos; valide rodando de verdade (container).
Ambiente: tudo roda no docker (`docker compose exec backend uv run ...`). NUNCA rode uv/npm no host.

## Abas (frontend)
Só 5 itens no menu, todos dependentes do mês do MonthPicker (topbar, já existe):
1. **Dashboard** — KPIs do mês: Entradas, Saídas, Saldo, Fixos, Variáveis; gastos por categoria.
2. **Lançamentos** — lista do mês (entradas e saídas, fixos marcados com badge "Fixo"); criar/editar/excluir; checkbox "Fixo (repete todo mês)" no formulário.
3. **Importar** — upload de fatura/extrato de cartão (Inter ou Nubank).
4. **Análise** — por categoria, por origem (forma de pagamento: ex. "Inter Crédito", "Inter Débito", "Pix"), fatura de cada cartão, entradas × saídas.
5. **Configurações** — categorias, formas de pagamento, cartões (nome, fechamento, vencimento, limite), gastos/entradas fixos (lista com valor atual, pausar/excluir).

Remover do menu e das rotas: Gastos Fixos, Aquisições, Investimentos, Cartões, Dívidas (arquivos podem ficar). Formulários: só os campos necessários
(tipo entrada/saída, descrição, valor, data, categoria, forma de pagamento, fixo?, parcelas só se crédito, pago?). Nada de "kind" manual (fixo/variável deriva do checkbox).

## Regras de negócio
- R1 **Fixos (entradas e saídas)** = `RecurringExpense` com `type` income|expense. Gerados automaticamente (idempotente) para o mês sempre que o mês é consultado
  (lista de transações e summary chamam `ensure_month(user, year, month)`). Não gerar para meses anteriores a `start_date`. Templates `is_variable` usam `default_amount` (sem fluxo de pendentes).
- R2 **Alterar valor de um fixo em um mês** (PATCH amount numa transação com `recurring_source`) ⇒ `template.default_amount = novo valor` e todas as transações
  do mesmo template em meses POSTERIORES e não pagas recebem o novo valor. Meses anteriores ficam intactos.
- R3 **Fixo vinculado a cartão** (`RecurringExpense.card` não nulo) = a fatura daquele cartão. Valor do mês = soma das transações de crédito daquele cartão
  (payment_method.card=card, card_function=credit) com competência (year/month) no mês, se houver alguma; senão `default_amount`. Re-sincronizar após importação.
- R4 **Sem contagem dupla**: no summary/análise, `total_expense` NÃO soma itens de crédito de cartões que têm fixo vinculado (a fatura já conta);
  `by_category` NÃO soma a transação-fatura (fixo vinculado a cartão) quando há itens de crédito no mês (usa os itens, que têm categoria real).
- R5 **Débito** importado entra como despesa variável com `payment_method` = forma "débito" do cartão (origem da compra).
- R6 **Importação**: formatos CSV Inter (fatura: `Data,Lançamento,Categoria,Tipo,Valor` com "R$ 1.234,56"; extrato conta: `;` com Data Lançamento/Descrição/Valor),
  CSV Nubank (fatura: `date,title,amount`; conta: `Data,Valor,Identificador,Descrição`) e OFX (genérico). Detectar formato pelo cabeçalho.
  Entrada: arquivo, `card_id`, `kind` credit|debit, `year`/`month` (mês da fatura, só p/ crédito — itens de crédito recebem year/month = mês da fatura).
  Ignorar pagamentos de fatura/estornos de pagamento. Linhas "Parcela X/Y" → installment_current/total. Dedup: `Transaction.import_key` (sha1 de card+data+descrição+valor+índice de ocorrência)
  único por usuário; e pular item que bate valor+mês+tipo com transação fixa existente (ex. Spotify, salário). Entradas (créditos em conta) viram income variável.
  Categoria por palavra-chave (uber/99→Uber/transporte, ifood/restaurante→Alimentação, mercado/supermerc→Mercado, farmac/drogar→Saúde, spotify/netflix/prime/youtube→Assinaturas,
  posto/combust→Uber/transporte); senão categoria da coluna do banco se existir com mesmo nome; senão "Outros".
  Resposta: `{"created": int, "skipped": int, "total": "decimal", "items": [{"date","description","amount","category","status": "created"|"duplicate"|"ignored"}]}`.

## Schema (agent-db)
- `RecurringExpense`: + `type` (TransactionType, default expense), + `card` FK `cards.Card` null SET_NULL related_name `fixed_expenses`, + `start_date` DateField null.
- `Transaction`: + `import_key` CharField(64) null/blank; UniqueConstraint(user, import_key) condition import_key not null.

## API (agent-api)
- `GET /api/v1/transactions/?year=&month=` e summary do mês chamam `ensure_month` antes.
- `PATCH /api/v1/transactions/{id}/` com amount em fixo ⇒ R2 (via service).
- `/api/v1/recurring-expenses/` CRUD expõe `type`, `card`, `start_date`. Ao criar fixo, gerar já o mês de start_date.
- `POST /api/v1/imports/statement/` multipart (`file`, `card_id`, `kind`, `year`, `month`) → resposta R6.
- Transaction serializer expõe `is_fixed` (bool) e `recurring_source`.
- Regenerar schema OpenAPI para o front (`npm run generate-types` dentro do container frontend).

## Dados reais (agent-seed) — usuário fenilo.projetos@gmail.com, início 2026-11 (mês atual)
Formas de pagamento: Débito, Pix, Boleto, Dinheiro. Cartões: Inter (fecha 7, vence 14), Nubank (fecha 8, vence 15) — via CardService (cria "X Crédito"/"X Débito").
Categorias: Salário, IMPOSTO, Saúde, Contas, Uber/transporte, Essencial, Lazer, Casa, Contabilizei, Educação, Bobeira, Alimentação, Beleza, Roupa, Mercado, Aluguel, Assinaturas, Outros, Filhos, Pet, Presentes, Viagem.
Fixos (start_date 2026-11-01):
| tipo | categoria | descrição | forma | dia | valor | cartão |
|---|---|---|---|---|---|---|
| income | Salário | Trampo | Pix | 10 | 8000.00 | |
| expense | IMPOSTO | Darf | Débito | 15 | 278.85 | |
| expense | IMPOSTO | Das | Débito | 15 | 480.00 | |
| expense | Saúde | Unimed | Boleto | 12 | 384.76 | |
| expense | Saúde | QLaira | Pix | 13 | 60.00 | |
| expense | Contas | Inter | Débito | 14 | 996.14 | Inter |
| expense | Uber/transporte | Nubank | Débito | 15 | 935.34 | Nubank |
| expense | Essencial | Internet | Pix | 16 | 158.39 | |
| expense | Lazer | Spotify | Débito | 17 | 13.00 | |
| expense | Casa | Apartamento | Boleto | 10 | 2199.20 | |
| expense | Contabilizei | Contabilidade | Débito | 15 | 255.00 | |
| expense | Educação | Faculdade | Pix | 6 | 569.62 | |
| expense | Casa | Leo | Pix | 10 | 1500.00 | |
Total saídas fixas = 7830.30; entradas = 8000.00.
