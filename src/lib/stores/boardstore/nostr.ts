// src/lib/stores/boardstore/nostr.ts
// Nostr-Integration und Event-Publishing

import type { Board, Card, Comment } from '../../classes/BoardModel.js';
import type { BoardProps, ColumnProps } from '../../classes/BoardModel.js';
import { boardToNostrEvent, cardToNostrEvent, createCommentEvent, createDeletionEvent, EVENT_KINDS } from '../../utils/nostrEvents.js';
import { generateDTag } from '../../utils/idGenerator.js';
import { getTargetRelays } from '../../utils/relaySelection.js';
import { getSyncManager } from '../syncManager.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';
import { authStore } from '../authStore.svelte.js';
import { BoardStorage } from './storage.js';
import { getCurrentPubkeyOrNull, hasCurrentPubkey } from './nostr/auth.js';
import { loadProcessedDeletions, saveProcessedDeletions } from './nostr/deletionEventsCache.js';
import { unixSecondsToMs, unknownTimestampToMs } from './nostr/time.js';
import {
    loadComments as loadCommentsImpl,
    stopAllCommentSubscriptions as stopAllCommentSubscriptionsImpl,
    subscribeToComments as subscribeToCommentsImpl
} from './nostr/comments.js';
import {
    deleteBoard as deleteBoardImpl,
    deleteCard as deleteCardImpl,
    publishSnapshot as publishSnapshotImpl
} from './nostr/publish.js';
import { subscribeToUpdates as subscribeToUpdatesImpl } from './nostr/subscriptions.js';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { toast } from 'svelte-sonner';

export class NostrIntegration {
    private ndk?: NDK;
    private boardSubscription: any | null = null;
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
        console.log('[BoardStore] ✅ Nostr initialized - SyncManager ready');

        // ⚡ Load processed deletions from localStorage
        this.processedDeletionEvents = loadProcessedDeletions();

        // Wenn bereits ein User authentifiziert ist, sofort Boards laden
        try {
            if (hasCurrentPubkey() && onBoardLoad) {
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
     * Gibt die NDK-Instanz zurück
     */
    public getNDK(): NDK | undefined {
        return this.ndk;
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

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey) {
            console.log('[BoardStore] ℹ️ No pubkey available, skipping Nostr board loading');
            return;
        }

        try {
            const startTime = Date.now();
            console.log('[BoardStore] 🛰️ Fetching boards from Nostr for pubkey:', pubkey);

            // 1. Fetch Board Events (Kind 30301)
            // ⚡ OPTIMIZATION: Limit to recent boards (last 90 days) für schnelleren Load
            const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
            
            const boardFilter = {
                kinds: [30301],
                authors: [pubkey],
                since: ninetyDaysAgo // Nur Boards der letzten 90 Tage
            };

            const boardEvents = await this.ndk.fetchEvents(boardFilter as any);
            
            console.log(`[BoardStore] ⏱️ Fetched ${boardEvents.size} board event(s) in ${Date.now() - startTime}ms`);

            if (!boardEvents || boardEvents.size === 0) {
                console.log('[BoardStore] ℹ️ No boards found on Nostr for current user');
                return;
            }

            // 2. ⚡ SIMPLIFIED: Relay versteckt gelöschte Events automatisch!
            //    Wir brauchen KEINE lokale Deletion-Tracking mehr!
            //    Der Relay gibt nur nicht-gelöschte Events zurück.
            
            console.log('[BoardStore] �️ Relay will automatically hide deleted boards (NIP-09)');

            // 3. Initialisiere loadedBoardIds
            const loadedBoardIds: string[] = [];
        
            // 4. Sammle Board-IDs die auf dem Relay existieren
            const relayBoardIds = new Set<string>();
            
            // ⚡ OPTIMIZATION: Import dependencies einmalig vor der Loop
            const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
            const { Board: BoardClass } = await import('../../classes/BoardModel.js');
            
            // ⚡ OPTIMIZATION: Parallele Verarbeitung aller Board-Events
            const boardProcessingPromises = Array.from(boardEvents).map(async (event) => {
                if (event.kind !== 30301) return null;

                try {
                    // Check ob Board mit deleted=true Tag markiert ist
                    const deletedTag = event.tags.find((t: any) => t[0] === 'deleted' && t[1] === 'true');
                    if (deletedTag) {
                        return null;
                    }

                    const boardProps = nostrEventToBoard(event);
                    const board = new BoardClass(boardProps);

                    // Merke dass dieses Board auf dem Relay existiert
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

                    // Prepare storage data
                    const context = board.getContextData(true) as any;
                    const remoteCreated = event.created_at
                        ? new Date(unixSecondsToMs(event.created_at)).toISOString()
                        : context.createdAt || new Date().toISOString();
                    context.createdAt = context.createdAt || remoteCreated;
                    context.updatedAt = context.updatedAt || remoteCreated;

                    return { 
                        boardId: board.id, 
                        needsStorage: true, 
                        storageKey, 
                        context 
                    };
                } catch (err) {
                    console.error('[BoardStore] ❌ Failed to import Nostr board event:', err);
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
                        window.localStorage.setItem(result.storageKey, JSON.stringify(result.context));
                    }
                }
            } else {
                for (const result of processedBoards) {
                    if (result) {
                        loadedBoardIds.push(result.boardId);
                    }
                }
            }
            
            console.log(`[BoardStore] ✅ Processed ${loadedBoardIds.length} board(s) in parallel`);

            // MRU-Heuristik: Neuestes Board wählen wenn aktuelles Board anonym ist
            // ⚡ OPTIMIZATION: Early exit wenn nicht nötig
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
                        console.log('[BoardStore] ✅ Switched active board to newest Nostr board:', best.id);
                        return;
                    } catch (err) {
                        console.warn('[BoardStore] ⚠️ Failed to switch active board to Nostr board:', err);
                    }
                }
            }

            onBoardsLoaded(loadedBoardIds, false);

            // 7. POST-CLEANUP: Lösche lokale Boards die nicht mehr auf dem Relay existieren
            //    (Boards die auf Relay gelöscht wurden, sind durch Pre-Cleanup & Filter schon weg)
            if (typeof window !== 'undefined') {
                // Nur Board-Daten Keys (nicht config, board-ids, etc.)
                const boardDataKeys = Object.keys(localStorage).filter(k => {
                    // Skip non-board keys
                    if (k === 'kanban-config') return false;
                    if (k === 'kanban-board-ids') return false;
                    
                    // Nur Keys die wie "kanban-board-xxx" aussehen
                    return k.startsWith('kanban-') && k.includes('board-');
                });
                
                let cleanedCount = 0;
                
                for (const key of boardDataKeys) {
                    const boardId = key.replace('kanban-', '');
                    
                    // Skip wenn:
                    // - Board ist auf dem Relay (relayBoardIds)
                    // - Board ist aktuell aktiv (currentBoard.id)
                    // - Board ist in der boardIds Liste (wurde gerade geladen)
                    if (relayBoardIds.has(boardId) || 
                        boardId === currentBoard.id ||
                        loadedBoardIds.includes(boardId)) {
                        continue;
                    }
                    
                    // Board existiert nicht mehr auf Relay → löschen
                    localStorage.removeItem(key);
                    cleanedCount++;
                    console.log('[BoardStore] 🧹 Post-cleanup: Removed orphaned board:', boardId);
                }
                
                if (cleanedCount > 0) {
                    console.log(`[BoardStore] ✅ Post-cleanup: Removed ${cleanedCount} orphaned local board(s)`);
                }
            }
        } catch (error) {
            console.error('[BoardStore] ❌ Error while loading boards from Nostr:', error);
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
            console.log('[BoardStore] ℹ️ Nostr not initialized, skip loadCardsForBoard');
            return;
        }

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey || !board.author) {
            console.log('[BoardStore] ℹ️ No pubkey or board author, skip loadCardsForBoard');
            return;
        }

        try {
            // Baue die a-tag Referenz: "30301:pubkey:board-id"
            const boardRef = `30301:${board.author}:${board.id}`;
            
            // console.log('[BoardStore] 🃏 Fetching cards for board:', board.name, 'Ref:', boardRef);

            // Fetch alle Card-Events (Kind 30302) die zu diesem Board gehören
            const cardFilter = {
                kinds: [30302],
                '#a': [boardRef]
            };

            const cardEvents = await this.ndk.fetchEvents(cardFilter as any);

            if (!cardEvents || cardEvents.size === 0) {
                console.log('[BoardStore] ℹ️ No cards found on Nostr for board:', board.id);
                return;
            }

            console.log('[BoardStore] 🃏 Found', cardEvents.size, 'card(s) on relay for board:', board.name);

            // ⚡ RELAY FILTERT GELÖSCHTE CARDS: Keine lokale Deletion-Tracking mehr nötig!
            // Relay gibt per NIP-09 nur nicht-gelöschte Events zurück

            // Deserialisiere alle Card-Events
            const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
            
            // ⚡ OPTIMIZATION: Parallele Verarbeitung aller Card-Events
            const cardProcessingPromises = Array.from(cardEvents).map(async (cardEvent) => {
                try {
                    const cardProps = nostrEventToCard(cardEvent);
                    
                    // Validiere dass Card zum richtigen Board gehört
                    if (cardProps.boardRef !== boardRef) {
                        console.warn('[BoardStore] ⚠️ Card boardRef mismatch:', cardProps.boardRef, 'expected:', boardRef);
                        return null;
                    }
                    
                    return cardProps;
                } catch (err) {
                    console.error('[BoardStore] ❌ Failed to deserialize card event:', err);
                    return null;
                }
            });
            
            const processedCards = await Promise.all(cardProcessingPromises);
            
            // Batch-Verarbeitung aller Cards
            let loadedCount = 0;
            for (const cardProps of processedCards) {
                if (cardProps) {
                    onCardLoaded(cardProps);
                    loadedCount++;
                }
            }

            console.log('[BoardStore] ✅ Finished loading cards for board:', board.name, `(${loadedCount} loaded in parallel)`);
        } catch (error) {
            console.error('[BoardStore] ❌ Error while loading cards from Nostr:', error);
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
        boardStore: any // ⚡ v2.0: Store-Referenz statt Callbacks!
    ): void {
        if (!this.ndk) {
            console.log('[BoardStore] ℹ️ Nostr not initialized, skip subscribe');
            return;
        }

        const pubkey = getCurrentPubkeyOrNull();

        if (!pubkey) {
            console.log('[BoardStore] ℹ️ No pubkey available, skip board subscription');
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
    }

    /**
     * Handler für Board-Events (Kind 30301)
     * 
     * ⚡ v2.0: Event-Driven Architecture mit upsertBoardFromNostr()
     * ⚡ v4.1: Optimiert - Silent Skip für bereits verarbeitete Events
     */
    private async handleBoardEvent(
        boardEvent: any,
        currentBoard: Board,
        boardStore: any // ⚡ v2.0: Store-Referenz für direkte API-Aufrufe
    ): Promise<void> {
        // ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
        if (this.processedEvents.has(boardEvent.id)) {
            return; // Silent skip - Event bereits verarbeitet
        }
        
        this.processedEvents.add(boardEvent.id);
        
        // ⚡ v4.1: Nur bei NEUEN Events loggen
        console.log('📥 Board-Event (new):', boardEvent.id.substring(0, 16));
        
        // ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
        const { getSyncManager } = await import('../syncManager.svelte.js');
        const syncManager = getSyncManager();
        if (syncManager.isMyEvent(boardEvent.id)) {
            // Silent skip - eigenes Event
            
            // ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
            setTimeout(() => {
                syncManager.clearMyEvent(boardEvent.id);
            }, 5000);
            
            return;
        }
        
        try {
            // Deserialisiere Board-Event
            const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
            const boardProps = nostrEventToBoard(boardEvent);
            
            // Validierung: Board muss eine ID haben
            if (!boardProps.id) {
                console.warn('⚠️ Board-Event hat keine ID - skip');
                return;
            }
            
            // ⚡ v2.0: Timestamp-Based Conflict Resolution
            // Prüfe ob Board später gelöscht wurde
            const deleteTime = this.boardDeletionTimestamps.get(boardProps.id);
            if (deleteTime) {
                const boardTime = unixSecondsToMs(boardEvent.created_at);
                if (boardTime < deleteTime) {
                    console.log(`⏭️ Board ${boardProps.id} was deleted after this update, skip`);
                    return;
                }
            }
            
            // ⚡ v4.0: Last-Write-Wins Conflict Resolution
            // Vergleiche Event-Timestamp mit localStorage um stale data zu verhindern
            const { BoardStorage } = await import('./storage.js');
            const localBoard = BoardStorage.loadBoard(boardProps.id);
            
            if (localBoard && localBoard.updatedAt) {
                // Parse ISO timestamp zu Number für Vergleich
                const localTime = unknownTimestampToMs(localBoard.updatedAt);
                const eventTime = unixSecondsToMs(boardEvent.created_at); // Nostr timestamps sind in Sekunden
                
                if (eventTime <= localTime) {
                    // Silent skip - lokale Daten sind neuer oder gleich
                    return; // Don't overwrite newer local data with stale event
                }
                
                // Nur bei tatsächlichem Update loggen
                console.log(`✅ LWW: Apply newer event (${Math.round((eventTime - localTime) / 1000)}s newer)`);
            }
            
            // ⚡ NEW: Set unseen changes flag if board is NOT currently loaded
            if (boardProps.id !== currentBoard.id) {
                // Board ist im Hintergrund → markiere als geändert
                const { BoardStorage } = await import('./storage.js');
                const backgroundBoard = BoardStorage.loadBoard(boardProps.id);
                if (backgroundBoard) {
                    backgroundBoard.markAsChanged();
                    BoardStorage.saveBoard(backgroundBoard);
                }
            }
            
            // ⚡ v2.0: Direkte Store-API (SECONDARY action)
            // Unterstützt UPDATE (aktuelles Board) UND INSERT (neues Board)
            boardStore.upsertBoardFromNostr(boardProps);
            
        } catch (error) {
            console.error(`❌ Error processing board event:`, error);
        }
    }

    /**
     * Handler für Card-Events (Kind 30302)
     * 
     * ⚡ v2.0: Event-Driven Architecture mit direkter Store-API
     * ⚡ v4.1: Optimiert - Silent Skip für bereits verarbeitete Events
     */
    private async handleCardEvent(
        cardEvent: any,
        currentBoard: Board,
        boardStore: any // ⚡ v2.0: Store-Referenz für direkte API-Aufrufe
    ): Promise<void> {
        // ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
        if (this.processedEvents.has(cardEvent.id)) {
            return; // Silent skip - Event bereits verarbeitet
        }
        
        this.processedEvents.add(cardEvent.id);
        
        // ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
        const { getSyncManager } = await import('../syncManager.svelte.js');
        const syncManager = getSyncManager();
        if (syncManager.isMyEvent(cardEvent.id)) {
            // Silent skip - eigenes Event
            
            // ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
            setTimeout(() => {
                syncManager.clearMyEvent(cardEvent.id);
            }, 5000);
            
            return;
        }
        
        try {
            // Deserialisiere Card-Event
            const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
            const cardProps = nostrEventToCard(cardEvent);
            
            // ⚡ v3.0: BACKGROUND BOARD SYNC FIX
            // Parse boardRef to get target board ID
            // Format: "30301:pubkey:board-id"
            let targetBoardId: string | null = null;
            
            if (cardProps.boardRef) {
                const parts = cardProps.boardRef.split(':');
                if (parts.length === 3 && parts[0] === '30301') {
                    targetBoardId = parts[2];
                    // console.log(`📦 Card ${cardProps.id} gehört zu Board: ${targetBoardId}`);
                } else {
                    console.warn(`⚠️ Invalid boardRef format: ${cardProps.boardRef}`);
                    return;
                }
            } else {
                console.warn(`⚠️ Card ${cardProps.id} has no boardRef`);
                return;
            }
            
            // ⚡ v2.0: Timestamp-Based Conflict Resolution
            // Prüfe ob Card später gelöscht wurde
            const deleteTime = this.cardDeletionTimestamps.get(cardProps.id!);
            if (deleteTime) {
                // ⚠️ Card-Event hat keine updatedAt - nutze Event created_at
                const cardTime = unixSecondsToMs(cardEvent.created_at); // Millisekunden
                
                if (cardTime < deleteTime) {
                    console.log(`🗑️ Card ${cardProps.id} was deleted after this update (${new Date(deleteTime).toISOString()}), skip`);
                    return;
                }
            }
            
            // ⚡ v4.3: Last-Write-Wins for Cards (same pattern as Board)
            // Compare event timestamp with local card updatedAt
            const result = currentBoard.findCardAndColumn(cardProps.id!);
            if (result && result.card.updatedAt) {
                const localTime = unknownTimestampToMs(result.card.updatedAt);
                const eventTime = unixSecondsToMs(cardEvent.created_at);
                
                if (eventTime <= localTime) {
                    // Silent skip - lokale Daten sind neuer oder gleich
                    return;
                }
                
                // Nur bei tatsächlichem Update loggen
                console.log(`✅ Card LWW: Apply newer (${((eventTime - localTime) / 1000).toFixed(1)}s newer)`);
            }
            
            // columnId ist KRITISCH - ohne geht nichts!
            if (!cardProps.columnId) {
                console.error(`❌ Card ${cardProps.id} hat keine columnId!`);
                return;
            }
            
            // ⚡ v3.0: CRITICAL - Support Background Board Sync
            // Wenn Card für aktuelles Board → normale Verarbeitung
            // Wenn Card für Background Board → speichere direkt in localStorage
            if (targetBoardId === currentBoard.id) {
                console.log(`✅ Card ${cardProps.id} ist für aktuelles Board - normale Verarbeitung`);
                boardStore.upsertCardFromNostr(cardProps);
            } else {
                // console.log(`🔄 Card ${cardProps.id} ist für Background Board ${targetBoardId} - direkter localStorage Update`);
                boardStore.upsertCardToBackgroundBoard(targetBoardId, cardProps);
                
                // ⚡ NEW: Set unseen changes flag for background board
                const { BoardStorage } = await import('./storage.js');
                const backgroundBoard = BoardStorage.loadBoard(targetBoardId);
                if (backgroundBoard) {
                    backgroundBoard.markAsChanged();
                    BoardStorage.saveBoard(backgroundBoard);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error processing card event:`, error);
        }
    }

    // ⚠️ Track recently deleted cards (in-memory only, for this session)
    // Prevents race condition: Deletion event arrives → Board event with old data arrives → Old data restored
    // ❌ DEPRECATED v2.0: Ersetzt durch Timestamp-Based Tracking (cardDeletionTimestamps)
    // private recentlyDeletedCards = new Set<string>();
    
    /**
     * Handler für Deletion-Events (Kind 5)
     * 
     * ⚡ v2.0: Event-Driven Architecture mit Timestamp-Tracking
     * 
     * Wird aufgerufen wenn ein Board ODER Card gelöscht wurde (via subscription).
     * Trackt Deletion-Timestamps für Out-of-Order Event-Handling.
     * 
     * NIP-09: Replaceable Events (Kind 30301/30302) werden via 'a' tags referenziert
     */
    private async handleDeletionEvent(
        deletionEvent: any,
        boardStore: any // ⚡ v2.0: Store-Referenz für direkte API-Aufrufe
    ): Promise<void> {
        // console.log('🗑️ Deletion-Event erhalten:', deletionEvent.id);
        
        // ⚡ OPTIMIZATION: Check persistent deletion event cache FIRST
        if (this.processedDeletionEvents.has(deletionEvent.id)) {
            // Silently skip - already processed in previous session
            return;
        }
        
        // ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
        if (this.processedEvents.has(deletionEvent.id)) {
            return; // Silent skip - Event bereits verarbeitet
        }
        
        this.processedEvents.add(deletionEvent.id);
        
        // ⚡ Track this deletion event persistently
        this.processedDeletionEvents.add(deletionEvent.id);
        this.processedDeletionEvents = saveProcessedDeletions(this.processedDeletionEvents); // Persist to localStorage
        
        try {
            // NIP-09: Parse 'a' tags für replaceable events
            // Format: ['a', '30301:pubkey:board-id'] oder ['a', '30302:pubkey:card-id']
            const aTags = deletionEvent.tags.filter((t: any) => t[0] === 'a');
            const deleteTime = unixSecondsToMs(deletionEvent.created_at); // Millisekunden
            
            for (const aTag of aTags) {
                const eventRef = aTag[1]; // z.B. "30301:pubkey:board-xxx" oder "30302:pubkey:card-xxx"
                
                // ===== BOARD DELETION =====
                if (eventRef && eventRef.startsWith('30301:')) {
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const boardId = parts.slice(2).join(':');
                        
                        // ⚡ OPTIMIZATION: Skip if already tracked (prevents duplicate processing)
                        if (this.boardDeletionTimestamps.has(boardId)) {
                            // Silent skip - bereits getrackt
                            continue;
                        }
                        
                        // Track deletion timestamp (für Ordering)
                        this.boardDeletionTimestamps.set(boardId, deleteTime);
                        
                        // Check if board exists locally
                        const existsLocally = BoardStorage.loadBoard(boardId) !== null;
                        
                        if (existsLocally) {
                            console.log(`🗑️ Deleting board ${boardId.substring(0, 16)}... (deletion event)`);
                            
                            // Delete from localStorage (publish: false to avoid re-publishing deletion event)
                            BoardStorage.deleteBoard(boardId);
                            
                            // Update board list in store
                            boardStore.refreshBoardList();
                            
                            // If this was the active board, switch to another board
                            if (boardStore.data.id === boardId) {
                                boardStore.switchToAnotherBoardAfterDeletion(boardId);
                            }
                        }
                        // Silent skip wenn bereits gelöscht
                    }
                }
                
                // ===== CARD DELETION =====
                else if (eventRef && eventRef.startsWith('30302:')) {
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const cardId = parts.slice(2).join(':');
                        
                        // ⚡ OPTIMIZATION: Skip if already tracked (prevents duplicate processing)
                        if (this.cardDeletionTimestamps.has(cardId)) {
                            // Silent skip - bereits getrackt
                            continue;
                        }
                        
                        // 🔍 FILTER: Only process deletions for cards from current board
                        const currentBoard = boardStore.data;
                        if (!currentBoard) {
                            // No board loaded, skip
                            continue;
                        }
                        
                        // Check if card belongs to current board
                        const result = currentBoard.findCardAndColumn(cardId);
                        if (!result) {
                            // Card not in current board, skip
                            continue;
                        }
                        
                        // Track deletion timestamp (für Ordering)
                        this.cardDeletionTimestamps.set(cardId, deleteTime);
                        
                        console.log(`🗑️ Deleting card ${cardId.substring(0, 16)}... from board (deletion event)`);
                        
                        // ⚡ v2.0: Direkte Store-API (SECONDARY action)
                        boardStore.deleteCardFromNostr(cardId);
                    }
                }
            }
        } catch (error) {
            console.error(`❌ Error processing deletion event:`, error);
        }
    }

    /**
     * Publiziert Board zu Nostr
     * @returns Event-ID des publizierten Events oder null bei Fehler
     */
    public async publishBoard(board: Board): Promise<string | null> {
        if (!this.ndk) return null;

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

            // ⚠️ SICHERHEITS-CHECK: Warne wenn Draft nicht publiziert werden kann
            if (normalizedState === 'draft' && targetRelays.length === 0) {
                const mode = settingsStore.settings.draftPublishingMode;
                
                if (mode === 'private-relays') {
                    toast.warning('🔒 Keine privaten Relays konfiguriert', {
                        description: 'Board-Änderungen werden nur lokal gespeichert. Gehe zu Einstellungen → Nostr → Private Relays um Synchronisation zu aktivieren.',
                        duration: 6000
                    });
                    console.warn('[NostrIntegration] 🔒 Draft board cannot be published - no private relays configured');
                }
                // Falls local-only: Kein Toast (das ist erwartetes Verhalten)
            }

            const syncManager = getSyncManager();
            const publishedEvent = await syncManager.publishOrQueue(
                event, 
                'board', 
                'normal',
                normalizedState,
                targetRelays
            );
            
            // ⚡ NEU: Event-ID erfassen nach erfolgreichem Publish!
            if (publishedEvent?.id) {
                board.eventId = publishedEvent.id;
                console.log(`[NostrIntegration] 🔑 Board Event-ID: ${board.eventId}`);
                
                // ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
                const { BoardStorage } = await import('./storage.js');
                await BoardStorage.saveBoard(board);
                
                // ⚡ RÜCKGABE: Event-ID für LiaScript-Link-Generierung
                return publishedEvent.id;
            }
            
            return null;
        } catch (error) {
            console.error(`❌ Error publishing board:`, error);
            return null;
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
     * Merges local comments with remote comments from Nostr
     * Deduplicates by eventId, preserves local unpublished comments, sorts chronologically
     * 
     * @param localComments - Comments currently in localStorage
     * @param remoteComments - Comments fetched from Nostr (Kind 1 events)
     * @returns Merged and deduplicated comment array
     * 
     * @example
     * ```typescript
     * const local = [
     *   { id: 'local-1', text: 'Unpublished', author: 'npub1...', createdAt: '2025-01-15T10:00:00Z', syncStatus: 'local' },
     *   { id: 'local-2', text: 'Published', author: 'npub1...', createdAt: '2025-01-15T11:00:00Z', eventId: 'abc123', syncStatus: 'synced' }
     * ];
     * const remote = [
     *   { id: 'remote-1', text: 'Published', author: 'npub1...', createdAt: '2025-01-15T11:00:00Z', eventId: 'abc123', syncStatus: 'synced' },
     *   { id: 'remote-2', text: 'From other device', author: 'npub2...', createdAt: '2025-01-15T12:00:00Z', eventId: 'xyz789', syncStatus: 'synced' }
     * ];
     * const merged = mergeComments(local, remote);
     * // Result: [local-1, remote-1 (deduplicated), remote-2] sorted by createdAt
     * ```
     */
    private mergeComments(localComments: Comment[], remoteComments: Comment[]): Comment[] {
        // Step 1: Create Set of eventIds from local comments (for synced comments)
        const localEventIds = new Set<string>(
            localComments
                .filter(c => c.eventId) // Only comments with eventId
                .map(c => c.eventId!)
        );

        // Step 2: Filter remote comments to exclude duplicates
        const newRemoteComments = remoteComments.filter(remote => {
            // 2a. Skip if eventId already exists in local comments
            if (remote.eventId && localEventIds.has(remote.eventId)) {
                return false;
            }

            // 🚀 2b. NEW: Also check for text+timestamp duplicates (for pending local comments)
            // This handles the case where local comment was sent but hasn't received eventId yet
            // If text matches AND timestamp is within 5 seconds → it's the same comment
            const isDuplicate = localComments.some(local => {
                // Skip if local already has eventId (already synced)
                if (local.eventId) return false;

                // Check text match
                if (local.text !== remote.text) return false;

                // Check timestamp proximity (within 5 seconds)
                const localTime = unknownTimestampToMs(local.createdAt);
                const remoteTime = unknownTimestampToMs(remote.createdAt);
                const timeDiff = Math.abs(localTime - remoteTime);

                return timeDiff < 5000; // 5 seconds tolerance
            });

            return !isDuplicate;
        });

        // Step 3: Merge local + new remote comments
        const merged = [...localComments, ...newRemoteComments];

        // Step 4: Sort chronologically by createdAt (oldest first)
        merged.sort((a, b) => {
            const dateA = unknownTimestampToMs(a.createdAt);
            const dateB = unknownTimestampToMs(b.createdAt);
            return dateA - dateB;
        });

        return merged;
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
     * // In CardViewDialog.svelte:
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

        this.stopAllCommentSubscriptions();
    }
}
