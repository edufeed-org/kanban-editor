// src/lib/stores/boardstore/storage.ts
// localStorage Verwaltung für Boards

import { Board, Column, Card, type CardProps, type ColumnProps } from '../../classes/BoardModel.js';
import { generateTimestamp, generateDTag } from '../../utils/idGenerator.js';
import { authStore } from '../authStore.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';

export class BoardStorage {
    /**
     * ⚡ REFACTORING (9. Nov 2025): Eliminiert kanban-boards-list
     * Single Source of Truth: kanban-boards-metadata
     * 
     * Alte Struktur:
     *   - kanban-boards-list (nur IDs) ← REDUNDANT!
     *   - kanban-boards-metadata (Metadaten) ← USE THIS
     *   - kanban-board-{id} (volle Daten, lazy-loaded)
     * 
     * Neue Struktur:
     *   - kanban-boards-metadata (einzige Quelle für Board-Liste)
     *   - kanban-board-{id} (volle Daten, lazy-loaded)
     */

    /**
     * Lädt Board-IDs aus localStorage (aus kanban-boards-metadata)
     * 
     * ⚡ KRITISCH: ALLE Board-IDs kommen aus Metadaten!
     * Keine separaten Keys mehr.
     */
    public static loadBoardIds(): string[] {
        if (typeof window === 'undefined') return [];
        
        try {
            const metadataKey = 'kanban-boards-metadata';
            const stored = localStorage.getItem(metadataKey);
            
            if (stored) {
                const metadata = JSON.parse(stored);
                const ids = metadata.map((m: any) => m.id);
                console.log('📋 Board-IDs geladen aus Metadata:', ids.length, 'Boards');
                return ids;
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden der Board-IDs:', error);
        }
        
        return [];
    }

    /**
     * ⚠️ DEPRECATED: saveBoardIds() - Nicht mehr nötig!
     * 
     * Board-IDs werden NUR über addBoardToMetadataList() aktualisiert.
     * Diese Methode wird nicht mehr aufgerufen.
     * 
     * @deprecated Nutze stattdessen addBoardToMetadataList() in kanbanStore
     */
    public static saveBoardIds(boardIds: string[]): void {
        console.warn('⚠️ saveBoardIds() deprecated - Use addBoardToMetadataList() instead!');
        // NO-OP: Methode für Rückwärts-Kompatibilität erhalten, aber macht nichts
    }

    /**
     * Lädt zuletzt zugegriffenes Board aus localStorage
     * @returns Die Board-ID des zuletzt verwendeten Boards oder null
     */
    public static loadMostRecentBoard(boardIds: string[]): string | null {
        if (typeof window === 'undefined' || boardIds.length === 0) return null;
        
        try {
            let mostRecentBoardId = boardIds[0];
            let mostRecentTime = 0;
            
            console.log('🔍 Suche zuletzt aufgerufenes Board...');
            
            for (const boardId of boardIds) {
                const stored = localStorage.getItem(`kanban-${boardId}`);
                if (stored) {
                    try {
                        const data = JSON.parse(stored);
                        const lastAccessed = data.lastAccessedAt || data.updatedAt || data.createdAt;
                        
                        const timestamp = lastAccessed 
                            ? (typeof lastAccessed === 'string' 
                                ? new Date(lastAccessed).getTime() 
                                : lastAccessed)
                            : 0;
                        
                        console.log(`  Board: ${data.name} | lastAccessedAt: ${lastAccessed} | timestamp: ${timestamp}`);
                        
                        if (timestamp > mostRecentTime) {
                            mostRecentTime = timestamp;
                            mostRecentBoardId = boardId;
                            console.log(`    → Neuer Kandidat!`);
                        }
                    } catch (e) {
                        console.warn(`⚠️ Fehler beim Parsen von Board ${boardId}:`, e);
                    }
                }
            }
            
            console.log(`✅ Zuletzt zugegriffenes Board: ${mostRecentBoardId}`);
            return mostRecentBoardId;
        } catch (error) {
            console.error('❌ Fehler beim Laden des letzten Boards:', error);
            return boardIds[0] || null;
        }
    }

    /**
     * Rekonstruiert ein Board-Objekt aus JSON-Daten
     */
    public static reconstructBoard(data: any): Board {
        // Migration: Wenn author kein Pubkey-Format hat, ignoriere es
        let author = data.author;
        if (author && !author.match(/^[0-9a-f]{64}$/)) {
            console.warn(`⚠️ MIGRATION: Board author '${author}' ist kein Pubkey-Format, setze auf 'anonymous'`);
            author = 'anonymous';
        }
        
        const boardProps = {
            id: data.id,
            eventId: data.eventId, // ← NEU: Event-ID laden!
            name: data.name,
            description: data.description,
            publishState: data.publishState,
            author: author,
            maintainers: data.maintainers || [],
            tags: data.tags || [],
            ccLicense: data.ccLicense || 'cc-by-4.0',
            updatedAt: data.updatedAt, // ← KRITISCH: Timestamp MUSS aus localStorage kommen!
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
     * Erstellt ein Default-Board mit Standardspalten
     */
    public static createDefaultBoard(): Board {
        const defaultColumnNames = settingsStore.settings.defaultColumns || ['To Do', 'In Progress', 'Done'];
        
        console.log('🆕 Erstelle Default Board mit Spalten:', defaultColumnNames);
        
        const columns = defaultColumnNames.map(name => ({ 
            name, 
            color: BoardStorage.getDefaultColorForColumn(name) 
        }));
        
        const author = BoardStorage.getSafeAuthor();
        
        return new Board({
            name: 'Mein KI Kanban Board',
            description: 'Ein intelligentes Kanban-Board mit KI-Unterstützung',
            author: author,
            maintainers: author !== 'anonymous' ? [author] : [],
            columns
        });
    }

    /**
     * Gibt Standard-Farbe basierend auf Spalten-Namen zurück
     */
    private static getDefaultColorForColumn(name: string): string {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('to do') || lowerName.includes('todo') || lowerName.includes('backlog')) {
            return 'blue';
        }
        if (lowerName.includes('progress') || lowerName.includes('working') || lowerName.includes('doing')) {
            return 'orange';
        }
        if (lowerName.includes('done') || lowerName.includes('complete') || lowerName.includes('finished')) {
            return 'green';
        }
        if (lowerName.includes('archive') || lowerName.includes('archived')) {
            return 'red';
        }
        return 'slate';
    }

    /**
     * Gibt Author sicher zurück (auch wenn authStore noch nicht initialisiert)
     */
    private static getSafeAuthor(): string {
        try {
            if (typeof window === 'undefined') {
                return 'anonymous';
            }
            
            const pubkey = authStore?.getPubkeySafe();
            
            if (pubkey) {
                console.log('✅ Author gefunden:', pubkey.slice(0, 16) + '...');
                return pubkey;
            }
            
            console.warn('⚠️ authStore nicht initialisiert oder kein User eingeloggt, nutze "anonymous"');
            return 'anonymous';
        } catch (error) {
            console.error('❌ Unerwarteter Fehler in getSafeAuthor():', error);
            return 'anonymous';
        }
    }

    /**
     * Speichert ein Board in localStorage
     */
    public static saveBoard(board: Board): void {
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
     * Lädt ein spezifisches Board aus localStorage
     */
    public static loadBoard(boardId: string): Board | null {
        if (typeof window === 'undefined') return null;
        
        try {
            const storageKey = `kanban-${boardId}`;
            const stored = localStorage.getItem(storageKey);
            if (!stored) {
                console.warn(`⚠️ Board ${boardId} nicht gefunden unter ${storageKey}`);
                return null;
            }
            
            const data = JSON.parse(stored);
            return BoardStorage.reconstructBoard(data);
        } catch (error) {
            console.error('❌ Fehler beim Laden von Board:', boardId, error);
            return null;
        }
    }

    /**
     * Aktualisiert lastAccessedAt für ein Board
     */
    public static updateLastAccessed(boardId: string): void {
        if (typeof window === 'undefined') return;
        
        try {
            const storageKey = `kanban-${boardId}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                data.lastAccessedAt = generateTimestamp();
                localStorage.setItem(storageKey, JSON.stringify(data));
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Aktualisieren von lastAccessedAt:', error);
        }
    }

    /**
     * Löscht ein Board aus localStorage
     */
    public static deleteBoard(boardId: string): boolean {
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
     * Gibt alle gespeicherten Boards zurück
     */
    public static getAllBoardsMetadata(boardIds: string[]): Array<{ 
        id: string; 
        name: string; 
        description?: string; 
        createdAt: number; 
        updatedAt?: number;
        hasUnseenChanges?: boolean; // ← NEU: Ungesehene Änderungen
    }> {
        if (typeof window === 'undefined') return [];
        
        try {
            // ⚡ FIX: Lade Metadaten aus 'kanban-boards-metadata' statt einzelne Board-Keys!
            // Grund: Neue Boards von Nostr haben nur Metadaten, nicht vollständige Board-Daten
            const metadataKey = 'kanban-boards-metadata';
            const storedMetadata = localStorage.getItem(metadataKey);
            
            if (storedMetadata) {
                try {
                    const allMetadata = JSON.parse(storedMetadata);
                    
                    // Filter: Nur Boards die in boardIds sind
                    const boards = allMetadata
                        .filter((meta: any) => boardIds.includes(meta.id))
                        .map((meta: any) => {
                            // Parse timestamps
                            const lastAccessed = meta.lastAccessed 
                                ? (typeof meta.lastAccessed === 'string' 
                                    ? new Date(meta.lastAccessed).getTime()
                                    : meta.lastAccessed)
                                : Date.now();
                            
                            const createdAt = meta.createdAt 
                                ? (typeof meta.createdAt === 'string'
                                    ? new Date(meta.createdAt).getTime()
                                    : meta.createdAt)
                                : lastAccessed;
                            
                            return {
                                id: meta.id,
                                name: meta.name || 'Unbenanntes Board',
                                description: meta.description || '',
                                createdAt,
                                updatedAt: lastAccessed,
                                hasUnseenChanges: meta.hasUnseenChanges || false // ← NEU
                            };
                        });
                    
                    // Sortiere nach updatedAt (neueste zuerst)
                    return boards.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
                } catch (e) {
                    console.warn('⚠️ Fehler beim Parsen von Board-Metadaten:', e);
                }
            }
            
            // Fallback: Alte Logik (einzelne Board-Keys) für Legacy-Boards
            const boards: Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number; hasUnseenChanges?: boolean }> = [];
            
            for (const boardId of boardIds) {
                const storageKey = `kanban-${boardId}`;
                const stored = localStorage.getItem(storageKey);
                
                if (stored) {
                    try {
                        const data = JSON.parse(stored);
                        const updatedAtTime = data.updatedAt 
                            ? new Date(data.updatedAt).getTime() 
                            : (data.createdAt || Date.now());
                        
                        boards.push({
                            id: boardId,
                            name: data.name || 'Unbenanntes Board',
                            description: data.description,
                            createdAt: data.createdAt || Date.now(),
                            updatedAt: updatedAtTime,
                            hasUnseenChanges: false // Legacy-Boards: default false
                        });
                    } catch (e) {
                        console.warn(`⚠️ Fehler beim Parsen von Board ${boardId}:`, e);
                    }
                }
            }
            
            return boards.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (error) {
            console.error('❌ Fehler beim Laden aller Boards:', error);
            return [];
        }
    }
}
