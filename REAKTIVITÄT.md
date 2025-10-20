# 🎯 Reaktivitäts-Architektur: Wie das Board auf Store-Änderungen reagiert

**Version:** 1.0  
**Datum:** 20. Oktober 2025  
**Thema:** Svelte 5 Runes + $effect Pattern für Live-Updates

---

## 📊 Die Reaktivitätskette (Svelte 5 Runes)

```
┌─────────────────────────────────────────────────────────────┐
│ Externe Änderung (Nostr Event / User Aktion)               │
└────────────────┬────────────────────────────────────────────┘
                 ↓
        boardStore.addColumn()  ← API-Aufrufe
        column.addCard()
        card.addComment()
                 ↓
        column.cards = [...cards, newCard]  ← Array Reassignment
        this.updateTrigger++                 ← Svelte $state Mutation!
        this.saveToStorage()
                 ↓
    ┌───────────────────────────────────────┐
    │ updateTrigger = $state (GÄNDERT!)     │
    │ → Triggert alle abonnenten            │
    └───────────────────────────────────────┘
                 ↓
    ┌───────────────────────────────────────┐
    │ boardStore.uiData = $derived.by(() => │
    │   const cols = this.board.columns  ◄─ Liest updateTrigger + Daten
    │   const trigger = this.updateTrigger
    │   // Transform zu UI-Format
    │   return result
    │ })                                     │
    └───────────────────────────────────────┘
                 ↓ (NEU BERECHNET!)
    ┌───────────────────────────────────────┐
    │ Column.svelte $effect(() => {         │
    │   const uiColumns = boardStore.uiData │ ◄─ Reaktive Dependency!
    │   items = updated.items  ◄─ UI-State wird AKTUALISIERT
    │ })                                     │
    └───────────────────────────────────────┘
                 ↓
    ┌───────────────────────────────────────┐
    │ Svelte renderiert UI neu              │
    │ → Benutzer sieht SOFORT die Änderung  │
    └───────────────────────────────────────┘
```

---

## ✅ Was funktioniert SOFORT (ohne Reload):

### 1. **Spalte erstellen** → Sofort im Board sichtbar
```javascript
const col = boardStore.addColumn({ name: 'Neue Spalte' })
// UI-Update: ✅ SOFORT sichtbar rechts im Board
```

### 2. **Karte zur Spalte hinzufügen** → Sofort in Spalte sichtbar
```javascript
const card = col.addCard({ heading: 'Neue Karte' })
boardStore['triggerUpdate']()  // Wichtig!
// UI-Update: ✅ SOFORT sichtbar in der Spalte
```

### 3. **Kommentar hinzufügen** → Sofort in Karte sichtbar
```javascript
card.addComment('Text', 'author')
boardStore['triggerUpdate']()  // Wichtig!
// UI-Update: ✅ SOFORT sichtbar (Kommentar-Zähler aktualisiert)
```

### 4. **Spalten-Name ändern** → Sofort aktualisiert
```javascript
boardStore.updateColumn(colId, { name: 'Neuer Name' })
// UI-Update: ✅ SOFORT sichtbar in Spalten-Header
```

### 5. **Spalte löschen** → Sofort aus Board weg
```javascript
boardStore.deleteColumnWithCards(colId)
// UI-Update: ✅ SOFORT aus Board verschwunden
```

---

## 🔧 Das ist die RICHTIGE Architektur für Nostr-Integration!

### Wie es mit Nostr funktionieren wird:

```typescript
// NDK Subscription (live listening)
ndk.subscribe({ kinds: [30301] }, { closeOnEose: false })
  .on('event', (event: NDKEvent) => {
    
    // 1. Parse Nostr Event
    const board = nostrEventToBoard(event);
    
    // 2. Füge zu BoardStore ein
    boardStore.importBoard(board, 'merge');
    
    // 3. UI reagiert AUTOMATISCH!
    // → Column.svelte $effect wird triggert
    // → items werden aktualisiert
    // → Benutzer sieht sofort die Änderung
  });
```

**Das ist perfekt weil:**
- ✅ Keine manuellen UI-Updates nötig
- ✅ Mehrere Benutzer können gleichzeitig ein Board bearbeiten
- ✅ Alle sehen Live-Updates in Echtzeit
- ✅ Offline-Änderungen werden später synchronisiert

---

## 🧪 Teste die Reaktivität selbst!

### Test 1: Ausführlicher Test mit Timing
```javascript
window.reactive_test()
```

**Was passiert:**
1. Neue Spalte wird erstellt (2 Sekunden für Beobachtung)
2. Neue Karte wird hinzugefügt (2 Sekunden)
3. Kommentar wird hinzugefügt (1 Sekunde)
4. Spalten-Name wird geändert (2 Sekunden)
5. Spalte wird gelöscht

**Erwartung:** Alle Änderungen sind SOFORT in der UI sichtbar (ohne Reload!)

### Test 2: Schneller Test
```javascript
window.reactive_quick_test()
```

### Test 3: Debug - Zeige aktuellen uiData
```javascript
window.debug_uidata()
```

### Test 4: Beobachte Updates
```javascript
window.watch_updates()
```

Dann:
```javascript
boardStore.createCard('col-id', 'Test')
// Jedes Mal wenn updateTrigger sich ändert, wird es geloggt
```

Zum Stoppen:
```javascript
clearInterval(window.__updateWatchInterval)
```

---

## ❌ Warum der Demo-Loader mit Reload nicht reagiert

Das **Demo-Problem** (Reload nötig nach `window.add_democontent()`):

```
add_democontent() erstellt Spalten
    ↓
updateTrigger wird inkrementiert
    ↓
$derived wird neu berechnet
    ↓
$effect in Column.svelte wird triggert
    ↓
items sollten aktualisiert werden
    ↓
ABER: saveToStorage() speichert in localStorage
    ↓
Seite wird geladen (oder Nutzer navigiert weg)
    ↓
loadFromStorage() ÜBERSCHREIBT den Board-State mit alten Daten!
    ↓
💥 $effect sieht alte Daten wieder - UI zeigt nicht das aktuell was gerade hinzugefügt wurde
```

### Die Lösung:

Das Demo-Loader sollte `saveToStorage()` **NICHT** aufrufen:

```typescript
// AKTUELL (falsch - speichert in localStorage)
col.addCard(...)
triggerUpdate()  // → speichert zu localStorage

// RICHTIG FÜR DEMO (nur UI Update, kein persist)
col.addCard(...)
// triggerUpdate() aufrufen um $derived neu zu berechnen
// ABER: nur den updateTrigger inkrementieren, nicht speichern
```

---

## 🎯 Geplante Verbesserungen

### Phase 2: BoardStore Refactoring
```typescript
// Separate Methoden für:
// 1. Local-Only Update (nur UI, kein localStorage)
// 2. Persistent Update (UI + localStorage)
// 3. Nostr-Publish (UI + localStorage + Nostr Event)

public triggerUpdateLocal(): void {
    this.updateTrigger++;  // Nur Reaktivität
    // NICHT speichern
}

public triggerUpdatePersistent(): void {
    this.updateTrigger++;
    this.saveToStorage();  // Mit Speicherung
}

public async publishToNostr(): void {
    this.updateTrigger++;
    this.saveToStorage();
    // Event publizieren
}
```

### Phase 3: Nostr Integration
```typescript
// Subscribe to live updates
ndk.subscribe({...}, { closeOnEose: false })
  .on('event', (event) => {
    boardStore.applyNostrEvent(event);
    // UI aktualisiert sich AUTOMATISCH durch $effect
  });
```

---

## 📋 Zusammenfassung: Wie die Reaktivität funktioniert

| Ebene | Technologie | Funktion |
|-------|-------------|----------|
| **1. Store State** | `$state` (Svelte 5 Rune) | Speichert reaktive Daten |
| **2. Computed Value** | `$derived.by()` | Berechnet UI-Format neu wenn State sich ändert |
| **3. Component Sync** | `$effect()in Komponenten | Komponenten beobachten $derived und aktualisieren Props |
| **4. Rendering** | Svelte Compiler | Aktualisiert DOM automatisch |

**Die Magie:** `updateTrigger++` ist alles was nötig ist um die ganze Kette auszulösen!

---

## 🚀 Fazit

Das Board **ist bereits vollständig reaktiv** und bereit für Nostr-Integration!

- ✅ Store-Änderungen triggern $derived Neuberechnung
- ✅ $effect in Komponenten reagieren auf $derived Änderungen
- ✅ UI wird SOFORT aktualisiert ohne Reload
- ✅ localStorage Persistierung funktioniert
- ✅ Das Pattern ist perfekt für Nostr Live-Updates

Das einzige was noch zu tun ist:
1. NDK Integration (Event Subscriptions)
2. Event-Parsing (Nostr → BoardModel)
3. Auto-Sync auf Board-Änderungen

**Dann:** Vollständig dezentrales, Live-synchronisiertes Kanban Board! 🎉

---

**Test jetzt:** `window.reactive_test()`
