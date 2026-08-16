# 📁 Code Review — GistDB SDK

### Visão Geral
Biblioteca client/SDK em JavaScript (ESM) para utilizar o GitHub Gists como um banco de dados leve, oferecendo criptografia opcional ponta-a-ponta (AES-GCM), fila offline básica e cache local via IndexedDB/sessionStorage.

---

### 🏗️ Arquitetura

**Pontos críticos:**
- **Incompatibilidade Grave de Criptografia/Rede Offline:** No fluxo do método [set](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/GistDB.js#L89), a aplicação tenta obter a versão remota do arquivo com `getFile` antes de salvá-lo para aplicar a estratégia de conflito. No entanto, [getFile](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/GistTransport.js#L37) não possui tratamento offline ou cache fallback de leitura local. Se o usuário estiver offline, a chamada para a API do GitHub falhará instantaneamente, impedindo que o fluxo chegue ao salvamento na fila offline de `putFile`.
- **Testes Falsos (Mocking de lógica interna):** As suítes de testes em `__tests__/` não importam nem testam as classes reais de `src/` (exceto indiretamente através de re-implementações). Elas importam helpers de [helpers.js](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/__tests__/helpers.js) que simulam a lógica de negócio de forma simplificada. Isso mascara bugs críticos da implementação real.

**Recomendações estruturais:**
- **Revisar a Fila Offline:** O SDK precisa suportar leituras a partir do cache local quando offline e permitir escritas diretas na fila sem tentar verificar o estado do arquivo remoto no Gist se `navigator.onLine === false`.
- **Corrigir Execução de Testes:** Ajustar os testes para importar e testar as classes reais (`GistDB`, `CryptoManager`, `LocalCacheAdapter`, etc.) expondo e mockando apenas a camada de transporte de rede (`fetch`) ou a API do GitHub.

---

### 🔄 Consistência

**Inconsistências encontradas:**
| Padrão | Arquivos A | Arquivos B | Recomendação |
|--------|------------|------------|--------------|
| Nomenclatura de Erros | [GistAPI.js](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/GistAPI.js#L76) usa `'VALIDATION'` | [errors.js](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/errors.js#L19) define `VALIDATION_ERROR` | Padronizar código do erro para `VALIDATION_ERROR`. |
| Armazenamento Offline | [GistTransport.js](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/GistTransport.js#L3) comenta IndexedDB | [GistTransport.js](file:///mnt/h/programa%C3%A7%C3%A3o%20-%20copia/projetos/lib/util/gistdb-sdk/src/GistTransport.js#L140) usa `localStorage` | Corrigir comentários e constante `IDB_QUEUE` ou migrar a fila para IndexedDB. |

---

### 📄 Review por Arquivo

#### `src/GistDB.js`
**Resumo:** Ponto de entrada e fachada principal do SDK que coordena o cache, criptografia, transporte e watchers.
**Críticas:**
- **Erro de Sintaxe Crítico:** Na linha 62 (`db.#schema = schema;`), o campo privado `#schema` está sendo atribuído sem ter sido declarado no início da classe. Isso causa falha de compilação/execução instantânea em ambientes JS modernos.
- O construtor é público e vazio, embora a recomendação seja usar o método estático `create`.
**Sugestões:**
Declarar o campo privado no topo da classe:
```javascript
export class GistDB {
  #crypto = null;
  #transport = null;
  #cache = null;
  #resolver = null;
  #prefix = '';
  #gistId = null;
  #watchers = new Map();
  #pollIntervals = new Map();
  #schema = null; // <-- Adicionar esta linha
```
**Comentários:** Bons comentários JSDoc no entrypoint, documentando opções do factory estático.

#### `src/LocalCacheAdapter.js`
**Resumo:** Adaptador de cache local com suporte a expiração (TTL) e suporte híbrido IndexedDB / sessionStorage.
**Críticas:**
- **Condição de Corrida na Inicialização:** O método `#init()` é assíncrono e disparado no construtor (que é síncrono por natureza). Se `read()` ou `write()` forem executados antes do término de `#openIDB()`, o cache fallback (`sessionStorage`) será usado temporariamente, gerando inconsistência quando o IndexedDB terminar de inicializar e passar a ser o meio ativo.
**Sugestões:**
Salvar a Promise de inicialização e aguardá-la nos métodos de leitura/escrita:
```javascript
// No constructor:
this.#initPromise = this.#init();

// Nos métodos como read, write, clear:
async read(key) {
  await this.#initPromise;
  // ... resto da lógica
}
```
**Comentários:** Comentários claros explicam a estratégia de fallback.

#### `src/GistTransport.js`
**Resumo:** Camada de transporte HTTP com resiliência, retry exponencial e fila offline básica.
**Críticas:**
- A constante `IDB_QUEUE` e os comentários indicam IndexedDB, mas a fila armazena na verdade em `localStorage`, que tem limite estrito de 5MB e comportamento síncrono bloqueante.
**Sugestões:**
Altere a constante ou implemente de fato usando IndexedDB para manter a consistência com o nome.
**Comentários:** Comentários úteis, porém misleading sobre o uso de IndexedDB na fila offline.

#### `__tests__/helpers.js`
**Resumo:** Arquivo utilitário contendo mocks e re-implementações para a suíte de testes.
**Críticas:**
- **Erro de Suíte Vazia do Jest:** Como o arquivo reside em `__tests__/` e possui a extensão `.js`, o executor do Jest tenta rodá-lo como um arquivo de teste e falha por não conter nenhum bloco `test()` ou `it()`.
**Sugestões:**
Mover `helpers.js` para fora da pasta `__tests__/` (ex: criar uma pasta `__tests__/__helpers__/helpers.js` ou renomeá-lo para evitar que coincida com a regex de testes do Jest).
**Comentários:** Praticamente sem comentários.

---

### 🎯 Prioridades de Refatoração

1. 🔴 **Crítico** — Corrigir a falta de declaração do campo `#schema` na classe `GistDB` (Syntax Error imediato).
2. 🔴 **Crítico** — Mover `helpers.js` para evitar falha no executor de testes Jest, e reescrever os testes para importar os módulos originais de `src/` em vez de mocks funcionais duplicados.
3. 🟠 **Alto** — Resolver a condição de corrida de inicialização do `LocalCacheAdapter` (Await na Promise de inicialização).
4. 🟡 **Médio** — Resolver o problema da leitura online obrigatória antes da gravação offline no fluxo do `set()` do `GistDB`.
