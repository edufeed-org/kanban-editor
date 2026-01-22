# 🧠 Tool-Based KI-Integration (MCP-Style)

**Version:** 1.1  
**Datum:** 21. Januar 2026  
**Status:** ✅ Active (Einzige KI-Architektur)  
**Framework:** Svelte 5 Runes  
**Architektur:** Tool-Based (OpenAI Function Calling)

> **✅ Dies ist die aktive und einzige KI-Architektur im Projekt.**  
> Die alten Ansätze (Intent Detection, 2-Phase System, Learning) wurden entfernt.

---

## I. Übersicht

### Was ist das?

Ein KI-Assistent für die Unterrichtsvorbereitung, der das Kanban-Board über **vordefinierte Tools** manipuliert. Das LLM entscheidet selbständig, welches Tool mit welchen Parametern aufgerufen wird.

### Architektur-Vergleich

```
══════════════════════════════════════════════════════════════════════
ALTER ANSATZ (DEPRECATED) - AI-INTEGRATION.md v2.0
══════════════════════════════════════════════════════════════════════
User: "Erstelle eine Karte zu Fake-News"
   ↓
Intent Detection (Rule-based + LLM) → "confirmation"
   ↓
Phase 1: LLM generiert Markdown-Vorschlag
   ↓
Phase 2: LLM generiert GANZES Board JSON
   ↓
❌ PROBLEM: 4 Spalten mit 12 Karten erstellt statt 1 Karte!

══════════════════════════════════════════════════════════════════════
NEUER ANSATZ (Tool-Based) - Diese Dokumentation
══════════════════════════════════════════════════════════════════════
User: "Erstelle eine Karte zu Fake-News in Spalte Material"
   ↓
LLM mit Tool-Definitionen (OpenAI Function Calling)
   ↓
LLM Output: {
  "tool": "add_card",
  "params": { "heading": "Fake-News", "columnName": "Material" }
}
   ↓
Tool Executor → boardStore.createCard()
   ↓
✅ ERGEBNIS: Exakt 1 Karte in "Material" erstellt!
```

### Warum Tool-Based?

| Alter Ansatz | Neuer Ansatz |
|--------------|--------------|
| Intent Detection oft falsch | LLM entscheidet selbst |
| Immer ganzes Board generiert | Granulare Einzelaktionen |
| 2-Phasen-System komplex | 1 LLM-Call mit Tools |
| Schwer erweiterbar | Einfach neue Tools hinzufügen |
| ~500 Zeilen Intent-Code | ~200 Zeilen Tool-Definitionen |

---

## II. Tool-Katalog

### 📋 Übersicht aller Tools

| Kategorie | Tool | Parameter | Beschreibung |
|-----------|------|-----------|--------------|
| **Board** | `create_board` | `title`, `description?`, `columns?[]` | Neues Board erstellen |
| **Board** | `update_board` | `description` | Board-Beschreibung ändern |
| **Spalte** | `add_column` | `name`, `color?` | Neue Spalte hinzufügen |
| **Spalte** | `update_column` | `columnName`, `newName` | Spalte umbenennen |
| **Spalte** | `delete_column` | `columnName` | Spalte löschen |
| **Karte** | `add_card` | `heading`, `columnName`, `content?`, `labels?[]` | Karte erstellen |
| **Karte** | `update_card` | `cardId`, `heading?`, `content?`, `links?[]`, `labels?[]`, `image?` | Karte aktualisieren |
| **Karte** | `move_card` | `cardId`, `fromColumn`, `toColumn` | Karte verschieben |
| **Karte** | `delete_card` | `cardId` | Karte löschen |
| **Kommentar** | `add_comment` | `cardId`, `text` | Kommentar hinzufügen |
| **Meta** | `respond` | `message` | Nur Text-Antwort |
| **Meta** | `ask_clarification` | `question` | Nachfrage stellen |

---

## III. Detaillierte Tool-Spezifikationen

### 🔷 Board-Tools

#### `create_board`
Erstellt ein komplett neues Kanban-Board.

```typescript
{
  name: "create_board",
  parameters: {
    title: string,          // Pflicht: Board-Titel
    description?: string,   // Optional: Beschreibung
    columns?: [{            // Optional: Spalten mit Karten
      name: string,
      cards?: [{ heading: string, content?: string }]
    }]
  }
}
```

**Beispiel-Aufruf:**
```json
{
  "tool": "create_board",
  "arguments": {
    "title": "Medienkompetenz",
    "description": "Unterrichtsplanung für Klasse 8",
    "columns": [
      { "name": "Einstieg", "cards": [{ "heading": "Brainstorming" }] },
      { "name": "Erarbeitung" },
      { "name": "Sicherung" }
    ]
  }
}
```

#### `update_board`
Aktualisiert die Beschreibung des aktuellen Boards.

```typescript
{
  name: "update_board",
  parameters: {
    description: string     // Neue Beschreibung
  }
}
```

---

### 🔷 Spalten-Tools

#### `add_column`
Fügt eine neue Spalte zum Board hinzu.

```typescript
{
  name: "add_column",
  parameters: {
    name: string,           // Pflicht: Spaltenname
    color?: string          // Optional: slate|red|orange|yellow|green|blue|purple|pink
  }
}
```

#### `update_column`
Benennt eine bestehende Spalte um.

```typescript
{
  name: "update_column",
  parameters: {
    columnName: string,     // Aktueller Name (zur Identifikation)
    newName: string         // Neuer Name
  }
}
```

#### `delete_column`
Löscht eine Spalte inkl. aller enthaltenen Karten.

```typescript
{
  name: "delete_column",
  parameters: {
    columnName: string      // Name der zu löschenden Spalte
  }
}
```

---

### 🔷 Karten-Tools

#### `add_card`
Erstellt eine neue Karte in einer Spalte.

```typescript
{
  name: "add_card",
  parameters: {
    heading: string,        // Pflicht: Kartentitel
    columnName: string,     // Pflicht: Zielspalte
    content?: string,       // Optional: Beschreibung
    labels?: string[]       // Optional: Tags/Labels
  }
}
```

**Beispiel-Aufruf:**
```json
{
  "tool": "add_card",
  "arguments": {
    "heading": "Fake-News erkennen",
    "columnName": "Material",
    "content": "Übungsblatt zur Quellenprüfung",
    "labels": ["Medienkompetenz", "Kritisches Denken"]
  }
}
```

#### `update_card`
Aktualisiert eine bestehende Karte.

```typescript
{
  name: "update_card",
  parameters: {
    cardId: string,         // Pflicht: ID oder Titel der Karte
    heading?: string,       // Optional: Neuer Titel
    content?: string,       // Optional: Neue Beschreibung
    labels?: string[],      // Optional: Neue Labels
    links?: [{              // Optional: Links hinzufügen
      url: string,
      title: string
    }],
    image?: string          // Optional: Bild-URL
  }
}
```

**Beispiel - Labels hinzufügen:**
```json
{
  "tool": "update_card",
  "arguments": {
    "cardId": "Fake-News erkennen",
    "labels": ["Medienkompetenz", "Kritisches Denken", "Neu: Quellenarbeit"]
  }
}
```

**Beispiel - Bild und Link hinzufügen:**
```json
{
  "tool": "update_card",
  "arguments": {
    "cardId": "Fake-News",
    "image": "https://example.com/infografik.png",
    "links": [{ "url": "https://klicksafe.de", "title": "klicksafe.de" }]
  }
}
```

#### `move_card`
Verschiebt eine Karte in eine andere Spalte.

```typescript
{
  name: "move_card",
  parameters: {
    cardId: string,         // ID oder Titel der Karte
    fromColumn: string,     // Quellspalte
    toColumn: string        // Zielspalte
  }
}
```

#### `delete_card`
Löscht eine Karte.

```typescript
{
  name: "delete_card",
  parameters: {
    cardId: string          // ID oder Titel der Karte
  }
}
```

---

### 🔷 Kommentar-Tools

#### `add_comment`
Fügt einen Kommentar zu einer Karte hinzu.

```typescript
{
  name: "add_comment",
  parameters: {
    cardId: string,         // ID oder Titel der Karte
    text: string            // Kommentar-Text
  }
}
```

---

### 🔷 Meta-Tools

#### `respond`
Antwortet dem Nutzer ohne Board-Aktion.

```typescript
{
  name: "respond",
  parameters: {
    message: string         // Die Antwort
  }
}
```

**Wann nutzen:** Fragen beantworten, Erklärungen geben, Gespräche führen.

#### `ask_clarification`
Fragt nach mehr Details.

```typescript
{
  name: "ask_clarification",
  parameters: {
    question: string        // Die Rückfrage
  }
}
```

**Wann nutzen:** Unklare Anfragen, fehlende Informationen.

---

## IV. Implementierung

### Dateistruktur

```
src/lib/agent/
├── tools/                          # 🆕 NEU
│   ├── index.ts                    # Exports
│   ├── toolDefinitions.ts          # OpenAI Function Calling Schema
│   ├── toolExecutor.ts             # Tool-Dispatcher → boardStore
│   └── toolSystemPrompt.ts         # System Prompt Generator
├── actionProcessing.ts             # ✅ BEHALTEN (intern genutzt)
├── types.ts                        # 🔄 ERWEITERT (ToolCall, ToolResult)
├── llmRequest.ts                   # ✅ BEHALTEN
│
│ ❌ DEPRECATED (nicht mehr nutzen):
├── intentDetection.ts              
├── llmIntentDetection.ts           
├── contentProposal.ts              
└── structureGeneration.ts          
```

### Type Definitions

```typescript
// src/lib/agent/types.ts - ERWEITERT

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}
```

### System Prompt

```typescript
// src/lib/agent/tools/toolSystemPrompt.ts

export function buildToolSystemPrompt(boardContext: any): string {
  const columnNames = boardContext.columns?.map((c: any) => c.name).join(', ') || 'Keine';
  
  // Alle Karten mit Details für Analyse-Aufgaben
  const allCards = boardContext.columns?.flatMap((col: any) => 
    col.cards?.map((card: any) => ({
      column: col.name,
      heading: card.heading,
      content: card.content || '(leer)',
      labels: card.labels || []
    }))
  ) || [];
  
  return `Du bist ein KI-Assistent für ein Kanban-Board zur Unterrichtsplanung.

## Aktueller Board-Kontext
- Board: "${boardContext.name || 'Unbenannt'}"
- Spalten: ${columnNames}
- Karten: ${JSON.stringify(allCards, null, 2)}

## Regeln
1. **EINE Karte erstellen** → add_card (NICHT create_board!)
2. **EINE Spalte erstellen** → add_column
3. **Ganzes Board mit Spalten** → create_board
4. **Karte ändern** → update_card
5. **Gespräch/Frage** → respond
6. **Unklare Anfrage** → ask_clarification

## BATCH-OPERATIONEN
Wenn der Nutzer eine Aufgabe für MEHRERE Karten anfordert:
- Analysiere ALLE Karten im Kontext
- Gib MEHRERE tool_calls in einer Antwort zurück
- Jede Karte bekommt einen eigenen update_card Aufruf

Beispiel: "Ergänze Labels bei allen Karten ohne Label"
→ Gib N separate update_card Aufrufe zurück (einen pro Karte)

## WICHTIG
- "erstelle eine Karte" → IMMER add_card, NIEMALS create_board!
- Antworte auf Deutsch
- Nutze IMMER ein Tool`;
}
```

### Tool Executor

```typescript
// src/lib/agent/tools/toolExecutor.ts

import { boardStore } from '$lib/stores/kanbanStore.svelte';
import type { ToolCall, ToolResult } from '../types';

export async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  const { name, arguments: args } = toolCall;
  
  switch (name) {
    case 'add_card': {
      const column = findColumnByName(args.columnName);
      if (!column) {
        return { success: false, message: `❌ Spalte "${args.columnName}" nicht gefunden` };
      }
      boardStore.createCard(column.id, args.heading, args.content, args.labels);
      return { success: true, message: `✅ Karte "${args.heading}" erstellt` };
    }
    
    case 'update_card': {
      const card = findCardById(args.cardId);
      if (!card) {
        return { success: false, message: `❌ Karte nicht gefunden` };
      }
      boardStore.editCard(card.id, {
        heading: args.heading,
        content: args.content,
        labels: args.labels,
        links: args.links,
        image: args.image
      });
      return { success: true, message: `✅ Karte aktualisiert` };
    }
    
    case 'respond':
      return { success: true, message: args.message };
    
    // ... weitere Tools
  }
}
```

---

## V. Beispiel-Flows

### Flow 1: Einzelne Karte erstellen

```
User: "Erstelle eine Karte zu Fake-News in der Spalte Material"

→ LLM Output:
{
  "tool_calls": [{
    "function": {
      "name": "add_card",
      "arguments": "{\"heading\":\"Fake-News\",\"columnName\":\"Material\"}"
    }
  }]
}

→ executeToolCall()
→ boardStore.createCard("material-id", "Fake-News")
→ triggerUpdate()

✅ EINE Karte erstellt
```

### Flow 2: Karte aktualisieren

```
User: "Füge der Karte 'Fake-News' das Label 'Medienkompetenz' hinzu"

→ LLM Output:
{
  "tool_calls": [{
    "function": {
      "name": "update_card",
      "arguments": "{\"cardId\":\"Fake-News\",\"labels\":[\"Medienkompetenz\"]}"
    }
  }]
}

→ findCardById("Fake-News")
→ boardStore.editCard(cardId, { labels: ["Medienkompetenz"] })

✅ Karte aktualisiert
```

### Flow 3: Konversation ohne Board-Aktion

```
User: "Was ist Medienkompetenz?"

→ LLM Output:
{
  "tool_calls": [{
    "function": {
      "name": "respond",
      "arguments": "{\"message\":\"Medienkompetenz bezeichnet die Fähigkeit...\"}"
    }
  }]
}

✅ Nur Text-Antwort, keine Board-Änderung
```

### Flow 4: Ganzes Board erstellen

```
User: "Erstelle ein Board für Medienkompetenz mit 3 Spalten"

→ LLM Output:
{
  "tool_calls": [{
    "function": {
      "name": "create_board",
      "arguments": "{\"title\":\"Medienkompetenz\",\"columns\":[{\"name\":\"Einstieg\"},{\"name\":\"Erarbeitung\"},{\"name\":\"Sicherung\"}]}"
    }
  }]
}

✅ Neues Board mit 3 leeren Spalten
```

### Flow 5: Batch-Operation (Mehrere Karten gleichzeitig)

```
User: "Identifiziere fehlende Handlungsanweisungen und ergänze sie 
       in allen Karten. Gib ihnen das Label 'to do'."

→ LLM analysiert Board-Kontext und erkennt 3 Karten ohne Handlungsanweisung

→ LLM Output (Multiple Tool Calls):
{
  "tool_calls": [
    {
      "id": "call_1",
      "function": {
        "name": "update_card",
        "arguments": "{\"cardId\":\"Fake-News\",\"content\":\"Handlungsanweisung: Recherchiere 3 Beispiele für Fake-News und dokumentiere die Erkennungsmerkmale.\",\"labels\":[\"to do\"]}"
      }
    },
    {
      "id": "call_2", 
      "function": {
        "name": "update_card",
        "arguments": "{\"cardId\":\"Quellenprüfung\",\"content\":\"Handlungsanweisung: Prüfe die verlinkten Quellen auf Seriosität anhand der CRAAP-Methode.\",\"labels\":[\"to do\"]}"
      }
    },
    {
      "id": "call_3",
      "function": {
        "name": "update_card", 
        "arguments": "{\"cardId\":\"Diskussion\",\"content\":\"Handlungsanweisung: Bereite 3 Diskussionsfragen zum Thema Desinformation vor.\",\"labels\":[\"to do\"]}"
      }
    }
  ]
}

→ executeToolCall() wird für JEDEN Call ausgeführt
→ 3x boardStore.editCard()

✅ Alle 3 Karten wurden ergänzt und mit "to do" gelabelt
```

**Wichtig für Batch-Operationen:**
- Das LLM erhält den **vollständigen Board-Kontext** im System Prompt
- OpenAI Function Calling unterstützt **parallele Tool-Calls**
- Der Tool Executor iteriert durch **alle** tool_calls
- Jede Aktion wird **einzeln** ausgeführt und bestätigt

---

## VI. AIPanel.svelte Integration

```svelte
<script lang="ts">
  import { getToolDefinitions, buildToolSystemPrompt, executeToolCall } from '$lib/agent/tools';
  import { chatStore } from '$lib/stores/chatStore.svelte';
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';

  async function handleUserMessage(userMessage: string) {
    // 1. Board-Kontext
    const boardContext = boardStore.getContextData(false);
    
    // 2. System Prompt + Tools
    const systemPrompt = buildToolSystemPrompt(boardContext);
    const tools = getToolDefinitions();
    
    // 3. LLM Call
    const response = await callLLMWithTools(userMessage, systemPrompt, tools);
    
    // 4. Tool ausführen
    if (response.tool_calls?.length > 0) {
      for (const tc of response.tool_calls) {
        const result = await executeToolCall({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        });
        chatStore.addMessage(result.message, 'assistant');
      }
    }
  }

  async function callLLMWithTools(userMessage: string, systemPrompt: string, tools: any[]) {
    const { llmBaseUrl, llmApiKey, llmModel } = settingsStore.settings;
    
    const res = await fetch(`${llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(llmApiKey && { 'Authorization': `Bearer ${llmApiKey}` })
      },
      body: JSON.stringify({
        model: llmModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        tools,
        tool_choice: 'required'
      })
    });
    
    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content,
      tool_calls: data.choices?.[0]?.message?.tool_calls
    };
  }
</script>
```

---

## VII. Migration Guide

### Schritt 1: Tools-Ordner erstellen

```bash
mkdir -p src/lib/agent/tools
```

### Schritt 2: Dateien erstellen

1. `tools/index.ts` - Exports
2. `tools/toolDefinitions.ts` - Alle 12 Tool-Schemas
3. `tools/toolSystemPrompt.ts` - Prompt Generator
4. `tools/toolExecutor.ts` - Dispatcher

### Schritt 3: types.ts erweitern

`ToolCall`, `ToolResult`, `ToolDefinition` hinzufügen.

### Schritt 4: AIPanel.svelte umbauen

- `simulateAIResponse()` → `handleUserMessage()`
- Phase 1/Phase 2 Code entfernen
- Tool-Flow implementieren

### Schritt 5: Deprecated Files

Diese Dateien nicht mehr importieren:
- `intentDetection.ts`
- `llmIntentDetection.ts`
- `contentProposal.ts`
- `structureGeneration.ts`

---

## VIII. Referenzen

- **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
- **Model Context Protocol:** https://modelcontextprotocol.io/
- **boardStore API:** [STORES/BOARDSTORE.md](../ARCHITECTURE/STORES/BOARDSTORE.md)
- **Alter Ansatz (deprecated):** [AI-INTEGRATION.md](./AI-INTEGRATION.md)

---

**Letztes Update:** 21. Januar 2026  
**Status:** Ready for Implementation  
**Geschätzter Aufwand:** ~70 Minuten
