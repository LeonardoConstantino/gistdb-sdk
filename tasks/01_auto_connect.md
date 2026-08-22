# Task 01: Descoberta Automática de Gist (`autoConnect`)

## Objetivo
Permitir que o SDK descubra e reconecte automaticamente a um Gist existente da aplicação pesquisando na conta do GitHub do usuário via API REST pelo marcador de `prefix`, eliminando a necessidade de fornecer manualmente o `gistId` no 2º dispositivo.

## Arquivos de Entrada
- `src/types.ts`
- `src/GistAPI.ts`
- `src/GistDB.ts`
- `__tests__/GistDB.test.ts`

## Detalhamento da Execução

1. **[Types & API — `autoConnect` option]:**
   - Adicionar o parâmetro opcional `autoConnect?: boolean` na interface `GistDBConfig`.
   - Adicionar método `findGistByPrefix(prefix: string): Promise<string | null>` na classe `GistAPI`.
   - O método consulta `GET /gists` filtrando pela descrição no formato `GistDB [prefix]`.

2. **[GistDB.create integration]:**
   - Na factory `GistDB.create`:
     - Se `gistId` for omitido E `autoConnect: true` (ou por padrão se omitido), invocar `findGistByPrefix`.
     - Se encontrar um Gist existente, reusar seu ID.
     - Se não encontrar, criar um novo Gist com a descrição `GistDB [prefix]` e reusar o ID gerado.

3. **[Critérios de Aceite & Feedback]:**
   - [ ] `GistDB.create({ token, prefix, autoConnect: true })` encontra o Gist existente sem receber `gistId`.
   - [ ] Se não existir Gist com o prefixo, um novo Gist com tag `GistDB [prefix]` é criado.
   - [ ] Teste unitário em `__tests__/GistDB.test.ts` simulando a busca via mock da API.
