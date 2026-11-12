# FinFlow — Redesign completo do frontend

**Data:** 2026-11-12  ·  **Status:** design aprovado pelo usuário (protótipo) · lacunas da revisão resolvidas como decisões minhas (§12, itens 10–17)
**Referência visual (fonte de verdade de layout e movimento):**
`docs/superpowers/specs/2026-11-12-frontend-redesign/prototipo.html` — protótipo aprovado tela a tela.
Abra no navegador (servidor estático na pasta; usa `touro.jpg` da mesma pasta e three.js via CDN).
`touro-referencia.html` na mesma pasta é a referência isolada do touro de partículas.

> Onde este documento e o protótipo divergirem em **aparência**, vale o protótipo.
> Onde divergirem em **dados/comportamento real**, vale este documento.
> Os números do protótipo são fictícios; tudo vem da API.

---

## 1. Intenção

O usuário quer refazer o frontend **do zero** com aparência sofisticada e moderna: preto profundo com
brilho verde granulado, tipografia serifada de "Money, energy.", um touro de partículas 3D interativo
como fundo e animações caprichadas (cartões de banco metálicos, leque de cartões, cartão de perfil que gira).

O uso real dele é um fluxo mensal curto:
**Login → Lançamentos** (estimativa dos fixos do mês e o que já entrou/saiu) **→ Importar** (faturas dos
cartões) **→ Visão** (o mês em perspectiva de vários meses). O redesign enxuga o app para esse fluxo.

**Sucesso:** o app real fica igual ao protótipo aprovado, com dados reais, sem perder nenhuma função que
o usuário usa hoje nessas telas.

## 2. Metas, não-metas, anti-metas

**Metas**
- Reimplementar o frontend com as 6 telas do protótipo: Login, Lançamentos, Importar, Visão, Ajustes, Conta.
- Fundo com touro de partículas (three.js) com o comportamento por tela descrito na §5.
- Componentes interativos portados fielmente: cartão metálico (shader), leque de cartões, cartão de perfil giratório.
- Manter as funções existentes de cadastro/edição (categorias, formas de pagamento, cartões, fixos,
  lançamentos, importação, sessões).

**Não-metas**
- Não mexer em contratos da API existentes (seções 5 e 6 do `FINFLOW_PLANO_IMPLEMENTACAO_v2.md` são congeladas).
- Não remover nada do backend: as páginas órfãs saem só do frontend (endpoints continuam).
- Tema claro: só existe o tema escuro.

**Anti-metas (seria fracasso mesmo funcionando)**
- Parecer "template de dashboard" genérico (cards brancos, ícones coloridos, sombras padrão).
- Touro deformado/achatado ou girando demais: o usuário rejeitou toda inferência de volume 3D.
  Usar **exatamente** a amostragem da `touro-referencia.html`.
- Textos "longe uns dos outros" (nome numa ponta, detalhe na outra) e colunas desalinhadas.
- Layout que só fica alinhado com a quantidade de itens do mock (tem que segurar listas de qualquer tamanho).

## 3. Restrições do projeto (CLAUDE.md)

- Orquestração: implementação via `agent-front-core` (fundação, tokens, layout, componentes genéricos,
  MSW) e `agent-front-pages` (páginas). Mudanças de backend, se aprovadas (§10), via `agent-db`/`agent-domain`/`agent-api`.
- Dinheiro trafega como string decimal (`"1234.56"`), nunca float; formatação só na borda (`lib/currency.ts`).
- Types gerados do OpenAPI (`npm run gen:types`) — nunca editar `src/types/api.ts` à mão.
- TDD (teste antes do código). Commits `test:/feat:/refactor:/chore:`.
- Não rodar `npm install`/`uv` no host contra os bind mounts com containers rodando; usar `docker compose exec`.
- Decisões fora do plano mestre vão para `DECISIONS.md` (1 linha cada).

## 4. Identidade visual

| Item | Valor |
|---|---|
| Fundo | `#040605` + gradientes radiais verdes + grão animado (overlay de ruído) |
| Acento | `--g: #7ee08a` (verde), `--g2: #3f9a50` |
| Texto | `--tx` claro; `--mu: #8aa38e` (secundário); `--mu2` (terciário) |
| Superfície | vidro `rgba(10,18,12,.5)` + `backdrop-filter: blur(16px) saturate(140%)`, borda `--line`, raio 20px |
| Tipografia | **Playfair Display** (títulos H1 em CAIXA ALTA espaçada, nomes, frase da Visão) + **Manrope** (corpo e números, `tabular-nums lining-nums`) |
| Movimento | easing `cubic-bezier(.2,.8,.2,1)`; entrada das telas em cascata (`rise`: opacidade+blur+translate, 55ms entre blocos); `prefers-reduced-motion` desliga animações não essenciais |
| Gráficos | fixos `#5b8fc7` (azul), variáveis `#3f9a50` (verde) — validados para daltonismo no fundo `#0a120c`; projeção hachurada; receita em linha tracejada |

Copiar os tokens exatos do `<style>` do protótipo para o design system (Tailwind theme + CSS vars).

## 5. Fundo: touro de partículas

Canvas WebGL fixo atrás de todo o app (three.js 0.160, `ShaderMaterial`, blending aditivo).
Implementação de referência: `touro-referencia.html` + o módulo do touro no fim do `prototipo.html`.
Portar **sem alterar parâmetros** (recorte da foto, amostragem, tamanhos, shader, profundidade).

- **Estrelas** em tela cheia (não espalham no morph).
- **Mouse:** repulsão suave das partículas (força pela metade da versão original) e giro leve:
  `rotation.y → mouse.x * 0.14`, `rotation.x → -mouse.y * 0.05`, interpolação 0.04/frame. Sem oscilação ociosa.
- **Clique** em área vazia: onda de choque (ignorar cliques em botões, inputs, cards de vidro, cartões, nav, sheet).
- **Por tela:** Login = touro grande e centralizado; telas de dados = touro centralizado no espaço livre
  à direita do conteúdo com brilho 0.42 (se não couber, atrás do conteúdo com 0.22).
- **Troca de tela:** touro se desfaz (partículas espalham) e se remonta no novo lugar.
- Pausar o render quando a aba estiver oculta. Sem WebGL → só o fundo de gradiente.

## 6. Shell (todas as telas logadas)

- **Barra lateral (206px):** logo "Fin**flow**" (Playfair, "flow" verde), itens Lançamentos, Importar, Visão,
  Ajustes com atalho visível (1–4); item ativo com barra verde luminosa à esquerda.
- **Atalhos:** `1`–`4` trocam de tela; `N` abre "Novo lançamento" em Lançamentos; `Esc` fecha o sheet.
- **Conteúdo:** largura `max(1080px, 100vw − 340px − 30vw)`, alinhado à esquerda; touro ocupa o espaço à direita.
- **Cartão de perfil giratório** no rodapé da barra (porta do componente `FlipCard` enviado pelo usuário:
  eixo Y, vira no clique, arrastável com arremesso, inclinação 12° + brilho no hover, hoverScale 1.03,
  mola 170/20, sombra que estreita ao girar; teclado Enter/Espaço). Formato retrato 206×290:
  - **Frente:** painel de foto com silhueta centralizada (cabeça ~40% da altura, ombros sumindo num
    degradê escuro), brilho verde e textura de pontos; sobre o degradê o nome (Playfair) e "Mês · Ano"
    do período selecionado; botão de câmera no canto; rodapé "Conta pessoal · ● Sessão ativa" e pílula "↻ Conta".
    Com foto do usuário, a foto ocupa o painel (`object-fit: cover`) no lugar da silhueta.
  - **Verso:** cabeçalho (avatar, nome, e-mail), botões Perfil ("nome, e-mail e foto") e Dispositivos
    ("N sessões"), Sair embaixo. Perfil/Dispositivos abrem a tela Conta na aba certa e o cartão volta para a frente.
  - Na tela Conta a borda do cartão fica verde (é o "item ativo" da conta).

## 7. Telas

### 7.1 Login
Formulário de vidro centralizado ("Bem-vindo de volta" / ENTRAR / e-mail / senha / Entrar / "Lembrar este
dispositivo"), logo no canto superior esquerdo, tagline "Money, *energy.*" no canto inferior esquerdo,
touro grande ao centro atrás. Comportamento de auth atual (JWT + refresh) mantido.

### 7.2 Lançamentos (tela inicial)
Cabeçalho: eyebrow "Mês · Ano", título LANÇAMENTOS, seletor de mês (‹ Nov 2026 ›) e botão "+ Novo lançamento [N]".

Grade de 2 colunas iguais **que sempre terminam na mesma linha** (o último card de cada coluna estica):
- **Esquerda:**
  - *Fixos previstos do mês:* total previsto, "R$ X pagos · R$ Y a vencer", anel de % pago, barra de progresso,
    chips por fixo (✓ pago, ○ pendente, "≈" valor estimado para fixo variável). Clicar no chip alterna pago
    (`toggle-paid`). Se o mês ainda não tem os fixos gerados, o card mostra a ação de gerar (`generate-fixed`).
  - *Resumo do mês:* linhas Entradas / Saídas / Sobra, cada uma com barra proporcional; linhas se distribuem
    quando o card estica.
- **Direita:**
  - *Faturas abertas:* leque de cartões metálicos (§8.2) dos cartões com crédito; ao lado, dados da fatura do
    cartão da frente (valor, "fecha D mmm · vence dia D", barra de limite usado, "Limite R$ X · N% usado") e
    bolinhas de posição. Dica "arraste o cartão para trocar".
    Ação **"Marcar fatura paga"** junto aos dados (`POST /cards/{id}/pay-invoice/`, alterna) — sem ela o
    "limite usado" fica errado. Avisos de divergência de fatura e de limite (hoje em `Cards.tsx`) aparecem aqui.
  - *Próximos vencimentos:* fixos não pagos do mês (dia, nome, categoria · forma, valor, "≈" se estimado);
    os já vencidos ficam no topo com etiqueta "vencido"; lista rola dentro do card se for longa; rodapé fixo
    "Total a vencer" (mesma soma do "a vencer" do card de fixos).
- **Largura total, abaixo das duas colunas:** *Movimentações* em formato de tabela
  (Descrição | Categoria | Pagamento | Valor), agrupada por dia com total do dia, filtros Todas / Entradas /
  Saídas / Cartão, etiqueta FIXO e parcela "3/10". Linha abre o sheet em modo edição (editar/excluir).
  Mantém o que `Transactions.tsx` tem hoje: busca por texto e menu "Filtros" (categoria, forma de pagamento,
  pago/não pago) na mesma linha dos filtros; marcador pago/pendente clicável em cada linha.

**Sheet "Novo lançamento"** (painel lateral direito de vidro): valor grande, descrição, categoria (pílulas),
forma de pagamento (pílulas), aviso quando crédito cai na próxima fatura ("cai na fatura de dezembro" —
usar `lib/cardCycle.ts`), parcelas (1×/3×/6×/10× + outro valor), Salvar. Validação RHF + Zod.

### 7.3 Importar
Grade `380px | 1fr`:
1. **Escolha o cartão:** leque de cartões metálicos 300×189 (mesmo componente §8.2); dica "Arraste o cartão
   para trocar"; histórico de importações abaixo (cartão · mês · itens · total), guardado no navegador
   (`localStorage`, rótulo "neste navegador") — o backend não registra importações.
2. **Solte a fatura:** fechamento e vencimento do cartão da frente; área de soltar (CSV ou PDF, ou clique)
   com o nome do cartão ("Arraste a fatura do Nubank"). Crédito pede o mês da fatura.
3. **Conferir** (largura total, abaixo): tabela Data | Descrição | Categoria | Valor com rolagem interna e
   cabeçalho fixo; categoria sugerida pela IA local como pílula "✦" (clique troca a categoria); duplicados
   riscados e esmaecidos; estornos/ignorados sinalizados; resumo "N itens · R$ X · K duplicados".
   O backend grava ao receber o arquivo, então esta etapa é o **relatório pós-importação**: aparece depois do
   envio, a troca de categoria salva na hora (PATCH do lançamento) e o botão final é "Concluir".

### 7.4 Visão (Dashboard + Análise fundidos)
- Eyebrow "Visão · últimos 12 meses" e **frase grande em Playfair** que muda com o mês selecionado:
  "Novembro custou **R$ X**, N% abaixo de outubro. Sobraram **R$ Y**." (mês projetado: "Dezembro deve fechar
  perto de **R$ X**").
- **Gráfico** em largura total: barras empilhadas fixos (azul) + variáveis (verde) dos últimos 12 meses +
  1 mês projetado (hachurado, contorno tracejado); receita como linha tracejada no mesmo eixo; grade
  recessiva; topo das barras arredondado 4px, 2px de separação entre segmentos; hover com tooltip
  (Fixos / Variáveis / Total); clicar num mês seleciona e atualiza frase e cards. Um eixo só.
- **3 cards lado a lado:** "Onde foi o variável" (barras horizontais por categoria), "Fixos × variáveis"
  (barra dividida + valores e %), "Destaque" (variáveis vs média dos últimos 6 meses + total por fatura de cartão).
- Tabela/visão acessível dos dados do gráfico (dataviz: identidade nunca só por cor).

### 7.5 Ajustes (cadastros)
Eyebrow "Cadastros", título AJUSTES. Abas com indicador deslizante: **Categorias, Formas de pagamento,
Cartões, Fixos**. O painel tem exatamente a largura da barra de abas (alinhados).
- **Categorias:** grade com 4 por linha se a quantidade for par, 3 se for ímpar.
- **Formas de pagamento:** linhas compactas (ícone + nome com detalhe embaixo, ex.: "Pix / à vista · sai na hora").
- **Cartões:** leque de cartões metálicos (§8.2); abaixo, nome (Playfair) + Editar/Desativar e dados em
  4 colunas (Fechamento, Vencimento, Limite, Funções) do cartão da frente.
- **Fixos:** linhas com dia, nome + "categoria · forma", valor ("≈" se estimado) e linha de total previsto.
- Criar/editar/arquivar continuam existindo em todas as abas (as funções da `Settings.tsx` atual);
  formulários abrem no mesmo sheet lateral do "Novo lançamento".

### 7.6 Conta (configuração — nova)
Acessada só pelo verso do cartão de perfil. Eyebrow "Configuração", título CONTA. Abas segmentadas que ocupam
a largura do painel (560px): **Perfil** e **Dispositivos**.
- **Perfil:** layout do protótipo, **só leitura** nesta versão (`auth/me`): Nome e E-mail exibidos, "Enviar foto"
  e Salvar desabilitados com "em breve". Silhueta no lugar da foto.
- **Dispositivos:** sessões (navegador · sistema, "este dispositivo · ativo agora" / "último acesso há N dias"),
  pílula "Ativo" na sessão atual. O login passa a enviar `device_name` (montado do user-agent) e guarda o id da
  sessão para marcar "este dispositivo". **Sem botão "Encerrar"** nesta versão: hoje revogar não invalida o
  refresh token, e um botão que não encerra nada engana.

## 8. Componentes interativos (portar fielmente)

### 8.1 Cartão bancário metálico
Placa com gradiente da marca (`lib/banks.ts`), logotipo, chip EMV, contactless, nome, final do cartão,
"Vence D". Camada WebGL2 por cima (`mix-blend-mode: screen`): porta do `ReflectiveCard` enviado pelo usuário
sem vídeo — reflexos de sala/softbox, ruído de warp, escovado, brilho que segue o ponteiro, inclinação com mola
(rigidez 120, amortecimento 16), saída `pow(cor, 1.15)` com ganho 1.9 (preserva a cor da marca). Renderiza
só quando há movimento. Código de referência: IIFE "metal" no `prototipo.html`.

### 8.2 Leque de cartões (Faturas, Importar, Ajustes → Cartões)
Porta do componente `Stack` enviado pelo usuário com `layout="fan"`, `spread .5`, `depth .5`, `tilt 30`,
`threshold 90`, `sendToBackOnClick false`, `visible 4`: cartões girados a partir do canto inferior direito;
arrastar/arremessar o da frente além do limiar o manda para trás (voa, inclina pela velocidade, volta por
baixo); soltar antes volta com mola; setas/Enter/Espaço também trocam; entrada escalonada; `onChange(topIndex)`.
Referência: `makeFan` no `prototipo.html`.

### 8.3 Cartão de perfil giratório
Porta do `FlipCard` enviado pelo usuário (parâmetros na §6). Referência: IIFE "account flip card" no protótipo.

## 9. Remoções no frontend
Saem páginas, rotas, hooks de API, mocks e testes de: Dashboard, Analytics (viram Visão), Investments, Debts,
Acquisitions, RecurringExpenses e Cards (vira aba de Ajustes). Componentes antigos substituídos
(`BankCard`, `CardSwap`, `KpiCard`, `Topbar`, etc.) saem quando ficarem sem uso. Backend intacto.

## 10. Dados — de onde vem cada bloco

| Bloco | Fonte |
|---|---|
| Fixos previstos, chips pago/pendente | `transactions` do mês com `is_fixed` + `is_paid`; `months/{y}/{m}/summary` (`total_fixed`); `recurring-expenses` (fixo variável → "≈") |
| Resumo do mês | `months/{y}/{m}/summary` (`total_income`, `total_expense`, `balance`) |
| Faturas abertas | `cards/summary` (limite, comprometido, fatura do ciclo) |
| Próximos vencimentos | `transactions` do mês, fixos não pagos com data ≥ hoje |
| Movimentações | `transactions` (filtros do mês) |
| Importar | `cards` (ativos), `imports/statement/` (resultado com status por item e categoria) |
| Visão | `months/{y}/{m}/summary` dos últimos 12 meses (`total_fixed`, `total_variable`, `total_income`, `by_category`, `by_payment_method`); `cards/summary` para faturas |
| Ajustes | `categories`, `payment-methods`, `cards`, `recurring-expenses` (CRUD existentes) |
| Conta | `auth/me` (GET), `auth/sessions` (lista/encerrar) |

**Lacunas do backend:** resolvidas sem mexer no backend nesta versão (§12, itens 13–16). Ficam para uma
fase seguinte, se o usuário quiser: prévia (dry-run) da importação, PATCH de perfil + avatar, revogação real de
sessão (vincular ao refresh token + blacklist) e registro de importações.

## 11. Qualidade e testes
- TDD com Vitest + Testing Library + MSW (handlers atualizados para todas as telas).
- Lógica pura testada isoladamente: ordem do leque, snap/arremesso do flip, regra 3/4 colunas, mapeadores
  de dados (resumo, próximos vencimentos, série da Visão, projeção, frase), formatação de dinheiro.
- Componentes WebGL (touro, metal) com fallback e mockados no jsdom; testes de fumaça por página.
- `npm run build` e `npm test` verdes; checagem visual contra o protótipo em 1900×970.
- Acessibilidade: foco visível, teclado em leque/flip/abas, `aria-pressed` no flip, `prefers-reduced-motion`.

## 12. Decisões que tomei (o usuário pode revisar)
1. **Movimento:** sem `motion`. Leque e flip portam o integrador de mola próprio do protótipo (já verificado,
   ~20 linhas, `lib/spring.ts`); única dependência nova de animação é `three` para o touro.
2. **Gráfico da Visão** em SVG próprio (como no protótipo), não Recharts; Recharts sai se ficar sem uso.
3. **Projeção do próximo mês:** fixos = soma dos fixos ativos; variáveis = mesmo mês do ano anterior se existir,
   senão média dos últimos 6 meses.
4. **Linha de receita:** tracejada por mês (degrau), não uma linha única.
5. **Fontes** auto-hospedadas via `@fontsource` (sem depender do Google Fonts em runtime).
6. **Rotas:** `/` Lançamentos, `/import`, `/overview`, `/settings/:tab`, `/account/:tab`, `/login`.
7. **"Esconder interface"** (botão de demonstração do protótipo) não entra no produto.
8. **Chips de fixos** alternam pago com um clique; **linha de movimentação** abre edição no sheet.
9. Mês/ano do cartão de perfil e da tela seguem o mês selecionado (`PeriodContext`).
10. **Fatura paga** ganha controle em Faturas abertas e em Ajustes → Cartões (senão o limite usado fica errado).
11. **Fixos vencidos e não pagos** continuam em Próximos vencimentos com etiqueta "vencido".
12. **Movimentações** mantém busca, filtros extras e pago por linha (nenhuma função em uso se perde).
13. **Importar:** etapa 3 = relatório pós-importação (sem dry-run no backend).
14. **Perfil:** só leitura + "em breve" para foto/edição.
15. **Dispositivos:** lista real (login envia `device_name`), sem "Encerrar" até a revogação ser real.
16. **Histórico de importações** em `localStorage`.
17. **Celular:** foco desktop. Abaixo de 1100px as grades viram uma coluna; sem navegação mobile própria
    nem ajuste do touro nesta versão.

## 13. Deixado para o builder
Estrutura de pastas/componentes, divisão em tarefas, nomes, estratégia de cache do React Query, como
encapsular o canvas do touro no React, detalhes dos formulários de CRUD dentro do padrão visual descrito.
