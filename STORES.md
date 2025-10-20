# 📦 Svelte 5 Stores Spezifikation

**Version:** 2.0 (UPDATED für Svelte 5 Runes)
**Datum:** 19. Oktober 2025  
**Framework:** Svelte 5 (Runes), TypeScript  
**Status:** PARTIALLY IMPLEMENTED (Phase 1 ✅, Phase 2 🟡, Phase 3 ⏳)

---

## ⚠️ KRITISCHE ÄNDERUNG: Svelte 5 Runes Paradigma

### **Dateiendung `.svelte.ts` ist NOTWENDIG!**

Ab Svelte 5 müssen alle Stores mit **reaktiven Daten** die Endung `.svelte.ts` haben, damit der Compiler Runes transformieren kann:

```typescript
// ❌ FALSCH: kanbanStore.svelte.ts (funktioniert NICHT)
export class BoardStore {
    private board = $state(...); // ← Compiler-Fehler!
}

// ✅ RICHTIG: kanbanStore.svelte.ts (funktioniert)
export class BoardStore {
    private board = $state(...); // ← OK!
    public uiData = $derived.by(...); // ← OK!
}
```

**Betroffene Stores:**
- ✅ **kanbanStore.svelte.ts** — Bereits konvertiert (BoardStore mit `$state`, `$derived`)
- 🟡 **settingsStore.svelte.ts** — MUSS konvertiert werden (aktuell: Svelte 4 writable)
- ⏳ **authStore.svelte.ts** — Noch zu erstellen (Nostr User Management)
- ⏳ **syncManager.svelte.ts** — Noch zu erstellen (Offline-First Queue)

### 📖 ANLEITUNG: Dynamische Prop-Änderungen

**Wenn du willst, dass der Nutzer eine Eigenschaft (z.B. Spalten-Name) in der UI ändern kann:**

👉 **Lies:** [PROP-UPDATE-GUIDE.md](./PROP-UPDATE-GUIDE.md) (5-Schritt Anleitung mit Beispielen)

Diese Anleitung erklärt:
1. Store-Methode erstellen (`updateColumn()`, `updateCard()`, etc.)
2. Component Handler implementieren (z.B. `handleRename()`)
3. `$effect` für UI-Sync hinzufügen (automatische Reaktivität)
4. Model-Update-Methode nutzen (`column.update()`)
5. localStorage wird automatisch gespeichert via `triggerUpdate()`

**Praktisches Beispiel:** Spalten-Name ändern im Popover → sofort sichtbar im Board → bleibt nach Reload erhalten ✅

---

## II. Aktuelle Implementierung (Phase 1 ✅)

### BoardStore (kanbanStore.svelte.ts)

```typescript
// src/lib/stores/kanbanStore.svelte.ts (PRODUCTION)

export class BoardStore {
    private board = $state(this.loadFromStorage()); // ← $state Rune
    private _columnOrder = $state<string[]>(this.board.columns.map(c => c.id)); // ← Immutable ordering
    private updateTrigger = $state(0); // ← Reaktivitäts-Trigger

    // ← $derived.by berechnet automatisch neu wenn updateTrigger/board.columns sich ändern
    public uiData = $derived.by(() => {
        const columns = this.board.columns; // ← Direct access für Tracking
        const columnOrder = this._columnOrder;
        const trigger = this.updateTrigger;
        
        // Transformiere zu UI-Format
        const columnMap = new Map(columns.map(c => [c.id, c]));
        const result: UIColumn[] = [];
        for (const colId of columnOrder) {
            const column = columnMap.get(colId);
            if (column) {
                result.push({
                    id: column.id,
                    name: column.name,
                    color: column.color,
                    items: column.cards.map(card => ({
                        id: card.id,
                        name: card.heading,
                        description: card.content,
                        // ... weitere Properties
                    }))
                });
            }
        }
        return result;
    });

    // ──────────────────────────────────────────
    // Öffentliche Methoden
    // ──────────────────────────────────────────

    public createCard(columnId: string, name: string, description?: string): string {
        const cardProps: CardProps = {
            heading: name,
            content: description || 'Bitte bearbeiten...',
            publishState: 'draft'
        };
        
        const column = this.board.findColumn(columnId);
        if (column) {
            const card = column.addCard(cardProps); // ← Rune-safe: addCard nutzt Reassignment
            this.triggerUpdate(); // → saveToStorage()
            this.publishToNostr();
            return card.id;
        }
        throw new Error(`Column ${columnId} not found`);
    }

    public updateCard(cardId: string, updates: Partial<CardProps>): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.update(updates);
            this.triggerUpdate(); // ← Automatisch saveToStorage()
            this.publishToNostr();
        } else {
            throw new Error(`Card ${cardId} not found`);
        }
    }

    public syncBoardState(uiColumns: UIColumn[]): void {
        // 3-Schritt Synchronisation
        const newColumnOrder = uiColumns.map(c => c.id);
        this._columnOrder = newColumnOrder;
        
        // Reorder board.columns
        const columnMap = new Map(this.board.columns.map(c => [c.id, c]));
        const reorderedColumns = [];
        for (const colId of newColumnOrder) {
            const col = columnMap.get(colId);
            if (col) reorderedColumns.push(col);
        }
        this.board.columns = reorderedColumns; // ← Reassignment!
        
        // Sync card positions
        for (const uiColumn of uiColumns) {
            const boardColumn = this.board.findColumn(uiColumn.id);
            if (!boardColumn) continue;
            
            const cardMap = new Map(boardColumn.cards.map(c => [c.id, c]));
            const reorderedCards = [];
            
            for (const uiCard of uiColumn.items) {
                const cardIdStr = String(uiCard.id);
                let card = cardMap.get(cardIdStr);
                
                if (!card) {
                    const result = this.board.findCardAndColumn(cardIdStr);
                    if (result && result.column.id !== uiColumn.id) {
                        result.column.deleteCard(cardIdStr);
                        boardColumn.appendCard(result.card);
                        card = result.card;
                    }
                }
                if (card) reorderedCards.push(card);
            }
            boardColumn.cards = reorderedCards; // ← Reassignment!
        }
        
        this.triggerUpdate(); // ← Speichert sofort
        this.publishToNostr();
    }

    // ──────────────────────────────────────────
    // Private Helper
    // ──────────────────────────────────────────

    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage(); // ← Synchron!
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        
        try {
            const data = this.board.getContextData(true);
            localStorage.setItem('kanban-board-data', JSON.stringify(data));
            console.log('💾 Board in localStorage gespeichert');
        } catch (error) {
            console.warn('⚠️ Fehler beim Speichern:', error);
        }
    }

    private loadFromStorage(): Board {
        if (typeof window === 'undefined') {
            return this.createDefaultBoard();
        }
        
        try {
            const stored = localStorage.getItem('kanban-board-data');
            if (stored) {
                const data = JSON.parse(stored);
                return this.reconstructBoard(data);
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden:', error);
        }
        
        return this.createDefaultBoard();
    }

    private publishToNostr(): void {
        // Stub für zukünftige Nostr Integration
        console.log('Publishing board state to Nostr...', this.board.getContextData(true));
        this.saveToStorage();
    }
}

// ← GLOBALE INSTANZ (nicht writable!)
export const boardStore = new BoardStore();
```

**Kritische Design-Punkte:**

1. ✅ **`$state` für Rune-Tracking** — updateTrigger wird gelesen, daher triggert $derived
2. ✅ **`$derived.by()` berechnet automatisch neu** — keine Subscribers notwendig
3. ✅ **Reassignments statt Mutationen** — `this.cards = [...this.cards, card]` statt `.push()`
4. ✅ **`triggerUpdate()` synchron** — speichert sofort in localStorage (schnell genug für ~10KB)
5. ✅ **Globale Singleton-Instanz** — kein `writable()`, nur `class BoardStore`

### Column.svelte (Sync mit $effect)

```svelte
<!-- src/routes/cardsboard/Column.svelte -->
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte';

    // ← Überwacht boardStore.uiData automatisch
    $effect(() => {
        const uiColumns = boardStore.uiData; // ← Dependency Tracking
        
        const updatedColumn = uiColumns.find(c => c.id === columnId);
        if (updatedColumn) {
            // Vergleiche Items
            const itemsChanged = updatedColumn.items.length !== items.length ||
                updatedColumn.items.some((newItem, idx) => {
                    const oldItem = items[idx];
                    return !oldItem || newItem.id !== oldItem.id || 
                        newItem.name !== oldItem.name;
                });
            
            if (itemsChanged) {
                items = updatedColumn.items; // ← Auto-Sync!
            }
        }
    });
</script>
```

**Ablauf bei Karten-Bearbeitung:**

1. User bearbeitet Karte in CardDialog
2. `handleEditSave()` → `boardStore.editCard()`
3. `editCard()` → `updateCard()` → `triggerUpdate()`
4. `updateTrigger++` inkrementiert
5. `uiData` $derived neu berechnet (weil `updateTrigger` dependency changed)
6. `Column.svelte` $effect bemerkt `boardStore.uiData` update
7. `items` Prop wird aktualisiert
8. **UI re-rendert sofort** ✅

### BoardModel.ts (Array-Reassignments)

```typescript
// src/lib/classes/BoardModel.ts (WICHTIG!)

export class Column {
    addCard(props: CardProps): Card {
        const card = new Card(props);
        // ✅ RICHTIG: Reassignment statt push()
        this.cards = [...this.cards, card]; // ← Svelte 5 tracking!
        return card;
    }

    appendCard(card: Card): void {
        this.cards = [...this.cards, card]; // ← Reassignment!
    }
}

export class Card {
    addComment(text: string, author: string): void {
        const comment: Comment = { /* ... */ };
        // ✅ RICHTIG: Reassignment
        this.comments = [...this.comments, comment]; // ← Svelte 5 tracking!
    }
}

export class Board {
    addColumn(props: ColumnProps): Column {
        const column = new Column(props);
        // ✅ RICHTIG: Reassignment
        this.columns = [...this.columns, column]; // ← Svelte 5 tracking!
        return column;
    }
}
```

---

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
   * Generiert Share-Link mit komprimiertem Board-JSON (jsoncrush)
   * Rein clientseitig – kein Backend nötig!
   * @returns URL-sicherer komprimierter Token (Base64-URL)
   */
  public generateShareLink(): string {
    const json = this.exportBoard();

    // 1. Komprimiere JSON mit jsoncrush
    const crushed = crush(json);

    // 2. Base64-URL encode (URL-sicher: - _ statt + /)
    const token = btoa(crushed)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, ''); // Padding entfernen

    // 3. Größenlimit prüfen (z.B. 2KB für URLs)
    const tokenSizeKB = token.length / 1024;
    if (tokenSizeKB > 2) {
      console.warn(
        `⚠️ Share-Token ist ${tokenSizeKB.toFixed(1)}KB – möglicherweise zu lang für manche Browser/Services`
      );
    }

    return token;
  }

  /**
   * Importiert Board aus komprimiertem Share-Link-Token
   * Rein clientseitig – keine Backend-Anfrage nötig!
   * @param token Base64-URL komprimierter Token (z.B. von generateShareLink())
   * @param strategy 'merge' (neue IDs) oder 'overwrite' (alte IDs)
   * @returns { success: boolean; error?: string; importedBoardId?: string }
   */
  public async importFromShareLink(
    token: string,
    strategy: 'merge' | 'overwrite' = 'merge'
  ): Promise<{ success: boolean; error?: string; importedBoardId?: string }> {
    try {
      // 1. Base64-URL decode
      const normalized = token
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Padding hinzufügen falls nötig
      const pad = normalized.length % 4;
      const padded = pad ? normalized + '='.repeat(4 - pad) : normalized;

      let crushed: string;
      try {
        crushed = atob(padded);
      } catch (e) {
        throw new Error('Ungültiger Base64-URL Token');
      }

      // 2. Dekomprimiere mit jsoncrush
      let jsonString: string;
      try {
        jsonString = uncrush(crushed);
      } catch (e) {
        throw new Error(`Dekompression fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
      }

      // 3. Importiere mit Standard-Logik
      const importResult = this.importBoard(jsonString, strategy);

      if (!importResult) {
        return {
          success: false,
          error: 'Board Import fehlgeschlagen – ungültiges Format'
        };
      }

      return {
        success: true,
        importedBoardId: this.board.id
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Share-Link Import fehlgeschlagen:', message);

      return {
        success: false,
        error: message
      };
    }
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

### 1.3 SyncManager (Offline-First Queue mit Dexie)

**Datei:** `src/lib/stores/syncManager.ts` (siehe `AGENTS.md` Section VI.2)

**Verantwortlichkeiten:**

- ✅ Event Queue für Offline-Betrieb (Dexie IndexedDB)
- ✅ Online/Offline Status Detection
- ✅ Automatisches Retry mit exponentielles Backoff (2^n Sekunden)
- ✅ Dead-Letter Pattern (max 3 Retries)
- ✅ Last-Write-Wins Conflict Resolution
- ✅ Queue Analytics & Monitoring

**Persistence Layer:**

- 🗄️ **Dexie** (IndexedDB wrapper) statt `svelte-persisted-store`
- 📊 **QueuedEventRow** Schema mit Indexes: `id`, `timestamp`, `retries`, `type`, `createdAt`
- 🔄 **Exponentielles Backoff**: 2s → 4s → 8s → Dead-Letter
- ⚡ **Performance**: O(log n) Queries statt O(n) Array-Filter

**Integration in BoardStore:**

```typescript
// In BoardStore.moveCard()
public moveCard(cardId: string, fromColId: string, toColId: string) {
  this.board.moveCard(cardId, fromColId, toColId); // Lokal
  this.publishCardUpdate(cardId, toColId); // → syncManager.publishOrQueue()
}

// In BoardStore.publishCardUpdate()
private async publishCardUpdate(cardId: string, columnId: string): Promise<void> {
  const event = cardToNostrEvent(card, column.name, rank, boardRef, this.ndk);

  // ✅ Publish sofort oder Queue (persisted in Dexie)
  await this.syncManager.publishOrQueue(event, 'card');
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
const token = boardStore.generateShareLink(); // komprimiert & URL-safe

// Import
const success = boardStore.importBoard(jsonString, 'merge');

// Import aus Share-Link (clientseitig!)
const result = await boardStore.importFromShareLink(token, 'merge');
if (result.success) {
  console.log('✅ Board importiert:', result.importedBoardId);
} else {
  console.error('❌ Fehler:', result.error);
}
```

**Neu in Phase 1.5:**

- `generateShareLink()` — Komprimiert Board mit **jsoncrush** (71% kleiner als btoa!)
- `importFromShareLink()` — Dekomprimiert & importiert clientseitig (kein Backend nötig!)

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

## IV. Persistenz-Strategie mit Dexie

### 4.1 IndexedDB mit Dexie (SyncManager Event Queue)

```typescript
// src/lib/stores/syncManager.ts

import Dexie, { type Table } from 'dexie';

export interface QueuedEventRow {
  id?: number;              // Auto-increment
  timestamp: number;        // ms when queued (Index)
  retries: number;          // Retry counter (Index)
  type: 'board' | 'card' | 'comment'; // (Index)
  raw: string;              // Serialized NDKEvent.rawEvent()
  createdAt: number;        // Unix timestamp (Index)
  lastRetry?: number;       // Timestamp of last retry attempt
}

export class KanbanQueueDB extends Dexie {
  queuedEvents!: Table<QueuedEventRow>;

  constructor() {
    super('KanbanQueueDB');
    this.version(1).stores({
      // Compound + Single Indexes
      queuedEvents: '++id, timestamp, retries, type, createdAt'
    });
  }
}

const db = new KanbanQueueDB();
```

**Vorteile Dexie vs svelte-persisted-store:**

| Feature          | Dexie                             | svelte-persisted   |
| ---------------- | --------------------------------- | ------------------ |
| **Query API**    | ✅ `.where('type').equals('card')` | ❌ Array-Filter nur |
| **Indexes**      | ✅ Ja (createdAt, retries, type)   | ❌ Nein             |
| **Transactions** | ✅ Atomare Updates                 | ❌ Nein             |
| **Batch Ops**    | ✅ `.limit(50)`                    | ❌ Nein             |
| **Size Limit**   | ✅ Unbegrenzt                      | ❌ ~5MB             |
| **Performance**  | ✅ O(log n) Queries                | ❌ O(n) Array       |
| **Dead-Letter**  | ✅ Leicht                          | ❌ Manual           |

### 4.2 Session-Speicherung (AuthStore mit svelte-persisted-store)

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

### 4.3 Board Cache (NDK + Dexie)

```typescript
// Optional: Boards im IndexedDB cachen via NDK

import NDK, { NDKCacheAdapterDexie } from '@nostr-dev-kit/ndk';

const ndk = new NDK({
  explicitRelayUrls: ['wss://relay.damus.io'],
  cacheAdapter: new NDKCacheAdapterDexie() // ← Board Events cachen
});
```

### 4.4 Retry-Strategie mit Exponentielles Backoff

```typescript
// In SyncManager.syncQueue()

for (const row of queuedEvents) {
  try {
    // Publish Event
    await this.publishEvent(event);

    // Success: Remove from queue
    await db.queuedEvents.delete(row.id!);

  } catch (error) {
    // Increment retry counter
    const newRetries = (row.retries || 0) + 1;
    const maxRetries = 3;

    if (newRetries >= maxRetries) {
      // Dead-Letter: Remove after max retries
      await db.queuedEvents.delete(row.id!);
      console.error(`❌ Event failed ${maxRetries}x, removed`);
    } else {
      // Exponentielles Backoff: 2^retries Sekunden
      const backoffMs = Math.pow(2, newRetries) * 1000; // 2s, 4s, 8s
      const nextRetryTime = Date.now() + backoffMs;

      await db.queuedEvents.update(row.id!, {
        retries: newRetries,
        lastRetry: nextRetryTime
      });

      console.log(
        `⏳ Retry ${newRetries}/${maxRetries} in ${(backoffMs / 1000).toFixed(1)}s`
      );
    }

    break; // Stop-on-first-error
  }
}
```

---## V. Svelte 5 Runes Best Practices

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

| Meilenstein               | Stores                                                                 | Status         |
| ------------------------- | ---------------------------------------------------------------------- | -------------- |
| **1.1: Nostr Publishing** | BoardStore + SyncManager                                               | 🔄 IN PROGRESS |
| **1.2: Offline-First**    | SyncManager erweitert                                                  | 🟡 PLANNED     |
| **1.3: Comments**         | BoardStore.addComment()                                                | 🟡 PLANNED     |
| **1.4: Authentication**   | AuthStore Integration                                                  | 🟡 PLANNED     |
| **1.5: Export/Import**    | BoardStore.export/import() + **generateShareLink/importFromShareLink** | 🟡 PLANNED     |
| **2.1: UI Components**    | Context-basierte Komponenten                                           | ⚪ PLANNED      |

---

## XI. Share-Link Patterns (Meilenstein 1.5)

### Grundlegende Nutzung

```typescript
// 1. Share-Token generieren
const token = boardStore.generateShareLink();
console.log(`Token (${token.length} chars):`, token);
// Output: "KCxbImNvbHVtbnMiLFt7Im5hbWUiOiJUbyBEbyIsImNhcmRzIjpbXX1dXQ"

// 2. Token teilen (z.B. kopieren)
await navigator.clipboard.writeText(token);

// 3. Import aus Token
const result = await boardStore.importFromShareLink(token, 'merge');
if (result.success) {
  console.log('✅ Board importiert:', result.importedBoardId);
}
```

### UI Integration (Export/Import Dialog)

```svelte
<!-- Beispiel: ExportImportDialog.svelte -->
<script lang="ts">
  import { boardStore } from '$lib/stores/kanbanStore';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import UploadIcon from '@lucide/svelte/icons/upload';

  let shareToken = $state('');
  let importInput = $state('');
  let loading = $state(false);

  async function copyToken() {
    const token = boardStore.generateShareLink();
    await navigator.clipboard.writeText(token);
    shareToken = token;
  }

  async function importToken() {
    loading = true;
    const result = await boardStore.importFromShareLink(importInput, 'merge');
    if (result.success) {
      console.log('✅ Board importiert');
      importInput = '';
    } else {
      console.error('❌', result.error);
    }
    loading = false;
  }
</script>

<Dialog.Root>
  <Dialog.Trigger asChild let:builder>
    <Button builders={[builder]} variant="outline">
      <DownloadIcon class="mr-2 h-4 w-4" />
      Export / Share
    </Button>
  </Dialog.Trigger>

  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Board exportieren & teilen</Dialog.Title>
    </Dialog.Header>

    <!-- Export Tab -->
    <div class="space-y-4">
      <div>
        <h3 class="font-semibold mb-2">Share-Link (komprimiert)</h3>
        <div class="flex gap-2">
          <Textarea 
            value={shareToken} 
            readonly 
            placeholder="Click 'Copy Token' um zu generieren"
            class="flex-1 font-mono text-xs"
          />
          <Button onclick={copyToken} size="sm">
            <CopyIcon class="h-4 w-4" />
          </Button>
        </div>
        <p class="text-xs text-muted-foreground mt-1">
          {shareToken.length} Zeichen (URL-sicher für Sharing)
        </p>
      </div>

      <div>
        <Button onclick={() => boardStore.downloadBoardAsJSON()} variant="outline" class="w-full">
          <DownloadIcon class="mr-2 h-4 w-4" />
          Als JSON herunterladen
        </Button>
      </div>
    </div>

    <!-- Import Tab -->
    <div class="space-y-4 border-t pt-4">
      <div>
        <h3 class="font-semibold mb-2">Board importieren</h3>
        <Textarea 
          bind:value={importInput}
          placeholder="Share-Token oder JSON einfügen..."
          class="font-mono text-xs"
          rows={4}
        />
      </div>

      <Button 
        onclick={importToken}
        disabled={!importInput || loading}
        class="w-full"
      >
        <UploadIcon class="mr-2 h-4 w-4" />
        {loading ? 'Importieren...' : 'Importieren'}
      </Button>
    </div>

    <Dialog.Footer>
      <Dialog.Close asChild let:builder>
        <Button builders={[builder]} variant="outline">Schließen</Button>
      </Dialog.Close>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### QR-Code Integration (optional)

```typescript
import QRCode from 'qrcode';

async function generateQRCode() {
  const token = boardStore.generateShareLink();
  const qrUrl = await QRCode.toDataURL(token);

  // Anzeigen oder herunterladen
  const img = document.createElement('img');
  img.src = qrUrl;
  document.body.appendChild(img);
}
```

### Size-Vergleich

| Format        | Größe (5 Spalten, 20 Karten) | Kompression       |
| ------------- | ---------------------------- | ----------------- |
| Raw JSON      | ~8.5 KB                      | 0%                |
| btoa() Base64 | ~11.3 KB                     | -33% (größer!)    |
| **jsoncrush** | ~2.4 KB                      | **71% kleiner** ✅ |

### 🔐 Datenschutz

- ✅ **Rein clientseitig** – Keine Server-Kommunikation
- ✅ **Offline-ready** – Funktioniert ohne Internet
- ✅ **Komprimiert** – Kurze URLs für Sharing
- ✅ **URL-safe** – Base64-URL Encoding (- _ statt + /)
- ✅ **Kein Backend** – Kein Account nötig zum Teilen

### Installation

```bash
pnpm add jsoncrush
pnpm add -D @types/jsoncrush
```

---

## XII. Dokumentation Links

- **[AGENTS.md](./AGENTS.md)** – BoardModel.ts, Chat.ts Spezifikation
- **[NDK.md](./NDK.md)** – NDK Initialisierung & Event API
- **[NOSTR-USER.md](./NOSTR-USER.md)** – AuthStore & Signer Integration
- **[ROADMAP.md](./ROADMAP.md)** – Meilensteine 1.1 – 1.5

---

**Zuletzt aktualisiert:** 18. Oktober 2025  
**Nächster Review:** Nach Implementierung von Meilenstein 1.1
