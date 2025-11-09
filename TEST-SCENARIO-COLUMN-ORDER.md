# 🧪 Test Scenario: Spaltenreihenfolge-Sync (Bug Hunt)

**Problem:** BoardB publiziert Spaltenreihenfolge nochmal zu Nostr, obwohl `publish: false` gesetzt ist

**Status:** 🔴 INVESTIGATING

---

## Test Setup

### Browser A & B Vorbereitung

```
1. Öffne http://localhost:5173/ in Browser A
2. Öffne http://localhost:5173/ in Browser B (Side-by-Side)
3. Browser A: Erstelle "Test Board"
4. Browser A: Erstelle 3 Spalten: "Todo", "In Progress", "Done"
5. Browser A: Warte bis Nostr Subscription Browser B aktualisiert
```

---

## Test Szenario 1: Spalten-Reihenfolge ändern (Browser A)

### Schritte

```
1. Browser A: Öffne "Test Board"
2. Browser A: Ziehe Spalte "Done" nach vorne (Drag-and-Drop)
3. Browser A: Neue Reihenfolge: "Done", "Todo", "In Progress"
```

### Browser A - Erwartetes Verhalten

```
✅ Spalten-Reihenfolge aktualisiert lokal
✅ Board zu Nostr publiziert (PRIMARY action)

Console Log erwartet:
  ✓ handleCardMove(): triggerUpdate() → publishBoardAsync()
  ✓ publishBoardAsync() → publiziert mit neuer Spaltenreihenfolge
  ✓ 📨 Board-Event published to 3 relays
```

### Browser B - Erwartetes Verhalten

```
✅ Subscription empfängt Board-Event
✅ handleBoardEvent() called
✅ upsertBoardFromNostr() called (SECONDARY action)
✅ Spalten-Reihenfolge aktualisiert
✅ triggerUpdate({ publish: false }) → publish: false!

Console Log erwartet (Browser B):
  ✓ 📥 Board-Event erhalten: xxx
  ✓ upsertBoardFromNostr: Test Board
  ✓ 🔄 Synchronized 3 columns from Nostr
  ✗ ❌ KEIN "📨 Board-Event published" (weil publish: false!)
```

### ⚠️ BUG: Was könnte falsch sein?

```
Mögliche Ursachen:

1. ❌ publish: false wird ignoriert
   → Check: triggerUpdate() Methode Line 211

2. ❌ Ein Watcher/Effect triggert publishBoardAsync()
   → Check: $effect im kanbanStore (Lines 150-250)

3. ❌ updateTrigger++ triggert publish-Logik
   → Check: Gibt es einen subscribe() auf updateTrigger?

4. ❌ saveToStorage() triggert publish
   → Check: saveToStorage() Methode (macht kein publish)

5. ❌ Direkter Aufruf zu publishBoardAsync()
   → Check: Gibt es Code der immer publishBoardAsync() aufruft?
```

---

## Debug-Console Commands

Führe diese Browser-Console Commands aus, um zu debuggen:

### 1. Logging aktivieren

```javascript
// In Browser B Console nach dem Empfang des Board-Events:

// Checkpoint: War publish: false gesetzt?
console.log('ℹ️ Suche nach upsertBoardFromNostr() Aufrufen');
console.log('  → Sollte triggerUpdate({ publish: false }) aufrufen');

// Checkpoint: Was wurde publiziert?
console.log('⏩ Suche nach alle publishBoardAsync() Aufrufe');
console.log('  → Nach upsertBoardFromNostr sollte KEINE publish sein!');
```

### 2. Prüfe _columnOrder Update

```javascript
// In Browser B Console:
localStorage.setItem('DEBUG_columnOrder', 'watch_this');

// Nach Board-Event-Update:
console.log('Aktuelle _columnOrder:', boardStore._columnOrder);
console.log('Board.columns:', boardStore.board.columns.map(c => c.id));
```

### 3. Trace publishBoardAsync() Calls

```javascript
// Patch publishBoardAsync() zum Tracen:
// (Nur wenn du Source-Code editierst)

const originalPublish = boardStore.publishBoardAsync.bind(boardStore);
boardStore.publishBoardAsync = async function() {
    console.trace('📨 publishBoardAsync() called from:');
    return originalPublish();
};
```

---

## Test Szenario 2: Spalten umbenennen (Browser A)

### Schritte

```
1. Browser A: Öffne "Test Board"
2. Browser A: Klicke auf Spalten-Header "Todo"
3. Browser A: Bearbeite Namen zu "Backlog"
4. Browser A: Klicke Speichern
```

### Erwartetes Verhalten

```
✅ Browser A: Lokal aktualisiert
✅ Browser A: publishBoardAsync() aufgerufen (PRIMARY)
✅ Browser B: Subscription empfängt Event
✅ Browser B: upsertBoardFromNostr() → triggerUpdate({ publish: false })
✗ Browser B: KEIN weiteres publish!
```

---

## Test Szenario 3: Mehrfache Spalten-Reorder (Browser A)

### Schritte

```
1. Browser A: Öffne "Test Board"
2. Browser A: Drag-and-Drop Spalte 1 nach Position 3
3. Browser A: Warte 2 Sekunden
4. Browser A: Drag-and-Drop Spalte 2 nach Position 1
5. Browser A: Warte 2 Sekunden
6. Browser A: Check Nostr-Event Count
```

### Console-Filter (Browser A)

```javascript
// Zähle alle Board-Events die publiziert wurden:
// Erwartung: GENAU 2 Events (eines für jeden Reorder)
// Nicht mehr!

// In Dev-Tools Network-Tab:
// → Filter für "wss://" (WebSocket)
// → Zähle wie viele Board-Events gesendet wurden
```

---

## Hypothese: Der Bug

**Vermutung:** Nach `upsertBoardFromNostr()` wird direkt `publishBoardAsync()` aufgerufen, obwohl es nicht sollte.

**Warum?**
- ✅ Code sagt `publish: false`
- ❓ Aber trotzdem passiert publish
- 🔴 = Irgendwo wird der Flag ignoriert oder überschrieben

**Möglicher Ort:** 
- Line 217 in `triggerUpdate()` - Der else-Fall könnte problematisch sein
- Oder ein $effect der auf `updateTrigger` abhängt

---

## Fix-Strategie (wenn Bug bestätigt)

```typescript
// Option 1: Expliziter Flag statt publish-Parameter
private isProcessingNostrEvent = false;

public upsertBoardFromNostr(boardProps: BoardProps): void {
    this.isProcessingNostrEvent = true;
    // ... rest of code ...
    this.triggerUpdate({ publish: false });
    this.isProcessingNostrEvent = false;
}

// Dann in publishToNostr():
private publishToNostr(): void {
    if (this.isProcessingNostrEvent) {
        console.log('⏩ Skipping publish (processing Nostr event)');
        return;
    }
    this.publishBoardAsync();
}

// Option 2: publishBoardAsync() NICHT aufrufen in triggerUpdate()
// Sondern NUR in Primary Actions
private triggerUpdate(options?: { publish?: boolean }): void {
    this.updateTrigger++;
    this.saveToStorage();
    
    if (options?.publish !== false) {
        this.publishBoardAsync();  // ← Das ist korrekt!
    }
}
```

---

## Success Criteria

- [ ] Board-Event wird nur EINMAL pro Spalten-Änderung publiziert (in Browser A)
- [ ] Browser B empfängt Event OHNE erneut zu publizieren
- [ ] Console zeigt `triggerUpdate({ publish: false })` ohne nachfolgendes publish
- [ ] Spalten-Reihenfolge in Browser A+B identisch nach Sync

---

**Nächster Schritt:** 
1. Führe Test Szenario 1 aus
2. Öffne Browser B Console
3. Beobachte was nach Board-Event passiert
4. Report hier: Wird `publishBoardAsync()` trotz `publish: false` aufgerufen?

**Debugging-Tipp:** Setze einen Breakpoint in `triggerUpdate()` Zeile 217 und schaue ob der Code erwartet ausgeführt wird.
