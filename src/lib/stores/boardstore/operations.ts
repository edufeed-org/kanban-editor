// src/lib/stores/boardstore/operations.ts
// Board-Operationen (CRUD für Columns/Cards)

import { Board, Column, Card, type CardProps, type ColumnProps } from '../../classes/BoardModel.js';
import { generateDTag } from '../../utils/idGenerator.js';
import type { CardItem, UIColumn } from './types.js';
import type { NostrIntegration } from './nostr.js';

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
    public static async deleteCard(
        board: Board,
        cardId: string,
        nostrIntegration?: NostrIntegration
    ): Promise<boolean> {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.error(`❌ Karte ${cardId} nicht gefunden`);
            return false;
        }

        // 1. Lokal löschen
        result.column.deleteCard(cardId);
        console.log(`✅ Karte gelöscht: ${cardId}`);
        
        // 2. Auf Nostr löschen (NIP-09 Deletion Event)
        if (nostrIntegration && result.card) {
            try {
                await nostrIntegration.deleteCard(result.card);
                console.log(`🛰️ Card deletion event published to Nostr`);
            } catch (error) {
                console.error('❌ Fehler beim Publizieren des Card-Deletion-Events:', error);
            }
        }
        
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
        console.group('🔄 syncBoardState');
        console.log('Input:', {
            oldColumnCount: board.columns.length,
            newColumnCount: uiColumns.length,
            totalCardsInUI: uiColumns.reduce((sum, col) => sum + col.items.length, 0)
        });

        // 1. Build Map: Card-ID → Card Instance + old position (SNAPSHOT bevor wir Columns modifizieren!)
        const cardRegistry = new Map<string, { card: Card; oldColumnId: string; oldRank: number }>();
        for (const col of board.columns) {
            for (let i = 0; i < col.cards.length; i++) {
                const card = col.cards[i];
                cardRegistry.set(card.id, { card, oldColumnId: col.id, oldRank: i });
            }
        }
        console.log('Card registry:', cardRegistry.size, 'cards');

        // 2. Update column order
        const newColumnOrder = uiColumns.map(c => c.id);

        // 3. Reorder board.columns UND rebuild card arrays
        const reorderedColumns: Column[] = [];
        const movedCardIds: string[] = [];
        const processedCardIds = new Set<string>(); // Duplikate-Prevention

        for (const uiCol of uiColumns) {
            const col = board.columns.find(c => c.id === uiCol.id);
            if (!col) {
                console.warn(`⚠️ Column ${uiCol.id} nicht gefunden`);
                continue;
            }

            // Rebuild card array für diese Column
            const newCards: Card[] = [];
            for (let newRank = 0; newRank < uiCol.items.length; newRank++) {
                const uiCard = uiCol.items[newRank];
                const cardId = String(uiCard.id);
                
                // Duplikate vermeiden
                if (processedCardIds.has(cardId)) {
                    console.warn(`⚠️ DUPLIKAT ignoriert: Card ${cardId} bereits in anderer Column`);
                    continue;
                }
                
                // Hole Card aus SNAPSHOT (nicht aus board.columns!)
                const snapshot = cardRegistry.get(cardId);
                if (snapshot) {
                    const { card, oldColumnId, oldRank } = snapshot;
                    
                    // Move Detection: Column ODER Position hat sich geändert
                    const columnChanged = oldColumnId !== col.id;
                    const positionChanged = oldRank !== newRank;
                    
                    if (columnChanged || positionChanged) {
                        movedCardIds.push(card.id);
                        if (columnChanged) {
                            console.log(`  ↗️ Card "${card.heading}" verschoben: "${oldColumnId}" → "${col.id}"`);
                        } else {
                            console.log(`  🔄 Card "${card.heading}" Position geändert: Rank ${oldRank} → ${newRank} (Column: "${col.name}")`);
                        }
                    }
                    
                    newCards.push(card);
                    processedCardIds.add(cardId);
                } else {
                    console.warn(`⚠️ Card ${cardId} nicht im Snapshot gefunden`);
                }
            }
            
            console.log(`  Column "${col.name}": ${newCards.length} cards`);
            col.cards = newCards;
            reorderedColumns.push(col);
        }

        board.columns = reorderedColumns;

        console.log('Result:', {
            movedCards: movedCardIds.length,
            totalCardsProcessed: processedCardIds.size,
            finalColumnCount: board.columns.length
        });
        console.groupEnd();

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

    // ========================================
    // SECONDARY ACTIONS (Nostr Event-Driven)
    // ========================================

    /**
     * ⚡ SEKUNDÄR: Card von Nostr-Event erstellen/updaten
     * KEIN Publish zu Nostr (wird von triggerUpdate mit publish: false aufgerufen)
     * 
     * @param board - Aktuelles Board
     * @param cardProps - Card-Daten aus nostrEventToCard()
     * @returns true wenn erfolgreich
     */
    public static upsertCardFromNostr(
        board: Board,
        cardProps: CardProps
    ): boolean {
        console.log(`📥 upsertCardFromNostr: ${cardProps.heading || cardProps.id}`);
        
        // 1. Find target column
        // cardProps sollte columnId haben (aus Event deserialisiert)
        const columnId = (cardProps as any).columnId;
        if (!columnId) {
            console.warn(`⚠️ Card ${cardProps.id} hat keine columnId - skip`);
            return false;
        }
        
        const column = board.findColumn(columnId);
        if (!column) {
            console.warn(`⚠️ Column ${columnId} not found for card ${cardProps.id}`);
            return false;
        }
        
        // ⚡ v4.3: Remove card from OLD column if it moved (prevents duplication)
        // Search ALL columns except target column for the card
        for (const col of board.columns) {
            if (col.id === columnId) continue; // Skip target column
            
            const oldCardIndex = col.cards.findIndex(c => c.id === cardProps.id);
            if (oldCardIndex >= 0) {
                console.log(`🔄 Card ${cardProps.id} moved from column ${col.id} → ${columnId}`);
                col.cards.splice(oldCardIndex, 1); // Remove from old column
                break; // Card can only be in one column at a time
            }
        }
        
        // 2. Check if card exists
        const existingCard = column.findCard(cardProps.id!);
        
        if (existingCard) {
            // Update existing card
            existingCard.update(cardProps);
            console.log(`🔄 Updated card ${cardProps.id} from Nostr`);
            
            // ⚡ v4.3: Handle rank (position) change
            // If card exists AND has a rank, ensure it's at correct position
            if (cardProps.rank !== undefined) {
                const currentIndex = column.cards.findIndex(c => c.id === cardProps.id);
                const targetIndex = cardProps.rank;
                
                if (currentIndex !== targetIndex && targetIndex >= 0 && targetIndex < column.cards.length) {
                    // Move card to correct position
                    const [movedCard] = column.cards.splice(currentIndex, 1);
                    column.cards.splice(targetIndex, 0, movedCard);
                    console.log(`  📍 Card repositioned: index ${currentIndex} → ${targetIndex} (rank: ${cardProps.rank})`);
                }
            }
        } else {
            // Create new card
            // ⚡ v4.3: Insert at correct rank position if provided
            if (cardProps.rank !== undefined && cardProps.rank >= 0 && cardProps.rank <= column.cards.length) {
                // Insert at specific position
                const newCard = new Card(cardProps);
                column.cards.splice(cardProps.rank, 0, newCard);
                console.log(`✨ Created new card ${cardProps.id} at rank ${cardProps.rank}`);
            } else {
                // Fallback: Add at end
                column.addCard(cardProps);
                console.log(`✨ Created new card ${cardProps.id} (no rank - added at end)`);
            }
        }
        
        return true;
    }

    /**
     * ⚡ SEKUNDÄR: Card von Nostr-Event löschen
     * KEIN Publish zu Nostr (wird von triggerUpdate mit publish: false aufgerufen)
     * 
     * @param board - Aktuelles Board
     * @param cardId - ID der zu löschenden Card
     * @returns true wenn Card gefunden und gelöscht
     */
    public static deleteCardFromNostr(
        board: Board,
        cardId: string
    ): boolean {
        console.log(`🗑️ deleteCardFromNostr: ${cardId}`);
        
        for (const column of board.columns) {
            const card = column.findCard(cardId);
            
            if (card) {
                column.deleteCard(cardId);
                console.log(`✅ Deleted card ${cardId} from Nostr event`);
                return true;
            }
        }
        
        console.warn(`⚠️ Card ${cardId} not found in any column`);
        return false;
    }

    /**
     * ⚡ SEKUNDÄR: Board von Nostr-Event löschen
     * KEIN Publish zu Nostr (wird von triggerUpdate mit publish: false aufgerufen)
     * 
     * @param boardId - ID des zu löschenden Boards
     * @returns true wenn Board aus Liste entfernt wurde
     */
    public static deleteBoardFromNostr(boardId: string): boolean {
        if (typeof window === 'undefined') {
            console.warn('⚠️ localStorage not available (SSR?)');
            return false;
        }
        
        console.log(`🗑️ deleteBoardFromNostr: ${boardId}`);
        
        // Lade Board-Liste aus localStorage
        const boardListKey = 'kanban-boards-metadata';
        const stored = localStorage.getItem(boardListKey);
        
        if (!stored) {
            console.warn(`⚠️ No board metadata list found in localStorage`);
            return false;
        }
        
        try {
            const boardList = JSON.parse(stored);
            const initialLength = boardList.length;
            
            // Filter Board aus Liste
            const newBoardList = boardList.filter((b: any) => b.id !== boardId);
            
            if (newBoardList.length < initialLength) {
                // Board wurde gefunden und entfernt
                localStorage.setItem(boardListKey, JSON.stringify(newBoardList));
                console.log(`✅ Board ${boardId} removed from metadata list`);
                return true;
            } else {
                console.warn(`⚠️ Board ${boardId} not found in metadata list`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error deleting board from metadata list:`, error);
            return false;
        }
    }

    /**
     * ⚡ SEKUNDÄR: Board von Nostr-Event erstellen/updaten
     * KEIN Publish zu Nostr
     * 
     * Wird aufgerufen für:
     * - Neue Boards von anderen Usern (kollaboratives Erstellen) ✨
     * - Updates auf Board-Metadaten (Name, Description, Tags) 📝
     * - Updates auf Spalten-Struktur (Reihenfolge, Namen, Farben) 🔄
     * 
     * @param currentBoard - Aktuell geladenes Board
     * @param boardProps - Board-Daten aus nostrEventToBoard()
     * @returns true wenn UPDATE, false wenn INSERT (neues Board)
     */
    public static upsertBoardFromNostr(
        currentBoard: Board,
        boardProps: { 
            id: string; 
            name: string; 
            description?: string; 
            tags?: string[];
            columns?: Array<{ id: string; name: string; color?: string }>;
            author?: string;
            publishState?: string;
            updatedAt?: string;
        }
    ): boolean {
        console.log(`📥 upsertBoardFromNostr: ${boardProps.name || boardProps.id}`);
        
        // 1. Prüfe: Ist das Board bereits geladen?
        const isCurrentBoard = currentBoard.id === boardProps.id;
        
        if (isCurrentBoard) {
            // UPDATE: Metadaten + Spalten-Struktur des aktuellen Boards
            console.log(`📝 Updating current board from Nostr: ${boardProps.name}`);
            
            // 1. Update Board-Metadaten
            currentBoard.name = boardProps.name;
            currentBoard.description = boardProps.description || '';
            currentBoard.tags = boardProps.tags || [];
            
            // ⚡ KRITISCH: Author MUSS synchronisiert werden!
            // Sonst stimmt boardRef nicht (30301:author:id)
            if (boardProps.author) {
                currentBoard.author = boardProps.author;
            }
            
            // ⚡ v4.0: CRITICAL: updatedAt synchronisieren!
            // Für Last-Write-Wins Vergleich muss Timestamp aktualisiert werden
            if (boardProps.updatedAt) {
                currentBoard.updatedAt = boardProps.updatedAt;
                console.log(`📅 Updated timestamp from Nostr: ${boardProps.updatedAt}`);
            }
            
            // 2. ⚡ NEU: Spalten-Synchronisation (Reihenfolge + Metadaten)
            if (boardProps.columns && boardProps.columns.length > 0) {
                // Erstelle Map: columnId → Column-Instanz
                const existingColumnsMap = new Map(
                    currentBoard.columns.map(c => [c.id, c])
                );
                
                // ⚡ CRITICAL: Prüfe ob Reihenfolge bereits gleich ist
                const currentOrder = currentBoard.columns.map(c => c.id);
                const nostrOrder = boardProps.columns.map(c => c.id);
                const isSameOrder = JSON.stringify(currentOrder) === JSON.stringify(nostrOrder);
                
                // Reorder columns basierend auf boardProps
                const newColumnOrder: Column[] = [];
                
                for (const colProps of boardProps.columns) {
                    const existingCol = existingColumnsMap.get(colProps.id);
                    
                    if (existingCol) {
                        // Spalte existiert → Update Metadaten (Name, Farbe)
                        existingCol.name = colProps.name;
                        existingCol.color = colProps.color || existingCol.color;
                        newColumnOrder.push(existingCol);
                    } else {
                        // Spalte existiert nicht → Neue Spalte erstellen
                        // (Sollte selten vorkommen - neue Spalten via separates Event)
                        const newCol = new Column(colProps);
                        newColumnOrder.push(newCol);
                        console.log(`➕ New column added from Nostr: ${colProps.name}`);
                    }
                }
                
                // ⚡ CRITICAL: Nur reassignieren wenn Reihenfolge geändert!
                // Sonst triggert unnötige UI-Update (Double-Move Bug)
                if (!isSameOrder) {
                    currentBoard.columns = newColumnOrder;
                    console.log(`🔄 Synchronized ${newColumnOrder.length} columns from Nostr`);
                } else {
                    // ⚡ Spalten gleich, aber Metadaten (Name, Farbe) könnte geändert sein
                    console.log(`✅ Columns already in correct order, skip reassignment (metadata only)`);
                }
            }
            
            return true; // = UPDATE
        } else {
            // INSERT: Neues Board zur Liste hinzufügen
            console.log(`✨ New board detected from Nostr: ${boardProps.name}`);
            
            // Speichere Board-Metadaten in localStorage
            // (NICHT das komplette Board laden - das passiert bei loadBoard())
            const metadata = {
                id: boardProps.id,
                name: boardProps.name,
                description: boardProps.description || '',
                lastAccessed: boardProps.updatedAt || new Date().toISOString(),
                author: boardProps.author || '',
                publishState: boardProps.publishState || 'draft'
            };
            
            // Füge zur Board-Liste hinzu
            BoardOperations.addBoardToMetadataList(metadata);
            
            // Optional: Toast-Notification für User
            console.log(`🔔 Neues Board verfügbar: "${boardProps.name}"`);
            
            // ⚡ KRITISCH: Reaktivität triggern!
            // 1. Board-IDs neu laden (wurde von addBoardToMetadataList aktualisiert)
            // 2. triggerUpdate() für UI-Update
            // (Wird im Wrapper kanbanStore.upsertBoardFromNostr() gemacht)
            
            return false; // = INSERT
        }
    }

    /**
     * ⚡ HELPER: Fügt Board-Metadaten zur Liste hinzu
     * OHNE das komplette Board zu laden
     * 
     * @param metadata - Board-Metadaten (für Sidebar-Liste)
     */
    private static addBoardToMetadataList(metadata: {
        id: string;
        name: string;
        description: string;
        lastAccessed: string;
        author: string;
        publishState: string;
        hasUnseenChanges?: boolean; // ← NEU: Flag für ungesehene Änderungen
    }): void {
        if (typeof window === 'undefined') {
            console.warn('⚠️ localStorage not available (SSR?)');
            return;
        }
        
        /**
         * ⚡ REFACTORING (9. Nov 2025): SINGLE SOURCE OF TRUTH
         * 
         * Nur kanban-boards-metadata wird aktualisiert.
         * kanban-boards-list wurde komplett eliminiert.
         * loadBoardIds() lädt jetzt direkt aus Metadaten!
         */
        
        const metadataKey = 'kanban-boards-metadata';
        const stored = localStorage.getItem(metadataKey);
        const boardList = stored ? JSON.parse(stored) : [];
        
        // Prüfe: Board bereits in Liste?
        const existingIndex = boardList.findIndex((b: any) => b.id === metadata.id);
        
        if (existingIndex >= 0) {
            // Update existing entry (preserve hasUnseenChanges wenn nicht explizit gesetzt)
            boardList[existingIndex] = { 
                ...boardList[existingIndex], 
                ...metadata,
                // Wenn hasUnseenChanges nicht explizit im Update ist, behalte alten Wert
                hasUnseenChanges: metadata.hasUnseenChanges !== undefined 
                    ? metadata.hasUnseenChanges 
                    : boardList[existingIndex].hasUnseenChanges || false
            };
            console.log(`🔄 Updated metadata for board ${metadata.id}`);
        } else {
            // Add new entry mit Default hasUnseenChanges: false
            boardList.push({ ...metadata, hasUnseenChanges: metadata.hasUnseenChanges || false });
            console.log(`➕ Added new board to metadata list: ${metadata.name}`);
        }
        
        // Speichere aktualisierte Metadata-Liste
        localStorage.setItem(metadataKey, JSON.stringify(boardList));
    }

    /**
     * Setzt hasUnseenChanges-Flag für ein Board
     * 
     * ⚡ Called from: nostr.ts handleBoardEvent() / handleCardEvent()
     * 
     * @param boardId - Board ID
     * @param value - true = Board hat unsichtbare Änderungen, false = keine
     */
    public static setHasUnseenChanges(boardId: string, value: boolean): void {
        if (typeof window === 'undefined') return;
        
        const metadataKey = 'kanban-boards-metadata';
        const stored = localStorage.getItem(metadataKey);
        if (!stored) {
            console.warn(`⚠️ Keine Metadata gefunden für setHasUnseenChanges`);
            return;
        }
        
        try {
            const boardList = JSON.parse(stored);
            const boardIndex = boardList.findIndex((b: any) => b.id === boardId);
            
            if (boardIndex >= 0) {
                boardList[boardIndex].hasUnseenChanges = value;
                localStorage.setItem(metadataKey, JSON.stringify(boardList));
                console.log(`🔔 hasUnseenChanges=${value} für Board ${boardId.substring(0, 20)}...`);
            } else {
                console.warn(`⚠️ Board ${boardId} nicht in Metadata gefunden`);
            }
        } catch (e) {
            console.warn('⚠️ Error setting hasUnseenChanges:', e);
        }
    }

    /**
     * Löscht hasUnseenChanges-Flag für ein Board
     * 
     * ⚡ Called from: kanbanStore.loadBoard()
     * 
     * @param boardId - Board ID
     */
    public static clearHasUnseenChanges(boardId: string): void {
        BoardOperations.setHasUnseenChanges(boardId, false);
    }
}
