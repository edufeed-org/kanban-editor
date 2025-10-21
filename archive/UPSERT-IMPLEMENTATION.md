# Upsert-Implementierung für Nostr Card Synchronisation

**Datum:** 20. Oktober 2025  
**Status:** ✅ Implementiert und getestet  
**Version:** 1.0

## Überblick

Implementierung einer **Upsert-Operation** (Update or Insert) für Kanban-Karten. Dies ist essentiell für die Synchronisation mit Nostr Events, wo Karten eine eindeutige `d-tag` ID haben und nicht dupliziert werden dürfen.

### ⚠️ WICHTIG: Svelte 5 $effect Pattern

**Diese Implementierung nutzt das neue Svelte 5 `$effect` Pattern:**

- ✅ **Model-Layer (BoardModel.ts):** Board, Column, Card Klassen (keine Reaktivität nötig)
- ✅ **Store-Layer (kanbanStore.svelte.ts):** BoardStore mit `$state`, `$derived.by`, `triggerUpdate()`
- ✅ **Component-Layer (Column.svelte, Card.svelte):** `$effect` für Auto-Sync mit Store
- ❌ **NICHT:** Direkt `board.upsertCard()` aufrufen (keine Reaktivität!)
- ❌ **NICHT:** Card Props direkt mutieren (ownership_invalid_mutation Warning!)

**Regel:** Immer `boardStore.upsertCard()` nutzen, NICHT `board.upsertCard()`!


## Problem

Wenn eine Karte aus Nostr geladen wird (z.B. Kind 30302 Event mit `d-tag`), könnte sie:
- ❌ Dupliziert werden (neue Karte statt Update)
- ❌ In der falschen Spalte landen
- ❌ Mehrfach existieren

**Lösung:** Spaltenübergreifende `upsertCard()` die nach ID sucht und:
- **Wenn gefunden:** Die bestehende Karte aktualisieren
- **Wenn nicht gefunden:** Neue Karte in der Zielspalte erstellen

## Implementierte Änderungen

### 1. CardProps Interface (BoardModel.ts)

```typescript
export interface CardProps {
    id?: string;
    heading: string;
    content?: string;
    // ... andere Felder
    author?: string; // ← NEU: Nostr Public Key (npub) - Ersteller
}
```

### 2. Card Klasse (BoardModel.ts)

```typescript
export class Card {
    public author?: string; // ← NEU: Nostr npub des Erstellers
    
    update(props: Partial<CardProps>): void {
        // ... andere Updates
        if (props.author !== undefined) this.author = props.author;
        this.updatedAt = generateTimestamp();
    }
}
```

### 3. Board.upsertCard() (BoardModel.ts)

**Spaltenübergreifende Upsert-Logik:**

```typescript
upsertCard(targetColumnId: string, cardProps: CardProps): Card {
    const targetColumn = this.findColumn(targetColumnId);
    if (!targetColumn) {
        throw new Error(`Target column ${targetColumnId} not found`);
    }

    // Prüfe ob die Karte bereits existiert (spaltenübergreifend!)
    const existing = this.findCardById(cardProps.id!);
    
    if (existing) {
        // ✅ UPDATE: Karte existiert - nur Daten aktualisieren
        // Karte BLEIBT in ihrer aktuellen Spalte!
        existing.card.update(cardProps);
        return existing.card;
    } else {
        // ✅ INSERT: Neue Karte - zu Zielspalte hinzufügen
        const newCard = new Card(cardProps);
        targetColumn.cards = [...targetColumn.cards, newCard];
        return newCard;
    }
}
```

**Wichtig:** Die Karte wechselt **nicht** die Spalte wenn sie bereits existiert!

### 4. BoardStore.upsertCard() (kanbanStore.svelte.ts)

```typescript
public upsertCard(targetColumnId: string, props: CardProps) {
    if (!props.id) {
        throw new Error('upsertCard requires props.id to be set (from Nostr d-tag)');
    }

    const card = this.board.upsertCard(targetColumnId, props);
    this.triggerUpdate(); // Trigger Reaktivität
    this.publishToNostr();
    return card;
}
```

### 5. UI: Author anzeigen (Card.svelte)

```svelte
{#if card.author}
    <div class="author-info" title={card.author}>
        <span class="author-label">von</span>
        <code class="author-npub">{card.author.slice(0, 8)}...</code>
    </div>
{/if}
```

**Styling:**
```css
.author-info {
    display: flex;
    align-items: center;
    gap: 0.35em;
    font-size: 0.7em;
    color: var(--muted-foreground);
    background-color: var(--muted);
    padding: 0.25em 0.4em;
    border-radius: 3px;
}
```

## Praktisches Beispiel: Upsert-Datenfluss mit $effect

### Szenario: Nostr Event wird empfangen und soll synchronisiert werden

```typescript
// 1. Event von Nostr kommt rein
const nostrEvent = {
    kind: 30302,
    pubkey: 'npub1abc...',
    tags: [
        ['d', 'card-123'],
        ['title', 'Updated Title']
    ]
};

// 2. Store-Methode aufrufen (NICHT board.upsertCard direkt!)
const cardProps = {
    id: 'card-123',
    heading: 'Updated Title',
    author: 'npub1abc...',
    publishState: 'published'
};

boardStore.upsertCard(targetColumnId, cardProps);

// 3. boardStore triggert automatisch Reaktivität
//    - triggerUpdate() wird aufgerufen
//    - uiData $derived wird neu berechnet
//    - Column.svelte $effect bemerkt Update
//    - Card.svelte re-rendert

// 4. localStorage wird synchron gespeichert
// 5. Nostr-Event wird async publiziert (publishToNostr)
```

### Reaktivitäts-Kette (**WICHTIG!**)

```
1. boardStore.upsertCard()
   └→ board.upsertCard() (Model-Layer)
   └→ triggerUpdate() (wichtig!)
       └→ updateTrigger++ (inkrementieren!)
       └→ saveToStorage() (synchron!)
       └→ publishToNostr() (async)

2. uiData $derived.by() wird neu berechnet
   ├─ Weil: updateTrigger hat sich geändert
   ├─ Transformation: Board → UIColumn[]
   └─ Alle neuen Werte verfügbar

3. Column.svelte $effect bemerkt Änderung
   ├─ Abhängigkeit: boardStore.uiData
   └─ Aktualisiert: items Prop

4. Card.svelte wird re-rendert
   ├─ Props kommen von Column
   ├─ author wird angezeigt
   └─ UI zeigt neue Werte sofort ✅
```

**FALSCH würde sein:**
```typescript
// ❌ FALSCH: Direct board manipulation (KEINE Reaktivität!)
const card = boardStore['data'].upsertCard(columnId, props);
// board wurde mutiert aber triggerUpdate() nicht aufgerufen
// → $derived wird NICHT neu berechnet
// → UI wird NICHT aktualisiert!

// ✅ RICHTIG: Store-Methode nutzen
boardStore.upsertCard(columnId, props);
// triggerUpdate() wird aufgerufen → $derived → $effect → UI ✅
```


### Von Nostr-Events laden

```typescript
// Event Kind 30302 von Nostr empfangen
const cardProps: CardProps = {
    id: event.tags.find(t => t[0] === 'd')?.[1], // d-tag als ID
    heading: event.tags.find(t => t[0] === 'title')?.[1] || '',
    content: event.content,
    author: event.pubkey, // Signer des Events
    publishState: 'published'
};

// Upsert: Aktualisiert falls vorhanden, sonst neu
boardStore.upsertCard(targetColumnId, cardProps);
```

### Duplikate verhindern

```javascript
// ❌ ALT: addCard() würde duplizieren
boardStore.addCard(columnId, { id: 'card-123', heading: 'Test' });
boardStore.addCard(columnId, { id: 'card-123', heading: 'Test Updated' });
// Ergebnis: 2 Karten mit gleicher ID!

// ✅ NEU: upsertCard() ist sicher
boardStore.upsertCard(columnId, { id: 'card-123', heading: 'Test' });
boardStore.upsertCard(columnId, { id: 'card-123', heading: 'Test Updated' });
// Ergebnis: 1 Karte mit aktuellem heading
```

## Test-Funktionen (Browser Console)

### Test 1: Upsert-Verhalten

```javascript
window.test_upsert()
```

**Was wird getestet:**
1. Erste Karte mit ID erstellen
2. Verifizierung dass Karte existiert
3. UPSERT mit gleicher ID - sollte UPDATE sein
4. Verifizierung dass Daten aktualisiert wurden
5. Verifizierung dass **kein Duplikat** erstellt wurde

**Output-Beispiel:**
```
🧪 UPSERT-TEST: Testen Sie die Upsert-Funktionalität
📝 Schritt 1: Erste Karte mit test-card-001 erstellen
✅ Karte erstellt: test-card-001
✅ Karte gefunden: test-card-001 in Spalte: TODO — Aufgaben
  Content: Initial content
  Author: npub1test0000000000000000000000000001

📝 Schritt 2: UPSERT - Karte mit gleicher ID aktualisieren
✅ Upsert durchgeführt
✅ Karte gefunden: test-card-001
  Content (sollte updated sein): Updated content - sollte nicht dupliziert werden!
  Author (sollte neu sein): npub1test0000000000000000000000000002
  publishState (sollte published sein): published

📊 Abschluss:
✅ Total Karten im Board: 11
✅ Test erfolgreich - keine Duplikate erstellt!
```

### Test 2: Duplikat-Verhinderung

```javascript
window.test_no_duplicate()
```

**Was wird getestet:**
- 3x die gleiche Karte `upsertCard()` aufrufen
- Verifizierung dass **nur 1 Karte** existiert (nicht 3!)
- Verifizierung dass die letzte Version gilt

## Integration mit Nostr (Phase 2)

Diese Implementierung bereitet vor für:

1. **Event Publishing:**
   ```typescript
   const event = cardToNostrEvent(card, columnName, rank, boardRef, ndk);
   await syncManager.publishOrQueue(event, 'card');
   ```

2. **Event Subscription & Sync:**
   ```typescript
   ndk.subscribe(
       { kinds: [30302], '#a': [boardRef] },
       { closeOnEose: false }
   ).on('event', (event) => {
       const cardProps = nostrEventToCard(event);
       boardStore.upsertCard(targetColumnId, cardProps);
   });
   ```

3. **Offline Queue:**
   ```typescript
   // Bei Offline: Queued, bei Online: automatisch synced
   // Keine Duplikate auch wenn mehrmals synced
   ```

## Architektur-Überblick

```
┌─ Nostr Event (Kind 30302)
│  ├─ d-tag = eindeutige ID
│  ├─ author = pubkey (wird zu card.author)
│  └─ tags = Metadaten
│
↓
nostrEventToCard(event) → CardProps mit id & author
│
↓
boardStore.upsertCard(columnId, cardProps)
│
├─ Findet Karte spaltenübergreifend: board.findCardById(cardProps.id)
│  ├─ Gefunden: Update existierende Karte
│  └─ Nicht gefunden: Erstelle neue Karte in targetColumn
│
↓
triggerUpdate() → Reaktivität triggern
│
↓
UI aktualisiert sich automatisch via $effect
```

## Wichtige Eigenschaften

| Feature | Beschreibung |
|---------|-------------|
| **Spaltenübergreifend** | Sucht Karte in ALLEN Spalten, nicht nur Zielgruppe |
| **Nicht bewegend** | Findet Karte nicht ihre Spalte wechseln bei Update |
| **Duplikat-sicher** | Mehrfache upsertCard() mit gleicher ID = nur Update |
| **Nostr-konform** | ID = `d-tag`, author = `pubkey` des Events |
| **Reaktiv** | `triggerUpdate()` sorgt für sofortiges UI-Update |
| **Persistent** | Änderungen werden zu localStorage + Nostr publiziert |

## Zukünftige Erweiterungen

1. **Spalten-Bewegung via Nostr:** `d-tag` + spalten-Metadaten könnten Position kodieren
2. **Konflikt-Auflösung:** Bei simultanen Änderungen (CRDTs)
3. **Versionierung:** `updatedAt` Timestamps für Last-Write-Wins
4. **Event-Tombstones:** Kind 5 Events für Löschungen

## Fehlerbehandlung

```typescript
try {
    boardStore.upsertCard(columnId, cardProps);
} catch (error) {
    if (error.message.includes('not found')) {
        console.error('Spalte nicht gefunden - kolonne gelöscht?');
    } else if (!cardProps.id) {
        console.error('ID erforderlich für upsertCard()');
    }
}
```

## Performance

- **Zeit:** O(n) wo n = Anzahl der Karten (Spaltenübergreifende Suche)
- **Speicher:** O(1) (kein zusätzlicher Overhead)
- **Skalierbarkeit:** Für Boards mit 1000+ Karten ggf. Index-Struktur erwägen

## Siehe auch

- **BoardModel.ts:** Board/Column/Card Klassen
- **kanbanStore.svelte.ts:** Store mit upsertCard() API
- **Card.svelte:** UI mit author-Anzeige
- **demoBoardLoader.ts:** Test-Funktionen

---

**Nächster Schritt:** Nostr Event-Parsing in `nostrEvents.ts` implementieren und mit SyncManager verbinden.
