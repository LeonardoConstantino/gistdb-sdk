import { GistDB } from './index.js';

// ─── 1. Inicialização ─────────────────────────────────────────
const db = await GistDB.create({
  token: 'ghp_SEU_TOKEN_AQUI',
  prefix: 'meuapp',
  password: 'senha-forte-do-usuario',
  conflictResolver: 'last-write-wins',
  ttl: 10 * 60 * 1000,

  // Validação opcional por collection
  schema: {
    users: (data) => typeof data.name === 'string' && data.name.length > 0,
    todos: (data) => typeof data.title === 'string',
  },
});

// ─── 2. Escrita ───────────────────────────────────────────────
const result = await db.set('todos', 'todo-1', {
  title: 'Aprender GistDB',
  done: false,
  tags: ['estudo', 'js'],
});
console.log(result);
// { id: 'todo-1', version: 'v1', updatedAt: '2024-...' }

// ─── 3. Leitura ───────────────────────────────────────────────
const todo = await db.get('todos', 'todo-1');
console.log(todo.title); // 'Aprender GistDB'

// ─── 4. Listar com filtro ─────────────────────────────────────
const pendentes = await db.list('todos', (t) => !t.done);
console.log(pendentes.length);

// ─── 5. Deletar ───────────────────────────────────────────────
await db.delete('todos', 'todo-1');

// ─── 6. Watch (sync entre abas/dispositivos) ──────────────────
const unwatch = db.watch(
  'todos',
  (id, data) => {
    if (data === null) {
      console.log(`Item ${id} deletado remotamente.`);
    } else {
      console.log(`Item ${id} atualizado:`, data);
    }
  },
  15_000,
); // poll a cada 15 segundos

// ─── 7. Sync manual + limpeza ────────────────────────────────
await db.sync();
console.log('Último sync:', await db.getLastSyncAt());

// Para de observar uma collection
unwatch();

// Encerra tudo (limpa token da memória)
db.destroy();

// ─── Sem criptografia (dados públicos) ───────────────────────
const publicDb = await GistDB.create({
  token: 'ghp_SEU_TOKEN_AQUI',
  prefix: 'config-publica',
  // sem password → dados em plaintext no Gist
});

await publicDb.set('settings', 'theme', { mode: 'dark', lang: 'pt-BR' });
