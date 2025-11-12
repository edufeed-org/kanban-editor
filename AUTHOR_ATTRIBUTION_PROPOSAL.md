# Author-Attribution Proposal

**Datum:** 12. November 2025  
**Status:** ✅ **IMPLEMENTIERT** (Phase 1: Core Implementation)  
**Branch:** `author-attribution`

## 📊 Implementierungs-Status

- ✅ **Phase 1: Core Implementation** (Abgeschlossen am 12.11.2025)
  - ✅ `getAuthorAttribution()` Methode in `authStore.svelte.ts` (Zeile ~573)
  - ✅ `AuthStoreProxy.getAuthorAttribution()` hinzugefügt (Zeile ~899)
  - ✅ TypeScript-Interfaces definiert
  - ✅ Dokumentation in `docs/ARCHITECTURE/STORES/AUTHSTORE.md`
  - ✅ TypeScript-Check: 0 Errors
  
- ✅ **Phase 2: BoardStore Integration** (Abgeschlossen am 12.11.2025)
  - ✅ `BoardModel.ts`: `authorName?: string` zu Comment, CardProps, BoardProps hinzugefügt
  - ✅ `Board.getContextData()`: `authorName` Serialisierung hinzugefügt
  - ✅ `Card.getContextData()`: `authorName` bereits vorhanden (verifiziert)
  - ✅ `Card.addComment()`: `authorName` Parameter hinzugefügt
  - ✅ `kanbanStore.svelte.ts`: `getAuthorFields()` Methode hinzugefügt
  - ✅ `kanbanStore.svelte.ts`: `createBoard()` verwendet `getAuthorFields()`
  - ✅ `kanbanStore.svelte.ts`: `createCard()` verwendet `getAuthorFields()`
  - ✅ `kanbanStore.svelte.ts`: `addComment()` verwendet `getAuthorFields()`
  - ✅ `BoardOperations.createCard()`: `authorName` Parameter hinzugefügt
  - ✅ `BoardOperations.addComment()`: `authorName` Parameter hinzugefügt
  
- ✅ **Phase 3: UI Integration** (Teilweise abgeschlossen am 12.11.2025)
  - ✅ `CardViewDialog.svelte`: `formatAuthorName()` erweitert für `authorName` Parameter
  - ✅ `CardViewDialog.svelte`: Beide `formatAuthorName()` Aufrufe aktualisiert (Zeile ~443, ~459)
  - ✅ `Card.svelte`: Bereits `authorName` Unterstützung (verifiziert)
  - ⏳ Andere Komponenten prüfen (CardDialog, AvatarStack)
  
- ⏳ **Phase 4: Testing & Migration**
  - [ ] Unit-Tests für `getAuthorAttribution()`
  - [ ] Backward Compatibility Tests (alte Boards ohne `authorName`)
  - [ ] Migration-Script (optional: Enrichment mit Namen)

---

## 🎯 Problem

Aktuell gibt es **zwei verschiedene Ansätze** für Author-Attribution:

1. **kanbanStore** (Board/Card): `getPubkey()` → `"0a1b2c3d..."`
2. **CardViewDialog** (Comments): `getUserName() || getDisplayName() || getPubkey()` → `"Alice"`

Das führt zu **inkonsistenter Speicherung** und **verwirrenden UI-Darstellungen**.

---

## 💡 Lösungsvorschlag: Dual-Field Strategy

### Konzept

**Speichere ZWEI Felder:**

```typescript
interface CardProps {
  author: string;        // Pubkey (IMMER, für Nostr)
  authorName?: string;   // Display Name (optional, für UI)
}

interface BoardProps {
  author: string;        // Pubkey (IMMER)
  authorName?: string;   // Display Name (optional)
}
```

### Vorteile

1. ✅ **Nostr-konform** - `author` ist immer der Pubkey
2. ✅ **UI-freundlich** - `authorName` für lesbare Anzeige
3. ✅ **Unveränderlich** - Pubkey bleibt gleich, auch wenn Name sich ändert
4. ✅ **Rückwärtskompatibel** - Alte Boards ohne `authorName` funktionieren weiter

---

## 🔧 Implementation

### 1. BoardModel.ts erweitern

```typescript
// In src/lib/classes/BoardModel.ts

export interface Comment extends NostrElement {
  text: string;
  author: string;         // Pubkey (Hex)
  authorName?: string;    // 🆕 Display Name (optional)
  createdAt: string;
  eventId?: string;
  syncStatus?: 'local' | 'syncing' | 'synced' | 'failed';
}

export interface CardProps {
  id?: string;
  heading: string;
  content?: string;
  author?: string;        // Pubkey (Hex)
  authorName?: string;    // 🆕 Display Name (optional)
  // ... rest
}

export interface BoardProps {
  id?: string;
  name: string;
  author?: string;        // Pubkey (Hex)
  authorName?: string;    // 🆕 Display Name (optional)
  // ... rest
}

export class Card {
  public author?: string;
  public authorName?: string;  // 🆕
  
  constructor(props: CardProps) {
    this.author = props.author;
    this.authorName = props.authorName;  // 🆕
    // ...
  }
  
  getContextData() {
    return {
      // ...
      author: this.author,
      authorName: this.authorName,  // 🆕
    };
  }
}

export class Board {
  public author?: string;
  public authorName?: string;  // 🆕
  
  // Analog zu Card
}

export class Comment {
  public author: string;
  public authorName?: string;  // 🆕
  
  constructor(props: Comment) {
    this.author = props.author;
    this.authorName = props.authorName;  // 🆕
    // ...
  }
}
```

### 2. AuthStore Helper-Methode

```typescript
// In src/lib/stores/authStore.svelte.ts

/**
 * 🎯 Get author attribution data for Board/Card creation
 * Returns BOTH pubkey (required) and display name (optional)
 * 
 * USE CASES:
 * - Board creation
 * - Card creation
 * - Comment creation
 * - Any object that needs author tracking
 * 
 * @returns { pubkey: string, displayName: string | null }
 * 
 * @example
 * const { pubkey, displayName } = authStore.getAuthorAttribution();
 * const card = new Card({
 *   heading: 'Task',
 *   author: pubkey,         // Always pubkey (for Nostr)
 *   authorName: displayName // Optional readable name (for UI)
 * });
 */
public getAuthorAttribution(): { pubkey: string; displayName: string | null } {
  const pubkey = this.getPubkey() || 'anonymous';
  const displayName = this.getUserName(); // null if no profile name
  
  return { pubkey, displayName };
}
```

### 3. kanbanStore.svelte.ts anpassen

```typescript
// In src/lib/stores/kanbanStore.svelte.ts

// ❌ VORHER
private getSafeAuthor(): string {
    return authStore.getPubkey() || 'anonymous';
}

// ✅ NACHHER
private getAuthorAttribution(): { pubkey: string; displayName: string | null } {
    try {
        if (!authStore || typeof authStore.getAuthorAttribution !== 'function') {
            return { pubkey: 'anonymous', displayName: null };
        }
        return authStore.getAuthorAttribution();
    } catch {
        return { pubkey: 'anonymous', displayName: null };
    }
}

// Bei Board-Erstellung:
public createBoard(name: string, description?: string): string {
    const { pubkey, displayName } = this.getAuthorAttribution();
    
    const board = new Board({
        name,
        description,
        author: pubkey,           // Pubkey für Nostr
        authorName: displayName   // Name für UI
    });
    
    // ...
}

// Bei Card-Erstellung:
public createCard(columnId: string, heading: string): string {
    const { pubkey, displayName } = this.getAuthorAttribution();
    
    const column = this.board.findColumn(columnId);
    const card = new Card({
        heading,
        author: pubkey,
        authorName: displayName
    });
    
    // ...
}

// Bei Comment-Erstellung:
public addComment(cardId: string, text: string): void {
    const { pubkey, displayName } = this.getAuthorAttribution();
    
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card } = result;
    card.addComment({
        text,
        author: pubkey,
        authorName: displayName,
        createdAt: new Date().toISOString()
    });
    
    this.triggerUpdate();
}
```

### 4. UI-Anzeige

```svelte
<!-- In Card.svelte / CardViewDialog.svelte -->

<script>
  let { card } = $props();
  
  // Zeige authorName wenn verfügbar, sonst getDisplayNameForPubkey()
  let displayAuthor = $derived(
    card.authorName || authStore.getDisplayNameForPubkey(card.author || 'anonymous')
  );
</script>

<p class="text-xs text-muted-foreground">
  Erstellt von: {displayAuthor}
</p>

<!-- Comment-Anzeige -->
{#each card.comments as comment}
  <div class="comment">
    <p class="text-xs font-semibold">
      {comment.authorName || authStore.getDisplayNameForPubkey(comment.author)}
    </p>
    <p class="text-sm">{comment.text}</p>
  </div>
{/each}
```

---

## 📊 Migration Path

### Phase 1: Rückwärtskompatibilität

Alte Boards ohne `authorName`:
```typescript
// In reconstructBoard():
const card = new Card({
  heading: cardData.heading,
  author: cardData.author,           // ✅ Vorhanden
  authorName: cardData.authorName    // ⚠️ undefined bei alten Karten
});

// Comments analog:
const comment: Comment = {
  text: commentData.text,
  author: commentData.author,
  authorName: commentData.authorName,  // ⚠️ undefined bei alten Comments
  createdAt: commentData.createdAt
};

// In UI:
card.authorName || authStore.getDisplayNameForPubkey(card.author)
comment.authorName || authStore.getDisplayNameForPubkey(comment.author)
// → Falls authorName fehlt: Fetch Name von Nostr
```

### Phase 2: Gradual Enhancement

- Neue Boards/Cards/Comments haben beide Felder
- Alte Boards werden bei nächstem Edit aktualisiert
- UI zeigt immer korrekte Namen (mit Fallback)

### Phase 3: Comment-Migration

Für alte Comments ohne `authorName`:
```typescript
// Optional: Background-Job zum Nachladen von Namen
async function enrichOldComments(card: Card) {
  for (const comment of card.comments) {
    if (!comment.authorName && comment.author !== 'anonymous') {
      // Fetch name from Nostr
      const name = await authStore.getDisplayNameForPubkey(comment.author);
      comment.authorName = name;
    }
  }
}
```

---

## 🎯 Acceptance Criteria

- [ ] `Comment`, `CardProps` und `BoardProps` haben `authorName` Feld
- [ ] `authStore.getAuthorAttribution()` existiert
- [ ] `kanbanStore` nutzt neue Helper-Methode für Board/Card/Comment
- [ ] `addComment()` in kanbanStore nutzt `getAuthorAttribution()`
- [ ] UI zeigt lesbare Namen (nicht Pubkeys)
- [ ] Alte Boards ohne `authorName` funktionieren weiter
- [ ] Alte Comments ohne `authorName` funktionieren weiter
- [ ] Nostr Events haben korrekten Pubkey in `pubkey` Tag
- [ ] Tests für neue Attribution-Logik (Board/Card/Comment)

---

## 🚀 Alternative: Name-First Strategy (NICHT empfohlen)

**Konzept:** Speichere nur `userName`, hole Pubkey bei Bedarf

**Nachteile:**
- ❌ Nostr Events brauchen immer Pubkey
- ❌ Name kann sich ändern → Attribution verloren
- ❌ Offline nicht möglich (braucht authStore lookup)

**Fazit:** Dual-Field ist besser!

---

## 📝 Offene Fragen

1. **Soll authorName bei jedem Save aktualisiert werden?**
   - Nein → Attribution bleibt wie bei Erstellung
   - Ja → Zeigt aktuellen Namen (auch wenn User ihn ändert)

2. **Was passiert bei Demo-User?**
   - `pubkey: "demo-xxxx"`
   - `authorName: "Demo User"`
   - Funktioniert identisch!

3. **~~Brauchen wir authorName für Comments?~~**
   - ✅ **JA!** Konsistent mit Cards/Boards
   - ✅ Comment-Interface wurde erweitert
   - ✅ UI zeigt lesbare Namen für Comment-Autoren

---

## ✅ Next Steps

1. Review dieses Proposals
2. Entscheidung: Dual-Field oder andere Strategie?
3. Implementation in Feature-Branch
4. Tests schreiben
5. Migration alter Boards testen
6. Merge nach board-improvements

---

**Verantwortlich:** AI Agent + Team  
**Timeline:** Nach Approval → 2-3 Stunden Implementation
