# 📖 Test Suite - Vollständiger Guide

**Zielgruppe:** Entwickler & Maintenance  
**Schwierigkeit:** ⭐ Easy  
**Zeit:** 5 Minuten Setup

---

## 🚀 Schritt-für-Schritt Anleitung

### 1️⃣ Dev Server starten

Öffne PowerShell im Projekt-Root:

```powershell
cd f:\code\svelte\nostr-cli
pnpm run dev
```

**Warte bis:**
```
  VITE v7.x.x  ready in XXX ms
  ➜  Local:   http://localhost:5173/
```

---

### 2️⃣ Test Route öffnen

Öffne deinen Browser:

```
http://localhost:5173/test
```

Du solltest sehen:
- 📋 **Heading:** "🧪 Test Suite Runner"
- 📊 **3 Status Cards:** Tests ausgeführt, Erfolgreich, Fehlgeschlagen
- 🟢 **Grüner Button:** "▶️ Tests ausführen"
- 🗑️ **Clear Button:** "🗑️ Löschen"

---

### 3️⃣ Tests ausführen

Klick auf **"▶️ Tests ausführen"** Button

Du solltest sehen:
- ⏳ Button ändert sich zu "⏳ Tests laufen..."
- 📈 Status Cards aktualisieren sich live
- 📁 Grouped Console Output mit Farb-Highlighting
- ✅ Grüne Zeilen für bestandene Tests
- ❌ Rote Zeilen für fehlerhafte Tests

---

### 4️⃣ Ergebnisse prüfen

**Bei Erfolg (alles grün ✅):**
```
==========================================
1. Board & Column Management
✅ Board erstellt: Projekt Phoenix
✅ Spalten hinzugefügt: To Do, In Arbeit, Fertig
...
🎉 Alle Tests bestanden!
==========================================
```

**Bei Fehler (rote ❌ Zeilen):**
1. Öffne Browser Console: Drücke `F12`
2. Klick auf "Console" Tab
3. Suche nach roten Error-Messages
4. Lese die Fehlermeldung
5. Überprüfe Projekt-Status: `pnpm run check`

---

## 📊 Erwartete Output

### Header & Status Cards
```
🧪 Test Suite Runner
Kanban Board Model & Store Tests

┌─────────────────┬─────────────────┬─────────────────┐
│ ~35 Tests       │ ~35 ✅          │ 0 ❌            │
│ ausgeführt      │ Erfolgreich     │ Fehlgeschlagen  │
└─────────────────┴─────────────────┴─────────────────┘
```

### Console Output (Beispiel)
```
📂 1. Board & Column Management
  ✅ Board erstellt: Projekt Phoenix
  ✅ Spalten hinzugefügt: To Do, In Arbeit, Fertig
  ✅ Spalte aktualisiert: In Progress
  ✅ Count ist korrekt: 3

📂 2. Card Management
  ✅ 2 Karten zur 'To Do'-Spalte hinzugefügt.
  ✅ Karte aktualisiert
  ✅ Kommentar hinzugefügt

...

📂 Final State
  Der finale Zustand des Boards:
  {... Board JSON ...}

🎉 Alle Tests bestanden!
```

### Summary Footer
```
~35 Tests, 35 ✅, 0 ❌
🎉 Alle Tests bestanden!
```

---

## 🧪 Test Kategorien Erklärung

### 1. Board & Column Management (4 Tests)
Prüft grundlegende Board-Operationen:
- ✅ Board erstellen
- ✅ Spalten hinzufügen
- ✅ Spalten aktualisieren
- ✅ Count korrekt

**Verwendet:** `Board`, `Column` Klassen

---

### 2. Card Management (3 Tests)
Prüft Karten-Operationen:
- ✅ Mehrere Karten hinzufügen
- ✅ Karte aktualisieren
- ✅ Kommentare hinzufügen

**Verwendet:** `Card`, `Comment` Klassen

---

### 3. Card Movement & Finding (2 Tests)
Prüft Karten-Verschiebungen:
- ✅ Karte zwischen Spalten verschieben
- ✅ Karte im Board finden

**Verwendet:** `Board.moveCard()`, `Board.findCardAndColumn()`

---

### 4. Publish State Management (4 Tests)
Prüft Draft/Published/Archived States:
- ✅ Standard State ist 'draft'
- ✅ State auf 'published' setzen
- ✅ Board State Management
- ✅ State Persistierung

**Verwendet:** `Card.setPublishState()`, `Board.setPublishState()`

---

### 5. AI Interaction Simulation (4 Tests)
Prüft KI-gesteuerte Operationen:
- ✅ Chat initialisieren
- ✅ Prompt an KI senden
- ✅ AI Action verarbeiten (split_card)
- ✅ KI-gesteuerte Kartenerstellung

**Verwendet:** `Chat`, `AIAction` Types

---

### 6. Phase A+B Comment System (11 Tests) ⭐ NEW
Umfassende Comment-Tests:
- ✅ Mehrere Kommentare hinzufügen (3 Tests)
- ✅ Kommentare löschen (3 Tests)
- ✅ Comment ID Generation (2 Tests)
- ✅ Serialisierung (3 Tests)

**Verwendet:** `Card.addComment()`, `Card.deleteComment()`, `getContextData()`

---

### 7. BoardStore UI Integration (4 Tests) ⭐ NEW
Prüft Store UI Reaktivität:
- ✅ uiData Konvertierung
- ✅ createCard() Funktionalität
- ✅ UI Auto-Sync
- ✅ Fehlerbehandlung

**Verwendet:** `BoardStore`, `$derived.by()`, `uiData`

---

### 8. Nostr Event Serialization (2 Tests)
Prüft Nostr Integration:
- ✅ Board zu Event konvertieren
- ✅ Event Schema korrekt

**Verwendet:** `boardToNostrEvent()`, NDK

---

### 9. Auth Store Tests (1 Test)
Prüft Authentifizierung:
- ✅ Auth Store Mock

**Verwendet:** `authStore` (Mock)

---

## 🔧 Erweiterte Nutzung

### Neue Tests hinzufügen

**Datei bearbeiten:**
```
src/lib/utils/testSuite.ts
```

**Format:**
```typescript
// Section hinzufügen
console.group("10. Meine neuen Tests");

// Test hinzufügen
const myCard = testCard.addComment("Text", "npub");
if (myCard.comments.length === 1) {
    console.log("✅ Mein Test bestanden");
} else {
    console.error("❌ Mein Test fehlgeschlagen");
}

console.groupEnd();
```

**Nach Speicherung:**
1. Refresh im Browser (F5)
2. Klick "Tests ausführen"
3. Neue Tests sollten jetzt laufen

---

### Tests vom Console ausführen

**Alternativ zur Web UI:**

```javascript
// Im Browser Console (F12)
import { runTestSuite } from './src/lib/utils/testSuite.ts';
runTestSuite();
```

---

## 🆘 Troubleshooting

### Problem: "Test Suite Error" Meldung
**Symptom:** Rote Error-Box nach Button-Klick  
**Ursache:** Exception in Test Suite  
**Lösung:**
1. Öffne Browser Console (F12)
2. Schau nach Error-Stack
3. Lese Error-Message
4. Überprüfe `pnpm run check`

**Beispiel Error:**
```
❌ Test Suite Error: Cannot read property 'id' of undefined
    at runTestSuite (testSuite.ts:123)
```

---

### Problem: Tests schlagen fehl
**Symptom:** Red ❌ Zeilen in Output  
**Ursache:** Assertion nicht erfüllt  
**Lösung:**
1. Lese die fehlgeschlagene Assertion
2. Überprüfe Implementierung in `BoardModel.ts`
3. Prüfe ob neueste Code ist: `pnpm run check`
4. Falls immer noch Fehler: `pnpm run build`

---

### Problem: Keine Ausgabe nach Button-Klick
**Symptom:** Button wird grau, dann wieder normal, aber keine Output  
**Ursache:** Wahrscheinlich Exception beim Laden von testSuite  
**Lösung:**
1. Öffne Browser Console (F12)
2. Schau nach roten Errors
3. Prüfe ob `testSuite.ts` kompiliert: `pnpm run check`
4. Refresh Seite (F5) und nochmal versuchen

---

### Problem: Button ist nicht klickbar
**Symptom:** Button wird nicht aktiv, grayed out  
**Ursache:** Tests laufen noch (zu lange)  
**Lösung:**
1. Warte bis Button aktiv wird
2. Falls > 5 Sekunden: Refresh (F5)
3. Falls immer noch: Browser Console öffnen und Errors suchen

---

### Problem: Build schlägt fehl
**Symptom:** `pnpm run build` gibt Errors  
**Ursache:** TypeScript oder Tailwind Fehler  
**Lösung:**
```bash
# 1. Check durchführen
pnpm run check

# 2. Falls Errors: Fix durchführen (Fehler lesen)

# 3. Build nochmal versuchen
pnpm run build

# 4. Falls Tailwind Fehler:
#    Stelle sicher dass nur erlaubte Klassen verwendet werden
#    (keine dunklen Mode Klassen in test +page.svelte)
```

---

## 📊 Performance

### Typische Ausführungszeiten
```
Test Setup:           ~50ms
Board Creation:       ~10ms
Card Creation:        ~5ms (pro Karte)
Comment Operations:   ~3ms (pro Kommentar)
Total Execution:      ~200-500ms
UI Update:            < 100ms
```

### Memory Usage
```
Baseline:            ~2MB
During Test Run:     ~5MB
After Completion:    ~2MB (GC cleanup)
```

---

## 🎯 Best Practices

### ✅ DO's
- ✅ Regelmäßig Tests ausführen (vor Commit)
- ✅ Neue Features mit Tests abdecken
- ✅ Browser Console für Debugging nutzen
- ✅ Fehlermeldungen vollständig lesen

### ❌ DON'Ts
- ❌ Tests modifizieren um sie zu "bestehen"
- ❌ Console Output ignorieren
- ❌ Dev Server nicht starten vor Test
- ❌ Alte Browser-Tabs verwenden

---

## 📚 Weiterführende Docs

- **STATUS.md** — Overview & Quick Status
- **GUIDES/TEST-RUNNER.md** — Technische Implementation
- **AGENTS.md** — Test Suite Spezifikation

---

## 💡 Tipps & Tricks

### Tip 1: Console Output "festhalten"
```javascript
// Im Browser Console
let output = '';
const oldLog = console.log;
console.log = (...args) => {
    output += args.join(' ') + '\n';
    oldLog(...args);
};
// Tests ausführen
// Später: output Variable hat alle Logs!
```

### Tip 2: Einzelne Test-Sektion ausführen
```typescript
// In testSuite.ts: Kommentiere andere Sektionen aus
// console.group("1. Board Tests");
console.group("5. Comment System"); // ← Nur diese
// ... Comment Tests
// console.group("7. Nostr Tests");
```

### Tip 3: Fehler in Test reproduzieren
```javascript
// Im Console nach Test-Fehler:
// Kopiere die fehlerhafte Assertion
const card = new Card({heading: "Test"});
card.addComment("Kommentar", "npub1");
console.log(card.comments);  // Debug ausführen
```

---

## 🤝 Support

Fragen zur Test Suite?

1. Lies **STATUS.md** für Overview
2. Lies **diesen Guide** für Anleitung
3. Öffne Browser Console (F12) für Errors
4. Überprüfe **AGENTS.md** für Spezifikation

---

**Version:** 2.0  
**Letztes Update:** 22. Oktober 2025  
**Status:** 🟢 Production-Ready

Siehe auch: `STATUS.md` für Überblick
