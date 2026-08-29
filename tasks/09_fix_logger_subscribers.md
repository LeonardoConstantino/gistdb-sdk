# Task 09: Ajuste nos Subscribers do `Logger` & Eliminação de Logs Duplicados no Playground

## Objetivo
Garantir que handlers inscritos via `Logger.subscribe()` recebam todos os registros de log estruturados independente do estado de `Logger.enable()`, e eliminar a duplicação de logs no `playground.html`.

## Arquivos de Entrada
- `src/Logger.ts`
- `playground.html`
- `__tests__/Logger.test.ts`

## Detalhamento da Execução

1. **[Logger.ts — `shouldLog` logic]:**
   - Atualizar a lógica de `shouldLog(lvl)` em `Logger.ts` para que se houver subscribers cadastrados (`this.handlers.size > 0`), a emissão interna para handlers ocorra independente de `this.enabled` (que deve controlar apenas o output no `console`).

2. **[playground.html — Eliminação de logs duplicados]:**
   - Ajustar o `playground.html` para evitar logar o mesmo evento duas vezes (uma via `console.info` interceptado e outra via `Logger.subscribe()`).

3. **[Critérios de Aceite & Feedback]:**
   - [ ] Teste em `__tests__/Logger.test.ts` garantindo que `Logger.subscribe()` recebe eventos mesmo sem chamar `Logger.enable()`.
   - [ ] Playground funciona exibindo uma única entrada por evento no rail de logs.
   - [ ] `npm test` passa 100%.
