/**
 * Board-Operations für BoardStore
 * 
 * Enthält alle CRUD-Operationen für Boards:
 * - createBoard, loadBoard, deleteBoard
 * - getAllBoards, filterBoards
 * - updateBoardMetadata
 */

import { Board, type BoardProps } from '$lib/classes/BoardModel.js';
import { settingsStore } from '../settingsStore.svelte.js';
import { getSafeAuthor, getDefaultColorForColumn } from './helpers.js';
import { generateTimestamp } from '$lib/utils/idGenerator.js';

/**
 * Erstellt ein neues Board mit Default-Spalten
 */
export function createBoard(name: string = 'Neues Board'): {
    board: Board;
    boardId: string;
} {
    const author = getSafeAuthor();
    
    const defaultColumnNames = settingsStore.settings.defaultColumns || ['To Do', 'In Progress', 'Done'];
    const columns = defaultColumnNames.map((name: string) => ({ 
        name, 
        color: getDefaultColorForColumn(name) 
    }));
    
    const newBoard = new Board({
        name,
        description: '',
        author: author,
        maintainers: author !== 'anonymous' ? [author] : [],
        columns
    });
    
    const boardId = newBoard.id;
    
    // Speichere zu localStorage
    if (typeof window !== 'undefined') {
        try {
            const data = newBoard.getContextData(true);
            const now = Date.now();
            // @ts-ignore
            data.createdAt = now;
            localStorage.setItem(`kanban-${boardId}`, JSON.stringify(data));
            
            console.log('✅ Neues Board erstellt:', boardId, name);
        } catch (error) {
            console.error('❌ Fehler beim Speichern des neuen Boards:', error);
        }
    }
    
    return { board: newBoard, boardId };
}

/**
 * Lädt ein Board aus localStorage
 */
export function loadBoardFromStorage(boardId: string): Board | null {
    if (typeof window === 'undefined') return null;
    
    try {
        const storageKey = `kanban-${boardId}`;
        const stored = localStorage.getItem(storageKey);
        
        if (!stored) {
            console.warn(`⚠️ Board ${boardId} nicht gefunden unter ${storageKey}`);
            return null;
        }
        
        const data = JSON.parse(stored);
        
        // Update lastAccessedAt
        data.lastAccessedAt = generateTimestamp();
        localStorage.setItem(storageKey, JSON.stringify(data));
        
        console.log('✅ Board geladen:', boardId, data.name, '(lastAccessedAt aktualisiert)');
        
        return reconstructBoard(data);
    } catch (error) {
        console.error('❌ Fehler beim Laden von Board:', boardId, error);
        return null;
    }
}

/**
 * Rekonstruiert Board-Instanz aus gespeicherten Daten
 */
export function reconstructBoard(data: any): Board {
    // Migration: Wenn author kein Pubkey-Format hat, ignoriere es
    let author = data.author;
    if (author && !author.match(/^[0-9a-f]{64}$/)) {
        console.warn('⚠️ author ist kein gültiger Pubkey, wird ignoriert:', author);
        author = undefined;
    }
    
    const boardProps = {
        id: data.id,
        name: data.name,
        description: data.description,
        publishState: data.publishState,
        author: author,
        maintainers: data.maintainers || [],
        tags: data.tags || [],
        ccLicense: data.ccLicense || 'cc-by-4.0',
        columns: data.columns?.map((colData: any) => ({
            id: colData.id,
            name: colData.name,
            color: colData.color || 'slate',
            cards: colData.cards?.map((cardData: any) => ({
                id: cardData.id,
                heading: cardData.heading,
                content: cardData.content,
                image: cardData.image,
                color: cardData.color || 'slate',
                author: cardData.author,
                authorName: cardData.authorName,
                comments: cardData.comments || [],
                labels: cardData.labels || [],
                links: cardData.links || [],
                attendees: cardData.attendees || [],
                publishState: cardData.publishState || 'draft'
            })) || []
        })) || []
    };
    
    return new Board(boardProps);
}

/**
 * Löscht ein Board aus localStorage
 */
export function deleteBoardFromStorage(boardId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
        localStorage.removeItem(`kanban-${boardId}`);
        console.log('🗑️ Board gelöscht:', boardId);
        return true;
    } catch (error) {
        console.error('❌ Fehler beim Löschen von Board:', boardId, error);
        return false;
    }
}

/**
 * Gibt alle gespeicherten Boards zurück (neueste zuerst)
 */
export function getAllBoardsFromStorage(boardIds: string[]): Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt?: number;
}> {
    if (typeof window === 'undefined') return [];
    
    try {
        const boards: Array<{
            id: string;
            name: string;
            description?: string;
            createdAt: number;
            updatedAt?: number;
        }> = [];
        
        for (const boardId of boardIds) {
            const stored = localStorage.getItem(`kanban-${boardId}`);
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    
                    // Parse Timestamps korrekt (ISO String → Number)
                    const updatedAt = data.updatedAt || data.createdAt;
                    const timestamp = updatedAt 
                        ? (typeof updatedAt === 'string' 
                            ? new Date(updatedAt).getTime()
                            : updatedAt)
                        : 0;
                    
                    boards.push({
                        id: boardId,
                        name: data.name || 'Unbenanntes Board',
                        description: data.description,
                        createdAt: data.createdAt || 0,
                        updatedAt: timestamp
                    });
                } catch (parseError) {
                    console.error(`❌ Fehler beim Parsen von Board ${boardId}:`, parseError);
                }
            }
        }
        
        // Sortiere nach updatedAt (zuletzt BEARBEITETE zuerst)
        return boards.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
        console.error('❌ Fehler beim Laden aller Boards:', error);
        return [];
    }
}

/**
 * Speichert Board zu localStorage
 */
export function saveBoardToStorage(board: Board): void {
    if (typeof window === 'undefined') return;
    
    try {
        const data = board.getContextData(true);
        const storageKey = `kanban-${board.id}`;
        localStorage.setItem(storageKey, JSON.stringify(data));
        console.log('💾 Board in localStorage gespeichert:', storageKey);
    } catch (error) {
        console.warn('⚠️ Fehler beim Speichern in localStorage:', error);
    }
}

/**
 * Erstellt ein Default-Board
 */
export function createDefaultBoard(): Board {
    const defaultColumnNames = settingsStore.settings.defaultColumns || ['To Do', 'In Progress', 'Done'];
    
    console.log('🆕 Erstelle Default Board mit Spalten:', defaultColumnNames);
    
    const columns = defaultColumnNames.map((name: string) => ({ 
        name, 
        color: getDefaultColorForColumn(name) 
    }));
    
    const author = getSafeAuthor();
    
    return new Board({
        name: 'Mein KI Kanban Board',
        description: 'Ein intelligentes Kanban-Board mit KI-Unterstützung',
        author: author,
        maintainers: author !== 'anonymous' ? [author] : [],
        columns
    });
}
