# 🗃️ GistDB

> **Um banco de dados leve, criptografado e sem servidor, que usa GitHub Gists como backend de persistência.**

GistDB é uma biblioteca TypeScript que transforma GitHub Gists em um banco de dados NoSQL funcional. Ideal para projetos pessoais, extensões de browser, aplicações Electron e qualquer contexto onde você precise de persistência de dados sem manter uma infraestrutura própria de servidor. Suporta criptografia AES de ponta a ponta, cache local com TTL, resolução de conflitos, observadores reativos via polling e validação de schema por collection.

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Arquitetura](#-arquitetura)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
  - [Inicialização](#inicialização)
  - [CRUD](#crud)
  - [Sincronização](#sincronização)
  - [Observadores (Watch)](#observadores-watch)
- [API Reference](#-api-reference)
- [Tratamento de Erros](#-tratamento-de-erros)
- [Contribuição](#-contribuição)
- [Licença](#-licença)

---

## 🔍 Visão Geral

O GistDB resolve o problema de persistência de dados em aplicações que não podem — ou não querem — depender de um banco de dados dedicado. Usando a API do GitHub Gists como camada de armazenamento, cada registro é salvo como um arquivo `.json` individual dentro de um Gist privado ou público. Todo o acesso passa por uma camada de cache local com TTL configurável, e os dados podem ser protegidos com criptografia AES derivada de senha.

```
Aplicação → GistDB → [ Cache Local (TTL) ] → GitHub Gist (JSON Files)
                              ↑
                     Criptografia AES (opcional)
```

---

## ✨ Funcionalidades

- **CRUD completo** — `get`, `set`, `delete` e `list` por collection
- **Criptografia AES** — cifragem/decifragem transparente via senha; recuperação automática via `salt`
- **Cache local com TTL** — evita chamadas desnecessárias à API do GitHub
- **Resolução de conflitos** — estratégias `last-write-wins`, `merge` ou função customizada
- **Validação de schema** — validadores por collection definidos pelo usuário
- **Observadores reativos** — `watch()` com polling configurável para detectar mudanças remotas
- **Suporte offline** — detecção de `navigator.onLine`; operações offline são enfileiradas
- **Gerenciamento seguro de token** — `KeyVault` isola o Personal Access Token em memória
- **Versionamento de registros** — cada registro carrega `_version`, `_id` e `_updatedAt`

---

## 🏗️ Arquitetura

```
src/
├── GistDB.ts             # Classe principal (factory + orquestrador)
├── GistAPI.ts            # Cliente HTTP para a API do GitHub Gists
├── GistTransport.ts      # Camada de transporte (leitura/escrita de arquivos no Gist)
├── CryptoManager.ts      # Criptografia AES derivada de senha (PBKDF2)
├── LocalCacheAdapter.ts  # Cache em memória / localStorage com TTL
├── ConflictResolver.ts   # Estratégias de resolução de conflito
├── KeyVault.ts           # Armazenamento seguro do GitHub token em memória
├── Logger.ts             # Logger estruturado (warn / info)
└── errors.ts             # GistDBError com códigos de erro tipados
```

### Fluxo de uma operação `set`

```
set(collection, id, data)
       │
       ├─► Valida schema (opcional)
       ├─► Detecta modo offline
       ├─► Busca versão remota no Gist (se online)
       ├─► Incrementa versão (_version: vN → vN+1)
       ├─► Resolve conflito (local vs. remote)
       ├─► Criptografa payload (se senha configurada)
       ├─► Persiste no GitHub Gist via GistTransport
       ├─► Atualiza cache local
       └─► Notifica watchers
```

---

## 📦 Instalação

```bash
# npm
npm install gistdb

# yarn
yarn add gistdb

# pnpm
pnpm add gistdb
```

> **Requisitos:** Node.js ≥ 18 ou ambiente de browser moderno com suporte a `SubtleCrypto` e `fetch`.

---

## ⚙️ Configuração

Antes de usar, você precisa de um **GitHub Personal Access Token (PAT)** com o escopo `gist`.

1. Acesse [github.com/settings/tokens](https://github.com/settings/tokens)
2. Clique em **Generate new token (classic)**
3. Marque o escopo **`gist`**
4. Copie o token gerado

> ⚠️ Nunca exponha seu token em código client-side público. Use variáveis de ambiente.

---

## 🚀 Uso

### Inicialização

```typescript
import { GistDB } from './GistDB.js';

const db = await GistDB.create({
  token: process.env.GITHUB_TOKEN!, // Seu PAT com escopo "gist"
  prefix: 'meu-app', // Prefixo único para isolar dados
  password: 'senha-secreta', // Opcional: habilita criptografia AES
  gistId: 'abc123', // Opcional: reutiliza um Gist existente
  ttl: 5 * 60 * 1000, // Cache local em ms (padrão: 5 min)
  conflictResolver: 'last-write-wins', // 'last-write-wins' | 'merge' | fn
  schema: {
    usuarios: (data) => typeof data.nome === 'string' && data.nome.length > 0,
  },
});
```

| Parâmetro          | Tipo                                       | Obrigatório | Descrição                                         |
| ------------------ | ------------------------------------------ | :---------: | ------------------------------------------------- |
| `token`            | `string`                                   |     ✅      | GitHub Personal Access Token (escopo `gist`)      |
| `prefix`           | `string`                                   |     ✅      | Prefixo único para namespacing das collections    |
| `gistId`           | `string \| null`                           |     ❌      | ID de um Gist existente (cria um novo se omitido) |
| `password`         | `string`                                   |     ❌      | Senha para criptografia AES dos dados             |
| `ttl`              | `number`                                   |     ❌      | Tempo de vida do cache em ms (padrão: `300000`)   |
| `conflictResolver` | `'last-write-wins' \| 'merge' \| function` |     ❌      | Estratégia de resolução de conflito               |
| `schema`           | `Record<string, (data: any) => boolean>`   |     ❌      | Validadores por collection                        |

---

### CRUD

```typescript
// Criar / atualizar um registro
const result = await db.set('usuarios', 'user-1', {
  nome: 'Ada Lovelace',
  email: 'ada@example.com',
});
// → { id: 'user-1', version: 'v1', updatedAt: '2024-...' }

// Ler um registro
const usuario = await db.get('usuarios', 'user-1');
// → { nome: 'Ada Lovelace', email: 'ada@example.com', _id: 'user-1', _version: 'v1', ... }

// Listar todos os registros de uma collection (com filtro opcional)
const ativos = await db.list('usuarios', (u) => u.ativo === true);

// Deletar um registro
await db.delete('usuarios', 'user-1');
// → true
```

---

### Sincronização

```typescript
// Força limpeza do cache e flush da fila de escritas pendentes
const { syncedAt } = await db.sync();

// Verifica quando ocorreu a última sincronização
const lastSync = await db.getLastSyncAt();
```

---

### Observadores (Watch)

```typescript
// Observa mudanças em uma collection via polling (padrão: 30s)
const unsubscribe = db.watch(
  'usuarios',
  (id, data) => {
    if (data === null) {
      console.log(`Usuário ${id} foi deletado`);
    } else {
      console.log(`Usuário ${id} atualizado:`, data);
    }
  },
  15_000,
); // polling a cada 15 segundos

// Cancela a observação
unsubscribe();

// Destrói a instância e limpa todos os recursos
db.destroy();
```

---

## 📚 API Reference

### `GistDB.create(options)` → `Promise<GistDB>`

Factory assíncrono. **Único ponto de entrada** para criar uma instância do GistDB. Lança `GistDBError` se `token` ou `prefix` não forem fornecidos.

---

### `db.get(collection, id)` → `Promise<any | null>`

Retorna o registro da collection pelo `id`. Usa cache local quando disponível e ainda válido. Retorna `null` se não encontrado.

---

### `db.set(collection, id, data)` → `Promise<{ id, version, updatedAt }>`

Cria ou atualiza um registro. Aplica validação de schema, resolução de conflito e criptografia conforme configuração. Funciona em modo offline (enfileira escritas).

---

### `db.delete(collection, id)` → `Promise<boolean>`

Remove o arquivo correspondente do Gist e invalida o cache local. Notifica watchers com `data = null`.

---

### `db.list(collection, filterFn?)` → `Promise<any[]>`

Lista todos os registros de uma collection. Aceita uma função de filtro opcional `(item: any) => boolean`.

---

### `db.sync()` → `Promise<{ syncedAt: string }>`

Limpa o cache local e envia escritas pendentes ao GitHub. Retorna o timestamp da sincronização.

---

### `db.watch(collection, callback, interval?)` → `() => void`

Registra um observador de mudanças via polling. O `callback` recebe `(id: string, data: any | null)`. Retorna uma função que cancela a subscrição.

---

### `db.destroy()` → `void`

Cancela todos os polling intervals, limpa os watchers e apaga o token do `KeyVault`.

---

## ⚠️ Tratamento de Erros

O GistDB lança instâncias de `GistDBError` com códigos semânticos:

```typescript
import { GistDBError } from './errors.js';

try {
  await db.set('usuarios', 'u1', { nome: 123 }); // falha no schema
} catch (err) {
  if (err instanceof GistDBError) {
    console.error(err.code); // 'VALIDATION_ERROR'
    console.error(err.message); // 'Dados inválidos para collection "usuarios".'
  }
}
```

| Código             | Causa                                            |
| ------------------ | ------------------------------------------------ |
| `TOKEN_REQUIRED`   | Nenhum token fornecido ao `create()`             |
| `PREFIX_REQUIRED`  | Nenhum prefix fornecido ao `create()`            |
| `NOT_INITIALIZED`  | Método chamado antes de `gistId` ser configurado |
| `VALIDATION_ERROR` | Dados rejeitados pelo validador de schema        |

---

## 🤝 Contribuição

Contribuições são bem-vindas! Siga os passos abaixo:

1. Faça um **fork** do repositório
2. Crie uma branch para sua feature: `git checkout -b feat/minha-feature`
3. Implemente suas mudanças com testes
4. Abra um **Pull Request** descrevendo o que foi alterado e o motivo

### Padrões do projeto

- TypeScript estrito com `private class fields` (`#`)
- Erros sempre lançados via `GistDBError` com código semântico
- Logs via `Logger` (nunca `console.log` direto em produção)
- Funções assíncronas com tipos de retorno explícitos

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [`LICENSE`](./LICENSE) para mais detalhes.

---

<p align="center">
  Feito com ☕ e TypeScript &nbsp;·&nbsp; GitHub Gists como banco de dados nunca foi tão simples.
</p>
