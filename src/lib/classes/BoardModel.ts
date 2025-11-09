// src/lib/classes/BoardModel.ts

import { generateDTag, generateTimestamp } from '../utils/idGenerator.js';

// ============================================================================
// INTERFACES UND TYPEN
// ============================================================================

export type PublishState = 'draft' | 'published' | 'archived';

// Basis-Interface für alle Elemente, die eine Nostr-d-tag-ID benötigen
export interface NostrElement {
    id: string;
}

export interface Comment extends NostrElement {
    text: string;
    author: string; // Nostr Public Key (npub)
    createdAt: string; // ISO 8601
}

export interface Link extends NostrElement {
    url: string;
    title: string;
}

export interface CardProps {
    id?: string;
    heading: string;
    content?: string;
    color?: string;
    image?: string; // URL zum Kartenbild
    comments?: Comment[];
    labels?: string[];
    links?: Link[];
    attendees?: string[];
    publishState?: PublishState;
    author?: string; // Nostr Public Key (hex pubkey) - Ersteller der Karte
    authorName?: string; // ← NEU: Lesbar Display Name für UI (z.B. "Johan Amos Comenius")
    // ⚠️ NOSTR-SPECIFIC: Metadaten für Echtzeit-Synchronisation
    rank?: number; // Position in der Spalte (aus Nostr Event "rank"-Tag)
    columnId?: string; // Spalten-ID (aus Nostr Event "s"-Tag - muss Column-ID sein, nicht Name!)
    boardRef?: string; // Board-Referenz (aus "a"-Tag, Format: "30301:pubkey:board-id")
}

export interface ColumnProps {
    id?: string;
    name: string;
    color?: string;
    cards?: CardProps[];
}

export interface BoardProps {
    id?: string;
    eventId?: string; // ← NEU: Actual Nostr event ID
    name: string;
    description?: string;
    columns?: ColumnProps[];
    publishState?: PublishState;
    author?: string;
    maintainers?: string[]; // ← NEU: Nostr pubkeys mit Edit-Berechtigung
    createdAt?: number;
    tags?: string[];
    ccLicense?: string;
}

export interface AIAction {
    type: 'add_card' | 'update_card' | 'move_card' | 'split_card' | 'add_column' | 'delete_card';
    [key: string]: any;
}

// ============================================================================
// CARD KLASSE
// ============================================================================

export class Card {
    public id: string;
    public heading: string;
    public content?: string;
    public color?: string;
    public image?: string; // URL zum Kartenbild
    public comments: Comment[] = [];
    public labels: string[] = [];
    public links: Link[] = [];
    public attendees: string[] = [];
    public publishState: PublishState = 'draft';
    public author?: string; // Nostr Public Key (hex pubkey) - Ersteller der Karte
    public authorName?: string; // ← NEU: Lesbar Display Name für UI
    public createdAt: string;
    public updatedAt: string;

    constructor(props: CardProps) {
        this.id = props.id || generateDTag('card');
        this.heading = props.heading;
        this.content = props.content;
        this.color = props.color;
        this.image = props.image;
        this.comments = props.comments || [];
        this.labels = props.labels || [];
        this.links = props.links || [];
        this.attendees = props.attendees || [];
        this.publishState = props.publishState || 'draft';
        this.author = props.author;
        this.authorName = props.authorName; // ← NEU: authorName laden
        this.createdAt = generateTimestamp();
        this.updatedAt = this.createdAt;
    }

    update(props: Partial<CardProps>): void {
        if (props.heading !== undefined) this.heading = props.heading;
        if (props.content !== undefined) this.content = props.content;
        if (props.color !== undefined) this.color = props.color;
        if (props.image !== undefined) this.image = props.image;
        if (props.labels !== undefined) this.labels = props.labels;
        if (props.links !== undefined) this.links = props.links;
        if (props.attendees !== undefined) this.attendees = props.attendees;
        if (props.publishState !== undefined) this.publishState = props.publishState;
        if (props.author !== undefined) this.author = props.author;
        if (props.authorName !== undefined) this.authorName = props.authorName; // ← NEU

        this.updatedAt = generateTimestamp();
    }

    setPublishState(state: PublishState): void {
        this.publishState = state;
        this.updatedAt = generateTimestamp();
    }

    addComment(text: string, author: string): void {
        const comment: Comment = {
            id: generateDTag('comment') || `comment-${Date.now()}-${Math.random()}`, // ← Fallback für Safety
            text,
            author,
            createdAt: generateTimestamp()
        };
        // WICHTIG: Reassigniere das Array für Svelte 5 Reaktivität
        this.comments = [...this.comments, comment];
    }

    deleteComment(commentId: string): void {
        this.comments = this.comments.filter(comment => comment.id !== commentId);
    }

    getContextData(): Omit<CardProps, 'comments' | 'links' | 'attendees'> & {
        comments: { text: string; author: string }[],
        links: { url: string; title: string }[]
    } {
        return {
            id: this.id,
            heading: this.heading,
            content: this.content,
            color: this.color,
            image: this.image,
            labels: this.labels,
            publishState: this.publishState,
            author: this.author, // ← ✅ FIXED: author hinzugefügt!
            authorName: this.authorName, // ← NEU: authorName serialisieren!
            comments: this.comments.map(c => ({ text: c.text, author: c.author })),
            links: this.links.map(l => ({ url: l.url, title: l.title }))
        };
    }
}

// ============================================================================
// COLUMN KLASSE
// ============================================================================

export class Column {
    public id: string;
    public name: string;
    public color?: string;
    public cards: Card[] = [];

    constructor(props: ColumnProps) {
        this.id = props.id || generateDTag('column');
        this.name = props.name;
        this.color = props.color;
        this.cards = (props.cards || []).map(cardProps => new Card(cardProps));
    }

    update(props: Partial<ColumnProps>): void {
        if (props.name !== undefined) this.name = props.name;
        if (props.color !== undefined) this.color = props.color;
    }

    addCard(props: CardProps): Card {
        const card = new Card(props);
        // WICHTIG: Reassigniere das Array für Svelte 5 Reaktivität
        this.cards = [...this.cards, card];
        return card;
    }

    /**
     * Fügt ein bestehendes Card-Objekt hinzu (für moveCard-Operation)
     * @internal Nur von Board.moveCard() verwendet
     */
    appendCard(card: Card): void {
        // WICHTIG: Reassigniere das Array für Svelte 5 Reaktivität
        this.cards = [...this.cards, card];
    }

    deleteCard(cardId: string): void {
        this.cards = this.cards.filter(card => card.id !== cardId);
    }

    findCard(cardId: string): Card | undefined {
        return this.cards.find(card => card.id === cardId);
    }

    splitCard(sourceCardId: string, newCardsProps: CardProps[]): void {
        // Lösche die Quellkarte
        this.deleteCard(sourceCardId);

        // Füge die neuen Karten hinzu
        for (const cardProps of newCardsProps) {
            this.addCard(cardProps);
        }
    }

    getContextData(full: boolean = false): { id: string, name: string, color?: string, cards: any[] } {
        if (full) {
            return {
                id: this.id,
                name: this.name,
                color: this.color,
                cards: this.cards.map(card => card.getContextData())
            };
        } else {
            return {
                id: this.id,
                name: this.name,
                color: this.color,
                cards: this.cards.map(card => ({ id: card.id, heading: card.heading }))
            };
        }
    }
}

// ============================================================================
// BOARD KLASSE
// ============================================================================

export class Board {
    public id: string;
    public eventId?: string; // ← NEU: Actual Nostr event ID (for deletion)
    public name: string;
    public description?: string;
    public columns: Column[] = [];
    public publishState: PublishState = 'draft';
    public author?: string;
    public maintainers: string[] = []; // ← NEU: Array von Pubkeys mit Edit-Berechtigung
    public createdAt: string;
    public updatedAt: string;
    public tags: string[] = [];
    public ccLicense: string = 'cc-by-4.0';

    constructor(props: BoardProps) {
        this.id = props.id || generateDTag('board');
        this.eventId = props.eventId; // ← NEU: Event-ID speichern
        this.name = props.name;
        this.description = props.description;
        this.columns = (props.columns || []).map(colProps => new Column(colProps));
        this.publishState = props.publishState || 'draft';
        this.author = props.author;
        this.maintainers = props.maintainers || []; // ← NEU: Aus Props laden
        this.tags = props.tags || [];
        this.ccLicense = props.ccLicense || 'cc-by-4.0';
        this.createdAt = generateTimestamp();
        this.updatedAt = this.createdAt;
    }

    setPublishState(state: PublishState): void {
        this.publishState = state;
        this.updatedAt = generateTimestamp();
    }

    update(props: { name?: string; description?: string; tags?: string[]; ccLicense?: string }): void {
        if (props.name !== undefined) this.name = props.name;
        if (props.description !== undefined) this.description = props.description;
        if (props.tags !== undefined) this.tags = props.tags;
        if (props.ccLicense !== undefined) this.ccLicense = props.ccLicense;
        this.updatedAt = generateTimestamp();
    }

    /**
     * Überprüft, ob ein Pubkey ein Maintainer (Co-Editor) des Boards ist.
     * @param pubkey - Nostr pubkey (hex format)
     * @returns true wenn pubkey === author ODER in maintainers array enthalten
     */
    isMaintainer(pubkey?: string): boolean {
        if (!pubkey) return false;
        return pubkey === this.author || (this.maintainers || []).includes(pubkey);
    }

    /**
     * Überprüft, ob ein Pubkey berechtigt ist, Karten zu diesem Board hinzuzufügen.
     * - Wenn maintainers leer: nur author kann hinzufügen
     * - Wenn maintainers gesetzt: author oder any maintainer kann hinzufügen
     * @param pubkey - Nostr pubkey (hex format)
     * @returns true wenn berechtigt, false sonst
     */
    canAddCard(pubkey?: string): boolean {
        if (!pubkey) return false;
        if ((this.maintainers || []).length === 0) {
            // Nur author wenn keine maintainers definiert
            return pubkey === this.author;
        }
        // author oder any maintainer
        return this.isMaintainer(pubkey);
    }

    addColumn(props: ColumnProps): Column {
        const column = new Column(props);
        // WICHTIG: Reassigniere das Array für Svelte 5 Reaktivität
        this.columns = [...this.columns, column];
        return column;
    }

    deleteColumn(columnId: string): void {
        this.columns = this.columns.filter(column => column.id !== columnId);
    }

    findColumn(columnId: string): Column | undefined {
        return this.columns.find(column => column.id === columnId);
    }

    findCardAndColumn(cardId: string): { card: Card; column: Column } | null {
        for (const column of this.columns) {
            const card = column.findCard(cardId);
            if (card) {
                return { card, column };
            }
        }
        return null;
    }

    /**
     * Findet eine Karte über alle Spalten hinweg anhand ihrer ID (spaltenübergreifend)
     * Nützlich für Upsert-Operationen aus Nostr
     */
    findCardById(cardId: string): { card: Card; column: Column } | null {
        return this.findCardAndColumn(cardId);
    }

    moveCard(cardId: string, fromColId: string, toColId: string): void {
        const fromColumn = this.findColumn(fromColId);
        const toColumn = this.findColumn(toColId);

        if (!fromColumn || !toColumn) {
            throw new Error('Source or target column not found');
        }

        const card = fromColumn.findCard(cardId);
        if (!card) {
            throw new Error('Card not found in source column');
        }

        // Karte aus der Quellspalte entfernen (aber nicht löschen - die Instanz behalten!)
        fromColumn.deleteCard(cardId);

        // Das BESTEHENDE Card-Objekt zur Zielspalte hinzufügen (nicht mit Props rekonstruieren!)
        toColumn.appendCard(card);
    }

    /**
     * Upsert-Operation: Fügt Karte hinzu ODER aktualisiert sie, wenn sie bereits existiert
     * Spaltenübergreifend! Unterstützt jetzt auch Spalten- und Positionswechsel.
     * 
     * ⚠️ WICHTIG: Für Nostr-Synchronisation!
     * - Wenn Karte existiert: Update (Position/Spalte KANN geändert werden)
     * - Wenn Karte neu: Insert (an rank-Position oder am Ende)
     * 
     * @param targetColumnId - Spalte, in die die Karte aufgenommen wird
     * @param cardProps - Die Kartendaten
     * @param rank - Optional: Position in der Spalte (0-basiert). Wenn undefined, wird am Ende eingefügt.
     * @returns Die neue oder aktualisierte Karte
     */
    upsertCard(targetColumnId: string, cardProps: CardProps, rank?: number): Card {
        const targetColumn = this.findColumn(targetColumnId);
        if (!targetColumn) {
            throw new Error(`Target column ${targetColumnId} not found`);
        }

        // Prüfe ob die Karte bereits existiert (spaltenübergreifend)
        const existing = this.findCardById(cardProps.id!);
        
        if (existing) {
            // ✅ UPDATE: Karte existiert bereits
            const { card, column: currentColumn } = existing;
            
            // Update Kartendaten
            card.update(cardProps);
            
            // ⚠️ NEU: Prüfe ob Spalte oder Position geändert wurde
            if (currentColumn.id !== targetColumnId || (rank !== undefined && currentColumn.cards.indexOf(card) !== rank)) {
                // Karte aus alter Spalte entfernen
                currentColumn.cards = currentColumn.cards.filter(c => c.id !== card.id);
                
                // Karte in neue Spalte an rank-Position einfügen
                if (rank !== undefined && rank >= 0 && rank <= targetColumn.cards.length) {
                    // Einfügen an spezifischer Position
                    const newCards = [...targetColumn.cards];
                    newCards.splice(rank, 0, card);
                    targetColumn.cards = newCards;
                } else {
                    // Am Ende einfügen
                    targetColumn.cards = [...targetColumn.cards, card];
                }
            }
            
            return card;
        } else {
            // ✅ INSERT: Neue Karte - zu Zielspalte hinzufügen
            const newCard = new Card(cardProps);
            
            if (rank !== undefined && rank >= 0 && rank <= targetColumn.cards.length) {
                // Einfügen an spezifischer Position
                const newCards = [...targetColumn.cards];
                newCards.splice(rank, 0, newCard);
                targetColumn.cards = newCards;
            } else {
                // Am Ende einfügen
                targetColumn.cards = [...targetColumn.cards, newCard];
            }
            
            return newCard;
        }
    }

    getContextData(full: boolean = false): {
        id: string,
        eventId?: string, // ← NEU: Event-ID serialisieren!
        name: string,
        description: string,
        tags: string[],
        ccLicense: string,
        publishState: PublishState,
        createdAt: string,
        updatedAt: string,
        author?: string,
        maintainers?: string[], // ← NEU: maintainers zur Return Type hinzugefügt!
        columns: any[]
    } {
        return {
            id: this.id,
            eventId: this.eventId, // ← NEU: Event-ID serialisieren!
            name: this.name,
            description: this.description || '',
            tags: this.tags,
            ccLicense: this.ccLicense,
            publishState: this.publishState,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            author: this.author,
            maintainers: this.maintainers, // ← NEU: maintainers serialisieren!
            columns: this.columns.map(col => col.getContextData(full))
        };
    }
}

// ============================================================================
// CHAT KLASSE (KI-CONTROLLER)
// ============================================================================

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    type: 'message' | 'action';
    timestamp: string;
}

export class Chat {
    private board: Board;
    public messages: ChatMessage[] = [];

    constructor(board: Board) {
        this.board = board;
    }

    addMessage(text: string, sender: 'user' | 'ai', type: 'message' | 'action' = 'message'): void {
        const message: ChatMessage = {
            id: generateDTag('comment'),
            text,
            sender,
            type,
            timestamp: generateTimestamp()
        };
        // WICHTIG: Reassigniere das Array für Svelte 5 Reaktivität
        this.messages = [...this.messages, message];
    }

    sendPromptToAI(prompt: string, context?: Card | Column | Board): void {
        // Sammle Kontext-Daten
        let selectionContext;
        if (context) {
            if (context instanceof Card) {
                selectionContext = context.getContextData();
            } else if (context instanceof Column) {
                selectionContext = context.getContextData(true);
            } else if (context instanceof Board) {
                selectionContext = context.getContextData(true);
            }
        }

        const payload = {
            prompt,
            boardContext: this.board.getContextData(false),
            selectionContext
        };

        // Simuliere KI-Server-Aufruf (in einer echten App würde hier eine WebSocket/Nostr-Verbindung sein)
        console.log('KI-Payload:', JSON.stringify(payload, null, 2));

        // Füge die Nachricht zum Chat hinzu
        this.addMessage(prompt, 'user');
    }

    processAIAction(action: AIAction): void {
        this.addMessage(`AI Action: ${action.type}`, 'ai', 'action');

        try {
            switch (action.type) {
                case 'add_card':
                    if (action.columnId && action.cardProps) {
                        const column = this.board.findColumn(action.columnId);
                        if (column) {
                            column.addCard(action.cardProps);
                        }
                    }
                    break;

                case 'update_card':
                    if (action.cardId && action.updates) {
                        const result = this.board.findCardAndColumn(action.cardId);
                        if (result) {
                            result.card.update(action.updates);
                        }
                    }
                    break;

                case 'move_card':
                    if (action.cardId && action.fromColId && action.toColId) {
                        this.board.moveCard(action.cardId, action.fromColId, action.toColId);
                    }
                    break;

                case 'split_card':
                    if (action.columnId && action.sourceCardId && action.newCards) {
                        const column = this.board.findColumn(action.columnId);
                        if (column) {
                            column.splitCard(action.sourceCardId, action.newCards);
                        }
                    }
                    break;
            }

            this.addMessage(`Action "${action.type}" erfolgreich ausgeführt`, 'ai', 'action');
        } catch (error) {
            this.addMessage(`Fehler bei Action "${action.type}": ${error}`, 'ai', 'action');
        }
    }
}