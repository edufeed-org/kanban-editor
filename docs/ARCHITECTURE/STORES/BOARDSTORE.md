# BoardStore Dokumentation

**Datei:** `src/lib/stores/kanbanStore.svelte.ts`  
**Technologie:** Svelte 5 Runes (`$state`, `$derived`)  
**Zweck:** Zentrale State-Verwaltung für Kanban-Boards mit Multi-Board-Support

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Architektur](#architektur)
3. [Reaktives Datenmodell](#reaktives-datenmodell)
4. [Multi-Board-Verwaltung](#multi-board-verwaltung)
5. [CRUD-Operationen](#crud-operationen)
6. [Autorisierung](#autorisierung)
7. [Paste-System](#paste-system)
8. [Best Practices](#best-practices)
9. [Häufige Fehler](#häufige-fehler)

---

## Übersicht

Der `BoardStore` ist der **Single Source of Truth** für alle Board-Daten in der Anwendung. Er verwendet **Svelte 5 Runes** für Reaktivität und persistiert automatisch in `localStorage`.

### Kernfunktionen

- ✅ **Multi-Board-Verwaltung** — Mehrere Boards parallel verwalten
- ✅ **Reaktive UI-Anbindung** — `$derived.by()` für automatische UI-Updates
- ✅ **Auto-Persistierung** — Automatisches Speichern in localStorage
- ✅ **Autorisierung** — Maintainer-basierte Zugriffssteuerung
- ✅ **MRU-Reload** — Most Recently Used Board beim App-Start
- ✅ **Paste-Integration** — Direkte Clipboard-Verarbeitung

### Verwendung in Komponenten

```typescript
import { boardStore } from '$lib/stores/kanbanStore.svelte';

// Reaktiver Zugriff auf UI-Daten
let columns = $derived(boardStore.uiData);

// Board-Metadaten
let { name, description } = $derived(boardStore.boardMeta);

// Neue Karte erstellen
boardStore.createCard(columnId, 'Meine Karte', 'Beschreibung');
```

---

## Architektur

### Datenfluss-Diagramm

```
┌────────────────────────────────────────────────────┐
│ UI-Komponenten (Board.svelte, Column.svelte)      │
│ ├─ Lesen: boardStore.uiData ($derived)            │
│ └─ Schreiben: boardStore.createCard(), etc.       │
└────────────────────────────────────────────────────┘
                    ↕ ($effect Sync)
┌────────────────────────────────────────────────────┐
│ BoardStore (kanbanStore.svelte.ts)                 │
│ ├─ board = $state(Board-Instanz)                  │
│ ├─ _columnOrder = $state(string[])                │
│ ├─ updateTrigger = $state(number)                 │
│ ├─ uiData = $derived.by(() => {...})              │
│ ├─ triggerUpdate() → localStorage                 │
│ └─ publishToNostr() → SyncManager.publishOrQueue()      │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ Persistierung & Synchronisation                    │
│ ├─ localStorage: 'kanban-{boardId}' (Sync)        │
│ │    - boardId ist i.d.R. im Format 'board-<...>' │
│ │    - dadurch ist der Key meistens 'kanban-board-<...>' │
│ ├─ localStorage: 'kanban-deleted-boards-v1' (Tombstones) │
│ │    - verhindert „Resurrection“ gelöschter Boards │
│ ├─ Board-IDs: werden aus localStorage Keys abgeleitet │
│ │    - legacy Key 'kanban-boards-list' ist NICHT mehr Source of Truth │
│ └─ SyncManager: Offline-Queue & Nostr-Publishing (Async) │
└────────────────────────────────────────────────────┘
```

### Klassenstruktur

```typescript
export class BoardStore {
    // Reaktive States
    private board = $state<Board>(...)
    private boardIds = $state<string[]>(...)
    private _columnOrder = $state<string[]>(...)
    public updateTrigger = $state<number>(0)
    
    // Berechnete Werte
    public uiData = $derived.by(() => {...})
    public boardMeta = $derived({...})
    
    // CRUD-Methoden
    public createCard(...)
    public updateCard(...)
    public deleteCard(...)
    public moveCard(...)
    
    // Multi-Board
    public getAllBoards()
    public createBoard()
    public loadBoard()
    public deleteBoard()
}
```

---

## Reaktives Datenmodell

### $state: Reaktive Zustandsverwaltung

```typescript
// RICHTIG: Svelte 5 Runes
private board = $state<Board>(this.loadFromStorage());
private updateTrigger = $state<number>(0);

// FALSCH: Svelte 4 Syntax (deprecated!)
// private board = writable<Board>(...);
```

**REGEL 1:** Alle mutablen Daten MÜSSEN `$state()` verwenden.

### $derived: Berechnete Werte

```typescript
// UI-Daten automatisch berechnen
public uiData = $derived.by(() => {
    const columns = this.board.columns;  // ← Dependency Tracking
    const trigger = this.updateTrigger;  // ← Fallback Trigger
    
    // Transformiere zu UI-Format
    return columns.map(col => ({
        id: col.id,
        name: col.name,
        items: col.cards.map(card => ({...}))
    }));
});
```

**REGEL 2:** `$derived.by()` wird **automatisch** neu berechnet wenn:
- `this.board.columns` sich ändert
- `this.updateTrigger` inkrementiert wird

### updateTrigger-Pattern

```typescript
private triggerUpdate(): void {
    this.updateTrigger++;        // ← Triggert $derived Neuberechnung
    this.saveToStorage();        // ← Synchron speichern
    console.log('🔄 Update triggered:', this.updateTrigger);
}

// Verwendung
public createCard(columnId: string, name: string) {
    const card = column.addCard({heading: name});
    this.triggerUpdate();  // ← ESSENTIAL!
}
```

**REGEL 3:** JEDE Änderung an `board` MUSS `triggerUpdate()` aufrufen!

**Warum?**
- ✅ `updateTrigger++` → $derived wird neu berechnet
- ✅ `saveToStorage()` → localStorage wird aktualisiert
- ✅ UI wird automatisch synchronisiert via $effect in Components

---

## Multi-Board-Verwaltung

### Board-IDs Liste

```typescript
private static BOARDS_LIST_KEY = 'kanban-boards-list';
private boardIds = $state<string[]>([...]);

// Liste speichern/laden
private loadBoardIds(): string[] {
    const stored = localStorage.getItem('kanban-boards-list');
    return stored ? JSON.parse(stored) : [];
}

private saveBoardIds(): void {
    localStorage.setItem('kanban-boards-list', JSON.stringify(this.boardIds));
}
```

**REGEL 4:** Board-IDs werden **separat** gespeichert von Board-Daten.

### Board erstellen

```typescript
public createBoard(name: string = 'Neues Board'): string {
    const author = authStore.getPubkey() || 'anonymous';
    
    const newBoard = new Board({
        name,
        author,
        maintainers: [author],
        columns: [
            { name: 'Material', color: 'slate' },
            { name: 'Auswahl', color: 'green' },
            { name: 'Einstieg', color: 'orange' }
        ]
    });
    
    const newBoardId = newBoard.id;
    
    // 1. Speichere Board-Daten
    localStorage.setItem(`kanban-${newBoardId}`, JSON.stringify(newBoard.getContextData(true)));
    
    // 2. Füge zur Liste hinzu
    this.boardIds = [...this.boardIds, newBoardId];
    this.saveBoardIds();
    
    // 3. Trigger Update für UI-Reaktivität
    this.updateTrigger++;
    
    return newBoardId;
}
```

**REGEL 5:** Neue Boards werden SOFORT persistiert (nicht erst beim nächsten Update).

### Board laden (MRU-Pattern)

```typescript
private loadFromStorage(): Board {
    const boardIds = this.loadBoardIds();
    
    if (boardIds.length > 0) {
        // Finde Board mit neuestem lastAccessedAt
        let mostRecentBoardId = boardIds[0];
        let mostRecentTime = 0;
        
        for (const boardId of boardIds) {
            const data = JSON.parse(localStorage.getItem(`kanban-${boardId}`));
            const timestamp = new Date(data.lastAccessedAt || data.updatedAt).getTime();
            
            if (timestamp > mostRecentTime) {
                mostRecentTime = timestamp;
                mostRecentBoardId = boardId;
            }
        }
        
        return this.reconstructBoard(JSON.parse(localStorage.getItem(`kanban-${mostRecentBoardId}`)));
    }
    
    // Fallback: Default Board
    return this.createDefaultBoard();
}
```

**REGEL 6:** Beim App-Start wird das **zuletzt geöffnete** Board geladen (MRU = Most Recently Used).

### Board wechseln

```typescript
public loadBoard(boardId: string): boolean {
    const data = JSON.parse(localStorage.getItem(`kanban-${boardId}`));
    if (!data) return false;
    
    this.board = this.reconstructBoard(data);
    this._columnOrder = this.board.columns.map(c => c.id);
    
    // Setze lastAccessedAt auf JETZT
    data.lastAccessedAt = generateTimestamp();
    localStorage.setItem(`kanban-${boardId}`, JSON.stringify(data));
    
    this.updateTrigger++;  // UI-Update
    return true;
}
```

**REGEL 7:** `lastAccessedAt` wird **beim Laden** aktualisiert (nicht beim Speichern).

### Alle Boards auflisten

```typescript
public getAllBoards(): Array<{ id: string; name: string; updatedAt: number }> {
    const trigger = this.updateTrigger;  // ← Reaktivität!
    const ids = this.boardIds;
    
    const boards = [];
    for (const boardId of ids) {
        const data = JSON.parse(localStorage.getItem(`kanban-${boardId}`));
        boards.push({
            id: boardId,
            name: data.name,
            updatedAt: new Date(data.updatedAt).getTime()
        });
    }
    
    // Sortiere nach updatedAt (zuletzt bearbeitet zuerst)
    return boards.sort((a, b) => b.updatedAt - a.updatedAt);
}
```

**REGEL 8:** `getAllBoards()` ist **reaktiv** (liest `updateTrigger` für Dependency Tracking).

---

## CRUD-Operationen

### Karte erstellen

```typescript
public createCard(columnId: string, name: string, description?: string): string {
    const author = authStore.getPubkey() || 'anonymous';
    const authorName = authStore.getUserName() || author;
    
    const cardProps: CardProps = {
        heading: name,
        content: description || 'Bitte bearbeiten...',
        publishState: 'draft',
        author,
        authorName
    };
    
    const card = this.addCard(columnId, cardProps);
    return card.id;
}

private addCard(columnId: string, props: CardProps) {
    // 🔐 AUTORISIERUNG: Nur Maintainer dürfen Karten hinzufügen
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error('❌ Keine Berechtigung: Nur Maintainer können Karten hinzufügen.');
    }
    
    const column = this.board.findColumn(columnId);
    if (!column) throw new Error(`Spalte ${columnId} nicht gefunden.`);
    const card = column.addCard(props);
    
    this.triggerUpdate();  // ← ESSENTIAL!
    this.publishCardToNostr(card.id).catch(err => {
        console.error("Fehler beim Publizieren der Karte:", err)
    });
    
    return card;
}
```

**REGEL 9:** ALLE Write-Operationen MÜSSEN Autorisierung prüfen!

### Karte aktualisieren

```typescript
public editCard(cardId: string, updates: { 
    name?: string
    description?: string
    image?: string
    color?: string
    labels?: string[]
}): void {
    const cardProps: Partial<CardProps> = {};
    if (updates.name !== undefined) cardProps.heading = updates.name;
    if (updates.description !== undefined) cardProps.content = updates.description;
    if (updates.image !== undefined) cardProps.image = updates.image;
    if (updates.color !== undefined) cardProps.color = updates.color;
    if (updates.labels !== undefined) cardProps.labels = updates.labels;
    
    this.updateCard(cardId, cardProps);
}

private updateCard(cardId: string, updates: Partial<CardProps>): void {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) throw new Error('Card not found');
    
    result.card.update(updates);
    this.triggerUpdate();  // ← ESSENTIAL!
    this.publishCardToNostr(cardId).catch(err => {
        console.error("Fehler beim Publizieren des Karten-Updates:", err)
    });
}
```

**REGEL 10:** UI-API (`editCard`) transformiert zu Model-API (`updateCard`).

### Karte verschieben (DnD)

```typescript
public syncBoardState(uiColumns: UIColumn[]): boolean {
    // 🔐 AUTORISIERUNG (DnD)
    const userRole = this.getCurrentUserRole();
    const boardId = this.board.id;
    if (!PermissionChecks.canMoveCard(userRole, boardId)) return false;

    // Debounce: schnelle DnD-Events sammeln
    this.pendingSyncData = uiColumns;
    if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
    this.syncDebounceTimer = setTimeout(() => {
        this.executeSyncBoardState();
    }, 150);

    return true;
}

private async executeSyncBoardState(): Promise<void> {
    if (this.syncInProgress) return;
    if (!this.pendingSyncData) return;

    this.syncInProgress = true;
    const uiColumns = this.pendingSyncData;
    this.pendingSyncData = null;

    try {
        // ✅ Atomarer Sync via BoardOperations
        // Hard-Fail: wenn UI-Payload Cards/Columns „verliert“, brechen wir ab
        // (keine Persistierung / kein Publish auf Basis transienter DnD-Glitches).
        const { newColumnOrder, movedCardIds } = BoardOperations.syncBoardState(
            this.board,
            this._columnOrder,
            uiColumns,
            { strategy: 'hard-fail' }
        );

        this._columnOrder = newColumnOrder;
        this.triggerUpdate({ publish: false });

        await this.publishBoardAsync();
        for (const cardId of movedCardIds) {
            await this.publishCardAsync(cardId);
        }
    } finally {
        this.syncInProgress = false;
    }
}
```

**REGEL 11:** `syncBoardState()` ist die **atomic 3-step sync** für DnD-Operationen.

**Hinweis (Datenverlust-Schutz):** `strategy: 'hard-fail'` stoppt den Sync, wenn das UI-Payload unvollständig ist (kein Persist/Publish auf transienten DnD-Glitches).

**Hinweis (DnD-Placeholder):** `svelte-dnd-action` kann temporäre Placeholder-IDs wie `dnd-shadow-placeholder-*` erzeugen. Diese werden beim Hard-Fail-Check ignoriert.

**UX nach Hard-Fail:** Der Store zeigt eine Toast („Drag & Drop abgebrochen“). Zusätzlich setzt die Board-UI den lokalen DnD-State zurück (Reset auf Parent/Store-Stand), damit Drag & Drop direkt weiter nutzbar ist.

### Kommentar hinzufügen

```typescript
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) throw new Error('Card not found');
    
    result.card.addComment(text, author);
    this.triggerUpdate();  // ← ESSENTIAL!
    this.publishCardToNostr(result.card.id).catch(err => {
        console.error("Fehler beim Publizieren des Kommentars (via Karten-Update):", err)
    });
}
```

**REGEL 12:** Kommentare triggern ebenfalls `updateTrigger` und ein Karten-Update auf Nostr.

---

## Autorisierung

### Maintainer-Check

```typescript
// In Board-Klasse (BoardModel.ts)
public isMaintainer(pubkey?: string): boolean {
    if (!pubkey) return false;
    return pubkey === this.author || (this.maintainers || []).includes(pubkey);
}

public canAddCard(pubkey?: string): boolean {
    if (!pubkey) return false;
    if ((this.maintainers || []).length === 0) {
        return pubkey === this.author;
    }
    return this.isMaintainer(pubkey);
}
```

**REGEL 13:** Autorisierung ist **Board-Level** (nicht Global).

### Verwendung in BoardStore

```typescript
public addCard(...) {
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error(`❌ Nicht autorisiert`);
    }
    // ... Card hinzufügen
}
```

**REGEL 14:** ALLE Write-Operationen (außer Read) MÜSSEN `canAddCard()` prüfen.

### Fehlermeldungen

```typescript
// RICHTIG: Detaillierte Fehlermeldung mit Context
throw new Error(
    `❌ Keine Berechtigung: Sie müssen angemeldet sein und Maintainer dieses Boards sein ` +
    `(author: ${this.board.author}, maintainers: ${this.board.maintainers.join(', ') || 'keine'})`
);

// FALSCH: Zu generisch
throw new Error('Unauthorized');
```

**REGEL 15:** Fehlermeldungen MÜSSEN Context enthalten für Debugging.

---

## Paste-System

### Card-Paste (Merge mit existierender Card)

```typescript
public async handleCardPaste(
    cardId: string,
    clipboardData: DataTransfer | ClipboardEvent['clipboardData']
): Promise<PasteResult> {
    const { pasteHandler } = await import('../paste/PasteHandler.js');
    
    const result = await pasteHandler.handlePaste(clipboardData, {
        target: 'card',
        cardId,
        author: authStore.getUserName() || authStore.getPubkey() || 'anonymous'
    });
    
    if (result.success && result.cardUpdates) {
        const existing = this.board.findCardAndColumn(cardId);
        const merged = this.mergeCardUpdates(existing.card, result.cardUpdates);
        this.updateCard(cardId, merged);
    }
    
    return result;
}
```

**REGEL 16:** Card-Paste **merged** mit existierenden Daten (kein Replace).

### Column-Paste (Neue Card erstellen)

```typescript
public async handleColumnPaste(
    columnId: string,
    clipboardData: DataTransfer | ClipboardEvent['clipboardData']
): Promise<PasteResult & { cardId?: string }> {
    const { pasteHandler } = await import('../paste/PasteHandler.js');
    
    const result = await pasteHandler.handlePaste(clipboardData, {
        target: 'column',
        columnId,
        author: authStore.getUserName() || authStore.getPubkey() || 'anonymous'
    });
    
    if (result.success && result.cardUpdates) {
        const card = this.addCard(columnId, {
            heading: result.cardUpdates.heading || 'Eingefügter Inhalt',
            content: result.cardUpdates.content || '',
            image: result.cardUpdates.image,
            ...
        });
        
        return { ...result, cardId: card.id };
    }
    
    return result;
}
```

**REGEL 17:** Column-Paste **erstellt** eine neue Card (kein Merge).

---

## Best Practices

### ✅ DO

```typescript
// Nutze Store-API (nicht direkt Board-Klasse)
boardStore.createCard(columnId, 'Titel');

// Autorisierung vor Write-Operationen
if (!this.board.canAddCard(signerPubkey)) {
    return false;  // Graceful Error
}

// triggerUpdate() nach JEDER Änderung
this.board.addColumn({name: 'Neu'});
this.triggerUpdate();  // ← ESSENTIAL!

// Reaktive Abhängigkeiten in $derived
public uiData = $derived.by(() => {
    const trigger = this.updateTrigger;  // ← Gelesen für Tracking
    return this.board.columns.map(...);
});
```

### ❌ DON'T

```typescript
// NIEMALS direkt Board-Klasse mutieren
this.board.columns.push(newColumn);  // ← KEINE Reaktivität!

// NIEMALS triggerUpdate() vergessen
this.board.addCard({...});  // ← localStorage NICHT aktualisiert!

// NIEMALS Autorisierung überspringen
boardStore.deleteBoard();  // ← Jeder kann löschen!

// NIEMALS ohne Error-Handling
const card = boardStore.addCard(...);  // ← Was wenn Error?
```

**REGEL 18:** Store-API ist **mandatory** — niemals direkt `board.*` aufrufen!

---

## Häufige Fehler

### Fehler 1: triggerUpdate() vergessen

**Symptom:** Änderungen verschwinden nach Browser-Reload

```typescript
// ❌ FALSCH
public createCard(columnId: string, name: string) {
    const card = column.addCard({heading: name});
    // triggerUpdate() vergessen!
}

// ✅ RICHTIG
public createCard(columnId: string, name: string) {
    const card = column.addCard({heading: name});
    this.triggerUpdate();  // ← ESSENTIAL!
}
```

**Fix:** IMMER `triggerUpdate()` nach Board-Änderungen aufrufen!

### Fehler 2: UI zeigt alte Daten

**Symptom:** Card-Update funktioniert, aber UI zeigt alten Wert

```typescript
// Problem: $effect in Component beobachtet falsche Dependency
$effect(() => {
    const data = boardStore.data;  // ← Zu granular!
});

// Fix: Beobachte uiData statt data
$effect(() => {
    const columns = boardStore.uiData;  // ← Richtige Ebene!
    items = columns.find(c => c.id === columnId)?.items || [];
});
```

**Fix:** Nutze `boardStore.uiData` für UI-Sync (nicht `boardStore.data`).

### Fehler 3: Autorisierung nicht geprüft

**Symptom:** Jeder User kann Boards löschen

```typescript
// ❌ FALSCH
public deleteBoard(boardId: string) {
    localStorage.removeItem(`kanban-${boardId}`);
}

// ✅ RICHTIG
public deleteBoard(boardId: string) {
    const signerPubkey = authStore.getPubkey();
    if (!this.board.canAddCard(signerPubkey ?? undefined)) {
        throw new Error('❌ Keine Berechtigung');
    }
    // ✅ Anti-Resurrection: Tombstone setzen, dann Key entfernen
    tombstoneBoard(boardId);
    localStorage.removeItem(`kanban-${boardId}`);
}
```

**Fix:**
- ALLE lokalen Write-Ops MÜSSEN Permissions prüfen.
- Für Nostr Kind-5 Deletions muss zusätzlich gelten: `deletionEvent.pubkey` entspricht dem Pubkey im `a`-Tag (NIP-09 Adressierung), sonst KEIN Delete/Tombstone.

### Fehler 4: Board-IDs werden aus Keys abgeleitet

**Symptom:** Veraltete Implementierungen pflegen eine separate ID-Liste und geraten aus Sync.

**Aktueller Fix/Standard:** Board-IDs werden aus `Object.keys(localStorage)` abgeleitet (Single Source of Truth), und gelöschte Boards werden zusätzlich per Tombstone-Registry gefiltert.

```typescript
// ✅ RICHTIG (aktuell): Keine separate IDs-Liste als Source of Truth
const boardIds = BoardStorage.loadBoardIds();

// ✅ Delete: Tombstone setzen (dauerhaft) + Key entfernen
BoardStorage.deleteBoard(boardId);
```

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | Nutze `$state()` für mutable Data | 🔴 CRITICAL |
| **REGEL 3** | `triggerUpdate()` nach JEDER Änderung | 🔴 CRITICAL |
| **REGEL 6** | MRU-Reload beim App-Start | 🟠 HIGH |
| **REGEL 9** | Autorisierung bei ALLEN Write-Ops | 🔴 CRITICAL |
| **REGEL 11** | `syncBoardState()` für DnD (atomic) | 🟠 HIGH |
| **REGEL 18** | Store-API (nicht direkt Board-Klasse) | 🔴 CRITICAL |

**Ohne diese Regeln: Datenverlust & Security-Issues! ⚠️**
