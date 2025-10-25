# Copilot Instructions für Kanban-Board Projekt

**Projekt:** Nostr-basiertes KI-Kanban-Board mit Svelte 5  
**Repository:** edufeed-org/kanban-editor  
**Letztes Update:** 25. Oktober 2025  
**Status:** Phase 1 (In Entwicklung)

---

## 📚 DOKUMENTATIONS-REGELN (KRITISCH!)

### 🔴 RULE #0: Dokumentation IMMER in `/docs` speichern!

**Keine Ausnahmen! Alle neuen Dokumente gehören in `/docs`.**

```
❌ FALSCH:  archive/NEUES-FEATURE.md
❌ FALSCH:  root/FEATURE-GUIDE.md
❌ FALSCH:  src/docs/something.md

✅ RICHTIG: docs/ARCHITECTURE/FEATURE.md
✅ RICHTIG: docs/GUIDES/FEATURE.md
✅ RICHTIG: docs/FEATURE/FEATURE.md
```

---

### 🔴 RULE #1: EIN THEMA = EIN DOKUMENT (nicht 5!)

**KEINE Fragmentierung! Nicht:**

```
❌ docs/STORES-QUICKSTART.md
❌ docs/STORES-SUMMARY.md
❌ docs/STORES-MAP.md
❌ docs/STORES-COMPLETED.md
❌ docs/STORES-IMPLEMENTATION.md
❌ docs/STORES-DOCS-INDEX.md

✅ docs/ARCHITECTURE/STORES.md
   (Enthält: Quickstart + Summary + Map + Implementation + alles!)
```

**Warum?**
- 🧠 Entwickler finden Infos schneller (eine Datei, nicht 5 durchsuchen)
- 🔗 Verlinkung ist einfach (`docs/ARCHITECTURE/STORES.md`, nicht `docs/STORES-*/`)
- 📖 Bessere Dokumentations-Struktur in `/docs/_INDEX.md`
- 🎯 Zielgerichtet: Alles zum Thema an EINEM Ort

---

### 🔴 RULE #2: Zielgerichtet schreiben

**Struktur für JEDES Dokument:**

```markdown
# THEMA

## I. Übersicht (Was?)
- Zweck des Dokuments
- Wer braucht das?
- 30-Sekunden-Zusammenfassung

## II. Quick Start (Wie schnell?)
- 5 min Copy-Paste Beispiel
- Häufigster Use Case
- "Hello World" der Funktionalität

## III. Detaillierte Dokumentation (Warum? Wie genau?)
- Vollständige API Reference
- Alle Methoden/Konfigurationen
- Edge Cases & Fehler

## IV. Häufige Fehler (Was kann schiefgehen?)
- Faq
- Debugging Guide
- Lösungen für 80% aller Fehler

## V. Referenzen (Wo sind Details?)
- Links zu verwandten Docs
- External Resources
- Best Practices
```

**Beispiel: docs/ARCHITECTURE/STORES.md**
```
# STORES - State Management mit Svelte 5

## I. Übersicht (30 sec)
AuthStore, BoardStore, SettingsStore — alle mit $state Runes

## II. Quick Start (5 min)
```typescript
import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
boardStore.createCard(columnId, heading);
```

## III. Detaillierte Dokumentation
- AuthStore persisted() Pattern
- BoardStore reaktive Cascade
- SettingsStore Defaults

## IV. Häufige Fehler
- triggerUpdate() vergessen?
- Falsche Property-Pfade?

## V. Referenzen
Siehe: ARCHITECTURE/REACTIVITY.md für Runes Basics
```

---

### 🟡 RULE #3: Neue Docs in `/docs/_INDEX.md` verlinken

**Wenn du ein neues Dokument erstellst:**

1. Erstelle die Datei in `/docs/ARCHITECTURE/`, `/docs/GUIDES/` oder `/docs/FEATURE/`
2. **Öffne `/docs/_INDEX.md`**
3. Füge einen Link hinzu im passenden Bereich:
   - Architektur-Docs? → `ARCHITECTURE/`
   - Wie-mache-ich-X Guides? → `GUIDES/`
   - Feature-Spezifikation? → `FEATURE/`
   - Collaborations-Themen? → `COLLABORATION/`
4. Update die Tabelle (Dateiname, Zweck, Status, Datum)

**Beispiel:**

```markdown
# docs/_INDEX.md

### ARCHITECTURE/ (12 Dateien)

| Datei | Zweck | Status |
|-------|-------|--------|
| [`STORES.md`](./ARCHITECTURE/STORES.md) | State Management | ✅ |
| [`MY-NEW-TOPIC.md`](./ARCHITECTURE/MY-NEW-TOPIC.md) | NEW TOPIC HERE | ✅ Neu (25.10.) |  ← ADD THIS LINE
```

---

### 🟢 RULE #4: Struktur der `/docs` Ordner

**Verwende diese Ordner-Struktur IMMER:**

```
docs/
├── _INDEX.md                    ← Zentrale Navigation (MUSS aktualisiert werden!)
│
├── ARCHITECTURE/                ← Technische Konzepte & Patterns
│   ├── STORES.md               (State Management)
│   ├── REACTIVITY.md           (Svelte 5 Runes)
│   ├── NDK.md                  (Nostr Integration)
│   └── ... (weitere technische Topics)
│
├── GUIDES/                      ← How-to & Schritt-für-Schritt
│   ├── QUICK-START.md          (5 min Einstieg)
│   ├── AUTHSTORE-INTEGRATION-GUIDE.md
│   ├── Kanban-NIP.md          (Event Schema)
│   └── ... (weitere Guides)
│
├── FEATURE/                     ← Feature-spezifische Dokumentation
│   ├── COMMENTS.md            (Kommentar-System)
│   └── ... (weitere Features)
│
├── COLLABORATION/              ← Organisatorisches & Roadmap
│   ├── ROADMAP.md             (Phasen & Meilensteine)
│   ├── CONTRIBUTING.md        (Contribution Richtlinien)
│   └── ... (weitere Collaboration Topics)
│
└── TESTSUITE/                  ← Test-Dokumentation
    ├── INDEX.md               (Test Navigation)
    ├── GUIDE.md              (Wie teste ich?)
    └── ... (weitere Test Docs)
```

**KEINE neuen Top-Level Ordner ohne gute Begründung!**

---

### 🟢 RULE #5: Dokumentation ist Arbeit am Code!

**Wenn du Code schreibst → schreibe auch Dokumentation!**

```
Feature hinzugefügt? 
  → Neue Datei in docs/FEATURE/ oder docs/GUIDES/
  → Verlink in docs/_INDEX.md
  → Update CHANGELOG.md

Bug gefixt?
  → Nicht nur Code fixen, auch docs/ update
  → Explizite Fehlerursache dokumentieren

Architektur geändert?
  → Betroffene Docs überprüfen & update
  → Cross-Reference aktualisieren
```

---

### 📋 CHECKLIST: Neue Dokumentation hinzufügen

```markdown
## Neue Doc erstellen?

- [ ] 1. Thema definieren: "Worum geht es?"
- [ ] 2. Ordner wählen: ARCHITECTURE/ oder GUIDES/ oder FEATURE/?
- [ ] 3. Dateiname: NUR EINES pro Datei! (nicht 5 Splits)
- [ ] 4. Struktur: I. Übersicht, II. Quick Start, III. Details, IV. Fehler, V. Referenzen
- [ ] 5. In docs/_INDEX.md verlinken (Tabelle + Navigation)
- [ ] 6. Timestamp hinzufügen: "✅ Neu (25.10.)"
- [ ] 7. Cross-References überprüfen: Andere Docs müssen darauf verlinken?
- [ ] 8. Test: Kann ein neuer Entwickler diese Datei verstehen?
- [ ] 9. CI/CD: Funktioniert die Verlinkung? (Link Checker?)
- [ ] 10. Committed: Mit Message "docs: Add THEME documentation"
```

---

### 🚫 HÄUFIGE FEHLER

| Fehler | Problem | Lösung |
|--------|---------|--------|
| **Docs in root/** | Nicht zentralisiert | Alles nach `/docs/` verschieben |
| **5 Docs für 1 Thema** | Unübersichtlich | In 1 Datei zusammenfassen |
| **Nicht in `_INDEX.md`** | Verloren / Unsichtbar | Immer verlinken! |
| **Keine Struktur** | Schwer zu lesen | I. Übersicht, II. Quick Start, etc. |
| **Zu ausschweifend** | Entwickler lesen nur 50% | Zielgerichtet: Quick Start first |
| **Keine Cross-Links** | Fragmente statt System | Immer auf verwandte Docs verlinken |

---

---

## 🎯 Projektübersicht

Wir bauen ein **KI-gesteuertes Kanban-Board** mit **Offline-First Funktionalität** und **dezentraler Speicherung via Nostr**. Für AI-Agenten kritisch zu verstehen:

- **Svelte 5 Runes** (nicht Svelte 4!) mit striktem `.svelte.ts` Convention
- **Klassische Architektur**: `BoardModel.ts` → `BoardStore` → UI-Komponenten
- **Nostr Integration**: Events als Source-of-Truth (NIP-30301/30302)
- **Offline-First**: IndexedDB Queue mit Retry-Logik (Dexie)

### Kritische Abhängigkeitskette
```
BoardModel.ts (Core)
  ├→ Board, Column, Card, Chat Klassen
  ├→ getContextData() für KI-Kontext
  └→ PublishState & Interfaces
    ↓
kanbanStore.svelte.ts (State)
  ├→ $state für board + updateTrigger
  ├→ $derived.by für uiData
  ├→ triggerUpdate() für Persistierung
  └→ publishToNostr() für Sync
    ↓
UI-Komponenten (Svelte)
  ├→ Board.svelte, Column.svelte, Card.svelte
  ├→ CardDialog.svelte, CardViewDialog.svelte
  ├→ shadcn-svelte Komponenten (@lucide/svelte/icons/*)
  └→ $effect für Auto-Sync mit boardStore.uiData
```

**OHNE diese Abhängigkeitskette funktioniert nichts!**

---

## 📋 Schnell-Referenz für Häufige Aufgaben

### ✅ Neue Karte erstellen
```typescript
// RICHTIG: Via BoardStore (mit triggerUpdate Cascade)
const cardId = boardStore.createCard('column-id', 'Titel', 'Beschreibung');
// → boardStore.createCard()
//   → board.findColumn().addCard() [Model-Layer]
//   → triggerUpdate() [CRITICAL!]
//   → updateTrigger++ [triggers $derived]
//   → uiData recalculates [new UIColumn[]]
//   → Column.svelte $effect detects change [items prop updated]
//   → Card.svelte re-renders [UI zeigt neue Karte]

// FALSCH: Direkt Board/Column nutzen - KEINE Reaktivität!
const column = board.findColumn('col-id');
const card = column.addCard({heading: '...'});
// ❌ triggerUpdate() nicht aufgerufen!
// ❌ localStorage nicht aktualisiert
// ❌ uiData nicht recalculated
// ❌ $effect nicht triggered
// ❌ UI zeigt keine neue Karte!
```

### ✅ Spalten-Name ändern (mit persistency)
**Folge:** PROP-UPDATE-GUIDE.md 5-Schritt Checkliste
1. Store-Methode: `boardStore.updateColumn(colId, { name: newName })`
   - ❌ NICHT: `board.findColumn(colId).update()` direkt aufrufen!
2. Handler in Component: `handleRename()` ruft **Store** auf (nicht board!)
3. Store ruft `board.findColumn().update()` auf
4. Store ruft `triggerUpdate()` auf (CRITICAL!)
   - Dies inkrementiert `updateTrigger` → triggert $derived
5. `$effect` in Column.svelte überwacht `boardStore.uiData` und synced lokale Props
6. localStorage wird automatisch via `triggerUpdate()` gespeichert
7. (Später) Nostr-Event wird via `publishToNostr()` gesendet

### ✅ Kommentar hinzufügen (via Store!)
```typescript
// RICHTIG
await boardStore.addComment(cardId, 'Mein Kommentar');
// → boardStore.addComment()
//   → card.addComment() [Model-Layer]
//   → triggerUpdate() [CRITICAL!]
//   → Reactivity cascade…
//   → Card.svelte re-renders mit neuem Kommentar

// FALSCH: Direkt auf Card-Instanz
card.addComment('Text', 'npub1...');
// ❌ triggerUpdate() nicht aufgerufen!
// ❌ UI wird nicht aktualisiert!
// ❌ localStorage nicht gespeichert!
```

### ✅ Karte zwischen Spalten verschieben (DnD)
```typescript
// Nach DnD-Finalize in Board.svelte:
boardStore.syncBoardState(newUIColumns); // Atomic 3-Step Sync
// → Spalten-Reihenfolge aktualisiert
// → triggerUpdate() aufgerufen (CRITICAL!)
// → Reactivity cascade
// → UI synchronisiert
// → localStorage aktualisiert
```

### ✅ UI-Icons verwenden
```typescript
// RICHTIG (UX-RULES.md konform)
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
<Button class="group">
  <MessageSquareIcon class="mr-2 h-4 w-4" />
  Kommentare
</Button>

// FALSCH
import { MessageSquare } from "lucide-svelte"; // ← Syntax falsch!
<Button>💬 Kommentare</Button> // ← Emoji statt Icon!
```

---

## 🏗️ Architektur-Muster

### 1. **Svelte 5 Runes Pattern** (`.svelte.ts` MANDATORY!)

**Datei MUSS `.svelte.ts` sein** für reaktive Stores:
```typescript
// ✅ src/lib/stores/kanbanStore.svelte.ts
export class BoardStore {
    private board = $state(this.loadFromStorage()); // ← $state Rune
    private updateTrigger = $state(0);
    
    public uiData = $derived.by(() => {
        const cols = this.board.columns; // ← Dependency tracking
        const trigger = this.updateTrigger;
        // Transform zu UI-Format
        return cols.map(c => ({ id: c.id, name: c.name, items: [...] }));
    });
    
    private triggerUpdate() {
        this.updateTrigger++; // ← Triggert $derived Neuberechnung
        this.saveToStorage(); // ← Synchron!
    }
}
```

**Kritische Punkte:**
- ✅ `$state()` für mutable Variablen (z.B. `board`, `columnOrder`)
- ✅ `$derived.by()` für berechnete Werte
- ✅ Array-Reassignments: `array = [...array, item]` statt `.push()`
- ✅ updateTrigger als Fallback-Dependency
- ✅ `.svelte.ts` Datei-Endung NICHT optional!

### 2. **BoardModel Klassen-Pattern**

**Datei:** `src/lib/classes/BoardModel.ts`
```typescript
export class Card {
    // Properties als public (keine getter/setter)
    public id: string;
    public heading: string;
    public comments: Comment[] = [];
    
    constructor(props: CardProps) {
        this.id = props.id || generateDTag();
        // Alle Props via Props-Interface
    }
    
    update(props: Partial<CardProps>): void {
        if (props.heading !== undefined) this.heading = props.heading;
        this.updatedAt = generateTimestamp(); // MUSS beim Update gesetzt werden
    }
    
    // KI-Kontext Serialisierung (WICHTIG!)
    getContextData(): Omit<CardProps, ...> {
        return {
            id: this.id,
            heading: this.heading,
            comments: this.comments.map(c => ({ text: c.text, author: c.author })),
            // ← Keine Klasseninstanzen! Nur Plain Objects für KI
        };
    }
}

export class Column {
    addCard(props: CardProps): Card {
        const card = new Card(props);
        this.cards = [...this.cards, card]; // ← Array Reassignment!
        return card;
    }
}

export class Board {
    findCardAndColumn(cardId): { card: Card; column: Column } | null {
        // Sucht eine Karte im gesamten Board
        // Wird von Store für findCard() verwendet
    }
}
```

**Kritische Punkte:**
- ✅ Alle Klassen haben `getContextData()` für KI-Serialisierung
- ✅ Array-Mutationen via Reassignment (z.B. `this.cards = [...]`)
- ✅ `updatedAt` IMMER beim Update setzen
- ✅ Keine komplexen Computed Properties - Store macht Transformation

### 3. **Store → UI Sync Pattern** (mit $effect)

**Datei:** `src/routes/cardsboard/Column.svelte`
```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    
    // Props von parent
    let { column } = $props();
    
    // Lokale reaktive State
    let items = $state(column.items || []);
    
    // $effect überwacht boardStore.uiData und synced lokale Props
    $effect(() => {
        const uiColumns = boardStore.uiData; // ← Dependency tracking
        const updated = uiColumns.find(c => c.id === column.id);
        
        if (updated && JSON.stringify(updated.items) !== JSON.stringify(items)) {
            console.log('🔄 Items synced from store');
            items = updated.items; // ← Auto-Sync
        }
    });
</script>

<slot cards={items} />
```

**Kritische Punkte:**
- ✅ `$effect` beobachtet `boardStore.uiData` (nicht einzelne Cards!)
- ✅ Lokale `items` State wird from Store synced
- ✅ DnD-Handler sollte `boardStore.syncBoardState()` aufrufen (nicht lokale Mutations)
- ✅ UI-Zustand (Farbe, Name) wird nie lokal geändert - immer über Store!

### 4. **Offline-First Sync Pattern** (SyncManager mit Dexie)

**Datei:** `src/lib/stores/syncManager.ts` (Zu erstellen!)
```typescript
export class SyncManager {
    private eventQueue = $state<QueuedEvent[]>([]); // ← IndexedDB persistence
    private isOnline = $state(navigator.onLine);
    
    public async publishOrQueue(event: NDKEvent, type: 'board' | 'card'): Promise<void> {
        if (this.isOnline) {
            try {
                await this.publishEvent(event); // ← Try to publish
            } catch (error) {
                this.queueEvent(event, type); // ← Fallback to queue
            }
        } else {
            this.queueEvent(event, type); // ← Queue when offline
        }
    }
    
    private async syncQueue(): Promise<void> {
        // Retry-Logik: 2^retries Backoff
        for (const event of this.eventQueue) {
            try {
                await this.publishEvent(event);
                // Remove on success
            } catch (error) {
                event.retries++;
                if (event.retries >= 3) {
                    // Dead-letter: delete after 3 attempts
                }
                break; // Stop on first error
            }
        }
    }
}
```

**Kritische Punkte:**
- ✅ `isOnline` State wird von window.online/offline Events gesetzt
- ✅ Retry-Logik: `wait = 2^retries * 1000`
- ✅ Dead-Letter Pattern: Nach 3 Versuchen löschen
- ✅ Stop-on-First-Error: Verhindert Überlastung

---

## 🎨 UI-Komponenten (shadcn-svelte Convention)

**ALLE UI muss shadcn-svelte Patterns folgen!** (Siehe UX-RULES.md)

### Komponenten-Struktur

```svelte
<!-- ✅ RICHTIG -->
<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import MessageSquareIcon from "@lucide/svelte/icons/message-square";
</script>

<Card.Root class="hover:shadow-md transition-shadow">
    <Card.Header>
        <Card.Title class="text-sm font-medium">Titel</Card.Title>
        <Card.Description class="text-xs">Beschreibung</Card.Description>
    </Card.Header>
    <Card.Content>
        <!-- Inhalt -->
    </Card.Content>
    <Card.Footer class="flex justify-between">
        <Button class="group" variant="ghost">
            <MessageSquareIcon class="mr-2 h-4 w-4" />
            Kommentare
        </Button>
    </Card.Footer>
</Card.Root>
```

### Icon-Import Syntax (KRITISCH!)

```typescript
// ✅ RICHTIG
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
import KeyRoundIcon from "@lucide/svelte/icons/key-round";
import UserIcon from "@lucide/svelte/icons/user";

// ❌ FALSCH (funktioniert NICHT)
import { MessageSquare, KeyRound, User } from "lucide-svelte";
import MessageSquareIcon from "lucide-svelte";
```

---

## 📂 Projektstruktur & Key Files

```
src/
├── lib/
│   ├── classes/
│   │   └── BoardModel.ts          ✅ Core: Board, Column, Card, Chat Klassen
│   ├── stores/
│   │   ├── kanbanStore.svelte.ts  ✅ Svelte 5 $state/$derived Store
│   │   ├── settingsStore.ts       🟡 MUSS zu .svelte.ts konvertiert werden
│   │   ├── authStore.svelte.ts    ⏳ TODO: Nostr Auth (NIP-07)
│   │   └── syncManager.ts         ⏳ TODO: Offline-First Queue
│   ├── utils/
│   │   ├── idGenerator.ts         ✅ generateDTag(), generateTimestamp()
│   │   ├── nostrEvents.ts         ⏳ TODO: boardToNostrEvent(), cardToNostrEvent()
│   │   └── testSuite.ts           ✅ runTestSuite() für lokales Testing
│   └── components/
│       ├── ui/                    ✅ shadcn-svelte (Button, Card, Dialog, etc.)
│       ├── CardEditModal.svelte   🟡 Ggf. zu CardDialog.svelte mergen
│       └── Kind1PostCreationForm.svelte
├── routes/
│   ├── +layout.svelte             ✅ Root layout + NDK init
│   ├── +page.svelte               ✅ Landing page
│   └── cardsboard/
│       ├── +page.svelte           🟡 Board page + DnD
│       ├── Board.svelte           🟡 DnD container
│       ├── Column.svelte          🟡 Mit $effect sync
│       ├── Card.svelte            🟡 Mit CardDialog integration
│       ├── CardDialog.svelte      🟡 Edit modal
│       ├── CardViewDialog.svelte  🟡 View modal
│       ├── types.ts               🟡 Sollte durch BoardModel ersetzt werden
│       ├── data.ts                🟡 Mock-Daten (zu entfernen)
│       └── ...

AGENTS.md                          ← Technische Spezifikation (MANDATORY!)
STORES.md                          ← Svelte 5 Store-Architektur
PROP-UPDATE-GUIDE.md               ← Dynamische Prop-Updates (5-Schritt Guide)
NOSTR-USER.md                      ← Benutzerauthentifizierung
NDK.md                             ← Nostr Development Kit
Kanban-NIP.md                      ← Event Schema (NIP-30301/30302)
UX-RULES.md                        ← shadcn-svelte Guidelines
```

---

## 🔌 Integration Points

### Nostr Publishing

**Via:** `src/lib/utils/nostrEvents.ts` (TODO - Phase 1.1)

```typescript
// Zu implementieren:
export function boardToNostrEvent(board: Board, ndk: NDK): NDKEvent { ... }
export function cardToNostrEvent(card: Card, columnName: string, rank: number, boardRef: string, ndk: NDK): NDKEvent { ... }
export function createCommentEvent(text: string, cardRef: string, cardEventId: string, ndk: NDK): NDKEvent { ... }

// Event Kinds (Kanban-NIP.md):
// - Kind 30301: Board Event (Parametrized Replaceable)
// - Kind 30302: Card Event (Parametrized Replaceable)
// - Kind 1: Comment (Regular Note)
```

### NDK Context (Zu initialisieren in +layout.svelte)

```typescript
// Zu implementieren:
export let ndk: NDK;

// Im +layout.ts:
import NDK from "@nostr-dev-kit/ndk";
ndk = new NDK({ explicitRelayUrls: [...] });
await ndk.connect();
```

### Benutzerauthentifizierung (Phase 1.4 - authStore.svelte.ts)

```typescript
// Zu implementieren:
export class AuthStore {
    private user = $state<NDKUser | null>(null);
    
    async loginWithNIP07() {
        // NIP-07 Signer integration
    }
}
```

---

## 🧪 Testing & Debugging

### Test-Suite lokal ausführen
```typescript
import { runTestSuite } from '$lib/utils/testSuite';
runTestSuite(); // Output in Browser-Konsole

// Tests aktuell abdecken:
// ✅ Board + Column + Card Management
// ✅ Card-Verschiebungen (moveCard)
// ✅ PublishState Management
// ✅ KI-Interaktion (Chat.split_card)
// ✅ Kommentar-System
// ❌ Nostr Event Serialisierung (TODO)
// ❌ Offline-Sync (TODO)
```

### Build Commands
```bash
pnpm run dev          # Dev server mit HMR
pnpm run build        # Production build
pnpm run test:unit    # Vitest unit tests
pnpm run test:e2e     # Playwright E2E tests
pnpm run check        # svelte-check + TypeScript
pnpm run lint         # ESLint
```

---

## ⚠️ Häufige Fehler & Lösungen

### Fehler 1: Store-State wird nicht reaktiv aktualisiert
**Problem:** Änderung in `boardStore.board` wird nicht in UI reflektiert
```typescript
// ❌ FALSCH
column.cards.push(newCard); // Mutation ohne Reassignment

// ✅ RICHTIG
column.cards = [...column.cards, newCard]; // Array Reassignment
this.triggerUpdate(); // Inkrementiert updateTrigger → triggert $derived
```

### Fehler 2: Komponente zeigt alte Daten nach Card-Update
**Problem:** `$effect` wird nicht ausgelöst
```typescript
// ❌ FALSCH - $effect beobachtet nur updateTrigger, nicht boardStore.uiData
$effect(() => {
    console.log(boardStore.data); // Zu granular!
});

// ✅ RICHTIG
$effect(() => {
    const uiColumns = boardStore.uiData; // Beobachtet $derived.by() Wert
    items = uiColumns.find(c => c.id === columnId)?.items || [];
});
```

### Fehler 3: Icon wird nicht angezeigt (oder hat Wrong Syntax)
**Problem:** Falsche Import-Syntax
```typescript
// ❌ FALSCH
import { MessageSquare } from "lucide-svelte"; // ← Default export!
import MessageSquareIcon from "lucide-svelte/icons/message-square"; // ← Falsch!

// ✅ RICHTIG
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
```

### Fehler 4: Store ist nicht persisted nach Reload
**Problem:** `triggerUpdate()` wurde nicht aufgerufen
```typescript
// ❌ FALSCH
public createCard(columnId: string, name: string) {
    const col = this.board.findColumn(columnId);
    if (col) col.addCard({heading: name});
    // Kein triggerUpdate()! → Nicht gespeichert!
}

// ✅ RICHTIG
public createCard(columnId: string, name: string) {
    const col = this.board.findColumn(columnId);
    if (col) {
        col.addCard({heading: name});
        this.triggerUpdate(); // ← Speichert zu localStorage
    }
}
```

### Fehler 5: `.svelte.ts` Datei ist `.ts` statt `.svelte.ts`
**Problem:** Compiler erkennt `$state` nicht
```typescript
// ❌ FALSCH: kanbanStore.ts
export class BoardStore {
    private board = $state(...); // ← COMPILER ERROR: $ is not defined!
}

// ✅ RICHTIG: kanbanStore.svelte.ts
export class BoardStore {
    private board = $state(...); // ← OK! Compiler transformiert Rune
}
```

### Fehler 6: Prop-Mutation Warning in Component (NEW - CRITICAL!)
**Problem:** "ownership_invalid_mutation" Warning in Card.svelte nach $effect Update
```typescript
// ❌ FALSCH - Mutiert Prop direkt
$effect(() => {
    card.name = newValue;  // ← ownership_invalid_mutation Warning!
    card.color = newColor; // ← Forbidden!
});

// ✅ RICHTIG - Lokale State Variablen nutzen
let localName = $state(card.name);
let localColor = $state(card.color || 'slate');

$effect(() => {
    if (nameChanged) {
        localName = card.name; // ← OK! Update nur lokale State
    }
    if (colorChanged) {
        localColor = card.color || 'slate'; // ← OK!
    }
});

// Template nutzt lokale Variablen, NICHT card Props
<input bind:value={localName} />                           // ← RICHTIG
<div class:draft={localPublishState === 'draft'} />       // ← RICHTIG
```

**Warum:** Svelte 5 strict ownership model:
- Props gehören dem **Parent** (z.B. Column.svelte)
- Child (z.B. Card.svelte) darf Props **NICHT mutieren**
- Nur Parent darf `card = {...}` reassignieren
- Child darf nur lokale `$state` Variablen mutieren

### Fehler 7: Timestamp-Vergleich verwendet String statt Number (NEW - CRITICAL!)
**Problem:** ISO-String Timestamps werden direkt verglichen → falsches Ergebnis!
```typescript
// ❌ FALSCH - String-Vergleich funktioniert NICHT für Timestamps!
const timestamp = data.lastAccessedAt || data.updatedAt || 0;
if (timestamp > mostRecentTime) {  // ← String-Vergleich statt numerisch!
    mostRecentTime = timestamp;
}

// ✅ RICHTIG - ISO-String zu Timestamp konvertieren
const lastAccessed = data.lastAccessedAt || data.updatedAt;
const timestamp = lastAccessed 
    ? (typeof lastAccessed === 'string' 
        ? new Date(lastAccessed).getTime()  // ← Parse zu Number!
        : lastAccessed)
    : 0;

if (timestamp > mostRecentTime) {  // ← Numerischer Vergleich ✓
    mostRecentTime = timestamp;
}
```

**Warum:** ISO-Strings (z.B. `"2025-10-21T12:20:00.000Z"`) werden lexikographisch verglichen, nicht numerisch!

**Beispiel Bug:**
- Board A: `lastAccessedAt: "2025-10-21T12:20:00Z"` → als String: `"2025-10-21T12:20:00Z"`
- Board B: `lastAccessedAt: "2025-10-21T11:30:00Z"` → als String: `"2025-10-21T11:30:00Z"`
- String-Vergleich: `"2025-10-21T12:20:00Z" > "2025-10-21T11:30:00Z"` → funktioniert **zufällig**
- ABER: `"2025-10-21T09:00:00Z" > "2025-10-21T11:00:00Z"` → **FALSE** (weil String-Vergleich Zeichen-weise!)

**Lösung:** IMMER `new Date(isoString).getTime()` für numerischen Vergleich verwenden!

---

## 🔐 Security First Pattern (KRITISCH!)

### ⚠️ **CRITICAL: Prop-Mutationen in Svelte 5 sind VERBOTEN**

```typescript
// ❌ FALSCH - Wird ownership_invalid_mutation Warning werfen!
// In Card.svelte $effect:
$effect(() => {
    card.name = newName;          // ← MUTATION! Forbidden!
    card.color = newColor;        // ← MUTATION! Forbidden!
    card.publishState = 'draft';  // ← MUTATION! Forbidden!
});

// ✅ RICHTIG - Lokale State Variablen nutzen
let localName = $state(card.name);
let localColor = $state(card.color || 'slate');
let localPublishState = $state(card.publishState);

$effect(() => {
    // Nur lokale Variablen UPDATEN, nicht Prop!
    if (cardNameChanged) {
        localName = card.name;
    }
    if (cardColorChanged) {
        localColor = card.color || 'slate';
    }
});

// Template nutzt lokale Variablen:
<input bind:value={localName} />      // ← OK
<div class:draft={localPublishState === 'draft'} /> // ← OK
```

**Warum?** Svelte 5 Runes verwenden strict ownership model:
- Parent komponenten **dürfen nicht** den State von Props direkt mutieren
- Die Karte (Card Prop) gehört dem Parent (Column)
- Nur der Parent darf `card = {...}` reassignieren
- Child (Card.svelte) darf nur lokale `$state` Variablen mutieren

**Consequence wenn ignoriert:**
- 🔴 Runtime Warning: "ownership_invalid_mutation"
- 🔴 Unpredictable behavior
- 🔴 Data consistency broken
- 🔴 Build wird fehlschlagen mit `pnpm run check`

**Pattern zur Vermeidung (Card.svelte Template):**
```svelte
<script lang="ts">
  let { card } = $props();  // ← Read-only Prop!
  
  // Lokale State für Editing
  let localName = $state(card.name);
  let localColor = $state(card.color || 'slate');
  
  function handleSave() {
    // Store-API aufrufen (nicht card mutieren!)
    boardStore.updateCard(card.id, {
      heading: localName,
      color: localColor
    });
  }
</script>

<input bind:value={localName} />
<button onclick={handleSave}>Speichern</button>
```

### Private Key Handling (aus NOSTR-USER.md)

**⚠️ NIEMALS diese Fehler machen:**
```typescript
// ❌ FALSCH - Private Keys NIEMALS speichern!
localStorage.setItem('nsec', nsec);  // ← SICHERHEITSLECK!
const session = { pubkey, nsec };     // ← SICHERHEITSLECK!
console.log('User key:', nsec);       // ← EXPOSURE!

// ✅ RICHTIG - Nur pubkey speichern
localStorage.setItem('pubkey', pubkey);
const session = { pubkey, expires: Date.now() + 7*24*60*60*1000 };
// nsec wird nach Signer-Erstellung sofort verworfen
```

### Session Management
- ✅ **Session Expiration**: 7 Tage (IndexedDB mit TTL)
- ✅ **Automatic Cleanup**: Abgelaufene Sessions löschen
- ✅ **Only pubkey persistent**: Private Keys NIE in Storage
- ✅ **Error Messages clean**: Keine sensiblen Daten exponieren

### Authentifizierungs-Optionen (Priorität)
```typescript
// 1. PRIMÄR: NIP-07 Browser Extension (sicherste Option)
if (window.nostr) {
    const signer = new NDKNip07Signer();
}

// 2. DEVELOPMENT: nsec Private Key (nur lokal!)
if (process.env.PUBLIC_ENABLE_NSEC_LOGIN === 'true') {
    // ⚠️ Nur in Development!
    const signer = new NDKPrivateKeySigner(nsec);
}

// 3. FUTURE: NIP-46 Remote Signing (hohe Sicherheit)
// const signer = new NDKNip46Signer(relayUrl, remotePubkey);
```

### Production Security Checklist
```markdown
## Pre-Deployment Security Check

- [ ] ✅ HTTPS enforced (KEINE HTTP URLs in Production)
- [ ] ✅ nsec-Login disabled (PUBLIC_ENABLE_NSEC_LOGIN=false)
- [ ] ✅ CSP Headers konfiguriert (Content Security Policy)
- [ ] ✅ URL-Validierung für externe Resources (Profile Pictures!)
- [ ] ✅ Error Messages ohne sensitive Daten
- [ ] ✅ Session Expiration getestet (7 Tage)
- [ ] ✅ Logout funktioniert vollständig (Session + Storage clearen)
- [ ] ✅ NIP-07 Extension Check funktioniert (window.nostr Existenz)
- [ ] ✅ Profile Picture URLs werden validiert (HTTPS + Domain Whitelist)
- [ ] ✅ NIP-05 Verifikation funktioniert (optional)
- [ ] ✅ Keine console.log() mit sensiblen Daten
- [ ] ✅ Signer-Validierung bei jedem Event-Signing
```

### URL-Validierung für externe Content
```typescript
// ✅ RICHTIG: Validiere Profile Picture URLs
function sanitizeImageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        // Nur HTTPS erlauben
        if (parsed.protocol !== 'https:') return '';
        // Optional: Domain Whitelist prüfen
        return url;
    } catch {
        return ''; // Fehlerhafte URL = keine Anzeige
    }
}
```

---

## 🏗️ Storage Architecture Deep Dive

### Die 3-Layer Storage Pattern (aus MULTI-LAYER STORAGE.md)

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: UI (Svelte Components)                        │
│  Liest: boardStore.uiData ($derived)                    │
│  Schreibt: Benutzer-Interaktionen → Handler → Store     │
└─────────────────────────────────────────────────────────┘
                    ↕ ($effect Sync)
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Single Source of Truth (BoardStore)           │
│  ├─ board = $state(Board-Instance) ← CENTRAL STATE     │
│  ├─ _columnOrder = $state (immutable for DnD safety)    │
│  ├─ updateTrigger = $state (reactivity trigger)         │
│  ├─ uiData = $derived.by (UI transformation)            │
│  ├─ triggerUpdate() → Layer 3a (localStorage)           │
│  ├─ publishToNostr() → Layer 3b (async)                 │
│  └─ syncBoardState() → atomic persistence               │
└─────────────────────────────────────────────────────────┘
                ↙         ↓         ↘
    ┌─────────────┐ ┌─────────────┐ ┌──────────────────┐
    │ 3a.Nostr    │ │ 3b. Queue   │ │ 3c.localStorage  │
    │ Events      │ │ (IndexedDB) │ │ Cache (immediate)│
    │ (30301/3030 │ │ Offline     │ │ Sync on update   │
    │             │ │ fallback    │ │ 5-10KB typical   │
    └─────────────┘ └─────────────┘ └──────────────────┘
```

### Storage Decision Tree (für jede Datenspeicherung)

**Frage 1: Muss es über Browser-Neustarts hinweg erhalten bleiben?**
- ❌ Nein → `$state` im Component (transient)
- ✅ Ja → Layer 2 oder 3

**Frage 2: Ist es globaler State, den mehrere Komponenten brauchen?**
- ❌ Nein → `$state` im Component (lokal)
- ✅ Ja → `BoardStore ($state)` (Global + persistent)

**Frage 3: Ist es sensitive Session-Daten?**
- ✅ Ja → IndexedDB mit Expiration + TTL (AuthStore)
- ❌ Nein → localStorage ist OK (BoardStore)

**Frage 4: Muss es dezentral synchronisiert werden?**
- ❌ Nein → localStorage reicht (schnell + einfach)
- ✅ Ja → SyncManager Queue → Nostr Events

### Critical: isDragging Guard (prevents $effect loops)

```typescript
// Board.svelte - IMMER dieser Pattern!
let isDragging = $state(false);

$effect(() => {
    // Nur wenn NICHT dragging: synchronisiere Spalten
    if (!isDragging) {
        // Reorder logic here
        boardStore.syncBoardState(newColumns);
    }
});

function handleDndConsider(e) {
    isDragging = true;  // PAUSE: Keine $effect Updates während Drag!
    columns = e.detail.items;
}

function handleDndFinalize(e) {
    isDragging = false; // RESUME: Jetzt sync zum Store
    // ... finalization
}
```

**Grund**: Ohne `isDragging` würde `$effect` während DnD ständig triggern und Spalten zurücksetzen → Broken UX!

### SettingsStore Konversion (noch offen!)

**Status:** 🟡 MUSS zu `.svelte.ts` konvertiert werden

```typescript
// ❌ ALT: settingsStore.ts (Svelte 4 writable - DEPRECATED!)
export const settingsStore = writable<SettingsState>(defaults);

// ✅ NEU: settingsStore.svelte.ts (Svelte 5 Runes)
export class SettingsStore {
    private settings = $state<SettingsState>(defaults);
    
    public get data() {
        return this.settings;
    }
    
    public setMaxCardsBeforeScroll(value: number) {
        this.settings.maxCardsBeforeScroll = value;
        this.saveToStorage();
    }
    
    private saveToStorage() {
        localStorage.setItem('kanban-settings', JSON.stringify(this.settings));
    }
}

export const settingsStore = new SettingsStore();

// In Components:
let settings = $derived(settingsStore.data);
```

---

## 🔌 NDK Integration Patterns (aus NDK.md)

### NDK Initialisierung (in +layout.svelte)

```typescript
// ✅ RICHTIG: Explizite Relay-URLs (nicht auto-discover!)
import NDK from "@nostr-dev-kit/ndk";

let ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.primal.net',
        'wss://nos.lol'
    ],
    // Optional: Cache mit IndexedDB für Performance
    // cacheAdapter: new NDKCacheAdapter({ ...options })
});

await ndk.connect();
export { ndk };
```

### Event Publishing Pattern

```typescript
// ✅ RICHTIG: Event signieren & publizieren
const event = new NDKEvent(ndk);
event.kind = 30301; // Board Event
event.tags = [
    ["d", board.id],
    ["title", board.name],
    // ... weitere tags
];
event.content = "";

// Signieren mit authentifiziertem Signer
const relays = await event.publish();
console.log(`✅ Published to ${relays.size} relays`);

// ❌ FALSCH: Publish ohne Signer
if (!event.pubkey) {
    throw new Error('Event not signed! Set NDK signer first!');
}
```

### Event Subscription Pattern (für Live-Updates)

```typescript
// ✅ RICHTIG: Subscribe mit closeOnEose: false (persistent!)
const subscription = ndk.subscribe(
    {
        kinds: [30301],                      // Board Events
        authors: [currentUserPubkey],
        ["d"]: [boardId]                     // d-tag filter
    },
    { closeOnEose: false }                   // ← Wichtig!
);

subscription.on('event', (event: NDKEvent) => {
    console.log('📥 Board updated:', event);
    // Update local state
    boardStore.handleNostrUpdate(event);
});

subscription.on('eose', () => {
    console.log('✅ Initial load complete');
});

// ❌ FALSCH: closeOnEose: true (subscription beendet sich!)
// const subscription = ndk.subscribe({...}, { closeOnEose: true });
```

### Relay-Failover (automatisch via NDK)

```typescript
// NDK handled Relay-Failover automatisch
// Wenn ein Relay ausfällt, wird zu nächstem versucht
// Kein manuelles Error-Handling nötig!

// Optional: Monitor Relay-Status
ndk.on('relay:connect', (relay) => {
    console.log(`🟢 Connected to ${relay.url}`);
});

ndk.on('relay:disconnect', (relay) => {
    console.log(`🔴 Disconnected from ${relay.url}`);
});
```

---

## 🎯 Meilenstein & Phase Awareness

**KRITISCH:** Jede neue Feature muss sich in den ROADMAP.md Phasen/Meilenstein orientieren!

### Bevor du Code schreibst: Frage dich selbst

```
1️⃣ Welche Phase bin ich?
   → Phase 1: Foundation (in progress)
   → Phase 2: UI Components (planned)
   → Phase 3: KI-Integration (planned)

2️⃣ Welcher Meilenstein?
   → Phase 1.1: Nostr Event Publishing (in progress)
   → Phase 1.2: Offline-First Sync
   → Phase 1.3: Kommentar-System
   → Phase 1.4: User Authentication
   → Phase 1.5: Export/Import (CRITICAL!)

3️⃣ Acceptance Criteria erfüllt?
   → Checklist aus ROADMAP.md durchgehen!
   → NICHT implementieren, was nicht gefordert ist!

4️⃣ Tests geschrieben?
   → Unit Tests (Vitest)
   → E2E Tests (Playwright)
   → Acceptance Criteria validiert?

5️⃣ Abhängigkeiten gelöst?
   → STORES.md: Alle Store-Änderungen?
   → NDK.md: Event-Publishing korrekt?
   → NOSTR-USER.md: Auth implementiert?
   → UX-RULES.md: UI konform?
```

### Phase 1.5 ist KRITISCH (Export/Import)

Diese Feature ist **förderrelevant** und muss in Phase 1-4 umgesetzt werden!

```typescript
// Store-Level Export/Import API

// ✅ Export: Board zu JSON serialisieren
const boardJson = boardStore.exportBoard(); // → Full Board.getContextData(true)

// ✅ Import: JSON validieren & importieren
const result = await boardStore.importBoard(boardJson, 'merge');
// Modes:
// - 'merge': Neue IDs für importierte Objekte (konfliktfrei)
// - 'overwrite': Bestehende Board ersetzen (Warnung!)

// ✅ Round-Trip Test
const exported = boardStore.exportBoard();
await boardStore.importBoard(exported, 'overwrite');
// Board sollte identisch sein!
```

---

## ⚡ Acceptance Criteria Template

**IMMER mit diesen Kriterien arbeiten (aus ROADMAP.md):**

```markdown
## Meilenstein: [Name] (Phase X.Y)

### Acceptance Criteria
- ✅ [Kriterium 1]: [Konkrete Messung/Test]
- ✅ [Kriterium 2]: [Konkrete Messung/Test]
- ✅ [Kriterium 3]: [Konkrete Messung/Test]

### Abhängigkeiten
- [ ] [Feature X] muss vorher erledigt sein
- [ ] [Document Y] muss gelesen sein
- [ ] [Service Z] muss verfügbar sein

### Tests Required
- [ ] Unit Tests (Vitest): [Was wird getestet?]
- [ ] E2E Tests (Playwright): [Benutzer-Szenarios]
- [ ] Integration Tests: [Store + Components]
- [ ] Security Tests: [Relevante Security-Checks]

### Definition of Done
- [ ] Alle Acceptance Criteria erfüllt
- [ ] Alle Tests grün
- [ ] Code-Review durchgeführt
- [ ] Dokumentation aktualisiert
```

---

## 📚 Dokumentations-Referenzen

**Lesen Sie diese Dateien IMMER in dieser Reihenfolge bei komplexen Features:**

1. **AGENTS.md** — Gesamte technische Spezifikation (Startpunkt für alle Features)
2. **STORES.md** — State Management Pattern (bei Hinzufügung von neuem Store-State)
3. **MULTI-LAYER STORAGE.md** — 3-Layer Architecture & Datenfluss (⭐ KRITISCH!)
4. **PROP-UPDATE-GUIDE.md** — Dynamische Prop-Änderungen (bei UI-Edits)
5. **UX-RULES.md** — UI-Komponenten (vor Komponenten-Entwicklung)
6. **NOSTR-USER.md** — Authentifizierung & Security (⭐ KRITISCH!)
7. **NDK.md** — NDK Integration Patterns (bei Event Publishing)
8. **Kanban-NIP.md** — Event Schema (bei Nostr-Integration)
9. **ROADMAP.md** — Phasen & Meilensteine (vor Feature-Umsetzung)

**Dependency Graph lesen:** README.md → Documentation Map

---

## 🎯 Phase & Meilensteine

**Projekt wird in Phasen entwickelt** (siehe ROADMAP.md):

- **Phase 1** (Aktuell 🔴): Foundation + Nostr Publishing
  - 1.1: Event Publishing
  - 1.2: Offline-First Sync Manager
  - 1.3: Kommentar-System
  - 1.4: User Authentication
- **Phase 2** (Geplant 🟡): UI Components & UX Polish
- **Phase 3** (Geplant ⚪): KI-Integration

**Jede Feature sollte diese Phasen NICHT überspringen!**

---

## � Rule Violations & Enforcement

**KRITISCH:** Diesen Abschnitt lesen, bevor Sie Code schreiben! 

### ⚠️ Häufige Regelver­stöße & wie man sie erkennt

#### **Violation 1: `.ts` statt `.svelte.ts` für Stores mit `$state`**

```typescript
// 🛑 VIOLATION DETECTED:
// src/lib/stores/myStore.ts mit $state/$derived
export class MyStore {
    private data = $state(...); // ← COMPILER ERROR!
}

// ✅ FIX:
// 1. Datei umbenennen: myStore.ts → myStore.svelte.ts
// 2. Compiler wird es dann transformieren
// 3. Import aktualisieren: 
//    import { myStore } from '.../myStore.svelte.js';
```

**Rule verletzt:** "Svelte 5 Runes Pattern" (`.svelte.ts` Konvention)  
**Wo dokumentiert:** STORES.md, MULTI-LAYER STORAGE.md  
**Wie erkennen:** Compiler-Fehler "$ is not defined"

---

#### **Violation 2: Array-Mutationen ohne Reassignment**

```typescript
// 🛑 VIOLATION DETECTED:
this.cards.push(newCard);          // Mutation ohne Reassignment
column.cards.splice(0, 1);         // Direkter Array-Zugriff
board.columns = [];                // Falscher Store-Update

// ✅ FIX:
this.cards = [...this.cards, newCard];
column.cards = column.cards.filter((c, i) => i !== 0);
this.board = new Board({...});     // Via triggerUpdate()
this.triggerUpdate();              // MUSS folgen!
```

**Rule verletzt:** "Array-Mutationen = Reassignments (Kritisch!)"  
**Wo dokumentiert:** MULTI-LAYER STORAGE.md, BoardModel.ts  
**Wie erkennen:** UI aktualisiert sich nicht, $effect wird nicht getriggert  
**Consequence:** ❌ Keine Reaktivität, ❌ localStorage nicht gespeichert

---

#### **Violation 3: triggerUpdate() nicht aufgerufen**

```typescript
// 🛑 VIOLATION DETECTED:
public createCard(columnId: string, name: string) {
    const col = this.board.findColumn(columnId);
    if (col) {
        col.addCard({heading: name});
        // triggerUpdate() vergessen!
    }
}

// ✅ FIX:
public createCard(columnId: string, name: string) {
    const col = this.board.findColumn(columnId);
    if (col) {
        col.addCard({heading: name});
        this.triggerUpdate(); // ← ESSENTIAL!
    }
}
```

**Rule verletzt:** "triggerUpdate() immer nach Board-Änderungen aufrufen"  
**Wo dokumentiert:** STORES.md, Fehler 4  
**Wie erkennen:** Daten sind lokal sichtbar aber nach Reload weg  
**Consequence:** ❌ localStorage nicht aktualisiert, ❌ Nostr nicht publiziert

---

#### **Violation 4: Private Keys in Storage speichern**

```typescript
// 🛑 VIOLATION DETECTED (SECURITY CRITICAL!):
localStorage.setItem('nsec', nsec);
const session = { pubkey, nsec };
console.log('User key:', nsec);

// ✅ FIX:
localStorage.setItem('pubkey', pubkey);
const session = { pubkey, expires: Date.now() + 7*24*60*60*1000 };
// nsec wird nach Signer-Erstellung sofort verworfen
```

**Rule verletzt:** "Security First Pattern - Private Key Handling"  
**Wo dokumentiert:** NOSTR-USER.md, Security Checklist  
**Severity:** 🔴 **CRITICAL** - Sicherheitsleck!  
**Consequence:** ❌ Private Keys exponiert, ❌ Accounts gehackt

---

#### **Violation 5: Icon-Import Syntax falsch**

```typescript
// 🛑 VIOLATION DETECTED:
import { MessageSquare } from "lucide-svelte";
import MessageIcon from "lucide-svelte/icons/message-square";

// ✅ FIX:
import MessageSquareIcon from "@lucide/svelte/icons/message-square";
```

**Rule verletzt:** "Icon-Import Syntax (KRITISCH!)" (UX-RULES.md)  
**Wo dokumentiert:** UX-RULES.md Rule G, copilot-instructions  
**Wie erkennen:** Icon wird nicht angezeigt oder Runtime-Fehler  
**Consequence:** ❌ Icons nicht sichtbar, ❌ UI-Bruch

---

#### **Violation 6: $effect beobachtet falschen Wert**

```typescript
// 🛑 VIOLATION DETECTED:
$effect(() => {
    console.log(boardStore.data); // Zu granular!
    // oder noch schlimmer:
    console.log(boardStore.updateTrigger); // Nur Trigger, nicht Board!
});

// ✅ FIX:
$effect(() => {
    const uiColumns = boardStore.uiData; // ← Ganzer $derived Wert
    const updatedColumn = uiColumns.find(c => c.id === columnId);
    if (updatedColumn && ...changed) {
        items = updatedColumn.items;
    }
});
```

**Rule verletzt:** "Store → UI Sync Pattern (mit $effect)"  
**Wo dokumentiert:** PROP-UPDATE-GUIDE.md, Fehler 2  
**Wie erkennen:** $effect wird nicht aufgerufen bei Updates  
**Consequence:** ❌ UI zeigt alte Daten, ❌ Sync-Probleme

---

#### **Violation 7: isDragging Guard vergessen (DnD)**

```typescript
// 🛑 VIOLATION DETECTED:
$effect(() => {
    // Ohne isDragging-Check!
    const uiColumns = boardStore.uiData;
    boardStore.syncBoardState(uiColumns);
});

function handleDndFinalize(e) {
    columns = e.detail.items;
    // Während Drag würde $effect triggern und Spalten zurücksetzen!
}

// ✅ FIX:
let isDragging = $state(false);

$effect(() => {
    if (!isDragging) { // ← GUARD!
        const uiColumns = boardStore.uiData;
        boardStore.syncBoardState(uiColumns);
    }
});

function handleDndConsider() {
    isDragging = true;
}

function handleDndFinalize(e) {
    isDragging = false;
    columns = e.detail.items;
}
```

**Rule verletzt:** "Critical: isDragging Guard (prevents $effect loops)"  
**Wo dokumentiert:** MULTI-LAYER STORAGE.md, Board.svelte  
**Consequence:** ❌ DnD broken, ❌ Spalten springen zurück, ❌ Broken UX

---

#### **Violation 8: Keine Acceptance Criteria geprüft**

```typescript
// 🛑 VIOLATION DETECTED:
// Feature "Kommentare" implementiert ohne:
// - Phase/Meilenstein zu prüfen (Phase 1.3?)
// - Acceptance Criteria aus ROADMAP.md zu kennen
// - Tests zu schreiben

// ✅ FIX:
// 1. ROADMAP.md öffnen → Phase 1.3 suchen
// 2. Acceptance Criteria lesen und abhaken:
//    - [ ] Kommentare als Kind 1 Events publiziert
//    - [ ] Kommentare haben korrekte Tags (a, p, e)
//    - [ ] Kommentar-Löschung erzeugt Kind 5 Event
//    - [ ] Neue Kommentare erscheinen in Echtzeit
// 3. Tests schreiben für alle Criteria
// 4. ERST DANN implementieren
```

**Rule verletzt:** "Meilenstein & Phase Awareness"  
**Wo dokumentiert:** ROADMAP.md, Acceptance Criteria Template  
**Consequence:** ❌ Feature nicht förderrelevant, ❌ Falsche Implementierung

---

#### **Violation 9: NDK ohne explicitRelayUrls**

```typescript
// 🛑 VIOLATION DETECTED:
const ndk = new NDK();
// oder
const ndk = new NDK({ relayUrls: [] }); // Auto-discover!

// ✅ FIX:
const ndk = new NDK({
    explicitRelayUrls: [
        'wss://relay.damus.io',
        'wss://relay.primal.net',
        'wss://nos.lol'
    ]
});
await ndk.connect();
```

**Rule verletzt:** "NDK mit explicitRelayUrls"  
**Wo dokumentiert:** NDK.md, NDK Integration Patterns  
**Consequence:** ❌ Unkontrollierte Relay-Verbindungen, ❌ Performance-Probleme

---

#### **Violation 10: Event Subscription mit closeOnEose: true**

```typescript
// 🛑 VIOLATION DETECTED:
const subscription = ndk.subscribe(
    { kinds: [30301], authors: [pubkey] },
    { closeOnEose: true } // ← FALSCH!
);
// Subscription beendet sich nach Initial Load!

// ✅ FIX:
const subscription = ndk.subscribe(
    { kinds: [30301], authors: [pubkey] },
    { closeOnEose: false } // ← PERSISTENT!
);
// Live-Updates kommen jetzt rein
```

**Rule verletzt:** "Event Subscriptions: closeOnEose: false"  
**Wo dokumentiert:** NDK.md, NDK Integration Patterns  
**Consequence:** ❌ Keine Live-Updates, ❌ Multiplayer-Sync broken

---

### 📋 **Enforcement Checklist vor dem Commit**

Bevor du Code commitst, prüfe diese Checklist:

```markdown
## Pre-Commit Checklist

### TypeScript/Svelte
- [ ] Alle `.svelte.ts` Dateien haben `.svelte.ts` Endung (nicht `.ts`)
- [ ] Array-Operationen sind Reassignments: `array = [...]`
- [ ] `triggerUpdate()` wird nach Board-Änderungen aufgerufen
- [ ] `$effect` beobachtet `boardStore.uiData` (nicht granulare Werte)
- [ ] DnD-Handler haben `isDragging` Guard

### Icons & UI
- [ ] Icon-Imports: `@lucide/svelte/icons/icon-name` Syntax
- [ ] Keine Emojis statt Icons (🔑 → KeyRoundIcon)
- [ ] shadcn-svelte Komponenten-Struktur korrekt
- [ ] Button-Varianten: `default`, `outline`, `ghost`, `destructive`

### Security
- [ ] ❌ Keine Private Keys in localStorage/Props
- [ ] ✅ Nur pubkey gespeichert
- [ ] ✅ Session Expiration implementiert
- [ ] ✅ URLs validiert (HTTPS + Domain)

### NDK & Nostr
- [ ] NDK mit explicitRelayUrls initialisiert
- [ ] Event Subscriptions mit `closeOnEose: false`
- [ ] Events vor Publish signiert
- [ ] SyncManager für Offline-Events verwendet

### Phases & Acceptance
- [ ] Meilenstein in ROADMAP.md identifiziert
- [ ] Acceptance Criteria Liste durchgegangen
- [ ] Tests geschrieben & grün
- [ ] Docs aktualisiert (README, CHANGELOG)

### Code Quality
- [ ] `runTestSuite()` ausgeführt (0 Fehler)
- [ ] `pnpm run lint` erfolgreich
- [ ] `pnpm run check` erfolgreich
- [ ] Keine console.log() mit sensitiven Daten
```

---

### 🔄 **Wie mit Regelveränderungen umgehen**

Falls eine bestehende Rule **nicht eingehalten werden kann**, ist folgendes Verfahren nötig:

```markdown
## Rule Change Request Template

### Problem
Beschreibe, warum die bestehende Rule nicht einhaltbar ist:
- Beispiel: "Array-Reassignments machen Code unleserlich bei 100+ Items"

### Gegenwärtige Rule
Zitiere die aktuelle Rule aus den Copilot-Instructions/Dokumentation

### Begründung für Änderung
Technische/architektonische Gründe für die Änderung:
- Performance-Impact?
- Sicherheits-Implikationen?
- Breaking Change für andere Komponenten?

### Proposal (neue Rule)
Formuliere die neue oder modifizierte Rule klar

### Migration Plan
Wie werden bestehende Codestellen aktualisiert?
- Welche Dateien betroffen?
- Automated Migration möglich?
- Tests zu aktualisieren?

### Approval
Diese Änderung muss von [Project Owner] genehmigt werden,
da sie potenziell alle zukünftigen AI-Agent-Tasks betrifft!
```

---

### 🚨 **CRITICAL Violations (stoppen Sie sofort!)**

Diese Violations MÜSSEN behoben werden, bevor Code merged wird:

| Violation | Severity | Action |
|-----------|----------|--------|
| Private Keys in Storage | 🔴 CRITICAL | Delete all code & redo from scratch |
| Missing `triggerUpdate()` | 🔴 CRITICAL | Data loss on reload! |
| **Timestamp String-Vergleich** | 🔴 **CRITICAL** | **MRU-Logic broken! Parse to Number first!** |
| Wrong Icon Syntax | 🟠 HIGH | Icons nicht sichtbar, UI broken |
| `$effect` mit falschem Wert | 🟠 HIGH | Sync broken, inconsistent state |
| No isDragging Guard (DnD) | 🟠 HIGH | DnD completely broken |
| Phase/Meilenstein ignoriert | 🟠 HIGH | Förderung at risk! |
| NDK ohne relayUrls | 🟡 MEDIUM | Performance/reliability issues |
| closeOnEose: true | 🟡 MEDIUM | Live-updates broken |

---

1. **Immer zuerst AGENTS.md lesen** für die Spezifikation
2. **Testet mit runTestSuite()** nach Änderungen an Core-Klassen
3. **Array-Mutations müssen reassigniert werden** (Svelte 5 Requirement)
   - 🛑 **Violation Detection:** `array.push()` → ❌ Keine Reaktivität
4. **triggerUpdate() immer nach Board-Änderungen aufrufen** (Persistierung)
   - 🛑 **Violation Detection:** Fehlend → ❌ localStorage nicht aktualisiert
5. **Icons: @lucide/svelte/icons/* Syntax NICHT verhandeln**
   - 🛑 **Violation Detection:** Falscher Import → ❌ Icons nicht sichtbar
6. **$effect statt subscribe** für UI-Sync
   - 🛑 **Violation Detection:** Beobachtet falschen Wert → ❌ UI-Update missed
7. **getContextData() für KI-Serialisierung verwenden** (keine Klasseninstanzen!)
8. **Offline-First denken** - jede Operation muss auch offline funktionieren
9. **Security-First**: Private Keys NIEMALS speichern (nur pubkey!)
   - 🛑 **Violation Detection:** Private Key in localStorage → 🔴 **CRITICAL!**
10. **Acceptance Criteria IMMER erfüllen** - nicht ignorieren!
    - 🛑 **Violation Detection:** Phase/Meilenstein unbekannt → ❌ Förderung at risk
11. **isDragging Guard bei DnD** - verhindert $effect Loops
    - 🛑 **Violation Detection:** Guard fehlt → ❌ DnD broken, Spalten springen
12. **Storage Decision Tree nutzen** - bei jeder Persistierung!
13. **NDK mit explicitRelayUrls** - nicht auto-discover!
    - 🛑 **Violation Detection:** Fehlendes relayUrls → ❌ Performance-Probleme
14. **Event Subscriptions: closeOnEose: false** - für Live-Updates!
    - 🛑 **Violation Detection:** `closeOnEose: true` → ❌ Live-Updates broken
15. **Phase-Awareness**: Welche Phase? Welcher Meilenstein? Abhängigkeiten?
16. **Vor Commit:** Pre-Commit Checklist durchgehen (siehe Rule Violations Section)
17. **Bei Regelkonflikt:** Rule Change Request Template verwenden (keine Ad-hoc-Anpassungen!)
18. **⚠️ NEU: Timestamp-Vergleiche MÜSSEN numerisch sein!** ← ISO-String zu `new Date().getTime()` konvertieren!
    - 🛑 **Violation Detection:** `if (isoString > timestamp)` → ❌ String-Vergleich! Parse zu Number first!

---

## 🔗 Schnelle Links

- **GitHub Repository:** https://github.com/edufeed-org/kanban-editor
- **Branch:** `connect-stores`
- **Issues Tracker:** GitHub Issues
- **Dokumentation:** Root `/` mit Markdown-Dateien
- **UI Components:** `src/lib/components/ui/`
- **Core Models:** `src/lib/classes/BoardModel.ts`
- **Store Implementation:** `src/lib/stores/kanbanStore.svelte.ts`

---

**Stand:** 20. Oktober 2025 | Aktualisiert durch AI-Agent Analyse

---

## 📋 Datei-Übersicht

Diese Copilot-Instructions enthalten:

- **~1300 Zeilen** kompakte, actionierbare Anleitung
- **18 Schnell-Referenz-Aufgaben** mit Code-Beispielen
- **4 Core Architecture Patterns** mit Diagrammen
- **5 häufige Fehler-Szenarien** mit Fixes
- **10 kritische Rule-Violations** mit Detection-Patterns
- **8 CRITICAL Violations** die sofort behoben werden MÜSSEN
- **Pre-Commit Checklist** mit 18-Punkt Verifikation
- **Rule Change Request Template** für Ausnahmen
- **17 Best Practices** mit Violation-Hinweisen
- **Vollständige Cross-References** zu AGENTS.md, STORES.md, NDK.md, etc.

**Diese Anleitung macht AI-Agenten sofort produktiv und sicherheit-bewusst!** 🚀
