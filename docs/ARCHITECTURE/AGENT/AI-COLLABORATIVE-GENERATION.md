# AI-Collaborative Board Generation (ChatStore + ChatBotStore Pattern)

**Datum:** 3. November 2025  
**Phase:** 3.0 - 3.3 (KI-Integration)  
**Status:** 🔄 DESIGN (ChatStore ✅, ChatBotStore ⏳)  
**Pattern:** GitHub Copilot-ähnliche Collaborative Board Building

---

## 📋 Übersicht

Das Kanban-Board nutzt einen **3-stufigen Workflow** für die AI-gesteuerte Unterrichtsplanung:

```
┌──────────────────────────────────────────────────────────────────┐
│ STUFE 1: DISCOVERY & CONTEXT                                     │
│ User beschreibt Anforderung im Chat                              │
│ AI speichert: Requirements, Preferences, Context                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STUFE 2: GENERATION & SUGGESTION (GitHub Copilot Pattern)       │
│ AI schlägt Board-Struktur vor (ohne zu speichern!)              │
│ User kann iterativ anpassen: "Füge X hinzu, entferne Y"         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ STUFE 3: EXECUTION & PERSISTENCE                                 │
│ User bestätigt: "Ja, erstelle das jetzt!"                       │
│ AI erstellt Spalten + Karten und speichert persistent            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Die Rolle der Stores

### ChatStore (✅ Implementiert)

**Zweck:** Speichern der Konversation und Kontextinformationen

```typescript
// User schreibt im Chat
chatStore.addMessage(
    "Ich muss eine Photosynthese-Stunde planen. Klasse 8, 45 Minuten.",
    'user'
);

// AI antwortet und speichert Kontext automatisch
chatStore.addMemory(
    'Photosynthese',
    'context',
    10,
    'user-requirement'
);

chatStore.addMemory(
    'Klasse 8, 45 Minuten',
    'preference',
    8,
    'user-requirement'
);

// Später: AI kann alle Memories abrufen für Kontext
const context = chatStore.getAIContext();
// → { messages: [...], memories: [...], summaries: [...] }
```

**Storage:** `localStorage` mit Key `chat-session-${boardId}`  
**Persistierung:** Automatisch nach jedem `addMemory()` / `addMessage()`

### ChatBotStore (⏳ Phase 3.2-3.3)

**Zweck:** Generierung von Board-Struktur OHNE sofort zu speichern

```typescript
// Schritt 1: LLM-Vorschlag generieren (noch nichts gespeichert!)
const suggestion = await chatBotStore.generateBoardStructure(
    "Erstelle eine Photosynthese-Stunde für Klasse 8 (45 Min)"
);

// Rückgabe:
{
    suggestedColumns: [
        { name: 'Lernziele', color: 'blue', order: 1 },
        { name: 'Einstieg (5 min)', color: 'green', order: 2 },
        { name: 'Theorie (15 min)', color: 'yellow', order: 3 },
        { name: 'Experiment (20 min)', color: 'orange', order: 4 },
        { name: 'Diskussion (5 min)', color: 'purple', order: 5 },
        { name: 'Hausaufgaben', color: 'gray', order: 6 }
    ],
    suggestedCards: [
        { columnId: 'lernziele', heading: 'Schüler verstehen Photosynthese', ... },
        { columnId: 'einstieg', heading: 'Warum sind Pflanzen grün?', ... },
        // ... mehr Karten ...
    ],
    reasoning: "Struktur mit klassischen Phasen: Einstieg → Theorie → Praxis → Diskussion"
}
```

**Wichtig:** Zu diesem Zeitpunkt ist **NICHTS im Board geändert**!

### BoardStore (✅ Existiert)

**Zweck:** Tatsächliche Manipulation des Boards

```typescript
// Nur wenn User bestätigt:
await chatBotStore.applyBoardStructure(
    suggestion.suggestedColumns,
    suggestion.suggestedCards
);

// Das ruft intern auf:
for (const col of columns) {
    boardStore.createColumn(col.name, col.color);  // ← Echte Aktion!
}

for (const card of cards) {
    boardStore.createCard(card.columnId, card.heading, card.content);
}

// Und speichert:
chatStore.addMessage(
    `Ich habe ${columns.length} Spalten und ${cards.length} Karten erstellt.`,
    'assistant'
);
```

---

## 💬 Praktisches Beispiel: Unterrichtsplanung

### Szenario: Englisch-Unterricht Shakespeare's Hamlet

#### Phase 1: Discovery (User + ChatStore)

```
User: "Ich plane einen Englisch-Unterricht zu Shakespeares Hamlet. 
        90 Minuten, Gymnasium Klasse 11. Ich will Kontext, 
        Akt-Analyse, Themen und Spracharbeit abdecken."

[ChatStore speichert]
✓ Memory: { type: 'context', content: 'Shakespeares Hamlet' }
✓ Memory: { type: 'preference', content: 'Gymnasium Klasse 11' }
✓ Memory: { type: 'preference', content: '90 Minuten' }
✓ Memory: { type: 'context', content: 'Kontext, Akt-Analyse, Themen, Spracharbeit' }
```

#### Phase 2: Suggestion (ChatBotStore generiert Vorschlag)

```
User klickt: [Generiere Board-Struktur mit AI]

ChatBotStore arbeitet:
1. Ruft chatStore.getAIContext() auf
   → { messages: [User-Nachricht], memories: [4 Memories], summaries: [] }

2. Sendet an LLM (z.B. Ollama/OpenAI):
   {
     "model": "llama2",
     "messages": [
       {
         "role": "system",
         "content": "Du bist Experte für Unterrichtsplanung.
                     Generiere Spalten und Karten mit JSON-Format."
       },
       {
         "role": "user",
         "content": "Erstelle eine 90-Minuten-Stunde zu Hamlet für Klasse 11:
                    Kontext: Shakespeares Hamlet
                    Zielgruppe: Gymnasium Klasse 11
                    Inhalte: Kontext, Akt-Analyse, Themen, Spracharbeit
                    
                    Gib folgendes JSON zurück:
                    {
                      'columns': [
                        { 'name': string, 'color': string, 'order': number }
                      ],
                      'cards': [
                        { 'columnId': string, 'heading': string, 'content': string }
                      ]
                    }"
       }
     ]
   }

3. LLM antwortet:
   {
     "columns": [
       { "name": "Lernziele", "color": "blue", "order": 1 },
       { "name": "Historischer Kontext", "color": "green", "order": 2 },
       { "name": "Akt-Analyse", "color": "yellow", "order": 3 },
       { "name": "Thematische Diskussion", "color": "orange", "order": 4 },
       { "name": "Spracharbeit", "color": "purple", "order": 5 },
       { "name": "Hausaufgaben", "color": "gray", "order": 6 }
     ],
     "cards": [
       { "columnId": "lernziele", "heading": "Schüler kennen Hamlet und dessen Konflikt", ... },
       { "columnId": "historischer-kontext", "heading": "Shakespeares Elisabethanische Zeit", ... },
       // ... viele mehr ...
     ]
   }

4. ChatBotStore zeigt Vorschlag in UI:
   ✓ 6 Spalten vorgeschlagen
   ✓ ~25 Karten vorgeschlagen
   [Anlegen] [Änderungen vornehmen] [Abbrechen]
```

#### Phase 2b: User-Feedback (Iterative Verbesserung)

```
User sieht Vorschlag und antwortet im Chat:
"Das sieht gut aus, aber kombiniere 'Thematische Diskussion' 
 und 'Spracharbeit' zu einer Spalte 'Analyse & Diskussion',
 und füge noch 'Klausur-Vorbereitung' hinzu."

ChatBotStore macht neuen Vorschlag:
1. Nimmt alte Vorschlag + User-Feedback
2. Sendet neuen Request an LLM:
   "Basierend auf meinem vorherigen Vorschlag:
    - Merge 'Thematische Diskussion' + 'Spracharbeit' → 'Analyse & Diskussion'
    - Füge neue Spalte 'Klausur-Vorbereitung' hinzu
    - Behalte alles andere bei
    
    Gib aktualisierte Struktur zurück"
    
3. LLM antwortet mit neuem Struktur-Vorschlag

4. ChatBotStore zeigt neuen Vorschlag:
   ✓ 6 Spalten (angepasst)
   ✓ ~28 Karten (neu organisiert)
   [Anlegen] [Weitere Änderungen] [Abbrechen]

User: "Perfekt! Jetzt anlegen."
```

#### Phase 3: Execution (BoardStore speichert)

```
ChatBotStore.applyBoardStructure(finalColumns, finalCards):

1. Für jede Spalte:
   boardStore.createColumn('Lernziele', 'blue')
   boardStore.createColumn('Historischer Kontext', 'green')
   // ... weitere Spalten ...

2. Für jede Karte in jeder Spalte:
   boardStore.createCard('lernziele', 'Schüler kennen Hamlet...', '...')
   boardStore.createCard('historischer-kontext', 'Elisabethanische Zeit', '...')
   // ... weitere Karten ...

3. ChatStore speichert die Completion:
   chatStore.addMessage(
       "✓ Unterrichtsstunde erstellt! 6 Spalten, 28 Karten.",
       'assistant'
   )

4. User sieht:
   ✓ Spalten und Karten sind jetzt im Board sichtbar
   ✓ Konversation dokumentiert die Erstellung
   ✓ Alles in localStorage persistiert
   ✓ Bereit zum Unterrichten! 🎉
```

---

## 🔧 Technical Design

### ChatStore API (✅ Existiert)

```typescript
export class ChatStore {
    // Session Management
    public loadSession(boardId: string): void
    public deleteSession(boardId: string): void
    public listAllSessions(): SessionInfo[]

    // Messages (Konversation)
    public addMessage(content: string, role: 'user' | 'assistant'): void
    public deleteMessage(messageId: string): void
    public clearMessages(): void

    // Memories (Kontext)
    public addMemory(
        content: string,
        type: 'entity' | 'preference' | 'fact' | 'context',
        importance: number,
        source: string
    ): void
    public searchMemories(query: string): MemoryProps[]
    public getTopMemories(limit?: number): MemoryProps[]

    // Summaries (Token-Sparen für lange Chats)
    public addSummary(
        messageRange: [number, number],
        summaryText: string,
        tokensSaved: number
    ): void

    // AI-Context
    public getAIContext(includeFullHistory?: boolean): {
        messages: MessageProps[];
        memories: MemoryProps[];
        summaries: any[];
    }
}
```

### ChatBotStore API (⏳ Phase 3.2-3.3, zu implementieren)

```typescript
export class ChatBotStore {
    /**
     * Generiert einen Board-Struktur-Vorschlag basierend auf User-Anforderung
     * ⚠️ Speichert NICHTS! Nur Vorschlag zurückgeben!
     */
    public async generateBoardStructure(userRequest: string): Promise<{
        suggestedColumns: ColumnProps[];
        suggestedCards: CardProps[];
        reasoning: string;
    }> {
        // 1. Kontext sammeln
        const context = chatStore.getAIContext();
        
        // 2. LLM API aufrufen (Ollama/OpenAI)
        const response = await fetch(llmEndpoint, {
            method: 'POST',
            body: JSON.stringify({
                model: 'llama2',
                messages: [
                    {
                        role: 'system',
                        content: `Du bist Experte für Unterrichtsplanung.
                                 Antworte IMMER mit gültigem JSON:
                                 {
                                   "columns": [...],
                                   "cards": [...],
                                   "reasoning": "..."
                                 }`
                    },
                    {
                        role: 'user',
                        content: userRequest + '\n\nKontext: ' + JSON.stringify(context)
                    }
                ]
            })
        });
        
        // 3. Parse LLM-Response
        const parsed = JSON.parse(response.choices[0].message.content);
        
        // 4. Gebe Vorschlag zurück (noch keine Persistierung!)
        return {
            suggestedColumns: parsed.columns,
            suggestedCards: parsed.cards,
            reasoning: parsed.reasoning
        };
    }

    /**
     * Wendet den generierten Vorschlag an (speichert tatsächlich!)
     * Ruft BoardStore auf um die Struktur zu erstellen
     */
    public async applyBoardStructure(
        columns: ColumnProps[],
        cards: CardProps[]
    ): Promise<void> {
        // 1. Spalten erstellen
        for (const col of columns) {
            boardStore.createColumn(col.name, col.color);
        }
        
        // 2. Karten erstellen
        for (const card of cards) {
            boardStore.createCard(
                card.columnId,
                card.heading,
                card.content
            );
        }
        
        // 3. ChatStore aktualisieren (Abschluss dokumentieren)
        chatStore.addMessage(
            `✓ Ich habe ${columns.length} Spalten und ${cards.length} Karten erstellt!`,
            'assistant'
        );
    }

    /**
     * Prozessiert AI-Actions vom Board (zukünftig)
     * z.B. split_card, add_card, move_card, delete_card, add_column, etc.
     */
    public async processAIAction(action: AIAction): Promise<void> {
        switch (action.type) {
            // Card Operations
            case 'add_card':
                await boardStore.createCard(action.columnId, action.heading);
                break;
            case 'split_card':
                await boardStore.splitCard(action.cardId, action.newCards);
                break;
            case 'move_card':
                await boardStore.moveCard(action.cardId, action.fromColumnId, action.toColumnId);
                break;
            case 'update_card':
                await boardStore.editCard(action.cardId, action.updates);
                break;
            case 'delete_card':
                await boardStore.deleteCard(action.cardId);
                break;
            
            // Column Operations
            case 'add_column':
                await boardStore.addColumn(action.columnProps);
                break;
            case 'update_column':
                await boardStore.updateColumn(action.columnId, action.updates);
                break;
            case 'move_column':
                await boardStore.moveColumn(action.columnId, action.toPosition);
                break;
            case 'delete_column':
                await boardStore.deleteColumn(action.columnId);
                break;
            
            // Batch Operations
            case 'reorder_cards':
                await boardStore.reorderCards(action.columnId, action.cardIds);
                break;
            case 'reorder_columns':
                await boardStore.reorderColumns(action.columnIds);
                break;
            
            // Board Operations
            case 'update_board':
                await boardStore.updateBoard(action.updates);
                break;
            
            default:
                console.error(`Unknown action type: ${action.type}`);
        }
    }
}
```

### Datenfluss-Diagramm

```
User Input
    ↓
ChatStore.addMessage()
    ↓ (speichert Konversation)
ChatStore speichert auch Memories automatisch
    ↓
User klickt: [Generiere Struktur]
    ↓
ChatBotStore.generateBoardStructure()
    ├─ chatStore.getAIContext() ← Kontext holen!
    ├─ LLM API aufrufen
    └─ Vorschlag zurückgeben (OHNE zu speichern!)
    ↓
UI zeigt Vorschlag: [Anlegen] [Ändern] [Abbrechen]
    ↓
User: "Ja, anlegen"
    ↓
ChatBotStore.applyBoardStructure()
    ├─ BoardStore.createColumn() ← Tatsächlich speichern!
    ├─ BoardStore.createCard() ← Tatsächlich speichern!
    └─ ChatStore.addMessage() ← Dokumentieren
    ↓
localStorage aktualisiert
    ↓
UI zeigt neues Board mit Spalten + Karten
```

---

## 🎯 Separation of Concerns

| Store | Verantwortung | Darf nicht |
|-------|---------------|----------|
| **ChatStore** | ✅ Konversation speichern | ❌ Board ändern |
| **ChatStore** | ✅ Memories speichern | ❌ Spalten/Karten erstellen |
| **ChatBotStore** | ✅ Vorschläge generieren | ❌ Permanent speichern ohne User-Bestätigung |
| **ChatBotStore** | ✅ User-Feedback einarbeiten | ❌ Direkt Board ändern |
| **BoardStore** | ✅ Board manipulieren | ❌ Konversation speichern (nur dokumentieren) |
| **BoardStore** | ✅ Spalten/Karten erstellen | ❌ Vorschläge generieren |

---

## 📋 Implementation Timeline

### Phase 3.0 ✅ (DONE)
- ✅ ChatStore vollständig implementiert
- ✅ Message-History speichern
- ✅ Memory-System speichern
- ✅ 23/23 Tests passing

### Phase 3.1 ⏳ (TODO - 5 Tage)
- ⏳ LLM-Integration (Ollama/OpenAI API)
- ⏳ OpenAI-kompatible Endpoints
- ⏳ Error-Handling für API-Fehler
- ⏳ UI: Chatbot-Interface (Input, Output, Loading-States)

### Phase 3.2 ⏳ (TODO - 10 Tage)
- ⏳ ChatBotStore implementieren
- ⏳ `generateBoardStructure()` Methode
- ⏳ `applyBoardStructure()` Methode
- ⏳ UI: Vorschlags-Dialog mit Preview
- ⏳ Tests für ChatBotStore

### Phase 3.3 ⏳ (TODO - 8 Tage)
- ⏳ AI-Actions implementieren (11 Action-Types):
  - **Card Operations:** add_card, update_card, move_card, split_card, delete_card
  - **Column Operations:** add_column, update_column, move_column, delete_column
  - **Batch Operations:** reorder_cards, reorder_columns
- ⏳ `processAIAction()` Methode mit vollständigem Switch
- ⏳ Real-time Board-Manipulation via AI
- ⏳ Tests für alle AI-Actions

---

## 📚 Abhängigkeiten

| Abhängigkeit | Status | Wo dokumentiert |
|--------------|--------|-----------------|
| ChatStore API | ✅ DONE | `STORES/CHATSTORE.md` |
| BoardStore API | ✅ DONE | `STORES/BOARDSTORE.md` |
| Memory System | ✅ DONE | `ChatModel.ts` |
| LLM Integration | ⏳ Phase 3.1 | `LLM-INTEGRATION.md` (zu erstellen) |
| UI Components | ⏳ Phase 3.1 | `CHATBOT-UI.md` (zu erstellen) |

---

## 💡 Best Practices

### 1. Niemals direkt Board ändern während Generierung

```typescript
// ❌ FALSCH
public async generateBoardStructure() {
    // ... generieren ...
    boardStore.createColumn('Test');  // ❌ User hat nicht bestätigt!
}

// ✅ RICHTIG
public async generateBoardStructure() {
    // ... generieren ...
    return {
        suggestedColumns: [...],      // ✅ Nur zurückgeben
        suggestedCards: [...]
    };
}
```

### 2. Immer User-Kontext nutzen

```typescript
// ✅ RICHTIG
const context = chatStore.getAIContext();
const userPreferences = context.memories
    .filter(m => m.type === 'preference')
    .map(m => m.content);
    
// Sendet an LLM: "Berücksichtige diese Präferenzen: ..."
```

### 3. Feedback-Loops speichern

```typescript
// ✅ RICHTIG
chatStore.addMessage(
    "Anpassung: Füge Spalte X hinzu, entferne Spalte Y",
    'user'
);

// Nächster Vorschlag berücksichtigt dieses Feedback automatisch
const newSuggestion = await chatBotStore.generateBoardStructure(...);
```

---

## 🧪 Testing Strategy

### ChatStore Tests (✅ Existing)
```typescript
// Bereits vorhanden:
- addMemory() speichert mit localStorage
- searchMemories() aktualisiert lastAccessed
- getTopMemories() sortiert nach Importance
- getAIContext() kombiniert Messages + Memories + Summaries
```

### ChatBotStore Tests (⏳ Phase 3.2)
```typescript
// Zu implementieren:
- generateBoardStructure() gibt valides JSON zurück
- applyBoardStructure() ruft BoardStore auf
- Kontext-Mixing: ChatStore + Board-Daten
- LLM-Fehlerbehandlung (Timeout, API-Error)
- User-Feedback-Loops (Iterative Verbesserung)
```

### Integration Tests (⏳ Phase 3.3)
```typescript
// End-to-End Szenarien:
1. User schreibt Anforderung
2. ChatStore speichert Memories
3. ChatBotStore generiert Vorschlag
4. User gibt Feedback
5. ChatBotStore generiert neuen Vorschlag
6. User bestätigt
7. BoardStore erstellt tatsächliche Struktur
8. UI zeigt fertiges Board
```

---

## 📖 Verwandte Dokumente

- **[CHATSTORE.md](../STORES/CHATSTORE.md)** - ChatStore API-Referenz
- **[CHATBOTSTORE.md](../STORES/CHATBOTSTORE.md)** - ChatBotStore Design (noch nicht implementiert)
- **[BOARDSTORE.md](../STORES/BOARDSTORE.md)** - BoardStore API-Referenz
- **[AGENTS.md](../../AGENTS.md)** - Core Agent Spezifikation
- **[ROADMAP.md](../../COLLABORATION/ROADMAP.md)** - Phase 3 Timeline

---

**Letzte Änderung:** 3. November 2025  
**Status:** 🔄 DESIGN COMPLETE, PHASE 3.0 IMPLEMENTATION IN PROGRESS  
**Nächster Schritt:** Phase 3.1 - LLM Integration dokumentieren
