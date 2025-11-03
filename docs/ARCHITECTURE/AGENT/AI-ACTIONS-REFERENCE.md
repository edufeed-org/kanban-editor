# AI-Actions Reference Guide

**Datum:** 3. November 2025  
**Zweck:** Vollständige Referenz aller verfügbaren AI-Aktionen  
**Status:** ⏳ Phase 3.2-3.3 Implementation  
**Related:** [`AI-COLLABORATIVE-GENERATION.md`](./AI-COLLABORATIVE-GENERATION.md) | [`CHATBOTSTORE.md`](../STORES/CHATBOTSTORE.md)

---

## 📋 Übersicht: 11 AI-Action Typen

```
CARD OPERATIONS (5)
├─ add_card           → Neue Karte erstellen
├─ update_card        → Karten-Properties ändern
├─ move_card          → Karte zwischen Spalten verschieben
├─ split_card         → Karte aufteilen (1 → mehrere)
└─ delete_card        → Karte löschen ✅ NEU!

COLUMN OPERATIONS (4)
├─ add_column         → Neue Spalte hinzufügen ✅ NEU!
├─ update_column      → Spalten-Name/Farbe ändern ✅ NEU!
├─ move_column        → Spalte verschieben ✅ NEU!
└─ delete_column      → Spalte löschen ✅ NEU!

BATCH OPERATIONS (2)
├─ reorder_cards      → Karten in Spalte umsortieren ✅ NEU!
└─ reorder_columns    → Spalten neu ordnen ✅ NEU!
```

---

## 🎯 Detaillierte Action-Spezifikation

### CARD OPERATIONS

#### 1. `add_card`

Erstellt eine neue Karte in einer Spalte.

```typescript
{
    type: 'add_card',
    columnId: string,
    cardProps: {
        heading: string,
        content?: string,
        labels?: string[],
        color?: string
    }
}
```

**Beispiel:**
```json
{
    "type": "add_card",
    "columnId": "col-todo",
    "cardProps": {
        "heading": "Frontend: Login-Form implementieren",
        "content": "Mit Email/Password + OAuth2",
        "labels": ["frontend", "auth"]
    }
}
```

**Benutzer-Trigger:**
- "Füge eine neue Karte 'Backend-API testen' hinzu"
- "Erstelle drei neue Aufgaben für die Gruppe..."

---

#### 2. `update_card`

Aktualisiert eine bestehende Karte (Heading, Content, Labels, etc.).

```typescript
{
    type: 'update_card',
    cardId: string,
    updates: Partial<CardProps>
}
```

**Beispiel:**
```json
{
    "type": "update_card",
    "cardId": "card-123",
    "updates": {
        "heading": "Backend: API-Testing (UPDATED)",
        "color": "color-gradient-2"
    }
}
```

**Benutzer-Trigger:**
- "Ändere die Überschrift dieser Karte zu..."
- "Aktualisiere die Beschreibung"

---

#### 3. `move_card`

Verschiebt eine Karte von einer Spalte zu einer anderen.

```typescript
{
    type: 'move_card',
    cardId: string,
    fromColumnId: string,
    toColumnId: string
}
```

**Beispiel:**
```json
{
    "type": "move_card",
    "cardId": "card-456",
    "fromColumnId": "col-todo",
    "toColumnId": "col-in-progress"
}
```

**Benutzer-Trigger:**
- "Verschiebe diese Karte zu 'In Progress'"
- "Mark this as completed"

---

#### 4. `split_card`

Teilt eine Karte in mehrere Unter-Aufgaben auf (komplexe Action!).

```typescript
{
    type: 'split_card',
    columnId: string,
    sourceCardId: string,
    newCards: CardProps[]
}
```

**Beispiel:**
```json
{
    "type": "split_card",
    "columnId": "col-todo",
    "sourceCardId": "card-789",
    "newCards": [
        {
            "heading": "API: GET /users Endpoint",
            "labels": ["backend", "api"]
        },
        {
            "heading": "API: POST /users Endpoint",
            "labels": ["backend", "api"]
        },
        {
            "heading": "API: Error-Handling",
            "labels": ["backend", "api"]
        }
    ]
}
```

**Benutzer-Trigger:**
- "Teile diese komplexe Aufgabe in kleinere Schritte auf"
- "Zerlege diese Karte in Frontend/Backend/Testing"

---

#### 5. `delete_card` ✅ NEW

Löscht eine Karte aus dem Board.

```typescript
{
    type: 'delete_card',
    cardId: string,
    columnId: string  // Required for validation
}
```

**Beispiel:**
```json
{
    "type": "delete_card",
    "cardId": "card-old",
    "columnId": "col-done"
}
```

**Benutzer-Trigger:**
- "Lösche diese Karte"
- "Entferne diese doppelte Aufgabe"

---

### COLUMN OPERATIONS

#### 1. `add_column` ✅ NEW

Erstellt eine neue Spalte im Board.

```typescript
{
    type: 'add_column',
    columnProps: {
        name: string,
        color?: string
    }
}
```

**Beispiel:**
```json
{
    "type": "add_column",
    "columnProps": {
        "name": "Code Review",
        "color": "color-purple"
    }
}
```

**Benutzer-Trigger:**
- "Erstelle eine neue Spalte 'Code Review'"
- "Füge einen 'Backlog' hinzu"

---

#### 2. `update_column` ✅ NEW

Aktualisiert Spalten-Properties (Name, Farbe).

```typescript
{
    type: 'update_column',
    columnId: string,
    updates: Partial<ColumnProps>
}
```

**Beispiel:**
```json
{
    "type": "update_column",
    "columnId": "col-in-progress",
    "updates": {
        "name": "Aktuell in Bearbeitung",
        "color": "color-yellow"
    }
}
```

**Benutzer-Trigger:**
- "Benenne diese Spalte um zu..."
- "Ändere die Farbe dieser Spalte"

---

#### 3. `move_column` ✅ NEW

Verschiebt eine Spalte an eine neue Position.

```typescript
{
    type: 'move_column',
    columnId: string,
    toPosition: number  // 0-based index
}
```

**Beispiel:**
```json
{
    "type": "move_column",
    "columnId": "col-review",
    "toPosition": 2
}
```

**Position-Mapping:**
```
toPosition=0: [Review, TODO, InProgress, Done]
toPosition=1: [TODO, Review, InProgress, Done]
toPosition=2: [TODO, InProgress, Review, Done]
toPosition=3: [TODO, InProgress, Done, Review]
```

**Benutzer-Trigger:**
- "Verschiebe die Review-Spalte nach ganz vorne"
- "Ordne die Spalten um..."

---

#### 4. `delete_column` ✅ NEW

Löscht eine Spalte (und alle darin enthaltenen Karten).

```typescript
{
    type: 'delete_column',
    columnId: string
}
```

**Beispiel:**
```json
{
    "type": "delete_column",
    "columnId": "col-archive"
}
```

**⚠️ WARNUNG:** Deleting a column deletes ALL contained cards!

**Benutzer-Trigger:**
- "Lösche diese Spalte"
- "Entferne die Archive-Spalte"

---

### BATCH OPERATIONS

#### 1. `reorder_cards` ✅ NEW

Sortiert Karten in einer Spalte neu (z.B. nach Priorität).

```typescript
{
    type: 'reorder_cards',
    columnId: string,
    cardIds: string[]  // New order
}
```

**Beispiel:**
```json
{
    "type": "reorder_cards",
    "columnId": "col-todo",
    "cardIds": [
        "card-important",
        "card-123",
        "card-456",
        "card-low-prio"
    ]
}
```

**Vorher (alte Reihenfolge):**
```
TODO:
├─ Karte: card-456
├─ Karte: card-important ⬆️
├─ Karte: card-low-prio
└─ Karte: card-123
```

**Nachher (neue Reihenfolge):**
```
TODO:
├─ Karte: card-important ✓
├─ Karte: card-123
├─ Karte: card-456
└─ Karte: card-low-prio
```

**Benutzer-Trigger:**
- "Sortiere diese Karten nach Priorität"
- "Ordne die Tasks um..."

---

#### 2. `reorder_columns` ✅ NEW

Sortiert alle Spalten neu.

```typescript
{
    type: 'reorder_columns',
    columnIds: string[]  // New order
}
```

**Beispiel:**
```json
{
    "type": "reorder_columns",
    "columnIds": [
        "col-backlog",
        "col-todo",
        "col-in-progress",
        "col-review",
        "col-done"
    ]
}
```

**Vorher:**
```
[TODO] [Done] [In Progress] [Review] [Backlog]
```

**Nachher:**
```
[Backlog] [TODO] [In Progress] [Review] [Done]
```

**Benutzer-Trigger:**
- "Reorganisiere die Spalten nach Workflow..."
- "Setze den Standard-Workflow auf"

---

### BOARD OPERATIONS

#### 1. `update_board` ✅ NEW

Aktualisiert Board-Level Properties (Name, Description).

```typescript
{
    type: 'update_board',
    updates: Partial<BoardProps>
}
```

**Beispiel:**
```json
{
    "type": "update_board",
    "updates": {
        "name": "Photosynthese Unterricht - Q4 2025",
        "description": "Lernziele: Dunkelreaktion verstehen, Experimente durchführen"
    }
}
```

**Benutzer-Trigger:**
- "Ändere den Namen dieses Boards"
- "Aktualisiere die Beschreibung"

---

## 📊 Häufigkeitsanalyse (Predicted)

Basierend auf Benutzer-Nutzungsmustern:

| Action | Häufigkeit | Priorität | Komplexität |
|--------|-----------|-----------|------------|
| `add_card` | ⭐⭐⭐⭐⭐ | 🔴 P0 | 🟢 Easy |
| `move_card` | ⭐⭐⭐⭐ | 🔴 P0 | 🟡 Medium |
| `split_card` | ⭐⭐⭐ | 🟠 P1 | 🔴 Hard |
| `delete_card` | ⭐⭐⭐ | 🟠 P1 | 🟢 Easy |
| `update_card` | ⭐⭐ | 🟡 P2 | 🟢 Easy |
| `add_column` | ⭐⭐⭐⭐ | 🔴 P0 | 🟡 Medium |
| `update_column` | ⭐⭐ | 🟡 P2 | 🟢 Easy |
| `move_column` | ⭐⭐ | 🟡 P2 | 🟡 Medium |
| `delete_column` | ⭐ | 🟡 P2 | 🟢 Easy |
| `reorder_cards` | ⭐⭐ | 🟡 P2 | 🟡 Medium |
| `reorder_columns` | ⭐ | 🟢 P3 | 🟡 Medium |

---

## 🔌 Implementation-Reihenfolge (Empfohlen)

### Phase 3.2: Grundoperationen (5/11 Actions)

```typescript
1. ✅ add_card         // Meistgenutzt
2. ✅ move_card        // Meistgenutzt
3. ✅ delete_card      // Häufig
4. ✅ add_column       // Meistgenutzt
5. ✅ update_card      // Häufig
```

### Phase 3.3: Erweiterte Operations (6/11 Actions)

```typescript
6. split_card          // Komplex, aber wichtig
7. update_column       // Weniger häufig
8. move_column         // Workflow-Support
9. delete_column       // Workflow-Support
10. reorder_cards      // Advanced
11. reorder_columns    // Advanced
```

---

## ✅ TypeScript Types (Vollständig)

```typescript
export interface AIAction {
    type: 
        // Card Operations
        | 'add_card' 
        | 'update_card' 
        | 'move_card' 
        | 'split_card' 
        | 'delete_card'
        // Column Operations
        | 'add_column'
        | 'update_column'
        | 'move_column'
        | 'delete_column'
        // Batch Operations
        | 'reorder_cards'
        | 'reorder_columns'
        // Board Operations
        | 'update_board';
    
    [key: string]: any;
}

export type AIActionPayload =
    // Card Operations
    | { type: 'add_card'; columnId: string; cardProps: Partial<CardProps> }
    | { type: 'update_card'; cardId: string; updates: Partial<CardProps> }
    | { type: 'move_card'; cardId: string; fromColumnId: string; toColumnId: string }
    | { type: 'split_card'; columnId: string; sourceCardId: string; newCards: CardProps[] }
    | { type: 'delete_card'; cardId: string; columnId: string }
    // Column Operations
    | { type: 'add_column'; columnProps: Partial<ColumnProps> }
    | { type: 'update_column'; columnId: string; updates: Partial<ColumnProps> }
    | { type: 'move_column'; columnId: string; toPosition: number }
    | { type: 'delete_column'; columnId: string }
    // Batch Operations
    | { type: 'reorder_cards'; columnId: string; cardIds: string[] }
    | { type: 'reorder_columns'; columnIds: string[] }
    // Board Operations
    | { type: 'update_board'; updates: Partial<BoardProps> };
```

---

## 🎓 Praktische Beispiele

### Szenario 1: Unterrichtsplanung

**Benutzer:** "Plane eine 90-Minuten Photosynthese-Lektion"

**AI würde folgende Actions generieren:**
```json
[
    { "type": "add_column", "columnProps": { "name": "Einstieg (10 min)" } },
    { "type": "add_column", "columnProps": { "name": "Erarbeitung (40 min)" } },
    { "type": "add_column", "columnProps": { "name": "Vertiefung (30 min)" } },
    { "type": "add_column", "columnProps": { "name": "Abschluss (10 min)" } },
    { "type": "add_card", "columnId": "einstieg", "cardProps": { "heading": "Video: Photosynthese einfach erklärt" } },
    { "type": "add_card", "columnId": "einstieg", "cardProps": { "heading": "Quiz: Vorwissen abfragen" } },
    { "type": "add_card", "columnId": "erarbeitung", "cardProps": { "heading": "Experiment: Stärkenachweis" } },
    { "type": "add_card", "columnId": "erarbeitung", "cardProps": { "heading": "Gruppenarbeit: Lichtabhängigkeit" } }
]
```

### Szenario 2: Prioritäts-Reorganisation

**Benutzer:** "Priorisiere diese Aufgaben basierend auf Dringlichkeit"

**AI würde folgende Actions generieren:**
```json
[
    { "type": "reorder_cards", "columnId": "todo", "cardIds": ["urgent-1", "important-2", "normal-3"] }
]
```

---

## 📚 Verwandte Dokumentation

- **[AI-COLLABORATIVE-GENERATION.md](./AI-COLLABORATIVE-GENERATION.md)** — Vollständiger 3-Phase Workflow
- **[CHATBOTSTORE.md](../STORES/CHATBOTSTORE.md)** — Store-Implementation & processAIAction()
- **[AGENTS.md](../../../AGENTS.md)** — Core Data Model (Chat-Klasse)

---

**Status:** ✅ DESIGN COMPLETE | ⏳ IMPLEMENTATION Phase 3.2-3.3  
**Last Updated:** 3. November 2025  
**Autor:** AI Agent (mit User-Feedback)
