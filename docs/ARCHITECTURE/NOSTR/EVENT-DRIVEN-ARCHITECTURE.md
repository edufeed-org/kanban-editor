# Event-Driven Architecture: Nostr Events → Store Actions

**Status:** 🔴 PLANNED - Neue Architektur für v2.0  
**Datum:** 9. November 2025  
**Priorität:** HIGH - Löst Race Condition Problem fundamental  
**Voraussetzung:** Ersetzt bisherige Validation/Filtering-Ansätze (v1.11-v1.12)

---

## 📋 Übersicht

### Problem mit bisherigem Ansatz (v1.0 - v1.12)

**Gescheiterte Strategien:**

```
❌ v1.11.5-v1.11.6: In-Memory Tracking + Filtering
   → Board-Event kommt VOR Deletion-Event
   → Filtering kann nicht greifen

❌ v1.12: Relay Validation
   → Fetch Cards vom Relay für Validierung
   → Funktioniert nicht (Relay-Cache-Lag oder Timing)
```

**Root Cause:**
- Wir versuchen, Events zu **filtern/validieren**
- Aber Events kommen in **unvorhersehbarer Reihenfolge**
- Relay-State ist nicht instant synchron

### Neue Strategie: Event = Command

**Kernidee:**

```typescript
// NICHT: Event → Parse → Validate → Merge → Hope
// SONDERN: Event → Direct Store Action

Board-Event (30301) → boardStore.updateBoardFromNostr(props)
Card-Event (30302)  → boardStore.upsertCardFromNostr(cardProps)
Delete-Event (5)    → boardStore.deleteCardFromNostr(cardId)
```

**Warum besser?**
- ✅ Events sind **Commands** (Anweisungen), nicht State-Snapshots
- ✅ Jeder Event-Type = Eine Store-Methode
- ✅ Keine komplexe Merge/Validation-Logik
- ✅ Store hat gleiche API für UI-Actions und Nostr-Events

---

## 🎯 Architektur-Prinzipien

### 1. Primary vs Secondary Actions

**Das Endlosschleifen-Problem:**

```
Browser A: User löscht Card
  → deleteCard() [PRIMARY]
  → publishToNostr() ✅
  
Browser B: Deletion-Event empfangen
  → deleteCardFromNostr() [SECONDARY]
  → publishToNostr() ❌ NICHT!
  
→ KEINE Endlosschleife!
```

**Lösung:**

```typescript
// PRIMARY: User-initiated → Publish zu Nostr
boardStore.deleteCard(cardId)
  → board.deleteCard()
  → triggerUpdate({ publish: true })  ← Sendet zu Nostr

// SECONDARY: Nostr-Event empfangen → NUR lokaler Update
boardStore.deleteCardFromNostr(cardId)
  → board.deleteCard()
  → triggerUpdate({ publish: false })  ← Kein Publish!
```

### 2. Event-ID Deduplication

**Problem:** Gleicher Event kommt mehrfach vom Relay

```typescript
// Lösung: Track processed Event-IDs
private processedEvents = new Set<string>();

handleCardEvent(event) {
    if (this.processedEvents.has(event.id)) {
        console.log('Event already processed, skip');
        return;
    }
    
    this.processedEvents.add(event.id);
    // ... apply action
}
```

### 3. Timestamp-Based Conflict Resolution

**Problem:** Events kommen in falscher Reihenfolge

```typescript
// Scenario: Delete (T2) kommt VOR Update (T1)
T1: Update-Event (created_at: 100)
T2: Delete-Event (created_at: 200)

// Lösung: Track Deletion-Timestamps
private cardDeletionTimestamps = new Map<string, number>();

handleDeletionEvent(event) {
    const cardId = extractCardId(event);
    const deleteTime = event.created_at * 1000;
    
    this.cardDeletionTimestamps.set(cardId, deleteTime);
    boardStore.deleteCardFromNostr(cardId);
}

upsertCardFromNostr(cardProps) {
    const deleteTime = this.cardDeletionTimestamps.get(cardProps.id);
    
    // Card wurde NACH diesem Update gelöscht → skip
    if (deleteTime && cardProps.updatedAt < deleteTime) {
        console.log('Card was deleted after this update, skip');
        return;
    }
    
    // ... apply update
}
```

---

## 🏗️ Implementierung

### Phase 1: Basis-Infrastruktur

**Datei:** `src/lib/stores/boardstore/storage.ts` oder `operations.ts`

```typescript
/**
 * Erweitere triggerUpdate() mit publish-Flag
 */
private triggerUpdate(options?: { publish?: boolean }): void {
    this.updateTrigger++;
    this.saveToStorage();
    
    // NUR bei Primary Actions zu Nostr publishen
    if (options?.publish !== false) {
        this.publishToNostr();
    }
}
```

### Phase 2: Neue Store-APIs (Secondary Actions)

**Datei:** `src/lib/stores/boardstore/operations.ts`

```typescript
/**
 * ⚡ SEKUNDÄR: Card von Nostr-Event erstellen/updaten
 * KEIN Publish zu Nostr (publish: false)
 * 
 * @param cardProps - Card-Daten aus nostrEventToCard()
 */
public upsertCardFromNostr(cardProps: CardProps): void {
    // 1. Find target column
    const column = this.board.columns.find(c => c.id === cardProps.columnId);
    
    if (!column) {
        console.warn(`Column ${cardProps.columnId} not found for card ${cardProps.id}`);
        return;
    }
    
    // 2. Check if card exists
    const existingCard = column.findCard(cardProps.id);
    
    if (existingCard) {
        // Update existing card
        existingCard.update(cardProps);
        console.log(`🔄 Updated card ${cardProps.id} from Nostr`);
    } else {
        // Create new card
        column.addCard(cardProps);
        console.log(`✨ Created new card ${cardProps.id} from Nostr`);
    }
    
    // ⚠️ CRITICAL: publish: false (kein Nostr-Publish!)
    this.triggerUpdate({ publish: false });
}

/**
 * ⚡ SEKUNDÄR: Card von Nostr-Event löschen
 * KEIN Publish zu Nostr (publish: false)
 * 
 * @param cardId - ID der zu löschenden Card
 */
public deleteCardFromNostr(cardId: string): void {
    for (const column of this.board.columns) {
        const card = column.findCard(cardId);
        
        if (card) {
            column.deleteCard(cardId);
            console.log(`🗑️ Deleted card ${cardId} from Nostr event`);
            
            // ⚠️ CRITICAL: publish: false
            this.triggerUpdate({ publish: false });
            break;
        }
    }
}

/**
 * ⚡ SEKUNDÄR: Board-Metadaten von Nostr-Event updaten
 * Nur Name, Description, Tags - KEINE Spalten/Karten!
 * KEIN Publish zu Nostr (publish: false)
 * 
 * @param boardProps - Board-Daten aus nostrEventToBoard()
 */
public updateBoardMetadataFromNostr(boardProps: Partial<BoardProps>): void {
    // Nur Metadaten updaten (nicht Struktur!)
    if (boardProps.name !== undefined) {
        this.board.name = boardProps.name;
    }
    
    if (boardProps.description !== undefined) {
        this.board.description = boardProps.description;
    }
    
    if (boardProps.tags !== undefined) {
        this.board.tags = boardProps.tags;
    }
    
    console.log(`📝 Updated board metadata from Nostr: ${this.board.name}`);
    
    // ⚠️ CRITICAL: publish: false
    this.triggerUpdate({ publish: false });
}
```

### Phase 3: Event-Handler Refactoring

**Datei:** `src/lib/stores/boardstore/nostr.ts`

#### 3.1 Event-ID Tracking

```typescript
export class NostrIntegration {
    private ndk?: NDK;
    private boardSubscription: any | null = null;
    
    // ⚡ NEU: Event-Deduplication
    private processedEvents = new Set<string>();
    
    // ⚡ NEU: Deletion-Timestamp-Tracking
    private cardDeletionTimestamps = new Map<string, number>();
    private boardDeletionTimestamps = new Map<string, number>();
```

#### 3.2 Card-Event Handler (VEREINFACHT!)

```typescript
/**
 * Handler für Card-Events (Kind 30302)
 * 
 * ⚡ NEUE STRATEGIE: Direct Store Action (kein komplexes Merging!)
 */
private async handleCardEvent(
    cardEvent: any,
    currentBoard: Board,
    boardStore: any // ← NEU: Brauchen Store-Referenz!
): Promise<void> {
    console.log('📥 Card-Event erhalten:', cardEvent.id);
    
    // 1. Deduplication: Event schon verarbeitet?
    if (this.processedEvents.has(cardEvent.id)) {
        console.log('⏩ Card-Event already processed, skip');
        return;
    }
    
    this.processedEvents.add(cardEvent.id);
    
    try {
        // 2. Deserialisiere Card-Event
        const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
        const cardProps = nostrEventToCard(cardEvent);
        
        // 3. Validierung: Gehört die Karte zu diesem Board?
        const expectedBoardRef = `30301:${currentBoard.author}:${currentBoard.id}`;
        if (cardProps.boardRef !== expectedBoardRef) {
            console.warn(`⚠️ Card ${cardProps.id} gehört zu anderem Board: ${cardProps.boardRef}`);
            return;
        }
        
        // 4. Prüfe: Wurde Card später gelöscht?
        const deleteTime = this.cardDeletionTimestamps.get(cardProps.id);
        if (deleteTime) {
            const cardTime = cardProps.updatedAt 
                ? new Date(cardProps.updatedAt).getTime()
                : cardEvent.created_at * 1000;
            
            if (cardTime < deleteTime) {
                console.log(`🗑️ Card ${cardProps.id} was deleted after this update (${new Date(deleteTime).toISOString()}), skip`);
                return;
            }
        }
        
        // 5. ⚡ DIREKT: Store-API aufrufen (kein Callback!)
        boardStore.upsertCardFromNostr(cardProps);
        
    } catch (error) {
        console.error(`❌ Error processing card event:`, error);
    }
}
```

#### 3.3 Deletion-Event Handler (VEREINFACHT!)

```typescript
/**
 * Handler für Deletion-Events (Kind 5)
 * 
 * ⚡ NEUE STRATEGIE: Direct Store Action + Timestamp-Tracking
 */
private async handleDeletionEvent(
    deletionEvent: any,
    boardStore: any // ← NEU: Store-Referenz
): Promise<void> {
    console.log('🗑️ Deletion-Event erhalten:', deletionEvent.id);
    
    // Deduplication
    if (this.processedEvents.has(deletionEvent.id)) {
        console.log('⏩ Deletion-Event already processed, skip');
        return;
    }
    
    this.processedEvents.add(deletionEvent.id);
    
    try {
        // Parse 'a' tags für replaceable events
        const aTags = deletionEvent.tags.filter((t: any) => t[0] === 'a');
        const deleteTime = deletionEvent.created_at * 1000;
        
        for (const aTag of aTags) {
            const eventRef = aTag[1]; // z.B. "30302:pubkey:card-id"
            
            // ===== CARD DELETION =====
            if (eventRef && eventRef.startsWith('30302:')) {
                const parts = eventRef.split(':');
                if (parts.length >= 3) {
                    const cardId = parts.slice(2).join(':');
                    
                    // Track deletion timestamp (für Ordering)
                    this.cardDeletionTimestamps.set(cardId, deleteTime);
                    console.log(`🗑️ Tracked deletion timestamp for card ${cardId}: ${new Date(deleteTime).toISOString()}`);
                    
                    // ⚡ DIREKT: Store-API aufrufen
                    boardStore.deleteCardFromNostr(cardId);
                }
            }
            
            // ===== BOARD DELETION =====
            else if (eventRef && eventRef.startsWith('30301:')) {
                const parts = eventRef.split(':');
                if (parts.length >= 3) {
                    const boardId = parts.slice(2).join(':');
                    
                    // Track deletion timestamp
                    this.boardDeletionTimestamps.set(boardId, deleteTime);
                    console.log(`🗑️ Tracked deletion timestamp for board ${boardId}: ${new Date(deleteTime).toISOString()}`);
                    
                    // ⚡ DIREKT: Store-API aufrufen
                    // (boardStore.deleteBoardFromNostr() - zu implementieren)
                }
            }
        }
    } catch (error) {
        console.error(`❌ Error processing deletion event:`, error);
    }
}
```

#### 3.4 Board-Event Handler (VEREINFACHT!)

```typescript
/**
 * Handler für Board-Events (Kind 30301)
 * 
 * ⚡ NEUE STRATEGIE: Nur Metadaten updaten (keine Karten!)
 */
private async handleBoardEvent(
    boardEvent: any,
    currentBoard: Board,
    boardStore: any
): Promise<void> {
    console.log('📥 Board-Event erhalten:', boardEvent.id);
    
    // Deduplication
    if (this.processedEvents.has(boardEvent.id)) {
        console.log('⏩ Board-Event already processed, skip');
        return;
    }
    
    this.processedEvents.add(boardEvent.id);
    
    try {
        // Deserialisiere Board-Event
        const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
        const boardProps = nostrEventToBoard(boardEvent);
        
        if (!boardProps.id) {
            console.warn('⚠️ Board-Event hat keine ID - skip');
            return;
        }
        
        // Nur aktives Board updaten
        if (boardProps.id !== currentBoard.id) {
            console.log(`ℹ️ Board-Event für anderes Board (${boardProps.id}), skip`);
            return;
        }
        
        // Prüfe: Wurde Board später gelöscht?
        const deleteTime = this.boardDeletionTimestamps.get(boardProps.id);
        if (deleteTime) {
            const boardTime = boardEvent.created_at * 1000;
            if (boardTime < deleteTime) {
                console.log(`🗑️ Board ${boardProps.id} was deleted after this update, skip`);
                return;
            }
        }
        
        // ⚡ DIREKT: Nur Metadaten updaten (NICHT Spalten/Karten!)
        boardStore.updateBoardMetadataFromNostr({
            name: boardProps.name,
            description: boardProps.description,
            tags: boardProps.tags
        });
        
    } catch (error) {
        console.error(`❌ Error processing board event:`, error);
    }
}
```

#### 3.5 Subscription Update

```typescript
/**
 * Subscribed zu Board-, Card- und Deletion-Events
 */
public subscribeToUpdates(
    currentBoard: Board,
    boardStore: any // ← NEU: Store-Referenz statt Callbacks!
): void {
    if (!this.ndk) {
        console.log('[BoardStore] ℹ️ Nostr not initialized, skip subscribe');
        return;
    }

    const pubkey = authStore.getPubkeySafe?.() || authStore.getPubkey?.() || null;

    if (!pubkey) {
        console.log('[BoardStore] ℹ️ No pubkey available, skip subscription');
        return;
    }

    // Stop existing subscription
    if (this.boardSubscription) {
        this.boardSubscription.stop();
    }

    console.log('[BoardStore] 🛰️ Subscribing to board, card AND deletion events');

    const sub = this.ndk.subscribe(
        {
            kinds: [30301, 30302, 5] as number[],
            authors: [pubkey]
        } as any,
        { closeOnEose: false }
    );

    sub.on('event', async (event: any) => {
        if (event.kind === 30301) {
            await this.handleBoardEvent(event, currentBoard, boardStore);
        } else if (event.kind === 30302) {
            await this.handleCardEvent(event, currentBoard, boardStore);
        } else if (event.kind === 5) {
            await this.handleDeletionEvent(event, boardStore);
        }
    });

    this.boardSubscription = sub;
}
```

---

## 🧹 Cleanup: Alte Implementierungen entfernen

### Zu entfernen aus `nostr.ts`:

**1. Relay Validation Code (Lines ~428-490)**

```typescript
// ❌ ENTFERNEN: Komplette Relay-Validation-Logik
// Von:
console.log(`🛡️ Validating cards with relay...`);

if (this.ndk && boardProps.columns && boardProps.author) {
    const boardRef = `30301:${boardProps.author}:${boardProps.id}`;
    
    try {
        // Fetch alle aktuell existierenden Card-Events...
        const cardFilter = {
            kinds: [30302],
            '#a': [boardRef]
        };
        
        const existingCardEvents = await this.ndk.fetchEvents(cardFilter as any);
        // ... Rest der Validation-Logik
    } catch (fetchError) {
        // ...
    }
}

// Bis:
// Continue with board processing...
```

**2. In-Memory Deletion Tracking (Lines ~562-565)**

```typescript
// ❌ ENTFERNEN: Altes In-Memory Tracking
// private recentlyDeletedCards = new Set<string>();

// ❌ ENTFERNEN: setTimeout Cleanup-Logik in handleDeletionEvent
setTimeout(() => {
    this.recentlyDeletedCards.delete(cardId);
    console.log(`⏱️ Cleared ${cardId} from recently deleted tracking (after 5s)`);
}, 5000);
```

**3. Cache Invalidation Code (Lines ~620-697)**

```typescript
// ❌ ENTFERNEN: Komplexe localStorage-Cache-Invalidation
// Von:
// ⚡ CACHE INVALIDATION: Clear card from ALL board caches
if (typeof window !== 'undefined') {
    const boardKeys = Object.keys(localStorage)
        .filter(k => k.startsWith('kanban-board-'));
    
    let clearedCount = 0;
    
    for (const key of boardKeys) {
        try {
            const rawData = localStorage.getItem(key);
            // ... komplexe Cache-Cleaning-Logik
        } catch (e) {
            // ...
        }
    }
}

// Bis Ende der handleDeletionEvent-Methode
```

**Was bleibt?**
- Nur Event-ID Deduplication (`processedEvents`)
- Nur Timestamp-Tracking (`cardDeletionTimestamps`, `boardDeletionTimestamps`)
- Direkte Store-API-Aufrufe

---

## 📋 Migration Checklist

### Phase 1: Preparation
- [x] Dokumentation erstellt (`EVENT-DRIVEN-ARCHITECTURE.md`)
- [x] Team-Review & Approval ✅ (Dokumentation ist klar verständlich)
- [ ] Tests für neue Store-APIs schreiben

### Phase 2: Implementation
- [x] **kanbanStore.svelte.ts**: `triggerUpdate({ publish })` erweitert ✅
- [x] **kanbanStore.svelte.ts**: Zentrale `publishToNostr()` Methode erstellt ✅
- [ ] **operations.ts**: Neue Secondary Actions implementieren:
  - [ ] `upsertCardFromNostr(cardProps)`
  - [ ] `deleteCardFromNostr(cardId)`
  - [ ] `updateBoardMetadataFromNostr(boardProps)`
- [ ] **nostr.ts**: Event-Handler refactoren:
  - [ ] Event-ID Deduplication hinzufügen
  - [ ] Deletion-Timestamp-Tracking hinzufügen
  - [ ] `handleCardEvent()` vereinfachen
  - [ ] `handleDeletionEvent()` vereinfachen
  - [ ] `handleBoardEvent()` vereinfachen
  - [ ] `subscribeToUpdates()` API ändern (Store-Referenz statt Callbacks)

### Phase 3: Cleanup
- [ ] **nostr.ts**: Alten Code entfernen:
  - [ ] Relay Validation (Lines ~428-490)
  - [ ] In-Memory Tracking (`recentlyDeletedCards`)
  - [ ] Cache Invalidation (Lines ~620-697)
  - [ ] setTimeout Cleanup-Logik

### Phase 4: Testing
- [ ] Unit-Tests für neue Store-APIs
- [ ] Integration-Tests für Event-Handling
- [ ] Multi-Browser-Test (Endlosschleifen-Check!)
- [ ] Event-Ordering-Tests (Deletion vor Update)

### Phase 5: Documentation
- [ ] `BOARDSTORE.md` aktualisieren
- [ ] `LOADING-SUBSCRIPTION.md` aktualisieren
- [ ] `ROADMAP.md` aktualisieren
- [ ] `CHANGELOG.md` Entry

---

## 🎯 Acceptance Criteria

Die neue Architektur gilt als erfolgreich implementiert, wenn:

**Funktional:**
- ✅ Card-Events → Card wird erstellt/geupdatet (KEIN Nostr-Publish)
- ✅ Deletion-Events → Card wird gelöscht (KEIN Nostr-Publish)
- ✅ Board-Events → Metadaten werden geupdatet (KEIN Nostr-Publish)
- ✅ User-Actions → Nostr-Publish erfolgt (PRIMARY)
- ✅ Keine Endlosschleifen zwischen Browsern
- ✅ Event-Ordering korrekt (Deletion nach Update = Card bleibt gelöscht)

**Technisch:**
- ✅ Event-Deduplication funktioniert (gleicher Event nicht 2x verarbeitet)
- ✅ Timestamp-Based Conflict Resolution funktioniert
- ✅ Keine Race Conditions mehr
- ✅ Code ist einfacher/wartbarer als v1.12

**Tests:**
- ✅ Unit-Tests: >90% Coverage für neue Store-APIs
- ✅ Integration-Tests: Multi-Browser-Szenarien
- ✅ Regression-Tests: Alte Funktionalität bleibt erhalten

---

## 📚 Referenzen

- **Problem-Analyse:** Siehe Conversation-Summary Messages 96-101
- **Bisherige Versuche:**
  - v1.11.5-v1.11.6: In-Memory Tracking (FAILED)
  - v1.12: Relay Validation (FAILED)
- **Related Docs:**
  - [`BOARDSTORE.md`](../STORES/BOARDSTORE.md)
  - [`LOADING-SUBSCRIPTION.md`](./LOADING-SUBSCRIPTION.md)
  - [`SYNCMANAGER.md`](../STORES/SYNCMANAGER.md)

---

## 🔮 Zukünftige Erweiterungen

**Optional (nicht in v2.0):**

1. **Optimistic Updates**
   - User-Action → Sofort UI-Update (temp ID)
   - Event kommt zurück → Ersetze temp mit real ID
   - Komplexer, aber beste UX

2. **Conflict Resolution UI**
   - Bei simultanen Edits: Dialog zeigen
   - User wählt Version (mine/theirs/merge)
   - Komplexere Merge-Strategie

3. **Event-Queue Priority**
   - Deletion-Events vor Update-Events verarbeiten
   - Sortierung nach Timestamp vor Apply

---

**Version:** 1.0  
**Autor:** AI Assistant  
**Datum:** 9. November 2025  
**Status:** 🔴 PLANNED - Ready for Implementation
