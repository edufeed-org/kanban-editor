// src/lib/stores/boardstore/storage.ts
// localStorage Verwaltung für Boards

import { Board, Column, Card, type CardProps, type ColumnProps } from '../../classes/BoardModel.js';
import { generateTimestamp, generateDTag } from '../../utils/idGenerator.js';
import { authStore } from '../authStore.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';

export class BoardStorage {
    /**
     * ✅ REFACTORING (10. Nov 2025): Extract Board IDs from localStorage Keys
     * 
     * ALTE METHODE: Liest aus kanban-boards-metadata
     * NEUE METHODE: Extrahiert IDs aus localStorage Keys direkt
     * 
     * Vorteile:
     * - Auto-Discovery: Boards von Nostr erscheinen automatisch
     * - Robustheit: Kein einzelner Key kann alles brechen
     * - Single Source of Truth: Boards enthalten alle ihre Daten
     * 
     * Neue Struktur:
     *   - kanban-{id} (volle Board-Daten, alle Felder inkl. lastAccessedAt)
     *   - KEIN kanban-boards-metadata mehr!
     */
    public static loadBoardIds(): string[] {
        if (typeof window === 'undefined') return [];
        
        try {
            // Get all localStorage keys
            const allKeys = Object.keys(localStorage);
            
            // Filter for board keys: "kanban-{id}" but NOT config/settings/metadata/backup
            const boardKeys = allKeys.filter(key => {
                // Must start with "kanban-"
                if (!key.startsWith('kanban-')) return false;
                
                // Extract ID part (after "kanban-")
                const id = key.replace('kanban-', '');
                
                // Exclude non-board keys
                if (id === 'config') return false;
                if (id === 'settings') return false;
                if (id === 'boards-list') return false;
                if (id.includes('-metadata')) return false;
                if (id.includes('-backup')) return false;
                if (id.includes('-migrated')) return false;
                
                // Board IDs should have minimum length (generated IDs are long)
                // This filters out accidentally created short keys
                if (id.length < 10) return false;
                
                return true;
            });
            
            // Extract board IDs from keys (remove "kanban-" prefix)
            const boardIds = boardKeys
                .map(key => key.replace('kanban-', ''))
                .filter(id => id && id.length > 0); // ✅ Extra safety: filter empty strings
            
            console.log(`📋 Board-IDs gefunden aus localStorage Keys: ${boardIds.length} Boards`);
            if (boardIds.length > 0) {
                console.log(`  IDs: ${boardIds.slice(0, 5).join(', ')}${boardIds.length > 5 ? '...' : ''}`);
            }
            
            return boardIds;
            
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden der Board-IDs:', error);
            return [];
        }
    }

    /**
     * ⚠️ DEPRECATED: saveBoardIds() - Nicht mehr nötig!
     * 
     * Nach Metadata-Refactoring (Jan 2026):
     * - Board-IDs werden automatisch aus localStorage.keys() geladen (loadBoardIds())
     * - Keine separate Board-Liste mehr notwendig
     * 
     * @deprecated Wird nicht mehr verwendet - loadBoardIds() scannt localStorage-Keys
     */
    public static saveBoardIds(boardIds: string[]): void {
        console.warn('⚠️ saveBoardIds() deprecated - Board IDs are auto-discovered from localStorage keys!');
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
            lastAccessedAt: data.lastAccessedAt, // ✅ NEW (REFACTORING): Load from board
            hasUnseenChanges: data.hasUnseenChanges ?? false, // ✅ NEW (REFACTORING): Load from board
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
     * ✅ REFACTORING (10. Nov 2025): Load metadata from boards directly
     * 
     * ALTE METHODE: Liest aus kanban-boards-metadata
     * NEUE METHODE: Lädt Header-Daten direkt aus jedem Board
     * 
     * Performance: Nur Header-Daten laden (nicht columns/cards)
     * Single Source of Truth: Boards enthalten ihre eigenen Metadaten
     */
    public static getAllBoardsMetadata(boardIds: string[]): Array<{ 
        id: string; 
        name: string; 
        description?: string; 
        createdAt: number; 
        updatedAt?: number;
        lastAccessed?: number; // ✅ NEW: From board.lastAccessedAt
        hasUnseenChanges?: boolean; // ✅ NEW: From board.hasUnseenChanges
        author?: string;
        publishState?: string;
    }> {
        if (typeof window === 'undefined') return [];
        
        // ✅ Filter out invalid IDs (undefined, null, empty strings)
        const validIds = boardIds.filter(id => id && typeof id === 'string' && id.length > 0);
        
        const boards = validIds.map(id => {
            try {
                const boardKey = `kanban-${id}`;
                const stored = localStorage.getItem(boardKey);
                
                if (!stored) {
                    console.warn(`⚠️ Board ${id} nicht gefunden in localStorage`);
                    return null;
                }
                
                const boardData = JSON.parse(stored);
                
                // ✅ Parse timestamps correctly
                const parseTimestamp = (value: any): number => {
                    if (!value) return 0;
                    if (typeof value === 'number') return value;
                    if (typeof value === 'string') {
                        const parsed = new Date(value).getTime();
                        return isNaN(parsed) ? 0 : parsed;
                    }
                    return 0;
                };
                
                // Return LIGHTWEIGHT metadata (no columns/cards!)
                return {
                    id: boardData.id,
                    name: boardData.name || 'Unbenanntes Board',
                    description: boardData.description || '',
                    createdAt: parseTimestamp(boardData.createdAt) || Date.now(),
                    updatedAt: parseTimestamp(boardData.updatedAt),
                    lastAccessed: parseTimestamp(boardData.lastAccessedAt), // ✅ From board!
                    hasUnseenChanges: boardData.hasUnseenChanges ?? false,  // ✅ From board!
                    author: boardData.author,
                    publishState: boardData.publishState
                };
                
            } catch (error) {
                console.error(`❌ Fehler beim Laden von Board ${id}:`, error);
                return null;
            }
        }).filter(meta => meta !== null) as Array<{
            id: string;
            name: string;
            description?: string;
            createdAt: number;
            updatedAt?: number;
            lastAccessed?: number;
            hasUnseenChanges?: boolean;
            author?: string;
            publishState?: string;
        }>;
        
        // Sort by lastAccessed (most recent first)
        return boards.sort((a, b) => (b.lastAccessed || b.updatedAt || 0) - (a.lastAccessed || a.updatedAt || 0));
    }
}
