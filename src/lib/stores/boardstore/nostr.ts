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
            // NIP-09: Replaceable Events (Kind 30301) werden via 'a' tags referenziert
            if (deletionEvents && deletionEvents.size > 0) {
                console.log('[BoardStore] 🗑️ Found', deletionEvents.size, 'deletion events on relay');
                for (const delEvent of deletionEvents) {
                    // NIP-09: Parse 'a' tags für replaceable events
                    // Format: ['a', '30301:pubkey:board-id']
                    const aTags = delEvent.tags.filter(t => t[0] === 'a');
                    for (const aTag of aTags) {
                        const eventRef = aTag[1]; // z.B. "30301:pubkey:board-xxx"
                        if (eventRef && eventRef.startsWith('30301:')) {
                            // Extrahiere board-id (alles nach dem zweiten ":")
                            const parts = eventRef.split(':');
                            if (parts.length >= 3) {
                                const boardId = parts.slice(2).join(':'); // board-xxx
                                const wasAlreadyDeleted = deletedBoardIds.has(boardId);
                                deletedBoardIds.add(boardId);
                                if (!wasAlreadyDeleted) {
                                    console.log('[BoardStore] 🗑️ Found deleted board:', boardId);
                                }
                            }
                        }
                    }
                }
                console.log('[BoardStore] 🗑️ Total unique deleted boards:', deletedBoardIds.size);
                console.log('[BoardStore] 🗑️ Deleted board IDs:', Array.from(deletedBoardIds).map(id => id.substring(0, 20) + '...'));
            }

            // 4. PRE-CLEANUP: Lösche gelöschte Boards AUS localStorage BEVOR wir sie laden!
            if (typeof window !== 'undefined' && deletedBoardIds.size > 0) {
                let preCleanedCount = 0;
                for (const deletedId of deletedBoardIds) {
                    const key = `kanban-${deletedId}`;
                    if (localStorage.getItem(key)) {
                        localStorage.removeItem(key);
                        preCleanedCount++;
                        console.log('[BoardStore] 🗑️ Pre-cleanup: Removed deleted board from localStorage:', deletedId);
                    }
                }
            if (preCleanedCount > 0) {
                console.log(`[BoardStore] ✅ Pre-cleanup: Removed ${preCleanedCount} deleted board(s) from localStorage`);
            }
        }

        // 5. Initialisiere loadedBoardIds - filtere gelöschte Boards AUS!
        const loadedBoardIds = boardIds.filter(id => !deletedBoardIds.has(id));
        console.log('[BoardStore] 🔍 Initial boardIds from store:', boardIds.length, boardIds.map(id => id.substring(0, 20) + '...'));
        console.log('[BoardStore] 🔍 After filtering deleted:', loadedBoardIds.length, loadedBoardIds.map(id => id.substring(0, 20) + '...'));
        if (loadedBoardIds.length < boardIds.length) {
            console.log(`[BoardStore] 🗑️ Filtered ${boardIds.length - loadedBoardIds.length} deleted board(s) from initial board list`);
        }
        
        // 6. Sammle Board-IDs die auf dem Relay existieren
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

                    // 6a. Skip wenn Board gelöscht wurde (sollte schon aus loadedBoardIds gefiltert sein)
                    if (deletedBoardIds.has(board.id)) {
                        console.log('[BoardStore] ⏩ Skipping deleted board:', board.id);
                        continue;
                    }
                    
                    // 6b. Merke dass dieses Board auf dem Relay existiert (NUR nicht-gelöschte!)
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
                        // NUR hinzufügen wenn NICHT gelöscht!
                        if (!loadedBoardIds.includes(board.id) && !deletedBoardIds.has(board.id)) {
                            loadedBoardIds.push(board.id);
                            console.log('[BoardStore] ✅ Added local board to loadedBoardIds:', board.id);
                        } else if (deletedBoardIds.has(board.id)) {
                            console.log('[BoardStore] 🗑️ NOT adding deleted board to loadedBoardIds:', board.id);
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

                    // NUR hinzufügen wenn NICHT gelöscht!
                    if (!loadedBoardIds.includes(board.id) && !deletedBoardIds.has(board.id)) {
                        loadedBoardIds.push(board.id);
                        console.log('[BoardStore] ✅ Added remote board to loadedBoardIds:', board.id);
                    } else if (deletedBoardIds.has(board.id)) {
                        console.log('[BoardStore] 🗑️ NOT adding deleted remote board to loadedBoardIds:', board.id);
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
                    if (k === 'nostr-deleted-boards') return false;
                    
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

            // Lade gelöschte Card-IDs aus localStorage
            let deletedCardIds = new Set<string>();
            if (typeof window !== 'undefined') {
                const localCardDeletions = localStorage.getItem('nostr-deleted-cards');
                if (localCardDeletions) {
                    try {
                        const deletedIds = JSON.parse(localCardDeletions);
                        if (Array.isArray(deletedIds)) {
                            deletedCardIds = new Set(deletedIds);
                            console.log('[BoardStore] 🗑️ Found', deletedCardIds.size, 'deleted card(s) in localStorage');
                        }
                    } catch (e) {
                        console.warn('[BoardStore] Failed to parse deleted cards:', e);
                    }
                }
            }

            // Deserialisiere alle Card-Events
            const { nostrEventToCard } = await import('../../utils/nostrEvents.js');
            
            let loadedCount = 0;
            let skippedCount = 0;
            
            for (const cardEvent of cardEvents) {
                try {
                    const cardProps = nostrEventToCard(cardEvent);
                    
                    // 🗑️ SKIP: Wenn Card gelöscht wurde
                    if (cardProps.id && deletedCardIds.has(cardProps.id)) {
                        console.log('[BoardStore] 🗑️ Skipping deleted card:', cardProps.heading);
                        skippedCount++;
                        continue;
                    }
                    
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

            console.log('[BoardStore] ✅ Finished loading cards for board:', board.name, `(${loadedCount} loaded, ${skippedCount} skipped)`);
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
            
            // 🗑️ KRITISCH: Prüfe ob Board gelöscht wurde BEVOR wir es hinzufügen!
            let deletedBoardIds = new Set<string>();
            if (typeof window !== 'undefined') {
                const localDeletions = localStorage.getItem('nostr-deleted-boards');
                if (localDeletions) {
                    try {
                        const deletedIds = JSON.parse(localDeletions);
                        if (Array.isArray(deletedIds)) {
                            deletedBoardIds = new Set(deletedIds);
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            
            // Skip wenn Board gelöscht wurde!
            if (deletedBoardIds.has(boardProps.id)) {
                console.log(`🗑️ SKIP: Board ${boardProps.name} ist gelöscht - wird NICHT hinzugefügt`);
                return;
            }
            
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
            
            // 🗑️ KRITISCH: Prüfe ob Card gelöscht wurde BEVOR wir sie verarbeiten!
            let deletedCardIds = new Set<string>();
            if (typeof window !== 'undefined') {
                const localCardDeletions = localStorage.getItem('nostr-deleted-cards');
                if (localCardDeletions) {
                    try {
                        const deletedIds = JSON.parse(localCardDeletions);
                        if (Array.isArray(deletedIds)) {
                            deletedCardIds = new Set(deletedIds);
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            
            // Skip wenn Card gelöscht wurde!
            if (cardProps.id && deletedCardIds.has(cardProps.id)) {
                console.log(`🗑️ SKIP: Card ${cardProps.heading} ist gelöscht - wird NICHT verarbeitet`);
                return;
            }
            
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

    /**
     * Handler für Deletion-Events (Kind 5)
     * 
     * Wird aufgerufen wenn ein Board ODER Card gelöscht wurde (via subscription).
     * Entfernt das Element aus der Liste und speichert die Deletion lokal.
     * 
     * NIP-09: Replaceable Events (Kind 30301/30302) werden via 'a' tags referenziert
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
                        
                        console.log(`🗑️ Board ${boardId} wurde gelöscht - entferne aus Liste`);
                        
                        // Speichere Deletion lokal (für Offline-Persistenz)
                        if (typeof window !== 'undefined') {
                            const localDeletions = localStorage.getItem('nostr-deleted-boards');
                            let deletedIds: string[] = [];
                            
                            if (localDeletions) {
                                try {
                                    deletedIds = JSON.parse(localDeletions);
                                } catch {
                                    deletedIds = [];
                                }
                            }
                            
                            if (!deletedIds.includes(boardId)) {
                                deletedIds.push(boardId);
                                localStorage.setItem('nostr-deleted-boards', JSON.stringify(deletedIds));
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
                        
                        console.log(`🗑️ Card ${cardId} wurde gelöscht - speichere lokal`);
                        
                        // Speichere Card-Deletion lokal (für Offline-Persistenz)
                        if (typeof window !== 'undefined') {
                            const localCardDeletions = localStorage.getItem('nostr-deleted-cards');
                            let deletedCardIds: string[] = [];
                            
                            if (localCardDeletions) {
                                try {
                                    deletedCardIds = JSON.parse(localCardDeletions);
                                } catch {
                                    deletedCardIds = [];
                                }
                            }
                            
                            if (!deletedCardIds.includes(cardId)) {
                                deletedCardIds.push(cardId);
                                localStorage.setItem('nostr-deleted-cards', JSON.stringify(deletedCardIds));
                                console.log(`🗑️ Card ${cardId} zur Deletion-Liste hinzugefügt`);
                            }
                        }
                        
                        // Note: Card-Deletion wird vom kanbanStore via onCardUpdate gehandhabt
                        // Der Card-Handler wird die Deletion beim nächsten Event checken
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
            // NIP-09: Replaceable events (Kind 30302) brauchen 'a' tags, nicht 'e' tags
            const deletionEvent = createDeletionEvent(
                cardEventId,
                true, // isReplaceableEvent = true für Kind 30302
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
