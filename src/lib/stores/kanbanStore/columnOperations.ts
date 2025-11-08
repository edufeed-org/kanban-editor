/**
 * Column-Operations für BoardStore
 * 
 * Enthält alle CRUD-Operationen für Columns:
 * - createColumn, updateColumn, deleteColumn
 * - reorderColumns
 */

import type { Board, ColumnProps } from '$lib/classes/BoardModel.js';

// Type Definition (kompatibel mit index.svelte.ts)
export interface UIColumn {
    id: string;
    name: string;
    color?: string;
    items: Array<{
        id: string; // ✅ string (nicht number | string)
        [key: string]: any;
    }>;
}

/**
 * Erstellt eine neue Column
 */
export function createColumn(
    board: Board,
    name: string = 'Neue Spalte'
): { column: any; columnId: string } {
    const columnProps: ColumnProps = {
        name,
        color: 'slate'
    };
    
    const column = board.addColumn(columnProps);
    console.log('✅ Column erstellt:', column.id);
    
    return { column, columnId: column.id };
}

/**
 * Updated eine Column
 */
export function updateColumn(
    board: Board,
    columnId: string,
    updates: { name?: string; color?: string }
): void {
    const column = board.findColumn(columnId);
    if (!column) {
        throw new Error(`Column ${columnId} not found`);
    }
    
    column.update(updates);
}

/**
 * Löscht eine Column (mit allen Cards)
 */
export function deleteColumn(board: Board, columnId: string): void {
    board.deleteColumn(columnId);
    console.log('🗑️ Column gelöscht:', columnId);
}

/**
 * Reordert Columns basierend auf UI-State
 */
export function reorderColumns(
    board: Board,
    reorderedColumns: UIColumn[]
): string[] {
    const newColumnOrder = reorderedColumns.map(col => col.id);
    console.log('🔄 Columns neu angeordnet:', newColumnOrder);
    
    // Sortiere board.columns nach neuer Reihenfolge
    board.columns.sort((a, b) => {
        const indexA = newColumnOrder.indexOf(a.id);
        const indexB = newColumnOrder.indexOf(b.id);
        return indexA - indexB;
    });
    
    return newColumnOrder;
}

/**
 * Synchronisiert Board-State (Columns UND Cards)
 */
export function syncBoardState(
    board: Board,
    uiColumns: UIColumn[]
): { newColumnOrder: string[] } {
    console.log('🔄 syncBoardState - Synchronisiere Spalten UND Karten');
    
    // SCHRITT 1: Spalten-Reihenfolge
    const newColumnOrder = uiColumns.map(c => c.id);
    
    // SCHRITT 2: Reordne board.columns
    const columnMap = new Map(board.columns.map(c => [c.id, c]));
    const reorderedColumns: typeof board.columns = [];
    for (const colId of newColumnOrder) {
        const col = columnMap.get(colId);
        if (col) {
            reorderedColumns.push(col);
        }
    }
    board.columns = reorderedColumns;
    
    // SCHRITT 3: Karten-Positionen synchronisieren
    for (const uiColumn of uiColumns) {
        const modelColumn = board.findColumn(uiColumn.id);
        if (!modelColumn) continue;
        
        const uiCardIds = uiColumn.items.map((item: { id: string }) => item.id);
        const cardMap = new Map(modelColumn.cards.map(c => [c.id, c]));
        const reorderedCards: typeof modelColumn.cards = [];
        
        for (const cardId of uiCardIds) {
            const card = cardMap.get(cardId);
            if (card) {
                reorderedCards.push(card);
            }
        }
        
        // Ersetze cards Array komplett
        modelColumn.cards = reorderedCards;
    }
    
    console.log('  ✓ Board-State synchronisiert');
    
    return { newColumnOrder };
}
