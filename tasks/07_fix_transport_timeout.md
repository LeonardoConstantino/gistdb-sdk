# Task 07: Correção do Timeout no `GistTransport` via `AbortController`

## Objetivo
Corrigir o bug onde o `AbortController` criado na função `#retry` de `GistTransport.ts` não repassa o `signal` para a requisição HTTP em `GistAPI.ts`, tornando a configuração de timeout inoperante e deixando o SDK vulnerável a requisições travadas na API do GitHub.

## Arquivos de Entrada
- `src/GistAPI.ts`
- `src/GistTransport.ts`
- `__tests__/GistTransport.test.ts`

## Detalhamento da Execução

1. **[GistAPI — Suporte a `AbortSignal`]:**
   - Atualizar a assinatura dos métodos privados e públicos da `GistAPI` (ou `#req`) para aceitar um `signal?: AbortSignal` opcional.
   - Passar `signal` dentro das opções de `fetch(url, { ...opts, signal })`.

2. **[GistTransport — Conexão do `controller.signal`]:**
   - Atualizar a função `#retry<T>(fn: (signal?: AbortSignal) => Promise<T>, attempt = 0)` em `GistTransport.ts`.
   - Passar `controller.signal` para a função `fn(controller.signal)`.

3. **[Critérios de Aceite & Feedback]:**
   - [ ] Requisições HTTP em `GistAPI` aceitam `AbortSignal` e cancelam o `fetch` em caso de abort.
   - [ ] Teste unitário em `__tests__/GistTransport.test.ts` simulando um timeout de rede com `AbortController` ativado.
   - [ ] Executar `npm test` e garantir que todos os 50+ testes passem sem regressão.
