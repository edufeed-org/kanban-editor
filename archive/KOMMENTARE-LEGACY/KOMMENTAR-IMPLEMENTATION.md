# Kommentar-System: Visual Implementation Guide

## 🎯 Das Problem (AKTUELL)

```
CardViewDialog.svelte
│
├─ Tabs.Content value="comments"
│  │
│  ├─ ✅ Existing Comments Loop
│  │  └─ Zeigt alte Kommentare an
│  │
│  ├─ ❌ FEHLEND: Kommentar-Input-Form
│  │  └─ Kein Textarea zum Hinzufügen neuer Kommentare
│  │  └─ Kein "Absenden"-Button
│  │
│  └─ User kann NUR lesen, nicht schreiben!
│     └─ 💔 Schlechte UX
```

---

## 🔧 Die Lösung (3 Parts)

### PART 1: UI-Komponente (CardViewDialog.svelte)

```svelte
<!-- EXISTING CODE (bleibt gleich) -->
{#if (card.comments || []).length > 0}
  <div class="space-y-3">
    {#each card.comments as comment (comment.id)}
      <div class="p-3 bg-muted rounded-md space-y-1">
        <div class="flex justify-between items-center">
          <span class="font-medium text-sm">{comment.author}</span>
          <span class="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleDateString('de-DE')}
          </span>
        </div>
        <p class="text-sm text-foreground">{comment.text}</p>
      </div>
    {/each}
  </div>
{:else}
  <p class="text-sm text-muted-foreground text-center py-8">
    Keine Kommentare vorhanden
  </p>
{/if}

<!-- ➕ NEW: Kommentar-Eingabe-Form -->
<div class="pt-4 border-t">
  <form onsubmit={handleAddComment} class="space-y-3">
    
    <!-- Textarea -->
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

<!-- Script-Teil (in <script lang="ts"> block) -->
<script lang="ts">
  // ... existing imports ...
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import SendIcon from '@lucide/svelte/icons/send';
  import LoaderIcon from '@lucide/svelte/icons/loader';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  
  // ... existing state ...
  let commentText = $state('');
  let isLoading = $state(false);
  
  async function handleAddComment(e: Event) {
    e.preventDefault();
    
    if (!commentText.trim()) return;
    
    isLoading = true;
    try {
      // ⚠️ TODO: Holen Sie npub aus AuthStore (Phase 1.4)
      const author = 'current-user-npub';  // PLACEHOLDER
      
      await boardStore.addComment(
        card.id,
        commentText.trim(),
        author
      );
      
      // Success: reset form
      commentText = '';
      
      console.log('✅ Kommentar abgesendet');
    } catch (error) {
      console.error('❌ Fehler beim Absenden:', error);
      // TODO: Toast-Fehler anzeigen
    } finally {
      isLoading = false;
    }
  }
</script>
```

**UI-Result:**
```
┌─────────────────────────────────────────────────────┐
│  Kommentare Tab                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Existing Comment 1                                 │
│  ┌────────────────────────────────────────────────┐│
│  │ Alice                     2025-10-20           ││
│  │ Das ist ein alter Kommentar                    ││
│  └────────────────────────────────────────────────┘│
│                                                     │
│  Existing Comment 2                                 │
│  ┌────────────────────────────────────────────────┐│
│  │ Bob                       2025-10-19           ││
│  │ Mein Gedanke dazu...                          ││
│  └────────────────────────────────────────────────┘│
│                                                     │
│  ────────────────────────────────────────────────   │
│                                                     │
│  Kommentar hinzufügen                              │
│  ┌────────────────────────────────────────────────┐│
│  │ ┌──────────────────────────────────────────┐ ││
│  │ │ Schreiben Sie einen Kommentar...        │ ││
│  │ │                                          │ ││
│  │ │ ← User tippt hier                       │ ││
│  │ │                                          │ ││
│  │ │                                          │ ││
│  │ └──────────────────────────────────────────┘ ││
│  │                                               ││
│  │ [Abbrechen]              [➤ Absenden]        ││
│  └────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### PART 2: Store-Integration (kanbanStore.svelte.ts)

**Current Code (FALSCH):**
```typescript
// Zeile ~295 in BoardStore Klasse
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

**Fixed Code (RICHTIG):**
```typescript
// Zeile ~295 in BoardStore Klasse - EINFACH 1 ZEILE HINZUFÜGEN!
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

**Diff View:**
```diff
  public addComment(cardId: string, text: string, author: string): void {
      const result = this.board.findCardAndColumn(cardId);
      if (result) {
          result.card.addComment(text, author);
+         this.triggerUpdate();    // ← THIS LINE IS MISSING!
          this.publishToNostr();
      } else {
          throw new Error(`Card with id ${cardId} not found`);
      }
  }
```

**Was triggerUpdate() macht:**
```typescript
private triggerUpdate(): void {
    this.updateTrigger++;              // ← Incrementiert Counter
    this.saveToStorage();              // ← Speichert zu localStorage
    console.log('🔄 Update triggered:', this.updateTrigger);
}

// Warum das wichtig ist:
public uiData = $derived.by(() => {
    const trigger = this.updateTrigger;  // ← Abhängigkeit!
    // ... wenn trigger sich ändert, wird $derived neu gerechnet ...
    return [...];  // ← Updated Output
});
```

**Visualisierung (VORHER vs NACHHER):**

```
VORHER (BUG):
│
├─ User klickt "Absenden"
├─ boardStore.addComment() wird aufgerufen
├─ comment wird zu board.comments hinzugefügt ✅
├─ localStorage wird NICHT aktualisiert ❌
├─ $derived.by() wird NICHT neu berechnet ❌
├─ UI zeigt Kommentar NICHT ❌
│
└─ Kommentar ist lokal da, aber unsichtbar 💔


NACHHER (FIXED):
│
├─ User klickt "Absenden"
├─ boardStore.addComment() wird aufgerufen
├─ comment wird zu board.comments hinzugefügt ✅
├─ this.triggerUpdate() wird aufgerufen ✅
│  ├─ updateTrigger++ (0 → 1)
│  └─ saveToStorage() → localStorage ✅
├─ $derived.by() erkennt Änderung ✅
│  └─ uiData wird neu berechnet
├─ Column.svelte $effect wird triggert ✅
│  └─ items Props werden aktualisiert
├─ CardViewDialog re-rendert ✅
│
└─ UI zeigt neuen Kommentar sofort! 🎉
```

---

### PART 3: Nostr Event Publishing (FUTURE)

```typescript
// In src/lib/utils/nostrEvents.ts

import { NDKEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

export function createCommentEvent(
  cardId: string,
  cardAuthorNpub: string,
  commentText: string,
  currentUserNpub: string,
  ndk: NDK,
  cardEventId?: string
): NDKEvent {
  const event = new NDKEvent(ndk);
  
  // Kind 1 = Text Note (Kommentar)
  event.kind = 1;
  event.content = commentText;
  
  // Tags nach Kanban-NIP
  event.tags = [
    // "a"-tag: Referenz zum replaceable Card Event
    ['a', `30302:${cardAuthorNpub}:${cardId}`],
    
    // "p"-tag: Mention des Card-Autors (für Notifications)
    ['p', cardAuthorNpub],
    
    // Alt-Text für Clients, die Kind 1 nicht unterstützen
    ['alt', `Kommentar zu Karte: ${cardId}`]
  ];
  
  // Optional: Direct Event Reference (wenn Card als Event publiziert)
  if (cardEventId) {
    event.tags.push(['e', cardEventId, '', 'reply']);
  }
  
  return event;
}

// Integration in boardStore.publishToNostr():
private async publishToNostr(): Promise<void> {
  if (!this.ndk) {
    console.warn('⚠️ NDK nicht initialisiert');
    return;
  }
  
  try {
    // Iterate über alle Cards und Comments
    // (Produktiv würde man nur neu hinzugefügte Items publizieren)
    
    for (const column of this.board.columns) {
      for (const card of column.cards) {
        for (const comment of card.comments) {
          // Erstelle Nostr Event
          const event = createCommentEvent(
            card.id,
            this.board.author || 'unknown',
            comment.text,
            comment.author,
            this.ndk,
            card.eventId  // Optional
          );
          
          // Publish oder Queue (wenn offline)
          await this.syncManager.publishOrQueue(event, 'comment');
        }
      }
    }
    
    console.log('📡 Nostr Publishing fertig');
  } catch (error) {
    console.error('❌ Nostr Publishing fehlgeschlagen:', error);
  }
}
```

**Nostr Event Result:**
```json
{
  "kind": 1,
  "created_at": 1729376400,
  "content": "Mein erster Kommentar",
  "tags": [
    ["a", "30302:npub1xyz:card-123"],
    ["p", "npub1xyz"],
    ["alt", "Kommentar zu Karte: card-123"]
  ]
}
```

---

## 🔍 Debugging Guide

### Symptom 1: Kommentar wird nicht angezeigt
```
Ursache: triggerUpdate() nicht aufgerufen
Debugging:
  1. Console öffnen (F12)
  2. Kommentar tippen und absenden
  3. Checke console.log: "🔄 Update triggered: ..."
  4. Wenn nicht da: triggerUpdate() fehlt in addComment()
```

### Symptom 2: Kommentar ist weg nach Reload
```
Ursache: saveToStorage() wird nicht aufgerufen
Debugging:
  1. Chrome DevTools → Application → LocalStorage
  2. Checke: localStorage['kanban-board-data']
  3. JSON.parse() und nach comments suchen
  4. Wenn Kommentar fehlt: triggerUpdate() ruft saveToStorage() nicht auf
```

### Symptom 3: Author ist falsch
```
Ursache: AuthStore noch nicht implementiert
Debugging:
  1. In CardViewDialog: setze feste npub statt AuthStore
  2. Kommentar hinzufügen
  3. Checke: comment.author in UI
  4. Wenn falsch: npub-String prüfen
```

---

## 📝 Checklist vor Submit

### Phase A: UI-Form
- [ ] Textarea wird in Comments-Tab angezeigt
- [ ] Placeholder-Text: "Schreiben Sie einen Kommentar..."
- [ ] SendIcon neben "Absenden"-Button
- [ ] LoaderIcon während Loading
- [ ] Form wird leer nach Absenden
- [ ] Buttons disabled bei leerem Text
- [ ] Abbrechen-Button funktioniert

### Phase B: Store-Fix
- [ ] triggerUpdate() wird aufgerufen nach addComment()
- [ ] updateTrigger wird inkrementiert (console.log zeigt's)
- [ ] Neuer Kommentar erscheint in UI
- [ ] Kommentar bleibt nach F5 Reload
- [ ] localStorage enthält neuen Kommentar

### Phase C: AuthStore (Later)
- [ ] AuthStore.svelte.ts erstellt
- [ ] currentUser State mit npub
- [ ] loginWithNIP07() implementiert
- [ ] In CardViewDialog: authStore.currentUser?.npub als author

### Phase D: Nostr (Later)
- [ ] createCommentEvent() erstellt Kind 1
- [ ] Event hat "a"-Tag mit Card-Ref
- [ ] Event hat "p"-Tag mit Author
- [ ] publishToNostr() wird aufgerufen

---

## 🚀 Performance Tips

### 1. Lazy Load Comments (Future)
```typescript
// Lade nur die ersten 10 Kommentare
const visibleComments = card.comments.slice(0, 10);
const hiddenCount = Math.max(0, card.comments.length - 10);

// "Load More" Button wenn mehr Kommentare vorhanden
{#if hiddenCount > 0}
  <Button onclick={() => loadMoreComments()}>
    +{hiddenCount} weitere Kommentare
  </Button>
{/if}
```

### 2. Virtuelle Lists (für viele Kommentare)
```typescript
// Bei >100 Kommentaren: virtuelle Liste verwenden
import { VirtualList } from '@sveltejs/kit';
```

### 3. Optimize: Only save changed Comments
```typescript
// Statt alle Comments zu speichern, nur neue
const delta = newComments.filter(c => !oldComments.find(o => o.id === c.id));
```

---

## 🎓 Learning Resources

- **KOMMENTAR-SYSTEM.md** - Vollständig (50+ Pages)
- **KOMMENTAR-QUICK-REF.md** - Quick Start
- **KOMMENTAR-ARCHITEKTUR.md** - Diagramme & Flows
- **AGENTS.md** - Core Class Definitions
- **STORES.md** - State Management Deep Dive

---

**Ready to implement?** Start with Phase A (UI-Form) + Phase B-Fix (triggerUpdate)!
