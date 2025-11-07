# Migration: aiActionGenerator.ts → agent/

**Datum:** 06. November 2025  
**Status:** ✅ COMPLETED  
**Grund:** Konsolidierung aller AI-bezogenen Module unter `$lib/agent/`

---

## Problem

Die AI-spezifische Logik war auf zwei Orte verteilt:

```
src/lib/
├── utils/
│   └── aiActionGenerator.ts     ← AI-Logik (inkonsistent!)
└── agent/                        ← AI-Logik (haupt-location)
    ├── contentProposal.ts
    ├── structureGeneration.ts
    ├── actionProcessing.ts
    └── ...
```

**Duplikate:**
- `parseContentProposal()` - in beiden
- `generateStructurePrompt()` - in beiden (verschiedene Versionen!)
- `validateStructureJSON()` - in beiden
- `parseStructureProposal()` - in beiden
- `structureToActions()` - in beiden

---

## Lösung

**Alle AI-Funktionen konsolidiert unter `$lib/agent/`:**

```
src/lib/agent/
├── index.ts                    ← Zentrale Exports
├── types.ts                    ← Type Definitionen
├── intentDetection.ts          ← User Intent erkennen
├── contentProposal.ts          ← Phase 1: Content Parsing
├── structureGeneration.ts      ← Phase 2: JSON Validation & Parsing
└── actionProcessing.ts         ← Phase 3: Action Execution
```

---

## Migrierte Funktionen

### Von `aiActionGenerator.ts` nach `structureGeneration.ts`:

1. **`generateStructurePrompt()`** - erweitert
   - **Neu:** Unterstützt `userContext` Parameter mit `boardName` und `existingColumns`
   - **Verbessert:** Detailliertere Anweisungen für LLM
   
2. **`validateStructureJSON()`** - erweitert
   - **Neu:** Auto-Extraktion aus Markdown Code-Blöcken
   - **Neu:** JSON-Suche in Text (Fallback)
   - **Verbessert:** Detailliertere Fehler-Messages mit Column/Card Context

3. **`parseStructureProposal()`** - bereits vorhanden
   - Keine Änderungen (war bereits besser implementiert)

4. **`structureToActions()`** - bereits vorhanden
   - Keine Änderungen (war bereits besser implementiert)

### Gelöscht (bereits in `contentProposal.ts`):

- `parseContentProposal()` - war Duplikat

---

## Breaking Changes

### Import-Änderungen

**Alt:**
```typescript
import {
  parseContentProposal,
  generateStructureFromContent,
  validateStructureJSON,
  parseStructureProposal,
  structureToActions
} from '$lib/utils/aiActionGenerator.js';
```

**Neu:**
```typescript
import {
  parseContentProposal,
  generateStructurePrompt,  // ← Name geändert!
  validateStructureJSON,
  parseStructureProposal,
  structureToActions
} from '$lib/agent';
```

### Funktions-Umbenennung

| Alt | Neu | Grund |
|-----|-----|-------|
| `generateStructureFromContent()` | `generateStructurePrompt()` | Konsistenz mit `contentProposal.ts` |

### Signatur-Änderung

**`generateStructurePrompt()`:**

```typescript
// Alt (aiActionGenerator.ts)
function generateStructureFromContent(
  originalContent: string,
  userContext?: { boardName?: string; existingColumns?: string[] }
): string

// Neu (agent/structureGeneration.ts)
function generateStructurePrompt(
  originalContent: string,
  userContext?: { boardName?: string; existingColumns?: string[] }
): string
```

→ **Gleiche Signatur, nur Name geändert**

---

## Migration Guide für Entwickler

### Wenn Sie `aiActionGenerator.ts` verwendet haben:

1. **Imports aktualisieren:**
   ```typescript
   // Ersetze:
   import { ... } from '$lib/utils/aiActionGenerator.js';
   
   // Mit:
   import { ... } from '$lib/agent';
   ```

2. **Funktions-Namen aktualisieren:**
   ```typescript
   // Ersetze:
   const prompt = generateStructureFromContent(content, context);
   
   // Mit:
   const prompt = generateStructurePrompt(content, context);
   ```

3. **Fertig!** - Alle anderen Funktionen haben gleiche Namen

---

## Verbesserte Funktionalität

### 1. Enhanced `validateStructureJSON()`

**Neu: Auto-Extraktion aus verschiedenen Formaten**

```typescript
// Unterstützt jetzt:
validateStructureJSON('{ "columns": [...] }');  // ✅ Pure JSON
validateStructureJSON('```json\n{ ... }\n```'); // ✅ Markdown Code-Block
validateStructureJSON('Text\n{ ... }\nText');   // ✅ JSON in Text
```

**Detailliertere Fehler:**

```typescript
// Alt:
{ valid: false, error: 'Spalte fehlt "name" Feld' }

// Neu:
{ valid: false, error: 'Column 2 missing or invalid "name"' }
{ valid: false, error: 'Column "Übung" Card 3 heading too short (min 3 chars)' }
```

### 2. Bessere `generateStructurePrompt()`

**Mehr Kontext für LLM:**

```typescript
const prompt = generateStructurePrompt(content, {
  boardName: 'Römisches Reich',
  existingColumns: ['Einführung', 'Vertiefung']
});

// Prompt enthält jetzt:
// "Board Name: Römisches Reich"
// "Existierenden Spalten beachten: Einführung, Vertiefung"
```

---

## Aktuelle Struktur (nach Migration)

```typescript
// src/lib/agent/index.ts
export type { UserIntent, ContentProposal, StructureProposal } from './types';

// Phase 1: Content Parsing
export { parseContentProposal } from './contentProposal';

// Phase 2: Structure Generation
export {
  STRUCTURE_GENERATION_SYSTEM_PROMPT,
  generateStructurePrompt,      // ← Migriert & verbessert
  validateStructureJSON,         // ← Migriert & verbessert
  parseStructureProposal,
  structureToActions
} from './structureGeneration';

// Phase 3: Action Processing
export { createBoardPreview, executeActions } from './actionProcessing';
```

---

## Vorteile der Migration

✅ **Konsistenz:** Alle AI-Logik an einem Ort  
✅ **Wartbarkeit:** Keine Duplikate mehr  
✅ **Klarheit:** `$lib/utils/` für generische Utils, `$lib/agent/` für AI  
✅ **Erweiterbarkeit:** Neue AI-Features kommen klar zu `agent/`  
✅ **Bessere Funktionen:** Erweiterte Validierung & Fehlerbehandlung

---

## Nächste Schritte

- [x] Migration durchgeführt
- [x] `aiActionGenerator.ts` gelöscht
- [x] Dokumentation aktualisiert
- [ ] ChatStore aktualisieren (falls verwendet)
- [ ] AIPanel.svelte aktualisieren (falls verwendet)
- [ ] Tests aktualisieren (falls vorhanden)

---

## Referenzen

- **Agent Module:** `src/lib/agent/`
- **Index:** `src/lib/agent/index.ts`
- **Types:** `src/lib/agent/types.ts`
- **Content Proposal:** `src/lib/agent/contentProposal.ts`
- **Structure Generation:** `src/lib/agent/structureGeneration.ts`

---

**Status:** ✅ Migration abgeschlossen - `aiActionGenerator.ts` ist deprecated und entfernt
