// src/lib/stores/boardstore/nostr.ts
// Nostr-Integration und Event-Publishing

import type { Board, Card, Comment } from '../../classes/BoardModel.js';
import {
    cardToNostrEvent,
    createCommentEvent,
    createDeletionEvent,
    createColumnOrderPatchEvent,
    EVENT_KINDS
} from '../../utils/nostrEvents.js';
import { getTargetRelays } from '../../utils/relaySelection.js';
import { getSyncManager } from '../syncManager.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';
import { BoardStorage } from './storage.js';
import { getCurrentPubkeyOrNull, hasCurrentPubkey } from './nostr/auth.js';
import { loadProcessedDeletions } from './nostr/deletionEventsCache.js';
import { unixSecondsToMs, unknownTimestampToMs } from './nostr/time.js';
import {
    loadComments as loadCommentsImpl,
    buildCardRef,
    stopAllCommentSubscriptions as stopAllCommentSubscriptionsImpl,
    subscribeToComments as subscribeToCommentsImpl
} from './nostr/comments.js';
import {
    publishBoard as publishBoardImpl,
    deleteBoard as deleteBoardImpl,
    deleteCard as deleteCardImpl,
    publishSnapshot as publishSnapshotImpl
} from './nostr/publish.js';
import { subscribeToUpdates as subscribeToUpdatesImpl } from './nostr/subscriptions.js';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { toast } from 'svelte-sonner';
import { isBoardTombstoned } from './deletedBoards.js';

export class NostrIntegration {
    private ndk?: NDK;
    private boardSubscription: any | null = null;
    private activeBoardSubscriptionKey: string | null = null;
    private commentSubscriptions = new Map<string, any>(); // cardId -> subscription

    // ⚡ NEU (v2.0): Event-Deduplication für Event-Driven Architecture
    private processedEvents = new Set<string>();
    
    // ⚡ NEU (v2.0): Deletion-Timestamp-Tracking für Out-of-Order Events
    private cardDeletionTimestamps = new Map<string, number>();
    private boardDeletionTimestamps = new Map<string, number>();

    private processedDeletionEvents = new Set<string>();

    private stopAllCommentSubscriptions(): void {
        stopAllCommentSubscriptionsImpl(this.commentSubscriptions as any);
    }

    /**
     * Initialisiert Nostr Integration
     */
    public async initialize(ndk: NDK, onBoardLoad?: () => Promise<void>): Promise<void> {
        this.ndk = ndk;

        this.processedDeletionEvents = loadProcessedDeletions();

        try {
            if (hasCurrentPubkey() && onBoardLoad) {
                await onBoardLoad();
            } else {
            }
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Error during initial Nostr loading:', error);
        }
    }

    /**
     * Gibt die NDK-Instanz zurück
     */
    public getNDK(): NDK | undefined {
        return this.ndk;
    }

    /**
     * Lädt Boards des aktuellen Users aus Nostr
     */
    public async loadBoardsFromNostr(
        currentBoard: Board,
        onBoardsLoaded: (boardIds: string[], shouldSwitchBoard: boolean, newBoard?: Board) => void
    ): Promise<void> {
        if (!this.ndk) {
            console.log('[NostrIntegration] ℹ️ Nostr not initialized, skip loadBoardsFromNostr');
            return;
        }

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey) {
            console.log('[NostrIntegration] ℹ️ No pubkey available, skipping Nostr board loading');
            return;
        }

        try {
            const startTime = Date.now();
            console.log('[NostrIntegration] 🛰️ Fetching boards from Nostr for pubkey:', pubkey);

            const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
            
            const boardFilter = {
                kinds: [30301],
                authors: [pubkey],
                since: ninetyDaysAgo // Nur Boards der letzten 90 Tage
            };

            const boardEvents = await this.ndk.fetchEvents(boardFilter as any);
            
            if (!boardEvents || boardEvents.size === 0) {
                console.log('[NostrIntegration] ℹ️ No boards found on Nostr for current user');
                return;
            }

            const loadedBoardIds: string[] = [];
        
            const relayBoardIds = new Set<string>();
            
            const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
            const { Board: BoardClass } = await import('../../classes/BoardModel.js');
            
            const boardProcessingPromises = Array.from(boardEvents).map(async (event) => {
                if (event.kind !== 30301) return null;

                try {
                    const deletedTag = event.tags.find((t: any) => t[0] === 'deleted' && t[1] === 'true');
                    if (deletedTag) {
                        return null;
                    }

                    const boardProps = nostrEventToBoard(event);
                    const board = new BoardClass(boardProps);

                    if (isBoardTombstoned(board.id)) {
                        return null;
                    }

                    relayBoardIds.add(board.id);

                    const storageKey = `kanban-${board.id}`;
                    const existingRaw = typeof window !== 'undefined'
                        ? window.localStorage.getItem(storageKey)
                        : null;

                    let acceptRemote = true;
                    if (existingRaw) {
                        try {
                            const existing = JSON.parse(existingRaw);
                            
                            // 🔥 FIX: Berücksichtige AUCH lastAccessedAt beim Timestamp-Vergleich!
                            const localTs = existing.lastAccessedAt
                                ? unknownTimestampToMs(existing.lastAccessedAt)
                                : existing.updatedAt
                                    ? unknownTimestampToMs(existing.updatedAt)
                                    : existing.createdAt
                                        ? unknownTimestampToMs(existing.createdAt)
                                        : 0;
                            
                            const remoteTs = event.created_at ? unixSecondsToMs(event.created_at) : Date.now();
                            if (localTs && localTs > remoteTs) {
                                acceptRemote = false;
                            }
                        } catch {
                            acceptRemote = true;
                        }
                    }

                    if (!acceptRemote) {
                        return { boardId: board.id, needsStorage: false };
                    }

                    const context = board.getContextData(true) as any;
                    const remoteCreated = event.created_at
                        ? new Date(unixSecondsToMs(event.created_at)).toISOString()
                        : context.createdAt || new Date().toISOString();
                    context.createdAt = context.createdAt || remoteCreated;
                    context.updatedAt = context.updatedAt || remoteCreated;

                    // 🔴 CRITICAL: Board-Events (30301) enthalten KEINE Cards.
                    // Beim Schreiben des Board-Kontexts darf der lokale Card-State NICHT überschrieben werden.
                    // → Wir übernehmen deshalb vorhandene Cards pro Column-ID aus dem lokalen Storage.
                    if (existingRaw) {
                        try {
                            const existing = JSON.parse(existingRaw);
                            const existingColumns = Array.isArray(existing?.columns) ? existing.columns : [];

                            const cardsByColumnId = new Map<string, any[]>();
                            for (const col of existingColumns) {
                                if (col?.id && Array.isArray(col.cards)) {
                                    cardsByColumnId.set(col.id, col.cards);
                                }
                            }

                            if (Array.isArray(context.columns)) {
                                context.columns = context.columns.map((col: any) => {
                                    const existingCards = cardsByColumnId.get(col?.id) ?? [];
                                    const hasIncomingCards = Array.isArray(col?.cards) && col.cards.length > 0;

                                    return {
                                        ...col,
                                        cards: hasIncomingCards ? col.cards : existingCards,
                                    };
                                });
                            }

                            // Best-effort: Preserve lastAccessedAt/flags if present locally
                            if (context.lastAccessedAt === undefined && existing?.lastAccessedAt !== undefined) {
                                context.lastAccessedAt = existing.lastAccessedAt;
                            }
                            if (context.hasUnseenChanges === undefined && existing?.hasUnseenChanges !== undefined) {
                                context.hasUnseenChanges = existing.hasUnseenChanges;
                            }
                        } catch {
                            // ignore merge errors; we prefer keeping remote metadata over failing the whole load
                        }
                    }

                    return { 
                        boardId: board.id, 
                        needsStorage: true, 
                        storageKey, 
                        context 
                    };
                } catch (err) {
                    console.error('[NostrIntegration] ❌ Failed to import Nostr board event:', err);
                    return null;
                }
            });
            
            // ⚡ Wait for all boards to be processed in parallel
            const processedBoards = await Promise.all(boardProcessingPromises);
            
            // ⚡ Batch localStorage operations
            if (typeof window !== 'undefined') {
                for (const result of processedBoards) {
                    if (!result) continue;
                    
                    loadedBoardIds.push(result.boardId);
                    
                    if (result.needsStorage && result.storageKey && result.context) {
                        // ✅ Anti-Resurrection: Double-check vor dem Write
                        if (!isBoardTombstoned(result.boardId)) {
                            window.localStorage.setItem(result.storageKey, JSON.stringify(result.context));
                        }
                    }
                }
            } else {
                for (const result of processedBoards) {
                    if (result) {
                        loadedBoardIds.push(result.boardId);
                    }
                }
            }
            

            // MRU-Heuristik: Neuestes Board wählen wenn aktuelles Board anonym ist
            const currentIsAnonymous = !currentBoard.author || currentBoard.author === 'anonymous';
            
            if (currentIsAnonymous && loadedBoardIds.length > 0 && typeof window !== 'undefined') {
                // ⚡ OPTIMIZATION: Parallele Verarbeitung für Timestamp-Vergleich
                const boardDataPromises = loadedBoardIds.map(async (id) => {
                    const raw = window.localStorage.getItem(`kanban-${id}`);
                    if (!raw) return null;
                    
                    try {
                        const data = JSON.parse(raw);
                        const ts = data.updatedAt
                            ? unknownTimestampToMs(data.updatedAt)
                            : data.createdAt
                                ? unknownTimestampToMs(data.createdAt)
                                : 0;
                        return { id, ts, data };
                    } catch {
                        return null;
                    }
                });
                
                const boardData = (await Promise.all(boardDataPromises)).filter(b => b !== null);
                
                if (boardData.length > 0) {
                    // Find board with highest timestamp
                    const best = boardData.reduce((prev, curr) => 
                        curr.ts > prev.ts ? curr : prev
                    );
                    
                    try {
                        const newBoard = BoardStorage.reconstructBoard(best.data);
                        onBoardsLoaded(loadedBoardIds, true, newBoard);
                        console.log('[NostrIntegration] ✅ Switched active board to newest Nostr board:', best.id);
                        return;
                    } catch (err) {
                        console.warn('[NostrIntegration] ⚠️ Failed to switch active board to Nostr board:', err);
                    }
                }
            }

            onBoardsLoaded(loadedBoardIds, false);
        } catch (error) {
            console.error('[NostrIntegration] ❌ Error while loading boards from Nostr:', error);
        }
    }

    /**
     * Lädt alle Cards für ein bestimmtes Board vom Relay
     * 
     * ⚠️ WICHTIG: Wird beim initialen Board-Load aufgerufen, um alle existierenden Cards zu laden
     */
    public async loadCardsForBoard(
        board: Board,
        onCardLoaded: (cardProps: any) => void
    ): Promise<void> {
        if (!this.ndk) {
            console.log('[NostrIntegration] ℹ️ Nostr not initialized, skip loadCardsForBoard');
            return;
        }

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey) {
            console.log('[NostrIntegration] ℹ️ No pubkey, skip loadCardsForBoard');
            return;
        }

        // Cards referenzieren Boards via `a`-Tag: `30301:<author>:<d>`.
        // In der Praxis kann (v.a. nach localStorage Reset / Shared-Board) die lokale `board.author`
        // temporär fehlen oder inkonsistent sein. Daher laden wir defensiv über beide Kandidaten:
        // - canonical owner (board.author)
        // - aktueller Nutzer (pubkey)
        const boardRefAuthors = Array.from(
            new Set([board.author, pubkey].filter((v): v is string => typeof v === 'string' && v.length > 0))
        );

        if (boardRefAuthors.length === 0) {
            console.log('[NostrIntegration] ℹ️ No boardRef authors available, skip loadCardsForBoard');
            return;
        }

        try {
            const boardRefs = boardRefAuthors.map((author) => `30301:${author}:${board.id}`);
            
            const cardFilter = {
                kinds: [30302],
				'#a': boardRefs
            };

            const cardEvents = await this.ndk.fetchEvents(cardFilter as any);

            if (!cardEvents || cardEvents.size === 0) {
                console.log('[NostrIntegration] ℹ️ No cards found on Nostr for board:', board.id);
                return;
            }

            console.log('[NostrIntegration] 🃏 Found', cardEvents.size, 'card(s) on relay for board:', board.name);

            // ⚡ RELAY FILTERT GELÖSCHTE CARDS: Keine lokale Deletion-Tracking mehr nötig!
            const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
            
            const cardProcessingPromises = Array.from(cardEvents).map(async (cardEvent) => {
                try {
                    const cardProps = nostrEventToCard(cardEvent);
                    
                    // Validiere dass Card zum Board gehört (akzeptiere beide möglichen boardRefs)
                    if (!cardProps.boardRef || !boardRefs.includes(cardProps.boardRef)) {
                        return null;
                    }
                    
                    return cardProps;
                } catch (err) {
                    console.error('[NostrIntegration] ❌ Failed to deserialize card event:', err);
                    return null;
                }
            });
            
            const processedCards = await Promise.all(cardProcessingPromises);
            
            let loadedCount = 0;
            for (const cardProps of processedCards) {
                if (cardProps) {
                    onCardLoaded(cardProps);
                    loadedCount++;
                }
            }

            console.log('[NostrIntegration] ✅ Finished loading cards for board:', board.name, `(${loadedCount} loaded in parallel)`);
        } catch (error) {
            console.error('[NostrIntegration] ❌ Error while loading cards from Nostr:', error);
        }
    }

    /**
     * Subscribed zu Board-, Card- und Deletion-Updates
     * 
     * ⚡ v2.0: Event-Driven Architecture mit Store-Referenz
     * 
     * ⚠️ WICHTIG: Für kollaborative Boards - empfange Events von ALLEN Teilnehmern!
     * - Board-Events (Kind 30301): Von author + maintainers
     * - Card-Events (Kind 30302): Alle mit #a-Tag auf dieses Board
     * - Deletion-Events (Kind 5): Alle gelöschten Boards/Cards
     */
    public subscribeToUpdates(
        currentBoard: Board,
        boardStore: any
    ): void {
        if (!this.ndk) {
            console.log('[NostrIntegration] ℹ️ Nostr not initialized, skip subscribe');
            return;
        }

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey) {
            console.log('[NostrIntegration] ℹ️ No pubkey available, skip board subscription');
            return;
        }

        // Idempotency-Guard: subscribeToNostrUpdates() wird an mehreren Stellen aufgerufen
        // (z.B. initializeNostr + loadBoard + UI). Wenn Board+User gleich bleiben, dürfen
        // wir NICHT jedes Mal dispose+resubscribe ausführen, sonst gibt es mehrfaches
        // ColumnOrderPatch subscribe + unnötige Catch-up Replays.
        const subscriptionKey = `${pubkey}|${currentBoard.id}|${currentBoard.author || ''}`;
        if (this.boardSubscription && this.activeBoardSubscriptionKey === subscriptionKey) {
            return;
        }

        // Stoppe ALLE existierenden Subscriptions (inkl. shared/follower/comment)
        this.dispose();

        this.boardSubscription = subscribeToUpdatesImpl({
            ndk: this.ndk,
            pubkey,
            currentBoard,
            boardStore,
            processedEvents: this.processedEvents,
            processedDeletionEvents: this.processedDeletionEvents,
            cardDeletionTimestamps: this.cardDeletionTimestamps,
            boardDeletionTimestamps: this.boardDeletionTimestamps,
        });

        this.activeBoardSubscriptionKey = subscriptionKey;
    }

    /**
     * Publiziert Board zu Nostr
     * @returns Event-ID des publizierten Events oder null bei Fehler
     */
    public async publishBoard(board: Board): Promise<string | null> {
        return publishBoardImpl(this.ndk, board);
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
            
            // ⚡ WICHTIG: Card erbt publishState vom Board!
            // Wenn Board öffentlich ist, soll Card auch auf öffentlichen Relays landen.
            // Card-eigener publishState wird nur als Fallback verwendet.
            const effectivePublishState = board.publishState === 'published' 
                ? 'published' 
                : (card.publishState || 'private');
            const normalizedState = effectivePublishState as 'published' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                privatePublishingMode: settingsStore.settings.privatePublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            const publishedEvent = await syncManager.publishOrQueue(
                event, 
                'card', 
                'normal',
                normalizedState,
                targetRelays
            );

            // ⚡ NEU: Event-ID erfassen nach erfolgreichem Publish!
            if (publishedEvent?.id) {
                card.eventId = publishedEvent.id;
                
                // ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
                const { BoardStorage } = await import('./storage.js');
                await BoardStorage.saveBoard(board);
            }
        } catch (error) {
            console.error(`❌ Error publishing card ${cardId}:`, error);
        }
    }

    /**
     * Publiziert ALLE Cards eines Boards auf öffentliche Relays.
     * 
     * ⚠️ WICHTIG: Wird aufgerufen wenn ein Board auf "published" gesetzt wird.
     * Cards müssen auf öffentlichen Relays sein, damit das Board für andere sichtbar ist.
     * 
     * @param board - Das Board dessen Cards republiziert werden sollen
     * @param targetRelays - Optional: Spezifische Relays (z.B. Edufeed-Relays)
     * @returns Promise<number> - Anzahl erfolgreich publizierter Cards
     */
    public async publishAllCardsToPublicRelays(
        board: Board, 
        targetRelays?: string[]
    ): Promise<number> {
        if (!this.ndk) {
            console.warn('[NostrIntegration] ⚠️ NDK not initialized - cannot publish cards');
            return 0;
        }

        // Wenn keine spezifischen Relays angegeben, nutze öffentliche Relays
        const relays = targetRelays ?? getTargetRelays({
            publishState: 'published',
            privatePublishingMode: settingsStore.settings.privatePublishingMode,
            relaysPublic: settingsStore.settings.relaysPublic,
            relaysPrivate: settingsStore.settings.relaysPrivate
        });

        if (relays.length === 0) {
            console.warn('[NostrIntegration] ⚠️ No public relays configured - cannot publish cards publicly');
            toast.warning('Keine öffentlichen Relays konfiguriert', {
                description: 'Cards können nicht veröffentlicht werden. Bitte konfiguriere öffentliche Relays in den Einstellungen.',
                duration: 5000
            });
            return 0;
        }

        console.log(`[NostrIntegration] 📤 Publishing all cards of board ${board.id} to public relays:`, relays);

        let successCount = 0;
        const syncManager = getSyncManager();

        for (const column of board.columns) {
            for (const card of column.cards) {
                try {
                    const rank = column.cards.indexOf(card);
                    const boardRef = `30301:${board.author || 'unknown'}:${board.id}`;

                    const event = cardToNostrEvent(
                        card,
                        column.id,
                        column.name,
                        rank,
                        boardRef,
                        this.ndk
                    );

                    const publishedEvent = await syncManager.publishOrQueue(
                        event,
                        'card',
                        'normal',
                        'published', // ⚡ Force published state for public relay targeting
                        relays
                    );

                    if (publishedEvent?.id) {
                        card.eventId = publishedEvent.id;
                        successCount++;
                        console.log(`[NostrIntegration] ✅ Card ${card.id} published to public relays`);
                    }
                } catch (error) {
                    console.error(`[NostrIntegration] ❌ Error publishing card ${card.id}:`, error);
                }
            }
        }

        // Board nach Publish speichern (für eventIds)
        if (successCount > 0) {
            await BoardStorage.saveBoard(board);
            console.log(`[NostrIntegration] 📤 Published ${successCount} cards to public relays`);
        }

        return successCount;
    }

    /**
     * Publiziert eine Column-Order Änderung als Patch-Event.
     *
     * Motivation:
     * - Editors dürfen kein 30301 publizieren (würde Board-Adresse forken).
     * - Trotzdem soll Column-Reihenfolge kollaborativ synchronisiert werden.
     */
    public async publishColumnPatch(
        board: Board,
        args: {
            columnOrder?: string[];
            columns?: Array<{ id: string; name?: string; color?: string }>;
            deletedColumnIds?: string[];
            deletedCardIds?: string[];
        }
    ): Promise<void> {
        if (!this.ndk) return;

        const hasOrder = Array.isArray(args.columnOrder) && args.columnOrder.length > 0;
        const hasColumns = Array.isArray(args.columns) && args.columns.length > 0;
        const hasDeletes = Array.isArray(args.deletedColumnIds) && args.deletedColumnIds.length > 0;
        const hasCardDeletes = Array.isArray(args.deletedCardIds) && args.deletedCardIds.length > 0;
        if (!hasOrder && !hasColumns && !hasDeletes && !hasCardDeletes) return;

        try {
            if (!board.author) {
                console.warn('[NostrIntegration] ⚠️ Cannot publish column patch: board.author missing');
                return;
            }

            const event = createColumnOrderPatchEvent(
                {
                    boardId: board.id,
                    boardAuthor: board.author,
                    columnOrder: args.columnOrder,
                    columns: args.columns,
                    deletedColumnIds: args.deletedColumnIds,
                    deletedCardIds: args.deletedCardIds,
                    updatedAtMs: Date.now(),
                },
                this.ndk
            );

            console.log('[NostrIntegration] 🧩 publishColumnPatch', {
                kind: event.kind,
                boardId: board.id,
                boardAuthor: board.author,
                orderLen: Array.isArray(args.columnOrder) ? args.columnOrder.length : 0,
                colsLen: Array.isArray(args.columns) ? args.columns.length : 0,
                delLen: Array.isArray(args.deletedColumnIds) ? args.deletedColumnIds.length : 0,
                delCardLen: Array.isArray(args.deletedCardIds) ? args.deletedCardIds.length : 0,
            });

            const publishState = board.publishState || 'private';
            const normalizedState = publishState as
                | 'published'
                | 'private';

            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                privatePublishingMode: settingsStore.settings.privatePublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate,
            });

            const syncManager = getSyncManager();

            await syncManager.publishOrQueue(event, 'board', 'normal', normalizedState, targetRelays);
        } catch (error) {
            console.error('❌ Error publishing column patch:', error);
        }
    }

    public async publishColumnOrderPatch(board: Board, columnOrder: string[]): Promise<void> {
        return this.publishColumnPatch(board, { columnOrder });
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

            // Set status to 'syncing' before publishing
            comment.syncStatus = 'syncing';

            // IMPORTANT: publisher and subscriber must use the exact same cardRef string.
            const cardRef = buildCardRef(board, cardId, card.author);

            // IMPORTANT: `e`-tag must reference the actual Nostr event id of the card (not the d-tag)
            const event = createCommentEvent(comment.text, cardRef, card.eventId || '', this.ndk);
            const publishState = card.publishState || 'private';
            const normalizedState = publishState as 'published' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                privatePublishingMode: settingsStore.settings.privatePublishingMode,
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

            // ✅ CAPTURE EVENT-ID after publishing
            // Note: syncManager.publishOrQueue() signs and publishes the event
            // The event.id is available after signing
            if (event.id) {
                comment.eventId = event.id;
                comment.syncStatus = 'synced';
                
                // Persist to localStorage
                BoardStorage.saveBoard(board);
                
                console.log(`✅ Comment ${commentId} published with eventId: ${event.id}`);
            } else {
                // If eventId not available, mark as failed
                comment.syncStatus = 'failed';
                console.warn(`⚠️ Comment ${commentId} published but eventId not available`);
            }
        } catch (error) {
            console.error(`❌ Error publishing comment:`, error);
            
            // Mark as failed on error
            const result = board.findCardAndColumn(cardId);
            if (result) {
                const comment = result.card.comments?.find(c => c.id === commentId);
                if (comment) {
                    comment.syncStatus = 'failed';
                    BoardStorage.saveBoard(board);
                }
            }
        }
    }

    /**
     * ⚡ NEU: Löscht einen Comment auf Nostr (Kind 5 Deletion Event)
     * Wird bei kaskadierender Card-Löschung aufgerufen
     */
    public async deleteComment(comment: Comment, card: Card): Promise<void> {
        if (!this.ndk) {
            console.warn('[NostrIntegration] deleteComment: NDK nicht initialisiert');
            return;
        }

        // Nur published comments (mit eventId) können auf Nostr gelöscht werden
        if (!comment.eventId) {
            console.log(`[NostrIntegration] ⏭️ Comment ${comment.id} ist lokal, keine Nostr-Löschung nötig`);
            return;
        }

        try {
            console.log(`[NostrIntegration] 🗑️ Deleting comment on Nostr: ${comment.text.substring(0, 50)}... (${comment.eventId})`);

            // Erstelle Deletion Event (Kind 5)
            // Comments sind reguläre Events (Kind 1), nicht replaceable
            const deletionEvent = createDeletionEvent(
                comment.eventId, // Event-ID des Comments
                false, // isReplaceableEvent = false für Kind 1
                `Comment deleted`,
                this.ndk,
                comment.eventId // Actual event ID
            );

            // Bestimme Target-Relays basierend auf Card's publishState
            const publishState = card.publishState || 'private';
            const normalizedState = publishState as 'published' | 'private';
            
            const targetRelays = getTargetRelays({
                publishState: normalizedState,
                privatePublishingMode: settingsStore.settings.privatePublishingMode,
                relaysPublic: settingsStore.settings.relaysPublic,
                relaysPrivate: settingsStore.settings.relaysPrivate
            });

            const syncManager = getSyncManager();
            await syncManager.publishOrQueue(
                deletionEvent,
                'comment',
                'high', // Hohe Priorität für Löschungen
                normalizedState,
                targetRelays
            );

            console.log(`✅ Comment deletion event queued for ${targetRelays.length} relay(s)`);
        } catch (error) {
            console.error(`❌ Error deleting comment on Nostr:`, error);
        }
    }

    /**
     * Loads comments for a specific card from Nostr relays
     * Fetches Kind 1 events with #a tag referencing the card, merges with local comments
     * 
     * **🔄 Retry-Mechanismus:** Wenn die Card noch nicht im Board gefunden wird (z.B. weil sie noch vom Relay geladen wird),
     * wird der Load-Vorgang automatisch bis zu 5x mit 500ms Verzögerung erneut versucht.
     * 
     * @param board - Board containing the card
     * @param cardId - ID of the card to load comments for
     * @param retryCount - Interner Parameter für Retry-Logik (nicht von außen setzen!)
     * 
     * @example
     * ```typescript
     * await nostrIntegration.loadComments(board, 'card-123');
     * // Fetches all Kind 1 events with #a: ['30302:author:card-123']
     * // Merges with local comments in card.comments
     * // Persists merged state to localStorage
     * ```
     */
    public async loadComments(board: Board, cardId: string, retryCount = 0): Promise<void> {
        return loadCommentsImpl(this.ndk, board, cardId, retryCount);
    }

    /**
     * ⚡ Phase 3B: Abonniert Live-Updates für Kommentare einer Karte
     * 
     * Erstellt eine persistente Subscription für alle Kind 1 Events, die auf diese Card referenzieren.
     * Neue Kommentare werden automatisch mit bestehenden gemerged und triggern UI-Updates.
     * 
     * **🔄 Retry-Mechanismus:** Wenn die Card noch nicht im Board gefunden wird (z.B. weil sie noch vom Relay geladen wird),
     * wird die Subscription automatisch bis zu 5x mit 500ms Verzögerung erneut versucht.
     * 
     * @param board - Das Board mit der Card
     * @param cardId - Die ID der Card
     * @param onUpdate - Callback der nach jedem neuen Kommentar aufgerufen wird (z.B. triggerUpdate() für UI refresh)
     * @param retryCount - Interner Parameter für Retry-Logik (nicht von außen setzen!)
     * @returns Cleanup-Funktion zum Beenden der Subscription (und ggf. laufender Retries)
     * 
     * @example
     * ```typescript
     * // In CardDetailsDialog.svelte:
     * let unsubscribe: () => void;
     * onMount(() => {
     *     unsubscribe = boardStore.subscribeToComments(card.id);
     * });
     * onDestroy(() => {
     *     unsubscribe?.();
     * });
     * ```
     */
    public subscribeToComments(board: Board, cardId: string, onUpdate?: () => void, retryCount = 0): () => void {
        return subscribeToCommentsImpl(
            this.ndk,
            this.processedEvents,
            this.commentSubscriptions as any,
            board,
            cardId,
            onUpdate,
            retryCount
        );
    }

    /**
     * Löscht ein Board auf Nostr durch Senden eines NIP-09 Deletion Events
     * @param board - Board das gelöscht werden soll
     */
    public async deleteBoard(board: Board): Promise<void> {
        return deleteBoardImpl(this.ndk, board);
    }

    /**
     * Löscht eine Card auf Nostr durch Senden eines NIP-09 Deletion Events
     * @param card - Card die gelöscht werden soll
     */
    public async deleteCard(card: Card): Promise<void> {
        return deleteCardImpl(this.ndk, card);
    }

    // ============================================================================
    // BOARD SNAPSHOTS (Kind 30303) - Phase 1.5 Board Versioning
    // ============================================================================

    /**
     * 🔖 Creates and publishes a manual snapshot of the current board state
     * 
     * Snapshot events (Kind 30303) are NON-REPLACEABLE, meaning each snapshot
     * is a permanent record that can be referenced later for rollback.
     * 
     * @param board - The current board instance to snapshot
     * @param label - User-provided label/description for this version
     * @param reason - Why this snapshot was created (default: 'manual')
     * @returns The event ID of the published snapshot, or null if failed
     * 
     * Event Structure:
     * ```
     * {
     *   kind: 30303,
     *   tags: [
     *     ["a", "30301:pubkey:board-id"],  // Reference to board
     *     ["v", "label"],                   // User label
     *     ["r", "manual"],                  // Reason
     *     ["t", "1699123456"]               // Timestamp
     *   ],
     *   content: "{...board JSON...}"
     * }
     * ```
     */
    public async publishSnapshot(
        board: Board,
        label: string,
        reason: 'manual' | 'auto_save' | 'before_import' | 'before_restore' = 'manual'
    ): Promise<string | null> {
        return publishSnapshotImpl(this.ndk, board, label, reason);
    }

    /**
     * 🔍 Loads all snapshots for a specific board from Nostr relays
     * 
     * @param boardId - The board's d-tag ID
     * @param boardAuthor - The board owner's pubkey
     * @returns Array of BoardSnapshot objects sorted by timestamp (newest first)
     */
    public async loadSnapshots(
        boardId: string,
        boardAuthor: string
    ): Promise<Array<{
        id: string;
        label: string;
        timestamp: number;
        reason: string;
        cardCount: number;
        columnCount: number;
        createdBy: string;
        boardData: any;
    }>> {
        if (!this.ndk) {
            console.error('[NostrIntegration] ❌ NDK not initialized for loading snapshots');
            return [];
        }

        try {
            // Build filter for Kind 30303 events referencing this board
            const aTagValue = `30301:${boardAuthor}:${boardId}`;
            
            const filter = {
                kinds: [EVENT_KINDS.SNAPSHOT],
                '#a': [aTagValue],
            };

            console.log(`🔍 [NostrIntegration] Loading snapshots for board ${boardId}...`);
            console.log(`🔍 [NostrIntegration] Filter:`, filter);
            
            // Get private relays to query - snapshots are stored on private relays
            const privateRelays = settingsStore.settings.relaysPrivate || [];
            const targetRelays = privateRelays.length > 0 
                ? privateRelays 
                : ['ws://localhost:7000'];
            
            console.log(`🔍 [NostrIntegration] Querying relays:`, targetRelays);
            
            // Build relay set from connected relays
            // Note: Private relays should already be in the NDK pool (added in +layout.svelte)
            const connectedRelays = new Set<import('@nostr-dev-kit/ndk').NDKRelay>();
            for (const url of targetRelays) {
                try {
                    const relay = this.ndk.pool.getRelay(url);
                    if (relay) {
                        // Wait for connection if not connected
                        if (relay.status !== 1) { // 1 = CONNECTED
                            console.log(`🔍 [NostrIntegration] Waiting for relay connection: ${url}`);
                            await relay.connect();
                        }
                        connectedRelays.add(relay);
                    } else {
                        console.warn(`🔍 [NostrIntegration] Relay not in pool: ${url} - was it added in +layout.svelte?`);
                    }
                } catch (relayError) {
                    console.warn(`🔍 [NostrIntegration] Failed to connect relay ${url}:`, relayError);
                }
            }
            
            if (connectedRelays.size === 0) {
                console.warn('🔍 [NostrIntegration] No relays connected, trying default fetch');
                const events = await this.ndk.fetchEvents(filter as any);
                console.log(`🔍 [NostrIntegration] Found ${events.size} snapshot event(s) from default relays`);
                return this.parseSnapshotEvents(events);
            }
            
            console.log(`🔍 [NostrIntegration] ${connectedRelays.size}/${targetRelays.length} relays connected`);
            const relaySet = new NDKRelaySet(connectedRelays, this.ndk);
            
            // Fetch events from private relays specifically
            const events = await this.ndk.fetchEvents(filter as any, { relaySet });
            
            console.log(`🔍 [NostrIntegration] Found ${events.size} snapshot event(s)`);
            
            return this.parseSnapshotEvents(events);
            
        } catch (error) {
            console.error('[NostrIntegration] ❌ Failed to load snapshots:', error);
            return [];
        }
    }
    
    /**
     * Helper to parse snapshot events into structured data
     */
    private parseSnapshotEvents(events: Set<import('@nostr-dev-kit/ndk').NDKEvent>): Array<{
        id: string;
        label: string;
        timestamp: number;
        reason: string;
        cardCount: number;
        columnCount: number;
        createdBy: string;
        boardData: any;
    }> {
        const snapshots: Array<{
            id: string;
            label: string;
            timestamp: number;
            reason: string;
            cardCount: number;
            columnCount: number;
            createdBy: string;
            boardData: any;
        }> = [];

        for (const event of events) {
            try {
                // Parse tags
                const vTag = event.tags.find((t: string[]) => t[0] === 'v');
                const rTag = event.tags.find((t: string[]) => t[0] === 'r');
                const tTag = event.tags.find((t: string[]) => t[0] === 't');
                
                const label = vTag ? vTag[1] : 'Unnamed snapshot';
                const reason = rTag ? rTag[1] : 'manual';
                const timestamp = tTag ? parseInt(tTag[1], 10) : (event.created_at || 0);
                
                // Parse board data from content
                let boardData: any = {};
                let cardCount = 0;
                let columnCount = 0;
                
                if (event.content) {
                    try {
                        boardData = JSON.parse(event.content);
                        columnCount = boardData.columns?.length || 0;
                        cardCount = boardData.columns?.reduce(
                            (sum: number, col: any) => sum + (col.cards?.length || 0), 
                            0
                        ) || 0;
                    } catch (parseError) {
                        console.warn('[NostrIntegration] ⚠️ Failed to parse snapshot content:', parseError);
                    }
                }
                
                snapshots.push({
                    id: event.id || `snapshot-${timestamp}`,
                    label,
                    timestamp,
                    reason,
                    cardCount,
                    columnCount,
                    createdBy: event.pubkey,
                    boardData,
                });
            } catch (eventError) {
                console.warn('[NostrIntegration] ⚠️ Failed to process snapshot event:', eventError);
            }
        }

        // Sort by timestamp (newest first)
        snapshots.sort((a, b) => b.timestamp - a.timestamp);
        
        console.log(`✅ [NostrIntegration] Parsed ${snapshots.length} snapshot(s)`);
        
        return snapshots;
    }

    /**
     * 🔖 Fetches a specific snapshot by its label
     * 
     * @param boardId - The board's d-tag ID  
     * @param boardAuthor - The board owner's pubkey
     * @param label - The exact label to search for
     * @returns The matching snapshot or null if not found
     */
    public async fetchSnapshotByLabel(
        boardId: string,
        boardAuthor: string,
        label: string
    ): Promise<{
        id: string;
        label: string;
        timestamp: number;
        boardData: any;
    } | null> {
        const snapshots = await this.loadSnapshots(boardId, boardAuthor);
        return snapshots.find(s => s.label === label) || null;
    }

    /**
     * 🔍 Fetches a specific snapshot by its event ID
     * 
     * @param snapshotId - The Nostr event ID of the snapshot
     * @returns The snapshot data or null if not found
     */
    public async fetchSnapshotById(
        snapshotId: string
    ): Promise<{
        id: string;
        label: string;
        timestamp: number;
        reason: string;
        boardData: any;
    } | null> {
        if (!this.ndk) {
            console.error('[NostrIntegration] ❌ NDK not initialized');
            return null;
        }

        try {
            const event = await this.ndk.fetchEvent({ ids: [snapshotId] });
            
            if (!event) {
                console.warn(`[NostrIntegration] ⚠️ Snapshot ${snapshotId} not found`);
                return null;
            }

            const vTag = event.tags.find((t: string[]) => t[0] === 'v');
            const rTag = event.tags.find((t: string[]) => t[0] === 'r');
            const tTag = event.tags.find((t: string[]) => t[0] === 't');
            
            let boardData = {};
            if (event.content) {
                try {
                    boardData = JSON.parse(event.content);
                } catch {
                    console.warn('[NostrIntegration] ⚠️ Failed to parse snapshot content');
                }
            }

            return {
                id: event.id || snapshotId,
                label: vTag ? vTag[1] : 'Unnamed',
                timestamp: tTag ? parseInt(tTag[1], 10) : (event.created_at || 0),
                reason: rTag ? rTag[1] : 'manual',
                boardData,
            };
            
        } catch (error) {
            console.error('[NostrIntegration] ❌ Failed to fetch snapshot by ID:', error);
            return null;
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

        this.boardSubscription = null;
        this.activeBoardSubscriptionKey = null;

        this.stopAllCommentSubscriptions();
    }
}
