/**
 * Main Paste Handler Orchestrator
 * 
 * Koordiniert alle registrierten Paste-Handler und verarbeitet
 * Clipboard-Events intelligent basierend auf Priorität.
 * 
 * Usage:
 * ```typescript
 * const handler = new PasteHandler();
 * const result = await handler.handlePaste(event.clipboardData, { 
 *   target: 'card', 
 *   cardId: '...' 
 * });
 * 
 * if (result.success) {
 *   boardStore.updateCard(cardId, result.cardUpdates);
 * }
 * ```
 */

import type { IPasteHandler, PasteContext, PasteResult } from './types.js';
import { UrlPasteHandler } from './handlers/UrlPasteHandler.js';
import { ImagePasteHandler } from './handlers/ImagePasteHandler.js';
import { TextPasteHandler } from './handlers/TextPasteHandler.js';
import { NostrEventHandler } from './handlers/NostrEventHandler.js';

export class PasteHandler {
    private handlers: IPasteHandler[] = [];
    
    constructor() {
        // Registriere alle Handler (sortiert nach Priorität)
        this.registerHandler(new ImagePasteHandler());      // Priority: 20
        this.registerHandler(new NostrEventHandler());      // Priority: 15
        this.registerHandler(new UrlPasteHandler());        // Priority: 10
        this.registerHandler(new TextPasteHandler());       // Priority: 0 (Fallback)
        
        // Sortiere nach Priorität (höchste zuerst)
        this.sortHandlers();
    }
    
    /**
     * Registriert einen neuen Handler
     * Nützlich für Custom-Handler oder Testing
     */
    public registerHandler(handler: IPasteHandler): void {
        this.handlers.push(handler);
        this.sortHandlers();
    }
    
    /**
     * Entfernt einen Handler
     */
    public unregisterHandler(handlerName: string): void {
        this.handlers = this.handlers.filter(h => h.name !== handlerName);
    }
    
    /**
     * Hauptmethode: Verarbeitet Paste-Event
     */
    public async handlePaste(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult> {
        if (!clipboardData) {
            return {
                success: false,
                type: 'unknown',
                error: 'Keine Clipboard-Daten verfügbar'
            };
        }
        
        // Versuche jeden Handler in Reihenfolge der Priorität
        for (const handler of this.handlers) {
            const canHandle = await handler.canHandle(clipboardData);
            
            if (canHandle) {
                console.log(`🎯 Paste Handler: ${handler.name} (Priority: ${handler.priority})`);
                
                const result = await handler.handle(clipboardData, context);
                
                if (result.success) {
                    console.log(`✅ Paste erfolgreich: ${result.type}`, result.debug || '');
                    return result;
                }
                
                // Handler konnte nicht erfolgreich verarbeiten, versuche nächsten
                console.warn(`⚠️ Handler ${handler.name} konnte nicht verarbeiten:`, result.error);
            }
        }
        
        // Kein Handler konnte verarbeiten
        return {
            success: false,
            type: 'unknown',
            error: 'Kein passender Handler gefunden'
        };
    }
    
    /**
     * Gibt alle registrierten Handler zurück (für Debugging)
     */
    public getHandlers(): ReadonlyArray<IPasteHandler> {
        return this.handlers;
    }
    
    private sortHandlers(): void {
        this.handlers.sort((a, b) => b.priority - a.priority);
    }
}

// Singleton-Instanz für einfache Verwendung
export const pasteHandler = new PasteHandler();
