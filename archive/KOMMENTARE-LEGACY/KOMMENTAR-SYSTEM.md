# Umsetzungsplan: Kommentar-System (Kind 1 Events)

**Status:** 📋 Planungsphase | **Meilenstein:** Phase 1.3  
**Autor:** KI-Agent | **Datum:** 20. Oktober 2025

---

## 📊 Überblick: Kommentar-Flow

```
    ┌────────────────────────────────────────────────────────────────┐
    │                     UI LAYER (CardViewDialog)                  │
    ├────────────────────────────────────────────────────────────────┤
    │                                                                │
    │  Tabs: Content | Kommentare                                    │
    │  ┌──────────────────────────────────────────────────────────┐  │
    │  │ Comments Tab:                                            │  │
    │  │                                                          │  │
    │  │  EXISTING Comments (bereits implementiert)               │  │
    │  │    - Loop über card.comments                             │  │
    │  │    - Zeige Author + CreatedAt + Text                     │  │
    │  │    - Delete-Button für Kommentare                        │  │
    │  │                                                          │  │
    │  │  NEW Kommentar-Eingabe-Form (zu implementieren)          │  │
    │  │  ┌─────────────────────────────────────────────────────┐ │  │
    │  │  │ <Field.Root>                                        │ │  │
    │  │  │   Textarea: "Schreiben Sie einen Kommentar..."      │ │  │
    │  │  │   [Buttons: Abbrechen | Absenden]                   │ │  │
    │  │  └─────────────────────────────────────────────────────┘ │  │
    │  │                                                          │  │
    │  │  onSubmit → boardStore.addComment(cardId, text, author)  │  │
    │  └──────────────────────────────────────────────────────────┘  │
    │                                                                │
    └────────────────────────────────────────────────────────────────┘
                                ↓
           ┌──────────────────────────────────────┐
           │   STORE LAYER (kanbanStore.svelte.ts)│
           └──────────────────────────────────────┘
                        ↓
     ┌─────────────────────────────────────────────────┐
     │  addComment(cardId, text, author)               │
     │                                                 │
     │  1 Finde Card:                                  │
     │     board.findCardAndColumn(cardId)             │
     │                                                 │
     │  2️ Füge Comment hinzu:                          │
     │     card.addComment(text, author)               │
     │     → this.comments = [..., new Comment]        │
     │                                                 │
     │  3️ Trigger Reaktivität:                         │
     │     triggerUpdate()                             │
     │     → updateTrigger++                           │
     │     → saveToStorage()                           │
     │                                                 │
     │  4️ Publish zu Nostr:                            │
     │     publishToNostr()                            │
     │     → createCommentEvent()                      │
     │     → publishOrQueue()                          │
     └─────────────────────────────────────────────────┘
                            ↓
    ┌─────────────────────────────────────────────────────────────────────┐
    │                  PERSISTENCE & SYNC LAYER                           │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                     │
    │  localStorage                    Nostr Events (Kind 1)              │
    │  ├─ board.getContextData()       ├─ Kind: 1 (Text Note)             │
    │  ├─ comments Array               ├─ Tags:                           │
    │  │  [                            │   - "a" → Card-Ref (30302)       │
    │  │    {                          │   - "p" → Card-Author (npub)     │
    │  │      id: "...",               │   - "e" → Card-EventId (optional)│
    │  │      text: "...",             │   - "ALT" → Plaintext Summary    │
    │  │      author: "npub1...",      │                                  │
    │  │      createdAt: "2025-10..."  │  content: "Kommentar Text"       │
    │  │    }                          │  created_at: 1729376400          │
    │  │  ]                            │                                  │
    │  │                               │  - Speichert Comment als         │
    │  │  - Speichert lokal            │     Standard Nostr Event         │
    │  │  - Ermöglicht Offline-Use     │  - Ermöglicht Live-Sync          │
    │  │  - Schnelle UI-Updates        │  - Cross-Device Sync             │
    │  │                               │  - Social-Features (Replies)     │
    │  │                               │  - Future: Reactions & Zaps      │
    │                                                                     │
    └─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Phasen der Implementierung

### Phase A: UI-Komponente (CardViewDialog.svelte) ⏳ THIS SPRINT

**Datei:** `src/routes/cardsboard/CardViewDialog.svelte`

**Aufgabe:** Füge Kommentar-Input-Form im "Kommentare"-Tab hinzu

#### A1: HTML-Struktur (+ Textarea + Buttons)

```svelte
<!-- Tabs.Content value="comments" class="space-y-4" -->
<!-- BESTEHENDES CODE BLEIBT -->

<!-- NEU: Kommentar-Eingabe-Form (nach bestehenden Kommentaren) -->
{#if (card.comments || []).length > 0}
  <div class="space-y-3">
    <!-- ... bestehende Kommentare Loop ... -->
  </div>
{:else}
  <p class="text-sm text-muted-foreground text-center py-8">Keine Kommentare vorhanden</p>
{/if}

<!-- ➕ NEU: Kommentar-Eingabe -->
<div class="pt-4 border-t">
  <form onsubmit={handleAddComment} class="space-y-3">
    <!-- Input Textarea -->
    <div>
      <label for="comment-input" class="text-sm font-medium block mb-2">
        Kommentar hinzufügen
      </label>
      <Textarea
        id="comment-input"
        bind:value={commentText}
        placeholder="Schreiben Sie einen Kommentar..."
        class="min-h-24 resize-none"
      />
    </div>

    <!-- Buttons: Abbrechen | Absenden -->
    <div class="flex gap-2 justify-end">
      <Button
        type="button"
        variant="outline"
        onclick={() => (commentText = '')}
        disabled={isLoading}
      >
        Abbrechen
      </Button>
      <Button
        type="submit"
        disabled={!commentText.trim() || isLoading}
      >
        {#if isLoading}
          <LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
          Wird abgesendet...
        {:else}
          <SendIcon class="mr-2 h-4 w-4" />
          Absenden
        {/if}
      </Button>
    </div>
  </form>
</div>
```

#### A2: Script-Logik

```typescript
<script lang="ts">
  // ... bestehender Code ...
  
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import SendIcon from '@lucide/svelte/icons/send';
  import LoaderIcon from '@lucide/svelte/icons/loader';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  
  // Props
  let { card, isOpen, onClose }: Props = $props();
  
  // Neue State-Variablen
  let commentText = $state('');
  let isLoading = $state(false);
  
  async function handleAddComment(e: Event) {
    e.preventDefault();
    
    if (!commentText.trim()) return;
    
    isLoading = true;
    try {
      // 👇 Store-Aufruf (mehr Details unten in Phase B)
      await boardStore.addComment(
        card.id,
        commentText.trim(),
        'current-user-npub' // ⚠️ TODO: Aus AuthStore holen
      );
      
      // Reset form
      commentText = '';
      
      console.log('✅ Kommentar abgesendet');
    } catch (error) {
      console.error('❌ Fehler beim Absenden:', error);
      // Toast Error anzeigen
    } finally {
      isLoading = false;
    }
  }
</script>
```

**🎨 UX-Details:**
- ✅ Textarea mit 24px Min-Höhe (resize-none)
- ✅ SendIcon neben "Absenden"-Button
- ✅ Loading-State mit Spinner während Absenden
- ✅ Submit-Button disabled wenn Textarea leer
- ✅ Abbrechen-Button setzt Textarea zurück

---

### Phase B: Store-Integration (kanbanStore.svelte.ts) ✅ PARTIALLY DONE

**Status:** `addComment()` Methode existiert bereits (Zeilen 295-302)

**Aktueller Code:**
```typescript
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.publishToNostr();  // ← Async! Aber wird nicht gewartet
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

#### B1: **PROBLEM:** `triggerUpdate()` fehlt!

**Fehler:** Nach `addComment()` wird `triggerUpdate()` NICHT aufgerufen
→ `updateTrigger` wird nicht inkrementiert
→ `$derived.by()` wird nicht neu berechnet
→ UI sieht neue Kommentare NICHT!

#### B1-FIX: `addComment()` erweitern

```typescript
// ❌ AKTUELL (FALSCH)
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.publishToNostr();  // ← Kein triggerUpdate()!
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}

// ✅ KORRIGIERT
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.triggerUpdate();  // ← 🔑 KRITISCH: Triggert Reaktivität!
        this.publishToNostr(); // ← Async, wird nicht gewartet
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

#### B2: Optional - Async/Await für Better Error Handling

**Zukünftige Verbesserung (Phase 1.2):**

```typescript
// Mit vollständiger Error-Behandlung
public async addComment(cardId: string, text: string, author: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) {
        throw new Error(`Card with id ${cardId} not found`);
    }
    
    // 1️⃣ Lokal hinzufügen (sofort sichtbar in UI)
    result.card.addComment(text, author);
    this.triggerUpdate();  // Triggert $derived neu
    
    // 2️⃣ Zu Nostr publishen (im Hintergrund)
    try {
        await this.publishToNostr();
        console.log('✅ Kommentar zu Nostr publiziert');
    } catch (error) {
        console.warn('⚠️ Nostr-Publish fehlgeschlagen, aber lokal gespeichert:', error);
        // Kommentar bleibt lokal, wird später synchronisiert
    }
}
```

**Vorteile:**
- ✅ UI-Update ist sofort (nicht blockiert durch Nostr)
- ✅ Fehlerbehandlung getrennt
- ✅ Offline-Fallback funktioniert

---

### Phase C: Nostr Event Publishing (nostrEvents.ts) ⏳ FUTURE

**Datei:** `src/lib/utils/nostrEvents.ts` (noch zu erstellen)

#### C1: Comment Event Schema (Kind 1)

```typescript
/**
 * Erstellt ein Kommentar-Event als Kind 1 (Text Note)
 * 
 * Event-Struktur nach Kanban-NIP Spec:
 * - Kind: 1 (Standard Nostr Text Note)
 * - Tags:
 *   - ["a", "30302:card-author:card-d-tag"] → Ref zur Card (replaceable)
 *   - ["p", "card-author-npub"] → Mention des Card-Autors
 *   - ["e", "card-event-id"] → Optional: Direct Event-Ref (wenn bekannt)
 */
export function createCommentEvent(
  cardId: string,
  cardAuthorNpub: string,
  commentText: string,
  currentUserNpub: string,
  ndk: NDK,
  cardEventId?: string
): NDKEvent {
  const event = new NDKEvent(ndk);
  
  event.kind = 1; // Text Note
  event.content = commentText;
  
  // Tags nach Kanban-NIP
  event.tags = [
    // Ref zur Card (replaceable event reference)
    ['a', `30302:${cardAuthorNpub}:${cardId}`],
    
    // Mention des Card-Autors (für Notifications)
    ['p', cardAuthorNpub],
  ];
  
  // Wenn Card-Event-ID bekannt, füge auch Event-Ref hinzu
  if (cardEventId) {
    event.tags.push(['e', cardEventId, '', 'reply']);
  }
  
  // Alt-Text für Clients, die Kind 1 nicht verstehen
  event.tags.push(['alt', `Kommentar zu Karte: ${cardId}`]);
  
  return event;
}
```

#### C2: Integration in BoardStore

```typescript
// In kanbanStore.svelte.ts

private async publishToNostr(): Promise<void> {
  if (!this.ndk) {
    console.warn('⚠️ NDK nicht initialisiert, Nostr-Publish übersprungen');
    return;
  }
  
  try {
    // Nur Kommentare der letzten Änderung publishen
    // (Komplexe Logik: Welche Card/Comment wurde zuletzt geändert?)
    
    // Simplifizierung: Iteriere über alle Cards und publishe neue Kommentare
    // (Production würde nur Delta publishen)
    
    console.log('📡 Publishing zu Nostr...');
  } catch (error) {
    console.error('❌ Nostr-Publish fehlgeschlagen:', error);
  }
}
```

---

## 🔄 State Update Flow (Detailliert)

### State-Management-Kette:

```
UI: CardViewDialog.svelte
  ↓ input: commentText
  ↓ submit: handleAddComment()
  ↓ call: boardStore.addComment(cardId, text, author)
  ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STORE: kanbanStore.svelte.ts
  ↓
  1️⃣ findCardAndColumn(cardId)
     board.columns → find Column
     column.cards → find Card
  ↓
  2️⃣ card.addComment(text, author)
     Comment-Objekt erstellen:
     {
       id: generateDTag(),
       text: "...",
       author: "npub1...",
       createdAt: generateTimestamp()
     }
     Array Reassignment:
     this.comments = [...this.comments, comment]
  ↓
  3️⃣ triggerUpdate()  ← 🔑 KRITISCH!
     this.updateTrigger++
     → $derived.by() wird neu berechnet
     → uiData wird aktualisiert
     → Komponenten sehen neuen Wert
  ↓
  4️⃣ saveToStorage()
     board.getContextData(true)
     localStorage.setItem('kanban-board-data', JSON.stringify(data))
     → Persistence über Browser-Reload
  ↓
  5️⃣ publishToNostr()  [async, nicht blockierend]
     createCommentEvent(...)
     ndk.publish(event)
     → Speichern auf Nostr Relays
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ↓ Rückkehr zu UI
  ↓
  $effect() beobachtet boardStore.uiData
  ↓ uiData enthält neue comments Array
  ↓
UI: Column.svelte
  ↓ $derived updated items
  ↓
CardViewDialog zeigt neue Kommentare
  ↓
✅ UI aktualisiert, User sieht Kommentar sofort!
```

### 🔑 Kritische State-Updates:

| Punkt | Komponente | Aktion | Folge |
|-------|-----------|--------|-------|
| 1 | BoardModel.ts | `card.comments = [...]` | Array Reassignment |
| 2 | kanbanStore.svelte.ts | `this.updateTrigger++` | $derived.by() neu berechnet |
| 3 | kanbanStore.svelte.ts | `uiData = $derived.by(...)` | UI-Daten aktualisiert |
| 4 | Column.svelte | `$effect` triggert | `items` Props synced |
| 5 | CardViewDialog.svelte | `card.comments` neu gelesen | UI re-rendert |

---

## 📋 Implementierungs-Checklist

### Phase A: UI-Komponente

- [ ] **A1.1** CardViewDialog.svelte öffnen
- [ ] **A1.2** Textarea + Buttons im Comments-Tab hinzufügen
- [ ] **A1.3** Script-Variablen: `commentText`, `isLoading`
- [ ] **A1.4** Import: `Textarea`, `SendIcon`, `LoaderIcon`
- [ ] **A1.5** `handleAddComment()` Handler schreiben
- [ ] **A1.6** Test in Browser: Form wird angezeigt + Enter funktioniert

### Phase B: Store-Fix

- [ ] **B1.1** kanbanStore.svelte.ts öffnen (Zeile ~295)
- [ ] **B1.2** `addComment()` Methode aktualisieren
- [ ] **B1.3** `triggerUpdate()` aufrufen (nach `card.addComment()`)
- [ ] **B1.4** Test: Neuer Kommentar erscheint im Comments-Tab
- [ ] **B1.5** Test: Kommentar bleibt nach Reload (localStorage)

### Phase C: Author-Kontext (AuthStore Integration)

- [ ] **C1.1** AuthStore.svelte.ts erstellen (Phase 1.4)
- [ ] **C1.2** `currentUser` State für npub
- [ ] **C1.3** In CardViewDialog: `boardStore.addComment(..., authStore.currentUser.npub)`
- [ ] **C1.4** Fallback: "anonymous" wenn nicht authentifiziert

### Phase D: Nostr Publishing

- [ ] **D1.1** nostrEvents.ts erstellen
- [ ] **D1.2** `createCommentEvent()` Funktion
- [ ] **D1.3** kanbanStore.publishToNostr() erweitern
- [ ] **D1.4** SyncManager Integration für Offline-Queue

### Phase E: UI-Verbesserungen

- [ ] **E1.1** Kommentar Delete-Button (Kind 5 Events)
- [ ] **E1.2** Edit-Kommentare (Replaceable Events)
- [ ] **E1.3** Kommentar-Thread (Replies)
- [ ] **E1.4** Live-Updates (NDK Subscriptions)

---

## ⚠️ Kritische Fehler zu vermeiden

### ❌ Fehler 1: Kein triggerUpdate()

```typescript
// FALSCH
addComment() {
    card.addComment(text, author);
    // triggerUpdate() vergessen!
    // Folge: UI wird nicht aktualisiert
}

// RICHTIG
addComment() {
    card.addComment(text, author);
    this.triggerUpdate();  // ← MUSS sein!
}
```

### ❌ Fehler 2: Array-Mutation statt Reassignment

```typescript
// FALSCH (in BoardModel.Card)
addComment(text, author) {
    this.comments.push(comment);  // ← Keine Reaktivität!
}

// RICHTIG
addComment(text, author) {
    this.comments = [...this.comments, comment];  // ← Reassignment!
}
```

### ❌ Fehler 3: Await vergessen für Async-Publishing

```typescript
// FALSCH
addComment() {
    card.addComment(text, author);
    this.triggerUpdate();
    this.publishToNostr();  // ← Async, aber kein Error-Handling
}

// RICHTIG (Phase 1.2)
async addComment() {
    card.addComment(text, author);
    this.triggerUpdate();
    try {
        await this.publishToNostr();
    } catch (error) {
        // Graceful Fallback: lokal gespeichert, wird später synced
    }
}
```

### ❌ Fehler 4: Author hardcoded

```typescript
// FALSCH
boardStore.addComment(cardId, text, 'hardcoded-npub');

// RICHTIG
const author = authStore.currentUser?.npub || 'anonymous';
boardStore.addComment(cardId, text, author);
```

---

## 🎯 Meilenstein-Zuordnung (ROADMAP.md)

| Phase | Meilenstein | Task | Status |
|-------|------------|------|--------|
| 1.3 | Kommentar-System | UI-Form | ⏳ TODO |
| 1.3 | Kommentar-System | Store-Integration | 🔄 PARTIAL |
| 1.3 | Kommentar-System | Nostr Events | ⏳ TODO |
| 1.4 | Auth | AuthStore + NIP-07 | ⏳ TODO |
| 1.2 | Offline-First | SyncManager Queue | ⏳ TODO |

---

## 📝 Acceptance Criteria (Phase 1.3)

### Kriterium 1: Kommentar-Eingabe

- ✅ Textarea zeigt sich im Comments-Tab
- ✅ Placeholder-Text: "Schreiben Sie einen Kommentar..."
- ✅ Submit-Button ist disabled bei leerem Textarea
- ✅ Loading-State während Absenden (Spinner sichtbar)

### Kriterium 2: Kommentar wird hinzugefügt

- ✅ Nach Absenden verschwindet Textarea-Inhalt
- ✅ Neuer Kommentar erscheint in der Comments-Liste
- ✅ Kommentar hat: Author + CreatedAt + Text
- ✅ Kommentar bleibt nach Reload (localStorage)

### Kriterium 3: State Management

- ✅ BoardModel.Card.addComment() nutzt Array Reassignment
- ✅ BoardStore.addComment() ruft triggerUpdate() auf
- ✅ $derived.by() wird neu berechnet
- ✅ uiData enthält neuen Kommentar

### Kriterium 4: Nostr Publishing (Phase 1.3.1)

- ✅ createCommentEvent() erstellt Kind 1 Event
- ✅ Event hat "a"-Tag mit Card-Referenz
- ✅ Event hat "p"-Tag mit Card-Author
- ✅ publishToNostr() wird nach addComment() aufgerufen

---

## 🔗 Abhängigkeiten

```
Kommentar-System (Phase 1.3)
  ├─ Abhängig: AuthStore (Phase 1.4) ← Author-npub
  ├─ Abhängig: NDK Context (Phase 1.1) ← Publishing
  ├─ Abhängig: SyncManager (Phase 1.2) ← Offline-Queue
  └─ Abhängig: nostrEvents.ts (Phase 1.3.1) ← Event-Serialisierung
```

---

## 📚 Referenzen

- **AGENTS.md** → Kommentar-Klasse + Card.addComment()
- **STORES.md** → BoardStore State Management
- **Kanban-NIP.md** → Event-Schema (Kind 1, Tags)
- **NOSTR-USER.md** → AuthStore für Author-npub
- **NDK.md** → Event Publishing via NDK

---

**Nächster Schritt:** Implementieren Phase A (UI-Form) + Phase B-Fix (triggerUpdate)
