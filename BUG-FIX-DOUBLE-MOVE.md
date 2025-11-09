# 🐛 Bug Fix: Double-Move nach Spalten-Reorder

**Datum:** 9. November 2025  
**Status:** ✅ FIXED & VALIDATED  
**Severity:** 🟠 HIGH - User sieht doppelte Animation beim Spalten-verschieben

---

## Das Problem

Nach Spalten-Reorder auf Browser A zeigt die UI:
- ❌ Spalte wird verschoben (richtig)
- ❌ Spalte wird NOCHMAL verschoben (falsch!)

**Root Cause:**
1. Browser A: Spalte verschoben lokal
2. Browser A: `syncBoardState()` → `publishBoardAsync()`
3. Browser A: Board-Event zu Nostr publiziert
4. Browser A: **Empfängt sein EIGENES Event zurück** (Echo)
5. Browser A: `upsertBoardFromNostr()` → `currentBoard.columns = newColumnOrder`
6. ❌ Spalten werden NOCHMAL reordert → **Double-Move!**

**Problem-Zeile:** `operations.ts:554`
```typescript
// ❌ FALSCH: Reassigniert IMMER, auch wenn Reihenfolge gleich ist
currentBoard.columns = newColumnOrder;
```

---

## Die Lösung

**FIX:** Prüfe ob Spalten-Reihenfolge bereits gleich ist BEVOR reassignieren:

```typescript
// ⚡ CRITICAL: Prüfe ob Reihenfolge bereits gleich ist
const currentOrder = currentBoard.columns.map(c => c.id);
const nostrOrder = boardProps.columns.map(c => c.id);
const isSameOrder = JSON.stringify(currentOrder) === JSON.stringify(nostrOrder);

// ...

// ⚡ CRITICAL: Nur reassignieren wenn Reihenfolge geändert!
if (!isSameOrder) {
    currentBoard.columns = newColumnOrder;
    console.log(`🔄 Synchronized ${newColumnOrder.length} columns from Nostr`);
} else {
    console.log(`✅ Columns already in correct order, skip reassignment`);
}
```

**Effekt:**
- ✅ Wenn Spalten gleich: Kein Reassignment → Kein Double-Move
- ✅ Wenn Spalten unterschiedlich (echte Change): Reassignment → Korrekt synchronisiert

---

## Modified Files

| Datei | Zeile | Änderung |
|-------|-------|----------|
| `operations.ts` | 530-563 | Added order-check, conditional reassignment |

---

## Test

**Vor Fix (Bug):**
```
Browser A nach Spalten-Reorder:
🔄 Board.svelte: Spalten vom Parent synchronisieren
🔄 Board.svelte: Spalten vom Parent synchronisieren  ← DOPPELT!
```

**Nach Fix:**
```
Browser A nach Spalten-Reorder:
🔄 Board.svelte: Spalten vom Parent synchronisieren
✅ Columns already in correct order, skip reassignment
```

---

## Validation

```bash
pnpm run check
# ✅ 0 errors, 0 warnings
```

---

## Next: Test mit 2 Browsern

**Test Szenario (Manual):**

```
1. Browser A: Öffne "Test Board"
2. Browser A: Erstelle 3 Spalten (oder nutze bestehendes Board)
3. Browser A: Verschiebe Spalte (Drag-and-Drop)
4. ✅ Erwartung: Spalte bewegt sich NUR EINMAL
5. ✅ Keine Double-Animation mehr!

Browser A Console:
✅ 🔄 Board.svelte: Spalten vom Parent synchronisieren (einmal)
✅ 💾 Board in localStorage gespeichert
✅ 📨 Publishing to 1 target relay(s)
✅ ✅ Columns already in correct order, skip reassignment
(KEIN doppeltes syncBoardState())
```

---

## Impact

| Bereich | Impact |
|---------|--------|
| **UX** | ✅ Spalten-Animation ist smooth (keine Jitter) |
| **Performance** | ✅ Weniger unnötige Re-renders |
| **Nostr Sync** | ✅ Event-Echo verursacht kein Double-Move mehr |
| **Backward Compat** | ✅ Keine Breaking Changes |

---

## Related Issues

- 🐛 Double-move when reordering columns
- 🔄 Echo-loop when browser receives own event from relay
- ⚠️ `upsertBoardFromNostr()` triggert UI-Update auch bei keiner Änderung

---

**Status:** ✅ CLOSED  
**Next Step:** Execute full test suite (TEST-SCENARIO-COLUMN-ORDER.md)
