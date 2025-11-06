# Intelligente Board-Struktur-Analyse (Phase 2)

**Version:** 1.0  
**Datum:** 06. November 2025  
**Status:** ✅ IMPLEMENTIERT  
**Feature:** Bestehende Spalten werden bei Struktur-Generierung intelligent berücksichtigt

---

## I. Übersicht

### Was ist das Feature?

Das System analysiert **vor** der Struktur-Generierung (Phase 2) die bestehenden Board-Spalten und erkennt automatisch deren Struktur-Muster. Basierend auf dieser Analyse wählt das System eine passende **Strategie**, die dem LLM vorgibt, ob neue Spalten erstellt oder bestehende genutzt werden sollen.

### Warum wurde es implementiert?

**Problem vorher:**
- LLM erstellte **IMMER** neue Spalten, selbst wenn bereits passende existierten
- Board mit "Todo", "In Progress", "Done" → LLM erstellte "Einführung", "Vertiefung", "Übung"
- Bestehende Struktur wurde **komplett ignoriert**

**Lösung jetzt:**
- ✅ System erkennt Spalten-Muster (Status, Phasen, Themen)
- ✅ Wählt intelligente Strategie (`add_to_existing`, `mixed`, `create_new`)
- ✅ Instruiert LLM entsprechend
- ✅ Validiert, dass LLM sich an Vorgaben hält

### Wann wird es verwendet?

- **Automatisch** bei jeder Phase 2 Struktur-Generierung
- User muss **nichts** konfigurieren
- Funktioniert transparent im Hintergrund

---

## II. Quick Start

### Als Entwickler: Code-Nutzung

```typescript
import { analyzeExistingStructure } from '$lib/agent';

// 1. Hole bestehende Spalten
const existingColumns = boardStore.uiData.map(col => col.name);
// → ["Todo", "In Progress", "Done"]

// 2. Analysiere Struktur
const analysis = analyzeExistingStructure(existingColumns);
// → {
//     hasColumns: true,
//     columnCount: 3,
//     strategy: 'add_to_existing',
//     instructions: 'WICHTIG: Das Board hat bereits 3 Spalten...'
//   }

// 3. Nutze Strategie für Validierung
const validation = validateColumnAlignment(
  generatedColumns,
  existingColumns,
  analysis.strategy
);
// → { valid: true } oder { valid: false, error: "..." }
```

### Als User: Erwartetes Verhalten

**Szenario 1: Status-Board**
```
Bestehende Spalten: ["Todo", "In Progress", "Done"]
User-Prompt: "Erstelle Lernkarten zu JavaScript Basics"

Ergebnis:
✅ Karten werden in BESTEHENDE Spalten verteilt
✅ Keine neuen Spalten erstellt
✅ "JavaScript Variablen" → Todo
✅ "Funktionen verstehen" → In Progress
```

**Szenario 2: Leeres Board**
```
Bestehende Spalten: []
User-Prompt: "Erstelle Lernkarten zu Python"

Ergebnis:
✅ Neue Spalten werden erstellt
✅ z.B. "Grundlagen", "Datentypen", "Funktionen"
```

**Szenario 3: Themen-Board (Mixed)**
```
Bestehende Spalten: ["Einführung", "Basics"]
User-Prompt: "Erstelle Karten zu fortgeschrittenen Konzepten"

Ergebnis:
✅ LLM kann wählen:
  - Karten zu Basics hinzufügen ODER
  - Neue Spalte "Fortgeschritten" erstellen
```

---

## III. Technische Details

### Struktur-Analyse-Logik

Die Funktion `analyzeExistingStructure()` erkennt drei Hauptmuster:

#### Pattern 1: Status-Board
```typescript
const hasStatus = existingColumns.some(col =>
  /todo|doing|done|backlog|in progress|review/i.test(col)
);

// Beispiele:
// ✅ "Todo", "Doing", "Done"
// ✅ "Backlog", "In Progress", "Review"
// ✅ "To Do", "In Arbeit", "Fertig"

Strategie: 'add_to_existing'
→ Karten werden zu bestehenden Spalten hinzugefügt
→ KEINE neuen Spalten erlaubt
```

#### Pattern 2: Phasen-Board
```typescript
const hasPhases = existingColumns.some(col =>
  /phase|schritt|step|etappe/i.test(col)
);

// Beispiele:
// ✅ "Phase 1", "Phase 2", "Phase 3"
// ✅ "Schritt 1", "Schritt 2"
// ✅ "Step A", "Step B"

Strategie: 'add_to_existing'
→ Karten werden Phasen zugeordnet
→ KEINE neuen Phasen erlaubt
```

#### Pattern 3: Themen-Board (wenige Spalten)
```typescript
const hasTopics = existingColumns.some(col =>
  /einführung|vertiefung|grundlagen|advanced|basics/i.test(col)
);

// UND: existingColumns.length < 5

// Beispiele:
// ✅ "Einführung", "Vertiefung"
// ✅ "Basics", "Advanced"

Strategie: 'mixed'
→ Karten können zu bestehenden Spalten ODER
→ Neue thematische Spalten können erstellt werden
```

#### Pattern 4: Viele Spalten / Unklar
```typescript
// existingColumns.length >= 5
// UND: Kein klares Muster erkannt

Strategie: 'add_to_existing'
→ Sicher: Keine neuen Spalten
→ Verhindert Fragmentierung
```

### Strategien im Detail

| Strategie | Bedeutung | LLM-Instruktion | Validierung |
|-----------|-----------|-----------------|-------------|
| `create_new` | Board ist leer | "Erstelle neue Spalten" | Alle Spalten-Namen erlaubt |
| `add_to_existing` | Klares Muster erkannt | "KEINE neuen Spalten! Nutze nur: X, Y, Z" | **NUR** bestehende Namen erlaubt |
| `mixed` | Themen-Board mit Platz | "Du kannst bestehende nutzen ODER neue erstellen" | Mindestens 1 bestehende Spalte genutzt (Warnung wenn 0) |

### Validierungs-Pipeline

```
Phase 2 Start
    ↓
analyzeExistingStructure()
    ↓
generateStructurePrompt() ← Nutzt strategy.instructions
    ↓
LLM generiert JSON
    ↓
validateStructureJSON() ← JSON-Syntax OK?
    ↓
validateColumnAlignment() ← Spalten-Namen OK?
    ↓ (bei Fehler)
RETRY (max 3x)
```

**Validation Rules:**

```typescript
// add_to_existing: ALLE generierten Spalten MÜSSEN existieren
if (strategy === 'add_to_existing') {
  const invalidColumns = generated.filter(name => 
    !existing.includes(name)
  );
  
  if (invalidColumns.length > 0) {
    return { valid: false, error: "..." };
  }
}

// mixed: Mindestens 1 bestehende genutzt (Warnung, kein Block)
if (strategy === 'mixed') {
  const usedExisting = generated.filter(name =>
    existing.includes(name)
  );
  
  if (usedExisting.length === 0) {
    return { 
      valid: true, 
      error: "HINWEIS: Keine bestehenden Spalten genutzt" 
    };
  }
}

// create_new: Alles erlaubt
return { valid: true };
```

---

## IV. Integration in AIPanel

### Code-Flow

```typescript
// src/routes/cardsboard/AIPanel.svelte

async function generateBoardStructure() {
  // 1. Hole bestehende Spalten
  const existingColumns = boardStore.uiData.map(col => col.name);
  
  // 2. Analysiere Struktur
  const structureAnalysis = analyzeExistingStructure(existingColumns);
  // → { strategy: 'add_to_existing', instructions: "...", ... }
  
  // 3. Generiere Prompt mit Kontext
  const userPrompt = generateStructurePrompt(
    currentContentProposal.content,
    { existingColumns }
  );
  // → Prompt enthält strategy.instructions
  
  // 4. Sende an LLM
  const { content: jsonResponse } = await chatStore.sendToLLMWithSystem(
    userPrompt,
    STRUCTURE_GENERATION_SYSTEM_PROMPT
  );
  
  // 5. Validiere JSON
  const validation = validateStructureJSON(jsonResponse);
  
  // 6. 🆕 Validiere Spalten-Alignment
  const columnValidation = validateColumnAlignment(
    validation.data.columns,
    existingColumns,
    structureAnalysis.strategy  // ← Nutzt erkannte Strategie!
  );
  
  if (!columnValidation.valid) {
    // Retry mit Fehler-Nachricht
    await generateBoardStructure();
    return;
  }
  
  // 7. Execute Actions
  // ...
}
```

### System-Prompt Enhancement

Der `STRUCTURE_GENERATION_SYSTEM_PROMPT` wurde erweitert:

```typescript
export const STRUCTURE_GENERATION_SYSTEM_PROMPT = `...

Bei bestehenden Spalten:
- Ordne Karten intelligent zu (basierend auf Spalten-Namen)
- Verteile Karten gleichmäßig (keine Spalte leer lassen)
- Respektiere die bestehende Struktur (z.B. nicht "Todo" in "Done" Spalte)

...`;
```

---

## V. Fehler & Debugging

### Häufige Probleme

#### Problem 1: LLM erstellt trotzdem neue Spalten

**Symptom:**
```
Bestehende: ["Todo", "Done"]
LLM generiert: [{ name: "Grundlagen" }, { name: "Vertiefung" }]
```

**Ursache:** Strategie war `mixed` statt `add_to_existing`

**Lösung:**
```typescript
// Check: Wurden Status-Keywords erkannt?
const hasStatus = existingColumns.some(col =>
  /todo|done/i.test(col)  // ← MUSS matchen!
);

// Falls nicht: Pattern erweitern
/todo|done|doing|fertig/i  // ← "Fertig" hinzufügen
```

#### Problem 2: Validierung schlägt fehl bei mixed

**Symptom:**
```
Strategy: 'mixed'
Generated: [{ name: "Neue Spalte 1" }, { name: "Neue Spalte 2" }]
Validation: ⚠️ Warnung, aber valid: true
```

**Erklärung:** Das ist **korrekt**! Bei `mixed` ist es OK, wenn LLM nur neue Spalten erstellt. Es wird nur eine Warnung geloggt.

**Lösung:** Keine Aktion nötig. System funktioniert wie erwartet.

#### Problem 3: Retry-Loop bei Validation

**Symptom:**
```
⚠️ Column alignment failed (Attempt 1/3)
⚠️ Column alignment failed (Attempt 2/3)
⚠️ Column alignment failed (Attempt 3/3)
```

**Ursache:** LLM ignoriert Instruktionen persistent

**Lösung 1:** Pattern-Detection verbessern (mehr Keywords)
```typescript
// Füge lokalisierte Varianten hinzu
/todo|done|doing|zu tun|erledigt|in arbeit/i
```

**Lösung 2:** System-Prompt schärfen
```typescript
// Expliziter machen
"WICHTIG: Du MUSST AUSSCHLIESSLICH diese Spalten nutzen: ${existingColumns.join(', ')}.
ERSTELLE KEINE NEUEN SPALTEN! Dies ist MANDATORY!"
```

### Debug-Output

Bei Problemen: Aktiviere Console-Logging in AIPanel:

```typescript
console.log('📋 Structure Analysis:', {
  existingColumns,
  strategy: structureAnalysis.strategy,
  instructions: structureAnalysis.instructions
});

console.log('📋 Generated columns:', validation.data.columns.map(c => c.name));
console.log('📋 Validation result:', columnValidation);
```

---

## VI. Referenzen

### Verwandte Dokumentation

- **[docs/ARCHITECTURE/AGENT/README.md](../ARCHITECTURE/AGENT/README.md)** - Agent-Modul Übersicht
- **[docs/FEATURE/TWO-PHASE-AI-RESPONSE-INTEGRATION.md](./TWO-PHASE-AI-RESPONSE-INTEGRATION.md)** - Zwei-Phasen-System
- **[AGENTS.md](../../AGENTS.md)** - Vollständige Spezifikation

### Code-Referenzen

| Datei | Relevante Funktionen |
|-------|---------------------|
| `src/lib/agent/structureGeneration.ts` | `analyzeExistingStructure()`, `generateStructurePrompt()`, `validateColumnAlignment()` |
| `src/lib/agent/index.ts` | Exports für alle Agent-Funktionen |
| `src/routes/cardsboard/AIPanel.svelte` | Integration in UI-Flow (Phase 2) |

### Tests

**TODO (Phase 3):**
```typescript
// src/lib/agent/structureGeneration.test.ts

describe('analyzeExistingStructure', () => {
  it('erkennt Status-Board', () => {
    const result = analyzeExistingStructure(['Todo', 'Done']);
    expect(result.strategy).toBe('add_to_existing');
  });
  
  it('erkennt Phasen-Board', () => {
    const result = analyzeExistingStructure(['Phase 1', 'Phase 2']);
    expect(result.strategy).toBe('add_to_existing');
  });
  
  it('wählt mixed bei Themen-Board', () => {
    const result = analyzeExistingStructure(['Einführung', 'Vertiefung']);
    expect(result.strategy).toBe('mixed');
  });
});
```

---

## VII. Versionshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.1 | 06.11.2025 | **Intent Detection erweitert:** Neue Patterns für "erstelle Karten für", "füge Karten", "fülle die Spalten" (Bug #5) |
| 1.0 | 06.11.2025 | Initial: Intelligente Struktur-Analyse implementiert |

---

**Status:** ✅ PRODUKTIV  
**Maintainer:** Agent-Modul Team  
**Letzte Aktualisierung:** 06. November 2025
