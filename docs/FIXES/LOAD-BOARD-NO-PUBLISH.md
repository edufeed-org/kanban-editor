# 🐛 Bug-Fix: Board-Laden triggert unnötiges Nostr-Publishing

**Datum:** 13. November 2025  
**Status:** ✅ FIXED  
**Priority:** 🔴 HIGH (UX Problem - Board-Liste flackert)

---

## 📊 Problem-Analyse

### Symptom

Beim **Laden** eines Boards aus der Board-Liste passiert Folgendes:

1. ✅ Board wird aus localStorage geladen → **OK**
2. ✅ `lastAccessedAt` wird aktualisiert → **OK** (für lokale MRU-Liste)
3. ❌ **Board-Event wird zu Nostr publiziert** → **FALSCH!**
4. ❌ Alle anderen Browser empfangen das Event
5. ❌ Ihre Board-Listen werden neu sortiert
6. ❌ **UI flackert/springt** (schlechte UX)

### Log-Beweis

```
💾 Board in localStorage gespeichert: kanban-board-7e0f3e8061f0e5abd9cdca91ede86f447b7ae6f9165cdc2f5939d2da7d634783
[SyncManager] Using 1 target relay(s) for PublishState: draft
[SyncManager] Signing event...
✅ Alle Cards vom Relay geladen und synchronisiert
[SyncManager] ✅ Event published to 1 relay(s)
[SyncManager] 🔑 Event ID: e857af1520a8a97f688a37687a38140481babb60485df50d19718feb9fc38ad7
```

→ **Board-Event wurde publiziert, obwohl das Board nur GELADEN wurde!**

### Root Cause

In `kanbanStore.svelte.ts` Zeile 509:

```typescript
private async loadCardsFromNostr(board: Board): Promise<void> {
    // ... Cards laden vom Relay ...
    
    // Nach dem Laden aller Cards: UI aktualisieren
    this.triggerUpdate();  // ❌ FEHLER: Kein { publish: false } Parameter!
    console.log('✅ Alle Cards vom Relay geladen und synchronisiert');
}
```

**Problem:** `triggerUpdate()` ohne Parameter → Default ist `publish: true` → Board wird zu Nostr publiziert!

### Warum ist das ein Problem?

#### 1. **Performance**
- Jedes Board-Laden triggert ein Nostr-Event
- Unnötiger Netzwerk-Traffic
- Relay-Last steigt

#### 2. **UX Problem**
- **Multi-Browser Szenario:**
  - Browser A: User klickt Board in Liste
  - Browser A publiziert Board-Event (mit neuem `lastAccessedAt`)
  - Browser B empfängt Event
  - Browser B sortiert Liste neu (MRU-Order)
  - **Browser B UI flackert/springt!**

#### 3. **Semantik**
- **Board laden** ist **KEINE Änderung**
- Nostr-Events sollten nur bei **echten Änderungen** publiziert werden:
  - Board-Name geändert
  - Spalte hinzugefügt/gelöscht
  - Tags geändert
  - etc.

---

## 🔧 Die Lösung

### Fix 1: `loadCardsFromNostr()` - Kein Publishing

**Datei:** `src/lib/stores/kanbanStore.svelte.ts` Line 509

```typescript
// ❌ VORHER
this.triggerUpdate();

// ✅ NACHHER
this.triggerUpdate({ publish: false });
```

**Begründung:**
- Wir **laden** nur Cards vom Relay
- **Keine lokalen Änderungen** wurden gemacht
- → **Kein Grund** zu Nostr zu publishen!

### Fix 2: `loadBoard()` - Klarstellung

**Datei:** `src/lib/stores/kanbanStore.svelte.ts` Line 360

```typescript
// ⚡ v4.1: KEIN saveToStorage beim Laden!
// Grund: Board kommt aus localStorage, kein Grund es sofort wieder zu speichern
// Das würde neuere Nostr-Daten überschreiben!
// Aber: updateTrigger++ damit $derived neu berechnet wird
// 🔴 WICHTIG: Kein triggerUpdate() hier - nur updateTrigger++
// → Verhindert unnötiges Nostr-Publishing beim reinen Laden!
this.updateTrigger++;
```

**Begründung:**
- `loadBoard()` lädt aus localStorage
- `updateTrigger++` triggert **nur** UI-Update ($derived)
- **KEIN** `triggerUpdate()` → **KEIN** Publishing zu Nostr
- ✅ `lastAccessedAt` wird trotzdem lokal gespeichert (via `BoardStorage.saveBoard()`)

---

## ✅ Verifikation

### Test-Szenario

**Setup:**
- Browser A: Board-Liste mit 3 Boards
- Browser B: Gleiche Board-Liste
- Beide Browser sind online

**Test:**
1. Browser A: Klicke auf "Neues Board 2" in der Liste
2. Beobachte Browser B

**Erwartetes Ergebnis:**
- ✅ Browser A lädt Board
- ✅ Browser B: **KEINE** Änderung in der Liste
- ✅ Kein Flackern
- ✅ Kein Nostr-Event in den Logs

**Tatsächliches Ergebnis (nach Fix):**
```
// Browser A Logs:
💾 Board in localStorage gespeichert: kanban-board-...  // ← Nur localStorage!
✅ Board geladen: Neues Board 2
✅ Alle Cards vom Relay geladen und synchronisiert
⏭️ triggerUpdate: SKIP publish to Nostr (publish=false)  // ← KEIN Publishing!

// Browser B Logs:
(keine neuen Events)  // ← Korrekt!
```

---

## 📊 Impact

### Vor dem Fix

```
Board laden → triggerUpdate() 
           → publishToNostr() 
           → Relay empfängt Event
           → Alle Browser empfangen Event
           → UI flackert ❌
```

### Nach dem Fix

```
Board laden → triggerUpdate({ publish: false })
           → NUR localStorage Update
           → NUR lokales UI-Update
           → Keine Nostr-Events ✅
```

### Performance-Verbesserung

- **-100% unnötige Nostr-Events** beim Board-Laden
- **-100% unnötige Relay-Traffic**
- **-100% UI-Flackern** in Multi-Browser Setup

---

## 🎯 Regel für die Zukunft

### Wann `publish: true` (Default)?

**User macht echte Änderung:**
- Board-Name geändert
- Spalte hinzugefügt/gelöscht/umbenannt
- Card hinzugefügt/bearbeitet/gelöscht
- Tags geändert
- PublishState geändert

→ `this.triggerUpdate()` oder `this.triggerUpdate({ publish: true })`

### Wann `publish: false`?

**System macht interne Updates ohne User-Änderung:**
- Board wird geladen (`loadBoard()`)
- Cards werden vom Relay geladen (`loadCardsFromNostr()`)
- Nostr-Event wird empfangen (`upsertBoardFromNostr()`, `upsertCardFromNostr()`)
- Interne Sync-Operationen

→ `this.triggerUpdate({ publish: false })`

### Code-Beispiele

```typescript
// ✅ RICHTIG: User ändert Board-Name
public renameBoard(name: string): void {
    this.board.name = name;
    this.triggerUpdate();  // publish: true (Default)
}

// ✅ RICHTIG: System lädt Board vom Relay
private async loadBoardFromNostr(boardId: string): Promise<void> {
    const board = await fetchBoardFromRelay(boardId);
    this.board = board;
    this.triggerUpdate({ publish: false });  // Explizit: KEIN Publishing!
}

// ❌ FALSCH: System lädt Board, published trotzdem
private async loadBoardFromNostr(boardId: string): Promise<void> {
    const board = await fetchBoardFromRelay(boardId);
    this.board = board;
    this.triggerUpdate();  // ← BUG! Würde zu Nostr publishen!
}
```

---

## 🔗 Verwandte Dokumente

- **[MULTI-LAYER STORAGE.md](../MULTI-LAYER STORAGE.md)** - 3-Layer Storage Architektur
- **[AGENTS.md](../../AGENTS.md)** - triggerUpdate() Pattern
- **[ROADMAP.md](../COLLABORATION/ROADMAP.md)** - Phase 1.1 Nostr Publishing

---

## 🆕 Zusätzlicher Fix: Board-Sortierung bei Nostr-Laden

**Datum:** 13. November 2025  
**Problem:** Neu von Nostr geladene Boards erscheinen OBEN in der Liste (nicht unten)

### Root Cause

In `operations.ts` Line 608:
```typescript
lastAccessedAt: boardProps.updatedAt || new Date().toISOString(),  // ❌ FALSCH!
```

**Problem:**
- Neues Board von Nostr bekommt `lastAccessedAt = updatedAt` (alte Zeit)
- Sortierung verwendet `lastAccessed` als Primary Sort Key
- → Board erscheint an falscher Position (zu weit oben)

### Fix

```typescript
lastAccessedAt: undefined,  // ✅ RICHTIG!
```

**Begründung:**
- Neues Board wurde **NICHT vom User angesehen**
- `lastAccessedAt = undefined` → Fallback zu `updatedAt` in Sortierung
- → Board erscheint weiter unten (bis User es das erste Mal öffnet)

### Sortierungs-Logik (bereits korrekt)

```typescript
const sorted = allBoards.sort((a, b) => {
    const timeA = a.lastAccessed || a.updatedAt || a.createdAt || 0;
    const timeB = b.lastAccessed || b.updatedAt || b.createdAt || 0;
    return timeB - timeA; // DESC: newest first
});
```

**Reihenfolge:**
1. **Zuletzt angesehen** (lastAccessed) → oben
2. **Zuletzt geändert** (updatedAt) → Mitte
3. **Erstellt** (createdAt) → unten
4. **Keine Timestamps** (0) → ganz unten

---

## 📝 Changelog

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 13.11.2025 | Initial Fix - loadCardsFromNostr() & loadBoard() |

---

**Status:** ✅ FIXED & TESTED  
**Verifiziert:** Multi-Browser Test erfolgreich (kein Flackern mehr)
