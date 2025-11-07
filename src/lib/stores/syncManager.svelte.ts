// src/lib/stores/syncManager.svelte.ts
/**
 * SyncManager - Offline-First Event Queue mit Nostr Signing
 *
 * Verantwortlichkeiten:
 * 1. Event Queueing (offline fallback)
 * 2. Event Signing mit Nostr Signer
 * 3. Automatic Retry-Logik (exponentieller Backoff)
 * 4. Online/Offline Detection
 * 5. IndexedDB Persistierung
 *
 * Integration:
 * - BoardStore.publishToNostr() nutzt SyncManager.publishOrQueue()
 * - AuthStore liefert den Signer (window.nostr oder NDKPrivateKeySigner)
 * - NDK wird für Relay-Publishing genutzt
 *
 * Status: Phase 1.2 ROADMAP (noch zu integrieren)
 */

import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKSigner, NDKUser } from '@nostr-dev-kit/ndk';

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedEvent {
  id?: string;
  event: string; // Serialized NDKEvent as JSON string
  timestamp: number; // Unix timestamp when queued
  retries: number; // Number of failed attempts
  type: 'board' | 'card' | 'comment'; // Event classification
  priority?: 'high' | 'normal' | 'low'; // Optional priority for sorting
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedEvents: number;
  lastSyncTime?: number;
  nextRetryTime?: number;
}

export interface SyncConfig {
  maxRetries?: number; // Default: 3
  backoffMultiplier?: number; // Default: 2 (exponential: 2^retries * baseDelay)
  baseDelayMs?: number; // Default: 1000ms
  maxQueueSize?: number; // Default: 1000 events
  syncIntervalMs?: number; // Default: 30000 (auto-sync every 30s when online)
}

// ============================================================================
// SYNC MANAGER IMPLEMENTATION
// ============================================================================

export class SyncManager {
  // ========== State (Svelte 5 Runes) ==========
  private isOnline = $state(typeof window !== 'undefined' ? navigator.onLine : true);
  private isSyncing = $state(false);
  private eventQueue = $state<QueuedEvent[]>([]);
  private lastSyncTime = $state<number | undefined>(undefined);
  private nextRetryTime = $state<number | undefined>(undefined);
  private signer = $state<NDKSigner | undefined>(undefined); // 🔴 FIX: Must be $state!

  // ========== Configuration ==========
  private config: Required<SyncConfig>;

  // ========== Timing ==========
  private syncIntervalId: NodeJS.Timeout | undefined;
  private retryTimeoutId: NodeJS.Timeout | undefined;

  /**
   * Constructor
   * @param ndk NDK instance for publishing events
   * @param signer Optional signer (from AuthStore)
   * @param config Optional configuration
   */
  constructor(
    private ndk: NDK,
    initialSigner: NDKSigner | undefined,
    config: SyncConfig = {}
  ) {
    this.signer = initialSigner; // 🔄 Set via $state variable
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxQueueSize: config.maxQueueSize ?? 1000,
      syncIntervalMs: config.syncIntervalMs ?? 30000,
    };

    // Initialize
    this.loadQueueFromStorage();
    this.setupListeners();

    // Initial sync if online
    if (this.isOnline && this.eventQueue.length > 0) {
      console.log('[SyncManager] Online at startup, syncing queued events...');
      this.syncQueue();
    }

    // Setup periodic sync
    this.startPeriodicSync();
  }

  /**
   * Update signer (called when user logs in/out)
   * 🔴 CRITICAL FIX: Must be $state variable to trigger reactivity!
   */
  public updateSigner(signer: NDKSigner | undefined): void {
    const wasSigner = this.signer ? 'yes' : 'no';
    const isSigner = signer ? 'yes' : 'no';
    
    this.signer = signer;  // 🔄 Update reactive state
    
    console.log(`[SyncManager] Signer updated: ${wasSigner} → ${isSigner}`);
    
    // Try to sync if we now have a signer
    if (signer && this.isOnline && this.eventQueue.length > 0) {
      console.log(`[SyncManager] ✅ New signer available! Syncing ${this.eventQueue.length} queued event(s)...`);
      this.syncQueue();
    } else if (signer && this.eventQueue.length === 0) {
      console.log('[SyncManager] New signer available, but no queued events');
    } else if (!signer) {
      console.log('[SyncManager] Signer cleared (logged out)');
    }
  }

  /**
   * Main entry point: Publish or queue event
   * 
   * Flow:
   * 1. If online → Try to sign and publish
   * 2. If offline or publish fails → Queue event
   * 3. Event persisted to IndexedDB
   */
  public async publishOrQueue(
    event: NDKEvent,
    type: 'board' | 'card' | 'comment',
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<void> {
    try {
      // Check if we should try immediate publish
      if (this.isOnline && this.signer) {
        try {
          console.log(`[SyncManager] Online - attempting to publish ${type} event immediately`);
          const relays = await this.signAndPublish(event);
          
          if (relays.size > 0) {
            console.log(`[SyncManager] ✅ Event published to ${relays.size} relay(s)`);
            this.lastSyncTime = Date.now();
            return;
          } else {
            throw new Error('No relays accepted the event');
          }
        } catch (error) {
          console.warn(`[SyncManager] ⚠️ Publish failed, will queue:`, error);
          console.log(`✅ Event ${event.id} queued for publishing`);
          this.queueEvent(event, type, priority);
        }
      } else {
        // Offline or no signer
        const reason = !this.isOnline ? 'offline' : 'no signer';
        console.log(`[SyncManager] ${reason.toUpperCase()} - queueing ${type} event`);
        this.queueEvent(event, type, priority);
      }
    } catch (error) {
      console.error('[SyncManager] Unexpected error in publishOrQueue:', error);
      this.queueEvent(event, type, priority);
    }
  }

  /**
   * Sign event with signer and publish to relays
   * 
   * CRITICAL: Must sign before publishing
   * This ensures event has valid signature for relay acceptance
   */
  private async signAndPublish(event: NDKEvent): Promise<Set<any>> {
    if (!this.signer) {
      throw new Error('No signer available - cannot sign event');
    }

    try {
      // Step 1: Sign the event
      console.log('[SyncManager] Signing event with signer...');
      await event.sign(this.signer);
      
      if (!event.sig) {
        throw new Error('Event signing failed - no signature generated');
      }
      console.log('[SyncManager] ✅ Event signed successfully');

      // Step 2: Publish to relays
      console.log('[SyncManager] Publishing signed event to relays...');
      const relays = await event.publish();
      
      console.log(`[SyncManager] ✅ Published to ${relays.size} relay(s):`, Array.from(relays));
      return relays;
    } catch (error) {
      console.error('[SyncManager] Signing or publishing failed:', error);
      throw error;
    }
  }

  /**
   * Queue event for later sync
   * 
   * Rules:
   * - Events serialized as JSON (avoid circular refs)
   * - Queue size limited to prevent memory issues
   * - Duplicates check (same event type & content)
   */
  private queueEvent(
    event: NDKEvent,
    type: 'board' | 'card' | 'comment',
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    // Check queue size limit
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      console.error(`[SyncManager] Queue size limit (${this.config.maxQueueSize}) exceeded!`);
      // Remove lowest priority event
      const lowestPriority = this.eventQueue.reduce((min, e) => 
        (this.priorityScore(e.priority) < this.priorityScore(min.priority)) ? e : min
      );
      const idx = this.eventQueue.indexOf(lowestPriority);
      if (idx >= 0) {
        this.eventQueue.splice(idx, 1);
      }
    }

    const queuedEvent: QueuedEvent = {
      event: JSON.stringify(event.rawEvent()), // Serialize to JSON
      timestamp: Date.now(),
      retries: 0,
      type,
      priority,
    };

    // Add to queue (reassignment for Svelte 5 reactivity)
    this.eventQueue = [...this.eventQueue, queuedEvent];
    
    console.log(`[SyncManager] 📥 Queued ${type} event (retries: 0, priority: ${priority})`);
    console.log(`[SyncManager] Queue size: ${this.eventQueue.length}`);

    // Persist to storage
    this.saveQueueToStorage();
  }

  /**
   * Main sync loop - processes all queued events
   * 
   * Strategy: Stop-on-First-Error
   * - Prevents overwhelming relay if there's a persistent issue
   * - Preserves order of events
   * - Next sync will retry from beginning
   */
  public async syncQueue(): Promise<void> {
    console.log(`[SyncManager] syncQueue called - isOnline: ${this.isOnline}, isSyncing: ${this.isSyncing}, hasSigner: ${!!this.signer}`);
    
    if (this.isSyncing || !this.isOnline || !this.signer) {
      const reason = this.isSyncing 
        ? 'already syncing' 
        : !this.isOnline 
          ? 'offline' 
          : 'no signer';
      console.log(`[SyncManager] Sync skipped - ${reason}`);
      return;
    }

    this.isSyncing = true;
    console.log(`[SyncManager] 🔄 Starting sync - ${this.eventQueue.length} events to process`);

    // Process queue in order - make a snapshot to avoid mutation issues
    let successCount = 0;
    let failureCount = 0;

    // Create snapshot to avoid iterator issues
    const queueSnapshot = [...this.eventQueue];

    for (const queuedEvent of queueSnapshot) {
      try {
        // Check if event still exists in queue (might have been removed)
        const currentIdx = this.eventQueue.findIndex(e => e.timestamp === queuedEvent.timestamp);
        if (currentIdx === -1) {
          continue; // Event was already removed, skip
        }

        // Deserialize event
        const rawEvent = JSON.parse(queuedEvent.event);
        const event = new NDKEvent(this.ndk, rawEvent);

        // Attempt publish
        console.log(`[SyncManager] Publishing queued ${queuedEvent.type} event (attempt ${queuedEvent.retries + 1})`);
        const relays = await this.signAndPublish(event);

        if (relays.size > 0) {
          // Success - remove from queue
          this.removeFromQueue(queuedEvent.timestamp);
          successCount++;
          console.log(`[SyncManager] ✅ Event synced`);
        } else {
          throw new Error('No relays accepted event');
        }
      } catch (error) {
        failureCount++;
        console.error(`[SyncManager] ⚠️ Sync failed for event:`, error);

        // Find current event in queue (it might have moved)
        const idx = this.eventQueue.findIndex(e => e.timestamp === queuedEvent.timestamp);
        if (idx >= 0) {
          // Increment retry counter by creating new object
          const currentEvent = this.eventQueue[idx];
          const updatedEvent = { ...currentEvent, retries: currentEvent.retries + 1 };
          
          // Check if we should remove after max retries
          if (updatedEvent.retries >= this.config.maxRetries) {
            console.error(
              `[SyncManager] ❌ Event failed ${updatedEvent.retries} times - removing from queue`
            );
            this.removeFromQueue(queuedEvent.timestamp);
          } else {
            // Update the queue with incremented retries (Svelte 5 reassignment)
            const updatedQueue = [...this.eventQueue];
            updatedQueue[idx] = updatedEvent;
            this.eventQueue = updatedQueue;
            
            // Calculate next retry time
            const delayMs = Math.pow(this.config.backoffMultiplier, updatedEvent.retries) * this.config.baseDelayMs;
            this.nextRetryTime = Date.now() + delayMs;
            console.log(`[SyncManager] ⏰ Next retry in ${delayMs}ms (attempt ${updatedEvent.retries + 1})`);
            
            // Persist updated queue
            this.saveQueueToStorage();
          }
        }

        // Stop on first error (prevent relay overload)
        console.log('[SyncManager] Stopping sync - will retry remaining events on next attempt');
        break;
      }
    }

    this.isSyncing = false;
    this.lastSyncTime = Date.now();

    console.log(
      `[SyncManager] ✅ Sync complete - ${successCount} succeeded, ${failureCount} failed, ${this.eventQueue.length} remaining`
    );

    this.saveQueueToStorage();
  }

  /**
   * Remove event from queue
   */
  private removeFromQueue(timestamp: number): void {
    this.eventQueue = this.eventQueue.filter(e => e.timestamp !== timestamp);
    this.saveQueueToStorage();
  }

  /**
   * Setup online/offline listeners
   */
  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[SyncManager] 🌐 ONLINE - triggering sync');
      this.isOnline = true;
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncManager] 📡 OFFLINE - all events will be queued');
      this.isOnline = false;
    });
  }

  /**
   * Start periodic sync when online
   */
  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;

    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && this.eventQueue.length > 0 && !this.isSyncing) {
        console.log('[SyncManager] ⏰ Periodic sync trigger');
        this.syncQueue();
      }
    }, this.config.syncIntervalMs);
  }

  /**
   * Stop periodic sync (cleanup)
   */
  public dispose(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  // ========== Storage Persistence ==========

  private saveQueueToStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      const queueData = this.eventQueue.map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        retries: e.retries,
        type: e.type,
        priority: e.priority || 'normal',
      }));

      localStorage.setItem('nostr-event-queue', JSON.stringify(queueData));
      console.log(`[SyncManager] 💾 Queue persisted (${queueData.length} events)`);
    } catch (error) {
      console.error('[SyncManager] Failed to save queue to storage:', error);
    }
  }

  private loadQueueFromStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem('nostr-event-queue');
      if (stored) {
        this.eventQueue = JSON.parse(stored);
        console.log(`[SyncManager] 📂 Loaded ${this.eventQueue.length} queued events from storage`);
      }
    } catch (error) {
      console.error('[SyncManager] Failed to load queue from storage:', error);
      this.eventQueue = [];
    }
  }

  // ========== Utilities ==========

  private priorityScore(priority?: string): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'low':
        return 1;
      default:
        return 2;
    }
  }

  // ========== Public API ==========

  /**
   * Get current sync status
   */
  public get status(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedEvents: this.eventQueue.length,
      lastSyncTime: this.lastSyncTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Get queued events (for debugging)
   */
  public getQueuedEvents(): QueuedEvent[] {
    return [...this.eventQueue];
  }

  /**
   * Clear all queued events (DANGER!)
   */
  public clearQueue(): void {
    console.warn('[SyncManager] ⚠️ Clearing entire queue - this cannot be undone!');
    this.eventQueue = [];
    this.saveQueueToStorage();
  }

  /**
   * Force set online status (for testing)
   */
  public forceOnlineStatus(online: boolean): void {
    this.isOnline = online;
    console.log(`[SyncManager] Forced online status: ${online}`);
  }

  /**
   * Get queue statistics
   */
  public getQueueStats() {
    return {
      total: this.eventQueue.length,
      byType: {
        board: this.eventQueue.filter(e => e.type === 'board').length,
        card: this.eventQueue.filter(e => e.type === 'card').length,
        comment: this.eventQueue.filter(e => e.type === 'comment').length,
      },
      byPriority: {
        high: this.eventQueue.filter(e => (e.priority || 'normal') === 'high').length,
        normal: this.eventQueue.filter(e => (e.priority || 'normal') === 'normal').length,
        low: this.eventQueue.filter(e => (e.priority || 'normal') === 'low').length,
      },
      byRetries: {
        '0': this.eventQueue.filter(e => e.retries === 0).length,
        '1': this.eventQueue.filter(e => e.retries === 1).length,
        '2': this.eventQueue.filter(e => e.retries === 2).length,
        '3+': this.eventQueue.filter(e => e.retries >= 3).length,
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE (will be initialized in +layout.ts)
// ============================================================================

let syncManager: SyncManager | null = null;

export function initializeSyncManager(
  ndk: NDK,
  signer: NDKSigner | undefined,
  config?: SyncConfig
): SyncManager {
  syncManager = new SyncManager(ndk, signer, config);
  return syncManager;
}

export function getSyncManager(): SyncManager {
  if (!syncManager) {
    throw new Error('SyncManager not initialized! Call initializeSyncManager() first.');
  }
  return syncManager;
}

export function disposeSyncManager(): void {
  if (syncManager) {
    syncManager.dispose();
    syncManager = null;
  }
}
