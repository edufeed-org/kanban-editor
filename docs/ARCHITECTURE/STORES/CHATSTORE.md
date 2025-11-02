# ChatStore - KI-Chat-Sessions für Boards

**Version:** 1.0  
**Datum:** 02. November 2025  
**Phase:** 3 (KI-Integration)  
**Pattern:** Manual localStorage  
**Status:** ✅ IMPLEMENTIERT

---

## 📚 Quick Reference

| Aspekt | Details |
|--------|---------|
| **Datei** | `src/lib/stores/chatStore.svelte.ts` |
| **Pattern** | Manual localStorage (dynamische Keys) |
| **Storage-Keys** | `chat-session-${boardId}` |
| **Datenmodell** | `ChatSession` → `Message` → `Memory` → `ConversationSummary` |
| **Use-Case** | 1 Chat-Session pro Board für KI-Assistent |
| **Dependencies** | `ChatModel.ts` (Klassen) |

---

## 🎯 Zweck

Der ChatStore verwaltet KI-Chat-Sessions für jedes Board:

- **1 Session pro Board** — Direkte Zuordnung Board ↔ Chat
- **Message-History** — User + AI Messages mit Timestamps
- **Memory-System** — AI merkt sich wichtige Informationen
- **Conversation Summaries** — Lange Chats werden zusammengefasst

---

## 🏗️ Architektur

### Datenmodell-Hierarchie

```
ChatSession
├── messages: Message[]
│   ├── id, role, content, timestamp
│   └── tokens, attachments
├── memories: Memory[]
│   ├── id, type, content, importance
│   └── source, createdAt, lastAccessed
└── summaries: ConversationSummary[]
    ├── id, messageRange
    └── summary, tokensSaved
```

### Storage-Struktur

```typescript
localStorage:
  chat-session-board1 → ChatSession (vollständig serialisiert)
  chat-session-board2 → ChatSession
  chat-session-board3 → ChatSession
  ...
```

---

## 📖 API-Referenz

### Session Management

#### `loadSession(boardId: string, boardName?: string): void`

Lädt oder erstellt eine Chat-Session für ein Board.

```typescript
// Beispiel
chatStore.loadSession('board-abc123', 'UI-Konzept Board');
```

**Was passiert:**
1. Alte Session wird gespeichert
2. Neue Session aus localStorage geladen
3. Wenn nicht vorhanden → neue Session erstellt
4. UI wird reaktiv aktualisiert

---

#### `deleteSession(boardId: string): void`

Löscht eine Chat-Session permanent.

```typescript
// Beispiel
chatStore.deleteSession('board-abc123');
```

**Warnung:** Alle Messages, Memories und Summaries werden gelöscht!

---

#### `listAllSessions(): Array<{ boardId, lastMessageAt, messageCount }>`

Listet alle verfügbaren Chat-Sessions.

```typescript
// Beispiel
const sessions = chatStore.listAllSessions();
// [
//   { boardId: 'board1', lastMessageAt: 1698765432000, messageCount: 15 },
//   { boardId: 'board2', lastMessageAt: 1698765400000, messageCount: 8 }
// ]
```

**Use-Case:** Chat-History Sidebar mit allen Boards

---

### Messages

#### `addMessage(content: string, role: 'user' | 'assistant'): void`

Fügt eine neue Message hinzu.

```typescript
// User-Message
chatStore.addMessage('Erkläre mir Svelte Runes', 'user');

// AI-Response
chatStore.addMessage('Svelte 5 Runes sind...', 'assistant');
```

**Features:**
- ✅ Automatischer Timestamp
- ✅ Persistent in localStorage
- ✅ Reaktive UI-Updates

---

#### `deleteMessage(messageId: string): void`

Löscht eine einzelne Message.

```typescript
chatStore.deleteMessage('msg-abc123');
```

---

#### `clearMessages(): void`

Löscht alle Messages der aktuellen Session.

```typescript
chatStore.clearMessages();
```

---

### Memories

#### `addMemory(content, type, importance, source): void`

Fügt ein Memory hinzu (AI merkt sich Information).

```typescript
chatStore.addMemory(
  'User bevorzugt TypeScript',     // content
  'preference',                    // type
  8,                               // importance (1-10)
  'message-abc123'                 // source
);
```

**Memory Types:**
- `'entity'` — Personen, Orte, Konzepte
- `'preference'` — User-Präferenzen
- `'fact'` — Fakten über das Projekt
- `'context'` — Board-spezifische Kontexte

---

#### `searchMemories(query: string): MemoryProps[]`

Sucht Memories nach Keyword.

```typescript
const memories = chatStore.searchMemories('TypeScript');
// [{ content: 'User bevorzugt TypeScript', ... }]
```

---

#### `getTopMemories(limit: number = 5): MemoryProps[]`

Holt die wichtigsten Memories (für AI-Context).

```typescript
const topMemories = chatStore.getTopMemories(5);
```

**Ranking-Algorithmus:**
```typescript
score = importance * (1 / (now - lastAccessed))
```

Wichtige UND kürzlich verwendete Memories werden priorisiert.

---

### Summaries

#### `addSummary(messageRange, summaryText, tokensSaved): void`

Erstellt eine Conversation Summary.

```typescript
chatStore.addSummary(
  [0, 20],                         // messageRange
  'User fragt nach Svelte Runes...', // summaryText
  500                              // tokensSaved
);
```

**Use-Case:** Lange Chats komprimieren für AI-Context-Window

---

### AI-Context

#### `getAIContext(includeFullHistory: boolean = false): object`

Bereitet Context für AI-API vor.

```typescript
const context = chatStore.getAIContext();
// {
//   messages: [...],     // Letzte 10 Messages
//   memories: [...],     // Top 5 Memories
//   summaries: [...]     // Alle Summaries
// }

// Vollständige Historie
const fullContext = chatStore.getAIContext(true);
// messages enthält ALLE Messages
```

---

## 🎨 Derived Values (Reaktiv für UI)

### `messages` (Read-Only)

Alle Messages der aktuellen Session.

```typescript
let messages = $derived(chatStore.messages);
```

---

### `memories` (Read-Only)

Alle Memories der aktuellen Session.

```typescript
let memories = $derived(chatStore.memories);
```

---

### `summaries` (Read-Only)

Alle Summaries der aktuellen Session.

```typescript
let summaries = $derived(chatStore.summaries);
```

---

### `isActive` (Read-Only)

Gibt an, ob eine Session geladen ist.

```typescript
let isActive = $derived(chatStore.isActive);
```

---

### `currentSession` (Read-Only)

Vollständige Session-Daten für Debugging.

```typescript
let session = $derived(chatStore.currentSession);
```

---

## 📋 Integration Examples

### Beispiel 1: Chat-Panel Component

```svelte
<!-- src/routes/cardsboard/ChatPanel.svelte -->
<script lang="ts">
  import { chatStore } from '$lib/stores/chatStore.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';

  let { boardId } = $props<{ boardId: string }>();
  let inputText = $state('');

  // Lade Session beim Mount
  $effect(() => {
    chatStore.loadSession(boardId);
  });

  // Messages aus Store (reaktiv!)
  let messages = $derived(chatStore.messages);

  async function handleSend() {
    if (!inputText.trim()) return;

    // User-Message
    chatStore.addMessage(inputText, 'user');

    // AI-Response (später: echte API)
    const response = await callAI(inputText);
    chatStore.addMessage(response, 'assistant');

    inputText = '';
  }
</script>

<div class="chat-panel">
  <!-- Messages -->
  <div class="messages">
    {#each messages as message (message.id)}
      <div class="message {message.role}">
        <p>{message.content}</p>
        <span>{new Date(message.timestamp).toLocaleString()}</span>
      </div>
    {/each}
  </div>

  <!-- Input -->
  <Textarea bind:value={inputText} placeholder="Frage den KI-Assistenten..." />
  <Button onclick={handleSend}>Senden</Button>
</div>
```

---

### Beispiel 2: Memory-Sidebar

```svelte
<script lang="ts">
  import { chatStore } from '$lib/stores/chatStore.svelte';

  let memories = $derived(chatStore.memories);
  let query = $state('');

  function handleSearch() {
    const results = chatStore.searchMemories(query);
    console.log('Found memories:', results);
  }
</script>

<div class="memory-sidebar">
  <h3>Memories</h3>
  
  <input bind:value={query} placeholder="Suche..." />
  <button onclick={handleSearch}>Suchen</button>

  <ul>
    {#each memories as memory (memory.id)}
      <li>
        <strong>{memory.type}</strong>: {memory.content}
        <span>Wichtigkeit: {memory.importance}/10</span>
      </li>
    {/each}
  </ul>
</div>
```

---

## ⚠️ Wichtige Patterns

### ✅ Pattern 1: IMMER loadSession() aufrufen

```typescript
// ❌ FALSCH - Keine Session geladen!
chatStore.addMessage('Text', 'user');
// Error: No active session!

// ✅ RICHTIG - Session zuerst laden
chatStore.loadSession('board-abc123');
chatStore.addMessage('Text', 'user');
```

---

### ✅ Pattern 2: Session beim Board-Wechsel laden

```svelte
<script>
  let { boardId } = $props();

  $effect(() => {
    chatStore.loadSession(boardId);
  });
</script>
```

---

### ✅ Pattern 3: AI-Context mit Top Memories

```typescript
async function callAI(prompt: string) {
  const context = chatStore.getAIContext();
  
  const payload = {
    messages: context.messages,
    memories: context.memories,  // ← Top 5 most important
    summaries: context.summaries,
    prompt
  };
  
  return await fetch('/api/ai', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// chatStore.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { chatStore } from './chatStore.svelte';

describe('ChatStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should create new session for board', () => {
    chatStore.loadSession('board1');
    expect(chatStore.isActive).toBe(true);
  });

  it('should add message', () => {
    chatStore.loadSession('board1');
    chatStore.addMessage('Test', 'user');
    
    const messages = chatStore.messages;
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('Test');
  });

  it('should persist session to localStorage', () => {
    chatStore.loadSession('board1');
    chatStore.addMessage('Test', 'user');
    
    const stored = localStorage.getItem('chat-session-board1');
    expect(stored).toBeTruthy();
    
    const data = JSON.parse(stored!);
    expect(data.messages.length).toBe(1);
  });

  it('should search memories', () => {
    chatStore.loadSession('board1');
    chatStore.addMemory('User likes TypeScript', 'preference', 8, 'msg1');
    chatStore.addMemory('User likes Svelte', 'preference', 9, 'msg2');
    
    const results = chatStore.searchMemories('TypeScript');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('TypeScript');
  });
});
```

---

## 📊 Performance

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| `loadSession()` | O(1) | localStorage.getItem |
| `addMessage()` | O(1) | Array append + save |
| `searchMemories()` | O(n) | Linear search over memories |
| `getTopMemories()` | O(n log n) | Sort by score |
| `listAllSessions()` | O(k) | k = number of sessions |

**Empfohlene Limits:**
- Messages pro Session: < 100 (sonst Summary erstellen)
- Memories pro Session: < 50
- Sessions pro Browser: < 20

---

## 🔮 Zukünftige Erweiterungen (Phase 3+)

### Phase 3.1: Echte AI-Integration

```typescript
public async sendToAI(prompt: string): Promise<string> {
  const context = this.getAIContext();
  
  const response = await fetch('/api/openai', {
    method: 'POST',
    body: JSON.stringify({ prompt, context })
  });
  
  const data = await response.json();
  this.addMessage(data.response, 'assistant');
  
  return data.response;
}
```

---

### Phase 3.2: Automatic Memory Extraction

```typescript
public async extractMemories(messageId: string): Promise<void> {
  const message = this.session?.messages.find(m => m.id === messageId);
  if (!message) return;
  
  // AI extrahiert Memories aus Message
  const extracted = await aiExtractMemories(message.content);
  
  extracted.forEach(mem => {
    this.addMemory(mem.content, mem.type, mem.importance, messageId);
  });
}
```

---

### Phase 3.3: Conversation Summaries (Automatic)

```typescript
public async autoSummarize(): Promise<void> {
  const messages = this.session?.messages || [];
  
  // Wenn > 50 Messages: Erstelle Summary für erste 30
  if (messages.length > 50) {
    const summary = await aiSummarize(messages.slice(0, 30));
    this.addSummary([0, 30], summary, 500);
    
    // Alte Messages können gelöscht werden (sind in Summary)
  }
}
```

---

## 📚 Related Documentation

- **[BASESTORES.md](./BASESTORES.md)** — Base Class Architektur (Future)
- **[STORE-PATTERNS.md](../../GUIDES/STORE-PATTERNS.md)** — Wann Manual localStorage Pattern?
- **[BOARDSTORE.md](./BOARDSTORE.md)** — Ähnlicher Manual localStorage Store
- **[AI-INTEGRATION.md](../../FEATURE/AI-INTEGRATION.md)** — KI-Features Spec

---

## 📝 Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | 02.11.2025 | Initial implementation (Phase 3) |

---

**Status:** ✅ IMPLEMENTIERT  
**Phase:** 3 (KI-Integration)  
**Next Steps:** AI-API Integration, Automatic Memory Extraction
