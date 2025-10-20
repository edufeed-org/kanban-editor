# Spezifikation für KI-gestütztes Kanban-Board (Svelte 5 / TypeScript)

## I. Projektübersicht & Zielsetzung

Das Ziel ist die Neuentwicklung eines KI-unterstützten Kanban-Boards mit Svelte 5 und TypeScript. Die gesamte Zustandsverwaltung soll über streng definierte Klassenmethoden erfolgen, um die einfache Anbindung an dezentrale Speicher- und Übertragungsmechanismen (Nostr Events) zu gewährleisten.

### Schlüsselanforderungen

1. **Technologie**: Svelte 5 (Runes), TypeScript (strict mode).
2. **Datenmodell**: Implementierung der Klassen`Card`,`Column`,`Board`,`Chat`.
3. **Identifikatoren**: Jedes Kernelement muss eine eindeutige ID (simulierter Nostr`d-tag`) besitzen.
4. **Zustandsverwaltung**: Verwendung von Svelte 5 Runes (`$state`,`$derived`) zur Kapselung des`Board`-Zustands.
5. **KI-Kontext**: Bereitstellung von Methoden (`getContextData()`) zur Serialisierung des relevanten Board-Kontexts für die KI.
6. **Komplexe Aktionen**: Implementierung der Logik für die KI-gesteuerte`split-card`-Aktion.

## ⚠️ Kritische Abhängigkeiten & Cross-References

**WICHTIG:** Dieses Dokument spezifiziert **nur** die Core-Datenmodelle (`BoardModel.ts`) und die Chat-Logik. Für die vollständige Implementierung sind folgende spezialisierte Dokumentationen **zwingend erforderlich**:

| Dokument | Fokus | Abhängigkeit für |
|:---------|:-----|:-----------------|
| **[STORES.md](./STORES.md)** (NEU) | Store-Architektur, Export/Import API (Meilenstein 1.5), Persistence | BoardStore, AuthStore, SyncManager, Offline-First |
| **[PROP-UPDATE-GUIDE.md](./PROP-UPDATE-GUIDE.md)** ⭐ NEW | Dynamische UI-Prop-Änderungen (Name, Farbe, etc.) | Spalten/Karten Bearbeitung, Persistenz |
| **[NOSTR-USER.md](./NOSTR-USER.md)** | Benutzerauthentifizierung, NIP-07 Signer, Session-Management | AuthStore, Event-Signierung, User-Kontext |
| **[NDK.md](./NDK.md)** | Nostr Development Kit, Event Publishing, Subscriptions, Relay-Handling | `nostrEvents.ts`, SyncManager, Live-Updates |
| **[Kanban-NIP.md](./Kanban-NIP.md)** | Nostr Event Kinds (30301, 30302, 1), Tag-Schema | Event-Serialisierung in `nostrEvents.ts` |
| **[UX-RULES.md](./UX-RULES.md)** | shadcn-svelte Design Pattern, Icon-Konventionen, Accessibility | Card.svelte, Dialog-Komponenten, Form-Struktur |

**Kritische Abhängigkeitskette:**
```
BoardModel.ts (Core)
    ↓
kanbanStore.svelte.ts (via STORES.md)
    ├→ Benötigt: AuthStore (NOSTR-USER.md)
    ├→ Benötigt: NDK Context (NDK.md)
    └→ Benötigt: SyncManager (AGENTS.md + STORES.md)
         ├→ Publiziert: nostrEvents.ts (Kanban-NIP.md)
         └→ Persistiert: IndexedDB (STORES.md)
         
UI-Komponenten (Card.svelte, etc.)
    ├→ Verwenden: shadcn-svelte (UX-RULES.md)
    ├→ Lesen: BoardStore (STORES.md)
    ├→ Bearbeiten Props: PROP-UPDATE-GUIDE.md ⭐
    └→ Rendern: Board-Daten (BoardModel.ts)
```

**⚠️ OHNE diese Dependencies:**
- ❌ Benutzer können sich **nicht einloggen** (NOSTR-USER.md fehlt)
- ❌ Events können **nicht signiert werden** (AuthStore, NOSTR-USER.md)
- ❌ Boards können **nicht exportiert/importiert** werden (STORES.md fehlt)
- ❌ UI-Komponenten **verletzen UX-RULES** (UX-RULES.md ignoriert)
- ❌ Events können **nicht publiziert** werden (NDK.md fehlt)
- ❌ **Prop-Änderungen funktionieren nicht korrekt** (PROP-UPDATE-GUIDE.md ignoriert) ⭐

## II. Technischer Stack & Konventionen

| Aspekt                  | Konvention                                                                            |
| :---------------------- | :------------------------------------------------------------------------------------ |
| **Framework**     | Svelte 5 (unter Verwendung der neuen Runes-Syntax)                                    |
| **Sprache**       | TypeScript (strikte Typisierung für alle Klassen und Funktionen)                     |
| **Zustand**       | Svelte 5 `$state()` und `$derived()` für Stores und reaktive Werte.              |
| **Dateiendungen** | `.ts` für Logik/Klassen, `.svelte` für Komponenten, `.svelte.ts` für Stores mit Runes!            |
| **Nostr-IDs**     | Generierung von `d-tag`-ähnlichen IDs durch eine Hilfsfunktion `generateDTag()`. |

### ⚠️ KRITISCH: BoardStore vs direkter Board-Zugriff

**REGEL:** IMMER `boardStore.XXX()` Methoden nutzen, NIEMALS `board.XXX()` direkt aufrufen!

```typescript
// ❌ FALSCH - Keine Reaktivität, keine Persistierung!
const column = board.findColumn('col-id');
column.addCard({heading: 'Neue Karte'});
// localStorage NICHT aktualisiert
// UI zeigt NICHTS neu
// Nostr NICHT publiziert

// ✅ RICHTIG - Alles funktioniert automatisch!
boardStore.createCard('col-id', 'Neue Karte');
// → triggerUpdate() wird aufgerufen
// → localStorage synchron aktualisiert
// → uiData $derived wird neu berechnet
// → Column.svelte $effect wird getriggert
// → UI zeigt neue Karte sofort
// → (Später) Nostr Event wird publiziert
```

**Warum?** `triggerUpdate()` ist die Brücke zwischen Model und UI:
1. `board` ist reiner Datencontainer (keine Reaktivität)
2. `BoardStore` ist reaktiv mit `$state` und `$derived`
3. Nur `boardStore.XXX()` ruft `triggerUpdate()` auf
4. `triggerUpdate()` inkrementiert `updateTrigger` State
5. Das triggert `$derived.by()` Neuberechnung
6. Das triggert `$effect` in Components
7. Das updatet die UI

## III. Core Data Model (TypeScript Interfaces und Klassen)

Der KI-Agent soll die folgenden TypeScript-Interfaces und Klassen **vollständig** und **exakt** in der Datei `src/lib/classes/BoardModel.ts` generieren.

### 1. Interfaces für Datentypen

```typescript
// src/lib/classes/BoardModel.ts

// Basis-Interface für alle Elemente, die eine Nostr-d-tag-ID benötigen
export interface NostrElement {
    id: string; // Die eindeutige ID (d-tag)
}

export interface Comment extends NostrElement {
    text: string;
    author: string; // Nostr Public Key (npub)
    createdAt: string; // ISO 8601
}

export interface Link extends NostrElement {
    url: string;
    title: string;
}

export interface CardProps {
    id?: string;
    heading: string;
    content?: string;
    color?: string; // z.B. 'color-gradient-1'
    comments?: Comment[];
    labels?: string[];
    links?: Link[]; // in der Regel nur ein Link pro Karte auf eine Ressource
    updatedAt?: string; // ISO 8601: nostr `created_at` timestamp
    attendees?: string[]; // Array von npub-Keys genieriert aus den Kommentaren und der Author npub
    publishState?: PublishState; // 'draft' | 'published' | 'archived'
}

export interface ColumnProps {
    id?: string;
    name: string;
    color?: string;
    cards?: CardProps[];
}

export interface BoardProps {
    id?: string;
    name: string;
    description?: string;
    columns?: ColumnProps[];
    publishState?: PublishState; 
    author?: string; // npub-Key
}

export interface AIAction {
    type: 'add_card' | 'update_card' | 'move_card' | 'split_card';
    // Generische Typen, die je nach 'type' unterschiedliche Payloads enthalten
    [key: string]: any;
}```

### 2. Die Board-Klassen

Der KI-Agent soll die Logik der ursprünglichen JavaScript-Klassen in TypeSript umwandeln und **die folgenden Methoden inkl. Typisierung implementieren**. Die `getContextData` Methoden sind für die KI-Kommunikation essentiell.

#### `class Card`

| Methode | Beschreibung |
| :--- | :--- |
| `constructor(props: CardProps)` | Erstellt eine neue Karte. Initialisiert `id` mit `generateDTag()`. |
| `update(props: Partial<CardProps>)` | Aktualisiert die Karteneigenschaften. Setzt `updatedAt`. |
| `setPublishState(state: PublishState)` | Ändert den publishState der Karte. Setzt updatedAt |
| `addComment(text: string, author: string)` | Fügt einen Kommentar hinzu. |
| `deleteComment(commentId: string)` | Löscht einen Kommentar. |
| `getContextData(): Omit<CardProps, 'comments'|'links'|'attendees'> & { comments: { text: string; author: string }[], links: { url: string; title: string }[] }` | **Wichtig**: Erzeugt ein sauberes, flaches JSON-Objekt **ohne** Klasseninstanzen für den KI-Kontext. Sollte  publishState im zurückgegebenen Objekt enthalten |

#### `class Column`

| Methode | Beschreibung |
| :--- | :--- |
| `constructor(props: ColumnProps)` | Erstellt eine neue Spalte. Enthält ein Array von `Card`-Instanzen. |
| `update(props: Partial<ColumnProps>)` | Aktualisiert den Namen/die Farbe der Spalte. |
| `addCard(props: CardProps): Card` | Fügt eine neue `Card`-Instanz hinzu. |
| `deleteCard(cardId: string)` | Löscht eine Karte anhand ihrer ID. |
| `findCard(cardId: string): Card \| undefined` | Sucht eine Karte in dieser Spalte. |
| `splitCard(sourceCardId: string, newCardsProps: CardProps[])` | **KI-Aktion**: Löscht `sourceCardId` und fügt alle `newCardsProps` als neue Karten hinzu. |
| `getContextData(full: boolean = false): { id: string, name: string, cards: any[] }` | Wenn `full` `true` ist, enthält `cards` das volle `Card.getContextData()`. Sonst nur `{ id, heading }`. |

#### `class Board`

| Methode | Beschreibung |
| :--- | :--- |
| `constructor(props: BoardProps)` | Erstellt ein neues Board. Enthält ein Array von `Column`-Instanzen. |
| `setPublishState(state: PublishState)` | Ändert den publishState der Karte. Setzt updatedAt |
| `addColumn(props: ColumnProps): Column` | Fügt eine neue Spalte hinzu. |
| `deleteColumn(columnId: string)` | Löscht eine Spalte. |
| `findColumn(columnId: string): Column \| undefined` | Sucht eine Spalte. |
| `findCardAndColumn(cardId: string): { card: Card; column: Column } \| null` | Sucht eine Karte im gesamten Board und gibt die Karte und die zugehörige Spalte zurück. |
| `moveCard(cardId: string, fromColId: string, toColId: string)` | Verschiebt eine Karte zwischen zwei Spalten. |
| `getContextData(full: boolean = false): { id: string, name: string, description: string, columns: any[] }` | Erzeugt ein sauberes Kontextobjekt. Nutzt `Column.getContextData(full)`. |

### 3. Der Chat- und KI-Controller

#### `class Chat`

Diese Klasse ist die zentrale Schnittstelle zur KI (simulierter WebSocket/Nostr Server). Sie wird in **BoardStore** (STORES.md) instantiiert und stellt die Kommunikationsbrücke mit KI-Services dar.

**Integration:**
- **STORES.md** — Chat-Instanz in BoardStore
- **Meilenstein 3.1 (ROADMAP.md)** — Vollständige KI-Context API
- **Meilenstein 3.3 (ROADMAP.md)** — KI-Aktionen (split_card, add_card, move_card, update_card)

| Methode | Beschreibung |
| :--- | :--- |
| `constructor(board: Board)` | Hält eine **Referenz** auf die aktive `Board`-Instanz. |
| `addMessage(text: string, sender: 'user' \| 'ai', type: 'message' \| 'action' = 'message')` | Fügt eine Nachricht/Aktion zum Nachrichtenverlauf hinzu. |
| `sendPromptToAI(prompt: string, context?: Card \| Column \| Board)` | **Wichtig**: Sammelt den Kontext. Ruft `context.getContextData()` auf, wenn `context` übergeben wird. Erstellt das `payload`-Objekt (`{ prompt, boardContext, selectionContext }`) für den KI-Server. **Siehe STORES.md Section III für Payload-Format**. |
| `processAIAction(action: AIAction)` | **Wichtig**: Führt die Board-Manipulation aus, ausgelöst durch die KI. Muss alle `AIAction`-Typen (insbesondere `split_card`) mit den entsprechenden Methoden der `Board`- und `Column`-Klassen abhandeln. Wird von BoardStore aufgerufen. |

## IV. State Management (Svelte 5 Stores) - **WICHTIG: .svelte.ts Konvention!**

**⚠️ KRITISCHE ÄNDERUNG AB SVELTE 5:**

Alle Stores mit **reaktivem State** müssen die Endung `.svelte.ts` haben, damit der Compiler Runes transformieren kann!

```typescript
// ❌ FALSCH: kanbanStore.svelte.ts
export class BoardStore {
    private board = $state(...); // ← Compiler-Fehler: $state not recognized
}

// ✅ RICHTIG: kanbanStore.svelte.ts
export class BoardStore {
    private board = $state(...); // ← OK! Compiler erkennt Rune
}
```

**Siehe auch:** [STORES.md](./STORES.md) für vollständige Store-Architektur, Runes-Spezifikation und aktuelle Implementierung.

### Aktuelle Implementierung (Phase 1 ✅)

```typescript
// src/lib/stores/kanbanStore.svelte.ts (NEU: .svelte.ts!)

import { Board, Chat, type CardProps } from '../classes/BoardModel.js';

export class BoardStore {
    // ← $state Runes (nur in .svelte.ts möglich!)
    private board = $state(this.loadFromStorage());
    private _columnOrder = $state<string[]>([...]);
    private updateTrigger = $state(0);

    // ← $derived.by berechnet automatisch neu
    public uiData = $derived.by(() => {
        this.updateTrigger; // ← Dependency Tracking
        this._columnOrder;
        // Transform board.columns zu UI-Format
        // ...
    });

    // Alle Änderungen gehen durch zentrale Methoden:
    public createCard(columnId: string, name: string, description?: string): string {
        const card = this.board.findColumn(columnId)?.addCard({ 
            heading: name, 
            content: description 
        });
        
        if (card) {
            this.triggerUpdate(); // → saveToStorage() synchron
            this.publishToNostr(); // async
            return card.id;
        }
        throw new Error(`Column ${columnId} not found`);
    }

    public syncBoardState(uiColumns: UIColumn[]): void {
        // Atomic 3-Step Sync:
        // 1. Update _columnOrder
        this._columnOrder = uiColumns.map(c => c.id);
        
        // 2. Reorder board.columns for persistence
        // ... (siehe STORES.md für Details)
        
        // 3. Sync card positions
        // ...
        
        this.triggerUpdate(); // → saveToStorage()
        this.publishToNostr();
    }

    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage(); // ← Synchron!
    }

    private saveToStorage(): void {
        const data = this.board.getContextData(true);
        localStorage.setItem('kanban-board-data', JSON.stringify(data));
    }
}

// ← GLOBALE SINGLETON-INSTANZ (nicht writable!)
export const boardStore = new BoardStore();
```

**Kritische Design-Punkte:**

1. ✅ **Datei MUSS `.svelte.ts` sein** — Runes funktionieren nur dort!
2. ✅ **`$state` für reactive state** — updateTrigger wird gelesen → triggert $derived
3. ✅ **`$derived.by()` reactive computation** — keine Subscribers notwendig
4. ✅ **Array-Reassignments statt Mutationen** — `this.cards = [...this.cards, card]`
5. ✅ **Globale Klassen-Instanz** — kein `writable()`, nur `export const boardStore = new BoardStore()`

## V. Zu liefernde Dateien (Aktueller Stand der Implementierung)

Der aktuelle Stand der Codebase zeigt folgende Struktur:

| Datei                                 | Beschreibung                                                                                                                                                                   | Status |
| :------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: |
| `src/lib/utils/idGenerator.ts`      | Enthält die Funktion `generateDTag()` und ggf. Logik für Nostr Public Keys.                                                                                                | ✅ |
| `src/lib/classes/BoardModel.ts`     | **Komplette Implementierung mit Runes-safe Array-Reassignments** (`Column.addCard()`, `Card.addComment()`, etc. nutzen `[...array, item]`)                             | ✅ |
| `src/lib/stores/kanbanStore.svelte.ts`     | **KONVERTIERT zu .svelte.ts!** BoardStore mit `$state`, `$derived.by()`, `syncBoardState()`. Atomic 3-Step Sync für Spalten + Karten.                                    | ✅ |
| **`src/routes/cardsboard/+page.svelte`** | **Synchronisiert mit BoardStore via boardStore.syncBoardState()** nach DnD-finalize.                                   | ✅ |
| **`src/routes/cardsboard/Board.svelte`** | **Board-Container mit isDragging guard** zur Vermeidung von $effect-Loops. Implements DnD via svelte-dnd-action.                                                               | ✅ |
| **`src/routes/cardsboard/Column.svelte`** | **NEU: $effect für Auto-Sync!** Überwacht `boardStore.uiData` und aktualisiert `items` Props automatisch bei Card-Updates.                                                  | ✅ |
| **`src/routes/cardsboard/Card.svelte`** | **Mit CardDialog integration.** Bearbeitung triggert `boardStore.editCard()` → sofortige UI-Update via Column `$effect`.                                                  | ✅ |
| **`src/routes/cardsboard/CardDialog.svelte`** | **Card-Detail-Modal mit Tabs.** `onSave` triggert `boardStore.editCard()` für Persistence.                                   | ✅ |
| **`src/routes/cardsboard/types.ts`** | **TypeScript-Definitionen.** `CardItem`, `UIColumn`, `BoardUpdateHandler` interfaces.                                                 | ✅ |
| **`src/routes/cardsboard/data.ts`** | **Mock-Daten.** Beispiel-Boards für Development.                                                                                                 | ✅ |
| `src/lib/utils/testSuite.ts`        | Test-Suite ohne externes Framework. Validiert alle Kern-Funktionen.                                                                                                         | ✅ |
| **`src/lib/stores/settingsStore.svelte.ts`** | **🟡 MUSS KONVERTIERT WERDEN!** Aktuell: Svelte 4 `writable()` — sollte zu `.svelte.ts` mit Runes migriert werden.                                                          | 🟡 |
| **`src/lib/stores/authStore.svelte.ts`** | **⏳ Noch zu erstellen** — Nostr User Management (`.svelte.ts` mit `$state` für user session).                                                       | ⏳ |
| **`src/lib/utils/nostrEvents.ts`**  | **⏳ Noch zu erstellen** — Event Serialization/Deserialization (boardToNostrEvent, cardToNostrEvent).                                                                           | ⏳ |
| **`src/lib/stores/syncManager.svelte.ts`** | **⏳ Noch zu erstellen** — Offline-Sync Manager (IndexedDB Queue, `.svelte.ts` mit `$state`).                                                                                | ⏳ |

**Legende:** ✅ Vollständig | 🟡 MUSS KONVERTIERT | ⏳ Noch zu erstellen

**📌 Dokumentations-Referenzen:**
- **[STORES.md](./STORES.md)** — **UPDATED** für Svelte 5 Runes, aktuelle Implementierung, Konversionsanleitung
- **[MULTI-LAYER STORAGE.md](./MULTI-LAYER STORAGE.md)** — **UPDATED** Runes Paradigma, Array-Reassignment Rules
- **[UX-RULES.md](./UX-RULES.md)** — shadcn-svelte Komponenten, Icons, Accessibility
- **[NDK.md](./NDK.md)** — NDK-Integration, Relay-Handling
- **[NOSTR-USER.md](./NOSTR-USER.md)** — Authentifizierung, Signer

### Event-Mapping

Die Klassenstruktur wird auf Nostr Events gemäß **Kanban-NIP** (NIP-30301/30302) abgebildet:

| Klasse/Konzept | Nostr Event Kind | Event-Typ | Beschreibung |
|----------------|------------------|-----------|--------------|
| `Board` | 30301 | Parametrized Replaceable | Board-Definition mit Spalten |
| `Column` | - | Tag in 30301 | `["col", "id", "name", "order"]` |
| `Card` | 30302 | Parametrized Replaceable | Einzelne Karte mit Status |
| `Comment` | 1 | Regular | Text Note mit `a`-tag Referenz |
| `publishState` | - | Custom Tag | `["state", "draft|published|archived"]` |

### Event-Serialisierung

Der KI-Agent soll eine Utility-Datei erstellen: `src/lib/utils/nostrEvents.ts`

Diese Datei muss folgende Funktionen enthalten:

```typescript
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { Board, Card, Column, Comment } from '$lib/classes/BoardModel';

/**
 * Konvertiert ein Board zu einem Nostr Event (Kind 30301)
 */
export function boardToNostrEvent(board: Board, ndk: NDK): NDKEvent;

/**
 * Konvertiert ein Nostr Event zurück zu einem Board
 */
export function nostrEventToBoard(event: NDKEvent): BoardProps;

/**
 * Konvertiert eine Card zu einem Nostr Event (Kind 30302)
 * @param card - Die zu serialisierende Card
 * @param columnName - Name der Spalte (wird als 's' tag gesetzt)
 * @param rank - Position in der Spalte
 * @param boardRef - Referenz zum Board im Format "30301:pubkey:d-tag"
 */
export function cardToNostrEvent(
  card: Card, 
  columnName: string, 
  rank: number, 
  boardRef: string,
  ndk: NDK
): NDKEvent;

/**
 * Konvertiert ein Nostr Event zurück zu einer Card
 */
export function nostrEventToCard(event: NDKEvent): CardProps;

/**
 * Erstellt ein Kommentar-Event (Kind 1) für eine Card
 * @param text - Kommentar-Text
 * @param cardRef - Referenz zur Card im Format "30302:pubkey:d-tag"
 * @param cardEventId - Event-ID der Card (für 'e' tag)
 */
export function createCommentEvent(
  text: string,
  cardRef: string,
  cardEventId: string,
  ndk: NDK
): NDKEvent;
```

**Beispiel-Implementierung für `boardToNostrEvent`:**

```typescript
export function boardToNostrEvent(board: Board, ndk: NDK): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = 30301;
  event.tags = [
    ["d", board.id],
    ["title", board.name],
    ["description", board.description || ""],
    ["state", board.publishState || "draft"],
    ...board.columns.map((col, index) => 
      ["col", col.id, col.name, String(index), col.color || ""]
    ),
  ];
  
  if (board.author) {
    event.tags.push(["p", board.author]);
  }
  
  event.content = "";
  return event;
}
```

## VI. Offline-First Strategie & Synchronisation

### 6.1 Architektur-Überblick

Das Kanban-Board muss **offline-fähig** sein und sich automatisch synchronisieren, wenn die Verbindung wiederhergestellt wird.

```
┌─────────────────────────────────────────────┐
│         Browser (Client)                     │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  UI Layer (Svelte Components)          │ │
│  │  - Sofort reaktiv durch $state         │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  BoardStore (kanbanStore.svelte.ts)           │ │
│  │  - Lokaler Zustand (in-memory)         │ │
│  │  - Sofortige UI-Updates                │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  Sync Manager (syncManager.ts)         │ │
│  │  - Event Queue (IndexedDB)             │ │
│  │  - Online/Offline Detection            │ │
│  │  - Conflict Resolution                 │ │
│  │  - Retry Logic                         │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  NDK + Cache                           │ │
│  │  - IndexedDB Cache (Dexie)             │ │
│  │  - Event Subscriptions                 │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                    ↕
       ┌───────────────────────┐
       │  Nostr Relays         │
       │  (bei Online)         │
       └───────────────────────┘
```

### 6.2 Sync Manager Implementierung

Der KI-Agent soll eine neue Datei erstellen: `src/lib/stores/syncManager.ts`

```typescript
// src/lib/stores/syncManager.ts

import { persisted } from 'svelte-persisted-store';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

export interface QueuedEvent {
  event: string; // Serialized NDKEvent
  timestamp: number;
  retries: number;
  type: 'board' | 'card' | 'comment';
}

export class SyncManager {
  // Persistent Event Queue (IndexedDB via svelte-persisted-store)
  private eventQueue = persisted<QueuedEvent[]>('nostr-event-queue', []);
  
  // Online-Status (reaktiv)
  private isOnline = $state(navigator.onLine);
  
  // Sync in Progress Flag
  private isSyncing = $state(false);
  
  constructor(private ndk: NDK) {
    this.setupListeners();
    
    // Initial Sync wenn online
    if (this.isOnline) {
      this.syncQueue();
    }
  }
  
  private setupListeners(): void {
    window.addEventListener('online', () => {
      console.log('🌐 Online - Starting sync...');
      this.isOnline = true;
      this.syncQueue();
    });
    
    window.addEventListener('offline', () => {
      console.log('📡 Offline - Queueing events...');
      this.isOnline = false;
    });
  }
  
  /**
   * Publiziert ein Event oder fügt es zur Queue hinzu
   */
  public async publishOrQueue(
    event: NDKEvent, 
    type: 'board' | 'card' | 'comment'
  ): Promise<void> {
    if (this.isOnline) {
      try {
        await this.publishEvent(event);
      } catch (error) {
        console.error('❌ Publish failed, adding to queue:', error);
        this.queueEvent(event, type);
      }
    } else {
      this.queueEvent(event, type);
    }
  }
  
  private async publishEvent(event: NDKEvent): Promise<void> {
    const relays = await event.publish();
    
    if (relays.size === 0) {
      throw new Error('No relays accepted the event');
    }
    
    console.log(`✅ Published to ${relays.size} relay(s)`);
  }
  
  private queueEvent(event: NDKEvent, type: 'board' | 'card' | 'comment'): void {
    const queuedEvent: QueuedEvent = {
      event: JSON.stringify(event.rawEvent()),
      timestamp: Date.now(),
      retries: 0,
      type
    };
    
    this.eventQueue.update(queue => [...queue, queuedEvent]);
    console.log(`📥 Queued ${type} event for later sync`);
  }
  
  /**
   * Synchronisiert alle Events in der Queue
   */
  public async syncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    
    this.isSyncing = true;
    const queue = get(this.eventQueue);
    
    console.log(`🔄 Syncing ${queue.length} queued event(s)...`);
    
    for (const queuedEvent of queue) {
      try {
        const rawEvent = JSON.parse(queuedEvent.event);
        const event = new NDKEvent(this.ndk, rawEvent);
        
        await this.publishEvent(event);
        
        // Erfolgreich: Aus Queue entfernen
        this.eventQueue.update(q => 
          q.filter(e => e.timestamp !== queuedEvent.timestamp)
        );
        
      } catch (error) {
        console.error('⚠️  Sync failed for event:', error);
        
        // Retry-Counter erhöhen
        queuedEvent.retries++;
        
        // Nach 3 Versuchen: Event markieren oder entfernen
        if (queuedEvent.retries >= 3) {
          console.error('❌ Event failed 3 times, removing from queue');
          this.eventQueue.update(q => 
            q.filter(e => e.timestamp !== queuedEvent.timestamp)
          );
        }
        
        break; // Stop bei erstem Fehler
      }
    }
    
    this.isSyncing = false;
    console.log('✅ Sync complete');
  }
  
  /**
   * Gibt Sync-Status zurück
   */
  public get status() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedEvents: get(this.eventQueue).length
    };
  }
}
```

### 6.3 Integration in BoardStore

Der `BoardStore` muss erweitert werden, um den `SyncManager` zu nutzen:

```typescript
// In src/lib/stores/kanbanStore.svelte.ts

import { SyncManager } from './syncManager';
import { boardToNostrEvent, cardToNostrEvent } from '$lib/utils/nostrEvents';

export class BoardStore {
  private board = $state(/* ... */);
  private syncManager: SyncManager;
  
  constructor(private ndk: NDK) {
    this.syncManager = new SyncManager(ndk);
    
    // Initial Load von Nostr
    this.loadFromNostr();
  }
  
  public moveCard(cardId: string, fromColId: string, toColId: string) {
    // 1. Lokale Änderung (sofort sichtbar)
    this.board.moveCard(cardId, fromColId, toColId);
    
    // 2. Nostr Event erstellen und publishen/queuen
    this.publishCardUpdate(cardId);
  }
  
  private async publishCardUpdate(cardId: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card, column } = result;
    const rank = column.cards.indexOf(card);
    const boardRef = `30301:${this.board.author}:${this.board.id}`;
    
    const event = cardToNostrEvent(card, column.name, rank, boardRef, this.ndk);
    
    await this.syncManager.publishOrQueue(event, 'card');
  }
  
  private async loadFromNostr(): Promise<void> {
    // Board Event laden
    const boardEvent = await this.ndk.fetchEvent({
      kinds: [30301],
      authors: [this.currentUser.pubkey],
      '#d': [this.board.id]
    });
    
    if (boardEvent) {
      // Board aus Event rekonstruieren
      // (Details siehe nostrEvents.ts)
    }
    
    // Live Subscriptions für Updates
    this.subscribeToUpdates();
  }
  
  private subscribeToUpdates(): void {
    // Board Updates
    this.ndk.subscribe(
      { 
        kinds: [30301], 
        authors: [this.currentUser.pubkey],
        '#d': [this.board.id]
      },
      { closeOnEose: false }
    ).on('event', (event) => {
      this.handleBoardUpdate(event);
    });
    
    // Card Updates
    this.ndk.subscribe(
      {
        kinds: [30302],
        '#a': [`30301:${this.currentUser.pubkey}:${this.board.id}`]
      },
      { closeOnEose: false }
    ).on('event', (event) => {
      this.handleCardUpdate(event);
    });
  }
  
  public get syncStatus() {
    return this.syncManager.status;
  }
}
```

### 6.4 Conflict Resolution

Bei gleichzeitigen Änderungen durch mehrere Nutzer oder Geräte:

**Strategie: Last-Write-Wins**

- Nutze den `created_at` Timestamp des Nostr Events
- Neuere Events überschreiben ältere
- Replaceable Events (30301, 30302) garantieren dies automatisch

**Alternative: Merge-Strategie** (bei Bedarf)

- Beide Versionen werden als separate Cards angelegt
- User erhält Benachrichtigung über Konflikt
- Manuelle Zusammenführung durch User

### 6.5 publishState Mapping

Das `publishState` Feld wird als **Custom Tag** im Nostr Event gespeichert:

```typescript
// Im Board Event (30301)
["state", "draft"]     // oder "published" oder "archived"

// Im Card Event (30302)
["state", "draft"]
```

**Wichtig:** Nicht alle Nostr-Clients werden dieses Tag unterstützen. Draft-Events sollten optional gar nicht publiziert werden (nur lokal speichern).

## VII. Kommentar-System Spezifikation

### 7.1 Architektur


Kommentare werden als **separate Nostr Events** (Kind 1 - Text Notes) gespeichert, die auf die Card referenzieren.

**Vorteile:**
- ✅ Standard Nostr-Kommentare (kompatibel mit anderen Clients)
- ✅ Eigene Timeline für jede Card
- ✅ Reactions und Zaps möglich
- ✅ Einfach zu laden via NDK-Subscriptions

### 7.2 Event-Struktur

```typescript
{
  kind: 1,
  created_at: <unix-timestamp>,
  tags: [
    ["e", "<card-event-id>", "", "reply"],      // Reply auf Card-Event
    ["p", "<card-author-pubkey>"],              // Erwähnung des Card-Autors
    ["a", "30302:<author>:<card-d-tag>", ""],   // Referenz zum replaceablen Event
  ],
  content: "Das ist mein Kommentar zur Karte."
}
```

**Alternative (NIP-22):** Kind 42 (Channel Messages) könnte ebenfalls verwendet werden, hat aber weniger Client-Support.

### 7.3 Card-Klasse Erweiterung

Die `Card`-Klasse muss erweitert werden:

```typescript
export class Card {
  // Bestehende Properties...
  
  // Nostr-spezifische Properties
  public eventId?: string; // Die Event-ID des Card-Events (30302)
  public author?: string;  // npub des Card-Erstellers
  
  /**
   * Lädt alle Kommentare für diese Card aus Nostr
   */
  async loadCommentsFromNostr(ndk: NDK): Promise<void> {
    if (!this.eventId && !this.id) return;
    
    const filter = {
      kinds: [1],
      '#a': [`30302:${this.author}:${this.id}`]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    this.comments = Array.from(events).map(event => ({
      id: event.id,
      text: event.content,
      author: event.pubkey,
      createdAt: new Date(event.created_at * 1000).toISOString()
    }));
  }
  
  /**
   * Erstellt einen neuen Kommentar auf Nostr
   */
  async addCommentToNostr(ndk: NDK, text: string): Promise<Comment> {
    const event = new NDKEvent(ndk);
    event.kind = 1;
    event.content = text;
    event.tags = [
      ["a", `30302:${this.author}:${this.id}`],
      ["p", this.author || ""]
    ];
    
    if (this.eventId) {
      event.tags.push(["e", this.eventId, "", "reply"]);
    }
    
    await event.publish();
    
    const comment: Comment = {
      id: event.id!,
      text: text,
      author: event.pubkey,
      createdAt: new Date(event.created_at! * 1000).toISOString()
    };
    
    // Lokal hinzufügen
    this.comments.push(comment);
    
    return comment;
  }
  
  /**
   * Löscht einen Kommentar (NIP-09: Event Deletion)
   */
  async deleteCommentFromNostr(ndk: NDK, commentId: string): Promise<void> {
    const deleteEvent = new NDKEvent(ndk);
    deleteEvent.kind = 5; // Event Deletion
    deleteEvent.tags = [
      ["e", commentId]
    ];
    deleteEvent.content = "Kommentar gelöscht";
    
    await deleteEvent.publish();
    
    // Lokal entfernen
    this.deleteComment(commentId);
  }
  
  /**
   * Abonniert Live-Updates für Kommentare
   */
  subscribeToComments(ndk: NDK, callback: (comment: Comment) => void): () => void {
    const sub = ndk.subscribe(
      {
        kinds: [1],
        '#a': [`30302:${this.author}:${this.id}`]
      },
      { closeOnEose: false }
    );
    
    sub.on('event', (event) => {
      const comment: Comment = {
        id: event.id!,
        text: event.content,
        author: event.pubkey,
        createdAt: new Date(event.created_at! * 1000).toISOString()
      };
      
      callback(comment);
    });
    
    // Cleanup-Funktion zurückgeben
    return () => sub.stop();
  }
}
```

### 7.4 BoardStore Integration

Der `BoardStore` muss Kommentar-Operationen unterstützen:

```typescript
export class BoardStore {
  // ... bestehende Methoden
  
  public async addComment(cardId: string, text: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card } = result;
    
    try {
      await card.addCommentToNostr(this.ndk, text);
    } catch (error) {
      console.error('Failed to add comment:', error);
      
      // Fallback: Lokal hinzufügen (wird später synchronisiert)
      const currentUser = await this.ndk.signer?.user();
      card.addComment(text, currentUser?.pubkey || 'unknown');
    }
  }
  
  public async deleteComment(cardId: string, commentId: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card } = result;
    
    try {
      await card.deleteCommentFromNostr(this.ndk, commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      
      // Fallback: Lokal löschen
      card.deleteComment(commentId);
    }
  }
  
  public async loadComments(cardId: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card } = result;
    await card.loadCommentsFromNostr(this.ndk);
  }
}
```

### 7.5 UI-Integration (Card.svelte)

#### Datei: `src/routes/cardsboard/Card.svelte` (Echte Implementierung)

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import type { CardType } from "./types";
  import CardViewDialog from "./CardViewDialog.svelte";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import UsersIcon from "@lucide/svelte/icons/users";
  
  // Props mit Svelte 5 Runes-Syntax
  let { card, isDragging = false }: { card: CardType; isDragging?: boolean } = $props();
  
  let showDialog = $state(false);
  
  function handleCardClick() {
    showDialog = true;
  }
  
  // Derived values für Metadaten
  let hasComments = $derived(card.comments && card.comments.length > 0);
  let hasAttendees = $derived(card.attendees && card.attendees.length > 0);
  let hasLinks = $derived(card.links && card.links.length > 0);
</script>

<!-- Hauptkarte mit Click-Handler -->
<Card.Root 
  class="cursor-pointer transition-all duration-200 {isDragging ? 'rotate-3 scale-105 shadow-lg' : 'hover:shadow-md'}" 
  onclick={handleCardClick}
>
  <Card.Header class="pb-3">
    <Card.Title class="text-sm font-medium leading-tight">
      {card.title}
    </Card.Title>
    {#if card.description}
      <Card.Description class="text-xs line-clamp-2">
        {card.description}
      </Card.Description>
    {/if}
  </Card.Header>
  
  <!-- Labels/Tags -->
  {#if card.labels && card.labels.length > 0}
    <Card.Content class="py-2">
      <div class="flex flex-wrap gap-1">
        {#each card.labels.slice(0, 3) as label}
          <Badge variant="secondary" class="text-xs px-1.5 py-0.5">
            {label}
          </Badge>
        {/each}
        {#if card.labels.length > 3}
          <Badge variant="outline" class="text-xs px-1.5 py-0.5">
            +{card.labels.length - 3}
          </Badge>
        {/if}
      </div>
    </Card.Content>
  {/if}
  
  <!-- Footer mit Metadaten -->
  <Card.Footer class="pt-3 pb-3 flex justify-between text-xs text-muted-foreground">
    <div class="flex items-center gap-3">
      
      <!-- Kommentare -->
      {#if hasComments}
        <div class="flex items-center gap-1">
          <MessageSquareIcon class="h-3 w-3" />
          <span>{card.comments?.length}</span>
        </div>
      {/if}
      
      <!-- Attendees -->
      {#if hasAttendees}
        <div class="flex items-center gap-1">
          <UsersIcon class="h-3 w-3" />
          <span>{card.attendees?.length}</span>
        </div>
      {/if}
      
      <!-- Links -->
      {#if hasLinks}
        <div class="flex items-center gap-1">
          <ExternalLinkIcon class="h-3 w-3" />
          <span>{card.links?.length}</span>
        </div>
      {/if}
      
    </div>
    
    <!-- Erstellungsdatum -->
    <div>
      {new Date(card.createdAt).toLocaleDateString('de-DE')}
    </div>
  </Card.Footer>
</Card.Root>

<!-- Card Detail Dialog -->
<CardViewDialog bind:open={showDialog} {card} />
```

#### Datei: `src/routes/cardsboard/types.ts` (Echte TypeScript-Definitionen)

```typescript
export type PublishState = 'draft' | 'published' | 'archived';

export interface Comment {
  id: string;
  text: string;
  author: string; // npub
  createdAt: string; // ISO 8601
}

export interface Link {
  id: string;
  url: string;
  title: string;
}

export interface CardType {
  id: string;
  title: string;
  description?: string;
  color?: string;
  labels?: string[];
  comments?: Comment[];
  links?: Link[];
  attendees?: string[]; // npub array
  createdAt: string;
  updatedAt: string;
  publishState: PublishState;
  author?: string; // npub
}

export interface ColumnType {
  id: string;
  name: string;
  color?: string;
  cards: CardType[];
  order: number;
}

export interface BoardState {
  id: string;
  name: string;
  description?: string;
  columns: ColumnType[];
  publishState: PublishState;
  author?: string; // npub
  createdAt: string;
  updatedAt: string;
}
```

## VIII. Test-Suite

Um die korrekte Implementierung der Klassenlogik zu verifizieren, soll der Agent eine Test-Suite in der Datei `src/lib/utils/testSuite.ts` erstellen. Diese Suite soll **kein** externes Test-Framework (wie Jest oder Vitest) verwenden, sondern eine einfache, ausführbare Funktion sein, die den Zustand im Speicher manipuliert und die Ergebnisse über `console.log` ausgibt.

### 8.1 Datei: `src/lib/utils/testSuite.ts`

Die Datei soll eine einzelne exportierbare Funktion `runTestSuite()` enthalten, die alle Kernfunktionen testet **inklusive** der neuen Nostr- und Kommentar-Features.

```typescript
// src/lib/utils/testSuite.ts

import { Board, Chat } from '$lib/classes/BoardModel';
import type { Card, Column } from '$lib/classes/BoardModel';

export function runTestSuite() {
    console.clear();
    console.group("===== KANBAN BOARD TEST SUITE START =====");

    // 1. Board-Erstellung
    console.group("1. Board & Column Management");
    const board = new Board({ name: "Projekt Phoenix", description: "Vollständige Neuentwicklung des Kanban-Boards." });
    console.log("✅ Board erstellt:", board.name);
  
    const todoCol = board.addColumn({ name: "To Do" });
    const progressCol = board.addColumn({ name: "In Arbeit" });
    const doneCol = board.addColumn({ name: "Fertig" });
    console.log("✅ Spalten hinzugefügt:", board.columns.map(c => c.name));
  
    progressCol.update({ name: "In Progress" });
    console.log("✅ Spalte aktualisiert:", progressCol.name);
    console.groupEnd();

    // 2. Card Management
    console.group("2. Card Management");
    const card1 = todoCol.addCard({ heading: "Klassenstruktur definieren", content: "Alle Klassen in TypeScript erstellen." });
    const card2 = todoCol.addCard({ heading: "Svelte Stores einrichten", labels: ["state-management"] });
    console.log(`✅ ${todoCol.cards.length} Karten zur 'To Do'-Spalte hinzugefügt.`);
  
    card1.update({ content: "Alle Klassen in TypeScript mit strikter Typisierung erstellen." });
    console.log("✅ Karte aktualisiert:", card1.content);
  
    card1.addComment("Das ist die wichtigste Aufgabe!", "npub1...");
    console.log("✅ Kommentar hinzugefügt:", card1.comments[0].text);
    console.groupEnd();

    // 3. Board-Level Operationen
    console.group("3a. Board-Level Operations (Move Card)");
    board.moveCard(card1.id, todoCol.id, progressCol.id);
    console.log(`✅ Karte '${card1.heading}' von '${todoCol.name}' nach '${progressCol.name}' verschoben.`);
  
    const found = board.findCardAndColumn(card1.id);
    if (found?.column.id === progressCol.id) {
        console.log("✅ Verifizierung: Karte erfolgreich in der Zielspalte gefunden.");
    } else {
        console.error("❌ Fehler bei der Kartenverschiebung!");
    }
    console.groupEnd();

    console.group("3b. Publish State Management");
     // Test für eine Karte
    const draftCard = todoCol.cards[0];
    if (draftCard.publishState === 'draft') {
        console.log("✅ Karte ist standardmäßig im 'draft'-Modus.");
    } else {
        console.error(`❌ FEHLER: Karte sollte 'draft' sein, ist aber '${draftCard.publishState}'`);
    }
  
    draftCard.setPublishState('published');
    if (draftCard.publishState === 'published') {
        console.log("✅ Karte wurde erfolgreich in den 'published'-Modus versetzt.");
    } else {
        console.error("❌ FEHLER: Karte konnte nicht auf 'published' gesetzt werden.");
    }
  
    // Test für das Board
    if (board.publishState === 'draft') {
        console.log("✅ Board ist standardmäßig im 'draft'-Modus.");
    } else {
        console.error(`❌ FEHLER: Board sollte 'draft' sein, ist aber '${board.publishState}'`);
    }

    board.setPublishState('published');
    if (board.publishState === 'published') {
        console.log("✅ Board wurde erfolgreich in den 'published'-Modus versetzt.");
    } else {
        console.error("❌ FEHLER: Board konnte nicht auf 'published' gesetzt werden.");
    }
    console.groupEnd();

    // 4. KI-Interaktionssimulation
    console.group("4. AI Interaction Simulation");
    const chat = new Chat(board);
    const complexCard = progressCol.addCard({ 
        heading: "Gesamtes UI/UX implementieren", 
        content: "Basiert auf den Figma-Designs. Beinhaltet Drag-and-Drop, Modal-Dialoge und responsive Anpassungen."
    });
  
    console.group("4a. KI-Anfrage senden (sendPromptToAI)");
    console.log("▶️ Simuliere Nutzeranfrage, um eine komplexe Karte aufzuteilen...");
    // Diese Methode sollte das Payload-Objekt in der Konsole ausgeben, um es zu verifizieren
    chat.sendPromptToAI(
        "Teile diese Aufgabe in logische Frontend-Komponenten auf.",
        complexCard
    );
    console.log("✅ Kontext-Payload für die KI wurde erfolgreich generiert und geloggt.");
    console.groupEnd();

    console.group("4b. KI-Antwort verarbeiten (processAIAction)");
    const aiResponseAction = {
        type: 'split_card' as const,
        columnId: progressCol.id,
        sourceCardId: complexCard.id,
        newCards: [
            { heading: "UI: Board-Layout erstellen", labels: ["ui", "layout"] },
            { heading: "Logik: Drag-and-Drop implementieren", labels: ["logik", "dnd"] },
            { heading: "UI: Karten-Modal entwickeln", labels: ["ui", "modal"] }
        ]
    };
    console.log("◀️ Simuliere KI-Antwort mit 'split_card'-Aktion...");
    chat.processAIAction(aiResponseAction);

    const sourceCardExists = !!progressCol.findCard(complexCard.id);
    const newCardsExist = progressCol.cards.some(c => c.heading.includes("UI: Board-Layout"));
    if (!sourceCardExists && newCardsExist) {
        console.log("✅ 'split_card'-Aktion erfolgreich: Alte Karte gelöscht, neue Karten hinzugefügt.");
    } else {
        console.error("❌ Fehler bei der 'split_card'-Aktion!");
    }
    console.log(`Karten in 'In Progress': ${progressCol.cards.length}`);
    console.groupEnd();
    console.groupEnd();
  
    // 5. Löschoperationen
    console.group("5. Deletion Operations");
    const commentId = card1.comments[0].id;
    card1.deleteComment(commentId);
    console.log(`✅ Kommentar gelöscht. Übrige Kommentare: ${card1.comments.length}`);

    progressCol.deleteCard(card1.id);
    console.log(`✅ Karte '${card1.heading}' gelöscht. Übrige Karten in Spalte: ${progressCol.cards.length}`);

    board.deleteColumn(doneCol.id);
    console.log(`✅ Spalte '${doneCol.name}' gelöscht. Übrige Spalten: ${board.columns.length}`);
    console.groupEnd();

    // Abschluss
    console.group("Final State");
    console.log("Der finale Zustand des Boards:");
    console.dir(board.getContextData(true));
    console.groupEnd();
  
    console.groupEnd(); // Ende der Test-Suite
}
```

### 8.2 Erweiterte Tests für Nostr-Integration

Die Test-Suite sollte zusätzlich folgende Szenarien testen:

```typescript
// 6. Nostr Event Serialization
console.group("6. Nostr Event Serialization");
const boardEvent = boardToNostrEvent(board, mockNdk);
console.log("✅ Board serialisiert:", {
    kind: boardEvent.kind,
    tags: boardEvent.tags.length
});

const cardEvent = cardToNostrEvent(
    card1, 
    progressCol.name, 
    0, 
    `30301:npub123:${board.id}`,
    mockNdk
);
console.log("✅ Card serialisiert:", {
    kind: cardEvent.kind,
    tags: cardEvent.tags.length
});
console.groupEnd();

// 7. Offline Queue Simulation
console.group("7. Offline Queue");
const syncManager = new SyncManager(mockNdk);
const queueStatus = syncManager.status;
console.log("✅ SyncManager initialisiert:", queueStatus);
console.groupEnd();

// 8. Comment System
console.group("8. Comment System (Nostr)");
// Simuliert Kommentar-Event
const commentEvent = createCommentEvent(
    "Test Kommentar",
    `30302:npub123:${card1.id}`,
    card1.eventId || "",
    mockNdk
);
console.log("✅ Kommentar-Event erstellt:", {
    kind: commentEvent.kind,
    content: commentEvent.content
});
console.groupEnd();
```

### 8.3 Verwendung der Test-Suite in einer Svelte-Komponente

Der Agent sollte eine einfache Möglichkeit bereitstellen, die Suite auszuführen. Dies kann durch einen Button in der Hauptkomponente `+page.svelte` geschehen.

#### Datei: `src/routes/cardsboard/+page.svelte` (Echte Implementierung)

```svelte
<script lang="ts">
    import * as Resizable from "$lib/components/ui/resizable";
    import Topbar from "./Topbar.svelte";
    import Board from "./Board.svelte";
    import CardSidebar from "./CardSidebar.svelte";
    import { settingsStore } from "$lib/stores/settingsStore";

    // Sidebar-Zustand aus Settings-Store
    let { showLeftSidebar, showRightSidebar } = $settingsStore;
</script>

<!-- Vollbildschirm-Layout ohne Scrollen -->
<div class="h-screen overflow-hidden bg-background">
    <!-- Topbar mit Sidebar-Toggles -->
    <Topbar />
    
    <!-- Resizable Panel-System (3 Panels horizontal) -->
    <Resizable.PaneGroup direction="horizontal" class="h-[calc(100vh-4rem)]">
        
        <!-- Linke Sidebar: Board-Liste (optional, toggle-bar) -->
        {#if showLeftSidebar}
            <Resizable.Pane defaultSize={15} minSize={10} maxSize={40}>
                <div class="h-full bg-muted/30 border-r">
                    <div class="p-4">
                        <h3 class="font-semibold mb-4">Meine Boards</h3>
                        <!-- Board-Liste hier -->
                    </div>
                </div>
            </Resizable.Pane>
            <Resizable.Handle />
        {/if}
        
        <!-- Hauptbereich: Kanban-Board -->
        <Resizable.Pane defaultSize={70} minSize={40}>
            <div class="h-full">
                <Board />
            </div>
        </Resizable.Pane>
        
        <!-- Rechte Sidebar: KI-Agent + Debug (optional, toggle-bar) -->
        {#if showRightSidebar}
            <Resizable.Handle />
            <Resizable.Pane defaultSize={15} minSize={10} maxSize={40}>
                <CardSidebar />
            </Resizable.Pane>
        {/if}
        
    </Resizable.PaneGroup>
</div>
```

#### Datei: `src/routes/cardsboard/Topbar.svelte` (Echte Implementierung)

```svelte
<script lang="ts">
    import * as Sheet from "$lib/components/ui/sheet";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
    import { Button } from "$lib/components/ui/button";
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import SettingsIcon from "@lucide/svelte/icons/settings";
    import UserIcon from "@lucide/svelte/icons/user";
    import { settingsStore } from "$lib/stores/settingsStore";

    function toggleLeftSidebar() {
        settingsStore.toggleLeftSidebar();
    }
    
    function toggleRightSidebar() {
        settingsStore.toggleRightSidebar();
    }
</script>

<!-- Fixed Topbar (4rem height) -->
<header class="h-16 border-b bg-background flex items-center px-4 gap-4">
    
    <!-- Sidebar-Toggles (links) -->
    <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" onclick={toggleLeftSidebar}>
            <PanelLeftIcon class="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="sm" onclick={toggleRightSidebar}>
            <PanelRightIcon class="h-4 w-4" />
        </Button>
    </div>
    
    <!-- Board-Titel (center-left) -->
    <div class="flex-1">
        <h1 class="text-lg font-semibold">Kanban Board</h1>
    </div>
    
    <!-- Actions (rechts) -->
    <div class="flex items-center gap-2">
        
        <!-- Settings Sheet -->
        <Sheet.Root>
            <Sheet.Trigger asChild let:builder>
                <Button builders={[builder]} variant="ghost" size="sm">
                    <SettingsIcon class="h-4 w-4" />
                </Button>
            </Sheet.Trigger>
            <Sheet.Content side="right">
                <Sheet.Header>
                    <Sheet.Title>Board-Einstellungen</Sheet.Title>
                </Sheet.Header>
                <!-- Settings-Inhalt hier -->
            </Sheet.Content>
        </Sheet.Root>
        
        <!-- Profile Dropdown -->
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild let:builder>
                <Button builders={[builder]} variant="ghost" size="sm">
                    <UserIcon class="h-4 w-4" />
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Item>Profil bearbeiten</DropdownMenu.Item>
                <DropdownMenu.Item>Einstellungen</DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item>Logout</DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
        
    </div>
</header>
```

---

## IX. UX-RULES Compliance ✅

Diese Spezifikation wurde entsprechend der **[UX-RULES.md](./UX-RULES.md)** aktualisiert. Alle Komponenten müssen die shadcn-svelte Design Patterns einhalten.

**Siehe auch:**
- **[UX-RULES.md](./UX-RULES.md)** — Vollständige shadcn-svelte Konventionen, Icon-Syntax, Accessibility Standards

### ✅ Korrigierte UI-Komponenten

| Komponente | Vorher (Verstoß) | Nachher (Compliant) | Status |
|------------|------------------|---------------------|--------|
| **Card.svelte** | `<div class="card">` | `<Card.Root>` mit vollständiger Struktur | ✅ |
| **Button-Elemente** | `<button>` | `<Button variant="...">` | ✅ |
| **Formulare** | Direkte `<input>` | `<Field.Root>` Struktur | ✅ |
| **Icons** | Keine Icons | Lucide Icons mit `class="mr-2 h-4 w-4"` | ✅ |
| **Dialog** | Einfaches Modal | `<Dialog.Root>` mit Header/Footer | ✅ |

### ✅ Eingehaltene Regeln

- **Regel 8-10**: Card-Komponente verwendet `Card.Root`, `Card.Header`, `Card.Content`, `Card.Footer`
- **Regel 11-17**: Kommentar-Formular verwendet `Field.Root` Container
- **Regel 18-24**: Dialog-Struktur mit vollständiger Hierarchie
- **Regel 6**: Icons positioniert links vom Text mit korrekten Klassen
- **Icon-Regel**: Lucide Icons statt Emojis oder fehlende Icons

### 📋 Implementierte shadcn-svelte Komponenten

```typescript
// Verwendete UI-Komponenten
import * as Card from "$lib/components/ui/card";
import * as Dialog from "$lib/components/ui/dialog";
import * as Field from "$lib/components/ui/field";
import { Button } from "$lib/components/ui/button";
import { Textarea } from "$lib/components/ui/textarea";
import { Badge } from "$lib/components/ui/badge";
import { Skeleton } from "$lib/components/ui/skeleton";

// Lucide Icons (⚠️ WICHTIG: @lucide/svelte/icons/ Syntax!)
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import TrashIcon from "@lucide/svelte/icons/trash";
import SendIcon from "@lucide/svelte/icons/send";
import LoaderIcon from "@lucide/svelte/icons/loader";
import PlayIcon from "@lucide/svelte/icons/play";
```

### 🎯 Design-Pattern

Das aktualisierte Card.svelte folgt jetzt dem **shadcn-svelte Design-Pattern**:

1. **Card-Struktur**: Header (Titel + Labels), Content (Links), Footer (Actions)
2. **Dialog für Kommentare**: Vollständige Dialog-Hierarchie mit Header/Content/Footer
3. **Formular-Pattern**: Field.Root Container für alle Eingabefelder
4. **Button-Varianten**: `ghost` für sekundäre Aktionen, `default` für primäre Aktionen
5. **Icon-Integration**: Alle Icons von lucide-svelte mit konsistenter Positionierung

### 🎯 Kritische Icon-Import-Syntax

**⚠️ ACHTUNG**: Die korrekte Import-Syntax ist essentiell für die Funktionalität!

```typescript
// ✅ RICHTIG: @lucide/svelte/icons/icon-name
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import TrashIcon from "@lucide/svelte/icons/trash";
import SendIcon from "@lucide/svelte/icons/send";
import KeyRoundIcon from "@lucide/svelte/icons/key-round";

// ❌ FALSCH: Diese Syntax funktioniert NICHT
import MessageSquareIcon from "lucide-svelte/icons/message-square";
import { MessageSquare, Trash, Send } from "lucide-svelte";
```

**Icon-Verwendung im Button:**
```svelte
<Button>
  <MessageSquareIcon class="mr-2 h-4 w-4" />
  Kommentare
</Button>
```
