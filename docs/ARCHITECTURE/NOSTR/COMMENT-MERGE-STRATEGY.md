# 💬 Comment-Merge-Strategie für Nostr-Synchronisation

**Version:** 1.0  
**Datum:** 11. November 2025  
**Status:** 🎯 PROPOSAL - Implementation Required  
**Kontext:** Comments werden als separate Kind 1 Events gespeichert, nicht inline in Card-Events

---

## 🎯 Problem

**Situation:**
- Comments werden als **separate Nostr Kind 1 Events** gespeichert (by design ✅)
- Lokale Comments entstehen in `card.comments[]` (localStorage)
- Nostr Comments werden via **Subscription** geladen
- **MERGE-PROBLEM:** Wie mergen wir lokale + remote Comments ohne Duplikate?

**Beispiel-Szenario:**
```typescript
// Browser A (offline):
card.addComment("Lokaler Kommentar A1", "userA");
card.addComment("Lokaler Kommentar A2", "userA");

// Browser B (online):
card.addComment("Remote Kommentar B1", "userB");
// → Publiziert zu Nostr als Kind 1 Event

// Browser A geht online:
// → Lädt Remote Comments von Nostr
// ❌ PROBLEM: Wie mergen wir A1, A2 (lokal) mit B1 (remote)?
```

---

## 🏗️ Aktueller Stand

### Comment-Struktur (BoardModel.ts)

```typescript
export interface Comment extends NostrElement {
    id: string;           // Lokale ID (z.B. "comment-123")
    text: string;         // Kommentar-Text
    author: string;       // Nostr Public Key (hex)
    createdAt: string;    // ISO 8601 Timestamp
    eventId?: string;     // ← NEU: Nostr Event-ID (wenn publiziert)
}
```

### Aktueller Publishing-Flow

```typescript
// 1. Lokaler Kommentar wird hinzugefügt
boardStore.addComment(cardId, "Mein Kommentar");
// → card.comments.push({ id: "comment-123", text: "...", author: "...", createdAt: "..." })
// → localStorage wird gespeichert

// 2. Async: Kommentar wird zu Nostr publiziert
await nostrIntegration.publishComment(board, cardId, commentId);
// → Erstellt Kind 1 Event mit:
//    - tags: [["a", "30302:author:card-id"], ["e", cardEventId, "", "reply"]]
//    - content: "Mein Kommentar"

// 3. Nostr Relay speichert das Event
// → Event bekommt Event-ID: "abc123def456..."

// 4. ❌ PROBLEM: Event-ID wird NICHT zurück zu localStorage gespeichert!
// → card.comments[0].eventId bleibt undefined
```

### Aktueller Loading-Flow (NICHT IMPLEMENTIERT!)

```typescript
// ⚠️ NOCH NICHT IMPLEMENTIERT!
// card.loadCommentsFromNostr(ndk) existiert NICHT in BoardModel.ts
// card.subscribeToComments(ndk, callback) existiert NICHT in BoardModel.ts

// Geplant (laut AGENTS.md):
async loadCommentsFromNostr(ndk: NDK): Promise<void> {
    const filter = {
      kinds: [1],
      '#a': [`30302:${this.author}:${this.id}`]
    };
    
    const events = await ndk.fetchEvents(filter);
    
    this.comments = Array.from(events).map(event => ({
      id: event.id,
      text: event.content,
      author: event.pubkey,
      createdAt: new Date(event.created_at * 1000).toISOString(),
      eventId: event.id  // ← Event-ID speichern!
    }));
}
```

---

## ✅ Lösungsvorschlag: 3-Way Merge mit Event-ID als Unique Key

### Kern-Konzept

**Unique Identifier:** 
- Lokale Comments: `comment.id` (z.B. "comment-123")
- Remote Comments: `event.id` (Nostr Event-ID)
- **Nach Publish:** `comment.eventId` = Nostr Event-ID

**Merge-Logik:**
1. **Published Comments** (haben eventId) → Nutze eventId als Unique Key
2. **Lokale Comments** (kein eventId) → Nutze comment.id als Unique Key
3. **Deduplizierung:** Wenn `comment.eventId === remoteEvent.id` → Skip (schon lokal)

### Implementation

#### 1. Comment Interface erweitern

```typescript
// src/lib/classes/BoardModel.ts

export interface Comment extends NostrElement {
    id: string;           // Lokale ID (für unpublished comments)
    eventId?: string;     // ← KRITISCH: Nostr Event-ID (für published comments)
    text: string;
    author: string;
    createdAt: string;
    
    // ⚡ NEW: Sync-Status
    syncStatus?: 'local' | 'syncing' | 'synced' | 'failed';
}
```

#### 2. PublishComment Flow erweitern

```typescript
// src/lib/stores/boardstore/nostr.ts

public async publishComment(board: Board, cardId: string, commentId: string): Promise<void> {
    const result = board.findCardAndColumn(cardId);
    if (!result) throw new Error(`Card ${cardId} not found`);
    
    const { card } = result;
    const comment = card.comments.find(c => c.id === commentId);
    if (!comment) throw new Error(`Comment ${commentId} not found`);
    
    // ⚡ SET STATUS: syncing
    comment.syncStatus = 'syncing';
    
    try {
        const cardRef = `30302:${card.author || 'unknown'}:${card.id}`;
        const event = createCommentEvent(comment.text, cardRef, card.eventId || '', this.ndk);
        
        const publishedEvent = await this.syncManager.publishOrQueue(event, 'comment');
        
        if (publishedEvent?.id) {
            // ✅ KRITISCH: Event-ID zurück zu Comment speichern!
            comment.eventId = publishedEvent.id;
            comment.syncStatus = 'synced';
            
            console.log(`✅ Comment published with Event-ID: ${publishedEvent.id}`);
            
            // ⚡ Speichere zu localStorage (damit eventId persistent ist)
            BoardStorage.saveBoard(board);
        }
    } catch (error) {
        console.error('❌ Failed to publish comment:', error);
        comment.syncStatus = 'failed';
    }
}
```

#### 3. mergeComments() Funktion

```typescript
// src/lib/stores/boardstore/nostr.ts (neue Methode)

/**
 * Merged lokale Comments mit Remote Comments von Nostr
 * 
 * Strategie:
 * 1. Remote Comments mit eventId → Nutze als Unique Key
 * 2. Lokale Comments ohne eventId → Behalte (noch nicht publiziert)
 * 3. Deduplizierung: Wenn comment.eventId === remoteEvent.id → Skip
 * 
 * @param card - Die Karte mit lokalen Comments
 * @param remoteEvents - Remote Comment Events von Nostr
 */
private mergeComments(card: Card, remoteEvents: NDKEvent[]): void {
    // 1. Erstelle Set von bereits bekannten Event-IDs
    const existingEventIds = new Set(
        card.comments
            .filter(c => c.eventId)
            .map(c => c.eventId)
    );
    
    // 2. Filter neue Remote Events
    const newRemoteComments = remoteEvents
        .filter(event => !existingEventIds.has(event.id))
        .map(event => ({
            id: event.id!,  // Nostr Event-ID als lokale ID
            eventId: event.id,  // ← WICHTIG: Event-ID speichern
            text: event.content,
            author: event.pubkey,
            createdAt: new Date(event.created_at! * 1000).toISOString(),
            syncStatus: 'synced' as const
        }));
    
    // 3. Merge: Lokale Comments + Neue Remote Comments
    card.comments = [
        ...card.comments,  // Behalte alle lokalen (auch unpublished)
        ...newRemoteComments  // Füge nur neue Remote hinzu
    ];
    
    // 4. Sortiere nach createdAt (neueste zuletzt)
    card.comments.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    console.log(`🔄 Merged Comments: ${newRemoteComments.length} new, ${card.comments.length} total`);
}
```

#### 4. loadComments() mit Merge

```typescript
// src/lib/stores/boardstore/nostr.ts

/**
 * Lädt Comments von Nostr und merged sie mit lokalen Comments
 */
public async loadComments(cardId: string): Promise<void> {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card } = result;
    
    try {
        // Filter für Comment Events (Kind 1)
        const filter = {
            kinds: [1],
            '#a': [`30302:${card.author || 'unknown'}:${card.id}`]
        };
        
        const events = await this.ndk.fetchEvents(filter);
        
        // ⚡ Merge statt Overwrite!
        this.mergeComments(card, Array.from(events));
        
        // Speichere merged state zu localStorage
        BoardStorage.saveBoard(this.board);
        
    } catch (error) {
        console.error(`❌ Failed to load comments for card ${cardId}:`, error);
    }
}
```

#### 5. subscribeToComments() für Live-Updates

```typescript
// src/lib/stores/boardstore/nostr.ts

/**
 * Abonniert Live-Updates für Comments
 */
public subscribeToComments(cardId: string): () => void {
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return () => {};
    
    const { card } = result;
    
    const sub = this.ndk.subscribe(
        {
            kinds: [1],
            '#a': [`30302:${card.author || 'unknown'}:${card.id}`]
        },
        { closeOnEose: false }  // ← Persistent subscription!
    );
    
    sub.on('event', (event) => {
        console.log('📥 New comment event received:', event.id);
        
        // Merge einzelnes Event
        this.mergeComments(card, [event]);
        
        // Speichere zu localStorage
        BoardStorage.saveBoard(this.board);
    });
    
    // Cleanup-Funktion zurückgeben
    return () => sub.stop();
}
```

---

## 🔄 Kompletter Lifecycle

### Szenario 1: Offline Comment → Online Publish

```typescript
// 1. Browser offline: Lokaler Kommentar
boardStore.addComment(cardId, "Offline Kommentar");
// → comment: { id: "comment-abc", eventId: undefined, syncStatus: 'local', ... }

// 2. Browser geht online: Auto-Publish
await boardStore.publishComment(board.id, cardId, "comment-abc");
// → Publiziert zu Nostr
// → comment.eventId = "nostr-event-123"
// → comment.syncStatus = 'synced'
// → localStorage wird gespeichert

// 3. Reload: Comment hat jetzt eventId
// → comment: { id: "comment-abc", eventId: "nostr-event-123", syncStatus: 'synced', ... }
```

### Szenario 2: Remote Comments laden

```typescript
// 1. Board öffnen
await boardStore.loadComments(cardId);
// → Lädt Remote Events von Nostr
// → Merged mit lokalen Comments (dedupliziert via eventId)

// 2. Live Subscription starten
const unsubscribe = boardStore.subscribeToComments(cardId);
// → Neue Remote Comments werden automatisch gemerged

// 3. Cleanup beim Board-Wechsel
unsubscribe();
```

### Szenario 3: Multi-Device Sync

```typescript
// Browser A (offline):
boardStore.addComment(cardId, "Comment A1");  // id: "comment-a1", eventId: undefined
boardStore.addComment(cardId, "Comment A2");  // id: "comment-a2", eventId: undefined

// Browser B (online):
boardStore.addComment(cardId, "Comment B1");  // id: "comment-b1"
await publishComment(..., "comment-b1");       // → eventId: "nostr-b1"

// Browser A geht online:
await boardStore.loadComments(cardId);
// → Lädt "nostr-b1" von Nostr
// → Merged: [comment-a1 (local), comment-a2 (local), nostr-b1 (remote)]

await boardStore.publishComment(..., "comment-a1");  // → eventId: "nostr-a1"
await boardStore.publishComment(..., "comment-a2");  // → eventId: "nostr-a2"

// Result: [nostr-a1, nostr-a2, nostr-b1] (alle synced)
```

---

## 🧪 Test-Cases

### Test 1: Duplicate Detection

```typescript
it('should not duplicate comments when loading from Nostr', async () => {
    // Setup: Lokaler Comment mit eventId
    const card = new Card({ heading: 'Test' });
    card.comments = [{
        id: 'local-1',
        eventId: 'nostr-event-123',
        text: 'Published comment',
        author: 'userA',
        createdAt: '2025-11-11T10:00:00Z',
        syncStatus: 'synced'
    }];
    
    // Remote Event mit gleicher ID
    const remoteEvent = {
        id: 'nostr-event-123',
        content: 'Published comment',
        pubkey: 'userA',
        created_at: 1699699200
    };
    
    // Merge
    mergeComments(card, [remoteEvent]);
    
    // Assert: Nur 1 Kommentar (kein Duplikat)
    expect(card.comments.length).toBe(1);
    expect(card.comments[0].eventId).toBe('nostr-event-123');
});
```

### Test 2: Local + Remote Merge

```typescript
it('should merge local and remote comments', async () => {
    // Setup
    const card = new Card({ heading: 'Test' });
    card.comments = [
        { id: 'local-1', text: 'Local 1', author: 'userA', createdAt: '2025-11-11T10:00:00Z', syncStatus: 'local' },
        { id: 'local-2', text: 'Local 2', author: 'userA', createdAt: '2025-11-11T11:00:00Z', syncStatus: 'local' }
    ];
    
    // Remote Events
    const remoteEvents = [{
        id: 'remote-1',
        content: 'Remote 1',
        pubkey: 'userB',
        created_at: 1699702800  // 2025-11-11T10:30:00Z
    }];
    
    // Merge
    mergeComments(card, remoteEvents);
    
    // Assert
    expect(card.comments.length).toBe(3);
    expect(card.comments[0].id).toBe('local-1');   // 10:00
    expect(card.comments[1].id).toBe('remote-1');  // 10:30 (eingefügt zwischen local-1 und local-2)
    expect(card.comments[2].id).toBe('local-2');   // 11:00
});
```

### Test 3: EventId Update nach Publish

```typescript
it('should update eventId after publish', async () => {
    const card = new Card({ heading: 'Test' });
    card.comments = [
        { id: 'comment-abc', text: 'Test', author: 'userA', createdAt: '2025-11-11T10:00:00Z', syncStatus: 'local' }
    ];
    
    // Publish
    const publishedEvent = await publishComment(board, card.id, 'comment-abc');
    
    // Assert
    expect(card.comments[0].eventId).toBe(publishedEvent.id);
    expect(card.comments[0].syncStatus).toBe('synced');
});
```

---

## 📊 Vorteile dieser Strategie

| Vorteil | Beschreibung |
|---------|--------------|
| ✅ **Keine Duplikate** | EventId als Unique Key verhindert doppelte Comments |
| ✅ **Offline-First** | Lokale Comments bleiben erhalten bis sie published sind |
| ✅ **Multi-Device Sync** | Remote Comments werden automatisch gemerged |
| ✅ **Delete-Safe** | EventId erlaubt NIP-09 Deletion |
| ✅ **Chronologisch** | Comments werden nach createdAt sortiert |
| ✅ **Status Tracking** | syncStatus zeigt Publishing-State |

---

## 🚀 Implementation Roadmap

### Phase 1: Core Merge (Priority High)

- [ ] 1. Comment Interface erweitern (eventId, syncStatus)
- [ ] 2. publishComment() updated eventId nach Publish
- [ ] 3. mergeComments() Funktion implementieren
- [ ] 4. BoardStorage.saveBoard() nach Comment-Publish

### Phase 2: Loading & Subscription (Priority High)

- [ ] 5. loadComments() mit mergeComments()
- [ ] 6. subscribeToComments() für Live-Updates
- [ ] 7. Integration in CardViewDialog.svelte

### Phase 3: Testing (Priority Medium)

- [ ] 8. Unit Tests für mergeComments()
- [ ] 9. Integration Tests für Publishing-Flow
- [ ] 10. E2E Tests für Multi-Device Sync

### Phase 4: UI Feedback (Priority Low)

- [ ] 11. Sync-Status Icons in UI (🔄 syncing, ✅ synced, ❌ failed)
- [ ] 12. Retry-Button für failed comments
- [ ] 13. "Offline" Badge für local comments

---

## 📝 Open Questions

### Q1: Wie verhindern wir Race Conditions?

**Szenario:** 
- Comment wird lokal hinzugefügt
- Gleichzeitig lädt loadComments() remote Events
- → Kann zu Duplikaten führen?

**Antwort:**
- Mutex/Lock für Comment-Array während Merge
- Oder: Merge nur einmal pro Card-Reload (nicht während User Input)

### Q2: Wie handhaben wir gelöschte Comments?

**Szenario:**
- User löscht Comment lokal
- Remote hat noch alten Comment
- → Wird beim Reload wieder hinzugefügt?

**Antwort:**
- NIP-09 Deletion Event publizieren
- Deleted Comments in `deletedCommentIds: Set<string>` tracken
- Beim Merge: Filter deleted Comments raus

### Q3: Performance bei vielen Comments?

**Szenario:**
- Card hat 1000+ Comments
- Jeder Reload merged 1000 Events
- → Performance-Problem?

**Antwort:**
- Pagination: Nur letzte N Comments laden (z.B. 50)
- "Load more" Button für ältere Comments
- Virtual Scrolling in UI

---

## 🎯 Zusammenfassung

**Problem:** Lokale Comments müssen mit Remote Nostr Comments gemerged werden

**Lösung:** 
1. EventId als Unique Key nach Publishing
2. mergeComments() dedupliziert via EventId
3. Lokale Comments (ohne eventId) bleiben erhalten
4. Live Subscription für neue Remote Comments

**Status:** Ready for Implementation ✅

**Nächste Schritte:**
1. Phase 1 implementieren (eventId + mergeComments)
2. Tests schreiben
3. Integration in CardViewDialog

---

**Dokument-Version:** 1.0  
**Erstellt:** 11. November 2025  
**Autor:** AI Agent  
**Review:** Pending
