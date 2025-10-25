/**
 * Paste System Types & Interfaces
 * 
 * Erweiterbares System zum Verarbeiten von Zwischenablage-Inhalten
 * in Cards und Columns.
 */

import type { CardProps } from '../classes/BoardModel.js';

/**
 * Kontext für Paste-Operation
 */
export interface PasteContext {
    /** Ziel: 'card' = update existierende Card, 'column' = neue Card erstellen */
    target: 'card' | 'column';
    
    /** Card ID (wenn target === 'card') */
    cardId?: string;
    
    /** Column ID (wenn target === 'column') */
    columnId?: string;
    
    /** Optional: User-Kontext für author-Zuordnung */
    author?: string;
}

/**
 * Ergebnis einer Paste-Operation
 */
export interface PasteResult {
    /** Erfolgreich verarbeitet? */
    success: boolean;
    
    /** Typ des erkannten Inhalts */
    type: 'url' | 'image' | 'text' | 'nostr-event' | 'unknown';
    
    /** Aktualisierte Card-Properties (für updateCard/addCard) */
    cardUpdates?: Partial<CardProps>;
    
    /** Optional: Fehlermeldung */
    error?: string;
    
    /** Optional: Debug-Info */
    debug?: string;
}

/**
 * Base Interface für alle Paste Handler
 */
export interface IPasteHandler {
    /** Name des Handlers (z.B. "YouTube URL") */
    readonly name: string;
    
    /** Priorität (höher = früher prüfen), Default: 0 */
    readonly priority: number;
    
    /**
     * Kann dieser Handler den Inhalt verarbeiten?
     */
    canHandle(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<boolean>;
    
    /**
     * Verarbeite den Inhalt und gebe Card-Updates zurück
     */
    handle(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult>;
}

/**
 * URL-spezifische Typen
 */
export interface UrlMetadata {
    url: string;
    type: 'youtube' | 'image' | 'nostr-event' | 'generic';
    title?: string;
    description?: string;
    imageUrl?: string;
}

/**
 * Nostr Event Metadata
 */
export interface NostrEventMetadata {
    id: string;
    kind: number;
    content: string;
    pubkey: string;
    created_at: number;
}
