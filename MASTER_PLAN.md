# Master Plan: GistDB SDK — Multi-Device Sync, DX & Refactoring (v1.2)

Este arquivo coordena o plano de implementação e a evolução do **GistDB SDK** para melhorar a experiência do desenvolvedor (DX), a sincronização transparente entre múltiplos dispositivos e o saneamento técnico decorrente das auditorias de código (Code Review v2).

## Status do Projeto
- **Fase Atual:** Fase 4 — Correções e Refatoração de Qualidade (Code Review v2)
- **Stack:** TypeScript, Web Crypto API (AES-GCM), GitHub Gist REST API, IndexedDB/Storage API
- **Progresso Geral:** Tasks 01, 02 e 03 Concluídas ([X])

## Diretrizes para Agentes
1. **Isolamento de Branches:** Cada task deve ser implementada em sua própria branch (ex: `feature/task-07-transport-timeout`).
2. **Leia a Task:** Abra o arquivo correspondente na pasta `tasks/`.
3. **Siga os Padrões:** Manter TypeScript estrito, métodos assíncronos e erros herdando de `GistDBError`.
4. **Preserve Contratos Públicos:** Não quebre a API pública `GistDB.create({ token, prefix, ... })`.
5. **Testes Obrigatórios:** Nenhuma task é dada como concluída até que todos os testes (`npm test`) estejam passando.
6. **Reporte:** Ao finalizar e mesclar a branch na `master`, atualize o status abaixo para `[X]`.

---

## Lista de Tarefas (Pipeline)

### Fase 1: Identidade e Descoberta Automática
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **01** | [Descoberta Automática de Gist (`autoConnect`)](./tasks/01_auto_connect.md) | [X] | — |
| **02** | [Identidade de Dispositivo & Metadados de Envelope](./tasks/02_device_identity.md) | [X] | — |

### Fase 2: Automação do Ciclo de Vida e Resiliência (DX)
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **03** | [Gerenciador de Ciclo de Vida (`autoSync`)](./tasks/03_auto_sync.md) | [X] | 01, 02 |
| **04** | [Fila de Mutações Offline (`OutboxQueueManager`)](./tasks/04_outbox_queue.md) | [ ] | 03 |

### Fase 3: Estado de Sessão e Polling Inteligente
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **05** | [API de Hand-off de Sessão (`db.session`)](./tasks/05_session_handoff.md) | [ ] | 02 |
| **06** | [Smart ETag Polling (`If-None-Match` no `watch`)](./tasks/06_smart_etag_watch.md) | [ ] | 01 |

### Fase 4: Correções e Refatoração de Qualidade (Code Review v2)
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **07** | [Correção do Timeout em `GistTransport` via `AbortController`](./tasks/07_fix_transport_timeout.md) | [X] | — |
| **08** | [Sincronização de Contratos (`types.ts`, `package.json`, `usage-example.js`)](./tasks/08_fix_types_and_examples.md) | [X] | — |
| **09** | [Subscribers do `Logger` e Desduplicação no Playground](./tasks/09_fix_logger_subscribers.md) | [X] | — |
| **10** | [Persistência de `lastSyncAt` e Pipeline de Decifragem em `GistDB.ts`](./tasks/10_refactor_decryption_pipeline_and_lastsync.md) | [X] | — |
| **11** | [Testes Unitários da Classe Real `GistDB` e Limpeza de Código Morto](./tasks/11_real_gistdb_unit_tests.md) | [ ] | 07, 10 |

---

## Notas de Orquestração
- **Branches por Task:** Sempre criar uma nova branch `feature/task-XX-...` antes de iniciar cada tarefa.
- **Validação com Testes:** A tarefa só é finalizada quando `npm test` executar com 100% de sucesso.
- **TypeScript:** Todas as exportações públicas devem estar devidamente tipadas em `src/types.ts`.
