# 🧪 Quick Test: Demo-Loader Reaktivität

**Problem:** Demo-Loader hat nicht sofort reagiert, nur nach Reload.  
**Root Cause:** `_columnOrder` wurde nicht aktualisiert bei `addColumn()`.  
**Fix:** `addColumn()` und `deleteColumn()` aktualisieren jetzt `_columnOrder`.

---

## 🚀 Test durchführen

### 1. Terminal
```bash
pnpm run dev
```

### 2. Browser
```
http://localhost:5173/cardsboard
```

### 3. Console (F12)
```javascript
window.reset_board()
window.add_democontent()
```

### 4. Ergebnis erwartet

**SOFORT sichtbar (ohne Reload):**
- ✅ 3 neue Spalten im Board (rechts)
- ✅ Spalten haben Karten
- ✅ Karten haben Labels & Farben
- ✅ Console zeigt Fortschritt

**Test erfolgreich wenn:**
- Board zeigt alle Demo-Spalten sofort
- Keine Refresh/Reload nötig
- Console logs zeigen "🔄 uiData wird neu berechnet..."

---

## 📊 Was wurde gefixt

```typescript
// VORHER (kaputt):
public addColumn(props: ColumnProps) {
    return this.board.addColumn(props);
    // _columnOrder wurde NICHT aktualisiert!
    // uiData filtert nach _columnOrder
    // → Neue Spalte wurde nicht angezeigt
}

// NACHHER (fixed):
public addColumn(props: ColumnProps) {
    const column = this.board.addColumn(props);
    // _columnOrder wird AKTUALISIERT
    this._columnOrder = [...this._columnOrder, column.id];
    return column;
    // uiData sieht die neue Spalte jetzt!
}
```

---

## 🔍 Debug-Tipps wenn noch nicht OK

### Check 1: Spalte wird erstellt?
```javascript
window.show_board()
// Schaue ob 3 Spalten in den logs auftauchen
```

### Check 2: updateTrigger wird inkrementiert?
```javascript
window.watch_updates()
// Schaue ob "Update erkannt!" messages kommen
// Wenn nicht: triggerUpdate() wird nicht aufgerufen
```

### Check 3: uiData wird neu berechnet?
```javascript
window.debug_uidata()
// Schaue ob Spalten/Karten auftauchen
// Wenn nicht: $derived.by funktioniert nicht
```

### Check 4: Board.svelte $effect funktioniert?
```javascript
// Öffne Browser DevTools Sources
// Setze Breakpoint in Board.svelte $effect (Zeile ~78)
// Führe aus: window.add_democontent()
// Wenn Breakpoint hit: $effect wird triggert ✅
```

---

## 🎯 Erwarteter Datenfluss jetzt

```
window.add_democontent()
    ↓
boardStore.addColumn() aufgerufen
    ↓
board.addColumn() erzeugt neue Column
    ↓
_columnOrder = [..._columnOrder, column.id] ← FIX!
    ↓
triggerUpdate() aufgerufen
    ↓
updateTrigger++ ($state mutation)
    ↓
boardStore.uiData $derived.by neu berechnet
    ↓
uiData liest _columnOrder und findet neue Spalte ← WICHTIG!
    ↓
+page.svelte columns = $derived.by() aktualisiert
    ↓
Board.svelte $effect beobachtet columns_inner Änderung
    ↓
columns = [...columns_inner] aktualisiert
    ↓
✨ UI rendert neue Spalte SOFORT!
```

---

**Bereit zum Test!** 🚀
