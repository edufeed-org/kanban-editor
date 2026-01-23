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
import { NDKEvent, NDKRelaySet, NDKRelayStatus } from '@nostr-dev-kit/ndk';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import type { PublishState } from '$lib/stores/settingsStore.svelte';
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import { authStore } from '$lib/stores/authStore.svelte';

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
  connectedRelays: number;
  totalRelays: number;
  hasRelaySigner: boolean;
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
  private relayMonitoringIntervalId: NodeJS.Timeout | undefined;
  
  // ✅ REACTIVE TRACKING: Public $state for Topbar to track changes
  // Changed from private to public so $derived in Topbar can depend on these
  public lastConnectedCount = $state(-1);  // -1 = not yet initialized, will trigger first log
  public lastTotalCount = $state(-1);
  
  // 🔥 NEW: Add a simple counter that increments on EVERY status change
  // This ensures Svelte sees the change even if the actual values are the same
  public statusChangeCounter = $state(0);
  
  // ⚡ CRITICAL: Tracke eigene publizierte Events (Echo-Prevention)
  // Key: Event-ID, Value: Timestamp wann getrackt
  private myPublishedEvents = $state(new Set<string>());
  
  // ✅ FIX: Make status a $derived instead of a getter for Svelte 5 reactivity
  public status = $derived.by((): SyncStatus => {
    // ✅ CRITICAL: Read triggers to create reactive dependency!
    // The interval updates lastConnectedCount/lastTotalCount directly
    // Reading them here creates the dependency chain
    const connectedRelays = this.lastConnectedCount;
    const totalRelays = this.lastTotalCount;
    const changeCounter = this.statusChangeCounter; // ← Force re-computation
    
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      queuedEvents: this.eventQueue.length,
      lastSyncTime: this.lastSyncTime,
      nextRetryTime: this.nextRetryTime,
      connectedRelays, // ← From $state trigger!
      totalRelays,     // ← From $state trigger!
      hasRelaySigner: !!this.signer,
    };
  });

  constructor(public ndk: NDK, initialSigner: NDKSigner | undefined, config: SyncConfig = {}) {
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
    this.setupNDKRelayEventListeners(); // 🐛 Debug relay connections
    if (this.isOnline && this.eventQueue.length > 0) {
      // console.log('[SyncManager] Online at startup, syncing queued events...');
      this.syncQueue();
    }
    this.startPeriodicSync();
    this.startRelayStatusMonitoring();
  }

  public updateSigner(signer: NDKSigner | undefined): void {
    const wasSigner = this.signer ? 'yes' : 'no';
    const isSigner = signer ? 'yes' : 'no';
    this.signer = signer;
    // console.log(`[SyncManager] Signer updated: ${wasSigner}  ${isSigner}`);
    if (signer && this.isOnline && this.eventQueue.length > 0) {
      console.log(`[SyncManager] New signer available! Syncing ${this.eventQueue.length} queued event(s)...`);
      this.syncQueue();
    }
  }

  public async publishOrQueue(event: NDKEvent, type: 'board' | 'card' | 'comment', priority: 'high' | 'normal' | 'low' = 'normal', publishState?: PublishState, targetRelays?: string[]): Promise<NDKEvent | undefined> {
    try {
      // ⚡ NEW: Check if user is authenticated before queuing
      if (!authStore.isAuthenticated) {
        console.log(`[SyncManager] ⛔ User not authenticated - skipping Nostr publishing/queueing for ${type} event`);
        return undefined;
      }
      
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
          const relays = await this.signAndPublish(event, targetRelays, type);
          if (relays && relays.size > 0) {
            console.log(`[SyncManager] ✅ Event published to ${relays.size} relay(s)`);
            if (event.id) {
              console.log(`[SyncManager] 🔑 Event ID: ${event.id}`);
            } else {
              console.warn(`[SyncManager] ⚠️ Event published but has no ID!`);
            }
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

  private async signAndPublish(event: NDKEvent, targetRelays?: string[], type?: 'board' | 'card' | 'comment'): Promise<Set<any>> {
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
      console.log(`[SyncManager] Event signed successfully`);
      console.log(`[SyncManager] Event ID after signing: ${event.id || 'UNDEFINED!'}`);
      
      // ⚡ VALIDATION: Check deletion events for auth issues
      if (event.kind === 5) {
        const aTags = event.tags.filter(tag => tag[0] === 'a');
        if (aTags.length > 0) {
          const targetCoordinate = aTags[0][1]; // e.g., "30301:author:d-tag"
          const [kind, targetAuthor] = targetCoordinate.split(':');
          
          if (targetAuthor && event.pubkey !== targetAuthor) {
            console.warn('[SyncManager] ⚠️ DELETION AUTH MISMATCH:');
            console.warn(`  Event pubkey: ${event.pubkey}`);
            console.warn(`  Target author: ${targetAuthor}`);
            console.warn(`  → Deletion will likely fail on relay!`);
          } else if (targetAuthor && event.pubkey === targetAuthor) {
            console.log('[SyncManager] ✅ Deletion auth verified: pubkey matches target author');
          }
        }
      }
      
      // ⚡ CRITICAL: Tracke Event-ID SOFORT nach Signierung!
      // Verhindert Echo-Loop (eigenes Event wird beim Empfangen erkannt & geskipt)
      if (event.id) {
        this.myPublishedEvents.add(event.id);
        console.log(`[SyncManager] 📌 Tracking own event: ${event.id.substring(0, 30)}...`);
      } else {
        console.error(`[SyncManager] ⚠️ CRITICAL: Event has no ID after signing! Cannot track for echo prevention!`);
      }
      
      const maxAttempts = 3;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          if (targetRelays && targetRelays.length > 0) {
            const plainRelays = Array.isArray(targetRelays) ? [...targetRelays] : targetRelays;
            console.log(`[SyncManager] Publishing to ${plainRelays.length} target relay(s):`, plainRelays);
            
            // 🔧 FIX: Ensure relays are connected before publishing
            const connectedRelays = new Set<any>();
            for (const url of plainRelays) {
              try {
                // Get relay from pool - it should already be there (added in +layout.svelte)
                const relay = this.ndk.pool.getRelay(url);
                if (relay) {
                  // Wait for connection if not connected
                  if (relay.status !== NDKRelayStatus.CONNECTED) {
                    console.log(`[SyncManager] Waiting for relay connection: ${url}`);
                    await relay.connect();
                  }
                  
                  // ✅ CRITICAL: Verify relay is ACTUALLY connected after connect() call
                  // Don't trust the status flag alone - check WebSocket connection
                  if (relay.status === NDKRelayStatus.CONNECTED && relay.connectivity?.status === NDKRelayStatus.CONNECTED) {
                    connectedRelays.add(relay);
                    console.log(`[SyncManager] ✅ Relay verified connected: ${url}`);
                  } else {
                    console.warn(`[SyncManager] ⚠️ Relay NOT connected after connect() call: ${url} (status: ${relay.status}, connectivity: ${relay.connectivity?.status})`);
                  }
                } else {
                  console.warn(`[SyncManager] Relay not in pool: ${url} - was it added in +layout.svelte?`);
                }
              } catch (relayError) {
                console.warn(`[SyncManager] Failed to connect relay ${url}:`, relayError);
              }
            }
            
            if (connectedRelays.size === 0) {
              throw new Error(`No relays connected from: ${plainRelays.join(', ')}`);
            }
            
            console.log(`[SyncManager] ${connectedRelays.size}/${plainRelays.length} relays connected`);
            const ndkRelaySet = new NDKRelaySet(connectedRelays, this.ndk);
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
    console.log(`[SyncManager] syncQueue called - isOnline: ${this.isOnline}, isSyncing: ${this.isSyncing}, hasSigner: ${!!this.signer}, isAuthenticated: ${authStore.isAuthenticated}`);
    if (this.isSyncing || !this.isOnline || !this.signer || !authStore.isAuthenticated) {
      const reason = this.isSyncing ? 'already syncing' : !this.isOnline ? 'offline' : !this.signer ? 'no signer' : 'user not authenticated';
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

  /**
   * 🐛 DEBUG: Listen to NDK relay connection/disconnection events
   * This helps understand when NDK auto-reconnects or disconnects
   */
  private setupNDKRelayEventListeners(): void {
    if (typeof window === 'undefined') return;
    
    // Listen to relay connect events
    this.ndk.pool?.on('relay:connect', (relay: any) => {
      console.log(`🟢 [NDK Pool] Relay CONNECTED: ${relay.url}`);
    });
    
    // Listen to relay disconnect events
    this.ndk.pool?.on('relay:disconnect', (relay: any) => {
      console.log(`🔴 [NDK Pool] Relay DISCONNECTED: ${relay.url}`);
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

  /**
   * 🐛 Debug: Monitor relay status changes with interval (not $effect - works outside component context!)
   * 
   * ✅ BEST METHOD: Use NDK's pool.stats() - most reliable!
   * Fallback to individual relay checks if stats not available
   * 
   * 🔥 FIX: Private Relays werden NICHT separat gezählt!
   * Alle Relays (public + private) sind in NDK pool.stats() enthalten!
   */
  private startRelayStatusMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    let logCounter = 0; // Log every 10 checks (10 seconds) if no change
    
    // Check every 1 second for relay status changes (faster UI updates!)
    this.relayMonitoringIntervalId = setInterval(() => {
      // 🔥 METHOD 1: Try using NDK pool.stats() (most reliable!)
      let currentConnected = 0;
      let currentTotal = 0;
      let usingFallback = false;
      
      try {
        // NDK's pool.stats() gibt die echten Connected/Total counts zurück
        const poolStats = this.ndk.pool?.stats();
        if (poolStats) {
          currentConnected = poolStats.connected || 0;
          currentTotal = poolStats.total || 0;
        } else {
          throw new Error('pool.stats() not available, using fallback');
        }
      } catch (error) {
        usingFallback = true;
        // 🔥 FALLBACK: Manual relay iteration (wenn pool.stats() nicht existiert)
        const allRelays = Array.from(this.ndk.pool?.relays?.values() || []);
        
        // ✅ IMPROVED: Count relays with VERIFIED active connection
        // Check both status flag AND connectivity status for accuracy
        const connectedRelays = allRelays.filter(r => {
          const hasCorrectStatus = r.status === NDKRelayStatus.CONNECTED;
          const hasActiveConnection = r.connectivity?.status === NDKRelayStatus.CONNECTED;
          return hasCorrectStatus && hasActiveConnection;
        });
        
        currentConnected = connectedRelays.length;
        currentTotal = allRelays.length;
        
        // Log detailed relay status only on first check or when changed
        if (this.lastConnectedCount === -1 || this.lastConnectedCount !== currentConnected) {
          console.log('📊 [Relay Details]:');
          allRelays.forEach(r => {
            const statusName = r.status === NDKRelayStatus.DISCONNECTED ? 'DISCONNECTED' : 
                              r.status === NDKRelayStatus.CONNECTED ? 'CONNECTED' : 
                              r.status === NDKRelayStatus.CONNECTING ? 'CONNECTING' : 
                              r.status === NDKRelayStatus.DISCONNECTING ? 'DISCONNECTING' : 'UNKNOWN';
            const connectivityObj = r.connectivity || {};
            const connectivityStatus = connectivityObj.status;
            const connectivityStatusName = connectivityStatus === NDKRelayStatus.DISCONNECTED ? 'DISCONNECTED' :
                                           connectivityStatus === NDKRelayStatus.CONNECTED ? 'CONNECTED' :
                                           connectivityStatus === NDKRelayStatus.CONNECTING ? 'CONNECTING' : 'UNKNOWN';
            
            console.log(`  ${r.url}:`, {
              status: `${r.status} (${statusName})`,
              connectivity: `${connectivityStatus} (${connectivityStatusName})`,
              isActuallyConnected: r.status === NDKRelayStatus.CONNECTED && connectivityStatus === NDKRelayStatus.CONNECTED
            });
          });
        }
      }
      
      const hasChanged = this.lastConnectedCount !== currentConnected || this.lastTotalCount !== currentTotal;
      
      // Log periodically (every 10s) or when changed
      if (hasChanged || logCounter % 10 === 0) {
        const method = usingFallback ? 'fallback' : 'pool.stats()';
      }
      logCounter++;
      
      if (hasChanged) {
        // ✅ CRITICAL: Update $state to trigger reactivity chain!
        this.lastConnectedCount = currentConnected;
        this.lastTotalCount = currentTotal;
        
        // 🔥 NEW: Increment counter to force Svelte to see the change
        this.statusChangeCounter++;
        
        console.log(`[SyncManager] 🔔 STATUS CHANGED! Counter: ${this.statusChangeCounter}, Relays: ${currentConnected}/${currentTotal}`);
      }
    }, 1000); // Check every 1 second (faster UI updates!)
  }

  /**
   * 🔄 Force reconnect to all relays
   * Useful when user manually wants to retry after connection loss
   */
  public async forceReconnect(): Promise<void> {
    console.log('[SyncManager] 🔄 Force reconnect requested...');
    
    try {
      const allRelays = Array.from(this.ndk.pool?.relays?.values() || []);
      console.log(`[SyncManager] Found ${allRelays.length} relay(s) to reconnect`);
      
      // Log current relay states BEFORE disconnect
      console.log('📊 Relay status BEFORE disconnect:');
      allRelays.forEach(r => {
        const statusName = r.status === NDKRelayStatus.DISCONNECTED ? 'DISCONNECTED' : 
                          r.status === NDKRelayStatus.CONNECTED ? 'CONNECTED' : 
                          r.status === NDKRelayStatus.CONNECTING ? 'CONNECTING' : 
                          r.status === NDKRelayStatus.DISCONNECTING ? 'DISCONNECTING' : 'UNKNOWN';
        console.log(`  ${r.url}: ${statusName} (${r.status})`);
      });
      
      // Disconnect all relays first
      console.log(`[SyncManager] Disconnecting ${allRelays.length} relay(s)...`);
      for (const relay of allRelays) {
        try {
          await relay.disconnect();
          console.log(`  ✓ Disconnected: ${relay.url}`);
        } catch (err) {
          console.warn(`  ✗ Disconnect failed for ${relay.url}:`, err);
        }
      }
      
      // Wait a bit before reconnecting
      console.log('[SyncManager] Waiting 500ms before reconnect...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reconnect all relays
      console.log(`[SyncManager] Reconnecting to ${allRelays.length} relay(s) via ndk.connect()...`);
      await this.ndk.connect();
      
      // Wait for connections to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log relay states AFTER reconnect
      console.log('📊 Relay status AFTER reconnect:');
      const updatedRelays = Array.from(this.ndk.pool?.relays?.values() || []);
      updatedRelays.forEach(r => {
        const statusName = r.status === NDKRelayStatus.DISCONNECTED ? 'DISCONNECTED' : 
                          r.status === NDKRelayStatus.CONNECTED ? 'CONNECTED' : 
                          r.status === NDKRelayStatus.CONNECTING ? 'CONNECTING' : 
                          r.status === NDKRelayStatus.DISCONNECTING ? 'DISCONNECTING' : 'UNKNOWN';
        console.log(`  ${r.url}: ${statusName} (${r.status})`);
      });
      
      // Force status update
      this.statusChangeCounter++;
      
      console.log('[SyncManager] ✅ Force reconnect completed');
      
      // Try to sync queue if we have events
      if (this.eventQueue.length > 0) {
        console.log(`[SyncManager] Syncing ${this.eventQueue.length} queued events after reconnect...`);
        this.syncQueue();
      }
    } catch (error) {
      console.error('[SyncManager] ❌ Force reconnect failed:', error);
    }
  }

  public dispose(): void {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    if (this.retryTimeoutId) clearTimeout(this.retryTimeoutId);
    if (this.relayMonitoringIntervalId) clearInterval(this.relayMonitoringIntervalId);
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

  /**
   * ⚡ ECHO-PREVENTION: Prüft ob Event-ID zu eigenen publizierten Events gehört
   * @param eventId Die zu prüfende Event-ID
   * @returns true wenn eigenes Event (→ skip processing!)
   */
  public isMyEvent(eventId: string): boolean {
    return this.myPublishedEvents.has(eventId);
  }

  /**
   * ⚡ CLEANUP: Entfernt Event-ID aus Tracking-Liste (nach erfolgreichem Skip)
   * @param eventId Die Event-ID die aus Tracking entfernt werden soll
   */
  public clearMyEvent(eventId: string): void {
    const deleted = this.myPublishedEvents.delete(eventId);
    if (deleted) {
      console.log(`[SyncManager] 🗑️ Cleared own event tracking: ${eventId.substring(0, 30)}...`);
    }
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

  /**
   * 🐛 DEBUG: Monitor NDK auto-reconnect behavior
   * Shows when NDK automatically tries to reconnect to relays
   */
  public startAutoReconnectMonitoring(): void {
    console.log('🔍 [Auto-Reconnect Monitor] Starting...');
    
    // Track relay status changes over time
    const relayStatusHistory = new Map<string, number>();
    
    setInterval(() => {
      const relays = Array.from(this.ndk.pool?.relays?.values() || []);
      let autoReconnectDetected = false;
      
      relays.forEach(r => {
        const previousStatus = relayStatusHistory.get(r.url);
        const currentStatus = r.status;
        
        // Detect auto-reconnect: status changed from DISCONNECTED to CONNECTING
        if (previousStatus === NDKRelayStatus.DISCONNECTED && currentStatus === NDKRelayStatus.CONNECTING) {
          console.log(`🔄 [Auto-Reconnect] NDK automatically reconnecting to: ${r.url}`);
          autoReconnectDetected = true;
        }
        
        // Detect successful auto-reconnect: CONNECTING → CONNECTED
        if (previousStatus === NDKRelayStatus.CONNECTING && currentStatus === NDKRelayStatus.CONNECTED) {
          console.log(`✅ [Auto-Reconnect] NDK successfully reconnected to: ${r.url}`);
          autoReconnectDetected = true;
        }
        
        // Detect failed auto-reconnect: CONNECTING → DISCONNECTED
        if (previousStatus === NDKRelayStatus.CONNECTING && currentStatus === NDKRelayStatus.DISCONNECTED) {
          console.warn(`❌ [Auto-Reconnect] NDK failed to reconnect to: ${r.url}`);
          autoReconnectDetected = true;
        }
        
        relayStatusHistory.set(r.url, currentStatus);
      });
      
      if (autoReconnectDetected) {
        console.log('📊 Current relay states:');
        relays.forEach(r => {
          const statusName = r.status === NDKRelayStatus.DISCONNECTED ? 'DISCONNECTED' : 
                            r.status === NDKRelayStatus.CONNECTED ? 'CONNECTED' : 
                            r.status === NDKRelayStatus.CONNECTING ? 'CONNECTING' : 
                            r.status === NDKRelayStatus.DISCONNECTING ? 'DISCONNECTING' : 'UNKNOWN';
          console.log(`  ${r.url}: ${statusName}`);
        });
      }
    }, 2000); // Check every 2 seconds
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

/**
 * 🐛 DEBUG: Start monitoring NDK auto-reconnect behavior
 * Use in browser console: window.startAutoReconnectMonitor()
 */
export function startAutoReconnectMonitor(): void {
  const sm = getSyncManager();
  sm.startAutoReconnectMonitoring();
}

// 🌐 Expose to window for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).startAutoReconnectMonitor = startAutoReconnectMonitor;
}
