---
description: Dispara em paralelo os workstreams que já têm dependências satisfeitas
---
Analise o grafo de dependências da seção 1 de `FINFLOW_PLANO_IMPLEMENTACAO_v2.md`
e o estado atual do repositório. Identifique quais workstreams podem rodar
SIMULTANEAMENTE agora e dispare os subagentes correspondentes em paralelo.

Regras:
- agent-front-core pode rodar a qualquer momento (mocka a API com MSW).
- Após F2 (db) concluída, agent-domain e agent-seed podem rodar juntos.
- Trate as seções 5 e 6 como contratos congelados — se algum subagente precisar
  mudá-las, PARE tudo, atualize o documento primeiro e avise.
Ao final, consolide os relatórios dos subagentes em um resumo único.
