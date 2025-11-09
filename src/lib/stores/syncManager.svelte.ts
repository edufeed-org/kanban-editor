// src/lib/stores/syncManager.svelte.ts
/**
 * SyncManager - Offline-First Event Queue mit Nostr Signing
 *
 * Responsibilities:
 * - Event queueing (offline fallback)
 * - Event signing with Nostr signer
 * - Retry/backoff for transient relay-connect failures
 * - Prevent duplicate concurrent publishes of identical events
 * - Persist queue to localStorage
 */

import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { PublishState } from '$lib/stores/settingsStore.svelte';

// ============================================================================
// TYPES
// ============================================================================

export interface QueuedEvent {
  id?: string;
  event: string;
  timestamp: number;
  retries: number;
  type: 'board' | 'card' | 'comment';
  priority?: 'high' | 'normal' | 'low';
  publishState?: PublishState;
  targetRelays?: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedEvents: number;
  lastSyncTime?: number;
  nextRetryTime?: number;
}

export interface SyncConfig {
  maxRetries?: number;
  backoffMultiplier?: number;
  baseDelayMs?: number;
  maxQueueSize?: number;
  syncIntervalMs?: number;
}

export class SyncManager {
  private isOnline = $state(typeof window !== 'undefined' ? navigator.onLine : true);
  private isSyncing = $state(false);
  private eventQueue = $state<QueuedEvent[]>([]);
  private lastSyncTime = $state<number | undefined>(undefined);
  private nextRetryTime = $state<number | undefined>(undefined);
  private signer = $state<NDKSigner | undefined>(undefined);
  private inflightPublishes: Map<string, Promise<Set<any>>> = new Map();
  private config: Required<SyncConfig>;
  private syncIntervalId: NodeJS.Timeout | undefined;
  private retryTimeoutId: NodeJS.Timeout | undefined;

  constructor(private ndk: NDK, initialSigner: NDKSigner | undefined, config: SyncConfig = {}) {
    this.signer = initialSigner;
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxQueueSize: config.maxQueueSize ?? 1000,
      syncIntervalMs: config.syncIntervalMs ?? 30000,
    };
    this.loadQueueFromStorage();
    this.setupListeners();
    if (this.isOnline && this.eventQueue.length > 0) {
      console.log('[SyncManager] Online at startup, syncing queued events...');
      this.syncQueue();
    }
    this.startPeriodicSync();
  }

  public updateSigner(signer: NDKSigner | undefined): void {
    const wasSigner = this.signer ? 'yes' : 'no';
    const isSigner = signer ? 'yes' : 'no';
    this.signer = signer;
    console.log(`[SyncManager] Signer updated: ${wasSigner}  ${isSigner}`);
    if (signer && this.isOnline && this.eventQueue.length > 0) {
      console.log(`[SyncManager] New signer available! Syncing ${this.eventQueue.length} queued event(s)...`);
      this.syncQueue();
    }
  }

  public async publishOrQueue(event: NDKEvent, type: 'board' | 'card' | 'comment', priority: 'high' | 'normal' | 'low' = 'normal', publishState?: PublishState, targetRelays?: string[]): Promise<NDKEvent | undefined> {
    try {
      if (targetRelays !== undefined && targetRelays.length === 0) {
        console.log(`[SyncManager] Local-only mode - skipping Nostr publishing for ${type} event`);
        return undefined; // ← NEU: Return undefined for local-only
      }
      if (this.isOnline && this.signer) {
        try {
          console.log(`[SyncManager] Online - attempting to publish ${type} event immediately`);
          if (targetRelays && targetRelays.length > 0) {
            console.log(`[SyncManager] Using ${targetRelays.length} target relay(s) for PublishState: ${publishState}`);
          }
          const relays = await this.signAndPublish(event, targetRelays);
          if (relays && relays.size > 0) {
            console.log(`[SyncManager] ✅ Event published to ${relays.size} relay(s)`);
            console.log(`[SyncManager] 🔑 Event ID: ${event.id}`); // ← NEU: Log Event-ID!
            this.lastSyncTime = Date.now();
            return event; // ← NEU: Return signed event with ID!
          }
          throw new Error('No relays accepted the event');
        } catch (error) {
          console.warn('[SyncManager] Publish failed, will queue:', error);
          console.log(`Event ${event.id} queued for publishing`);
          await this.queueEvent(event, type, priority, publishState, targetRelays);
          return undefined; // ← NEU: Return undefined when queued
        }
      } else {
        const reason = !this.isOnline ? 'offline' : 'no signer';
        console.log(`[SyncManager] ${reason.toUpperCase()} - queueing ${type} event`);
        await this.queueEvent(event, type, priority, publishState, targetRelays);
        return undefined; // ← NEU: Return undefined when queued
      }
    } catch (error) {
      console.error('[SyncManager] Unexpected error in publishOrQueue:', error);
      await this.queueEvent(event, type, priority, publishState, targetRelays);
      return undefined; // ← NEU: Return undefined on error
    }
  }

  private async signAndPublish(event: NDKEvent, targetRelays?: string[]): Promise<Set<any>> {
    if (!this.signer) {
      throw new Error('No signer available - cannot sign event');
    }
    const rawEventKey = JSON.stringify(event.rawEvent());
    if (this.inflightPublishes.has(rawEventKey)) {
      return this.inflightPublishes.get(rawEventKey)!;
    }
    const publishPromise = (async (): Promise<Set<any>> => {
      console.log('[SyncManager] Signing event...');
      await event.sign(this.signer);
      if (!event.sig) {
        throw new Error('Event signing failed - no signature generated');
      }
      console.log('[SyncManager] Event signed');
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (targetRelays && targetRelays.length > 0) {
            const plainRelays = Array.isArray(targetRelays) ? [...targetRelays] : targetRelays;
            console.log(`[SyncManager] Publishing to ${plainRelays.length} target relay(s):`, plainRelays);
            const ndkRelays = new Set(plainRelays.map(url => this.ndk.pool.getRelay(url)));
            const ndkRelaySet = new NDKRelaySet(ndkRelays, this.ndk);
            return await event.publish(ndkRelaySet);
          }
          console.log('[SyncManager] Publishing to NDK default relays');
          return await event.publish();
        } catch (err) {
          const isLast = attempt === maxAttempts - 1;
          console.warn(`[SyncManager] publish attempt ${attempt + 1} failed:`, err);
          if (isLast) throw err;
          const backoffMs = 500 * Math.pow(2, attempt);
          console.log(`[SyncManager] Waiting ${backoffMs}ms before retrying publish`);
          await new Promise(res => setTimeout(res, backoffMs));
        }
      }
      throw new Error('Failed to publish after retries');
    })();
    this.inflightPublishes.set(rawEventKey, publishPromise);
    try {
      const result = await publishPromise;
      return result;
    } finally {
      this.inflightPublishes.delete(rawEventKey);
    }
  }

  private async queueEvent(event: NDKEvent, type: 'board' | 'card' | 'comment', priority: 'high' | 'normal' | 'low', publishState?: PublishState, targetRelays?: string[]): Promise<void> {
    const queuedEvent: QueuedEvent = {
      event: JSON.stringify(event.rawEvent()),
      timestamp: Date.now(),
      retries: 0,
      type,
      priority,
      publishState,
      targetRelays,
    };
    
    // Check queue size limit
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority event, or oldest normal-priority if no low-priority exists
      const lowPriorityIdx = this.eventQueue.findIndex(e => e.priority === 'low');
      if (lowPriorityIdx !== -1) {
        console.warn(`[SyncManager] Queue full - removing oldest low-priority event`);
        this.eventQueue = this.eventQueue.filter((_, idx) => idx !== lowPriorityIdx);
      } else {
        const normalPriorityIdx = this.eventQueue.findIndex(e => !e.priority || e.priority === 'normal');
        if (normalPriorityIdx !== -1) {
          console.warn(`[SyncManager] Queue full - removing oldest normal-priority event`);
          this.eventQueue = this.eventQueue.filter((_, idx) => idx !== normalPriorityIdx);
        } else {
          console.warn(`[SyncManager] Queue full with all high-priority events - removing oldest`);
          this.eventQueue = this.eventQueue.slice(1);
        }
      }
    }
    
    this.eventQueue = [...this.eventQueue, queuedEvent];
    console.log(`[SyncManager] Queued event; queue size now ${this.eventQueue.length}`);
    this.saveQueueToStorage();
  }

  public async syncQueue(): Promise<void> {
    console.log(`[SyncManager] syncQueue called - isOnline: ${this.isOnline}, isSyncing: ${this.isSyncing}, hasSigner: ${!!this.signer}`);
    if (this.isSyncing || !this.isOnline || !this.signer) {
      const reason = this.isSyncing ? 'already syncing' : !this.isOnline ? 'offline' : 'no signer';
      console.log(`[SyncManager] Sync skipped - ${reason}`);
      return;
    }
    this.isSyncing = true;
    console.log(`[SyncManager] Starting sync - ${this.eventQueue.length} events to process`);
    const queueSnapshot = [...this.eventQueue];
    let successCount = 0;
    for (const queuedEvent of queueSnapshot) {
      try {
        const currentIdx = this.eventQueue.findIndex(e => e.timestamp === queuedEvent.timestamp);
        if (currentIdx === -1) continue;
        const rawEvent = JSON.parse(queuedEvent.event);
        const event = new NDKEvent(this.ndk, rawEvent);
        console.log(`[SyncManager] Publishing queued ${queuedEvent.type} event (attempt ${queuedEvent.retries + 1})`);
        const relays = await this.signAndPublish(event, queuedEvent.targetRelays);
        if (relays && relays.size > 0) {
          this.removeFromQueue(queuedEvent.timestamp);
          successCount++;
          console.log(`[SyncManager] Event synced`);
        } else {
          throw new Error('No relays accepted event');
        }
      } catch (error) {
        console.error('[SyncManager] Sync failed for event:', error);
        const idx = this.eventQueue.findIndex(e => e.timestamp === queuedEvent.timestamp);
        if (idx >= 0) {
          const currentEvent = this.eventQueue[idx];
          const updatedEvent = { ...currentEvent, retries: currentEvent.retries + 1 };
          if (updatedEvent.retries >= this.config.maxRetries) {
            console.error(`[SyncManager] Event failed ${updatedEvent.retries} times - removing from queue`);
            this.removeFromQueue(queuedEvent.timestamp);
          } else {
            const updatedQueue = [...this.eventQueue];
            updatedQueue[idx] = updatedEvent;
            this.eventQueue = updatedQueue;
            const delayMs = Math.pow(this.config.backoffMultiplier, updatedEvent.retries) * this.config.baseDelayMs;
            this.nextRetryTime = Date.now() + delayMs;
            console.log(`[SyncManager] Next retry in ${delayMs}ms (attempt ${updatedEvent.retries + 1})`);
            this.saveQueueToStorage();
          }
        }
        console.log('[SyncManager] Stopping sync - will retry remaining events on next attempt');
        break;
      }
    }
    this.isSyncing = false;
    this.lastSyncTime = Date.now();
    console.log(`[SyncManager] Sync complete - ${successCount} succeeded, ${this.eventQueue.length} remaining`);
    this.saveQueueToStorage();
  }

  private removeFromQueue(timestamp: number): void {
    this.eventQueue = this.eventQueue.filter(e => e.timestamp !== timestamp);
    this.saveQueueToStorage();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      console.log('[SyncManager] ONLINE - triggering sync');
      this.isOnline = true;
      this.syncQueue();
    });
    window.addEventListener('offline', () => {
      console.log('[SyncManager] OFFLINE - all events will be queued');
      this.isOnline = false;
    });
  }

  private startPeriodicSync(): void {
    if (typeof window === 'undefined') return;
    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && this.eventQueue.length > 0 && !this.isSyncing) {
        console.log('[SyncManager] Periodic sync trigger');
        this.syncQueue();
      }
    }, this.config.syncIntervalMs);
  }

  public dispose(): void {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
  }

  private saveQueueToStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    try {
      const queueData = this.eventQueue.map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        retries: e.retries,
        type: e.type,
        priority: e.priority || 'normal',
        publishState: e.publishState,
        targetRelays: e.targetRelays,
      }));
      localStorage.setItem('nostr-event-queue', JSON.stringify(queueData));
      console.log(`[SyncManager] Queue persisted (${queueData.length} events)`);
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
        console.log(`[SyncManager] Loaded ${this.eventQueue.length} queued events from storage`);
      }
    } catch (error) {
      console.error('[SyncManager] Failed to load queue from storage:', error);
      this.eventQueue = [];
    }
  }

  private priorityScore(priority?: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'low': return 1;
      default: return 2;
    }
  }

  public get status(): SyncStatus {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedEvents: this.eventQueue.length,
      lastSyncTime: this.lastSyncTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  public getQueuedEvents(): QueuedEvent[] {
    return [...this.eventQueue];
  }

  public clearQueue(): void {
    console.warn('[SyncManager] Clearing entire queue - this cannot be undone!');
    this.eventQueue = [];
    this.saveQueueToStorage();
  }

  public forceOnlineStatus(online: boolean): void {
    this.isOnline = online;
    console.log(`[SyncManager] Forced online status: ${online}`);
  }
}

let syncManager: SyncManager | null = null;

export function initializeSyncManager(ndk: NDK, signer: NDKSigner | undefined, config?: SyncConfig): SyncManager {
  if (syncManager) {
    if (signer) syncManager.updateSigner(signer);
    return syncManager;
  }
  syncManager = new SyncManager(ndk, signer, config);
  return syncManager;
}

export function getSyncManager(): SyncManager {
  if (!syncManager) throw new Error('SyncManager not initialized! Call initializeSyncManager() first.');
  return syncManager;
}

export function disposeSyncManager(): void {
  if (syncManager) {
    syncManager.dispose();
    syncManager = null;
  }
}
