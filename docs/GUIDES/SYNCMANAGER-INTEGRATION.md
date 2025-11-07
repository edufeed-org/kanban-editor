// SYNCMANAGER INTEGRATION GUIDE
//
// Wie man den SyncManager in BoardStore integriert
// Status: Phase 1.2 (Offline-First Synchronisation)

// ============================================================================
// SCHRITT 1: Imports hinzufügen (kanbanStore.svelte.ts)
// ============================================================================

import { 
  initializeSyncManager, 
  getSyncManager, 
  disposeSyncManager,
  type SyncConfig 
} from './syncManager.svelte.js';
import { boardToNostrEvent, cardToNostrEvent, createCommentEvent } from '$lib/utils/nostrEvents.js';
import type NDK from '@nostr-dev-kit/ndk';
import { authStore } from './authStore.svelte.js';

// ============================================================================
// SCHRITT 2: BoardStore erweitern
// ============================================================================

export class BoardStore {
  private ndk?: NDK;
  private syncManager?: ReturnType<typeof getSyncManager>;

  // Bestehende Properties...
  private board = $state(this.loadFromStorage());
  public updateTrigger = $state(0);

  /**
   * NDK + SyncManager initialisieren
   * Aufgerufen einmal beim App-Start in +layout.ts
   */
  public async initializeNostr(ndk: NDK): Promise<void> {
    this.ndk = ndk;

    // SyncManager erzeugen mit aktuellen Signer
    const signer = ndk.signer || authStore.signer;
    
    const syncConfig: SyncConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxQueueSize: 1000,
      syncIntervalMs: 30000,
    };

    const syncManager = initializeSyncManager(ndk, signer, syncConfig);
    this.syncManager = syncManager;

    console.log('✅ BoardStore.initializeNostr() - SyncManager initialized');

    // Falls bereits Events in Queue: auto-sync
    if (syncManager.status.queuedEvents > 0) {
      console.log(`[BoardStore] Found ${syncManager.status.queuedEvents} queued events, syncing...`);
      await syncManager.syncQueue();
    }
  }

  /**
   * Signer aktualisieren wenn Nutzer sich einloggt/ausloggt
   */
  public updateSigner(signer: any | undefined): void {
    if (this.syncManager) {
      this.syncManager.updateSigner(signer);
    }
  }

  /**
   * Veröffentliche Board zu Nostr
   * 
   * Flow:
   * 1. Konvertiere Board zu Event
   * 2. Sende zu SyncManager
   * 3. SyncManager versucht sofort oder queued offline
   */
  private async publishBoardToNostr(): Promise<void> {
    if (!this.ndk || !this.syncManager) {
      console.warn('[BoardStore] Nostr not initialized, skipping publish');
      return;
    }

    try {
      const boardEvent = boardToNostrEvent(this.board, this.ndk);
      
      console.log(`[BoardStore] Publishing board "${this.board.name}" to Nostr...`);
      await this.syncManager.publishOrQueue(boardEvent, 'board', 'high');
      
    } catch (error) {
      console.error('[BoardStore] Failed to publish board:', error);
    }
  }

  /**
   * Veröffentliche eine einzelne Karte zu Nostr
   * 
   * Benötigt:
   * - Card Object
   * - Parent Column info
   * - Board reference
   */
  private async publishCardToNostr(cardId: string): Promise<void> {
    if (!this.ndk || !this.syncManager) {
      console.warn('[BoardStore] Nostr not initialized, skipping publish');
      return;
    }

    try {
      const result = this.board.findCardAndColumn(cardId);
      if (!result) {
        console.warn(`[BoardStore] Card ${cardId} not found`);
        return;
      }

      const { card, column } = result;
      const rank = column.cards.indexOf(card);
      const boardRef = `30301:${this.board.author}:${this.board.id}`;

      const cardEvent = cardToNostrEvent(card, column.name, rank, boardRef, this.ndk);
      
      console.log(`[BoardStore] Publishing card "${card.heading}" to Nostr...`);
      await this.syncManager.publishOrQueue(cardEvent, 'card', 'normal');
      
    } catch (error) {
      console.error('[BoardStore] Failed to publish card:', error);
    }
  }

  /**
   * Veröffentliche Kommentar zu Nostr
   */
  public async publishCommentToNostr(cardId: string, text: string): Promise<void> {
    if (!this.ndk || !this.syncManager) {
      console.warn('[BoardStore] Nostr not initialized, skipping publish');
      return;
    }

    try {
      const result = this.board.findCardAndColumn(cardId);
      if (!result) {
        console.warn(`[BoardStore] Card ${cardId} not found`);
        return;
      }

      const { card } = result;
      const cardRef = `30302:${card.author}:${card.id}`;
      const cardEventId = card.eventId || ''; // Wird später gespeichert wenn published

      const commentEvent = createCommentEvent(text, cardRef, cardEventId, this.ndk);
      
      console.log(`[BoardStore] Publishing comment to Nostr...`);
      await this.syncManager.publishOrQueue(commentEvent, 'comment', 'normal');
      
    } catch (error) {
      console.error('[BoardStore] Failed to publish comment:', error);
    }
  }

  /**
   * Überschreibe alle Mutations-Methoden um publishToNostr aufzurufen
   * 
   * Beispiel für createCard:
   */
  public createCard(columnId: string, heading: string, description?: string): string {
    const col = this.board.findColumn(columnId);
    if (!col) throw new Error(`Column ${columnId} not found`);

    const author = authStore.userName || authStore.pubkey || 'anonymous';
    const card = col.addCard({ heading, content: description, author });

    // CRITICAL: Trigger reactive updates
    this.triggerUpdate();

    // ASYNC: Publish to Nostr (non-blocking)
    this.publishCardToNostr(card.id).catch(err => 
      console.error('[BoardStore] publishCardToNostr failed:', err)
    );

    return card.id;
  }

  /**
   * Trigger update - inkrementiert updateTrigger für Reaktivität
   * und speichert zu localStorage
   */
  private triggerUpdate(): void {
    this.updateTrigger++;
    this.saveToStorage();
  }

  /**
   * Cleanup beim Unmount
   */
  public dispose(): void {
    if (this.syncManager) {
      disposeSyncManager();
      this.syncManager = undefined;
    }
  }

  /**
   * Gibt Sync-Status für UI zurück
   */
  public get syncStatus() {
    return this.syncManager?.status || {
      isOnline: false,
      isSyncing: false,
      queuedEvents: 0,
    };
  }

  /**
   * Gibt Queue-Statistiken für Debugging zurück
   */
  public getQueueStats() {
    return this.syncManager?.getQueueStats() || {
      total: 0,
      byType: { board: 0, card: 0, comment: 0 },
      byPriority: { high: 0, normal: 0, low: 0 },
      byRetries: { '0': 0, '1': 0, '2': 0, '3+': 0 },
    };
  }

  // ... existing methods ...
}

// ============================================================================
// SCHRITT 3: Layout-Initialisierung (+layout.svelte / +layout.ts)
// ============================================================================

// In +layout.ts
import NDK from '@nostr-dev-kit/ndk';
import { boardStore } from '$lib/stores/kanbanStore.svelte';

export async function load() {
  // NDK erzeugen
  const ndk = new NDK({
    explicitRelayUrls: [
      'wss://relay.damus.io',
      'wss://relay.primal.net',
      'wss://nos.lol',
    ],
  });

  // Mit Relays verbinden
  await ndk.connect();

  // BoardStore mit NDK + SyncManager initialisieren
  await boardStore.initializeNostr(ndk);

  return { ndk };
}

// ============================================================================
// SCHRITT 4: UI-Komponente für Sync-Status
// ============================================================================

// In Topbar.svelte
<script lang="ts">
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  
  let syncStatus = $derived(boardStore.syncStatus);
  let queueStats = $derived(boardStore.getQueueStats());
</script>

<div class="sync-indicator">
  {#if syncStatus.isOnline}
    <span class="text-green-500">🌐 Online</span>
  {:else}
    <span class="text-orange-500">📡 Offline</span>
  {/if}

  {#if syncStatus.isSyncing}
    <span class="animate-spin">⏳</span>
  {/if}

  {#if syncStatus.queuedEvents > 0}
    <span class="text-yellow-500">
      📥 {syncStatus.queuedEvents} queued
    </span>
  {/if}
</div>

<!-- Debug Queue Stats -->
{#if queueStats.total > 0}
  <div class="text-xs text-muted-foreground">
    <div>Queue: {queueStats.byType.board}B + {queueStats.byType.card}C + {queueStats.byType.comment}Cm</div>
    <div>Retries: {queueStats.byRetries['0']} ok, {queueStats.byRetries['1']} 1x, {queueStats.byRetries['2']} 2x, {queueStats.byRetries['3+'] > 0 ? '❌' : ''}</div>
  </div>
{/if}

// ============================================================================
// SCHRITT 5: Error Handling & Logging
// ============================================================================

// In Produktionsumgebung:
// - SyncManager loggt automatisch zu Console (kann mit Logger konfiguriert werden)
// - Bei Fehlern: User-Notification via Toast
// - Queue persisted zu localStorage (auch nach Reload)
// - Automatische Retry-Logik mit exponentiellem Backoff

// Test in Browser Console:
// boardStore.getQueueStats() → Zeige Queue-Status
// boardStore.syncStatus → Zeige Online/Offline Status
// localStorage.getItem('nostr-event-queue') → Zeige persisted Events

// ============================================================================
// DEBUGGING TIPPS
// ============================================================================

/*
1. Queue ist leer (aber sollte events haben)?
   → Vielleicht publishOrQueue() wurde nicht aufgerufen
   → Überprüfe: triggerUpdate() wird nach Board-Änderung aufgerufen?
   → Überprüfe: initializeNostr() wurde aufgerufen?

2. Events werden nicht published?
   → Überprüfe: isOnline = true?
   → Überprüfe: signer vorhanden? (window.nostr oder nsec?)
   → Überprüfe: NDK relay-verbindung aktiv?
   → Check Browser Console für Errors

3. Event Signing schlägt fehl?
   → "No signer available" → Login notwendig!
   → "Event signing failed" → Browser extension issue?
   → Versuche nsec-login für Development

4. Relay antwortet nicht?
   → relays.size === 0 → Check relay URLs
   → Check Browser Network tab für WebSocket-Fehler
   → Fallback zu lokalem Relay oder testnet

5. Queue wird nicht persisted?
   → localStorage.nostr-event-queue ist leer?
   → Check Browser Storage Tab
   → Versuche localStorage.setItem() manuell in Console
*/
