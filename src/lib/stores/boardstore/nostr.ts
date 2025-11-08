// src/lib/stores/boardstore/nostr.ts
// Nostr-Integration und Event-Publishing

import type { Board, Card } from '../../classes/BoardModel.js';
import { boardToNostrEvent, cardToNostrEvent, createCommentEvent, createDeletionEvent } from '../../utils/nostrEvents.js';
import { getTargetRelays } from '../../utils/relaySelection.js';
import { getSyncManager } from '../syncManager.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';
import { authStore } from '../authStore.svelte.js';
import { BoardStorage } from './storage.js';
import type NDK from '@nostr-dev-kit/ndk';

export class NostrIntegration {
    private ndk?: NDK;
    private boardSubscription: any | null = null;

    /**
     * Initialisiert Nostr Integration
     */
    public async initialize(ndk: NDK, onBoardLoad?: () => Promise<void>): Promise<void> {
        this.ndk = ndk;
        console.log('[BoardStore] ✅ Nostr initialized - SyncManager ready');

        // Wenn bereits ein User authentifiziert ist, sofort Boards laden
        try {
            const hasPubkey =
                typeof authStore?.getPubkeySafe === 'function'
                    ? !!authStore.getPubkeySafe()
                    : typeof authStore?.getPubkey === 'function'
                        ? !!authStore.getPubkey()
                        : false;

            if (hasPubkey && onBoardLoad) {
                console.log('[BoardStore] 🛰️ User detected on Nostr init - loading boards from Nostr...');
                await onBoardLoad();
            } else {
                console.log('[BoardStore] ℹ️ No authenticated user on Nostr init - skipping initial Nostr board loading');
            }
        } catch (error) {
            console.warn('[BoardStore] ⚠️ Error during initial Nostr loading:', error);
        }
    }

    /**
     * Lädt Boards des aktuellen Users aus Nostr
     */
    public async loadBoardsFromNostr(
        boardIds: string[],
        currentBoard: Board,
        onBoardsLoaded: (boardIds: string[], shouldSwitchBoard: boolean, newBoard?: Board) => void
    ): Promise<void> {
        if (!this.ndk) {
            console.log('[BoardStore] ℹ️ Nostr not initialized, skip loadBoardsFromNostr');
            return;
        }

        const pubkey =
            (typeof authStore?.getPubkeySafe === 'function' && authStore.getPubkeySafe()) ||
            (typeof authStore?.getPubkey === 'function' && authStore.getPubkey()) ||
            null;

        if (!pubkey) {
            console.log('[BoardStore] ℹ️ No pubkey available, skipping Nostr board loading');
            return;
        }

        try {
            console.log('[BoardStore] 🛰️ Fetching boards from Nostr for pubkey:', pubkey);

            // 1. Fetch Board Events (Kind 30301)
            const boardFilter = {
                kinds: [30301],
                authors: [pubkey]
            };

            const boardEvents = await this.ndk.fetchEvents(boardFilter as any);

            if (!boardEvents || boardEvents.size === 0) {
                console.log('[BoardStore] ℹ️ No boards found on Nostr for current user');
                return;
            }

            // 2. Fetch Deletion Events (Kind 5) für diesen User
            const deletionFilter = {
                kinds: [5],
                authors: [pubkey]
            };

            const deletionEvents = await this.ndk.fetchEvents(deletionFilter as any);

            // 3. Erstelle Set mit gelöschten Board-IDs
            const deletedBoardIds = new Set<string>();
            
            // 3a. Lade lokal gespeicherte Deletions (Fallback wenn Relay Kind 5 nicht unterstützt)
            if (typeof window !== 'undefined') {
                const localDeletions = localStorage.getItem('nostr-deleted-boards');
                if (localDeletions) {
                    try {
                        const parsed = JSON.parse(localDeletions);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(id => deletedBoardIds.add(id));
                            console.log('[BoardStore] 📋 Loaded', deletedBoardIds.size, 'locally tracked deletions');
                        }
                    } catch (e) {
                        console.warn('[BoardStore] Failed to parse local deletions:', e);
                    }
                }
            }
            
            // 3b. Füge Deletions vom Relay hinzu (wenn vorhanden)
            if (deletionEvents && deletionEvents.size > 0) {
                console.log('[BoardStore] 🗑️ Found', deletionEvents.size, 'deletion events on relay');
                for (const delEvent of deletionEvents) {
                    // Delete Event hat Tag: ['e', '30301:pubkey:board-id']
                    const eTags = delEvent.tags.filter(t => t[0] === 'e');
                    for (const eTag of eTags) {
                        const eventId = eTag[1]; // z.B. "30301:pubkey:board-xxx"
                        if (eventId && eventId.startsWith('30301:')) {
                            // Extrahiere board-id (alles nach dem zweiten ":")
                            const parts = eventId.split(':');
                            if (parts.length >= 3) {
                                const boardId = parts.slice(2).join(':'); // board-xxx
                                deletedBoardIds.add(boardId);
                                console.log('[BoardStore] 🗑️ Found deleted board:', boardId);
                            }
                        }
                    }
                }
            }

            const loadedBoardIds = [...boardIds];

            for (const event of boardEvents) {
                if (event.kind !== 30301) continue;

                try {
                    const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
                    const boardProps = nostrEventToBoard(event);
                    const board = new (await import('../../classes/BoardModel.js')).Board(boardProps);

                    // 4. Skip wenn Board gelöscht wurde
                    if (deletedBoardIds.has(board.id)) {
                        console.log('[BoardStore] ⏩ Skipping deleted board:', board.id);
                        continue;
                    }

                    const storageKey = `kanban-${board.id}`;
                    const existingRaw = typeof window !== 'undefined'
                        ? window.localStorage.getItem(storageKey)
                        : null;

                    let acceptRemote = true;
                    if (existingRaw) {
                        try {
                            const existing = JSON.parse(existingRaw);
                            const localTs = existing.updatedAt
                                ? new Date(existing.updatedAt).getTime()
                                : existing.createdAt
                                    ? new Date(existing.createdAt).getTime()
                                    : 0;
                            const remoteTs = event.created_at ? event.created_at * 1000 : Date.now();
                            if (localTs && localTs > remoteTs) {
                                acceptRemote = false;
                            }
                        } catch {
                            acceptRemote = true;
                        }
                    }

                    if (!acceptRemote) {
                        console.log(`[BoardStore] ↩️ Keep newer local board for ${board.id}, skip remote version`);
                        if (!loadedBoardIds.includes(board.id)) {
                            loadedBoardIds.push(board.id);
                        }
                        continue;
                    }

                    if (typeof window !== 'undefined') {
                        const context = board.getContextData(true) as any;
                        const remoteCreated = event.created_at
                            ? new Date(event.created_at * 1000).toISOString()
                            : context.createdAt || new Date().toISOString();
                        context.createdAt = context.createdAt || remoteCreated;
                        context.updatedAt = context.updatedAt || remoteCreated;

                        window.localStorage.setItem(storageKey, JSON.stringify(context));
                        console.log('[BoardStore] 💾 Stored Nostr board from remote:', storageKey);
                    }

                    if (!loadedBoardIds.includes(board.id)) {
                        loadedBoardIds.push(board.id);
                    }
                } catch (err) {
                    console.error('[BoardStore] ❌ Failed to import Nostr board event:', err);
                }
            }

            // MRU-Heuristik: Neuestes Board wählen wenn aktuelles Board anonym ist
            if (typeof window !== 'undefined') {
                const currentIsAnonymous =
                    !currentBoard.author ||
                    currentBoard.author === 'anonymous';

                if (currentIsAnonymous && loadedBoardIds.length > 0) {
                    let bestId: string | null = null;
                    let bestTs = 0;

                    for (const id of loadedBoardIds) {
                        const raw = window.localStorage.getItem(`kanban-${id}`);
                        if (!raw) continue;
                        try {
                            const data = JSON.parse(raw);
                            const ts = data.updatedAt
                                ? new Date(data.updatedAt).getTime()
                                : data.createdAt
                                    ? new Date(data.createdAt).getTime()
                                    : 0;
                            if (ts > bestTs) {
                                bestTs = ts;
                                bestId = id;
                            }
                        } catch {
                            // ignore
                        }
                    }

                    if (bestId) {
                        const raw = window.localStorage.getItem(`kanban-${bestId}`);
                        if (raw) {
                            try {
                                const data = JSON.parse(raw);
                                const newBoard = BoardStorage.reconstructBoard(data);
                                onBoardsLoaded(loadedBoardIds, true, newBoard);
                                console.log('[BoardStore] ✅ Switched active board to newest Nostr board:', bestId);
                                return;
                            } catch (err) {
                                console.warn('[BoardStore] ⚠️ Failed to switch active board to Nostr board:', err);
                            }
                        }
                    }
                }
            }

            onBoardsLoaded(loadedBoardIds, false);
        } catch (error) {
            console.error('[BoardStore] ❌ Error while loading boards from Nostr:', error);
        }
    }

    /**
     * Subscribed zu Board- und Card-Updates
     * 
     * ⚠️ WICHTIG: Für kollaborative Boards - empfange Events von ALLEN Teilnehmern!
     * - Board-Events (Kind 30301): Von author + maintainers
     * - Card-Events (Kind 30302): Alle mit #a-Tag auf dieses Board
     */
    public subscribeToUpdates(
        onBoardEvent: (event: any) => Promise<void>,
        onCardEvent: (event: any) => Promise<void>
    ): void {
        if (!this.ndk) {
            console.log('[BoardStore] ℹ️ Nostr not initialized, skip subscribe');
            return;
        }

        const pubkey =
            (typeof authStore?.getPubkeySafe === 'function' && authStore.getPubkeySafe()) ||
            (typeof authStore?.getPubkey === 'function' && authStore.getPubkey()) ||
            null;

        if (!pubkey) {
            console.log('[BoardStore] ℹ️ No pubkey available, skip board subscription');
            return;
        }

        if (this.boardSubscription && typeof this.boardSubscription.stop === 'function') {
            try {
                this.boardSubscription.stop();
            } catch {
                // ignore
            }
        }

        console.log('[BoardStore] 🛰️ Subscribing to board AND card updates (collaborative mode)');

        // ⚠️ Filtere nach Boards/Cards die der User erstellt hat
        // Für Collaboration: Später könnten wir auch nach #p-tags (maintainers) filtern
        const sub = this.ndk.subscribe(
            {
                kinds: [30301, 30302] as number[],
                authors: [pubkey] // Boards und Cards die dieser User erstellt hat
            } as any,
            { closeOnEose: false }
        );

        sub.on('event', async (event: any) => {
            if (event.kind === 30301) {
                // Board-Event: Client-seitige Filterung in Handler
                await onBoardEvent(event);
            } else if (event.kind === 30302) {
                // Card-Event: Client-seitige Filterung (boardRef-Check)
                await onCardEvent(event);
            }
        });

        this.boardSubscription = sub;
    }

    /**
     * Publiziert Board zu Nostr
     */
    public async publishBoard(board: Board): Promise<void> {
        if (!this.ndk) return;

        try {
            const event = boardToNostrEvent(board, this.ndk);
            const publishState = board.publishState || 'draft';
            const normalizedState = (publishState === 'archived' ? 'private' : publishState) as 'published' | 'draft' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                draftPublishingMode: settingsStore.settings.draftPublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                event, 
                'board', 
                'normal',
                normalizedState,
                targetRelays
            );
        } catch (error) {
            console.error(`❌ Error publishing board:`, error);
        }
    }

    /**
     * Publiziert Card zu Nostr
     * 
     * ⚠️ WICHTIG: Sendet Column-ID UND Name (laut Kanban-NIP)
     * - s-Tag: Column-ID (PRIMARY)
     * - col_label-Tag: Column-Name (SECONDARY)
     * - rank: Position in der Spalte
     */
    public async publishCard(board: Board, cardId: string): Promise<void> {
        if (!this.ndk) return;

        try {
            const result = board.findCardAndColumn(cardId);
            if (!result) {
                console.warn(`⚠️ Card ${cardId} not found for publishing`);
                return;
            }

            const { card, column } = result;
            
            // ⚠️ FIX: rank ist die Position der Karte IN der Spalte (nicht columnIndex!)
            const rank = column.cards.indexOf(card);
            
            // ⚠️ FIX: boardRef muss Kind 30301 sein (nicht 30302!)
            const boardRef = `30301:${board.author || 'unknown'}:${board.id}`;

            // ⚠️ GEÄNDERT: Jetzt columnId UND columnName übergeben
            const event = cardToNostrEvent(
                card, 
                column.id,      // ⚠️ Column-ID (nicht Name!)
                column.name,    // ⚠️ Column-Name (für Display)
                rank,           // ⚠️ Position in Spalte
                boardRef, 
                this.ndk
            );
            
            const publishState = card.publishState || 'draft';
            const normalizedState = (publishState === 'archived' ? 'private' : publishState) as 'published' | 'draft' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                draftPublishingMode: settingsStore.settings.draftPublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                event, 
                'card', 
                'normal',
                normalizedState,
                targetRelays
            );

            console.log(`✅ Card ${cardId} queued for publishing`);
        } catch (error) {
            console.error(`❌ Error publishing card ${cardId}:`, error);
        }
    }

    /**
     * Publiziert Comment zu Nostr
     */
    public async publishComment(board: Board, cardId: string, commentId: string): Promise<void> {
        if (!this.ndk) return;

        try {
            const result = board.findCardAndColumn(cardId);
            if (!result) {
                console.warn(`⚠️ Card ${cardId} not found for comment publishing`);
                return;
            }

            const { card } = result;
            const comment = card.comments?.find(c => c.id === commentId);
            if (!comment) {
                console.warn(`⚠️ Comment ${commentId} not found`);
                return;
            }

            const cardRef = `30302:${card.author || 'unknown'}:${cardId}`;
            const event = createCommentEvent(comment.text, cardRef, card.id || '', this.ndk);
            const publishState = card.publishState || 'draft';
            const normalizedState = (publishState === 'archived' ? 'private' : publishState) as 'published' | 'draft' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                draftPublishingMode: settingsStore.settings.draftPublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                event, 
                'comment', 
                'normal',
                normalizedState,
                targetRelays
            );

            console.log(`✅ Comment ${commentId} queued for publishing`);
        } catch (error) {
            console.error(`❌ Error publishing comment:`, error);
        }
    }

    /**
     * Löscht ein Board auf Nostr durch Senden eines NIP-09 Deletion Events
     * @param board - Board das gelöscht werden soll
     */
    public async deleteBoard(board: Board): Promise<void> {
        if (!this.ndk) {
            console.warn('[NostrIntegration] deleteBoard: NDK nicht initialisiert');
            return;
        }

        try {
            // 1. Bestimme die Event-ID des Board-Events
            // Format für addressable events: "30301:<author-pubkey>:<d-tag>"
            const boardEventId = `30301:${board.author || 'unknown'}:${board.id}`;
            
            console.log(`[NostrIntegration] 🗑️ Deleting board on Nostr: ${board.name} (${boardEventId})`);

            // 2. Erstelle Deletion Event (Kind 5)
            const deletionEvent = createDeletionEvent(
                boardEventId,
                `Board "${board.name}" deleted`,
                this.ndk
            );

            // 3. Publiziere auf ALLEN Relays (sowohl public als private)
            // Grund: Board könnte auf beiden Relay-Sets existieren
            const allRelays = [
                ...settingsStore.settings.relaysPublic,
                ...settingsStore.settings.relaysPrivate
            ].filter((v, i, a) => a.indexOf(v) === i); // Deduplizieren

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                deletionEvent,
                'board',
                'high', // Hohe Priorität für Löschungen
                'published', // Lösch-Events immer auf published relays
                allRelays
            );

            // 4. Speichere Board-ID lokal als gelöscht (Fallback wenn Relay Kind 5 nicht unterstützt)
            if (typeof window !== 'undefined') {
                const localDeletions = localStorage.getItem('nostr-deleted-boards');
                let deletedIds: string[] = [];
                if (localDeletions) {
                    try {
                        deletedIds = JSON.parse(localDeletions);
                        if (!Array.isArray(deletedIds)) deletedIds = [];
                    } catch (e) {
                        deletedIds = [];
                    }
                }
                if (!deletedIds.includes(board.id)) {
                    deletedIds.push(board.id);
                    localStorage.setItem('nostr-deleted-boards', JSON.stringify(deletedIds));
                    console.log('[NostrIntegration] 📋 Board marked as deleted locally');
                }
            }

            console.log(`✅ Board deletion event queued for ${allRelays.length} relay(s)`);
        } catch (error) {
            console.error(`❌ Error deleting board on Nostr:`, error);
        }
    }

    /**
     * Löscht eine Card auf Nostr durch Senden eines NIP-09 Deletion Events
     * @param card - Card die gelöscht werden soll
     */
    public async deleteCard(card: Card): Promise<void> {
        if (!this.ndk) {
            console.warn('[NostrIntegration] deleteCard: NDK nicht initialisiert');
            return;
        }

        try {
            // 1. Bestimme die Event-ID des Card-Events
            // Format für addressable events: "30302:<author-pubkey>:<d-tag>"
            const cardEventId = `30302:${card.author || 'unknown'}:${card.id}`;
            
            console.log(`[NostrIntegration] 🗑️ Deleting card on Nostr: ${card.heading} (${cardEventId})`);

            // 2. Erstelle Deletion Event (Kind 5)
            const deletionEvent = createDeletionEvent(
                cardEventId,
                `Card "${card.heading}" deleted`,
                this.ndk
            );

            // 3. Bestimme Target-Relays basierend auf Card's publishState
            const publishState = card.publishState || 'draft';
            const normalizedState = (publishState === 'archived' ? 'private' : publishState) as 'published' | 'draft' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                draftPublishingMode: settingsStore.settings.draftPublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                deletionEvent,
                'card',
                'high', // Hohe Priorität für Löschungen
                normalizedState,
                targetRelays
            );

            console.log(`✅ Card deletion event queued for ${targetRelays.length} relay(s)`);
        } catch (error) {
            console.error(`❌ Error deleting card on Nostr:`, error);
        }
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        if (this.boardSubscription && typeof this.boardSubscription.stop === 'function') {
            try {
                this.boardSubscription.stop();
            } catch {
                // ignore
            }
        }
    }
}
