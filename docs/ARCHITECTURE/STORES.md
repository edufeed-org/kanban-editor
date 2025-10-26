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
// ❌ FALSCH: kanbanStore.ts (funktioniert NICHT)
export class BoardStore {
    private board = $state(...); // ← Compiler-Fehler: $ is not defined!
}

// ✅ RICHTIG: kanbanStore.svelte.ts (funktioniert)
export class BoardStore {
    private board = $state(...); // ← OK!
    public uiData = $derived.by(...); // ← OK!
}
```

**Betroffene Stores:**
- ✅ **kanbanStore.svelte.ts** — Bereits konvertiert (BoardStore mit `$state`, `$derived`)
- ✅ **settingsStore.svelte.ts** — Vollständig konvertiert! (Svelte 5 Runes, 20 Settings)
- ✅ **authStore.svelte.ts** — Vollständig implementiert! (Dummy + NIP-07 Ready)
- ⏳ **syncManager.svelte.ts** — Noch zu erstellen (Offline-First Queue)

### ⭐ WICHTIG: Die Reaktivitätskette (triggerUpdate → $derived → $effect)

**Dies ist der Schlüssel zur Svelte 5 Reaktivität:**

```
Nutzer-Action (z.B. Karte erstellt)
    ↓
boardStore.createCard() [Store-Methode]
    ↓
board.findColumn().addCard() [Model-Layer, keine Reaktivität nötig]
    ↓
this.triggerUpdate() [CRITICAL! - Increment updateTrigger]
    ↓
updateTrigger++ [$state wird aktualisiert]
    ↓
uiData $derived.by() [Dependency tracking: updateTrigger wurde gelesen!]
    ↓
uiData wird NEU berechnet [Transformiert Board → UIColumn[]]
    ↓
Column.svelte $effect detects change [$effect liest boardStore.uiData]
    ↓
items Prop wird gesetzt [parent prop update]
    ↓
Card.svelte re-renders [component subscribed zu items Prop]
    ↓
UI zeigt neue Karte ✅
```

**Kritische Punkte:**

1. ❌ **triggerUpdate() vergessen** → `updateTrigger` nicht aktualisiert → `$derived` wird nicht neu berechnet → `$effect` wird nicht getriggert → UI zeigt alte Daten
2. ❌ **Board direkt mutieren** (z.B. `board.addColumn()` ohne Store) → Keine Reaktivität → UI zeigt nichts
3. ✅ **Board.addColumn()** IMMER über Store-Methode aufrufen → `triggerUpdate()` automatisch
4. ✅ **Array-Reassignments** nutzen (z.B. `this.cards = [...this.cards, card]`) → Trigger Dependency Tracking

### 📖 ANLEITUNG: Dynamische Prop-Änderungen

**Wenn du willst, dass der Nutzer eine Eigenschaft (z.B. Spalten-Name) in der UI ändern kann:**

👉 **Lies:** [PROP-UPDATE-GUIDE.md](./PROP-UPDATE-GUIDE.md) (5-Schritt Anleitung mit Beispielen)

Diese Anleitung erklärt:
1. Store-Methode erstellen (`updateColumn()`, `updateCard()`, etc.)
2. Component Handler implementieren (z.B. `handleRename()`)
3. `$effect` für UI-Sync hinzufügen (automatische Reaktivität)
4. Model-Update-Methode nutzen (`column.update()`)
5. `triggerUpdate()` wird automatisch aufgerufen
6. localStorage wird automatisch gespeichert

**Praktisches Beispiel:** Spalten-Name ändern im Popover → sofort sichtbar im Board → bleibt nach Reload erhalten ✅

**WARNUNG:** Nicht vergessen - wenn `triggerUpdate()` nicht aufgerufen wird:
- 🔴 Daten nicht im localStorage gespeichert
- 🔴 UI zeigt alte Daten
- 🔴 Nach Reload sind Änderungen weg!

---

## III. Alle Stores sind Reaktiv! (AuthStore, BoardStore, SettingsStore)

### ⭐ WICHTIG: Unterschied ist NICHT Reaktivität sondern Persistierungs-Strategie

**Alle 3 Stores nutzen `$state` Runes → ALLE reaktiv!**

```typescript
// Alle 3 Stores speichern zu localStorage via persisted():

// 1. AuthStore - für Session (persisted() wrapper)
export class AuthStore {
    private sessionStore = persisted<UserSession | null>(
        'nostr-user-session',
        null
    );
    
    public currentUser = $state<NDKUser | null>(null);
    public isAuthenticated = $derived(!!this.currentUser);
}

// 2. BoardStore - für Boards (komplexes Modell)
export class BoardStore {
    private board = $state(this.loadFromStorage());
    private _columnOrder = $state<string[]>([...]);
    private updateTrigger = $state(0);
    
    public uiData = $derived.by(() => {
        this.updateTrigger;  // ← Dependency Tracking
        // Transform board zu UI-Format
    });
    
    private triggerUpdate() {
        this.updateTrigger++;
        this.saveToStorage();  // ← Persistierung
    }
}

// 3. SettingsStore - für Config (statisch)
export class SettingsStore {
    private settings = $state(this.loadFromStorage());
    private derived = $derived(computeDefaults(this.settings));
    
    public save() {
        this.saveToStorage();
    }
}
```

### Vergleich: Reaktivität vs Persistierung

| Store | Reaktivität | Persistierung | Größe | Komplexität |
|-------|-------------|---------------|-------|-------------|
| **AuthStore** | ✅ $state | persisted() | Klein (Session) | Minimal |
| **BoardStore** | ✅ $state + $derived | persisted() | Groß (komplexes Modell) | Hoch |
| **SettingsStore** | ✅ $state | persisted() | Klein (Config) | Minimal |

**Wichtig:** Alle 3 sind REAKTIV! Die Unterschiede sind nur in Use-Case und Komplexität.

---

## IV. Design Pattern für neue Stores

**Wenn neue Stores hinzukommen, folge diesem Pattern:**

```typescript
export class MyNewStore {
    // 1. Persistierte State (localStorage via persisted())
    private persistedValue = persisted<MyType>(
        'localstorage-key',
        defaultValue
    );
    
    // 2. Reaktive State ($state Rune)
    private data = $state(this.loadFromPersisted());
    
    // 3. Computed Values ($derived Rune für Read-Only)
    private derived = $derived(this.computeValue());
    
    // 4. Update Methods (mit Persistierung)
    public update(newValue: Partial<MyType>) {
        this.data = { ...this.data, ...newValue };  // ← Reassignment!
        this.saveToPersisted();                     // ← Persistierung
    }
    
    private loadFromPersisted(): MyType {
        // get() für Lesezugriff
        return get(this.persistedValue) || defaultValue;
    }
    
    private saveToPersisted() {
        this.persistedValue.set(this.data);
    }
}
```

**Kritische Punkte:**
- ✅ Nutze `persisted()` für automatische localStorage-Sync
- ✅ `$state` für mutable Daten
- ✅ `$derived` für Read-Only berechnete Werte
- ✅ Reassignments statt Mutationen (`this.data = {...}`)
- ✅ `get()` aus `svelte/store` für externe Zugriffe

`
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
            localStorage.setItem('CURRENT_KANBAN_BOARD_STORAGE_ID', JSON.stringify(data));
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
            const stored = localStorage.getItem('CURRENT_KANBAN_BOARD_STORAGE_ID');
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
### boardStore-API für Zustandsänderungen und Publishing
1. Eine Methode wie addCard wird von der UI aufgerufen, um eine Zustandsänderung zu initiieren.
2. Die Methode ändert den internen Board-Zustand (z.B. fügt eine Karte hinzu).
3. Nach der Zustandsänderung wird publishBoardUpdate() aufgerufen, um die Änderung zu Nostr zu veröffentlichen.
```typescript

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

  // ──────────────────────────────────────────
  // SNAPSHOT-MANAGEMENT (Phase 2)
  // Siehe: docs/PROPOSALS/BOARD-VERSIONING.md
  // ──────────────────────────────────────────

  /**
   * Erstellt manuellen Snapshot des aktuellen Boards
   * Publiziert Kind 30303 Event zu Nostr
   * 
   * @param label User-Beschreibung (z.B. "Sprint-3 Planning")
   * @throws Error wenn Publikation fehlschlägt
   */
  public async createManualSnapshot(label: string): Promise<void> {
    const snapshotEvent = new NDKEvent(this.ndk);
    snapshotEvent.kind = 30303;
    snapshotEvent.tags = [
      ["a", `30301:${this.board.author}:${this.board.id}`],
      ["v", label],  // User-Label (nicht numerische Version!)
      ["r", "manual"],  // Manually created
      ["t", Math.floor(Date.now() / 1000).toString()]
    ];
    
    // Komplettes Board-JSON im Content
    snapshotEvent.content = JSON.stringify(
      this.board.getContextData(true)  // true = include all cards
    );
    
    await this.syncManager.publishOrQueue(snapshotEvent, 'snapshot');
    console.log(`✅ Snapshot erstellt: "${label}"`);
  }

  /**
   * Lädt alle Snapshots für dieses Board
   * 
   * @returns Array von Snapshots, sortiert nach Zeitstempel (neueste zuerst)
   */
  public async loadSnapshots(): Promise<Array<{
    label: string;
    timestamp: number;
    author: string;
    event: NDKEvent;
  }>> {
    const snapshots = await this.ndk.fetchEvents({
      kinds: [30303],
      "#a": [`30301:${this.board.author}:${this.board.id}`]
    });
    
    return Array.from(snapshots)
      .map(event => {
        const vTag = event.tags.find(t => t[0] === 'v')?.[1] || 'Unnamed';
        return {
          label: vTag,
          timestamp: event.created_at || 0,
          author: event.pubkey,
          event
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);  // Newest first
  }

  /**
   * Stellt Board zu einem Snapshot wieder her (Rollback)
   * 
   * @param snapshotLabel Label des wiederherzustellenden Snapshots
   * @throws Error wenn Snapshot nicht gefunden wird
   */
  public async rollbackToSnapshot(snapshotLabel: string): Promise<void> {
    const snapshots = await this.ndk.fetchEvents({
      kinds: [30303],
      "#a": [`30301:${this.board.author}:${this.board.id}`],
      "#v": [snapshotLabel]
    });
    
    const snapshot = Array.from(snapshots)[0];
    if (!snapshot) {
      throw new Error(`Snapshot "${snapshotLabel}" nicht gefunden`);
    }
    
    // Board aus Snapshot-JSON rekonstruieren
    const boardData = JSON.parse(snapshot.content);
    this.board = this.reconstructBoard(boardData);
    
    // Lokal persistieren
    this.triggerUpdate();
    
    console.log(`✅ Board wiederhergestellt zu: "${snapshotLabel}"`);
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

### 1.2 AuthStore (Authentifizierung) ✅ PRODUCTION READY

**Datei:** `src/lib/stores/authStore.svelte.ts` (Svelte 5 Runes)

**Status:** ✅ Production Ready (Phase 1.4)

**Implementierung:** BASICS Pattern für Development + NIP-07 Vorbereitung

**Verantwortlichkeiten:**

- ✅ Benutzer-Session verwalten ($state reaktiv)
- ✅ Dummy-User für Development (`loginWithDummy()`)
- ✅ Private Key Support für Development (`loginWithNsec()`)
- ⏳ NIP-07 Browser Extensions (TODO: NDK Integration)
- ✅ Authentifizierungsstatus prüfen ($derived)
- ✅ localStorage Persistierung (SSR-safe)
- ✅ Session-Restore bei App-Start

**Integration mit BoardStore:**

```typescript
// In kanbanStore.svelte.ts
import { authStore } from '$lib/stores/authStore.svelte';

public createCard(columnId: string, name: string): string {
    // ✅ Auto-Author vom AuthStore
    const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
    
    const cardProps: CardProps = {
        heading: name,
        author: author  // ← Automatisch gesetzt!
    };
    // ...
}

public createBoard(name: string): string {
    // ✅ Board-Author auch automatisch
    const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
    // ...
}
```

**API Methods (alle synchron!):**

```typescript
// Login Methoden (alle async)
await authStore.loginWithDummy(name?: string): Promise<boolean>
await authStore.loginWithNsec(nsec: string, name?: string): Promise<boolean>
await authStore.loginWithNIP07(): Promise<boolean>  // TODO: Integration

// Getters (synchron)
authStore.getPubkey(): string | null           // Hex format
authStore.getNpub(): string | null             // Bech32 format
authStore.getUserName(): string | null         // Display name

// Session Management
authStore.logout(): void                        // Clear session
authStore.getStatus(): AuthStatus              // Full status object

// Reactive State ($state)
authStore.currentUser = UserSession | null     // Current session
authStore.isAuthenticated = boolean ($derived) // Auto-computed
authStore.isLoading = boolean ($state)         // Login in progress
authStore.errorMessage = string | null ($state) // Error context
```

**Datentypen:**

```typescript
export type SignerType = 'development' | 'nip07' | 'nip46';

export interface UserSession {
  pubkey: string;      // Hex Public Key (64 chars)
  npub: string;        // Bech32 encoded npub
  name: string;        // Display Name
  signerType: SignerType;
  createdAt: number;   // Timestamp
}
```

**localStorage Format:**

```json
{
  "kanban-auth-session": {
    "pubkey": "0000000000000000000000000000000000000000000000000000000000000001",
    "npub": "npub1dev00000000000000000000000000000000000000000000000000000000",
    "name": "Dev User",
    "signerType": "development",
    "createdAt": 1729691825598
  }
}
```

**Verwendung in Komponenten:**

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/authStore.svelte';
  
  // Reactive values
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let userName = $derived(authStore.getUserName());
  let pubkey = $derived(authStore.getPubkey());
  
  async function handleLogin() {
    await authStore.loginWithDummy('Alice');
    // → currentUser wird gesetzt, localStorage speichert Session
    // → Alle $derived Werte updaten automatisch!
  }
</script>

{#if isAuthenticated}
  <p>Hallo, {userName}!</p>
  <button onclick={() => authStore.logout()}>Logout</button>
{:else}
  <button onclick={handleLogin}>Login</button>
{/if}
```

**⚠️ SSR-Safety (automatisch gehandelt!):**

```typescript
// AuthStore checkt automatisch typeof window !== 'undefined'
private restoreSession(): void {
  if (typeof window === 'undefined') {
    console.debug('⏭️ Skipping restoreSession on SSR server');
    return;  // ← Kein localStorage-Zugriff auf Server!
  }
  
  try {
    const stored = localStorage.getItem(AuthStore.STORAGE_KEY);
    // ... restore logic
  } catch (error) { /* ... */ }
}
```

**Author-Attribution Pattern (KRITISCH!):**

Der `boardStore` nutzt AuthStore automatisch für Card/Board-Author:

```typescript
// boardStore.createCard() - Fallback Chain
const author = 
  authStore.getUserName()      // 1. Best: Display Name
  || authStore.getPubkey()     // 2. Fallback: Hex pubkey
  || 'anonymous';              // 3. Last resort

// Resultat im localStorage
{
  "id": "card-123",
  "heading": "Aufgabe",
  "author": "Dev User"  // ← Auto gesetzt vom authStore!
}
```

**Roadmap:**

| Phase | Feature | Status | Deadline |
|-------|---------|--------|----------|
| 1.4 | Dummy Login + Development | ✅ Done | Okt 2025 |
| 2.1 | NIP-07 Integration | 🟡 TODO | Nov 2025 |
| 2.2 | NIP-46 Remote Signers | ⏳ Planned | Dez 2025 |
| 3.1 | Team Management | 📋 Backlog | 2026 |

**Weitere Dokumentation:**
- **[AUTHSTORE-BASICS.md](../GUIDES/AUTHSTORE-BASICS.md)** — Anfänger-freundliche Erklärung
- **[AUTHSTORE-INTEGRATION-GUIDE.md](../GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md)** — Praktische Integration
- **[NOSTR-USER.md](./NOSTR-USER.md)** — Vollständige Spezifikation mit NIP-07/46
- **copilot-instructions.md** — Best Practices für AI-Agenten

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

- [x] **AuthStore** implementiert ✅ (NOSTR-USER.md)
  
  - [x] User-Session Management
  - [x] Dummy-User für Development
  - [x] localStorage Persistierung (SSR-safe)
  - [x] isAuthenticated Getter ($derived)
  - [ ] NIP-07 Signer Integration (Phase 2.1)
  - [ ] NIP-46 Remote Signers (Phase 2.2)

- [x] **SettingsStore** implementiert ✅ (SETTINGSSTORE.md + SETTINGSSTORE-IMPLEMENTATION.md)
  
  - [x] UI/UX Settings (maxCards, columnWidth, theme)
  - [x] localStorage Persistierung (SSR-safe)
  - [x] Nostr Relay Configuration
  - [x] LLM Model Settings (OpenAI-kompatible APIs)
  - [x] MCP Server URLs
  - [x] Board/Card Default States
  - [x] Sidebar Visibility
  - [x] $derived für berechnete Werte (isDarkMode, isLlmConfigured)
  - [x] Batch Operations (Export/Import/Reset)

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

## XII. Board Metadata Persistierung (NEU - Phase 1 ✅)

### 📋 Metadata-Felder im Board-Modell

Die `BoardProps` Schnittstelle unterstützt jetzt erweiterte Metadaten:

```typescript
export interface BoardProps {
    id?: string;
    name: string;
    description?: string;
    columns?: ColumnProps[];
    publishState?: PublishState;
    author?: string;
    tags?: string[];           // ← NEW: Array von Tags
    ccLicense?: string;        // ← NEW: CC Lizenz-Typ
}
```

**Neue Felder:**
- **`tags: string[]`** – Array von Tag-Strings zur Board-Kategorisierung
  - Beispiel: `["frontend", "design", "priorität-hoch"]`
  - Persistiert als JSON-Array in localStorage
  - Im Topbar-Dialog als komma-getrennte Eingabe dargestellt
  
- **`ccLicense: string`** – Creative Commons Lizenz für Board-Inhalte
  - Optionen: `'cc-by-4.0'`, `'cc-by-nc-4.0'`, `'cc-by-sa-4.0'`, etc.
  - Standard: `'cc-by-4.0'` (Attribution erforderlich, kommerzielle Nutzung erlaubt)
  - Zukünftig: Nostr-Event Tags für License-Sharing

### 🔄 Persistierungs-Flow (updateCurrentBoardMeta)

```
Topbar Dialog (Nutzer ändert Tags/License)
    ↓
saveBoardMeta() [Form Handler]
    ├─ Parse tags: "tag1, tag2" → ["tag1", "tag2"]
    └─ Call boardStore.updateCurrentBoardMeta({ tags, ccLicense })
    ↓
boardStore.updateCurrentBoardMeta(updates)
    ├─ this.board.update(updates) [Model update mit updatedAt]
    └─ this.triggerUpdate() [→ localStorage + publishToNostr()]
    ↓
localStorage.setItem('kanban-${boardId}', JSON.stringify(boardData))
    ├─ { id, name, description, tags, ccLicense, publishState, ... }
    └─ ✅ Persisted sofort & synchron
    ↓
$derived boardStore.boardMeta [Re-berechnung]
    └─ $effect in Topbar detects changes [Dialog zeigt neue Werte]
    ↓
UI aktualisiert sich automatisch ✅
```

### 📝 Topbar Form Integration

**Form-Felder in `metaForm`:**
```typescript
let metaForm = $state({
    title: boardMeta?.title || 'Mein Projekt Board',
    description: boardMeta?.description || '',
    tags: boardMeta?.tags?.join(', ') || '',                    // ← NEW: Join tags for display
    license: 'cc-by-4.0',                                       // ← NEW: CC License selector
    publishState: 'draft' as 'draft' | 'published' | 'archived'
});
```

**Form Handler (saveBoardMeta) - Persistiert alle Metadaten:**
```typescript
function saveBoardMeta() {
    // Parse tags from comma-separated string to array
    const tagsArray = metaForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    
    // Call store with ALL metadata
    boardStore.updateCurrentBoardMeta({
        name: metaForm.title,
        description: metaForm.description,
        tags: tagsArray,                    // ← NEW
        ccLicense: metaForm.license         // ← NEW
    });
    
    boardStore.setPublishState(metaForm.publishState);
    
    // Dialog closes, UI syncs automatically via $effect
    dialogOpen = false;
}
```

**Form Sync (beim Dialog öffnen) - Lädt aktuelle Werte:**
```typescript
$effect(() => {
    if (dialogOpen) {
        metaForm.title = currentBoardTitle;
        metaForm.description = currentBoardDescription;
        metaForm.tags = boardStore.data?.tags?.join(', ') || '';      // ← NEW: Reload tags
        metaForm.license = boardStore.data?.ccLicense || 'cc-by-4.0'; // ← NEW: Reload license
        metaForm.publishState = currentBoardPublishState;
    }
});
```

### 💾 localStorage Schema

```json
{
  "kanban-board-41815b6f...": {
    "id": "board-41815b6f5921aef...",
    "name": "Frontend Development",
    "description": "Sprint Q4 2025",
    "tags": ["frontend", "ui-components", "priority-high"],       // ← NEW: Gespeichert als Array
    "ccLicense": "cc-by-4.0",                                     // ← NEW: Lizenz-Typ
    "publishState": "published",
    "columns": [...],
    "updatedAt": "2025-10-20T15:30:45.123Z"
  }
}
```

### 🔗 BoardStore API

**Neue/Erweiterte Methoden:**

```typescript
// Aktualisiere ALLE Board-Metadaten (Name, Description, Tags, License)
boardStore.updateCurrentBoardMeta({
    name?: string;
    description?: string;
    tags?: string[];        // ← NEW
    ccLicense?: string;     // ← NEW
}): void

// Zugriff auf aktuelle Metadaten über $derived
boardStore.boardMeta = $derived({
    name: string;
    description: string;
    tags: string[];         // ← NEW
    ccLicense: string;      // ← NEW
})

// RawBoard-Daten mit allen Feldern
boardStore.data = $derived({
    id: string;
    name: string;
    description: string;
    tags: string[];         // ← NEW
    ccLicense: string;      // ← NEW
    publishState: PublishState;
    columns: Column[];
    updatedAt: string;
})
```

### ✅ Implementierungs-Checkliste

- ✅ **BoardProps Interface** – `tags` und `ccLicense` hinzugefügt (AGENTS.md, BoardModel.ts)
- ✅ **Board Class** – Felder initialisiert mit Defaults (tags=[], ccLicense='cc-by-4.0')
- ✅ **Board.update()** – Beide Felder werden aktualisiert & `updatedAt` gesetzt
- ✅ **boardStore.updateCurrentBoardMeta()** – Signature erweitert, neue Parameter akzeptiert
- ✅ **Topbar saveBoardMeta()** – Parst tags & übergibt beide an Store
- ✅ **Topbar $effect** – Sync-Logik für beide Felder beim Dialog öffnen
- ✅ **localStorage** – Persisterung automatisch via `triggerUpdate()`
- 🟡 **Optional: UI-Display** – Tags als Badges in BoardsList anzeigen (Future)
- 🟡 **Optional: License Info** – Badge im Board-Header anzeigen (Future)

---

## 📚 Verwandte Dokumentation

- **[BOARD-VERSIONING.md](../COLLABORATION/BOARD-VERSIONING.md)** — Manual Snapshots & Versioning (Kind 30303)
- **[MERGE-SYSTEM.md](../FEATURE/MERGE-SYSTEM.md)** — Conflict Detection & 3-Way Merge Resolution
- **[Kanban-NIP.md](../GUIDES/Kanban-NIP.md)** — Event Kinds & Tags (30301, 30302, 30303, 20001)
- **[NDK.md](./NDK.md)** — Nostr Development Kit Integration
- **[REACTIVITY.md](./REACTIVITY.md)** — Svelte 5 Runes & Verification Checklist

## XIII. Dokumentation Links

**Zuletzt aktualisiert:** 26. Oktober 2025  
**Nächster Review:** Nach Implementierung von Phase 2 (Conflict Resolution)
