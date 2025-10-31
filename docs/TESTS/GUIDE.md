# 📖 Test-Guide - Vollständige Anleitung

**Zielgruppe:** Entwickler & Maintenance  
**Schwierigkeit:** ⭐ Easy bis ⭐⭐ Medium  
**Zeit:** 10 Minuten Setup + Durchführung  

---

## 🎯 Überblick: Moderne Test-Strategie

Das Projekt nutzt **3 spezialisierte Test-Tools** für unterschiedliche Szenarien:

| Tool | Typ | Ort | Geschwindigkeit | Browser | Wann nutzen |
|------|-----|-----|-----------------|---------|------------|
| **Vitest** | Unit | `*.spec.ts` neben Komponente | ⚡⚡⚡ Sehr schnell | ❌ Nein | Funktions-Tests |
| **Vitest** | Store | `*.svelte.spec.ts` neben Store | ⚡⚡ Schnell | ❌ Nein | State & Reactivity |
| **Playwright** | E2E | `e2e/*.test.ts` | 🐢 Langsam | ✅ Ja | User-Journeys |

---

## 🚀 Quick Start

### 1️⃣ Unit & Store Tests ausführen (Vitest)

```bash
# Einmalig ausführen
pnpm run test:unit

# ODER: Mit Watch Mode (während Entwicklung)
pnpm run test:unit:watch

# ODER: Nur bestimmte Datei
pnpm run test:unit -- BoardModel.spec.ts
```

**Output Beispiel:**
```
✓ src/lib/classes/BoardModel.spec.ts (12 tests) 15ms
✓ src/lib/stores/kanbanStore.svelte.spec.ts (8 tests) 22ms
✓ src/routes/cardsboard/Card.svelte.spec.ts (5 tests) 8ms

Test Files  3 passed (3)
     Tests  25 passed (25)
  Duration  1.93s
```

---

### 2️⃣ E2E Tests ausführen (Playwright)

```bash
# Nur E2E Tests
pnpm run test:e2e

# ODER: Mit UI-Debugger
pnpm run test:e2e -- --ui

# ODER: Mit headed Browser (sichtbar)
pnpm run test:e2e -- --headed
```

**Output Beispiel:**
```
Running 1 test using 1 worker

✓ e2e/demo.test.ts:3:1 › home page has expected h1 (421ms)

1 passed (29.8s)
```

---

### 3️⃣ Alle Tests ausführen

```bash
# Unit + E2E Tests
pnpm run test

# Aktuell: 45 Unit Tests + 1 E2E Test = 46 Tests
```

---

## 📝 Neue Tests schreiben

### Pattern 1️⃣: Unit Test (Klassen & Funktionen)

**Dateistruktur:**
```
src/lib/classes/
├── BoardModel.ts
└── BoardModel.spec.ts          ← Test sitzt daneben!
```

**Beispiel: Card-Klasse testen**

```typescript
// src/lib/classes/BoardModel.spec.ts
import { describe, it, expect } from 'vitest';
import { Card, Column, Board } from './BoardModel';

describe('Card Operations', () => {
  it('erstellt Karte mit eindeutiger ID', () => {
    const card = new Card({ heading: 'Test Karte' });
    
    expect(card.id).toBeDefined();
    expect(card.id.length).toBeGreaterThan(0);
    expect(card.heading).toBe('Test Karte');
  });

  it('aktualisiert Karten-Eigenschaften', () => {
    const card = new Card({ heading: 'Alt' });
    
    card.update({ heading: 'Neu', color: 'red' });
    
    expect(card.heading).toBe('Neu');
    expect(card.color).toBe('red');
  });

  it('verwaltet Kommentare korrekt', () => {
    const card = new Card({ heading: 'Test' });
    
    card.addComment('Wichtig!', 'npub123');
    expect(card.comments).toHaveLength(1);
    expect(card.comments[0].text).toBe('Wichtig!');
    
    const commentId = card.comments[0].id;
    card.deleteComment(commentId);
    expect(card.comments).toHaveLength(0);
  });

  it('serialisiert korrekt für KI-Kontext', () => {
    const card = new Card({
      heading: 'Aufgabe',
      content: 'Beschreibung',
      labels: ['bug', 'urgent']
    });
    
    const context = card.getContextData();
    
    expect(context.id).toBeDefined();
    expect(context.heading).toBe('Aufgabe');
    expect(context.labels).toEqual(['bug', 'urgent']);
    expect(context.publishState).toBe('draft');
  });
});

describe('Board Operations', () => {
  it('verwaltet Spalten und Karten hierarchisch', () => {
    const board = new Board({ name: 'Test Board' });
    const col1 = board.addColumn({ name: 'To Do' });
    const col2 = board.addColumn({ name: 'Done' });
    
    const card = col1.addCard({ heading: 'Task' });
    
    expect(board.columns).toHaveLength(2);
    expect(col1.cards).toHaveLength(1);
    expect(card.heading).toBe('Task');
  });

  it('verschiebt Karten zwischen Spalten', () => {
    const board = new Board({ name: 'Test' });
    const col1 = board.addColumn({ name: 'A' });
    const col2 = board.addColumn({ name: 'B' });
    
    const card = col1.addCard({ heading: 'Task' });
    const cardId = card.id;
    
    board.moveCard(cardId, col1.id, col2.id);
    
    expect(col1.cards).toHaveLength(0);
    expect(col2.cards).toHaveLength(1);
    expect(col2.findCard(cardId)).toBeDefined();
  });

  it('findet Karten im gesamten Board', () => {
    const board = new Board({ name: 'Test' });
    const col = board.addColumn({ name: 'To Do' });
    const card = col.addCard({ heading: 'Task' });
    
    const found = board.findCardAndColumn(card.id);
    
    expect(found).not.toBeNull();
    expect(found?.card.heading).toBe('Task');
    expect(found?.column.name).toBe('To Do');
  });
});
```

---

### Pattern 2️⃣: Store Test (Svelte Runes & Reactivity)

**Dateistruktur:**
```
src/lib/stores/
├── kanbanStore.svelte.ts
└── kanbanStore.svelte.spec.ts  ← Test neben Store!
```

**Beispiel: BoardStore Reaktivität testen**

```typescript
// src/lib/stores/kanbanStore.svelte.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { boardStore } from './kanbanStore.svelte';

describe('BoardStore Reactivity', () => {
  beforeEach(() => {
    // Setup vor jedem Test
    localStorage.clear();
    boardStore.reset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('erstellt neue Karten und triggert $derived Update', () => {
    const colId = boardStore.addColumn({ name: 'To Do' });
    
    // Initial state
    expect(boardStore.uiData.columns).toHaveLength(1);
    
    // createCard() ruft triggerUpdate() auf
    boardStore.createCard(colId, 'Test Card');
    
    // $derived.by wurde getriggert → uiData neu berechnet
    expect(boardStore.uiData.columns[0].cards).toHaveLength(1);
    expect(boardStore.uiData.columns[0].cards[0].title).toBe('Test Card');
  });

  it('aktualisiert localStorage synchron nach triggerUpdate()', () => {
    const colId = boardStore.addColumn({ name: 'Done' });
    boardStore.createCard(colId, 'Important Task');
    
    // localStorage wurde synchron aktualisiert (in triggerUpdate())
    const stored = JSON.parse(localStorage.getItem('kanban-board-data') || '{}');
    
    expect(stored.columns).toHaveLength(1);
    expect(stored.columns[0].cards).toHaveLength(1);
    expect(stored.columns[0].cards[0].heading).toBe('Important Task');
  });

  it('behält Spalten-Reihenfolge nach Drag-and-Drop bei', () => {
    boardStore.addColumn({ name: 'A' });
    boardStore.addColumn({ name: 'B' });
    boardStore.addColumn({ name: 'C' });
    
    // Simuliere Drag-and-Drop: C → Position 0
    const reorderedColumns = [
      boardStore.uiData.columns[2], // C
      boardStore.uiData.columns[0], // A
      boardStore.uiData.columns[1]  // B
    ];
    
    boardStore.syncBoardState(reorderedColumns);
    
    // Neue Reihenfolge sollte C, A, B sein
    expect(boardStore.uiData.columns[0].name).toBe('C');
    expect(boardStore.uiData.columns[1].name).toBe('A');
    expect(boardStore.uiData.columns[2].name).toBe('B');
  });

  it('lädt Daten aus localStorage beim Init', () => {
    // Setze Test-Daten in localStorage
    const testBoard = {
      id: 'board-1',
      name: 'Saved Board',
      columns: [
        {
          id: 'col-1',
          name: 'To Do',
          cards: [{ id: 'card-1', heading: 'Task' }]
        }
      ]
    };
    
    localStorage.setItem('kanban-board-data', JSON.stringify(testBoard));
    
    // Neuer Store lädt Daten
    const newStore = new BoardStore();
    
    expect(newStore.boardMeta.name).toBe('Saved Board');
    expect(newStore.uiData.columns).toHaveLength(1);
    expect(newStore.uiData.columns[0].cards).toHaveLength(1);
  });
});

describe('BoardStore Card Editing', () => {
  beforeEach(() => {
    localStorage.clear();
    boardStore.reset();
  });

  it('editiert Kartenmetriken und persistiert sofort', () => {
    const colId = boardStore.addColumn({ name: 'Backlog' });
    const cardId = boardStore.createCard(colId, 'Original');
    
    boardStore.editCard(cardId, {
      heading: 'Updated',
      color: 'blue'
    });
    
    const card = boardStore.findCard(cardId);
    expect(card?.heading).toBe('Updated');
    expect(card?.color).toBe('blue');
    
    // Verifikation: localStorage wurde aktualisiert
    const stored = JSON.parse(localStorage.getItem('kanban-board-data') || '{}');
    expect(stored.columns[0].cards[0].heading).toBe('Updated');
  });
});
```

---

### Pattern 3️⃣: E2E Test (Browser User Journey)

**Dateistruktur:**
```
e2e/
├── demo.test.ts           ← Existing
└── board-operations.test.ts ← New
```

**Beispiel: Board-Operationen E2E testen**

```typescript
// e2e/board-operations.test.ts
import { test, expect } from '@playwright/test';

test.describe('Board User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigiere zur App
    await page.goto('/cardsboard');
    
    // Warte bis Seite geladen ist
    await expect(page.getByRole('heading', { name: /Kanban/i })).toBeVisible();
  });

  test('user can create board and add cards', async ({ page }) => {
    // 1. Navigiere zum Hauptbereich
    await expect(page.getByRole('button', { name: /Neues Board/ })).toBeVisible();
    
    // 2. Erstelle neue Spalte
    await page.getByRole('button', { name: /Spalte hinzufügen/ }).click();
    await page.getByPlaceholder('Spalten-Name').fill('To Do');
    await page.getByRole('button', { name: /Erstellen/ }).click();
    
    // 3. Verifikation: Spalte wurde erstellt
    await expect(page.getByText('To Do')).toBeVisible();
    
    // 4. Füge Karte hinzu
    await page.getByRole('button', { name: /Karte hinzufügen/ }).click();
    await page.getByPlaceholder('Karten-Titel').fill('My First Task');
    await page.getByRole('button', { name: /Speichern/ }).click();
    
    // 5. Verifikation: Karte wurde erstellt
    await expect(page.getByText('My First Task')).toBeVisible();
  });

  test('user can drag and drop cards between columns', async ({ page }) => {
    // Setup: Erstelle 2 Spalten
    await page.getByRole('button', { name: /Spalte hinzufügen/ }).click();
    await page.getByPlaceholder('Spalten-Name').fill('To Do');
    await page.getByRole('button', { name: /Erstellen/ }).click();
    
    await page.getByRole('button', { name: /Spalte hinzufügen/ }).click();
    await page.getByPlaceholder('Spalten-Name').fill('Done');
    await page.getByRole('button', { name: /Erstellen/ }).click();
    
    // Erstelle Karte in To Do
    const toDoSection = page.locator('text=To Do').first();
    await toDoSection.getByRole('button', { name: /Karte hinzufügen/ }).click();
    await page.getByPlaceholder('Karten-Titel').fill('Drag Me');
    await page.getByRole('button', { name: /Speichern/ }).click();
    
    // Drag Card von To Do nach Done
    const card = page.getByText('Drag Me');
    const doneSection = page.locator('text=Done');
    
    await card.dragTo(doneSection);
    
    // Verifikation: Karte ist nun in Done
    await expect(doneSection.getByText('Drag Me')).toBeVisible();
  });

  test('user can edit card properties via modal', async ({ page }) => {
    // Setup
    await page.getByRole('button', { name: /Spalte hinzufügen/ }).click();
    await page.getByPlaceholder('Spalten-Name').fill('Backlog');
    await page.getByRole('button', { name: /Erstellen/ }).click();
    
    // Erstelle Karte
    await page.getByRole('button', { name: /Karte hinzufügen/ }).click();
    await page.getByPlaceholder('Karten-Titel').fill('Original Title');
    await page.getByRole('button', { name: /Speichern/ }).click();
    
    // Öffne Card Modal
    await page.getByText('Original Title').click();
    
    // Editiere Titel
    await page.getByPlaceholder('Titel').fill('Updated Title');
    await page.getByRole('button', { name: /Speichern/ }).click();
    
    // Verifikation: Titel wurde aktualisiert
    await expect(page.getByText('Updated Title')).toBeVisible();
    await expect(page.getByText('Original Title')).not.toBeVisible();
  });
});
```

---

## 📊 Test-Struktur im Projekt

```
src/
├── lib/
│   ├── classes/
│   │   ├── BoardModel.ts
│   │   └── BoardModel.spec.ts              ← Unit Tests (Klassen)
│   ├── stores/
│   │   ├── kanbanStore.svelte.ts
│   │   ├── kanbanStore.svelte.spec.ts      ← Store Tests (Reactivity)
│   │   ├── authStore.svelte.ts
│   │   └── authStore.svelte.spec.ts
│   └── utils/
│       ├── mergeEngine.ts
│       └── mergeEngine.spec.ts             ← Utility Tests
│
├── routes/
│   ├── cardsboard/
│   │   ├── Card.svelte
│   │   ├── Card.svelte.spec.ts             ← Component Tests
│   │   └── ...
│   └── page.svelte.spec.ts
│
e2e/
├── demo.test.ts                            ← E2E Tests
├── board-operations.test.ts
└── auth-flow.test.ts
```

---

## 🎯 Best Practices

### ✅ DO's

```typescript
// ✅ Tests neben Code
src/lib/classes/BoardModel.ts
src/lib/classes/BoardModel.spec.ts  // ← Hier!

// ✅ Aussagekräftige Test-Namen
it('creates card with unique ID and default draft state', () => { ... });

// ✅ Setup/Teardown nutzen
beforeEach(() => {
  localStorage.clear();
  boardStore.reset();
});

// ✅ Ein Konzept pro Test
it('serializes card to context data', () => {
  const card = new Card({ heading: 'Test' });
  const context = card.getContextData();
  expect(context.id).toBeDefined();
});

// ✅ Arrange-Act-Assert Pattern
it('moves card between columns', () => {
  // Arrange
  const board = new Board({ name: 'Test' });
  const colA = board.addColumn({ name: 'A' });
  const colB = board.addColumn({ name: 'B' });
  const card = colA.addCard({ heading: 'Task' });
  
  // Act
  board.moveCard(card.id, colA.id, colB.id);
  
  // Assert
  expect(colB.findCard(card.id)).toBeDefined();
  expect(colA.findCard(card.id)).toBeUndefined();
});
```

### ❌ DON'Ts

```typescript
// ❌ Tests zu weit weg vom Code
src/lib/classes/BoardModel.ts
tests/__tests__/BoardModel.test.ts  // ← Nicht hier!

// ❌ Unklare Test-Namen
it('works', () => { ... });

// ❌ Tests mit abhängig voneinander
test1: create card
test2: assumes card from test1 exists  // ❌ Abhängigkeit!

// ❌ Mehrere Konzepte pro Test
it('creates card and updates and serializes', () => { ... });

// ❌ Ohne Setup/Teardown
it('test', () => {
  // Nächster Test könnte beeinträchtigt sein!
});
```

---

## 🧪 Test-Kategorien

### 1️⃣ Unit Tests (Vitest)
- **Was**: Einzelne Funktionen, Klassen-Methoden
- **Wo**: `*.spec.ts` neben der Komponente
- **Geschwindigkeit**: ⚡⚡⚡ Sehr schnell (< 1s)
- **Beispiel**: `Card.addComment()`, `Board.moveCard()`

### 2️⃣ Store Integration Tests (Vitest)
- **Was**: `$state` Reaktivität, `$derived` Neuberechnungen, `triggerUpdate()` Side-Effects
- **Wo**: `*.svelte.spec.ts` neben dem Store
- **Geschwindigkeit**: ⚡⚡ Schnell (1-5s)
- **Beispiel**: `boardStore.createCard()` aktualisiert localStorage + uiData

### 3️⃣ E2E Tests (Playwright)
- **Was**: Komplette User-Journeys im Browser
- **Wo**: `e2e/*.test.ts`
- **Geschwindigkeit**: 🐢 Langsam (30-60s)
- **Beispiel**: "Nutzer erstellt Board → Fügt Karte hinzu → Speichert"

---

## 🚨 Häufige Fehler

### Problem 1: Tests finden Komponente nicht

```typescript
// ❌ FALSCH
import Card from './Card.svelte';

// ✅ RICHTIG
import Card from './Card.svelte';
import { render } from '@testing-library/svelte';
```

### Problem 2: $state wird nicht aktualisiert

```typescript
// ❌ FALSCH - keine triggerUpdate() Mutation
board.addColumn({ name: 'New' });
expect(store.uiData).toHaveLength(2);

// ✅ RICHTIG - nutze Store-Methode
boardStore.addColumn({ name: 'New' });
expect(boardStore.uiData.columns).toHaveLength(2);
```

### Problem 3: localStorage nicht geleert

```typescript
// ❌ FALSCH - Tests beeinflussen sich gegenseitig
it('test 1', () => {
  localStorage.setItem('data', 'test1');
});

it('test 2', () => {
  // localStorage hat immer noch 'test1'!
});

// ✅ RICHTIG - Cleanup nach jedem Test
afterEach(() => {
  localStorage.clear();
});
```

---

## 📚 Test-Mocking

### Mock localStorage

```typescript
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});
```

### Mock NDK / Nostr

```typescript
import { vi } from 'vitest';

const mockNDK = {
  publish: vi.fn().mockResolvedValue(true),
  fetchEvent: vi.fn()
};
```

### Mock window.nostr (NIP-07)

```typescript
const mockNostr = {
  getPublicKey: vi.fn().mockResolvedValue('npub1...'),
  signEvent: vi.fn()
};

vi.stubGlobal('nostr', mockNostr);
```

---

## ⚡ Performance Tips

### Tip 1: Nutze Watch Mode während Entwicklung

```bash
pnpm run test:unit:watch
# Tests laufen automatisch wenn du Code speicherst
```

### Tip 2: Teste nur eine Datei

```bash
pnpm run test:unit -- BoardModel.spec.ts
```

### Tip 3: E2E mit headed Browser debuggen

```bash
pnpm run test:e2e -- --headed
# Browser bleibt offen zum manuellen Debugging
```

---

## 🔗 Verwandte Dokumentation

- **AGENTS.md** — Test-Spezifikation & Patterns
- **docs/COLLABORATION/ROADMAP.md** — Test-Milestones
- **docs/TESTSUITE/STATUS.md** — Aktueller Test-Status

---

## 🎓 Lern-Ressourcen

### Vitest
- [Vitest Dokumentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)

### Playwright
- [Playwright Docs](https://playwright.dev/)
- [Playwright Inspector](https://playwright.dev/docs/inspector)

### Svelte 5 Testing
- [Svelte Testing Documentation](https://svelte.dev/docs/api/compile#compile-time-options)
- [Testing Runes](https://learn.svelte.dev/tutorial/testing)

---

## 💡 Zusammenfassung

**Test-Strategien des Projekts:**

1. **Unit Tests** → Klassen & Funktionen testen
   ```bash
   pnpm run test:unit
   ```

2. **Store Tests** → Reaktivität & Persistence testen
   ```bash
   pnpm run test:unit  # Same command!
   ```

3. **E2E Tests** → User-Journeys im Browser testen
   ```bash
   pnpm run test:e2e
   ```

**Alle zusammen:**
```bash
pnpm run test  # Unit + E2E
```

---

**Version:** 4.0 (Modern Test Strategy)  
**Letztes Update:** 31. Oktober 2025  
**Status:** 🟢 Production-Ready  

Siehe auch: `docs/TESTSUITE/STATUS.md` für Überblick
