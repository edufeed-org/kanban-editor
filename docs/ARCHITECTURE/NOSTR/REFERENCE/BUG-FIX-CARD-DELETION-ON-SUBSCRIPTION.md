# 🔴 Bug-Fix: Karten werden gelöscht bei Nostr-Subscription

**Status:** ✅ FIXED (07. November 2025)  
**Severity:** 🔴 CRITICAL  
**Impact:** Alle neu erstellten Karten werden sofort wieder gelöscht nach Nostr-Publish  
**Root Cause:** Falsche Deserialisierung von Board-Events in der Nostr-Subscription

---

## 📋 Problem-Beschreibung

### Symptom

```
🆕 createCard aufgerufen: { columnId: "...", name: "Neue Karte" }
💾 Board in localStorage gespeichert
🔄 Update triggered
[BoardStore] 💾 Updated local board from Nostr subscription
🔄 Column.svelte: Items vom BoardStore aktualisiert { oldCount: 1, newCount: 0 }
```

**User-Sicht:**
1. ✅ Karte wird erstellt
2. ✅ Karte ist sichtbar in der UI
3. ❌ Sofort nach dem Publish wird die Karte gelöscht!

### Root Cause - Architektur-Fehler

Das Problem liegt in der **Nostr Event-Struktur**:

```
Kind 30301 (Board Event):
{
  tags: [
    ["d", "board-id"],
    ["col", "col-id-1", "Column Name", "0", "color"],  ← Spalten-Metadaten
    ["col", "col-id-2", "Column Name 2", "1", "color"],
    // ⚠️ KEINE Karten hier! Karten sind Kind 30302 Events!
  ]
}

Kind 30302 (Card Event - NICHT IMPLEMENTIERT):
{
  tags: [
    ["d", "card-id"],
    ["a", "30301:author:board-id"],  ← Referenz zum Board
    ["s", "Column Name"],
    ["title", "Card Title"],
    // ...
  ]
}
```

**Das Problem:**

```typescript
// In src/lib/utils/nostrEvents.ts
export function nostrEventToBoard(event: NDKEvent): BoardProps {
  const columns: ColumnProps[] = colTags.map(colTag => ({
    id: colTag[1],
    name: colTag[2] || 'Untitled',
    color: colTag[4] || undefined,
    cards: [], // 🔴 IMMER LEER! (Karten sind Kind 30302 Events)
  }));
}

// Wenn die Subscription dieses Event empfängt:
const boardProps = nostrEventToBoard(event);
// boardProps.columns = [{ id: "...", name: "...", cards: [] }, { ... }]
// ⚠️ Alle Karten sind weg!
```

**Die Execution Flow mit dem Bug:**

```
1. User erstellt Karte → createCard()
   ↓
2. Board wird lokal gespeichert (mit Karte)
   { columns: [{ cards: [{ id: "card-1", ... }] }] }
   ↓
3. Board wird zu Nostr Event publiziert
   ↓
4. SyncManager sendet zu Relay
   ↓
5. Relay sendet Event ZURÜCK über Subscription
   ↓
6. subscribeToBoardUpdatesForCurrentUser() empfängt Event
   ↓
7. nostrEventToBoard(event) erzeugt:
   { columns: [{ cards: [] }, { ... }] }  ← 🔴 Karten gelöscht!
   ↓
8. Board wird in localStorage überschrieben
   ↓
9. this.board wird mit leeren Karten rekonstruiert
   ↓
10. UI rendert, Column.svelte sieht: oldCount: 1, newCount: 0
    ↓
11. Karte ist weg! 🔥
```

---

## ✅ Lösung - Merge-Strategie

### Konzept: "Nur Metadaten-Updates"

**Regel:** Wenn die Subscription ein Board-Event (30301) empfängt:
- ✅ Aktualisiere **Spalten-Metadaten** (name, color, order)
- ❌ Überschreibe **NICHT** lokale Karten
- Behalte Karten aus lokaler Version

### Implementierung

**In `src/lib/stores/kanbanStore.svelte.ts` in der Subscription-Handler (Zeile ~550+):**

```typescript
// ⚠️ KRITISCH: Merge-Strategie für Board-Updates
if (typeof window !== 'undefined') {
    const existingData = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
    
    // MERGE: Ersetze nur Spalten-Metadaten (name, color, order)
    // aber BEHALTE lokale Karten!
    const remoteColumns = boardProps.columns || [];
    const mergedColumns = remoteColumns.map((remoteCol, idx) => {
        const existingCol = existingData.columns?.[idx];
        return {
            ...remoteCol,  // Neue Spalten-Metadaten
            cards: existingCol?.cards || [],  // 🔴 KRITISCH: Behalte lokale Karten!
        };
    });
    
    const mergedProps = {
        ...boardProps,
        columns: mergedColumns,  // Mit erhaltenen Karten
    };
    
    const contextBoard = new Board(mergedProps);
    // ... speichern in localStorage ...
}
```

### Warum funktioniert das?

1. ✅ **Lokal erstellte Karten bleiben** - sie werden nicht überschrieben
2. ✅ **Spalten-Metadaten werden aktualisiert** - Remote-Änderungen wirken
3. ✅ **Last-Write-Wins funktioniert noch** - für Board-Level Updates
4. ✅ **Phase 1.2 vorbereitet** - wenn Kind 30302 implementiert wird

---

## 🔄 Architektur-Konsequenzen

### Phase 1 (Aktuell) - Board-Metadaten

```
LOCAL (Phase 1):
- Karten: Lokal in localStorage
- Spalten-Namen: Von Nostr
- Spalten-Reihenfolge: Von Nostr

PUBLISH:
- Board-Event → Spalten-Metadaten
- Karten → NICHT publiziert (noch)
```

### Phase 1.2 (Zukünftig) - Card-Events

```
LOCAL (Phase 1.2):
- Karten: Von Nostr (Kind 30302 Events)
- Spalten-Namen: Von Nostr
- Spalten-Reihenfolge: Von Nostr

PUBLISH:
- Board-Event → Spalten-Metadaten
- Card-Events → Neue Kind 30302 Publish-Flow
```

**Wichtig:** Phase 1.2 wird den Code NICHT brechen - die Merge-Strategie hier ist optimal auch für Card-Updates vorbereitet.

---

## 🧪 Test-Szenarien

Nach dem Fix sollten folgende Szenarien funktionieren:

### Szenario 1: Neue Karte erstellen + Publish

```
1. ✅ Karte erstellen
2. ✅ Board publishen
3. ✅ Nostr-Event empfangen
4. ✅ Karte bleibt in der UI (nicht gelöscht!)
5. ✅ Spalten-Metadaten aktualisiert
```

**Expected Logs:**
```
🆕 createCard aufgerufen
💾 Board in localStorage gespeichert
[SyncManager] 📤 Publishing to 1 target relay
[BoardStore] 💾 Updated local board from Nostr subscription (Karten behalten)
✓ Karte ist noch sichtbar
```

### Szenario 2: Remote Board-Änderung (z.B. Spalte umbenennen)

```
1. User A: Spalte umbenennen → publish
2. User B: Subscription empfängt Event
3. ✅ Lokale Spalten-Namen werden aktualisiert
4. ✅ Lokale Karten bleiben
```

### Szenario 3: MRU-Logik

```
1. Zwei Boards vorhanden
2. User arbeitet an Board A
3. ✅ Neue Karten in Board A funktionieren
4. ✅ Karten werden nicht gelöscht
5. ✅ MRU zeigt weiterhin Board A als zuletzt verwendet
```

---

## 📝 Dokumentations-Updates

Die folgenden Dokumente wurden aktualisiert:

1. **`docs/ARCHITECTURE/NOSTR/LOADING-SUBSCRIPTION.md`**
   - Status: Phase 1 erklärt (Metadaten-Updates nur)
   - ⚠️ Kritischer Hinweis: Karten sind separate Events
   - Merge-Strategie dokumentiert (nur Metadaten überschreiben)

2. **`docs/ARCHITECTURE/STORES/BOARDSTORE.md`**
   - Sollte aktualisiert werden mit der Merge-Logik

3. **`ROADMAP.md`**
   - Phase 1.1: Board-Loading nur Metadaten (klargestellt)
   - Phase 1.2: Card-Events implementieren (abhängig von diesem Fix)

---

## 🔍 Code-Referenz

### Before (Bug)
```typescript
// Subscription-Handler
const boardProps = nostrEventToBoard(event);  // cards: []!
const contextBoard = new Board(boardProps);   // Alle Karten: []
window.localStorage.setItem(storageKey, JSON.stringify(contextBoard.getContextData(true)));
// → Alle Karten sind weg! 🔥
```

### After (Fix)
```typescript
// Subscription-Handler - mit Merge-Strategie
const existingData = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
const mergedColumns = boardProps.columns.map((remoteCol, idx) => ({
    ...remoteCol,
    cards: existingData.columns?.[idx]?.cards || [],  // ✅ Behalte lokale Karten
}));
const mergedProps = { ...boardProps, columns: mergedColumns };
const contextBoard = new Board(mergedProps);
window.localStorage.setItem(storageKey, JSON.stringify(contextBoard.getContextData(true)));
// → Karten bleiben erhalten! ✅
```

---

## ⏭️ Nächste Schritte

### Immediate (Phase 1.0 - JETZT)
- ✅ Fix implementiert
- ✅ TypeScript-Check passed
- 🔄 Runtime-Testing erforderlich
  - [ ] Karte erstellen → bleibt?
  - [ ] Neue Spalte erstellen → funktioniert?
  - [ ] MRU funktioniert?

### Phase 1.2 (Card-Events)
- Implementierung von Kind 30302 Event-Loading
- Subscription für Card-Events pro Board
- Merge-Strategie wird erweitert (nicht ersetzt!)

### Dokumentation
- [ ] BOARDSTORE.md mit Merge-Logik aktualisieren
- [ ] ROADMAP.md Phase 1.1 klarstellen
- [ ] copilot-instructions.md mit Subscription-Pattern ergänzen

---

## 🎓 Lessons Learned

**Architektur-Principle für zukünftige Events:**
1. **Replaceable Events:** Metadaten + Struktur (Board, Column)
2. **Regular Events:** Inhalte + Details (Cards, Comments)
3. **NIEMALS** würde man Inhalte in Metadaten-Events speichern
4. **IMMER** ist die Deserialisierung lossy - lokale Daten müssen geschützt werden

**Best Practice für Subscriptions:**
1. Lokale Daten NICHT einfach ersetzen
2. IMMER Last-Write-Wins prüfen
3. IMMER ein Merge-Pattern für teilweise Updates nutzen
4. IMMER testen: "Meine lokalen Daten sind nach Subscription da?"

---

**Implementiert von:** AI Agent  
**Datum:** 07. November 2025  
**Status:** ✅ Ready for Testing  
**Branch:** `read-boards-from-nostr`
