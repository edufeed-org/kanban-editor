/**
 * BoardStore - Hauptzugang für Kanban-Verwaltung
 * 
 * Refaktorierte modulare Struktur:
 * - helpers.ts - Utility-Funktionen
 * - boardOperations.ts - Board CRUD
 * - cardOperations.ts - Card CRUD
 * - columnOperations.ts - Column CRUD
 * - nostrSync.ts - Nostr Publishing & Subscription
 * - importExport.ts - Export/Import/ShareLink
 * - learningManager.ts - AI Learning System
 */

import { Board, Chat, type CardProps, type ColumnProps, type PublishState } from '$lib/classes/BoardModel.js';
import type NDK from '@nostr-dev-kit/ndk';
import { authStore } from '../authStore.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';
import { initializeLearningManager, boardLearningManager } from '../boardLearningManager.svelte.js';
import { getSyncManager, initializeSyncManager } from '../syncManager.svelte.js';

// Modulare Imports
import {
    canSaveToStorage,
    canUseLocalStorageAnonymously,
    loadBoardIds,
    saveBoardIds as saveBoardIdsToStorage
} from './helpers.js';

import {
    createBoard as createNewBoard,
    loadBoardFromStorage as loadStoredBoard,
    deleteBoardFromStorage as deleteStoredBoard,
    getAllBoardsFromStorage,
    saveBoardToStorage as saveBoard,
    createDefaultBoard
} from './boardOperations.js';

import {
    createCard as createNewCard,
    updateCard as editCard,
    deleteCard as removeCard,
    moveCard as relocateCard,
    upsertCard,
    setCardPublishState,
    addComment as addCardComment,
    deleteComment as removeCardComment
} from './cardOperations.js';

import {
    createColumn as createNewColumn,
    updateColumn as editColumn,
    deleteColumn as removeColumn,
    syncBoardState as syncState
} from './columnOperations.js';

import {
    publishBoardAsync,
    publishCardAsync,
    handleBoardEvent,
    handleCardEvent,
    subscribeToBoardUpdates
} from './nostrSync.js';

import {
    exportBoardAsJson,
    exportAllBoardsAsJson,
    importBoardFromJson,
    saveImportedBoard,
    restoreAllBoardsFromBackup,
    generateShareLink,
    parseShareToken
} from './importExport.js';

import {
    type LearningMemory,
    createLearningEntry,
    loadLearningMemory,
    saveLearningMemory,
    addLearningEntry,
    getRelevantLearnings,
    generateLLMContext
} from './learningManager.js';

// UI-Typen für Kompatibilität
export type CardItem = {
    id: string; // ✅ FIX: string statt number | string
    name: string;
    description?: string;
    comments?: any[];
    attendees?: string[];
    labels?: string[];
    color?: string;
    publishState?: PublishState;
    author?: string;
    authorName?: string;
    image?: string;
    link?: string;
    columnId?: string;
    boardId?: string;
};

export type UIColumn = {
    id: string;
    name: string;
    description?: string;
    color?: string;
    items: CardItem[];
};

// ============================================================================
// BOARD STORE (REFACTORED)
// ============================================================================

export class BoardStore {
    private static BOARDS_LIST_KEY = 'kanban-boards-list';
    
    // Core State ($state Runes)
    private board = $state(this.loadInitialBoard());
    private boardIds = $state<string[]>(loadBoardIds());
    private _columnOrder = $state<string[]>(this.board.columns.map(c => c.id));
    public updateTrigger = $state(0);
    
    // Nostr
    private ndk?: NDK;
    private boardSubscription: any | null = null;
    
    // Learning
    private learningMemory = $state<LearningMemory>({ entries: [], maxEntries: 50 });
    
    // Chat
    public chat = $state<Chat | null>(null);
    
    // Derived State ($derived)
    public data = $derived(this.board);
    public uiData = $derived.by(() => this.toUIColumns());
    
    constructor() {
        if (typeof window !== 'undefined') {
            // Board in Liste sicherstellen
            if (!this.boardIds.includes(this.board.id)) {
                this.boardIds = [...this.boardIds, this.board.id];
                this.saveBoardIds();
                this.saveToStorage();
            }
            
            // Learning initialisieren wenn aktiviert
            this.initializeLearningManagerIfEnabled();
            
            // Chat initialisieren
            this.chat = new Chat(this.board);
        }
    }
    
    // ========================================================================
    // INITIALIZATION & HELPERS
    // ========================================================================
    
    private loadInitialBoard(): Board {
        if (typeof window === 'undefined') {
            return createDefaultBoard();
        }
        
        const ids = loadBoardIds();
        if (ids.length > 0) {
            // Lade zuletzt genutztes Board
            const board = loadStoredBoard(ids[0]);
            if (board) return board;
        }
        
        return createDefaultBoard();
    }
    
    private saveBoardIds(): void {
        saveBoardIdsToStorage(this.boardIds);
    }
    
    private saveToStorage(): void {
        if (!canSaveToStorage()) {
            console.warn('⚠️ localStorage nicht erlaubt');
            return;
        }
        
        saveBoard(this.board);
    }
    
    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage();
    }
    
    private toUIColumns(): UIColumn[] {
        const trigger = this.updateTrigger; // Dependency tracking
        const columnOrder = this._columnOrder;
        
        return this.board.columns
            .sort((a, b) => {
                const indexA = columnOrder.indexOf(a.id);
                const indexB = columnOrder.indexOf(b.id);
                return indexA - indexB;
            })
            .map(column => ({
                id: column.id,
                name: column.name,
                color: column.color || 'slate',
                items: column.cards.map(card => ({
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
                    columnId: column.id,
                    boardId: this.board.id
                }))
            }));
    }
    
    private async initializeLearningManagerIfEnabled(): Promise<void> {
        // Optional: Wenn Learning System aktiviert ist
        try {
            const boardId = this.board.id;
            // await initializeLearningManager(boardId);  // TODO: Wenn implementiert
            this.learningMemory = loadLearningMemory(boardId);
            console.log('🎓 Learning Manager bereit');
        } catch (error) {
            console.error('❌ Learning Manager Fehler:', error);
        }
    }
    
    // ========================================================================
    // BOARD OPERATIONS
    // ========================================================================
    
    public createBoard(name: string = 'Neues Board'): string {
        const { board, boardId } = createNewBoard(name);
        
        this.board = board;
        this.boardIds = [...this.boardIds, boardId];
        this._columnOrder = board.columns.map(c => c.id);
        
        this.saveBoardIds();
        this.triggerUpdate();
        
        // ✅ FIX PHASE 11: Publishing!
        if (board.publishState !== 'draft' && this.ndk) {
            this.publishBoardToNostr();
        }
        
        return boardId;
    }
    
    public switchBoard(boardId: string): void {
        const board = loadStoredBoard(boardId);
        if (!board) {
            console.error('❌ Board nicht gefunden:', boardId);
            return;
        }
        
        this.board = board;
        this._columnOrder = board.columns.map(c => c.id);
        this.chat = new Chat(board);
        this.learningMemory = loadLearningMemory(boardId);
        
        this.triggerUpdate();
    }
    
    public deleteBoard(boardId: string): boolean {
        const deleted = deleteStoredBoard(boardId);
        if (deleted) {
            this.boardIds = this.boardIds.filter(id => id !== boardId);
            this.saveBoardIds();
        }
        return deleted;
    }
    
    public getAllBoards(): Array<any> {
        return getAllBoardsFromStorage(this.boardIds);
    }
    
    public updateBoardMetadata(updates: {
        name?: string;
        description?: string;
        tags?: string[];
        ccLicense?: string;
    }): void {
        if (updates.name) this.board.name = updates.name;
        if (updates.description) this.board.description = updates.description;
        if (updates.tags) this.board.tags = updates.tags;
        if (updates.ccLicense) this.board.ccLicense = updates.ccLicense;
        
        this.triggerUpdate();
        
        if (this.board.publishState !== 'draft' && this.ndk) {
            this.publishBoardToNostr();
        }
    }
    
    // ========================================================================
    // CARD OPERATIONS
    // ========================================================================
    
    public createCard(columnId: string, name: string, description?: string): string {
        const card = createNewCard(this.board, columnId, name, description);
        this.triggerUpdate();
        
        if (card.publishState !== 'draft' && this.ndk) {
            publishCardAsync(this.board, card.id, this.ndk);
        }
        
        return card.id;
    }
    
    public editCard(cardId: string, updates: any): void {
        editCard(this.board, cardId, updates);
        this.triggerUpdate();
        
        if (this.ndk) {
            publishCardAsync(this.board, cardId, this.ndk);
        }
    }
    
    public deleteCard(cardId: string): void {
        removeCard(this.board, cardId);
        this.triggerUpdate();
    }
    
    public moveCard(cardId: string, fromColId: string, toColId: string): void {
        relocateCard(this.board, cardId, fromColId, toColId);
        this.triggerUpdate();
        
        if (this.ndk) {
            publishCardAsync(this.board, cardId, this.ndk);
        }
    }
    
    public addComment(cardId: string, text: string): void {
        const author = authStore.getPubkey() || 'anonymous';
        addCardComment(this.board, cardId, text, author);
        this.triggerUpdate();
    }
    
    public deleteComment(cardId: string, commentId: string): void {
        removeCardComment(this.board, cardId, commentId);
        this.triggerUpdate();
    }
    
    // ========================================================================
    // COLUMN OPERATIONS
    // ========================================================================
    
    public createColumn(name: string = 'Neue Spalte'): string {
        const { columnId } = createNewColumn(this.board, name);
        this._columnOrder = [...this._columnOrder, columnId];
        
        this.triggerUpdate();
        
        if (this.board.publishState !== 'draft' && this.ndk) {
            this.publishBoardToNostr();
        }
        
        return columnId;
    }
    
    public updateColumn(columnId: string, updates: { name?: string; color?: string }): void {
        editColumn(this.board, columnId, updates);
        this.triggerUpdate();
        
        if (this.board.publishState !== 'draft' && this.ndk) {
            this.publishBoardToNostr();
        }
    }
    
    public deleteColumn(columnId: string): void {
        removeColumn(this.board, columnId);
        this._columnOrder = this._columnOrder.filter(id => id !== columnId);
        
        this.triggerUpdate();
        
        if (this.board.publishState !== 'draft' && this.ndk) {
            this.publishBoardToNostr();
        }
    }
    
    public syncBoardState(uiColumns: UIColumn[]): void {
        const { newColumnOrder } = syncState(this.board, uiColumns);
        this._columnOrder = newColumnOrder;
        
        this.triggerUpdate();
    }
    
    // ========================================================================
    // NOSTR SYNC
    // ========================================================================
    
    public setNDK(ndk: NDK): void {
        this.ndk = ndk;
        this.subscribeToNostrUpdates();
    }
    
    private async publishBoardToNostr(): Promise<void> {
        if (!this.ndk) return;
        await publishBoardAsync(this.board, this.ndk);
    }
    
    private subscribeToNostrUpdates(): void {
        if (!this.ndk) return;
        
        this.boardSubscription = subscribeToBoardUpdates(
            this.ndk,
            (event) => this.handleBoardEventFromNostr(event),
            (event) => this.handleCardEventFromNostr(event)
        );
    }
    
    private async handleBoardEventFromNostr(event: any): Promise<void> {
        await handleBoardEvent(
            event,
            this.boardIds,
            (boardId, board) => {
                if (boardId === this.board.id) {
                    this.board = board;
                    this._columnOrder = board.columns.map(c => c.id);
                    this.updateTrigger++;
                }
            },
            (newBoardIds) => {
                this.boardIds = newBoardIds;
                this.saveBoardIds();
            }
        );
    }
    
    private async handleCardEventFromNostr(event: any): Promise<void> {
        await handleCardEvent(
            event,
            (boardId) => {
                if (boardId === this.board.id) {
                    // Reload board from localStorage
                    const reloaded = loadStoredBoard(boardId);
                    if (reloaded) {
                        this.board = reloaded;
                        this.updateTrigger++;
                    }
                }
            }
        );
    }
    
    // ========================================================================
    // IMPORT/EXPORT
    // ========================================================================
    
    public exportBoard(includeMetadata = true): string {
        return exportBoardAsJson(this.board, includeMetadata);
    }
    
    public exportAllBoards(): string {
        return exportAllBoardsAsJson(this.boardIds);
    }
    
    public importBoard(jsonString: string, mode: 'merge' | 'new' | 'overwrite' = 'merge'): {
        success: boolean;
        board?: Board;
        error?: string;
    } {
        const result = importBoardFromJson(jsonString, mode);
        
        if (result.success && result.board) {
            const { boardId, newBoardIds } = saveImportedBoard(
                result.board,
                this.boardIds,
                mode === 'overwrite'
            );
            
            this.boardIds = newBoardIds;
            this.saveBoardIds();
        }
        
        return result;
    }
    
    public async generateShareLink(includeMetadata = true): Promise<{ url: string; tokenSize: number }> {
        return await generateShareLink(this.board, includeMetadata);
    }
    
    public parseShareToken(token: string): any {
        return parseShareToken(token);
    }
    
    // ========================================================================
    // LEARNING SYSTEM
    // ========================================================================
    
    public addLearning(context: string, userFeedback: string, action?: string): void {
        const entry = createLearningEntry(context, userFeedback, action);
        this.learningMemory = addLearningEntry(this.learningMemory, entry);
        saveLearningMemory(this.board.id, this.learningMemory);
    }
    
    public getRelevantLearnings(currentContext: string, limit = 5): any[] {
        return getRelevantLearnings(this.learningMemory, currentContext, limit);
    }
    
    public generateLLMContext(currentPrompt: string): any {
        return generateLLMContext(this.board, this.learningMemory, currentPrompt);
    }
}

// Singleton Export
export const boardStore = new BoardStore();
