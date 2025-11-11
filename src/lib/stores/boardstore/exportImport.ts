// src/lib/stores/boardstore/exportImport.ts
// Export/Import Funktionalität

import { Board, Column, Card } from '../../classes/BoardModel.js';
import { generateTimestamp, generateDTag } from '../../utils/idGenerator.js';
import { BoardStorage } from './storage.js';
import jsoncrush from 'jsoncrush';

export class ExportImport {
    /**
     * Exportiert Board als JSON
     */
    public static exportBoardAsJson(board: Board, includeMetadata = true): string {
        const data = board.getContextData(true);
        
        if (includeMetadata) {
            return JSON.stringify({
                version: '1.0',
                exportedAt: generateTimestamp(),
                exportedBy: 'kanban-editor',
                boardId: board.id,
                boardName: board.name,
                board: data
            }, null, 2);
        }
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Exportiert alle Boards als Backup
     */
    public static exportAllBoardsAsJson(boardIds: string[]): string {
        const allBoards: any[] = [];
        
        for (const boardId of boardIds) {
            const storageKey = `kanban-${boardId}`;
            const stored = localStorage.getItem(storageKey);
            
            if (stored) {
                try {
                    const data = JSON.parse(stored);
                    allBoards.push(data);
                } catch (error) {
                    console.warn(`⚠️ Fehler beim Parsen von Board ${boardId}:`, error);
                }
            }
        }
        
        return JSON.stringify({
            version: '1.0',
            exportedAt: generateTimestamp(),
            exportedBy: 'kanban-editor',
            boardCount: allBoards.length,
            boards: allBoards
        }, null, 2);
    }

    /**
     * Importiert Board aus JSON
     */
    public static importBoardFromJson(
        jsonString: string,
        mode: 'merge' | 'new' | 'overwrite' = 'merge'
    ): { success: boolean; board?: Board; error?: string } {
        try {
            const importData = JSON.parse(jsonString);
            const boardData = importData.board || importData;
            
            if (!boardData.id || !boardData.name) {
                return { 
                    success: false, 
                    error: 'Invalid board structure: missing id or name' 
                };
            }

            let newBoard: Board;

            if (mode === 'merge' || mode === 'new') {
                newBoard = new Board({
                    id: generateDTag('board'),
                    name: mode === 'new' 
                        ? `${boardData.name} (Imported)`
                        : boardData.name,
                    description: boardData.description,
                    publishState: boardData.publishState || 'draft',
                    author: boardData.author || 'anonymous',
                    maintainers: boardData.maintainers || [boardData.author || 'anonymous'],
                    tags: boardData.tags || [],
                    ccLicense: boardData.ccLicense || 'cc-by-4.0',
                    columns: []
                });

                newBoard.columns = (boardData.columns || []).map((colData: any) => {
                    const newCol = new Column({
                        id: generateDTag('column'),
                        name: colData.name,
                        color: colData.color || 'slate',
                        cards: []
                    });
                    
                    newCol.cards = (colData.cards || []).map((cardData: any) => {
                        return new Card({
                            id: generateDTag('card'),
                            heading: cardData.heading,
                            content: cardData.content,
                            image: cardData.image,
                            color: cardData.color || 'slate',
                            author: cardData.author || 'anonymous',
                            authorName: cardData.authorName,
                            comments: cardData.comments || [],
                            labels: cardData.labels || [],
                            links: cardData.links || [],
                            attendees: cardData.attendees || [],
                            publishState: cardData.publishState || 'draft'
                        });
                    });
                    
                    return newCol;
                });
                
                console.log(`✅ Board importiert im '${mode}'-Modus:`, newBoard.name);
                
            } else if (mode === 'overwrite') {
                newBoard = BoardStorage.reconstructBoard(boardData);
                console.log('✅ Board importiert im "overwrite"-Modus:', newBoard.name);
            } else {
                return { success: false, error: 'Unknown import mode' };
            }

            return { success: true, board: newBoard };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Import-Fehler:', errorMessage);
            return { 
                success: false, 
                error: `Failed to import board: ${errorMessage}` 
            };
        }
    }

    /**
     * Restore alle Boards aus Backup
     */
    public static restoreAllBoardsFromBackup(
        jsonString: string
    ): { success: boolean; imported: number; failed: number; boards: Board[]; errors: string[] } {
        const result = {
            success: false,
            imported: 0,
            failed: 0,
            boards: [] as Board[],
            errors: [] as string[]
        };

        try {
            const backupData = JSON.parse(jsonString);
            const boardsArray = backupData.boards || [];
            
            if (!Array.isArray(boardsArray) || boardsArray.length === 0) {
                result.errors.push('Invalid backup format: missing boards array');
                return result;
            }

            console.log(`🔄 Stelle ${boardsArray.length} Boards wieder her...`);

            for (let i = 0; i < boardsArray.length; i++) {
                try {
                    const boardData = boardsArray[i];
                    
                    if (!boardData.id || !boardData.name) {
                        throw new Error(`Board ${i + 1}: missing id or name`);
                    }

                    const board = BoardStorage.reconstructBoard(boardData);
                    const storageKey = `kanban-${board.id}`;
                    localStorage.setItem(storageKey, JSON.stringify(boardData));
                    
                    result.boards.push(board);
                    result.imported++;
                    
                    console.log(`✅ Board ${i + 1}/${boardsArray.length}: ${board.name}`);
                    
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    result.errors.push(`Board ${i + 1}: ${errorMsg}`);
                    result.failed++;
                    console.error(`❌ Board ${i + 1} fehlgeschlagen:`, errorMsg);
                }
            }

            result.success = result.imported > 0;
            console.log(`✅ Backup-Wiederherstellung abgeschlossen: ${result.imported} OK, ${result.failed} Fehler`);
            
            return result;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Failed to restore backup: ${errorMessage}`);
            console.error('❌ Backup-Wiederherstellungsfehler:', errorMessage);
            return result;
        }
    }

    /**
     * Generiert Share-Link
     */
    public static async generateShareLink(
        board: Board,
        includeMetadata = true
    ): Promise<{ url: string; tokenSize: number }> {
        const payload = includeMetadata
            ? { version: '1.0', exportedAt: generateTimestamp(), board: board.getContextData(true) }
            : board.getContextData(true);

        const json = JSON.stringify(payload);
        const crushed = jsoncrush.crush(json);
        const token = encodeURIComponent(crushed);

        let maxTokenSize = 200000;
        try {
            const resp = await fetch('/config.json');
            if (resp.ok) {
                const cfg = await resp.json();
                if (cfg?.shareTokenMaxSize) maxTokenSize = Number(cfg.shareTokenMaxSize) || maxTokenSize;
            }
        } catch (e) {
            // ignore
        }

        if (token.length > maxTokenSize) {
            throw new Error(`Share token too large (${token.length} > ${maxTokenSize}). Use Export/Backup instead.`);
        }

        const url = `${window.location.origin}/cardsboard?import=${token}`;
        return { url, tokenSize: token.length };
    }

    /**
     * Parst Share-Token
     */
    public static parseShareToken(token: string): any {
        try {
            const json = jsoncrush.uncrush(token);
            const parsed = JSON.parse(json);
            
            console.log('✅ Token erfolgreich geparst:', {
                hasBoard: !!parsed.board,
                boardName: parsed.board?.name || 'N/A',
                boardColumns: parsed.board?.columns?.length || 0,
                version: parsed.version || 'unknown'
            });
            
            return parsed;
        } catch (error) {
            console.error('❌ Token-Parsing Fehler:', error);
            const msg = error instanceof Error ? error.message : String(error);
            throw new Error(`Invalid share token: ${msg}`);
        }
    }
}
