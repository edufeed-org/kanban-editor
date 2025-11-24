// src/lib/stores/boardstore/nostr.ts
// Nostr-Integration und Event-Publishing

import type { Board, Card, Comment } from '../../classes/BoardModel.js';
import type { BoardProps, ColumnProps } from '../../classes/BoardModel.js';
import { boardToNostrEvent, cardToNostrEvent, createCommentEvent, createDeletionEvent } from '../../utils/nostrEvents.js';
import { generateDTag } from '../../utils/idGenerator.js';
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
    private commentSubscriptions = new Map<string, any>(); // cardId -> subscription

    // ⚡ NEU (v2.0): Event-Deduplication für Event-Driven Architecture
    private processedEvents = new Set<string>();
    
    // ⚡ NEU (v2.0): Deletion-Timestamp-Tracking für Out-of-Order Events
    private cardDeletionTimestamps = new Map<string, number>();
    private boardDeletionTimestamps = new Map<string, number>();
    
    // ⚡ OPTIMIZATION (Nov 2025): Persistent Deletion Event Tracking
    // Stores processed deletion event IDs to prevent re-processing after app restart
    private static DELETION_EVENTS_STORAGE_KEY = 'nostr-processed-deletions';
    private processedDeletionEvents = new Set<string>();

    // 🚀 NEW (Phase 3): IndexedDB Cache für Comments
    private static COMMENTS_STORAGE_PREFIX = 'nostr-comments-';

    /**
     * 🚀 Phase 3: Save comments to localStorage cache
     * Provides instant access to comments without network delay
     */
    private saveCommentsToStorage(cardId: string, comments: Comment[]): void {
        try {
            const key = `${NostrIntegration.COMMENTS_STORAGE_PREFIX}${cardId}`;
            const data = JSON.stringify(comments);
            localStorage.setItem(key, data);
            console.debug(`💾 Saved ${comments.length} comment(s) to cache`);
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Failed to save comments to cache:', error);
        }
    }

    /**
     * 🚀 Phase 3: Load comments from localStorage cache
     * Returns cached comments instantly, no network delay
     */
    private loadCommentsFromStorage(cardId: string): Comment[] {
        try {
            const key = `${NostrIntegration.COMMENTS_STORAGE_PREFIX}${cardId}`;
            const data = localStorage.getItem(key);
            
            if (!data) {
                return [];
            }
            
            const comments = JSON.parse(data) as Comment[];
            console.debug(`💿 Loaded ${comments.length} comment(s) from cache`);
            return comments;
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Failed to load comments from cache:', error);
            return [];
        }
    }

    /**
     * 🚀 Phase 3: Clear comments cache for a card
     */
    private clearCommentsCache(cardId: string): void {
        try {
            const key = `${NostrIntegration.COMMENTS_STORAGE_PREFIX}${cardId}`;
            localStorage.removeItem(key);
            console.log(`🗑️ Cleared comment cache for card ${cardId}`);
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Failed to clear cache:', error);
        }
    }
    
    /**
     * ⚡ OPTIMIZATION: Load processed deletion events from localStorage
     * Prevents re-processing deletion events after app restart
     */
    private loadProcessedDeletions(): void {
        try {
            const stored = localStorage.getItem(NostrIntegration.DELETION_EVENTS_STORAGE_KEY);
            if (stored) {
                const deletions = JSON.parse(stored) as string[];
                this.processedDeletionEvents = new Set(deletions);
                console.log(`💿 Loaded ${deletions.length} processed deletion event(s) from cache`);
            }
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Failed to load processed deletions:', error);
            this.processedDeletionEvents = new Set();
        }
    }
    
    /**
     * ⚡ OPTIMIZATION: Save processed deletion events to localStorage
     * Limits to last 1000 events to prevent unbounded growth
     */
    private saveProcessedDeletions(): void {
        try {
            // Limit to last 1000 deletion events (FIFO)
            const deletions = Array.from(this.processedDeletionEvents);
            const limited = deletions.slice(-1000); // Keep only last 1000
            
            localStorage.setItem(
                NostrIntegration.DELETION_EVENTS_STORAGE_KEY,
                JSON.stringify(limited)
            );
            
            // Update Set with limited data
            this.processedDeletionEvents = new Set(limited);
        } catch (error) {
            console.warn('[NostrIntegration] ⚠️ Failed to save processed deletions:', error);
        }
    }

    /**
     * Initialisiert Nostr Integration
     */
    public async initialize(ndk: NDK, onBoardLoad?: () => Promise<void>): Promise<void> {
        this.ndk = ndk;
        console.log('[BoardStore] ✅ Nostr initialized - SyncManager ready');
        
        // ⚡ Load processed deletions from localStorage
        this.loadProcessedDeletions();

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
                            
                            // 🔥 FIX: Berücksichtige AUCH lastAccessedAt beim Timestamp-Vergleich!
                            // Verhindert dass Nostr-Load neuere lokale lastAccessedAt überschreibt
                            const localTs = existing.lastAccessedAt
                                ? (typeof existing.lastAccessedAt === 'string' 
                                    ? new Date(existing.lastAccessedAt).getTime()
                                    : existing.lastAccessedAt)
                                : existing.updatedAt
                                    ? new Date(existing.updatedAt).getTime()
                                    : existing.createdAt
                                        ? new Date(existing.createdAt).getTime()
                                        : 0;
                            
                            const remoteTs = event.created_at ? event.created_at * 1000 : Date.now();
                            if (localTs && localTs > remoteTs) {
                                acceptRemote = false;
                                console.log(`[BoardStore] ↩️ Keep newer local board (lastAccessedAt: ${new Date(localTs).toISOString()}) - skip remote (createdAt: ${new Date(remoteTs).toISOString()})`);
                            }
                        } catch {
                            acceptRemote = true;
                        }
                    }

                    if (!acceptRemote) {
                        // console.log(`[BoardStore] ↩️ Keep newer local board for ${board.id}, skip remote version`);
                        // Relay gibt nur nicht-gelöschte Boards zurück - keine Deletion-Checks nötig
                        if (!loadedBoardIds.includes(board.id)) {
                            loadedBoardIds.push(board.id);
                            // console.log('[BoardStore] ✅ Added local board to loadedBoardIds:', board.id);
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
                        // console.log('[BoardStore] 💾 Stored Nostr board from remote:', storageKey);
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

        // ⚡ OPTIMIZATION: Filtere alte Deletion Events aus (nur letzte 7 Tage)
        // Verhindert, dass hunderte alte Deletion Events bei jedem Start verarbeitet werden
        const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        
        // ⚠️ Filtere nach Boards/Cards die der User erstellt hat
        // Für Collaboration: Später könnten wir auch nach #p-tags (maintainers) filtern
        const sub = this.ndk.subscribe(
            {
                kinds: [30301, 30302, 5] as number[], // Board, Card, Deletion
                authors: [pubkey], // Boards und Cards die dieser User erstellt hat
                since: sevenDaysAgo // ⚡ OPTIMIZATION: Nur Events der letzten 7 Tage
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

        // =============================================================
        // ⭐ NEU (Board-Sharing v1): Separate subscription für geteilte Boards
        //    Holt Board-Events (Kind 30301), bei denen der aktuelle Nutzer
        //    als p-tag (Maintainer/Viewer) eingetragen ist, aber NICHT Author ist.
        //    Dadurch taucht ein neu geteiltes Board unmittelbar in der Liste auf,
        //    ohne Polling oder manuelles Reload.
        // =============================================================
        const sharedSub = this.ndk.subscribe(
            {
                kinds: [30301] as number[],
                '#p': [pubkey], // Nutzer muss als p-tag gelistet sein
                since: sevenDaysAgo
            } as any,
            { closeOnEose: false }
        );

        sharedSub.on('event', async (event: any) => {
            try {
                // Dedup + Guards
                if (event.kind !== 30301) return;
                if (event.pubkey === pubkey) return; // eigene Events ignorieren
                if (this.processedEvents.has(event.id)) return;

                // Extrahiere Basisdaten
                const dTag = event.tags.find((t: any) => t[0] === 'd')?.[1];
                const title = event.tags.find((t: any) => t[0] === 'title')?.[1];
                const description = event.tags.find((t: any) => t[0] === 'description')?.[1];
                if (!dTag || !title) return; // Ungültiges Event

                // Teilnehmer (p-tags) extrahieren
                const pTagsAll = event.tags.filter((t: any) => t[0] === 'p').map((t: any) => t[1]);
                // Kanonischer Owner = erster p-tag falls vorhanden, sonst Publisher
                const canonicalOwner = pTagsAll.length > 0 ? pTagsAll[0] : event.pubkey;
                // Rolle relativ zum kanonischen Owner bestimmen
                let userRole = 'viewer';
                if (canonicalOwner === pubkey) {
                    userRole = 'owner';
                } else if (pTagsAll.includes(pubkey)) {
                    userRole = 'editor';
                }

                // Spalten (optional) aus Tags extrahieren
                const columnTags = event.tags.filter((t: any) => t[0] === 'col');
                const columns: ColumnProps[] = columnTags.map((t: any) => ({
                    id: t[1],
                    name: t[2] || 'Column',
                    color: t[4] || undefined,
                    cards: []
                }));

                // BoardProps aus Event ableiten und in Store upserten (persistiert + ID-Liste aktualisierbar)
                const boardProps: BoardProps = {
                    id: dTag,
                    eventId: event.id,
                    name: title,
                    description: description || undefined,
                    columns: columns,
                    author: canonicalOwner,
                    maintainers: pTagsAll.filter((p: string) => p !== canonicalOwner),
                    createdAt: event.created_at ? event.created_at * 1000 : Date.now(),
                    updatedAt: undefined
                };

                if (typeof boardStore?.upsertBoardFromNostr === 'function') {
                    boardStore.upsertBoardFromNostr(boardProps); // publish: false (secondary)
                }

                // Sofort in Shared-Cache eintragen für UI (BoardsList)
                if (typeof boardStore?.handleSharedBoardEvent === 'function') {
                    boardStore.handleSharedBoardEvent({
                        id: dTag,
                        name: title,
                        description: description || undefined,
                        createdAt: event.created_at ? event.created_at * 1000 : Date.now(),
                        updatedAt: event.created_at ? event.created_at * 1000 : undefined,
                        isShared: true,
                        userRole,
                        author: canonicalOwner
                    });
                }

                // Optional: Board-Liste neu laden, falls UI von IDs scannt
                if (typeof boardStore?.refreshBoardIds === 'function') {
                    boardStore.refreshBoardIds();
                }

                // Toast nur anzeigen, wenn Board neu ist (nicht bereits in Liste)
                try {
                    const existingShared = typeof boardStore?.filterSharedBoards === 'function'
                        ? boardStore.filterSharedBoards('')
                        : [];
                    const alreadyThere = Array.isArray(existingShared) && existingShared.some((b: any) => b.id === dTag);
                    if (!alreadyThere) {
                        const { toast } = await import('svelte-sonner');
                        const ownerShort = `${event.pubkey.slice(0, 8)}...${event.pubkey.slice(-4)}`;
                        toast.success('Neues Board geteilt', {
                            description: `${ownerShort} hat "${title}" mit dir geteilt`,
                        });
                    }
                } catch (toastErr) {
                    // Toast ist best-effort; Fehler still schlucken
                }

                this.processedEvents.add(event.id);
            } catch (error) {
                console.warn('⚠️ Fehler beim Verarbeiten eines Shared Board Events:', error);
            }
        });

        // Keine Speicherung der Subscription nötig (fire-and-forget) – optional könnte man cleanup hinzufügen.
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
            
            if (localBoard && localBoard.updatedAt) {
                // Parse ISO timestamp zu Number für Vergleich
                const localTime = new Date(localBoard.updatedAt).getTime();
                const eventTime = boardEvent.created_at * 1000; // Nostr timestamps sind in Sekunden
                
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
        this.saveProcessedDeletions(); // Persist to localStorage
        
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
                        
                        // Track deletion timestamp (für Ordering)
                        this.cardDeletionTimestamps.set(cardId, deleteTime);
                        
                        // ⚡ v2.0: Direkte Store-API (SECONDARY action)
                        boardStore.deleteCardFromNostr(cardId);
                        // Silent - kein Log bei Card-Deletion
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
                console.log(`[NostrIntegration] 🔑 Board Event-ID: ${board.eventId}`);
                
                // ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
                const { BoardStorage } = await import('./storage.js');
                await BoardStorage.saveBoard(board);
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
                const localTime = new Date(local.createdAt).getTime();
                const remoteTime = new Date(remote.createdAt).getTime();
                const timeDiff = Math.abs(localTime - remoteTime);

                return timeDiff < 5000; // 5 seconds tolerance
            });

            return !isDuplicate;
        });

        // Step 3: Merge local + new remote comments
        const merged = [...localComments, ...newRemoteComments];

        // Step 4: Sort chronologically by createdAt (oldest first)
        merged.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
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
        if (!this.ndk) {
            console.debug('[NostrIntegration] loadComments: NDK not initialized (will retry when ready)');
            return;
        }

        try {
            // 1. Find the card in the board
            const result = board.findCardAndColumn(cardId);
            if (!result) {
                // 🔄 RETRY LOGIC: Card könnte noch vom Relay geladen werden
                if (retryCount < 5) {
                    console.debug(`[NostrIntegration] loadComments: Card ${cardId} not found yet - retry ${retryCount + 1}/5 in 500ms`);
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return this.loadComments(board, cardId, retryCount + 1);
                }
                
                console.warn(`[NostrIntegration] Card ${cardId} not found in board after ${retryCount} retries`);
                return;
            }

            const { card } = result;

            // 🚀 2. Load from cache FIRST (instant access)
            const cachedComments = this.loadCommentsFromStorage(cardId);
            if (cachedComments.length > 0) {
                // Silent cache load - only log in debug
                console.debug(`💿 Using ${cachedComments.length} cached comment(s) for instant display`);
                // Merge cache with current card comments
                const merged = this.mergeComments(card.comments || [], cachedComments);
                card.comments = merged;
            }

            // 3. Build card reference for Nostr filter
            // Format: "30302:<author-pubkey>:<card-d-tag>"
            const cardRef = `30302:${card.author || board.author || 'unknown'}:${cardId}`;

            // Only log in debug mode - reduces noise
            console.debug(`[NostrIntegration] 📥 Loading comments for: ${card.heading}`);

            // 4. Fetch Kind 1 (text note) events with #a tag referencing this card
            const events = await this.ndk.fetchEvents({
                kinds: [1] as number[],
                '#a': [cardRef]
            });

            if (!events || events.size === 0) {
                console.debug('[NostrIntegration] 📭 No remote comments found');
                // Save current state to cache (might be empty or local-only)
                this.saveCommentsToStorage(cardId, card.comments || []);
                return;
            }

            // Only log if comments were actually found
            console.log(`[NostrIntegration] 📬 Found ${events.size} remote comment(s) for ${card.heading}`);

            // 5. Convert Nostr events to Comment objects
            const remoteComments: Comment[] = Array.from(events).map(event => {
                return {
                    id: generateDTag(), // Local ID for UI
                    eventId: event.id!, // Nostr event ID for deduplication
                    text: event.content,
                    author: event.pubkey,
                    createdAt: new Date(event.created_at! * 1000).toISOString(),
                    syncStatus: 'synced' as const // Remote comments are always synced
                };
            });

            // 6. Merge with current card comments (already contains cache)
            const localComments = card.comments || [];
            const merged = this.mergeComments(localComments, remoteComments);

            // 7. Update card with merged comments ONLY if changed
            const hasChanges = JSON.stringify(card.comments) !== JSON.stringify(merged);
            
            if (hasChanges) {
                card.comments = merged;

                // 🚀 8. Save to cache for next time
                this.saveCommentsToStorage(cardId, merged);

                // 9. Persist to localStorage (WITHOUT triggering Nostr publish)
                BoardStorage.saveBoard(board);

                console.log(`✅ ${remoteComments.length} new comment(s) merged`);
            } else {
                // ⏭️ No changes - still update cache but DON'T save board
                this.saveCommentsToStorage(cardId, merged);
            }
        } catch (error) {
            console.error('[NostrIntegration] ❌ Error loading comments:', error);
        }
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
        // 1. Guard: NDK verfügbar?
        if (!this.ndk) {
            console.debug('[NostrIntegration] subscribeToComments: NDK not initialized (normal during app startup)');
            return () => {}; // Return no-op cleanup function
        }

        // 2. Guard: Ignore DnD placeholder cards
        if (cardId.includes('dnd-shadow-placeholder')) {
            console.debug(`[NostrIntegration] Skipping DnD placeholder: ${cardId}`);
            return () => {};
        }

        // 3. Finde die Card im Board
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            // 🔄 RETRY LOGIC: Card könnte noch vom Relay geladen werden
            if (retryCount < 5) {
                // Silent retry - only log first attempt
                if (retryCount === 0) {
                    console.debug(`[NostrIntegration] 🔄 subscribeToComments: Card ${cardId} not ready yet, retrying...`);
                }
                
                // Store retry cleanup function reference
                let retryCleanup: (() => void) | null = null;
                
                // Schedule retry after 500ms
                const retryTimer = setTimeout(() => {
                    retryCleanup = this.subscribeToComments(board, cardId, onUpdate, retryCount + 1);
                }, 500);
                
                // Return cleanup function that cancels retry AND any eventual subscription
                return () => {
                    clearTimeout(retryTimer);
                    if (retryCleanup) {
                        retryCleanup();
                    }
                };
            }
            
            console.warn(`[NostrIntegration] ⚠️ subscribeToComments: Card ${cardId} not found after ${retryCount} retries`);
            return () => {};
        }

        const { card } = result;

        // 3. Build card reference für #a tag filter
        const cardAuthor = card.author || board.author || 'unknown';
        const cardRef = `30302:${cardAuthor}:${cardId}`;

        console.debug(`[NostrIntegration] 📡 Subscribing to comments for: ${cardId.substring(5, 12)}...`);

        // 4. Cleanup existing subscription für diese Card (falls vorhanden)
        const existingSub = this.commentSubscriptions.get(cardId);
        if (existingSub && typeof existingSub.stop === 'function') {
            try {
                existingSub.stop();
                console.debug(`[NostrIntegration] 🛑 Stopped duplicate subscription for ${cardId.substring(5, 12)}...`);
            } catch (err) {
                console.error('[NostrIntegration] Error stopping existing subscription:', err);
            }
        }

        // 5. Create NDK subscription für Kind 1 events mit #a tag filter
        const sub = this.ndk.subscribe(
            {
                kinds: [1],
                '#a': [cardRef]
            },
            { closeOnEose: false } // ← WICHTIG: Persistent subscription für live updates!
        );

        // 6. Event handler: Convert → Merge → Persist → Trigger UI
        sub.on('event', async (event: any) => {
            try {
                // Deduplication: Skip if already processed
                if (this.processedEvents.has(event.id)) {
                    return; // Silent skip - bereits verarbeitet
                }

                // Mark as processed
                this.processedEvents.add(event.id);

                // Convert Nostr event to Comment object
                const newComment: Comment = {
                    id: generateDTag(), // Local ID for UI
                    eventId: event.id!, // Nostr event ID for deduplication
                    text: event.content,
                    author: event.pubkey,
                    createdAt: new Date(event.created_at! * 1000).toISOString(),
                    syncStatus: 'synced' as const // Event kommt vom Relay = bereits synced
                };

                // Merge with existing comments (deduplication via eventId)
                const currentComments = card.comments || [];
                const merged = this.mergeComments(currentComments, [newComment]);
                card.comments = merged;

                // Persist to localStorage (board storage)
                BoardStorage.saveBoard(board);

                // 🚀 Save to cache for instant access next time
                this.saveCommentsToStorage(cardId, merged);

                // Trigger UI update callback
                if (onUpdate) {
                    onUpdate();
                }
            } catch (error) {
                console.error('[NostrIntegration] ❌ Error processing comment event:', error);
            }
        });

        // 7. Store subscription in Map für späteren Cleanup
        this.commentSubscriptions.set(cardId, sub);

        // Only log if retry was needed or in debug mode
        if (retryCount > 0) {
            console.log(`[NostrIntegration] ✅ Comment subscription active for ${cardId.substring(5, 12)}... (after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})`);
        }

        // 8. Return cleanup function
        return () => {
            if (sub && typeof sub.stop === 'function') {
                try {
                    sub.stop();
                    this.commentSubscriptions.delete(cardId);
                    console.log(`[NostrIntegration] 🛑 Comment subscription stopped for card ${cardId}`);
                } catch (err) {
                    console.error('[NostrIntegration] Error stopping comment subscription:', err);
                }
            }
        };
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
            // 0. ⚡ KASKADIERENDE LÖSCHUNG: Lösche zuerst alle Cards (inkl. Comments)
            console.log(`[NostrIntegration] 🗑️ Cascading delete: Deleting ${board.getAllCards().length} card(s) in board "${board.name}"`);
            
            const allCards = board.getAllCards();
            for (const card of allCards) {
                await this.deleteCard(card);
                console.log(`  ✓ Deleted card: ${card.heading}`);
            }
            
            console.log(`✅ All ${allCards.length} card(s) deleted`);

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
            
            // 🔍 DEBUG: Log deletion event details (BEFORE signing)
            console.log('[NostrIntegration] 📋 Board Deletion Event Details:');
            console.log('  Kind:', deletionEvent.kind);
            console.log('  Board Author:', board.author);
            console.log('  Board Event ID:', board.eventId || 'NOT SET');
            console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
            console.log('  Content:', deletionEvent.content);
            console.log('  Target Board ID:', boardEventId);
            console.log('  ⚠️ Note: Event will be signed by SyncManager before publishing');

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
            // 0. ⚡ KASKADIERENDE LÖSCHUNG: Lösche zuerst alle Comments der Card
            if (card.comments && card.comments.length > 0) {
                console.log(`[NostrIntegration] 🗑️ Cascading delete: Deleting ${card.comments.length} comment(s) for card "${card.heading}"`);
                
                for (const comment of card.comments) {
                    await this.deleteComment(comment, card);
                    console.log(`  ✓ Deleted comment: ${comment.text.substring(0, 50)}...`);
                }
                
                console.log(`✅ All ${card.comments.length} comment(s) deleted`);
            }

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
            
            // 🔍 DEBUG: Log deletion event details (BEFORE signing)
            console.log('[NostrIntegration] 📋 Card Deletion Event Details:');
            console.log('  Kind:', deletionEvent.kind);
            console.log('  Card Author:', card.author);
            console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
            console.log('  Content:', deletionEvent.content);
            console.log('  Target Card Identifier:', cardEventIdentifier);
            console.log('  Actual Event ID:', actualEventId || 'NOT FOUND');
            console.log('  ⚠️ Note: Event will be signed by SyncManager before publishing');

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
