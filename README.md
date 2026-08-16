# GistDB SDK

> Sincronização leve entre dispositivos usando GitHub Gist como backend — sem servidor, sem banco de dados, sem custo.

---

## Motivação

Pequenos projetos vivem num limbo: grandes demais para depender só de `localStorage`, pequenos demais para justificar um servidor + banco de dados + hospedagem. O GistDB preenche esse espaço usando o GitHub Gist como camada de persistência remota, com criptografia AES-GCM no lado do cliente, cache local e resolução de conflitos entre dispositivos.

---

## Funcionalidades

- CRUD genérico por collection e ID
- Criptografia AES-GCM 256-bit com Web Crypto API nativa (zero dependências)
- Cache local com TTL via IndexedDB / sessionStorage
- Retry automático com backoff exponencial
- Fila offline: operações enfileiradas quando sem conexão
- Resolução de conflitos configurável (last-write-wins, remote-wins, local-wins, custom)
- Validação de schema por collection
- Watch de collections com polling configurável
- Token de API protegido em memória — nunca vai para localStorage

---

## Requisitos

- Browser moderno com suporte a Web Crypto API (Chrome 37+, Firefox 34+, Safari 11+)
- GitHub Personal Access Token com escopo `gist`
- Node.js 18+ (apenas para testes com Jest)

---

## Instalação

```bash
# via npm (quando publicado)
npm install gistdb-sdk

# ou copie a pasta src/ direto para seu projeto
```

---

## Início rápido

```js
import { GistDB } from 'gistdb-sdk';

const db = await GistDB.create({
  token: 'ghp_SEU_TOKEN_AQUI',
  prefix: 'meuapp',
  encryptionKey: 'senha-forte-do-usuario',
});

// Escrever
await db.set('tarefas', 'tarefa-1', {
  titulo: 'Estudar GistDB',
  feita: false,
});

// Ler
const tarefa = await db.get('tarefas', 'tarefa-1');
console.log(tarefa.titulo); // 'Estudar GistDB'

// Listar com filtro
const pendentes = await db.list('tarefas', (t) => !t.feita);

// Deletar
await db.delete('tarefas', 'tarefa-1');

// Limpar ao sair
db.destroy();
```

---

## API

### `GistDB.create(options)`

Factory assíncrona — único ponto de entrada.

| Opção           | Tipo   | Obrigatório | Padrão              | Descrição                                   |
| --------------- | ------ | ----------- | ------------------- | ------------------------------------------- |
| `token`         | string | sim         | —                   | GitHub Personal Access Token (escopo: gist) |
| `prefix`        | string | sim         | —                   | Prefixo único do projeto (ex: `"meuapp"`)   |
| `gistId`        | string | não         | auto-criado         | ID de um Gist existente                     |
| `encryptionKey` | string | não         | `null` (sem cripto) | Senha para criptografar dados com AES-GCM   |
| `schema`        | object | não         | `{}`                | Mapa `{ collection: (data) => boolean }`    |
| `conflict`      | string | não         | `'last-write-wins'` | Estratégia de resolução de conflito         |
| `cacheTTL`      | number | não         | `300000` (5 min)    | TTL do cache local em ms                    |

---

### Métodos

#### `db.get(collection, id)` → `Object | null`

Retorna o item da collection pelo ID. Consulta o cache local primeiro; faz fetch no Gist apenas se necessário.

```js
const user = await db.get('users', 'u-123');
```

#### `db.set(collection, id, data)` → `{ id, version, updatedAt }`

Cria ou atualiza um item. Mescla com o dado remoto usando a estratégia de conflito configurada. Adiciona automaticamente `_id`, `_version` e `_updatedAt`.

```js
const result = await db.set('users', 'u-123', { nome: 'Ana', plano: 'pro' });
// { id: 'u-123', version: 'v1', updatedAt: '2024-...' }
```

#### `db.delete(collection, id)` → `boolean`

Remove o item do Gist e invalida o cache local.

#### `db.list(collection, filterFn?)` → `Array`

Retorna todos os itens da collection. Aceita função de filtro opcional.

```js
const ativos = await db.list('produtos', (p) => p.ativo === true);
```

#### `db.sync()` → `{ syncedAt }`

Limpa o cache local e reprocessa a fila offline pendente.

#### `db.watch(collection, callback, interval?)` → `unwatch()`

Observa mudanças em uma collection via polling. Retorna função para cancelar.

```js
const parar = db.watch(
  'pedidos',
  (id, data) => {
    if (data === null) console.log('Deletado:', id);
    else console.log('Atualizado:', id, data);
  },
  20_000,
); // poll a cada 20s

parar(); // cancela o watch
```

#### `db.destroy()`

Para todos os watchers e limpa o token da memória. Chame ao desmontar o componente ou fechar a aplicação.

---

## Criptografia

Quando `encryptionKey` é fornecida, todos os dados são cifrados com AES-GCM 256-bit **antes** de serem enviados ao Gist. A chave nunca sai do dispositivo.

```
Senha do usuário
      ↓
   PBKDF2 (310.000 iterações, SHA-256)
      ↓
   Chave AES-GCM 256-bit
      ↓
   encrypt({ dado: 'sensível' })
      ↓
   { __encrypted: true, iv: '...', ciphertext: '...', salt: '...' }
      ↓
   Gist (apenas o blob cifrado é armazenado)
```

Implementação via `crypto.subtle` — sem dependências externas, auditável, acelerada por hardware.

---

## Resolução de conflitos

Configure a estratégia ao criar a instância:

```js
const db = await GistDB.create({
  token,
  prefix,
  conflict: 'last-write-wins', // padrão
});
```

| Estratégia        | Comportamento                                         |
| ----------------- | ----------------------------------------------------- |
| `last-write-wins` | Quem tem `_updatedAt` mais recente prevalece (padrão) |
| `remote-wins`     | Dados do Gist sempre prevalecem                       |
| `local-wins`      | Dados locais sempre prevalecem                        |
| `custom`          | Função de merge fornecida pelo usuário                |

```js
// Estratégia custom: merge de campos
const db = await GistDB.create({
  token,
  prefix,
  conflict: 'custom',
  // conflictFn exposto via opção extra ao ConflictResolver
});
```

---

## Segurança

| Risco                                 | Mitigação aplicada                                     |
| ------------------------------------- | ------------------------------------------------------ |
| Token GitHub exposto no localStorage  | KeyVault usa apenas memória + sessionStorage (efêmero) |
| Dados sensíveis no Gist               | AES-GCM antes de qualquer escrita                      |
| Senha fraca                           | PBKDF2 com 310.000 iterações (OWASP 2024)              |
| Colisão entre projetos                | Prefixo obrigatório no nome de cada arquivo            |
| Rate limit da API GitHub              | Retry com backoff exponencial + fila offline           |
| Conflito de escrita multi-dispositivo | ConflictResolver com etag de versão (`_version`)       |
| Gist público expõe metadados          | Gists criados como **secretos** por padrão             |

> **Aviso**: Gist "secreto" não é privado — qualquer um com o link pode ler. Para dados verdadeiramente privados, use `encryptionKey`.

---

## Estrutura do projeto

```
gistdb-sdk/
├── src/
│   ├── GistDB.js            # Entry point — API pública
│   ├── CryptoManager.js     # AES-GCM + PBKDF2
│   ├── GistAPI.js           # GitHub REST API
│   ├── GistTransport.js     # Retry, fila offline, mapeamento
│   ├── LocalCacheAdapter.js # IndexedDB / sessionStorage + TTL
│   ├── ConflictResolver.js  # Estratégias de merge
│   ├── KeyVault.js          # Armazenamento seguro do token
│   └── errors.js            # GistDBError tipado
├── tests/
│   └── (41 testes — 100% passando)
├── package.json
└── README.md
```

---

## Nomenclatura de arquivos no Gist

Cada item é armazenado como um arquivo JSON separado no Gist, seguindo o padrão:

```
gistdb_{prefix}_{collection}_{id}.json
```

Exemplo:

```
gistdb_meuapp_tarefas_tarefa-1.json
gistdb_meuapp_users_u-123.json
```

O prefixo garante que múltiplos projetos podem compartilhar o mesmo Gist sem colisão.

---

## Limites do GitHub Gist

| Limite              | Valor                           |
| ------------------- | ------------------------------- |
| Arquivos por Gist   | Sem limite documentado          |
| Tamanho por arquivo | 10 MB                           |
| Rate limit API      | 5.000 req/hora (autenticado)    |
| Histórico de versão | Ilimitado (commits automáticos) |

Para aplicações com escrita frequente (> 1 req/s), avalie o rate limit e ajuste o `interval` do `watch()`.

---

## Testes

O projeto inclui 41 testes cobrindo todos os módulos. Para rodar no browser (sem instalação):

Abra o arquivo `tests/browser-runner.html` em qualquer browser moderno.

Para rodar com Jest (Node.js 18+):

```bash
npm test
```

Cobertura das suites:

- CryptoManager — 7 testes
- KeyVault — 5 testes
- ConflictResolver — 8 testes
- LocalCacheAdapter — 6 testes
- GistTransport (mock) — 6 testes
- GistDB (integração) — 9 testes
 - GistDB (integração) — 9 testes

## Playground

Há um playground interativo para testar o fluxo completo no browser: abra o arquivo `playground.html` na raiz do projeto. O playground oferece modo **mock** (opera localmente no sessionStorage) e modo **live** (usa a build em `dist/gistdb.min.js` e faz chamadas reais ao GitHub Gist).

Aviso de segurança: se usar o modo live, insira um GitHub Personal Access Token com escopo `gist` apenas em ambientes seguros e evite salvar o token em localStorage.

---

## Exemplos de uso

### Extensão de browser

```js
// background.js
const db = await GistDB.create({
  token: await chrome.storage.session.get('ghToken'),
  prefix: 'minha-extensao',
  encryptionKey: await getUserPassphrase(),
  cacheTTL: 60_000,
});
```

### React hook

```js
function useGistDB(options) {
  const [db, setDb] = useState(null);

  useEffect(() => {
    GistDB.create(options).then(setDb);
    return () => db?.destroy();
  }, []);

  return db;
}
```

### Sync entre abas

```js
const unwatch = db.watch(
  'config',
  (id, data) => {
    if (id === 'theme') applyTheme(data.mode);
  },
  10_000,
);
```

---

## Roadmap

- [ ] Wrapper React (`useGistDB` hook com Suspense)
- [ ] Suporte a `BroadcastChannel` para sync entre abas sem polling
- [ ] Plugin Vite/Rollup para bundle otimizado
- [ ] Suporte a múltiplos Gists por collection (sharding)
- [ ] Exportação / importação de backup local

---

## Licença

MIT — use livremente em projetos pessoais e comerciais.

---

_Construído com Web Crypto API, GitHub REST API v2022-11-28, e boas práticas de segurança OWASP 2024._
