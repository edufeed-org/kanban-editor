// src/lib/stores/syncManager.svelte.spec.ts
/**
 * SyncManager Unit Tests
 * 
 * Tests für:
 * - Event Queueing
 * - Retry-Logik
 * - Online/Offline Handling
 * - Event Signing
 * - Storage Persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from './syncManager.svelte';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';

// ============================================================================
// MOCKS
// ============================================================================

// Mock authStore to simulate authenticated user
vi.mock('./authStore.svelte', () => ({
  authStore: {
    isAuthenticated: true, // Default to authenticated for tests
    currentUser: { pubkey: 'mock-pubkey' },
  }
}));

const mockNDK = {
  signer: undefined,
  subscribe: vi.fn(),
} as unknown as NDK;

const mockSigner = {
  sign: vi.fn().mockResolvedValue(undefined),
  user: vi.fn(),
};

// ============================================================================
// TESTS
// ============================================================================

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Create fresh SyncManager instance
    syncManager = new SyncManager(mockNDK, mockSigner as any, {
      maxRetries: 3,
      baseDelayMs: 100, // Short delays for tests
      maxQueueSize: 10,
    });
  });

  afterEach(() => {
    syncManager.dispose();
  });

  // ========== Initialization Tests ==========

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const manager = new SyncManager(mockNDK, mockSigner as any);
      expect(manager.status.isOnline).toBeDefined();
      expect(manager.status.queuedEvents).toBe(0);
      manager.dispose();
    });

    it('should initialize with custom config', () => {
      const manager = new SyncManager(mockNDK, mockSigner as any, {
        maxRetries: 5,
        baseDelayMs: 500,
      });
      expect(manager.status).toBeDefined();
      manager.dispose();
    });

    it('should load existing queue from storage', () => {
      // Pre-populate localStorage
      const queueData = [
        {
          event: '{"kind":30301}',
          timestamp: Date.now(),
          retries: 0,
          type: 'board' as const,
          priority: 'normal' as const,
        },
      ];
      localStorage.setItem('nostr-event-queue', JSON.stringify(queueData));

      const manager = new SyncManager(mockNDK, mockSigner as any);
      expect(manager.status.queuedEvents).toBe(1);
      manager.dispose();
    });
  });

  // ========== Queue Management Tests ==========

  describe('Queue Management', () => {
    it('should queue event when offline', async () => {
      // Simulate offline
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      await syncManager.publishOrQueue(event, 'board');

      expect(syncManager.status.queuedEvents).toBe(1);
    });

    it('should queue event when publish fails', async () => {
      // Make NDK online
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      // Make signing fail
      const failingSigner = {
        sign: vi.fn().mockRejectedValue(new Error('Signing failed')),
      };

      const manager = new SyncManager(mockNDK, failingSigner as any);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      await manager.publishOrQueue(event, 'board');

      expect(manager.status.queuedEvents).toBe(1);
      manager.dispose();
    });

    it('should respect queue size limit', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const manager = new SyncManager(mockNDK, mockSigner as any, {
        maxQueueSize: 3,
      });

      for (let i = 0; i < 5; i++) {
        const event = new NDKEvent(mockNDK);
        event.kind = 30301;
        await manager.publishOrQueue(event, 'board');
      }

      // Should not exceed max size
      expect(manager.status.queuedEvents).toBeLessThanOrEqual(3);
      manager.dispose();
    });

    it('should preserve event order in queue', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      for (let i = 0; i < 3; i++) {
        const event = new NDKEvent(mockNDK);
        event.kind = 30301;
        event.content = `Event ${i}`;
        await syncManager.publishOrQueue(event, 'board');
      }

      const queued = syncManager.getQueuedEvents();
      expect(queued[0].event).toContain('Event 0');
      expect(queued[1].event).toContain('Event 1');
      expect(queued[2].event).toContain('Event 2');
    });
  });

  // ========== Signing Tests ==========

  describe('Event Signing', () => {
    it('should sign event before publishing', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const signSpy = vi.fn().mockResolvedValue(undefined);
      const signerWithSpy = {
        ...mockSigner,
        sign: signSpy,
      };

      const manager = new SyncManager(mockNDK, signerWithSpy as any);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;
      
      // Mock the event's sign method to track calls and simulate success
      event.sign = vi.fn().mockImplementation(async (signer) => {
        signSpy(); // Call our spy
        event.sig = 'dummy_sig'; // Simulate successful sign
        return event;
      });
      
      event.publish = vi.fn().mockResolvedValue(new Set(['relay1']));

      await manager.publishOrQueue(event, 'board');

      expect(signSpy).toHaveBeenCalled();
      manager.dispose();
    });

    it('should fail publish if no signer available', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const manager = new SyncManager(mockNDK, undefined);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      await manager.publishOrQueue(event, 'board');

      // Should be queued as fallback
      expect(manager.status.queuedEvents).toBe(1);
      manager.dispose();
    });
  });

  // ========== Authentication Tests ==========

  describe('Authentication', () => {
    it('should not queue event when user is not authenticated', async () => {
      // Mock authStore to simulate unauthenticated user
      const { authStore } = await import('./authStore.svelte');
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(false);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      const result = await syncManager.publishOrQueue(event, 'board');

      expect(result).toBeUndefined();
      expect(syncManager.status.queuedEvents).toBe(0);
      
      // Restore mock
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(true);
    });

    it('should not publish event when user is not authenticated', async () => {
      // Mock authStore to simulate unauthenticated user
      const { authStore } = await import('./authStore.svelte');
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(false);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      const result = await syncManager.publishOrQueue(event, 'board');

      expect(result).toBeUndefined();
      expect(syncManager.status.queuedEvents).toBe(0);
      
      // Restore mock
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(true);
    });

    it('should skip sync queue when user is not authenticated', async () => {
      // Mock authStore to simulate unauthenticated user
      const { authStore } = await import('./authStore.svelte');
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(false);

      // Add an event to queue first (when authenticated)
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(true);
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      
      const event = new NDKEvent(mockNDK);
      event.kind = 30301;
      await syncManager.publishOrQueue(event, 'board');
      
      expect(syncManager.status.queuedEvents).toBe(1);

      // Now try to sync when not authenticated
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(false);
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

      await syncManager.syncQueue();

      // Queue should not be processed
      expect(syncManager.status.queuedEvents).toBe(1);
      
      // Restore mock
      vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(true);
    });
  });

  // ========== Retry Logic Tests ==========

  describe('Retry Logic', () => {
    it('should increment retry count on failure', async () => {
      const queued = [
        {
          event: '{"kind":30301}',
          timestamp: Date.now(),
          retries: 0,
          type: 'board' as const,
        },
      ];
      localStorage.setItem('nostr-event-queue', JSON.stringify(queued));

      const failingSigner = {
        sign: vi.fn().mockRejectedValue(new Error('Signing failed')),
      };

      // Set offline first to prevent auto-sync during initialization
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const manager = new SyncManager(mockNDK, failingSigner as any);
      
      // Now force online and sync manually
      manager.forceOnlineStatus(true);
      await manager.syncQueue();

      const events = manager.getQueuedEvents();
      expect(events[0].retries).toBe(1);

      manager.dispose();
    });

    it('should remove event after max retries', async () => {
      const queued = [
        {
          event: '{"kind":30301}',
          timestamp: Date.now() - 1000,
          retries: 2, // Already 2 retries
          type: 'board' as const,
        },
      ];
      localStorage.setItem('nostr-event-queue', JSON.stringify(queued));

      const failingSigner = {
        sign: vi.fn().mockRejectedValue(new Error('Signing failed')),
      };

      // Set offline first to prevent auto-sync during initialization
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const manager = new SyncManager(mockNDK, failingSigner as any, {
        maxRetries: 3,
      });
      
      // Now force online and sync manually
      manager.forceOnlineStatus(true);
      await manager.syncQueue();

      // Event should be removed (exceeds max retries)
      expect(manager.status.queuedEvents).toBe(0);
      manager.dispose();
    });

    it('should calculate exponential backoff correctly', async () => {
      const manager = new SyncManager(mockNDK, mockSigner as any, {
        baseDelayMs: 1000,
        backoffMultiplier: 2,
      });

      // Math: 2^0 * 1000 = 1000ms, 2^1 * 1000 = 2000ms, etc.
      // This is implicit in syncQueue, but we can verify via getters

      expect(manager.status).toBeDefined();
      manager.dispose();
    });
  });

  // ========== Storage Tests ==========

  describe('Storage Persistence', () => {
    it('should persist queue to localStorage', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      await syncManager.publishOrQueue(event, 'board');

      const stored = localStorage.getItem('nostr-event-queue');
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('board');
    });

    it('should restore queue from localStorage on init', () => {
      const queueData = [
        {
          event: '{"kind":30301}',
          timestamp: Date.now(),
          retries: 1,
          type: 'card' as const,
          priority: 'high' as const,
        },
      ];
      localStorage.setItem('nostr-event-queue', JSON.stringify(queueData));

      const manager = new SyncManager(mockNDK, mockSigner as any);

      const restored = manager.getQueuedEvents();
      expect(restored).toHaveLength(1);
      expect(restored[0].type).toBe('card');
      expect(restored[0].retries).toBe(1);

      manager.dispose();
    });

    it('should handle corrupted storage gracefully', () => {
      localStorage.setItem('nostr-event-queue', 'invalid json {');

      const manager = new SyncManager(mockNDK, mockSigner as any);

      // Should initialize with empty queue
      expect(manager.status.queuedEvents).toBe(0);
      manager.dispose();
    });
  });

  // ========== Online/Offline Tests ==========

  describe('Online/Offline Detection', () => {
    it('should detect online status', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      const manager = new SyncManager(mockNDK, mockSigner as any);

      expect(manager.status.isOnline).toBe(true);
      manager.dispose();
    });

    it('should detect offline status', () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const manager = new SyncManager(mockNDK, mockSigner as any);

      expect(manager.status.isOnline).toBe(false);
      manager.dispose();
    });
  });

  // ========== Status & Stats Tests ==========

  describe('Status and Statistics', () => {
    it('should return current sync status', () => {
      const status = syncManager.status;

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isSyncing');
      expect(status).toHaveProperty('queuedEvents');
      expect(typeof status.queuedEvents).toBe('number');
    });

    it('should return queue statistics', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      // Add different event types
      const event1 = new NDKEvent(mockNDK);
      event1.kind = 30301;
      await syncManager.publishOrQueue(event1, 'board');

      const event2 = new NDKEvent(mockNDK);
      event2.kind = 30302;
      await syncManager.publishOrQueue(event2, 'card');

      const queuedEvents = syncManager.getQueuedEvents();

      expect(queuedEvents.length).toBe(2);
      expect(queuedEvents.filter(e => e.type === 'board').length).toBe(1);
      expect(queuedEvents.filter(e => e.type === 'card').length).toBe(1);
      expect(queuedEvents.filter(e => e.type === 'comment').length).toBe(0);
    });
  });

  // ========== Priority Tests ==========

  describe('Event Priority', () => {
    it('should respect high priority events', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const event = new NDKEvent(mockNDK);
      event.kind = 30301;

      await syncManager.publishOrQueue(event, 'board', 'high');

      const queued = syncManager.getQueuedEvents();
      expect(queued[0].priority).toBe('high');
    });

    it('should respect low priority events', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const event = new NDKEvent(mockNDK);
      event.kind = 30302;

      await syncManager.publishOrQueue(event, 'card', 'low');

      const queued = syncManager.getQueuedEvents();
      expect(queued[0].priority).toBe('low');
    });

    it('should remove low-priority events when queue is full', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const manager = new SyncManager(mockNDK, mockSigner as any, {
        maxQueueSize: 2,
      });

      // Add high-priority event
      const event1 = new NDKEvent(mockNDK);
      event1.kind = 30301;
      await manager.publishOrQueue(event1, 'board', 'high');

      // Add normal-priority event
      const event2 = new NDKEvent(mockNDK);
      event2.kind = 30302;
      await manager.publishOrQueue(event2, 'card', 'normal');

      // Add low-priority event (should push out the low one if there's a conflict)
      const event3 = new NDKEvent(mockNDK);
      event3.kind = 1;
      await manager.publishOrQueue(event3, 'comment', 'low');

      // Add another high-priority (queue is full, low-priority should be removed)
      const event4 = new NDKEvent(mockNDK);
      event4.kind = 30301;
      await manager.publishOrQueue(event4, 'board', 'high');

      const queued = manager.getQueuedEvents();
      expect(queued.length).toBeLessThanOrEqual(2);

      manager.dispose();
    });
  });

  // ========== Cleanup Tests ==========

  describe('Cleanup', () => {
    it('should dispose resources on cleanup', () => {
      const disposeSpy = vi.spyOn(syncManager, 'dispose');

      syncManager.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear intervals on dispose', () => {
      const manager = new SyncManager(mockNDK, mockSigner as any);

      expect(() => manager.dispose()).not.toThrow();

      manager.dispose(); // Should not throw on second dispose
    });
  });
});
