# 2-Phase AI Response System - Implementation Guide

**Datum:** 5. November 2025  
**Status:** ✅ Implementiert  
**Ziel:** Strukturierte KI-Antworten mit verlässlicher Board-Struktur-Generierung

---

## 🎯 Overview

Das neue **2-Phase-System** teilt die KI-Antwort-Verarbeitung in zwei getrennte Schritte:

```
PHASE 1: Content Proposal (Markdown OK)
  ↓
User bestätigt die Idee
  ↓
PHASE 2: Structure Generation (JSON required)
  ↓
Board-Aktionen werden ausgeführt
```

**Vorteile:**
- ✅ KI muss JSON nicht beim ersten Versuch generieren
- ✅ User hat explizite Kontrolle über Content vor Struktur
- ✅ Retry-Mechanismus wenn JSON ungültig ist
- ✅ Strukturierter Workflow statt Regex-Parsing

---

## 📂 Neue Dateien

### `src/lib/utils/aiActionGenerator.ts`

Utility-Funktionen für beide Phasen:

#### Phase 1: Content Parsing
```typescript
parseContentProposal(llmResponse: string): Promise<ContentProposal>
```
- Extrahiert Titel und Content
- Erkennt Struktur-Typ (spalten-mit-karten, phasen, etc.)
- Gibt User-freundliche Zusammenfassung

#### Phase 2: Structure Generation & Validation
```typescript
// LLM-Prompt generieren
generateStructureFromContent(originalContent, userContext)

// JSON Response validieren
validateStructureJSON(jsonString)

// JSON zu Board-Aktionen konvertieren
parseStructureProposal(jsonResponse): StructureProposal | null
structureToActions(structure): AIAction[]
```

---

## 🔄 Workflow-Beispiel

### USER:
```
Ich plane eine Unterrichtseinheit über das Römische Reich für Klasse 7. 
Hilf mir das zu strukturieren.
```

### PHASE 1 - KI Content-Vorschlag:
```markdown
## Hauptphasen der Unterrichtseinheit (6-8 Doppelstunden)

### Spalte 1: Grundlagen & Einstieg
- Stunde 1-2: Rom entsteht
- Geografie und Gründung Roms
...
```

**AIPanel zeigt:**
```
✅ Ich kann diese Struktur ins Kanban-Board übertragen. 
Möchten Sie, dass ich die Spalten und Karten automatisch anlege?

[Nicht jetzt] [✅ Übernehmen]
```

### PHASE 2 - KI generiert JSON:

**KI-Prompt an LLM:**
```
Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.
Analysiere den Lerninhalt und generiere AUSSCHLIESSLICH eine JSON-Struktur 
(kein anderer Text!).

Format:
{
  "columns": [
    {
      "name": "Spaltenname",
      "description": "...",
      "cards": [
        {"heading": "...", "content": "...", "labels": [...], "priority": "high"}
      ]
    }
  ]
}

Antworte AUSSCHLIESSLICH mit valide JSON!
```

**LLM-Response (JSON):**
```json
{
  "columns": [
    {
      "name": "Grundlagen & Einstieg",
      "description": "Einstieg in die Römische Geschichte",
      "cards": [
        {
          "heading": "Rom entsteht",
          "content": "Geografie und Gründung Roms, Legendäre Anfänge (Romulus & Remus)",
          "labels": ["grundlagen", "geschichte"],
          "priority": "high"
        },
        {
          "heading": "Gesellschaftliche Struktur",
          "content": "Patrizier und Plebejer",
          "labels": ["gesellschaft"],
          "priority": "medium"
        }
      ]
    },
    {
      "name": "Republik & Expansion",
      ...
    }
  ]
}
```

### PHASE 2 - Board wird aufgebaut:

```
⏳ Konvertiere Vorschlag in Board-Struktur...
📋 Erstelle 5 Spalten mit insgesamt 12 Karten...
✅ Board-Struktur erfolgreich erstellt! (17/17 Aktionen erfolgreich)
```

---

## 🛡️ Fehlerbehandlung & Retry

Wenn JSON vom LLM **ungültig** ist:

```
⚠️ Struktur-Format ungültig (Versuch 1/3):
Missing or invalid "columns" array

Versuche erneut...
```

**Retry-Logik:**
1. ❌ JSON invalid → Zeige Fehler + retry count
2. 🔄 Generiere besseren Prompt mit Beispiel
3. 🔄 Max. 3 Versuche
4. ❌ Nach 3 Versuchen → Abbruch + Fehlermeldung

```typescript
// In aiActionGenerator.ts
const MAX_STRUCTURE_RETRIES = 3;

// In AIPanel.svelte
if (!validation.valid) {
  structureRetries++;
  if (structureRetries < MAX_STRUCTURE_RETRIES) {
    // Retry mit besserem Prompt
  } else {
    // Gib auf nach 3 Versuchen
  }
}
```

---

## 📊 Data Structures

### ContentProposal (Phase 1)
```typescript
interface ContentProposal {
  type: 'content';
  title: string;                    // z.B. "Hauptphasen der Unterrichtseinheit"
  content: string;                  // Markdown-Content
  structure?: string;               // 'spalten-mit-karten', 'phasen', etc.
  canGenerate: boolean;             // Ob Struktur automatisch generiert werden kann
}
```

### StructureProposal (Phase 2)
```typescript
interface StructureProposal {
  type: 'structure';
  columns: ColumnStructure[];
}

interface ColumnStructure {
  name: string;                     // z.B. "Grundlagen & Einstieg"
  description?: string;             // Optional
  cards: CardStructure[];
}

interface CardStructure {
  heading: string;                  // z.B. "Rom entsteht"
  content?: string;                 // Detaillierte Beschreibung
  labels?: string[];                // ["grundlagen", "geschichte"]
  priority?: 'high' | 'medium' | 'low';
}
```

---

## 🔌 Integration in AIPanel.svelte

### State-Variablen:
```typescript
// Phase 1: Content Proposal State
let currentContentProposal = $state<ContentProposal | null>(null);
let showContentApprovalDialog = $state(false);

// Phase 2: Structure Generation State
let isGeneratingStructure = $state(false);
let structureRetries = $state(0);
const MAX_STRUCTURE_RETRIES = 3;
```

### Handler-Funktionen:

#### `simulateAIResponse(userMessage)`
- Neu: Lädt nur Phase 1
- Zeigt Content-Vorschlag
- Wartet auf User-Bestätigung

#### `handleApproveProposal()`
- Startet Phase 2
- Ruft `generateBoardStructure()` auf
- Zeigt Approval-Dialog

#### `generateBoardStructure(proposal)`
- Generiert LLM-Prompt für JSON
- Validiert Response
- Retry-Logik bei ungültiger JSON

#### `processStructureAndCreateActions(jsonResponse)`
- Parsiert JSON zu StructureProposal
- Konvertiert zu Board-Aktionen
- Führt Aktionen sequenziell aus

#### `handleRejectProposal()`
- Bricht ab wenn User "Nicht jetzt" klickt

---

## 🎨 UI Changes

### Approval Dialog (nach Phase 1):
```
┌─────────────────────────────┐
│ Board-Struktur generieren?  │
│ Hauptphasen der Unterr...   │
├─────────────────────────────┤
│ 📋 Erkannte Struktur:       │
│    spalten-mit-karten       │
│ Gerne helfe ich dir bei...  │
├─────────────────────────────┤
│ [Nicht jetzt] [✅ Übernehmen]│
└─────────────────────────────┘
```

### Structure Generation Indicator:
```
⏳ Generiere Board-Struktur...
```

---

## 🧪 Vortests vor Deployment

```bash
# 1. Build prüfen
pnpm run build

# 2. TypeScript Errors checken
pnpm run check

# 3. ESLint
pnpm run lint

# 4. Tests
pnpm run test:unit
```

---

## 📝 Test-Szenarien

### Test 1: Erfolgreicher Flow
1. User: "Strukturiere Unterrichtseinheit Römisches Reich"
2. KI gibt Vorschlag (Markdown)
3. Dialog: "Möchten Sie Board-Struktur generieren?"
4. User: "✅ Übernehmen"
5. KI generiert JSON
6. Board wird aufgebaut ✅

### Test 2: Fehlerhafte JSON (Retry)
1. KI generiert ungültige JSON
2. System zeigt: "Struktur-Format ungültig (Versuch 1/3)"
3. KI versucht es nochmal
4. (Hoffentlich) gültiges JSON diesmal ✅

### Test 3: Zu viele Retries
1. KI generiert 3x ungültige JSON
2. System zeigt: "Struktur-Generierung fehlgeschlagen nach 3 Versuchen"
3. User muss manuell vorgehen

### Test 4: Content-Ablehnung
1. User: "Strukturiere..."
2. KI gibt Vorschlag
3. User klickt: "Nicht jetzt"
4. Dialog schließt, Konversation geht weiter

---

## 🚀 Nächste Schritte

### Phase 3: LLM-Integration
```typescript
// chatStore.svelte.ts muss erweitert werden mit:
- sendToLLM(prompt, context?) → { content, error }
- checkActionConfidence(action) → { shouldAutoExecute, confidence, patternHash, usageCount }
```

### Phase 4: Learning System
```typescript
// Lerne von User-Choices:
- Welche Struktur-Patterns werden häufig akzeptiert?
- Welche Board-Aktionen werden auto-executed?
- Verbesserung der Prompts basierend auf Erfolgs-Rate
```

### Phase 5: Streaming-Responses
```typescript
// Für besseres UX:
- Stream JSON-Response während Generierung
- Show Progress Bar (50%, 75%, 100%)
- Cancel-Option während Generation läuft
```

---

## 📖 Referenzen

- **AIPanel.svelte** - Neu: 2-Phase UI
- **aiActionGenerator.ts** - Neu: Hilfs-Funktionen
- **boardStore.svelte.ts** - Unchanged: createColumn(), createCard()
- **chatStore.svelte.ts** - Muss erweitert werden
- **DOCUMENTATION-RULES-v3.md** - Code ↔ Docs Sync erforderlich!

---

## ⚠️ Bekannte Limitationen

1. **LLM Consistency**: Nicht alle LLMs generieren valides JSON zuverlässig
   - → Retry-System mindert das Problem, aber nicht 100% Erfolgsrate
   - → Evtl. Fallback zu Regex-Parsing für sehr schlecht formatierte Responses

2. **Complex Structures**: Sehr komplexe Strukturen (>10 Spalten) können Schwierigkeiten bereiten
   - → LLM könnte JSON truncaten oder abkürzen
   - → Lösung: Batch-Processing in mehreren Struktur-Anfragen

3. **User Context Loss**: Nach mehreren Turns vergisst LLM möglicherweise Original-Content
   - → Führe immer Original-Content mit Prompt mit (nicht nur letzte Message)

---

**Status:** ✅ Implementierung abgeschlossen  
**Testing-Datum:** Pending  
**Deployment-Datum:** Nach erfolgreichem Build & Test  
