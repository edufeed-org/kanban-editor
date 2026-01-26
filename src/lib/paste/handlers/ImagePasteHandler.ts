/**
 * Image Paste Handler
 * 
 * Verarbeitet binäre Bilder aus der Zwischenablage:
 * - Screenshot → Blob zu Data URL konvertieren
 * - Kopierte Bilder → Als Card-Image setzen
 */

import type { IPasteHandler, PasteContext, PasteResult, ClipboardData } from '../types.js';

export class ImagePasteHandler implements IPasteHandler {
    readonly name = 'Image Handler';
    readonly priority = 20; // Höchste Priorität für binäre Bilder
    
    async canHandle(data: ClipboardData): Promise<boolean> {
        // Prüfe ob Bild-Dateien vorhanden sind
        return data.files.some(file => file.type.startsWith('image/'));
    }
    
    async handle(data: ClipboardData, context: PasteContext): Promise<PasteResult> {
        try {
            const imageFile = data.files.find(file => file.type.startsWith('image/'));
            
            if (!imageFile) {
                return { success: false, type: 'image', error: 'Kein Bild gefunden' };
            }
            
            const imageDataUrl = await this.fileToDataUrl(imageFile);
            
            if (!imageDataUrl) {
                return { success: false, type: 'image', error: 'Bild konnte nicht gelesen werden' };
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
    
    private fileToDataUrl(file: File): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
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
