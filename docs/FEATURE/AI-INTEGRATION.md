# 🧠 KI-Integration im Kanban-Board (Vollständige Spezifikation)

**Version:** 2.0
**Datum:** 25. Oktober 2025
**Status:** Konzept (Design Phase)
**Framework:** Svelte 5 Runes
**Zielgruppe:** Lehrkräfte (Unterrichtsvorbereitung)

---

## I. Übersicht

### Was ist das?

Ein KI-Assistent ("Co-Pilot") für die Unterrichtsvorbereitung, der direkt in die rechte Sidebar des Kanban-Boards integriert ist. Der Assistent kann sowohl im Chat antworten als auch das Board aktiv manipulieren (Karten erstellen, Spalten organisieren, Kommentare hinzufügen).

### Wer braucht das?

- **Lehrkräfte:** Bei der Unterrichtsplanung (Material recherchieren, Phasen strukturieren, Methoden vorschlagen)
- **Entwickler:** Als Beispiel für LLM-Tool-Integration mit Svelte 5

### Warum?

- ✅ **Produktivität:** Routineaufgaben (z.B. Spalten erstellen, Material suchen) werden automatisiert
- ✅ **Wissensanbindung:** Zugriff auf Lehrplandatenbanken, Methodensammlungen via MCP-Server
- ✅ **Flexibilität:** Nutzer können ihr eigenes LLM (OpenAI, Ollama, etc.) konfigurieren

---

## II. Quick Start

### Minimales Setup

1. **Settings öffnen** (⚙️ Icon in Topbar)
2. **"KI-Einstellungen" Tab** auswählen
3. **LLM konfigurieren:**
   ```
   Model: ollama/mistral
   Base URL: http://localhost:11434
   API Key: (leer bei Ollama)
   ```
4. **MCP-Server hinzufügen** (optional):
   ```
   Name: Lehrplan DB NRW
   URL: https://mcp.example.org
   Commands: getCompetencies, searchContent
   ```
5. **Chat verwenden:**
   - "Erstelle eine Spalte 'Einstieg' und füge eine Karte 'Brainstorming' hinzu"
   - Der KI-Assistent erkennt die Absicht und manipuliert das Board direkt

---

## III. Architektur & Komponenten

### Die kritische Abhängigkeitskette (Svelte 5 Runes)

```
User-Chat-Eingabe
    ↓
AIController.sendMessage() [AIController.svelte.ts]
    ↓
LLM API Call (mit Tool-Definitionen)
    ↓
LLM Response (z.B. tool_calls: [{ name: "addCard", args: {...} }])
    ↓
AIController.executeToolCall()
    ├→ Internes Tool? → boardStore.createCard() [CRITICAL!]
    │   ↓
    │   board.findColumn().addCard() [Model-Layer]
    │   ↓
    │   triggerUpdate() [MUSS aufgerufen werden!]
    │   ↓
    │   updateTrigger++ [$state wird aktualisiert]
    │   ↓
    │   uiData $derived.by() [Dependency tracking]
    │   ↓
    │   Column.svelte $effect [Detektiert Änderung]
    │   ↓
    │   UI zeigt neue Karte ✅
    │
    └→ Externes Tool? → MCPClient.call()
        ↓
        HTTP Request zu MCP-Server
        ↓
        Antwort formatieren und im Chat anzeigen
```

**⚠️ KRITISCH:** Der `AIController` darf NIEMALS direkt `board.addCard()` aufrufen! Nur über `boardStore.createCard()` gehen, damit die Reaktivitätskette intakt bleibt.

---

## IV. Kernfunktionen

### 1. Board-Interaktion (Tool Calls)

Der Assistent kann das Kanban-Board über vordefinierte "Tools" manipulieren. Diese Tools sind Wrapper um die `boardStore`-Methoden.

**Verfügbare Tools:**
- `addCard` → `boardStore.createCard(columnId, heading, content)`
- `updateCard` → `boardStore.editCard(cardId, updates)`
- `deleteCard` → `boardStore.deleteCard(cardId)`
- `moveCard` → `boardStore.moveCard(cardId, fromColId, toColId)`
- `addColumn` → `boardStore.addColumn(name, color)`
- `deleteColumn` → `boardStore.deleteColumn(columnId)`
- `addComment` → `boardStore.addComment(cardId, text)`

### 2. Externe Datenanbindung (MCP-Server)

MCP (Model Context Protocol) ist eine standardisierte Schnittstelle für externe Datenquellen. Nutzer können beliebige MCP-Server konfigurieren (z.B. n8n Workflows, API-Gateways).

**Beispiel-MCPs für Unterrichtsvorbereitung:**
- `lehrplan-db-nrw` → `getCompetencies(subject, grade)`
- `methoden-sammlung` → `suggestTeachingMethods(topic)`
- `nostr-feed` → `searchMaterial(keywords)`
- `fachdidaktik-kb` → `summarizeCriteria(topic)`

### 3. Intelligente Intent-Erkennung

Der System-Prompt instruiert das LLM, zwischen Chat-Antworten und Board-Aktionen zu unterscheiden:

**Beispiele:**
- "Erkläre mir die Montessori-Methode" → Chat-Antwort (keine Board-Aktion)
- "Erstelle eine Spalte für die Erarbeitungsphase" → Board-Aktion (`addColumn`)
- "Suche Material zu Photosynthese" → MCP-Aufruf + ggf. Karte erstellen

### 4. Benutzerdefinierte Konfiguration

Alle KI-Einstellungen werden im `SettingsStore` gespeichert (bereits implementiert in `settingsStore.svelte.ts`).

---

---

## V. Detaillierte Implementierung

### 1. Datenmodell: `AIController.svelte.ts`

Der `AIController` ist der zentrale Orchestrator. Er **MUSS** die `.svelte.ts` Endung haben, da er reaktiven State (`$state`) nutzt.

```typescript
// src/lib/controllers/AIController.svelte.ts

import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
import type { ChatMessage, ToolCall } from './types';
import { MCPClient } from './MCPClient';

export class AIController {
    // ✅ Svelte 5 $state für reaktiven Chat-Verlauf
    public messages = $state<ChatMessage[]>([]);
    
    // ✅ Loading-State für UI-Feedback
    public isProcessing = $state(false);
    
    private mcpClient: MCPClient;
    
    constructor() {
        this.mcpClient = new MCPClient();
        
        // Initialisiere mit Willkommensnachricht
        this.messages = [{
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Hallo! Ich bin dein KI-Assistent für die Unterrichtsplanung. Wie kann ich helfen?',
            timestamp: Date.now()
        }];
    }
    
    /**
     * Sendet eine Nutzernachricht an das LLM
     */
    public async sendMessage(userInput: string): Promise<void> {
        if (!userInput.trim()) return;
        
        // Nutzernachricht zum Verlauf hinzufügen
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        };
        
        // ✅ Array Reassignment (Svelte 5 Reaktivität!)
        this.messages = [...this.messages, userMessage];
        
        this.isProcessing = true;
        
        try {
            // Board-Kontext für LLM vorbereiten
            const boardContext = this.getBoardContext();
            
            // LLM API aufrufen
            const response = await this.callLLM(userInput, boardContext);
            
            // Tool Calls verarbeiten (falls vorhanden)
            if (response.tool_calls && response.tool_calls.length > 0) {
                await this.executeToolCalls(response.tool_calls);
            }
            
            // LLM-Antwort zum Verlauf hinzufügen
            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.content || 'Aktion ausgeführt.',
                timestamp: Date.now(),
                toolCalls: response.tool_calls
            };
            
            // ✅ Array Reassignment
            this.messages = [...this.messages, assistantMessage];
            
        } catch (error) {
            console.error('AI Controller Error:', error);
            
            // Fehlermeldung zum Verlauf hinzufügen
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Fehler: ${error.message}`,
                timestamp: Date.now(),
                isError: true
            };
            
            // ✅ Array Reassignment
            this.messages = [...this.messages, errorMessage];
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Ruft das konfigurierte LLM mit Tool-Definitionen auf
     */
    private async callLLM(userInput: string, boardContext: any): Promise<any> {
        const settings = settingsStore.settings;
        
        // System-Prompt dynamisch zusammenbauen
        const systemPrompt = this.buildSystemPrompt();
        
        // Tools für LLM definieren
        const tools = this.buildToolDefinitions();
        
        // API Request (OpenAI-kompatibel)
        const response = await fetch(`${settings.llmBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(settings.llmApiKey && { 'Authorization': `Bearer ${settings.llmApiKey}` })
            },
            body: JSON.stringify({
                model: settings.llmModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...this.messages.slice(-10).map(m => ({ // Letzte 10 Nachrichten als Kontext
                        role: m.role,
                        content: m.content
                    })),
                    { role: 'user', content: userInput },
                    {
                        role: 'system',
                        content: `Aktueller Board-Kontext:\n${JSON.stringify(boardContext, null, 2)}`
                    }
                ],
                tools: tools,
                tool_choice: 'auto'
            })
        });
        
        if (!response.ok) {
            throw new Error(`LLM API Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            tool_calls: data.choices[0].message.tool_calls
        };
    }
    
    /**
     * Führt Tool Calls aus
     * ⚠️ CRITICAL: Nutzt IMMER boardStore-Methoden (nicht board direkt!)
     */
    private async executeToolCalls(toolCalls: ToolCall[]): Promise<void> {
        for (const toolCall of toolCalls) {
            const { name, arguments: args } = toolCall.function;
            
            console.log(`🔧 Executing tool: ${name}`, args);
            
            try {
                // Interne Kanban-Tools
                if (name === 'addCard') {
                    // ✅ RICHTIG: Via boardStore (triggert Reaktivität!)
                    boardStore.createCard(args.columnId, args.heading, args.content);
                    
                } else if (name === 'updateCard') {
                    // ✅ RICHTIG: Via boardStore
                    boardStore.editCard(args.cardId, {
                        heading: args.heading,
                        content: args.content,
                        color: args.color
                    });
                    
                } else if (name === 'addComment') {
                    // ✅ RICHTIG: Via boardStore
                    await boardStore.addComment(args.cardId, args.text);
                    
                } else if (name === 'addColumn') {
                    // ✅ RICHTIG: Via boardStore
                    boardStore.addColumn(args.name, args.color);
                    
                } else if (name.startsWith('mcp_')) {
                    // Externe MCP-Tools
                    const result = await this.mcpClient.call(name, args);
                    console.log(`MCP Result:`, result);
                    
                    // Optional: Ergebnis als Karte anlegen
                    if (args.createCard && result) {
                        boardStore.createCard(
                            args.columnId,
                            `MCP: ${name}`,
                            JSON.stringify(result, null, 2)
                        );
                    }
                }
                
            } catch (error) {
                console.error(`Tool execution failed: ${name}`, error);
            }
        }
    }
    
    /**
     * Extrahiert Board-Kontext für LLM (nutzt getContextData())
     */
    private getBoardContext(): any {
        const board = boardStore.data;
        
        // ✅ Nutzt getContextData() für KI-Serialisierung (keine Klasseninstanzen!)
        return board.getContextData(false); // false = nur Karten-IDs (nicht voller Content)
    }
    
    /**
     * Baut den System-Prompt dynamisch zusammen
     */
    private buildSystemPrompt(): string {
        const settings = settingsStore.settings;
        
        return `${settings.llmSystemPrompt}

Du arbeitest mit einem Kanban-Board für die Unterrichtsvorbereitung. Die Spalten repräsentieren typischerweise:
- Materialrecherche
- Unterrichtsplanung (Einstieg, Erarbeitung, Sicherung)
- Medienvorbereitung
- Austausch mit Kolleg:innen

**Verfügbare Kanban-Tools:**
${JSON.stringify(this.getKanbanToolDefinitions(), null, 2)}

**Verfügbare MCP-Tools:**
${JSON.stringify(this.getMCPToolDefinitions(), null, 2)}

Wenn der Nutzer etwas erstellen, ändern oder organisieren möchte, nutze die Tools.
Wenn der Nutzer Informationen braucht, nutze die MCP-Tools oder antworte direkt.
Antworte IMMER auf Deutsch.`;
    }
    
    /**
     * Tool-Definitionen für LLM (OpenAI Function Calling Format)
     */
    private buildToolDefinitions(): any[] {
        return [
            ...this.getKanbanToolDefinitions(),
            ...this.getMCPToolDefinitions()
        ];
    }
    
    private getKanbanToolDefinitions(): any[] {
        return [
            {
                type: 'function',
                function: {
                    name: 'addCard',
                    description: 'Fügt eine neue Karte zu einer Spalte hinzu.',
                    parameters: {
                        type: 'object',
                        properties: {
                            columnId: { type: 'string', description: 'Die ID der Zielspalte.' },
                            heading: { type: 'string', description: 'Titel der Karte.' },
                            content: { type: 'string', description: 'Beschreibung der Karte (optional).' }
                        },
                        required: ['columnId', 'heading']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'addColumn',
                    description: 'Erstellt eine neue Spalte auf dem Board.',
                    parameters: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Name der neuen Spalte.' },
                            color: { type: 'string', description: 'Farbe der Spalte (optional).' }
                        },
                        required: ['name']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'addComment',
                    description: 'Fügt einen Kommentar zu einer Karte hinzu.',
                    parameters: {
                        type: 'object',
                        properties: {
                            cardId: { type: 'string', description: 'Die ID der Karte.' },
                            text: { type: 'string', description: 'Der Kommentar-Text.' }
                        },
                        required: ['cardId', 'text']
                    }
                }
            }
            // ... weitere Tools (updateCard, deleteCard, moveCard, etc.)
        ];
    }
    
    private getMCPToolDefinitions(): any[] {
        const settings = settingsStore.settings;
        const tools: any[] = [];
        
        // MCP-Server aus Settings laden (falls konfiguriert)
        // Dies ist ein vereinfachtes Beispiel - in der Praxis müssten die
        // Tool-Definitionen von den MCP-Servern selbst kommen
        if (settings.mcpUrls.length > 0) {
            tools.push({
                type: 'function',
                function: {
                    name: 'mcp_search',
                    description: 'Durchsucht externe Datenquellen via MCP-Server.',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Suchbegriff' },
                            mcpUrl: { type: 'string', description: 'URL des MCP-Servers' },
                            createCard: { type: 'boolean', description: 'Ergebnis als Karte anlegen?' }
                        },
                        required: ['query', 'mcpUrl']
                    }
                }
            });
        }
        
        return tools;
    }
    
    /**
     * Löscht den Chat-Verlauf
     */
    public clearChat(): void {
        this.messages = [{
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Chat wurde zurückgesetzt. Wie kann ich helfen?',
            timestamp: Date.now()
        }];
    }
}

// Typen
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
    isError?: boolean;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: any;
    };
}
```

### 2. MCP-Client Implementation

```typescript
// src/lib/controllers/MCPClient.ts

export class MCPClient {
    /**
     * Ruft einen MCP-Server auf
     */
    public async call(toolName: string, args: any): Promise<any> {
        // MCP-Server URL aus Tool-Name extrahieren
        // Format: "mcp_search" oder ähnlich
        
        const mcpUrl = args.mcpUrl;
        if (!mcpUrl) {
            throw new Error('MCP URL not provided');
        }
        
        // HTTP Request an MCP-Server
        const response = await fetch(mcpUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: toolName.replace('mcp_', ''),
                params: args
            })
        });
        
        if (!response.ok) {
            throw new Error(`MCP Error: ${response.statusText}`);
        }
        
        return await response.json();
    }
}
```

### 3. UI-Integration: CardSidebar.svelte

```svelte
<!-- src/routes/cardsboard/CardSidebar.svelte -->
<script lang="ts">
    import { AIController } from '$lib/controllers/AIController.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import SendIcon from '@lucide/svelte/icons/send';
    import LoaderIcon from '@lucide/svelte/icons/loader';
    
    // ✅ AIController instanziieren
    const aiController = new AIController();
    
    // Lokaler Input-State
    let userInput = $state('');
    
    async function handleSend() {
        if (!userInput.trim() || aiController.isProcessing) return;
        
        await aiController.sendMessage(userInput);
        userInput = ''; // Input leeren
    }
    
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }
</script>

<div class="flex flex-col h-full">
    <!-- Chat-Verlauf -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {#each aiController.messages as message (message.id)}
            <div class="message message--{message.role}">
                <div class="font-semibold text-sm mb-1">
                    {message.role === 'user' ? '👤 Du' : '🤖 KI-Assistent'}
                </div>
                <div class="text-sm whitespace-pre-wrap">
                    {message.content}
                </div>
                
                {#if message.toolCalls}
                    <div class="mt-2 text-xs text-muted-foreground">
                        🔧 Aktionen: {message.toolCalls.map(t => t.function.name).join(', ')}
                    </div>
                {/if}
            </div>
        {/each}
        
        {#if aiController.isProcessing}
            <div class="flex items-center gap-2 text-muted-foreground">
                <LoaderIcon class="h-4 w-4 animate-spin" />
                <span class="text-sm">Denke nach...</span>
            </div>
        {/if}
    </div>
    
    <!-- Input-Bereich -->
    <div class="border-t p-4">
        <div class="flex gap-2">
            <Textarea
                bind:value={userInput}
                placeholder="Frage den KI-Assistenten..."
                onkeydown={handleKeyDown}
                rows={3}
                disabled={aiController.isProcessing}
            />
            <Button
                onclick={handleSend}
                disabled={!userInput.trim() || aiController.isProcessing}
            >
                <SendIcon class="h-4 w-4" />
            </Button>
        </div>
    </div>
</div>

<style>
    .message {
        padding: 0.75rem;
        border-radius: 0.5rem;
    }
    
    .message--user {
        background: hsl(var(--muted));
        margin-left: 2rem;
    }
    
    .message--assistant {
        background: hsl(var(--accent));
        margin-right: 2rem;
    }
</style>
```

---

## VI. SettingsStore Erweiterung

Die Einstellungen für LLM und MCP sind **bereits** im `settingsStore.svelte.ts` implementiert!

**Relevante Felder:**
```typescript
export interface SettingsState {
    // ... andere Settings
    
    // LLM Model Integration (✅ BEREITS IMPLEMENTIERT)
    llmModel: string;      // z.B. "ollama/mistral"
    llmBaseUrl: string;    // z.B. "http://localhost:11434"
    llmApiKey: string;     // API-Key (leer bei Ollama)
    llmSystemPrompt: string;
    
    // MCP Integration (✅ BEREITS IMPLEMENTIERT)
    mcpUrls: string[];     // Liste von MCP-Server URLs
}
```

**API-Methoden:**
- `settingsStore.setLlmModel(model)`
- `settingsStore.setLlmBaseUrl(url)`
- `settingsStore.setLlmApiKey(key)`
- `settingsStore.setLlmSystemPrompt(prompt)`
- `settingsStore.addMcpUrl(url)`
- `settingsStore.removeMcpUrl(url)`

**⚠️ KEINE Änderungen am SettingsStore nötig!** Die benötigten Felder existieren bereits.

---

---

## VII. Häufige Fehler & Debugging

### ❌ Fehler 1: Board wird nicht aktualisiert nach Tool Call

**Symptom:** LLM gibt `tool_calls` zurück, aber Board zeigt keine neue Karte.

**Root Cause:** `AIController` ruft `board.addCard()` direkt auf statt `boardStore.createCard()`.

**Fix:**
```typescript
// ❌ FALSCH - Keine Reaktivität!
const column = boardStore.data.findColumn(columnId);
column?.addCard({ heading: 'Test' });

// ✅ RICHTIG - Triggert Reaktivitätskette!
boardStore.createCard(columnId, 'Test', 'Beschreibung');
// → triggerUpdate() wird automatisch aufgerufen
// → UI aktualisiert sich sofort
```

**Warum?** Siehe [ARCHITECTURE/REACTIVITY.md](../ARCHITECTURE/REACTIVITY.md) - nur `boardStore`-Methoden rufen `triggerUpdate()` auf!

---

### ❌ Fehler 2: LLM API gibt 401 Unauthorized

**Symptom:** Chat zeigt "Fehler: Unauthorized"

**Root Cause:** API-Key falsch oder fehlt.

**Fix:**
1. Settings öffnen → "KI-Einstellungen"
2. API-Key prüfen (bei OpenAI: muss mit `sk-` beginnen)
3. Bei lokalem Ollama: API-Key LEER lassen!

---

### ❌ Fehler 3: MCP-Server antwortet nicht

**Symptom:** Tool Call `mcp_search` hängt oder wirft Timeout-Fehler.

**Root Cause:** MCP-Server URL falsch oder Server nicht erreichbar.

**Fix:**
```typescript
// In Browser Console testen:
fetch('http://localhost:8080/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'ping', params: {} })
});
```

---

## VIII. Security & Best Practices

### 🔐 Security Considerations

1.  **API-Keys NIEMALS in localStorage (bei Remote-APIs)**
    ```typescript
    // ⚠️ NUR für lokales Ollama speichern!
    if (llmBaseUrl.includes('localhost')) {
        settingsStore.setLlmApiKey(key);
    } else {
        // Für OpenAI etc: Key nur in Session (nicht persistent)
        sessionStorage.setItem('temp_llm_key', key);
    }
    ```

2.  **URL-Validierung für MCP-Server**
    ```typescript
    // Im SettingsStore bereits implementiert:
    private isValidHttpUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }
    ```

3.  **Tool-Execution Rate Limiting**
    ```typescript
    // Im AIController: Max. 5 Tool Calls pro Anfrage
    if (toolCalls.length > 5) {
        throw new Error('Zu viele Tool Calls! Max. 5 pro Anfrage.');
    }
    ```

### ✅ Best Practices

1.  **Board-Kontext limitieren**
    ```typescript
    // Nicht das GESAMTE Board senden (zu viele Tokens)
    getBoardContext(): any {
        const board = boardStore.data;
        return board.getContextData(false); // false = nur IDs, nicht voller Content
    }
    ```

2.  **Chat-Verlauf begrenzen**
    ```typescript
    // Nur letzte 10 Nachrichten an LLM senden
    messages: [
        ...this.messages.slice(-10).map(m => ({ ... }))
    ]
    ```

3.  **Error Handling**
    ```typescript
    // IMMER try-catch bei Tool Execution
    try {
        boardStore.createCard(...);
    } catch (error) {
        console.error('Tool execution failed:', error);
        // Fehlermeldung im Chat anzeigen
    }
    ```

4.  **Loading States**
    ```typescript
    // isProcessing für UI-Feedback (Svelte 5 $state)
    public isProcessing = $state(false);
    
    // In UI:
    {#if aiController.isProcessing}
        <LoaderIcon class="animate-spin" />
    {/if}
    ```     "name": "addCard",
        "description": "Fügt eine neue Karte zu einer Spalte hinzu.",
        "parameters": {
            "type": "object",
            "properties": {
                "columnId": { "type": "string", "description": "Die ID der Spalte." },
                "heading": { "type": "string", "description": "Der Titel der neuen Karte." },
                "content": { "type": "string", "description": "Der Inhalt der neuen Karte." }
            },
            "required": ["columnId", "heading"]
        }
    },
    {
        "name": "addComment",
        "description": "Fügt einen Kommentar zu einer bestehenden Karte hinzu.",
        "parameters": {
            "type": "object",
            "properties": {
---

## IX. Implementierungs-Roadmap

### Phase 1: Foundation ✅ SETTINGS BEREITS FERTIG

- [x] ✅ `SettingsStore` mit LLM/MCP-Feldern (BEREITS IMPLEMENTIERT!)
- [ ] UI in `SettingsDialog.svelte` erweitern (neuer "KI" Tab)
- [ ] Security für API-Key Handling (sessionStorage für Remote-APIs)

**Acceptance Criteria:**
- Nutzer kann LLM-Modell, Base URL und API-Key konfigurieren
- Nutzer kann MCP-Server URLs hinzufügen/entfernen
- System-Prompt kann bearbeitet werden
- Settings werden in localStorage persistiert

---

### Phase 2: AIController Core

- [ ] `AIController.svelte.ts` erstellen (mit `$state` für messages)
- [ ] LLM API Call implementieren (OpenAI-kompatibel)
- [ ] Tool-Definitions generieren (Kanban-Tools als JSON)
- [ ] Board-Kontext via `getContextData()` extrahieren

**Acceptance Criteria:**
- AIController kann LLM aufrufen
- Tool-Definitionen werden korrekt generiert
- Board-Kontext wird an LLM gesendet
---

## X. Referenzen & Cross-Links

### 🏗️ Architektur

*   **[ARCHITECTURE/STORES.md](../ARCHITECTURE/STORES.md)** — **KRITISCH!** Board-Interaktion MUSS über `boardStore` erfolgen
*   **[ARCHITECTURE/REACTIVITY.md](../ARCHITECTURE/REACTIVITY.md)** — Svelte 5 Runes, `triggerUpdate()` Kette, `.svelte.ts` Convention
*   **[ARCHITECTURE/SETTINGSSTORE.md](../ARCHITECTURE/SETTINGSSTORE.md)** — LLM/MCP-Konfiguration (bereits implementiert!)
*   **[ARCHITECTURE/UX-RULES.md](../ARCHITECTURE/UX-RULES.md)** — shadcn-svelte UI-Guidelines für Chat-Interface

### 📚 Datenmodell

*   **[AGENTS.md](../AGENTS.md)** — `BoardModel.ts` Klassen, `getContextData()` für KI-Kontext
*   **[copilot-instructions.md](../../.github/copilot-instructions.md)** — Häufige Fehler, Best Practices

### 🔧 Implementation Guides

*   **[GUIDES/QUICK-START.md](../GUIDES/QUICK-START.md)** — Projekt Setup
*   **[GUIDES/PROP-VS-STATE-CHEATSHEET.md](../GUIDES/PROP-VS-STATE-CHEATSHEET.md)** — Svelte 5 Reaktivität

### 🔗 Verwandte Features

*   **[FEATURE/COMMENTS.md](./COMMENTS.md)** — Kommentar-System (wird von `addComment` Tool genutzt)

### 📖 External Resources

*   **OpenAI Function Calling:** https://platform.openai.com/docs/guides/function-calling
*   **Model Context Protocol (MCP):** https://modelcontextprotocol.io/
*   **Svelte 5 Runes:** https://svelte.dev/docs/svelte/what-are-runes
*   **Falls n8n zum Einsatz kommen soll**: **n8n MCP Server Trigger node:** https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcptrigger/ and **n8n Custom Code Tool node** https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolcode/

---

## XI. FAQ & Troubleshooting

### Q: Kann ich GPT-4 statt Ollama nutzen?

**A:** Ja! Konfiguriere in Settings:
```
Model: gpt-4-turbo
Base URL: https://api.openai.com/v1
API Key: sk-... (dein OpenAI Key)
```

⚠️ **Security:** API-Key wird in localStorage gespeichert. Für Production: Verwende Server-Side API Calls!

---

### Q: Wie füge ich ein neues Tool hinzu?

**A:**
1. Neue Methode in `boardStore.svelte.ts` erstellen (falls nötig)
2. Tool-Definition in `AIController.getKanbanToolDefinitions()` hinzufügen
3. Tool-Execution in `AIController.executeToolCalls()` implementieren

**Beispiel:**
```typescript
// 1. Store-Methode (falls noch nicht vorhanden)
public deleteCard(cardId: string): void {
    // ... implementation
    this.triggerUpdate(); // CRITICAL!
}

// 2. Tool-Definition
{
    type: 'function',
    function: {
        name: 'deleteCard',
        description: 'Löscht eine Karte vom Board.',
        parameters: {
            type: 'object',
            properties: {
                cardId: { type: 'string', description: 'Die ID der zu löschenden Karte.' }
            },
            required: ['cardId']
        }
    }
}

// 3. Tool-Execution
else if (name === 'deleteCard') {
    boardStore.deleteCard(args.cardId);
}
```

---

### Q: Warum funktioniert mein Tool Call nicht?

**A:** Debugging-Schritte:

1. **Check Console für LLM-Antwort:**
   ```typescript
   console.log('LLM Response:', data);
   ```

2. **Check Tool Call Format:**
   ```typescript
   console.log('Tool Calls:', response.tool_calls);
   ```

3. **Check Store-Methode wird aufgerufen:**
   ```typescript
   // In boardStore.createCard():
   console.log('✅ createCard called with:', columnId, heading);
   ```

4. **Check triggerUpdate() wird aufgerufen:**
   ```typescript
   // In boardStore.triggerUpdate():
   console.log('🔄 triggerUpdate called, new value:', this.updateTrigger);
   ```

5. **Check UI-Sync:**
   ```typescript
   // In Column.svelte $effect:
   console.log('🔄 Column $effect triggered, items:', items.length);
   ```

---

## XII. Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **LLM** | Large Language Model (z.B. GPT-4, Mistral) |
| **MCP** | Model Context Protocol (standardisierte API für Datenquellen) |
| **Tool Call** | LLM ruft eine Funktion auf (z.B. `addCard`) |
| **System-Prompt** | Instruktionen für das LLM (definiert Verhalten) |
| **Board-Kontext** | Aktueller Zustand des Boards (als JSON für LLM) |
| **Reaktivitätskette** | `triggerUpdate()` → `$derived` → `$effect` → UI-Update |
| **`.svelte.ts`** | Dateiendung für Stores mit Svelte 5 Runes (`$state`) |

---

**Letztes Update:** 25. Oktober 2025  
**Status:** Design Complete, Ready for Implementation  
**Nächste Schritte:** Phase 1 - Settings UI erweitern
- [ ] Tool Call Parsing implementieren
- [ ] Kanban-Tools verknüpfen mit `boardStore`-Methoden
- [ ] **CRITICAL:** IMMER über `boardStore` gehen (nicht `board` direkt!)
- [ ] Error Handling für Tool Execution

**Acceptance Criteria:**
- `addCard` Tool Call erstellt Karte auf Board
- `addColumn` Tool Call erstellt neue Spalte
- `addComment` Tool Call fügt Kommentar hinzu
- UI aktualisiert sich sofort (via `triggerUpdate()` Kette)
- Tool Execution Fehler werden im Chat angezeigt

**Test Cases:**
```typescript
// User Input: "Erstelle eine Spalte 'Einstieg'"
// Expected: Neue Spalte wird erstellt + Bestätigung im Chat

// User Input: "Füge eine Karte 'Brainstorming' zur Spalte 'Einstieg' hinzu"
// Expected: Neue Karte wird erstellt + Bestätigung im Chat
```

---

### Phase 4: Chat UI

- [ ] `CardSidebar.svelte` erweitern mit Chat-Interface
- [ ] Message-Rendering (User vs Assistant)
- [ ] Loading States (`isProcessing`)
- [ ] Textarea mit Enter-to-Send
- [ ] Tool Call Anzeige (z.B. "🔧 Aktion: addCard")

**Acceptance Criteria:**
- Chat-Verlauf wird korrekt angezeigt
- Neue Nachrichten erscheinen sofort (Svelte 5 Reaktivität)
- Loading Spinner während LLM Processing
- Tool Calls werden visuell hervorgehoben

---

### Phase 5: MCP-Integration

- [ ] `MCPClient.ts` implementieren
- [ ] MCP Tool Calls in AIController integrieren
- [ ] MCP-Ergebnisse optional als Karten anlegen
- [ ] Error Handling für MCP-Requests

**Acceptance Criteria:**
- MCP-Server kann aufgerufen werden
- Ergebnisse werden im Chat angezeigt
- Optional: Ergebnisse als Karte auf Board erstellen

---

### Phase 6: Testing & Polish

- [ ] Unit Tests für AIController
- [ ] Integration Tests (LLM → Tool → Board)
- [ ] E2E Tests mit Playwright
- [ ] Performance Optimierung (Token-Limit, Caching)
- [ ] UI/UX Polish (Animationen, Icons, etc.)

**Acceptance Criteria:**
- 80% Test Coverage
- Alle Critical Paths getestet
- Performance: < 2s für Tool Execution
- UI ist flüssig und responsiv

---

### Zeitplan (Übersicht)

- Phase 1: Foundation
- Phase 2: AIController Core
- Phase 3: Tool Execution
- Phase 4: Chat UI
- Phase 5: MCP-Integration
- Phase 6: Testing & Polish

(Konkrete Zeitangaben wurden entfernt; Zeitplanung erfolgt projektintern.)
## V. Implementierungs-Schritte (Roadmap)

1.  **Phase 1: Datenmodell & Konfiguration**
    *   [ ] `SettingsStore` um `aiSettings` erweitern.
    *   [ ] UI in `SettingsDialog.svelte` erstellen, um die KI-Einstellungen zu verwalten.
    *   [ ] Sensible Daten wie API-Keys sicher handhaben (z.B. nur im Session-Speicher halten).

2.  **Phase 2: `AIController` & Chat-Grundgerüst**
    *   [ ] Neue Klasse `AIController.ts` erstellen.
    *   [ ] Grundlegendes Chat-Interface in `CardSidebar.svelte` implementieren (Nachrichtenanzeige, Input-Feld).
    *   [ ] `AIController` mit dem Chat-Interface verbinden, um Nachrichten zu senden und zu empfangen.

3.  **Phase 3: Tool-Integration (Kanban)**
    *   [ ] Definition der internen Kanban-Tools als JSON-Schema.
    *   [ ] Logik im `AIController` implementieren, um `boardStore`-Methoden basierend auf der LLM-Antwort aufzurufen.
    *   [ ] Den System-Prompt dynamisch mit den Tool-Definitionen erstellen.

4.  **Phase 4: MCP-Integration**
    *   [ ] `MCPClient.ts` implementieren.
    *   [ ] Logik im `AIController` erweitern, um externe MCP-Befehle auszuführen.
    *   [ ] Den System-Prompt um die MCP-Tools erweitern.

5.  **Phase 5: Testing & Verfeinerung**
    *   [ ] Testen der Intent-Erkennung mit verschiedenen Prompts.
    *   [ ] Fehlerbehandlung für API-Anfragen und Tool-Aufrufe implementieren.
    *   [ ] UI/UX für die Anzeige von Ladezuständen und Fehlermeldungen im Chat verbessern.

---

## VI. Referenzen & Cross-Links

*   **State Management:** Die Interaktion mit dem Board muss über den `boardStore` erfolgen. Siehe [`ARCHITECTURE/STORES.md`](./ARCHITECTURE/STORES.md).
*   **Datenmodell:** Die Tool-Parameter (`cardId`, `columnId`) beziehen sich auf die IDs im `BoardModel`. Siehe [`AGENTS.md`](../AGENTS.md).
*   **UI-Komponenten:** Die Einstellungs-UI muss den Regeln in [`ARCHITECTURE/UX-RULES.md`](./ARCHITECTURE/UX-RULES.md) folgen.
*   **Konfiguration:** Die Speicherung der Einstellungen erfolgt über den `SettingsStore`. Siehe [`ARCHITECTURE/SETTINGSSTORE.md`](./ARCHITECTURE/SETTINGSSTORE.md).
