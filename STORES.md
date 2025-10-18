# 📦 Svelte 5 Stores Spezifikation

**Version:** 1.0  
**Datum:** 18. Oktober 2025  
**Framework:** Svelte 5 (Runes), TypeScript  
**Status:** Specification (Implementation in Meilenstein 1.1 – 1.5)

---

## Executive Summary

Diese Spezifikation definiert die **zentrale Zustandsverwaltung** des Kanban-Boards. Stores sind die Brücke zwischen:
- **BoardModel.ts** (Geschäftslogik)
- **NDK.md** (Nostr Integration)
- **NOSTR-USER.md** (Authentifizierung)
- **UI-Komponenten** (Rendering)

**Kritisch:** Stores ermöglichen **Offline-First** und **Export/Import** (Meilenstein 1.5).

---

## I. Store-Architektur & Verantwortlichkeiten

### Überblick

```
┌────────────────────────────────────────────────────────┐
│  UI Layer (Svelte Components)                          │
│  - Board.svelte, Column.svelte, Card.svelte            │
│  - CardDialog.svelte, Chatbot.svelte                   │
└────────────┬─────────────────────────────────────────┘
             │ (Runes: $derived, $effect)
    ┌────────┴──────────┬──────────────┬────────────────┐
    ↓                   ↓              ↓                ↓
┌────────────┐  ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ BoardStore │  │  AuthStore   │ │ SyncManager │ │ SettingsStore│
│ (Primary)  │  │              │ │             │ │  (Optional)  │
└────────────┘  └──────────────┘ └─────────────┘ └──────────────┘
    │ $state       │ $state          │ $state        │ $state
    │ board        │ user            │ queue         │ settings
    ├─ CardStore   ├─ pubkey         ├─ events      ├─ theme
    ├─ ChatStore   ├─ signer         └─ isOnline    └─ layout
    └─ Sync        └─ profile
       Handling

    ↓  getContext('ndk')     ↓  getContext('authStore')
    
┌────────────────────────┬─────────────────────────────┐
│  NDK Instance          │  IndexedDB (Persistence)    │
│  - Relay Connection    │  - Event Queue              │
│  - Event Publishing    │  - Board Cache              │
│  - Subscriptions       │  - Session Storage          │
└────────────────────────┴─────────────────────────────┘
```

---

### 1.1 BoardStore (Primärer Store)

**Datei:** `src/lib/stores/kanbanStore.ts`

**Verantwortlichkeiten:**
- ✅ Board-Zustand verwalten (`Board` Instanz)
- ✅ Chat-Interface bereitstellen (`Chat` Instanz)
- ✅ Proxy-Methoden zu BoardModel.ts
- ✅ NDK Integration für Publish/Subscribe
- ✅ **Export/Import (Meilenstein 1.5)**
- ✅ SyncManager für Offline-First

**Struktur:**

```typescript
// src/lib/stores/kanbanStore.ts

import { Board, Chat } from '$lib/classes/BoardModel';
import { SyncManager } from './syncManager';
import type NDK from '@nostr-dev-kit/ndk';

export class BoardStore {
  // State
  private board = $state(new Board({ 
    name: 'Initiales Kanban Board',
    columns: [
      { name: 'Materialideen' },
      { name: 'Auswahl' },
      { name: 'Einstieg' },
      { name: 'Erarbeitung' },
      { name: 'Sicherung' }
    ]
  }));

  private chat = $state(new Chat(this.board));
  private syncManager: SyncManager;
  private ndk: NDK;
  private authStore: AuthStore; // ← Abhängigkeit!

  // ──────────────────────────────────────────
  // Constructor & Initialization
  // ──────────────────────────────────────────

  constructor(ndk: NDK, authStore: AuthStore) {
    this.ndk = ndk;
    this.authStore = authStore;
    this.syncManager = new SyncManager(ndk);
    
    // Initial Load from Nostr (wenn authenticated)
    if (authStore.isAuthenticated) {
      this.loadFromNostr();
    }
  }

  // ──────────────────────────────────────────
  // Getter (Reactive Access)
  // ──────────────────────────────────────────

  public get data() {
    return this.board;
  }

  public get chatInterface() {
    return this.chat;
  }

  public get syncStatus() {
    return this.syncManager.status;
  }

  // ──────────────────────────────────────────
  // Board Operations (Proxy Methods)
  // ──────────────────────────────────────────

  public moveCard(cardId: string, fromColId: string, toColId: string) {
    // 1. Lokale Änderung (sofort reactiv)
    this.board.moveCard(cardId, fromColId, toColId);
    
    // 2. Nostr Event veröffentlichen/queuen
    this.publishCardUpdate(cardId, toColId);
  }

  public addColumn(props: ColumnProps): Column {
    const column = this.board.addColumn(props);
    this.publishBoardUpdate();
    return column;
  }

  public deleteColumn(columnId: string) {
    this.board.deleteColumn(columnId);
    this.publishBoardUpdate();
  }

  public addCard(columnId: string, cardProps: CardProps): Card {
    const column = this.board.findColumn(columnId);
    if (!column) throw new Error(`Column ${columnId} not found`);
    
    const card = column.addCard(cardProps);
    this.publishCardUpdate(card.id, columnId);
    return card;
  }

  public deleteCard(cardId: string) {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
      result.column.deleteCard(cardId);
      this.publishBoardUpdate();
    }
  }

  // ──────────────────────────────────────────
  // Comment Operations
  // ──────────────────────────────────────────

  public async addComment(cardId: string, text: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) throw new Error(`Card ${cardId} not found`);
    
    const { card } = result;
    
    try {
      // Nostr: Erstelle Kind 1 Event
      await card.addCommentToNostr(this.ndk, text);
    } catch (error) {
      console.error('Failed to add comment to Nostr:', error);
      
      // Fallback: Lokal hinzufügen (wird später synced)
      const currentUser = this.authStore.getCurrentUser();
      card.addComment(text, currentUser?.pubkey || 'unknown');
    }
  }

  public async deleteComment(cardId: string, commentId: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    try {
      await result.card.deleteCommentFromNostr(this.ndk, commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      result.card.deleteComment(commentId);
    }
  }

  // ──────────────────────────────────────────
  // AI Operations
  // ──────────────────────────────────────────

  public async sendPromptToAI(prompt: string, context?: Card | Column | Board): Promise<void> {
    this.chat.sendPromptToAI(prompt, context);
    // Payload wird in Chat.sendPromptToAI() erstellt
  }

  public processAIAction(action: AIAction): void {
    this.chat.processAIAction(action);
    // Dann: publishBoardUpdate()
    this.publishBoardUpdate();
  }

  // ──────────────────────────────────────────
  // Export / Import (Meilenstein 1.5) ⭐
  // ──────────────────────────────────────────

  /**
   * Exportiert Board als JSON
   * @returns JSON string mit Board-Daten
   */
  public exportBoard(): string {
    const contextData = this.board.getContextData(true);
    
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: this.authStore.getCurrentUser()?.pubkey,
      board: contextData,
      // Metadaten für Import
      schemaVersion: 1
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Importiert Board aus JSON
   * @param jsonString JSON string from exportBoard()
   * @param strategy 'merge' (neue IDs) oder 'overwrite' (alte IDs erhalten)
   * @returns true wenn erfolgreich, false bei Fehler
   */
  public importBoard(jsonString: string, strategy: 'merge' | 'overwrite' = 'merge'): boolean {
    try {
      // 1. Parse & Validate
      const importData = JSON.parse(jsonString);
      
      if (importData.schemaVersion !== 1) {
        throw new Error(`Unsupported schema version: ${importData.schemaVersion}`);
      }

      if (!importData.board || !Array.isArray(importData.board.columns)) {
        throw new Error('Invalid board structure in import file');
      }

      // 2. ID Conflict Resolution
      const idMap = new Map<string, string>(); // alt -> neu

      if (strategy === 'merge') {
        // Strategie 1: Neue IDs generieren (keine Konflikte)
        this.board.columns.forEach(col => {
          col.cards.forEach(card => {
            // IDs merken falls nötig
          });
        });
        
        // Import mit neuen IDs
        importData.board.columns.forEach((col: ColumnProps) => {
          const newColId = generateDTag();
          const newCol = this.board.addColumn({
            ...col,
            id: newColId,
            cards: []
          });
          
          col.cards?.forEach((card: CardProps) => {
            const newCardId = generateDTag();
            newCol.addCard({
              ...card,
              id: newCardId
            });
            idMap.set(card.id, newCardId);
          });
        });
      } else if (strategy === 'overwrite') {
        // Strategie 2: Alte IDs erhalten (Überschreiben bei Konflikt)
        this.board = new Board({
          ...importData.board,
          id: this.board.id, // Board-ID behalten!
        });
      }

      // 3. Publish zu Nostr
      this.publishBoardUpdate();
      
      return true;

    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }

  /**
   * Exportiert Board als JSON File (Download)
   */
  public downloadBoardAsJSON(filename: string = 'board.json'): void {
    const json = this.exportBoard();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Generiert Share-Link mit komprimiertem Board-JSON (optional)
   * Hinweis: Benötigt Backend für URL-Shortening
   */
  public async generateShareLink(): Promise<string | null> {
    const json = this.exportBoard();
    const compressed = btoa(json); // Base64 encode
    
    // Optional: Backend aufrufen um Share-Link zu generieren
    // const response = await fetch('/api/share', { method: 'POST', body: compressed });
    // return response.json().shareUrl;
    
    return compressed; // Für jetzt: Base64 zurückgeben
  }

  // ──────────────────────────────────────────
  // Nostr Publishing (Internal)
  // ──────────────────────────────────────────

  private async publishBoardUpdate(): Promise<void> {
    if (!this.authStore.isAuthenticated) {
      console.warn('Cannot publish: User not authenticated');
      return;
    }

    const event = boardToNostrEvent(this.board, this.ndk);
    await this.syncManager.publishOrQueue(event, 'board');
  }

  private async publishCardUpdate(cardId: string, columnId: string): Promise<void> {
    if (!this.authStore.isAuthenticated) return;

    const column = this.board.findColumn(columnId);
    if (!column) return;

    const card = column.findCard(cardId);
    if (!card) return;

    const rank = column.cards.indexOf(card);
    const boardRef = `30301:${this.authStore.getCurrentUser()?.pubkey}:${this.board.id}`;

    const event = cardToNostrEvent(card, column.name, rank, boardRef, this.ndk);
    await this.syncManager.publishOrQueue(event, 'card');
  }

  // ──────────────────────────────────────────
  // Nostr Loading & Subscriptions
  // ──────────────────────────────────────────

  private async loadFromNostr(): Promise<void> {
    const user = this.authStore.getCurrentUser();
    if (!user) return;

    try {
      // Board laden
      const boardEvent = await this.ndk.fetchEvent({
        kinds: [30301],
        authors: [user.pubkey],
        '#d': [this.board.id]
      });

      if (boardEvent) {
        const boardProps = nostrEventToBoard(boardEvent);
        this.board = new Board({ ...this.board, ...boardProps });
      }

      // Live subscriptions starten
      this.subscribeToUpdates();

    } catch (error) {
      console.error('Failed to load board from Nostr:', error);
    }
  }

  private subscribeToUpdates(): void {
    const user = this.authStore.getCurrentUser();
    if (!user) return;

    // Board Updates
    this.ndk.subscribe(
      {
        kinds: [30301],
        authors: [user.pubkey],
        '#d': [this.board.id]
      },
      { closeOnEose: false }
    ).on('event', (event) => {
      const updated = nostrEventToBoard(event);
      this.board = new Board({ ...this.board, ...updated });
    });

    // Card Updates
    this.ndk.subscribe(
      {
        kinds: [30302],
        '#a': [`30301:${user.pubkey}:${this.board.id}`]
      },
      { closeOnEose: false }
    ).on('event', (event) => {
      const cardProps = nostrEventToCard(event);
      const columnName = event.tags.find(t => t[0] === 's')?.[1];
      
      if (columnName) {
        const column = this.board.columns.find(c => c.name === columnName);
        if (column) {
          const existing = column.findCard(cardProps.id!);
          if (existing) {
            existing.update(cardProps);
          } else {
            column.addCard(cardProps);
          }
        }
      }
    });
  }
}

// Export Global Instance
export const boardStore = new BoardStore(ndk, authStore);
```

---

### 1.2 AuthStore (Authentifizierung)

**Datei:** `src/lib/stores/authStore.ts` (siehe `NOSTR-USER.md`)

**Verantwortlichkeiten:**
- ✅ Benutzer-Session verwalten
- ✅ NDK Signer bereitstellen
- ✅ Authentifizierungsstatus prüfen
- ✅ Profildaten laden/speichern

**Abhängigkeit von BoardStore:** BoardStore benötigt den authentifizierten User von AuthStore.

**Integration:**

```typescript
// In BoardStore
constructor(ndk: NDK, authStore: AuthStore) {
  this.authStore = authStore;
  
  // Subscribe to auth changes
  $effect(() => {
    if (authStore.isAuthenticated) {
      this.loadFromNostr();
    } else {
      // Clear board or load demo data
    }
  });
}
```

---

### 1.3 SyncManager (Offline-First Queue)

**Datei:** `src/lib/stores/syncManager.ts` (siehe `AGENTS.md` Section VI.2)

**Verantwortlichkeiten:**
- ✅ Event Queue für Offline-Betrieb
- ✅ Online/Offline Status Detection
- ✅ Automatisches Retry bei Reconnect
- ✅ Last-Write-Wins Conflict Resolution

**Integration in BoardStore:**

```typescript
// In BoardStore.moveCard()
public moveCard(cardId: string, fromColId: string, toColId: string) {
  this.board.moveCard(cardId, fromColId, toColId); // Lokal
  this.publishCardUpdate(cardId, toColId); // → syncManager.publishOrQueue()
}
```

---

### 1.4 SettingsStore (Optional)

**Datei:** `src/lib/stores/settingsStore.ts`

**Verantwortlichkeiten:**
- Theme (Light/Dark)
- Sidebar-Sichtbarkeit
- Benutzer-Preferences

**Optional für Phase 1** — kann in Phase 2 hinzugefügt werden.

---

## II. Store-Interaktionen & Context-Passing

### NDK Context (Global)

```typescript
// In src/routes/+layout.svelte

<script lang="ts">
  import { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { setContext } from 'svelte';
  
  const ndk = new NDKSvelte({
    explicitRelayUrls: ['wss://relay.damus.io', 'wss://relay.primal.net']
  });
  
  await ndk.connect();
  
  // ✅ Wichtig: NDK in Context speichern
  setContext('ndk', ndk);
</script>
```

### AuthStore Context (Global)

```typescript
// In src/routes/+layout.svelte (Fortsetzung)

<script lang="ts">
  import { initializeAuth } from '$lib/stores/authStore';
  
  // Initialize AuthStore mit NDK
  const authStore = initializeAuth(ndk);
  
  // ✅ Wichtig: AuthStore in Context speichern
  setContext('authStore', authStore);
</script>
```

### BoardStore Initialization (Global)

```typescript
// In src/routes/+layout.svelte (Fortsetzung)

<script lang="ts">
  import { BoardStore } from '$lib/stores/kanbanStore';
  
  // BoardStore braucht NDK und AuthStore
  const boardStore = new BoardStore(ndk, authStore);
  
  // ✅ Wichtig: BoardStore in Context speichern
  setContext('boardStore', boardStore);
</script>
```

### Zugriff in Komponenten

```svelte
<!-- In src/lib/components/Card.svelte -->

<script lang="ts">
  import { getContext } from 'svelte';
  import type { BoardStore } from '$lib/stores/kanbanStore';
  
  const boardStore = getContext<BoardStore>('boardStore');
  
  // Reactive binding
  let board = $derived(boardStore.data);
</script>

<!-- Use board.data in template -->
<div>
  {#each board.columns as column}
    <!-- ... -->
  {/each}
</div>
```

---

## III. Export/Import API (Meilenstein 1.5) ⭐

### 3.1 Datenformat

**Export-JSON Struktur:**

```json
{
  "version": "1.0",
  "exportedAt": "2025-10-18T14:30:00Z",
  "exportedBy": "npub1...",
  "schemaVersion": 1,
  "board": {
    "id": "board-123",
    "name": "Meine Unterrichtsstunde",
    "description": "Römisches Reich, Klasse 7",
    "publishState": "draft",
    "author": "npub1...",
    "columns": [
      {
        "id": "col-1",
        "name": "Materialideen",
        "cards": [
          {
            "id": "card-1",
            "heading": "Video: Römisches Reich",
            "content": "5-Min Video zur Einführung",
            "publishState": "published",
            "labels": ["video", "einstieg"],
            "links": [
              {
                "id": "link-1",
                "url": "https://example.com/video",
                "title": "YouTube Video"
              }
            ],
            "comments": [
              {
                "text": "Gutes Einführungsvideo",
                "author": "npub2..."
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 3.2 API-Methoden

```typescript
// Export
const json = boardStore.exportBoard();
boardStore.downloadBoardAsJSON('meine-stunde.json');
const shareLink = await boardStore.generateShareLink();

// Import
const success = boardStore.importBoard(jsonString, 'merge');
```

### 3.3 Strategien für ID-Konflikte

#### Strategie 1: "merge" (Standard)
- Generiert neue IDs für alle importierten Objekte
- Keine Konflikte mit existierenden Boards
- Resultat: Zwei unabhängige Boards mit gleichen Inhalten

```typescript
const imported = boardStore.importBoard(jsonString, 'merge');
// Neue Board mit neuen IDs: card-1-neu, card-2-neu, etc.
```

#### Strategie 2: "overwrite"
- Behält alte IDs
- Überschreibt existierende Cards bei ID-Konflikten
- **Warnung:** Kann zu Datenverlust führen!

```typescript
const imported = boardStore.importBoard(jsonString, 'overwrite');
// Board wird mit den alten IDs überschrieben
```

### 3.4 Validierung

```typescript
function validateBoardImport(jsonString: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  try {
    const data = JSON.parse(jsonString);
    
    if (!data.board) errors.push('Missing "board" field');
    if (!Array.isArray(data.board.columns)) errors.push('Invalid columns array');
    
    data.board.columns.forEach((col, i) => {
      if (!col.name) errors.push(`Column ${i} missing name`);
      if (!Array.isArray(col.cards)) errors.push(`Column ${i} missing cards array`);
    });
    
  } catch (e) {
    errors.push(`JSON parse error: ${e.message}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## IV. Persistenz-Strategie

### 4.1 IndexedDB (svelte-persisted-store)

```typescript
// Beispiel aus AGENTS.md

import { persisted } from 'svelte-persisted-store';

export class SyncManager {
  // Persistent Event Queue
  private eventQueue = persisted<QueuedEvent[]>('nostr-event-queue', []);
  
  // Diese Queue bleibt über Browser-Neustarts erhalten
}
```

### 4.2 Session-Speicherung (AuthStore)

```typescript
// aus NOSTR-USER.md

export interface UserSession {
  pubkey: string;
  profile?: NDKUserProfile;
  loginMethod: 'nip07' | 'nsec' | 'nip46';
  loginTime: number;
  expires: number; // 7 Tage
}

// Gespeichert in IndexedDB (nicht localStorage!)
private sessionStore = persisted<UserSession | null>('nostr-session', null);
```

### 4.3 Board Cache (IndexedDB)

```typescript
// Optional: Boards im IndexedDB cachen

import NDK, { NDKCacheAdapterDexie } from '@nostr-dev-kit/ndk';

const ndk = new NDK({
  explicitRelayUrls: ['wss://relay.damus.io'],
  cacheAdapter: new NDKCacheAdapterDexie() // ← Board Events cachen
});
```

---

## V. Svelte 5 Runes Best Practices

### 5.1 $state in Stores

```typescript
export class BoardStore {
  // ✅ RICHTIG: $state für reactive state
  private board = $state(new Board({ ... }));
  
  // ❌ FALSCH: keine $state für externe Events
  // private externalData = new Board({ ... });
}
```

### 5.2 $derived in Komponenten

```svelte
<script lang="ts">
  const boardStore = getContext<BoardStore>('boardStore');
  
  // ✅ RICHTIG: $derived für berechnete Werte
  let columnCount = $derived(boardStore.data.columns.length);
  let hasCards = $derived(columnCount > 0);
  
  // ❌ FALSCH: Unnötige Stores für simple Werte
  // const columnCountStore = writable(0);
</script>
```

### 5.3 $effect für Cleanup

```typescript
export class BoardStore {
  constructor(ndk: NDK, authStore: AuthStore) {
    // ✅ RICHTIG: $effect für Side Effects
    $effect(() => {
      if (authStore.isAuthenticated) {
        this.subscribeToUpdates();
      }
    });
  }
}
```

### 5.4 $effect.pre für Setup

```typescript
export class SyncManager {
  constructor() {
    // ✅ RICHTIG: $effect.pre für Setup VOR Render
    $effect.pre(() => {
      window.addEventListener('online', () => this.syncQueue());
      window.addEventListener('offline', () => this.markOffline());
      
      // Cleanup
      return () => {
        window.removeEventListener('online', () => {});
        window.removeEventListener('offline', () => {});
      };
    });
  }
}
```

---

## VI. Integration Checklist

### Für Phase 1 (Meilenstein 1.1 – 1.5):

- [ ] **BoardStore** implementiert
  - [ ] Board-Zustand mit `$state`
  - [ ] Chat-Interface
  - [ ] Proxy-Methoden zu BoardModel
  - [ ] NDK Publishing (via SyncManager)
  - [ ] Export/Import API
  - [ ] Nostr Loading & Subscriptions

- [ ] **AuthStore** implementiert (NOSTR-USER.md)
  - [ ] User-Session Management
  - [ ] NIP-07 Signer Integration
  - [ ] isAuthenticated Getter

- [ ] **SyncManager** implementiert (AGENTS.md)
  - [ ] Event Queue (IndexedDB)
  - [ ] Online/Offline Detection
  - [ ] Retry-Logik

- [ ] **Context-Passing** in +layout.svelte
  - [ ] setContext('ndk', ndk)
  - [ ] setContext('authStore', authStore)
  - [ ] setContext('boardStore', boardStore)

- [ ] **Tests**
  - [ ] Export/Import Round-Trip
  - [ ] ID-Konflikt Handling
  - [ ] Offline Queueing
  - [ ] Store Interactions

### Für Phase 2 (UI Migration):

- [ ] Alle Komponenten nutzen `getContext('boardStore')`
- [ ] Keine direkten Store-Instantiierungen in Komponenten
- [ ] Alle Reaktivität via `$derived`

---

## VII. Fehlerbehandlung

### Export-Fehler

```typescript
public exportBoard(): string | null {
  try {
    const contextData = this.board.getContextData(true);
    return JSON.stringify(contextData);
  } catch (error) {
    console.error('Export failed:', error);
    return null;
  }
}
```

### Import-Fehler mit User-Feedback

```typescript
public importBoard(jsonString: string, strategy: 'merge' | 'overwrite' = 'merge'): 
  { success: boolean; error?: string } {
  
  try {
    const data = JSON.parse(jsonString);
    
    // Validation
    if (!data.board?.columns) {
      throw new Error('Invalid board structure');
    }
    
    // Import logic...
    return { success: true };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

---

## VIII. Security Considerations

### Sensitive Data Protection

```typescript
// ✅ RICHTIG: Exportiere keine Private Keys
const exportData = {
  board: this.board.getContextData(true),
  // ❌ NIEMALS: exportedBy user.signer
  exportedBy: this.authStore.getCurrentUser()?.pubkey // nur pubkey!
};

// ✅ RICHTIG: Import validiert User
public importBoard(jsonString: string) {
  const data = JSON.parse(jsonString);
  
  // Check if current user is authorized to import
  if (data.exportedBy && data.exportedBy !== this.authStore.getCurrentUser()?.pubkey) {
    console.warn('Board exported by different user');
  }
}
```

### Event Queue Security

```typescript
// Aus syncManager.ts
private queueEvent(event: NDKEvent, type: 'board' | 'card' | 'comment'): void {
  const queuedEvent: QueuedEvent = {
    event: JSON.stringify(event.rawEvent()), // ← Nur serialisiertes Event
    timestamp: Date.now(),
    retries: 0,
    type
  };
  
  // ✅ Kein Private Key in Queue!
}
```

---

## IX. Performance Optimization

### Store Subscription Limits

```typescript
// ✅ RICHTIG: Limit subscriptions
private subscribeToUpdates(): void {
  // Nur für aktuelles Board abonnieren
  const user = this.authStore.getCurrentUser();
  
  this.ndk.subscribe(
    {
      kinds: [30302],
      '#a': [`30301:${user.pubkey}:${this.board.id}`], // ← Spezifisch!
      limit: 100 // ← Limit setzen
    },
    { closeOnEose: false }
  );
}

// ❌ FALSCH: Zu breite Subscriptions
// this.ndk.subscribe({ kinds: [30302] }); // Alle Cards weltweit!
```

### Derived Value Memoization

```svelte
<script lang="ts">
  const boardStore = getContext<BoardStore>('boardStore');
  
  // ✅ RICHTIG: $derived ist memoized
  let cardCount = $derived(
    boardStore.data.columns.reduce((sum, col) => sum + col.cards.length, 0)
  );
  
  // Only recalculated when board.columns or cards change
</script>
```

---

## X. Roadmap Integration

| Meilenstein | Stores | Status |
|------------|--------|--------|
| **1.1: Nostr Publishing** | BoardStore + SyncManager | 🔄 IN PROGRESS |
| **1.2: Offline-First** | SyncManager erweitert | 🟡 PLANNED |
| **1.3: Comments** | BoardStore.addComment() | 🟡 PLANNED |
| **1.4: Authentication** | AuthStore Integration | 🟡 PLANNED |
| **1.5: Export/Import** | BoardStore.export/import() | 🟡 PLANNED |
| **2.1: UI Components** | Context-basierte Komponenten | ⚪ PLANNED |

---

## XI. Dokumentation Links

- **[AGENTS.md](./AGENTS.md)** – BoardModel.ts, Chat.ts Spezifikation
- **[NDK.md](./NDK.md)** – NDK Initialisierung & Event API
- **[NOSTR-USER.md](./NOSTR-USER.md)** – AuthStore & Signer Integration
- **[ROADMAP.md](./ROADMAP.md)** – Meilensteine 1.1 – 1.5

---

**Zuletzt aktualisiert:** 18. Oktober 2025  
**Nächster Review:** Nach Implementierung von Meilenstein 1.1
