# FinFlow — Pacote de Agentes para Claude Code

Este pacote configura **7 subagentes especializados** + **4 slash commands** de
orquestração para construir o FinFlow conforme o `FINFLOW_PLANO_IMPLEMENTACAO_v2.md`.

## 📦 Instalação

1. Copie estes arquivos para a **raiz do seu projeto** (onde o Claude Code roda):

```
seu-projeto/
├── CLAUDE.md                          ← regras globais (sempre ativas)
├── FINFLOW_PLANO_IMPLEMENTACAO_v2.md  ← a especificação (cole aqui!)
├── .claude/
│   ├── agents/                        ← os 7 subagentes
│   │   ├── agent-infra.md
│   │   ├── agent-db.md
│   │   ├── agent-domain.md
│   │   ├── agent-api.md
│   │   ├── agent-seed.md
│   │   ├── agent-front-core.md
│   │   └── agent-front-pages.md
│   └── commands/                      ← 4 comandos de orquestração
│       ├── finflow-bootstrap.md
│       ├── finflow-phase.md
│       ├── finflow-parallel.md
│       └── finflow-verify.md
```

> Os agentes em `.claude/agents/` são **project-scoped**: ficam versionados no
> repo e disponíveis para qualquer pessoa do time.

2. Abra o Claude Code na raiz do projeto. Rode `/agents` para confirmar que os 7
   aparecem na aba Library (Project).

## 🚀 Como usar

### Caminho recomendado (fase a fase, controlado)
```
/finflow-bootstrap          # cria infra (F1) e valida o ambiente
/finflow-phase 2            # modelagem do banco
/finflow-phase 3            # domínio em TDD (o mais crítico)
/finflow-phase 4            # API REST
/finflow-phase 5            # seed com dados reais
/finflow-phase 6            # fundação do front
/finflow-phase 7            # páginas e gráficos
/finflow-verify             # checklist de aceitação final
```

### Caminho rápido (paralelizado)
Depois da F2 concluída:
```
/finflow-parallel
```
O orquestrador dispara `agent-domain`, `agent-seed` e `agent-front-core`
simultaneamente (dependências já satisfeitas).

### Invocação direta de um agente
Você também pode chamar pelo nome em linguagem natural:
> "Use o **agent-domain** para implementar a PriceStrategy e seus testes."

Ou deixar o Claude Code rotear automaticamente — as descrições têm "MUST BE USED
for…" para auto-invocação por tipo de tarefa.

## 🧠 Modelos por agente
| Agente | Modelo | Por quê |
|---|---|---|
| agent-domain | **opus** | matemática financeira + TDD exigem o mais capaz |
| demais | **sonnet** | ótimo custo/desempenho para scaffolding e CRUD |
| sessão principal (orquestrador) | opus | coordenação e julgamento |

> Dica: rode a sessão principal em Opus (`claude --model opus`) para coordenar e
> deixe os subagentes Sonnet fazerem o trabalho de implementação.

## 🔒 Princípios embutidos em todos os agentes
- **Contratos congelados:** seções 5 (tabelas) e 6 (JSON) não mudam sem atualizar
  o documento primeiro — é o que elimina ruído entre back e front.
- **Escopo estrito:** cada agente recusa trabalho fora do seu workstream e reporta
  ao orquestrador.
- **TDD não-negociável** no agent-domain e agent-api.
- **UV, nunca pip/requirements.** Dinheiro nunca como float.

## ⚙️ Opcional: Agent Teams (experimental)
Para execução verdadeiramente concorrente de múltiplos subagentes, habilite:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```
Sem isso, a paralelização acontece via delegações sequenciais coordenadas pelo
orquestrador (suficiente para a maioria dos casos).
