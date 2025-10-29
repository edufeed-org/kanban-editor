# ChatBotStore Dokumentation

**Datei:** `src/lib/stores/chatBotStore.svelte.ts` *(noch zu erstellen)*  
**Technologie:** Svelte 5 Runes + OpenAI-kompatible API  
**Zweck:** KI-Chatbot für Board-Management & Aufgaben-Splitting

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Architektur](#architektur)
3. [Message-History](#message-history)
4. [KI-Kontext](#ki-kontext)
5. [AI-Actions](#ai-actions)
6. [LLM-Integration](#llm-integration)
7. [Implementation Guide](#implementation-guide)

---

## Übersicht

Der `ChatBotStore` verwaltet die **KI-Chatbot-Interaktion** für intelligente Board-Verwaltung. Er nutzt die `Chat`-Klasse aus `BoardModel.ts` und erweitert sie mit LLM-API-Integration.

### Features

- ✅ **Message-History** — Persistiert in localStorage
- ✅ **Board-Context** — Automatischer Kontext aus aktuellem Board
- ✅ **Card-Context** — Fokussierter Kontext für Card-Operations
- ✅ **AI-Actions** — `split_card`, `add_card`, `move_card`, `update_card`
- ✅ **OpenAI-kompatibel** — Unterstützt Ollama, OpenAI, etc.
- ✅ **Streaming** — (Optional) Token-by-Token Responses

### Status

⚠️ **TODO:** Diese Komponente ist noch **nicht vollständig implementiert** (Phase 3.1-3.3 - siehe ROADMAP.md).

**Partial Implementation:** `Chat`-Klasse in `BoardModel.ts` existiert bereits (siehe AGENTS.md Section V).

---

## Architektur

### Komponenten-Diagramm

```
┌────────────────────────────────────────────────────┐
│ UI-Komponente (ChatBot.svelte)                     │
│ ├─ Input: User Message                            │
│ ├─ Output: Chat History                           │
│ └─ Actions: Execute AI-Actions                    │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ ChatBotStore (chatBotStore.svelte.ts)             │
│ ├─ messages = $state<ChatMessage[]>([...])        │
│ ├─ isLoading = $state<boolean>(false)             │
│ ├─ sendMessage() → LLM API                        │
│ ├─ processAIAction() → BoardStore                 │
│ └─ Board-Kontext via boardStore                   │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ Chat-Klasse (BoardModel.ts)                       │
│ ├─ messages: ChatMessage[]                        │
│ ├─ addMessage()                                   │
│ ├─ sendPromptToAI() → Kontext sammeln             │
│ └─ processAIAction() → Board manipulieren         │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ LLM API (Ollama, OpenAI, etc.)                    │
│ ├─ POST /v1/chat/completions                      │
│ └─ Response: AI-Generated Actions                 │
└────────────────────────────────────────────────────┘
```

### Datenfluss

```
User: "Teile diese Karte in Frontend/Backend auf"
    ↓
ChatBotStore.sendMessage(prompt, cardContext)
    ↓
1. Board-Kontext sammeln (getContextData)
2. Card-Kontext sammeln (card.getContextData)
3. LLM API aufrufen (mit Kontext)
    ↓
LLM antwortet: { action: 'split_card', newCards: [...] }
    ↓
ChatBotStore.processAIAction(action)
    ↓
Chat.processAIAction() → BoardStore
    ↓
BoardStore.splitCard() → Card gelöscht, neue Karten erstellt
    ↓
UI aktualisiert automatisch (via $derived)
```

---

## Message-History

### ChatMessage-Interface

```typescript
export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    type: 'message' | 'action';
    timestamp: string;  // ISO 8601
}
```

**Aus `BoardModel.ts`:**

```typescript
export class Chat {
    public messages: ChatMessage[] = [];
    
    addMessage(
        text: string,
        sender: 'user' | 'ai',
        type: 'message' | 'action' = 'message'
    ): void {
        const message: ChatMessage = {
            id: generateDTag('comment'),
            text,
            sender,
            type,
            timestamp: generateTimestamp()
        };
        
        // ✅ IMPORTANT: Array Reassignment für Svelte 5 Reaktivität
        this.messages = [...this.messages, message];
    }
}
```

**REGEL 1:** Messages MÜSSEN via `addMessage()` hinzugefügt werden (Array Reassignment!).

### ChatBotStore Implementation

```typescript
// src/lib/stores/chatBotStore.svelte.ts

import { Chat } from '$lib/classes/BoardModel';
import { boardStore } from './kanbanStore.svelte';

export class ChatBotStore {
    // Reaktive States
    private chat = $state<Chat | null>(null);
    public isLoading = $state(false);
    public errorMessage = $state<string | null>(null);
    
    // Berechnete Werte
    public messages = $derived(this.chat?.messages || []);
    public hasMessages = $derived(this.messages.length > 0);
    
    constructor() {
        this.initializeChat();
    }
    
    private initializeChat(): void {
        // Chat-Instanz mit aktuellem Board
        this.chat = new Chat(boardStore.data);
    }
    
    /**
     * Sende Nachricht an KI und verarbeite Antwort
     */
    public async sendMessage(
        prompt: string,
        context?: 'board' | { cardId: string } | { columnId: string }
    ): Promise<void> {
        if (!this.chat) {
            throw new Error('Chat not initialized');
        }
        
        this.isLoading = true;
        this.errorMessage = null;
        
        try {
            // 1. User-Nachricht hinzufügen
            this.chat.addMessage(prompt, 'user');
            
            // 2. Kontext sammeln
            const contextData = this.gatherContext(context);
            
            // 3. LLM API aufrufen
            const response = await this.callLLM(prompt, contextData);
            
            // 4. AI-Antwort hinzufügen
            this.chat.addMessage(response.text, 'ai');
            
            // 5. Falls AI-Action: Ausführen
            if (response.action) {
                await this.processAIAction(response.action);
            }
            
        } catch (error) {
            this.errorMessage = error.message;
            console.error('❌ Chat error:', error);
        } finally {
            this.isLoading = false;
        }
    }
}
```

**REGEL 2:** `sendMessage()` ist **async** (wegen LLM API-Call).

---

## KI-Kontext

### Kontext-Sammlung

```typescript
/**
 * Sammelt relevanten Board/Card/Column-Kontext für die KI
 */
private gatherContext(
    context?: 'board' | { cardId: string } | { columnId: string }
): any {
    const board = boardStore.data;
    
    if (!context || context === 'board') {
        // Vollständiger Board-Kontext
        return {
            type: 'board',
            board: board.getContextData(false)  // ← Ohne volle Cards (zu groß)
        };
    }
    
    if ('cardId' in context) {
        // Card-fokussierter Kontext
        const result = board.findCardAndColumn(context.cardId);
        if (!result) {
            throw new Error('Card not found');
        }
        
        return {
            type: 'card',
            card: result.card.getContextData(),
            column: { id: result.column.id, name: result.column.name },
            board: { id: board.id, name: board.name }
        };
    }
    
    if ('columnId' in context) {
        // Column-fokussierter Kontext
        const column = board.findColumn(context.columnId);
        if (!column) {
            throw new Error('Column not found');
        }
        
        return {
            type: 'column',
            column: column.getContextData(false),  // ← Nur Card-IDs + headings
            board: { id: board.id, name: board.name }
        };
    }
    
    throw new Error('Invalid context');
}
```

**REGEL 3:** Board-Kontext wird **ohne volle Cards** gesendet (Token-Limit!).

### Kontext-Größe

| Context-Type | Payload-Größe | Use-Case |
|--------------|---------------|----------|
| `board` | ~5-10 KB | Generelle Board-Fragen |
| `card` | ~1-2 KB | Card-spezifische Aktionen |
| `column` | ~2-5 KB | Column-Operations |

**REGEL 4:** Kontext MUSS minimiert werden (LLM-Token-Limits!).

---

## AI-Actions

### AIAction-Interface

```typescript
export interface AIAction {
    type: 'add_card' | 'update_card' | 'move_card' | 'split_card';
    [key: string]: any;
}
```

### Action-Processing

**Aus `BoardModel.ts`:**

```typescript
export class Chat {
    processAIAction(action: AIAction): void {
        this.addMessage(`AI Action: ${action.type}`, 'ai', 'action');
        
        try {
            switch (action.type) {
                case 'split_card': {
                    const column = this.board.findColumn(action.columnId);
                    if (!column) throw new Error('Column not found');
                    
                    column.splitCard(action.sourceCardId, action.newCards);
                    console.log('✅ Card split successfully');
                    break;
                }
                
                case 'add_card': {
                    const column = this.board.findColumn(action.columnId);
                    if (!column) throw new Error('Column not found');
                    
                    column.addCard(action.cardProps);
                    console.log('✅ Card added');
                    break;
                }
                
                case 'move_card': {
                    this.board.moveCard(
                        action.cardId,
                        action.fromColumnId,
                        action.toColumnId
                    );
                    console.log('✅ Card moved');
                    break;
                }
                
                case 'update_card': {
                    const result = this.board.findCardAndColumn(action.cardId);
                    if (!result) throw new Error('Card not found');
                    
                    result.card.update(action.updates);
                    console.log('✅ Card updated');
                    break;
                }
                
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
        } catch (error) {
            console.error('❌ Action failed:', error);
            this.addMessage(`Error: ${error.message}`, 'ai');
        }
    }
}
```

**REGEL 5:** AI-Actions werden **immer geloggt** (als Chat-Message vom Typ `action`).

### ChatBotStore Integration

```typescript
/**
 * Verarbeitet AI-Action via BoardStore
 */
private async processAIAction(action: AIAction): Promise<void> {
    if (!this.chat) return;
    
    try {
        // Chat-Klasse verarbeitet Action
        this.chat.processAIAction(action);
        
        // BoardStore wird automatisch aktualisiert (weil chat.board === boardStore.board)
        // ABER: triggerUpdate() muss manuell aufgerufen werden!
        boardStore.triggerUpdate();
        
        console.log('✅ AI-Action executed:', action.type);
    } catch (error) {
        console.error('❌ AI-Action failed:', error);
        throw error;
    }
}
```

**REGEL 6:** Nach AI-Action MUSS `boardStore.triggerUpdate()` aufgerufen werden!

---

## LLM-Integration

### OpenAI-kompatible API

```typescript
/**
 * Ruft LLM API auf (OpenAI-kompatibel)
 */
private async callLLM(
    prompt: string,
    context: any
): Promise<{ text: string; action?: AIAction }> {
    const settings = settingsStore.settings;
    
    // System Prompt mit Kontext
    const systemPrompt = `
${settings.llmSystemPrompt}

Board-Kontext:
${JSON.stringify(context, null, 2)}

Du kannst folgende Aktionen ausführen:
- split_card: Teile eine Karte in mehrere auf
- add_card: Füge eine neue Karte hinzu
- move_card: Verschiebe eine Karte zwischen Spalten
- update_card: Aktualisiere eine existierende Karte

Antworte im JSON-Format:
{
  "text": "Deine Antwort an den User",
  "action": { "type": "...", ... } // Optional
}
`;
    
    // API-Request
    const response = await fetch(`${settings.llmBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': settings.llmApiKey ? `Bearer ${settings.llmApiKey}` : ''
        },
        body: JSON.stringify({
            model: settings.llmModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
        })
    });
    
    if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON Response
    try {
        const parsed = JSON.parse(content);
        return {
            text: parsed.text,
            action: parsed.action
        };
    } catch {
        // Fallback: Plain-Text Antwort (kein JSON)
        return { text: content };
    }
}
```

**REGEL 7:** LLM MUSS im OpenAI-kompatiblen Format antworten.

### Streaming-Support (Optional)

```typescript
/**
 * Streaming-Version (Token-by-Token)
 */
private async callLLMStreaming(
    prompt: string,
    context: any,
    onToken: (token: string) => void
): Promise<void> {
    const response = await fetch(`${settings.llmBaseUrl}/chat/completions`, {
        // ... same headers
        body: JSON.stringify({
            // ... same body
            stream: true  // ← Streaming aktivieren
        })
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';
    
    while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                    const parsed = JSON.parse(data);
                    const token = parsed.choices[0].delta.content;
                    if (token) {
                        buffer += token;
                        onToken(token);  // ← Callback für UI-Update
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        }
    }
    
    // Buffer enthält vollständige Antwort
    return buffer;
}
```

**REGEL 8:** Streaming ist **optional** (für bessere UX).

---

## Implementation Guide

### Schritt 1: Datei erstellen

```bash
touch src/lib/stores/chatBotStore.svelte.ts
```

### Schritt 2: Basic Implementation

```typescript
// src/lib/stores/chatBotStore.svelte.ts

import { Chat, type AIAction } from '$lib/classes/BoardModel';
import { boardStore } from './kanbanStore.svelte';
import { settingsStore } from './settingsStore.svelte';

export class ChatBotStore {
    private chat = $state<Chat | null>(null);
    public isLoading = $state(false);
    public errorMessage = $state<string | null>(null);
    
    public messages = $derived(this.chat?.messages || []);
    public hasMessages = $derived(this.messages.length > 0);
    
    constructor() {
        this.initializeChat();
        this.loadHistory();
    }
    
    private initializeChat(): void {
        this.chat = new Chat(boardStore.data);
    }
    
    private loadHistory(): void {
        // TODO: Load from localStorage
    }
    
    private saveHistory(): void {
        // TODO: Save to localStorage
    }
    
    public async sendMessage(
        prompt: string,
        context?: any
    ): Promise<void> {
        // Implementation wie oben...
    }
    
    private gatherContext(context?: any): any {
        // Implementation wie oben...
    }
    
    private async callLLM(prompt: string, context: any): Promise<any> {
        // Implementation wie oben...
    }
    
    private async processAIAction(action: AIAction): Promise<void> {
        // Implementation wie oben...
    }
    
    public clearHistory(): void {
        if (!this.chat) return;
        this.chat.messages = [];
        this.saveHistory();
    }
}

export const chatBotStore = new ChatBotStore();
```

### Schritt 3: UI-Integration

```svelte
<!-- src/lib/components/ChatBot.svelte -->
<script lang="ts">
    import { chatBotStore } from '$lib/stores/chatBotStore.svelte';
    
    let messages = $derived(chatBotStore.messages);
    let isLoading = $derived(chatBotStore.isLoading);
    let errorMessage = $derived(chatBotStore.errorMessage);
    
    let input = $state('');
    
    async function handleSend() {
        if (!input.trim()) return;
        
        await chatBotStore.sendMessage(input);
        input = '';
    }
</script>

<div class="chat-container">
    <!-- Message History -->
    <div class="messages">
        {#each messages as message}
            <div class="message" class:user={message.sender === 'user'} class:ai={message.sender === 'ai'}>
                <div class="sender">{message.sender === 'user' ? 'You' : 'AI'}</div>
                <div class="text">{message.text}</div>
                {#if message.type === 'action'}
                    <span class="badge">Action</span>
                {/if}
            </div>
        {/each}
        
        {#if isLoading}
            <div class="loading">AI is thinking...</div>
        {/if}
        
        {#if errorMessage}
            <div class="error">{errorMessage}</div>
        {/if}
    </div>
    
    <!-- Input -->
    <div class="input-container">
        <input
            bind:value={input}
            placeholder="Ask the AI..."
            onkeydown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
        />
        <button onclick={handleSend} disabled={isLoading || !input.trim()}>
            Send
        </button>
    </div>
</div>
```

### Schritt 4: Sidebar Integration

```svelte
<!-- In RightSidebar.svelte -->
<script lang="ts">
    import ChatBot from '$lib/components/ChatBot.svelte';
</script>

<div class="sidebar-right">
    <h3>AI Assistant</h3>
    <ChatBot />
</div>
```

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | Messages via addMessage() hinzufügen | 🔴 CRITICAL |
| **REGEL 2** | sendMessage() ist async | 🔴 CRITICAL |
| **REGEL 3** | Board-Kontext ohne volle Cards | 🟠 HIGH |
| **REGEL 4** | Kontext minimieren (Token-Limits!) | 🟠 HIGH |
| **REGEL 5** | AI-Actions werden geloggt | 🟡 MEDIUM |
| **REGEL 6** | triggerUpdate() nach AI-Action | 🔴 CRITICAL |
| **REGEL 7** | LLM antwortet im OpenAI-Format | 🔴 CRITICAL |

**Status:** ⏳ Phase 3.1-3.3 (ROADMAP.md) — Noch zu implementieren!
