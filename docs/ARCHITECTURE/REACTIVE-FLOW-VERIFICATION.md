# Reactive Flow Verification Routine

**Ziel:** Verhinderung von komplexen reaktiven Bugs durch systematische Verifikation der Svelte 5 Rune-Patterns.

**Letztes Update:** 23. Oktober 2025  
**Status:** Production Ready ✅

---

## Das Problem: Prop vs State Template Bug

Ein einfacher aber tückischer Bug in komplexen reaktiven Flows:

```typescript
// $state Variable wird aktualisiert
let localImage = $state(card.image || '');

// $effect triggert und synchronisiert
$effect(() => {
    if (updatedCard.image !== localImage) {
        localImage = updatedCard.image;  // ← WIRD AKTUALISIERT!
    }
});

// ABER Template zeigt alte Prop:
{#if card.image}       <!-- ← FALSCH: zeigt alten Wert -->
    <img src={card.image} />
{/if}

// NICHT die neue State Variable:
{#if localImage}       <!-- ← RICHTIG: zeigt neuen Wert -->
    <img src={localImage} />
{/if}
```

**Warum ist das ein Problem?**
1. Console zeigt: `🔄 Card image updated: https://...` ✓
2. UI zeigt: altes oder kein Bild ✗
3. Alles funktioniert (Store, $effect, Persistence), aber Template ist schuldig!

---

## The Verification Checklist (5 Schritte)

### SCHRITT 1️⃣: Data Source Mapping

**Frage:** Wo kommt dieser Wert her?

```typescript
// Für jeden Wert in der Template:
❓ card.image - Externe Quelle (Prop vom Parent)?
❓ localImage - Interne State ($state Variable)?
❓ derivedValue - Berechneter Wert ($derived)?
```

**Decision Tree:**

```
┌─ Ist es ein Prop (z.B. card.image)?
│  └─ Wird von Parent aktualisiert?
│     ├─ JA → Template kann {card.image} nutzen
│     └─ NEIN → Template MUSS lokale $state nutzen!
│
├─ Ist es eine $state Variable (z.B. localImage)?
│  └─ Template MUSS diese Variable nutzen!
│     ❌ NIEMALS die Original-Prop benutzen!
│
└─ Ist es ein $derived Wert?
   └─ Template kann direkt benutzen
      (automatisch reaktiv)
```

**Checkliste:**
- ✅ Alle Template-Variablen identifiziert
- ✅ Quelle jedes Wertes dokumentiert (Prop/State/Derived)
- ✅ Für jede $state Variable: Existiert auch lokale Variable?

---

### SCHRITT 2️⃣: Dependency Tracing

**Frage:** Wie wird dieser Wert aktualisiert?

```typescript
// Trace der Reaktivität:

State Change
    ↓
boardStore.editCard(cardId, { image: newUrl })
    ↓
triggerUpdate() aufgerufen?  ← ✅ MUST!
    ↓
updateTrigger++ (State ändert)
    ↓
$derived.by() Abhängigkeit triggert?  ← ✅ Muss updateTrigger lesen!
    ↓
uiData wird neu berechnet
    ↓
$effect in Component triggert?  ← ✅ Muss uiData lesen!
    ↓
localImage = updatedCard.image
    ↓
Template liest {localImage}  ← ✅ MUSS von State nutzen!
    ↓
UI rendern mit neuem Wert  ← ✅ ENDLICH!
```

**Checkliste:**
- ✅ Store-Methode aufgerufen? (z.B. `boardStore.editCard()`)
- ✅ `triggerUpdate()` wird aufgerufen?
- ✅ `$derived.by()` liest `updateTrigger` explizit?
- ✅ `$effect` hängt von `boardStore.uiData` ab?
- ✅ `$effect` aktualisiert lokale `$state` Variable?

---

### SCHRITT 3️⃣: Component-Level Template Audit

**Vor dem Commit: Durchlaufe jede Template-Variable**

```svelte
<script>
  let { card } = $props();
  let localName = $state(card.name);
  let localImage = $state(card.image || '');
  let localPublishState = $state(card.publishState);
  
  $effect(() => {
    const uiColumns = boardStore.uiData;
    const updatedCard = uiColumns
      .flatMap(c => c.items)
      .find(c => c.id === card.id);
    
    if (updatedCard && updatedCard.image !== localImage) {
      localImage = updatedCard.image;
    }
  });
</script>

<!-- AUDIT: Welche Variablen werden verwendet? -->
<div>
  <!-- ✅ RICHTIG: Nutzt lokale State -->
  {localImage}          <!-- State Variable (reaktiv) -->
  {localName}           <!-- State Variable (reaktiv) -->
  {localPublishState}   <!-- State Variable (reaktiv) -->
  
  <!-- ✅ AUCH OK: Nutzt Prop (read-only) -->
  {card.id}             <!-- Prop (ändert sich nicht) -->
  {card.updatedAt}      <!-- Prop (read-only) -->
  
  <!-- ❌ FALSCH: Nutzt alte Prop statt State -->
  {card.image}          <!-- ✗ FALSCH! Sollte {localImage} sein! -->
  {card.name}           <!-- ✗ FALSCH! Sollte {localName} sein! -->
  {card.publishState}   <!-- ✗ FALSCH! Sollte {localPublishState} sein! -->
</div>
```

**Naming Convention: `local{PropertyName}`**
```
card.image          → localImage
card.name           → localName
card.publishState   → localPublishState
card.color          → localColor
card.comments       → localComments
```

**Automatisierte Checks:**
```bash
# 1. Finde alle let local* Variablen
grep -n "let local[A-Z]" src/routes/cardsboard/Card.svelte

# 2. Für jede Variable: Prüfe dass Template diese nutzt
# z.B. für "let localImage"
#   ✅ Template sollte {localImage} enthalten
#   ❌ Template sollte NICHT {card.image} enthalten

# 3. Grep nach {card.} Mustern
grep -n "{card\." src/routes/cardsboard/Card.svelte
# Resultat sollte LEER sein oder nur read-only Props!
```

**Checkliste:**
- ✅ Alle veränderbaren Werte haben `local*` Variable?
- ✅ Template nutzt NIEMALS Props die als `local*` spiegeln?
- ✅ Keine undefinierte Variablen in Template?
- ✅ Alle `local*` Variablen haben Initialwerte?

---

### SCHRITT 4️⃣: $effect Dependencies überprüfen

**Häufiger Fehler:** $effect triggert nicht, weil Dependencies falsch sind.

```typescript
// ❌ FALSCH: Beobachtet falsches Dependency
$effect(() => {
    const newValue = boardStore.data;  // ← Zu granular!
    // Wenn nur eine Sub-Property ändert, triggert $effect nicht!
});

// ❌ FALSCH: Beobachtet nur Trigger, nicht die Daten
$effect(() => {
    const trigger = boardStore.updateTrigger;
    // Aber nicht die eigentlichen Daten gelesen!
});

// ✅ RICHTIG: Beobachtet die richtige $derived Ebene
$effect(() => {
    const uiColumns = boardStore.uiData;  // ← $derived.by() Rückgabewert
    // Wenn updateTrigger ändert → uiData wird neu berechnet → $effect triggered
    const updatedCard = uiColumns.flatMap(c => c.items).find(...);
    localImage = updatedCard?.image || '';
});

// ✅ AUCH RICHTIG: Explizit lesen für Dependency Tracking
$effect(() => {
    const trigger = boardStore.updateTrigger;  // ← Explizite Dependency
    const data = boardStore.uiData;            // ← Auch gelesen
    // Beide werden als Dependencies tracked
});
```

**Rune Dependency Rules:**
```typescript
// In $derived.by() oder $effect MUSS gelesen werden:
const trigger = boardStore.updateTrigger;  // ← Svelte tracked dies!

// Nicht ausreichend:
if (boardStore.updateTrigger > 5) { }  // ← WIRD gelesen
let x = boardStore.updateTrigger;      // ← WIRD gelesen
return boardStore.updateTrigger + 1;   // ← WIRD gelesen

// NICHT ausreichend:
const x = 5;  // ← Nicht gelesen!
console.log('value');  // ← Kein read!
```

**Checkliste:**
- ✅ $derived.by() liest `boardStore.updateTrigger`?
- ✅ $effect liest `boardStore.uiData` (nicht Subproperties)?
- ✅ Keine circular dependencies? (z.B. $effect mutiert seine Dependency?)
- ✅ Alle reaktiven Quellen gelesen?

**Debugging $effect:**
```typescript
$effect(() => {
    console.log('$effect triggered with:', {
        trigger: boardStore.updateTrigger,
        uiDataLength: boardStore.uiData.length
    });
    // Your logic here
});
```

---

### SCHRITT 5️⃣: Manual Testing & Verification

**Test Pattern vor dem Commit:**

```typescript
// SETUP: Öffne Developer Console (F12)

// 1. STATE CHANGE
boardStore.editCard(cardId, { image: 'https://new-image.jpg' });

// 2. VERIFY IN CONSOLE
console.log('Values after edit:');
console.log('  card.image:', card.image);       // Might be old (parent not updated)
console.log('  localImage:', localImage);       // Should be NEW!
console.log('  Template shows:', ???);          // ← SCHAU SELBST!

// 3. WENN TEMPLATE ALTE WERT ZEIGT
//    Root Cause 1: localImage ist nicht in Template benutzt
//    Root Cause 2: Template benutzt {card.image} statt {localImage}
//    Root Cause 3: $effect wurde nicht triggered

// 4. DEBUG FIX
// Option A: Prüfe dass Template {localImage} nutzt
grep -n "{localImage}" src/routes/cardsboard/Card.svelte

// Option B: Prüfe dass $effect triggert
// (Füge console.log oben ein)

// Option C: Prüfe dass boardStore.editCard() triggerUpdate() aufruft
grep -n "triggerUpdate" src/lib/stores/kanbanStore.svelte.ts
```

**Checkliste:**
- ✅ State-Änderung triggert Console-Log?
- ✅ Lokale Variable zeigt neuen Wert?
- ✅ Template zeigt neuen Wert?
- ✅ Wert persisted nach Reload?
- ✅ Keine Console-Fehler?

---

## Complete Workflow Example

### Szenario: Image URL in CardDialog ändern

```
User Action (Browser)
  ↓
CardDialog handleSubmit()
  ├→ onSave(cardId, { image: newUrl })
  │
  ↓
Card.svelte handleEditSave()
  ├→ boardStore.editCard(cardId, { image: newUrl })
  │
  ↓
kanbanStore.svelte.ts editCard()
  ├→ updateCard(cardId, { image: newUrl })
  │  ├→ card.update({ image: newUrl })  [Model-Layer]
  │  └→ triggerUpdate() ← CRITICAL!
  │
  ↓
triggerUpdate() in boardStore
  ├→ updateTrigger++  [State ändert]
  ├→ saveToStorage()  [Persistence]
  │
  ↓
updateTrigger + uiData $derived.by() re-evaluates
  ├→ Liest: const trigger = boardStore.updateTrigger
  ├→ Liest: board.columns (mappiert zu uiData)
  │
  ↓
Column.svelte $effect triggert
  ├→ Beobachtet: boardStore.uiData
  ├→ Findet: updatedColumn
  ├→ Updated: items Prop
  │
  ↓
Card.svelte $effect triggert
  ├→ Beobachtet: boardStore.uiData
  ├→ Findet: updatedCard
  ├→ Updated: localImage = updatedCard.image
  │
  ↓
Template Re-render
  ├→ {#if localImage}  ← RICHTIG
  ├→ <img src={localImage} />  ← RICHTIG
  │
  ✓ IMAGE SICHTBAR!
```

---

## Häufige Fehler & Fixes

### Error 1: "Template zeigt alte Wert nach Save"

**Symptom:**
- Console: `🔄 Card image updated: https://...` ✓
- UI: kein Bild oder altes Bild ✗

**Root Causes (in Priorität):**
1. Template nutzt `{card.image}` statt `{localImage}`
2. `localImage` wird nicht initialisiert
3. `$effect` wird nicht triggered
4. `triggerUpdate()` wird nicht aufgerufen

**Fix:**
```svelte
<!-- ❌ WAS -->
{#if card.image}
  <img src={card.image} />
{/if}

<!-- ✅ NOW -->
{#if localImage}
  <img src={localImage} />
{/if}
```

---

### Error 2: "$effect wird nicht ausgelöst"

**Symptom:**
- Lokale State wird nicht aktualisiert
- Console zeigt kein "triggered"

**Root Cause:**
$effect liest falsches Dependency

**Fix:**
```typescript
// ❌ WAS
$effect(() => {
    console.log(boardStore.data);  // Zu granular!
});

// ✅ NOW
$effect(() => {
    const uiData = boardStore.uiData;  // $derived.by() Rückgabewert
    console.log(uiData);
});
```

---

### Error 3: "$derived wird nicht neu berechnet"

**Symptom:**
- `$derived.by()` reagiert nicht auf `updateTrigger` Änderungen
- Daten sind alt

**Root Cause:**
`updateTrigger` wird nicht explizit in `$derived.by()` gelesen

**Fix:**
```typescript
// ❌ WAS
let uiData = $derived.by(() => {
    return boardStore.data;  // updateTrigger nicht gelesen!
});

// ✅ NOW
let uiData = $derived.by(() => {
    const trigger = boardStore.updateTrigger;  // ← Explicit read!
    return boardStore.data;
});
```

---

## Pre-Commit Checklist

**Vor jedem Commit: Diese Punkte durchgehen**

```markdown
## Reactive Flow Pre-Commit Checklist

### Component-Level Audit
- [ ] Alle `let local{Property}` Variablen identifiziert?
- [ ] Template nutzt NIEMALS die Original-Props dieser Variablen?
- [ ] Alle `local*` Variablen haben Initialwerte?
- [ ] Keine undefined/null Fehler in Template?

### $effect Verification
- [ ] $effect beobachtet `boardStore.uiData` (oder richtige Dependency)?
- [ ] $effect aktualisiert lokale `$state` Variablen?
- [ ] Keine circular dependencies?

### $derived.by Verification (Store-Level)
- [ ] Alle `$derived.by()` Funktionen lesen Runes explizit?
- [ ] `const trigger = boardStore.updateTrigger;` vorhanden?
- [ ] Dependencies im Store-Level richtig propagiert?

### Store Methods Verification
- [ ] Alle card-modifizierenden Methoden rufen `triggerUpdate()` auf?
- [ ] `triggerUpdate()` inkrementiert `updateTrigger++`?
- [ ] `saveToStorage()` wird aufgerufen?

### Manual Testing
- [ ] Change → Console log zeigt neuen Wert? ✓
- [ ] Change → UI zeigt sofort neuen Wert? ✓
- [ ] Change → Nach Reload immer noch sichtbar? ✓
- [ ] Kein Reload nötig? ✓

### Final Build Check
- [ ] `pnpm run check` erfolgreich?
- [ ] 0 Fehler, 0 Warnungen?
- [ ] Keine ownership_invalid_mutation Fehler?
```

---

## Ressourcen

- **AGENTS.md** — Section X: Reactive Data Flow Verification Checklist (Langform)
- **copilot-instructions.md** — Rules 19-20: Prop vs State Pattern, Rune Dependencies
- **STORES.md** — Detaillierte Store-Architektur
- **Card.svelte** — Referenz-Implementation (Image Field)
- **CardViewDialog.svelte** — Working Pattern (currentCard $derived)

---

**Letzter Update:** 23. Oktober 2025  
**Status:** Production Ready ✅  
**Next Review:** Nach Implementierung weiterer reaktiver Features
