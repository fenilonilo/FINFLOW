# FinFlow — Redesign do frontend · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o frontend atual pelas 6 telas do protótipo aprovado (Login, Lançamentos, Importar, Visão, Ajustes, Conta) com dados reais da API. O backend ganha só o que as telas pedem (Tasks 18–21: prévia e histórico de importação, perfil editável com foto, revogação real de sessão).

**Architecture:** Fundação nova (tokens, shell, touro WebGL, cartão metálico, leque, flip, sheet) sobre o React Query + axios já existentes. Lógica de tela vai para funções puras em `src/lib/` testadas isoladamente. As páginas só compõem os componentes e chamam os hooks de `src/api/`. As páginas órfãs saem no fim.

**Tech Stack:** React 18, Vite 5, TS strict, Tailwind 3, React Query 5, RHF + Zod, MSW 2, Vitest + Testing Library. Novas dependências: `three@0.160.0`, `@types/three`, `@fontsource/playfair-display`, `@fontsource/manrope`.

**Spec:** `docs/superpowers/specs/2026-11-12-frontend-redesign-design.md`
**Protótipo (fonte de verdade visual):** `docs/superpowers/specs/2026-11-12-frontend-redesign/prototipo.html`
- Telas: `<section id="s-lanc|s-imp|s-visao|s-ajustes|s-conta">`, linhas 447–670.
- `makeCard`: linha 751.
- `makeFan`: linha 774.
- Flip: linha 915.
- Visão: linha 982.
- Metal: linha 1043.
- Touro: linhas 1185–fim (com `touro-referencia.html`).

**Dono:**
- Tasks 18–21 (backend, executadas ANTES da Task 1): `agent-db` (models/migrações) + `agent-domain` (services) + `agent-api` (views/serializers), conforme a task.
- Tasks 1–10: `agent-front-core`.
- Tasks 11–17: `agent-front-pages`.

**Ordem de execução:** 18, 19, 20, 21, 1, 2, …, 17.

## Global Constraints

- **Dinheiro:**
  - Trafega e é somado como string decimal.
  - Somas e comparações usam `lib/money.ts` (centavos inteiros via `BigInt`), nunca `parseFloat` em conta.
  - Formatação só na borda (`formatMoney`).
- **Backend:** TDD com pytest; views finas → services → repositories (único lugar com ORM); exceções de domínio em `apps/common/exceptions.py`; `docker compose exec backend uv run pytest --cov=apps --cov-fail-under=85 && docker compose exec backend uv run ruff check .` verde ao fim de cada task de back. Nada de `pip`/`requirements.txt`; sem dependência nova (nem Pillow: validar imagem por assinatura de bytes). Tabelas e campos novos são aditivos; registrar 1 linha em `DECISIONS.md` por mudança de schema/contrato.
- **Types:** `src/types/api.ts` nunca é editado à mão. Tipos de UI vão para `src/types/models.ts`.
- **Comandos:** rodar dentro do container, nunca no host com o container de pé.
  - Testes: `docker compose exec frontend npm test -- <arquivo>`.
  - Build: `docker compose exec frontend npm run build`.
  - Instalação: `docker compose exec frontend npm install <pkg>`.
- **TDD:**
  - Teste antes do código.
  - Commits `test:` / `feat:` / `refactor:` / `chore:`.
  - Branch `feat/frontend-redesign`, criada a partir de `main` antes da Task 1. A `main` tem mudanças não commitadas que não são deste trabalho: não incluí-las nos commits.
- **DECISIONS.md:** recebe 1 linha por decisão da §12 do spec (itens 1–17), na Task 17.
- **Tokens (copiar do `<style>` do protótipo):**
  - Fundo `#040605`, `--g #7ee08a`, `--g2 #3f9a50`, `--mu #8aa38e`.
  - Vidro `rgba(10,18,12,.5)` + `blur(16px) saturate(140%)`, raio 20px.
  - Easing `cubic-bezier(.2,.8,.2,1)`.
  - Gráfico: fixos `#5b8fc7`, variáveis `#3f9a50`.
- **Fontes:**
  - Playfair Display: títulos (H1 em caixa alta espaçada), nomes, frase da Visão.
  - Manrope: corpo e números, com `font-variant-numeric: tabular-nums lining-nums`.
- **Animação:**
  - Toda animação não essencial respeita `prefers-reduced-motion`.
  - Sem lib de animação: molas via `lib/spring.ts`.
- **Textos:** UI em pt-BR, exatamente como no protótipo (rótulos, eyebrows, dicas).
- **Telas estreitas:** abaixo de 1100px as grades viram uma coluna. Sem nav mobile própria.

## Review Focus

1. **Mês sem dados:** sem transações, sem fixos gerados e sem cartões de crédito. Todas as telas renderizam estados vazios sem erro; Fixos mostra "Gerar fixos do mês". Teste na Task 11.
2. **Mais de 50 lançamentos no mês:** a API pagina com `PAGE_SIZE 50`. Movimentações, Próximos vencimentos e Fixos precisam de todos os itens. `useMonthTransactions` segue `next` até o fim. Teste na Task 4.
3. **Valores com centavos somados em muitas linhas:** total do dia, total a vencer e resumo batem no centavo. `sumMoney(['0.10','0.20'])` resulta em `'0.30'`. Teste na Task 2.
4. **Cartão sem limite (`limit null`) ou sem crédito:** fora do leque de Faturas, e sem barra de limite. Não pode aparecer NaN nem "null". Teste na Task 11.
5. **Browser sem WebGL ou `localStorage` bloqueado:**
   - O app funciona: fundo só gradiente, cartão sem camada metálica.
   - `device_name` gerado sem quebrar o login.

   Testes nas Tasks 3 e 6.

---

### Task 1: Dependências, tokens, fontes e CSS global

**Files:**
- Modify: `frontend/package.json`, `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/src/main.tsx`
- Delete: `frontend/src/contexts/ThemeContext.tsx` e todos os usos (só existe tema escuro)

**Interfaces:**
- Produces:
  - Classes Tailwind: `bg-ink` (#040605), `text-g`, `text-mu`, `font-display` (Playfair), `font-sans` (Manrope).
  - Classes CSS globais: `.glass`, `.eyebrow`, `.h1` (Playfair caixa alta espaçada), `.num` (tabular-nums), `.btn`, `.btn.line`, `.pill`, `.rise` (entrada em cascata, delay via `--i` × 55ms).
  - Overlay de grão animado em `body::after`.

- [ ] **Step 1: Instalar as dependências.** `docker compose exec frontend npm install three@0.160.0 @fontsource/playfair-display @fontsource/manrope && docker compose exec frontend npm install -D @types/three`
- [ ] **Step 2: Fontes e tokens.**
  - Importar as fontes em `main.tsx`: playfair-display 400/400-italic e manrope 400/500/600/700.
  - Remover `ThemeProvider`.
  - Copiar para `index.css` os tokens `:root` e as regras `.glass` / `.eyebrow` / `.btn` / `.pill` / grão / `rise` do protótipo.
  - Mapear as cores no `tailwind.config.js`.
- [ ] **Step 3: Verificar.** `docker compose exec frontend npm run build`: compila. A suíte antiga pode quebrar só por causa do `ThemeProvider`; ajustar o wrapper de `src/test/pages.test.tsx`.
- [ ] **Step 4: Commit.** `chore: tokens, fontes e dependencias do redesign`

### Task 2: Molas e dinheiro (lógica pura)

**Files:**
- Create: `frontend/src/lib/spring.ts`, `frontend/src/lib/spring.test.ts`, `frontend/src/lib/money.ts`, `frontend/src/lib/money.test.ts`

**Interfaces:**
- Produces:
  - `type Spring = { p: number; v: number; t: number; k: number; c: number }`
  - `spring(p: number, k: number, c: number): Spring`
  - `stepSprings(springs: Spring[], dt: number): boolean`: semi-implícito de Euler com sub-passos de 240 Hz (`n = ceil(dt*240)`) e `dt` limitado a 0.05. Faz snap quando `|t-p|<.01 && |v|<.05`. Retorna `true` enquanto alguma mola se move. É o loop do protótipo, linhas 949–957.
  - `sumMoney(values: string[]): string`, `subMoney(a: string, b: string): string`, `cmpMoney(a: string, b: string): -1|0|1`, `pct(part: string, whole: string): number` (0–100, 1 casa; `whole` 0 → 0).

- [ ] **Step 1: Escrever os testes que falham.**
  ```ts
  test('spring settles on target', () => { const s = spring(0, 170, 20); s.t = 180; let i = 0; while (stepSprings([s], 1/60) && i++ < 600); expect(s.p).toBe(180); expect(s.v).toBe(0) })
  test('stepSprings reports idle when at rest', () => expect(stepSprings([spring(1, 320, 26)], 1/60)).toBe(false))
  test('sumMoney is exact', () => { expect(sumMoney(['0.10','0.20'])).toBe('0.30'); expect(sumMoney([])).toBe('0.00'); expect(sumMoney(['-12.50','100'])).toBe('87.50') })
  test('pct handles zero whole', () => { expect(pct('50.00','200.00')).toBe(25); expect(pct('1','0')).toBe(0) })
  ```
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/lib/spring.test.ts src/lib/money.test.ts`: FAIL (módulos inexistentes).
- [ ] **Step 3: Implementar** as assinaturas acima.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: integrador de mola e soma decimal exata`

### Task 3: Mapeadores de tela (lógica pura)

**Files:**
- Create: `frontend/src/lib/month.ts` + `month.test.ts`, `frontend/src/lib/overview.ts` + `overview.test.ts`, `frontend/src/lib/device.ts` + `device.test.ts`

**Interfaces:**
- Consumes:
  - `Transaction`, `RecurringExpense`, `PaymentMethod`, `MonthSummary` de `@/types/models`.
  - `sumMoney`, `cmpMoney` (Task 2).
- Produces (`month.ts`):
  - `isEstimated(tx: Transaction, recurring: RecurringExpense[]): boolean`: `tx.recurring_source` aponta para um recorrente com `is_variable`.
  - `fixosProgress(txs: Transaction[]): { total: string; paid: string; pending: string; pct: number; items: Transaction[] }`: só `is_fixed && type==='expense'`.
  - `dueList(txs: Transaction[], today: string): { items: Array<Transaction & { overdue: boolean }>; total: string }`. Inclui os fixos não pagos do mês, com os vencidos (`date < today`) primeiro e depois os demais por data. O `total` é igual a `fixosProgress(txs).pending`.
  - `groupByDay(txs: Transaction[]): Array<{ date: string; total: string; items: Transaction[] }>`: dias em ordem decrescente; o total do dia soma entradas positivas e saídas negativas.
  - `type LedgerFilter = 'all'|'income'|'expense'|'card'`.
  - `filterLedger(txs: Transaction[], f: LedgerFilter, cardPmIds: Set<number>): Transaction[]`: `card` usa os ids das formas de pagamento com `card_detail` não nulo.
  - `catCols(n: number): 3|4`: par dá 4, ímpar dá 3.
- Produces (`overview.ts`):
  - `type MonthPoint = { year: number; month: number; fixed: string; variable: string; income: string; projected: boolean }`.
  - `buildSeries(summaries: MonthSummary[]): MonthPoint[]`: ordem cronológica.
  - `projectNext(series: MonthPoint[], activeFixedTotal: string): MonthPoint`. Fixos = `activeFixedTotal`. Variáveis = mesmo mês do ano anterior se existir na série; senão, média dos últimos 6 meses (arredondada ao centavo). `income` = receita do último mês.
  - `headline(p: MonthPoint, prev: MonthPoint | undefined): { spent: string; deltaPct: number | null; left: string; projected: boolean }`.
- Produces (`device.ts`):
  - `deviceName(ua: string): string`: formato `"<Navegador> · <Sistema>"`. Navegadores: Chrome / Edge / Firefox / Safari / Navegador. Sistemas: Windows / macOS / Android / iOS / Linux. No máximo 80 caracteres.
  - `getDeviceName(): string`: lê e grava `localStorage['ff_device']` dentro de try/catch; se o storage falhar, devolve `deviceName(navigator.userAgent)`.

- [ ] **Step 1: Escrever os testes que falham** (valores exatos):
  ```ts
  // month.test.ts — fixtures: fixo pago 100.00 (dia 05), fixo pendente 50.10 (dia 10), fixo pendente 20.00 (dia 20), variável 30.00
  expect(fixosProgress(txs)).toMatchObject({ total: '170.10', paid: '100.00', pending: '70.10' })
  expect(dueList(txs, '2026-11-12').items.map(t => [t.date, t.overdue])).toEqual([['2026-11-10', true], ['2026-11-20', false]])
  expect(dueList(txs, '2026-11-12').total).toBe(fixosProgress(txs).pending)
  expect(groupByDay(txs)[0].date).toBe('2026-11-20')
  expect(catCols(8)).toBe(4); expect(catCols(7)).toBe(3)
  expect(filterLedger(txs, 'card', new Set([9])).every(t => t.payment_method === 9)).toBe(true)
  // overview.test.ts
  expect(projectNext(series13WithLastYearDec, '1000.00')).toMatchObject({ month: 12, fixed: '1000.00', variable: '<variável de dez/2025 da fixture>', projected: true })
  expect(projectNext(series3, '1000.00').variable).toBe('<média dos 3 meses da fixture, ao centavo>')
  expect(headline(nov, oct).deltaPct).toBeCloseTo(-12.5, 1)
  expect(headline(nov, undefined).deltaPct).toBeNull()
  // device.test.ts
  expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36')).toBe('Chrome · Windows')
  expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS')
  // getDeviceName com localStorage lançando: não lança e devolve string não vazia
  ```
  O implementador escreve as fixtures com os números acima; os marcados `<...>` são calculados a partir da fixture escolhida e fixados no teste.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/lib/month.test.ts src/lib/overview.test.ts src/lib/device.test.ts`: FAIL.
- [ ] **Step 3: Implementar** as assinaturas.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: mapeadores puros das telas do redesign`

### Task 4: Camada de API, login com dispositivo e mocks MSW

**Files:**
- Modify: `frontend/src/api/cards.ts`, `frontend/src/api/transactions.ts`, `frontend/src/api/months.ts`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/mocks/handlers.ts`, `frontend/src/types/models.ts`
- Create: `frontend/src/api/imports.ts`, `frontend/src/api/catalog.ts` (categorias, formas de pagamento, recorrentes), `frontend/src/api/sessions.ts`, `frontend/src/api/account.ts`, `frontend/src/api/api.test.tsx`
- Regenerate: `frontend/src/types/api.ts` via `docker compose exec frontend npm run generate-types` (backend das Tasks 18–21 de pé) — nunca à mão.

**Interfaces:**
- Consumes: `api` (`api/client.ts`), `getDeviceName` (Task 3).
- Produces:
  - `useMonthTransactions(year, month): UseQueryResult<Transaction[]>`. Chave `['transactions', year, month, 'all']`. Segue `next` até o fim (a API pagina 50 por página).
  - `useUpdateTransaction` / `useCreateTransaction` / `useDeleteTransaction`: as atuais, que já existem.
  - `useCardsSummary(year, month): UseQueryResult<CardSummary[]>`, chave `['cards-summary', year, month]`.
  - `usePayInvoice()`: mutation `{ cardId, year, month, is_paid }` → `POST /cards/{id}/pay-invoice/`. Invalida `cards-summary`, `transactions` e `summary`.
  - `useCards()` (existe), `useCreateCard` / `useUpdateCard` / `useToggleCardActive`: mesmos endpoints do `Cards.tsx`.
  - `useMonthSummaries(points: Array<{year:number;month:number}>)`: `useQueries` sobre `months/{y}/{m}/summary/`.
  - `useGenerateFixed(year, month)`: passa a tipar o retorno como `GenerateFixedResult`. `useGenerateVariables(year, month)` chama `POST months/{y}/{m}/generate-variables/` com `[{recurring_id, amount}]`.
  - `useImportStatement()`: mutation `{ file: File; cardId: number; kind: 'credit'|'debit'; year; month; dryRun?: boolean; categories?: Record<number, number | null> }` → `ImportResult`, com o FormData igual ao do `Import.tsx` atual mais `dry_run` e `categories` (string JSON `{ "<index>": category_id }`), contrato da Task 18. Só invalida `transactions`/`summary`/`imports` quando `dryRun` é falso.
  - `useImports(): UseQueryResult<StatementImportLog[]>`: `GET imports/` (Task 19), chave `['imports']`.
  - Em `account.ts`: `useUpdateMe()` (`PATCH auth/me/` com `{ first_name, email }`), `useUploadAvatar()` (`POST auth/me/avatar/` multipart `avatar`), `useDeleteAvatar()`; todos atualizam o usuário do `AuthContext`.
  - `useRevokeSession()`: `DELETE auth/sessions/{id}/`, invalida `['sessions']`.
  - Em `catalog.ts`:
    - `useCategories`, `useCreate/UpdateCategory`, `useArchiveCategory`;
    - `usePaymentMethods`, `useCreate/Update/ArchivePaymentMethod`;
    - `useRecurring`, `useCreate/UpdateRecurring`, `usePauseRecurring`, `useDeleteRecurring`.

    Mesmos endpoints, chaves de query e invalidações do `Settings.tsx` / `RecurringExpenses.tsx` de hoje.
  - `useSessions(): UseQueryResult<DeviceSession[]>`, com `DeviceSession = { id: number; device_name: string; last_seen_at: string; created_at: string; revoked: boolean; is_current: boolean }` adicionado em `models.ts` (formato do serializer do backend, Task 21).
  - `User` em `models.ts` ganha `avatar_url: string | null` (Task 20).
  - `AuthContext.login` envia `{ email, password, device_name: getDeviceName() }`.
  - MSW: handlers novos para:
    - `GET cards/summary/`, com 3 cartões: um com crédito e limite, um com crédito e `limit:null`, um só débito;
    - `POST cards/:id/pay-invoice/`;
    - `POST imports/statement/`, com itens nos 4 status (cada item com `index` e `category_id`), respondendo igual com ou sem `dry_run`;
    - `GET imports/` (2 registros), `PATCH auth/me/`, `POST/DELETE auth/me/avatar/`, `DELETE auth/sessions/:id/`;
    - `POST months/:y/:m/generate-variables/`.

    Ajustar `auth/sessions/` ao formato `DeviceSession`.

- [ ] **Step 1: Escrever os testes que falham** em `api.test.tsx` (`renderHook` + `setupServer`):
  ```ts
  test('useMonthTransactions follows pagination', async () => { /* handler: página 1 com 50 itens + next, página 2 com 7 */ await waitFor(() => expect(result.current.data).toHaveLength(57)) })
  test('login sends device_name', async () => { /* handler captura body */ expect(body.device_name).toMatch(/ · /) })
  test('usePayInvoice posts year/month/is_paid', async () => { expect(body).toEqual({ year: 2026, month: 11, is_paid: true }) })
  test('useImportStatement sends dry_run and categories JSON', async () => { /* prévia: dry_run 'true'; confirm: dry_run 'false' e categories '{"0":3}' */ })
  ```
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/api/api.test.tsx`: FAIL.
- [ ] **Step 3: Implementar** hooks, login e handlers.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: hooks de API do redesign, device_name no login e mocks`

### Task 5: Shell (barra lateral, rotas, atalhos, seletor de mês)

**Files:**
- Create: `frontend/src/components/shell/AppShell.tsx`, `Sidebar.tsx`, `MonthNav.tsx`, `PageHeader.tsx`, `frontend/src/components/shell/shell.test.tsx`
- Modify: `frontend/src/App.tsx`
- Delete (no fim da Task 17): `components/layout/*`

**Interfaces:**
- Consumes: `usePeriod`, `useAuth`.
- Produces:
  - **Rotas:** `/` Lançamentos, `/import`, `/overview`, `/settings/:tab` (`categories|payments|cards|fixed`, padrão `categories`), `/account/:tab` (`profile|devices`), `/login`, `*` → `/`.
  - `<AppShell/>`: barra lateral de 206px + `<main>` com largura `max(1080px, 100vw - 340px - 30vw)`. Expõe `data-screen` no `body` (`lanc|imp|visao|ajustes|conta|login`), que o touro (Task 6) lê.
  - **Atalhos globais**, ignorados com foco em input/textarea/select:
    - `1`–`4` navegam para `/`, `/import`, `/overview`, `/settings`;
    - `N` em `/` abre o sheet de novo lançamento (`?new=1`);
    - `Esc` fecha o sheet.
  - `<MonthNav/>`: ‹ Nov 2026 ›, via `setPeriod`.
  - `<PageHeader eyebrow title right?/>`.
  - `<Sidebar/>`: logo "Fin**flow**", itens com o atalho visível e a barra verde no item ativo. O rodapé recebe o `<ProfileCard/>` da Task 9; até lá fica um placeholder.

- [ ] **Step 1: Escrever os testes que falham:** `pressing 2 navigates to /import`, `pressing 2 inside an input does nothing`, `N on / sets ?new=1`, `MonthNav › from Dec 2026 goes to Jan 2027`.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/shell/shell.test.tsx`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: shell do redesign com rotas e atalhos`

### Task 6: Touro de partículas

**Files:**
- Create: `frontend/src/components/bull/BullBackground.tsx`, `frontend/src/components/bull/bull.ts` (módulo three sem React), `frontend/public/touro.jpg` (cópia de `docs/superpowers/specs/2026-11-12-frontend-redesign/touro.jpg`), `frontend/src/components/bull/BullBackground.test.tsx`

**Interfaces:**
- Produces:
  - `createBull(canvas: HTMLCanvasElement): { place(screen: string, contentRect: DOMRect | null): void; shock(x: number, y: number): void; dispose(): void } | null`. Devolve `null` se não houver contexto WebGL.
  - `<BullBackground/>`: canvas fixo atrás de tudo. Observa o `data-screen` do `body` e o retângulo do `<main>`. Chama `place` a cada troca, com dissolve e remontagem como no protótipo. Faz `shock` no clique em área vazia, ignorando `button, input, a, .glass, .fan, .flip, nav, [role=dialog]`. Pausa com `document.hidden`. Com `prefers-reduced-motion`, não faz morph nem repulsão.

- [ ] **Step 1: Escrever o teste que falha:** sem WebGL (`getContext` devolvendo null no jsdom), `<BullBackground/>` renderiza sem lançar e o canvas fica com `data-fallback="true"`.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/bull`: FAIL.
- [ ] **Step 3: Implementar** portando o módulo do protótipo (linhas 1185–fim) **sem alterar parâmetros**: recorte, amostragem, tamanhos, shader, giro `0.14`/`0.05` com interpolação `0.04`, repulsão pela metade. Posicionamento:
  - Login: touro grande e centralizado.
  - Telas de dados: centralizado no espaço livre à direita, brilho `0.42`.
  - Sem espaço livre: atrás do conteúdo, brilho `0.22`.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS. Depois, conferência visual no `npm run dev` contra o protótipo em 1900×970.
- [ ] **Step 5: Commit.** `feat: fundo do touro de particulas`

### Task 7: Cartão metálico

**Files:**
- Create: `frontend/src/components/card/MetalCard.tsx`, `frontend/src/components/card/metal.ts` (WebGL2 compartilhado), `frontend/src/components/card/MetalCard.test.tsx`
- Delete: `components/ui/BankCard.tsx`, `CardSwap.tsx`, `CardSwap.css` (na Task 17, quando não houver mais usos)

**Interfaces:**
- Consumes: `BANKS` (`lib/banks.ts`), `Card | CardSummary` (campos `name`, `bank`, `due_day`).
- Produces:
  - `<MetalCard card={{ name: string; bank: BankKey; due_day: number }} />`: placa com o gradiente da marca, logotipo, chip EMV, contactless, nome e "Vence {due_day}", sem final do cartão (a API não tem esse campo).
  - Camada WebGL2 com `mix-blend-mode: screen`, inclinação de mola (`k 120`, `c 16`), saída `pow(cor, 1.15)` com ganho `1.9`. Só renderiza enquanto houver movimento.
  - `metalRefresh(): void`: redesenha os cartões que ficaram visíveis (aba Cartões).

- [ ] **Step 1: Escrever o teste que falha:** renderiza "Nubank" e "Vence 7"; sem WebGL2, a camada não é montada e nada lança.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/card`: FAIL.
- [ ] **Step 3: Implementar** portando `makeCard` (linha 751) e o IIFE metal (linha 1043).
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: cartao bancario metalico`

### Task 8: Leque de cartões

**Files:**
- Create: `frontend/src/components/fan/Fan.tsx`, `frontend/src/components/fan/fanOrder.ts`, `frontend/src/components/fan/Fan.test.tsx`

**Interfaces:**
- Consumes: `spring`, `stepSprings` (Task 2).
- Produces:
  - `sendToBack(order: number[]): number[]`: move o primeiro para o fim.
  - `<Fan items={ReactNode[]} onChange={(topIndex: number) => void} size?: 'sm'|'big' visible?=4 spread?=.5 depth?=.5 tilt?=30 threshold?=90 />`, com `role="group"`, `tabIndex=0` e `aria-label`.
  - Posição dos cartões: `rotate(k*spread*8)`, `scale(1-k*depth*.12)`, origem `90% 90%`.
  - Arrastar o da frente: inclina pela velocidade e pelo deslocamento (`v/1300*.7 + d/260*.3`). Passou de `threshold` ou de 650 px/s, o cartão é arremessado para trás; antes disso, volta com mola.
  - `ArrowRight`/`ArrowDown`/`Enter`/`Space` mandam o da frente para trás; `ArrowLeft`/`ArrowUp` trazem o último para a frente.
  - `big` = 300×189.

- [ ] **Step 1: Escrever os testes que falham:**
  ```ts
  expect(sendToBack([0,1,2])).toEqual([1,2,0])
  // render 3 itens, foco no grupo, Enter → onChange chamado com 1; ArrowLeft → onChange com 0
  // 1 item: Enter não chama onChange
  ```
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/fan`: FAIL.
- [ ] **Step 3: Implementar** portando `makeFan` (linha 774), com o loop de mola via `stepSprings` e `requestAnimationFrame` sem rAF duplo.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: leque de cartoes`

### Task 9: Cartão de perfil giratório

**Files:**
- Create: `frontend/src/components/flip/FlipCard.tsx`, `frontend/src/components/flip/flipMath.ts`, `frontend/src/components/shell/ProfileCard.tsx`, `frontend/src/components/flip/flip.test.tsx`
- Modify: `frontend/src/components/shell/Sidebar.tsx` (rodapé)

**Interfaces:**
- Consumes: `spring`/`stepSprings`, `useAuth`, `usePeriod`, `useSessions`, `monthLabelFull`.
- Produces (`flipMath.ts`):
  - `snap(deg) = round(deg/180)*180`.
  - `isBack(deg)`.
  - `releaseTarget(here: number, velocityDegPerS: number): number`: `clamp(snap(here + v*.16), snap(here)-180, snap(here)+180)`.
- Produces (`<FlipCard front back />`):
  - Eixo Y, `aria-pressed`, `inert` na face oculta. Gira no clique ou com Enter/Espaço; arrasta com histórico de 90 ms.
  - Molas: giro 170/20, inclinação 400/40 (máx. 12°), elevação 320/26 até 1.03, brilho via `--gx`/`--gy`/`--sheen`.
  - Sombra que estreita ao girar.
  - Ref imperativa `{ flipFront(): void }`.
- Produces (`<ProfileCard/>`, 206×290, texto exato do protótipo):
  - **Frente:** silhueta (ou a foto `avatar_url`, se houver), `first_name`, "{Mês} · {Ano}" do período, câmera, "Conta pessoal", "● Sessão ativa", pílula "↻ Conta".
  - **Verso:** avatar (foto se houver) + nome + e-mail; Perfil ("nome, e-mail e foto") → `/account/profile`; Dispositivos ("{n} sessões") → `/account/devices`; Sair → `logout()`.
  - Navegar vira o cartão de volta após 300 ms.
  - Borda verde quando a rota começa com `/account`.

- [ ] **Step 1: Escrever os testes que falham:**
  ```ts
  expect(releaseTarget(100, 0)).toBe(180); expect(releaseTarget(80, 0)).toBe(0); expect(releaseTarget(10, 2000)).toBe(180)
  // Enter no FlipCard → aria-pressed="true"; botão da face oculta não é focável (inert)
  // clicar "Dispositivos" no verso → rota /account/devices
  ```
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/flip`: FAIL.
- [ ] **Step 3: Implementar** portando o IIFE do flip (linha 915) e o CSS `.flip*`/`.pf-*`/`.fb`/`.bk-*` do protótipo.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: cartao de perfil giratorio`

### Task 10: Sheet lateral e formulário de lançamento

**Files:**
- Create: `frontend/src/components/sheet/Sheet.tsx`, `frontend/src/components/sheet/TransactionForm.tsx`, `frontend/src/components/sheet/TransactionForm.test.tsx`

**Interfaces:**
- Consumes: `useCategories`, `usePaymentMethods`, `useCreate/Update/DeleteTransaction`, `invoiceMonthLabel` (`lib/cardCycle.ts`), `parseMoney`.
- Produces:
  - `<Sheet open onClose title>`: painel de vidro à direita, `role="dialog"`, foco preso, Esc fecha.
  - `<TransactionForm tx?: Transaction onDone />`, com RHF + Zod e estes campos:
    - valor grande;
    - Entrada/Saída;
    - descrição;
    - data (padrão hoje no mês do período);
    - categoria (pílulas);
    - forma de pagamento (pílulas);
    - pago;
    - parcelas 1×/3×/6×/10×/outro, só no crédito.

    Aviso "cai na fatura de {mês}" quando a forma tem `card_detail` e `card_function==='credit'`. No modo edição aparecem Excluir e o título "Editar lançamento"; parcelas ficam ocultas.
  - O valor sai como string decimal (`parseMoney`).

- [ ] **Step 1: Escrever os testes que falham:**
  - Submit sem valor mostra erro e não chama a API.
  - Valor "1.234,56" envia `amount: '1234.56'`.
  - Crédito com fechamento dia 5 e data 2026-11-12 mostra "cai na fatura de dezembro".
  - Modo edição mostra "Excluir".
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/components/sheet`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: sheet lateral e formulario de lancamento`

### Task 11: Lançamentos

**Files:**
- Create: `frontend/src/pages/lanc/Lancamentos.tsx`, `FixosCard.tsx`, `ResumoCard.tsx`, `FaturasCard.tsx`, `VencimentosCard.tsx`, `Ledger.tsx`, `VariablesSheet.tsx`, `frontend/src/pages/lanc/Lancamentos.test.tsx`

**Interfaces:**
- Consumes: `useMonthTransactions`, `useMonthSummary`, `useRecurring`, `useCardsSummary`, `usePayInvoice`, `useGenerateFixed`, `useGenerateVariables`, `usePaymentMethods`, `useUpdateTransaction`; os mapeadores da Task 3; `Fan`, `MetalCard`, `Sheet`, `TransactionForm`, `PageHeader`, `MonthNav`.
- **Layout:**
  - Header: eyebrow "{Mês} · {Ano}", título LANÇAMENTOS, `MonthNav` e "+ Novo lançamento [N]".
  - Grade de 2 colunas iguais. O último card de cada coluna tem `flex:1`, então as colunas terminam na mesma linha com qualquer tamanho de lista.
  - O Ledger fica abaixo, em largura total.
- **FixosCard:**
  - Total previsto, "R$ X pagos · R$ Y a vencer", anel de %, barra.
  - Chips com ✓/○ e "≈" quando `isEstimated`; clicar no chip alterna `is_paid`.
  - Sem fixos no mês: botão "Gerar fixos do mês". Se `pending_variables` voltar não vazio, abre o `VariablesSheet` para os valores e confirma com `useGenerateVariables`.
- **ResumoCard:** linhas Entradas / Saídas / Sobra com barra proporcional à maior.
- **FaturasCard:**
  - Leque só dos cartões com `functions` contendo `credit`.
  - Dados do cartão da frente:
    - valor `invoice.amount`;
    - "fecha D mmm · vence dia D";
    - barra `committed_pct` e "Limite R$ X · N% usado", só se `limit` não for nulo;
    - botão "Marcar fatura paga"/"Fatura paga ✓" (`usePayInvoice`, alterna `invoice.is_paid`);
    - aviso "fatura divergente" se `invoice.divergent`;
    - aviso de limite se `committed_pct ≥ 90`.
  - Bolinhas de posição e a dica "arraste o cartão para trocar".
  - Sem cartão de crédito: estado vazio "Nenhum cartão de crédito".
- **VencimentosCard:**
  - Vem de `dueList(txs, hoje)`. A etiqueta "vencido" aparece nos atrasados.
  - A lista rola dentro do card.
  - O rodapé fixo "Total a vencer" mostra `dueList(...).total`.
- **Ledger:**
  - Header Descrição | Categoria | Pagamento | Valor; grade `36px minmax(0,1.8fr) minmax(0,1fr) minmax(0,1.2fr) 120px`.
  - Dias de `groupByDay` com o total do dia.
  - Linha:
    - marcador pago/pendente clicável;
    - etiqueta FIXO;
    - parcela "3/10";
    - clique abre o sheet em modo edição.
  - Filtros Todas/Entradas/Saídas/Cartão na mesma linha que a busca por texto (no cliente, sobre `description`) e o menu "Filtros" (categoria, forma de pagamento, pago/não pago).
  - `?new=1` abre o sheet de novo lançamento.

- [ ] **Step 1: Escrever os testes que falham** (MSW):
  - Renderiza "Fixos previstos", "Faturas abertas", "Próximos vencimentos" e "Movimentações".
  - Clicar num chip pendente faz PATCH com `is_paid: true`.
  - "Marcar fatura paga" faz POST com `pay-invoice`.
  - O cartão com `limit:null` não mostra "Limite"; o cartão só débito não entra no leque.
  - Filtro "Entradas" mostra só entradas; a busca "mercado" filtra pela descrição.
  - Mês vazio (handlers com listas vazias): aparece "Gerar fixos do mês" e nenhum erro é lançado.
  - Um fixo vencido aparece com "vencido".
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/lanc`: FAIL.
- [ ] **Step 3: Implementar** seguindo `<section id="s-lanc">` do protótipo.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: tela de lancamentos do redesign`

### Task 12: Importar

**Files:**
- Create: `frontend/src/pages/Importar.tsx`, `frontend/src/pages/Importar.test.tsx`
- Delete: `frontend/src/pages/Import.tsx` (substituído)

**Interfaces:**
- Consumes: `useCards`, `useImportStatement`, `useImports`, `useCategories`, `Fan` (`big`), `MetalCard`, `usePeriod`.
- **Layout:** grade `380px | 1fr`.
- **Etapa 1:** leque dos cartões ativos, dica "Arraste o cartão para trocar" e histórico de `useImports()` no formato do protótipo ("Nubank · outubro" | "41 itens · R$ 2.390,12"). Vazio: "Nenhuma importação ainda".
- **Etapa 2:**
  - Fechamento e vencimento do cartão da frente.
  - Escolha crédito/débito, só se o cartão tiver as duas funções.
  - Mês da fatura (padrão: período), quando for crédito.
  - Área de soltar para CSV ou PDF (ou clique), com "Arraste a fatura do {nome}". Soltar envia na hora como **prévia** (`dryRun: true`): nada é gravado.
- **Etapa 3, "3 · Conferir"** (largura total), igual ao protótipo:
  - Vazio: linhas fantasma + "A conferência aparece aqui assim que a fatura for lida."
  - Tabela Data | Descrição | Categoria | Valor com cabeçalho fixo e rolagem interna.
  - Categoria sugerida como pílula "✦" (classe `ai`). Clicar abre a escolha de categoria e troca **só no estado local** (nada salvo ainda).
  - Duplicados riscados e esmaecidos (classe `dup`); estornos e ignorados sinalizados.
  - Resumo "N itens · R$ X · K duplicados" no cabeçalho; rodapé "✦ categorias sugeridas pela IA local · clique para trocar" + botão "Importar N lançamentos" (N = itens `created`).
  - O botão reenvia o mesmo arquivo com `dryRun: false` e `categories` = mapa índice → categoria escolhida de todos os itens `created`; no sucesso, limpa a etapa e o histórico (`['imports']`) atualiza.

- [ ] **Step 1: Escrever os testes que falham:**
  - Soltar um arquivo envia FormData com `card_id` do cartão da frente, `kind` e `dry_run=true`.
  - A conferência mostra os 4 status, e o duplicado tem a classe `dup`.
  - Trocar a categoria de um item e clicar "Importar N lançamentos" envia `dry_run=false` e `categories` com a categoria trocada.
  - O histórico mostra as entradas de `GET imports/` ("Nubank · outubro").
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/Importar.test.tsx`: FAIL.
- [ ] **Step 3: Implementar** seguindo `<section id="s-imp">`.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: tela importar do redesign`

### Task 13: Visão

**Files:**
- Create: `frontend/src/pages/visao/Visao.tsx`, `MonthsChart.tsx`, `frontend/src/pages/visao/Visao.test.tsx`
- Delete: `pages/Dashboard.tsx`, `pages/Analytics.tsx` (Task 17)

**Interfaces:**
- Consumes: `useMonthSummaries` (12 meses até o período), `useRecurring` (soma dos ativos do tipo expense para `activeFixedTotal`), `useCardsSummary`, `buildSeries`, `projectNext`, `headline`.
- **Frase** em Playfair: "{Mês} custou **R$ X**, N% abaixo/acima de {mês anterior}. Sobraram **R$ Y**." Para o mês projetado: "{Mês} deve fechar perto de **R$ X**".
- **`<MonthsChart points selected onSelect/>`**, em SVG próprio:
  - Barras empilhadas: fixos `#5b8fc7` e variáveis `#3f9a50`, topo arredondado de 4px e 2px entre segmentos.
  - 13ª barra projetada, hachurada, com contorno tracejado.
  - Receita como degrau tracejado, um eixo só, grade recessiva.
  - Hover com tooltip Fixos/Variáveis/Total; clique seleciona o mês.
  - Legenda presente e `<table>` visualmente oculta com os mesmos dados.
- **3 cards:**
  - "Onde foi o variável": `by_category`, barras horizontais.
  - "Fixos × variáveis": barra dividida, valores e %.
  - "Destaque": variáveis vs média dos 6 meses e total por fatura de cartão.

- [ ] **Step 1: Escrever os testes que falham:**
  - Renderiza 13 grupos de barra (`data-month`), e o último tem `data-projected="true"`.
  - Clicar no mês de outubro troca a frase para "Outubro custou".
  - A tabela acessível tem 13 linhas.
  - Com só 1 mês de dados, não lança.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/visao`: FAIL.
- [ ] **Step 3: Implementar** seguindo `<section id="s-visao">` e o script da Visão (linha 982).
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: tela visao do redesign`

### Task 14: Ajustes

**Files:**
- Create: `frontend/src/pages/ajustes/Ajustes.tsx`, `Tabs.tsx`, `CategoriasTab.tsx`, `PagamentosTab.tsx`, `CartoesTab.tsx`, `FixosTab.tsx`, `forms.tsx` (formulários de categoria, forma, cartão e fixo, todos dentro do `Sheet`), `frontend/src/pages/ajustes/Ajustes.test.tsx`
- Delete: `pages/Settings.tsx`, `pages/Cards.tsx`, `pages/RecurringExpenses.tsx` (Task 17)

**Interfaces:**
- Consumes: hooks de `catalog.ts` e `cards.ts`, `catCols`, `Fan` (`big`), `MetalCard`, `metalRefresh`, `usePayInvoice`, `Sheet`.
- Produces: `<Tabs tabs={Array<{id,label}>} value onChange/>`, com indicador deslizante e largura do painel igual à da barra. É reutilizado pela Conta (Task 15).
- **Header:** eyebrow "Cadastros", título AJUSTES. A aba vem de `/settings/:tab`.
- **Categorias:** grade com `catCols(n)` colunas; criar, editar e arquivar.
- **Formas de pagamento:** linhas compactas (ícone + nome + detalhe); criar, editar e arquivar.
- **Cartões:**
  - Leque, nome em Playfair, Editar/Desativar.
  - 4 colunas: Fechamento, Vencimento, Limite, Funções.
  - "Marcar fatura paga" do mês do período.
  - Inativos aparecem fora do leque, esmaecidos, com "Reativar".
- **Fixos:** linhas com dia, nome + "categoria · forma", valor (com "≈" se `is_variable`) e linha de total previsto; criar, editar, pausar e excluir.

- [ ] **Step 1: Escrever os testes que falham:**
  - 7 categorias renderizam a grade com `data-cols="3"`, e 8 com `"4"`.
  - `/settings/cards` abre a aba Cartões.
  - Criar categoria pelo sheet faz POST.
  - Desativar cartão faz PATCH com `is_active:false`.
  - Pausar fixo faz PATCH com `status:'paused'`.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/ajustes`: FAIL.
- [ ] **Step 3: Implementar** seguindo `<section id="s-ajustes">`.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: tela ajustes do redesign`

### Task 15: Conta

**Files:**
- Create: `frontend/src/pages/Conta.tsx`, `frontend/src/pages/Conta.test.tsx`

**Interfaces:**
- Consumes: `Tabs` (Task 14), `useAuth`, `useSessions`, `useRevokeSession`, `useUpdateMe`, `useUploadAvatar`.
- **Header:** eyebrow "Configuração", título CONTA. Abas Perfil e Dispositivos ocupam o painel de 560px; a aba vem de `/account/:tab`.
- **Perfil (editável):** círculo com silhueta (ou a foto) e câmera; "Foto do perfil", "JPG ou PNG · até 2 MB"; "Enviar foto" abre seletor (`accept="image/jpeg,image/png"`), recusa no cliente > 2 MB e envia com `useUploadAvatar`; Nome e E-mail com RHF + Zod; "Salvar" faz `PATCH auth/me/`; erros do envelope (`errors.email`) aparecem no campo.
- **Dispositivos:**
  - Sessões não revogadas.
  - A sessão com `is_current` mostra "este dispositivo · ativo agora" e a pílula "Ativo". As outras mostram "último acesso há N dias" (ou "hoje"), a partir de `last_seen_at`, e o botão "Encerrar" (`useRevokeSession`).
  - Lista vazia: "Nenhuma sessão registrada".

- [ ] **Step 1: Escrever os testes que falham:**
  - `/account/devices` marca "Ativo" na sessão `is_current` e não mostra "Encerrar" nela.
  - "Encerrar" numa outra sessão faz `DELETE auth/sessions/{id}/`.
  - Em Perfil, editar o nome e "Salvar" faz `PATCH auth/me/` com o nome novo.
  - Arquivo > 2 MB não é enviado e mostra erro.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/Conta.test.tsx`: FAIL.
- [ ] **Step 3: Implementar** seguindo `<section id="s-conta">`.
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: tela conta`

### Task 16: Login

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `useAuth().login`.
- **Formulário** de vidro centralizado: "Bem-vindo de volta", ENTRAR, e-mail, senha, Entrar, "Lembrar este dispositivo".
- **Moldura:** logo no canto superior esquerdo e "Money, *energy.*" no canto inferior esquerdo; o `body` recebe `data-screen="login"`.
- **Erro 401:** mostra "E-mail ou senha incorretos" sem limpar o e-mail.

- [ ] **Step 1: Escrever os testes que falham:** submit chama `login(email, senha)`; 401 mostra a mensagem e mantém o e-mail.
- [ ] **Step 2: Rodar e ver falhar.** `docker compose exec frontend npm test -- src/pages/Login.test.tsx`: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando: PASS.
- [ ] **Step 5: Commit.** `feat: login do redesign`

### Task 17: Remoções, fumaça, decisões e verificação final

**Files:**
- **Delete:**
  - páginas: `pages/Dashboard.tsx`, `Analytics.tsx`, `Investments.tsx`, `Debts.tsx`, `Acquisitions.tsx`, `RecurringExpenses.tsx`, `Cards.tsx`, `Settings.tsx`, `Transactions.tsx`;
  - API: `api/acquisitions.ts`, `api/investments.ts`, mais o que ficar sem uso em `api/analytics.ts`;
  - componentes: `components/layout/*`, `components/ui/{BankCard,CardSwap*,KpiCard*,MonthPicker,...}` que ficarem sem uso;
  - mocks: `mocks/data/acquisitions.ts` e os handlers órfãos;
  - dependência: `recharts`, se ficar sem uso.
- Modify: `frontend/src/test/pages.test.tsx` (fumaça das 6 telas novas), `DECISIONS.md`

- [ ] **Step 1: Reescrever a fumaça** em `pages.test.tsx` com uma renderização por tela nova, via MSW, cada uma afirmando o título (LANÇAMENTOS, IMPORTAR, VISÃO, AJUSTES, CONTA, ENTRAR).
- [ ] **Step 2: Remover os arquivos** listados. `grep -r "recharts\|BankCard\|CardSwap\|KpiCard" frontend/src` deve voltar vazio antes de remover a dependência.
- [ ] **Step 3: DECISIONS.md:** 1 linha por item da §12 do spec (1–17), com os itens 13–16 na versão com backend.
- [ ] **Step 4: Verificar.** `docker compose exec frontend npm test && docker compose exec frontend npm run build`: tudo verde.
- [ ] **Step 5: Conferência visual.** `npm run dev` com `VITE_API_MOCK=true` e Playwright em 1900×970, tela a tela contra o protótipo:
  - colunas de Lançamentos terminando juntas;
  - leque arrastando;
  - flip girando;
  - touro posicionado;
  - console sem erros.
- [ ] **Step 6: Commit.** `refactor: remove paginas antigas e registra decisoes do redesign`

---

## Backend (executar antes da Task 1)

### Task 18: Prévia (dry-run) da importação com categorias escolhidas

**Files:**
- Modify: `backend/apps/transactions/services.py` (`StatementImportService.import_file`), `backend/apps/transactions/api/serializers.py` (`StatementImportSerializer`), `backend/apps/transactions/api/views.py` (`StatementImportView`)
- Test: `backend/apps/transactions/tests/unit/test_statement_import.py` e o teste de API correspondente

**Interfaces:**
- Request multipart `POST /api/v1/imports/statement/` ganha campos opcionais:
  - `dry_run` (bool, padrão `false`).
  - `categories` (string JSON `{"<index>": <category_id|null>}`), índice = posição do item na resposta.
- Resposta: cada item ganha `index: int` e `category_id: int | null` (além de `category`, o nome). Topo inalterado (`created`, `skipped`, `total`, `items`). Com `dry_run`, `created` e `total` contam o que SERIA criado. Status `201` no real, `200` no dry-run.
- `dry_run=true`: roda a mesma lógica e desfaz tudo (nenhuma transação, categoria "Outros" ou fixo gerado persiste) — `transaction.atomic()` + `set_rollback(True)`, sem duplicar a lógica.
- `categories` fornecido: o item `created` usa a categoria indicada (validar que pertence ao usuário → `ValidationDomainError` no campo `categories`); descrições com categoria fornecida NÃO vão para o LLM (`classify`), então o confirm não chama o LLM de novo quando o front manda todas.

- [ ] **Step 1: Testes que falham:** dry-run não cria `Transaction` (count antes == depois) e devolve itens com `index`/`category_id`; dry-run não cria "Outros"; confirm com `categories={"0": cat.id}` grava a transação 0 com `cat`; `classify` não é chamado para descrição com categoria fornecida (mock); categoria de outro usuário → 400 com `errors.categories`; API: dry-run responde 200, real 201.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Gate:** `docker compose exec backend uv run pytest --cov=apps --cov-fail-under=85 && docker compose exec backend uv run ruff check .`
- [ ] **Step 5: Commit.** `feat: previa da importacao de fatura com categorias escolhidas`

### Task 19: Registro e histórico de importações

**Files:**
- Modify: `backend/apps/transactions/models.py` (novo model `StatementImport`), migração nova, `repositories.py`, `services.py`, `api/serializers.py`, `api/views.py`, `api/urls.py`, `backend/apps/common/factories.py` (factory), `DECISIONS.md` (1 linha)

**Interfaces:**
- `StatementImport(user FK, card FK (on_delete CASCADE), kind, year (null), month (null), filename (max 255), created_count, skipped_count, total Decimal(12,2), created_at auto_now_add)`, `db_table = "transactions_statementimport"`, ordenação `-created_at`.
- Gravado pelo `import_file` real (não no dry-run), dentro do mesmo `atomic`.
- `GET /api/v1/imports/` → as 12 mais recentes do usuário: `[{ id, card_id, card_name, card_bank, kind, year, month, filename, created_count, skipped_count, total, created_at }]` (`total` string decimal). Sem paginação.

- [ ] **Step 1: Testes que falham:** import real cria 1 `StatementImport` com contagens/total certos; dry-run não cria; `GET imports/` devolve só os do usuário, no máximo 12, mais novo primeiro.
- [ ] **Step 2–4:** falhar, implementar, gate (mesmo comando da Task 18) e `makemigrations --check` limpo.
- [ ] **Step 5: Commit.** `feat: historico de importacoes de fatura`

### Task 20: Perfil editável e foto

**Files:**
- Modify: `backend/apps/accounts/models.py` (`User.avatar = FileField(upload_to="avatars/", null=True, blank=True)`), migração, `api/serializers.py`, `api/views.py`, `api/urls.py`, `services.py`/`repositories.py`, `config/settings/base.py` (`MEDIA_URL="/media/"`, `MEDIA_ROOT=BASE_DIR/"media"`), `config/urls.py` (servir media em DEBUG), `frontend/vite.config.ts` (proxy `/media` igual ao `/api`, se houver proxy), `DECISIONS.md`

**Interfaces:**
- `UserSerializer`: `{ id, email, first_name, avatar_url: string | null }` — URL relativa `/media/...` (funciona atrás do proxy do Vite).
- `PATCH /api/v1/auth/me/` com `first_name` e/ou `email`; e-mail único (case-insensitive) → 400 `errors.email`; devolve o `UserSerializer`.
- `POST /api/v1/auth/me/avatar/` multipart `avatar`: só JPEG/PNG validados pela assinatura de bytes (`FF D8 FF` / `89 50 4E 47 0D 0A 1A 0A`), máx. 2 MB → 400 `errors.avatar`; troca apaga o arquivo antigo; devolve o `UserSerializer`. `DELETE` remove a foto (204).
- `media/` já está no `.gitignore`.

- [ ] **Step 1: Testes que falham:** PATCH nome; PATCH e-mail duplicado → 400 `errors.email`; upload PNG válido → `avatar_url` não nulo; GIF ou texto renomeado `.png` → 400; > 2 MB → 400; DELETE limpa; sem auth → 401. Testes usam `MEDIA_ROOT` temporário (fixture `settings` + `tmp_path`).
- [ ] **Step 2–4:** falhar, implementar, gate.
- [ ] **Step 5: Commit.** `feat: edicao de perfil e foto do usuario`

### Task 21: Revogação real de sessão de dispositivo

**Files:**
- Modify: `backend/apps/accounts/api/views.py`, `api/serializers.py`, `api/urls.py`, novo `backend/apps/accounts/authentication.py`, `services.py`/`repositories.py`, `config/settings/base.py` (`DEFAULT_AUTHENTICATION_CLASSES` e `SIMPLE_JWT["TOKEN_REFRESH_SERIALIZER"]`), `DECISIONS.md`

**Interfaces:**
- Login: cada login cria uma `DeviceSession` nova (nome = `device_name` ou `"Dispositivo"`) e grava `sid = session.id` no refresh (o access herda a claim).
- Autenticação: subclasse de `JWTAuthentication` — token com `sid` de sessão revogada ou inexistente → 401. Token sem `sid` (legado) continua válido. Atualiza `last_seen_at` no máximo 1×/min por sessão (evitar escrita por request).
- Refresh: serializer de refresh que recusa (401) `sid` revogado; a rotação mantém `sid`.
- `DELETE auth/sessions/{id}/`: revoga (inclusive a própria). `POST auth/logout/`: blacklist do refresh + revoga a sessão do `sid`.
- `GET auth/sessions/`: não revogadas, mais recente primeiro, cada uma com `is_current: bool` (`id == request.auth["sid"]`).

- [ ] **Step 1: Testes que falham:** login com `device_name` cria sessão e o access tem `sid`; dois logins → 2 sessões; revogar a sessão A → access de A em `auth/me/` dá 401 e refresh de A dá 401, enquanto B segue 200; `is_current` true só na sessão do token; logout revoga; token sem `sid` segue aceito; `last_seen_at` não é reescrito em duas requests no mesmo minuto.
- [ ] **Step 2–4:** falhar, implementar, gate.
- [ ] **Step 5: Commit.** `feat: revogacao real de sessao por dispositivo`
