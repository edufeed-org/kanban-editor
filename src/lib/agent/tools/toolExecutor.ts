/**
 * Tool Executor - Führt Tool-Calls aus
 * 
 * Dispatcht Tool-Aufrufe an die entsprechenden BoardOperations.
 * Jeder Tool-Call wird einzeln ausgeführt und Ergebnisse gesammelt.
 */

import type { Board, Column, Card, Comment as CommentType } from '$lib/classes/BoardModel';
import { BoardOperations } from '$lib/stores/boardstore/operations';
import type { NostrIntegration } from '$lib/stores/boardstore/nostr';

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string; // JSON string
    };
}

export interface ToolResult {
    tool_call_id: string;
    tool_name: string;
    success: boolean;
    result?: any;
    error?: string;
}

export interface ExecutionContext {
    board: Board;
    currentUserPubkey: string | null;
    currentUserName: string | null;
    nostrIntegration?: NostrIntegration;
    // BoardStore reference for direct API calls
    boardStore?: {
        createColumn: (name: string, color?: string) => string;
        updateColumn: (columnId: string, updates: any) => void;
        deleteColumn: (columnId: string) => void;
        createCard: (columnId: string, heading: string, content?: string) => string;
        editCard: (cardId: string, updates: any) => void;
        deleteCard: (cardId: string) => Promise<void>;
        moveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void;
    };
    triggerUpdate: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Findet eine Spalte anhand des Namens (case-insensitive)
 */
function findColumnByName(board: Board, name: string): Column | undefined {
    const lowerName = name.toLowerCase().trim();
    return board.columns.find(col => 
        col.name.toLowerCase().trim() === lowerName
    );
}

/**
 * Findet eine Spalte anhand der ID
 */
function findColumnById(board: Board, columnId: string): Column | undefined {
    return board.findColumn(columnId);
}

/**
 * Findet eine Karte anhand der ID im gesamten Board
 */
function findCardById(board: Board, cardId: string): { card: Card; column: Column } | null {
    return board.findCardAndColumn(cardId);
}

/**
 * Findet eine Karte anhand des Titels (partial match, case-insensitive)
 */
function findCardByTitle(board: Board, title: string): { card: Card; column: Column } | null {
    const lowerTitle = title.toLowerCase().trim();
    
    for (const column of board.columns) {
        for (const card of column.cards) {
            if (card.heading.toLowerCase().includes(lowerTitle)) {
                return { card, column };
            }
        }
    }
    return null;
}

/**
 * Löst eine Spalten-Referenz auf (kann Name oder ID sein)
 */
function resolveColumn(board: Board, columnRef: string): Column | undefined {
    // Erst nach ID suchen
    const byId = findColumnById(board, columnRef);
    if (byId) return byId;
    
    // Dann nach Name suchen
    return findColumnByName(board, columnRef);
}

/**
 * Löst eine Karten-Referenz auf (kann ID oder Titel sein)
 */
function resolveCard(board: Board, cardRef: string): { card: Card; column: Column } | null {
    // Erst nach ID suchen
    const byId = findCardById(board, cardRef);
    if (byId) return byId;
    
    // Dann nach Titel suchen
    return findCardByTitle(board, cardRef);
}

// ============================================================================
// Tool Execution Functions
// ============================================================================

function executeCreateBoard(args: any, ctx: ExecutionContext): ToolResult {
    // Board existiert bereits - wir können nur das aktuelle Board aktualisieren
    // In der aktuellen Architektur wird ein neues Board über den Store erstellt
    return {
        tool_call_id: '',
        tool_name: 'create_board',
        success: false,
        error: 'Board-Erstellung nicht im Chat-Kontext möglich. Bitte nutze die Board-Verwaltung in der Sidebar.'
    };
}

function executeUpdateBoard(args: any, ctx: ExecutionContext): ToolResult {
    const { name, description, tags } = args;
    
    try {
        if (name) ctx.board.name = name;
        if (description !== undefined) ctx.board.description = description;
        if (tags) ctx.board.tags = tags;
        
        ctx.triggerUpdate();
        
        return {
            tool_call_id: '',
            tool_name: 'update_board',
            success: true,
            result: {
                boardId: ctx.board.id,
                updatedFields: { name, description, tags }
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'update_board',
            success: false,
            error: `Fehler beim Aktualisieren des Boards: ${error}`
        };
    }
}

function executeAddColumn(args: any, ctx: ExecutionContext): ToolResult {
    const { name, color, position } = args;
    
    if (!name) {
        return {
            tool_call_id: '',
            tool_name: 'add_column',
            success: false,
            error: 'Spaltenname ist erforderlich'
        };
    }
    
    try {
        let columnId: string;
        
        // Prefer boardStore API if available (handles triggerUpdate internally)
        if (ctx.boardStore) {
            columnId = ctx.boardStore.createColumn(name, color);
        } else {
            // Fallback to BoardOperations
            columnId = BoardOperations.createColumn(ctx.board, name, color) || '';
            ctx.triggerUpdate();
        }
        
        if (!columnId) {
            return {
                tool_call_id: '',
                tool_name: 'add_column',
                success: false,
                error: 'Spalte konnte nicht erstellt werden'
            };
        }
        
        // TODO: Position handling wenn position angegeben
        
        return {
            tool_call_id: '',
            tool_name: 'add_column',
            success: true,
            result: {
                columnId,
                name,
                color: color || 'slate'
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'add_column',
            success: false,
            error: `Fehler beim Erstellen der Spalte: ${error}`
        };
    }
}

function executeUpdateColumn(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const columnIdentifier = args.column_id || args.columnId || args.columnName || args.column;
    const { name, color } = args;
    
    if (!columnIdentifier) {
        return {
            tool_call_id: '',
            tool_name: 'update_column',
            success: false,
            error: 'column_id ist erforderlich'
        };
    }
    
    const column = resolveColumn(ctx.board, columnIdentifier);
    if (!column) {
        return {
            tool_call_id: '',
            tool_name: 'update_column',
            success: false,
            error: `Spalte "${columnIdentifier}" nicht gefunden`
        };
    }
    
    try {
        const updates: any = {};
        if (name) updates.name = name;
        if (color) updates.color = color;
        
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        if (ctx.boardStore?.updateColumn) {
            ctx.boardStore.updateColumn(column.id, updates);
        } else {
            BoardOperations.updateColumn(ctx.board, column.id, updates);
            ctx.triggerUpdate();
        }
        
        return {
            tool_call_id: '',
            tool_name: 'update_column',
            success: true,
            result: {
                columnId: column.id,
                updatedFields: updates
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'update_column',
            success: false,
            error: `Fehler beim Aktualisieren der Spalte: ${error}`
        };
    }
}

function executeDeleteColumn(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const columnIdentifier = args.column_id || args.columnId || args.columnName || args.column;
    const moveCardsTo = args.move_cards_to || args.moveCardsTo || args.targetColumn;
    
    if (!columnIdentifier) {
        return {
            tool_call_id: '',
            tool_name: 'delete_column',
            success: false,
            error: 'column_id ist erforderlich'
        };
    }
    
    const column = resolveColumn(ctx.board, columnIdentifier);
    if (!column) {
        return {
            tool_call_id: '',
            tool_name: 'delete_column',
            success: false,
            error: `Spalte "${columnIdentifier}" nicht gefunden`
        };
    }
    
    try {
        // Wenn Karten verschoben werden sollen
        if (moveCardsTo && column.cards.length > 0) {
            const targetColumn = resolveColumn(ctx.board, moveCardsTo);
            if (!targetColumn) {
                return {
                    tool_call_id: '',
                    tool_name: 'delete_column',
                    success: false,
                    error: `Zielspalte "${moveCardsTo}" nicht gefunden`
                };
            }
            
            // Karten verschieben via boardStore API wenn verfügbar
            for (const card of column.cards) {
                if (ctx.boardStore?.moveCard) {
                    ctx.boardStore.moveCard(card.id, column.id, targetColumn.id);
                } else {
                    BoardOperations.moveCard(ctx.board, card.id, column.id, targetColumn.id);
                }
            }
        }
        
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        if (ctx.boardStore?.deleteColumn) {
            ctx.boardStore.deleteColumn(column.id);
        } else {
            BoardOperations.deleteColumn(ctx.board, column.id);
            ctx.triggerUpdate();
        }
        
        return {
            tool_call_id: '',
            tool_name: 'delete_column',
            success: true,
            result: {
                deletedColumnId: column.id,
                movedCardsTo: moveCardsTo || null
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'delete_column',
            success: false,
            error: `Fehler beim Löschen der Spalte: ${error}`
        };
    }
}

function executeAddCard(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung: LLM kann verschiedene Namen verwenden
    const columnIdentifier = args.column_id || args.columnId || args.columnName || args.column;
    const title = args.title || args.heading || args.name;
    const { description, labels, color } = args;
    
    if (!columnIdentifier || !title) {
        return {
            tool_call_id: '',
            tool_name: 'add_card',
            success: false,
            error: `column_id und title sind erforderlich (erhalten: column=${columnIdentifier}, title=${title})`
        };
    }
    
    // resolveColumn kann sowohl ID als auch Name auflösen
    const column = resolveColumn(ctx.board, columnIdentifier);
    if (!column) {
        return {
            tool_call_id: '',
            tool_name: 'add_card',
            success: false,
            error: `Spalte "${columnIdentifier}" nicht gefunden`
        };
    }
    
    try {
        let cardId: string;
        
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        if (ctx.boardStore?.createCard) {
            cardId = ctx.boardStore.createCard(column.id, title, description || '');
        } else {
            cardId = BoardOperations.createCard(
                ctx.board,
                column.id,
                title,
                description || '',
                ctx.currentUserPubkey || undefined,
                ctx.currentUserName || undefined
            ) || '';
        }
        
        if (!cardId) {
            return {
                tool_call_id: '',
                tool_name: 'add_card',
                success: false,
                error: 'Karte konnte nicht erstellt werden'
            };
        }
        
        // Labels und Color setzen wenn angegeben
        if (labels || color) {
            const updates: any = {};
            if (labels) updates.labels = labels;
            if (color) updates.color = color;
            
            if (ctx.boardStore?.editCard) {
                ctx.boardStore.editCard(cardId, updates);
            } else {
                BoardOperations.updateCard(ctx.board, cardId, updates);
                ctx.triggerUpdate();
            }
        }
        
        return {
            tool_call_id: '',
            tool_name: 'add_card',
            success: true,
            result: {
                cardId,
                columnId: column.id,
                columnName: column.name,
                title,
                description: description || ''
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'add_card',
            success: false,
            error: `Fehler beim Erstellen der Karte: ${error}`
        };
    }
}

function executeUpdateCard(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const cardIdentifier = args.card_id || args.cardId || args.card;
    const title = args.title || args.heading || args.name;
    const description = args.description || args.content;
    const { labels, color } = args;
    
    if (!cardIdentifier) {
        return {
            tool_call_id: '',
            tool_name: 'update_card',
            success: false,
            error: 'card_id ist erforderlich'
        };
    }
    
    const cardResult = resolveCard(ctx.board, cardIdentifier);
    if (!cardResult) {
        return {
            tool_call_id: '',
            tool_name: 'update_card',
            success: false,
            error: `Karte "${cardIdentifier}" nicht gefunden`
        };
    }
    
    try {
        const updates: any = {};
        if (title !== undefined) updates.heading = title;
        if (description !== undefined) updates.content = description;
        if (labels !== undefined) updates.labels = labels;
        if (color !== undefined) updates.color = color;
        
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        if (ctx.boardStore?.editCard) {
            ctx.boardStore.editCard(cardResult.card.id, updates);
        } else {
            BoardOperations.updateCard(ctx.board, cardResult.card.id, updates);
            ctx.triggerUpdate();
        }
        
        return {
            tool_call_id: '',
            tool_name: 'update_card',
            success: true,
            result: {
                cardId: cardResult.card.id,
                updatedFields: updates
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'update_card',
            success: false,
            error: `Fehler beim Aktualisieren der Karte: ${error}`
        };
    }
}

function executeMoveCard(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const cardIdentifier = args.card_id || args.cardId || args.card;
    const targetColumnIdentifier = args.to_column_id || args.toColumnId || args.targetColumn || args.column;
    const { position } = args;
    
    if (!cardIdentifier || !targetColumnIdentifier) {
        return {
            tool_call_id: '',
            tool_name: 'move_card',
            success: false,
            error: 'card_id und to_column_id sind erforderlich'
        };
    }
    
    const cardResult = resolveCard(ctx.board, cardIdentifier);
    if (!cardResult) {
        return {
            tool_call_id: '',
            tool_name: 'move_card',
            success: false,
            error: `Karte "${cardIdentifier}" nicht gefunden`
        };
    }
    
    const targetColumn = resolveColumn(ctx.board, targetColumnIdentifier);
    if (!targetColumn) {
        return {
            tool_call_id: '',
            tool_name: 'move_card',
            success: false,
            error: `Zielspalte "${targetColumnIdentifier}" nicht gefunden`
        };
    }
    
    try {
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        if (ctx.boardStore?.moveCard) {
            ctx.boardStore.moveCard(cardResult.card.id, cardResult.column.id, targetColumn.id);
        } else {
            BoardOperations.moveCard(
                ctx.board,
                cardResult.card.id,
                cardResult.column.id,
                targetColumn.id
            );
            ctx.triggerUpdate();
        }
        
        // TODO: Position innerhalb der Spalte wenn angegeben
        
        return {
            tool_call_id: '',
            tool_name: 'move_card',
            success: true,
            result: {
                cardId: cardResult.card.id,
                fromColumn: cardResult.column.name,
                toColumn: targetColumn.name
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'move_card',
            success: false,
            error: `Fehler beim Verschieben der Karte: ${error}`
        };
    }
}

function executeDeleteCard(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const cardIdentifier = args.card_id || args.cardId || args.card;
    
    if (!cardIdentifier) {
        return {
            tool_call_id: '',
            tool_name: 'delete_card',
            success: false,
            error: 'card_id ist erforderlich'
        };
    }
    
    const cardResult = resolveCard(ctx.board, cardIdentifier);
    if (!cardResult) {
        return {
            tool_call_id: '',
            tool_name: 'delete_card',
            success: false,
            error: `Karte "${cardIdentifier}" nicht gefunden`
        };
    }
    
    try {
        // Prefer boardStore API (includes triggerUpdate + Nostr publishing)
        // Note: boardStore.deleteCard is async, but we fire-and-forget here
        if (ctx.boardStore?.deleteCard) {
            void ctx.boardStore.deleteCard(cardResult.card.id);
        } else {
            BoardOperations.deleteCard(ctx.board, cardResult.card.id, ctx.nostrIntegration);
            ctx.triggerUpdate();
        }
        
        return {
            tool_call_id: '',
            tool_name: 'delete_card',
            success: true,
            result: {
                deletedCardId: cardResult.card.id,
                deletedFromColumn: cardResult.column.name
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'delete_card',
            success: false,
            error: `Fehler beim Löschen der Karte: ${error}`
        };
    }
}

function executeAddComment(args: any, ctx: ExecutionContext): ToolResult {
    // Flexible Argument-Unterstützung
    const cardIdentifier = args.card_id || args.cardId || args.card;
    const text = args.text || args.comment || args.content;
    
    if (!cardIdentifier || !text) {
        return {
            tool_call_id: '',
            tool_name: 'add_comment',
            success: false,
            error: 'card_id und text sind erforderlich'
        };
    }
    
    const cardResult = resolveCard(ctx.board, cardIdentifier);
    if (!cardResult) {
        return {
            tool_call_id: '',
            tool_name: 'add_comment',
            success: false,
            error: `Karte "${cardIdentifier}" nicht gefunden`
        };
    }
    
    try {
        const author = ctx.currentUserPubkey || 'anonymous';
        cardResult.card.addComment(text, author);
        ctx.triggerUpdate();
        
        return {
            tool_call_id: '',
            tool_name: 'add_comment',
            success: true,
            result: {
                cardId: cardResult.card.id,
                commentText: text,
                author: author
            }
        };
    } catch (error) {
        return {
            tool_call_id: '',
            tool_name: 'add_comment',
            success: false,
            error: `Fehler beim Hinzufügen des Kommentars: ${error}`
        };
    }
}

function executeRespond(args: any): ToolResult {
    const { message } = args;
    
    return {
        tool_call_id: '',
        tool_name: 'respond',
        success: true,
        result: {
            message: message || 'Keine Nachricht angegeben',
            isResponse: true
        }
    };
}

function executeAskClarification(args: any): ToolResult {
    const { question, options } = args;
    
    return {
        tool_call_id: '',
        tool_name: 'ask_clarification',
        success: true,
        result: {
            question: question || 'Kannst du das genauer beschreiben?',
            options: options || [],
            needsClarification: true
        }
    };
}

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Führt einen einzelnen Tool-Call aus
 */
export function executeToolCall(
    toolCall: ToolCall,
    ctx: ExecutionContext
): ToolResult {
    const toolName = toolCall.function.name;
    
    let args: any;
    try {
        args = JSON.parse(toolCall.function.arguments);
    } catch (error) {
        return {
            tool_call_id: toolCall.id,
            tool_name: toolName,
            success: false,
            error: `Ungültige Tool-Argumente: ${error}`
        };
    }
    
    console.log(`🔧 Executing tool: ${toolName}`, args);
    
    let result: ToolResult;
    
    switch (toolName) {
        case 'create_board':
            result = executeCreateBoard(args, ctx);
            break;
        case 'update_board':
            result = executeUpdateBoard(args, ctx);
            break;
        case 'add_column':
            result = executeAddColumn(args, ctx);
            break;
        case 'update_column':
            result = executeUpdateColumn(args, ctx);
            break;
        case 'delete_column':
            result = executeDeleteColumn(args, ctx);
            break;
        case 'add_card':
            result = executeAddCard(args, ctx);
            break;
        case 'update_card':
            result = executeUpdateCard(args, ctx);
            break;
        case 'move_card':
            result = executeMoveCard(args, ctx);
            break;
        case 'delete_card':
            result = executeDeleteCard(args, ctx);
            break;
        case 'add_comment':
            result = executeAddComment(args, ctx);
            break;
        case 'respond':
            result = executeRespond(args);
            break;
        case 'ask_clarification':
            result = executeAskClarification(args);
            break;
        default:
            result = {
                tool_call_id: toolCall.id,
                tool_name: toolName,
                success: false,
                error: `Unbekanntes Tool: ${toolName}`
            };
    }
    
    // Tool Call ID setzen
    result.tool_call_id = toolCall.id;
    
    console.log(`✅ Tool result:`, result);
    
    return result;
}

/**
 * Führt mehrere Tool-Calls aus (für Batch-Operationen)
 */
export function executeToolCalls(
    toolCalls: ToolCall[],
    ctx: ExecutionContext
): ToolResult[] {
    const results: ToolResult[] = [];
    
    for (const toolCall of toolCalls) {
        const result = executeToolCall(toolCall, ctx);
        results.push(result);
        
        // Bei kritischen Fehlern abbrechen
        if (!result.success && result.error?.includes('nicht gefunden')) {
            // Weiter machen bei "nicht gefunden" - könnte sein dass eine spätere Operation das Objekt erstellt
            continue;
        }
    }
    
    return results;
}

/**
 * Generiert eine menschenlesbare Zusammenfassung der Ergebnisse
 */
export function summarizeResults(results: ToolResult[]): string {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const lines: string[] = [];
    
    if (successful.length > 0) {
        lines.push(`✅ ${successful.length} Aktion(en) erfolgreich:`);
        for (const r of successful) {
            switch (r.tool_name) {
                case 'add_card':
                    lines.push(`  • Karte "${r.result?.title}" in "${r.result?.columnName}" erstellt`);
                    break;
                case 'update_card':
                    lines.push(`  • Karte aktualisiert`);
                    break;
                case 'move_card':
                    lines.push(`  • Karte von "${r.result?.fromColumn}" nach "${r.result?.toColumn}" verschoben`);
                    break;
                case 'delete_card':
                    lines.push(`  • Karte gelöscht`);
                    break;
                case 'add_column':
                    lines.push(`  • Spalte "${r.result?.name}" erstellt`);
                    break;
                case 'update_column':
                    lines.push(`  • Spalte aktualisiert`);
                    break;
                case 'delete_column':
                    lines.push(`  • Spalte gelöscht`);
                    break;
                case 'add_comment':
                    lines.push(`  • Kommentar hinzugefügt`);
                    break;
                case 'respond':
                    // Reine Antwort - nicht in Summary
                    break;
                case 'ask_clarification':
                    // Rückfrage - nicht in Summary
                    break;
                default:
                    lines.push(`  • ${r.tool_name} ausgeführt`);
            }
        }
    }
    
    if (failed.length > 0) {
        lines.push(`\n❌ ${failed.length} Aktion(en) fehlgeschlagen:`);
        for (const r of failed) {
            lines.push(`  • ${r.tool_name}: ${r.error}`);
        }
    }
    
    return lines.join('\n');
}
