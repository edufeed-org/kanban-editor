# 🎯 Reaktivitäts-Architektur (Svelte 5 Runes)

**Umfang:** Svelte 5 Runes ($state, $derived, $effect) + Dynamische Prop-Updates

---

## 📊 Die Reaktivitätskette (Svelte 5 Runes)

Wie das Board auf Store-Änderungen reagiert:

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
    │ updateTrigger = $state (ÄNDERT!)      │
    │ → Triggert alle abonnenten            │
    └───────────────────────────────────────┘
                 ↓
    ┌───────────────────────────────────────┐
    │ boardStore.uiData = $derived.by(() => │
    │   const cols = this.board.columns     │ ◄─ Dependency tracking!
    │   const trigger = this.updateTrigger  │
    │   // Transform zu UI-Format           │
    │   return result                       │
    │ })                                     │
    └───────────────────────────────────────┘
                 ↓ (NEU BERECHNET!)
    ┌───────────────────────────────────────┐
    │ Column.svelte $effect(() => {         │
    │   const uiColumns = boardStore.uiData │ ◄─ Reaktive Dependency!
    │   items = updated.items               │ ◄─ UI-State wird AKTUALISIERT
    │ })                                     │
    └───────────────────────────────────────┘
                 ↓
    ┌───────────────────────────────────────┐
    │ Svelte renderiert UI neu              │
    │ → Benutzer sieht SOFORT die Änderung  │
    └───────────────────────────────────────┘
```

---

## ✅ Was funktioniert SOFORT (ohne Reload)

- ✅ Neue Spalte hinzufügen → Sofort sichtbar
- ✅ Karte verschieben → Live DnD funktioniert
- ✅ Spalten-Name ändern → Column.svelte re-rendert
- ✅ Karte kommentieren → Kommentare erscheinen sofort
- ✅ Nach localStorage → Sofort persistiert

**Warum?** Die triggerUpdate() → $derived → $effect Kette ist **synchron und sofort**.

---

## 🔧 KRITISCH: BoardStore vs direkter Board-Zugriff

**REGEL:** IMMER `boardStore.XXX()` Methoden nutzen, NIEMALS `board.XXX()` direkt aufrufen!

```typescript
// ❌ FALSCH - Keine Reaktivität, keine Persistierung!
const column = board.findColumn('col-id');
column.addCard({heading: 'Neue Karte'});
// localStorage NICHT aktualisiert
// UI zeigt NICHTS neu
// Nostr NICHT publiziert

// ✅ RICHTIG - Alles funktioniert automatisch!
boardStore.createCard('col-id', 'Neue Karte');
// → triggerUpdate() wird aufgerufen
// → localStorage synchron aktualisiert
// → uiData $derived wird neu berechnet
// → Column.svelte $effect wird getriggert
// → UI zeigt neue Karte sofort
// → (Später) Nostr Event wird publiziert
```

**Warum?** `triggerUpdate()` ist die Brücke zwischen Model und UI:
1. `board` ist reiner Datencontainer (keine Reaktivität)
2. `BoardStore` ist reaktiv mit `$state` und `$derived`
3. Nur `boardStore.XXX()` ruft `triggerUpdate()` auf
4. `triggerUpdate()` inkrementiert `updateTrigger` State
5. Das triggert `$derived.by()` Neuberechnung
6. Das triggert `$effect` in Components
7. Das updatet die UI

---

## ⚠️ KRITISCH: Svelte 5 Prop-Mutation Anti-Pattern

Svelte 5 hat einen **strikten Ownership Model**. Props dürfen von Child-Komponenten NICHT direkt mutiert werden!

### ❌ FALSCH: Direktes Prop-Mutieren in $effect

```svelte
<script lang="ts">
    let { card } = $props();  // ← Prop vom Parent
    
    $effect(() => {
        card.name = newValue;      // ❌ MUTATION! Forbidden!
        card.color = newColor;     // ❌ ownership_invalid_mutation Warning!
    });
</script>

<input bind:value={card.name} />  <!-- ❌ FALSCH! -->
```

**Consequence:**
- 🔴 Warning: "ownership_invalid_mutation"
- 🔴 Unpredictable behavior
- 🔴 Build fails with `pnpm run check`

### ✅ RICHTIG: Lokale State Variablen verwenden

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    
    let { card } = $props();  // ← Read-only Prop vom Parent
    
    // Lokale State Variablen für Editing
    let localName = $state(card.name);
    let localColor = $state(card.color || 'slate');
    let localPublishState = $state(card.publishState);
    
    // Optional: Update lokale Variablen wenn Prop ändert
    $effect(() => {
        if (card.name !== localName) {
            localName = card.name;
        }
        if (card.color !== localColor) {
            localColor = card.color || 'slate';
        }
        if (card.publishState !== localPublishState) {
            localPublishState = card.publishState;
        }
    });
    
    function handleSave() {
        // Store-API aufrufen (nicht card mutieren!)
        boardStore.updateCard(card.id, {
            heading: localName,
            color: localColor,
            publishState: localPublishState
        });
    }
</script>

<!-- Template nutzt lokale Variablen, NICHT Props! -->
<input bind:value={localName} />
<div class:draft={localPublishState === 'draft'}>...</div>
<button onclick={handleSave}>Speichern</button>
```

**Warum funktioniert das?**

1. **Prop ist read-only:** `card` gehört dem Parent (z.B. Column.svelte)
2. **Lokale State gehört Child:** `localName` ist private zu Card.svelte
3. **Child darf Lokale mutieren:** `localName = newValue` ist OK
4. **Parent aktualisiert Prop:** Nur Parent darf `card = {...}` setzen
5. **Store vermittelt:** `boardStore.updateCard()` informiert Parent → Parent setzt neuen `card` Prop

---

## 📋 5-Schritt Implementierungs-Checkliste (für dynamische Props)

### Schritt 1: Store-Methode erstellen

**Datei:** `src/lib/stores/kanbanStore.svelte.ts`

Erstelle eine öffentliche Methode, die die Änderung in das Board-Modell schreibt:

```typescript
// Beispiel: Spalten-Name ändern
public updateColumn(columnId: string, updates: { name?: string; color?: string }): void {
    const column = this.board.findColumn(columnId);
    if (column) {
        column.update(updates);
        this.triggerUpdate(); // 🔑 WICHTIG: Trigger Reaktivität!
        this.publishToNostr();
    } else {
        throw new Error(`Column with id ${columnId} not found`);
    }
}
```

### Schritt 2: Lokale State in Component

**Datei:** `src/routes/cardsboard/Column.svelte`

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    
    let { column } = $props();  // ← Prop vom Parent
    
    // Lokale State für bearbeitbare Felder
    let editingName = $state(column.name);
    let editingColor = $state(column.color || 'slate');
    let isEditing = $state(false);
</script>
```

### Schritt 3: $effect für Auto-Sync

```svelte
<script lang="ts">
    // Nach Prop-Änderung: Update lokale State
    $effect(() => {
        editingName = column.name;
        editingColor = column.color || 'slate';
    });
</script>
```

### Schritt 4: Handler für Updates

```svelte
<script lang="ts">
    function handleSaveName() {
        if (editingName !== column.name) {
            boardStore.updateColumn(column.id, { name: editingName });
        }
        isEditing = false;
    }
    
    function handleSaveColor() {
        if (editingColor !== column.color) {
            boardStore.updateColumn(column.id, { color: editingColor });
        }
    }
</script>
```

### Schritt 5: Template mit lokalen Variablen

```svelte
<!-- ✅ RICHTIG: Template nutzt lokale Variablen -->
{#if isEditing}
    <input bind:value={editingName} />
    <button onclick={handleSaveName}>Speichern</button>
{:else}
    <h3>{editingName}</h3>
    <button onclick={() => isEditing = true}>Bearbeiten</button>
{/if}

<!-- Style nutzt auch lokale Variable -->
<div class:column-color-{editingColor}>...</div>
```

---

## 🎯 Häufige Szenarien

### Szenario 1: Spalten-Name editieren

**Flow:**
```
User klickt "Bearbeiten"
    ↓
Input-Feld zeigt localName (kopiert von column.name)
    ↓
User tippt neuen Namen
    ↓
User klickt "Speichern"
    ↓
boardStore.updateColumn(id, { name: localName })
    ↓
BoardStore ruft column.update({ name })
    ↓
BoardStore ruft triggerUpdate()
    ↓
updateTrigger++ (Svelte $state Mutation)
    ↓
uiData $derived neu berechnet
    ↓
Column.svelte $effect sieht neue uiData
    ↓
column Prop wird vom Parent aktualisiert
    ↓
$effect in Column setzt editingName = column.name (neu)
    ↓
Template re-rendert mit neuem Namen
```

### Szenario 2: Karten-Farbe wechseln

**Flow:**
```
User klickt Color-Picker
    ↓
localColor = 'red'
    ↓
User klickt OK
    ↓
boardStore.updateCard(cardId, { color: localColor })
    ↓
BoardStore ruft card.update({ color })
    ↓
BoardStore ruft triggerUpdate()
    ↓
UI re-rendert mit neuer Farbe
```

### Szenario 3: Kommentar hinzufügen

**Flow:**
```
User tippt Kommentar in Textarea
    ↓
User klickt "Abschicken"
    ↓
boardStore.addComment(cardId, text)
    ↓
BoardStore ruft card.addComment()
    ↓
BoardStore ruft triggerUpdate()
    ↓
uiData hat neue comments
    ↓
CardViewModal $effect sieht neue comments
    ↓
UI re-rendert mit neuem Kommentar
```

---

## 🔍 Debugging: Warum funktioniert meine Update nicht?

### Problem: UI aktualisiert sich nicht nach Änderung

**Debugging Checklist:**

```typescript
// ❌ FEHLER 1: triggerUpdate() nicht aufgerufen
boardStore.updateCard(cardId, { name: 'New' });
// Kein triggerUpdate() → Keine Reaktivität!

// ✅ FIX
boardStore.updateCard(cardId, { name: 'New' }); // Store ruft triggerUpdate()

// ❌ FEHLER 2: Direkter board Zugriff
board.findColumn('col-id').addCard({heading: 'New'}); // No reactivity!

// ✅ FIX
boardStore.createCard('col-id', 'New'); // Über Store!

// ❌ FEHLER 3: Prop direkt mutiert
card.name = 'New'; // ownership_invalid_mutation!

// ✅ FIX
let localName = $state(card.name);
localName = 'New'; // OK!
boardStore.updateCard(card.id, { heading: localName }); // Sync zu Parent
```

### Problem: `$effect` triggert nicht

**Gründe:**
1. `$effect` beobachtet falschen Wert (zu granular)
2. `updateTrigger` wird nicht inkrementiert
3. `$derived` wird nicht neu berechnet

**Debug Code:**
```typescript
// In Component Console
$effect(() => {
    console.log('🔄 Effect triggered!');
    console.log('boardStore.uiData:', boardStore.uiData);
    console.log('column prop:', column);
});

// Sollte loggen wenn boardStore.uiData ändert
```

### Problem: localStorage wird nicht aktualisiert

**Grund:** `triggerUpdate()` nicht aufgerufen oder zu Fuß `saveToStorage()` vergessen

```typescript
private triggerUpdate(): void {
    this.updateTrigger++;       // Triggert $derived
    this.saveToStorage();       // Speichert zu localStorage! ← WICHTIG
    this.publishToNostr();      // Publiziert zu Nostr
}
```

---

## 🎨 Array-Reassignments (Kritisch!)

Svelte 5 mit $state erfordert **Reassignments**, keine `.push()` oder `.splice()`:

```typescript
// ❌ FALSCH: Array-Mutation ohne Reassignment
this.cards.push(newCard);           // Keine Reaktivität!
column.cards.splice(0, 1);          // Keine Reaktivität!

// ✅ RICHTIG: Array Reassignment
this.cards = [...this.cards, newCard];
column.cards = column.cards.filter((c, i) => i !== 0);

// IMMER danach: triggerUpdate()
this.triggerUpdate();
```

**Warum?** Svelte 5 trackkt nur Zuweisungen (`=`), nicht Mutationen!

---

## 📝 Konkretes Beispiel: Karte umbenennen

### Schritt-für-Schritt Implementierung

**1. Store-Methode (kanbanStore.svelte.ts):**
```typescript
public updateCard(cardId: string, updates: Partial<CardProps>): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.update(updates);
        this.triggerUpdate(); // 🔑 WICHTIG!
        this.publishToNostr();
    }
}
```

**2. Card Component (Card.svelte):**
```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    
    let { card } = $props();
    let isEditing = $state(false);
    let editingTitle = $state(card.heading);
    
    $effect(() => {
        editingTitle = card.heading;
    });
    
    function handleSave() {
        if (editingTitle !== card.heading) {
            boardStore.updateCard(card.id, { heading: editingTitle });
        }
        isEditing = false;
    }
</script>

{#if isEditing}
    <input bind:value={editingTitle} />
    <button onclick={handleSave}>✓</button>
{:else}
    <h4 ondblclick={() => isEditing = true}>{card.heading}</h4>
{/if}
```

**3. Datenfluss:**
```
User klickt auf Karten-Titel
    ↓ ondblclick
isEditing = true
    ↓ UI re-rendert
Input-Feld sichtbar mit editingTitle (= card.heading)
    ↓
User tippt neue Text
    ↓ bind:value
editingTitle = "Neuer Titel"
    ↓
User klickt ✓
    ↓ onclick
handleSave()
    ↓
boardStore.updateCard(card.id, { heading: "Neuer Titel" })
    ↓ Store
BoardStore.updateCard() → card.update() → triggerUpdate()
    ↓
updateTrigger++ (Mutation $state)
    ↓
uiData $derived neu berechnet (mit triggerUpdate++ als Dependency)
    ↓
Column.svelte $effect triggered (beobachtet boardStore.uiData)
    ↓
card Prop updated (Parent setzt neues Objekt)
    ↓
$effect in Card.svelte triggered
    ↓
editingTitle = card.heading (neue Wert!)
    ↓
UI re-rendert mit neuem Titel
    ↓
isEditing = false
    ↓
Input verschwindet, Titel im readonly-Mode angezeigt
```

---

## ✨ Best Practices

1. **Immer Store-Methoden nutzen** — Nie direkt `board` mutieren
2. **triggerUpdate() nicht vergessen** — Sonst keine Reaktivität
3. **Lokale State in Components** — Props sind read-only
4. **Array Reassignments** — `array = [...]` statt `.push()`
5. **$effect für Auto-Sync** — Beobacht `boardStore.uiData`, nicht granulare Werte
6. **Prop-Änderungen über Store** — `boardStore.updateCard()`, nicht Props direkt

---

## 🔗 Verwandte Dokumentation

- [`STORES.md`](./STORES.md) — State Management Deep Dive
- [`AGENTS.md`](../../AGENTS.md) — Core Data Model
- [`UX-RULES.md`](./UX-RULES.md) — Component Architecture
