# Task 03: Gerenciador de Ciclo de Vida (`autoSync`)

## Objetivo
Implementar sincronização automática orientada a eventos do ciclo de vida da aplicação (ganho de foco da janela, reconexão de rede e descarregamento da página).

## Arquivos de Entrada
- `src/types.ts`
- `src/GistDB.ts`
- `__tests__/GistDB.test.ts`

## Detalhamento da Execução

1. **[Configuração `autoSync`]:**
   - Suportar objeto de configuração em `GistDBConfig`:
     ```typescript
     autoSync?: {
       onFocus?: boolean;
       onReconnect?: boolean;
       onUnload?: boolean;
     }
     ```

2. **[Listeners do Ciclo de Vida]:**
   - Se em ambiente de navegador (`typeof window !== 'undefined'`), registrar listeners para:
     - `visibilitychange` (quando `document.visibilityState === 'visible'`) -> dispara `db.sync()`.
     - `online` -> dispara `db.sync()`.
     - `beforeunload` / `pagehide` -> esvazia filas pendentes.
   - Fornecer método interno de cleanup ao chamar `db.destroy()`.

## Critérios de Aceite
- [ ] Ativar `autoSync: { onFocus: true }` executa `sync()` automaticamente quando o documento ganha foco.
- [ ] Chamada ao `db.destroy()` remove todos os listeners de eventos sem deixar vazar memória.
