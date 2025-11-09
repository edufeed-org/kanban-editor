# ✅ Manuelle Test-Ausführung: localStorage Consolidation (v1.4)

**Datum:** 9. November 2025  
**Fokus:** 5 Test-Szenarien + Spaltenreihenfolge-Bug

---

## 🚀 QUICK START - Setup in 2 Minuten

### Terminal 1 (Dev Server)

```bash
cd f:\code\svelte\nostr-cli
pnpm run dev
# Output sollte sein: "Local: http://localhost:5173"
```

### Terminal 2 (Open Browsers)

```bash
# Browser A: http://localhost:5173 (erste Tab)
# Browser B: http://localhost:5173 (zweite Tab nebeneinander)
# Beide Console öffnen: F12 → Console Tab
```

---

## 📋 Test Scenario 1: Board Creation (Browser A)

**Ziel:** ✅ Neues Board sollte sofort sichtbar sein

### Schritte

```
1. Browser A Dashboard: Leer (0 Boards)
2. Klicke "+Neues Board"
3. Gib ein: "Test Board A"
4. Klicke "Erstellen"
```

### Erwartetes Verhalten

✅ **Sofort:**
- Board "Test Board A" erscheint in der Liste
- Kann sofort geklickt werden

✅ **Nach Reload (F5):**
- Board ist NOCH IMMER in der Liste
- Keine "verlorenen" Boards

✅ **Console Check (F12 → Console)**
```javascript
// Tippe in Browser A Console:
JSON.parse(localStorage.getItem('kanban-boards-metadata')).map(b => ({ id: b.id, name: b.name }))

// Output sollte sein:
// [{id: "...", name: "Test Board A"}]
```

### ✅ Success: Bestätigung

- [ ] Board erscheint sofort
- [ ] Board bleibt nach Reload
- [ ] localStorage hat nur 1 Board in kanban-boards-metadata
- [ ] Kein Eintrag in kanban-boards-list

**Status:** ✅ PASS / ❌ FAIL

---

## 📋 Test Scenario 2: Cross-Browser Board Visibility (Nostr Sync)

**Ziel:** Browser B erstellt Board → Browser A sollte es sehen

### Schritte

```
1. Browser A: Dashboard offen (zeigt "Test Board A")
2. Browser B: Dashboard offen
3. Browser B: Klicke "+Neues Board"
4. Browser B: Gib ein: "Test Board B"
5. Browser B: Klicke "Erstellen"
6. Browser B: Warte 3 Sekunden (Nostr Sync)
7. Browser A: Check ob "Test Board B" sichtbar ist
```

### Erwartetes Verhalten

✅ **Browser B:**
- Board "Test Board B" erscheint sofort

✅ **Browser A (nach ~2-3 Sekunden):**
- "Test Board B" erscheint in der Liste
- Sortierung: Newest first
  - Test Board B (gerade erstellt)
  - Test Board A (älter)

✅ **Console Check (beide Browser)**
```javascript
// Browser A Console:
JSON.parse(localStorage.getItem('kanban-boards-metadata'))
  .sort((a,b) => new Date(b.lastAccessed) - new Date(a.lastAccessed))
  .map(b => b.name)

// Output: ["Test Board B", "Test Board A"]
```

### ✅ Success: Bestätigung

- [ ] Browser B: Board erscheint sofort
- [ ] Browser A: Board erscheint nach 2-3 Sekunden
- [ ] Sortierung: Newest first korrekt
- [ ] localStorage konsistent zwischen Browsern

**Status:** ✅ PASS / ❌ FAIL

---

## 📋 Test Scenario 3: Board Sorting by lastAccessed

**Ziel:** Boards sollten nach lastAccessed sortiert sein (newest first)

### Schritte

```
1. Browser A: Dashboard
2. Klicke "Test Board A" (um zu öffnen → lastAccessed updated)
3. Warte 2 Sekunden
4. Dashboard zurück (klicke Branding/Logo)
5. Check: Reihenfolge sollte sein:
   - Test Board A (gerade geöffnet!)
   - Test Board B (älter)
```

### Erwartetes Verhalten

✅ **Nach Board-öffnen:**
- Board zu oben verschoben (lastAccessed updated)
- Neue Sortierung:
  - Test Board A (lastAccessed: gerade)
  - Test Board B (lastAccessed: älter)

✅ **localStorage Integrity**
```javascript
// Browser A Console:
const boards = JSON.parse(localStorage.getItem('kanban-boards-metadata'));
const sorted = boards.sort((a,b) => 
  new Date(b.lastAccessed) - new Date(a.lastAccessed)
);
console.log(sorted.map(b => ({ name: b.name, accessed: b.lastAccessed })));

// Output: 
// [{name: "Test Board A", accessed: "2025-11-09T12:34:56.789Z"},
//  {name: "Test Board B", accessed: "2025-11-09T12:34:54.123Z"}]
```

### ✅ Success: Bestätigung

- [ ] Board A an Position 1 nach öffnen
- [ ] Board B an Position 2
- [ ] lastAccessed Timestamps korrekt
- [ ] Sortierung persistent nach Reload

**Status:** ✅ PASS / ❌ FAIL

---

## 📋 Test Scenario 4: Offline-Online Sync

**Ziel:** Offline-erstellte Boards sollten bei Online-Verbindung synced werden

### Schritte

```
1. Browser A: F12 → Network Tab
2. Dropdown: "Throttling" → "Offline"
3. Browser A Dashboard: Klicke "+Neues Board"
4. Gib ein: "Offline Board"
5. Klicke "Erstellen"
6. Browser B: Sollte NICHT sichtbar sein (noch offline)
7. Browser A: Network → "Online" wieder aktivieren
8. Browser A: Warte 3 Sekunden
9. Browser B: Dashboard refresh (F5)
10. Check: "Offline Board" sollte sichtbar sein
```

### Erwartetes Verhalten

✅ **Browser A (Offline Mode):**
- Board erstellt und lokal sichtbar
- localStorage hat Board

✅ **Browser B (Online, vor Sync):**
- "Offline Board" NICHT sichtbar

✅ **Browser B (Online, nach 3 Sekunden):**
- "Offline Board" erscheint via Nostr Sync!

### ✅ Success: Bestätigung

- [ ] Board lokal erstellt im Offline-Mode
- [ ] Board synced zu Browser B nach Online
- [ ] localStorage hat alle 3 Boards
- [ ] Keine Fehler in Console

**Status:** ✅ PASS / ❌ FAIL

---

## 📋 Test Scenario 5: localStorage Integrity Check

**Ziel:** Nur noch EIN Key für Board-Liste sollte existieren

### Browser A Console Commands

```javascript
// ✅ 1. RICHTIG (nach Refactoring):
Object.keys(localStorage)
  .filter(k => k.includes('board'))
  .sort()

// Expected Output:
// [
//   "kanban-boards-metadata",    // ← RICHTIG (Single Source of Truth)
//   "kanban-board-abc123",       // (aktuelle Boards, egal)
//   "kanban-board-def456",
//   "kanban-board-ghi789",
// ]
// 
// NICHT:
// ❌ "kanban-boards-list"  (sollte nicht existieren!)
```

```javascript
// ✅ 2. Prüfe Struktur von kanban-boards-metadata:
JSON.parse(localStorage.getItem('kanban-boards-metadata'))

// Expected Output:
// [
//   {
//     id: "...",
//     name: "Test Board A",
//     description: "",
//     lastAccessed: "2025-11-09T12:34:56.789Z",
//     author: "",
//     publishState: "draft"
//   },
//   {...}
// ]
```

```javascript
// ✅ 3. Prüfe: Keine Duplikate
const meta = JSON.parse(localStorage.getItem('kanban-boards-metadata'));
const ids = meta.map(b => b.id);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('Duplikate:', duplicates.length === 0 ? '✅ Keine' : duplicates);
```

### ✅ Success: Bestätigung

- [ ] Nur 1 Key für Board-Liste: `kanban-boards-metadata`
- [ ] Struktur hat alle Felder: id, name, description, lastAccessed, author, publishState
- [ ] Keine Duplikate in Board-Liste
- [ ] Keine `kanban-boards-list` Key

**Status:** ✅ PASS / ❌ FAIL

---

## 🐛 Test Scenario 6: Spaltenreihenfolge-Sync Bug

**Ziel:** Prüfe ob BoardB die Spaltenreihenfolge nochmal zu Nostr publiziert

### Setup

```
1. Browser A: Öffne "Test Board A"
2. Browser A: Erstelle 3 Spalten: "Todo", "In Progress", "Done"
3. Browser A: Warte bis Nostr sync (3 Sekunden)
4. Browser B: Klicke auf "Test Board A" (sollte die 3 Spalten laden)
5. Browser B: Warte bis vollständig geladen
```

### Test: Spaltenreihenfolge ändern

**Browser A:**
```
1. Öffne "Test Board A" Board-View
2. Ziehe Spalte "Done" an erste Position (Drag-and-Drop)
3. Neue Reihenfolge sollte sein: "Done", "Todo", "In Progress"
```

**Browser B Console (Logging aktivieren):**
```javascript
// Öffne Browser B Console
// Du solltest sehen:

// RICHTIG (✅):
// 📥 Board-Event erhalten: xxx
// 📝 Updating current board from Nostr: Test Board A
// 🔄 Synchronized 3 columns from Nostr
// triggerUpdate({ publish: false }) ← publish: false!
// (kein weiteres publishBoardAsync() sollte folgen!)

// FALSCH (❌) - Das ist der Bug:
// 📥 Board-Event erhalten: xxx
// 🔄 Synchronized 3 columns from Nostr
// 📨 Board-Event published to 3 relays  ← PROBLEM! Sollte nicht sein!
// 📨 Board-Event published to 3 relays  ← DUPLIKAT!
```

### Expected Nostr Event Count

**Browser A:**
- Event 1: Spalte-Reorder publiziert
- Event Count: 1

**Browser B (Receiving):**
- Nostr-Subscription empfängt Event
- Re-publish: 0 (publish: false!)
- Event Count (B published): 0

**Wenn Bug existiert:**
- Browser B publiziert erneut
- Event Count (B published): 1+
- Result: ❌ FAIL - Unnecessary duplicate event!

### ✅ Success: Bestätigung

- [ ] Browser A: 1 Event publiziert (Spalten-Reorder)
- [ ] Browser B: Event empfangen (Console zeigt Log)
- [ ] Browser B: KEIN Event re-publiziert (publish: false!)
- [ ] Spaltenreihenfolge korrekt in beiden Browsern

**Status:** ✅ PASS / ❌ FAIL / 🔴 BUG_CONFIRMED

---

## 📊 Test Summary

Trage nach jedem Test das Ergebnis ein:

| Test | Scenario | Status | Notes |
|------|----------|--------|-------|
| 1 | Board Creation (A) | ✅ / ❌ | |
| 2 | Cross-Browser (B→A) | ✅ / ❌ | |
| 3 | Sorting by lastAccessed | ✅ / ❌ | |
| 4 | Offline-Online Sync | ✅ / ❌ | |
| 5 | localStorage Integrity | ✅ / ❌ | |
| 6 | Column Order Bug | ✅ / ❌ / 🔴 | |

---

## 🔧 Debugging Tipps

**Wenn Test fehlschlägt:**

### 1. Console in beiden Browsern öffnen
```javascript
// Suche nach ERROR oder WARNING Meldungen
// Vor allem:
// - "localStorage not available"
// - "cannot read property of undefined"
// - "Board has no ID"
```

### 2. Network Tab checken (DevTools)
```
1. DevTools → Network Tab
2. Filter: "wss://" (WebSocket-Events)
3. Schaue nach Nostr-Events (sollten klein sein, JSON-like)
```

### 3. localStorage Inspector
```javascript
// In Console:
console.table(JSON.parse(localStorage.getItem('kanban-boards-metadata')))
// Zeigt alle Boards in Tabellen-Format
```

### 4. Full Cache Clear
```bash
# Wenn du neu starten willst:
# DevTools → Application → Storage → Clear all
# Oder: localStorage.clear()
```

---

## ⚠️ Known Issues

1. **"Board has no ID"** - Kann passieren bei Nostr-Events mit fehlender d-tag
2. **Double-publishes** - Das ist der Bug den du debuggen sollst (Test 6)
3. **Slow Nostr Sync** - Kann 3-5 Sekunden dauern (normal)

---

**Nächste Schritte nach Tests:**

✅ Wenn alle Tests PASS:
- localStorage Consolidation ist **ERFOLGREICH**
- Kann zu Phase 2 übergehen

❌ Wenn Test fehlschlägt:
- Dokumentiere welcher Test failed
- Zeige Console-Fehler
- Debugge mit dem Test-Plan TEST-SCENARIO-COLUMN-ORDER.md

🔴 Wenn Test 6 BUG_CONFIRMED:
- Der "double-publish" Bug ist real
- Debugge mit bisection/breakpoint
- Fix dann im nächsten Session

**Ready?** Start mit Test 1! 🚀
