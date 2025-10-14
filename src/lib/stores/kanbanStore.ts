// src/lib/stores/kanbanStore.ts

import { Board, Chat, type CardProps, type ColumnProps, type PublishState } from '../classes/BoardModel.js';

// ============================================================================
// BOARD STORE (SVELTE 5 RUNES)
// ============================================================================

export class BoardStore {
    // Die Board-Instanz als reaktiver Zustand (Svelte 5 Rune)
    private board = $state(new Board({
        name: 'Mein KI Kanban Board',
        description: 'Ein intelligentes Kanban-Board mit KI-Unterstützung',
        columns: [
            { name: 'To Do', color: 'color-gradient-1' },
            { name: 'In Progress', color: 'color-gradient-2' },
            { name: 'Done', color: 'color-gradient-3' }
        ]
    }));

    // Öffentliche getter-Funktion, um die Board-Daten reaktiv abzurufen
    public get data() {
        return this.board;
    }

    // ============================================================================
    // PROXY-METHODEN FÜR BOARD-OPERATIONEN
    // ============================================================================

    public setPublishState(state: PublishState): void {
        this.board.setPublishState(state);
    }

    public addColumn(props: ColumnProps) {
        return this.board.addColumn(props);
    }

    public deleteColumn(columnId: string): void {
        this.board.deleteColumn(columnId);
    }

    public findColumn(columnId: string) {
        return this.board.findColumn(columnId);
    }

    public findCardAndColumn(cardId: string) {
        return this.board.findCardAndColumn(cardId);
    }

    public moveCard(cardId: string, fromColId: string, toColId: string): void {
        this.board.moveCard(cardId, fromColId, toColId);
        // Nach einer Änderung sollte hier der Nostr-Publish-Befehl folgen
        this.publishToNostr();
    }

    public addCard(columnId: string, props: CardProps) {
        const column = this.board.findColumn(columnId);
        if (column) {
            return column.addCard(props);
        }
        throw new Error(`Column with id ${columnId} not found`);
    }

    public updateCard(cardId: string, updates: Partial<CardProps>): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.update(updates);
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public deleteCard(cardId: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.column.deleteCard(cardId);
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public setCardPublishState(cardId: string, state: PublishState): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.setPublishState(state);
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public addComment(cardId: string, text: string, author: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.addComment(text, author);
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public deleteComment(cardId: string, commentId: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.deleteComment(commentId);
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    // ============================================================================
    // KI-INTEGRATION
    // ============================================================================

    public sendPromptToAI(prompt: string, context?: any): void {
        if (this.chat) {
            this.chat.sendPromptToAI(prompt, context);
        }
    }

    public processAIAction(action: any): void {
        if (this.chat) {
            this.chat.processAIAction(action);
            this.publishToNostr();
        }
    }

    // ============================================================================
    // NOSTR-INTEGRATION (STUB)
    // ============================================================================

    private publishToNostr(): void {
        // Hier würde die tatsächliche Nostr-Publikation erfolgen
        // z.B. über eine WebSocket-Verbindung oder HTTP-API
        console.log('Publishing board state to Nostr...', this.board.getContextData(true));
    }

    // ============================================================================
    // CHAT-INTEGRATION
    // ============================================================================

    private chat = $state<Chat | null>(null);

    public initializeChat(): void {
        this.chat = new Chat(this.board);
    }

    public get chatInstance(): Chat | null {
        return this.chat;
    }

    // ============================================================================
    // UTILITY-METHODEN
    // ============================================================================

    public getContextData(full: boolean = false): any {
        return this.board.getContextData(full);
    }

    public exportData(): any {
        return this.board.getContextData(true);
    }

    public importData(data: any): void {
        // Einfache Import-Funktionalität (kann erweitert werden)
        if (data && data.columns) {
            // Hier würde eine vollständige Import-Logik implementiert werden
            console.log('Importing board data...', data);
        }
    }
}

// ============================================================================
// STORE-INSTANZEN
// ============================================================================

// Globale Board-Store-Instanz
export const boardStore = new BoardStore();

// ============================================================================
// CONVENIENCE-FUNKTIONEN FÜR KOMPONENTEN
// ============================================================================

// Reaktive Getter für häufig verwendete Daten
export const boardData = $derived(boardStore.data);
export const boardColumns = $derived(boardStore.data.columns);
export const boardName = $derived(boardStore.data.name);
export const boardDescription = $derived(boardStore.data.description);

// Hilfsfunktion für Card-Operationen
export function getCardById(cardId: string) {
    return boardStore.findCardAndColumn(cardId);
}

// Hilfsfunktion für Column-Operationen
export function getColumnById(columnId: string) {
    return boardStore.findColumn(columnId);
}