# Codebase-Analyse: Kanban-Board Status & Roadmap

**Datum:** 17. Oktober 2025  
**Projekt:** Nostr-basiertes KI-Kanban-Board  
**Spezifikation:** AGENTS.md

---

## Executive Summary

Das Projekt befindet sich in einem **frühen bis mittleren Stadium**. Die Kernarchitektur gemäß `AGENTS.md` ist **zu 60-70% implementiert**, aber es fehlen noch wichtige Komponenten für die vollständige KI- und Nostr-Integration.

### ✅ Was ist vorhanden

1. ✅ **Vollständige TypeScript-Klassenstruktur** (`BoardModel.ts`)
2. ✅ **Svelte 5 Store mit Runes** (`kanbanStore.ts`)
3. ✅ **Test-Suite** (`testSuite.ts`)
4. ✅ **ID-Generierung** (`idGenerator.ts`)
5. ✅ **NDK Integration** (bereits in `+layout.svelte`)
6. ✅ **UI-Komponenten** (Cardsboard-Prototyp vorhanden)

### ❌ Was fehlt

1. ❌ **Board.svelte, Column.svelte, Card.svelte** (gemäß AGENTS.md Spec)
2. ❌ **Chatbot.svelte** (KI-Interface)
3. ❌ **Nostr Event Publishing/Subscribing**
4. ❌ **Offline-First Synchronisation**
5. ❌ **Kommentar-System als Nostr Events**

---

## 1. Detaillierte Komponenten-Analyse

### 1.1 Core Data Model ✅ (100% vollständig)

**Datei:** `src/lib/classes/BoardModel.ts` (402 Zeilen)

#### Implementierte Features:

| Klasse    | Status | Methoden | Bemerkungen |
|-----------|--------|----------|-------------|
| `Card`    | ✅ 100% | `constructor`, `update`, `setPublishState`, `addComment`, `deleteComment`, `getContextData` | Vollständig gemäß Spec |
| `Column`  | ✅ 100% | `constructor`, `update`, `addCard`, `deleteCard`, `findCard`, `splitCard`, `getContextData` | Inklusive `splitCard` für KI-Aktion |
| `Board`   | ✅ 100% | `constructor`, `setPublishState`, `addColumn`, `deleteColumn`, `findColumn`, `findCardAndColumn`, `moveCard`, `getContextData` | Alle Methoden vorhanden |
| `Chat`    | ✅ 100% | `constructor`, `addMessage`, `sendPromptToAI`, `processAIAction` | KI-Interface implementiert |

#### Typen & Interfaces:

```typescript
✅ PublishState = 'draft' | 'published' | 'archived'
✅ NostrElement, Comment, Link
✅ CardProps, ColumnProps, BoardProps
✅ AIAction
✅ ChatMessage
```

**Bewertung:** 🟢 Exzellent - Die Klassenstruktur ist vollständig und entspricht der Spezifikation.

---

### 1.2 State Management ✅ (90% vollständig)

**Datei:** `src/lib/stores/kanbanStore.ts` (201 Zeilen)

#### Implementierte Features:

```typescript
✅ class BoardStore mit $state() Rune
✅ Proxy-Methoden für alle Board-Operationen
✅ Chat-Integration vorbereitet
✅ publishToNostr() Stub vorhanden
✅ Exported convenience functions
```

#### Was fehlt:

```typescript
❌ Tatsächliche Nostr-Publikation (nur console.log)
❌ Event-Subscriptions für Live-Updates
❌ Offline-Queue für unpublished events
❌ Conflict Resolution bei Sync
```

**Bewertung:** 🟡 Gut - Struktur vorhanden, aber Nostr-Integration fehlt.

---

### 1.3 Utilities ✅ (100% vollständig)

**Datei:** `src/lib/utils/idGenerator.ts` (30 Zeilen)

```typescript
✅ generateDTag() - Eindeutige IDs
✅ generateMockNpub() - Test-Npubs
✅ generateTimestamp() - ISO 8601
```

**Datei:** `src/lib/utils/testSuite.ts` (153 Zeilen)

```typescript
✅ Komplette Test-Suite
✅ Board & Column Management Tests
✅ Card Management Tests
✅ Move Card Tests
✅ Publish State Tests
✅ AI Interaction Simulation
✅ Deletion Tests
```

**Bewertung:** 🟢 Vollständig implementiert.

---

### 1.4 UI-Komponenten 🔴 (30% vollständig)

#### Vorhanden (in `src/routes/cardsboard/`):

```
✅ +page.svelte - Board-Container (aber nicht gemäß Spec)
✅ Board.svelte - Board-Layout
✅ Column.svelte - Spalten-Darstellung
✅ Card.svelte - Karten-Darstellung
✅ CardDialog.svelte, CardSidebar.svelte - Modal-Dialoge
⚠️  HeaderBar.svelte, Topbar.svelte, SettingsPanel.svelte - Extra Features
```

#### Was fehlt (gemäß AGENTS.md Spec):

```
❌ src/lib/components/Board.svelte (Spec-konform)
❌ src/lib/components/Column.svelte (Spec-konform)
❌ src/lib/components/Card.svelte (Spec-konform)
❌ src/lib/components/Chatbot.svelte
❌ Integration mit boardStore (aktuell nutzt data.ts)
```

**Problem:** Die existierenden Komponenten in `cardsboard/` nutzen ein **eigenes Datenmodell** (`data.ts`) statt `BoardModel.ts` und `kanbanStore.ts`.

**Bewertung:** 🔴 Nicht kompatibel - Die UI muss neu aufgesetzt werden.

---

## 2. Nostr-Integration Analyse

### 2.1 NDK Setup ✅

**Datei:** `src/routes/+layout.svelte`

```svelte
✅ NDKSvelte initialisiert
✅ Relay-Pool konfiguriert (Damus, Primal, nos.lol)
✅ createReactivePool() für Svelte 5
✅ ndk.connect() aufgerufen
```

**Package.json:**
```json
✅ "@nostr-dev-kit/ndk": "2.14.2"
✅ "@nostr-dev-kit/svelte": "^2.0.8"
```

### 2.2 Event-Schema Mapping

| AGENTS.md Konzept | Kanban-NIP Mapping | Status |
|-------------------|-------------------|--------|
| Board             | Kind 30301        | ❌ Nicht implementiert |
| Column            | `col` tag in 30301 | ❌ Nicht implementiert |
| Card              | Kind 30302        | ❌ Nicht implementiert |
| Comment           | Kind 1 (NIP-10) oder Kind 42 | ❌ Nicht implementiert |
| publishState      | Custom tag?       | ❌ Nicht spezifiziert |

**Bewertung:** 🔴 Nostr-Events werden noch nicht erstellt/publiziert.

---

## 3. Offline-First Konzept

### 3.1 Anforderungen

Gemäß Ihrer Frage: **"Kann der User offline arbeiten und bei Reconnect synchronisieren?"**

**Antwort:** Ja, das ist möglich. Hier die Strategie:

#### Architektur-Vorschlag:

```
┌─────────────────────────────────────────────┐
│         Browser (Client)                     │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  UI Layer (Svelte Components)          │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  BoardStore ($state + $derived)        │ │
│  │  - Lokaler Zustand (sofort reaktiv)    │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  Sync Manager                          │ │
│  │  - Event Queue (IndexedDB)             │ │
│  │  - Online/Offline Detection            │ │
│  │  - Conflict Resolution                 │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  NDK + Cache (IndexedDB)               │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                    ↕
       ┌───────────────────────┐
       │  Nostr Relays         │
       │  (wenn online)        │
       └───────────────────────┘
```

#### Implementierungs-Schritte:

1. **Lokaler Cache (IndexedDB):**
   - Nutze `svelte-persisted-store` ODER
   - NDK's `NDKCacheAdapterDexie`

2. **Event Queue:**
   - Alle Änderungen erzeugen NDKEvents
   - Bei Offline: Events in Queue speichern
   - Bei Online: Queue abarbeiten

3. **Conflict Resolution:**
   - Last-Write-Wins (via `created_at`)
   - ODER: Merge-Strategie (Split in neue Cards)

### 3.2 Code-Beispiel (Erweiterung von kanbanStore.ts)

```typescript
import { persisted } from 'svelte-persisted-store';
import { NDKEvent } from '@nostr-dev-kit/ndk';

export class BoardStore {
  private board = $state(/* ... */);
  
  // Event Queue für Offline-Änderungen
  private eventQueue = persisted<SerializedEvent[]>('event-queue', []);
  
  // Online-Status
  private isOnline = $state(navigator.onLine);
  
  constructor(private ndk: NDK) {
    // Online/Offline Listener
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    
    // Initial Sync
    if (this.isOnline) {
      this.loadFromNostr();
    }
  }
  
  public moveCard(cardId: string, fromColId: string, toColId: string) {
    // 1. Lokale Änderung (sofort sichtbar)
    this.board.moveCard(cardId, fromColId, toColId);
    
    // 2. Event erstellen
    const event = this.createCardUpdateEvent(cardId);
    
    // 3. Publish oder Queue
    if (this.isOnline) {
      this.publishEvent(event);
    } else {
      this.queueEvent(event);
    }
  }
  
  private async publishEvent(event: NDKEvent) {
    try {
      const relays = await event.publish();
      console.log(`Published to ${relays.size} relays`);
    } catch (error) {
      console.error('Publish failed, queueing:', error);
      this.queueEvent(event);
    }
  }
  
  private queueEvent(event: NDKEvent) {
    this.eventQueue.update(queue => [
      ...queue,
      event.serialize()
    ]);
  }
  
  private async syncQueue() {
    const queue = get(this.eventQueue);
    
    for (const serialized of queue) {
      const event = new NDKEvent(this.ndk, JSON.parse(serialized));
      
      try {
        await event.publish();
        
        // Erfolgreich: Aus Queue entfernen
        this.eventQueue.update(q => 
          q.filter(e => e !== serialized)
        );
      } catch (error) {
        console.error('Sync failed for event:', error);
        break; // Stop bei erstem Fehler
      }
    }
  }
  
  private async loadFromNostr() {
    // Board laden
    const boardEvent = await this.ndk.fetchEvent({
      kinds: [30301],
      authors: [this.currentUser.pubkey],
      '#d': [this.board.id]
    });
    
    if (boardEvent) {
      this.deserializeBoardEvent(boardEvent);
    }
    
    // Cards laden
    const cardEvents = await this.ndk.fetchEvents({
      kinds: [30302],
      '#a': [`30301:${this.currentUser.pubkey}:${this.board.id}`]
    });
    
    for (const cardEvent of cardEvents) {
      this.deserializeCardEvent(cardEvent);
    }
  }
}
```

**Bewertung:** 🟡 Konzept ist machbar, aber noch nicht implementiert.

---

## 4. Kommentar-System

### 4.1 Gemäß Kanban-NIP

Kommentare werden als **separate Nostr Events** (Kind 1 oder Kind 42) behandelt:

```typescript
{
  kind: 1, // Text note
  tags: [
    ["e", "<card-event-id>", "", "reply"],
    ["p", "<card-author-pubkey>"],
    ["a", "30302:<author>:<card-d-tag>"]
  ],
  content: "Das ist mein Kommentar"
}
```

### 4.2 Implementierungs-Strategie

#### Option A: Kind 1 (Text Notes)
- ✅ Standard Nostr-Kommentare
- ✅ Kompatibel mit allen Clients
- ❌ Schwieriger zu filtern

#### Option B: Kind 42 (NIP-22 Channel Messages)
- ✅ Dediziert für Kommentare
- ✅ Einfacher zu filtern
- ❌ Weniger Client-Support

**Empfehlung:** Kind 1 mit `["a", "30302:..."]` tag.

### 4.3 Code-Beispiel

```typescript
// In Card-Klasse
async loadComments(ndk: NDK): Promise<Comment[]> {
  const filter = {
    kinds: [1],
    '#a': [`30302:${this.author}:${this.id}`]
  };
  
  const events = await ndk.fetchEvents(filter);
  
  return Array.from(events).map(event => ({
    id: event.id,
    text: event.content,
    author: event.pubkey,
    createdAt: new Date(event.created_at * 1000).toISOString()
  }));
}

async addNostrComment(ndk: NDK, text: string): Promise<void> {
  const event = new NDKEvent(ndk);
  event.kind = 1;
  event.content = text;
  event.tags = [
    ["a", `30302:${this.author}:${this.id}`],
    ["p", this.author]
  ];
  
  await event.publish();
  
  // Lokalen Zustand aktualisieren
  this.addComment(text, event.pubkey);
}
```

**Bewertung:** 🔴 Noch nicht implementiert.

---

## 5. Gap-Analyse: AGENTS.md vs. Aktuelle Codebasis

| Komponente | AGENTS.md Spec | Aktueller Status | Priorität |
|------------|----------------|------------------|-----------|
| **BoardModel.ts** | ✅ Vollständig | ✅ Implementiert | - |
| **kanbanStore.ts** | ✅ Vollständig | 🟡 90% (fehlt Nostr) | 🔴 HOCH |
| **Board.svelte** | ✅ Spec-konform | ❌ Fehlt | 🔴 HOCH |
| **Column.svelte** | ✅ Spec-konform | ❌ Fehlt | 🔴 HOCH |
| **Card.svelte** | ✅ Spec-konform | ❌ Fehlt | 🔴 HOCH |
| **Chatbot.svelte** | ✅ KI-Interface | ❌ Fehlt | 🟡 MITTEL |
| **Nostr Events** | ✅ Publishing | ❌ Nicht implementiert | 🔴 HOCH |
| **Offline-Sync** | Impliziert | ❌ Nicht implementiert | 🟡 MITTEL |
| **Kommentare** | Nicht erwähnt | ❌ Nicht spezifiziert | 🟢 NIEDRIG |

---

## 6. Anpassungen an AGENTS.md

### 6.1 Empfohlene Ergänzungen

Die `AGENTS.md` sollte erweitert werden um:

#### 1. Nostr-Integration Sektion

```markdown
## VII. Nostr Integration

### Event-Struktur

Siehe [Kanban-NIP.md](./Kanban-NIP.md) für Details.

- **Board:** Kind 30301 (Parametrized Replaceable Event)
- **Card:** Kind 30302 (Parametrized Replaceable Event)
- **Comment:** Kind 1 (Text Note) mit `a`-tag Referenz

### Offline-First Architektur

- Lokaler State mit `$state()` Runes
- Event Queue für nicht-publizierte Änderungen
- IndexedDB Cache via NDK
- Automatische Synchronisation bei Reconnect

Siehe [NDK.md](./NDK.md) für Implementierungs-Details.
```

#### 2. Kommentar-System Spezifikation

```markdown
### Comment Management

Kommentare werden als separate Nostr Events (Kind 1) gespeichert:

```typescript
interface NostrComment extends Comment {
  eventId: string; // Nostr Event ID
  tags: string[][]; // Nostr tags
}
```

**Card-Klasse erweitern:**

```typescript
class Card {
  // Bestehende Methoden...
  
  async loadCommentsFromNostr(ndk: NDK): Promise<void>
  async addCommentToNostr(ndk: NDK, text: string): Promise<void>
  async deleteCommentFromNostr(ndk: NDK, commentId: string): Promise<void>
}
```
```

#### 3. Sync-Strategie

```markdown
## VIII. Synchronisation & Konfliktauflösung

### Last-Write-Wins Strategie

Bei Konflikten gewinnt das Event mit dem neuesten `created_at` Timestamp.

### Merge-Strategie (Alternative)

Bei gleichzeitigen Änderungen:
1. Beide Versionen werden als separate Cards angelegt
2. User erhält Benachrichtigung über Konflikt
3. Manuelle Zusammenführung durch User
```

### 6.2 Aktualisierte Datei-Liste

```markdown
## V. Zu liefernde Dateien (AKTUALISIERT)

| Datei | Beschreibung | Status |
|-------|-------------|--------|
| `src/lib/utils/idGenerator.ts` | ID-Generierung | ✅ |
| `src/lib/classes/BoardModel.ts` | Core-Klassen | ✅ |
| `src/lib/stores/kanbanStore.ts` | Svelte 5 Stores | 🟡 |
| `src/lib/stores/syncManager.ts` | **NEU: Offline-Sync** | ❌ |
| `src/lib/utils/nostrEvents.ts` | **NEU: Event Serialization** | ❌ |
| `src/routes/+page.svelte` | Hauptlayout | 🟡 |
| `src/lib/components/Board.svelte` | Board-Container | ❌ |
| `src/lib/components/Column.svelte` | Spalten-Komponente | ❌ |
| `src/lib/components/Card.svelte` | Karten-Komponente | ❌ |
| `src/lib/components/Chatbot.svelte` | KI-Interface | ❌ |
| `src/lib/utils/testSuite.ts` | Test-Suite | ✅ |
| **`NDK.md`** | **NEU: NDK Dokumentation** | ✅ |
```

---

## 7. Roadmap & Empfohlene Vorgehensweise

### Phase 1: Nostr-Grundlagen (1-2 Wochen)

```
✅ 1. NDK Setup (bereits erledigt)
⏳ 2. Event Serialization/Deserialization implementieren
⏳ 3. BoardStore um Nostr-Publish erweitern
⏳ 4. Subscriptions für Live-Updates
⏳ 5. Testen mit echten Relays
```

### Phase 2: UI-Komponenten (2-3 Wochen)

```
⏳ 1. Board.svelte (gemäß Spec)
⏳ 2. Column.svelte (gemäß Spec)
⏳ 3. Card.svelte (gemäß Spec)
⏳ 4. Integration mit boardStore
⏳ 5. Drag-and-Drop funktional
```

### Phase 3: Offline-First (1-2 Wochen)

```
⏳ 1. Event Queue implementieren
⏳ 2. Online/Offline Detection
⏳ 3. Sync Manager
⏳ 4. Conflict Resolution
⏳ 5. Testen mit Offline-Szenarien
```

### Phase 4: KI-Integration (2-3 Wochen)

```
⏳ 1. Chatbot.svelte UI
⏳ 2. AI-Prompt-Generation
⏳ 3. processAIAction erweitern
⏳ 4. split_card Logik testen
⏳ 5. KI-Server-Anbindung (WebSocket/HTTP)
```

### Phase 5: Kommentare & Erweiterte Features (1 Woche)

```
⏳ 1. Kommentar-System als Nostr Events
⏳ 2. Attachments (Links, Images)
⏳ 3. Labels & Filtering
⏳ 4. Permissions (Maintainers)
```

---

## 8. Kritische Entscheidungen

### 8.1 Existierende Cardsboard-Komponenten

**Frage:** Was tun mit `src/routes/cardsboard/`?

**Optionen:**

1. **Neustart:** Cardsboard löschen, neu nach Spec bauen
   - ✅ Saubere Architektur
   - ❌ Arbeit geht verloren

2. **Migration:** Cardsboard auf BoardModel migrieren
   - ✅ Bestehende UI-Arbeit erhalten
   - ❌ Refactoring-Aufwand

3. **Parallel:** Beide Versionen behalten
   - ✅ Flexibilität
   - ❌ Code-Duplikation

**Empfehlung:** Option 2 (Migration) - Die UI ist gut, nur Datenmodell muss angepasst werden.

### 8.2 Kommentar-Architektur

**Frage:** Lokal oder immer aus Nostr laden?

**Option A:** Kommentare immer frisch aus Nostr laden
- ✅ Immer aktuell
- ❌ Performance-Impact

**Option B:** Kommentare lokal cachen, mit Subscription
- ✅ Schneller
- ✅ Offline verfügbar
- ❌ Komplexer

**Empfehlung:** Option B mit reaktiven Subscriptions.

### 8.3 PublishState vs. Nostr

**Problem:** `publishState: 'draft' | 'published' | 'archived'` ist nicht im Kanban-NIP.

**Lösungen:**

1. **Custom Tag:** `["state", "draft"]` in Events
2. **Lokaler State:** Nur Client-seitig
3. **Separate Events:** Draft-Events nicht publishen

**Empfehlung:** Option 1 - Custom Tag für Kompatibilität.

---

## 9. Zusammenfassung & Nächste Schritte

### Status: 🟡 60% Complete

**Was funktioniert:**
- ✅ Vollständige TypeScript-Klassenstruktur
- ✅ Svelte 5 State Management
- ✅ NDK Setup
- ✅ Test-Suite

**Was fehlt:**
- ❌ Nostr Event Publishing/Subscribing
- ❌ Spec-konforme UI-Komponenten
- ❌ Offline-Sync
- ❌ Chatbot

### Empfohlene Nächste Schritte:

1. **SOFORT:**
   - ✅ NDK.md Dokumentation erstellen (erledigt)
   - ✅ AGENTS.md um Nostr-Sektion erweitern (erledigt)
   
2. **DIESE WOCHE:**
   - ⏳ Event Serialization implementieren (`src/lib/utils/nostrEvents.ts`)
   - ⏳ `publishToNostr()` in kanbanStore richtig implementieren
   
3. **NÄCHSTE WOCHE:**
   - ⏳ Board.svelte, Column.svelte, Card.svelte gemäß Spec
   - ⏳ Migration von cardsboard-Daten zu BoardModel
   
4. **DANACH:**
   - ⏳ Offline-Sync Manager
   - ⏳ Chatbot-UI
   - ⏳ KI-Server-Integration

---

## 10. Ressourcen & Dokumentation

- ✅ [AGENTS.md](./AGENTS.md) - Projekt-Spezifikation
- ✅ [Kanban-NIP.md](./Kanban-NIP.md) - Nostr Event Schema
- ✅ [NDK.md](./NDK.md) - NDK Integration Guide (NEU)
- 📦 [NDK Docs](https://github.com/nostr-dev-kit/ndk)
- 📦 [Nostr NIPs](https://github.com/nostr-protocol/nips)

---

**Fazit:** Das Projekt hat ein solides Fundament, aber die Nostr-Integration ist der kritische Pfad zum MVP.
