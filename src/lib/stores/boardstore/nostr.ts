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
import { toast } from 'svelte-sonner';

export class NostrIntegration {
    private ndk?: NDK;
    private boardSubscription: any | null = null;

    // ⚡ NEU (v2.0): Event-Deduplication für Event-Driven Architecture
    private processedEvents = new Set<string>();
    
    // ⚡ NEU (v2.0): Deletion-Timestamp-Tracking für Out-of-Order Events
    private cardDeletionTimestamps = new Map<string, number>();
    private boardDeletionTimestamps = new Map<string, number>();

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

            // 2. ⚡ SIMPLIFIED: Relay versteckt gelöschte Events automatisch!
            //    Wir brauchen KEINE lokale Deletion-Tracking mehr!
            //    Der Relay gibt nur nicht-gelöschte Events zurück.
            
            console.log('[BoardStore] �️ Relay will automatically hide deleted boards (NIP-09)');

            // 3. Initialisiere loadedBoardIds
            const loadedBoardIds: string[] = [];
        
            // 4. Sammle Board-IDs die auf dem Relay existieren
            const relayBoardIds = new Set<string>();            for (const event of boardEvents) {
                if (event.kind !== 30301) continue;

                try {
                    // Check ob Board mit deleted=true Tag markiert ist
                    const deletedTag = event.tags.find((t: any) => t[0] === 'deleted' && t[1] === 'true');
                    if (deletedTag) {
                        console.log('[BoardStore] ⏩ Skipping board marked as deleted (deleted tag)');
                        continue;
                    }

                    const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
                    const boardProps = nostrEventToBoard(event);
                    const board = new (await import('../../classes/BoardModel.js')).Board(boardProps);

                    // ⚡ SIMPLIFIED: Relay gibt nur nicht-gelöschte Boards zurück!
                    //    Keine lokale Deletion-Prüfung mehr nötig
                    
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
                        // Relay gibt nur nicht-gelöschte Boards zurück - keine Deletion-Checks nötig
                        if (!loadedBoardIds.includes(board.id)) {
                            loadedBoardIds.push(board.id);
                            console.log('[BoardStore] ✅ Added local board to loadedBoardIds:', board.id);
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

                    // Relay gibt nur nicht-gelöschte Boards zurück - keine Deletion-Checks nötig
                    if (!loadedBoardIds.includes(board.id)) {
                        loadedBoardIds.push(board.id);
                        console.log('[BoardStore] ✅ Added remote board to loadedBoardIds:', board.id);
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

        const pubkey =
            (typeof authStore?.getPubkeySafe === 'function' && authStore.getPubkeySafe()) ||
            (typeof authStore?.getPubkey === 'function' && authStore.getPubkey()) ||
            null;

        if (!pubkey || !board.author) {
            console.log('[BoardStore] ℹ️ No pubkey or board author, skip loadCardsForBoard');
            return;
        }

        try {
            // Baue die a-tag Referenz: "30301:pubkey:board-id"
            const boardRef = `30301:${board.author}:${board.id}`;
            
            console.log('[BoardStore] 🃏 Fetching cards for board:', board.name, 'Ref:', boardRef);

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
            
            let loadedCount = 0;
            
            for (const cardEvent of cardEvents) {
                try {
                    const cardProps = nostrEventToCard(cardEvent);
                    
                    // Validiere dass Card zum richtigen Board gehört
                    if (cardProps.boardRef !== boardRef) {
                        console.warn('[BoardStore] ⚠️ Card boardRef mismatch:', cardProps.boardRef, 'expected:', boardRef);
                        continue;
                    }
                    
                    // Callback mit den Card-Props aufrufen
                    onCardLoaded(cardProps);
                    loadedCount++;
                    
                } catch (err) {
                    console.error('[BoardStore] ❌ Failed to deserialize card event:', err);
                }
            }

            console.log('[BoardStore] ✅ Finished loading cards for board:', board.name, `(${loadedCount} loaded)`);
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

        console.log('[BoardStore] 🛰️ Subscribing to board, card AND deletion events (Event-Driven v2.0)');

        // ⚠️ Filtere nach Boards/Cards die der User erstellt hat
        // Für Collaboration: Später könnten wir auch nach #p-tags (maintainers) filtern
        const sub = this.ndk.subscribe(
            {
                kinds: [30301, 30302, 5] as number[], // Board, Card, Deletion
                authors: [pubkey] // Boards und Cards die dieser User erstellt hat
            } as any,
            { closeOnEose: false }
        );

        sub.on('event', async (event: any) => {
            if (event.kind === 30301) {
                // ===== BOARD-EVENT HANDLER =====
                await this.handleBoardEvent(event, currentBoard, boardStore);
            } else if (event.kind === 30302) {
                // ===== CARD-EVENT HANDLER =====
                await this.handleCardEvent(event, currentBoard, boardStore);
            } else if (event.kind === 5) {
                // ===== DELETION-EVENT HANDLER =====
                await this.handleDeletionEvent(event, boardStore);
            }
        });

        this.boardSubscription = sub;
    }

    /**
     * Handler für Board-Events (Kind 30301)
     * 
     * ⚡ v2.0: Event-Driven Architecture mit upsertBoardFromNostr()
     */
    private async handleBoardEvent(
        boardEvent: any,
        currentBoard: Board,
        boardStore: any // ⚡ v2.0: Store-Referenz für direkte API-Aufrufe
    ): Promise<void> {
        console.log('📥 Board-Event erhalten:', boardEvent.id);
        
        // ⚡ v2.0: Event-Deduplication
        if (this.processedEvents.has(boardEvent.id)) {
            console.log('⏩ Board-Event already processed, skip');
            return;
        }
        
        this.processedEvents.add(boardEvent.id);
        
        // ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
        const { getSyncManager } = await import('../syncManager.svelte.js');
        const syncManager = getSyncManager();
        if (syncManager.isMyEvent(boardEvent.id)) {
            console.log(`⏭️ Eigenes Board-Event erkannt - SKIP: ${boardEvent.id.substring(0, 30)}...`);
            
            // ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
            setTimeout(() => {
                syncManager.clearMyEvent(boardEvent.id);
                console.log(`[SyncManager] 🗑️ Delayed cleanup (5s): ${boardEvent.id.substring(0, 30)}...`);
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
                const boardTime = boardEvent.created_at * 1000;
                if (boardTime < deleteTime) {
                    console.log(`⏭️ Board ${boardProps.id} was deleted after this update, skip`);
                    return;
                }
            }
            
            // ⚡ v4.0: Last-Write-Wins Conflict Resolution
            // Vergleiche Event-Timestamp mit localStorage um stale data zu verhindern
            const { BoardStorage } = await import('./storage.js');
            const localBoard = BoardStorage.loadBoard(boardProps.id);
            
            console.log(`🔍 LWW Check: localBoard exists?`, !!localBoard, localBoard ? `updatedAt: ${localBoard.updatedAt}` : 'null');
            
            if (localBoard && localBoard.updatedAt) {
                // Parse ISO timestamp zu Number für Vergleich
                const localTime = new Date(localBoard.updatedAt).getTime();
                const eventTime = boardEvent.created_at * 1000; // Nostr timestamps sind in Sekunden
                
                if (eventTime <= localTime) {
                    console.log(`⏭️ LWW: Skip older/equal event`);
                    console.log(`  Event time:  ${new Date(eventTime).toISOString()} (${eventTime})`);
                    console.log(`  Local time:  ${new Date(localTime).toISOString()} (${localTime})`);
                    console.log(`  Diff: ${Math.round((localTime - eventTime) / 1000)}s newer in localStorage`);
                    return; // Don't overwrite newer local data with stale event
                }
                
                console.log(`✅ LWW: Apply newer event`);
                console.log(`  Event time:  ${new Date(eventTime).toISOString()} (${eventTime})`);
                console.log(`  Local time:  ${new Date(localTime).toISOString()} (${localTime})`);
                console.log(`  Diff: ${Math.round((eventTime - localTime) / 1000)}s newer from Nostr`);
            } else {
                console.log(`✅ LWW: No local board, apply event unconditionally`);
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
     */
    private async handleCardEvent(
        cardEvent: any,
        currentBoard: Board,
        boardStore: any // ⚡ v2.0: Store-Referenz für direkte API-Aufrufe
    ): Promise<void> {
        console.log('📥 Card-Event erhalten:', cardEvent.id);
        
        // ⚡ v2.0: Event-Deduplication
        if (this.processedEvents.has(cardEvent.id)) {
            console.log('⏩ Card-Event already processed, skip');
            return;
        }
        
        this.processedEvents.add(cardEvent.id);
        
        // ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
        const { getSyncManager } = await import('../syncManager.svelte.js');
        const syncManager = getSyncManager();
        if (syncManager.isMyEvent(cardEvent.id)) {
            console.log(`⏭️ Eigenes Card-Event erkannt - SKIP: ${cardEvent.id.substring(0, 30)}...`);
            
            // ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
            setTimeout(() => {
                syncManager.clearMyEvent(cardEvent.id);
                console.log(`[SyncManager] 🗑️ Delayed cleanup (5s): ${cardEvent.id.substring(0, 30)}...`);
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
                    console.log(`📦 Card ${cardProps.id} gehört zu Board: ${targetBoardId}`);
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
                const cardTime = cardEvent.created_at * 1000; // Millisekunden
                
                if (cardTime < deleteTime) {
                    console.log(`🗑️ Card ${cardProps.id} was deleted after this update (${new Date(deleteTime).toISOString()}), skip`);
                    return;
                }
            }
            
            // ⚡ v4.3: Last-Write-Wins for Cards (same pattern as Board)
            // Compare event timestamp with local card updatedAt
            const result = currentBoard.findCardAndColumn(cardProps.id!);
            if (result && result.card.updatedAt) {
                const localTime = new Date(result.card.updatedAt).getTime();
                const eventTime = cardEvent.created_at * 1000;
                
                if (eventTime <= localTime) {
                    console.log(`⏭️ Card LWW: Skip older/equal event`);
                    console.log(`  Card:        ${cardProps.heading || cardProps.id}`);
                    console.log(`  Event time:  ${new Date(eventTime).toISOString()}`);
                    console.log(`  Local time:  ${new Date(localTime).toISOString()}`);
                    console.log(`  Delta:       ${((localTime - eventTime) / 1000).toFixed(1)}s newer`);
                    return;
                }
                
                console.log(`✅ Card LWW: Apply newer event`);
                console.log(`  Event time:  ${new Date(eventTime).toISOString()}`);
                console.log(`  Local time:  ${new Date(localTime).toISOString()}`);
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
                console.log(`🔄 Card ${cardProps.id} ist für Background Board ${targetBoardId} - direkter localStorage Update`);
                boardStore.upsertCardToBackgroundBoard(targetBoardId, cardProps);
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
        console.log('🗑️ Deletion-Event erhalten:', deletionEvent.id);
        
        // ⚡ v2.0: Event-Deduplication
        if (this.processedEvents.has(deletionEvent.id)) {
            console.log('⏩ Deletion-Event already processed, skip');
            return;
        }
        
        this.processedEvents.add(deletionEvent.id);
        
        try {
            // NIP-09: Parse 'a' tags für replaceable events
            // Format: ['a', '30301:pubkey:board-id'] oder ['a', '30302:pubkey:card-id']
            const aTags = deletionEvent.tags.filter((t: any) => t[0] === 'a');
            const deleteTime = deletionEvent.created_at * 1000; // Millisekunden
            
            for (const aTag of aTags) {
                const eventRef = aTag[1]; // z.B. "30301:pubkey:board-xxx" oder "30302:pubkey:card-xxx"
                
                // ===== BOARD DELETION =====
                if (eventRef && eventRef.startsWith('30301:')) {
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const boardId = parts.slice(2).join(':');
                        
                        // Track deletion timestamp (für Ordering)
                        this.boardDeletionTimestamps.set(boardId, deleteTime);
                        console.log(`🗑️ Tracked deletion timestamp for board ${boardId}: ${new Date(deleteTime).toISOString()}`);
                        
                        // ⚡ v2.0: Direkte Store-API (SECONDARY action)
                        boardStore.deleteBoardFromNostr(boardId);
                        console.log(`✅ Called boardStore.deleteBoardFromNostr(${boardId})`);
                    }
                }
                
                // ===== CARD DELETION =====
                else if (eventRef && eventRef.startsWith('30302:')) {
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const cardId = parts.slice(2).join(':');
                        
                        // Track deletion timestamp (für Ordering)
                        this.cardDeletionTimestamps.set(cardId, deleteTime);
                        console.log(`🗑️ Tracked deletion timestamp for card ${cardId}: ${new Date(deleteTime).toISOString()}`);
                        
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
                console.log(`[NostrIntegration] 🔑 Board Event-ID captured: ${board.eventId}`);
                
                // ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
                // Grund: saveBoard() wurde bereits vor publishBoard() aufgerufen
                // → eventId muss nachträglich gespeichert werden
                const { BoardStorage } = await import('./storage.js');
                await BoardStorage.saveBoard(board);
                console.log(`[NostrIntegration] 💾 Board with eventId saved to localStorage`);
            } else {
                console.log(`[NostrIntegration] ⚠️ Board Event-ID not available (event queued or local-only)`);
            }
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

            // ⚠️ SICHERHEITS-CHECK: Warne wenn Draft nicht publiziert werden kann
            if (normalizedState === 'draft' && targetRelays.length === 0) {
                const mode = settingsStore.settings.draftPublishingMode;
                
                if (mode === 'private-relays') {
                    toast.warning('🔒 Keine privaten Relays konfiguriert', {
                        description: 'Karten-Änderungen werden nur lokal gespeichert. Gehe zu Einstellungen → Nostr → Private Relays um Synchronisation zu aktivieren.',
                        duration: 6000
                    });
                    console.warn('[NostrIntegration] 🔒 Draft card cannot be published - no private relays configured');
                }
            }

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
                console.log(`[NostrIntegration] 🔑 Card Event-ID captured: ${card.eventId}`);
                
                // ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
                const { BoardStorage } = await import('./storage.js');
                await BoardStorage.saveBoard(board);
                console.log(`[NostrIntegration] 💾 Card with eventId saved to localStorage`);
            } else {
                console.log(`[NostrIntegration] ⚠️ Card Event-ID not available (event queued or local-only)`);
            }

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
            // ⚡ NEU: Include actual event ID if available!
            const deletionEvent = createDeletionEvent(
                boardEventId,
                true, // isReplaceableEvent = true für Kind 30301
                `Board "${board.name}" deleted`,
                this.ndk,
                board.eventId // ← NEU: Actual event ID for relay deletion!
            );
            
            // 🔍 DEBUG: Log deletion event details
            console.log('[NostrIntegration] 📋 Board Deletion Event Details:');
            console.log('  Kind:', deletionEvent.kind);
            console.log('  Pubkey (signer):', deletionEvent.pubkey || 'NOT SIGNED YET');
            console.log('  Board Author:', board.author);
            console.log('  Board Event ID:', board.eventId || 'NOT SET');
            console.log('  ⚠️ MATCH?:', (deletionEvent.pubkey === board.author) ? '✅ YES' : '❌ NO - DELETION WILL FAIL!');
            console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
            console.log('  Content:', deletionEvent.content);
            console.log('  Target Board ID:', boardEventId);

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

            // ⚡ NIP-09: Relay handled board deletion automatically
            // Keine lokale localStorage-Tracking mehr nötig!

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
            const cardEventIdentifier = `30302:${card.author || 'unknown'}:${card.id}`;
            
            console.log(`[NostrIntegration] 🗑️ Deleting card on Nostr: ${card.heading} (${cardEventIdentifier})`);

            // 2. WICHTIG: Versuche zuerst, das Event vom Relay zu fetchen, um die echte Event-ID zu bekommen
            let actualEventId: string | undefined = undefined;
            try {
                const existingEvent = await this.ndk.fetchEvent({
                    kinds: [30302] as number[],
                    authors: [card.author || ''],
                    '#d': [card.id]
                });
                
                if (existingEvent?.id) {
                    actualEventId = existingEvent.id;
                    console.log(`[NostrIntegration] 🎯 Found actual event ID: ${actualEventId}`);
                } else {
                    console.warn(`[NostrIntegration] ⚠️ Card event not found on relay - deletion may not work`);
                }
            } catch (fetchError) {
                console.warn('[NostrIntegration] ⚠️ Could not fetch card event:', fetchError);
            }

            // 3. Erstelle Deletion Event (Kind 5)
            // NIP-09: Replaceable events (Kind 30302) brauchen 'a' tags UND möglicherweise 'e' tags
            const deletionEvent = createDeletionEvent(
                cardEventIdentifier,
                true, // isReplaceableEvent = true für Kind 30302
                `Card "${card.heading}" deleted`,
                this.ndk,
                actualEventId // ← NEU: Übergebe echte Event-ID falls vorhanden
            );
            
            // 🔍 DEBUG: Log deletion event details
            console.log('[NostrIntegration] 📋 Deletion Event Details:');
            console.log('  Kind:', deletionEvent.kind);
            console.log('  Pubkey (signer):', deletionEvent.pubkey || 'NOT SIGNED YET');
            console.log('  Card Author:', card.author);
            console.log('  ⚠️ MATCH?:', (deletionEvent.pubkey === card.author) ? '✅ YES' : '❌ NO - DELETION WILL FAIL!');
            console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
            console.log('  Content:', deletionEvent.content);
            console.log('  Target Card Identifier:', cardEventIdentifier);
            console.log('  Actual Event ID:', actualEventId || 'NOT FOUND');

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
