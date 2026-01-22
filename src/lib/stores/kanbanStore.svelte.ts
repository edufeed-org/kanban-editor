// src/lib/stores/kanbanStore.svelte.ts
// REFACTORED: Hauptstore der alle Module zusammenführt

import { Board, Chat, type CardProps, type ColumnProps, type BoardProps } from '../classes/BoardModel.js';
import { BoardRole, type BoardShare } from '../types/sharing.js';
import { authStore } from './authStore.svelte.js';
import { settingsStore } from './settingsStore.svelte.js';
import { initializeSyncManager } from './syncManager.svelte.js';
import { generateDTag } from '../utils/idGenerator.js';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKKind } from '@nostr-dev-kit/ndk';

// Module imports
import {
    BoardStorage,
    NostrIntegration,
    BoardOperations,
    ExportImport,
    PasteHandler,
    ChatIntegration,
    BoardSharingOperations,
    type CardItem,
    type UIColumn
} from './boardstore/index.js';

// ✅ NEW (REFACTORING): Migration import
import { MetadataMigration } from './boardstore/migration.js';

// Permission checks import
import { PermissionChecks } from '$lib/utils/permissionCheck.js';
import { toast } from 'svelte-sonner';

// ✅ Anti-Resurrection: Prevent loading/reconstructing tombstoned boards
import { clearAllBoardTombstones, clearBoardTombstone, isBoardTombstoned } from './boardstore/deletedBoards.js';

// Re-export types für Komponenten
export type { CardItem, UIColumn };

// ============================================================================
// BOARD STORE (SVELTE 5 RUNES) - REFACTORED
// ============================================================================

export class BoardStore {
    private static BOARDS_LIST_KEY = 'kanban-boards-list';
    
    // Reaktiver State
    private board = $state(this.loadFromStorage());
    private boardIds = $state<string[]>(BoardStorage.loadBoardIds());
    private _columnOrder = $state<string[]>(this.board.columns.map(c => c.id));
    private cachedSharedBoards = $state<Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}>>([]); // Cache für geteilte Boards (inkl. author)
    private isLoadingSharedBoards = false; // Loading-Flag (non-reactive to prevent infinite loops in $effect)
    public updateTrigger = $state(0);

	// Non-reactive guard to avoid repeated recovery attempts on spam-clicks.
	private tombstoneRecoveryInFlight = new Set<string>();
    
    // 🚀 NEW: NDK Ready Signal (prevents race conditions)
    public ndkReady = $state(false);
    
    // Module instances
    private nostrIntegration: NostrIntegration;

    constructor() {
        // ✅ NEW (REFACTORING): Run migration FIRST if needed
        if (MetadataMigration.needsMigration()) {
            console.log('🔄 Metadata migration needed - running...');
            MetadataMigration.migrate();
        }
        
        // Initialisiere Nostr-Modul
        this.nostrIntegration = new NostrIntegration();
        
        if (typeof window !== 'undefined') {
            this.initializeBoard();
            this.exposeCurrentBoardIdToWindow();
        }
    }
    
    private initializeBoard(): void {
        const currentBoardId = this.board.id;
        if (!this.boardIds.includes(currentBoardId)) {
            console.log('🔥 Erstes Laden: Füge Default Board zur Liste hinzu:', currentBoardId);
            this.boardIds = [...this.boardIds, currentBoardId];
            // BoardStorage.saveBoardIds() removed - deprecated, auto-discovered from localStorage
            this.saveToStorage();
        }
    }
    
    /**
     * ⚡ Öffentliche Methode: Wird nach Login/Logout aufgerufen
     * 
     * Behandelt Demo-Board-Migration und Board-Liste-Aktualisierung
     */
    public async onAuthChanged(): Promise<void> {
        console.log('🔄 Auth status changed - handling board migration');
        
        // ⚡ NEW: Cache für geteilte Boards leeren bei Auth-Änderung
        this.cachedSharedBoards = [];
        this.isLoadingSharedBoards = false;
        
        // Migriere Demo-Board falls nötig
        this.migrateDemoBoardToRealBoard();
        
        // Board-IDs neu laden (um Demo-Board zu entfernen bei auth)
        this.refreshBoardIds();
        
        // 📋 KRITISCH: Geteilte Boards neu laden nach Auth-Änderung
        // Ohne dies verliert der User nach Refresh alle gefolgten Boards!
        const currentUser = authStore.getPubkey();
        if (currentUser && this.nostrIntegration?.getNDK()) {
            try {
                console.log('📥 Loading shared boards after auth change...');
                await this.loadSharedBoardsAsync(currentUser);
                console.log('✅ Shared boards reloaded');
            } catch (error) {
                console.warn('⚠️ Failed to reload shared boards:', error);
            }
        }
        
        // Update trigger für Board-Liste Reaktivität
        this.triggerUpdate({ publish: false });
        
        console.log('✅ Auth change handled - board migration complete');
    }
    
    /**
     * ⚡ Fix anonymous board author after auth
     * Wird von +layout.svelte aufgerufen nachdem NDK ready ist
     */
    public fixAnonymousBoardAuthor(): void {
        try {
            if (!authStore || typeof authStore.getPubkey !== 'function') {
                console.log('ℹ️ AuthStore noch nicht initialisiert - skip author fix');
                return;
            }
            
            const pubkey = authStore.getPubkey();
            const isAuth = authStore.isAuthenticated;
            
            if (!isAuth || !pubkey) {
                console.log('ℹ️ User nicht eingeloggt - skip author fix');
                return;
            }
            
            // 🔴 IMPORTANT: maintainers dürfen den Owner (author) NICHT enthalten.
            // Sonst erscheint der Owner im Share-UI doppelt (Owner + Editor) und ist "nicht entfernbar".
            if (this.board.author === 'anonymous' || !this.board.author) {
                this.board.author = pubkey;
            }

            const owner = this.board.author;
            const rawMaintainers = Array.isArray(this.board.maintainers) ? this.board.maintainers : [];
            const normalizedMaintainers = Array.from(
                new Set(rawMaintainers.filter(p => typeof p === 'string' && p && p !== owner))
            );

            // Nur schreiben, wenn sich etwas geändert hat
            const changed =
                (owner === pubkey && (this.board.author === 'anonymous' || !this.board.author)) ||
                normalizedMaintainers.length !== rawMaintainers.length ||
                normalizedMaintainers.some((p, i) => p !== rawMaintainers[i]);

            if (changed) {
                this.board.maintainers = normalizedMaintainers;
                this.saveToStorage();
                console.log('✅ Board-Author/Maintainers normalisiert:', {
                    author: this.board.author,
                    maintainers: this.board.maintainers.length,
                });
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Fixen des Board-Authors:', error);
        }
    }

    // ============================================================================
    // PUBLIC GETTERS
    // ============================================================================
    
    public get data() {
        this.updateTrigger;
        return this.board;
    }

    public get uiData(): UIColumn[] {
        this.updateTrigger;
        this._columnOrder;
        
        const orderedColumns = this._columnOrder
            .map(id => this.board.columns.find(c => c.id === id))
            .filter(Boolean) as any[];

        return orderedColumns.map(col => ({
            id: col.id,
            name: col.name,
            description: col.description,
            color: col.color,
            items: col.cards.map((card: any) => ({
                id: card.id,
                name: card.heading,
                description: card.content,
                comments: card.comments,
                attendees: card.attendees,
                labels: card.labels,
                links: card.links, // ← ✅ FIXED: Komplettes links Array hinzufügen!
                color: card.color,
                publishState: card.publishState,
                author: card.author,
                authorName: card.authorName,
                image: card.image,
                link: card.links?.[0]?.url,
                columnId: col.id,
                boardId: this.board.id
            }))
        }));
    }

    public get allBoardIds(): string[] {
        return this.boardIds;
    }

    public get boardMeta() {
        this.updateTrigger;
        return {
            id: this.board.id,
            name: this.board.name,
            description: this.board.description,
            publishState: this.board.publishState,
            author: this.board.author,
            createdAt: this.board.createdAt,
            updatedAt: this.board.updatedAt
        };
    }

    public getCurrentBoardMeta() {
        return {
            id: this.board.id,
            name: this.board.name,
            description: this.board.description,
            publishState: this.board.publishState,
            author: this.board.author,
            createdAt: this.board.createdAt,
            updatedAt: this.board.updatedAt
        };
    }

    // ============================================================================
    // STORAGE METHODS (delegiert zu BoardStorage)
    // ============================================================================
    
    private loadFromStorage(): Board {
        const boardIds = BoardStorage.loadBoardIds();
        
        if (boardIds.length === 0) {
            console.log('📝 Keine Boards gefunden, erstelle Default-Board');
            return BoardStorage.createDefaultBoard();
        }
        
        const boards = BoardStorage.getAllBoardsMetadata(boardIds);
        
        // This is the SINGLE SOURCE OF TRUTH for board ordering
        console.log('🔍 loadFromStorage() - Available boards sorted by lastAccessed:');
        boards.slice(0, 5).forEach((board, index) => {
            const date = new Date(board.lastAccessed || board.updatedAt || board.createdAt || 0);
            const idPreview = typeof board.id === 'string' ? `${board.id.slice(0, 8)}...` : '(no-id)';
            console.log(`  ${index + 1}. ${board.name} - ${date.toLocaleString()} (${idPreview})`);
        });
        
        if (boards.length > 0) {
            const mostRecentBoardId = boards[0].id;
            const board = BoardStorage.loadBoard(mostRecentBoardId);
            
            if (board) {
                console.log(`✅ Loading first board from sorted list: ${board.name}`);
                return board;
            }
        }
        
        console.log('⚠️ Keine Boards gefunden, erstelle Default-Board');
        return BoardStorage.createDefaultBoard();
    }

    private saveToStorage(): void {
        BoardStorage.saveBoard(this.board);
        console.log(`💾 Saved board "${this.board.name}" with lastAccessedAt:`, this.board.lastAccessedAt);
    }

    /**
     * ⚡ PHASE 1: Event-Driven Architecture
     * 
     * Triggert Update mit optionalem Nostr-Publish
     * 
     * @param options - { publish?: boolean } - Default: true (Primary Actions)
     *   - publish: true  → User-Action → Publish zu Nostr (PRIMARY)
     *   - publish: false → Nostr-Event → NUR lokaler Update (SECONDARY)
     */
    private triggerUpdate(options?: { publish?: boolean }): void {
        // ⚡ FIX: Update board's lastAccessedAt on every modification
        // This ensures the board moves to the top of the list after any change
        this.board.updateLastAccessed();
        
        this.updateTrigger++;
        this.saveToStorage();
        
        // NUR bei Primary Actions zu Nostr publishen (Default: true)
        if (options?.publish !== false) {
            this.publishToNostr();
        }
    }

    /**
     * ⚡ PHASE 1: Event-Driven Architecture
     * 
     * Zentrale Methode für Nostr-Publishing
     * Publiziert aktuelles Board zu Nostr
     */
    private publishToNostr(): void {
        // Asynchron publishen (nicht-blockierend)
        this.publishBoardAsync();
    }

    // ============================================================================
    // MULTI-BOARD MANAGEMENT
    // ============================================================================
    
    public getAllBoards(): Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean }> {
        // ⚡ KRITISCH: updateTrigger lesen für Reaktivität!
        this.updateTrigger;
        
        // ⚡ BENUTZER-BASIERTE FILTERUNG
        const currentUserPubkey = this.getCurrentUserPubkey();
        const isAnonymous = !currentUserPubkey;
        
        // Anonyme Benutzer: Nur Demo-Board anzeigen
        if (isAnonymous) {
            return this.getDemoBoardsForAnonymousUser();
        }
        
        // ⚡ FIX: Authentifizierte Benutzer - Demo-Board explizit ausschließen
        const filteredBoardIds = this.boardIds.filter(id => id !== 'demo-board');
        const allBoards = BoardStorage.getAllBoardsMetadata(filteredBoardIds);
        
        // 🔍 DEBUG: Log all boards and their authors
        console.log(`🔍 getAllBoards() - Checking ${allBoards.length} boards for user ${currentUserPubkey?.slice(0, 8)}...`);
        allBoards.forEach(board => {
            const fullBoard = BoardStorage.loadBoard(board.id);
            console.log(`  📋 Board "${board.name}": author=${fullBoard?.author?.slice(0, 8)}... maintainers=${JSON.stringify(fullBoard?.maintainers?.map(m => m.slice(0, 8) + '...') || [])}`);
        });
        
        const userBoards = allBoards.filter(board => {
            const fullBoard = BoardStorage.loadBoard(board.id);

            // ✅ Leave/Hide Guard: verlassene (oder explizit versteckte) Boards dürfen NICHT mehr angezeigt werden.
            // Wichtig: author-scoped Prüfung, damit keine d-tag Kollisionen auftreten.
            if (BoardSharingOperations.isBoardHidden(board.id, fullBoard?.author)) {
                console.log(`  🚫 Hidden/left: "${board.name}" (filtered)`);
                return false;
            }

            // Board gehört dem aktuellen Benutzer wenn:
            // 1. author === currentUserPubkey ODER
            // 2. maintainers enthält currentUserPubkey
            const isOwnerOrMaintainer = this.isUserOwnerOrMaintainer(board.id, currentUserPubkey);
            if (!isOwnerOrMaintainer) {
                console.log(`  ❌ Filtered out: "${board.name}" (not owner or maintainer)`);
            }
            return isOwnerOrMaintainer;
        });
        
        console.log(`✅ getAllBoards() returning ${userBoards.length}/${allBoards.length} boards for user ${currentUserPubkey?.slice(0, 8)}...`);
        
        // ⚡ DEBUG: Duplikate-Check
        const boardIdsInList = userBoards.map(b => b.id);
        const duplicates = boardIdsInList.filter((id, index) => boardIdsInList.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.error(`🔴 DUPLIKATE in getAllBoards() gefunden:`, duplicates);
            console.log('  userBoards:', userBoards.map(b => ({ id: b.id, name: b.name })));
        }
        
        // ⚡ FIX: Aktuelles Board mit Live-Daten überschreiben (nicht cached localStorage!)
        // ⚡ ZUSÄTZLICH: Alle Boards mit frischem lastAccessedAt aktualisieren
        const refreshedBoards = userBoards.map(board => {
            if (board.id === this.board.id) {
                // Aktuelles Board: Nutze Live-Daten
                return {
                    id: this.board.id,
                    name: this.board.name,
                    description: this.board.description,
                    createdAt: new Date(this.board.createdAt).getTime(),
                    updatedAt: this.board.updatedAt 
                        ? new Date(this.board.updatedAt).getTime() 
                        : new Date(this.board.createdAt).getTime(),
                    lastAccessed: this.board.lastAccessedAt 
                        ? new Date(this.board.lastAccessedAt).getTime() 
                        : new Date(this.board.createdAt).getTime(),
                    hasUnseenChanges: this.board.hasUnseenChanges
                };
            } else {
                // Andere Boards: Lade frisches lastAccessedAt aus Storage
                const storedBoard = BoardStorage.loadBoard(board.id);
                if (storedBoard?.lastAccessedAt) {
                    return {
                        ...board,
                        lastAccessed: new Date(storedBoard.lastAccessedAt).getTime()
                    };
                }
                return board;
            }
        });
        
        return refreshedBoards;
    }

    public createBoard(name: string, description?: string): string {
        // WICHTIG: Keine Permission-Check für createBoard!
        // Jeder Benutzer kann eigene Boards erstellen, unabhängig von Rollen auf anderen Boards.
        // Ein Viewer auf Board A kann trotzdem sein eigenes Board B erstellen.
        
        const { author, authorName } = this.getAuthorFields();
        const board = new Board({
            name,
            description,
            author,
            authorName: authorName || undefined, // ← NEU: Display name (null → undefined für TypeScript)
            maintainers: [], // ← FIX: Author should NOT be in maintainers (they're already the owner)
            publishState: 'draft',
            columns: []
        });

        settingsStore.settings.defaultColumns.forEach((colName: string) => {
            board.addColumn({
                name: colName,
                color: this.getDefaultColorForColumn(colName)
            });
        });

        BoardStorage.saveBoard(board);
        
        // ⚡ FIX: Duplikate vermeiden! Nur hinzufügen wenn nicht bereits in Liste
        if (!this.boardIds.includes(board.id)) {
            this.boardIds = [...this.boardIds, board.id];
            // BoardStorage.saveBoardIds() removed - deprecated, auto-discovered from localStorage
            console.log(`✅ Board ${board.name} added to list - now visible in sidebar`);
        } else {
            console.warn(`⚠️ Board ${board.id} bereits in boardIds-Liste - DUPLIKAT vermieden`);
        }

        // ⚡ KRITISCH: Metadaten-Liste aktualisieren (für getAllBoardsMetadata)
        // Grund: createBoard() auf Browser A muss gleiche Struktur wie upsertBoardFromNostr() nutzen
        // this.addBoardToMetadataList({
        //     id: board.id,
        //     name: board.name,
        //     description: board.description || '',
        //     lastAccessed: new Date().toISOString(),
        //     author: board.author || '',
        //     publishState: board.publishState || 'draft'
        // });

        this.board = board;
        this._columnOrder = board.columns.map(c => c.id);
        this.triggerUpdate();

        console.log(`✅ Neues Board erstellt: ${name}`);
        return board.id;
    }

    public loadBoard(boardId: string, options?: { skipLastAccessed?: boolean }): boolean {
        // ✅ Hard guard: deleted boards must never be loaded or reconstructed.
        // Exception handling: shared boards can end up tombstoned due to stale/invalid deletion events.
        // In that case we try a Nostr revalidation and only keep the tombstone if deletion is confirmed.
        if (isBoardTombstoned(boardId)) {
            const isShared = this.cachedSharedBoards.some(b => b.id === boardId);

            if (isShared && !this.tombstoneRecoveryInFlight.has(boardId)) {
                console.warn(`⛔ loadBoard: Shared Board ${boardId} ist tombstoned – starte Revalidierung...`);
                this.tombstoneRecoveryInFlight.add(boardId);
                this.revalidateSharedBoardTombstone(boardId)
                    .then(result => {
                        if (result === 'recovered') {
                            console.log(`✅ Tombstone revalidiert/entfernt – lade Shared Board ${boardId} erneut`);
                            this.loadBoard(boardId, { skipLastAccessed: true });
                        } else if (result === 'still-deleted') {
                            const before = this.cachedSharedBoards.length;
                            this.cachedSharedBoards = this.cachedSharedBoards.filter(b => b.id !== boardId);
                            if (this.cachedSharedBoards.length !== before) {
                                this.updateTrigger++;
                            }
                        }
                    })
                    .finally(() => {
                        this.tombstoneRecoveryInFlight.delete(boardId);
                    });
            } else {
                console.warn(`⛔ loadBoard: Board ${boardId} ist tombstoned – Skip load/reconstruct`);
            }

            return false;
        }

        let board = BoardStorage.loadBoard(boardId);
        if (!board) {
            // Versuch: Shared Board Rekonstruktion asynchronously (wenn über p-tag entdeckt, aber noch nicht lokal persistiert)
            const isShared = this.cachedSharedBoards.some(b => b.id === boardId);
            if (isShared) {
                console.warn(`⚠️ Shared Board ${boardId} nicht lokal – starte Rekonstruktion...`);
                this.reconstructSharedBoard(boardId).then(success => {
                    if (success) {
                        console.log(`🔁 Rekonstruktion abgeschlossen – lade Board ${boardId} erneut`);
                        this.loadBoard(boardId, { skipLastAccessed: true });
                    } else {
                        console.error(`❌ Rekonstruktion für Shared Board ${boardId} fehlgeschlagen`);
                    }
                });
            } else {
                console.error(`❌ Board ${boardId} nicht gefunden`);
            }
            return false; // Aktueller synchroner Aufruf schlägt fehl; bei Erfolg wird später reload ausgeführt
        }

        this.board = board;
        // No-op guard: Beim Reload kann loadBoard() (z.B. via Nostr bootstrap) erneut für das
        // bereits initial gerenderte Board aufgerufen werden. Wenn die Reihenfolge identisch ist,
        // vermeiden wir ein redundantes Reassign, das sichtbar als "Spalten springen" wirkt.
        const nextOrder = board.columns.map(c => c.id);
        if (
            nextOrder.length !== this._columnOrder.length ||
            !this._columnOrder.every((v, i) => v === nextOrder[i])
        ) {
            this._columnOrder = nextOrder;
        }
        
        // ✅ KRITISCH: Wenn User Viewer ist (aus Follow-Set), zur followers Liste hinzufügen
        // Dies ermöglicht korrekte Viewer-Rolle in getCurrentUserRole()
        const currentUser = authStore.getPubkey();
        if (currentUser) {
            const boardMeta = this.cachedSharedBoards.find(b => b.id === boardId);
            if (boardMeta?.userRole === 'viewer' && !board.followers.includes(currentUser)) {
                console.log(`✅ Adding current user to followers (Follow-Set board)`);
                board.followers.push(currentUser);
            }
        }
        
        // ⚡ NEW (13.11.2025): Update lastAccessed NUR bei manuellem Board-Switch
        // Bei Nostr-Load: skipLastAccessed = true (Race Condition vermeiden!)
        if (!options?.skipLastAccessed) {
            board.updateLastAccessed();
            console.log(`📌 lastAccessed updated: ${board.lastAccessedAt}`);
        } else {
            console.log(`⏭️ Skipped lastAccessed update (Nostr-Load)`);
        }
        
        board.clearChanges();
        
        // ⚡ FIX: Save board to persist lastAccessedAt timestamp
        // This is critical for board ordering after page refresh
        BoardStorage.saveBoard(board);
        
        // ⚡ v4.1: KEIN triggerUpdate() beim Laden!
        // Grund: Wir wollen NICHT zu Nostr publishen beim reinen Laden
        // Aber: updateTrigger++ damit $derived neu berechnet wird
        // UND: saveToStorage() wurde bereits oben aufgerufen via BoardStorage.saveBoard()
        this.updateTrigger++;
        
        ChatIntegration.reset();
        console.log(`✅ Board geladen: ${board.name}`);
        
        // ⚠️ NEU: Lade alle Cards für dieses Board vom Relay (asynchron)
        this.loadCardsFromNostr(board);
        
        // 🔴 KRITISCH: Lade Followers (Viewer) aus NIP-51 Kind 30000 Follow Set Events
        // Dies ist nötig um Viewer-Rollen korrekt zu rekonstruieren nach Reload
        this.loadBoardFollowers().catch(err => {
            console.warn('⚠️ Failed to load board followers:', err);
            // Non-blocking error - board can still be used without followers loaded
        });
        
        // 🎯 COLLABORATION FIX: Subscription für neues Board neu starten
        // Dies ist wichtig, damit Card-Events für das NEUE Board empfangen werden!
        this.subscribeToNostrUpdates();
        
        return true;
    }

    /**
     * Rekonstruiert ein geteiltes Board aus einem Nostr Event falls es nur im Shared-Cache existiert.
     * Persistiert das Board unter 'kanban-{id}' damit loadBoard() funktioniert und Karten nachgeladen werden können.
     * Rückgabe: true wenn Rekonstruktion erfolgreich oder bereits vorhanden, sonst false.
     */
    private async reconstructSharedBoard(boardId: string): Promise<boolean> {
        // ✅ Hard guard: deleted boards must never be reconstructed from Nostr
        if (isBoardTombstoned(boardId)) {
            console.warn(`⛔ reconstructSharedBoard: Board ${boardId} ist tombstoned – Skip reconstruction`);
            return false;
        }

        // Bereits vorhanden?
        const existing = BoardStorage.loadBoard(boardId);
        if (existing) return true;

        const sharedMeta = this.cachedSharedBoards.find(b => b.id === boardId);
        if (!sharedMeta) return false;

        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            console.warn(`⚠️ NDK nicht initialisiert – Rekonstruktion von ${boardId} verschoben`);
            return false;
        }

        const author = sharedMeta.author;
        const filter: any = author
            ? { kinds: [30301], authors: [author], '#d': [boardId] }
            : { kinds: [30301], '#d': [boardId] };
        try {
            const event = await ndk.fetchEvent(filter);
            if (!event) {
                console.warn(`⚠️ Kein Remote-Event für Shared Board ${boardId} gefunden`);
                return false;
            }
            const { nostrEventToBoard } = await import('../utils/nostrEvents.js');
            const boardProps = nostrEventToBoard(event);
            if (!boardProps.id) return false;
            const reconstructed = new Board(boardProps);
            BoardStorage.saveBoard(reconstructed);
            this.refreshBoardIds();
            console.log(`🛠️ Rekonstruiertes Shared Board gespeichert: ${reconstructed.name} (${reconstructed.id})`);
            
            // 🔴 UPDATE: Aktualisiere Board-Metadaten in cachedSharedBoards mit echten Daten
            const cachedIndex = this.cachedSharedBoards.findIndex(b => b.id === boardId);
            if (cachedIndex !== -1) {
                this.cachedSharedBoards[cachedIndex] = {
                    ...this.cachedSharedBoards[cachedIndex],
                    name: reconstructed.name,
                    description: reconstructed.description,
                    updatedAt: reconstructed.updatedAt ? new Date(reconstructed.updatedAt).getTime() : undefined,
                    createdAt: reconstructed.createdAt ? new Date(reconstructed.createdAt).getTime() : Date.now()
                };
                // ⚡ UI aktualisieren ohne Persist/Pub Side-Effects
                this.updateTrigger++;
                console.log(`✅ Board-Metadaten in Cache aktualisiert: ${reconstructed.name}`);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Fehler bei Rekonstruktion von Shared Board ${boardId}:`, error);
            return false;
        }
    }

    private async revalidateSharedBoardTombstone(
        boardId: string,
        explicitAuthor?: string
    ): Promise<'recovered' | 'still-deleted' | 'unknown'> {
        if (!isBoardTombstoned(boardId)) return 'recovered';

        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) return 'unknown';

        const sharedMeta = this.cachedSharedBoards.find(b => b.id === boardId);
        const author = explicitAuthor || sharedMeta?.author;
        if (!author) return 'unknown';

        try {
            // 1) Latest board event (acts as "board is still alive" signal)
            const boardEvent = await ndk.fetchEvent({
                kinds: [30301 as unknown as NDKKind],
                authors: [author],
                '#d': [boardId]
            });
            if (!boardEvent) return 'still-deleted';

            const boardMs = (boardEvent.created_at || 0) * 1000;

            // 2) Latest deletion event for this board address
            // We scope by authors:[author] to avoid unrelated/malicious deletion events.
            const deletionEvent = await ndk.fetchEvent({
                kinds: [5 as unknown as NDKKind],
                authors: [author],
                '#a': [`30301:${author}:${boardId}`]
            });
            const deletionMs = deletionEvent?.created_at ? deletionEvent.created_at * 1000 : 0;

            // If there's a deletion newer or equal to the latest board event, keep tombstone.
            if (deletionMs && deletionMs >= boardMs) {
                return 'still-deleted';
            }

            // Otherwise: tombstone is stale/false-positive.
            clearBoardTombstone(boardId);
            return 'recovered';
        } catch (error) {
            console.warn('⚠️ Tombstone revalidation failed:', error);
            return 'unknown';
        }
    }

    public deleteBoard(boardId?: string): boolean {
        // Permission Check: Kann Benutzer das Board löschen?
        const userRole = this.getCurrentUserRole();
        const currentBoardId = boardId || this.board.id;
        if (!PermissionChecks.canDeleteBoard(userRole, currentBoardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, dieses Board zu löschen.'
            })
            return false; // Silently fail - Permission denied message already shown
        }
        
        const idToDelete = boardId || this.board.id;
        
        if (this.boardIds.length <= 1) {
            console.error('❌ Letztes Board kann nicht gelöscht werden');
            return false;
        }

        // 1. Board-Referenz speichern für Nostr-Löschung
        const boardToDelete = (idToDelete === this.board.id) 
            ? this.board 
            : this.loadBoardById(idToDelete);

        // 2. Auf anderes Board wechseln wenn aktuelles Board gelöscht wird
        if (this.board.id === idToDelete) {
            const otherBoardId = this.boardIds.find(id => id !== idToDelete);
            if (otherBoardId) {
                this.loadBoard(otherBoardId);
            }
        }

        // 3. Lokal löschen
        BoardStorage.deleteBoard(idToDelete);
        this.boardIds = this.boardIds.filter(id => id !== idToDelete);
        // BoardStorage.saveBoardIds() removed - deprecated, auto-discovered from localStorage

        console.log(`✅ Board ${idToDelete} lokal gelöscht`);

        // 4. Auf Nostr löschen (asynchron)
        if (boardToDelete) {
            this.nostrIntegration.deleteBoard(boardToDelete);
        }

        return true;
    }

    private loadBoardById(boardId: string): Board | null {
        try {
            const data = BoardStorage.loadBoard(boardId);
            if (!data) return null;
            return BoardStorage.reconstructBoard(data);
        } catch (error) {
            console.error(`❌ Error loading board ${boardId}:`, error);
            return null;
        }
    }

    // ============================================================================
    // NOSTR INTEGRATION (delegiert zu NostrIntegration)
    // ============================================================================
    
    public async initializeNostr(ndk: NDK): Promise<void> {
        // initializeSyncManager erwartet NDK + Signer
        const signer = ndk.signer;
        await initializeSyncManager(ndk, signer);
        
        await this.nostrIntegration.initialize(ndk, async () => {
            await this.loadBoardsFromNostr();
        });
        
        // ✅ KRITISCH: Subscription für Live-Updates SOFORT starten
        // Damit auch ohne Login neue Boards in anderen Browsern sichtbar werden
        this.subscribeToNostrUpdates();
        console.log('[BoardStore] ✅ Live subscription started - ready for multi-browser sync');
        
        // 🚀 Signal that NDK is ready - components can now safely use Nostr methods
        this.ndkReady = true;
        console.log('[BoardStore] ✅ NDK ready signal set - components can now use Nostr');
    }

    public async loadBoardsFromNostr(): Promise<void> {
        await this.nostrIntegration.loadBoardsFromNostr(
            this.boardIds,
            this.board,
            (updatedBoardIds: string[], switched: boolean, newBoard?: Board) => {
                // ⚡ FIX: Board IDs NICHT per Merge deduplizieren, sondern aus Storage ableiten.
                // Grund: Storage ist Source-of-Truth (inkl. Tombstones/Filter). Merge kann gelöschte IDs
                // wieder einschleusen und in Kombination mit Refresh/Subscribe zu Feedback-Loops führen.
                this.boardIds = BoardStorage.loadBoardIds();
                console.log(`📋 Board IDs aktualisiert (${this.boardIds.length} boards, storage-derived)`);
                
                // ⚡ NEW (13.11.2025): Lade das Board mit dem neuesten lastAccessedAt
                // NICHT das "erste" Board, um Race Conditions zu vermeiden!
                if (switched && newBoard) {
                    this.board = newBoard;

                    // No-op guard: identische Order soll keinen sichtbaren Re-sort triggern.
                    const nextOrder = newBoard.columns.map(c => c.id);
                    if (
                        nextOrder.length !== this._columnOrder.length ||
                        !this._columnOrder.every((v, i) => v === nextOrder[i])
                    ) {
                        this._columnOrder = nextOrder;
                    }

                    // ⚠️ Nostr-driven Load: UI refresh ja, aber keine Side-Effects (kein lastAccessed/save/publish)
                    this.updateTrigger++;
                } else {
                    // ⚡ FIX: Re-load current board OHNE lastAccessed Update
                    // Das verhindert, dass alle Boards den gleichen Timestamp bekommen
                    const currentId = this.board.id;
                    if (updatedBoardIds.includes(currentId)) {
                        console.log(`✅ Re-loading current board without lastAccessed update: ${currentId}`);
                        this.loadBoard(currentId, { skipLastAccessed: true });
                    } else {
                        // Aktuelles Board wurde gelöscht → Lade das neueste Board
                        const allBoards = this.getAllBoards();
                        if (allBoards.length > 0) {
                            const mostRecent = allBoards.reduce((prev, curr) => {
                                const prevTime = prev.lastAccessed || prev.updatedAt || prev.createdAt || 0;
                                const currTime = curr.lastAccessed || curr.updatedAt || curr.createdAt || 0;
                                
                                // 🔥 FIX: Bei gleichen Timestamps → deterministischer Vergleich via ID!
                                if (currTime === prevTime) {
                                    // Lexikographischer Vergleich: kleinere ID = "neuer" (arbitrary but deterministic)
                                    return curr.id < prev.id ? curr : prev;
                                }
                                
                                return currTime > prevTime ? curr : prev;
                            });
                            console.log(`⚠️ Current board deleted, switching to most recent: ${mostRecent.name}`);
                            this.loadBoard(mostRecent.id, { skipLastAccessed: true });
                        }
                    }
                }
            }
        );
    }

    private async loadCardsFromNostr(board: Board): Promise<void> {
        const targetBoardId = board.id;

        await this.nostrIntegration.loadCardsForBoard(board, (cardProps: any) => {
            console.log('🃏 Card vom Relay geladen:', cardProps.id, 'für Spalte:', cardProps.columnId);

            try {
                // ⚠️ Wichtig: Card-Loads können asynchron eintreffen.
                // Wenn der User inzwischen das Board gewechselt hat, dürfen wir NICHT in this.board schreiben.
                if (this.board.id !== targetBoardId) {
                    this.upsertCardToBackgroundBoard(targetBoardId, cardProps);
                    return;
                }

                // Finde Zielspalte im AKTUELLEN Board (das ist hier garantiert targetBoardId)
                let targetColumn = this.board.findColumn((cardProps as any).columnId);

                // Fallback: Name-basiertes Matching
                if (!targetColumn && (cardProps as any).columnName) {
                    targetColumn = this.board.columns.find(
                        (col) => col.name.toLowerCase() === String((cardProps as any).columnName || '').toLowerCase()
                    );
                    if (targetColumn) {
                        console.log(`✅ Column matched by name: "${(cardProps as any).columnName}"`);
                        (cardProps as any).columnId = targetColumn.id;
                    }
                }

                // Letzter Fallback: Erste Spalte
                if (!targetColumn && this.board.columns.length > 0) {
                    targetColumn = this.board.columns[0];
                    console.log(`⚠️ Using first column as fallback: "${targetColumn.name}"`);
                    (cardProps as any).columnId = targetColumn.id;
                }

                if (!targetColumn) {
                    console.error(`❌ No column found for card ${cardProps.id}`);
                    return;
                }

                // Card via Secondary Action upserten (inkl. Preserve-Comments + Rank + LWW in BoardOperations)
                BoardOperations.upsertCardFromNostr(this.board, cardProps);
            } catch (error) {
                console.error(`❌ Error loading card from Nostr:`, error);
            }
        });

        // Nach dem Laden aller Cards: UI aktualisieren (OHNE Nostr-Publishing!)
        // 🔴 Wichtig: Nur wenn wir noch auf dem selben Board sind.
        if (this.board.id === targetBoardId) {
            this.triggerUpdate({ publish: false });
            console.log('✅ Alle Cards vom Relay geladen und synchronisiert');
        } else {
            console.log('ℹ️ Cards geladen, aber Board wurde gewechselt - kein UI-Update für altes Board');
        }
    }

    /**
     * ⚡ EVENT-DRIVEN ARCHITECTURE v2.0
     * Subscribed zu Nostr-Updates (Board, Card, Deletion)
     * 
     * Nutzt die neuen Secondary Actions:
     * - upsertCardFromNostr()
     * - deleteCardFromNostr()
     * - upsertBoardFromNostr()
     */
    public subscribeToNostrUpdates(): void {
        console.log('[BoardStore] 🛰️ Subscribing to Nostr updates (Event-Driven v2.0)');
        
        // ⚡ NEU: Store-Referenz statt Callbacks!
        this.nostrIntegration.subscribeToUpdates(this.board, this);
    }

    // Alias-Methoden für Backward-Kompatibilität
    public async loadBoardsFromNostrForCurrentUser(): Promise<void> {
        await this.loadBoardsFromNostr();
    }

    public subscribeToBoardUpdatesForCurrentUser(): void {
        this.subscribeToNostrUpdates();
    }

    public getCurrentBoardId(): string {
        return this.board.id;
    }

    /**
     * Erzwingt ein Neuladen des aktuell aktiven Boards aus Nostr.
     *
     * Verhalten:
     * - Guard: NDK muss initialisiert sein (`ndkReady`), und es muss mindestens ein Relay verbunden sein.
     * - Löscht optional den lokalen Cache-Eintrag (`kanban-{boardId}`), damit kein stale localStorage-Stand geladen wird.
     * - Lädt anschließend Boards/Board erneut aus Nostr.
     *
     * Hinweis: Diese Methode ist bewusst Store-zentriert (kein localStorage-Hack in der UI).
     */
    public async forceReloadCurrentBoardFromNostr(options?: {
        clearLocalCache?: boolean;
        syncManager?: { lastConnectedCount: number };
    }): Promise<void> {
        if (!this.ndkReady) {
            throw new Error('Nostr ist noch nicht initialisiert');
        }

        const boardId = this.board.id;
        const clearLocalCache = options?.clearLocalCache ?? true;

        // Guard: NostrIntegration muss NDK haben
        if (!this.nostrIntegration?.getNDK()) {
            throw new Error('NDK ist nicht verfügbar');
        }

        // Guard: Mindestens ein Relay verbunden
        let connectedRelays = 0;
        try {
            if (options?.syncManager) {
                connectedRelays = options.syncManager.lastConnectedCount;
            } else {
                const mod = await import('./syncManager.svelte.js');
                const sm = mod.getSyncManager();
                connectedRelays = sm.lastConnectedCount;
            }
        } catch {
            // Wenn SyncManager nicht ready ist, behandeln wir das wie "offline"
            connectedRelays = 0;
        }

        if (connectedRelays <= 0) {
            throw new Error('Keine Relay-Verbindung verfügbar');
        }

        const storageKey = `kanban-${boardId}`;
        const hasLocalStorage = (() => {
            try {
                return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
            } catch {
                return false;
            }
        })();

        const backupJson = hasLocalStorage ? localStorage.getItem(storageKey) : null;

        if (clearLocalCache && hasLocalStorage) {
            localStorage.removeItem(storageKey);
        }

        try {
            // Boards/Board aus Nostr (re-)laden
            await this.loadBoardsFromNostr();

            // Sicherstellen, dass das aktuelle Board erneut geladen wird
            const ok = this.loadBoard(boardId, { skipLastAccessed: true });
            if (!ok) {
                // Shared Boards können nach Cache-Clear erst asynchron via Nostr rekonstruiert werden.
                // In diesem Fall blockieren wir hier deterministisch, statt sofort zu throwen.
                const isShared = this.cachedSharedBoards.some(b => b.id === boardId);
                if (isShared) {
                    const reconstructed = await this.reconstructSharedBoard(boardId);
                    const okAfter = reconstructed && this.loadBoard(boardId, { skipLastAccessed: true });
                    if (!okAfter) {
                        throw new Error('Board konnte nicht aus Nostr geladen werden');
                    }
                } else {
                    throw new Error('Board konnte nicht aus Nostr geladen werden');
                }
            }
        } catch (error) {
            // Fallback: lokalen Cache wiederherstellen, um Datenverlust zu vermeiden
            if (backupJson && hasLocalStorage) {
                localStorage.setItem(storageKey, backupJson);
                this.loadBoard(boardId, { skipLastAccessed: true });
            }
            throw error;
        }
    }

    public findColumn(columnId: string) {
        return this.board.findColumn(columnId);
    }

    // Weitere Backward-Kompatibilität-Methoden
    public addColumn(props: { name: string; color?: string }) {
        const columnId = this.createColumn(props.name, props.color);
        return this.board.findColumn(columnId);
    }

    public addCard(columnId: string, props: Partial<CardProps>): string {
        return this.createCard(columnId, props.heading || 'Neue Karte', props.content);
    }

    public deleteColumnWithCards(columnId: string): void {
        this.deleteColumn(columnId);
    }

    public upsertCard(columnId: string, props: Partial<CardProps> & { heading: string }): string {
        const result = this.board.findCardAndColumn(props.id || '');
        if (result) {
            // Update existing card
            this.editCard(result.card.id, props);
            return result.card.id;
        } else {
            // Create new card
            return this.createCard(columnId, props.heading, props.content);
        }
    }

    public findCardAndColumn(cardId: string) {
        return this.board.findCardAndColumn(cardId);
    }

    public updateCard(cardId: string, updates: Partial<CardProps>): void {
        this.editCard(cardId, updates);
    }

    public removeCard(cardId: string): void {
        this.deleteCard(cardId);
    }

    public filterBoards(query: string): Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean}> {
        // ✅ BENUTZER-BASIERTE FILTERUNG: getAllBoards() liefert bereits gefilterte Boards
        const userBoards = this.getAllBoards();
        
        // ✅ 1. FILTER by search query
        const filtered = query 
            ? userBoards.filter(board => {
                const lowerQuery = query.toLowerCase();
                return board.name.toLowerCase().includes(lowerQuery) ||
                    (board.description && board.description.toLowerCase().includes(lowerQuery));
            })
            : userBoards;
        
        // ✅ 2. LIMIT to maxBoardsInSidebar (unless searching)
        // User said: "alle durchsuchbar" - so no limit when query exists
        if (!query) {
            const maxBoards = settingsStore.settings.maxBoardsInSidebar || 10;
            return filtered.slice(0, maxBoards);
        }
        
        return filtered;
    }

    /**
     * ✅ NEUE METHODE: Geteilte Boards filtern (wo User Maintainer oder Follower ist)
     * 
     * Diese Methode lädt Boards aus Nostr Events, bei denen der aktuelle Nutzer
     * als Maintainer (p-tag) oder Follower (NIP-51 Follow Set) hinzugefügt wurde.
     */
    public filterSharedBoards(query: string): Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean; isShared: boolean; userRole: string; author?: string}> {
        // ⚡ KRITISCH: updateTrigger lesen für Reaktivität!
        this.updateTrigger;
        
        const currentUserPubkey = this.getCurrentUserPubkey();
        if (!currentUserPubkey) {
            return []; // Anonyme Nutzer haben keine geteilten Boards
        }
        
        // Verwende gecachte geteilte Boards, aber filtere defensiv:
        // - Tombstones (Owner-Delete) dürfen nie wieder sichtbar werden
        // - Hidden Boards (Leave/Unfollow) dürfen nicht zurückkommen
        // - Self-owned Boards dürfen nicht als "shared" in der Liste auftauchen
        const sharedBoards = this.cachedSharedBoards
            .filter(b => !isBoardTombstoned(b.id))
            .filter(b => !BoardSharingOperations.isBoardHidden(b.id, b.author))
            .filter(b => b.author !== currentUserPubkey);
        
        // ⚠️ FIXED: Do NOT trigger async loading here!
        // This causes state_unsafe_mutation when called from $derived
        // Use triggerLoadSharedBoards() from component's $effect instead
        
        // ✅ FILTER by search query
        const filtered = query 
            ? sharedBoards.filter(board => {
                const lowerQuery = query.toLowerCase();
                return board.name.toLowerCase().includes(lowerQuery) ||
                    (board.description && board.description.toLowerCase().includes(lowerQuery));
            })
            : sharedBoards;
        
        return filtered;
    }

    /**
     * Trigger loading of shared boards (safe to call from $effect)
     * This is a separate method to avoid state mutations in $derived context
     */
    public triggerLoadSharedBoards(): void {
        const currentUserPubkey = this.getCurrentUserPubkey();
        if (!currentUserPubkey) {
            return;
        }
        // Fire-and-forget async loading
        this.loadSharedBoardsAsync(currentUserPubkey);
    }

    /**
     * ⭐ NEU (Board-Sharing v1): Direkter Handler für eingehende Shared Board Events
     * Wird von NostrIntegration.subscribeToUpdates(sharedSub) aufgerufen, wenn ein Board-Event
     * mit p-tag des aktuellen Nutzers eintrifft, dessen Author != aktueller Nutzer ist.
     * Fügt das Board, falls noch nicht vorhanden, zu cachedSharedBoards hinzu und triggert ein UI-Update.
     */
    public handleSharedBoardEvent(eventData: { id: string; name: string; description?: string; createdAt: number; updatedAt?: number; isShared: boolean; userRole: string; author?: string }): void {
        // 🔒 Hard guards: niemals Boards re-injecten, die der User gelöscht/verlassen hat
        if (isBoardTombstoned(eventData.id)) {
            return;
        }

        if (BoardSharingOperations.isBoardHidden(eventData.id, eventData.author)) {
            return;
        }

        const currentUserPubkey = this.getCurrentUserPubkey();
        if (currentUserPubkey && eventData.author === currentUserPubkey) {
            // Eigene Boards dürfen nicht in den Shared-Cache gelangen (sonst Duplikate)
            return;
        }

        const exists = this.cachedSharedBoards.some(b => b.id === eventData.id);
        if (!exists) {
            this.cachedSharedBoards = [
                ...this.cachedSharedBoards,
                {
                    id: eventData.id,
                    name: eventData.name,
                    description: eventData.description,
                    createdAt: eventData.createdAt,
                    updatedAt: eventData.updatedAt,
                    lastAccessed: undefined,
                    hasUnseenChanges: false,
                    isShared: true,
                    userRole: eventData.userRole,
                    author: eventData.author
                }
            ];
            // Nur UI Refresh, kein Publish nötig
            this.triggerUpdate({ publish: false });
            console.log(`✨ Shared Board hinzugefügt (auto): ${eventData.name} (${eventData.id})`);
        }
    }

    /**
     * ✅ HELPER: Lädt geteilte Boards asynchron aus Nostr und triggert Update
     * 
     * WICHTIG: Merged mit existierendem Cache statt zu ersetzen!
     * Grund: Boards können via followerSub Events real-time hinzugefügt werden.
     * Wenn wir den Cache ersetzen, verlieren wir diese real-time Boards!
     */
    public async loadSharedBoardsAsync(currentUserPubkey: string): Promise<void> {
        try {
            console.log(`🔍 loadSharedBoardsAsync called with pubkey: ${currentUserPubkey.slice(0, 8)}...`);
            
            const ndk = this.nostrIntegration.getNDK();
            if (!ndk) {
                console.warn('⚠️ NDK nicht verfügbar für Shared Boards Loading');
                return;
            }

            // Verhindere mehrfaches gleichzeitiges Laden
            if (this.isLoadingSharedBoards) {
                console.log('⏸️ Bereits am Laden - überspringe');
                return;
            }
            this.isLoadingSharedBoards = true;

            console.log('📡 Starte Nostr Abfrage für geteilte Boards...');

            // 0️⃣ Cross-Device Leave: Sync Left-Boards Liste (NIP-51) → Hide Registry
            // Damit werden verlassene Boards schon beim Discovery/Load konsequent gefiltert.
            await BoardSharingOperations.syncLeftBoardsFromNostr(currentUserPubkey, ndk);
            
            // 1️⃣ Lade Boards wo User in p-tags ist (OWNER/EDITOR)
            const sharedBoards = await BoardSharingOperations.loadSharedBoardsFromNostr(
                currentUserPubkey,
                ndk
            );
            console.log(`✅ p-tags Boards: ${sharedBoards.length}`);
            
            // 2️⃣ Lade Boards aus User's eigenem Follow-Set (VIEWER)
            const followedBoards = await BoardSharingOperations.loadFollowedBoardsFromNostr(
                currentUserPubkey,
                ndk
            );
            console.log(`✅ Follow-Set Boards: ${followedBoards.length}`);

            // ⚠️ KRITISCH: Merge mit existierendem Cache, nicht ersetzen!
            // Sonst verlieren wir Boards, die via followerSub Events real-time hinzugefügt wurden
            const boardMap = new Map<string, typeof sharedBoards[0]>();
            
            // Existierende Boards zuerst (prioritär, da sie real-time sind)
            for (const board of this.cachedSharedBoards) {
                boardMap.set(board.id, board);
            }
            
            // Neue Boards aus Nostr hinzufügen (bei Duplikaten gewinnt Cache)
            for (const board of [...sharedBoards, ...followedBoards]) {
                if (!boardMap.has(board.id)) {
                    boardMap.set(board.id, board);
                }
            }
            
            this.cachedSharedBoards = Array.from(boardMap.values());
            
            if (sharedBoards.length > 0 || followedBoards.length > 0 || this.cachedSharedBoards.length > 0) {
                console.log(`📥 Geteilte Boards geladen: ${sharedBoards.length} (p-tags) + ${followedBoards.length} (Follow-Set) = ${this.cachedSharedBoards.length} total`);
                this.triggerUpdate({ publish: false }); // UI Update ohne Nostr Publishing
            }

        } catch (error) {
            console.error('❌ Fehler beim Laden geteilter Boards:', error);
        } finally {
            this.isLoadingSharedBoards = false;
        }
    }

    /**
     * ✅ NEUE METHODE: Verlässt ein geteiltes Board
     * 
     * @param boardId - Board ID
     */
    public async leaveBoard(boardId: string): Promise<void> {
        const currentUserPubkey = this.getCurrentUserPubkey();
        if (!currentUserPubkey) {
            throw new Error('Nutzer nicht authentifiziert');
        }
        
        try {
            const ndk = this.nostrIntegration.getNDK();
            const cached = this.cachedSharedBoards.find(b => b.id === boardId);
            await BoardSharingOperations.leaveBoard(boardId, currentUserPubkey, ndk, cached?.author);
            
            // Entferne Board aus dem Cache der geteilten Boards
            this.cachedSharedBoards = this.cachedSharedBoards.filter(b => b.id !== boardId);
            
            // Entferne auch aus localStorage falls vorhanden (sollte nicht der Fall sein für geteilte Boards)
            this.boardIds = this.boardIds.filter(id => id !== boardId);
            
            this.triggerUpdate({ publish: false });
            console.log(`✅ Board ${boardId} erfolgreich verlassen`);
            
        } catch (error) {
            console.error('❌ Fehler beim Verlassen des Boards:', error);
            throw error;
        }
    }

    /**
     * ⚡ REFRESH: Board IDs neu aus localStorage laden
     * 
     * Nützlich nach Filter-Fixes oder manuellen localStorage-Änderungen.
     * Ruft loadBoardIds() mit aktualisierter Filter-Logik auf.
     */
    public refreshBoardIds(): void {
        const oldCount = this.boardIds.length;
        this.boardIds = BoardStorage.loadBoardIds();
        const newCount = this.boardIds.length;
        
        console.log(`🔄 Board IDs refreshed: ${oldCount} → ${newCount}`);
        console.log(`   IDs: [${this.boardIds.slice(0, 5).join(', ')}${this.boardIds.length > 5 ? ', ...' : ''}]`);

        // ⚠️ KRITISCH: Refresh ist READ-ONLY.
        // NICHT triggerUpdate() aufrufen, weil das lastAccessedAt updated, speichert und ggf. publisht.
        // Das kann sonst Delete/Restore Feedback-Loops auslösen.
        this.updateTrigger++;
    }

    /**
     * 🧯 Recovery: setzt lokale Sichtbarkeits-Guards zurück.
     * - löscht Hidden/Leave Registry (Shared Boards)
     * - löscht Tombstone Registry (Deleted Boards)
     * - refreshed `boardIds` (aus localStorage-Keys)
     *
     * Hinweis: Das ist bewusst eine manuelle Recovery-Operation.
     */
    public resetBoardVisibilityGuards(): void {
        BoardSharingOperations.clearAllHiddenBoards();
        clearAllBoardTombstones();
        this.refreshBoardIds();
        this.triggerUpdate({ publish: false });
    }

    public updateCurrentBoardMeta(updates: { name?: string; description?: string; publishState?: 'draft' | 'published'; tags?: string[]; ccLicense?: string }): void {
        // Permission Check: Kann Benutzer Board-Einstellungen ändern?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditBoardMeta(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Nur der Board-Besitzer kann Name, Beschreibung, Tags, Lizenz und Publish-Status ändern.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        BoardOperations.updateBoardMetadata(this.board, updates);
        if (updates.publishState !== undefined) {
            BoardOperations.setBoardPublishState(this.board, updates.publishState);
        }
        this.triggerUpdate();
        this.publishBoardAsync();
    }

    public setPublishState(state: 'draft' | 'published'): void {
        // Permission Check: Kann Benutzer Board-Einstellungen ändern?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditBoardMeta(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Nur der Board-Besitzer kann den Publish-Status ändern.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        BoardOperations.setBoardPublishState(this.board, state);
        this.triggerUpdate();
        this.publishBoardAsync();
    }

    public moveCard(cardId: string, fromColumnId: string, toColumnId: string): void {
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditBoard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, die Board-Einstellungen zu ändern.'
            });
            return; // Silently fail - Permission denied message already shown
        }

        if (BoardOperations.moveCard(this.board, cardId, fromColumnId, toColumnId)) {
            // ⚡ Update lastAccessedAt damit Board in Liste nach oben rutscht
            this.board.updateLastAccessed();
            
            // Wir publishen den Move als Card-Event (30302). Board-Publish (30301) ist dafür nicht nötig.
            // Zusätzlich: triggerUpdate mit publish=false, damit Editor-Flows nicht unnötig publishBoardAsync() anstoßen.
            this.triggerUpdate({ publish: false });
            // ⚠️ CRITICAL: Position (column/rank) ist Teil des Card-Events (30302).
            // Wenn wir hier nur das Board publizieren, kann Reload/Remote-Sync die Move-Position verlieren.
            this.publishCardAsync(cardId);
        }
    }

    private async publishBoardAsync(): Promise<void> {
        // 🔒 Board-Events (Kind 30301) sind parametrized replaceable und werden unter der Signer-Pubkey adressiert.
        // Wenn ein Editor publisht, entsteht ein Fork-Board (30301:<editorPubkey>:<d>) und kann Maintainers/Meta „wegschreiben“.
        // Daher: Board-Publish nur als OWNER (oder Demo-Board).
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canPublishBoard(userRole, boardId)) return;

        await this.nostrIntegration.publishBoard(this.board);
    }

    /**
     * Publiziert das aktuelle Board zu Nostr und gibt die Event-ID zurück
     * @returns Event-ID des publizierten Events oder null bei Fehler
     */
    public async publishBoardAndGetEventId(): Promise<string | null> {
        return await this.nostrIntegration.publishBoard(this.board);
    }

    private async publishCardAsync(cardId: string): Promise<void> {
        await this.nostrIntegration.publishCard(this.board, cardId);
    }

    private async publishCommentAsync(cardId: string, commentId: string): Promise<void> {
        await this.nostrIntegration.publishComment(this.board, cardId, commentId);
    }

    // ============================================================================
    // CARD/COLUMN OPERATIONS (delegiert zu BoardOperations)
    // ============================================================================
    
    public createCard(columnId: string, name: string, description?: string): string {
        // Permission Check: Kann Benutzer Karten erstellen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canCreateCard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Karten zu erstellen.'
            });
            return ''; // Silently fail - Permission denied message already shown
        }
        
        const { author, authorName } = this.getAuthorFields();
        const cardId = BoardOperations.createCard(
            this.board, 
            columnId, 
            name, 
            description, 
            author,
            authorName || undefined // ← NEU: Display name (null → undefined)
        );
        
        if (cardId) {
            // ⚡ Update lastAccessedAt damit Board in Liste nach oben rutscht
            this.board.updateLastAccessed();
            
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
        
        return cardId || '';
    }

    public editCard(cardId: string, updates: Partial<CardProps>): void {
        // Permission Check: Kann Benutzer Karten bearbeiten?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditCard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Karten zu bearbeiten.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        if (BoardOperations.updateCard(this.board, cardId, updates)) {
            // ⚡ Update lastAccessedAt damit Board in Liste nach oben rutscht
            this.board.updateLastAccessed();
            
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
    }

    public async deleteCard(cardId: string): Promise<void> {
        // Permission Check: Kann Benutzer Karten löschen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canDeleteCard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Karten zu löschen.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        // Lösche Card lokal UND auf Nostr (via BoardOperations)
        const success = await BoardOperations.deleteCard(
            this.board,
            cardId,
            this.nostrIntegration
        );

        if (success) {
            // ⚡ Update lastAccessedAt damit Board in Liste nach oben rutscht
            this.board.updateLastAccessed();
            
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    public createColumn(name: string, color?: string): string {
        // Permission Check: Kann Benutzer Spalten erstellen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canCreateColumn(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Spalten zu erstellen.'
            });
            return ''; // Silently fail - Permission denied message already shown
        }
        
        const columnId = BoardOperations.createColumn(this.board, name, color);
        
        if (columnId) {
            this._columnOrder = [...this._columnOrder, columnId];
            this.triggerUpdate();
            this.publishBoardAsync();
        }
        
        return columnId || '';
    }

    public updateColumn(columnId: string, updates: Partial<ColumnProps>): void {
        // Permission Check: Kann Benutzer Spalten bearbeiten?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditColumn(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Spalten zu bearbeiten.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        if (BoardOperations.updateColumn(this.board, columnId, updates)) {
            // Wir publizieren hier manuell (Owner: 30301, Editor: Column-Patch), daher publish=false.
            this.triggerUpdate({ publish: false });

            if (PermissionChecks.canPublishBoard(userRole, boardId)) {
                void this.publishBoardAsync();
            } else {
                const namePatch = typeof updates.name === 'string' ? updates.name.trim() : '';
                const colorPatch = typeof updates.color === 'string' ? updates.color : '';

                const patchEntry: { id: string; name?: string; color?: string } = { id: columnId };
                if (namePatch.length > 0) patchEntry.name = namePatch;
                if (colorPatch.length > 0) patchEntry.color = colorPatch;

                if (patchEntry.name || patchEntry.color) {
                    void this.publishColumnPatchAsync({ columns: [patchEntry] });
                }
            }
        }
    }

    public deleteColumn(columnId: string): void {
        // Permission Check: Kann Benutzer Spalten löschen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canDeleteColumn(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Spalten zu löschen.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        if (BoardOperations.deleteColumn(this.board, columnId)) {
            this._columnOrder = this._columnOrder.filter(id => id !== columnId);
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    public handleCardMove(cardId: string, fromColumnId: string, toColumnId: string): void {
        // Permission Check: Kann Benutzer Karten verschieben?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canMoveCard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Karten zu verschieben.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        if (BoardOperations.moveCard(this.board, cardId, fromColumnId, toColumnId)) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
    }

    public reorderColumns(columnIds: string[]): void {
        // Permission Check: Kann Benutzer Spalten-Reihenfolge ändern?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canEditColumn(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Spalten zu bearbeiten.'
            });
            return; // Silently fail - Permission denied message already shown
        }

        // No-op guard: Verhindert sichtbares "Re-sort"/Re-render, wenn die Reihenfolge identisch ist.
        // (Wichtig bei Board-Load + Subscriptions: der Patch kann die gleiche Order erneut liefern.)
        if (
            Array.isArray(columnIds) &&
            columnIds.length === this._columnOrder.length &&
            this._columnOrder.every((v, i) => v === columnIds[i])
        ) {
            return;
        }
        
        this._columnOrder = columnIds;
        BoardOperations.reorderColumns(this.board, columnIds);
        // Wir publizieren hier manuell (Owner: 30301, Editor: ColumnOrder-Patch), daher publish=false.
        this.triggerUpdate({ publish: false });

        if (PermissionChecks.canPublishBoard(userRole, boardId)) {
            void this.publishBoardAsync();
        } else {
            void this.publishColumnOrderPatchAsync(columnIds);
        }
    }

    private syncInProgress = $state(false);
    private pendingSyncData: UIColumn[] | null = null;
    private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private lastDnDSyncAbortToastAt = 0;
    public dndSyncAbortToken = $state(0);
    private lastColumnOrderPatchAtMs = $state(0);
    private syncRetryCount = 0;
    private maxSyncRetries = 3;

    private async publishColumnOrderPatchAsync(columnIds: string[]): Promise<void> {
        await this.nostrIntegration.publishColumnOrderPatch(this.board, columnIds);
    }

    private async publishColumnPatchAsync(args: {
        columnOrder?: string[];
        columns?: Array<{ id: string; name?: string; color?: string }>;
    }): Promise<void> {
        await this.nostrIntegration.publishColumnPatch(this.board, args);
    }

    public applyColumnOrderPatchFromNostr(args: {
        boardId: string;
        columnOrder: string[];
        columnUpdates?: Array<{
            id: string;
            namePresent: boolean;
            colorPresent: boolean;
            name?: string;
            color?: string;
        }>;
        eventTimeMs: number;
        publisherPubkey?: string;
    }): boolean {
        const { boardId, columnOrder, eventTimeMs } = args;
        const columnUpdates = Array.isArray(args.columnUpdates) ? args.columnUpdates : [];
        if (boardId !== this.board.id) return false;
        const hasOrderPatch = Array.isArray(columnOrder) && columnOrder.length > 0;
        const hasMetaPatch = columnUpdates.length > 0;
        if (!hasOrderPatch && !hasMetaPatch) return false;
        if (!(typeof eventTimeMs === 'number' && Number.isFinite(eventTimeMs) && eventTimeMs > 0)) return false;
        if (eventTimeMs <= this.lastColumnOrderPatchAtMs) return false;

        let didChange = false;

        // 1) Column metadata patches (name/color)
        if (hasMetaPatch) {
            for (const patch of columnUpdates) {
                if (!patch?.id) continue;
                const col = this.board.findColumn(patch.id);
                if (!col) continue;

                const next: Partial<ColumnProps> = {};

                if (patch.namePresent && typeof patch.name === 'string') {
                    const incomingName = patch.name.trim();
                    if (incomingName.length > 0 && incomingName !== col.name) {
                        next.name = incomingName;
                    }
                }

                if (patch.colorPresent && typeof patch.color === 'string') {
                    const incomingColor = patch.color;
                    const currentColor = col.color || '';
                    if (incomingColor !== currentColor) {
                        next.color = incomingColor;
                    }
                }

                if (Object.keys(next).length > 0) {
                    col.update(next);
                    didChange = true;
                }
            }
        }

        // 2) Column order patch
        if (hasOrderPatch) {
            const existingColumnIds = this.board.columns.map((c) => c.id);
            const existingSet = new Set(existingColumnIds);

            const dedupedIncoming: string[] = [];
            const seen = new Set<string>();
            for (const id of columnOrder) {
                if (typeof id !== 'string' || id.length === 0) continue;
                if (seen.has(id)) continue;
                seen.add(id);
                if (existingSet.has(id)) dedupedIncoming.push(id);
            }

            if (dedupedIncoming.length > 0) {
                // Defensive merge: keep all existing columns, never drop unknowns.
                const mergedOrder = [
                    ...dedupedIncoming,
                    ...existingColumnIds.filter((id) => !seen.has(id)),
                ];

                // No-op guard: wenn Order identisch ist, nur LWW-Timestamp aktualisieren.
                // Das verhindert den sichtbaren "neu sortiert"-Effekt beim Board-Load,
                // wenn ein Patch/Event die gleiche Reihenfolge nochmals liefert.
                const current = this._columnOrder;
                const sameOrder =
                    current.length === mergedOrder.length && current.every((v, i) => v === mergedOrder[i]);
                if (!sameOrder) {
                    this._columnOrder = mergedOrder;
                    BoardOperations.reorderColumns(this.board, mergedOrder);
                    didChange = true;
                }
            }
        }

        // Always advance LWW timestamp once we've accepted this event (even if it was a no-op).
        this.lastColumnOrderPatchAtMs = eventTimeMs;

        if (!didChange) {
            return false;
        }

        // Lokale Persistierung/UI-Update, ohne Board-Event zu publizieren.
        this.triggerUpdate({ publish: false });

        return true;
    }

    public syncBoardState(uiColumns: UIColumn[]): boolean {
        // Permission Check: Kann Benutzer Karten verschieben?
        // (syncBoardState wird hauptsächlich für DnD verwendet)
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canMoveCard(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Karten zu verschieben.'
            });
            return false;
        }
        
        // Debounce: Sammle schnelle Änderungen
        this.pendingSyncData = uiColumns;
        
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            console.log('⏱️ Sync debounced (waiting for more changes)');
        }
        
        this.syncDebounceTimer = setTimeout(() => {
            this.executeSyncBoardState();
        }, 600); // 600ms debounce - gives user time to finish changes
        
        return true;
    }

    private async executeSyncBoardState(): Promise<void> {
        if (this.syncInProgress) {
            console.log('⏳ Sync bereits in Arbeit, warte...');
            return;
        }
        
        if (!this.pendingSyncData) return;
        
        this.syncInProgress = true;
        const uiColumns = this.pendingSyncData;
        this.pendingSyncData = null;
        
        console.group('📦 executeSyncBoardState');
        console.log('Processing columns:', uiColumns.length);
        
        try {
            const userRole = this.getCurrentUserRole();
            const boardId = this.board.id;
            const prevColumnOrder = [...this._columnOrder];

            const { newColumnOrder, movedCardIds } = BoardOperations.syncBoardState(
                this.board,
                this._columnOrder,
                uiColumns,
                { strategy: 'hard-fail' }
            );
            this._columnOrder = newColumnOrder;
            const columnOrderChanged =
                prevColumnOrder.length !== newColumnOrder.length ||
                prevColumnOrder.some((v, i) => v !== newColumnOrder[i]);
            
            // ⚡ CRITICAL: triggerUpdate mit publish=false
            // Grund: Wir publishen selbst weiter unten sequentiell!
            this.triggerUpdate({ publish: false });
			
            // Publishing sequentiell (nicht parallel) um Race Conditions zu vermeiden
            // - Owner: publisht 30301 nur wenn Column-Order tatsächlich geändert wurde
            // - Editor: publisht ColumnOrder-Patch (kein 30301 Fork)
            if (columnOrderChanged) {
                if (PermissionChecks.canPublishBoard(userRole, boardId)) {
                    console.log('📤 Publishing board (column order changed)...');
                    await this.publishBoardAsync();
                } else {
                    console.log('📤 Publishing column order patch (editor)...');
                    await this.publishColumnOrderPatchAsync(newColumnOrder);
                }
            }
            
            // Publiziere verschobene Cards
            if (movedCardIds.length > 0) {
                console.log(`📤 Publishing ${movedCardIds.length} moved cards...`);
                for (const cardId of movedCardIds) {
                    await this.publishCardAsync(cardId);
                }
            }
            
            console.log('✅ Sync complete');
            this.syncRetryCount = 0; // Reset retry counter on success
        } catch (error) {
            console.error('❌ Sync failed (attempt ' + (this.syncRetryCount + 1) + '/' + this.maxSyncRetries + '):', error);

            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('syncBoardState hard-fail')) {
                this.dndSyncAbortToken++;
                this.syncRetryCount++;

                // Retry with exponential backoff if not exceeded max retries
                if (this.syncRetryCount < this.maxSyncRetries && this.pendingSyncData) {
                    const retryDelay = Math.min(1000 * Math.pow(2, this.syncRetryCount - 1), 4000);
                    console.log(`⏳ Retrying sync in ${retryDelay}ms...`);
                    
                    setTimeout(() => {
                        this.executeSyncBoardState();
                    }, retryDelay);
                } else if (this.syncRetryCount >= this.maxSyncRetries) {
                    // Only show error after exhausting all retries
                    const now = Date.now();
                    if (now - this.lastDnDSyncAbortToastAt > 2000) {
                        toast.error('Synchronisierung fehlgeschlagen', {
                            description:
                                'Die Änderungen konnten nicht gespeichert werden.'
                        });
                        this.lastDnDSyncAbortToastAt = now;
                    }
                    this.syncRetryCount = 0; // Reset for next operation
                }
            }
        } finally {
            this.syncInProgress = false;
            console.groupEnd();
            
            // Falls während dem Sync neue Daten angekommen sind
            if (this.pendingSyncData) {
                console.log('🔄 Neue Änderungen vorhanden, starte erneut...');
                this.executeSyncBoardState();
            }
        }
    }

    public async addComment(cardId: string, text: string, authorOverride?: string): Promise<void> {
        // Permission Check: Kann Benutzer Kommentare hinzufügen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canAddComment(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Kommentare hinzuzufügen.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        // ⚡ NEW: Get both author fields
        const { author: defaultAuthor, authorName } = this.getAuthorFields();
        const author = authorOverride || defaultAuthor;
        
        // ⚡ NEW: Pass authorName to BoardOperations
        const commentId = BoardOperations.addComment(
            this.board, 
            cardId, 
            text, 
            author,
            authorOverride ? undefined : (authorName || undefined) // ← NEU: Nur wenn kein Override
        );
        
        if (commentId) {
            // ⚡ Update lastAccessedAt damit Board in Liste nach oben rutscht
            this.board.updateLastAccessed();
            
            this.triggerUpdate();
            await this.publishCommentAsync(cardId, commentId);
        }
    }

    public deleteComment(cardId: string, commentId: string): void {
        // Permission Check: Kann Benutzer Kommentare löschen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canDeleteComment(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Kommentare zu löschen.'
            });
            return; // Silently fail - Permission denied message already shown
        }
        
        if (BoardOperations.deleteComment(this.board, cardId, commentId)) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
    }

    /**
     * Loads comments for a specific card from Nostr relays
     * Fetches Kind 1 events and merges with local comments
     * 
     * @param cardId - ID of the card to load comments for
     * 
     * @example
     * ```typescript
     * await boardStore.loadComments('card-123');
     * // Fetches all remote comments, merges with local, persists to storage
     * ```
     */
    public async loadComments(cardId: string): Promise<void> {
        if (!this.nostrIntegration) {
            console.warn('[BoardStore] loadComments: Nostr integration not available');
            return;
        }

        await this.nostrIntegration.loadComments(this.board, cardId);
        
        // Trigger UI update after comments are loaded (WITHOUT Nostr publish)
        // Reason: Loading comments doesn't change board structure, only card data
        this.triggerUpdate({ publish: false });
    }

    /**
     * ⚡ Phase 3B: Subscribes to live comment updates for a specific card
     * 
     * Creates a persistent subscription for all Kind 1 events targeting this card.
     * New comments will be automatically merged with existing ones and trigger UI updates.
     * 
     * **WICHTIG:** Cleanup-Funktion MUSS aufgerufen werden (z.B. in onDestroy)!
     * 
     * @param cardId - ID of the card to subscribe to
     * @returns Cleanup function to stop the subscription
     * 
     * @example
     * ```typescript
     * // In CardViewDialog.svelte:
     * let unsubscribe: () => void;
     * 
     * onMount(() => {
     *     unsubscribe = boardStore.subscribeToComments(card.id);
     * });
     * 
     * onDestroy(() => {
     *     unsubscribe?.();
     * });
     * ```
     */
    public subscribeToComments(cardId: string): () => void {
        if (!this.nostrIntegration) {
            console.warn('[BoardStore] subscribeToComments: Nostr integration not available');
            return () => {}; // Return no-op cleanup function
        }

        return this.nostrIntegration.subscribeToComments(
            this.board,
            cardId,
            () => this.triggerUpdate({ publish: false }) // Callback for UI updates (WITHOUT Nostr publish - comment already on relay)
        );
    }

    /**
     * Subscribes to live comment updates for ALL cards in the current board.
     *
     * This matches the common expectation that comments sync in the background,
     * not only when a card dialog is opened.
     *
     * Returns a cleanup function that stops all per-card subscriptions created by this call.
     */
    public subscribeToAllComments(): () => void {
        const board = this.board;
        if (!board) {
            console.warn('[BoardStore] subscribeToAllComments: No board loaded');
            return () => {};
        }

        const unsubscribers: Array<() => void> = [];
        for (const column of board.columns || []) {
            for (const card of column.cards || []) {
                unsubscribers.push(this.subscribeToComments(card.id));
            }
        }

        return () => {
            for (const unsub of unsubscribers) {
                try {
                    unsub();
                } catch {
                    // ignore
                }
            }
        };
    }

    /**
     * 🚀 Phase 4B: Load comments for ALL cards in the current board
     * 
     * Batch-loads comments from Nostr relays for all cards in parallel.
     * This provides a much better UX than loading comments individually per card.
     * 
     * **Performance:** Uses Promise.all() for parallel fetching
     * **Cache:** Results are persisted to localStorage via loadComments()
     * **UI:** Triggers update after all comments are loaded
     * 
     * @example
     * ```typescript
     * // In Board.svelte onMount:
     * onMount(async () => {
     *     await boardStore.loadBoard(boardId);
     *     await boardStore.loadAllComments(); // ← AUTO-LOAD!
     * });
     * ```
     */
    public async loadAllComments(): Promise<void> {
        const board = this.board;
        if (!board) {
            console.warn('[BoardStore] loadAllComments: No board loaded');
            return;
        }
        
        console.log('📥 Batch-loading comments for all cards in board...');
        
        // Collect all card IDs from all columns
        const cardIds: string[] = [];
        for (const column of board.columns) {
            for (const card of column.cards) {
                cardIds.push(card.id);
            }
        }
        
        if (cardIds.length === 0) {
            console.log('ℹ️ No cards in board, skipping comment load');
            return;
        }
        
        // console.log(`📋 Found ${cardIds.length} cards, loading comments...`);
        
        // Batch load all comments in parallel
        const startTime = performance.now();
        
        try {
            await Promise.all(
                cardIds.map(cardId => this.loadComments(cardId))
            );
            
            const duration = (performance.now() - startTime).toFixed(0);
            // console.log(`✅ Loaded comments for ${cardIds.length} cards in ${duration}ms`);
        } catch (error) {
            console.error('❌ Error batch-loading comments:', error);
        }
        
        // ⚡ OPTIMIZATION: Trigger UI update WITHOUT publishing to Nostr
        // Reason: Loading comments doesn't change the board structure itself
        // Only cards were updated with comments from Nostr
        this.triggerUpdate({ publish: false }); // ← Skip publish!
    }

    // ============================================================================
    // EXPORT/IMPORT (delegiert zu ExportImport)
    // ============================================================================
    
    public exportBoardAsJson(includeMetadata = true): string {
        return ExportImport.exportBoardAsJson(this.board, includeMetadata);
    }

    public importBoardFromJson(jsonString: string, mode: 'merge' | 'new' | 'overwrite' = 'merge') {
        return ExportImport.importBoardFromJson(jsonString, mode);
    }

    public saveImportedBoard(board: Board, overwriteExisting = false): string {
        // ⚡ FIX: Duplikate vermeiden mit Set
        if (overwriteExisting) {
            if (!this.boardIds.includes(board.id)) {
                this.boardIds = [...this.boardIds, board.id];
            }
        } else {
            if (!this.boardIds.includes(board.id)) {
                this.boardIds = [...this.boardIds, board.id];
            }
        }

        // BoardStorage.saveBoardIds() removed - deprecated, auto-discovered from localStorage
        BoardStorage.saveBoard(board);

        this.board = board;
        this._columnOrder = board.columns.map(c => c.id);
        this.triggerUpdate();

        console.log(`✅ Importiertes Board gespeichert: ${board.name}`);
        return board.id;
    }

    public restoreAllBoardsFromBackup(jsonString: string) {
        const result = ExportImport.restoreAllBoardsFromBackup(jsonString);
        
        if (result.success && result.boards.length > 0) {
            const newBoardIds = result.boards.map(b => b.id);
            this.boardIds = [...new Set([...this.boardIds, ...newBoardIds])];
            // BoardStorage.saveBoardIds() removed - deprecated, auto-discovered from localStorage
            
            this.board = result.boards[0];
            this._columnOrder = this.board.columns.map(c => c.id);
            this.triggerUpdate();
        }
        
        return result;
    }

    public async generateShareLink(boardIdOrMetadata?: string | boolean, includeMetadata = true) {
        // Backward compatibility: alte Signatur generateShareLink(includeMetadata)
        // Neue Signatur: generateShareLink(boardId, includeMetadata)
        let targetBoardId: string;
        let metadata: boolean;
        
        if (typeof boardIdOrMetadata === 'string') {
            targetBoardId = boardIdOrMetadata;
            metadata = includeMetadata;
        } else {
            targetBoardId = this.board.id;
            metadata = boardIdOrMetadata !== undefined ? boardIdOrMetadata : true;
        }
        
        // Load the target board temporarily if not current
        const wasCurrentBoard = targetBoardId === this.board.id;
        const originalBoardId = this.board.id;
        
        if (!wasCurrentBoard) {
            this.loadBoard(targetBoardId);
        }
        
        const result = await ExportImport.generateShareLink(this.board, metadata);
        
        // Restore original board if we switched
        if (!wasCurrentBoard) {
            this.loadBoard(originalBoardId);
        }
        
        return result;
    }

    public parseShareToken(token: string): any {
        return ExportImport.parseShareToken(token);
    }

    public importFromShareToken(token: string, mode: 'merge' | 'new' | 'overwrite' = 'merge') {
        try {
            const parsed = this.parseShareToken(token);
            const boardData = parsed.board || parsed;
            const jsonString = JSON.stringify(boardData);
            return this.importBoardFromJson(jsonString, mode);
        } catch (error) {
            console.error('❌ Share-Token Import fehlgeschlagen:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    // ============================================================================
    // PASTE HANDLERS (delegiert zu PasteHandler)
    // ============================================================================
    
    public handleCardPaste(cardId: string, pastedData: any): { success: boolean; type?: string; debug?: any; error?: string } {
        const author = this.getSafeAuthor();
        const success = PasteHandler.handleCardPaste(this.board, cardId, pastedData, author);
        
        if (success) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
            return { success: true, type: 'card' };
        }
        
        return { success: false, error: 'Paste fehlgeschlagen' };
    }

    public handleColumnPaste(columnId: string, pastedCards: any[]): { success: boolean; type?: string; debug?: any; error?: string } {
        const author = this.getSafeAuthor();
        const cardIds = PasteHandler.handleColumnPaste(this.board, columnId, pastedCards, author);
        
        if (cardIds.length > 0) {
            this.triggerUpdate();
            this.publishBoardAsync();
            return { success: true, type: 'column', debug: { cardIds } };
        }
        
        return { success: false, error: 'Keine Karten erstellt' };
    }

    // ============================================================================
    // CHAT INTEGRATION (delegiert zu ChatIntegration)
    // ============================================================================
    
    public initializeChat(): Chat {
        return ChatIntegration.initializeChat(this.board);
    }

    public get chatInstance(): Chat | null {
        return ChatIntegration.getChatInstance();
    }

    // ============================================================================
    // BOARD SHARING & PERMISSIONS (2-Layer System)
    // ============================================================================

    /**
     * Fügt einen Editor (Maintainer) zum Board hinzu
     * @param pubkey - Nostr Public Key (Hex) des neuen Editors
     */
    public async addEditor(pubkey: string): Promise<void> {
        // Permission Check: Kann Benutzer andere Benutzer einladen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canInviteUsers(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Benutzer einzuladen.'
            });
            throw new Error('Berechtigung verweigert: Benutzer einladen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            console.error('❌ NDK Instanz nicht verfügbar – addEditor abgebrochen');
            throw new Error('NDK nicht verfügbar für addEditor');
        }
        await BoardSharingOperations.addEditor(
            this.board,
            pubkey,
            ndk
        );
        this.triggerUpdate({publish: true});
    }

    /**
     * Entfernt einen Editor vom Board
     * @param pubkey - Nostr Public Key des zu entfernenden Editors
     */
    public async removeEditor(pubkey: string): Promise<void> {
        // Permission Check: Kann Benutzer andere Benutzer verwalten?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canInviteUsers(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Benutzer-Zugriff zu entfernen.'
            });
            throw new Error('Berechtigung verweigert: Benutzer-Zugriff entfernen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            console.error('❌ NDK Instanz nicht verfügbar – removeEditor abgebrochen');
            throw new Error('NDK nicht verfügbar für removeEditor');
        }
        await BoardSharingOperations.removeEditor(
            this.board,
            pubkey,
            ndk
        );
        this.triggerUpdate({publish: true});
    }

    /**
     * Fügt einen Viewer (Follower) zum Board hinzu
     * @param pubkey - Nostr Public Key des neuen Viewers
     */
    public async addViewer(pubkey: string): Promise<void> {
        // Permission Check: Kann Benutzer andere Benutzer einladen?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canInviteUsers(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Benutzer einzuladen.'
            });
            throw new Error('Berechtigung verweigert: Benutzer einladen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            throw new Error('NDK nicht verfügbar');
        }
        
        await BoardSharingOperations.addViewer(
            this.board,
            pubkey,
            ndk
        );
        this.triggerUpdate({publish: true});
    }

    /**
     * Entfernt einen Viewer vom Board
     * @param pubkey - Nostr Public Key des zu entfernenden Viewers
     */
    public async removeViewer(pubkey: string): Promise<void> {
        // Permission Check: Kann Benutzer andere Benutzer verwalten?
        const userRole = this.getCurrentUserRole();
        const boardId = this.board.id;
        if (!PermissionChecks.canInviteUsers(userRole, boardId)) {
            toast.error('Fehlende Berechtigung', {
                description: 'Du hast keine Berechtigung, Benutzer-Zugriff zu entfernen.'
            });
            throw new Error('Berechtigung verweigert: Benutzer-Zugriff entfernen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            throw new Error('NDK nicht verfügbar');
        }
        
        await BoardSharingOperations.removeViewer(
            this.board,
            pubkey,
            ndk
        );
        this.triggerUpdate({publish: true});
    }

    /**
     * Lädt alle Board-Teilnehmer (Editoren + Viewer)
     */
    public async getBoardParticipants(): Promise<BoardShare[]> {
        return await BoardSharingOperations.getBoardParticipants(
            this.board
        );
    }

    /**
     * Owner UX: Leave-Requests (Kind 30000) für das aktuelle Board laden.
     * Wird im ShareDialog genutzt, um "Leave requested" zu markieren.
     */
    public async getLeaveRequestsForCurrentBoard(): Promise<Record<string, { eventId: string; createdAt?: number }>> {
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) return {};

        const boardId = this.board?.id;
        const boardAuthor = this.board?.author;
        if (!boardId || !boardAuthor) return {};

        const boardRef = `30301:${boardAuthor}:${boardId}`;
        return await BoardSharingOperations.loadLeaveRequestsForBoard(boardRef, ndk);
    }

    /**
     * Lädt Board Followers aus NIP-51 Follow Set Events
     */
    public async loadBoardFollowers(): Promise<void> {
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk || !this.board.author) return;
        
        const followers = await BoardSharingOperations.loadBoardFollowers(
            this.board,
            ndk
        );
        
        this.board.followers = followers;
        // ⚡ Secondary data load: persist locally, but never publish or bump lastAccessed
        BoardStorage.saveBoard(this.board);
        this.updateTrigger++;
    }

    /**
     * USER-CONTROLLED FOLLOW: Fügt Board zu EIGENER Follow-Set hinzu
     * Dies ist die RICHTIGE Art für Nutzer, einem Board zu folgen!
     * 
     * @param boardId - Board d-tag
     * @param boardAuthor - Board author pubkey (hex)
     */
    public async followBoard(boardId: string, boardAuthor: string): Promise<void> {
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            throw new Error('Nicht eingeloggt - Login erforderlich um Board zu folgen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            throw new Error('NDK nicht verfügbar');
        }
        
        // NIP-51 Follow-Set Event erstellen (signiert vom User selbst!)
        await BoardSharingOperations.followBoard(boardId, boardAuthor, ndk);
        
        console.log(`✅ Board gefolgt: ${boardId}`);
        toast.success('Board gefolgt!', {
            description: 'Das Board wurde zu deiner Liste hinzugefügt'
        });
        
        // Board-Liste neu laden
        if (currentUser) {
            await this.loadSharedBoardsAsync(currentUser);
        }
    }
    
    /**
     * USER-CONTROLLED FOLLOW + LOAD: Folgt dem Board UND lädt es direkt
     * Kombination für Share-Link-Workflow: Follow → Rekonstruieren → Laden
     * 
     * @param boardId - Board d-tag
     * @param boardAuthor - Board author pubkey (hex)
     * @returns true wenn erfolgreich geladen, false sonst
     */
    public async followAndLoadBoard(boardId: string, boardAuthor: string): Promise<boolean> {
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            throw new Error('Nicht eingeloggt - Login erforderlich um Board zu folgen');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            throw new Error('NDK nicht verfügbar');
        }
        
        try {
            // 1. Board zu Follow-Set hinzufügen
            await BoardSharingOperations.followBoard(boardId, boardAuthor, ndk);
            console.log(`✅ Board gefolgt: ${boardId}`);
            
            // 1.5. 🔴 KRITISCH: Board-Metadaten SOFORT zu cachedSharedBoards hinzufügen
            // Dies ist nötig weil reconstructSharedBoard() nach diesem Board im Cache sucht!
            // loadSharedBoardsAsync() würde es nicht finden (nur p-tags, nicht Follow-Sets)
            console.log(`🔄 Füge Board zu cachedSharedBoards hinzu...`);
            const existingBoard = this.cachedSharedBoards.find(b => b.id === boardId);
            if (!existingBoard) {
                // Temporäres Board-Metadaten-Objekt (wird später von Nostr überschrieben)
                this.cachedSharedBoards.push({
                    id: boardId,
                    name: 'Wird geladen...', // Platzhalter
                    createdAt: Date.now(),
                    isShared: true,
                    userRole: 'viewer', // Viewer weil via Follow-Set
                    author: boardAuthor
                });
                // 🔴 WICHTIG: triggerUpdate() für UI-Aktualisierung!
                this.triggerUpdate({ publish: false }); // Nur UI, kein Nostr
                console.log(`✅ Board temporär zu Cache hinzugefügt`);
            } else {
                console.log(`ℹ️ Board bereits im Cache`);
            }
            
            // 2. Board-Liste neu laden (optional, für zukünftige Reloads)
            await this.loadSharedBoardsAsync(currentUser);
            console.log(`✅ Board-Liste aktualisiert`);
            
            // 3. Board rekonstruieren von Nostr (falls nicht lokal vorhanden)
            // ⚠️ Recovery: wenn das Board tombstoned ist, zuerst gegen Nostr revalidieren.
            if (isBoardTombstoned(boardId)) {
                const revalidated = await this.revalidateSharedBoardTombstone(boardId, boardAuthor);
                if (revalidated !== 'recovered') {
                    console.warn(`⛔ followAndLoadBoard: Board ${boardId} bleibt tombstoned (${revalidated})`);
                    return false;
                }
            }

            const reconstructed = await this.reconstructSharedBoard(boardId);
            if (!reconstructed) {
                console.error(`❌ Board-Rekonstruktion fehlgeschlagen: ${boardId}`);
                return false;
            }
            console.log(`✅ Board rekonstruiert: ${boardId}`);
            
            // 4. Board laden und als aktiv setzen
            const loaded = this.loadBoard(boardId, { skipLastAccessed: false });
            if (!loaded) {
                console.error(`❌ Board-Laden fehlgeschlagen: ${boardId}`);
                return false;
            }
            console.log(`✅ Board geladen und aktiv: ${boardId}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Fehler bei followAndLoadBoard:', error);
            throw error;
        }
    }

    /**
     * USER-CONTROLLED UNFOLLOW: Entfernt Board aus EIGENER Follow-Set
     * User kann jederzeit sein eigenes Follow-Set ändern!
     * 
     * @param boardId - Board d-tag
     * @param boardAuthor - Board author pubkey (hex)
     */
    public async unfollowBoard(boardId: string, boardAuthor: string): Promise<void> {
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            throw new Error('Nicht eingeloggt');
        }
        
        const ndk = this.nostrIntegration?.getNDK();
        if (!ndk) {
            throw new Error('NDK nicht verfügbar');
        }
        
        // NIP-51 Follow-Set Event aktualisieren (signiert vom User selbst!)
        await BoardSharingOperations.unfollowBoard(boardId, boardAuthor, ndk);
        
        console.log(`✅ Board entfolgt: ${boardId}`);
        toast.success('Board entfolgt', {
            description: 'Das Board wurde aus deiner Liste entfernt'
        });
        
        // Board-Liste neu laden
        if (currentUser) {
            await this.loadSharedBoardsAsync(currentUser);
        }
    }

    /**
     * Prüft die Berechtigung des aktuellen Nutzers
     */
    public getCurrentUserRole(): BoardRole | null {
        const currentUser = authStore.getPubkey();
        return this.board.getUserRole(currentUser || undefined);
    }

    /**
     * Prüft ob der aktuelle Nutzer Editor-Rechte hat
     */
    public canCurrentUserEdit(): boolean {
        const currentUser = authStore.getPubkey();
        return this.board.canEditBoard(currentUser || undefined);
    }

    /**
     * Prüft ob der aktuelle Nutzer das Board löschen darf
     */
    public canCurrentUserDelete(): boolean {
        const currentUser = authStore.getPubkey();
        return this.board.canDeleteBoard(currentUser || undefined);
    }

    // ============================================================================
    // DEMO BOARD & USER MANAGEMENT
    // ============================================================================
    
    /**
     * Erstellt oder lädt Demo-Board für anonyme Benutzer
     */
    private getDemoBoardsForAnonymousUser(): Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number; lastAccessed?: number; hasUnseenChanges?: boolean }> {
        const demoBoardId = 'demo-board';
        let demoBoard = BoardStorage.loadBoard(demoBoardId);
        
        if (!demoBoard) {
            // Erstelle Demo-Board mit vorgefertigtem Inhalt
            demoBoard = this.createDemoBoard();
            BoardStorage.saveBoard(demoBoard);
            console.log('✅ Demo-Board für anonymen Benutzer erstellt');
        }
        
        return [{
            id: demoBoard.id,
            name: demoBoard.name,
            description: demoBoard.description,
            createdAt: new Date(demoBoard.createdAt).getTime(),
            updatedAt: demoBoard.updatedAt 
                ? new Date(demoBoard.updatedAt).getTime() 
                : new Date(demoBoard.createdAt).getTime(),
            lastAccessed: demoBoard.lastAccessedAt 
                ? new Date(demoBoard.lastAccessedAt).getTime() 
                : new Date(demoBoard.createdAt).getTime(),
            hasUnseenChanges: false
        }];
    }
    
    /**
     * Erstellt ein Demo-Board mit Beispieldaten
     */
    private createDemoBoard(): Board {
        const board = new Board({
            id: 'demo-board',
            name: '🎯 Demo-Board - Testen Sie die App!',
            description: 'Willkommen! Dies ist ein Demo-Board zum Ausprobieren. Erstellen Sie Karten, verschieben Sie sie zwischen Spalten und testen Sie alle Funktionen. Nach der Anmeldung können Sie echte Boards erstellen.',
            author: 'demo',
            authorName: 'Demo User',
            publishState: 'draft',
            columns: []
        });
        
        // Standard-Spalten hinzufügen
        const todoColumn = board.addColumn({ name: '📋 Zu erledigen', color: 'blue' });
        const progressColumn = board.addColumn({ name: '🔄 In Arbeit', color: 'orange' });
        const doneColumn = board.addColumn({ name: '✅ Erledigt', color: 'green' });
        
        // Beispiel-Karten hinzufügen
        todoColumn.addCard({
            heading: '👋 Willkommen im Demo-Board!',
            content: 'Dies ist eine Beispielkarte. Klicken Sie darauf, um sie zu bearbeiten, oder ziehen Sie sie in eine andere Spalte.',
            labels: ['demo', 'anleitung'],
            author: 'demo',
            authorName: 'Demo User'
        });
        
        todoColumn.addCard({
            heading: '📝 Neue Karte erstellen',
            content: 'Klicken Sie auf "Neue Karte" in einer Spalte, um eigene Inhalte hinzuzufügen.',
            labels: ['tipp'],
            author: 'demo',
            authorName: 'Demo User'
        });
        
        progressColumn.addCard({
            heading: '🚀 App erkunden',
            content: 'Probieren Sie alle Funktionen aus: Karten bearbeiten, Kommentare hinzufügen, Labels verwenden.',
            labels: ['in-progress'],
            author: 'demo',
            authorName: 'Demo User'
        });
        
        doneColumn.addCard({
            heading: '🎉 Demo erfolgreich gestartet',
            content: 'Sie haben das Demo-Board erfolgreich geladen! Melden Sie sich an, um echte Boards zu erstellen.',
            labels: ['erfolg'],
            author: 'demo',
            authorName: 'Demo User'
        });
        
        return board;
    }
    
    /**
     * Wandelt Demo-Board in echtes Board um nach dem Login
     */
    public migrateDemoBoardToRealBoard(): void {
        const currentUserPubkey = this.getCurrentUserPubkey();
        if (!currentUserPubkey) {
            console.warn('⚠️ Kann Demo-Board nicht migrieren: Kein authentifizierter Benutzer');
            return;
        }
        
        // ✅ FIX: Verwende SORTIERTE Board-Liste von getAllBoards() statt unsortierter getUserBoardsForPubkey()
        const existingUserBoards = this.getAllBoards();
        
        if (existingUserBoards.length > 0) {
            // Benutzer hat bereits Boards → Demo-Board löschen
            const wasOnDemoBoard = (this.board.id === 'demo-board');
            
            this.deleteDemoBoard();
            
            // ⚡ FIX: Demo-Board aus boardIds entfernen
            this.boardIds = this.boardIds.filter(id => id !== 'demo-board');
            
            // ✅ FIX: NUR zu anderem Board wechseln wenn User GERADE auf Demo-Board war!
            // Sonst bleibt User auf seinem aktuellen Board (bessere UX)
            if (wasOnDemoBoard && existingUserBoards.length > 0) {
                const firstUserBoardId = existingUserBoards[0].id;
                console.log(`🔄 User war auf Demo-Board - wechsle zum letzten Board: ${existingUserBoards[0].name}`);
                this.loadBoard(firstUserBoardId);
            } else if (!wasOnDemoBoard) {
                console.log(`✅ Demo-Board gelöscht - User bleibt auf aktuellem Board: ${this.board.name}`);
            }
            
            return;
        }
        
        // Benutzer hat noch keine Boards → Demo-Board in echtes Board umwandeln
        const demoBoard = BoardStorage.loadBoard('demo-board');
        if (demoBoard) {
            // Aktualisiere Board-Metadaten
            const { authorName } = this.getAuthorFields();
            demoBoard.author = currentUserPubkey;
            demoBoard.authorName = authorName || undefined;
            // Owner ist KEIN Maintainer (Editor) – maintainers sind nur Co-Editoren.
            demoBoard.maintainers = [];
            
            // Neuen Board-Namen und Beschreibung
            demoBoard.name = '🏠 Mein erstes Board';
            demoBoard.description = 'Willkommen bei Ihrem ersten echten Kanban-Board! Sie können den Namen und die Beschreibung jederzeit ändern.';
            
            // Neue Board-ID generieren
            const newBoardId = generateDTag();
            const oldId = demoBoard.id;
            demoBoard.id = newBoardId;
            
            // Aktualisiere alle Karten-Autoren
            demoBoard.columns.forEach(column => {
                column.cards.forEach(card => {
                    card.author = currentUserPubkey;
                    card.authorName = authorName || undefined;
                });
            });
            
            // Speichere das neue Board
            BoardStorage.saveBoard(demoBoard);
            
            // Lösche das alte Demo-Board
            if (typeof window !== 'undefined') {
                localStorage.removeItem('kanban-demo-board');
            }
            
            // ⚡ FIX: Board-IDs korrekt aktualisieren
            this.boardIds = [...this.boardIds.filter(id => id !== 'demo-board'), newBoardId];
            this.board = demoBoard;
            this._columnOrder = demoBoard.columns.map(c => c.id);
            
            // ⚡ FIX: Board-IDs neu laden um localStorage-Änderungen zu reflektieren
            this.refreshBoardIds();
            
            this.triggerUpdate();
            
            console.log(`✅ Demo-Board zu echtem Board migriert: ${oldId} → ${newBoardId}`);
            
            // Optional: Toast-Benachrichtigung
            if (typeof window !== 'undefined' && (window as any).toast) {
                (window as any).toast.success('Demo-Board wurde zu Ihrem ersten echten Board!');
            }
        }
    }
    
    /**
     * Löscht das Demo-Board komplett
     */
    private deleteDemoBoard(): void {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('kanban-demo-board');
            
            // ⚡ FIX: Board-IDs neu laden nach Demo-Board Löschung
            this.boardIds = this.boardIds.filter(id => id !== 'demo-board');
            this.refreshBoardIds();
            console.log('🗑️ Demo-Board gelöscht');
        }
    }
    
    /**
     * Prüft ob ein Benutzer Owner oder Maintainer eines Boards ist
     */
    private isUserOwnerOrMaintainer(boardId: string, userPubkey: string): boolean {
        const board = BoardStorage.loadBoard(boardId);
        if (!board) return false;
        
        // Owner check
        if (board.author === userPubkey) return true;
        
        // Maintainer check
        if (board.maintainers && board.maintainers.includes(userPubkey)) return true;
        
        return false;
    }
    
    /**
     * Lädt alle Boards eines bestimmten Benutzers
     */
    private getUserBoardsForPubkey(pubkey: string): Array<{ id: string; name: string }> {
        return this.boardIds
            .map(id => BoardStorage.loadBoard(id))
            .filter(board => board && (board.author === pubkey || (board.maintainers && board.maintainers.includes(pubkey))))
            .map(board => ({ id: board!.id, name: board!.name }));
    }
    
    /**
     * Hilfsmethode: Aktueller Benutzer Pubkey
     */
    private getCurrentUserPubkey(): string | null {
        try {
            return authStore?.currentUser?.pubkey || null;
        } catch (error) {
            return null;
        }
    }
    
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    
    public updateBoardAuthor(): void {
        this.fixAnonymousBoardAuthor();
    }

    public getContextData(full = true): any {
        return this.board.getContextData(full);
    }

    /**
     * ⚡ DEPRECATED: Use getAuthorFields() instead!
     * This method only returns pubkey, but we need both pubkey AND displayName.
     */
    private getSafeAuthor(): string {
        try {
            if (!authStore || typeof authStore.getPubkey !== 'function') {
                return 'anonymous';
            }
            return authStore.getPubkey() || 'anonymous';
        } catch {
            return 'anonymous';
        }
    }

    /**
     * ✅ NEW: Get both author fields (pubkey + displayName)
     * Uses authStore.getAuthorAttribution() to implement dual-field strategy
     * 
     * @returns Object with author (pubkey) and authorName (display name)
     */
    private getAuthorFields(): { author: string; authorName: string | null } {
        try {
            if (!authStore || typeof authStore.getAuthorAttribution !== 'function') {
                return { author: 'anonymous', authorName: null };
            }
            const { pubkey, displayName } = authStore.getAuthorAttribution();
            return {
                author: pubkey || 'anonymous',
                authorName: displayName  // can be null
            };
        } catch {
            return { author: 'anonymous', authorName: null };
        }
    }

    /**
     * ⚡ DEPRECATED & REMOVED: addBoardToMetadataList()
     * 
     * Nach Storage-Refactoring (Nov 2025):
     * - getAllBoardsMetadata() liest direkt aus kanban-{id} Keys
     * - kanban-boards-metadata wird NICHT mehr verwendet
     * - Metadaten sind Single Source of Truth im Board selbst
     * 
     * @deprecated Entfernt am 13.11.2025 - Nicht mehr nötig
     */
    private addBoardToMetadataList(metadata: {
        id: string;
        name: string;
        description: string;
        lastAccessed: string;
        author: string;
        publishState: string;
    }): void {
        // NO-OP: Metadaten werden nicht mehr separat gespeichert
        // getAllBoardsMetadata() liest direkt aus kanban-{id} Keys
    }

    private getDefaultColorForColumn(name: string): string {
        const normalized = name.toLowerCase().trim();
        const colorMap: Record<string, string> = {
            'to do': 'blue',
            'in progress': 'orange',
            'done': 'green',
            'archive': 'red'
        };
        return colorMap[normalized] || 'slate';
    }

    private exposeCurrentBoardIdToWindow(): void {
        if (typeof window !== 'undefined') {
            (window as any).__getCurrentBoardId = () => {
                console.log('📍 Aktuelles Board:', this.board.id, '|', this.board.name);
                return this.board.id;
            };
        }
    }

    // ========================================================================
    // EVENT-DRIVEN ARCHITECTURE v2.0: SECONDARY ACTIONS
    // Werden von Nostr-Event-Handlern aufgerufen (publish: false)
    // ========================================================================

    /**
     * ⚡ SEKUNDÄR: Card von Nostr-Event erstellen/updaten
     * KEIN Publish zu Nostr (publish: false)
     */
    public upsertCardFromNostr(cardProps: CardProps): void {
        BoardOperations.upsertCardFromNostr(this.board, cardProps);
        this.triggerUpdate({ publish: false });
    }

    /**
     * ⚡ v3.0: BACKGROUND BOARD SYNC
     * 
     * Card von Nostr-Event in BACKGROUND-Board einfügen/updaten
     * (Board ist NICHT aktuell geöffnet)
     * 
     * Wird aufgerufen wenn:
     * - Browser A hat Board 1 offen
     * - Browser B hat Board 2 offen
     * - Browser A fügt Card zu Board 1 hinzu
     * - Browser B empfängt Card-Event für Board 1 (Background-Board)
     * 
     * KEIN Publish zu Nostr (publish: false)
     * KEIN triggerUpdate (kein UI-Update, da Board nicht geöffnet)
     */
    public upsertCardToBackgroundBoard(boardId: string, cardProps: CardProps): void {
        // console.log(`📦 upsertCardToBackgroundBoard: Board ${boardId}, Card ${cardProps.id}`);
        
        // ⚡ FIX: Prüfe ob Board noch in boardIds existiert (nicht gelöscht!)
        if (!this.boardIds.includes(boardId)) {
            console.log(`⏭️ Board ${boardId} wurde gelöscht - skip card update`);
            return;
        }
        
        // 1. Lade Board aus localStorage
        const storageKey = `kanban-${boardId}`;
        const stored = localStorage.getItem(storageKey);
        
        if (!stored) {
            console.warn(`⚠️ Background Board ${boardId} not found in localStorage - skip card update`);
            return;
        }
        
        try {
            const boardData = JSON.parse(stored);
            
            // 2. Rekonstruiere Board-Instanz (ohne Reaktivität!)
            const tempBoard = BoardStorage.reconstructBoard(boardData);
            
            // 3. Füge/Update Card in tempBoard
            BoardOperations.upsertCardFromNostr(tempBoard, cardProps);
            
            // 4. Speichere Board zurück zu localStorage
            BoardStorage.saveBoard(tempBoard);
            
            console.log(`✅ Card ${cardProps.id} saved to background board ${boardId}`);
            
        } catch (error) {
            console.error(`❌ Error updating background board ${boardId}:`, error);
        }
    }

    /**
     * ⚡ SEKUNDÄR: Card von Nostr-Event löschen
     * KEIN Publish zu Nostr (publish: false)
     */
    public deleteCardFromNostr(cardId: string): void {
        BoardOperations.deleteCardFromNostr(this.board, cardId);
        this.triggerUpdate({ publish: false });
    }

    /**
     * ⚡ SEKUNDÄR: Board von Nostr-Event erstellen/updaten
     * KEIN Publish zu Nostr (publish: false)
     * 
     * Wird aufgerufen für:
     * - Neue Boards von anderen Usern (kollaboratives Erstellen)
     * - Updates auf Board-Metadaten (Name, Description, Tags)
     */
    public upsertBoardFromNostr(boardProps: BoardProps): void {
        if (!boardProps.id) {
            console.warn('⚠️ upsertBoardFromNostr: Board has no ID, skip');
            return;
        }

        // 🔒 Hard guard: Tombstoned Boards dürfen nie wieder durch Nostr-Events resurrected werden
        if (isBoardTombstoned(boardProps.id)) {
            return;
        }

        // 🔒 Hard guard: Hidden (Leave/Unfollow) Boards dürfen nicht re-inserted werden
        // ⚠️ Aber: niemals eigene Boards blockieren (sonst "aktive Boards unsichtbar" Bug).
        const currentUserPubkey = this.getCurrentUserPubkey();
        const isForeignBoard = Boolean(currentUserPubkey && boardProps.author && boardProps.author !== currentUserPubkey);
        if (isForeignBoard && BoardSharingOperations.isBoardHidden(boardProps.id, boardProps.author)) {
            return;
        }
        
        // ⚡ FIX: Prüfe ob Board noch existiert (nicht gelöscht!)
        // Wenn Board gelöscht wurde, ignoriere Updates
        const boardExists = this.boardIds.includes(boardProps.id) || boardProps.id === this.board.id;
        if (!boardExists) {
            console.log(`⏭️ Board ${boardProps.id} wurde gelöscht - skip board update`);
            return;
        }
        
        // ⚡ v4.2: DEBUG - Was kommt an?
        // console.log(`🔍 upsertBoardFromNostr DEBUG:`, {
        //     id: boardProps.id,
        //     name: boardProps.name,
        //     updatedAt: boardProps.updatedAt,
        //     updatedAtType: typeof boardProps.updatedAt
        // });
        
        // ⚡ Konvertiere ColumnProps zu kompaktem Format
        const columns = boardProps.columns?.map(c => ({
            id: c.id || '',
            name: c.name,
            color: c.color
        }));
        
        const isUpdate = BoardOperations.upsertBoardFromNostr(this.board, {
            id: boardProps.id,
            name: boardProps.name,
            description: boardProps.description,
            tags: boardProps.tags,
            columns, // ⚡ NEU: Spalten-Sync
            author: boardProps.author,
            maintainers: boardProps.maintainers, // ⚡ CRITICAL FIX: Sync maintainers from Nostr!
            followers: boardProps.followers, // ⚡ CRITICAL FIX: Sync followers from Nostr!
            publishState: boardProps.publishState,
            updatedAt: boardProps.updatedAt  // ⚡ v4.1: Timestamp MUSS weitergegeben werden!
        });
        
        if (isUpdate) {
            // Board-Metadaten + Spalten wurden aktualisiert
            // ⚡ CRITICAL: _columnOrder muss synchronisiert werden!
            this._columnOrder = this.board.columns.map(c => c.id);
            
            // ⚡ v4.1: KEIN saveToStorage bei Updates von Nostr!
            // Grund: Board existiert bereits in localStorage
            // Update wird erst beim nächsten User-Edit gespeichert
            // Das verhindert Race Conditions mit LWW
            this.updateTrigger++;  // ← NUR trigger update, KEIN save!
        } else {
            // ⚡ v4.2: NEUES Board - Erstelle VOLLSTÄNDIGES Board-Objekt!
            // Grund: Board existiert noch nicht in localStorage
            // User soll es in der Board-Liste UND beim Öffnen sehen können
            // KRITISCH: Nutze updatedAt vom Event, nicht NOW!
            console.log(`📦 upsertBoardFromNostr: Neues Board ${boardProps.id}, erstelle & speichere`);
            // console.log(`🔍 DEBUG: boardProps.updatedAt =`, boardProps.updatedAt);
            
            // 1. Erstelle vollständiges Board-Objekt aus boardProps
            const newBoard = new Board({
                id: boardProps.id,
                eventId: boardProps.eventId,
                name: boardProps.name,
                description: boardProps.description,
                tags: boardProps.tags,
                author: boardProps.author,
                maintainers: boardProps.maintainers || [], // ⚡ CRITICAL FIX: Include maintainers
                followers: boardProps.followers || [], // ⚡ CRITICAL FIX: Include followers
                publishState: boardProps.publishState,
                updatedAt: boardProps.updatedAt,  // ⚡ v4.2: Timestamp vom Event!
                columns: boardProps.columns
            });
            
            // console.log(`🔍 DEBUG: newBoard.updatedAt AFTER construction =`, newBoard.updatedAt);
            
            // 2. Speichere vollständiges Board zu localStorage
            // (Board hat jetzt den korrekten updatedAt-Timestamp vom Event)
            BoardStorage.saveBoard(newBoard);
            
            // 3. Board-Liste muss neu geladen werden
            this.boardIds = BoardStorage.loadBoardIds();
            
            // 4. Trigger update für UI
            this.updateTrigger++;
        }
    }

    // ============================================================================
    // BOARD SNAPSHOTS / VERSION HISTORY (Phase 1.5)
    // ============================================================================

    /**
     * 🔖 Creates a manual snapshot of the current board state
     * 
     * Publishes a Kind 30303 event to Nostr containing the complete board data.
     * Snapshots are non-replaceable, so each snapshot is a permanent record.
     * 
     * @param label - User-provided label/description for this version
     * @returns True if snapshot was created successfully
     * 
     * @example
     * ```typescript
     * await boardStore.createManualSnapshot('Before big refactor');
     * await boardStore.createManualSnapshot('Version 1.0 release');
     * ```
     */
    public async createManualSnapshot(label: string): Promise<boolean> {
        if (!this.nostrIntegration) {
            console.error('[BoardStore] ❌ Nostr not initialized - cannot create snapshot');
            return false;
        }

        if (!this.board) {
            console.error('[BoardStore] ❌ No board loaded - cannot create snapshot');
            return false;
        }

        try {
            const snapshotId = await this.nostrIntegration.publishSnapshot(
                this.board,
                label,
                'manual'
            );

            if (snapshotId) {
                console.log(`✅ [BoardStore] Snapshot "${label}" created: ${snapshotId}`);
                return true;
            } else {
                console.error('[BoardStore] ❌ Snapshot creation failed - no ID returned');
                return false;
            }
        } catch (error) {
            console.error('[BoardStore] ❌ Failed to create snapshot:', error);
            return false;
        }
    }

    /**
     * 🔍 Loads all snapshots for the current board from Nostr
     * 
     * @returns Array of snapshots sorted by timestamp (newest first)
     */
    public async loadSnapshots(): Promise<Array<{
        id: string;
        label: string;
        timestamp: number;
        reason: string;
        cardCount: number;
        columnCount: number;
        createdBy: string;
        boardData: any;
    }>> {
        if (!this.nostrIntegration) {
            console.error('[BoardStore] ❌ Nostr not initialized - cannot load snapshots');
            return [];
        }

        if (!this.board) {
            console.error('[BoardStore] ❌ No board loaded - cannot load snapshots');
            return [];
        }

        const boardAuthor = this.board.author || authStore.getPubkey() || '';
        
        if (!boardAuthor) {
            console.error('[BoardStore] ❌ No board author - cannot load snapshots');
            return [];
        }

        try {
            const snapshots = await this.nostrIntegration.loadSnapshots(
                this.board.id,
                boardAuthor
            );
            
            console.log(`✅ [BoardStore] Loaded ${snapshots.length} snapshot(s)`);
            return snapshots;
        } catch (error) {
            console.error('[BoardStore] ❌ Failed to load snapshots:', error);
            return [];
        }
    }

    /**
     * 🔄 Restores the board to a previous snapshot
     * 
     * This will:
     * 1. Create a backup snapshot of current state (before_restore)
     * 2. Replace current board data with snapshot data
     * 3. Save to localStorage
     * 4. Publish updated board to Nostr
     * 
     * @param snapshotId - The event ID of the snapshot to restore
     * @returns True if restore was successful
     */
    public async rollbackToSnapshot(snapshotId: string): Promise<boolean> {
        if (!this.nostrIntegration) {
            console.error('[BoardStore] ❌ Nostr not initialized - cannot rollback');
            return false;
        }

        if (!this.board) {
            console.error('[BoardStore] ❌ No board loaded - cannot rollback');
            return false;
        }

        try {
            // 1. Fetch the snapshot
            const snapshot = await this.nostrIntegration.fetchSnapshotById(snapshotId);
            
            if (!snapshot || !snapshot.boardData) {
                console.error(`[BoardStore] ❌ Snapshot ${snapshotId} not found or invalid`);
                return false;
            }

            console.log(`🔄 [BoardStore] Restoring to snapshot "${snapshot.label}"...`);

            // 2. Create backup of current state (before_restore)
            await this.nostrIntegration.publishSnapshot(
                this.board,
                `Backup vor Wiederherstellung: ${snapshot.label}`,
                'before_restore'
            );
            console.log(`💾 [BoardStore] Backup snapshot created`);

            // 3. Reconstruct board from snapshot data
            const { Board } = await import('../classes/BoardModel.js');
            const restoredBoard = new Board(snapshot.boardData);
            
            // Preserve the original board ID (don't use snapshot's ID)
            const originalId = this.board.id;
            restoredBoard.id = originalId;

            // 4. Replace current board
            this.board = restoredBoard;
            
            // 5. Save to localStorage
            BoardStorage.saveBoard(this.board);
            
            // 6. Update UI
            this.triggerUpdate({ publish: true });

            console.log(`✅ [BoardStore] Board restored to snapshot "${snapshot.label}"`);
            console.log(`   📊 Cards: ${snapshot.boardData.columns?.reduce((sum: number, col: any) => sum + (col.cards?.length || 0), 0) || 0}`);
            console.log(`   📁 Columns: ${snapshot.boardData.columns?.length || 0}`);

            return true;
        } catch (error) {
            console.error('[BoardStore] ❌ Failed to rollback to snapshot:', error);
            return false;
        }
    }

    /**
     * 🔖 Creates an automatic snapshot before a destructive operation
     * 
     * Called automatically before:
     * - Import operations (importBoardFromJson)
     * - Major board restructuring
     * 
     * @param reason - The reason for the snapshot
     * @returns True if snapshot was created successfully
     */
    public async createAutoSnapshot(reason: 'before_import' | 'auto_save'): Promise<boolean> {
        if (!this.nostrIntegration || !this.board) {
            return false;
        }

        const labelMap = {
            'before_import': 'Automatisches Backup vor Import',
            'auto_save': 'Automatisches Backup',
        };

        try {
            const snapshotId = await this.nostrIntegration.publishSnapshot(
                this.board,
                labelMap[reason],
                reason
            );

            return !!snapshotId;
        } catch (error) {
            console.error('[BoardStore] ⚠️ Auto-snapshot failed:', error);
            return false;
        }
    }
    
    /**
     * ⚡ HELPER: Refresh board list after external deletion
     * 
     * Called when deletion event received from another device
     */
    public refreshBoardList(): void {
        this.boardIds = BoardStorage.loadBoardIds();
        console.log(`🔄 Board list refreshed: ${this.boardIds.length} boards`);

        // Refresh ist READ-ONLY: UI update ohne triggerUpdate()-Side-Effects.
        this.updateTrigger++;
    }
    
    /**
     * ⚡ HELPER: Switch to another board after active board was deleted
     * 
     * Called when deletion event received for currently active board
     * 
     * @param deletedBoardId - ID of deleted board
     */
    public switchToAnotherBoardAfterDeletion(deletedBoardId: string): void {
        console.log(`⚠️ Active board ${deletedBoardId} was deleted - switching to another board`);
        
        // Refresh board list (might have changed)
        this.refreshBoardList();
        
        if (this.boardIds.length > 0) {
            // Switch to first available board
            const firstBoardId = this.boardIds[0];
            console.log(`🔄 Switching to first available board: ${firstBoardId}`);
            this.loadBoard(firstBoardId);
            
            // ⚡ FIX: Expliziter triggerUpdate() nach Board-Wechsel
            // Grund: loadBoard() ruft nur updateTrigger++ auf, aber nach deleteBoard()
            // muss die UI sofort aktualisiert werden (sonst wird gelöschtes Board noch angezeigt)
            // publish: false → kein Nostr-Publishing (Board wurde nur geladen, nicht geändert)
            this.triggerUpdate({ publish: false });
            console.log(`✅ UI forced update after board switch`);
        } else {
            // No boards left → create new empty board
            console.log(`📝 No boards left, creating new empty board`);
            this.createBoard('Neues Board', 'Automatisch erstellt nach Board-Löschung');
        }
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const boardStore = new BoardStore();

// ============================================================================
// HELPER FUNCTIONS (für Komponenten-Kompatibilität)
// ============================================================================

export function getCardById(cardId: string) {
    const board = boardStore.data;
    const result = board.findCardAndColumn(cardId);
    return result?.card || null;
}

export function getColumnById(columnId: string) {
    const board = boardStore.data;
    return board.findColumn(columnId) || null;
}
