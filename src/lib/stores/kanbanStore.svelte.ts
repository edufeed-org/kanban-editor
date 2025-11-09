// src/lib/stores/kanbanStore.svelte.ts
// REFACTORED: Hauptstore der alle Module zusammenführt

import { Board, Chat, type CardProps, type ColumnProps, type BoardProps } from '../classes/BoardModel.js';
import { initializeLearningManager } from './boardLearningManager.svelte.js';
import { authStore } from './authStore.svelte.js';
import { settingsStore } from './settingsStore.svelte.js';
import { initializeSyncManager } from './syncManager.svelte.js';
import { nostrEventToCard } from '../utils/nostrEvents.js';
import type NDK from '@nostr-dev-kit/ndk';

// Module imports
import {
    BoardStorage,
    NostrIntegration,
    BoardOperations,
    ExportImport,
    BoardLearning,
    PasteHandler,
    ChatIntegration,
    type CardItem,
    type UIColumn
} from './boardstore/index.js';

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
    public updateTrigger = $state(0);
    
    // Module instances
    private nostrIntegration: NostrIntegration;

    constructor() {
        // Initialisiere Nostr-Modul
        this.nostrIntegration = new NostrIntegration();
        
        if (typeof window !== 'undefined') {
            this.initializeBoard();
            this.scheduleAuthorFix();
            this.exposeCurrentBoardIdToWindow();
            this.initializeLearningManagerIfEnabled();
        }
    }
    
    private initializeBoard(): void {
        const currentBoardId = this.board.id;
        if (!this.boardIds.includes(currentBoardId)) {
            console.log('🔥 Erstes Laden: Füge Default Board zur Liste hinzu:', currentBoardId);
            this.boardIds = [...this.boardIds, currentBoardId];
            BoardStorage.saveBoardIds(this.boardIds);
            this.saveToStorage();
        }
    }
    
    private scheduleAuthorFix(): void {
        this.fixAnonymousBoardAuthor();
    }
    
    private async initializeLearningManagerIfEnabled(): Promise<void> {
        try {
            const response = await fetch('/config.json');
            if (!response.ok) return;
            
            const config = await response.json();
            const useLearning = config.learning?.useLearningManager ?? false;
            
            if (useLearning) {
                initializeLearningManager(this);
                console.log('✅ BoardLearningManager aktiviert');
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden von config.json:', error);
        }
    }
    
    private fixAnonymousBoardAuthor(): void {
        try {
            if (!authStore || typeof authStore.getPubkey !== 'function') {
                return;
            }
            
            const pubkey = authStore.getPubkey();
            const isAuth = authStore.isAuthenticated;
            
            if (!isAuth || !pubkey) return;
            
            if (this.board.author === 'anonymous' || !this.board.author) {
                this.board.author = pubkey;
                this.board.maintainers = [pubkey];
                this.saveToStorage();
                console.log('✅ Board-Author aktualisiert');
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
        const mostRecentBoardId = BoardStorage.loadMostRecentBoard(boardIds);
        
        if (mostRecentBoardId) {
            const board = BoardStorage.loadBoard(mostRecentBoardId);
            if (board) {
                console.log(`✅ Letztes Board geladen: ${board.name} (${mostRecentBoardId})`);
                return board;
            }
        }
        
        return BoardStorage.createDefaultBoard();
    }

    private saveToStorage(): void {
        BoardStorage.saveBoard(this.board);
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
        this.updateTrigger++;
        this.saveToStorage();
        
        // NUR bei Primary Actions zu Nostr publishen (Default: true)
        if (options?.publish !== false) {
            console.log('🚀 triggerUpdate: Publishing to Nostr (publish=' + (options?.publish ?? 'undefined (default true)') + ')');
            this.publishToNostr();
        } else {
            console.log('⏭️ triggerUpdate: SKIP publish to Nostr (publish=false)');
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
    
    public getAllBoards(): Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number }> {
        // ⚡ KRITISCH: updateTrigger lesen für Reaktivität!
        this.updateTrigger;
        
        // ⚡ WICHTIG: Metadata aus localStorage lesen
        const boards = BoardStorage.getAllBoardsMetadata(this.boardIds);
        
        // ⚡ DEBUG: Duplikate-Check
        const boardIdsInList = boards.map(b => b.id);
        const duplicates = boardIdsInList.filter((id, index) => boardIdsInList.indexOf(id) !== index);
        if (duplicates.length > 0) {
            console.error(`🔴 DUPLIKATE in getAllBoards() gefunden:`, duplicates);
            console.log('  boardIds:', this.boardIds);
            console.log('  boards:', boards.map(b => ({ id: b.id, name: b.name })));
        }
        
        // ⚡ FIX: Aktuelles Board mit Live-Daten überschreiben (nicht cached localStorage!)
        const currentBoardIndex = boards.findIndex(b => b.id === this.board.id);
        if (currentBoardIndex !== -1) {
            boards[currentBoardIndex] = {
                id: this.board.id,
                name: this.board.name,
                description: this.board.description,
                createdAt: new Date(this.board.createdAt).getTime(),
                updatedAt: this.board.updatedAt 
                    ? new Date(this.board.updatedAt).getTime() 
                    : new Date(this.board.createdAt).getTime()
            };
        }
        
        return boards;
    }

    public createBoard(name: string, description?: string): string {
        const author = this.getSafeAuthor();
        const board = new Board({
            name,
            description,
            author,
            maintainers: [author],
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
            BoardStorage.saveBoardIds(this.boardIds);
            console.log(`✅ Board ${board.name} added to list - now visible in sidebar`);
        } else {
            console.warn(`⚠️ Board ${board.id} bereits in boardIds-Liste - DUPLIKAT vermieden`);
        }

        // ⚡ KRITISCH: Metadaten-Liste aktualisieren (für getAllBoardsMetadata)
        // Grund: createBoard() auf Browser A muss gleiche Struktur wie upsertBoardFromNostr() nutzen
        this.addBoardToMetadataList({
            id: board.id,
            name: board.name,
            description: board.description || '',
            lastAccessed: new Date().toISOString(),
            author: board.author || '',
            publishState: board.publishState || 'draft'
        });

        this.board = board;
        this._columnOrder = board.columns.map(c => c.id);
        this.triggerUpdate();

        console.log(`✅ Neues Board erstellt: ${name}`);
        return board.id;
    }

    public loadBoard(boardId: string): boolean {
        const board = BoardStorage.loadBoard(boardId);
        if (!board) {
            console.error(`❌ Board ${boardId} nicht gefunden`);
            return false;
        }

        this.board = board;
        this._columnOrder = board.columns.map(c => c.id);
        BoardStorage.updateLastAccessed(boardId);
        
        // ⚡ v4.1: KEIN saveToStorage beim Laden!
        // Grund: Board kommt aus localStorage, kein Grund es sofort wieder zu speichern
        // Das würde neuere Nostr-Daten überschreiben!
        // Aber: updateTrigger++ damit $derived neu berechnet wird
        this.updateTrigger++;
        
        ChatIntegration.reset();
        console.log(`✅ Board geladen: ${board.name}`);
        
        // ⚠️ NEU: Lade alle Cards für dieses Board vom Relay (asynchron)
        this.loadCardsFromNostr(board);
        
        return true;
    }

    public deleteBoard(boardId?: string): boolean {
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
        BoardStorage.saveBoardIds(this.boardIds);

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
    }

    public async loadBoardsFromNostr(): Promise<void> {
        await this.nostrIntegration.loadBoardsFromNostr(
            this.boardIds,
            this.board,
            (updatedBoardIds: string[], switched: boolean, newBoard?: Board) => {
                // ⚡ FIX: Duplikate vermeiden via Set-Deduplication
                this.boardIds = [...new Set([...this.boardIds, ...updatedBoardIds])];
                BoardStorage.saveBoardIds(this.boardIds);
                console.log(`📋 Board IDs aktualisiert (${this.boardIds.length} unique boards)`);
                
                if (switched && newBoard) {
                    this.board = newBoard;
                    this._columnOrder = newBoard.columns.map(c => c.id);
                    this.triggerUpdate();
                }
            }
        );
    }

    private async loadCardsFromNostr(board: Board): Promise<void> {
        await this.nostrIntegration.loadCardsForBoard(
            board,
            (cardProps: any) => {
                console.log('🃏 Card vom Relay geladen:', cardProps.id, 'für Spalte:', cardProps.columnId);
                
                try {
                    // Prüfe ob Card bereits existiert (Duplikate vermeiden!)
                    const existing = this.board.findCardById(cardProps.id);
                    if (existing) {
                        console.log('✅ Card bereits vorhanden, skip:', cardProps.id);
                        return;
                    }
                    
                    // Finde Zielspalte
                    let targetColumn = this.board.findColumn(cardProps.columnId);
                    
                    // Fallback: Name-basiertes Matching
                    if (!targetColumn && (cardProps as any).columnName) {
                        targetColumn = this.board.columns.find(col => 
                            col.name.toLowerCase() === ((cardProps as any).columnName || '').toLowerCase()
                        );
                        if (targetColumn) {
                            console.log(`✅ Column matched by name: "${(cardProps as any).columnName}"`);
                            cardProps.columnId = targetColumn.id;
                        }
                    }
                    
                    // Letzter Fallback: Erste Spalte
                    if (!targetColumn && this.board.columns.length > 0) {
                        targetColumn = this.board.columns[0];
                        console.log(`⚠️ Using first column as fallback: "${targetColumn.name}"`);
                        cardProps.columnId = targetColumn.id;
                    }
                    
                    if (!targetColumn) {
                        console.error(`❌ No column found for card ${cardProps.id}`);
                        return;
                    }
                    
                    // Card via upsert hinzufügen (mit rank-Position)
                    this.board.upsertCard(cardProps.columnId, cardProps, cardProps.rank);
                    
                } catch (error) {
                    console.error(`❌ Error loading card from Nostr:`, error);
                }
            }
        );
        
        // Nach dem Laden aller Cards: UI aktualisieren
        this.triggerUpdate();
        console.log('✅ Alle Cards vom Relay geladen und synchronisiert');
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

    public setCardPublishState(cardId: string, state: 'draft' | 'published' | 'archived'): void {
        BoardOperations.setCardPublishState(this.board, cardId, state);
        this.triggerUpdate();
        this.publishCardAsync(cardId);
    }

    public filterBoards(query: string): Array<{id: string; name: string; description?: string; createdAt: number; updatedAt?: number}> {
        const allBoards = this.getAllBoards();
        if (!query) return allBoards;
        
        const lowerQuery = query.toLowerCase();
        return allBoards.filter(board => 
            board.name.toLowerCase().includes(lowerQuery) ||
            (board.description && board.description.toLowerCase().includes(lowerQuery))
        );
    }

    public updateCurrentBoardMeta(updates: { name?: string; description?: string; publishState?: 'draft' | 'published' | 'archived'; tags?: string[]; ccLicense?: string }): void {
        BoardOperations.updateBoardMetadata(this.board, updates);
        this.triggerUpdate();
        this.publishBoardAsync();
    }

    public setPublishState(state: 'draft' | 'published' | 'archived'): void {
        BoardOperations.setBoardPublishState(this.board, state);
        this.triggerUpdate();
        this.publishBoardAsync();
    }

    public moveCard(cardId: string, fromColumnId: string, toColumnId: string): void {
        if (BoardOperations.moveCard(this.board, cardId, fromColumnId, toColumnId)) {
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    private async publishBoardAsync(): Promise<void> {
        await this.nostrIntegration.publishBoard(this.board);
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
        const author = this.getSafeAuthor();
        const cardId = BoardOperations.createCard(this.board, columnId, name, description, author);
        
        if (cardId) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
        
        return cardId || '';
    }

    public editCard(cardId: string, updates: Partial<CardProps>): void {
        if (BoardOperations.updateCard(this.board, cardId, updates)) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
    }

    public async deleteCard(cardId: string): Promise<void> {
        // Lösche Card lokal UND auf Nostr (via BoardOperations)
        const success = await BoardOperations.deleteCard(
            this.board, 
            cardId, 
            this.nostrIntegration
        );
        
        if (success) {
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    public createColumn(name: string, color?: string): string {
        const columnId = BoardOperations.createColumn(this.board, name, color);
        
        if (columnId) {
            this._columnOrder = [...this._columnOrder, columnId];
            this.triggerUpdate();
            this.publishBoardAsync();
        }
        
        return columnId || '';
    }

    public updateColumn(columnId: string, updates: Partial<ColumnProps>): void {
        if (BoardOperations.updateColumn(this.board, columnId, updates)) {
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    public deleteColumn(columnId: string): void {
        if (BoardOperations.deleteColumn(this.board, columnId)) {
            this._columnOrder = this._columnOrder.filter(id => id !== columnId);
            this.triggerUpdate();
            this.publishBoardAsync();
        }
    }

    public handleCardMove(cardId: string, fromColumnId: string, toColumnId: string): void {
        if (BoardOperations.moveCard(this.board, cardId, fromColumnId, toColumnId)) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
            this.publishBoardAsync();
        }
    }

    public reorderColumns(columnIds: string[]): void {
        this._columnOrder = columnIds;
        BoardOperations.reorderColumns(this.board, columnIds);
        this.triggerUpdate();
        this.publishBoardAsync();
    }

    private syncInProgress = $state(false);
    private pendingSyncData: UIColumn[] | null = null;
    private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    public syncBoardState(uiColumns: UIColumn[]): boolean {
        // Debounce: Sammle schnelle Änderungen
        this.pendingSyncData = uiColumns;
        
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
            console.log('⏱️ Sync debounced (waiting for more changes)');
        }
        
        this.syncDebounceTimer = setTimeout(() => {
            this.executeSyncBoardState();
        }, 150); // 150ms debounce
        
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
            const { newColumnOrder, movedCardIds } = BoardOperations.syncBoardState(
                this.board,
                this._columnOrder,
                uiColumns
            );
            this._columnOrder = newColumnOrder;
            
            // ⚡ CRITICAL: triggerUpdate mit publish=false
            // Grund: Wir publishen selbst weiter unten sequentiell!
            this.triggerUpdate({ publish: false });
            
            // Publishing sequentiell (nicht parallel) um Race Conditions zu vermeiden
            console.log('📤 Publishing board...');
            await this.publishBoardAsync();
            
            // Publiziere verschobene Cards
            if (movedCardIds.length > 0) {
                console.log(`📤 Publishing ${movedCardIds.length} moved cards...`);
                for (const cardId of movedCardIds) {
                    await this.publishCardAsync(cardId);
                }
            }
            
            console.log('✅ Sync complete');
        } catch (error) {
            console.error('❌ Sync failed:', error);
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
        const author = authorOverride || this.getSafeAuthor();
        const commentId = BoardOperations.addComment(this.board, cardId, text, author);
        
        if (commentId) {
            this.triggerUpdate();
            await this.publishCommentAsync(cardId, commentId);
        }
    }

    public deleteComment(cardId: string, commentId: string): void {
        if (BoardOperations.deleteComment(this.board, cardId, commentId)) {
            this.triggerUpdate();
            this.publishCardAsync(cardId);
        }
    }

    // ============================================================================
    // EXPORT/IMPORT (delegiert zu ExportImport)
    // ============================================================================
    
    public exportBoardAsJson(includeMetadata = true): string {
        return ExportImport.exportBoardAsJson(this.board, includeMetadata);
    }

    public exportAllBoardsAsJson(): string {
        return ExportImport.exportAllBoardsAsJson(this.boardIds);
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

        BoardStorage.saveBoardIds(this.boardIds);
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
            BoardStorage.saveBoardIds(this.boardIds);
            
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
    // LEARNING METHODS (delegiert zu BoardLearning)
    // ============================================================================
    
    public learnColumnStructure(columnId: string): any {
        return BoardLearning.learnColumnStructure(this.board, columnId);
    }

    public learnBoardStructure(): any {
        return BoardLearning.learnBoardStructure(this.board);
    }

    public createColumnWithTemplate(templateName: string): any {
        return BoardLearning.createColumnWithTemplate(this.board, templateName);
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
    // UTILITY METHODS
    // ============================================================================
    
    public updateBoardAuthor(): void {
        this.fixAnonymousBoardAuthor();
    }

    public getContextData(full = true): any {
        return this.board.getContextData(full);
    }

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
     * ⚡ HELPER: Fügt Board-Metadaten zur Liste hinzu
     * SINGLE SOURCE OF TRUTH: kanban-boards-metadata
     * 
     * Aktualisiert NUR:
     * - 'kanban-boards-metadata' - Vollständige Metadaten + IDs
     * 
     * ⚡ REFACTORING (9. Nov 2025): Eliminiert redundanten kanban-boards-list Key
     * 
     * @param metadata - Board-Metadaten (für Sidebar-Liste)
     */
    private addBoardToMetadataList(metadata: {
        id: string;
        name: string;
        description: string;
        lastAccessed: string;
        author: string;
        publishState: string;
    }): void {
        if (typeof window === 'undefined') {
            console.warn('⚠️ localStorage not available (SSR?)');
            return;
        }
        
        // === Single Key Update ===
        const metadataKey = 'kanban-boards-metadata';
        const stored = localStorage.getItem(metadataKey);
        const boardList = stored ? JSON.parse(stored) : [];
        
        // Prüfe: Board bereits in Liste?
        const existingIndex = boardList.findIndex((b: any) => b.id === metadata.id);
        
        if (existingIndex >= 0) {
            // Update existing entry
            boardList[existingIndex] = { ...boardList[existingIndex], ...metadata };
            console.log(`🔄 Updated metadata for board ${metadata.id}`);
        } else {
            // Add new entry
            boardList.push(metadata);
            console.log(`➕ Added new board to metadata list: ${metadata.name}`);
        }
        
        // Speichere aktualisierte Metadata-Liste (Single Source of Truth)
        localStorage.setItem(metadataKey, JSON.stringify(boardList));
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
        console.log(`📦 upsertCardToBackgroundBoard: Board ${boardId}, Card ${cardProps.id}`);
        
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
            publishState: boardProps.publishState
        });
        
        if (isUpdate) {
            // Board-Metadaten + Spalten wurden aktualisiert
            // ⚡ CRITICAL: _columnOrder muss synchronisiert werden!
            this._columnOrder = this.board.columns.map(c => c.id);
            this.triggerUpdate({ publish: false });
        } else {
            // Neues Board wurde zur Liste hinzugefügt
            // Board-Liste muss neu geladen werden
            this.boardIds = BoardStorage.loadBoardIds();
            this.triggerUpdate({ publish: false });
        }
    }
    
    /**
     * ⚡ SEKUNDÄR: Board von Nostr-Event löschen
     * KEIN Publish zu Nostr (publish: false)
     * 
     * Wird aufgerufen wenn ein Deletion-Event (Kind 5) für ein Board empfangen wird.
     * 
     * @param boardId - ID des zu löschenden Boards
     */
    public deleteBoardFromNostr(boardId: string): void {
        console.log(`🗑️ deleteBoardFromNostr: ${boardId}`);
        
        // Lösche Board aus Metadaten-Liste
        const wasDeleted = BoardOperations.deleteBoardFromNostr(boardId);
        
        if (wasDeleted) {
            // Board-Liste aktualisieren
            this.boardIds = BoardStorage.loadBoardIds();
            
            // Wenn aktuell geladenes Board gelöscht wurde → zu anderem Board wechseln
            if (this.board.id === boardId) {
                console.log(`⚠️ Active board ${boardId} was deleted`);
                
                if (this.boardIds.length > 0) {
                    // Wechsel zum ersten verfügbaren Board
                    const firstBoardId = this.boardIds[0];
                    console.log(`🔄 Switching to first available board: ${firstBoardId}`);
                    
                    const raw = BoardStorage.loadBoard(firstBoardId);
                    if (raw) {
                        this.board = BoardStorage.reconstructBoard(raw);
                        this._columnOrder = this.board.columns.map(c => c.id);
                    }
                } else {
                    // Keine Boards mehr → erstelle neues leeres Board
                    console.log(`📝 No boards left, creating new empty board`);
                    this.createBoard('Neues Board', 'Automatisch erstellt nach Board-Löschung');
                }
            }
            
            this.triggerUpdate({ publish: false });
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
