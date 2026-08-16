---
name: code-review-multifile
description: >
  Realiza code review profundo em projetos com múltiplos arquivos lidos diretamente
  do sistema de arquivos. Use esta skill SEMPRE que o usuário pedir para revisar um
  projeto, pasta, repositório, ou múltiplos arquivos de código — mesmo que ele não
  use a palavra "review" explicitamente. Gatilhos: "revisa meu projeto", "olha esse
  repositório", "analisa essa pasta", "revisa os arquivos", "faz um code review do
  projeto", "o que tem de errado no meu código", "melhora meu projeto". A skill
  avalia dois eixos igualmente: (1) arquitetura e dependências entre módulos e
  (2) consistência de padrões entre arquivos. Deve ser ativada mesmo que o usuário
  forneça apenas o caminho do projeto sem pedir review explicitamente.
---

# Code Review Multi-Arquivo

## Objetivo

Realizar code review de altíssimo nível em projetos com múltiplos arquivos,
combinando análise unitária por arquivo (via motor de review) com visão sistêmica
de arquitetura e consistência de padrões. O agente lê os arquivos diretamente do
sistema de arquivos e entrega um relatório estruturado com dois níveis: projeto e
arquivo.

Foco igualmente distribuído entre:

- **Arquitetura**: dependências, acoplamento, separação de responsabilidades, fluxo de dados entre módulos.
- **Consistência**: padrões de nomenclatura, estilo, estrutura de funções e comentários aplicados de forma uniforme no projeto.

---

## Quando usar

- Usuário fornece um caminho de pasta ou repositório
- Usuário menciona "projeto", "repo", "repositório", "pasta com arquivos"
- Usuário pede para revisar "o código todo" ou "todos os arquivos"
- Usuário cola uma estrutura de diretórios e pede análise
- Usuário diz "o que tem de errado no meu projeto"
- Qualquer solicitação de review que implique mais de um arquivo

---

## Processo

### Fase 0 — Mapeamento

1. Liste recursivamente os arquivos do projeto com `find <path> -type f` (ou `ls -R`).
2. Filtre arquivos irrelevantes: `node_modules/`, `.git/`, `dist/`, `build/`, `*.lock`, `*.log`, binários.
3. Identifique a linguagem principal e o tipo de projeto (API, frontend, lib, CLI, monorepo).
4. Classifique os arquivos em grupos lógicos:
   - **Entrypoints** (index, main, app, server)
   - **Módulos de domínio** (lógica de negócio)
   - **Utilitários e helpers**
   - **Configuração** (env, config, tsconfig, package.json)
   - **Testes**

> Se houver mais de 20 arquivos relevantes, informe o usuário e priorize os grupos
> Entrypoints e Módulos de domínio. Leia os demais sob demanda.

---

### Fase 1 — Leitura e Análise Unitária

Para cada arquivo relevante (em ordem: entrypoints → domínio → utilitários → config):

1. Leia o arquivo completo com `cat <path>` ou equivalente.
2. Aplique o **Motor de Review Unitário** (ver `references/unit-review-engine.md`):
   - Resumo do que o arquivo faz
   - Críticas objetivas (performance, legibilidade, manutenibilidade, idiomatismo)
   - Sugestões (reescrita se < 30 linhas; recomendações estruturais se ≥ 30 linhas)
   - Avaliação de comentários existentes
3. Registre internamente para a Fase 2:
   - Exports e imports do arquivo
   - Padrões de nomenclatura usados
   - Estilo de tratamento de erros
   - Padrões de async/await, callbacks ou Promises
   - Presença e qualidade de comentários/JSDoc

---

### Fase 2 — Análise Sistêmica

Após ler todos os arquivos, execute dois eixos de análise:

#### Eixo A — Arquitetura e Dependências

- Mapeie o grafo de dependências entre módulos (quem importa quem).
- Identifique:
  - **Acoplamento excessivo**: módulo que importa muitos outros sem necessidade
  - **Dependências circulares**: A → B → A
  - **Violações de separação de responsabilidades**: lógica de negócio misturada com I/O, UI ou configuração
  - **Módulos anêmicos**: arquivos com apenas re-exports ou passagem de dados sem lógica própria
  - **Módulos sobrecarregados**: um arquivo fazendo trabalho que deveria estar em 3+
- Avalie o fluxo de dados: de onde os dados entram, como são transformados, onde saem.

#### Eixo B — Consistência de Padrões

Compare os padrões entre todos os arquivos e aponte inconsistências em:

| Categoria            | O que verificar                                              |
| -------------------- | ------------------------------------------------------------ |
| Nomenclatura         | camelCase vs snake_case, prefixos, sufixos                   |
| Estrutura de funções | arrow vs function declaration, tamanho médio                 |
| Async                | mix de callbacks, Promises e async/await                     |
| Tratamento de erros  | try/catch vs `.catch()` vs ausência                          |
| Comentários          | JSDoc presente em uns, ausente em outros; estilos diferentes |
| Exports              | named vs default misturados sem critério                     |
| Constantes           | hardcoded em uns, centralizadas em outros                    |

---

### Fase 3 — Relatório Consolidado

Entregue o relatório no formato abaixo. Seja conciso: priorize problemas reais,
omita elogios genéricos.

```
## 📁 Code Review — [Nome do Projeto]

### Visão Geral
[Tipo de projeto, linguagem, estrutura. 2-3 linhas.]

---

### 🏗️ Arquitetura

**Pontos críticos:**
- [problema 1 com localização: arquivo(s) envolvido(s)]
- [problema 2...]

**Dependências problemáticas:**
[Grafo simplificado apenas se houver dependências circulares ou acoplamento crítico]

**Recomendações estruturais:**
- [recomendação 1]
- [recomendação 2]

---

### 🔄 Consistência

**Inconsistências encontradas:**
| Padrão | Arquivos A | Arquivos B | Recomendação |
|--------|------------|------------|--------------|
| [ex: async] | usa async/await | usa .then() | padronizar com async/await |

---

### 📄 Review por Arquivo

#### `caminho/arquivo.js`
**Resumo:** [1 linha]
**Críticas:** [lista objetiva]
**Sugestões:** [código ou recomendações]
**Comentários:** [avaliação]

[repetir para cada arquivo]

---

### 🎯 Prioridades de Refatoração

1. 🔴 **Crítico** — [problema que causa bugs ou falha de segurança]
2. 🟠 **Alto** — [problema que compromete manutenibilidade]
3. 🟡 **Médio** — [inconsistência ou débito técnico]
4. 🟢 **Baixo** — [melhoria de estilo ou legibilidade]
```

---

## Orientações Globais

- Seja conciso, técnico e direto. Clareza > elegância.
- Não presuma requisitos inexistentes no código.
- Não introduza abstrações desnecessárias nas sugestões.
- ❌ Nunca sugira overengineering: padrões complexos sem ganho claro.
- ✅ A melhoria proposta deve reduzir ou manter a complexidade cognitiva.
- Se um arquivo estiver fora do escopo da linguagem principal (ex: arquivo de config YAML num projeto JS), revise apenas se contiver erros evidentes.
- Para projetos > 20 arquivos: entregue o relatório em partes (Arquitetura primeiro, depois arquivos por grupo lógico) e pergunte se o usuário quer continuar.

---

## Anti-exemplos (quando NÃO usar esta skill)

- Usuário cola um único bloco de código no chat → use o motor de review unitário diretamente (sem esta skill)
- Usuário pede explicação teórica sobre arquitetura → responda diretamente
- Usuário quer refatorar apenas um função específica → review pontual sem fase sistêmica

---

## Referências

- `references/unit-review-engine.md` — Motor de review por arquivo (prompt completo adaptado para uso pelo agente)
