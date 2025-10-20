# Multi-Layer Storage Architektur

## 🏗️ Architektur-Übersicht: Multi-Layer Storage

Das System ist als **3-schichtige Architektur** konzipiert:

```
┌─────────────────────────────────────────────────────────┐
│  1. UI Layer (Svelte 5 Components)                      │
│  └─ Liest: boardStore.uiData ($derived)                 │
│     Column.svelte: $effect synchronisiert automatisch   │
└─────────────────────────────────────────────────────────┘
                           ↕ (Reactive Updates)
┌─────────────────────────────────────────────────────────┐
│  2. Application Layer (BoardStore - Single Source)      │
│  ├─ board = $state(Board-Instance) ← CENTRAL STATE      │
│  ├─ _columnOrder = $state (immutable column ordering)   │
│  ├─ updateTrigger = $state (reactivity trigger)         │
│  ├─ uiData = $derived.by (reactive UI transformation)   │
│  ├─ triggerUpdate() → saveToStorage() synchron          │
│  ├─ syncBoardState() → atomic column+card persistence   │
│  ├─ publishToNostr() → Nostr Events (async)             │
│  └─ $effect guards (isDragging) → prevents loops        │
└─────────────────────────────────────────────────────────┘
                    ↙         ↓         ↘
        ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
        │ 3a. Nostr    │ │ 3b. Sync     │ │ 3c. localStorage │
        │ Events       │ │ Queue        │ │ Cache            │
        │ (30301/30302)│ │ (IndexedDB)  │ │ (Immediate)      │
        └──────────────┘ └──────────────┘ └──────────────────┘
```

## 🎯 **Svelte 5 Runes Paradigma (WICHTIG!)**

### **Warum `.svelte.ts` statt `.ts`?**

Ab Svelte 5 müssen Stores, die **reactive state** haben, mit Runes implementiert werden:

```typescript
// ❌ FALSCH (alte Svelte 4 writable pattern):
import { writable } from 'svelte/store';
export const boardStore = writable(new Board());

// ✅ RICHTIG (Svelte 5 Runes):
export class BoardStore {
    private board = $state(new Board()); // ← Rune!
    public uiData = $derived.by(() => { ... }); // ← Rune!
}
```

**Grund**: Svelte 5 Runes (`$state`, `$derived`, `$effect`) funktionieren nur in `.svelte.ts` Dateien, wo der Compiler sie transformieren kann.

**Praktische Anwendung:** [PROP-UPDATE-GUIDE.md](./PROP-UPDATE-GUIDE.md) erklärt wie man damit dynamische Prop-Änderungen in der UI implementiert ⭐

**Konsequenz**: Alle Stores mit reaktiven Daten müssen zu `.svelte.ts` konvertiert werden!

## 📊 Datenfluss-Strategien

### 1. **BoardStore = Single Source of Truth** (Svelte 5 Runes)

```typescript
// src/lib/stores/kanbanStore.svelte.ts (NEU!)

export class BoardStore {
    // ← DAS ist der einzige "echte" Zustand (Rune)
    private board = $state(new Board({ /* ... */ }));
    
    // ← Immutable column ordering für DnD safety
    private _columnOrder = $state<string[]>([...]);
    
    // ← Trigger für Reaktivität
    private updateTrigger = $state(0);
    
    // ← Berechneter Wert (automatisch reaktiv!)
    public uiData = $derived.by(() => {
        // Nutzt updateTrigger + _columnOrder für Tracking
        this.updateTrigger;
        this._columnOrder;
        // Transformiere board.columns zu UI-Format
        return uiColumns;
    });

    // Alle Änderungen gehen durch diese zentrale Methode:
    public syncBoardState(uiColumns: UIColumn[]): void {
        // 1. Update _columnOrder (immutable)
        this._columnOrder = uiColumns.map(c => c.id);
        
        // 2. Reorder board.columns (für persistence)
        // ... 
        
        // 3. Sync card positions
        // ...
        
        // 4. Trigger updates
        this.triggerUpdate(); // → saveToStorage() → localStorage
        this.publishToNostr(); // → Nostr Events (async)
    }
    
    private triggerUpdate() {
        this.updateTrigger++;
        this.saveToStorage(); // Synchron!
    }
}

// Globale Instanz (nicht writable!)
export const boardStore = new BoardStore();
```

### 2. **Array-Mutationen = Reassignments (Kritisch!)**

```typescript
// ❌ FALSCH (Svelte 5 erkennt es nicht):
this.cards.push(newCard);
this.comments.push(comment);

// ✅ RICHTIG (Svelte 5 tracking):
this.cards = [...this.cards, newCard];
this.comments = [...this.comments, comment];
```

**Grund**: Svelte 5 Runes überwachen nur **Reassignments**, nicht **Mutationen**.

**Implementiert in**:
- `BoardModel.ts`: `Column.addCard()`, `Card.addComment()`, `Board.addColumn()`, etc.
- `kanbanStore.svelte.ts`: Alle Array-Operationen

### 3. **UI-Komponenten Synchronisation (Svelte 5)**

```svelte
<!-- Column.svelte - NEU! -->
<script lang="ts">
    // $effect triggert automatisch, wenn boardStore.uiData sich ändert
    $effect(() => {
        const uiColumns = boardStore.uiData; // ← Dependency tracking
        
        const updatedColumn = uiColumns.find(c => c.id === columnId);
        if (updatedColumn && itemsChanged(updatedColumn.items, items)) {
            items = updatedColumn.items; // ← Prop update
        }
    });
</script>
```

**Ablauf**:
1. User bearbeitet Karte in CardDialog
2. `handleEditSave()` → `boardStore.editCard()`
3. `editCard()` → `updateCard()` → `triggerUpdate()`
4. `triggerUpdate()` inkrementiert `updateTrigger`
5. `uiData` $derived wird neu berechnet (weil `updateTrigger` changed)
6. `Column.svelte` $effect bemerkt `boardStore.uiData` update
7. `items` Prop wird aktualisiert
8. `Card.svelte` re-rendert mit neuen Werten ✅

## 📋 localStorage = Schneller Fallback (synchron!)

```typescript
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
    const stored = localStorage.getItem('kanban-board-data');
    if (stored) {
        const data = JSON.parse(stored);
        return this.reconstructBoard(data);
    }
    return this.createDefaultBoard();
}
```

**Wichtig**: localStorage wird **synchron** bei jedem `triggerUpdate()` aufgerufen - das ist schnell genug, weil es nur ~10KB Daten sind.

## 🔄 Nostr Events = Dezentrale Wahrheit (async)

```typescript
private publishToNostr(): void {
    // Hier würde die tatsächliche Nostr-Publikation erfolgen
    // Momentan: Stub für zukünftige Implementation
    console.log('Publishing board state to Nostr...', this.board.getContextData(true));
    
    // Wird später erweitert um:
    // - boardToNostrEvent() → Kind 30301
    // - cardToNostrEvent() → Kind 30302
    // - createCommentEvent() → Kind 1
    // - SyncManager.publishOrQueue()
}
```

## 🗂️ Stores Übersicht & Conversion Status

| Store | Datei | Typ | Status | Grund |
|-------|-------|-----|--------|-------|
| **BoardStore** | `kanbanStore.svelte.ts` | Svelte 5 Runes | ✅ Konvertiert | Reactive state mit `$state`, `$derived`, `$effect` |
| **SettingsStore** | `settingsStore.ts` | Writable (alt) | 🟡 MUSS konvertiert | Hat reactive state, sollte Runes nutzen |
| **AuthStore** | N/A | - | ⏳ Zu erstellen | Wird benötigt für Nostr User Management |
| **SyncManager** | `syncManager.ts` | Class | ⏳ Zu erstellen | Event Queue, Offline-First Logic |

### **settingsStore Konversion Planung**

```typescript
// ❌ ALT: settingsStore.ts (Svelte 4 writable)
export const settingsStore = writable<SettingsState>(defaults);

// ✅ NEU: settingsStore.svelte.ts (Svelte 5 Runes)
export class SettingsStore {
    private settings = $state<SettingsState>(defaults);
    
    public get data() {
        return this.settings;
    }
    
    public setMaxCardsBeforeScroll(value: number) {
        this.settings.maxCardsBeforeScroll = value;
        this.saveToStorage();
    }
}

export const settingsStore = new SettingsStore();

// In Komponenten:
let settings = $derived(settingsStore.data);
```

## 🔐 Fehler-Handling & Guardians

### **isDragging Flag** (prevents $effect loops)

```typescript
// Board.svelte
let isDragging = $state(false);

$effect(() => {
    // Nur wenn NICHT dragging: synchronisiere Spalten-Reihenfolge
    if (!isDragging) {
        // ... Spalten-Reordering Logic
    }
});

function handleDndConsider() {
    isDragging = true; // Pause updates
    columns = e.detail.items;
}

function handleDndFinalize() {
    isDragging = false; // Resume updates
    // ... finalization
}
```

**Grund**: Ohne `isDragging` würde `$effect` während DnD ständig triggern und Spalten zurücksetzen.

## 🗂️ Event Queue (Offline-First - FUTURE)

```typescript
// src/lib/stores/syncManager.ts (Noch zu implementieren!)

export class SyncManager {
    // IndexedDB Queue für Offline-Events
    private eventQueue = $state<QueuedEvent[]>([]);
    
    async publishOrQueue(event: NDKEvent, type: 'board' | 'card' | 'comment') {
        if (navigator.onLine) {
            try {
                await this.publishEvent(event);
            } catch (error) {
                this.queueEvent(event, type);
            }
        } else {
            this.queueEvent(event, type);
        }
    }
    
    async syncQueue() {
        // Wenn Online: Queue abarbeiten
    }
}
```

## 📝 Konkrete Schritte

### **Phase 1 ✅ (ABGESCHLOSSEN)**
- ✅ BoardStore zu `.svelte.ts` mit Runes konvertiert
- ✅ Array-Mutationen zu Reassignments in BoardModel.ts
- ✅ Column.svelte `$effect` für Auto-Sync implementiert
- ✅ Neue Karten sofort sichtbar + Updates sofort sichtbar
- ✅ localStorage Persistence funktioniert

### **Phase 2** (NÄCHSTE SCHRITTE)
- [ ] settingsStore zu `.svelte.ts` konvertieren
- [ ] AuthStore neu erstellen (`.svelte.ts` mit Nostr User)
- [ ] SyncManager implementieren (IndexedDB Queue)
- [ ] nostrEvents.ts Event Serialization
- [ ] Nostr Integration in BoardStore

### **Phase 3** (FUTURE)
- [ ] Live-Updates via NDK Subscriptions
- [ ] Conflict Resolution (Last-Write-Wins)
- [ ] Multiplayer Sync Tests
- [ ] Offline-Queue Tests