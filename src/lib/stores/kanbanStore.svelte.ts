// src/lib/stores/kanbanStore.svelte.ts

import { Board, Chat, type CardProps, type ColumnProps, type PublishState } from '../classes/BoardModel.js';
import { generateTimestamp } from '../utils/idGenerator.js';
import { authStore } from './authStore.svelte.js';

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
    private static BOARDS_LIST_KEY = 'kanban-boards-list'; // Schlüssel für Liste aller Board-IDs
    
    // Die Board-Instanz als reaktiver Zustand (Svelte 5 Rune)
    private board = $state(this.loadFromStorage());
    
    // 🔥 NEUE: Liste aller Board-IDs (für Multi-Board-Verwaltung)
    private boardIds = $state<string[]>(this.loadBoardIds());

    // Separate Spalten-Reihenfolge (wird nicht mutiert, nur replace)
    private _columnOrder = $state<string[]>(this.board.columns.map(c => c.id));

    // Trigger für Reaktivität - wird bei jeder Änderung inkrementiert
    // PUBLIC: Wird von Components gelesen als $derived-Abhängigkeit
    public updateTrigger = $state(0);

    constructor() {
        // KRITISCH: Wenn das Board nicht in der Liste ist, füge es hinzu!
        // (Das passiert beim ersten Laden wenn ein Default Board erstellt wird)
        if (typeof window !== 'undefined') {
            const currentBoardId = this.board.id;
            if (!this.boardIds.includes(currentBoardId)) {
                console.log('🔥 Erstes Laden: Füge Default Board zur Liste hinzu:', currentBoardId);
                this.boardIds = [...this.boardIds, currentBoardId];
                this.saveBoardIds();
                
                // Speichere auch das Default Board selbst
                this.saveToStorage();
            }
            
            // 🔥 DEBUGGING: Speichere die aktuelle Board-ID im window für Console-Tests
            this.exposeCurrentBoardIdToWindow();
        }
    }

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
        
        // 🔥 WICHTIG: Auch alle card.comments Arrays direkt lesen!
        // Das garantiert, dass Änderungen an comments die Ableitung triggern
        columns.forEach(col => {
            col.cards.forEach(card => {
                // Direkter Zugriff auf comments für Dependency Tracking
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _ = card.comments;
            });
        });
        
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
                            image: card.image,
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

    // 🔥 WICHTIG: Reaktive Board-Metadaten für Topbar und andere Komponenten
    // Diese $derived wird neu berechnet sobald board.name oder board.description sich ändern
    public boardMeta = $derived({
        id: this.board.id,
        name: this.board.name,
        description: this.board.description,
        trigger: this.updateTrigger  // Auch updateTrigger als Fallback-Dependency
    });

    // ============================================================================
    // PRIVATE HELPER
    // ============================================================================

    /**
     * 🔥 DEBUGGING: Speichert die aktuelle Board-ID im window-Objekt
     * Ermöglicht einfache Console-Tests: 
     * JSON.parse(localStorage.getItem('CURRENT_KANBAN_BOARD_STORAGE_ID'))
     */
    private exposeCurrentBoardIdToWindow(): void {
        if (typeof window === 'undefined') return;
        
        const boardId = this.board.id;
        (window as any).CURRENT_KANBAN_BOARD_ID = boardId;
        (window as any).CURRENT_KANBAN_BOARD_STORAGE_ID = 'kanban-'+boardId;
        
        console.log(`✅ Board-ID verfügbar: window.CURRENT_KANBAN_BOARD_ID = "${boardId}"`);
        console.log('📊 localStorage testen:');
        console.log(`   JSON.parse(localStorage.getItem('CURRENT_KANBAN_BOARD_STORAGE_ID'))`);
    }

    private loadBoardIds(): string[] {
        if (typeof window === 'undefined') return [];
        
        try {
            const stored = localStorage.getItem(BoardStore.BOARDS_LIST_KEY);
            if (stored) {
                const ids = JSON.parse(stored);
                console.log('📋 Board-IDs geladen:', ids);
                return ids;
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden der Board-IDs:', error);
        }
        
        // Neue App - keine alten Boards zu migrieren
        return [];
    }

    private saveBoardIds(): void {
        if (typeof window === 'undefined') return;
        
        try {
            localStorage.setItem(BoardStore.BOARDS_LIST_KEY, JSON.stringify(this.boardIds));
            console.log('💾 Board-IDs gespeichert:', this.boardIds.length);
        } catch (error) {
            console.warn('⚠️ Fehler beim Speichern der Board-IDs:', error);
        }
    }

    private loadFromStorage(): Board {
        if (typeof window === 'undefined') {
            // SSR fallback
            return this.createDefaultBoard();
        }
        
        try {
            // Lade das zuletzt AUFGERUFENE Board aus der Board-Liste (via lastAccessedAt)
            const boardIds = this.loadBoardIds();
            
            if (boardIds.length > 0) {
                // Finde das Board mit dem neuesten lastAccessedAt (oder fallback zu updatedAt)
                let mostRecentBoardId = boardIds[0];
                let mostRecentTime = 0;
                
                console.log('🔍 Suche zuletzt aufgerufenes Board...');
                
                for (const boardId of boardIds) {
                    const stored = localStorage.getItem(`kanban-${boardId}`);
                    if (stored) {
                        try {
                            const data = JSON.parse(stored);
                            // Priorisiere lastAccessedAt für MRU-Reload (wann zuletzt geöffnet)
                            const lastAccessed = data.lastAccessedAt || data.updatedAt || data.createdAt;
                            
                            // ⚠️ WICHTIG: ISO-String zu Timestamp konvertieren für numerischen Vergleich!
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
                
                const stored = localStorage.getItem(`kanban-${mostRecentBoardId}`);
                if (stored) {
                    const data = JSON.parse(stored);
                    console.log('✅ Zuletzt aufgerufenes Board geladen:', data.name);
                    return this.reconstructBoard(data);
                }
            }
        } catch (error) {
            console.warn('⚠️ Fehler beim Laden aus localStorage:', error);
        }
        
        // Keine Boards vorhanden - erstelle Default Board
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
            tags: data.tags || [], // ← NEU: Tags laden
            ccLicense: data.ccLicense || 'cc-by-4.0', // ← NEU: License laden
            columns: data.columns?.map((colData: any) => ({
                id: colData.id,
                name: colData.name,
                color: colData.color || 'slate', // 🎯 Standardfarbe wenn keine gespeichert
                cards: colData.cards?.map((cardData: any) => ({
                    id: cardData.id,
                    heading: cardData.heading,
                    content: cardData.content,
                    image: cardData.image, // ← image MUSS hier sein!
                    color: cardData.color || 'slate', // 🎯 Standardfarbe wenn keine gespeichert
                    author: cardData.author, // ← ✅ FIXED: author hinzugefügt!
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
                { name: 'Backlog', color: 'slate' },
                { name: 'To Do', color: 'blue' },
                { name: 'In Progress', color: 'orange' },
                { name: 'Done', color: 'green' },
                { name: 'Archive', color: 'red' }
            ]
        });
    }

    private saveToStorage(): void {
        if (typeof window === 'undefined') return;
        
        try {
            const data = this.board.getContextData(true);
            // 🔥 WICHTIG: Board.id ist bereits "board-TIMESTAMP", daher nutze es direkt als Schlüssel!
            // z.B. Board.id = "board-1761035980797" → Key = "kanban-board-1761035980797"
            const storageKey = `kanban-${this.board.id}`;
            localStorage.setItem(storageKey, JSON.stringify(data));
            console.log('💾 Board in localStorage gespeichert:', storageKey);
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
    // MULTI-BOARD VERWALTUNG
    // ============================================================================

    /**
     * Gibt alle gespeicherten Boards in chronologischer Reihenfolge zurück (neueste zuerst)
     * REAKTIV: updateTrigger wird gelesen um Neuberechnung zu triggern
     */
    public getAllBoards(): Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number }> {
        // 🔥 WICHTIG: updateTrigger lesen damit Svelte diese Methode als abhängig registriert!
        const trigger = this.updateTrigger;
        // 🔥 WICHTIG: boardIds lesen damit bei Änderungen neu berechnet wird!
        const ids = this.boardIds;
        
        if (typeof window === 'undefined') return [];
        
        try {
            const boards: Array<{ id: string; name: string; description?: string; createdAt: number; updatedAt?: number }> = [];
            
            // Nutze die gespeicherte Liste statt durchsuche alle localStorage-Keys
            for (const boardId of ids) {
                // 🔥 WICHTIG: boardId ist bereits "board-...", daher nutze "kanban-..." als Key
                const storageKey = `kanban-${boardId}`;
                const stored = localStorage.getItem(storageKey);
                
                if (stored) {
                    try {
                        const data = JSON.parse(stored);
                        // updatedAt is ISO string, parse to timestamp for sorting
                        // PRIORISIERE updatedAt (wann bearbeitet) für LISTE-SORTIERUNG
                        const updatedAtTime = data.updatedAt 
                            ? new Date(data.updatedAt).getTime() 
                            : (data.createdAt || Date.now());
                        
                        boards.push({
                            id: boardId,
                            name: data.name || 'Unbenanntes Board',
                            description: data.description,
                            createdAt: data.createdAt || Date.now(),
                            updatedAt: updatedAtTime
                        });
                    } catch (e) {
                        console.warn(`⚠️ Fehler beim Parsen von Board ${boardId}:`, e);
                    }
                }
            }
            
            // Sortiere nach updatedAt (zuletzt BEARBEITETE zuerst!) - für Board-Liste Anzeige
            // WICHTIG: updatedAt != lastAccessedAt!
            //   - updatedAt = wann wurde Board GEÄNDERT (Metadata/Karten) → für Liste-Sortierung
            //   - lastAccessedAt = wann wurde Board GEÖFFNET → für Reload-MRU (in loadFromStorage)
            return boards.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (error) {
            console.error('❌ Fehler beim Laden aller Boards:', error);
            return [];
        }
    }

    /**
     * Filtert Boards nach Suchbegriff
     * REAKTIV: updateTrigger wird gelesen um Neuberechnung zu triggern
     */
    public filterBoards(searchTerm: string): Array<{ id: string; name: string; description?: string; createdAt: number }> {
        // 🔥 WICHTIG: updateTrigger lesen damit Svelte diese Methode als abhängig registriert!
        const trigger = this.updateTrigger;
        
        const allBoards = this.getAllBoards();
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) return allBoards;
        
        return allBoards.filter(board => 
            board.name.toLowerCase().includes(term) ||
            (board.description?.toLowerCase().includes(term) ?? false)
        );
    }

    /**
     * Erstellt ein neues Board mit Default-Spalten und speichert es
     */
    public createBoard(name: string = 'Neues Board'): string {
        // ✅ Nutze getUserName() für lesbare author (statt pubkey!)
        const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
        
        const newBoard = new Board({
            name,
            description: '',
            author: author, // ✅ Nutze den Namen für bessere UX!
            columns: [
                { name: 'Backlog', color: 'muted' },
                { name: 'To Do', color: 'chart-1' },
                { name: 'In Progress', color: 'chart-2' },
                { name: 'Done', color: 'chart-3' },
                { name: 'Archive', color: 'muted' }
            ]
        });
        
        // Board.id ist jetzt durch Board Constructor gesetzt (mit generateDTag('board'))
        const newBoardId = newBoard.id;
        const now = Date.now();
        
        // Speichere das neue Board als separate Einheit
        if (typeof window !== 'undefined') {
            try {
                const data = newBoard.getContextData(true);
                // @ts-ignore - Wir wissen, dass createdAt existiert, aber getContextData() gibt es nicht zurück
                data.createdAt = now;
                // 🔥 WICHTIG: Key ist "kanban-board-...", da Board.id bereits "board-..." ist
                localStorage.setItem(`kanban-${newBoardId}`, JSON.stringify(data));
                
                // 🔥 WICHTIG: Füge die Board-ID zur Liste hinzu!
                this.boardIds = [...this.boardIds, newBoardId];
                this.saveBoardIds();
                
                console.log('✅ Neues Board erstellt:', newBoardId, name);
                
                // 🔥 WICHTIG: Triggere updateTrigger damit $derived.by() in BoardsList neu berechnet wird!
                this.updateTrigger++;
                
            } catch (error) {
                console.error('❌ Fehler beim Speichern des neuen Boards:', error);
            }
        }
        
        return newBoardId;
    }

    /**
     * Lädt ein Board mit der gegebenen ID und macht es zum aktiven Board
     */
    public loadBoard(boardId: string): boolean {
        if (typeof window === 'undefined') return false;
        
        try {
            // 🔥 WICHTIG: boardId ist bereits "board-...", daher nutze "kanban-board-..." als Key
            const storageKey = `kanban-${boardId}`;
            const stored = localStorage.getItem(storageKey);
            if (!stored) {
                console.warn(`⚠️ Board ${boardId} nicht gefunden unter ${storageKey}`);
                return false;
            }
            
            const data = JSON.parse(stored);
            this.board = this.reconstructBoard(data);
            this._columnOrder = this.board.columns.map(c => c.id);
            
            // ✨ NEU: Setze lastAccessedAt auf JETZT (für MRU-Reload)
            // Nutze direkte localStorage-Update OHNE triggerUpdate() um Endlosschleife zu vermeiden
            data.lastAccessedAt = generateTimestamp();
            localStorage.setItem(storageKey, JSON.stringify(data));
            
            // 🔥 WICHTIG: Nur updateTrigger erhöhen (für UI-Reaktivität), aber NICHT saveToStorage() aufrufen!
            // Grund: saveToStorage() würde board.getContextData() nutzen, das lastAccessedAt nicht enthält
            this.updateTrigger++;
            
            console.log('✅ Board geladen:', boardId, this.board.name, '(lastAccessedAt aktualisiert)');
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Laden von Board:', boardId, error);
            return false;
        }
    }

    /**
     * Löscht ein Board mit der gegebenen ID
     */
    public deleteBoard(boardId?: string): boolean {
        const targetId = boardId || this.board.id;
        
        if (typeof window === 'undefined') return false;
        
        try {
            // 🔥 WICHTIG: targetId ist bereits "board-...", daher nutze "kanban-..." als Key
            localStorage.removeItem(`kanban-${targetId}`);
            
            // 🔥 WICHTIG: Entferne die Board-ID aus der Liste!
            this.boardIds = this.boardIds.filter(id => id !== targetId);
            this.saveBoardIds();
            
            console.log('🗑️ Board gelöscht:', targetId);
            
            // 🔥 WICHTIG: Triggere updateTrigger damit $derived.by() in BoardsList neu berechnet wird!
            this.updateTrigger++;
            
            // Wenn das aktuelle Board gelöscht wurde, lade ein anderes oder Default
            if (targetId === this.board.id) {
                const allBoards = this.getAllBoards();
                if (allBoards.length > 0) {
                    this.loadBoard(allBoards[0].id);
                } else {
                    // Keine anderen Boards, erstelle Default
                    this.board = this.createDefaultBoard();
                    this._columnOrder = this.board.columns.map(c => c.id);
                    this.triggerUpdate();
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Fehler beim Löschen von Board:', targetId, error);
            return false;
        }
    }

    /**
     * Gibt die ID des aktuellen Boards zurück
     */
    public getCurrentBoardId(): string {
        return this.board.id;
    }

    /**
     * Gibt die Metadaten des aktuellen Boards zurück
     */
    public getCurrentBoardMeta(): { id: string; name: string; description?: string } {
        return {
            id: this.board.id,
            name: this.board.name,
            description: this.board.description
        };
    }

    /**
     * Aktualisiert die Metadaten des aktuellen Boards (Name, Beschreibung, Tags, Lizenz, etc.)
     */
    public updateCurrentBoardMeta(updates: { 
        name?: string
        description?: string
        tags?: string[]
        ccLicense?: string
    }): void {
        this.board.update(updates); // ✅ Nutze board.update() damit updatedAt gesetzt wird!
        this.triggerUpdate(); // 🔥 speichert zu localStorage und triggert $derived Neuberechnung
        console.log('✅ Board-Metadaten aktualisiert:', { 
            name: this.board.name, 
            description: this.board.description,
            tags: this.board.tags,
            ccLicense: this.board.ccLicense
        });
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
        // ✅ NEU: Authorization Check - nur Maintainers können Karten hinzufügen
        const signerPubkey = authStore.getPubkey();
        if (signerPubkey && !this.board.canAddCard(signerPubkey)) {
            const error = `❌ Nicht autorisiert: du bist nicht Maintainer dieses Boards (author: ${this.board.author}, maintainers: ${this.board.maintainers.join(', ') || 'keine'})`;
            console.error(error);
            throw new Error(error);
        }
        
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

        // ✅ NEU: Authorization Check (nur bei INSERT neuer Karten)
        // UPDATE: Keine Authorisierung nötig (Existierende Karten können von author aktualisiert werden)
        const existingCard = this.board.findCardById(props.id!);
        if (!existingCard) {
            // Neue Karte: Check Berechtigung
            const signerPubkey = authStore.getPubkey();
            if (signerPubkey && !this.board.canAddCard(signerPubkey)) {
                const error = `❌ Nicht autorisiert: du kannst keine Karten zu diesem Board hinzufügen (author: ${this.board.author}, maintainers: ${this.board.maintainers.join(', ') || 'keine'})`;
                console.error(error);
                throw new Error(error);
            }
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
            this.triggerUpdate(); // ← CRITICAL FIX: Trigger Reaktivität + localStorage!
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public addComment(cardId: string, text: string, author: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.addComment(text, author);
            this.triggerUpdate(); // Triggert Reaktivität + localStorage Speicherung
            this.publishToNostr();
        } else {
            throw new Error(`Card with id ${cardId} not found`);
        }
    }

    public deleteComment(cardId: string, commentId: string): void {
        const result = this.board.findCardAndColumn(cardId);
        if (result) {
            result.card.deleteComment(commentId);
            this.triggerUpdate(); // Triggert Reaktivität + localStorage Speicherung
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



    // ============================================================================
    // UI-EVENT-HANDLER (direkt von Komponenten aufrufbar)
    // ============================================================================

    /**
     * Wird von Column.svelte Footer aufgerufen: "Neue Karte" Button
     */
    public createCard(columnId: string, name: string = 'Neue Karte', description?: string): string {
        console.log('🆕 createCard aufgerufen:', { columnId, name, description });
        
        // ✅ WICHTIG: Nutze getUserName() für lesbare author (statt pubkey!)
        // Fallback: pubkey, dann 'anonymous'
        const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
        
        const cardProps: CardProps = {
            heading: name,
            content: description || 'Bitte bearbeiten...',
            publishState: 'draft',
            author: author // ✅ Nutze den Namen für bessere UX!
        };
        
        const card = this.addCard(columnId, cardProps);
        console.log('✅ Karte erstellt:', card.id, 'mit author:', author, 'Board hat jetzt', this.board.columns.flatMap(c => c.cards).length, 'Karten');
        
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
    public editCard(cardId: string, updates: { name?: string; description?: string; image?: string; color?: string; labels?: string[] }): void {
        const cardProps: Partial<CardProps> = {};
        if (updates.name !== undefined) cardProps.heading = updates.name;
        if (updates.description !== undefined) cardProps.content = updates.description;
        if (updates.image !== undefined) cardProps.image = updates.image;
        if (updates.color !== undefined) cardProps.color = updates.color;
        if (updates.labels !== undefined) cardProps.labels = updates.labels;
        
        this.updateCard(cardId, cardProps);
    }

    // ============================================================================
    // PASTE-SYSTEM INTEGRATION
    // ============================================================================

    /**
     * Verarbeitet Paste-Event für eine bestehende Card
     * 
     * @param cardId - ID der Ziel-Card
     * @param clipboardData - Clipboard-Daten vom Paste-Event
     * @returns PasteResult mit success/error
     */
    public async handleCardPaste(
        cardId: string,
        clipboardData: DataTransfer | ClipboardEvent['clipboardData']
    ): Promise<import('../paste/types.js').PasteResult> {
        const { pasteHandler } = await import('../paste/PasteHandler.js');
        
        const result = await pasteHandler.handlePaste(clipboardData, {
            target: 'card',
            cardId,
            author: authStore.getUserName() || authStore.getPubkey() || 'anonymous'
        });
        
        if (result.success && result.cardUpdates) {
            // Merge mit existierender Card
            const existing = this.board.findCardAndColumn(cardId);
            if (existing) {
                const merged = this.mergeCardUpdates(existing.card, result.cardUpdates);
                this.updateCard(cardId, merged);
            }
        }
        
        return result;
    }

    /**
     * Verarbeitet Paste-Event für eine Column (erstellt neue Card)
     * 
     * @param columnId - ID der Ziel-Column
     * @param clipboardData - Clipboard-Daten vom Paste-Event
     * @returns PasteResult mit success/error + neue Card-ID
     */
    public async handleColumnPaste(
        columnId: string,
        clipboardData: DataTransfer | ClipboardEvent['clipboardData']
    ): Promise<import('../paste/types.js').PasteResult & { cardId?: string }> {
        const { pasteHandler } = await import('../paste/PasteHandler.js');
        
        const result = await pasteHandler.handlePaste(clipboardData, {
            target: 'column',
            columnId,
            author: authStore.getUserName() || authStore.getPubkey() || 'anonymous'
        });
        
        if (result.success && result.cardUpdates) {
            // Erstelle neue Card mit Paste-Daten
            const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
            
            const cardProps: CardProps = {
                heading: result.cardUpdates.heading || 'Eingefügter Inhalt',
                content: result.cardUpdates.content || '',
                image: result.cardUpdates.image,
                color: result.cardUpdates.color || 'slate',
                labels: result.cardUpdates.labels || [],
                links: result.cardUpdates.links || [],
                publishState: 'draft',
                author
            };
            
            const card = this.addCard(columnId, cardProps);
            return { ...result, cardId: card.id };
        }
        
        return result;
    }

    /**
     * Hilfsmethode: Merged Paste-Updates mit existierender Card
     * Append statt Replace für content
     */
    private mergeCardUpdates(
        existingCard: import('../classes/BoardModel.js').Card,
        updates: Partial<CardProps>
    ): Partial<CardProps> {
        const merged: Partial<CardProps> = { ...updates };
        
        // Content: Append statt Replace
        if (updates.content) {
            merged.content = (existingCard.content || '') + updates.content;
        }
        
        // Labels: Merge (keine Duplikate)
        if (updates.labels) {
            const existingLabels = existingCard.labels || [];
            merged.labels = [...new Set([...existingLabels, ...updates.labels])];
        }
        
        // Links: Append
        if (updates.links) {
            const existingLinks = existingCard.links || [];
            merged.links = [...existingLinks, ...updates.links];
        }
        
        return merged;
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
        // ✅ AUTHORIZATION CHECK: Bereits in addCard() und upsertCard() durchgeführt!
        // Diese Methode wird nur aufgerufen wenn Validierung erfolgreich war
        
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