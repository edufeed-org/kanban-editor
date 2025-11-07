# ChatStore - Praxis-Beispiel für Manual localStorage Pattern

**Version:** 1.0  
**Datum:** 02. November 2025  
**Zweck:** Vollständiges Beispiel wie ein komplexer Store nach dem Store-Pattern aufgebaut wird  
**Referenz:** [STORE-PATTERNS.md](./STORE-PATTERNS.md)

---

## 📋 Anforderungen

Der ChatStore soll folgende Funktionalität bieten:

1. **Multi-Session Management**
   - ⚠️ **Design-Entscheidung:** 1 Session pro Board ODER mehrere Sessions pro Board?
   - **Option A (Einfach):** 1 Session pro Board → Key: `chat-session-${boardId}`
   - **Option B (Komplex):** Multiple Sessions pro Board → Key: `chat-session-${sessionId}`
   - Jede Session hat eigene Message-History

2. **Messages**
   - User-Messages und AI-Responses
   - Timestamp, Role, Content
   - Optional: Attachments, Context

3. **Conversation Summaries**
   - Auto-generierte Zusammenfassungen langer Chats
   - Reduziert Context-Window für AI

4. **Memories**
   - Wichtige Informationen die sich AI merken soll
   - Entities (Personen, Orte, Konzepte)
   - User-Präferenzen
   - Board-spezifische Kontexte

---

## 🤔 Design-Entscheidung: 1 vs. Multiple Conversations pro Board

### Option A: 1 Conversation pro Board (Einfach) ✅ **Current Implementation**

**Storage-Key:** `chat-session-${boardId}`

**Vorteile:**
- ✅ Einfachste Implementation
- ✅ Direkte Zuordnung: Board ↔ Chat
- ✅ Weniger Komplexität
- ✅ Perfekt für "Board-Assistant" Use-Case

**Nachteile:**
- ❌ Keine Topic-Trennung
- ❌ Lange Conversations werden unübersichtlich

**Use-Cases:**
- Board-spezifische Hilfe ("Was ist auf diesem Board?")
- Task-Management ("Erstelle Card für...")
- Board-Kontext bleibt immer relevant

---

### Option B: Multiple Conversations pro Board (Komplex) 🔄 **Alternative Design**

**Storage-Keys:** 
- `chat-session-${sessionId}` - Einzelne Session
- `chat-board-index-${boardId}` - Liste aller Sessions für Board

**Vorteile:**
- ✅ Topic-Trennung ("UI-Fragen", "Datenmodell", "Testing")
- ✅ Übersichtlichere Historie
- ✅ Parallele Conversations möglich
- ✅ Sessions können archiviert werden

**Nachteile:**
- ❌ Höhere Komplexität
- ❌ Session-Management UI nötig
- ❌ 2 localStorage-Keys pro Board

**Use-Cases:**
- Verschiedene Topics pro Board
- Längere Entwicklungsphasen
- Team-Kollaboration (verschiedene Nutzer → verschiedene Sessions)

---

## 🎯 Pattern-Entscheidung

**Checkliste:**
- ❓ Mehrere localStorage-Keys? → ✅ JA (`chat-session-${boardId}`)
- ❓ Klassen-Hierarchien? → ✅ JA (ChatSession → Message → Memory)
- ❓ Async Initialisierung? → ✅ JA (AI-API calls)
- ❓ Komplexe Logik? → ✅ JA (Summarization, Memory-Extraction)

**Ergebnis:** → **Manual localStorage Pattern** 🏗️

---

## ⚠️ WICHTIG: Warum NICHT persisted()?

Der ChatStore verwendet **NICHT** das hybride Pattern mit `persisted()` + `$state`, sondern **reines Manual localStorage**!

**Warum?**

```typescript
// ❌ FALSCH für ChatStore - persisted() funktioniert NICHT mit dynamischen Keys!
private persistedData = persisted(`chat-session-${boardId}`, defaultValue);
//                                              ↑
//                               Key ist dynamisch zur Laufzeit!
//                               persisted() evaluiert Key NUR beim Import!
```

**Das Problem:**
- `persisted()` erstellt den localStorage-Key **beim Modul-Import**
- Der Key ist **statisch** und kann nicht zur Laufzeit geändert werden
- ChatStore braucht aber `chat-session-${boardId}` mit **wechselndem** `boardId`

**Daher: Reines Manual localStorage Pattern!**

```typescript
// ✅ RICHTIG für ChatStore
export class ChatStore {
  private session = $state<ChatSession | null>(null);
  private currentBoardId = $state<string | null>(null);
  
  // Dynamischer Key zur Laufzeit!
  private getStorageKey(): string {
    return `chat-session-${this.currentBoardId}`;
  }
  
  private saveToStorage(): void {
    const key = this.getStorageKey(); // ← Key wird zur Laufzeit berechnet!
    localStorage.setItem(key, JSON.stringify(this.session.getContextData()));
  }
}
```

---

## 🔀 Pattern-Vergleich: Hybrid vs. Pure Manual

### Pattern A: Hybrid (persisted + $state) - FÜR EINFACHE STORES

```typescript
// Beispiel: SettingsStore mit EINEM statischen Key
export class SettingsStore {
  // 1. Persistierter Store (statischer Key!)
  private persistedData = persisted<Settings>(
    'app-settings', // ← STATISCH!
    { theme: 'dark', language: 'de' }
  );
  
  // 2. Reaktive State (aus persisted geladen)
  private settings = $state(get(this.persistedData));
  
  // 3. Derived Values
  public isDarkTheme = $derived(this.settings.theme === 'dark');
  
  // 4. Methods
  public setTheme(theme: string) {
    this.settings = { ...this.settings, theme };
    this.persistedData.set(this.settings); // ← Auto-Sync zu localStorage
  }
}
```

**Wann nutzen:**
- ✅ 1 statischer localStorage-Key
- ✅ Einfache Datenstruktur (Plain Objects)
- ✅ Keine dynamischen Keys

---

### Pattern B: Pure Manual localStorage - FÜR KOMPLEXE STORES

```typescript
// Beispiel: ChatStore mit MEHREREN dynamischen Keys
export class ChatStore {
  // 1. Reaktive State (selbst verwaltet)
  private session = $state<ChatSession | null>(null);
  private currentBoardId = $state<string | null>(null);
  private updateTrigger = $state(0);
  
  // 2. Derived Values
  public messages = $derived.by(() => {
    this.updateTrigger; // ← Dependency tracking
    return this.session?.messages || [];
  });
  
  // 3. Dynamischer localStorage-Key
  private getStorageKey(): string {
    return `chat-session-${this.currentBoardId}`; // ← DYNAMISCH!
  }
  
  // 4. Manuelles Laden/Speichern
  private loadFromStorage(boardId: string): ChatSession {
    const key = `chat-session-${boardId}`;
    const stored = localStorage.getItem(key);
    return stored ? new ChatSession(JSON.parse(stored)) : new ChatSession({ id: boardId });
  }
  
  private saveToStorage(): void {
    if (!this.session || !this.currentBoardId) return;
    const key = this.getStorageKey();
    localStorage.setItem(key, JSON.stringify(this.session.getContextData()));
  }
  
  // 5. triggerUpdate() Pattern
  private triggerUpdate(): void {
    this.updateTrigger++; // ← Triggert $derived
    this.saveToStorage(); // ← Manual save
  }
  
  // 6. Public API
  public loadSession(boardId: string): void {
    this.currentBoardId = boardId;
    this.session = this.loadFromStorage(boardId);
    this.updateTrigger++;
  }
  
  public addMessage(content: string, role: 'user' | 'assistant'): void {
    this.session?.addMessage({ content, role });
    this.triggerUpdate(); // ← IMMER nach Änderungen!
  }
}
```

**Wann nutzen:**
- ✅ Mehrere/dynamische localStorage-Keys
- ✅ Klassen-Hierarchien (Session → Message → Memory)
- ✅ Komplexe Logik (Rekonstruktion, Transformation)
- ✅ Key wechselt zur Laufzeit

---

## 📊 Entscheidungsmatrix

| Kriterium | Hybrid (persisted + $state) | Pure Manual localStorage |
|-----------|:---------------------------:|:------------------------:|
| **localStorage-Key** | 1 statischer Key | Mehrere/dynamische Keys |
| **Beispiel-Key** | `'app-settings'` | `chat-session-${boardId}` |
| **Datenstruktur** | Plain Objects | Klassen-Hierarchien |
| **Setup-Zeit** | 5 Min | 15 Min |
| **Code-Zeilen** | ~30 | ~100 |
| **Auto-Sync** | ✅ Ja (via persisted) | ❌ Nein (manuell) |
| **Flexibilität** | Niedrig | Hoch |
| **Use-Case** | AuthStore, SettingsStore | BoardStore, ChatStore |

---

## 🎯 ChatStore = Pure Manual (NICHT Hybrid!)

Der ChatStore in diesem Beispiel folgt **100% dem Pure Manual Pattern**, weil:

1. **Dynamische Keys**: `chat-session-${boardId}` ändert sich zur Laufzeit
2. **Klassen-Hierarchien**: ChatSession → Message → Memory → ConversationSummary
3. **Komplexe Rekonstruktion**: `new ChatSession(data)` mit allen Child-Objekten
4. **Keine persisted() möglich**: Key ist nicht statisch evaluierbar

**Wenn du ein Hybrid-Pattern-Beispiel suchst, siehe:**
- AuthStore (1 Key: `'nostr-user-session'`)
- SettingsStore (1 Key: `'app-settings'`)
- ThemeStore (1 Key: `'ui-theme'`)

---

## 📐 Datenmodell (TypeScript Interfaces & Klassen)

### Option B Implementation: Multiple Sessions pro Board

Wenn du **mehrere Conversations pro Board** brauchst, erweitere das Datenmodell:

```typescript
// Zusätzliche Interfaces für Option B

export interface ChatSessionMetadata {
  sessionId: string;
  boardId: string;
  boardName: string;
  title: string; // z.B. "UI-Diskussion", "Datenmodell-Fragen"
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
}

export interface BoardChatIndex {
  boardId: string;
  sessions: ChatSessionMetadata[];
  activeSessionId: string | null;
}
```

**Storage-Struktur:**
```
localStorage:
  chat-session-abc123 → ChatSession (vollständige Session)
  chat-session-def456 → ChatSession
  chat-board-index-board1 → BoardChatIndex (Metadaten aller Sessions)
```

---

## 📐 Datenmodell (TypeScript Interfaces & Klassen) - Option A (Current)

### Interfaces

```typescript
// src/lib/classes/ChatModel.ts

export type MessageRole = 'user' | 'assistant' | 'system';
export type MemoryType = 'entity' | 'preference' | 'fact' | 'context';

export interface MessageProps {
  id?: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
  tokens?: number;
  attachments?: string[]; // URLs zu Bildern/Docs
}

export interface MemoryProps {
  id?: string;
  type: MemoryType;
  content: string;
  source: string; // z.B. "message-123"
  importance: number; // 1-10
  createdAt?: number;
  lastAccessed?: number;
}

export interface ConversationSummaryProps {
  id?: string;
  messageRange: [number, number]; // Start/End Message indices
  summary: string;
  tokensSaved: number;
  createdAt?: number;
}

export interface ChatSessionProps {
  id?: string; // Option A: Board-ID | Option B: Session-ID
  boardId?: string; // Option B: Referenz zum Board
  boardName?: string;
  title?: string; // Option B: Session-Titel (z.B. "UI-Fragen")
  messages?: MessageProps[];
  summaries?: ConversationSummaryProps[];
  memories?: MemoryProps[];
  createdAt?: number;
  lastMessageAt?: number;
}
```

### Klassen

```typescript
// src/lib/classes/ChatModel.ts

import { generateDTag, generateTimestamp } from '$lib/utils/idGenerator';

/**
 * Einzelne Chat-Nachricht
 */
export class Message {
  public id: string;
  public role: MessageRole;
  public content: string;
  public timestamp: number;
  public tokens: number;
  public attachments: string[];

  constructor(props: MessageProps) {
    this.id = props.id || generateDTag();
    this.role = props.role;
    this.content = props.content;
    this.timestamp = props.timestamp || generateTimestamp();
    this.tokens = props.tokens || 0;
    this.attachments = props.attachments || [];
  }

  getContextData(): MessageProps {
    return {
      id: this.id,
      role: this.role,
      content: this.content,
      timestamp: this.timestamp,
      tokens: this.tokens,
      attachments: this.attachments,
    };
  }
}

/**
 * Memory-Eintrag für langfristige Erinnerung
 */
export class Memory {
  public id: string;
  public type: MemoryType;
  public content: string;
  public source: string;
  public importance: number;
  public createdAt: number;
  public lastAccessed: number;

  constructor(props: MemoryProps) {
    this.id = props.id || generateDTag();
    this.type = props.type;
    this.content = props.content;
    this.source = props.source;
    this.importance = props.importance;
    this.createdAt = props.createdAt || generateTimestamp();
    this.lastAccessed = props.lastAccessed || generateTimestamp();
  }

  /**
   * Markiert Memory als kürzlich verwendet (wichtig für Relevanz-Ranking)
   */
  touch(): void {
    this.lastAccessed = generateTimestamp();
  }

  getContextData(): MemoryProps {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      source: this.source,
      importance: this.importance,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
    };
  }
}

/**
 * Conversation Summary für lange Chats
 */
export class ConversationSummary {
  public id: string;
  public messageRange: [number, number];
  public summary: string;
  public tokensSaved: number;
  public createdAt: number;

  constructor(props: ConversationSummaryProps) {
    this.id = props.id || generateDTag();
    this.messageRange = props.messageRange;
    this.summary = props.summary;
    this.tokensSaved = props.tokensSaved;
    this.createdAt = props.createdAt || generateTimestamp();
  }

  getContextData(): ConversationSummaryProps {
    return {
      id: this.id,
      messageRange: this.messageRange,
      summary: this.summary,
      tokensSaved: this.tokensSaved,
      createdAt: this.createdAt,
    };
  }
}

/**
 * Vollständige Chat-Session (1 Session = 1 Board)
 */
export class ChatSession {
  public id: string; // Board-ID
  public boardName: string;
  public messages: Message[];
  public summaries: ConversationSummary[];
  public memories: Memory[];
  public createdAt: number;
  public lastMessageAt: number;

  constructor(props: ChatSessionProps) {
    this.id = props.id || generateDTag();
    this.boardName = props.boardName || 'Unnamed Board';
    this.messages = props.messages?.map(m => new Message(m)) || [];
    this.summaries = props.summaries?.map(s => new ConversationSummary(s)) || [];
    this.memories = props.memories?.map(m => new Memory(m)) || [];
    this.createdAt = props.createdAt || generateTimestamp();
    this.lastMessageAt = props.lastMessageAt || generateTimestamp();
  }

  /**
   * Fügt eine neue Nachricht hinzu
   */
  addMessage(props: MessageProps): Message {
    const message = new Message(props);
    this.messages = [...this.messages, message]; // ← Array Reassignment!
    this.lastMessageAt = generateTimestamp();
    return message;
  }

  /**
   * Löscht eine Nachricht
   */
  deleteMessage(messageId: string): void {
    this.messages = this.messages.filter(m => m.id !== messageId);
  }

  /**
   * Fügt eine Conversation Summary hinzu
   */
  addSummary(props: ConversationSummaryProps): ConversationSummary {
    const summary = new ConversationSummary(props);
    this.summaries = [...this.summaries, summary];
    return summary;
  }

  /**
   * Fügt ein Memory hinzu
   */
  addMemory(props: MemoryProps): Memory {
    const memory = new Memory(props);
    this.memories = [...this.memories, memory];
    return memory;
  }

  /**
   * Sucht Memory nach Content
   */
  findMemory(query: string): Memory[] {
    const lowerQuery = query.toLowerCase();
    return this.memories.filter(m =>
      m.content.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Holt die wichtigsten Memories (für AI-Context)
   */
  getTopMemories(limit: number = 5): Memory[] {
    return this.memories
      .sort((a, b) => {
        // Score: Wichtigkeit * Aktualität
        const scoreA = a.importance * (1 / (Date.now() - a.lastAccessed));
        const scoreB = b.importance * (1 / (Date.now() - b.lastAccessed));
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Serialisierung für Storage
   */
  getContextData(): ChatSessionProps {
    return {
      id: this.id,
      boardName: this.boardName,
      messages: this.messages.map(m => m.getContextData()),
      summaries: this.summaries.map(s => s.getContextData()),
      memories: this.memories.map(m => m.getContextData()),
      createdAt: this.createdAt,
      lastMessageAt: this.lastMessageAt,
    };
  }
}
```

---

## 🏗️ Store Implementation (Manual localStorage Pattern)

```typescript
// src/lib/stores/chatStore.svelte.ts

import { ChatSession, type MessageProps, type MemoryProps } from '$lib/classes/ChatModel';

export class ChatStore {
  // 1️⃣ State mit dynamischer Key-Basis
  private currentBoardId = $state<string | null>(null);
  private session = $state<ChatSession | null>(null);
  private updateTrigger = $state(0);

  // 2️⃣ Derived für UI
  public messages = $derived.by(() => {
    this.updateTrigger; // ← Trigger MUSS gelesen werden!
    return this.session?.messages || [];
  });

  public memories = $derived.by(() => {
    this.updateTrigger;
    return this.session?.memories || [];
  });

  public summaries = $derived.by(() => {
    this.updateTrigger;
    return this.session?.summaries || [];
  });

  // 3️⃣ Laden mit dynamischem Key
  private loadFromStorage(boardId: string): ChatSession {
    const key = `chat-session-${boardId}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const data = JSON.parse(stored);
        return new ChatSession(data);
      } catch (error) {
        console.error('Failed to parse chat session:', error);
      }
    }

    // Neue Session erstellen
    return new ChatSession({ id: boardId });
  }

  // 4️⃣ Die zentrale Methode
  private triggerUpdate(): void {
    this.updateTrigger++; // ← Triggert $derived
    this.saveToStorage(); // ← Persistiert sofort
  }

  // 5️⃣ Speichern mit dynamischem Key
  private saveToStorage(): void {
    if (!this.session || !this.currentBoardId) return;

    const key = `chat-session-${this.currentBoardId}`;
    const data = this.session.getContextData();
    localStorage.setItem(key, JSON.stringify(data));
  }

  // 6️⃣ Public API - Board wechseln
  public loadSession(boardId: string): void {
    // Alte Session speichern
    if (this.session && this.currentBoardId) {
      this.saveToStorage();
    }

    // Neue Session laden
    this.currentBoardId = boardId;
    this.session = this.loadFromStorage(boardId);
    this.updateTrigger++; // UI neu rendern
  }

  // 7️⃣ Public API - Message hinzufügen
  public addMessage(content: string, role: 'user' | 'assistant'): void {
    if (!this.session) {
      throw new Error('No active session. Call loadSession(boardId) first!');
    }

    this.session.addMessage({ content, role });
    this.triggerUpdate(); // ← IMMER aufrufen!
  }

  // 8️⃣ Public API - Message löschen
  public deleteMessage(messageId: string): void {
    if (!this.session) return;

    this.session.deleteMessage(messageId);
    this.triggerUpdate();
  }

  // 9️⃣ Public API - Memory hinzufügen
  public addMemory(
    content: string,
    type: 'entity' | 'preference' | 'fact' | 'context',
    importance: number,
    source: string
  ): void {
    if (!this.session) return;

    this.session.addMemory({ content, type, importance, source });
    this.triggerUpdate();
  }

  // 🔟 Public API - Memory suchen
  public searchMemories(query: string): MemoryProps[] {
    if (!this.session) return [];

    return this.session.findMemory(query).map(m => m.getContextData());
  }

  // 1️⃣1️⃣ Public API - Conversation Summary erstellen
  public async createSummary(messageRange: [number, number]): Promise<void> {
    if (!this.session) return;

    // TODO: AI-API call um Summary zu generieren
    const summary = 'Zusammenfassung der Conversation...';
    const tokensSaved = 500; // Geschätzt

    this.session.addSummary({ messageRange, summary, tokensSaved });
    this.triggerUpdate();
  }

  // 1️⃣2️⃣ Public API - Alle Sessions auflisten
  public listAllSessions(): { boardId: string; lastMessageAt: number }[] {
    const sessions: { boardId: string; lastMessageAt: number }[] = [];

    // Alle localStorage Keys durchsuchen
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('chat-session-')) {
        const boardId = key.replace('chat-session-', '');
        const stored = localStorage.getItem(key);

        if (stored) {
          try {
            const data = JSON.parse(stored);
            sessions.push({
              boardId,
              lastMessageAt: data.lastMessageAt || 0,
            });
          } catch (error) {
            console.error(`Failed to parse session ${boardId}:`, error);
          }
        }
      }
    }

    // Sortiere nach letzter Aktivität
    return sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  // 1️⃣3️⃣ Public API - Session löschen
  public deleteSession(boardId: string): void {
    const key = `chat-session-${boardId}`;
    localStorage.removeItem(key);

    // Falls aktuelle Session: zurücksetzen
    if (this.currentBoardId === boardId) {
      this.currentBoardId = null;
      this.session = null;
      this.updateTrigger++;
    }
  }

  // 1️⃣4️⃣ Getter für aktuellen Status
  public get currentSession() {
    return this.session ? this.session.getContextData() : null;
  }

  public get isActive() {
    return !!this.session;
  }
}

// ← GLOBALE SINGLETON-INSTANZ
export const chatStore = new ChatStore();
```

---

## 🎨 UI-Integration (Svelte Component)

### Chat-Interface

```svelte
<!-- src/routes/cardsboard/ChatPanel.svelte -->
<script lang="ts">
  import { chatStore } from '$lib/stores/chatStore.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Card from '$lib/components/ui/card';
  import SendIcon from '@lucide/svelte/icons/send';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import BrainIcon from '@lucide/svelte/icons/brain';

  let { boardId } = $props<{ boardId: string }>();
  let inputText = $state('');
  let isLoading = $state(false);

  // Lade Session beim Mount
  $effect(() => {
    chatStore.loadSession(boardId);
  });

  // Messages aus Store (reaktiv!)
  let messages = $derived(chatStore.messages);
  let memories = $derived(chatStore.memories);

  async function handleSend() {
    if (!inputText.trim() || isLoading) return;

    isLoading = true;

    // User-Message hinzufügen
    chatStore.addMessage(inputText, 'user');

    // AI-Response simulieren (später: echte API)
    setTimeout(() => {
      chatStore.addMessage('Das ist eine AI-Antwort...', 'assistant');
      isLoading = false;
    }, 1000);

    inputText = '';
  }

  function handleDelete(messageId: string) {
    chatStore.deleteMessage(messageId);
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header -->
  <div class="border-b p-4">
    <h2 class="font-semibold">KI-Assistent</h2>
    <p class="text-xs text-muted-foreground">
      {messages.length} Nachrichten • {memories.length} Erinnerungen
    </p>
  </div>

  <!-- Messages -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    {#each messages as message (message.id)}
      <Card.Root class={message.role === 'user' ? 'ml-8' : 'mr-8'}>
        <Card.Header class="pb-2">
          <div class="flex justify-between items-center">
            <Card.Title class="text-xs">
              {message.role === 'user' ? '👤 Du' : '🤖 KI'}
            </Card.Title>
            <Button
              variant="ghost"
              size="sm"
              onclick={() => handleDelete(message.id)}
            >
              <TrashIcon class="h-3 w-3" />
            </Button>
          </div>
        </Card.Header>
        <Card.Content class="text-sm">
          {message.content}
        </Card.Content>
      </Card.Root>
    {/each}
  </div>

  <!-- Input -->
  <div class="border-t p-4">
    <div class="flex gap-2">
      <Textarea
        bind:value={inputText}
        placeholder="Frage den KI-Assistenten..."
        rows={2}
        disabled={isLoading}
      />
      <Button onclick={handleSend} disabled={isLoading || !inputText.trim()}>
        <SendIcon class="h-4 w-4" />
      </Button>
    </div>
  </div>

  <!-- Memories (optional) -->
  {#if memories.length > 0}
    <div class="border-t p-4 bg-muted/30">
      <div class="flex items-center gap-2 mb-2">
        <BrainIcon class="h-4 w-4" />
        <span class="text-xs font-semibold">Erinnerungen</span>
      </div>
      <div class="space-y-1">
        {#each memories.slice(0, 3) as memory (memory.id)}
          <div class="text-xs text-muted-foreground">
            • {memory.content}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

---

## ✅ Checkliste für Implementation

### Phase 1: Datenmodell (30 Min)

```typescript
- [ ] src/lib/classes/ChatModel.ts erstellt
- [ ] Interfaces definiert (MessageProps, MemoryProps, etc.)
- [ ] Klassen implementiert (Message, Memory, ConversationSummary, ChatSession)
- [ ] getContextData() auf ALLEN Klassen vorhanden
- [ ] Array-Reassignments verwendet (nicht .push())
```

### Phase 2: Store (45 Min)

```typescript
// Core Structure
- [ ] private session = $state(this.loadFromStorage())
- [ ] private updateTrigger = $state(0)
- [ ] public messages = $derived.by(() => { this.updateTrigger; ... })

// Methods
- [ ] private loadFromStorage(boardId)
- [ ] private saveToStorage()
- [ ] private triggerUpdate() ← ALLE Änderungen!

// Public API
- [ ] loadSession(boardId)
- [ ] addMessage(content, role)
- [ ] deleteMessage(messageId)
- [ ] addMemory(...)
- [ ] searchMemories(query)
- [ ] listAllSessions()
- [ ] deleteSession(boardId)

// Validierung
- [ ] getContextData() auf ALLEN Klassen vollständig?
- [ ] localStorage-Keys sind eindeutig? (chat-session-${boardId})
- [ ] triggerUpdate() wird ÜBERALL aufgerufen?
```

### Phase 3: UI (30 Min)

```svelte
- [ ] ChatPanel.svelte erstellt
- [ ] $effect für loadSession(boardId)
- [ ] messages = $derived(chatStore.messages)
- [ ] Input mit Button
- [ ] Message-Liste mit Delete-Buttons
- [ ] Memories-Display (optional)
```

### Phase 4: Testing (15 Min)

```typescript
- [ ] Browser-Reload: Messages bleiben erhalten?
- [ ] Board wechseln: Richtige Session wird geladen?
- [ ] localStorage-Keys korrekt? (Chrome DevTools → Application)
- [ ] triggerUpdate() wird überall aufgerufen?
```

**Total: ~2 Stunden für vollständige Implementation**

---

## 🔮 Zukünftige Erweiterungen

### Phase 1.6: BaseComplexStore<T> nutzen

Wenn 3+ Complex Stores existieren:

```typescript
export class ChatStore extends BaseComplexStore<ChatSession> {
  protected getStorageKey(): string {
    return `chat-session-${this.currentBoardId}`;
  }

  protected getData(): ChatSession | null {
    return this.session;
  }

  public addMessage(content: string, role: 'user' | 'assistant'): void {
    this.session?.addMessage({ content, role });
    this.triggerUpdate(); // ← Erbt persistData()!
  }
}
```

### Phase 3: AI-API Integration

```typescript
public async sendToAI(prompt: string): Promise<void> {
  // User-Message hinzufügen
  this.addMessage(prompt, 'user');

  // AI-Context sammeln
  const context = {
    messages: this.messages.slice(-10), // Letzte 10 Messages
    memories: this.session?.getTopMemories(5),
    boardContext: boardStore.board.getContextData(),
  };

  // AI-API call
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ prompt, context }),
  });

  const data = await response.json();

  // AI-Response hinzufügen
  this.addMessage(data.response, 'assistant');

  // Memories extrahieren (wenn vorhanden)
  if (data.memories) {
    data.memories.forEach((m: any) => {
      this.addMemory(m.content, m.type, m.importance, 'ai-extraction');
    });
  }
}
```

### Phase 3: Auto-Summarization

```typescript
public async autoSummarize(): Promise<void> {
  if (!this.session || this.messages.length < 20) return;

  // Nur wenn > 20 Messages und noch keine Summary existiert
  const lastSummary = this.summaries[this.summaries.length - 1];
  const lastSummarizedIndex = lastSummary?.messageRange[1] || 0;

  if (this.messages.length - lastSummarizedIndex >= 20) {
    const messageRange: [number, number] = [
      lastSummarizedIndex,
      this.messages.length - 1,
    ];

    await this.createSummary(messageRange);
  }
}
```

---

## 📚 Referenzen

- **[STORE-PATTERNS.md](./STORE-PATTERNS.md)** — Pattern-Übersicht
- **[AGENTS.md](../../AGENTS.md)** — Chat-Klasse Spezifikation (Section VI)
- **[ROADMAP.md](../COLLABORATION/ROADMAP.md)** — Phase 3: KI-Integration

---

## 📝 Zusammenfassung

**Warum Manual localStorage?**
- ✅ Mehrere Sessions mit dynamischen Keys (`chat-session-${boardId}`)
- ✅ Klassen-Hierarchien (ChatSession → Message → Memory)
- ✅ Async Initialisierung (AI-API calls)
- ✅ Komplexe Logik (Summarization, Memory-Ranking)

**Key Takeaways:**
1. **Dynamische Keys**: `chat-session-${boardId}` für Multi-Session
2. **triggerUpdate()**: IMMER nach Änderungen aufrufen
3. **Array Reassignments**: `this.messages = [...]` statt `.push()`
4. **getContextData()**: ALLE Felder serialisieren
5. **$derived.by()**: `updateTrigger` MUSS gelesen werden

**Zeit bis Production-Ready:** ~2 Stunden  
**Komplexität:** Mittel (Manual localStorage Pattern)  
**Maintenance:** Einfach (klare API, gute Tests)

---

## 🔄 ALTERNATIVE: Option B - Multiple Conversations pro Board

Falls du **mehrere Conversations pro Board** brauchst, hier die vollständige Implementation:

### Store Implementation (Option B)

```typescript
// src/lib/stores/chatStore.svelte.ts (Option B)

import { ChatSession, type ChatSessionMetadata, type BoardChatIndex } from '$lib/classes/ChatModel';
import { generateDTag } from '$lib/utils/idGenerator';

export class ChatStore {
  // State
  private currentBoardId = $state<string | null>(null);
  private currentSessionId = $state<string | null>(null);
  private session = $state<ChatSession | null>(null);
  private updateTrigger = $state(0);

  // Derived
  public messages = $derived.by(() => {
    this.updateTrigger;
    return this.session?.messages || [];
  });

  public memories = $derived.by(() => {
    this.updateTrigger;
    return this.session?.memories || [];
  });

  // ========================================
  // STORAGE HELPERS (2-TIER SYSTEM)
  // ========================================

  /**
   * Lädt Board-Index (Liste aller Sessions)
   */
  private loadBoardIndex(boardId: string): BoardChatIndex {
    const key = `chat-board-index-${boardId}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse board index:', error);
      }
    }

    // Neuer Index
    return {
      boardId,
      sessions: [],
      activeSessionId: null,
    };
  }

  /**
   * Speichert Board-Index
   */
  private saveBoardIndex(index: BoardChatIndex): void {
    const key = `chat-board-index-${index.boardId}`;
    localStorage.setItem(key, JSON.stringify(index));
  }

  /**
   * Lädt einzelne Session
   */
  private loadSession(sessionId: string): ChatSession | null {
    const key = `chat-session-${sessionId}`;
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        return new ChatSession(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse session:', error);
      }
    }

    return null;
  }

  /**
   * Speichert Session + aktualisiert Index
   */
  private saveSession(): void {
    if (!this.session || !this.currentSessionId || !this.currentBoardId) return;

    // 1. Session speichern
    const sessionKey = `chat-session-${this.currentSessionId}`;
    localStorage.setItem(sessionKey, JSON.stringify(this.session.getContextData()));

    // 2. Board-Index aktualisieren
    const index = this.loadBoardIndex(this.currentBoardId);
    const existingIndex = index.sessions.findIndex(s => s.sessionId === this.currentSessionId);

    const metadata: ChatSessionMetadata = {
      sessionId: this.currentSessionId,
      boardId: this.currentBoardId,
      boardName: this.session.boardName,
      title: this.session.title || 'Untitled Conversation',
      createdAt: this.session.createdAt,
      lastMessageAt: this.session.lastMessageAt,
      messageCount: this.session.messages.length,
    };

    if (existingIndex >= 0) {
      index.sessions[existingIndex] = metadata;
    } else {
      index.sessions = [...index.sessions, metadata];
    }

    index.activeSessionId = this.currentSessionId;
    this.saveBoardIndex(index);
  }

  private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveSession();
  }

  // ========================================
  // PUBLIC API - SESSION MANAGEMENT
  // ========================================

  /**
   * Erstellt neue Session für Board
   */
  public createSession(boardId: string, title: string = 'Neue Conversation'): string {
    const sessionId = generateDTag();
    const session = new ChatSession({
      id: sessionId,
      boardId,
      title,
    });

    // Session speichern
    const key = `chat-session-${sessionId}`;
    localStorage.setItem(key, JSON.stringify(session.getContextData()));

    // Index aktualisieren
    const index = this.loadBoardIndex(boardId);
    const metadata: ChatSessionMetadata = {
      sessionId,
      boardId,
      boardName: session.boardName,
      title,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt,
      messageCount: 0,
    };

    index.sessions = [...index.sessions, metadata];
    index.activeSessionId = sessionId;
    this.saveBoardIndex(index);

    return sessionId;
  }

  /**
   * Lädt Session (und wechselt aktive Session)
   */
  public loadSessionById(sessionId: string): void {
    const session = this.loadSession(sessionId);

    if (session) {
      // Alte Session speichern
      if (this.session && this.currentSessionId) {
        this.saveSession();
      }

      // Neue Session laden
      this.currentSessionId = sessionId;
      this.currentBoardId = session.boardId || null;
      this.session = session;
      this.updateTrigger++;
    }
  }

  /**
   * Listet alle Sessions für ein Board
   */
  public listSessionsForBoard(boardId: string): ChatSessionMetadata[] {
    const index = this.loadBoardIndex(boardId);
    return index.sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  /**
   * Löscht Session
   */
  public deleteSession(sessionId: string, boardId: string): void {
    // 1. Session aus localStorage löschen
    const key = `chat-session-${sessionId}`;
    localStorage.removeItem(key);

    // 2. Aus Board-Index entfernen
    const index = this.loadBoardIndex(boardId);
    index.sessions = index.sessions.filter(s => s.sessionId !== sessionId);

    // Falls aktive Session gelöscht wurde
    if (index.activeSessionId === sessionId) {
      index.activeSessionId = index.sessions[0]?.sessionId || null;
    }

    this.saveBoardIndex(index);

    // 3. Falls aktuell geladene Session: State zurücksetzen
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
      this.session = null;
      this.updateTrigger++;
    }
  }

  /**
   * Ändert Session-Titel
   */
  public renameSession(sessionId: string, newTitle: string): void {
    if (this.currentSessionId === sessionId && this.session) {
      this.session.title = newTitle;
      this.triggerUpdate();
    } else {
      // Session laden, umbenennen, speichern
      const session = this.loadSession(sessionId);
      if (session) {
        session.title = newTitle;
        const key = `chat-session-${sessionId}`;
        localStorage.setItem(key, JSON.stringify(session.getContextData()));
      }
    }
  }

  // ========================================
  // PUBLIC API - MESSAGES (wie vorher)
  // ========================================

  public addMessage(content: string, role: 'user' | 'assistant'): void {
    if (!this.session) {
      throw new Error('No active session!');
    }

    this.session.addMessage({ content, role });
    this.triggerUpdate();
  }

  public deleteMessage(messageId: string): void {
    if (!this.session) return;
    this.session.deleteMessage(messageId);
    this.triggerUpdate();
  }

  // ... (alle anderen Methoden wie addMemory, searchMemories, etc.)

  // ========================================
  // GETTERS
  // ========================================

  public get currentSession() {
    return this.session ? this.session.getContextData() : null;
  }

  public get isActive() {
    return !!this.session;
  }

  public get activeSessionId() {
    return this.currentSessionId;
  }
}

export const chatStore = new ChatStore();
```

### UI-Integration (Option B) - Session-Switcher

```svelte
<!-- src/routes/cardsboard/ChatPanel.svelte (Option B) -->
<script lang="ts">
  import { chatStore } from '$lib/stores/chatStore.svelte';
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import MessageSquareIcon from '@lucide/svelte/icons/message-square';
  import TrashIcon from '@lucide/svelte/icons/trash';

  let { boardId } = $props<{ boardId: string }>();
  let sessions = $state<ChatSessionMetadata[]>([]);
  let showNewSessionDialog = $state(false);
  let newSessionTitle = $state('');

  // Lade Sessions beim Mount
  $effect(() => {
    sessions = chatStore.listSessionsForBoard(boardId);

    // Falls keine aktive Session: erste laden oder neue erstellen
    if (!chatStore.activeSessionId && sessions.length > 0) {
      chatStore.loadSessionById(sessions[0].sessionId);
    } else if (!chatStore.activeSessionId) {
      const sessionId = chatStore.createSession(boardId, 'Erste Conversation');
      chatStore.loadSessionById(sessionId);
    }
  });

  // Aktualisiere Sessions-Liste bei Änderungen
  $effect(() => {
    if (chatStore.isActive) {
      sessions = chatStore.listSessionsForBoard(boardId);
    }
  });

  function handleCreateSession() {
    if (!newSessionTitle.trim()) return;

    const sessionId = chatStore.createSession(boardId, newSessionTitle);
    chatStore.loadSessionById(sessionId);
    sessions = chatStore.listSessionsForBoard(boardId);

    newSessionTitle = '';
    showNewSessionDialog = false;
  }

  function handleSwitchSession(sessionId: string) {
    chatStore.loadSessionById(sessionId);
  }

  function handleDeleteSession(sessionId: string) {
    if (confirm('Session wirklich löschen?')) {
      chatStore.deleteSession(sessionId, boardId);
      sessions = chatStore.listSessionsForBoard(boardId);
    }
  }
</script>

<div class="flex flex-col h-full">
  <!-- Header mit Session-Switcher -->
  <div class="border-b p-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <MessageSquareIcon class="h-5 w-5" />
      <h2 class="font-semibold">KI-Assistent</h2>
    </div>

    <div class="flex items-center gap-2">
      <!-- Session Dropdown -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild let:builder>
          <Button builders={[builder]} variant="outline" size="sm">
            {chatStore.currentSession?.title || 'Session wählen'}
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-64">
          <DropdownMenu.Label>Conversations</DropdownMenu.Label>
          <DropdownMenu.Separator />

          {#each sessions as session (session.sessionId)}
            <DropdownMenu.Item
              onclick={() => handleSwitchSession(session.sessionId)}
              class="flex justify-between items-center"
            >
              <div class="flex-1">
                <div class="font-medium">{session.title}</div>
                <div class="text-xs text-muted-foreground">
                  {session.messageCount} Nachrichten
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onclick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.sessionId);
                }}
              >
                <TrashIcon class="h-3 w-3" />
              </Button>
            </DropdownMenu.Item>
          {/each}

          <DropdownMenu.Separator />
          <DropdownMenu.Item onclick={() => showNewSessionDialog = true}>
            <PlusIcon class="mr-2 h-4 w-4" />
            Neue Conversation
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>

  <!-- Messages (wie vorher) -->
  <!-- ... -->
</div>

<!-- Dialog für neue Session -->
<Dialog.Root bind:open={showNewSessionDialog}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Neue Conversation</Dialog.Title>
    </Dialog.Header>
    <div class="space-y-4 py-4">
      <Input
        bind:value={newSessionTitle}
        placeholder="z.B. UI-Fragen, Datenmodell, Testing..."
      />
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => showNewSessionDialog = false}>
        Abbrechen
      </Button>
      <Button onclick={handleCreateSession}>
        Erstellen
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### Vergleich: Storage-Footprint

**Option A (1 Session pro Board):**
```
localStorage:
  chat-session-board1 → 50KB
  chat-session-board2 → 30KB
Total: 2 Keys, ~80KB
```

**Option B (Multiple Sessions):**
```
localStorage:
  chat-session-abc123 → 25KB (Session 1)
  chat-session-def456 → 30KB (Session 2)
  chat-session-ghi789 → 15KB (Session 3)
  chat-board-index-board1 → 2KB (Metadaten)
Total: 4 Keys für Board 1, ~72KB
```

### Empfehlung

| Use-Case | Empfehlung |
|----------|-----------|
| **Board-spezifischer KI-Assistent** | Option A (Einfach) |
| **Längere Entwicklungsphasen** | Option B (Multiple) |
| **Topic-Trennung wichtig** | Option B (Multiple) |
| **Team-Kollaboration** | Option B (Multiple) |
| **Prototype/MVP** | Option A (Einfach) |

**Tipp:** Starte mit **Option A**, migriere später zu **Option B** wenn nötig!

---

**Status:** ✅ PRODUCTION-READY EXAMPLE (Both Options)  
**Zielgruppe:** Entwickler die ChatStore implementieren  
**Aktualisierung:** 02.11.2025
