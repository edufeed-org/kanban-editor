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
