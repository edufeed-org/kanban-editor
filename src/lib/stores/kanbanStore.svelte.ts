// src/lib/stores/kanbanStore.svelte.ts

import { Board, Chat, type CardProps, type ColumnProps, type PublishState } from '../classes/BoardModel.js';

// UI-Typen importieren für Kompatibilität mit bestehenden Komponenten
export type CardItem = {
    id: number | string;
    name: string;
    description?: string;
    comments?: any[];
    attendees?: string[];
    labels?: string[];
    color?: string;
    publishState?: PublishState;
    author?: string;
    image?: string;
    link?: string;
    columnId?: string;
    boardId?: string;
};

export type UIColumn = {
    id: string;
    name: string;
    description?: string;
    color?: string;
    items: CardItem[];
};

// ============================================================================
// BOARD STORE (SVELTE 5 RUNES)
// ============================================================================

export class BoardStore {
    private static STORAGE_KEY = 'kanban-board-data';
    
    // Die Board-Instanz als reaktiver Zustand (Svelte 5 Rune)
    private board = $state(this.loadFromStorage());

    // Separate Spalten-Reihenfolge (wird nicht mutiert, nur replace)
    private _columnOrder = $state<string[]>(this.board.columns.map(c => c.id));

    // Trigger für Reaktivität - wird bei jeder Änderung inkrementiert
    private updateTrigger = $state(0);

    // Öffentliche getter-Funktion, um die Board-Daten reaktiv abzurufen
    public get data() {
        // Zugriff auf updateTrigger sorgt für Reaktivität
        this.updateTrigger;
        return this.board;
    }

    // ============================================================================
    // REAKTIVES UI-INTERFACE (für bestehende Komponenten)
    // ============================================================================

    // Konvertiert Board-Daten zu UI-kompatiblem Format (reaktiv via $derived)
    public uiData = $derived.by(() => {
        // WICHTIG: Direkter Zugriff auf this.board.columns für Reaktivität!
        // (nicht nur updateTrigger - Svelte 5 muss das Arrays Property tracking sehen)
        const columns = this.board.columns; // ← Direkter Zugriff triggert Tracking
        const columnOrder = this._columnOrder;
        const trigger = this.updateTrigger; // ← Auch updateTrigger als Fallback
        
        console.log('🔄 uiData wird neu berechnet...', columns.length, 'Spalten, trigger:', trigger);
        
        // Erstelle eine Map für schnellen Zugriff
        const columnMap = new Map(columns.map(c => [c.id, c]));
        
        // Nutze _columnOrder für die Reihenfolge
        const result: UIColumn[] = [];
        for (const colId of columnOrder) {
            const column = columnMap.get(colId);
            if (column) {
                result.push({
                    id: column.id,
                    name: column.name,
                    color: column.color,
                    items: column.cards.map(card => ({
                        id: card.id,
                        name: card.heading,
                        description: card.content,
                        comments: card.comments,
                        attendees: card.attendees,
                        labels: card.labels,
                        color: card.color,
                        publishState: card.publishState,
                        author: card.author || card.attendees?.[0], // author oder erster Attendee
                        columnId: column.id,
                        boardId: this.board.id
                    }))
                });
            }
        }
        
        return result;
    });

    // ============================================================================
    // PRIVATE HELPER
    // ============================================================================

    private loadFromStorage(): Board {
        if (typeof window === 'undefined') {
            // SSR fallback
            return this.createDefaultBoard();
        }
        
        try {
            const stored = localStorage.getItem(BoardStore.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                console.log('📂 Board aus localStorage geladen:', data.name);
                
                // Rekonstruiere Board-Instanz aus JSON-Daten
                return this.reconstructBoard(data);
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden aus localStorage:', error);
        }
        
        return this.createDefaultBoard();
    }

    private reconstructBoard(data: any): Board {
        // Erstelle Board-Instanz mit rekonstruierten Columns/Cards
        const boardProps = {
            id: data.id,
            name: data.name,
            description: data.description,
            publishState: data.publishState,
            author: data.author,
            columns: data.columns?.map((colData: any) => ({
                id: colData.id,
                name: colData.name,
                color: colData.color,
                cards: colData.cards?.map((cardData: any) => ({
                    id: cardData.id,
                    heading: cardData.heading,
                    content: cardData.content,
                    color: cardData.color,
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

    private createDefaultBoard(): Board {
        return new Board({
            name: 'Mein KI Kanban Board',
            description: 'Ein intelligentes Kanban-Board mit KI-Unterstützung',
            columns: [
                { name: 'To Do', color: 'color-gradient-1' },
                { name: 'In Progress', color: 'color-gradient-2' },
                { name: 'Done', color: 'color-gradient-3' }
            ]
        });
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        
        try {
            const data = this.board.getContextData(true);
            localStorage.setItem(BoardStore.STORAGE_KEY, JSON.stringify(data));
            console.log('💾 Board in localStorage gespeichert');
        } catch (error) {
            console.warn('⚠️ Fehler beim Speichern in localStorage:', error);
        }
    }

    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage(); // Automatisch speichern bei jeder Änderung
        console.log('🔄 Update triggered:', this.updateTrigger);
    }

    // ============================================================================
    // PROXY-METHODEN FÜR BOARD-OPERATIONEN
    // ============================================================================

    public setPublishState(state: PublishState): void {
        this.board.setPublishState(state);
    }

    public addColumn(props: ColumnProps) {
        const column = this.board.addColumn(props);
        // WICHTIG: _columnOrder muss aktualisiert werden!
        // Sonst wird die neue Spalte von uiData nicht berücksichtigt (weil $derived.by nach _columnOrder filtert)
        this._columnOrder = [...this._columnOrder, column.id];
        return column;
    }

    public deleteColumn(columnId: string): void {
        this.board.deleteColumn(columnId);
        // WICHTIG: _columnOrder muss aktualisiert werden!
        this._columnOrder = this._columnOrder.filter(id => id !== columnId);
    }

    public findColumn(columnId: string) {
        return this.board.findColumn(columnId);
    }

    public findCardAndColumn(cardId: string) {
        return this.board.findCardAndColumn(cardId);
    }

    public moveCard(cardId: string, fromColId: string, toColId: string): void {
        this.board.moveCard(cardId, fromColId, toColId);
        this.triggerUpdate(); // Trigger Reaktivität
        // Nach einer Änderung sollte hier der Nostr-Publish-Befehl folgen
        this.publishToNostr();
    }

    public addCard(columnId: string, props: CardProps) {
        const column = this.board.findColumn(columnId);
        if (column) {
            const card = column.addCard(props);
            this.triggerUpdate(); // Trigger Reaktivität
            this.publishToNostr();
            return card;
        }
        throw new Error(`Column with id ${columnId} not found`);
    }

    /**
     * Upsert-Operation: Fügt Karte hinzu ODER aktualisiert sie, wenn sie bereits existiert
     * 
     * Primärer Use-Case: Nostr Events laden/synchronisieren
     * - Wenn Karte mit gleicher ID existiert → Update durchführen
     * - Wenn Karte nicht existiert → Neue Karte in targetColumnId erstellen
     * 
     * @param targetColumnId - Spalte, in die neue Karten aufgenommen werden
     * @param props - Die Kartendaten (MUSS eine ID haben!)
     * @returns Die neue oder aktualisierte Karte
     */
    public upsertCard(targetColumnId: string, props: CardProps) {
        if (!props.id) {
            throw new Error('upsertCard requires props.id to be set (from Nostr d-tag)');
        }

        const card = this.board.upsertCard(targetColumnId, props);
        this.triggerUpdate(); // Trigger Reaktivität
        this.publishToNostr();
        return card;
    }

    public updateCard(cardId: string, updates: Partial<CardProps>): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.update(updates);
            this.triggerUpdate(); // Trigger Reaktivität
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public deleteCard(cardId: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.column.deleteCard(cardId);
            this.triggerUpdate(); // Trigger Reaktivität
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

    public updateColumn(columnId: string, updates: { name?: string; color?: string }): void {
        const column = this.board.findColumn(columnId);
        if (column) {
            column.update(updates);
            this.triggerUpdate(); // Trigger Reaktivität
            this.publishToNostr();
        } else {
            throw new Error(`Column with id ${columnId} not found`);
        }
    }

    public deleteColumnWithCards(columnId: string): void {
        this.board.deleteColumn(columnId);
        
        // Entferne auch aus _columnOrder
        this._columnOrder = this._columnOrder.filter(id => id !== columnId);
        
        this.triggerUpdate(); // Trigger Reaktivität
        this.publishToNostr();
    }

    public deleteBoard(): void {
        // Lösche alles: Neue leere Board mit Standardspalten
        this.board = new Board({
            name: 'Neues Board',
            columns: [
                { name: 'To Do' },
                { name: 'In Progress' },
                { name: 'Done' }
            ]
        });
        
        this._columnOrder = this.board.columns.map(c => c.id);
        this.triggerUpdate(); // Trigger Reaktivität
        this.publishToNostr();
    }

    // ============================================================================
    // UI-EVENT-HANDLER (direkt von Komponenten aufrufbar)
    // ============================================================================

    /**
     * Wird von Column.svelte Footer aufgerufen: "Neue Karte" Button
     */
    public createCard(columnId: string, name: string = 'Neue Karte', description?: string): string {
        console.log('🆕 createCard aufgerufen:', { columnId, name, description });
        
        const cardProps: CardProps = {
            heading: name,
            content: description || 'Bitte bearbeiten...',
            publishState: 'draft'
        };
        
        const card = this.addCard(columnId, cardProps);
        console.log('✅ Karte erstellt:', card.id, 'Board hat jetzt', this.board.columns.flatMap(c => c.cards).length, 'Karten');
        
        // publishToNostr() wird bereits in addCard() aufgerufen
        return card.id;
    }

    /**
     * Wird von Board.svelte aufgerufen: "Neue Spalte" Button am Ende des Boards
     */
    public createColumn(name: string = 'Neue Spalte'): string {
        console.log('🆕 createColumn aufgerufen:', { name });
        
        const columnProps: ColumnProps = {
            name,
            color: 'slate'
        };
        
        // Verwende this.addColumn() (nicht this.board.addColumn()) damit _columnOrder aktualisiert wird
        const column = this.addColumn(columnProps);
        
        this.triggerUpdate(); // Trigger Reaktivität
        this.publishToNostr();
        
        console.log('✅ Spalte erstellt:', column.id, 'Board hat jetzt', this.board.columns.length, 'Spalten');
        return column.id;
    }

    /**
     * Wird von DnD-Handlern aufgerufen: Karte zwischen Spalten verschieben
     */
    public handleCardMove(cardId: string, fromColumnId: string, toColumnId: string): void {
        // Nur bewegen wenn sich die Spalte tatsächlich geändert hat
        if (fromColumnId !== toColumnId) {
            this.moveCard(cardId, fromColumnId, toColumnId);
        }
    }

    /**
     * Wird von Board.svelte aufgerufen: Spalten reordern (DnD)
     * @param reorderedColumns - Die neu angeordneten Spalten aus der UI
     */
    public reorderColumns(reorderedColumns: UIColumn[]): void {
        console.log('🔄 reorderColumns aufgerufen mit', reorderedColumns.length, 'Spalten');
        
        // Aktualisiere die interne Reihenfolge der Spalten
        // Die reorderedColumns enthalten die UIColumn-Struktur mit allen Karten
        // Wir müssen die Board.columns mit den neuen Positions-IDs aktualisieren
        
        const newColumnOrder = reorderedColumns.map(col => col.id);
        console.log('  Neue Reihenfolge:', newColumnOrder);
        
        // Sortiere board.columns nach der neuen Reihenfolge
        this.board.columns.sort((a, b) => {
            const indexA = newColumnOrder.indexOf(a.id);
            const indexB = newColumnOrder.indexOf(b.id);
            return indexA - indexB;
        });
        
        // Trigger Reaktivität und speichern
        this.triggerUpdate();
        this.publishToNostr();
    }

    /**
     * Vollständige Synchronisierung: Spalten-Reihenfolge UND Karten-Positionen
     * @param uiColumns - Komplettes Update mit neuer Spalten- und Karten-Reihenfolge
     */
    public syncBoardState(uiColumns: UIColumn[]): void {
        console.log('🔄 syncBoardState - Synchronisiere Spalten UND Karten');
        console.log('  UI-Spalten:', uiColumns.length);
        
        // SCHRITT 1: Spalten-Reihenfolge
        const newColumnOrder = uiColumns.map(c => c.id);
        this._columnOrder = newColumnOrder;
        
        // SCHRITT 2: Reordne board.columns
        const columnMap = new Map(this.board.columns.map(c => [c.id, c]));
        const reorderedColumns: typeof this.board.columns = [];
        for (const colId of newColumnOrder) {
            const col = columnMap.get(colId);
            if (col) {
                reorderedColumns.push(col);
            }
        }
        this.board.columns = reorderedColumns;
        
        // SCHRITT 3: Karten-Positionen synchronisieren
        // Für jede Spalte in der UI: Aktualisiere die Karten-Reihenfolge und Position
        for (const uiColumn of uiColumns) {
            const boardColumn = this.board.findColumn(uiColumn.id);
            if (!boardColumn) continue;
            
            // Erstelle eine Map der Karten-IDs für schnellen Zugriff
            const cardMap = new Map(boardColumn.cards.map(c => [c.id, c]));
            
            // Reordne die Karten basierend auf der UI-Reihenfolge
            const reorderedCards: typeof boardColumn.cards = [];
            for (const uiCard of uiColumn.items) {
                const cardIdStr = String(uiCard.id);
                
                // Prüfe ob die Karte bereits in dieser Spalte ist
                let card = cardMap.get(cardIdStr);
                
                if (!card) {
                    // Karte ist woanders - suche sie im gesamten Board
                    const result = this.board.findCardAndColumn(cardIdStr);
                    if (result && result.column.id !== uiColumn.id) {
                        // Karte muss von anderer Spalte verschoben werden
                        console.log(`  📍 Verschiebe Karte ${cardIdStr} von ${result.column.id} nach ${uiColumn.id}`);
                        result.column.deleteCard(cardIdStr);
                        boardColumn.appendCard(result.card);
                        card = result.card;
                    }
                }
                
                if (card) {
                    reorderedCards.push(card);
                }
            }
            
            // Setze die neue Karten-Reihenfolge
            boardColumn.cards = reorderedCards;
        }
        
        console.log('  ✓ Board-State synchronisiert');
        
        this.triggerUpdate();
        this.publishToNostr();
    }

    /**
     * Wird von UI aufgerufen: Karte löschen
     */
    public removeCard(cardId: string): void {
        this.deleteCard(cardId);
    }

    /**
     * Wird von UI aufgerufen: Kartendetails bearbeiten  
     */
    public editCard(cardId: string, updates: { name?: string; description?: string; color?: string; labels?: string[] }): void {
        const cardProps: Partial<CardProps> = {};
        if (updates.name !== undefined) cardProps.heading = updates.name;
        if (updates.description !== undefined) cardProps.content = updates.description;
        if (updates.color !== undefined) cardProps.color = updates.color;
        if (updates.labels !== undefined) cardProps.labels = updates.labels;
        
        this.updateCard(cardId, cardProps);
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
        
        // Lokale Persistierung als Fallback
        this.saveToStorage();
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

// Hilfsfunktion für Card-Operationen
export function getCardById(cardId: string) {
    return boardStore.findCardAndColumn(cardId);
}

// Hilfsfunktion für Column-Operationen
export function getColumnById(columnId: string) {
    return boardStore.findColumn(columnId);
}