# 🧪 Test Plan: localStorage Consolidation (v1.4)

**Datum:** 9. November 2025  
**Status:** ✅ TypeScript Check: 0 errors, 0 warnings  
**Änderungen:**
- Eliminiert `kanban-boards-list` Key
- Single Source of Truth: `kanban-boards-metadata`
- `saveBoardIds()` ist jetzt DEPRECATED (NO-OP)

---

## Test Scenario 1: Board Creation (Browser A)

**Ziel:** Neues Board sollte sofort sichtbar sein (ohne localStorage-Clear)

### Schritte:

```
1. Browser A: Öffne http://localhost:5173/
2. Klicke "Neues Board"
3. Gib Namen ein: "Test Board A"
4. Klicke Erstellen
```

### Erwartetes Verhalten:

```
✅ Board erscheint SOFORT in der Liste (Browser A)
   └─ createBoard()
      └─ BoardStorage.saveBoard(board)
      └─ addBoardToMetadataList({...})
      └─ UI updated via triggerUpdate()

✅ Board sichtbar auch nach Reload (Browser A)
   └─ loadBoardIds() → aus kanban-boards-metadata ✓

✅ Alle Felder korrekt in localStorage:
   localStorage['kanban-boards-metadata'] = [{
       id: "...",
       name: "Test Board A",
       description: "",
       lastAccessed: "2025-11-09T...",
       author: "",
       publishState: "draft"
   }]

✅ Kein Eintrag in kanban-boards-list mehr!
   localStorage['kanban-boards-list'] = undefined
```

### Validation in Browser Console:

```javascript
// 1. Check: Metadata exists
JSON.parse(localStorage.getItem('kanban-boards-metadata'))
// Output: [{id: "...", name: "Test Board A", ...}]

// 2. Check: Legacy key NOT updated
localStorage.getItem('kanban-boards-list')
// Output: null (or old value from before refactor)

// 3. Check: loadBoardIds works
// (Internal: BoardStorage.loadBoardIds())
// Should return: ["..."]
```

---

## Test Scenario 2: Board Creation (Browser B via Nostr)

**Ziel:** Browser B erstellt Board → Browser A sollte es sehen

### Schritte:

```
1. Browser A: http://localhost:5173/
2. Browser B: http://localhost:5173/ (öffne in separatem Fenster)
3. Browser B: Erstelle "Test Board B"
4. Browser A: Check nach ~1 Sekunde
```

### Erwartetes Verhalten:

```
✅ Browser A sieht "Test Board B" sofort
   └─ upsertBoardFromNostr() wird aufgerufen
   └─ Calls BoardOperations.addBoardToMetadataList()
   └─ Updates kanban-boards-metadata
   └─ loadBoardIds() returns alle IDs

✅ Sortierung korrekt (newest first):
   1. Test Board B (just created)
   2. Test Board A (created earlier)
```

---

## Test Scenario 3: Board Sorting by lastAccessed

**Ziel:** Boards sollten nach lastAccessed sortiert sein (newest first)

### Schritte:

```
1. Browser A: Erstelle "Board 1"
2. Warte 2 Sekunden
3. Browser A: Erstelle "Board 2"
4. Browser A: Klicke auf "Board 1" (um zu öffnen)
5. Browser A: Öffne BoardsList (Dashboard)
```

### Erwartetes Verhalten:

```
✅ Liste zeigt (in dieser Reihenfolge):
   1. Board 1  (gerade geöffnet → lastAccessed updated)
   2. Board 2  (älter, aber neulich erstellt)

✅ localStorage kanban-boards-metadata:
   Board 1: lastAccessed = "2025-11-09T12:05:30Z"  (newest)
   Board 2: lastAccessed = "2025-11-09T12:05:28Z"  (slightly older)
```

---

## Test Scenario 4: Offline-Online Sync

**Ziel:** Offline-erstellte Boards sollten bei Online-Verbindung synced werden

### Schritte:

```
1. Browser A: Öffne DevTools (F12)
2. Setze Network offline: DevTools → Network → Offline
3. Erstelle "Offline Board"
4. Setze Network zurück auf Online
5. Überprüfe: Erscheint in Browser B?
```

### Erwartetes Verhalten:

```
✅ Browser A: Board lokal sichtbar (in kanban-boards-metadata)
✅ Browser B: Board wird nach Sync sichtbar (von Nostr)
```

---

## Test Scenario 5: localStorage Integrity Check

**Ziel:** Nur noch EIN Key für Board-Liste sollte existieren

### Befehle in Browser Console:

```javascript
// ✅ RICHTIG (nach Refactoring):
Object.keys(localStorage).filter(k => k.includes('board'))
// Output: [
//   "kanban-boards-metadata",      // ← RICHTIG (Single Source of Truth)
//   "kanban-board-xxx",
//   "kanban-board-yyy",
//   ...
// ]

// ❌ FALSCH (vor Refactoring):
// Output: [
//   "kanban-boards-list",          // ← FALSCH (Should NOT exist!)
//   "kanban-boards-metadata",
//   "kanban-board-xxx",
//   ...
// ]
```

---

## Sanity Checks

### 1. TypeScript Compilation

```bash
pnpm run check
# Expected: 0 errors, 0 warnings ✅
```

### 2. Build Check

```bash
pnpm run build
# Expected: Build successful ✅
```

### 3. No Console Warnings

```javascript
// In Browser Console:
// Should NOT see:
// ❌ "saveBoardIds() deprecated"
// ❌ "localStorage not available"

// Should see (optional logging):
// ✅ "📋 Board-IDs geladen aus Metadata: 3 Boards"
// ✅ "➕ Added new board to metadata list: Test Board A"
```

---

## Rollback Plan

Falls Probleme auftreten:

```bash
git revert HEAD~3  # Back to before consolidation
# or
git checkout HEAD -- src/lib/stores/
# Restore from backup if needed
```

---

## Known Limitations

### 1. Deprecated Code Still in Place

```typescript
// In storage.ts:
public static saveBoardIds(boardIds: string[]): void {
    console.warn('⚠️ saveBoardIds() deprecated - Use addBoardToMetadataList() instead!');
    // NO-OP: Makes no changes to localStorage
}
```

**Reason:** 6 Aufrufe in `kanbanStore.svelte.ts` still call this method
**Future Fix:** Remove these calls in next refactoring phase (Phase 2)

### 2. Manual localStorage Migration

Bestehende Instanzen mit alten `kanban-boards-list` Keys:
- Diese bleiben im localStorage (werden nicht automatisch gelöscht)
- Aber sind nicht mehr funktional (werden ignoriert)
- Optional: User kann localStorage manuell clearen

---

## Success Criteria ✅

- [x] TypeScript: 0 errors, 0 warnings
- [ ] Test Scenario 1: Browser A board visible immediately after creation
- [ ] Test Scenario 2: Browser A sees Browser B's boards via Nostr
- [ ] Test Scenario 3: Board sorting by lastAccessed works correctly
- [ ] Test Scenario 4: Offline boards sync when online
- [ ] Test Scenario 5: Only kanban-boards-metadata exists (no kanban-boards-list)
- [ ] No console warnings about deprecated methods (before full removal)

---

**Nächster Schritt:** Führe die Test-Szenarien manuell durch und prüfe "Success Criteria"
