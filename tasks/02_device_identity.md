# Task 02: Identidade de Dispositivo & Metadados de Envelope

## Objetivo
Injetar metadados automatizados de identidade do dispositivo (`deviceId`, `deviceName`, `platform`) em cada alteração enviada ao Gist (`set()`), além de disponibilizar a API `db.devices` para listar dispositivos ativos.

## Arquivos de Entrada
- `src/types.ts`
- `src/GistDB.ts`
- `src/GistTransport.ts`
- `__tests__/GistDB.test.ts`

## Detalhamento da Execução

1. **[Device Identity Generator]:**
   - Criar utilitário interno para derivar/recuperar um `deviceId` único persistido (via `localStorage` / `sessionStorage` com fallback para UUID em memória).
   - Injetar no payload de cada gravação os metadados `_device`: `{ id, name, platform, updatedAt }`.

2. **[Gerenciador de Registro de Dispositivos (`db.devices`)]:**
   - Criar coleção especial de controle `_devices` no Gist.
   - Sempre que `GistDB.create()` for chamado, registrar/atualizar o `lastSeenAt` do dispositivo atual.
   - Expor método `db.devices.list(): Promise<DeviceInfo[]>` retornando os aparelhos registrados.

## Critérios de Aceite
- [ ] Todo payload gravado via `set()` inclui o objeto `_device`.
- [ ] O SDK expõe a propriedade `db.deviceId` e a sub-API `db.devices.list()`.
- [ ] Dispositivos secundários conseguem listar quais outros aparelhos sincronizaram com a base.
