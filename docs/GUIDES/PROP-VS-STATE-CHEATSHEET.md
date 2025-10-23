# Prop vs State Template Pattern - CHEAT SHEET

**Schnelle Referenz zum Verhindern von Reactive Flow Bugs**

---

## The Pattern (3 Teile)

### TEIL 1: Lokale State Variable

```typescript
let { card } = $props();

// Erstelle lokale Spiegelung für alle veränderbaren Props
let localImage = $state(card.image || '');
let localName = $state(card.name || '');
let localPublishState = $state(card.publishState || 'draft');
```

**Naming Rule:** `local{PropertyName}` (z.B. `localImage`, `localName`)

---

### TEIL 2: $effect Synchronization

```typescript
$effect(() => {
    const uiData = boardStore.uiData;  // ← Dependency!
    
    const updatedCard = uiData
        .flatMap(c => c.items)
        .find(c => c.id === card.id);
    
    if (updatedCard) {
        if (updatedCard.image !== localImage) {
            localImage = updatedCard.image || '';
        }
        if (updatedCard.name !== localName) {
            localName = updatedCard.name || '';
        }
    }
});
```

**Regeln:**
- ✅ $effect liest `boardStore.uiData` (oder ähnliche $derived)
- ✅ $effect aktualisiert lokale `$state` Variablen
- ✅ Nur State Variablen, NIEMALS Props mutieren!

---

### TEIL 3: Template Binding

```svelte
<!-- ❌ FALSCH -->
{#if card.image}
    <img src={card.image} alt={card.name} />
{/if}

<!-- ✅ RICHTIG -->
{#if localImage}
    <img src={localImage} alt={localName} />
{/if}
```

**Regeln:**
- ✅ Template nutzt IMMER `local*` Variablen
- ✅ Keine direkten Prop-Zugriffe für veränderbare Werte
- ✅ Read-only Props (z.B. `card.id`) können direkt verwendet werden

---

## One-Liner Verification

```bash
# Script zum Überprüfen von Komponenten
# 1. Finde alle let local* Variablen
grep "let local[A-Z]" Card.svelte

# 2. Für JEDE: Stelle sicher Template nutzt diese Variable
# z.B. für "let localImage"
grep "{localImage}" Card.svelte  # ← Sollte Treffer haben!
grep "{card\.image}" Card.svelte # ← Sollte LEER sein!

# 3. Compile Check
pnpm run check
```

---

## Common Mistakes & Fixes

| Mistake | Error | Fix |
|---------|-------|-----|
| `{card.image}` statt `{localImage}` | UI zeigt alte Werte | Use `{localImage}` |
| `$effect` liest falsche Dependency | $effect triggert nicht | Read `boardStore.uiData` |
| Keine lokale `$state` Variable | Prop Mutation Error | Create `let local*` |
| `triggerUpdate()` vergessen | Keine Reaktivität | Call `triggerUpdate()` |
| $effect mutiert Prop direkt | ownership_invalid_mutation | Use local state only |

---

## Store Side: What You MUST Do

```typescript
// ✅ In kanbanStore.svelte.ts
public editCard(cardId: string, updates: Partial<CardProps>): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.update(updates);
        this.triggerUpdate();  // ← CRITICAL! Don't forget!
    }
}
```

**checklist:**
- ✅ Store method calls `triggerUpdate()`
- ✅ `updateTrigger++` incremented
- ✅ `saveToStorage()` called
- ✅ `$derived.by()` reads `updateTrigger`

---

## Examples: Property Patterns

### Example 1: Image Field

```svelte
<script>
  let { card } = $props();
  let localImage = $state(card.image || '');
  
  $effect(() => {
    const updated = findUpdatedCard(boardStore.uiData, card.id);
    if (updated?.image !== localImage) {
      localImage = updated?.image || '';
    }
  });
</script>

{#if localImage}
  <img src={localImage} alt="card image" />
{/if}
```

### Example 2: Text Field

```svelte
<script>
  let { card } = $props();
  let localName = $state(card.name || '');
  
  $effect(() => {
    const updated = findUpdatedCard(boardStore.uiData, card.id);
    if (updated?.name !== localName) {
      localName = updated?.name || '';
    }
  });
</script>

<input bind:value={localName} />
<span>{localName}</span>
```

### Example 3: Select/Dropdown

```svelte
<script>
  let { card } = $props();
  let localPublishState = $state(card.publishState || 'draft');
  
  $effect(() => {
    const updated = findUpdatedCard(boardStore.uiData, card.id);
    if (updated?.publishState !== localPublishState) {
      localPublishState = updated?.publishState || 'draft';
    }
  });
</script>

<select bind:value={localPublishState}>
  <option>draft</option>
  <option>published</option>
  <option>archived</option>
</select>
```

---

## Testing Flow

```typescript
// 1. USER ACTION
boardStore.editCard(cardId, { image: 'https://new.jpg' });

// 2. CHECK CONSOLE
console.log({
    storedValue: boardStore.uiData...,  // Should be NEW
    localValue: localImage,             // Should be NEW
    cardProp: card.image,               // Might be old (parent not updated)
});

// 3. CHECK UI
// Template should show NEW value immediately

// 4. CHECK PERSISTENCE
// Reload page → value should still be there
```

---

## When to Use Local State

| Scenario | Use Local State? |
|----------|------------------|
| Value changes via $effect | ✅ YES |
| Value from form input | ✅ YES |
| Value from store (mutable) | ✅ YES |
| Static value | ❌ NO |
| Read-only ID field | ❌ NO |
| Display-only prop | ❌ NO |

---

## Debugging Checklist (When Broken)

- [ ] Prop exists in Card class? `card.image` defined?
- [ ] uiData includes property? Check `uiData` transformation
- [ ] Local variable initialized? `let localImage = $state(...)`
- [ ] $effect exists? Re-reading from store?
- [ ] triggerUpdate() called? Check store method
- [ ] Template uses local? `{localImage}` not `{card.image}`
- [ ] Console shows values? Debug log in $effect
- [ ] Compile pass? `pnpm run check`

---

## TL;DR - The Three Rules

1. **Local State Rule**: Create `let local{Property}` for each mutable prop
2. **Template Rule**: ALWAYS use `{local{Property}}`, never `{prop.{Property}}`
3. **Sync Rule**: Use `$effect` to keep local in sync with store updates

✅ Follow these = No more reactive bugs!

---

**Last Update:** 23. Oktober 2025  
**Status:** Production Ready
