# Task 08: Sincronização de Contratos (`types.ts`, `package.json`, `usage-example.js`)

## Objetivo
Resolver discrepâncias de tipos e contratos entre `src/types.ts` e a API real (`GistDB.create`), atualizar `usage-example.js` com opções válidas, ajustar o entrypoint do `package.json` para `./dist/gistdb.min.js` e remover/atualizar arquivos obsoletos (`index.js`).

## Arquivos de Entrada
- `src/types.ts`
- `package.json`
- `usage-example.js`
- `index.js`

## Detalhamento da Execução

1. **[Contratos & Tipos — `src/types.ts`]:**
   - Atualizar a interface `GistDBConfig` para refletir exatamente as opções aceitas em `GistDB.create()` (`password`, `conflictResolver`, `ttl`, `autoConnect`, `autoSync`, `deviceName`).
   - Sincronizar `CacheEntry` e remover/corrigir tipos não utilizados ou obsoletos.

2. **[Exemplo de Uso — `usage-example.js`]:**
   - Corrigir os nomes das propriedades: `password` (em vez de `encryptionKey`), `conflictResolver` (em vez de `conflict`), `ttl` (em vez de `cacheTTL`).

3. **[Package & Entrypoint — `package.json` & `index.js`]:**
   - Ajustar `main` em `package.json` para `./dist/gistdb.min.js` e adicionar campo `types`.
   - Limpar ou re-exportar `index.js` adequadamente.

4. **[Critérios de Aceite & Feedback]:**
   - [ ] `usage-example.js` executa sem erros de parâmetro inválido.
   - [ ] `npm run typecheck` (tsc) valida `types.ts` e compila limpo sem avisos.
   - [ ] Executar `npm test` e verificar se a suíte de testes passa 100%.
