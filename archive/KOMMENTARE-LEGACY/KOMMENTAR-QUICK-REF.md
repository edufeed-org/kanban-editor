# Kommentar-System: Schnell-Referenz für Entwickler

## 🎯 Die 3 kritischen Teile

### Part 1️⃣: UI-Formular (CardViewDialog.svelte)

**Was:** Textarea + Buttons für Kommentar-Eingabe  
**Wo:** `Tabs.Content value="comments"` Section  
**Wie:** Form mit onsubmit Handler

```svelte
<!-- Im Comments-Tab, NACH den bestehenden Kommentaren -->
<div class="pt-4 border-t">
  <form onsubmit={handleAddComment} class="space-y-3">
    <!-- Input -->
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
    
    <!-- Buttons -->
    <div class="flex gap-2 justify-end">
      <Button
        type="button"
        variant="outline"
        onclick={() => (commentText = '')}
        disabled={isLoading}
      >
        Abbrechen
      </Button>
      <Button type="submit" disabled={!commentText.trim() || isLoading}>
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

**Script-Teil:**
```typescript
let commentText = $state('');
let isLoading = $state(false);

async function handleAddComment(e: Event) {
  e.preventDefault();
  if (!commentText.trim()) return;
  
  isLoading = true;
  try {
    await boardStore.addComment(
      card.id,
      commentText.trim(),
      'current-user-npub' // TODO: Aus AuthStore
    );
    commentText = '';
  } catch (error) {
    console.error('❌ Fehler:', error);
  } finally {
    isLoading = false;
  }
}
```

---

### Part 2️⃣: Store Handler (kanbanStore.svelte.ts) — 🔑 KRITISCH!

**Was:** Kommentar zum Board hinzufügen + Reaktivität triggern  
**Wo:** Zeile ~295 in `BoardStore` Klasse  
**Status:** Methode existiert, aber **BUGGY** ❌

**🐛 Der Bug:**

```typescript
// AKTUELL (FALSCH)
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.publishToNostr();  // ← triggerUpdate() FEHLT!
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

**💥 Problem:** 
- `triggerUpdate()` wird NICHT aufgerufen
- `updateTrigger` wird nicht inkrementiert
- `$derived.by()` wird nicht neu berechnet
- UI sieht den neuen Kommentar NICHT!

**✅ Die Lösung:**

```typescript
// KORRIGIERT
public addComment(cardId: string, text: string, author: string): void {
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
        result.card.addComment(text, author);
        this.triggerUpdate();  // ← 🔑 MANDATORY!
        this.publishToNostr(); // ← Async, wird nicht blockiert
    } else {
        throw new Error(`Card with id ${cardId} not found`);
    }
}
```

**Was triggerUpdate() macht:**
```typescript
private triggerUpdate(): void {
    this.updateTrigger++;  // ← Inkrementiert Zähler
    this.saveToStorage();  // ← Speichert zu localStorage
    console.log('🔄 Update triggered:', this.updateTrigger);
}
```

**Warum das funktioniert:**
```typescript
// In uiData $derived.by()
public uiData = $derived.by(() => {
    const trigger = this.updateTrigger;  // ← Liest den Zähler
    // ... transformation ...
    return [...];  // ← Wird neu berechnet wenn trigger sich ändert
});
```

---

### Part 3️⃣: Nostr Event Creation (createCommentEvent)

**Was:** Kind 1 Event für Nostr-Publishing  
**Wo:** `src/lib/utils/nostrEvents.ts` (noch zu erstellen)  
**Status:** 📋 Geplant für Phase 1.3.1

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
  
  event.kind = 1;  // Text Note
  event.content = commentText;
  
  // Tags nach Kanban-NIP
  event.tags = [
    ['a', `30302:${cardAuthorNpub}:${cardId}`],     // Ref zu Card
    ['p', cardAuthorNpub],                           // Mention Card-Author
    ['alt', `Kommentar zu Karte: ${cardId}`]        // Alt-Text
  ];
  
  if (cardEventId) {
    event.tags.push(['e', cardEventId, '', 'reply']);
  }
  
  return event;
}
```

---

## 🔄 State Update Flow (Schritt-für-Schritt)

```
Schritt 1: User tippt Text
  ├─ commentText wird über bind:value aktualisiert
  └─ $state reaktiv (Svelte 5)

Schritt 2: User klickt "Absenden"
  ├─ handleAddComment() wird aufgerufen
  ├─ isLoading = true (Loading-State aktiviert)
  └─ boardStore.addComment() wird gerufen

Schritt 3: Store findet die Card
  ├─ board.findCardAndColumn(cardId)
  └─ Gibt { card, column } zurück

Schritt 4: Store fügt Kommentar hinzu
  ├─ card.addComment(text, author)
  │  └─ Erstellt Comment: { id, text, author, createdAt }
  │  └─ Array Reassignment: this.comments = [..., comment]
  └─ Board-State ist jetzt lokal aktualisiert ✅

Schritt 5: Store triggert Reaktivität ← 🔑 KRITISCH!
  ├─ this.triggerUpdate()
  │  ├─ updateTrigger++
  │  └─ saveToStorage()
  └─ $derived.by() wird neu berechnet! ✅

Schritt 6: UI wird aktualisiert
  ├─ $derived.by() neu berechnet uiData
  ├─ uiData enthält now new comments[]
  └─ Column.svelte $effect liest uiData

Schritt 7: Component re-rendert
  ├─ CardViewDialog zeigt neue Kommentare
  └─ Textarea wird geleert (commentText = '')

Schritt 8: Async Publishing (Hintergrund)
  ├─ publishToNostr() wird aufgerufen
  ├─ createCommentEvent() erstellt Kind 1 Event
  ├─ Event wird zu Nostr Relays gesendet
  └─ Wenn offline: SyncManager queued es

✅ FERTIG: User sieht Kommentar sofort!
```

---

## 🐛 Die häufigsten Fehler

### Fehler 1: triggerUpdate() vergessen

```typescript
// ❌ FALSCH
result.card.addComment(text, author);
// triggerUpdate() vergessen
this.publishToNostr();

// ✅ RICHTIG
result.card.addComment(text, author);
this.triggerUpdate();  // ← MUST HAVE!
this.publishToNostr();
```

**Symptom:** Kommentar ist lokal da (console.log zeigt's), aber UI zeigt's nicht!

---

### Fehler 2: Array-Mutation statt Reassignment

```typescript
// ❌ FALSCH (in BoardModel.Card)
addComment(text, author) {
    this.comments.push({...});  // Mutation!
}

// ✅ RICHTIG
addComment(text, author) {
    this.comments = [...this.comments, {...}];  // Reassignment!
}
```

**Symptom:** Svelte 5 sieht Mutation nicht → keine Reaktivität

---

### Fehler 3: Auf Nostr-Publish warten

```typescript
// ❌ FALSCH
await this.publishToNostr();  // Blockiert UI!

// ✅ RICHTIG
this.publishToNostr();  // Fire & forget (mit Error-Handler)
```

**Symptom:** Lange Verzögerung bei Absenden, bis Relay antwortet

---

### Fehler 4: Author hardcoded

```typescript
// ❌ FALSCH
boardStore.addComment(cardId, text, 'npub1xyz...');

// ✅ RICHTIG
const author = authStore.currentUser?.npub || 'anonymous';
boardStore.addComment(cardId, text, author);
```

**Symptom:** Alle Kommentare haben same Author!

---

## ✅ Test-Checklist

Nachdem Implementierung fertig:

```
Phase A: UI-Form
  □ Textarea wird im Comments-Tab angezeigt
  □ Placeholder-Text sichtbar
  □ Submit-Button disabled bei leerem Text
  □ Loading-State mit Spinner funktioniert

Phase B: Store-Integration
  □ Kommentar wird nach Absenden angezeigt
  □ Kommentar hat Author + CreatedAt + Text
  □ Kommentar bleibt nach Browser-Reload (localStorage)
  □ console.log zeigt updateTrigger inkrementiert

Phase C: Multi-Card
  □ Kommentare bei verschiedenen Cards sind getrennt
  □ Löschen eines Kommentars funktioniert
  □ Edit funktioniert (Placeholder für Phase 1.3.2)

Phase D: Offline
  □ Wenn offline: Kommentar wird lokal gespeichert
  □ Nach Online: Wird zu Nostr synchronisiert
  □ SyncManager zeigt in Queue

Phase E: Nostr
  □ createCommentEvent() erstellt Kind 1
  □ Event hat "a"-Tag mit Card-Ref
  □ Event hat "p"-Tag mit Author
  □ Event wird zu Relays publiziert
```

---

## 🔗 Dependencies (Must-Have Imports)

```typescript
// CardViewDialog.svelte
import { Textarea } from '$lib/components/ui/textarea/index.js';
import SendIcon from '@lucide/svelte/icons/send';
import LoaderIcon from '@lucide/svelte/icons/loader';
import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

// kanbanStore.svelte.ts
import { Comment } from '../classes/BoardModel.js';
import { generateDTag, generateTimestamp } from '../utils/idGenerator.js';
```

---

## 📖 Dokumente zum Nachlesen

- **AGENTS.md** → Kommentar Interface + addComment()
- **STORES.md** → triggerUpdate() Mechanik
- **Kanban-NIP.md** → Kind 1 Event Schema
- **MULTI-LAYER STORAGE.md** → Array Reassignments & Reaktivität

---

**TL;DR:** 
1. Form in CardViewDialog hinzufügen ✅
2. `triggerUpdate()` in store addComment() aufrufen 🔑
3. Kommentare werden live in UI angezeigt ✅
4. localStorage speichert automatisch ✅
5. Später: Nostr Publishing ⏳
