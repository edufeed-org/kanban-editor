// src/lib/stores/boardstore/operations.ts
// Board-Operationen (CRUD für Columns/Cards)

import { Board, Column, Card, type CardProps, type ColumnProps } from '../../classes/BoardModel.js';
import { generateDTag } from '../../utils/idGenerator.js';
import type { CardItem, UIColumn } from './types.js';

export class BoardOperations {
    /**
     * Erstellt eine neue Card
     */
    public static createCard(
        board: Board,
        columnId: string,
        heading: string,
        description?: string,
        author?: string
    ): string | null {
        const column = board.findColumn(columnId);
        if (!column) {
            console.error(`❌ Spalte ${columnId} nicht gefunden`);
            return null;
        }

        const cardProps: CardProps = {
            heading,
            content: description,
            author: author || 'anonymous',
            publishState: 'draft'
        };

        const card = column.addCard(cardProps);
        console.log(`✅ Karte erstellt: ${card.heading}`);
        return card.id;
    }

    /**
     * Aktualisiert eine Card
     */
    public static updateCard(
        board: Board,
        cardId: string,
        updates: Partial<CardProps>
    ): boolean {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        result.card.update(updates);
        console.log(`✅ Karte aktualisiert: ${cardId}`);
        return true;
    }

    /**
     * Löscht eine Card
     */
    public static deleteCard(
        board: Board,
        cardId: string
    ): boolean {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        result.column.deleteCard(cardId);
        console.log(`✅ Karte gelöscht: ${cardId}`);
        return true;
    }

    /**
     * Verschiebt eine Card zwischen Spalten
     */
    public static moveCard(
        board: Board,
        cardId: string,
        fromColumnId: string,
        toColumnId: string
    ): boolean {
        try {
            board.moveCard(cardId, fromColumnId, toColumnId);
            console.log(`✅ Karte verschoben: ${cardId} von ${fromColumnId} nach ${toColumnId}`);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Verschieben der Karte:', error);
            return false;
        }
    }

    /**
     * Erstellt neue Column
     */
    public static createColumn(
        board: Board,
        name: string,
        color?: string
    ): string | null {
        const columnProps: ColumnProps = {
            name,
            color: color || 'slate'
        };

        const column = board.addColumn(columnProps);
        console.log(`✅ Spalte erstellt: ${column.name}`);
        return column.id;
    }

    /**
     * Aktualisiert Column
     */
    public static updateColumn(
        board: Board,
        columnId: string,
        updates: Partial<ColumnProps>
    ): boolean {
        const column = board.findColumn(columnId);
        if (!column) {
            console.error(`❌ Spalte ${columnId} nicht gefunden`);
            return false;
        }

        column.update(updates);
        console.log(`✅ Spalte aktualisiert: ${columnId}`);
        return true;
    }

    /**
     * Löscht Column
     */
    public static deleteColumn(
        board: Board,
        columnId: string
    ): boolean {
        try {
            board.deleteColumn(columnId);
            console.log(`✅ Spalte gelöscht: ${columnId}`);
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Löschen der Spalte:', error);
            return false;
        }
    }

    /**
     * Synchronisiert Board-State von UI
     */
    public static syncBoardState(
        board: Board,
        columnOrder: string[],
        uiColumns: UIColumn[]
    ): { newColumnOrder: string[]; movedCardIds: string[] } {
        // 1. Update column order
        const newColumnOrder = uiColumns.map(c => c.id);

        // 2. Reorder board.columns
        const reorderedColumns: Column[] = [];
        for (const uiCol of uiColumns) {
            const col = board.columns.find(c => c.id === uiCol.id);
            if (col) reorderedColumns.push(col);
        }
        board.columns = reorderedColumns;

        // 3. Sync card positions (mit Cross-Column Move Support)
        const movedCardIds: string[] = [];
        for (const uiCol of uiColumns) {
            const col = board.columns.find(c => c.id === uiCol.id);
            if (!col) continue;

            const newCards: Card[] = [];
            for (const uiCard of uiCol.items) {
                // Suche Card BOARD-WEIT (nicht nur in aktueller Column)
                const cardId = String(uiCard.id); // Normalize zu string
                const result = board.findCardAndColumn(cardId);
                if (result) {
                    const { card, column: oldColumn } = result;
                    
                    // Wenn Card in anderer Column ist → verschieben
                    if (oldColumn.id !== col.id) {
                        oldColumn.deleteCard(card.id);
                        movedCardIds.push(card.id);
                        console.log(`🔄 Card "${card.heading}" von "${oldColumn.name}" nach "${col.name}" verschoben`);
                    }
                    
                    newCards.push(card);
                }
            }
            col.cards = newCards;
        }

        console.log('🔄 Board-State synchronisiert', movedCardIds.length > 0 ? `(${movedCardIds.length} Cards verschoben)` : '');
        return { newColumnOrder, movedCardIds };
    }

    /**
     * Reorder Columns (simpler)
     */
    public static reorderColumns(
        board: Board,
        columnIds: string[]
    ): void {
        const reordered: Column[] = [];
        for (const id of columnIds) {
            const col = board.columns.find(c => c.id === id);
            if (col) reordered.push(col);
        }
        board.columns = reordered;
        console.log('🔄 Spalten neu angeordnet');
    }

    /**
     * Fügt Kommentar zu Card hinzu
     */
    public static addComment(
        board: Board,
        cardId: string,
        text: string,
        author: string
    ): string | null {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return null;
        }

        result.card.addComment(text, author);
        const commentId = result.card.comments[result.card.comments.length - 1].id;
        console.log(`✅ Kommentar hinzugefügt zu Karte ${cardId}`);
        return commentId;
    }

    /**
     * Löscht Kommentar
     */
    public static deleteComment(
        board: Board,
        cardId: string,
        commentId: string
    ): boolean {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        result.card.deleteComment(commentId);
        console.log(`✅ Kommentar ${commentId} gelöscht`);
        return true;
    }

    /**
     * Setzt publishState für Card
     */
    public static setCardPublishState(
        board: Board,
        cardId: string,
        state: 'draft' | 'published' | 'archived'
    ): boolean {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        result.card.setPublishState(state);
        console.log(`✅ Card publishState gesetzt: ${state}`);
        return true;
    }

    /**
     * Setzt publishState für Board
     */
    public static setBoardPublishState(
        board: Board,
        state: 'draft' | 'published' | 'archived'
    ): void {
        board.setPublishState(state);
        console.log(`✅ Board publishState gesetzt: ${state}`);
    }

    /**
     * Aktualisiert Board-Metadaten
     */
    public static updateBoardMetadata(
        board: Board,
        updates: {
            name?: string;
            description?: string;
            tags?: string[];
            maintainers?: string[];
            ccLicense?: string;
        }
    ): void {
        if (updates.name !== undefined) board.name = updates.name;
        if (updates.description !== undefined) board.description = updates.description;
        if (updates.tags !== undefined) board.tags = updates.tags;
        if (updates.maintainers !== undefined) board.maintainers = updates.maintainers;
        if (updates.ccLicense !== undefined) board.ccLicense = updates.ccLicense;
        
        console.log('✅ Board-Metadaten aktualisiert');
    }
}
