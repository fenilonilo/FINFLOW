# Spec — Cartões integrados: crédito/débito, fatura automática, limite e dívidas

**Data:** 2026-06-12
**Status:** Aprovada (brainstorming concluído)
**Módulos afetados:** `cards`, `core`, `transactions` (Transaction + Debt), frontend (Cartões, Lançamentos, Dívidas)

## 1. Problema

A página de Cartões hoje é um cadastro isolado: mostra "Sem fatura para este mês" sem
oferecer onde lançar a fatura, não tem limite nem gasto atual, e nada conecta cartões
aos Lançamentos, ao Dashboard ou às Dívidas. Para registrar a fatura o usuário teria
que criar categoria e lançamento manuais — atrito alto e risco de contagem dupla.

## 2. Decisões de design (aprovadas em brainstorming)

| # | Decisão | Alternativa rejeitada |
|---|---------|----------------------|
| D1 | Gasto atual do cartão = soma dos lançamentos pagos com o cartão | Campo manual; valor da fatura digitado |
| D2 | Fatura = soma automática dos lançamentos do ciclo; usuário só marca "paga" | Fatura lançada à mão como gasto fixo variável |
| D3 | Ciclo real de fechamento (`closing_day`), não mês calendário | Mês calendário |
| D4 | Cartão vinculado a `PaymentMethod` auto-criada (Abordagem A) | FK direta `Transaction.card` (Abordagem B) |
| D5 | Crédito e débito têm comportamentos distintos (competência, limite) | Tratamento único |
| D6 | Compra parcelada no crédito gera `Debt` + N transações futuras de uma vez | Parcelas manuais mês a mês |
| D7 | `Transaction` é a fonte única de verdade; fatura, limite e dívida derivam dela | Estados duplicados por módulo |

## 3. Modelo de dados

### 3.1 `cards.Card` (alterar)

```python
limit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
```

- `limit` opcional; só faz sentido para cartões com função crédito.

### 3.2 `core.PaymentMethod` (alterar)

```python
class CardFunction(models.TextChoices):
    CREDIT = "credit"
    DEBIT = "debit"

card = models.ForeignKey(
    "cards.Card", null=True, blank=True,
    on_delete=models.SET_NULL, related_name="payment_methods",
)
card_function = models.CharField(
    max_length=10, choices=CardFunction.choices, null=True, blank=True
)
```

- Constraint: `card_function` preenchido ⇔ `card` preenchido (CheckConstraint).
- Unicidade: um cartão tem no máximo uma forma por função
  (`UniqueConstraint(card, card_function)`).

### 3.3 `cards.CardInvoice` (semântica nova, schema igual)

- `amount` passa a ser **snapshot**: gravado apenas no momento de marcar paga.
- Enquanto a fatura não é paga, o valor exibido é sempre calculado ao vivo.
- Linha criada via `get_or_create(card, year, month)` no ato do pagamento.

### 3.4 `transactions.Transaction` (alterar)

```python
debt = models.ForeignKey(
    "transactions.Debt", null=True, blank=True,
    on_delete=models.CASCADE, related_name="installments",
)
```

- `on_delete=CASCADE` proposital — exclusão de dívida remove parcelas, mas o service
  só permite excluir dívida depois de desvincular/preservar parcelas pagas (seção 7).
- Competência (`year`/`month`) deixa de ser sempre derivada de `date` (seção 4.1):
  `save()` só deriva se `year`/`month` não vierem preenchidos pelo service.

### 3.5 `transactions.Debt` (alterar)

```python
class DebtOrigin(models.TextChoices):
    MANUAL = "manual"
    CARD_PURCHASE = "card_purchase"

origin = models.CharField(
    max_length=20, choices=DebtOrigin.choices, default=DebtOrigin.MANUAL
)
```

## 4. Regras de negócio

### 4.1 Competência de compra no crédito

- Ciclo da fatura do mês M: de `(closing_day + 1)` do mês M−1 até `closing_day` do mês M.
  Dias de fechamento maiores que o último dia do mês são limitados ao último dia
  (fechamento 31 em fevereiro → dia 28/29).
- Compra crédito em data D → competência = mês M cujo ciclo contém D.
  Exemplo: fechamento dia 3; compra 05/06 → fatura de julho → `year=2026, month=7`.
- A transação **preserva `date` real da compra**; apenas `year`/`month` (competência)
  apontam para o mês da fatura. Dashboard, Lançamentos e Analytics já agrupam por
  `year`/`month`, então a compra aparece no mês da fatura sem mudança nesses módulos.
- Compra débito → comportamento atual: competência = mês da data da compra.
- Trocar a forma de pagamento de uma transação existente (débito↔crédito ou entre
  cartões) recalcula a competência.

### 4.2 Vencimento da fatura

- `due_date` da fatura de M: `due_day` de M se `due_day > closing_day`; caso contrário,
  `due_day` de M+1. Mesmo clamp de fim de mês.

### 4.3 Valor da fatura

```
fatura(card, M) = Σ Transaction(expense, payment_method ∈ formas crédito do cartão,
                                competência = M)
```

- Independe de `is_paid` da transação (compra no crédito é gasto comprometido).
- Se `CardInvoice(card, M)` existe e `is_paid=True`, exibe-se o snapshot `amount`.
  Se o valor calculado divergir do snapshot, a API expõe ambos e o front exibe badge
  "valor divergente".

### 4.4 Limite comprometido (fórmula única)

```
comprometido(card) = Σ compras crédito do cartão cuja fatura (competência) ainda não está paga
```

- Cobre ciclo aberto, faturas fechadas pendentes e parcelas futuras sem caso especial:
  parcela futura → competência futura → fatura inexistente/não paga → comprometida.
- `gasto do ciclo aberto` (exibição separada no card) = compras crédito com competência
  no ciclo corrente.
- Débito nunca toca limite.

### 4.5 Compra parcelada no crédito (integração com Dívidas)

Lançamento com forma crédito + "Parcelado em N×" dispara, em transação atômica:

1. Cria `Debt`: `origin=card_purchase`, `creditor=descrição`, `total_amount=valor total`,
   `installment_total=N`, `installment_amount=total/N` (ajuste de centavos na última
   parcela), `installment_current=0`, `payment_method=forma crédito usada`,
   `start_date=data da compra`.
2. Cria N `Transaction` de uma vez: parcela k com `debt=FK`, `installment_current=k`,
   `installment_total=N`, `amount=parcela`, `date=data da compra`, competência =
   mês da fatura da compra + (k−1) meses.
3. Cada parcela entra na fatura e nos Lançamentos do seu mês automaticamente (4.3).

### 4.6 Pagar fatura

`pay-invoice(card, M)` em transação atômica:

1. `get_or_create CardInvoice(card, M)`; grava `amount=valor calculado`, `is_paid=True`,
   `due_date` (4.2).
2. Marca `is_paid=True` em todas as transações crédito do cartão com competência M.
3. Para cada `Debt` com parcela em M nesse cartão: `installment_current =
   max(installment_current, installment_current da parcela paga)`; se atingiu
   `installment_total` → `is_settled=True`.
4. Despagar (`is_paid=False`) reverte: transações de M voltam a `is_paid=False`,
   dívidas têm `installment_current` recalculado a partir das parcelas pagas restantes,
   `is_settled` revisto. Snapshot `amount` é limpo (volta a calcular ao vivo).

### 4.7 Ciclo de vida

- **Criar cartão**: form escolhe função (Crédito / Débito / Ambos). Service cria 1–2
  `PaymentMethod` ("{nome} Crédito", "{nome} Débito") com cor do cartão e ícone
  `credit-card`.
- **Renomear cartão / mudar cor**: propaga para as formas vinculadas.
- **Excluir cartão**: formas de pagamento vinculadas são arquivadas
  (`is_archived=True`), nunca deletadas — lançamentos antigos preservam a FK.
  Faturas (`CardInvoice`) são removidas com o cartão (comportamento atual, CASCADE).
- **Excluir dívida de cartão**: remove apenas parcelas não pagas; parcelas pagas são
  desvinculadas (`debt=NULL`) e preservadas.
- **Editar dívida de cartão** (valor/parcelas): recalcula apenas parcelas não pagas.
- **Dívidas manuais** (`origin=manual`): comportamento atual intacto, incluindo o
  botão `advance`.

## 5. API (`/api/v1/`)

### 5.1 `GET /cards/summary/?year=&month=`

```json
[
  {
    "card_id": 1,
    "name": "Nubank",
    "color": "#820ad1",
    "functions": ["credit", "debit"],
    "limit": "5000.00",
    "committed": "1830.50",
    "committed_pct": "36.61",
    "open_cycle_spend": "412.30",
    "invoice": {
      "amount": "987.40",
      "snapshot_amount": null,
      "is_paid": false,
      "divergent": false,
      "cycle_start": "2026-05-04",
      "cycle_end": "2026-06-03",
      "due_date": "2026-06-10"
    }
  }
]
```

- Dinheiro como string decimal (regra global). `limit` e `committed_pct` null quando
  limite não definido.
- `snapshot_amount` preenchido somente quando fatura paga; `divergent=true` quando
  `amount` calculado ≠ snapshot.

### 5.2 `POST /cards/{id}/pay-invoice/`

- Body: `{"year": 2026, "month": 6, "is_paid": true}` (`is_paid: false` despaga).
- Resposta: objeto `invoice` da seção 5.1. Erros no envelope padrão.

### 5.3 `POST /cards/` e `PATCH /cards/{id}/`

- Body ganha `limit` (string decimal, opcional) e `functions`
  (lista: `["credit"]`, `["debit"]` ou `["credit", "debit"]`).
- View fina → `CardService.create_card` / `update_card` (cria/propaga formas).
- Adicionar função a cartão existente cria a forma que falta; remover função arquiva a
  forma correspondente.

### 5.4 `POST /transactions/` (parcelado)

- Body ganha campos opcionais: `"installments": 6` (int ≥ 2) + valor total em `amount`.
- Válido apenas com forma de pagamento crédito; senão erro de validação no envelope
  padrão.
- Resposta: transação da 1ª parcela + header/campo `debt_id`.

### 5.5 OpenAPI

- Schemas novos anotados via drf-spectacular; frontend regenera com
  `npm run generate-types`.

## 6. Frontend

### 6.1 Cartões (`Cards.tsx`)

- Form: campo "Limite (opcional)" + seleção de função (Crédito / Débito / Ambos).
- Card na grade:
  - Barra de uso `comprometido / limite` — verde < 70 %, amarelo < 90 %, vermelho ≥ 90 %.
    Sem limite definido → sem barra.
  - Fatura do mês selecionado (sempre exibe valor; R$ 0,00 se ciclo vazio — o estado
    "Sem fatura para este mês" deixa de existir).
  - Datas do ciclo e vencimento; botão Paga/Pendente chama `pay-invoice`.
  - Badge "valor divergente" quando aplicável.
- Fonte de dados: `GET /cards/summary/` (substitui as duas queries atuais).

### 6.2 Lançamentos

- Seletor de forma de pagamento exibe badge Crédito/Débito nas formas de cartão.
- Forma crédito selecionada → aviso "Entra na fatura de {mês}" + toggle "Parcelado?"
  com nº de parcelas (2–48).
- Lista: parcelas mostram `k/N` (campos já existem).

### 6.3 Dívidas

- Dívidas `card_purchase`: badge com nome/cor do cartão; progresso avança sozinho ao
  pagar faturas; botão `advance` oculto para essas.

## 7. Casos de borda

| Caso | Comportamento |
|------|---------------|
| Fechamento dia 29–31 em mês curto | Clamp para último dia do mês |
| `due_day ≤ closing_day` | Vencimento no mês seguinte ao fechamento |
| Lançamento retroativo em fatura já paga | Snapshot congelado; badge "divergente" |
| Cartão sem limite | Sem barra; fatura e comprometido exibidos normalmente |
| Forma de cartão arquivada manualmente | Some do seletor de lançamentos; histórico do cartão intacto |
| Trocar payment_method de transação existente | Recalcula competência (e fatura dos dois lados) |
| Excluir dívida de cartão | Remove parcelas não pagas; pagas desvinculadas e mantidas |
| Despagar fatura | Reverte is_paid das parcelas, recalcula progresso das dívidas, limpa snapshot |
| Virada de ano (compra dez → fatura jan) | Competência year+1; testes cobrem |

## 8. Testes (TDD obrigatório)

- **Domain (unit)**: cálculo de ciclo (meses curtos, virada de ano, due ≤ closing),
  competência crédito vs débito, fórmula de comprometido, geração de parcelas
  (ajuste de centavos), pay/unpay com avanço/reversão de dívida.
- **API**: summary (formato, strings decimais), pay-invoice (idempotência, despagar),
  criação de cartão cria formas, parcelado cria dívida + N transações, validação de
  parcelado sem crédito.
- **Front (smoke)**: barra de limite, badge divergente, toggle parcelado condicionado
  a crédito.
- Gate: `uv run pytest --cov=apps --cov-fail-under=85 && uv run ruff check .`

## 9. Fora de escopo (v1)

- Geração automática de parcelas para compras parceladas **fora** de cartão.
- Juros rotativo / pagamento parcial de fatura.
- Importação de fatura (OFX/CSV).
- Múltiplas moedas.

## 10. Migração de dados existentes

- Cartões existentes: `limit=NULL`, sem formas vinculadas — usuário edita o cartão e
  escolhe funções para gerar as formas (sem migração automática de dados; evita
  adivinhação errada de vínculo com formas existentes).
- `CardInvoice` existentes mantêm `amount` como snapshot e `is_paid` atual.
- Transações existentes: competência intocada.
