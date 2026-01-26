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

import type { IPasteHandler, PasteContext, PasteResult, ClipboardData } from '../types.js';
import type NDK from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { nostrToAmb, type AmbLearningResource, type NostrEvent } from '@edufeed-org/amb-nostr-converter';

export class NostrEventHandler implements IPasteHandler {
    readonly name = 'Nostr Event Handler';
    readonly priority = 15; // Höher als Text, niedriger als Image
    
    // Einfacher Regex der naddr/nevent/etc in URLs, nostr: URIs oder direkt findet
    private readonly NOSTR_REGEX = /(n(?:event|ote|pub|profile|addr)1[a-z0-9]+)/i;
    
    async canHandle(data: ClipboardData): Promise<boolean> {
        const text = data.text.trim();
        const matches = this.NOSTR_REGEX.test(text);
        console.log('🔍 NostrEventHandler.canHandle:', { textLen: text.length, matches });
        return matches;
    }
    
    async handle(data: ClipboardData, context: PasteContext): Promise<PasteResult> {
        try {
            const text = data.text.trim();
            const identifier = this.extractIdentifier(text);
            if (!identifier) {
                return { success: false, type: 'nostr-event', error: 'Kein Nostr-Identifier gefunden' };
            }
            
            const type = this.getNostrType(identifier);

            const cardUpdates = await this.createCardUpdates(identifier, type, context);
            
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
    
    private extractIdentifier(text: string): string | null {
        if (!text) return null;
        const match = text.match(this.NOSTR_REGEX);
        console.log('🔍 extractIdentifier:', { text: text.substring(0, 80), match: match?.[1] });
        // Capturing group 1 enthält den vollständigen Identifier (z.B. naddr1...)
        return match ? match[1].toLowerCase() : null;
    }

    private async fetchEventFromNaddr(identifier: string, ndk: NDK): Promise<NostrEvent | null> {
        try {
            const decoded = nip19.decode(identifier);
            if (decoded.type !== 'naddr') return null;

            const data = decoded.data as { kind: number; pubkey: string; identifier: string };
            const filter = {
                kinds: [data.kind],
                authors: [data.pubkey],
                '#d': [data.identifier]
            };

            const event = await ndk.fetchEvent(filter as any);
            if (!event) return null;

            return event.rawEvent() as NostrEvent;
        } catch (error) {
            console.warn('⚠️ Nostr naddr fetch fehlgeschlagen:', error);
            return null;
        }
    }

    private async createCardUpdates(identifier: string, type: string, context: PasteContext) {
        const nostrUrl = `nostr:${identifier}`;
        const ndk = context.ndk;

        if (type === 'Addressable Event' && ndk) {
            const event = await this.fetchEventFromNaddr(identifier, ndk);
            if (event) {
                const ambResult = nostrToAmb(event, { defaultLanguage: 'de' });
                if (ambResult.success && ambResult.data) {
                    return this.createAmbCardUpdates(ambResult.data, identifier, context);
                }
            }
        }

        if (context.target === 'card') {
            return {
                content: `\n\n## Nostr ${type}\n\n[${identifier.substring(0, 20)}...](${nostrUrl})`,
                labels: ['nostr', type.toLowerCase()],
                links: [{
                    id: crypto.randomUUID(),
                    url: nostrUrl,
                    title: `Nostr ${type}`
                }]
            };
        }

        return {
            heading: `Nostr ${type}`,
            content: `[${identifier}](${nostrUrl})\n\nIdentifier: \`${identifier}\``,
            labels: ['nostr', type.toLowerCase()],
            links: [{
                id: crypto.randomUUID(),
                url: nostrUrl,
                title: `Nostr ${type}`
            }]
        };
    }

    private createAmbCardUpdates(resource: AmbLearningResource, identifier: string, context: PasteContext) {
        const nostrUrl = `nostr:${identifier}`;
        const heading = resource.name || 'AMB Learning Resource';
        const content = this.formatAmbContent(resource, nostrUrl);
        const labels = this.collectLabels(resource);
        const links = this.collectLinks(resource, nostrUrl);

        if (context.target === 'card') {
            return {
                content: `\n\n${content}`,
                labels,
                links,
                image: resource.image
            };
        }

        return {
            heading,
            content,
            labels,
            links,
            image: resource.image
        };
    }

    private formatAmbContent(resource: AmbLearningResource, nostrUrl: string): string {
        const lines: string[] = [];

        if (resource.description) {
            lines.push(resource.description.trim());
        }

        const creators = resource.creator?.map(c => c.name).filter(Boolean) || [];
        const languages = resource.inLanguage || [];
        const resourceTypes = this.getResourceTypes(resource);
        const learningTypes = resource.learningResourceType?.map(c => this.getConceptLabel(c)).filter(Boolean) || [];
        const about = resource.about?.map(c => this.getConceptLabel(c)).filter(Boolean) || [];
        const keywords = resource.keywords || [];

        lines.push('### Metadaten');

        if (creators.length > 0) {
            lines.push(`- Autor: ${creators.join(', ')}`);
        }
        if (resourceTypes.length > 0) {
            lines.push(`- Typ: ${resourceTypes.join(', ')}`);
        }
        if (learningTypes.length > 0) {
            lines.push(`- Lernressourcentyp: ${learningTypes.join(', ')}`);
        }
        if (languages.length > 0) {
            lines.push(`- Sprache: ${languages.join(', ')}`);
        }
        if (about.length > 0) {
            lines.push(`- Themen: ${about.join(', ')}`);
        }
        if (keywords.length > 0) {
            lines.push(`- Keywords: ${keywords.join(', ')}`);
        }
        if (resource.license?.id) {
            lines.push(`- Lizenz: ${resource.license.id}`);
        }
        if (resource.isAccessibleForFree !== undefined) {
            lines.push(`- Kostenfrei: ${resource.isAccessibleForFree ? 'Ja' : 'Nein'}`);
        }
        if (resource.id) {
            lines.push(`- Quelle: ${this.formatLink(resource.id, resource.id)}`);
        }

        lines.push(`- Nostr: ${this.formatLink(nostrUrl, nostrUrl)}`);

        return lines.join('\n');
    }

    private formatLink(url: string, label: string): string {
        return `[${label}](${url})`;
    }

    private collectLabels(resource: AmbLearningResource): string[] {
        const labels = new Set<string>(['nostr', 'amb']);
        for (const type of resource.type || []) {
            labels.add(type.toLowerCase());
        }
        for (const concept of resource.learningResourceType || []) {
            const label = this.getConceptLabel(concept);
            if (label) {
                labels.add(label.toLowerCase());
            }
        }
        return Array.from(labels);
    }

    private collectLinks(resource: AmbLearningResource, nostrUrl: string) {
        const links = [{
            id: crypto.randomUUID(),
            url: nostrUrl,
            title: 'Nostr Event'
        }];

        if (resource.id && this.isHttpUrl(resource.id)) {
            links.unshift({
                id: crypto.randomUUID(),
                url: resource.id,
                title: resource.name || 'Lernressource'
            });
        }

        return links;
    }

    private isHttpUrl(value: string): boolean {
        try {
            const parsed = new URL(value);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    private getResourceTypes(resource: AmbLearningResource): string[] {
        return (resource.type || []).filter(type => type && type !== 'LearningResource');
    }

    private getConceptLabel(concept: { prefLabel?: Record<string, string> } | undefined): string | undefined {
        if (!concept?.prefLabel) return undefined;
        const values = Object.values(concept.prefLabel);
        return values.length > 0 ? values[0] : undefined;
    }
}
