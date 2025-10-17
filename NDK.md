# NDK Integration für Kanban-Board

## Übersicht

Dieses Projekt nutzt **NDK (Nostr Development Kit)** und **@nostr-dev-kit/svelte** für die Nostr-Integration. NDK bietet eine umfassende API zum Erstellen, Lesen und Synchronisieren von Nostr-Events.

## Installierte Pakete

```json
{
  "@nostr-dev-kit/ndk": "2.14.2",
  "@nostr-dev-kit/svelte": "^2.0.8"
}
```

## Grundlegende Konzepte

### 1. NDK Initialisierung (Svelte 5)

NDK wird in `src/routes/+layout.svelte` initialisiert:

```svelte
<script lang="ts">
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";

  const ndk = new NDKSvelte({
    explicitRelayUrls: [
      "wss://relay.damus.io",
      "wss://relay.primal.net", 
      "wss://nos.lol",
    ],
  });

  // Reaktiver Pool für Svelte 5 Runes
  const pool = createReactivePool(ndk);

  ndk.connect();
</script>
```

### 2. NDK Context für Komponenten

Um NDK in Child-Komponenten verfügbar zu machen, sollte es über den Svelte Context weitergegeben werden:

```svelte
<script lang="ts">
  import { setContext } from 'svelte';
  
  setContext('ndk', ndk);
</script>
```

In Child-Komponenten:

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import type NDK from '@nostr-dev-kit/ndk';
  
  const ndk = getContext<NDK>('ndk');
</script>
```

## Nostr Events für Kanban-Boards

Gemäß **Kanban-NIP.md** (NIP-30301/30302) sind folgende Event-Typen definiert:

### Board Event (Kind 30301)

```typescript
{
  kind: 30301,
  created_at: <timestamp>,
  tags: [
    ["d", "<board-d-identifier>"],
    ["title", "Board Name"],
    ["description", "Board Description"],
    ["col", "col1-id", "To Do", "0"],
    ["col", "col2-id", "In Progress", "1"],
    ["col", "col3-id", "Done", "2"],
    ["p", "<maintainer-npub>"], // Maintainers
  ],
  content: ""
}
```

### Card Event (Kind 30302)

```typescript
{
  kind: 30302,
  created_at: <timestamp>,
  tags: [
    ["d", "<card-d-identifier>"],
    ["title", "Card Title"],
    ["description", "Card Description"],
    ["s", "To do"], // Status (column name)
    ["rank", "10"], // Order in column
    ["u", "https://attachment-url"], // Attachments
    ["p", "<assignee-npub>"], // Assignees
    ["a", "30301:<board-creator-pubkey>:<board-d-identifier>"], // Board reference
  ],
  content: ""
}
```

### Kommentare auf Cards

**Wichtig:** Kommentare werden als **separate Nostr Events** (Kind 1) behandelt, die auf die Card verweisen:

```typescript
{
  kind: 1, // Text note
  created_at: <timestamp>,
  tags: [
    ["e", "<card-event-id>", "", "reply"], // Reply to card
    ["p", "<card-author-pubkey>"], // Mention card author
    ["a", "30302:<card-author-pubkey>:<card-d-tag>"], // Reference to replaceable event
  ],
  content: "Das ist mein Kommentar zur Karte."
}
```

**Alternative:** NIP-22 (Comment Events - Kind 42):
```typescript
{
  kind: 42,
  tags: [
    ["e", "<card-event-id>", "", "root"],
    ["p", "<card-author-pubkey>"],
  ],
  content: "Kommentar-Text"
}
```

## NDK API für Kanban-Board

### Events Erstellen

```typescript
import { NDKEvent } from '@nostr-dev-kit/ndk';

// Board erstellen
const boardEvent = new NDKEvent(ndk);
boardEvent.kind = 30301;
boardEvent.tags = [
  ["d", board.id],
  ["title", board.name],
  ["description", board.description || ""],
  ...board.columns.map((col, index) => ["col", col.id, col.name, String(index)]),
];
await boardEvent.publish();

// Card erstellen
const cardEvent = new NDKEvent(ndk);
cardEvent.kind = 30302;
cardEvent.tags = [
  ["d", card.id],
  ["title", card.heading],
  ["description", card.content || ""],
  ["s", columnName],
  ["rank", String(cardIndex)],
  ["a", `30301:${board.author}:${board.id}`],
  ...card.attendees.map(npub => ["p", npub]),
];
await cardEvent.publish();
```

### Events Abrufen (Subscriptions)

```typescript
// Board abrufen
const boardFilter = {
  kinds: [30301],
  authors: [authorPubkey],
  "#d": [boardId],
  limit: 1
};

const board = await ndk.fetchEvent(boardFilter);

// Alle Cards eines Boards abrufen
const cardsFilter = {
  kinds: [30302],
  "#a": [`30301:${authorPubkey}:${boardId}`]
};

const cards = await ndk.fetchEvents(cardsFilter);

// Kommentare einer Card abrufen
const commentsFilter = {
  kinds: [1], // oder 42 für NIP-22
  "#e": [cardEventId]
};

const comments = await ndk.fetchEvents(commentsFilter);
```

### Reactive Subscriptions (Svelte 5)

```typescript
import { derived } from 'svelte/store';

// Auto-updating subscription
const cardsSubscription = ndk.storeSubscribe(
  { 
    kinds: [30302],
    "#a": [`30301:${authorPubkey}:${boardId}`] 
  },
  { closeOnEose: false } // Keep subscription open
);

// In Svelte-Komponente
let cards = $derived($cardsSubscription);
```

## Offline-First Strategie

### Konzept

1. **Lokaler Cache:** Alle Board-/Card-Daten werden im `BoardStore` gehalten
2. **IndexedDB Persistenz:** Nutzung von `svelte-persisted-store` oder NDK Cache
3. **Event Queue:** Nicht synchronisierte Änderungen werden in einer Queue gespeichert
4. **Synchronisation:** Bei Verbindung werden Events automatisch publiziert

### Implementierung

```typescript
// src/lib/stores/kanbanStore.ts

import { persisted } from 'svelte-persisted-store';
import type NDK from '@nostr-dev-kit/ndk';

export class BoardStore {
  private board = $state(/* ... */);
  private eventQueue = persisted<NDKEvent[]>('nostr-event-queue', []);
  private isOnline = $state(navigator.onLine);
  
  constructor(private ndk: NDK) {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  public moveCard(cardId: string, fromColId: string, toColId: string) {
    // 1. Lokale Änderung (sofort sichtbar)
    this.board.moveCard(cardId, fromColId, toColId);
    
    // 2. Event erstellen
    const event = this.createMoveCardEvent(cardId, fromColId, toColId);
    
    // 3. Publish oder Queue
    if (this.isOnline) {
      this.publishEvent(event);
    } else {
      this.queueEvent(event);
    }
  }
  
  private async publishEvent(event: NDKEvent) {
    try {
      await event.publish();
    } catch (error) {
      console.error('Failed to publish:', error);
      this.queueEvent(event); // Fallback to queue
    }
  }
  
  private queueEvent(event: NDKEvent) {
    this.eventQueue.update(queue => [...queue, event]);
  }
  
  private async syncQueue() {
    const queue = get(this.eventQueue);
    
    for (const event of queue) {
      try {
        await event.publish();
        // Remove from queue on success
        this.eventQueue.update(q => q.filter(e => e.id !== event.id));
      } catch (error) {
        console.error('Sync failed for event:', event.id);
        break; // Stop on first failure
      }
    }
  }
}
```

### NDK Built-in Caching

NDK hat einen eingebauten Cache-Mechanismus:

```typescript
import NDK, { NDKCacheAdapterDexie } from '@nostr-dev-kit/ndk';

const ndk = new NDK({
  explicitRelayUrls: ["wss://relay.damus.io"],
  cacheAdapter: new NDKCacheAdapterDexie(), // IndexedDB Cache
});
```

## Best Practices

### 1. Event-Struktur konsistent halten

Alle Board-Operationen sollten Events gemäß NIP-30301/30302 erzeugen.

### 2. Replaceable Events nutzen

`kind: 30301` und `kind: 30302` sind **parametrized replaceable events** (NIP-33). Das bedeutet:
- Nur die neueste Version mit gleichem `d`-tag wird behalten
- Ideal für Zustandsänderungen (Card-Updates, Board-Updates)

### 3. Signer Integration

Für Produktions-Apps sollte ein Nostr-Signer verwendet werden:

```typescript
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';

// Browser Extension (Alby, nos2x, etc.)
const signer = new NDKNip07Signer();
ndk.signer = signer;

// Get current user
const user = await signer.user();
```

### 4. Conflict Resolution

Bei Offline-First können Konflikte entstehen. Strategie:

- **Last-Write-Wins:** Nutze `created_at` Timestamps
- **Merge Strategy:** Bei gleichzeitigen Änderungen werden beide Versionen als neue Cards angelegt

## Komponenten-Beispiele

### Board mit NDK

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import type NDK from '@nostr-dev-kit/ndk';
  
  const ndk = getContext<NDK>('ndk');
  
  // Reactive subscription
  let boardEvents = $state([]);
  
  $effect(() => {
    const sub = ndk.subscribe(
      { kinds: [30301], authors: [currentUser.pubkey] },
      { closeOnEose: false }
    );
    
    sub.on('event', (event) => {
      // Update local state
      boardEvents = [...boardEvents, event];
    });
    
    return () => sub.stop();
  });
</script>
```

## Erweiterte Features

### 1. Event Validation

```typescript
import { validateEvent, verifySignature } from 'nostr-tools';

function isValidBoardEvent(event: NDKEvent): boolean {
  return (
    event.kind === 30301 &&
    event.tags.some(t => t[0] === 'd') &&
    event.tags.some(t => t[0] === 'title') &&
    verifySignature(event.rawEvent())
  );
}
```

### 2. Relay Hints

Füge Relay-Hints zu `a`-tags hinzu für bessere Auffindbarkeit:

```typescript
["a", "30301:pubkey:board-id", "wss://relay.damus.io"]
```

### 3. Verschlüsselung (optional)

Für private Boards kann NIP-04 (Encrypted Direct Messages) genutzt werden.

## Fehlerbehandlung

```typescript
async function publishBoard(board: Board) {
  try {
    const event = createBoardEvent(board);
    
    const relays = await event.publish();
    
    if (relays.size === 0) {
      throw new Error('No relays accepted the event');
    }
    
    console.log(`Published to ${relays.size} relays`);
  } catch (error) {
    console.error('Publish failed:', error);
    
    // Fallback: Queue for later
    queueForOfflineSync(event);
  }
}
```

## Nächste Schritte

1. ✅ NDK ist bereits integriert
2. ⏳ BoardStore um Nostr-Publish erweitern
3. ⏳ Event-Queue für Offline-Sync implementieren
4. ⏳ Subscription-basierte Auto-Updates
5. ⏳ Kommentar-System als separate Events
6. ⏳ Signer-Integration für Produktiv-Nutzung

## Ressourcen

- [NDK Documentation](https://github.com/nostr-dev-kit/ndk)
- [NDK Svelte Components](https://github.com/nostr-dev-kit/ndk-svelte-components)
- [Kanban NIP Proposal](./Kanban-NIP.md)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
