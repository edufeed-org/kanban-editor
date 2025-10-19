# Anleitung: Dynamische Prop-Änderungen in der UI

Diese Anleitung beschreibt die komplette Implementierung für Eigenschaften (Props), die Nutzer in der UI ändern können und die Änderungen persistent sein sollen.

## 📋 Übersicht

Wenn du möchtest, dass ein Nutzer eine Eigenschaft (z.B. Spalten-Name, Karten-Titel, Farbe) ändern kann und diese Änderung:
- ✅ Sofort sichtbar ist
- ✅ Nach Reload erhalten bleibt
- ✅ Mit localStorage/Nostr synchronisiert ist

...musst du folgende Schritte durchlaufen:

## 🎯 5-Schritt Implementierungs-Checkliste

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

**Kritische Punkte:**
- `this.triggerUpdate()` **MUSS** aufgerufen werden (erhöht `updateTrigger` State Variable)
- `this.publishToNostr()` für zukünftige Nostr-Synchronisation
- Error-Handling für nicht gefundene Elemente

---

### Schritt 2: Komponenten-Handler mit Store-Aufruf

**Datei:** `src/routes/cardsboard/Column.svelte` (oder ähnliche UI-Komponente)

Erstelle einen Handler, der den Store aufruft:

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

    let name = $props.required<string>();
    let columnId = $props.required<string>();
    let editName = $state(name);
    let popoverOpen = $state(false);

    function handleRename() {
        // ✅ Nur aktualisieren wenn sich tatsächlich was ändert
        if (editName !== name && columnId) {
            boardStore.updateColumn(columnId, { name: editName });
        }
        popoverOpen = false;
    }
</script>

<button onclick={handleRename}>
    Speichern
</button>
```

**Kritische Punkte:**
- Rufe `boardStore.updateColumn()` auf (nicht lokale `name = editName`)
- Prüfe ob Wert wirklich geändert wurde (Optimierung)
- Der Store triggert dann die Reaktivität

---

### Schritt 3: $effect für UI-Synchronisation

**Datei:** `src/routes/cardsboard/Column.svelte` (gleiche Komponente)

Überwache `boardStore.uiData` mit einem `$effect` und aktualisiere lokale Props:

```svelte
<script lang="ts">
    // $effect triggert automatisch, wenn boardStore.uiData sich ändert
    $effect(() => {
        const uiColumns = boardStore.uiData; // ← Dependency tracking
        
        const updatedColumn = uiColumns.find(c => c.id === columnId);
        if (updatedColumn) {
            // Aktualisiere Name wenn sich geändert hat
            if (updatedColumn.name !== name) {
                console.log('🔄 Name updated:', updatedColumn.name);
                name = updatedColumn.name;
                editName = name; // Auch editName aktualisieren für Consistency
            }
            
            // Aktualisiere andere Props analog
            if (updatedColumn.color !== color) {
                color = updatedColumn.color;
                selectedColor = color || 'slate';
            }
        }
    });
</script>
```

**Wie es funktioniert:**
1. `boardStore.uiData` ist ein `$derived` (wird neu berechnet bei `updateTrigger` Änderung)
2. Komponente hat `$effect` der `boardStore.uiData` beobachtet
3. Wenn `updateTrigger` sich ändert → `uiData` wird neu berechnet → `$effect` triggert
4. `$effect` aktualisiert die lokalen Props → UI re-rendert

**Wichtig:** Prüfe ob Wert tatsächlich geändert wurde vor dem Update (verhindert unnötige Re-Renders)

---

### Schritt 4: Board-Model Update-Methode

**Datei:** `src/lib/classes/BoardModel.ts`

Stelle sicher, dass die Modell-Klasse eine `update()`-Methode hat:

```typescript
export class Column {
    public name: string;
    public color?: string;

    update(props: Partial<ColumnProps>): void {
        if (props.name !== undefined) this.name = props.name;
        if (props.color !== undefined) this.color = props.color;
    }
}
```

**Kritische Punkte:**
- `update()` muss `undefined` Werte ignorieren (nur die übergebenen Felder updaten)
- Keine Validation nötig (optional: wenn kritisch)
- Für Svelte 5: Array-Reassignments nutzen wenn nötig (z.B. `this.items = [...this.items]` statt `.push()` oder `.splice()`)

---

### Schritt 5: localStorage wird automatisch gespeichert

**Datei:** `src/lib/stores/kanbanStore.svelte.ts`

Die `triggerUpdate()`-Methode speichert automatisch:

```typescript
private triggerUpdate(): void {
    this.updateTrigger++; // ← Inkrementiert den State
    this.saveToStorage(); // ← Speichert in localStorage SYNCHRON!
}

private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
        const data = this.board.getContextData(true);
        localStorage.setItem('kanban-board-data', JSON.stringify(data));
        console.log('💾 Board in localStorage gespeichert');
    } catch (error) {
        console.warn('⚠️ Fehler beim Speichern:', error);
    }
}
```

**Keine weitere Aktion nötig** - das ist bereits implementiert! ✅

---

## 🔍 Häufige Fehler und Lösungen

| Problem | Ursache | Lösung |
|---------|--------|--------|
| **UI aktualisiert sich nicht sofort** | `triggerUpdate()` nicht aufgerufen | Stelle sicher dass Store-Methode `triggerUpdate()` ruft |
| **UI aktualisiert sich, verschwindet aber nach Reload** | `saveToStorage()` nicht aufgerufen | `triggerUpdate()` muss aufgerufen werden (speichert automatisch) |
| **Änderung bleibt lokal aber wird nicht im Store gespeichert** | Handler ruft Store nicht auf | Nutze `boardStore.updateColumn()` statt `name = editName` |
| **Komponente aktualisiert sich nicht von Store-Änderungen** | Kein `$effect` implementiert | Füge `$effect` ein der `boardStore.uiData` beobachtet |
| **Unendliche Re-Renders / Loop** | `$effect` verändert was er beobachtet | Prüfe ob Wert tatsächlich geändert wurde vor Update |

---

## 📝 Praktische Beispiele

### Beispiel 1: Karten-Titel ändern

**Model** (`BoardModel.ts`):
```typescript
public update(props: Partial<CardProps>): void {
    if (props.heading !== undefined) this.heading = props.heading;
    // ... weitere Props
    this.updatedAt = generateTimestamp();
}
```

**Store** (`kanbanStore.svelte.ts`):
```typescript
public updateCard(cardId: string, updates: Partial<CardProps>): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.update(updates);
        this.triggerUpdate(); // 🔑
        this.publishToNostr();
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

**Component Handler** (`Card.svelte`):
```svelte
<script>
    let title = $props.required<string>();
    let cardId = $props.required<string>();
    let editTitle = $state(title);

    function handleSave() {
        if (editTitle !== title) {
            boardStore.updateCard(cardId, { heading: editTitle });
        }
    }
</script>

<button onclick={handleSave}>Speichern</button>
```

**Component Effect** (`Card.svelte`):
```svelte
$effect(() => {
    const uiCards = boardStore.uiData;
    // Suche Karte und aktualisiere title
    // ...
});
```

---

### Beispiel 2: Label zu Karte hinzufügen

**Store** (`kanbanStore.svelte.ts`):
```typescript
public addLabelToCard(cardId: string, label: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        const newLabels = [...result.card.labels, label];
        result.card.update({ labels: newLabels });
        this.triggerUpdate(); // 🔑
        this.publishToNostr();
    }
}
```

**Component**:
```svelte
function handleAddLabel() {
    boardStore.addLabelToCard(cardId, newLabel);
    newLabel = '';
}
```

---

## 🎨 Svelte 5 Runes Checkliste

Bei der Implementierung musst du folgende Svelte 5 Runes nutzen:

| Rune | Verwendung | Beispiel |
|------|-----------|---------|
| `$state` | Lokaler reaktiver Zustand in Komponente | `let editName = $state(name)` |
| `$props` | Props empfangen (mit `$props.required` für Required) | `let name = $props.required<string>()` |
| `$derived` | Berechnete reaktive Werte | `let count = $derived(items.length)` |
| `$derived.by` | Komplexe abgeleitete Logik | `public uiData = $derived.by(() => { ... })` |
| `$effect` | Seiteneffekte bei Reaktivitäts-Änderungen | `$effect(() => { ... })` |

---

## ✅ Implementierungs-Checkliste für neue Features

Wenn du ein neues Feature mit Prop-Änderungen hinzufügst:

- [ ] **Store-Methode** erstellt (`updateXyz()` in BoardStore)
- [ ] **Model-Update** verfügbar (`update()` Methode in Modell-Klasse)
- [ ] **Component Handler** implementiert (z.B. `handleRename()`)
- [ ] **Handler ruft Store auf** (nicht lokale Änderung!)
- [ ] **$effect hinzugefügt** zur Synchronisation von Store zu UI
- [ ] **$effect prüft auf tatsächliche Änderungen** (verhindert Loops)
- [ ] **localStorage-Speicherung** funktioniert (auto via `triggerUpdate()`)
- [ ] **Test:** Ändere Wert → sollte sofort sichtbar sein
- [ ] **Test:** Refresh Browser → Wert sollte erhalten bleiben

---

## 🔗 Verwandte Dokumentation

- **[MULTI-LAYER STORAGE.md](./MULTI-LAYER%20STORAGE.md)** — Detaillierte Erklärung der Speicher-Architektur
- **[STORES.md](./STORES.md)** — Store-Design Pattern und Runes
- **[AGENTS.md](./AGENTS.md)** — BoardStore Spezifikation
- **[UX-RULES.md](./UX-RULES.md)** — UI-Komponenten Patterns

---

## 💡 Best Practices

1. **Immer `triggerUpdate()` aufrufen** nach Model-Änderungen
2. **Nutze `$effect` für UI-Sync** statt manueller Event-Handler
3. **Prüfe auf echte Änderungen** vor Store-Aufrufen (Optimierung)
4. **Lokale State bleibt lokal** (`let editName = $state()`)
5. **Store ist Single Source of Truth** - synchronisiere von dort
6. **localStorage wird automatisch aktualisiert** - keine manuelle Arbeit nötig
7. **Debug-Logs helfen** beim Troubleshooting der Reaktivität


## Besipielflow

Nutzer ändert Spalten-Name im Popover
    ↓
handleRename() ruft boardStore.updateColumn() auf ✅ (Schritt 1-2)
    ↓
updateColumn() ruft triggerUpdate() auf ✅ (Schritt 1)
    ↓
triggerUpdate() ändert $state(updateTrigger) ✅ (Svelte 5 Reaktivität)
    ↓
uiData wird neu berechnet (ist $derived.by) ✅ (Schritt 3)
    ↓
Column.svelte $effect triggert und sieht neue Name ✅ (Schritt 3)
    ↓
UI rendert sofort neu mit neuem Namen ✅
    ↓
localStorage wird automatisch gespeichert ✅ (Schritt 5)