/**
 * URL Paste Handler
 * 
 * Verarbeitet URLs aus der Zwischenablage:
 * - YouTube Videos → Embed Player
 * - Bilder (jpg, png, etc.) → Card image
 * - Nostr Events (nevent, note, npub) → Delegiert an NostrEventHandler
 * - Generische URLs → Link in content
 */

import type { IPasteHandler, PasteContext, PasteResult, UrlMetadata } from '../types.js';

export class UrlPasteHandler implements IPasteHandler {
    readonly name = 'URL Handler';
    readonly priority = 10; // Höhere Priorität für URLs
    
    private readonly YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    private readonly IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    private readonly NOSTR_REGEX = /^(nostr:|)(nevent|note|npub|nprofile|naddr)[a-z0-9]+$/i;
    
    async canHandle(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<boolean> {
        if (!clipboardData) return false;
        
        const text = clipboardData.getData('text/plain');
        if (!text) return false;
        
        // Ist es eine gültige URL?
        try {
            new URL(text.trim());
            return true;
        } catch {
            // Falls nicht URL, prüfe ob Nostr-Identifier
            return this.NOSTR_REGEX.test(text.trim());
        }
    }
    
    async handle(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult> {
        if (!clipboardData) {
            return { success: false, type: 'unknown', error: 'Keine Clipboard-Daten' };
        }
        
        const text = clipboardData.getData('text/plain').trim();
        
        // Nostr Events an separaten Handler delegieren
        if (this.NOSTR_REGEX.test(text)) {
            return {
                success: false,
                type: 'nostr-event',
                error: 'Nostr Events werden von NostrEventHandler verarbeitet'
            };
        }
        
        try {
            const url = new URL(text);
            const metadata = this.analyzeUrl(url);
            
            const cardUpdates = await this.createCardUpdates(metadata, context);
            
            return {
                success: true,
                type: 'url',
                cardUpdates,
                debug: `Erkannter URL-Typ: ${metadata.type}`
            };
        } catch (error) {
            return {
                success: false,
                type: 'url',
                error: `URL-Verarbeitung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    private analyzeUrl(url: URL): UrlMetadata {
        const href = url.href;
        
        // YouTube Detection
        const youtubeMatch = href.match(this.YOUTUBE_REGEX);
        if (youtubeMatch) {
            return {
                url: href,
                type: 'youtube',
                title: `YouTube Video: ${youtubeMatch[1]}`
            };
        }
        
        // Image Detection
        if (this.IMAGE_EXTENSIONS.test(href)) {
            return {
                url: href,
                type: 'image',
                imageUrl: href
            };
        }
        
        // Generische URL
        return {
            url: href,
            type: 'generic',
            title: url.hostname
        };
    }
    
    private async createCardUpdates(
        metadata: UrlMetadata,
        context: PasteContext
    ): Promise<Partial<import('../types.js').PasteResult['cardUpdates']>> {
        switch (metadata.type) {
            case 'youtube':
                return this.handleYouTube(metadata, context);
            
            case 'image':
                return this.handleImage(metadata, context);
            
            case 'generic':
            default:
                return this.handleGenericUrl(metadata, context);
        }
    }
    
    private handleYouTube(metadata: UrlMetadata, context: PasteContext) {
        const videoId = metadata.url.match(this.YOUTUBE_REGEX)?.[1];
        
        if (context.target === 'card') {
            // Update existierende Card: Füge YouTube Embed in content hinzu
            return {
                content: `\n\n## YouTube Video\n\n[${metadata.title}](${metadata.url})\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
                labels: ['video', 'youtube']
            };
        } else {
            // Neue Card erstellen
            return {
                heading: metadata.title || 'YouTube Video',
                content: `[Video ansehen](${metadata.url})\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`,
                labels: ['video', 'youtube']
            };
        }
    }
    
    private handleImage(metadata: UrlMetadata, context: PasteContext) {
        if (context.target === 'card') {
            // Update existierende Card: Setze als Card-Image
            return {
                image: metadata.imageUrl,
                content: `\n\n![Bild](${metadata.imageUrl})`
            };
        } else {
            // Neue Card mit Bild
            return {
                heading: 'Eingefügtes Bild',
                image: metadata.imageUrl,
                content: `![Bild](${metadata.imageUrl})`,
                labels: ['image']
            };
        }
    }
    
    private handleGenericUrl(metadata: UrlMetadata, context: PasteContext) {
        if (context.target === 'card') {
            // Füge Link in content hinzu
            return {
                content: `\n\n[${metadata.title || metadata.url}](${metadata.url})`,
                links: [{ id: crypto.randomUUID(), url: metadata.url, title: metadata.title || metadata.url }]
            };
        } else {
            // Neue Card mit Link
            return {
                heading: metadata.title || 'Link',
                content: `[${metadata.url}](${metadata.url})`,
                links: [{ id: crypto.randomUUID(), url: metadata.url, title: metadata.title || metadata.url }],
                labels: ['link']
            };
        }
    }
}
