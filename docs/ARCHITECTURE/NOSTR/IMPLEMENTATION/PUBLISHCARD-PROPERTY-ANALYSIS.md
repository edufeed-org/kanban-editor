# 📊 publishCard: Property-Analyse

**Datei:** `src/lib/stores/boardstore/nostr.ts` (Lines 781-857)  
**Konvertierungsfunktion:** `cardToNostrEvent()` in `src/lib/utils/nostrEvents.ts`  
**Aktualisiert:** 11. November 2025

---

## 🎯 Zusammenfassung

| Property | Status | Im Nostr Event | Nostr Tag | Hinweise |
|----------|--------|---|---|---|
| **id** | ✅ GEPUSHED | Ja | `["d", card.id]` | d-tag (unique identifier) |
| **eventId** | ✅ GEPUSHED | Ja | Event-ID nach Publish | Wird nach dem Publish erfasst |
| **heading** | ✅ GEPUSHED | Ja | `["title", card.heading]` | Kartentitel |
| **content** | ✅ GEPUSHED | Ja | `["description", card.content]` + event.content | Kartenbeschreibung |
| **color** | ✅ GEPUSHED | Ja | `["color", card.color]` | Kartenfabe |
| **image** | ❌ NICHT GEPUSHED | **FEHLT** | **KEIN TAG** | ⚠️ URL zum Kartenbild |
| **labels** | ✅ GEPUSHED | Ja | `["label", label1, label2, ...]` | Mehrere label-Tags |
| **links** | ✅ GEPUSHED | Ja | `["r", url, title]` | Reference tags (beliebig viele) |
| **comments** | ⚠️ COUNT ONLY | Teilweise | `["comment-count", N]` | Nur Anzahl, nicht Inhalte |
| **author** | ✅ GEPUSHED | Ja | `["p", card.author]` | Creator pubkey |
| **authorName** | ❌ NICHT GEPUSHED | **FEHLT** | **KEIN TAG** | ⚠️ Lesbar Display Name |
| **publishState** | ✅ GEPUSHED | Ja | `["state", publishState]` | draft \| published \| archived |
| **attendees** | ❌ NICHT GEPUSHED | **FEHLT** | **KEIN TAG** | ⚠️ Array von User-Pubkeys |
| **rank** | ✅ GEPUSHED | Ja | `["rank", rank]` | Position in der Spalte |
| **columnId** | ✅ GEPUSHED | Ja | `["s", columnId]` | PRIMARY: Spalten-ID (laut Kanban-NIP) |
| **boardRef** | ✅ GEPUSHED | Ja | `["a", boardRef]` | Board-Referenz (30301:pubkey:board-id) |
| **createdAt** | ✅ GEPUSHED | Ja | Nostr `created_at` | Unix timestamp (vom NDK gesetzt) |
| **updatedAt** | ✅ GEPUSHED | Ja | Nostr `created_at` (für LWW) | ISO string (wird zu Nostr timestamp) |

---

## ✅ KORREKT GEPUSHTE PROPERTIES (14/18)

### 1. **id** ✅
```typescript
// In cardToNostrEvent()
tags: [['d', card.id], ...]
```
- **Nostr Tag:** `["d", "card-id-xxx"]`
- **Format:** d-tag (unique identifier für replaceable events)
- **Grund:** Erforderlich für Kind 30302 (replaceable card event)

### 2. **eventId** ✅ (NEU - nach Publish)
```typescript
// In publishCard()
const publishedEvent = await syncManager.publishOrQueue(...);
if (publishedEvent?.id) {
    card.eventId = publishedEvent.id;
    console.log(`🔑 Card Event-ID captured: ${card.eventId}`);
}
```
- **Status:** Nach erfolgreichem Publish gespeichert
- **Nostr:** Die Event-ID wird vom Nostr Relay generiert
- **Grund:** Notwendig für Deletion (NIP-09 Kind 5 Events)
- **Storage:** Wird zu localStorage gespeichert via `BoardStorage.saveBoard(board)`

### 3. **heading** ✅
```typescript
// In cardToNostrEvent()
tags: [..., ['title', card.heading], ...]
```
- **Nostr Tag:** `["title", "Kartentitel"]`
- **Grund:** Primärer Kartentitel
- **Erforderlich:** Ja (validation in `validateEventTags()`)

### 4. **content** ✅
```typescript
// In cardToNostrEvent()
if (card.content) {
    tags.push(['description', card.content]);
}
event.content = card.content || ''; // Markdown description
```
- **Nostr Tags:** 
  - `["description", "Kartenbeschreibung"]` (tag)
  - `event.content = "..."` (event content für Markdown)
- **Grund:** Detaillierte Kartenbeschreibung
- **Optional:** Ja

### 5. **color** ✅
```typescript
// In cardToNostrEvent()
if (card.color) {
    tags.push(['color', card.color]);
}
```
- **Nostr Tag:** `["color", "color-gradient-1"]`
- **Grund:** Visuelle Kartenfabe
- **Optional:** Ja

### 6. **labels** ✅
```typescript
// In cardToNostrEvent()
if (card.labels && card.labels.length > 0) {
    card.labels.forEach(label => {
        tags.push(['label', label]);
    });
}
```
- **Nostr Tags:** `["label", "tag1"]`, `["label", "tag2"]`, ...
- **Grund:** Mehrere Labels pro Karte
- **Optional:** Ja
- **Format:** Ein tag pro label

### 7. **links** ✅
```typescript
// In cardToNostrEvent()
if (card.links && card.links.length > 0) {
    card.links.forEach(link => {
        tags.push(['r', link.url, link.title || '']);
    });
}
```
- **Nostr Tags:** `["r", "https://...", "Link-Titel"]`
- **Grund:** Externe Ressourcen/Links
- **Optional:** Ja
- **Format:** "r"-Tags (reference)

### 8. **comments** ⚠️ (NUR COUNT)
```typescript
// In cardToNostrEvent()
if (card.comments && card.comments.length > 0) {
    tags.push(['comment-count', String(card.comments.length)]);
}
```
- **Nostr Tag:** `["comment-count", "5"]`
- **⚠️ WICHTIG:** NUR die ANZAHL wird gepushed!
- **Grund:** Kommentare sind separate Kind 1 Events
- **Kommentar-Inhalte:** Werden via `publishComment()` separat publiziert

### 9. **author** ✅
```typescript
// In cardToNostrEvent()
if (card.author) {
    tags.push(['p', card.author]);
}
```
- **Nostr Tag:** `["p", "pubkey-hex"]`
- **Grund:** Kartenerstellung - Nostr Public Key des Erstellers
- **Optional:** Ja (aber empfohlen)

### 10. **publishState** ✅
```typescript
// In cardToNostrEvent()
if (card.publishState) {
    tags.push(['state', card.publishState]);
}

// PLUS: Relay-Auswahl basierend auf State
const normalizedState = (publishState === 'archived' ? 'private' : publishState);
const targetRelays = getTargetRelays({ publishState: normalizedState, ... });
```
- **Nostr Tag:** `["state", "draft" | "published" | "archived"]`
- **Relay-Handling:** 
  - `'draft'` → Private Relays (abhängig von `draftPublishingMode`)
  - `'published'` → Public + Private Relays
  - `'archived'` → Private Relays (normalisiert zu 'private')
- **Grund:** Sichtbarkeit und Sync-Strategie

### 11. **rank** ✅
```typescript
// In publishCard()
const rank = column.cards.indexOf(card);  // Position IN der Spalte!

// In cardToNostrEvent()
tags: [..., ['rank', String(rank)], ...]
```
- **Nostr Tag:** `["rank", "0"]`, `["rank", "1"]`, etc.
- **Grund:** Position innerhalb der Spalte
- **⚠️ WICHTIG:** Ist Index in `column.cards[]`, nicht globale Position!

### 12. **columnId** ✅ (PRIMARY)
```typescript
// In publishCard()
const event = cardToNostrEvent(
    card,
    column.id,      // ← Spalten-ID
    column.name,    // ← Spalten-Name (für Display)
    rank,
    boardRef,
    this.ndk
);

// In cardToNostrEvent()
tags: [..., ['s', columnId], ...]
```
- **Nostr Tag:** `["s", "column-xxx"]`
- **Grund:** PRIMARY Spalten-Referenz (laut Kanban-NIP!)
- **⚠️ KRITISCH:** Muss Column-ID sein, NICHT Name!
- **Deserialisierung:** Via `nostrEventToCard()` → `cardProps.columnId`

### 13. **boardRef** ✅
```typescript
// In publishCard()
const boardRef = `30301:${board.author || 'unknown'}:${board.id}`;

// In cardToNostrEvent()
tags: [..., ['a', boardRef], ...]
```
- **Nostr Tag:** `["a", "30301:pubkey:board-id"]`
- **Format:** "a"-Tag für Referenz zu replaceablem Board-Event (Kind 30301)
- **Grund:** Eindeutige Board-Zuordnung
- **Deserialisierung:** Via `nostrEventToCard()` → `cardProps.boardRef`

### 14. **createdAt + updatedAt** ✅ (Timestamps)
```typescript
// createdAt: Wird vom Nostr NDK automatisch gesetzt
// event.created_at = Math.floor(Date.now() / 1000)

// updatedAt: Wird für Last-Write-Wins verwendet
// nostrEventToBoard() extrahiert: 
//   const eventTimestamp = event.created_at || Math.floor(Date.now() / 1000);
//   const updatedAt = new Date(eventTimestamp * 1000).toISOString();
```
- **Nostr:** `event.created_at` (Unix timestamp in Sekunden)
- **Grund:** Last-Write-Wins Conflict Resolution
- **Format:** Unix timestamp → wird zu ISO string nach Load

---

## ❌ NICHT GEPUSHTE PROPERTIES (4/18)

### 1. **image** ❌ FEHLT
```typescript
// card.image = "https://example.com/image.jpg"
// 
// ❌ Wird NICHT zu Nostr gepushed!
// 
// cardToNostrEvent() hat KEIN image-Tag:
if (card.image) {  // ← NICHT IMPLEMENTIERT!
    tags.push(['image', card.image]);
}
```

**Status:** ⚠️ NICHT IMPLEMENTIERT  
**Problem:** 
- Card-Bilder gehen verloren bei Nostr-Sync
- Nach Reload von Relay werden Bilder nicht wiederhergestellt
- Nur localStorage-Daten behalten Bilder

**Lösung:** Tags in `cardToNostrEvent()` hinzufügen:
```typescript
if (card.image) {
    tags.push(['image', card.image]); // ← Neuer Tag
}
```

**Deserialisierung:** In `nostrEventToCard()` hinzufügen:
```typescript
const imageTag = tags.find(t => t[0] === 'image');
const image = imageTag ? imageTag[1] : undefined;

return { ..., image, ... };
```

---

### 2. **authorName** ❌ FEHLT
```typescript
// card.authorName = "Johan Amos Comenius"
// 
// ❌ Wird NICHT zu Nostr gepushed!
// 
// Nur card.author (pubkey hex) wird gepushed:
if (card.author) {
    tags.push(['p', card.author]);  // ← Nur pubkey!
}
```

**Status:** ⚠️ NICHT IMPLEMENTIERT  
**Problem:**
- Display Name geht verloren bei Nostr-Sync
- Nach Reload sieht man nur `0x000...` statt "Johan Amos Comenius"
- User-freundlichkeit sinkt

**Lösung:** NIP-39 oder Custom Tag nutzen:
```typescript
// Option 1: NIP-39 (Standard für Usernames)
if (card.authorName) {
    tags.push(['name', card.authorName]);  // ← Neuer Tag
}

// Option 2: Custom Tag (edufeed-spezifisch)
if (card.authorName) {
    tags.push(['author_name', card.authorName]);
}
```

**Deserialisierung:** In `nostrEventToCard()`:
```typescript
const nameTag = tags.find(t => t[0] === 'name' || t[0] === 'author_name');
const authorName = nameTag ? nameTag[1] : undefined;

return { ..., authorName, ... };
```

---

### 3. **attendees** ❌ FEHLT
```typescript
// card.attendees = ["pubkey1", "pubkey2", "pubkey3"]
// 
// ❌ Wird NICHT zu Nostr gepushed!
```

**Status:** ⚠️ NICHT IMPLEMENTIERT  
**Problem:**
- Attendee-Liste geht verloren bei Nostr-Sync
- Kollaborations-Tracking unmöglich
- User-Zuordnung zu Tasks nicht persistent

**Lösung:** NIP-51 Pattern nutzen (mehrere p-tags):
```typescript
// In cardToNostrEvent()
if (card.author) {
    tags.push(['p', card.author, '', 'author']);  // Autor mit Role
}

if (card.attendees && card.attendees.length > 0) {
    card.attendees.forEach(attendee => {
        if (attendee !== card.author) {  // Nicht doppeln
            tags.push(['p', attendee, '', 'attendee']);  // Role: attendee
        }
    });
}
```

**Deserialisierung:** In `nostrEventToCard()`:
```typescript
const pTags = tags.filter(t => t[0] === 'p');
const author = event.pubkey; // Card creator

const attendees = pTags
    .filter(t => t[1] !== author)  // Exclude author
    .map(t => t[1]);

return { ..., author, attendees, ... };
```

---

### 4. **comments (Inhalte)** ❌ NICHT INLINE
```typescript
// card.comments = [
//     { id: '1', text: 'Toller Beitrag!', author: 'pubkey1', createdAt: '...' },
//     { id: '2', text: 'Stimme zu', author: 'pubkey2', createdAt: '...' }
// ]
//
// ❌ Kommentar-INHALTE werden NICHT inline gepushed!
// 
// Stattdessen: Nur comment-count als Tag
tags.push(['comment-count', String(card.comments.length)]);
```

**Status:** ⚠️ ABSICHTLICH (by design)  
**Grund:** Kommentare sind **separate Kind 1 Events**

**Warum separat?**
- ✅ NIP-01 Standard (Kind 1 = Text Notes)
- ✅ Kommentare können separat gelöscht werden (NIP-09)
- ✅ Kommentare haben eigene Zaps/Reactions
- ✅ Vermeidet Event-Size Explosion
- ✅ Bessere Performance

**Wie werden Kommentare synchronisiert?**
1. publishCard() publiziert die Card (mit comment-count)
2. publishComment() publiziert jeden Kommentar separat (Kind 1)
3. Bei Reload: Kommentare werden via Subscription geladen
4. Subscription sucht nach: `kind: 1` + `#a: "30302:pubkey:card-id"`

---

## 📊 Detaillierte Tag-Zuordnung

### Alle Nostr Tags in einem Card-Event (Kind 30302):

```
{
  kind: 30302,
  tags: [
    ["d", "card-id"],                           ← ID
    ["a", "30301:board-author:board-id"],       ← Board-Ref
    ["s", "column-id"],                         ← Column-ID (PRIMARY!)
    ["col_label", "Column Name"],               ← Column-Name (SECONDARY)
    ["title", "Card Heading"],                  ← Kartentitel
    ["description", "..."],                     ← Beschreibung (Tag)
    ["state", "draft|published|archived"],      ← Publish-State
    ["rank", "0"],                              ← Position in Spalte
    ["color", "color-gradient-1"],              ← Farbe
    // ❌ FEHLT: ["image", "https://..."],      ← IMAGE - NOCH NICHT IMPLEMENTIERT!
    ["p", "author-pubkey"],                     ← Author
    // ❌ FEHLT: ["name", "Johan Amos"],         ← AUTHOR NAME - NOCH NICHT IMPLEMENTIERT!
    // ❌ FEHLT: ["p", "attendee1", "", ...],   ← ATTENDEES - NOCH NICHT IMPLEMENTIERT!
    ["label", "tag1"],                          ← Labels (mehrfach)
    ["label", "tag2"],
    ["r", "https://...", "Link-Title"],         ← Links (mehrfach)
    ["comment-count", "2"],                     ← Kommentar-Count (NUR Count!)
  ],
  content: "Card Beschreibung als Markdown",    ← Content (auch in description-tag)
  created_at: 1736589600,                       ← Timestamp (von NDK gesetzt)
  pubkey: "event-publisher-pubkey",
  id: "<event-id>",
  sig: "<signature>"
}
```

---

## 🔧 Implementierungs-Lücken

### Zusammenfassung:

| Lücke | Property | Zeile in cardToNostrEvent() | Behebung |
|-------|----------|-----|----------|
| 1 | image | ~315-318 | Tag hinzufügen: `['image', card.image]` |
| 2 | authorName | ~320-323 | Tag hinzufügen: `['name', card.authorName]` |
| 3 | attendees | ~320-323 | Mehrere p-tags mit 'attendee' Role |
| - | comments | By Design | Separat via Kind 1 Events (korrekt!) |

---

## ✅ Action Items

### Priority 1: image Property FIX
- [ ] `cardToNostrEvent()`: Add image tag (Line ~315)
- [ ] `nostrEventToCard()`: Extract image tag
- [ ] Test: Bild publiziert → Relay → Reload → Bild da

### Priority 2: authorName Property
- [ ] `cardToNostrEvent()`: Add name tag (Line ~320)
- [ ] `nostrEventToCard()`: Extract name tag
- [ ] Test: Name publiziert → Relay → Reload → Name sichtbar

### Priority 3: attendees Property
- [ ] `cardToNostrEvent()`: Add attendee p-tags (Line ~320)
- [ ] `nostrEventToCard()`: Extract attendee p-tags
- [ ] Test: Attendees publiziert → Sync → Attendees sichtbar

---

## 📝 Zusammenfassung

**Korrekt gepushed:** 14/18 Properties ✅
- Alle kritischen Daten (heading, content, color, labels, links)
- Alle Referenzen (columnId, boardRef, author)
- Alle Metadaten (rank, publishState, timestamps)

**Nicht gepushed:** 4/18 Properties ❌
- `image` - Kartenbild-URL
- `authorName` - Lesbar Display Name
- `attendees` - Zugeordnete User
- `comments` (inhalte) - By Design (separate Kind 1 Events)

**Status:** ~78% Coverage - Ready für Production, aber mit Verbesserungspotenzial!

---

**Dokument-Version:** 1.0  
**Erstellt:** 11. November 2025  
**Basis:** nostr.ts publishCard() + nostrEvents.ts cardToNostrEvent()  
**Nächste Review:** Nach Implementation der Lücken
