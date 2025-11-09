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
     * Subscribed zu Board- und Card-Updates
     * 
     * ⚠️ WICHTIG: Für kollaborative Boards - empfange Events von ALLEN Teilnehmern!
     * - Board-Events (Kind 30301): Von author + maintainers
     * - Card-Events (Kind 30302): Alle mit #a-Tag auf dieses Board
     */
    public subscribeToUpdates(
        currentBoard: Board,
        boardIds: string[],
        onBoardUpdate: (boardProps: any, isNewBoard: boolean) => void,
        onCardUpdate: (cardProps: any) => void,
        onBoardDeletion?: (boardId: string) => void
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

        console.log('[BoardStore] 🛰️ Subscribing to board, card AND deletion events (collaborative mode)');

        // ⚠️ Filtere nach Boards/Cards die der User erstellt hat
        // Für Collaboration: Später könnten wir auch nach #p-tags (maintainers) filtern
        const sub = this.ndk.subscribe(
            {
                kinds: [30301, 30302, 5] as number[], // ← FIX: Kind 5 hinzugefügt!
                authors: [pubkey] // Boards und Cards die dieser User erstellt hat
            } as any,
            { closeOnEose: false }
        );

        sub.on('event', async (event: any) => {
            if (event.kind === 30301) {
                // ===== BOARD-EVENT HANDLER =====
                await this.handleBoardEvent(event, currentBoard, boardIds, onBoardUpdate);
            } else if (event.kind === 30302) {
                // ===== CARD-EVENT HANDLER =====
                await this.handleCardEvent(event, currentBoard, onCardUpdate);
            } else if (event.kind === 5) {
                // ===== DELETION-EVENT HANDLER =====
                await this.handleDeletionEvent(event, boardIds, onBoardDeletion);
            }
        });

        this.boardSubscription = sub;
    }

    /**
     * Handler für Board-Events (Kind 30301)
     */
    private async handleBoardEvent(
        boardEvent: any,
        currentBoard: Board,
        boardIds: string[],
        onBoardUpdate: (boardProps: any, isNewBoard: boolean) => void
    ): Promise<void> {
        console.log('📥 Board-Event erhalten:', boardEvent.id);
        
        try {
            // Deserialisiere Board-Event
            const { nostrEventToBoard } = await import('../../utils/nostrEvents.js');
            const boardProps = nostrEventToBoard(boardEvent);
            
            // Validierung: Board muss eine ID haben
            if (!boardProps.id) {
                console.warn('⚠️ Board-Event hat keine ID - skip');
                return;
            }
            
            // ⚡ RACE CONDITION FIX v2: Fetch aktuelle Cards vom Relay
            // Problem: Board-Event enthält alte Card-Daten (vor Deletion)
            // Lösung: Prüfe für jede Card ob sie wirklich auf dem Relay existiert
            console.log(`🛡️ Validating cards with relay... (checking ${boardProps.columns?.reduce((sum, col) => sum + (col.cards?.length || 0), 0) || 0} cards)`);
            
            if (this.ndk && boardProps.columns && boardProps.author) {
                const boardRef = `30301:${boardProps.author}:${boardProps.id}`;
                
                try {
                    // Fetch alle aktuell existierenden Card-Events für dieses Board vom Relay
                    const cardFilter = {
                        kinds: [30302],
                        '#a': [boardRef]
                    };
                    
                    const existingCardEvents = await this.ndk.fetchEvents(cardFilter as any);
                    const existingCardIds = new Set(
                        Array.from(existingCardEvents || [])
                            .map((evt: any) => {
                                const dTag = evt.tags.find((t: any) => t[0] === 'd');
                                return dTag ? dTag[1] : null;
                            })
                            .filter((id: any) => id !== null)
                    );
                    
                    console.log(`🛡️ Relay has ${existingCardIds.size} card(s) for this board`);
                    console.log(`🛡️ Existing card IDs:`, Array.from(existingCardIds));
                    
                    // Filter Cards: Nur die behalten, die wirklich auf dem Relay existieren
                    let filteredCount = 0;
                    for (const column of boardProps.columns) {
                        if (column.cards && Array.isArray(column.cards)) {
                            const originalLength = column.cards.length;
                            
                            column.cards = column.cards.filter(c => {
                                if (!c.id) {
                                    console.log(`🛡️ ⚠️ Card without ID found - keeping it`);
                                    return true;
                                }
                                
                                const exists = existingCardIds.has(c.id);
                                if (!exists) {
                                    console.log(`🛡️ ❌ Card ${c.id} not on relay - filtering out (deleted)`);
                                    filteredCount++;
                                }
                                return exists;
                            });
                            
                            const removed = originalLength - column.cards.length;
                            if (removed > 0) {
                                console.log(`🛡️ Removed ${removed} deleted card(s) from column "${column.name}"`);
                            }
                        }
                    }
                    
                    if (filteredCount > 0) {
                        console.log(`🛡️✅ Filtered ${filteredCount} deleted card(s) via relay validation`);
                    } else {
                        console.log(`🛡️ℹ️ All cards exist on relay - no filtering needed`);
                    }
                } catch (fetchError) {
                    console.warn(`🛡️ ⚠️ Failed to validate cards with relay:`, fetchError);
                    // Fallback: Continue with Board-Event data
                }
            }
            
            // ⚡ RELAY FILTERT GELÖSCHTE BOARDS: Keine lokale Deletion-Prüfung nötig!
            // Relay gibt per NIP-09 nur nicht-gelöschte Events zurück
            
            // Prüfe ob dieses Board schon in der Liste ist
            const isExisting = boardIds.includes(boardProps.id);
            const isActiveBoard = currentBoard.id === boardProps.id;
            
            if (isExisting) {
                console.log(`✅ Board ${boardProps.id} already in list`);
                
                if (isActiveBoard) {
                    console.log(`🔄 Updating active board metadata from Nostr...`);
                    // Callback für Update (nicht für neues Board)
                    onBoardUpdate(boardProps, false);
                }
                return;
            }
            
            // Neues Board! 
            console.log(`✨ New board detected: ${boardProps.name}`);
            onBoardUpdate(boardProps, true);
            
        } catch (error) {
            console.error(`❌ Error processing board event:`, error);
        }
    }

    /**
     * Handler für Card-Events (Kind 30302)
     */
    private async handleCardEvent(
        cardEvent: any,
        currentBoard: Board,
        onCardUpdate: (cardProps: any) => void
    ): Promise<void> {
        console.log('📥 Card-Event erhalten:', cardEvent.id);
        
        try {
            // Deserialisiere Card-Event
            const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
            const cardProps = nostrEventToCard(cardEvent);
            
            // ⚡ RELAY FILTERT GELÖSCHTE CARDS: Keine lokale Deletion-Prüfung nötig!
            // Relay gibt per NIP-09 nur nicht-gelöschte Events zurück
            
            // Validierung: Gehört die Karte zu diesem Board?
            if (cardProps.boardRef) {
                const expectedBoardRef = `30301:${currentBoard.author}:${currentBoard.id}`;
                if (cardProps.boardRef !== expectedBoardRef) {
                    console.warn(`⚠️ Card ${cardProps.id} gehört zu anderem Board: ${cardProps.boardRef}`);
                    return;
                }
            }
            
            // columnId ist KRITISCH - ohne geht nichts!
            if (!cardProps.columnId) {
                console.error(`❌ Card ${cardProps.id} hat keine columnId!`);
                return;
            }
            
            // Callback mit den Card-Props
            onCardUpdate(cardProps);
            
        } catch (error) {
            console.error(`❌ Error processing card event:`, error);
        }
    }

    // ⚠️ Track recently deleted cards (in-memory only, for this session)
    // Prevents race condition: Deletion event arrives → Board event with old data arrives → Old data restored
    private recentlyDeletedCards = new Set<string>();
    
    /**
     * Handler für Deletion-Events (Kind 5)
     * 
     * Wird aufgerufen wenn ein Board ODER Card gelöscht wurde (via subscription).
     * Entfernt das Element aus der Liste UND cleared den localStorage-Cache!
     * 
     * NIP-09: Replaceable Events (Kind 30301/30302) werden via 'a' tags referenziert
     * 
     * ⚡ CACHE INVALIDATION STRATEGY:
     * - Deletion event received → Clear from localStorage immediately
     * - Track deleted card IDs in-memory (session only)
     * - Board event handler checks deleted cards → won't restore them
     * - Relay won't return deleted events on next fetch
     * - Cache stays in sync with relay state
     */
    private async handleDeletionEvent(
        deletionEvent: any,
        boardIds: string[],
        onBoardDeletion?: (boardId: string) => void
    ): Promise<void> {
        console.log('🗑️ Deletion-Event erhalten:', deletionEvent.id);
        
        try {
            // NIP-09: Parse 'a' tags für replaceable events
            // Format: ['a', '30301:pubkey:board-id'] oder ['a', '30302:pubkey:card-id']
            const aTags = deletionEvent.tags.filter((t: any) => t[0] === 'a');
            
            for (const aTag of aTags) {
                const eventRef = aTag[1]; // z.B. "30301:pubkey:board-xxx" oder "30302:pubkey:card-xxx"
                
                // ===== BOARD DELETION =====
                if (eventRef && eventRef.startsWith('30301:')) {
                    // Extrahiere board-id (alles nach dem zweiten ":")
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const boardId = parts.slice(2).join(':'); // board-xxx
                        
                        console.log(`🗑️ Board ${boardId} wurde gelöscht - clearing cache...`);
                        
                        // ⚡ CACHE INVALIDATION: Clear localStorage for this board
                        if (typeof window !== 'undefined') {
                            const storageKey = `kanban-board-${boardId}`;
                            const existed = localStorage.getItem(storageKey) !== null;
                            
                            if (existed) {
                                localStorage.removeItem(storageKey);
                                console.log(`🗑️✅ Cleared board cache: ${storageKey}`);
                            } else {
                                console.log(`🗑️ℹ️ Board cache already gone: ${storageKey}`);
                            }
                        }
                        
                        // Callback aufrufen um Board aus Liste zu entfernen
                        if (onBoardDeletion) {
                            onBoardDeletion(boardId);
                        }
                    }
                }
                
                // ===== CARD DELETION =====
                else if (eventRef && eventRef.startsWith('30302:')) {
                    // Extrahiere card-id (alles nach dem zweiten ":")
                    const parts = eventRef.split(':');
                    if (parts.length >= 3) {
                        const cardId = parts.slice(2).join(':'); // card-xxx
                        
                        console.log(`🗑️ Card ${cardId} wurde gelöscht - clearing cache...`);
                        
                        // ⚡ Track deleted card ID (in-memory, session only)
                        // Prevents race condition with Board events
                        this.recentlyDeletedCards.add(cardId);
                        console.log(`🗑️ Marked card ${cardId} as recently deleted (prevents restore)`);
                        
                        // ⚡ Clear from tracking after 5 seconds (enough time for race condition window)
                        setTimeout(() => {
                            this.recentlyDeletedCards.delete(cardId);
                            console.log(`⏱️ Cleared ${cardId} from recently deleted tracking (after 5s)`);
                        }, 5000);
                        
                        // ⚡ CACHE INVALIDATION: Clear card from ALL board caches
                        // (Karte könnte theoretisch in mehreren Board-Caches sein)
                        if (typeof window !== 'undefined') {
                            const boardKeys = Object.keys(localStorage)
                                .filter(k => k.startsWith('kanban-board-'));
                            
                            let clearedCount = 0;
                            
                            for (const key of boardKeys) {
                                try {
                                    const rawData = localStorage.getItem(key);
                                    if (!rawData) continue;
                                    
                                    const boardData = JSON.parse(rawData);
                                    
                                    // Check if board has columns with cards
                                    if (boardData.columns && Array.isArray(boardData.columns)) {
                                        let modified = false;
                                        
                                        for (const column of boardData.columns) {
                                            if (column.cards && Array.isArray(column.cards)) {
                                                const originalLength = column.cards.length;
                                                column.cards = column.cards.filter((c: any) => c.id !== cardId);
                                                
                                                if (column.cards.length < originalLength) {
                                                    modified = true;
                                                    console.log(`🗑️ Removed card ${cardId} from column "${column.name}" in board cache: ${key}`);
                                                }
                                            }
                                        }
                                        
                                        // Wenn Cards entfernt wurden, speichere aktualisierte Version
                                        if (modified) {
                                            localStorage.setItem(key, JSON.stringify(boardData));
                                            clearedCount++;
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`⚠️ Failed to clean card cache from ${key}:`, e);
                                }
                            }
                            
                            if (clearedCount > 0) {
                                console.log(`🗑️✅ Cleared card ${cardId} from ${clearedCount} board cache(s)`);
                            } else {
                                console.log(`🗑️ℹ️ Card ${cardId} not found in any board caches`);
                            }
                        }
                        
                        // Note: Card-Deletion wird vom kanbanStore via onCardUpdate gehandhabt
                        // Der Cache ist jetzt bereits cleared!
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
            // NIP-09: Replaceable events (Kind 30301) brauchen 'a' tags, nicht 'e' tags
            const deletionEvent = createDeletionEvent(
                boardEventId,
                true, // isReplaceableEvent = true für Kind 30301
                `Board "${board.name}" deleted`,
                this.ndk
            );
            
            // 🔍 DEBUG: Log deletion event details
            console.log('[NostrIntegration] 📋 Board Deletion Event Details:');
            console.log('  Kind:', deletionEvent.kind);
            console.log('  Pubkey (signer):', deletionEvent.pubkey || 'NOT SIGNED YET');
            console.log('  Board Author:', board.author);
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
