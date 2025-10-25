/**
 * Image Paste Handler
 * 
 * Verarbeitet binäre Bilder aus der Zwischenablage:
 * - Screenshot → Blob zu Data URL konvertieren
 * - Kopierte Bilder → Als Card-Image setzen
 */

import type { IPasteHandler, PasteContext, PasteResult } from '../types.js';

export class ImagePasteHandler implements IPasteHandler {
    readonly name = 'Image Handler';
    readonly priority = 20; // Höchste Priorität für binäre Bilder
    
    async canHandle(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<boolean> {
        if (!clipboardData) return false;
        
        // Prüfe ob Bild-Dateien vorhanden sind
        const items = clipboardData.items;
        if (!items) return false;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                return true;
            }
        }
        
        return false;
    }
    
    async handle(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult> {
        if (!clipboardData) {
            return { success: false, type: 'image', error: 'Keine Clipboard-Daten' };
        }
        
        try {
            const imageDataUrl = await this.extractImageAsDataUrl(clipboardData);
            
            if (!imageDataUrl) {
                return { success: false, type: 'image', error: 'Kein Bild gefunden' };
            }
            
            const cardUpdates = this.createCardUpdates(imageDataUrl, context);
            
            return {
                success: true,
                type: 'image',
                cardUpdates,
                debug: `Bild als Data URL (${Math.round(imageDataUrl.length / 1024)}KB)`
            };
        } catch (error) {
            return {
                success: false,
                type: 'image',
                error: `Bild-Verarbeitung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    private async extractImageAsDataUrl(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<string | null> {
        if (!clipboardData) return null;
        const items = clipboardData.items;
        if (!items) return null;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (!blob) continue;
                
                // Konvertiere Blob zu Data URL
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            }
        }
        
        return null;
    }
    
    private createCardUpdates(imageDataUrl: string, context: PasteContext) {
        if (context.target === 'card') {
            // Update existierende Card: Setze als Card-Image
            return {
                image: imageDataUrl,
                content: `\n\n![Eingefügtes Bild](${imageDataUrl})`
            };
        } else {
            // Neue Card mit Bild
            const now = new Date().toLocaleString('de-DE');
            return {
                heading: `Screenshot ${now}`,
                image: imageDataUrl,
                content: `![Screenshot vom ${now}](${imageDataUrl})`,
                labels: ['screenshot', 'image']
            };
        }
    }
}
