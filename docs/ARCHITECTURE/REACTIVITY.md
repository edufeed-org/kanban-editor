# Reactivity in Svelte 5 - Vollständige Dokumentation# 🎯 Reaktivitäts-Architektur (Svelte 5 Runes)



**Datum:** 25. Oktober 2025  **Umfang:** Svelte 5 Runes ($state, $derived, $effect) + Dynamische Prop-Updates

**Framework:** Svelte 5 (mit Runes)  

**Status:** ✅ Production Ready  ---

**Ein-Dokument-Prinzip:** ✅ Merged REACTIVITY.md + REACTIVE-FLOW-VERIFICATION.md

## 📊 Die Reaktivitätskette (Svelte 5 Runes)

---

Wie das Board auf Store-Änderungen reagiert:

## I. Übersicht

```

Svelte 5 führt **Runes** ein - ein neues System für explizite Reaktivität. Das System ist streng und verhindert häufige Bugs.┌─────────────────────────────────────────────────────────────┐

│ Externe Änderung (Nostr Event / User Aktion)               │

**Die 3 Kern-Runes:**└────────────────┬────────────────────────────────────────────┘

- ✅ **`$state`** — Reaktive Variablen (mutable)                 ↓

- ✅ **`$derived`** — Berechnete Werte (read-only)        boardStore.addColumn()  ← API-Aufrufe

- ✅ **`$effect`** — Side Effects (wenn Abhängigkeiten sich ändern)        column.addCard()

        card.addComment()

**Das Kanban-Board nutzt Runes überall:**                 ↓

- `boardStore: $state` (reactive, persisted)        column.cards = [...cards, newCard]  ← Array Reassignment

- `isDarkMode: $derived(theme === 'dark')`        this.updateTrigger++                 ← Svelte $state Mutation!

- `$effect(() => { saveToStorage() })` (Sync zu localStorage)        this.saveToStorage()

                 ↓

---    ┌───────────────────────────────────────┐

    │ updateTrigger = $state (ÄNDERT!)      │

## II. Quick Start (10 Minuten)    │ → Triggert alle abonnenten            │

    └───────────────────────────────────────┘

### Die 3 Runes                 ↓

    ┌───────────────────────────────────────┐

```typescript    │ boardStore.uiData = $derived.by(() => │

// 1. $state — Reaktive Variable    │   const cols = this.board.columns     │ ◄─ Dependency tracking!

let count = $state(0);    │   const trigger = this.updateTrigger  │

count++; // Ändert sich automatisch in der UI!    │   // Transform zu UI-Format           │

    │   return result                       │

// 2. $derived — Berechneter Wert (automatisch aktualisiert)    │ })                                     │

let doubled = $derived(count * 2);    └───────────────────────────────────────┘

// Wenn count sich ändert → doubled wird automatisch neu berechnet                 ↓ (NEU BERECHNET!)

    ┌───────────────────────────────────────┐

// 3. $effect — Reagiere auf Änderungen    │ Column.svelte $effect(() => {         │

$effect(() => {    │   const uiColumns = boardStore.uiData │ ◄─ Reaktive Dependency!

  console.log('Count ist jetzt:', count);    │   items = updated.items               │ ◄─ UI-State wird AKTUALISIERT

  // Wird aufgerufen jedes Mal wenn count sich ändert!    │ })                                     │

});    └───────────────────────────────────────┘

```                 ↓

    ┌───────────────────────────────────────┐

### Im Kanban-Board    │ Svelte renderiert UI neu              │

    │ → Benutzer sieht SOFORT die Änderung  │

```typescript    └───────────────────────────────────────┘

// boardStore.svelte.ts (mit Runes)```

export class BoardStore {

  private board = $state(new Board());        // ← $state (reaktiv)---

  private updateTrigger = $state(0);          // ← Trigger für $effect

  ## ✅ Was funktioniert SOFORT (ohne Reload)

  public uiData = $derived.by(() => {         // ← $derived (computed)

    const _ = this.updateTrigger;             // ← Dependency tracking!- ✅ Neue Spalte hinzufügen → Sofort sichtbar

    // Transformiere board zu UI-Format- ✅ Karte verschieben → Live DnD funktioniert

    return this.board.columns.map(col => ...);- ✅ Spalten-Name ändern → Column.svelte re-rendert

  });- ✅ Karte kommentieren → Kommentare erscheinen sofort

  - ✅ Nach localStorage → Sofort persistiert

  public createCard(columnId: string, heading: string) {

    const col = this.board.findColumn(columnId);**Warum?** Die triggerUpdate() → $derived → $effect Kette ist **synchron und sofort**.

    col?.addCard({ heading });

    this.updateTrigger++;  // ← Triggert $derived Neuberechnung!---

    this.saveToStorage();  // ← Persistierung

  }## 🔧 KRITISCH: BoardStore vs direkter Board-Zugriff

}

**REGEL:** IMMER `boardStore.XXX()` Methoden nutzen, NIEMALS `board.XXX()` direkt aufrufen!

// Card.svelte (Komponente)

$effect(() => {```typescript

  const uiColumns = boardStore.uiData; // ← Liest $derived.by() Wert// ❌ FALSCH - Keine Reaktivität, keine Persistierung!

  items = uiColumns.find(c => c.id === columnId)?.items || [];const column = board.findColumn('col-id');

  // Wenn boardStore.uiData sich ändert → items wird neu synced!column.addCard({heading: 'Neue Karte'});

});// localStorage NICHT aktualisiert

```// UI zeigt NICHTS neu

// Nostr NICHT publiziert

---

// ✅ RICHTIG - Alles funktioniert automatisch!

## III. $state — Reaktive VariablenboardStore.createCard('col-id', 'Neue Karte');

// → triggerUpdate() wird aufgerufen

### Grundlagen// → localStorage synchron aktualisiert

// → uiData $derived wird neu berechnet

```typescript// → Column.svelte $effect wird getriggert

// 1. Simple $state// → UI zeigt neue Karte sofort

let name = $state('Alice');// → (Später) Nostr Event wird publiziert

name = 'Bob'; // UI wird automatisch aktualisiert```



// 2. Objekte**Warum?** `triggerUpdate()` ist die Brücke zwischen Model und UI:

let user = $state({ name: 'Alice', age: 30 });1. `board` ist reiner Datencontainer (keine Reaktivität)

user.name = 'Bob'; // ✅ Reaktiv!2. `BoardStore` ist reaktiv mit `$state` und `$derived`

3. Nur `boardStore.XXX()` ruft `triggerUpdate()` auf

// 3. Arrays - WICHTIG: Reassignment statt Mutation!4. `triggerUpdate()` inkrementiert `updateTrigger` State

let items = $state([1, 2, 3]);5. Das triggert `$derived.by()` Neuberechnung

items = [...items, 4]; // ✅ Reaktiv! (Reassignment)6. Das triggert `$effect` in Components

items.push(5);         // ❌ KEINE Reaktivität! (Mutation)7. Das updatet die UI

```

---

### Kritische Regel: Reassignments

## ⚠️ KRITISCH: Svelte 5 Prop-Mutation Anti-Pattern

```typescript

// ❌ FALSCH: Array-Mutation (KEINE Reaktivität!)Svelte 5 hat einen **strikten Ownership Model**. Props dürfen von Child-Komponenten NICHT direkt mutiert werden!

column.cards.push(newCard);        // push = Mutation

column.cards.splice(0, 1);         // splice = Mutation### ❌ FALSCH: Direktes Prop-Mutieren in $effect

Object.assign(card, {...});        // Object.assign = Mutation

```svelte

// ✅ RICHTIG: Reassignment (Reaktiv!)<script lang="ts">

column.cards = [...column.cards, newCard];           // spread operator    let { card } = $props();  // ← Prop vom Parent

column.cards = column.cards.filter((c, i) => i !== 0);    

object = { ...object, prop: newValue };              // object spread    $effect(() => {

```        card.name = newValue;      // ❌ MUTATION! Forbidden!

        card.color = newColor;     // ❌ ownership_invalid_mutation Warning!

### Pattern in Svelte 5    });

</script>

```typescript

// ❌ FALSCH (Svelte 4 legacy style)<input bind:value={card.name} />  <!-- ❌ FALSCH! -->

export const data = writable(initialValue);```

data.update(val => val + 1);

**Consequence:**

// ✅ RICHTIG (Svelte 5 style)- 🔴 Warning: "ownership_invalid_mutation"

let data = $state(initialValue);- 🔴 Unpredictable behavior

data++;  // Direkt mutieren!- 🔴 Build fails with `pnpm run check`

```

### ✅ RICHTIG: Lokale State Variablen verwenden

---

```svelte

## IV. $derived — Berechnete Werte<script lang="ts">

    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

### Grundlagen    

    let { card } = $props();  // ← Read-only Prop vom Parent

```typescript    

// 1. Simple $derived    // Lokale State Variablen für Editing

let x = $state(5);    let localName = $state(card.name);

let y = $derived(x * 2);    let localColor = $state(card.color || 'slate');

// y wird automatisch neu berechnet wenn x sich ändert    let localPublishState = $state(card.publishState);

    

// 2. $derived.by() — Komplexe Logik    // Optional: Update lokale Variablen wenn Prop ändert

let items = $state([1, 2, 3, 4, 5]);    $effect(() => {

let filtered = $derived.by(() => {        if (card.name !== localName) {

  return items.filter(i => i > 2);            localName = card.name;

});        }

        if (card.color !== localColor) {

// 3. Mit mehreren Dependencies            localColor = card.color || 'slate';

let firstName = $state('Max');        }

let lastName = $state('Mustermann');        if (card.publishState !== localPublishState) {

let fullName = $derived(`${firstName} ${lastName}`);            localPublishState = card.publishState;

// fullName aktualisiert sich wenn firstName ODER lastName sich ändert        }

```    });

    

### Dependency Tracking    function handleSave() {

        // Store-API aufrufen (nicht card mutieren!)

```typescript        boardStore.updateCard(card.id, {

// ✅ WICHTIG: Abhängigkeiten MÜSSEN explizit gelesen werden!            heading: localName,

            color: localColor,

// ❌ FALSCH - updateTrigger wird nicht als Dependency tracked            publishState: localPublishState

let uiData = $derived.by(() => {        });

  const cols = boardStore.board.columns; // Liest column direkt    }

  return cols.map(...);</script>

  // Wenn nur updateTrigger++ aber nicht column sich ändert → nicht getriggert!

});<!-- Template nutzt lokale Variablen, NICHT Props! -->

<input bind:value={localName} />

// ✅ RICHTIG - updateTrigger wird als Dependency tracked<div class:draft={localPublishState === 'draft'}>...</div>

let uiData = $derived.by(() => {<button onclick={handleSave}>Speichern</button>

  const trigger = boardStore.updateTrigger;  // ← EXPLICIT DEPENDENCY!```

  const cols = boardStore.board.columns;

  return cols.map(...);**Warum funktioniert das?**

  // Wenn updateTrigger++ → $derived wird getriggert!

});1. **Prop ist read-only:** `card` gehört dem Parent (z.B. Column.svelte)

```2. **Lokale State gehört Child:** `localName` ist private zu Card.svelte

3. **Child darf Lokale mutieren:** `localName = newValue` ist OK

### Im Kanban-Board (boardStore)4. **Parent aktualisiert Prop:** Nur Parent darf `card = {...}` setzen

5. **Store vermittelt:** `boardStore.updateCard()` informiert Parent → Parent setzt neuen `card` Prop

```typescript

export class BoardStore {---

  private board = $state(...);

  private updateTrigger = $state(0);  // ← Trigger-Counter## 📋 5-Schritt Implementierungs-Checkliste (für dynamische Props)

  

  // ✅ RICHTIG: updateTrigger als Dependency### Schritt 1: Store-Methode erstellen

  public uiData = $derived.by(() => {

    const _ = this.updateTrigger;  // ← Lese Trigger!**Datei:** `src/lib/stores/kanbanStore.svelte.ts`

    // Jetzt wird bei jedem updateTrigger++ neuberechnet

    return this.board.columns.map(col => ({Erstelle eine öffentliche Methode, die die Änderung in das Board-Modell schreibt:

      id: col.id,

      name: col.name,```typescript

      items: col.cards.map(card => ({// Beispiel: Spalten-Name ändern

        id: card.id,public updateColumn(columnId: string, updates: { name?: string; color?: string }): void {

        heading: card.heading    const column = this.board.findColumn(columnId);

      }))    if (column) {

    }));        column.update(updates);

  });        this.triggerUpdate(); // 🔑 WICHTIG: Trigger Reaktivität!

          this.publishToNostr();

  private triggerUpdate(): void {    } else {

    this.updateTrigger++;  // ← Inkrementiert Trigger        throw new Error(`Column with id ${columnId} not found`);

    // → uiData wird neu berechnet (weil Dependency gelesen!)    }

    // → Alle $effect die uiData lesen werden getriggert!}

  }```

}

```### Schritt 2: Lokale State in Component



---**Datei:** `src/routes/cardsboard/Column.svelte`



## V. $effect — Side Effects```svelte

<script lang="ts">

### Grundlagen    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

    

```typescript    let { column } = $props();  // ← Prop vom Parent

// 1. Einfaches $effect    

let count = $state(0);    // Lokale State für bearbeitbare Felder

$effect(() => {    let editingName = $state(column.name);

  console.log('Count ist:', count);    let editingColor = $state(column.color || 'slate');

  // Wird aufgerufen: beim Setup + jedes Mal wenn count sich ändert    let isEditing = $state(false);

});</script>

```

// 2. Mehrere Dependencies

let x = $state(0);### Schritt 3: $effect für Auto-Sync

let y = $state(0);

$effect(() => {```svelte

  console.log('x + y =', x + y);<script lang="ts">

  // Wird getriggert wenn x ODER y sich ändert    // Nach Prop-Änderung: Update lokale State

});    $effect(() => {

        editingName = column.name;

// 3. Mit Cleanup-Funktion        editingColor = column.color || 'slate';

$effect(() => {    });

  const subscription = eventBus.on('change', handler);</script>

  return () => subscription.unsubscribe();  // Cleanup```

});

```### Schritt 4: Handler für Updates



### Im Kanban-Board (Column.svelte)```svelte

<script lang="ts">

```svelte    function handleSaveName() {

<script lang="ts">        if (editingName !== column.name) {

  let { column } = $props();  // Prop vom Parent            boardStore.updateColumn(column.id, { name: editingName });

  let items = $state(column.items || []);  // Lokale State        }

          isEditing = false;

  // ✅ RICHTIG: $effect synced Items von BoardStore    }

  $effect(() => {    

    const uiColumns = boardStore.uiData;  // ← Read Dependency    function handleSaveColor() {

    const updated = uiColumns.find(c => c.id === column.id);        if (editingColor !== column.color) {

                boardStore.updateColumn(column.id, { color: editingColor });

    if (updated && JSON.stringify(updated.items) !== JSON.stringify(items)) {        }

      items = updated.items;  // ← Update lokale State    }

      console.log('🔄 Items synced from store');</script>

    }```

  });

</script>### Schritt 5: Template mit lokalen Variablen



<!-- Template nutzt lokale items, nicht prop -->```svelte

{#each items as item (item.id)}<!-- ✅ RICHTIG: Template nutzt lokale Variablen -->

  <Card {item} />{#if isEditing}

{/each}    <input bind:value={editingName} />

```    <button onclick={handleSaveName}>Speichern</button>

{:else}

---    <h3>{editingName}</h3>

    <button onclick={() => isEditing = true}>Bearbeiten</button>

## VI. Reactive Flow Verification — Die 5-Schritt Checkliste{/if}



Nutze diese Routine IMMER wenn du:<!-- Style nutzt auch lokale Variable -->

- State aktualisierst (z.B. `boardStore.editCard()`)<div class:column-color-{editingColor}>...</div>

- `$effect` implementierst```

- Props in Templates anzeigst

- Komplexe reactive chains baust---



### Schritt 1: Data Source Mapping## 🎯 Häufige Szenarien



Wo kommt jeder Wert her?### Szenario 1: Spalten-Name editieren



```typescript**Flow:**

// Frage: Woher kommt dieser Wert?```

User klickt "Bearbeiten"

// Option A: Externe Quelle (Prop)    ↓

let { card } = $props();Input-Feld zeigt localName (kopiert von column.name)

// → Nur READ-ONLY in Template    ↓

// → Kann nicht mutiert werden (ownership violation!)User tippt neuen Namen

    ↓

// Option B: Lokale StateUser klickt "Speichern"

let localImage = $state(card.image || '');    ↓

// → READ-WRITE möglichboardStore.updateColumn(id, { name: localName })

// → Template MUSS {localImage} nutzen    ↓

BoardStore ruft column.update({ name })

// Option C: Berechnet    ↓

let derived = $derived(boardStore.data?.image);BoardStore ruft triggerUpdate()

// → NUR READ (automatisch berechnet)    ↓

```updateTrigger++ (Svelte $state Mutation)

    ↓

### Schritt 2: Dependency TracinguiData $derived neu berechnet

    ↓

Wird der Wert aktualisiert? Wie?Column.svelte $effect sieht neue uiData

    ↓

```typescriptcolumn Prop wird vom Parent aktualisiert

// Für jeden $derived.by():    ↓

// ✅ Werden Rune-Abhängigkeiten explizit gelesen?$effect in Column setzt editingName = column.name (neu)

// ✅ Wird updateTrigger gelesen (Fallback)?    ↓

// ✅ Gibt es zirkuläre Abhängigkeiten?Template re-rendert mit neuem Namen

```

// Für jeden $effect():

// ✅ Liest es den GESAMTEN Wert (nicht sub-properties)?### Szenario 2: Karten-Farbe wechseln

// ✅ Sind Rune-Variablen explizit gelesen?

// ✅ Werden $derived Werte verwendet?**Flow:**

``````

User klickt Color-Picker

### Schritt 3: Template Audit    ↓

localColor = 'red'

Template nutzt richtige Variable?    ↓

User klickt OK

```svelte    ↓

<!-- CHECKLIST: -->boardStore.updateCard(cardId, { color: localColor })

{#if card.image}         <!-- ❌ FALSCH! Uses prop statt state! -->    ↓

{#if localImage}         <!-- ✅ RICHTIG! Uses $state variable -->BoardStore ruft card.update({ color })

    ↓

{currentUser.name}       <!-- ❌ FALSCH! -->BoardStore ruft triggerUpdate()

{currentUserName}        <!-- ✅ RICHTIG! (ist $derived) -->    ↓

UI re-rendert mit neuer Farbe

{updatedValue}           <!-- ❌ Undefined! -->```

{computed}               <!-- ✅ RICHTIG! (ist $derived) -->

```### Szenario 3: Kommentar hinzufügen



### Schritt 4: $effect Dependencies Check**Flow:**

```

```typescriptUser tippt Kommentar in Textarea

// FALSCH: $effect beobachtet falschen Dependency    ↓

$effect(() => {User klickt "Abschicken"

  if (authStore.currentUser?.profile?.name) {  // Zu granular!    ↓

    console.log('logged in');boardStore.addComment(cardId, text)

  }    ↓

});BoardStore ruft card.addComment()

    ↓

// RICHTIG: Ganzen Wert lesenBoardStore ruft triggerUpdate()

$effect(() => {    ↓

  const user = authStore.currentUser;  // ← Lese ganzen WertuiData hat neue comments

  if (user?.profile?.name) {    ↓

    console.log('logged in');CardViewModal $effect sieht neue comments

  }    ↓

});UI re-rendert mit neuem Kommentar

``````



### Schritt 5: Manual Test---



```typescript## 🔍 Debugging: Warum funktioniert meine Update nicht?

// FLOW:

boardStore.editCard(cardId, { image: 'https://...' });### Problem: UI aktualisiert sich nicht nach Änderung



// VERIFY:**Debugging Checklist:**

console.log('localImage:', localImage);  // Should be new URL

console.log('Template shows:', ???);     // Schau selbst!```typescript

// ❌ FEHLER 1: triggerUpdate() nicht aufgerufen

// WENN TEMPLATE ALTE WERT ZEIGT:boardStore.updateCard(cardId, { name: 'New' });

// → localImage ist nicht in Template benutzt// Kein triggerUpdate() → Keine Reaktivität!

// → FIX: Template zu {localImage} ändern

```// ✅ FIX

boardStore.updateCard(cardId, { name: 'New' }); // Store ruft triggerUpdate()

---

// ❌ FEHLER 2: Direkter board Zugriff

## VII. Häufige Fehler & Lösungenboard.findColumn('col-id').addCard({heading: 'New'}); // No reactivity!



### ❌ Fehler 1: `$derived.by()` wird nicht getriggert// ✅ FIX

boardStore.createCard('col-id', 'New'); // Über Store!

```typescript

// FALSCH: updateTrigger nicht gelesen// ❌ FEHLER 3: Prop direkt mutiert

public uiData = $derived.by(() => {card.name = 'New'; // ownership_invalid_mutation!

  return this.board.columns.map(...);  // updateTrigger nicht gelesen!

});// ✅ FIX

let localName = $state(card.name);

// RICHTIG:localName = 'New'; // OK!

public uiData = $derived.by(() => {boardStore.updateCard(card.id, { heading: localName }); // Sync zu Parent

  const _ = this.updateTrigger;  // ← Lese Trigger!```

  return this.board.columns.map(...);

});### Problem: `$effect` triggert nicht

```

**Gründe:**

### ❌ Fehler 2: Array Push statt Reassignment1. `$effect` beobachtet falschen Wert (zu granular)

2. `updateTrigger` wird nicht inkrementiert

```typescript3. `$derived` wird nicht neu berechnet

// FALSCH: push (Mutation) - KEINE Reaktivität

this.items.push(newItem);**Debug Code:**

```typescript

// RICHTIG: Reassignment// In Component Console

this.items = [...this.items, newItem];$effect(() => {

```    console.log('🔄 Effect triggered!');

    console.log('boardStore.uiData:', boardStore.uiData);

### ❌ Fehler 3: Template zeigt alte Werte    console.log('column prop:', column);

});

```typescript

// FALSCH: Template nutzt Prop statt State// Sollte loggen wenn boardStore.uiData ändert

let localName = $state(card.name);```

// aber Template zeigt: {card.name}

### Problem: localStorage wird nicht aktualisiert

// RICHTIG: Template nutzt lokale State

{localName}  // ← Nutzt $state Variable!**Grund:** `triggerUpdate()` nicht aufgerufen oder zu Fuß `saveToStorage()` vergessen

```

```typescript

### ❌ Fehler 4: Private Key speichernprivate triggerUpdate(): void {

    this.updateTrigger++;       // Triggert $derived

```typescript    this.saveToStorage();       // Speichert zu localStorage! ← WICHTIG

// 🔴 SICHERHEIT: Niemals!    this.publishToNostr();      // Publiziert zu Nostr

let sessionKey = $state(nsecPrivateKey);}

```

// ✅ RICHTIG:

let sessionKey = $state(pubkeyOnly);---

```

## 🎨 Array-Reassignments (Kritisch!)

### ❌ Fehler 5: Mutation Objects

Svelte 5 mit $state erfordert **Reassignments**, keine `.push()` oder `.splice()`:

```typescript

// FALSCH```typescript

user.profile.name = 'Bob';  // Mutation!// ❌ FALSCH: Array-Mutation ohne Reassignment

this.cards.push(newCard);           // Keine Reaktivität!

// RICHTIGcolumn.cards.splice(0, 1);          // Keine Reaktivität!

user = { ...user, profile: { ...user.profile, name: 'Bob' } };

```// ✅ RICHTIG: Array Reassignment

this.cards = [...this.cards, newCard];

---column.cards = column.cards.filter((c, i) => i !== 0);



## VIII. Patterns für Häufige Use-Cases// IMMER danach: triggerUpdate()

this.triggerUpdate();

### Pattern 1: Store zu Component Sync```



```typescript**Warum?** Svelte 5 trackkt nur Zuweisungen (`=`), nicht Mutationen!

// boardStore.svelte.ts

export class BoardStore {---

  private data = $state(...);

  private updateTrigger = $state(0);## 📝 Konkretes Beispiel: Karte umbenennen

  

  public uiData = $derived.by(() => {### Schritt-für-Schritt Implementierung

    const _ = this.updateTrigger;  // ← Dependency

    return transform(this.data);**1. Store-Methode (kanbanStore.svelte.ts):**

  });```typescript

}public updateCard(cardId: string, updates: Partial<CardProps>): void {

    const result = this.board.findCardAndColumn(cardId);

// Component.svelte    if (result) {

$effect(() => {        result.card.update(updates);

  const uiData = boardStore.uiData;  // ← $derived.by() Wert        this.triggerUpdate(); // 🔑 WICHTIG!

  localData = uiData;        this.publishToNostr();

});    }

```}

```

### Pattern 2: Prop zu Local State Sync

**2. Card Component (Card.svelte):**

```svelte```svelte

<script lang="ts"><script lang="ts">

  let { card } = $props();    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

  let localName = $state(card.name);    

      let { card } = $props();

  $effect(() => {    let isEditing = $state(false);

    if (card.name !== localName) {    let editingTitle = $state(card.heading);

      localName = card.name;  // ← Sync from prop    

    }    $effect(() => {

  });        editingTitle = card.heading;

</script>    });

    

<input bind:value={localName} />  <!-- Nutzt localName, nicht prop! -->    function handleSave() {

```        if (editingTitle !== card.heading) {

            boardStore.updateCard(card.id, { heading: editingTitle });

### Pattern 3: Conditional Side Effect        }

        isEditing = false;

```typescript    }

$effect(() => {</script>

  const isOnline = navigator.onLine;

  {#if isEditing}

  if (isOnline) {    <input bind:value={editingTitle} />

    syncQueue();  // nur wenn online    <button onclick={handleSave}>✓</button>

  }{:else}

});    <h4 ondblclick={() => isEditing = true}>{card.heading}</h4>

```{/if}

```

---

**3. Datenfluss:**

## IX. Referenzen```

User klickt auf Karten-Titel

- **[STORES.md](./STORES.md)** — State Management (BoardStore, AuthStore, SettingsStore)    ↓ ondblclick

- **[PROP-VS-STATE-CHEATSHEET.md](../GUIDES/PROP-VS-STATE-CHEATSHEET.md)** — Quick ReferenceisEditing = true

- **[AUTHSTORE.md](./AUTHSTORE.md)** — Praktisches Beispiel mit $state + $derived    ↓ UI re-rendert

Input-Feld sichtbar mit editingTitle (= card.heading)

---    ↓

User tippt neue Text

**Status:** ✅ Production Ready - Phase 1+    ↓ bind:value

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
