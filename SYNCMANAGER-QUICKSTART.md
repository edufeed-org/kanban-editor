# SyncManager Quick Start Guide

**5-Minuten Integration für BoardStore**

---

## Step 1: SyncManager in Layout initialisieren

```typescript
// src/routes/+layout.ts

import NDK from '@nostr-dev-kit/ndk';
import { boardStore } from '$lib/stores/kanbanStore.svelte';

export async function load() {
  // 1. Erstelle NDK mit Relays
  const ndk = new NDK({
    explicitRelayUrls: [
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
    ],
  });

  // 2. Verbinde mit Relays
  await ndk.connect();

  // 3. Initialisiere BoardStore mit NDK
  // (SyncManager wird intern erzeugt!)
  await boardStore.initializeNostr(ndk);

  return { ndk };
}
```

---

## Step 2: BoardStore erweitern

```typescript
// In src/lib/stores/kanbanStore.svelte.ts

import { boardToNostrEvent, cardToNostrEvent } from '$lib/utils/nostrEvents.js';
import { getSyncManager } from './syncManager.svelte.js';

export class BoardStore {
  // ... existing code ...
  
  private ndk?: NDK;
  
  // Neue Methode: Initialisiere Nostr
  public async initializeNostr(ndk: NDK): Promise<void> {
    this.ndk = ndk;
    console.log('✅ Nostr initialized - SyncManager ready');
  }
  
  // Überschreibe createCard - mit Publishing!
  public createCard(columnId: string, heading: string): string {
    const col = this.board.findColumn(columnId);
    if (!col) throw new Error('Column not found');
    
    // 1. Model update
    const author = authStore.userName || authStore.pubkey || 'anonymous';
    const card = col.addCard({ heading, author });
    
    // 2. Trigger UI + localStorage update (SYNC)
    this.triggerUpdate();
    
    // 3. Publish zu Nostr (ASYNC - non-blocking!)
    this.publishCard(card.id).catch(err => 
      console.error('Card publish failed:', err)
    );
    
    return card.id;
  }
  
  // Neue Hilfsmethode: Publish einzelne Karte
  private async publishCard(cardId: string): Promise<void> {
    if (!this.ndk) return;
    
    const result = this.board.findCardAndColumn(cardId);
    if (!result) return;
    
    const { card, column } = result;
    const rank = column.cards.indexOf(card);
    const boardRef = `30301:${this.board.author}:${this.board.id}`;
    
    // Erstelle Event
    const cardEvent = cardToNostrEvent(
      card,
      column.name,
      rank,
      boardRef,
      this.ndk
    );
    
    // Sende zu SyncManager
    // (Er kümmert sich um Signing, Publishing, und Queueing!)
    const syncManager = getSyncManager();
    await syncManager.publishOrQueue(cardEvent, 'card', 'normal');
  }
  
  // Ähnlich für Board
  private async publishBoard(): Promise<void> {
    if (!this.ndk) return;
    
    const boardEvent = boardToNostrEvent(this.board, this.ndk);
    const syncManager = getSyncManager();
    await syncManager.publishOrQueue(boardEvent, 'board', 'high');
  }
  
  // Cleanup wenn App schließt
  public dispose(): void {
    // SyncManager stoppt seine Interval-Timer
    getSyncManager().dispose();
  }
}
```

---

## Step 3: AuthStore für Signer-Updates

```typescript
// In src/lib/stores/authStore.svelte.ts (existiert bereits)

// Nach loginWithNip07() erfolgreich:
public async loginWithNip07(): Promise<NDKUser> {
  // ... existing code ...
  
  this.currentUser = user;
  
  // ⭐ NEU: Update SyncManager Signer
  const syncManager = getSyncManager();
  syncManager.updateSigner(this.ndk.signer);
  
  return user;
}

// Bei Logout:
public logout(): void {
  this.currentUser = null;
  
  // ⭐ NEU: Clear SyncManager Signer
  const syncManager = getSyncManager();
  syncManager.updateSigner(undefined);
  
  // ... rest of logout ...
}
```

---

## Step 4: UI Status-Indicator

```svelte
<!-- src/routes/cardsboard/Topbar.svelte -->

<script lang="ts">
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  import { getSyncManager } from '$lib/stores/syncManager.svelte';
  
  let syncStatus = $derived(getSyncManager().status);
</script>

<!-- Add to topbar -->
<div class="flex items-center gap-2 ml-auto">
  {#if syncStatus.isOnline}
    <span class="text-green-600 text-xs flex items-center gap-1">
      🌐 Online
    </span>
  {:else}
    <span class="text-orange-600 text-xs flex items-center gap-1">
      📡 Offline
    </span>
  {/if}
  
  {#if syncStatus.isSyncing}
    <span class="animate-spin text-xs">⏳</span>
  {/if}
  
  {#if syncStatus.queuedEvents > 0}
    <span class="text-yellow-600 text-xs">
      📥 {syncStatus.queuedEvents}
    </span>
  {/if}
</div>
```

---

## Step 5: Test es!

### Test 1: Online Publishing

```
1. App öffnen (online)
2. Board erstellen oder Karte hinzufügen
3. Console: Suche "[SyncManager] ✅ Published to X relay(s)"
4. ✅ Event wurde zu Nostr publiziert!
```

### Test 2: Offline Fallback

```
1. Browser Devtools öffnen → Network → Offline
2. Neue Karte erstellen
3. Console: Suche "[SyncManager] 📥 Queued card event"
4. localStorage prüfen: 
   - DevTools → Application → Storage → LocalStorage
   - Key: "nostr-event-queue"
   - Value sollte JSON-Array sein ✅
```

### Test 3: Auto-Sync auf Reconnect

```
1. Browser Offline + Karte erstellen (queued)
2. Devtools → Network → Back to Online
3. Console: Suche "[SyncManager] 🔄 Starting sync"
4. Event sollte automatisch publiziert werden ✅
```

### Test 4: Browser Reload (Persistence)

```
1. Offline + mehrere Karten erstellen (queued)
2. F5 Reload
3. Console: "[SyncManager] Loaded X queued events from storage"
4. Online gehen
5. Events sollten automatisch synced werden ✅
```

---

## Debugging Tipps

### Queue Status in Console

```javascript
// In Browser Console
const manager = getSyncManager();

// Status check
manager.status
// { isOnline: true, isSyncing: false, queuedEvents: 2, ... }

// Detaillierte Statistiken
manager.getQueueStats()
// { total: 5, byType: {board: 1, card: 3, comment: 1}, ... }

// Alle queued Events zeigen
manager.getQueuedEvents().forEach(e => {
  console.log(`${e.type} - retries: ${e.retries}, priority: ${e.priority}`);
});

// Queue löschen (DANGER!)
manager.clearQueue()
```

### Logging aktivieren

```typescript
// Alle "[SyncManager]" Nachrichten werden automatisch geloggt

// Zusätzliches Logging in BoardStore:
console.log('[BoardStore] Publishing card...', cardEvent);
console.log('[BoardStore] Sync status:', manager.status);
```

---

## Häufige Fehler

### Fehler 1: "SyncManager not initialized"

```
Problem: getSyncManager() wird aufgerufen aber initializeSyncManager() nie
Lösung: 1. Überprüfe +layout.ts
         2. boardStore.initializeNostr(ndk) aufgerufen?
         3. NDK connection erfolgreich?
```

### Fehler 2: "No signer available"

```
Problem: Events werden nicht signiert
Lösung: 1. User eingeloggt? (authStore.currentUser check)
         2. window.nostr vorhanden? (Browser extension?)
         3. Falls nsec: PUBLIC_ENABLE_NSEC_LOGIN=true?
```

### Fehler 3: Events werden nicht publiziert

```
Problem: Queue ist leer aber Events sollten da sein
Lösung: 1. publishOrQueue() wird aufgerufen?
         2. isOnline = true?
         3. Relay URLs korrekt? (explicitRelayUrls)
         4. Events signiert? (event.sig vorhanden?)
```

### Fehler 4: Queue wird nach Reload nicht wiederhergestellt

```
Problem: localStorage.getItem('nostr-event-queue') ist leer
Lösung: 1. localStorage Quota nicht überschritten?
         2. Private Browsing Mode? (localStorage nicht aktiv)
         3. Devtools → Storage → Clear All?
```

---

## Performance Tipps

### Wenn Queue zu groß wird

```typescript
// Config bei Initialization anpassen:

const syncManager = initializeSyncManager(ndk, signer, {
  maxQueueSize: 500,        // Reduce from 1000
  syncIntervalMs: 60000,    // Sync less frequently (every 60s)
  baseDelayMs: 2000,        // Longer delay before retries
});
```

### Wenn zu viel Console-Logging

```typescript
// Logs nur bei Errors/Warnings:
// (Die Implementierung loggt alles - später konfigurierbar)
```

---

## Nächste Schritte

Nach der Basis-Integration:

- [ ] E2E Tests mit Playwright (multi-user offline scenarios)
- [ ] Performance Testing (1000+ events in queue)
- [ ] Relay Failover Testing
- [ ] Mobile Testing (PWA offline mode)
- [ ] User Documentation

---

## FAQ

**Q: Muss ich NDK selbst initieren?**
A: Ja, aber der Standard-Code reicht (3 Relays).

**Q: Was macht triggerUpdate()?**
A: Inkrementiert einen Counter → triggert $derived → UI & localStorage update.

**Q: Sind Events encrypted?**
A: Nein, alle Events sind public (wie Nostr Events). Encryption kommt in Phase 2.

**Q: Kann ich mehrere Boards gleichzeitig sync'en?**
A: Ja, SyncManager queued alle Events zusammen.

**Q: Was passiert wenn Relay ausfällt?**
A: Automatische Retry mit Backoff. Nach 3x wird Event entfernt (Dead-Letter).

---

**Implementierungszeit:** ~30 Minuten  
**Test-Zeit:** ~15 Minuten  
**Total:** ~45 Minuten bis zur Fertigung!

Ready? 🚀 Los geht's!
