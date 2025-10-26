/**
 * Soft Lock Manager: "Now Editing" Ephemeral Events
 * 
 * KRITISCH: Datei MUSS .svelte.ts sein (nutzt $state Rune)
 * 
 * Wenn Anna eine Karte bearbeitet, veröffentlicht ihr Client ein Ephemeral Event (Kind 20001).
 * Paul sieht diese Warnung und wird gewarnt, dass Anna gerade editiert.
 */

import type NDK from '@nostr-dev-kit/ndk';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { EditingSession } from './mergeEngine.js';

export interface SoftLock {
  cardId: string;
  user: string;
  clientId: string;
  startedAt: Date;
  expiresAt: Date;
}

export class SoftLockManager {
  private locks = $state<Map<string, SoftLock>>(new Map());
  private refreshIntervals = new Map<string, number>();

  constructor(private ndk: NDK) {
    this.subscribeToLocks();
  }

  /**
   * Publiziere "Now Editing" Event wenn User eine Karte öffnet
   */
  async publishLock(
    session: EditingSession,
    userName: string
  ): Promise<void> {
    const event = new NDKEvent(this.ndk);
    event.kind = 20001; // Ephemeral
    event.tags = [
      ['a', `30302:${session.baseEventId}:${session.cardId}`],
      ['d', `editing-${session.cardId}`],
      ['expires', Math.floor((Date.now() + 300000) / 1000).toString()] // 5 Min
    ];
    event.content = JSON.stringify({
      user: userName,
      clientId: session.clientId,
      startedAt: new Date().toISOString()
    });

    try {
      const relays = await event.publish();
      console.log(`🔒 Published soft lock to ${relays.size} relays`);

      // Refresh Lock alle 4 Min (bevor es expiret)
      this.scheduleRefresh(session.cardId, session, userName);
    } catch (error) {
      console.error('Failed to publish soft lock:', error);
    }
  }

  /**
   * Lösche Lock wenn User Karte schließt
   */
  async releaseLock(cardId: string): Promise<void> {
    // Refresh-Interval clearen
    const interval = this.refreshIntervals.get(cardId);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(cardId);
    }

    // Kind 5 Event senden zum Löschen (optional, da Ephemeral ohnehin expiret)
    this.locks.delete(cardId);
  }

  /**
   * Abonniere alle Soft-Locks für aktuelle Card-ID
   */
  private subscribeToLocks(): void {
    // Subscribe zu Kind 20001 Events (als number)
    const subscription = this.ndk.subscribe(
      { kinds: [20001 as any] }, // Ephemeral event kind
      { closeOnEose: false }
    );

    subscription.on('event', (event: NDKEvent) => {
      const content = JSON.parse(event.content || '{}');
      const cardRef = event.tags.find(t => t[0] === 'a')?.[1] || '';
      const cardId = cardRef.split(':').pop() || '';

      if (!cardId) return;

      const expiresTag = event.tags.find(t => t[0] === 'expires');
      const expiresAt = new Date((parseInt(expiresTag?.[1] || '0') || 0) * 1000);

      this.locks.set(cardId, {
        cardId,
        user: content.user,
        clientId: content.clientId,
        startedAt: new Date(content.startedAt),
        expiresAt
      });

      // Auto-cleanup wenn expiret
      setTimeout(() => {
        this.locks.delete(cardId);
      }, expiresAt.getTime() - Date.now());
    });
  }

  /**
   * Refreshe Lock: Neues Event mit updated TTL
   */
  private scheduleRefresh(
    cardId: string,
    session: EditingSession,
    userName: string
  ): void {
    const interval = setInterval(() => {
      this.publishLock(session, userName);
    }, 240000); // Alle 4 Min

    this.refreshIntervals.set(cardId, interval as any);
  }

  /**
   * Get Locks: Wer bearbeitet gerade welche Cards?
   */
  getLocks(): SoftLock[] {
    const now = new Date();
    return Array.from(this.locks.values()).filter(lock => lock.expiresAt > now);
  }

  /**
   * Check Lock: Wird eine bestimmte Card gerade bearbeitet?
   */
  getCardLock(cardId: string): SoftLock | null {
    const lock = this.locks.get(cardId);
    if (!lock) return null;

    // Check ob noch gültig
    if (lock.expiresAt < new Date()) {
      this.locks.delete(cardId);
      return null;
    }

    return lock;
  }
}

// Globale Singleton-Instanz (wird in Store initialisiert)
export let softLockManager: SoftLockManager | null = null;

export function initSoftLockManager(ndk: NDK): SoftLockManager {
  softLockManager = new SoftLockManager(ndk);
  return softLockManager;
}
