# Agent Module - AI Integration

**Version:** 2.0 (Nach aiActionGenerator.ts Migration)  
**Datum:** 06. November 2025  
**Status:** ✅ KONSOLIDIERT

---

## Übersicht

Das `agent/` Modul konsolidiert **alle AI-bezogenen Funktionen** für das KI-gestützte Kanban-Board.

**Architektur:**

```
src/lib/agent/
├── index.ts                    ← Zentrale Exports (Public API)
├── types.ts                    ← TypeScript Interfaces
├── intentDetection.ts          ← User Intent Detection
├── contentProposal.ts          ← Phase 1: Content Parsing
├── structureGeneration.ts      ← Phase 2: JSON Validation & Parsing
└── actionProcessing.ts         ← Phase 3: Board Actions Execution
```

---

## Public API (`index.ts`)

**Import alles via:**
```typescript
import { ... } from '$lib/agent';
```

### Types

```typescript
export type {
  UserIntent,           // 'explicit' | 'confirmation' | 'vague'
  ContentProposal,      // { content, canGenerate, reason? }
  StructureProposal,    // { title, columns: [{ name, cards }] }
  BoardPreview,         // { columns, totalCards }
  AIAction,             // from BoardModel.ts
  ValidationResult      // { valid, error?, data? }
} from './types';
```

### Intent Detection

```typescript
export {
  detectUserIntent,           // string → UserIntent
  getIntentAwareSystemPrompt  // UserIntent → string
} from './intentDetection';
```

### Phase 1: Content Proposal

```typescript
export {
  parseContentProposal  // LLM Response → ContentProposal
} from './contentProposal';
```

### Phase 2: Structure Generation

```typescript
export {
  STRUCTURE_GENERATION_SYSTEM_PROMPT,  // System-Prompt Konstante
  generateStructurePrompt,             // Content → User-Prompt
  validateStructureJSON,               // JSON String → ValidationResult
  parseStructureProposal,              // Validated JSON → StructureProposal
  structureToActions                   // StructureProposal → AIAction[]
} from './structureGeneration';
```

### Phase 3: Action Processing

```typescript
export {
  createBoardPreview,   // StructureProposal → BoardPreview
  executeActions        // AIAction[] → Board Updates (via BoardStore)
} from './actionProcessing';
```

---

## 3-Phasen System

### Phase 1: Content-Vorschlag

**Ziel:** LLM liefert Markdown-Content, User reviewed

**Flow:**
1. User sendet Prompt
2. LLM antwortet mit Markdown
3. `parseContentProposal()` analysiert Response
4. UI zeigt Content + "Board generieren?" Button

**Code:**
```typescript
const proposal = await parseContentProposal(llmResponse);

if (proposal.canGenerate) {
  // Zeige "Board generieren" Button
} else {
  // Nur Content anzeigen (kein Board möglich)
}
```

---

### Phase 2: Struktur-Generation

**Ziel:** LLM generiert valides JSON für Board-Struktur

**Flow:**
1. User klickt "Board generieren"
2. `generateStructurePrompt()` erstellt User-Prompt
3. LLM antwortet mit JSON
4. `validateStructureJSON()` prüft Format
5. `parseStructureProposal()` extrahiert Struktur
6. UI zeigt Preview

**Code:**
```typescript
// 1. Generate Prompt
const userPrompt = generateStructurePrompt(content, {
  existingColumns: ['Einführung', 'Übung']
});

// 2. Send to LLM (with STRUCTURE_GENERATION_SYSTEM_PROMPT)
const jsonResponse = await sendToLLM(userPrompt, STRUCTURE_GENERATION_SYSTEM_PROMPT);

// 3. Validate
const validation = validateStructureJSON(jsonResponse);
if (!validation.valid) {
  throw new Error(validation.error);
}

// 4. Parse
const structure = parseStructureProposal(validation.data);

// 5. Preview
const preview = createBoardPreview(structure);
console.log(`Board: ${preview.totalCards} Karten in ${preview.columns.length} Spalten`);
```

---

### Phase 3: Action Execution

**Ziel:** Struktur wird zu Board-Aktionen konvertiert & ausgeführt

**Flow:**
1. User bestätigt Preview
2. `structureToActions()` konvertiert zu AIActions
3. `executeActions()` führt aus (via BoardStore)
4. Board wird aktualisiert

**Code:**
```typescript
// 1. Convert to Actions
const actions = structureToActions(structure);

// 2. Execute (via BoardStore)
await executeActions(actions, boardStore);

// 3. Done! Board ist aktualisiert
```

---

## Validierung

### JSON Auto-Extraktion

`validateStructureJSON()` unterstützt verschiedene Formate:

```typescript
// ✅ Pure JSON
validateStructureJSON('{ "title": "...", "columns": [...] }');

// ✅ Markdown Code-Block
validateStructureJSON('```json\n{ "title": "...", "columns": [...] }\n```');

// ✅ JSON in Text
validateStructureJSON('Text\n{ "title": "...", "columns": [...] }\nText');
```

### Detaillierte Fehler

```typescript
const result = validateStructureJSON(jsonString);

if (!result.valid) {
  console.error(result.error);
  // Beispiele:
  // "Column 2 missing or invalid "name""
  // "Column "Übung" Card 3 heading too short (min 3 chars)"
  // "Response does not contain JSON object. Starts with: "Hier ist...""
}
```

---

## Migration von `aiActionGenerator.ts`

**Status:** ✅ COMPLETED (06.11.2025)

**Änderungen:**

| Alt (utils/) | Neu (agent/) | Bemerkung |
|-------------|--------------|-----------|
| `aiActionGenerator.ts` | ❌ Gelöscht | Alle Funktionen migriert |
| `generateStructureFromContent()` | `generateStructurePrompt()` | Umbenannt |
| `validateStructureJSON()` | `validateStructureJSON()` | Erweitert (Auto-Extraktion) |
| `parseStructureProposal()` | `parseStructureProposal()` | Unverändert |
| `structureToActions()` | `structureToActions()` | Unverändert |

**Details:** [MIGRATION-AIACTIONGENERATOR.md](./MIGRATION-AIACTIONGENERATOR.md)

---

## Verwendung in Komponenten

### AIPanel.svelte (Beispiel)

```typescript
import {
  parseContentProposal,
  STRUCTURE_GENERATION_SYSTEM_PROMPT,
  generateStructurePrompt,
  validateStructureJSON,
  parseStructureProposal,
  structureToActions
} from '$lib/agent';

// Phase 1: Parse Content
const proposal = await parseContentProposal(llmResponse);

if (proposal.canGenerate) {
  // Phase 2: Generate Structure
  const userPrompt = generateStructurePrompt(proposal.content, {
    existingColumns: boardStore.uiData.map(c => c.name)
  });
  
  const jsonResponse = await chatStore.sendToLLMWithSystem(
    userPrompt,
    STRUCTURE_GENERATION_SYSTEM_PROMPT
  );
  
  const validation = validateStructureJSON(jsonResponse);
  
  if (validation.valid) {
    const structure = parseStructureProposal(validation.data);
    
    // Phase 3: Execute
    const actions = structureToActions(structure);
    await executeActions(actions, boardStore);
  }
}
```

---

## Tests

**Test-Dateien:**
```
src/lib/agent/
├── intentDetection.test.ts     ← Intent Detection Unit Tests
└── (TODO: weitere Tests)
```

**Test-Coverage:**
- [x] Intent Detection
- [ ] Content Proposal Parsing
- [ ] JSON Validation (verschiedene Formate)
- [ ] Structure Parsing
- [ ] Action Conversion
- [ ] E2E: Full 3-Phase Flow

---

## Dokumentation

- **[MIGRATION-AIACTIONGENERATOR.md](./MIGRATION-AIACTIONGENERATOR.md)** - Migration Guide
- **[TWO-PHASE-AI-RESPONSE.md](../../FEATURE/TWO-PHASE-AI-RESPONSE.md)** - Feature Spec
- **[AI-INTEGRATION.md](../../FEATURE/AI-INTEGRATION.md)** - Gesamtübersicht

---

## Roadmap

**Phase 1 (Current):** ✅ Konsolidierung
- [x] Migration von `aiActionGenerator.ts`
- [x] Erweiterte JSON-Validierung
- [x] Bessere Prompts

**Phase 2 (Next):**
- [ ] Error Recovery (Retry-Logik bei Parse-Fehlern)
- [ ] Streaming Support (JSON Partial Parsing)
- [ ] Multi-Board Support (Context aus mehreren Boards)

**Phase 3 (Future):**
- [ ] Custom AI Providers (nicht nur ChatGPT)
- [ ] Fine-tuning für Lern-Domänen
- [ ] Action Templates (vorgefertigte Strukturen)

---

**Zuletzt aktualisiert:** 06. November 2025  
**Maintainer:** AI Team  
**Status:** ✅ Production Ready
