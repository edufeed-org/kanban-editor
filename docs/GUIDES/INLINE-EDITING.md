# Inline-Editing Guide

**Version:** 1.0  
**Datum:** 31. Januar 2026  
**Status:** ✅ Implementiert (Branch: `inline-editing`)

---

## 🎯 Übersicht

Das Kanban-Board unterstützt Inline-Editing für Board- und Spaltentitel. Anstatt einen Dialog zu öffnen, können Benutzer direkt auf den Titel klicken und ihn bearbeiten.

## ✨ Features

### 1. Board-Titel Inline-Editing (Topbar.svelte)

**Verhalten:**
- **Aktivierung**: Klick auf den Board-Titel
- **Visueller Hinweis**: Stift-Icon erscheint bei Hover
- **Speichern**: Enter-Taste
- **Abbrechen**: Escape-Taste oder Klick außerhalb
- **Feedback**: Toast-Benachrichtigung "Board-Titel gespeichert"

**Technische Details:**
```svelte
<script lang="ts">
  let isEditingBoardTitle = $state(false);
  let editableBoardTitle = $state(boardStore.board?.name || '');
  
  function handleBoardTitleSave() {
    if (editableBoardTitle.trim() && boardStore.board) {
      boardStore.updateBoard({ name: editableBoardTitle.trim() });
      toast.success('Board-Titel gespeichert');
    }
    isEditingBoardTitle = false;
  }
  
  function handleBoardTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBoardTitleSave();
    } else if (e.key === 'Escape') {
      isEditingBoardTitle = false;
      editableBoardTitle = boardStore.board?.name || '';
    }
  }
</script>

{#if isEditingBoardTitle}
  <input
    type="text"
    bind:value={editableBoardTitle}
    onkeydown={handleBoardTitleKeydown}
    onblur={handleBoardTitleSave}
    class="bg-transparent border-b border-primary"
  />
{:else}
  <button onclick={() => isEditingBoardTitle = true} class="group">
    <span>{boardStore.board?.name}</span>
    <PencilIcon class="opacity-0 group-hover:opacity-100" />
  </button>
{/if}
```

### 2. Spaltentitel Inline-Editing (Column.svelte)

**Verhalten:**
- **Aktivierung**: Klick auf den Spaltentitel
- **Drag-Konflikt vermieden**: Separater Drag-Handle (`grip-vertical`)
- **Speichern**: Enter-Taste
- **Abbrechen**: Escape-Taste
- **Read-Only-Modus**: Editing deaktiviert wenn `readOnly={true}`

**Technische Details:**
```svelte
<script lang="ts">
  let isEditingTitle = $state(false);
  let editableTitle = $state(column.name);
  
  function handleTitleSave() {
    if (editableTitle.trim() && editableTitle !== column.name) {
      boardStore.updateColumn(column.id, { name: editableTitle.trim() });
    }
    isEditingTitle = false;
  }
  
  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      isEditingTitle = false;
      editableTitle = column.name;
    }
  }
</script>

<div class="column-header">
  <!-- Drag Handle - nur dieses Element ist draggable -->
  <button class="drag-handle cursor-grab">
    <GripVerticalIcon class="h-4 w-4" />
  </button>
  
  {#if isEditingTitle}
    <input
      type="text"
      bind:value={editableTitle}
      onkeydown={handleTitleKeydown}
      onblur={handleTitleSave}
    />
  {:else}
    <button 
      onclick={() => !readOnly && (isEditingTitle = true)}
      disabled={readOnly}
    >
      {column.name}
    </button>
  {/if}
</div>
```

---

## 🎨 Styling-Empfehlungen

### Input-Feld im Edit-Modus

```css
/* Transparent Background für nahtloses Erscheinungsbild */
input[type="text"] {
  background: transparent;
  border: none;
  border-bottom: 2px solid hsl(var(--primary));
  outline: none;
  font-size: inherit;
  font-weight: inherit;
}

/* Dynamische Breite basierend auf Textlänge */
input {
  width: calc(var(--char-count, 10) * 0.6em + 1em);
  min-width: 100px;
  max-width: 300px;
}
```

### Hover-Indikator

```css
/* Zeige Bearbeitbarkeit durch Hover-Effekt */
.editable-title {
  cursor: pointer;
}

.editable-title:hover {
  text-decoration: underline;
  text-decoration-style: dotted;
}

/* Stift-Icon nur bei Hover */
.edit-icon {
  opacity: 0;
  transition: opacity 150ms;
}

.editable-title:hover .edit-icon {
  opacity: 1;
}
```

---

## 🔧 Integration mit BoardStore

### Speichern der Änderungen

```typescript
// Board-Titel aktualisieren
boardStore.updateBoard({ name: newTitle });

// Spalten-Titel aktualisieren
boardStore.updateColumn(columnId, { name: newTitle });
```

### Validierung

```typescript
function validateTitle(title: string): boolean {
  // Mindestens 1 Zeichen nach trim()
  if (!title.trim()) return false;
  
  // Maximale Länge (optional)
  if (title.length > 100) return false;
  
  return true;
}
```

---

## 📱 Mobile-Verhalten

### Touch-Events

- **Tap**: Aktiviert Inline-Editing (wie Klick)
- **Long-Press**: Wird für Drag-and-Drop verwendet, NICHT für Editing
- **Keyboard**: Virtuelles Keyboard erscheint automatisch

### Fokus-Management

```typescript
// Auto-Fokus und Text-Selektion beim Start des Editings
function startEditing(inputRef: HTMLInputElement) {
  inputRef.focus();
  inputRef.select(); // Gesamten Text markieren
}
```

---

## ⚠️ Bekannte Einschränkungen

1. **Kein Multi-Line**: Titel sind immer einzeilig (kein `<textarea>`)
2. **Keine Undo-Funktion**: Änderungen werden sofort gespeichert
3. **Gleichzeitiges Editing**: Wenn zwei Benutzer gleichzeitig bearbeiten, gilt Last-Write-Wins

---

## 🧪 Testen

### Manuelle Tests

1. **Board-Titel**:
   - [ ] Klick auf Titel → Input erscheint
   - [ ] Enter → Speichert und zeigt Toast
   - [ ] Escape → Verwirft Änderung
   - [ ] Leerer Titel → Wird nicht gespeichert

2. **Spaltentitel**:
   - [ ] Klick auf Titel → Input erscheint
   - [ ] Drag-Handle → Startet Drag (nicht Editing)
   - [ ] Read-Only-Modus → Editing deaktiviert

### Automatisierte Tests (Playwright)

```typescript
test('inline editing board title', async ({ page }) => {
  await page.goto('/cardsboard');
  
  // Klick auf Board-Titel
  await page.click('[data-testid="board-title"]');
  
  // Input sollte erscheinen
  await expect(page.locator('input[data-testid="board-title-input"]')).toBeVisible();
  
  // Neuen Titel eingeben
  await page.fill('input[data-testid="board-title-input"]', 'Neuer Titel');
  await page.press('input[data-testid="board-title-input"]', 'Enter');
  
  // Toast überprüfen
  await expect(page.locator('.toast')).toContainText('gespeichert');
});
```

---

## 📚 Verwandte Dokumentation

- [PROP-VS-STATE-CHEATSHEET.md](./PROP-VS-STATE-CHEATSHEET.md) - State-Management in Svelte 5
- [STORE-PATTERNS.md](./STORE-PATTERNS.md) - BoardStore Patterns
- [PR.md](../../PR.md) - Pull Request Details

---

## 📝 Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | 31.01.2026 | Initial Release - Board + Column Inline-Editing |
