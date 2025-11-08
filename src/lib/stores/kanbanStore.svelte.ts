// src/lib/stores/kanbanStore.svelte.ts
// REFACTORED: Hauptstore der alle Module zusammenführt

import { Board, Chat, type CardProps, type ColumnProps } from '../classes/BoardModel.js';
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

    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage();
    }

    // ============================================================================
    // MULTI-BOARD MANAGEMENT
    // ============================================================================
    
    public getAllBoards(): Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number }> {
        return BoardStorage.getAllBoardsMetadata(this.boardIds);
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
        this.boardIds = [...this.boardIds, board.id];
        BoardStorage.saveBoardIds(this.boardIds);

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
        this.triggerUpdate();

        ChatIntegration.reset();
        console.log(`✅ Board geladen: ${board.name}`);
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
    }

    public async loadBoardsFromNostr(): Promise<void> {
        await this.nostrIntegration.loadBoardsFromNostr(
            this.boardIds,
            this.board,
            (updatedBoardIds: string[], switched: boolean, newBoard?: Board) => {
                this.boardIds = updatedBoardIds;
                BoardStorage.saveBoardIds(this.boardIds);
                
                if (switched && newBoard) {
                    this.board = newBoard;
                    this._columnOrder = newBoard.columns.map(c => c.id);
                    this.triggerUpdate();
                }
            }
        );
    }

    public subscribeToNostrUpdates(): void {
        this.nostrIntegration.subscribeToUpdates(
            async (boardEvent) => {
                console.log('📥 Board-Event erhalten:', boardEvent.id);
                // Handle board update
            },
            async (cardEvent) => {
                console.log('📥 Card-Event erhalten:', cardEvent.id);
                
                try {
                    // ⚠️ Deserialisiere Card-Event
                    const cardProps = nostrEventToCard(cardEvent);
                    
                    // ⚠️ Validierung: Gehört die Karte zu diesem Board?
                    if (cardProps.boardRef) {
                        const expectedBoardRef = `30301:${this.board.author}:${this.board.id}`;
                        if (cardProps.boardRef !== expectedBoardRef) {
                            console.warn(`⚠️ Card ${cardProps.id} gehört zu anderem Board: ${cardProps.boardRef}`);
                            return;
                        }
                    }
                    
                    // ⚠️ columnId ist KRITISCH - ohne geht nichts!
                    if (!cardProps.columnId) {
                        console.error(`❌ Card ${cardProps.id} hat keine columnId!`);
                        return;
                    }
                    
                    // ⚠️ Upsert mit rank-Position
                    this.board.upsertCard(cardProps.columnId, cardProps, cardProps.rank);
                    
                    // ⚠️ Triggere Update für UI
                    this.triggerUpdate();
                    
                    console.log(`✅ Card ${cardProps.id} synchronized to column ${cardProps.columnId} at rank ${cardProps.rank}`);
                } catch (error) {
                    console.error(`❌ Error processing card event:`, error);
                }
            }
        );
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

    public deleteCard(cardId: string): void {
        // 1. Card-Referenz speichern für Nostr-Löschung
        const result = this.board.findCardAndColumn(cardId);
        const cardToDelete = result?.card;

        // 2. Lokal löschen
        if (BoardOperations.deleteCard(this.board, cardId)) {
            this.triggerUpdate();
            this.publishBoardAsync();

            // 3. Auf Nostr löschen (asynchron)
            if (cardToDelete) {
                this.nostrIntegration.deleteCard(cardToDelete);
            }
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

    public syncBoardState(uiColumns: UIColumn[]): boolean {
        const newOrder = BoardOperations.syncBoardState(this.board, this._columnOrder, uiColumns);
        this._columnOrder = newOrder;
        this.triggerUpdate();
        this.publishBoardAsync();
        return true; // Immer erfolgreich, Permission wird in publishBoardAsync geprüft
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
        if (overwriteExisting) {
            const existingIdx = this.boardIds.indexOf(board.id);
            if (existingIdx === -1) {
                this.boardIds = [...this.boardIds, board.id];
            }
        } else {
            this.boardIds = [...this.boardIds, board.id];
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
