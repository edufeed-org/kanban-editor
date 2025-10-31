# 🛠️ Test Runner — Technische Implementierung (Vitest)

Dieses Dokument beschreibt die technische Umsetzung der Test-Suite.
Wir verwenden inzwischen Vitest für Unit- und Integrationstests und Playwright für E2E-Tests.
Die Anleitungen in `docs/TESTSUITE/GUIDE.md` und `docs/TESTSUITE/INDEX.md` sind die primären Nutzer-Guides — dieses Dokument ergänzt sie mit Implementierungsdetails.

## Grundprinzip

- Unit-Tests: Vitest (`.spec.ts`) — Dateien liegen neben der getesteten Komponente / dem Modul.
- Integration/Store-Tests: Vitest (`.spec.ts`) in passenden Ordnern (`src/lib/stores/*` oder neben Store-Implementation).
- E2E-Tests: Playwright im `e2e/`-Ordner.

## Befehle

```bash
pnpm run test:unit         # Einmalige Ausführung aller Unit-Tests (Vitest)
pnpm run test:unit:watch   # Watch Mode für Entwicklung
pnpm run test:e2e          # Playwright E2E-Tests
pnpm run test:e2e:ui       # Playwright mit UI-Debug (headed)
```

## Datei-Organisation & Namenskonvention

- Unit/Integration Tests: `*.spec.ts` direkt neben dem Modul oder der Komponente.
  - Beispiel: `src/routes/page.svelte` → `src/routes/page.svelte.spec.ts`
  - Beispiel: `src/lib/classes/BoardModel.ts` → `src/lib/classes/BoardModel.spec.ts`

- Store-Tests: neben Store-Dateien oder unter `src/lib/stores/__tests__/` — wichtig ist kleine, gut abgegrenzte Testfälle.

- E2E: alle Playwright-Tests in `e2e/` (z. B. `e2e/demo.test.ts`).

## Patterns & Beispiele

### Vitest + Testing Library (Svelte)

```typescript
// src/routes/mycomponent.spec.ts
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.svelte';
import { render, fireEvent } from '@testing-library/svelte';

describe('MyComponent', () => {
  it('rendert initial korrekt', () => {
    const { getByText } = render(MyComponent);
    expect(getByText('Erwarteter Text')).toBeTruthy();
  });
});
```

### Store Test (BoardStore Beispiel)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BoardStore } from '$lib/stores/kanbanStore.svelte';

describe('BoardStore Integration', () => {
  let store: BoardStore;
  beforeEach(() => { store = new BoardStore(); });

  it('creates and moves card atomically', () => {
    const colA = store.addColumn({ name: 'A' });
    const colB = store.addColumn({ name: 'B' });
    const cardId = store.createCard(colA.id, 'Test Card');
    store.moveCard(cardId, colA.id, colB.id);
    const found = store.findCardAndColumn(cardId);
    expect(found?.column.id).toBe(colB.id);
  });
});
```

## Testing Toolkit

- Vitest: Runner + Mocks + Timers (vi)
- @testing-library/svelte: DOM rendering & user events
- Playwright: E2E-Run

## Migration von altem `/test` UI-Runner

Frühere Implementierungen bauten auf einer in-app Test-UI (`/test`) und einer `runTestSuite()` helper-Datei. Diese ist nun **deprecated**. Alle Tests sind auf Vitest umgestellt:

- Entferne bitte keine noch genutzten Debug-Helfer, aber beginne, neue Tests als `.spec.ts` zu schreiben.
- Falls du temporär die alte `src/lib/utils/testSuite.ts` für lokal-debug verwendest, markiere sie deutlich als deprecated und verlinke hier.

## Weiterführende Links

- `docs/TESTSUITE/GUIDE.md` — User-Guide (Wie man Tests ausführt)
- `docs/TESTSUITE/INDEX.md` — Kurzindex
- `e2e/` — Playwright E2E-Tests

---
Version: 1.0 — Aktualisiert: 30. Oktober 2025
# 📋 Test Suite - Technische Referenz

**Siehe auch:** 
- `docs/TESTSUITE/STATUS.md` — Überblick & Quick Status
- `docs/TESTSUITE/GUIDE.md` — Ausführliche Anleitung
- `src/routes/test/+page.svelte` — Implementierung

---

## 🎯 Übersicht

Die Test Suite läuft unter der Route `/test` mit einer visuellen Web UI.

```
Browser Request:   GET /test
Route Handler:     src/routes/test/+page.svelte
Test Execution:    src/lib/utils/testSuite.ts (~35 Tests)
Output Display:    Real-time Console Capture
Result Summary:    Live Test Counter & Status Cards
```

---

## 📊 Features der Test UI

### Status Cards
- 📈 **Tests ausgeführt** — Gesamtanzahl
- 🟢 **Erfolgreich** — Bestandene Tests
- 🔴 **Fehlgeschlagen** — Fehlgeschlagene Tests

### Buttons
- **▶️ Tests ausführen** — Startet die Test Suite
- **🗑️ Löschen** — Löscht die Ausgabe

### Output
- ✅ **Farbiges Highlighting** (grün/rot/orange)
- 📁 **Gruppierte Tests** mit Einrückung
- ⏱️ **Live Counter** während der Ausführung
- 🎉 **Success Message** wenn alle Tests bestanden

---

## 📂 Implementierung

### Datei: `src/routes/test/+page.svelte`

```typescript
// State Management
let testOutput = $state('');
let isRunning = $state(false);
let testCount = $state(0);
let testsPassed = $state(0);
let testsFailed = $state(0);
let testLines: TestLine[] = $state([]);

// Console Interception
async function handleRunTests() {
    // Captures console.log, console.error, console.group
    // Speichert in testLines Array
    // Updatest Live Counter
}

// Farbige Ausgabe
function getLineColor(line: TestLine): string {
    // Mapping basierend auf Content
    // ✅ → grün
    // ❌ → rot
    // ⚠️ → orange
}
```

### Abhängigkeiten
- ✅ `runTestSuite` aus `$lib/utils/testSuite.ts`
- ✅ Button Komponente aus shadcn-svelte
- ✅ Responsive Grid Layout

---

## ✅ Test Kategorien

```
1. Board & Column Management (4 Tests)
2. Card Management (3 Tests)
3. Card Movement & Finding (2 Tests)
4. Publish State Management (4 Tests)
5. AI Interaction Simulation (4 Tests)
6. Phase A+B Comment System (11 Tests)
7. Phase C: BoardStore UI Integration (4 Tests)
8. Nostr Event Serialization (2 Tests)
9. Auth Store Tests (1 Test)

TOTAL: ~35 Tests ✅
```

---

## 🔧 Technische Details

### TypeScript Interfaces
```typescript
interface TestLine {
    text: string;
    type: 'log' | 'error' | 'group' | 'groupEnd' | 'info' | 'warn';
    level: number; // für Einrückung
}
```

### Console Capture Pattern
```typescript
// Original speichern
const originalLog = console.log;

// Überschreiben
console.log = (...args) => {
    originalLog(...args); // In echter Console ausgeben
    addLine(args.join(' '), 'log'); // In UI speichern
};

// Später: Wiederherstellen
console.log = originalLog;
```

### Live Counter Update
```typescript
if (text.includes('✅')) {
    testCount++;
    testsPassed++;
} else if (text.includes('❌')) {
    testCount++;
    testsFailed++;
}
```

---

## 🎨 Styling

- ✅ **Inline Styles** statt Tailwind (Tailwind v4 Kompatibilität)
- ✅ **Responsive Design** mit CSS Grid
- ✅ **Light-only** (keine Dark Mode Klassen)
- ✅ **Accessible** mit guter Farbkontrast

---

## 🆘 Troubleshooting

### Problem: "Test Suite Error"
→ Browser Console (F12) öffnen
→ Fehlerstack lesen
→ `pnpm run check` ausführen

### Problem: Tests schlagen fehl
→ Refresh (F5) die Seite
→ Dev Server läuft? (`pnpm run dev`)

### Problem: Button ist grau
→ Tests laufen noch
→ Warte auf Abschluss

### Problem: Keine Ausgabe
→ Dev Server muss laufen
→ Test Suite Module muss kompiliert sein

---

## 📝 Erweiterung

Um neue Tests hinzuzufügen:

1. Öffne `src/lib/utils/testSuite.ts`
2. Füge neue Sektion mit `console.group()` hinzu
3. Füge Tests mit `console.log('✅ ...')` hinzu
4. Refresh `/test` Route
5. Klick "Tests ausführen"

---

## 📊 Live Metriken

Die Test UI zeigt in Echtzeit:

| Metrik | Quelle | Update |
|--------|--------|--------|
| Tests ausgeführt | Zählt alle console.log/error | Live ⚡ |
| Erfolgreich | Zählt "✅" | Live ⚡ |
| Fehlgeschlagen | Zählt "❌" | Live ⚡ |

---

**Status:** 🟢 FERTIG & PRODUCTION-READY

Siehe auch: `START-TESTS.md`, `TESTS-QUICK-REF.md`
