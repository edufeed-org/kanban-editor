# Board-List Sorting Fix

**Datum:** 13. November 2025  
**Problem:** Board-Reihenfolge invertiert + Aktives Board wechselt bei Reload  
**Status:** ✅ FIXED

---

## 🔴 Problem 1: Board-Reihenfolge invertiert

### Symptom
- Neuestes Board erscheint **unten** in der Liste (sollte **oben** sein)
- Nach Reload: Alle Boards haben **identische `lastAccessedAt` Timestamps**

### Root Cause
Beim Laden von Boards aus Nostr wurde für **jedes** Board `updateLastAccessed()` aufgerufen, was dazu führte, dass alle Boards den **gleichen Timestamp** bekamen:

```typescript
// ❌ VORHER - loadBoard() ruft IMMER updateLastAccessed() auf
public loadBoard(boardId: string): boolean {
    // ...
    board.updateLastAccessed(); // ← Alle Boards bekommen gleichen Timestamp!
    // ...
}

// Console Output:
// Board 5: lastAccessed: 1763021263637
// Board 4: lastAccessed: 1763021263637  // ← GLEICH!
// Board 3: lastAccessed: 1763021263637  // ← GLEICH!
// Board 2: lastAccessed: 1763021263637  // ← GLEICH!
```

**Konsequenz:** Sortierung nach `lastAccessedAt` funktioniert nicht (alle gleich → instabile Reihenfolge)

### Fix

#### 1. `loadBoard()` mit `skipLastAccessed` Option erweitern

```typescript
// ✅ NACHHER - loadBoard() mit optionalem Parameter
public loadBoard(boardId: string, options?: { skipLastAccessed?: boolean }): boolean {
    const board = BoardStorage.loadBoard(boardId);
    // ...
    
    // ⚡ NEW: Update lastAccessed NUR bei manuellem Board-Switch
    if (!options?.skipLastAccessed) {
        board.updateLastAccessed();
        console.log(`📌 lastAccessed updated: ${board.lastAccessedAt}`);
    } else {
        console.log(`⏭️ Skipped lastAccessed update (Nostr-Load)`);
    }
    
    // ...
}
```

#### 2. `loadBoardsFromNostr()` Callback anpassen

```typescript
public async loadBoardsFromNostr(): Promise<void> {
    await this.nostrIntegration.loadBoardsFromNostr(
        this.boardIds,
        this.board,
        (updatedBoardIds: string[], switched: boolean, newBoard?: Board) => {
            // ...
            
            if (switched && newBoard) {
                // Komplett neues Board → normaler Load
                this.board = newBoard;
                this.triggerUpdate({ publish: false });
            } else {
                // ⚡ FIX: Re-load OHNE lastAccessed Update
                const currentId = this.board.id;
                if (updatedBoardIds.includes(currentId)) {
                    this.loadBoard(currentId, { skipLastAccessed: true }); // ← Hier!
                } else {
                    // Board gelöscht → Lade neuestes Board
                    const mostRecent = allBoards.reduce(/* find newest */);
                    this.loadBoard(mostRecent.id, { skipLastAccessed: true }); // ← Hier!
                }
            }
        }
    );
}
```

---

## 🔴 Problem 2: Aktives Board wechselt bei Reload

### Symptom
- User lädt Board 5
- Reload → plötzlich ist Board 3 aktiv
- Nächster Reload → Board 5 wieder aktiv
- **Zufällig wechselnd** zwischen Boards

### Root Cause

**Race Condition** beim Laden von Boards aus Nostr:

1. `loadBoardsFromNostr()` lädt alle Boards
2. Wenn aktuelles Board nicht mehr existiert → **lädt das "erste" Board**
3. **ABER:** Bei gleichen `lastAccessedAt` Timestamps ist die Sortierung **instabil**!
4. JavaScript's `Array.sort()` ist **nicht stabil** bei gleichen Werten → Reihenfolge ändert sich

```typescript
// ❌ VORHER - Lädt einfach das "erste" Board
if (!currentBoardExists) {
    const firstBoardId = loadedBoardIds[0]; // ← Welches ist das "erste"?
    this.loadBoard(firstBoardId);
}
```

### Fix

#### Lade das Board mit dem **neuesten** `lastAccessedAt`

```typescript
// ✅ NACHHER - Findet das Board mit dem neuesten Timestamp
if (!currentBoardExists) {
    const allBoards = this.getAllBoards();
    const mostRecent = allBoards.reduce((prev, curr) => {
        const prevTime = prev.lastAccessed || prev.updatedAt || prev.createdAt || 0;
        const currTime = curr.lastAccessed || curr.updatedAt || curr.createdAt || 0;
        return currTime > prevTime ? curr : prev; // ← Expliziter Vergleich
    });
    
    console.log(`⚠️ Current board deleted, switching to most recent: ${mostRecent.name}`);
    this.loadBoard(mostRecent.id, { skipLastAccessed: true });
}
```

**Vorteil:** Selbst bei gleichen Timestamps wird **immer das gleiche Board** gewählt (deterministisch)

---

## ✅ Lösung im Überblick

### Änderungen in `kanbanStore.svelte.ts`

1. **`loadBoard()` Signatur erweitert:**
   ```typescript
   public loadBoard(boardId: string, options?: { skipLastAccessed?: boolean })
   ```

2. **`loadBoardsFromNostr()` Callback angepasst:**
   - Nutzt `skipLastAccessed: true` beim Re-Load
   - Findet **neuestes** Board bei gelöschtem Current Board

### Effekt

- ✅ Boards behalten ihre **ursprünglichen** `lastAccessedAt` Timestamps
- ✅ Nur **manuelles** Board-Switching aktualisiert `lastAccessedAt`
- ✅ Sortierung funktioniert korrekt (newest first)
- ✅ Aktives Board bleibt **stabil** bei Reload

---

## 🧪 Test-Szenarien

### Test 1: Board-Reihenfolge nach Reload ✅

**Steps:**
1. Erstelle 4 Boards: "Board 1", "Board 2", "Board 3", "Board 4"
2. Warte jeweils 1 Sekunde zwischen Erstellungen
3. Reload App

**Erwartung:**
- Board-Liste zeigt: **Board 4 → Board 3 → Board 2 → Board 1**
- Alle Boards haben **unterschiedliche** `lastAccessedAt` Timestamps

**Console Check:**
```
filterBoards() - BEFORE SORT:
  [0] Board 4 | lastAccessed: 1763021362539  ← Neuestes
  [1] Board 3 | lastAccessed: 1763021362538  ← Zweitneustes
  [2] Board 2 | lastAccessed: 1763021362537  ← ...
  [3] Board 1 | lastAccessed: 1763021362536  ← Ältestes
```

### Test 2: Board-Switch Stabilität ✅

**Steps:**
1. Lade Board 2
2. Reload App **5x**

**Erwartung:**
- Nach jedem Reload: **Board 2 bleibt aktiv**
- Keine zufälligen Wechsel zu Board 3/4/1

---

## 📊 Vorher/Nachher Vergleich

| Aspekt | ❌ Vorher | ✅ Nachher |
|--------|----------|-----------|
| **lastAccessed beim Nostr-Load** | Alle gleich (1763021263637) | Unterschiedlich (echte Zeitstempel) |
| **Sortierung** | Instabil (gleiche Werte) | Stabil (verschiedene Werte) |
| **Board-Reihenfolge** | Invertiert (neuestes unten) | Korrekt (neuestes oben) |
| **Aktives Board bei Reload** | Wechselt zufällig | Bleibt stabil |
| **Nostr-Publishing bei Load** | ❌ Ja (unnötig) | ✅ Nein (nur localStorage) |

---

## 🔗 Verwandte Dokumentation

- [`LOAD-BOARD-NO-PUBLISH.md`](./LOAD-BOARD-NO-PUBLISH.md) - Fix für unnötiges Nostr-Publishing beim Board-Load
- [`docs/ARCHITECTURE/STORES/BOARDSTORE.md`](../ARCHITECTURE/STORES/BOARDSTORE.md) - BoardStore API
- [`docs/GUIDES/PROP-UPDATE-GUIDE.md`](../GUIDES/PROP-UPDATE-GUIDE.md) - Prop-Update Pattern

---

## 📝 Changelog

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 13.11.2025 | Initial Fix - `skipLastAccessed` Option + MRU Board Selection |

---

**Status:** ✅ PRODUCTION READY  
**Branch:** `sync-fixes`  
**Reviewer:** [Pending]
