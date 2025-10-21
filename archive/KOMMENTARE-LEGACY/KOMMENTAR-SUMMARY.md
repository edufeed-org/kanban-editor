# Kommentar-System: Executive Summary

## 📌 TL;DR - Die 3 wichtigsten Dinge

### 1️⃣ **UI-Formular** (Phase A) ⏳ TODO

Füge in `CardViewDialog.svelte` im "Kommentare"-Tab ein Eingabeformular hinzu:

- Textarea für Text-Eingabe
- "Absenden"-Button mit SendIcon
- "Abbrechen"-Button
- Loading-State während Absenden

### 2️⃣ **Store Bug-Fix** (Phase B) 🔑 CRITICAL

In `kanbanStore.svelte.ts` Zeile ~295 - **FEHLER GEFUNDEN UND FIXBAR**:

```typescript
// ❌ AKTUELL (FALSCH - keine Reaktivität!)
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.publishToNostr();  // ← triggerUpdate() FEHLT!
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}

// ✅ FIX (3 Zeilen ändern!)
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.triggerUpdate();  // ← 🔑 ADD THIS LINE!
        this.publishToNostr();
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

**Warum das wichtig ist:**

- `triggerUpdate()` inkrementiert den`updateTrigger` State
- Das triggert die`$derived.by()` Neuberechnung
- UI aktualisiert sich automatisch
- Kommentare werden zu localStorage gespeichert

### 3️⃣ **Nostr Integration** (Phase D) ⏳ FUTURE

Kind 1 Events mit korrekten Tags nach Kanban-NIP:

- `["a", "30302:card_author:card_id"]` - Ref zur Card
- `["p", "card_author_npub"]` - Mention des Authors
- `content: "Kommentar Text"`

---

## 🔄 Der Complete Flow (Schritt-für-Schritt)

```
 ┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: User schreibt Kommentar in Textarea (CardViewDialog)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  <Textarea bind:value={commentText} />                          │
│  
│  User tippt: "Mein erster Kommentar"
│  commentText = "Mein erster Kommentar"  ($state reaktiv)
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: User klickt "Absenden"                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  <form onsubmit={handleAddComment}>
│
│  handleAddComment(e) {
│    e.preventDefault()
│    if (!commentText.trim()) return
│
│    isLoading = true  ← Loading-Spinner anzeigen
│
│    boardStore.addComment(
│      card.id,
│      commentText.trim(),
│      authStore.currentUser?.npub  ← Author aus Auth
│    )
│  }
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: BoardStore fügt Kommentar hinzu (kanbanStore)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  boardStore.addComment(cardId, text, author) {
│
│    // 1. Find Card
│    const result = this.board.findCardAndColumn(cardId)
│    if (!result) throw Error("Card not found")
│
│    // 2. Add Comment (mit Array-Reassignment!)
│    result.card.addComment(text, author)
│    └─ this.comments = [...this.comments, comment]
│
│    // 3. 🔑 TRIGGER REAKTIVITÄT (BUG-FIX!)
│    this.triggerUpdate()
│    └─ updateTrigger++
│    └─ saveToStorage()  ← localStorage aktualisiert!
│
│    // 4. Publish zu Nostr (async, non-blocking)
│    this.publishToNostr()
│  }
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Reaktivität triggert UI-Update (Svelte 5 Runes)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  updateTrigger wurde geändert (0 → 1)
│       ↓
│  $derived.by() erkennt Änderung
│       ↓
│  uiData wird neu berechnet
│       ↓
│  Column.svelte $effect wird triggert
│       ↓
│  items Props werden mit neuen Comments aktualisiert
│       ↓
│  CardViewDialog re-rendert
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: UI zeigt neuen Kommentar (sofort sichtbar!)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  {#each card.comments as comment}
│    <div class="p-3 bg-muted rounded-md">
│      <span class="font-medium">{comment.author}</span>
│      <p class="text-sm">{comment.text}</p>  ← NEUER KOMMENTAR!
│      <span class="text-xs">{comment.createdAt}</span>
│    </div>
│  {/each}
│                                                                 │
│  [y] NEW COMMENT IS VISIBLE!                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Form wird zurückgesetzt (optional aber gut UX)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  commentText = ''      ← Textarea ist leer
│  isLoading = false     ← Spinner verschwindet
│  Button wird enabled   ← Bereit für nächsten Kommentar
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7 (ASYNC, NON-BLOCKING): Nostr Publishing                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  publishToNostr() wird async aufgerufen
│
│  createCommentEvent(...)  ← Creates Kind 1 Event
│    {
│      kind: 1,
│      content: "Mein erster Kommentar",
│      tags: [
│        ["a", "30302:card_author:card_id"],
│        ["p", "card_author_npub"]
│      ]
│    }
│
│  ndk.publish(event)  ← Sends to Nostr Relays
│
│  [y] NOSTR EVENT PUBLISHED!                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: Persistent - After Browser Reload                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Browser wird aktualisiert (F5)
│
│  loadFromStorage() wird aufgerufen
│    └─ localStorage['kanban-board-data'] gelesen
│    └─ board.reconstructBoard(data)
│    └─ ✅ Kommentar ist immer noch da!
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

✅ FULL CYCLE COMPLETE!
```

---

## 📋 Implementierungs-Roadmap

### Phase A: UI-Komponente (1-2 Stunden)

**Datei:** `src/routes/cardsboard/CardViewDialog.svelte`

```typescript
// Import hinzufügen
import { Textarea } from '$lib/components/ui/textarea/index.js';
import SendIcon from '@lucide/svelte/icons/send';
import LoaderIcon from '@lucide/svelte/icons/loader';
import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

// State-Variablen hinzufügen
let commentText = $state('');
let isLoading = $state(false);

// Handler-Funktion hinzufügen
async function handleAddComment(e: Event) {
  e.preventDefault();
  if (!commentText.trim()) return;
  
  isLoading = true;
  try {
    await boardStore.addComment(
      card.id,
      commentText.trim(),
      'current-user-npub'  // TODO: Aus AuthStore
    );
    commentText = '';
  } catch (error) {
    console.error('❌ Fehler:', error);
  } finally {
    isLoading = false;
  }
}

// HTML hinzufügen (in Tabs.Content value="comments")
// ┌─ Existing comments loop bleibt gleich
// ├─ Kommentar-Form (NEUE SECTION nach bestehenden Comments)
// │  └─ Textarea + Buttons
// └─ Form submission → handleAddComment()
```

**Acceptance Criteria:**

- ✅ Textarea wird angezeigt
- ✅ Placeholder-Text: "Schreiben Sie einen Kommentar..."
- ✅ Submit-Button disabled bei leerem Text
- ✅ Loading-State mit Spinner während Absenden

---

### Phase B: Store-Fix (5 Minuten) 🔑 CRITICAL

**Datei:** `src/lib/stores/kanbanStore.svelte.ts` (Zeile ~295)

**Einfach 1 Zeile hinzufügen:**

```typescript
// VORHER
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.publishToNostr();  // ← Keine Reaktivität!
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}

// NACHHER - Just add 1 line!
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.triggerUpdate();    // ← ADD THIS LINE!
        this.publishToNostr();
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

**Acceptance Criteria:**

- ✅ Neuer Kommentar erscheint sofort in UI
- ✅ Kommentar bleibt nach Reload (localStorage)

---

### Phase C: AuthStore Integration (Phase 1.4)

**Datei:** `src/lib/stores/authStore.svelte.ts` (zu erstellen)

```typescript
export class AuthStore {
    private currentUser = $state<{ npub: string } | null>(null);
  
    async loginWithNIP07() { ... }
    async logout() { ... }
}

export const authStore = new AuthStore();
```

**In CardViewDialog:**

```typescript
import { authStore } from '$lib/stores/authStore.svelte.js';

const author = authStore.currentUser?.npub || 'anonymous';
await boardStore.addComment(card.id, commentText.trim(), author);
```

---

### Phase D: Nostr Event Publishing (Phase 1.3.1)

**Datei:** `src/lib/utils/nostrEvents.ts` (zu erstellen)

```typescript
export function createCommentEvent(
  cardId: string,
  cardAuthorNpub: string,
  commentText: string,
  currentUserNpub: string,
  ndk: NDK,
  cardEventId?: string
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = 1;
  event.content = commentText;
  event.tags = [
    ['a', `30302:${cardAuthorNpub}:${cardId}`],
    ['p', cardAuthorNpub],
    ['alt', `Kommentar zu Karte: ${cardId}`]
  ];
  if (cardEventId) {
    event.tags.push(['e', cardEventId, '', 'reply']);
  }
  return event;
}
```

---

### Phase E: SyncManager (Phase 1.2)

**Datei:** `src/lib/stores/syncManager.svelte.ts` (zu erstellen)

Offline-Queue mit IndexedDB für fehlgeschlagene Events:

- Retry-Logic mit exponential backoff
- Online/Offline Detection
- Dead-letter Pattern nach 3 Versuchen

---

## ⚠️ Kritische Fehler zu vermeiden

### ❌ Fehler 1: triggerUpdate() nicht aufrufen

**Symptom:** Kommentar lokal da, aber UI zeigt ihn nicht
**Fix:** Unbedingt `this.triggerUpdate()` aufrufen nach `card.addComment()`

### ❌ Fehler 2: Array-Mutation statt Reassignment

**Symptom:** Svelte 5 erkennt Änderung nicht
**Fix:** `this.comments = [...this.comments, comment]` (nicht `.push()`)

### ❌ Fehler 3: Nostr Publishing blockiert UI

**Symptom:** Lange Verzögerung beim Absenden
**Fix:** `publishToNostr()` nicht awaiten (fire & forget)

### ❌ Fehler 4: Author hardcoded

**Symptom:** Alle Kommentare haben wrong Author
**Fix:** `authStore.currentUser?.npub` verwenden

---

## 🎯 State Management Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Svelte 5 State Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  card.comments = [  ← Array $state in BoardModel                │
│    {                                                            │
│      id: "comment-1",                                           │
│      text: "Alter Kommentar",                                   │
│      author: "npub1...",                                        │
│      createdAt: "2025-10-20T..."                                │
│    },                                                           │
│    {  ← NEW COMMENT                                             │
│      id: "comment-2",                                           │
│      text: "Mein erster Kommentar",  ← User Input               │
│      author: "npub1... (from AuthStore)",                       │
│      createdAt: "2025-10-20T14:32:00Z"  ← Auto-generated        │
│    }                                                            │
│  ]                                                              │
│                                                                 │
│  updateTrigger = 0 → 1  ← Inkrementiert via triggerUpdate()     │
│                                                                 │
│  uiData = $derived.by(() => {  ← Neu berechnet wenn             │
│    ... comments included in output ...                          │
│  })                                                             │
│                                                                 │
│  Persistence Layers:                                            │
│  ├─ localStorage → board.getContextData(true)                   │
│  ├─ Nostr → Kind 1 Event                                        │
│  └─ IndexedDB → SyncManager Queue (future)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Meilenstein-Zuordnung (ROADMAP.md)

| Phase | Meilenstein         | Status  | Effort |
| ----- | ------------------- | ------- | ------ |
| 1.3.1 | UI-Form + Store-Fix | ⏳ TODO | 2-3h   |
| 1.3.2 | Event Publishing    | ⏳ TODO | 2-3h   |
| 1.4   | AuthStore           | ⏳ TODO | 3-4h   |
| 1.2   | SyncManager         | ⏳ TODO | 4-5h   |

---

## 🔗 Abhängigkeiten

```
Kommentar-System
  ├─ Abhängig: AuthStore (für Author-npub) [Phase 1.4]
  ├─ Abhängig: NDK Context (für Publishing) [Phase 1.1] ✅
  ├─ Abhängig: nostrEvents.ts (für Event-Schema) [Phase 1.3.1]
  └─ Abhängig: SyncManager (für Offline-Queue) [Phase 1.2]
```

---

## 📚 Dokumentation

Alle Details finden sich in:

- **KOMMENTAR-SYSTEM.md** - Vollständiger Umsetzungsplan (50+ Seiten)
- **KOMMENTAR-QUICK-REF.md** - Schnell-Referenz für Entwickler
- **KOMMENTAR-ARCHITEKTUR.md** - Diagramme & State Flows

---

## ✅ Next Steps

1. **Jetzt (5 Min):** Phase B-Fix (1 Zeile`triggerUpdate()` hinzufügen)
2. **Morgen (1-2h):** Phase A (UI-Form implementieren)
3. **Später (3-4h):** Phase C (AuthStore) + Phase D (Nostr)
4. **Future (4-5h):** Phase E (SyncManager)

---

**The key insight:** Das System ist schon **90% ready**. Es braucht nur:

1. `triggerUpdate()` eine Zeile im Store (Bug-Fix)
2. Ein Textarea + Form in der UI
3. AuthStore für den Author
4. Nostr Event Publishing (Kind 1)

**Alles andere ist Boilerplate!** ✨
