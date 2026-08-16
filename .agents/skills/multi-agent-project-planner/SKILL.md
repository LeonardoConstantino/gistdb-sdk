---
name: multi-agent-project-planner
description: >
  Decompõe qualquer projeto de software (ou projeto complexo) em um sistema de
  arquivos de planejamento multi-agente: um arquivo MASTER_PLAN.md orquestrador
  central + arquivos de task individuais, auto-contidos e prontos para execução
  paralela por múltiplos agentes. Use esta skill SEMPRE que o usuário mencionar
  frases como "planejar refatoração", "dividir projeto em tasks", "criar plano
  multi-agente", "organizar tarefas para agentes", "quero um master plan",
  "decompor projeto", "pipeline de desenvolvimento", "tasks paralelas", ou
  quando o usuário apresentar um projeto com múltiplas funcionalidades a
  implementar. Ative mesmo que o usuário não mencione "agentes" — se ele quer
  organizar um projeto complexo em partes executáveis, esta skill é a correta.
---

# Multi-Agent Project Planner

## Objetivo

Transformar a descrição de um projeto (ou uma lista de funcionalidades) em um
sistema de arquivos de planejamento estruturado, onde um arquivo central
orquestra o estado global e cada task possui seu próprio arquivo isolado com
tudo que um agente precisa para executá-la de forma autônoma e paralela.

O resultado final é um conjunto de arquivos `.md` prontos para serem colocados
em um repositório e consumidos por agentes de IA ou desenvolvedores humanos.

---

## Quando usar

- Usuário quer planejar uma refatoração de projeto existente
- Usuário lista funcionalidades e quer transformá-las em tasks executáveis
- Usuário menciona "dividir trabalho entre agentes" ou "execução paralela"
- Usuário tem um projeto com 3+ funcionalidades interdependentes
- Usuário quer um "roadmap técnico" ou "plano de implementação" estruturado
- Usuário apresenta código e pergunta "por onde começar" ou "como organizar"

---

## Processo

### Passo 1 — Coleta de contexto

Antes de gerar qualquer arquivo, identifique:

1. **Stack tecnológica** (linguagem, framework, bibliotecas principais)
2. **Estado atual** (greenfield, refatoração, migração?)
3. **Lista de funcionalidades** a implementar (extraia do que o usuário forneceu)
4. **Arquivos/módulos centrais** que as tasks vão tocar
5. **Design System ou padrões de estilo** vigentes (se houver)
6. **Restrições** (versões de libs, padrões proibidos, etc.)

Se algum desses itens for crítico e estiver faltando, faça no máximo 2 perguntas
objetivas antes de continuar. Nunca bloqueie por informações secundárias.

---

### Passo 2 — Decomposição em fases e tasks

Organize as funcionalidades em **fases lógicas** (ex: Infraestrutura → Core →
Features → Refinamentos) e dentro de cada fase, em **tasks atômicas**:

**Critérios de uma boa task:**
- Executável por um único agente sem depender de outra task em andamento
- Tem entradas claras (arquivos de entrada) e saídas verificáveis (critérios de aceite)
- Não ultrapassa ~1 dia de trabalho de um agente
- Pode ser validada por testes

**Mapeie dependências** entre tasks usando IDs numéricos (ex: Task 03 depende de 01 e 02).

---

### Passo 3 — Gerar o MASTER_PLAN.md

Crie o arquivo central com esta estrutura:

```markdown
# Master Plan: [Nome do Projeto] (v[versão])

Este arquivo coordena a execução de tarefas por múltiplos agentes.

## Status do Projeto
- **Fase Atual:** [fase inicial]
- **Stack:** [tecnologias principais]
- **Progresso Geral:** 0%

## Diretrizes para Agentes
1. **Leia a Task:** Abra o arquivo correspondente na pasta `tasks/`.
2. **Siga os padrões:** [referência ao design system ou guia de estilo, se houver]
3. **Não altere outros módulos** além dos listados em "Arquivos de Entrada" da task.
4. **Testes:** Nenhuma task é concluída sem critérios de aceite verificados.
5. **Reporte:** Ao finalizar, atualize o status abaixo para [X].

---

## Lista de Tarefas (Pipeline)

### Fase 1: [Nome da Fase]
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **01** | [Nome da Task](./tasks/01_nome.md) | [ ] | — |
| **02** | [Nome da Task](./tasks/02_nome.md) | [ ] | 01 |

### Fase 2: [Nome da Fase]
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **03** | [Nome da Task](./tasks/03_nome.md) | [ ] | 01, 02 |

---
## Notas de Orquestração
- [Restrições globais, convenções obrigatórias, padrões a seguir]
```

---

### Passo 4 — Gerar cada arquivo de task

Para cada task identificada, crie `tasks/NN_nome_da_task.md`:

```markdown
# Task NN: [Nome da Task]

## Objetivo
[1-2 parágrafos: o que deve ser implementado e por quê]

## Arquivos de Entrada
- `src/path/to/file.ts`   ← arquivos que o agente DEVE ler/modificar
- `src/path/to/other.ts`

## Detalhamento da Execução

1. **[Subtask 1 — Nome]:**
   - Detalhe técnico do que fazer
   - Se X, então Y; caso contrário, Z

2. **[Subtask 2 — Nome]:**
   - Detalhe técnico
   - Referência a interfaces, tipos, ou contratos relevantes

3. **[Interface / UI (se aplicável)]:**
   - Componentes a criar ou modificar
   - Padrões visuais a seguir

4. **[Feedback / Testes]:**
   - Como verificar que a implementação está correta

## Critérios de Aceite
- [ ] [Comportamento verificável 1]
- [ ] [Comportamento verificável 2]
- [ ] [Comportamento verificável 3]
```

**Regras para arquivos de task:**
- Cada task deve ser **auto-contida**: um agente que só leu este arquivo deve
  conseguir executá-la sem consultar outros arquivos do plano.
- Liste explicitamente os arquivos de entrada — nunca deixe o agente adivinhar.
- Os critérios de aceite devem ser **binários e verificáveis** (não "funciona bem",
  mas "ao importar o arquivo X, o estado Y é restaurado").
- Inclua contexto de stack/padrões relevantes dentro da task se necessário.

---

### Passo 5 — Validação do plano

Antes de entregar, verifique:

- [ ] Todas as funcionalidades do usuário foram mapeadas em pelo menos uma task?
- [ ] Nenhuma task tem dependência circular?
- [ ] Tasks da mesma fase podem ser executadas em paralelo?
- [ ] Os critérios de aceite são verificáveis sem ambiguidade?
- [ ] O MASTER_PLAN tem diretrizes suficientes para um agente trabalhar de forma autônoma?
- [ ] Há uma ordem lógica de execução que não bloqueia o progresso?

---

## Formato de saída

Entregar **dois blocos distintos**:

**1. Visão geral do plano** (em prosa, ~150 palavras):
- Número de fases e tasks
- Quais tasks podem rodar em paralelo
- Dependências críticas no caminho
- Estimativa de complexidade geral

**2. Conteúdo completo dos arquivos**, na ordem:
```
📁 MASTER_PLAN.md
[conteúdo completo]

📁 tasks/01_nome.md
[conteúdo completo]

📁 tasks/02_nome.md
[conteúdo completo]
...
```

Se o projeto tiver mais de 10 tasks, gere o MASTER_PLAN completo e pergunte ao
usuário quais tasks detalhar primeiro, para não sobrecarregar o contexto.

---

## Exemplos

<exemplo_1>
[Contexto]: Projeto frontend em TypeScript com Tailwind. Usuário quer refatorar
um editor de relatórios fotográficos com ~5 funcionalidades novas.

[Entrada do usuário]: "Preciso adicionar: barra de status, persistência de
configurações, toggle de preview, sistema de templates e import/export JSON."

[Ação da skill]:
1. Identifica stack: TypeScript, Tailwind v4, AppStore central, IndexedDB
2. Decompõe em 5 tasks, agrupa na Fase 6 (Refinamentos)
3. Mapeia dependências: todas dependem das tasks de store (03) e layout (06)
4. Gera MASTER_PLAN com tabela de status e diretrizes
5. Gera 5 arquivos de task, cada um com arquivos de entrada e critérios binários

[Saída esperada]:
- `00_MASTER_PLAN.md` com tabela de 5 tasks, dependências e diretrizes Tailwind v4
- `tasks/11_status_bar.md` até `tasks/15_import_export_json.md`, cada um
  com objetivo, arquivos de entrada, detalhamento em subtasks e critérios de aceite
</exemplo_1>

<exemplo_2>
[Contexto]: API backend em Python/FastAPI. Usuário quer construir do zero um
serviço de autenticação com JWT, RBAC e auditoria.

[Entrada do usuário]: "Quero criar um sistema de auth com login, refresh token,
controle de permissões por role e log de acessos."

[Ação da skill]:
1. Identifica stack: Python, FastAPI, SQLAlchemy (inferido do contexto)
2. Decompõe em fases: Infraestrutura (modelos DB) → Core Auth (JWT) →
   RBAC (roles/permissions) → Auditoria (audit log)
3. Gera 7 tasks com dependências explícitas
4. Inclui nas diretrizes: padrão de resposta da API, convenções de nomenclatura

[Saída esperada]:
- `MASTER_PLAN.md` com 4 fases e 7 tasks
- Tasks individuais com endpoints a implementar, schemas Pydantic esperados
  e testes de integração como critérios de aceite
</exemplo_2>

---

## Anti-exemplos (quando NÃO usar)

- Usuário quer apenas **explicar** como um projeto funciona (use análise direta)
- Projeto tem apenas **1-2 funcionalidades** simples (overhead desnecessário)
- Usuário quer um **cronograma de projeto** com datas e pessoas (use outra abordagem)
- Usuário quer **documentação técnica** do código existente, não planejamento

---

## Notas de compatibilidade

- **Claude 3+:** Aproveite a janela longa para gerar todos os arquivos de uma vez
  em projetos de até 10 tasks. Para projetos maiores, gere o master plan e itere.
- **GPT-4/4o:** Insira as diretrizes de stack no system prompt para consistência
  entre múltiplas chamadas de geração de task.
- **Llama 3 / open source:** Use delimitadores XML explícitos como
  `<master_plan>...</master_plan>` e `<task id="01">...</task>` para estruturar
  a geração e facilitar o parsing posterior.
- **Uso com agentes de código** (Claude Code, Cursor, Copilot Workspace): Os
  arquivos gerados por esta skill são diretamente consumíveis — basta apontar o
  agente para o arquivo de task correspondente.