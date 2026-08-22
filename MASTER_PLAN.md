# Master Plan: GistDB SDK — Multi-Device Sync & DX Enhancements (v1.1)

Este arquivo coordena o plano de implementação e a evolução do **GistDB SDK** para melhorar drasticamente a experiência do desenvolvedor (DX) e a sincronização transparente entre múltiplos dispositivos.

## Status do Projeto
- **Fase Atual:** Fase 1 — Identidade e Descoberta Automática de Dispositivos
- **Stack:** TypeScript, Web Crypto API (AES-GCM), GitHub Gist REST API, IndexedDB/Storage API
- **Progresso Geral:** 0%

## Diretrizes para Agentes
1. **Leia a Task:** Abra o arquivo correspondente na pasta `tasks/`.
2. **Siga os padrões:** Manter TypeScript estrito, métodos assíncronos e erros herdando de `GistDBError`.
3. **Preserve Contratos Públicos:** Não quebre a API legada `GistDB.create({ token, prefix, gistId })`. Torne as novas opções (`autoConnect`, `autoSync`, etc.) opcionais e retrocompatíveis.
4. **Testes:** Nenhuma task é concluída sem testes unitários em `__tests__/`.
5. **Reporte:** Ao finalizar, atualize o status abaixo para `[X]`.

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
| **03** | [Gerenciador de Ciclo de Vida (`autoSync`)](./tasks/03_auto_sync.md) | [ ] | 01, 02 |
| **04** | [Fila de Mutações Offline (`OutboxQueueManager`)](./tasks/04_outbox_queue.md) | [ ] | 03 |

### Fase 3: Estado de Sessão e Polling Inteligente
| ID | Task | Status | Dependências |
|----|------|--------|--------------|
| **05** | [API de Hand-off de Sessão (`db.session`)](./tasks/05_session_handoff.md) | [ ] | 02 |
| **06** | [Smart ETag Polling (`If-None-Match` no `watch`)](./tasks/06_smart_etag_watch.md) | [ ] | 01 |

---

## Notas de Orquestração
- **TypeScript:** Todas as exportações públicas devem estar tipadas em `src/types.ts`.
- **Compatibilidade Node/Browser:** Manter suporte isomórfico (Web APIs com fallbacks apropriados).
