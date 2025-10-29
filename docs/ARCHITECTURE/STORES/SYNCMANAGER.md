# SyncManager Dokumentation

**Datei:** `src/lib/stores/syncManager.ts` *(noch zu erstellen)*  
**Technologie:** Svelte 5 Runes + IndexedDB (Dexie)  
**Zweck:** Offline-First Event-Queue für Nostr-Synchronisation

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Architektur](#architektur)
3. [Event-Queue](#event-queue)
4. [Retry-Logik](#retry-logik)
5. [Online/Offline Detection](#onlineoffline-detection)
6. [Integration](#integration)
7. [Implementation Guide](#implementation-guide)

---

## Übersicht

Der `SyncManager` implementiert **Offline-First Synchronisation** für Nostr Events. Er queued Events wenn offline und synced sie automatisch wenn die Verbindung wiederhergestellt wird.

### Features

- ✅ **Automatic Queueing** — Events werden automatisch gequed wenn offline
- ✅ **Retry-Logik** — Exponentieller Backoff (2^retries × 1000ms)
- ✅ **Dead-Letter Queue** — Nach 3 Fehlversuchen wird Event entfernt
- ✅ **Online-Detection** — Automatische Reaktion auf window.online/offline
- ✅ **IndexedDB Persistence** — Queue überlebt Browser-Reload
- ✅ **Type-Safe** — Vollständiges TypeScript-Support

### Status

⚠️ **TODO:** Diese Komponente ist noch **nicht implementiert** (Phase 1.2 - siehe ROADMAP.md).

---

## Architektur

### Komponenten-Diagramm

```
┌────────────────────────────────────────────────────┐
│ BoardStore (kanbanStore.svelte.ts)                 │
│ ├─ publishToNostr() → SyncManager.publishOrQueue() │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ SyncManager (syncManager.ts)                       │
│ ├─ isOnline = $state(navigator.onLine)            │
│ ├─ eventQueue = $state<QueuedEvent[]>([...])      │
│ ├─ publishOrQueue() → Try publish or queue        │
│ ├─ syncQueue() → Retry all queued events          │
│ └─ Online/Offline Event Listeners                 │
└────────────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────────────┐
│ Persistierung                                      │
│ ├─ IndexedDB (Dexie) → Event Queue                │
│ └─ Nostr Relays → Published Events                │
└────────────────────────────────────────────────────┘
```

### Datenfluss

```
User bearbeitet Board
    ↓
BoardStore.updateCard()
    ↓
BoardStore.publishToNostr()
    ↓
SyncManager.publishOrQueue(event, 'card')
    ↓
┌─────────────┐
│ isOnline?   │
├─────────────┤
│ YES → Try   │ → Relay akzeptiert → ✅ Event published
│   publish   │ → Relay lehnt ab   → ❌ Queue Event
│             │
│ NO → Queue  │ → IndexedDB speichert Event
│   Event     │
└─────────────┘
    ↓
window.online Event
    ↓
SyncManager.syncQueue()
    ↓
Retry all queued events
```

---

## Event-Queue

### QueuedEvent-Interface

```typescript
export interface QueuedEvent {
    event: string;          // Serialized NDKEvent (JSON.stringify)
    timestamp: number;      // Unix Timestamp (wann gequed)
    retries: number;        // Anzahl Retry-Versuche
    type: 'board' | 'card' | 'comment'; // Event-Typ (für Logging)
}
```

**REGEL 1:** Events werden als **JSON-String** gespeichert (nicht als Objekte).

**Warum?** IndexedDB hat Probleme mit komplexen Objekten (NDKEvent hat Circular References).

### Queue-Operationen

```typescript
export class SyncManager {
    private eventQueue = $state<QueuedEvent[]>([]);
    
    /**
     * Fügt Event zur Queue hinzu
     */
    private queueEvent(event: NDKEvent, type: 'board' | 'card' | 'comment'): void {
        const queuedEvent: QueuedEvent = {
            event: JSON.stringify(event.rawEvent()),  // ← Serialize!
            timestamp: Date.now(),
            retries: 0,
            type
        };
        
        this.eventQueue = [...this.eventQueue, queuedEvent];
        this.saveQueue();  // → IndexedDB
        
        console.log(`📥 Queued ${type} event for later sync`);
    }
    
    /**
     * Entfernt Event aus Queue
     */
    private removeFromQueue(timestamp: number): void {
        this.eventQueue = this.eventQueue.filter(e => e.timestamp !== timestamp);
        this.saveQueue();
    }
}
```

**REGEL 2:** Queue wird **sofort** in IndexedDB gespeichert nach jedem Add/Remove.

---

## Retry-Logik

### Exponentieller Backoff

```typescript
/**
 * Synchronisiert alle Events in der Queue
 * Stop-on-First-Error: Verhindert Überlastung
 */
public async syncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    
    this.isSyncing = true;
    const queue = [...this.eventQueue];  // Kopie für Iteration
    
    console.log(`🔄 Syncing ${queue.length} queued event(s)...`);
    
    for (const queuedEvent of queue) {
        try {
            // Deserialize Event
            const rawEvent = JSON.parse(queuedEvent.event);
            const event = new NDKEvent(this.ndk, rawEvent);
            
            // Versuch zu publishen
            await this.publishEvent(event);
            
            // Erfolgreich → Aus Queue entfernen
            this.removeFromQueue(queuedEvent.timestamp);
            console.log('✅ Event synced successfully');
            
        } catch (error) {
            console.error('⚠️  Sync failed for event:', error);
            
            // Retry-Counter erhöhen
            queuedEvent.retries++;
            
            // Dead-Letter: Nach 3 Versuchen entfernen
            if (queuedEvent.retries >= 3) {
                console.error('❌ Event failed 3 times, removing from queue');
                this.removeFromQueue(queuedEvent.timestamp);
            } else {
                // Queue updaten (mit erhöhtem retry-count)
                this.saveQueue();
            }
            
            // Stop bei erstem Fehler (verhindert Überlastung)
            break;
        }
    }
    
    this.isSyncing = false;
    console.log('✅ Sync complete');
}
```

**REGEL 3:** Stop-on-First-Error verhindert dass hunderte Events gleichzeitig fehlschlagen.

**Backoff-Delays:**

```typescript
// Optional: Delay zwischen Retries
private async syncQueueWithBackoff(): Promise<void> {
    for (const event of this.eventQueue) {
        const delay = Math.pow(2, event.retries) * 1000;  // 1s, 2s, 4s
        
        console.log(`⏰ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
            await this.publishEvent(event);
            // ...
        } catch {
            // ...
        }
    }
}
```

**REGEL 4:** Backoff-Delays sind **optional** (können Sync verzögern).

---

## Online/Offline Detection

### Event Listeners

```typescript
export class SyncManager {
    private isOnline = $state(navigator.onLine);
    
    constructor(private ndk: NDK) {
        this.setupListeners();
        
        // Initial Sync wenn online
        if (this.isOnline) {
            this.syncQueue();
        }
    }
    
    private setupListeners(): void {
        window.addEventListener('online', () => {
            console.log('🌐 Online - Starting sync...');
            this.isOnline = true;
            this.syncQueue();  // ← Auto-Sync beim Reconnect
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Offline - Queueing events...');
            this.isOnline = false;
        });
    }
}
```

**REGEL 5:** `window.online/offline` Events triggern automatisch Sync.

### Publish-or-Queue Pattern

```typescript
/**
 * Hauptmethode: Versucht zu publishen oder queued Event
 */
public async publishOrQueue(
    event: NDKEvent,
    type: 'board' | 'card' | 'comment'
): Promise<void> {
    if (this.isOnline) {
        try {
            await this.publishEvent(event);
            console.log('✅ Event published successfully');
        } catch (error) {
            console.error('❌ Publish failed, adding to queue:', error);
            this.queueEvent(event, type);  // ← Fallback
        }
    } else {
        console.log('📡 Offline, queueing event');
        this.queueEvent(event, type);
    }
}

/**
 * Versucht Event zu publishen (wirft Error bei Fehlschlag)
 */
private async publishEvent(event: NDKEvent): Promise<void> {
    const relays = await event.publish();
    
    if (relays.size === 0) {
        throw new Error('No relays accepted the event');
    }
    
    console.log(`✅ Published to ${relays.size} relay(s)`);
}
```

**REGEL 6:** `publishOrQueue()` hat **Automatic Fallback** zu Queue bei Fehlern.

---

## Integration

### BoardStore Integration

```typescript
// In kanbanStore.svelte.ts
import { SyncManager } from './syncManager';
import { boardToNostrEvent, cardToNostrEvent } from '$lib/utils/nostrEvents';

export class BoardStore {
    private syncManager: SyncManager;
    
    constructor(private ndk: NDK) {
        this.syncManager = new SyncManager(ndk);
        // ...
    }
    
    private async publishToNostr(): Promise<void> {
        // ✅ AUTHORIZATION CHECK: Bereits in addCard() durchgeführt!
        
        // Board Event erstellen
        const boardEvent = boardToNostrEvent(this.board, this.ndk);
        await this.syncManager.publishOrQueue(boardEvent, 'board');
        
        // Card Events erstellen (für alle Karten)
        for (const column of this.board.columns) {
            for (const card of column.cards) {
                const cardEvent = cardToNostrEvent(
                    card,
                    column.name,
                    column.cards.indexOf(card),
                    `30301:${this.board.author}:${this.board.id}`,
                    this.ndk
                );
                await this.syncManager.publishOrQueue(cardEvent, 'card');
            }
        }
        
        console.log('✅ Board state queued/published to Nostr');
    }
    
    /**
     * Öffentliche Sync-Status-Abfrage
     */
    public get syncStatus() {
        return this.syncManager.status;
    }
}
```

**REGEL 7:** BoardStore delegiert Publishing an SyncManager.

### UI-Integration (Sync-Status)

```svelte
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte';
    
    let syncStatus = $derived(boardStore.syncStatus);
</script>

<div class="sync-indicator">
    {#if syncStatus.isOnline}
        <span class="text-green-500">🌐 Online</span>
    {:else}
        <span class="text-orange-500">📡 Offline</span>
    {/if}
    
    {#if syncStatus.isSyncing}
        <span>⏳ Syncing...</span>
    {/if}
    
    {#if syncStatus.queuedEvents > 0}
        <span class="text-yellow-500">
            📥 {syncStatus.queuedEvents} events queued
        </span>
    {/if}
</div>
```

---

## Implementation Guide

### Schritt 1: Datei erstellen

```bash
# Erstelle neue Datei
touch src/lib/stores/syncManager.ts
```

### Schritt 2: Dependencies installieren

```bash
# IndexedDB-Wrapper
pnpm add dexie
pnpm add -D @types/dexie
```

### Schritt 3: Basic Implementation

```typescript
// src/lib/stores/syncManager.ts

import type NDK from '@nostr-dev-kit/ndk';
import type { NDKEvent } from '@nostr-dev-kit/ndk';
import Dexie from 'dexie';

export interface QueuedEvent {
    event: string;
    timestamp: number;
    retries: number;
    type: 'board' | 'card' | 'comment';
}

// IndexedDB Schema
class EventQueueDB extends Dexie {
    events!: Dexie.Table<QueuedEvent, number>;
    
    constructor() {
        super('nostr-event-queue');
        this.version(1).stores({
            events: '++id, timestamp, type'
        });
    }
}

export class SyncManager {
    private db = new EventQueueDB();
    private isOnline = $state(navigator.onLine);
    private isSyncing = $state(false);
    private eventQueue = $state<QueuedEvent[]>([]);
    
    constructor(private ndk: NDK) {
        this.loadQueue();
        this.setupListeners();
        
        if (this.isOnline) {
            this.syncQueue();
        }
    }
    
    private async loadQueue(): Promise<void> {
        const events = await this.db.events.toArray();
        this.eventQueue = events;
        console.log(`📋 Loaded ${events.length} queued events`);
    }
    
    private async saveQueue(): Promise<void> {
        // Clear alle alten Events
        await this.db.events.clear();
        
        // Speichere aktuelle Queue
        await this.db.events.bulkAdd(this.eventQueue);
    }
    
    private setupListeners(): void {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    
    public async publishOrQueue(
        event: NDKEvent,
        type: 'board' | 'card' | 'comment'
    ): Promise<void> {
        if (this.isOnline) {
            try {
                await this.publishEvent(event);
            } catch (error) {
                this.queueEvent(event, type);
            }
        } else {
            this.queueEvent(event, type);
        }
    }
    
    private async publishEvent(event: NDKEvent): Promise<void> {
        const relays = await event.publish();
        if (relays.size === 0) {
            throw new Error('No relays accepted event');
        }
    }
    
    private queueEvent(event: NDKEvent, type: 'board' | 'card' | 'comment'): void {
        const queuedEvent: QueuedEvent = {
            event: JSON.stringify(event.rawEvent()),
            timestamp: Date.now(),
            retries: 0,
            type
        };
        
        this.eventQueue = [...this.eventQueue, queuedEvent];
        this.saveQueue();
    }
    
    public async syncQueue(): Promise<void> {
        // Implementation wie oben...
    }
    
    public get status() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            queuedEvents: this.eventQueue.length
        };
    }
}
```

### Schritt 4: BoardStore Integration

```typescript
// In kanbanStore.svelte.ts

import { SyncManager } from './syncManager';

export class BoardStore {
    private syncManager?: SyncManager;
    
    constructor() {
        // syncManager wird später initialisiert (nach NDK)
    }
    
    public initializeSyncManager(ndk: NDK): void {
        this.syncManager = new SyncManager(ndk);
    }
    
    private async publishToNostr(): Promise<void> {
        if (!this.syncManager) {
            console.warn('⚠️ SyncManager not initialized, skipping publish');
            return;
        }
        
        const boardEvent = boardToNostrEvent(this.board, this.ndk);
        await this.syncManager.publishOrQueue(boardEvent, 'board');
    }
}
```

### Schritt 5: Layout.svelte Integration

```typescript
// In +layout.svelte
import NDK from '@nostr-dev-kit/ndk';
import { boardStore } from '$lib/stores/kanbanStore.svelte';

onMount(async () => {
    const ndk = new NDK({...});
    await ndk.connect();
    
    // SyncManager initialisieren
    boardStore.initializeSyncManager(ndk);
});
```

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | Events als JSON-String speichern | 🔴 CRITICAL |
| **REGEL 2** | Queue sofort nach Add/Remove speichern | 🟠 HIGH |
| **REGEL 3** | Stop-on-First-Error bei Sync | 🟠 HIGH |
| **REGEL 5** | window.online/offline Auto-Sync | 🔴 CRITICAL |
| **REGEL 6** | publishOrQueue hat Automatic Fallback | 🔴 CRITICAL |
| **REGEL 7** | BoardStore delegiert zu SyncManager | 🔴 CRITICAL |

**Status:** ⏳ Phase 1.2 (ROADMAP.md) — Noch zu implementieren!
