# Kommentar-System: Architektur & Diagramme

## 1. Komponenten-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                    CardViewDialog.svelte                        │
│                  (Karte Detail-Ansicht Modal)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tabs: [Content] [Kommentare]                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Tabs.Content value="comments"                             │  │
│  │                                                           │  │
│  │  // EXISTING Comments Loop                                │  │
│  │    {#each card.comments as comment}                       │  │
│  │      <div class="p-3 bg-muted rounded-md">                │  │
│  │        <span class="font-medium">{comment.author}</span>  │  │
│  │        <p class="text-sm">{comment.text}</p>              │  │
│  │        <span class="text-xs">{comment.createdAt}</span>   │  │
│  │      </div>                                               │  │
│  │    {/each}                                                │  │
│  │                                                           │  │
│  │ ──────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │ + NEW Kommentar Input Form (zu implementieren)            │  │
│  │    ┌───────────────────────────────────────────────────┐  │  │
│  │    │ <form onsubmit={handleAddComment}>                │  │  │
│  │    │   <label>Kommentar hinzufügen</label>             │  │  │
│  │    │   <Textarea                                       │  │  │
│  │    │     bind:value={commentText}                      │  │  │
│  │    │     placeholder="Schreiben Sie einen Comment..."  │  │  │
│  │    │   />                                              │  │  │
│  │    │   <div>                                           │  │  │
│  │    │     <Button variant="outline">Abbrechen</Button>  │  │  │
│  │    │     <Button type="submit">                        │  │  │
│  │    │       <SendIcon/> Absenden                        │  │  │
│  │    │     </Button>                                     │  │  │
│  │    │   </div>                                          │  │  │
│  │    │ </form>                                           │  │  │
│  │    └───────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                        ↓ onsubmit                               │
│                  handleAddComment(e)                            │
│                        ↓                                        │
│              boardStore.addComment(                             │
│                cardId,                                          │
│                commentText,                                     │
│                currentUserNpub  ← AuthStore                     │
│              )                                                  │
│                        ↓                                        │
│       ╔════════════════════════════════════════════════════╗    │
│       ║   STORE LAYER (Siehe unten)                        ║    │
│       ╚════════════════════════════════════════════════════╝    │
│                        ↓                                        │
│              · UI updated automatically                         │
│                 (new comments visible)                          │
│                        ↓                                        │
│              commentText = ''  (Form reset)                     │
│              isLoading = false                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Store State Management

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BoardStore (kanbanStore.svelte.ts)           │
│                                                                     │
│  PRIVATE STATE (Svelte 5 $state Runes)                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  board = $state(...)                                           │ │
│  │  ├─ Board Instance                                             │ │
│  │  │  ├─ id: string                                              │ │
│  │  │  ├─ name: string                                            │ │
│  │  │  └─ columns: Column[]                                       │ │
│  │  │      └─ Column                                              │ │
│  │  │         ├─ id: string                                       │ │
│  │  │         ├─ name: string                                     │ │
│  │  │         └─ cards: Card[]                                    │ │
│  │  │             └─ Card                                         │ │
│  │  │                ├─ id: string                                │ │
│  │  │                ├─ heading: string                           │ │
│  │  │                ├─ content: string                           │ │
│  │  │                └─ comments: Comment[]  ← WIR ÄNDERN DAS!    │ │
│  │  │                   ├─ Comment                                │ │
│  │  │                   │  ├─ id: string                          │ │
│  │  │                   │  ├─ text: string                        │ │
│  │  │                   │  ├─ author: string (npub)               │ │
│  │  │                   │  └─ createdAt: string (ISO 8601)        │ │
│  │  │                   └─ ...                                    │ │
│  │  │                                                             │ │
│  │  updateTrigger = $state(0)  ← Dependency Trigger               │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  PUBLIC DERIVED STATE (Svelte 5 $derived)                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  uiData = $derived.by(() => {                                  │ │
│  │      const trigger = this.updateTrigger;  ← Liest Zähler       │ │
│  │      const columns = this.board.columns;                       │ │
│  │                                                                │ │
│  │      // Transformiert Board-Daten zu UI-Format                 │ │
│  │      return columns.map(col => ({                              │ │
│  │          id: col.id,                                           │ │
│  │          name: col.name,                                       │ │
│  │          items: col.cards.map(card => ({                       │ │
│  │              id: card.id,                                      │ │
│  │              name: card.heading,                               │ │
│  │              description: card.content,                        │ │
│  │              comments: card.comments,  ← UPDATED!              │ │
│  │              ...                                               │ │
│  │          }))                                                   │ │
│  │      }));                                                      │ │
│  │  })                                                            │ │
│  │                                                                │ │
│  │  -> Neuberechnung triggert automatisch, wenn:                  │ │
│  │      - updateTrigger sich ändert                               │ │
│  │      - board.columns sich ändert                               │ │
│  │      - card.comments sich ändert (!)                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  PUBLIC METHODS (Store API)                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  addComment(cardId, text, author): void {                      │ │
│  │      ┌─ (1) find Card                                          │ │
│  │      │   const result = board.findCardAndColumn(cardId)        │ │
│  │      │   if (!result) throw Error(...)                         │ │
│  │      │                                                         │ │
│  │      ├─ (2) add Comment to Card                                │ │
│  │      │   result.card.addComment(text, author)                  │ │
│  │      │   └─ this.comments = [...this.comments, comment]        │ │
│  │      │                                                         │ │
│  │      ├─ (3) trigger update (CRITICAL!)                         │ │
│  │      │   this.triggerUpdate()                                  │ │
│  │      │   ├─ updateTrigger++                                    │ │
│  │      │   └─ saveToStorage()                                    │ │
│  │      │                                                         │ │
│  │      ├─ (4) publish to Nostr (async)                           │ │
│  │      │   this.publishToNostr()                                 │ │
│  │      │   └─ createCommentEvent(...)                            │ │
│  │      │                                                         │ │
│  │      └─ RETURN: (voila! UI aktualisiert sich automatisch)      │ │
│  │  }                                                             │ │
│  │                                                                │ │
│  │  [weitere Methoden...]                                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flow: Kommentar hinzufügen

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    KOMMENTAR HINZUFÜGEN - FLOW                           ║
╚══════════════════════════════════════════════════════════════════════════╝

START: User tippt Text in Textarea
  │
  ├─ <Textarea bind:value={commentText} />
  │  └─ commentText = "Mein erster Kommentar"
  │  └─ $state reaktiv (Svelte 5)
  │
  └──→ User klickt "Absenden"

PHASE 1: UI Handler
  │
  ├─ <form onsubmit={handleAddComment}>
  │
  ├─ handleAddComment(e)
  │  ├─ e.preventDefault()
  │  ├─ if (!commentText.trim()) return
  │  ├─ isLoading = true  ← Show spinner
  │  │
  │  └─ await boardStore.addComment(
  │       cardId,
  │       commentText.trim(),
  │       authStore.currentUser?.npub  ← ⚠️ AuthStore needed
  │     )
  │
  └──→ Continue to PHASE 2

PHASE 2: Store Layer (boardStore.addComment)
  │
  ├─ const result = board.findCardAndColumn(cardId)
  │  ├─ Suche Column mit matching ID
  │  ├─ Suche Card in Column
  │  └─ Gebe { card, column } zurück
  │
  ├─ if (!result) throw Error("Card not found")
  │
  ├─ result.card.addComment(text, author)
  │  └─ BoardModel.Card.addComment()
  │     ├─ Erstelle Comment-Objekt:
  │     │  {
  │     │    id: generateDTag(),
  │     │    text: "Mein erster Kommentar",
  │     │    author: "npub1...",
  │     │    createdAt: generateTimestamp()  // ISO 8601
  │     │  }
  │     │
  │     └─ REASSIGN Array (Svelte 5 requirement):
  │        this.comments = [...this.comments, comment]
  │        // NOT: this.comments.push(comment)
  │
  ├─ 🔑 this.triggerUpdate()  ← CRITICAL FIX!
  │  ├─ updateTrigger++  (0 → 1)
  │  │  └─ Dependencies in $derived.by() re-execute
  │  │
  │  └─ saveToStorage()
  │     └─ board.getContextData(true)
  │        └─ localStorage['kanban-board-data'] = JSON.stringify(...)
  │           └─ Kommentar wird persisted!
  │
  ├─ this.publishToNostr()  [async, non-blocking]
  │  ├─ createCommentEvent(...)
  │  │  └─ Kind 1 (Text Note)
  │  │     - Tags: ["a", "30302:author:card-id"]
  │  │     - Tags: ["p", "card-author"]
  │  │     - Content: "Mein erster Kommentar"
  │  │
  │  └─ ndk.publish(event)
  │     └─ Sendet zu Nostr Relays
  │        (Wenn offline: SyncManager queued es)
  │
  └──→ Continue to PHASE 3

PHASE 3: UI Update (Automatisch via Svelte Reactivity)
  │
  ├─ updateTrigger wurde inkrementiert
  │  └─ uiData $derived.by() merkt Änderung
  │
  ├─ uiData wird neu berechnet
  │  ├─ trigger = updateTrigger  // 1 (changed!)
  │  ├─ columns = this.board.columns  (unchanged)
  │  ├─ card.comments wird gelesen (changed!)
  │  │  └─ Enthält jetzt: [...old_comments, new_comment]
  │  │
  │  └─ return [..., { comments: new_comments }, ...]
  │
  ├─ Column.svelte erkennt Änderung via $effect
  │  ├─ $effect(() => {
  │  │   const uiColumns = boardStore.uiData;  // Liest neue Daten
  │  │   items = uiColumns.find(...)?.items;   // Updatet lokale Props
  │  │ })
  │  │
  │  └─ items State wird aktualisiert
  │
  ├─ CardViewDialog zeigt neue Kommentare
  │  ├─ {#each card.comments as comment}
  │  │  ├─ Alte: comment 1, comment 2
  │  │  └─ NEU: comment 1, comment 2, comment 3 ✨
  │  │
  │  └─ {/each}
  │
  ├─ UI Re-render erfolgt
  │
  └──→ Continue to PHASE 4

PHASE 4: Form Reset
  │
  ├─ commentText = ''           ← Clear textarea
  ├─ isLoading = false          ← Hide spinner
  ├─ Textarea ist now leer
  │
  └──→ SUCCESS ✅

END: Kommentar ist sichtbar + persistent + auf Nostr


╔════════════════════════════════════════════════════════════════════════════╗
║                          KRITISCHE PUNKTE                                  ║
├════════════════════════════════════════════════════════════════════════════┤
║                                                                            ║
║ (!) MUSS SEIN:                                                             ║
║   - triggerUpdate() aufrufen (sonst keine Reaktivität!)                    ║
║   - Array Reassignment (nicht .push()!)                                    ║
║   - Author aus AuthStore holen (nicht hardcoded)                           ║
║   - publishToNostr() ist async (aber wird nicht blockiert)                 ║
║                                                                            ║
║ (x) NICHT MACHEN:                                                          ║
║   - await publishToNostr() (würde UI blockieren)                           ║
║   - this.comments.push(comment) (keine Reaktivität)                        ║
║   - Kommentar auf Global State speichern                                   ║
║   - Fehler ignorieren (Error-Handling wichtig)                             ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Daten-Transformationen

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  DATEN-FLOW: Kommentar durchs System                     │
└──────────────────────────────────────────────────────────────────────────┘

STEP 1: User Input (UI)
  Input: string = "Mein erster Kommentar"
  
STEP 2: Create Comment Object (BoardModel.Card)
  Comment = {
    id: "f7a3b9c2d1e4f6a8",          // generateDTag()
    text: "Mein erster Kommentar",
    author: "npub1qqqqqqqwqqqqwq...", // Aus AuthStore
    createdAt: "2025-10-20T14:32:00Z" // generateTimestamp()
  }

STEP 3: Add to Card Comments Array (with reassignment)
  card.comments = [
    {...existing_comment_1},
    {...existing_comment_2},
    {...new_comment}  ← Added
  ]

STEP 4: Trigger Reactivity (Store)
  updateTrigger: 0 → 1
  
STEP 5: Serialize to localStorage (Store)
  board.getContextData(true) = {
    id: "board-id",
    name: "Board Name",
    columns: [
      {
        id: "col-1",
        cards: [
          {
            id: "card-id",
            heading: "Card Title",
            comments: [
              {text: "...", author: "..."},
              {text: "Mein erster Kommentar", author: "npub1..."}  ← Here
            ]
          }
        ]
      }
    ]
  }
  
  localStorage['kanban-board-data'] = JSON.stringify(above)

STEP 6: Transform for UI (Store)
  uiData = $derived.by() = {
    id: "col-1",
    items: [
      {
        id: "card-id",
        name: "Card Title",
        comments: [  ← Same as above
          {text: "...", author: "..."},
          {text: "Mein erster Kommentar", author: "npub1..."}
        ]
      }
    ]
  }

STEP 7: Display in Component (CardViewDialog)
  {#each card.comments as comment}
    <div class="p-3 bg-muted rounded-md">
      <span class="font-medium">{comment.author}</span>
      <p class="text-sm">{comment.text}</p>
      <span class="text-xs">{comment.createdAt}</span>
    </div>
  {/each}
  
  ✅ NEW COMMENT VISIBLE!

STEP 8 (ASYNC): Create Nostr Event (nostrEvents.ts)
  NDKEvent = {
    kind: 1,
    content: "Mein erster Kommentar",
    tags: [
      ["a", "30302:author:card-id"],
      ["p", "card-author-npub"],
      ["alt", "Kommentar zu Karte: card-id"]
    ],
    created_at: 1729376400  // Unix timestamp
  }

STEP 9 (ASYNC): Publish to Relays (NDK)
  ndk.publish(event)
  
  ✅ NOSTR EVENT PUBLISHED!


┌──────────────────────────────────────────────────────────────────────────┐
│                          DATA PERSISTENCE                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ · LOCAL (Immediate)                                                      │
│    └─ boardStore.board.comments (in-memory)                              │
│       └─ Accessible immediately via $state                               │
│                                                                          │
│ · LOCALSTORAGE (Persistent)                                              │
│    └─ localStorage['kanban-board-data']                                  │
│       └─ Survives browser reload                                         │
│       └─ Survives offline periods                                        │
│                                                                          │
│ · NOSTR (Decentralized)                                                  │
│    └─ NDK publishes Kind 1 event                                         │
│       └─ Stored on multiple relays                                       │
│       └─ Accessible from any Nostr client                                │
│       └─ Cross-device sync                                               │
│                                                                          │
│ · INDEXEDDB (Offline Queue) [Future]                                     │
│    └─ SyncManager stores failed events                                   │
│       └─ Retry with exponential backoff                                  │
│       └─ Dead-letter after 3 attempts                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Fehlerfall: Ohne triggerUpdate()

```
┌─────────────────────────────────────────────────────────────────────┐
│              (x) FEHLERFALL: triggerUpdate() FEHLT                  │
└─────────────────────────────────────────────────────────────────────┘

// In kanbanStore.addComment() - FALSCH:
result.card.addComment(text, author);
// triggerUpdate() FEHLT! ←←← BUG
this.publishToNostr();

RESULTAT:
  │
  ├─ ✅ board.columns[0].cards[0].comments Array wird aktualisiert
  │    └─ comment hinzugefügt via: this.comments = [...]
  │
  ├─ ✅ localStorage gespeichert... NEIN! (triggerUpdate() nicht da)
  │
  ├─ ❌ updateTrigger wird NICHT inkrementiert
  │    └─ Bleibt bei: 0
  │
  ├─ ❌ $derived.by() wird NICHT neu berechnet
  │    └─ uiData wird nicht aktualisiert
  │
  ├─ ❌ Column.svelte $effect wird NICHT triggert
  │    └─ items Props bleiben alt
  │
  ├─ ❌ CardViewDialog zeigt alte Kommentare
  │    └─ Neue Kommentar nicht sichtbar!
  │
  └─ 💥 User ist verwirrt: "Ich hab gerade einen Kommentar geschrieben, 
                            aber er ist nicht da!"

ABER BEIM RELOAD:
  ├─ localStorage hat KEINEN neuen Kommentar (triggerUpdate() war nicht da)
  │
  └─ Kommentar ist komplett weg!

CONSOLE OUTPUT:
  │
  ├─ board.comments hat Kommentar (wenn man inspiziert)
  │  └─ aber UI sieht ihn nicht
  │
  └─ Symptom: "State ist da, aber UI aktualisiert nicht" 🤯


┌─────────────────────────────────────────────────────────────────────┐
│              (ok) KORREKT: triggerUpdate() VORHANDEN                │
└─────────────────────────────────────────────────────────────────────┘

// In kanbanStore.addComment() - RICHTIG:
result.card.addComment(text, author);
this.triggerUpdate();  // ← 🔑 CRITICAL LINE!
this.publishToNostr();

RESULTAT:
  │
  ├─ ✅ board.columns[0].cards[0].comments Array wird aktualisiert
  │
  ├─ ✅ this.triggerUpdate() wird aufgerufen
  │    ├─ updateTrigger: 0 → 1
  │    └─ saveToStorage() → localStorage aktualisiert
  │
  ├─ ✅ $derived.by() erkennt updateTrigger Änderung
  │    └─ uiData wird neu berechnet
  │
  ├─ ✅ Column.svelte $effect wird triggert
  │    ├─ const uiColumns = boardStore.uiData;
  │    └─ items wird aktualisiert (enthält neue Comments)
  │
  ├─ ✅ CardViewDialog re-rendert mit neuen Kommentaren
  │    └─ {#each card.comments} loops zeigt neuen Eintrag
  │
  └─ ✅ User sieht Kommentar sofort!

NACH RELOAD:
  ├─ localStorage wird geladen
  ├─ board.reconstructBoard() mit gespeicherten Kommentaren
  │
  └─ ✅ Kommentar ist immer noch da!

CONSOLE OUTPUT:
  │
  ├─ 🔄 Update triggered: 1
  ├─ 💾 Board in localStorage gespeichert
  ├─ board.comments hat Kommentar
  │
  └─ ✅ Alles funktioniert wie erwartet!
```

---

## 6. Nostr Event Schema

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    KIND 1 EVENT (Text Note / Comment)                      ║
╚════════════════════════════════════════════════════════════════════════════╝

{
  "id": "3da1f67e08...",                 // Event ID (Hash)
  "pubkey": "npub1qqqqqqqwqqqqwq...",   // Kommentator (Author)
  "created_at": 1729376400,              // Unix timestamp
  "kind": 1,                             // Text Note = Comment
  "tags": [
    ["a", "30302:card_author:card_id"],  // Ref zu Card (replaceable)
    ["p", "npub1qqqqqqqwqqqqwq..."],     // Mention Card-Autor
    ["e", "event_id", "relay_url", "reply"], // Optional: Reply to Card Event
    ["alt", "Kommentar zu Karte: xyz"]   // Alt-Text für Clients
  ],
  "content": "Mein erster Kommentar",    // Actual comment text
  "sig": "sig_hex..."                    // Signature
}

TAGS ERKLÄRUNG:
  │
  ├─ ["a", "30302:card_author:card_id"]
  │  └─ Ref zum replaceable Card Event (30302)
  │     ├─ "a" = addressable event reference
  │     ├─ "30302" = Card event kind
  │     ├─ "card_author" = npub des Card-Erstellers
  │     └─ "card_id" = d-tag der Card
  │
  ├─ ["p", "npub..."]
  │  └─ Mention des Card-Autors (für Notifications)
  │     └─ Wird von Relays indiziert für "mentions"
  │
  ├─ ["e", "event_id", "relay_url", "reply"]
  │  └─ Direct reply to Card Event (optional)
  │     └─ Wenn die Card als Kind 30302 Event publiziert wurde
  │
  └─ ["alt", "Text"]
     └─ Alternative text for non-Kanban clients
        └─ Wird als Fallback angezeigt

VERWENDUNG (NIP-19 Encoding):
  │
  ├─ note1xxxxx = Link zum Comment
  └─ naddr1xxxxx = Link zum Comment via a-tag (persistent)


INTEGRATION MIT CARD-EVENT:
  │
  ├─ Card Event (30302)
  │  └─ ["d", "card_id"]  ← Wird referenziert
  │
  └─ Comment Event (1)
     └─ ["a", "30302:card_author:card_id"]  ← Ref zur Card
        └─ Wird automatisch von NDK aufgelöst

SUBSCRIPTIONS (NDK):
  │
  ├─ Subscribe alle Comments zu einer Card:
  │  ndk.subscribe({
  │    kinds: [1],
  │    "#a": ["30302:author:card_id"]
  │  })
  │
  └─ Subscribe alle Comments eines Users:
     ndk.subscribe({
       kinds: [1],
       authors: ["user_pubkey"]
     })

```

---

## 7. State Diagram

```
                    ┌─────────────────────┐
                    │   Initial State     │
                    │                     │
                    │ card.comments = []  │
                    │ updateTrigger = 0   │
                    │ commentText = ""    │
                    │ isLoading = false   │
                    └──────────┬──────────┘
                               │
                      User klickt "Absenden"
                               │
                               ▼
                    ┌─────────────────────┐
                    │ HandleAddComment()  │
                    │ Start               │
                    │                     │
                    │ isLoading = true    │
                    │ isSubmitting = true │
                    └──────────┬──────────┘
                               │
                 boardStore.addComment() aufgerufen
                               │
                               ▼
            ┌──────────────────────────────────┐
            │  Store Phase 1:                  │
            │  Find Card + Add Comment         │
            │                                  │
            │ this.comments = [..., comment]   │
            │                                  │
            │ Lokal State aktualisiert [y]     │
            │ Noch keine UI-Update             │
            └──────────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────────┐
            │  Store Phase 2:                  │
            │  triggerUpdate() ← (!)           │
            │                                  │
            │ updateTrigger: 0 → 1             │
            │ saveToStorage() → localStorage   │
            │                                  │
            │ $derived.by() triggered [y]      │
            │ uiData neu berechnet             │
            └──────────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────────┐
            │  Reactivity Chain:               │
            │                                  │
            │ updateTrigger changed            │
            │    ↓                             │
            │ $derived.by() neu gerechnet      │
            │    ↓                             │
            │ uiData aktualisiert              │
            │    ↓                             │
            │ Column.svelte $effect triggered  │
            │    ↓                             │
            │ items Props aktualisiert         │
            │    ↓                             │
            │ CardViewDialog sieht neue items  │
            │    ↓                             │
            │ UI Re-rendert [y]                │
            └──────────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────────┐
            │  UI Updated State:               │
            │                                  │
            │ card.comments enthält            │
            │   neue Kommentar [y]             │
            │                                  │
            │ Textarea angezeigt               │
            │ SendIcon neben Button            │
            │                                  │
            │ Liste der Kommentare             │
            │ mit Neuem Eintrag                │
            └──────────┬───────────────────────┘
                       │
                       ▼
            ┌──────────────────────────────────┐
            │  Form Reset:                     │
            │                                  │
            │ commentText = ""                 │
            │ isLoading = false                │
            │ Textarea ist empty               │
            │ Button re-enabled                │
            │                                  │
            │ Ready for next comment!          │
            └──────────┬───────────────────────┘
                       │
                       ▼ (async, non-blocking)
            ┌──────────────────────────────────┐
            │  Nostr Publishing (Async):       │
            │                                  │
            │ createCommentEvent()             │
            │ publishToNostr()                 │
            │ Event to Relays sent             │
            │                                  │
            │ [y] DONE (im Hintergrund)        │
            └──────────────────────────────────┘
```

---

Zusammenfassung als ASCII-Art:

```
INPUT → STORE → PERSISTENCE → REACTIVITY → UI UPDATE

Input:         Store:        Persist:          Reactivity:        UI:
User types     card.         trigger           updateTrigger      NEW
   ↓       addComment()     Update()                ↓           comment
   │            ↓           ↓             $derived.by() neu      visible
Textarea   reassign        localStorage      berechnet
   │       comments[]      aktualisiert        ↓
   │       ← Array Assign  ✅              uiData updated
   └───────→ triggerUpdate()               ↓
             updateTrigger++          $effect triggered
             ✅                        ↓
                                   items synced
                                       ↓
                                   CardViewDialog
                                   re-rendert
                                       ↓
                                   ✅ SUCCESS
```
