/**
 * Import/Export & Share-Link Operations für BoardStore
 * 
 * Enthält:
 * - exportBoardAsJson, exportAllBoardsAsJson
 * - importBoardFromJson, restoreAllBoardsFromBackup
 * - generateShareLink, parseShareToken
 */

import { Board } from '$lib/classes/BoardModel.js';
import { reconstructBoard, saveBoardToStorage } from './boardOperations.js';
import { generateDTag } from '$lib/utils/idGenerator.js';
// @ts-ignore - pako hat keine @types
import pako from 'pako';

/**
 * Exportiert ein Board als JSON
 */
export function exportBoardAsJson(board: Board, includeMetadata = true): string {
    const data = board.getContextData(true);
    
    if (includeMetadata) {
        return JSON.stringify({
            version: '1.0',
            exportedAt: new Date().toISOString(),
            exportedBy: board.author,
            board: data
        }, null, 2);
    }
    
    return JSON.stringify(data, null, 2);
}

/**
 * Exportiert alle Boards als JSON-Backup
 */
export function exportAllBoardsAsJson(boardIds: string[]): string {
    const boards: any[] = [];
    
    for (const boardId of boardIds) {
        const stored = localStorage.getItem(`kanban-${boardId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                boards.push(data);
            } catch (error) {
                console.error(`❌ Fehler beim Exportieren von Board ${boardId}:`, error);
            }
        }
    }
    
    return JSON.stringify({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        boardCount: boards.length,
        boards: boards
    }, null, 2);
}

/**
 * Importiert ein Board aus JSON
 */
export function importBoardFromJson(
    jsonString: string,
    mode: 'merge' | 'new' | 'overwrite' = 'merge'
): { success: boolean; board?: Board; error?: string } {
    try {
        const parsed = JSON.parse(jsonString);
        const boardData = parsed.board || parsed;
        
        // Validierung
        if (!boardData.id || !boardData.name) {
            return {
                success: false,
                error: 'Ungültiges Board-Format: id und name sind erforderlich'
            };
        }
        
        // Mode: 'merge' - Neue IDs generieren
        if (mode === 'merge') {
            boardData.id = generateDTag('board');
            boardData.columns = boardData.columns?.map((col: any) => ({
                ...col,
                id: generateDTag('column'),
                cards: col.cards?.map((card: any) => ({
                    ...card,
                    id: generateDTag('card')
                }))
            }));
        }
        
        // Mode: 'new' - Neue IDs + "(Imported)" Suffix
        if (mode === 'new') {
            boardData.id = generateDTag('board');
            boardData.name = `${boardData.name} (Imported)`;
            boardData.columns = boardData.columns?.map((col: any) => ({
                ...col,
                id: generateDTag('column'),
                cards: col.cards?.map((card: any) => ({
                    ...card,
                    id: generateDTag('card')
                }))
            }));
        }
        
        // Mode: 'overwrite' - IDs beibehalten (Warnung!)
        // Keine Änderungen
        
        const board = reconstructBoard(boardData);
        return { success: true, board };
        
    } catch (error) {
        return {
            success: false,
            error: `JSON-Parse-Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
        };
    }
}

/**
 * Speichert importiertes Board
 */
export function saveImportedBoard(
    board: Board,
    boardIds: string[],
    overwriteExisting = false
): { boardId: string; newBoardIds: string[] } {
    const boardId = board.id;
    
    saveBoardToStorage(board);
    
    let newBoardIds = boardIds;
    if (!boardIds.includes(boardId)) {
        newBoardIds = [...boardIds, boardId];
    }
    
    return { boardId, newBoardIds };
}

/**
 * Restored alle Boards aus Backup
 */
export function restoreAllBoardsFromBackup(
    jsonString: string
): {
    success: boolean;
    imported: number;
    failed: number;
    boards: Board[];
    errors: string[];
} {
    const result = {
        success: true,
        imported: 0,
        failed: 0,
        boards: [] as Board[],
        errors: [] as string[]
    };
    
    try {
        const parsed = JSON.parse(jsonString);
        const boards = parsed.boards || [parsed];
        
        for (const boardData of boards) {
            try {
                const board = reconstructBoard(boardData);
                saveBoardToStorage(board);
                result.boards.push(board);
                result.imported++;
            } catch (error) {
                result.failed++;
                result.errors.push(
                    `Board ${boardData.id || 'unknown'}: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
                );
            }
        }
        
        result.success = result.failed === 0;
        
    } catch (error) {
        result.success = false;
        result.errors.push(`JSON-Parse-Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
    
    return result;
}

/**
 * Generiert Share-Link mit Token
 */
export async function generateShareLink(
    board: Board,
    includeMetadata = true
): Promise<{ url: string; tokenSize: number }> {
    const json = exportBoardAsJson(board, includeMetadata);
    const compressed = pako.deflate(json);
    const base64 = btoa(String.fromCharCode(...compressed));
    const encoded = encodeURIComponent(base64);
    
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?import=${encoded}`;
    
    return {
        url,
        tokenSize: encoded.length
    };
}

/**
 * Parsed Share-Token
 */
export function parseShareToken(token: string): any {
    try {
        const decoded = decodeURIComponent(token);
        const binary = atob(decoded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decompressed = pako.inflate(bytes, { to: 'string' });
        return JSON.parse(decompressed);
    } catch (error) {
        throw new Error(`Token-Parse-Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
}
