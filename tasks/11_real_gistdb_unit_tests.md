# Task 11: Testes Unitários com a Classe Real `GistDB` e Limpeza de Código Morto

## Objetivo
Refatorar a suíte de testes `__tests__/GistDB.test.ts` para testar diretamente a classe real `GistDB` (usando mocks de rede em `GistAPI` ou `fetch` global) em vez da reimplementação `makeTestDB()`, e remover o arquivo de suporte morto `__tests__/support/helpers.js`.

## Arquivos de Entrada
- `__tests__/GistDB.test.ts`
- `__tests__/support/helpers.js`
- `src/GistDB.ts`

## Detalhamento da Execução

1. **[Limpeza de Código Morto]:**
   - Deletar `__tests__/support/helpers.js` (ou substituir por utilitários minimalistas importados se estritamente necessários).

2. **[Refatoração de `GistDB.test.ts`]:**
   - Substituir a função `makeTestDB()` inline por uma chamada real a `GistDB.create({ token: 'ghp_mock', prefix: 'test' })`.
   - Mockar a camada HTTP da `GistAPI` ou o `fetch` global para responder com gists simulados em memória sem tráfego de rede real.
   - Garantir a cobertura dos métodos públicos (`create`, `get`, `set`, `delete`, `list`, `sync`, `getLastSyncAt`, `watch`, `destroy`, `devices.list`).

3. **[Critérios de Aceite & Feedback]:**
   - [ ] `__tests__/GistDB.test.ts` consome a exportação real de `src/GistDB.ts`.
   - [ ] Código morto `__tests__/support/helpers.js` é removido.
   - [ ] Todos os 50+ testes passam com sucesso rodando `npm test`.
