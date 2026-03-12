// src/lib/stores/presenceStore.svelte.ts
/**
 * Presence Store - Track online users per board
 * 
 * Architecture:
 * - Uses Nostr Ephemeral Events (Kind 20000) - not permanently stored
 * - Per-board presence tracking via board d-tag reference
 * - Heartbeat every 30 seconds to indicate active presence
 * - Auto-cleanup after 60 seconds of inactivity
 * - Efficient: only tracks current board, not global presence
 * 
 * Event Structure:
 * {
 *   kind: 20000,
 *   content: "",
 *   tags: [
 *     ["d", "presence"],
 *     ["a", "30301:author:board-d-tag"]
 *   ]
 * }
 */

import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent, NDKRelayStatus, type NDKSubscription } from '@nostr-dev-kit/ndk';
import { authStore } from './authStore.svelte';

// ============================================================================
// TYPES
// ============================================================================

export interface OnlineUser {
  pubkey: string;
  lastSeen: number; // Unix timestamp in milliseconds
  displayName?: string;
}

// ============================================================================
// PRESENCE STORE
// ============================================================================

export class PresenceStore {
  private ndk: NDK | null = null;
  private currentBoardId: string | null = null;
  private currentBoardAuthor: string | null = null;
  private subscription: NDKSubscription | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private displayNameRefreshInterval: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  
  // Allowed relay URLs for presence publishing (excludes relaysEdufeed)
  private allowedPresenceRelays: string[] = [];
  
  // Reactive state
  public onlineUsers = $state<Map<string, OnlineUser>>(new Map());
  
  // Derived values
  public userCount = $derived(this.onlineUsers.size);
  public userList = $derived(Array.from(this.onlineUsers.values()));
  
  // Config
  private readonly HEARTBEAT_INTERVAL = 30000; // 30s (production)
  private readonly INACTIVITY_TIMEOUT = 120000;
  private readonly CLEANUP_INTERVAL = 30000;
  private readonly DISPLAYNAME_REFRESH_INTERVAL = 10000; // Check for updated names every 10s

  /**
   * Initialize presence tracking for NDK instance
   * @param ndk - The NDK instance
   * @param presenceRelayUrls - URLs of relays to use for presence (relaysPublic + relaysPrivate)
   */
  public async initialize(ndk: NDK, presenceRelayUrls: string[] = []): Promise<void> {
    if (this.ndk) {
      console.log('⚠️ PresenceStore already initialized');
      return;
    }
    
    this.ndk = ndk;
    this.allowedPresenceRelays = presenceRelayUrls;
    
    console.log('✅ PresenceStore initialized with', this.ndk.pool?.relays?.size || 0, 'relay(s) in pool');
  }
  

  /**
   * Start tracking presence for a specific board
   */
  public async startTracking(boardId: string, boardAuthor: string): Promise<void> {
    // Guard: If already tracking the SAME board, do nothing
    if (this.isTracking && this.currentBoardId === boardId && this.currentBoardAuthor === boardAuthor) {
      console.log('⚠️ [PRESENCE] Already tracking this board, ignoring duplicate startTracking call');
      return;
    }
    
    console.log('🔵 [PRESENCE] startTracking called:', { boardId, boardAuthor, authenticated: authStore.isAuthenticated, currentUser: authStore.getPubkey()?.substring(0, 8) });
    
    if (!this.ndk) {
      console.warn('⚠️ [PRESENCE] Cannot start tracking - NDK not initialized');
      return;
    }
    
    if (!authStore.isAuthenticated) {
      console.warn('⚠️ [PRESENCE] Cannot start tracking - User not authenticated');
      return;
    }
    
    // Check for connected relays (status >= 3 indicates connected/ready)
    const connectedRelays = Array.from(this.ndk.pool?.relays?.values() || []).filter(
      relay => relay.status >= 3
    );
    
    if (connectedRelays.length === 0) {
      console.error('❌ [PRESENCE] Cannot start tracking - No connected relays!');
      return;
    }
    
    // Detect board switch: if currentBoardId is set and different, clear users
    if (this.currentBoardId !== null && (this.currentBoardId !== boardId || this.currentBoardAuthor !== boardAuthor)) {
      console.log('🔄 [PRESENCE] Switching boards - clearing old users');
      this.onlineUsers = new Map();
    }
    
    // Set tracking flag
    this.isTracking = true;
    
    this.currentBoardId = boardId;
    this.currentBoardAuthor = boardAuthor;
    
    this.subscribeToPresence();
    
    // Start heartbeat immediately (no delay needed)
    this.startHeartbeat();
    
    this.startCleanup();
    
    this.startDisplayNameRefresh();
    
    console.log('✅ [PRESENCE] Tracking started successfully for board:', boardId);
  }

  /**
   * Stop tracking presence
   * @param clearUsers - Whether to clear the online users list (default: false)
   *                     Set to true only when switching boards or unmounting
   */
  public stopTracking(clearUsers: boolean = false): void {
    if (!this.isTracking) {
      return; // Already stopped
    }
    
    console.log('🛑 [PRESENCE] Stopping tracking...', { clearUsers });
    
    // Clear intervals and timeouts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear display name refresh
    if (this.displayNameRefreshInterval) {
      clearInterval(this.displayNameRefreshInterval);
      this.displayNameRefreshInterval = null;
    }
    
    // Stop subscription
    if (this.subscription) {
      this.subscription.stop();
      this.subscription = null;
    }
    
    // Only clear users and board tracking info if explicitly requested
    if (clearUsers) {
      this.onlineUsers = new Map();
      this.currentBoardId = null;
      this.currentBoardAuthor = null;
    }
    
    // Always mark as not tracking
    this.isTracking = false;
    
    console.log('✅ [PRESENCE] Tracking stopped');
  }

  /**
   * Subscribe to presence events for current board
   */
  private subscribeToPresence(): void {
    if (!this.ndk || !this.currentBoardId || !this.currentBoardAuthor) return;
    
    // Stop existing subscription if any to prevent duplicates
    if (this.subscription) {
      this.subscription.stop();
      this.subscription = null;
    }
    
    const boardRef = `30301:${this.currentBoardAuthor}:${this.currentBoardId}`;
    
    const filter = {
      kinds: [20000],
      '#d': ['presence'],
      '#a': [boardRef]
    };
    
    this.subscription = this.ndk.subscribe(
      filter,
      { closeOnEose: false } // Keep subscription open for live updates
    );
    
    this.subscription.on('event', (event: NDKEvent) => {
      console.log('📥 [PRESENCE] Event received:', {
        pubkey: event.pubkey.substring(0, 8),
        fullPubkey: event.pubkey,
        kind: event.kind,
        tags: event.tags,
        created_at: event.created_at,
        relay: event.relay?.url || 'unknown'
      });
			this.handlePresenceEvent(event);
    });
    
    this.subscription.on('eose', () => {
      console.log('🔵 [PRESENCE] Initial subscription sync complete (EOSE)');
      console.log('🔵 [PRESENCE] Subscription state:', {
        subscriptionId: this.subscription?.subId,
        filter: JSON.stringify(filter)
      });
    });
    
    // Immediately fetch recent presence events to show currently online users
    this.fetchCurrentOnlineUsers(boardRef);
  }
  
  /**
   * Fetch recent presence events to immediately show currently online users
   */
  private async fetchCurrentOnlineUsers(boardRef: string): Promise<void> {
    if (!this.ndk) return;
    
    try {
      // Fetch presence events from the last 3 minutes
      // (2x heartbeat interval to ensure we catch active users)
      const threeMinutesAgo = Math.floor((Date.now() - 180000) / 1000);
      
      const filter = {
        kinds: [20000],
        '#d': ['presence'],
        '#a': [boardRef],
        since: threeMinutesAgo
      };
      
      console.log('🔍 [PRESENCE] Fetching current online users...', { boardRef, since: threeMinutesAgo });
      
      const events = await this.ndk.fetchEvents(filter);
      
      console.log(`📥 [PRESENCE] Fetched ${events.size} presence event(s)`);
      
      // Process each event to populate initial online users
      for (const event of events) {
        this.handlePresenceEvent(event);
      }
    } catch (error) {
      console.error('❌ [PRESENCE] Error fetching current online users:', error);
    }
  }

  /**
   * Handle incoming presence event
   */
  private handlePresenceEvent(event: NDKEvent): void {
    const pubkey = event.pubkey;
    const timestamp = event.created_at ? event.created_at * 1000 : Date.now();
    
    // SECURITY: Never add current user to online users list
    // This prevents showing own avatar even if we receive our own heartbeat
    const currentUserPubkey = authStore.getPubkey();
    
    if (currentUserPubkey && pubkey === currentUserPubkey) {
      console.log('🟡 [PRESENCE] Ignoring own presence event');
      return; // Silently ignore own presence events
    }
    
    console.log('✅ [PRESENCE] Adding user to map:', pubkey.substring(0, 8), 'Total users:', this.onlineUsers.size + 1);
    
    // Update or add user (Svelte 5: Must reassign Map for reactivity)
    const newMap = new Map(this.onlineUsers);
    newMap.set(pubkey, {
      pubkey,
      lastSeen: timestamp,
      displayName: undefined // Will be fetched async if needed
    });
    this.onlineUsers = newMap;
    
    // Fetch display name asynchronously
    this.fetchDisplayName(pubkey);
  }

  /**
   * Fetch display name for a user from Nostr profile (async, reactive)
   */
  private async fetchDisplayName(pubkey: string): Promise<void> {
    if (!this.ndk) return;
    
    try {
      // First try cached display name from authStore
      const cachedName = authStore.getDisplayNameForPubkey(pubkey);
      
      // Update immediately with cached name if available
      if (cachedName && cachedName !== pubkey.substring(0, 16)) {
        const user = this.onlineUsers.get(pubkey);
        if (user && !user.displayName) {
          const newMap = new Map(this.onlineUsers);
          newMap.set(pubkey, {
            ...user,
            displayName: cachedName
          });
          this.onlineUsers = newMap;
        }
      }
      
      // Then fetch fresh profile from Nostr
      const ndkUser = this.ndk.getUser({ pubkey });
      await ndkUser.fetchProfile();
      
      // Extract display name from profile
      const profile = ndkUser.profile;
      let displayName: string | undefined = undefined;
      
      if (profile) {
        displayName = profile.displayName || profile.name || profile.nip05;
      }
      
      // Update user with fetched display name (Svelte 5: Must reassign Map for reactivity)
      const user = this.onlineUsers.get(pubkey);
      if (user && displayName) {
        const newMap = new Map(this.onlineUsers);
        newMap.set(pubkey, {
          ...user,
          displayName
        });
        this.onlineUsers = newMap;
      }
    } catch (error) {
      // Silently fail - profile fetching is not critical
      // User will see truncated pubkey instead
    }
  }

  /**
   * Start publishing heartbeat events
   */
  private startHeartbeat(): void {
    // Guard: prevent multiple intervals
    if (this.heartbeatInterval) {
      console.warn('⚠️ [PRESENCE] Heartbeat already running, skipping startHeartbeat()');
      return;
    }
    
    console.log('🔵 [PRESENCE] startHeartbeat() called - publishing immediately...');
    
    this.publishHeartbeat();
    
    console.log(`⏰ [PRESENCE] Heartbeat scheduled every ${this.HEARTBEAT_INTERVAL/1000}s`);
    
    this.heartbeatInterval = setInterval(() => {
      this.publishHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Publish a single heartbeat event
   */
  private async publishHeartbeat(): Promise<void> {
    if (!this.ndk) {
      console.warn('[PRESENCE] cannot publish heartbeat, ndk missing')
      return
    }
    
    try {
      const boardRef = `30301:${this.currentBoardAuthor}:${this.currentBoardId}`;
      
      const event = new NDKEvent(this.ndk);
      event.kind = 20000; // Ephemeral event
      event.content = '';
      event.tags = [
        ['d', 'presence'],
        ['a', boardRef]
      ];
      
      const relays = await event.publish();
      
      // Only log failures or first success
      if (relays.size === 0) {
        console.warn('⚠️ [PRESENCE] Heartbeat published to 0 relays');
      }
    } catch (error) {
      console.error('❌ [PRESENCE] Error publishing heartbeat:', error);
    }
  }

  /**
   * Start cleanup timer to remove inactive users
   */
  private startCleanup(): void {
    // Guard: prevent multiple intervals
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveUsers();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Remove users who haven't sent heartbeat in INACTIVITY_TIMEOUT
   */
  private cleanupInactiveUsers(): void {
    const now = Date.now();
    const cutoff = now - this.INACTIVITY_TIMEOUT;
    const currentUserPubkey = authStore.getPubkey();
    
    // Svelte 5: Must create new Map for reactivity
    const newMap = new Map(this.onlineUsers);
    let removedCount = 0;
    
    for (const [pubkey, user] of this.onlineUsers) {
      // Remove if inactive OR if it's the current user (safety check)
      if (user.lastSeen < cutoff || (currentUserPubkey && pubkey === currentUserPubkey)) {
        newMap.delete(pubkey);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.onlineUsers = newMap;
      // Only log when users are actually removed
      console.log(`🗑️ [PRESENCE] Cleaned up ${removedCount} inactive user(s). Remaining:`, this.onlineUsers.size);
    }
  }

  /**
   * Start display name refresh timer
   * Periodically checks authStore cache for updated display names
   */
  private startDisplayNameRefresh(): void {
    // Guard: prevent multiple intervals
    if (this.displayNameRefreshInterval) {
      return;
    }
    
    this.displayNameRefreshInterval = setInterval(() => {
      this.refreshDisplayNames();
    }, this.DISPLAYNAME_REFRESH_INTERVAL);
  }

  /**
   * Refresh display names from authStore cache
   * This allows reactive updates when profiles are fetched by authStore
   */
  private refreshDisplayNames(): void {
    let updated = false;
    const currentUserPubkey = authStore.getPubkey();
    const newMap = new Map(this.onlineUsers);
    
    for (const [pubkey, user] of this.onlineUsers) {
      // SAFETY: Remove current user if they somehow ended up in the map
      if (currentUserPubkey && pubkey === currentUserPubkey) {
        newMap.delete(pubkey);
        updated = true;
        continue;
      }
      
      // Get fresh display name from authStore cache
      const displayName = authStore.getDisplayNameForPubkey(pubkey);
      
      // Only update if we got a real name (not truncated pubkey) and it's different
      if (displayName && 
          !displayName.includes('...') && 
          displayName !== 'Anonym' &&
          displayName !== user.displayName) {
        newMap.set(pubkey, {
          ...user,
          displayName
        });
        updated = true;
      }
    }
    
    // Only reassign Map if something actually changed (Svelte 5 reactivity)
    if (updated) {
      this.onlineUsers = newMap;
    }
  }

  /**
   * Get status summary
   */
  public getStatus() {
    return {
      tracking: !!this.currentBoardId,
      boardId: this.currentBoardId,
      onlineCount: this.userCount,
      users: this.userList
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const presenceStore = new PresenceStore();
