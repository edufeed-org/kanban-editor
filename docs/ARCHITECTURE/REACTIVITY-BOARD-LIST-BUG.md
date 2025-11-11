# 🐛 Reaktivitäts-Bug: Board-Liste zeigt alte Namen

**Datum:** 8. November 2025  
**Bug:** Board umbenennen → Name ändert sich nicht in der Sidebar  
**Status:** ✅ FIXED  
**Branch:** `read-boards-from-nostr`

---

## Problem

Wenn ein Board umbenannt wird, wird der neue Name **nicht sofort** in der linken Sidebar (BoardsList.svelte) angezeigt. Erst nach einem Browser-Reload erscheint der neue Name.

**User Flow:**
1. Board "Mein Board" öffnen
2. In Settings/Topbar Board umbenennen zu "Projekt X"
3. ❌ Sidebar zeigt immer noch "Mein Board"
4. Browser neu laden (F5)
5. ✅ Sidebar zeigt jetzt "Projekt X"

---

## Root Cause: Cached localStorage Daten

### Das Problem im Detail

```typescript
// 1. Board umbenennen
updateCurrentBoardMeta({ name: 'Projekt X' })
  ↓
// 2. BoardOperations.updateBoardMetadata() setzt this.board.name = 'Projekt X'
this.board.name = 'Projekt X'; // ← $state Mutation!
  ↓
// 3. triggerUpdate() wird aufgerufen
this.updateTrigger++; // ← Triggert $derived
this.saveToStorage(); // ← Speichert zu localStorage (asynchron!)
  ↓
// 4. BoardsList.svelte $derived reagiert
filteredBoards = $derived.by(() => {
    return boardStore.filterBoards(searchQuery);
});
  ↓
// 5. filterBoards() ruft getAllBoards() auf
public getAllBoards() {
    return BoardStorage.getAllBoardsMetadata(this.boardIds);
    // ↑ Liest DIREKT aus localStorage!
}
  ↓
// 6. ❌ PROBLEM: localStorage hat noch ALTE Daten!
// saveToStorage() war zu langsam oder noch nicht committed
```

### Warum das ein Timing-Problem ist

- `saveToStorage()` ist **nicht garantiert synchron**
- localStorage.setItem() kann verzögert sein (Browser-Optimierung)
- `getAllBoards()` liest **sofort** nach `triggerUpdate()`
- Zwischen Schritt 3 und Schritt 5 ist **keine Garantie**, dass localStorage aktuell ist!

---

## Die Lösung: Live $state Daten bevorzugen

### Vorher (❌ Broken)

```typescript
public getAllBoards() {
    // Nur aus localStorage lesen
    return BoardStorage.getAllBoardsMetadata(this.boardIds);
}
```

**Problem:** Liest **cached** localStorage-Daten, die noch nicht aktualisiert wurden.

### Nachher (✅ Fixed)

```typescript
public getAllBoards() {
    // 1. Reaktive Dependency!
    this.updateTrigger; // ← Triggert Neuberechnung
    
    // 2. Lade Boards aus localStorage (für ANDERE Boards)
    const boards = BoardStorage.getAllBoardsMetadata(this.boardIds);
    
    // 3. ⚡ KRITISCH: Aktuelles Board mit LIVE-Daten überschreiben
    const currentIndex = boards.findIndex(b => b.id === this.board.id);
    if (currentIndex !== -1) {
        boards[currentIndex] = {
            id: this.board.id,
            name: this.board.name, // ← LIVE vom $state! Nicht cached!
            description: this.board.description,
            createdAt: new Date(this.board.createdAt).getTime(),
            updatedAt: this.board.updatedAt 
                ? new Date(this.board.updatedAt).getTime()
                : new Date(this.board.createdAt).getTime()
        };
    }
    
    return boards;
}
```

**Warum das funktioniert:**
1. `this.updateTrigger` wird gelesen → $derived wird getriggert
2. Andere Boards (nicht aktiv) werden aus localStorage gelesen → **OK**
3. **Aktuelles Board** wird mit `this.board.name` ($state) überschrieben → **IMMER AKTUELL**
4. Keine Abhängigkeit von localStorage-Timing mehr!

---

## Reaktivitätskette (nach Fix)

```
User benennt Board um
  ↓
updateCurrentBoardMeta({ name: 'Projekt X' })
  ↓
BoardOperations.updateBoardMetadata()
  ↓
this.board.name = 'Projekt X' // $state Mutation
  ↓
triggerUpdate()
  ↓
this.updateTrigger++ // Triggert $derived
  ↓
BoardsList.svelte $derived
  ↓
filteredBoards = boardStore.filterBoards(...)
  ↓
filterBoards() ruft getAllBoards() auf
  ↓
getAllBoards() liest this.updateTrigger (Dependency!)
  ↓
getAllBoards() liest this.board.name ($state)
  ↓
Aktuelles Board hat LIVE-Daten! ✅
  ↓
UI zeigt "Projekt X" SOFORT ✅
```

---

## Betroffene Komponenten

- ✅ **BoardsList.svelte** → `filteredBoards` $derived reagiert jetzt sofort
- ✅ **LeftSidebar.svelte** → Board-Name-Anzeige (falls verwendet)
- ✅ Alle Board-Listen-Komponenten

---

## Testing

### Manueller Test

1. Board öffnen
2. Board umbenennen (in Settings oder Topbar)
3. ✅ Sidebar zeigt neuen Namen **sofort** (ohne Reload!)

### Edge Cases

- ✅ **Mehrere Boards:** Andere Boards zeigen noch alte Namen aus localStorage (OK!)
- ✅ **Nach Reload:** Alle Boards haben aktuelle Namen (localStorage wurde gespeichert)
- ✅ **Board wechseln:** Neues aktives Board zeigt sofort aktuelle Daten

---

## Learnings

### 1. localStorage ist NICHT sofort verfügbar

- `localStorage.setItem()` ist **nicht garantiert synchron**
- Browser können Writes verzögern (Performance-Optimierung)
- **Nie auf sofortige Verfügbarkeit verlassen!**

### 2. $state ist die Source of Truth

- Wenn Daten in `$state` sind → **immer bevorzugen**
- localStorage ist **Persistierung**, nicht **Source of Truth**
- Reaktivität basiert auf `$state`, nicht auf localStorage

### 3. Reaktive Dependencies explizit lesen

```typescript
// ❌ FALSCH: Keine Dependency
public getAllBoards() {
    return BoardStorage.getAllBoardsMetadata(this.boardIds);
}

// ✅ RICHTIG: updateTrigger als Dependency
public getAllBoards() {
    this.updateTrigger; // ← Lesen triggert Neuberechnung!
    // ... rest
}
```

---

## Verwandte Dokumentation

- [`REACTIVITY.md`](./REACTIVITY.md) — Svelte 5 Runes Patterns
- [`STORES.md`](./STORES.md) — BoardStore Architektur
- [`MULTI-LAYER STORAGE.md`](../../archive/MULTI-LAYER STORAGE.md) — Storage-Hierarchie

---

**Status:** ✅ FIXED in kanbanStore.svelte.ts  
**Commit:** [Hash wird hinzugefügt]  
**Date:** 8. November 2025
