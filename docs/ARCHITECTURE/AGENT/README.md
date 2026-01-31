# Agent Module - Tool-Based AI System

**Version:** 3.0 (Tool-Based Architecture)  
**Datum:** 31. Januar 2026  
**Status:** ✅ PRODUCTION READY

---

## Übersicht

Das `agent/` Modul implementiert ein **Tool-Based AI System** mit OpenAI Function Calling. Das alte 3-Phasen System (Intent Detection → Content Proposal → Structure Generation) wurde **vollständig ersetzt**.

**Architektur:**

```
src/lib/agent/
├── index.ts                    ← Zentrale Exports (Public API)
├── types.ts                    ← TypeScript Interfaces (Tool-Types)
├── llmRequest.ts               ← LLM API Wrapper (OpenAI/Ollama)
└── tools/                      ← Tool-Based AI System
    ├── index.ts                ← Tool Exports
    ├── toolDefinitions.ts      ← OpenAI Function Calling Schemas
    ├── toolExecutor.ts         ← Tool Dispatcher & Execution
    └── toolSystemPrompt.ts     ← Kontextbewusster System Prompt
```

---

## Konzept: Tool-Based AI (OpenAI Function Calling)

Statt manuell LLM-Responses zu parsen, verwendet das System **OpenAI Function Calling**:

```
┌─────────────────────────────────────────────────────────────────┐
│  User: "Erstelle eine Karte zu Fake News"                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  LLM + Tools: Wählt automatisch `add_card` Tool                 │
│  Response: { tool_calls: [{ name: "add_card", args: {...} }] }  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Tool Executor: Führt `add_card` mit BoardStore aus             │
│  → Karte wird erstellt, User erhält Feedback                    │
└─────────────────────────────────────────────────────────────────┘
```

**Vorteile:**
- ✅ Keine manuelle JSON-Validierung nötig
- ✅ LLM wählt automatisch das richtige Tool
- ✅ Robuster als Text-Parsing
- ✅ Erweiterbar (neue Tools = neue Funktionen)

---

## Verfügbare Tools

### Board Tools

| Tool | Beschreibung |
|------|--------------|
| `populate_board` | Befüllt Board komplett mit Spalten & Karten |
| `update_board` | Aktualisiert Board-Metadaten (Beschreibung, Tags) |

### Column Tools

| Tool | Beschreibung |
|------|--------------|
| `add_column` | Fügt neue Spalte hinzu |
| `update_column` | Benennt Spalte um |
| `delete_column` | Löscht Spalte inkl. Karten |

### Card Tools

| Tool | Beschreibung |
|------|--------------|
| `add_card` | Erstellt einzelne Karte in Spalte |
| `update_card` | Aktualisiert Karten-Inhalt, Labels, Links, Bild |
| `move_card` | Verschiebt Karte zwischen Spalten |
| `delete_card` | Löscht Karte |

### Comment Tools

| Tool | Beschreibung |
|------|--------------|
| `add_comment` | Fügt Kommentar zu Karte hinzu |

### Meta Tools

| Tool | Beschreibung |
|------|--------------|
| `respond` | Antwortet ohne Board-Aktion (Fragen, Erklärungen) |
| `ask_clarification` | Fragt nach mehr Details |

---

## Public API

### Import

```typescript
// Zentrale Imports
import { llmRequest } from '$lib/agent';
import type { ToolDefinition, ToolCall, ToolResult } from '$lib/agent';

// Tool-spezifische Imports
import {
  toolDefinitions,
  getToolDefinitions,
  buildToolSystemPrompt,
  executeToolCall,
  executeToolCalls
} from '$lib/agent/tools';
```

### Types (`types.ts`)

```typescript
// OpenAI Function Calling Format
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: { type: 'object'; properties: Record<string, any>; required: string[] };
  };
}

// Tool-Call aus LLM Response
interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };  // JSON string
}

// Ergebnis einer Tool-Ausführung
interface ToolResult {
  tool_call_id: string;
  tool_name: string;
  success: boolean;
  result?: any;
  error?: string;
}
```

---

## Verwendung

### 1. System Prompt mit Board-Kontext erstellen

```typescript
import { buildToolSystemPrompt } from '$lib/agent/tools';

const systemPrompt = buildToolSystemPrompt(
  {
    name: boardStore.board.name,
    description: boardStore.board.description,
    columns: boardStore.uiData
  },
  selectedCard  // Optional: aktuell selektierte Karte
);
```

### 2. LLM Request mit Tools

```typescript
import { getToolDefinitions } from '$lib/agent/tools';

const response = await fetch(endpoint, {
  method: 'POST',
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    tools: getToolDefinitions(),  // ← Alle Tool-Schemas
    tool_choice: 'auto'
  })
});
```

### 3. Tool-Calls ausführen

```typescript
import { executeToolCalls } from '$lib/agent/tools';

const toolCalls = response.choices[0].message.tool_calls;

if (toolCalls) {
  const results = await executeToolCalls(toolCalls, {
    boardOperations,  // BoardOperations instance
    nostrIntegration, // NostrIntegration instance
    board: boardStore.board
  });
  
  // Ergebnisse verarbeiten
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.tool_name}: ${result.result}`);
    } else {
      console.error(`❌ ${result.tool_name}: ${result.error}`);
    }
  }
}
```

---

## LLM Request Utility

`llmRequest.ts` bietet einen generischen LLM-Wrapper:

```typescript
import { llmRequest } from '$lib/agent';

// Text-Response
const text = await llmRequest({
  systemPrompt: 'Du bist ein hilfreicher Assistent.',
  userMessage: 'Was ist 2+2?',
  returnType: 'text'
});

// JSON-Response (mit Auto-Extraktion)
const json = await llmRequest<{ answer: number }>({
  systemPrompt: 'Antworte nur mit JSON.',
  userMessage: 'Was ist 2+2?',
  returnType: 'json'
});

// → Unterstützt: OpenAI, OpenRouter, Ollama (auto-detect)
```

**Features:**
- ✅ Auto-Detection: OpenAI vs Ollama Endpoint
- ✅ JSON Auto-Extraktion (aus Markdown, Text)
- ✅ Reasoning-Model Support (DeepSeek, o1)
- ✅ Konfiguration via `settingsStore`

---

## Tool Executor Details

Der `toolExecutor.ts` enthält:

### JSON Repair

LLMs (besonders Ollama) erzeugen manchmal fehlerhaftes JSON. Der Executor repariert:
- Echte Newlines in Strings → `\n`
- Doppelt escapte Characters → `\\n` → `\n`
- Fehlende schließende Klammern
- Extra Text nach JSON

### Execution Context

```typescript
interface ExecutionContext {
  boardOperations: BoardOperations;
  nostrIntegration: NostrIntegration;
  board: Board;
}
```

### Tool Dispatch

Jedes Tool wird an die entsprechende `BoardOperations` Methode dispatcht:

```typescript
// add_card → BoardOperations.createCard()
// update_card → BoardOperations.editCard()
// move_card → BoardOperations.moveCard()
// etc.
```

---

## Konfiguration

Die LLM-Einstellungen kommen aus `settingsStore`:

| Setting | Beschreibung |
|---------|--------------|
| `llmBaseUrl` | API-Endpoint (OpenAI, OpenRouter, Ollama) |
| `llmApiKey` | API-Key (nicht nötig für Ollama) |
| `llmModel` | Model-Name (z.B. `gpt-4`, `llama3`) |

---

## Archivierte Dokumentation

Das alte 3-Phasen System wurde archiviert:
- `archive/MIGRATION-AIACTIONGENERATOR.md` - Historische Migration
- `archive/TWO-PHASE-AI-RESPONSE.md` - Altes 2-Phasen System

Diese Dateien sind **nicht mehr relevant** für die aktuelle Implementierung.

---

## Erweiterung: Neue Tools hinzufügen

### 1. Tool-Definition in `toolDefinitions.ts`

```typescript
{
  type: 'function',
  function: {
    name: 'my_new_tool',
    description: 'Beschreibung für das LLM',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '...' }
      },
      required: ['param1']
    }
  }
}
```

### 2. Handler in `toolExecutor.ts`

```typescript
case 'my_new_tool': {
  const { param1 } = args;
  // Implementierung...
  return { success: true, result: 'Ergebnis' };
}
```

---

## Roadmap

**Aktuell (v3.0):** ✅ Tool-Based AI System
- [x] OpenAI Function Calling
- [x] Board/Column/Card Tools
- [x] JSON Repair für LLM-Fehler
- [x] Multi-Provider Support (OpenAI, Ollama)

**Geplant (feature/ai-mcp Branch):**
- [ ] OER-Suche Tools (`search_oer`, `add_cards_from_oer`)
- [ ] URL-Import Tool (`import_from_url`)
- [ ] MCP Server Integration

---

**Zuletzt aktualisiert:** 31. Januar 2026  
**Status:** ✅ Production Ready
