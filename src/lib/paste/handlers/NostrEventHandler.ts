/**
 * Nostr Event Paste Handler
 * 
 * Verarbeitet Nostr Event Identifier aus der Zwischenablage:
 * - nevent1... → Event Preview mit Inhalt
 * - note1... → Event Preview
 * - npub1... → Profile Preview
 * - nprofile1... → Profile Preview
 * - naddr1... → Addressable Event Preview
 * 
 * TODO: Integration mit NDK für Event-Fetching
 */

import type { IPasteHandler, PasteContext, PasteResult } from '../types.js';

export class NostrEventHandler implements IPasteHandler {
    readonly name = 'Nostr Event Handler';
    readonly priority = 15; // Höher als Text, niedriger als Image
    
    private readonly NOSTR_REGEX = /^(nostr:|)(nevent|note|npub|nprofile|naddr)1[a-z0-9]+$/i;
    
    async canHandle(clipboardData: DataTransfer | ClipboardEvent['clipboardData']): Promise<boolean> {
        if (!clipboardData) return false;
        
        const text = clipboardData.getData('text/plain').trim();
        return this.NOSTR_REGEX.test(text);
    }
    
    async handle(
        clipboardData: DataTransfer | ClipboardEvent['clipboardData'],
        context: PasteContext
    ): Promise<PasteResult> {
        if (!clipboardData) {
            return { success: false, type: 'nostr-event', error: 'Keine Clipboard-Daten' };
        }
        
        try {
            let identifier = clipboardData.getData('text/plain').trim();
            
            // Entferne "nostr:" Prefix falls vorhanden
            identifier = identifier.replace(/^nostr:/, '');
            
            const type = this.getNostrType(identifier);
            
            // TODO: Hier würde NDK Integration kommen um Event zu fetchen
            // Für jetzt erstellen wir eine Placeholder-Card
            
            const cardUpdates = this.createCardUpdates(identifier, type, context);
            
            return {
                success: true,
                type: 'nostr-event',
                cardUpdates,
                debug: `Nostr ${type} erkannt`
            };
        } catch (error) {
            return {
                success: false,
                type: 'nostr-event',
                error: `Nostr Event Verarbeitung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    private getNostrType(identifier: string): string {
        if (identifier.startsWith('nevent1')) return 'Event';
        if (identifier.startsWith('note1')) return 'Note';
        if (identifier.startsWith('npub1')) return 'Profile';
        if (identifier.startsWith('nprofile1')) return 'Profile';
        if (identifier.startsWith('naddr1')) return 'Addressable Event';
        return 'Unknown';
    }
    
    private createCardUpdates(identifier: string, type: string, context: PasteContext) {
        const nostrUrl = `nostr:${identifier}`;
        
        if (context.target === 'card') {
            // Update existierende Card: Füge Nostr Reference hinzu
            return {
                content: `\n\n## Nostr ${type}\n\n[${identifier.substring(0, 20)}...](${nostrUrl})\n\n> TODO: Fetch event content via NDK`,
                labels: ['nostr', type.toLowerCase()],
                links: [{ 
                    id: crypto.randomUUID(), 
                    url: nostrUrl, 
                    title: `Nostr ${type}` 
                }]
            };
        } else {
            // Neue Card erstellen
            return {
                heading: `Nostr ${type}`,
                content: `[${identifier}](${nostrUrl})\n\n> TODO: Fetch event content via NDK\n\nIdentifier: \`${identifier}\``,
                labels: ['nostr', type.toLowerCase()],
                links: [{ 
                    id: crypto.randomUUID(), 
                    url: nostrUrl, 
                    title: `Nostr ${type}` 
                }]
            };
        }
    }
}
