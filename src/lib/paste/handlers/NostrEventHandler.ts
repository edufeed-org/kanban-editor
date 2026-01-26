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
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

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

            const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] };
            const filter = {
                kinds: [data.kind],
                authors: [data.pubkey],
                '#d': [data.identifier]
            };

            console.log('🔍 naddr decoded:', { kind: data.kind, pubkey: data.pubkey.substring(0, 16), identifier: data.identifier, relays: data.relays });

            // Versuche zuerst mit den Relay-Hints aus dem naddr
            if (data.relays && data.relays.length > 0) {
                console.log('🔍 Trying relay hints:', data.relays);
                for (const relayUrl of data.relays) {
                    try {
                        // Prüfe ob Relay bereits verbunden ist
                        const existingRelay = ndk.pool.relays.get(relayUrl);
                        if (!existingRelay) {
                            // Relay nicht im Pool, verbinden und warten
                            console.log('🔍 Connecting to relay:', relayUrl);
                            const relay = await ndk.addExplicitRelay(relayUrl);
                            // Warte auf Verbindung mit Timeout
                            await new Promise<void>((resolve) => {
                                const timeout = setTimeout(() => {
                                    console.log('🔍 Relay connection timeout, continuing...');
                                    resolve();
                                }, 3000);
                                
                                relay.on('connect', () => {
                                    console.log('🔍 Relay connected:', relayUrl);
                                    clearTimeout(timeout);
                                    resolve();
                                });
                                
                                // Falls bereits verbunden
                                if (relay.status === 1) { // WebSocket.OPEN
                                    clearTimeout(timeout);
                                    resolve();
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('⚠️ Relay hinzufügen fehlgeschlagen:', relayUrl, e);
                    }
                }
            }

            const event = await ndk.fetchEvent(filter as any);
            console.log('🔍 fetchEvent result:', event ? `kind=${event.kind}` : 'null');
            if (!event) return null;

            return event.rawEvent() as NostrEvent;
        } catch (error) {
            console.warn('⚠️ Nostr naddr fetch fehlgeschlagen:', error);
            return null;
        }
    }

    private async createCardUpdates(identifier: string, type: string, context: PasteContext) {
        const nostrWebUrl = this.getNostrWebUrl(identifier);
        const ndk = context.ndk;

        console.log('🔍 createCardUpdates:', { identifier: identifier.substring(0, 20), type, hasNdk: !!ndk });

        if (type === 'Addressable Event' && ndk) {
            console.log('🔍 Fetching naddr event...');
            const event = await this.fetchEventFromNaddr(identifier, ndk);
            console.log('🔍 Fetched event:', event ? 'found' : 'null');
            if (event) {
                console.log('🔍 Event details:', { 
                    kind: event.kind, 
                    pubkey: event.pubkey?.substring(0, 16),
                    tagsCount: event.tags?.length,
                    contentLen: event.content?.length,
                    hasCreatedAt: !!event.created_at
                });
                console.log('🔍 Event tags:', event.tags?.map(t => `${t[0]}=${t[1]?.substring(0, 30)}`));
                
                // Versuche AMB Konvertierung
                try {
                    const ambResult = nostrToAmb(event, { defaultLanguage: 'de' });
                    console.log('🔍 AMB conversion:', ambResult.success ? 'success' : 'failed', ambResult.success ? ambResult.data?.name : ambResult.error);
                    if (ambResult.success && ambResult.data) {
                        return this.createAmbCardUpdates(ambResult.data, identifier, context);
                    }
                } catch (conversionError) {
                    console.error('🔍 AMB conversion error:', conversionError);
                }
                
                // Fallback: Extrahiere Daten direkt aus Event-Tags
                console.log('🔍 Using fallback: extracting from tags directly');
                const resource = this.extractResourceFromTags(event);
                if (resource.name) {
                    return this.createAmbCardUpdates(resource, identifier, context);
                }
            }
        }

        if (context.target === 'card') {
            return {
                content: `\n\n## Nostr ${type}\n\n[${identifier.substring(0, 20)}...](${nostrWebUrl})`,
                labels: ['nostr', type.toLowerCase()],
                links: [{
                    id: crypto.randomUUID(),
                    url: nostrWebUrl,
                    title: `Nostr ${type}`
                }]
            };
        }

        return {
            heading: `Nostr ${type}`,
            content: `[${identifier}](${nostrWebUrl})\n\nIdentifier: \`${identifier}\``,
            labels: ['nostr', type.toLowerCase()],
            links: [{
                id: crypto.randomUUID(),
                url: nostrWebUrl,
                title: `Nostr ${type}`
            }]
        };
    }

    private createAmbCardUpdates(resource: AmbLearningResource, identifier: string, context: PasteContext) {
        const nostrWebUrl = this.getNostrWebUrl(identifier);
        const heading = resource.name || 'AMB Learning Resource';
        const content = this.formatAmbContent(resource);
        const labels = this.collectLabels(resource);
        const links = this.collectLinks(resource, nostrWebUrl);

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

    private formatAmbContent(resource: AmbLearningResource): string {
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

    private collectLinks(resource: AmbLearningResource, nostrWebUrl: string) {
        const links = [{
            id: crypto.randomUUID(),
            url: nostrWebUrl,
            title: 'Nostr Event (njump)'
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

    /**
     * Erzeugt eine Web-URL für einen Nostr-Identifier
     * Verwendet konfigurierbare njump-Instanz (default: njump.edufeed.org)
     */
    private getNostrWebUrl(identifier: string): string {
        const njumpUrl = settingsStore.settings.njumpUrl || 'https://njump.edufeed.org';
        // Entferne trailing slash falls vorhanden
        const baseUrl = njumpUrl.replace(/\/$/, '');
        return `${baseUrl}/${identifier}`;
    }

    private getResourceTypes(resource: AmbLearningResource): string[] {
        return (resource.type || []).filter(type => type && type !== 'LearningResource');
    }

    private getConceptLabel(concept: { prefLabel?: Record<string, string> } | undefined): string | undefined {
        if (!concept?.prefLabel) return undefined;
        const values = Object.values(concept.prefLabel);
        return values.length > 0 ? values[0] : undefined;
    }

    /**
     * Fallback: Extrahiert AMB-Daten direkt aus Event-Tags wenn nostrToAmb fehlschlägt
     */
    private extractResourceFromTags(event: NostrEvent): AmbLearningResource {
        const getTag = (name: string): string | undefined => {
            const tag = event.tags?.find(t => t[0] === name);
            return tag?.[1];
        };

        const getTagsByPrefix = (prefix: string): Array<{ key: string; value: string }> => {
            return (event.tags || [])
                .filter(t => t[0].startsWith(prefix))
                .map(t => ({ key: t[0], value: t[1] }));
        };

        // Extrahiere Basis-Felder
        const name = getTag('name') || getTag('title');
        const description = getTag('description') || getTag('summary');
        const image = getTag('image');
        const inLanguage = getTag('inLanguage');
        const licenseId = getTag('license:id');
        const isAccessibleForFree = getTag('isAccessibleForFree');

        // Extrahiere creator
        const creatorName = getTag('creator:name');
        const creatorType = getTag('creator:type') as 'Person' | 'Organization' | undefined;
        const creator: AmbLearningResource['creator'] = creatorName ? [{
            type: creatorType === 'Organization' ? 'Organization' : 'Person',
            name: creatorName
        }] : undefined;

        // Extrahiere learningResourceType
        const lrtId = getTag('learningResourceType:id');
        const lrtPrefLabel = getTagsByPrefix('learningResourceType:prefLabel')
            .reduce((acc, { key, value }) => {
                const lang = key.split(':')[2] || 'de';
                acc[lang] = value;
                return acc;
            }, {} as Record<string, string>);
        
        const learningResourceType: AmbLearningResource['learningResourceType'] = lrtId ? [{
            id: lrtId,
            prefLabel: Object.keys(lrtPrefLabel).length > 0 ? lrtPrefLabel : undefined
        }] : undefined;

        // Extrahiere about (Themen)
        const aboutTags = getTagsByPrefix('about:');
        const aboutMap = new Map<string, { id: string; prefLabel: Record<string, string> }>();
        for (const { key, value } of aboutTags) {
            const parts = key.split(':');
            if (parts[1] === 'id') {
                const existing = aboutMap.get(value) || { id: value, prefLabel: {} };
                existing.id = value;
                aboutMap.set(value, existing);
            } else if (parts[1] === 'prefLabel') {
                // Finde passende ID oder erstelle neuen Eintrag
                const lang = parts[2] || 'de';
                // Suche existierenden Eintrag
                let found = false;
                for (const entry of aboutMap.values()) {
                    if (!entry.prefLabel[lang]) {
                        entry.prefLabel[lang] = value;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    aboutMap.set(value, { id: value, prefLabel: { [lang]: value } });
                }
            }
        }
        const about: AmbLearningResource['about'] = aboutMap.size > 0 ? Array.from(aboutMap.values()) : undefined;

        // Parse content für zusätzliche Daten
        let contentData: { id?: string } = {};
        if (event.content) {
            try {
                contentData = JSON.parse(event.content);
            } catch {
                // Content ist kein JSON
            }
        }

        const resource: AmbLearningResource = {
            '@context': ['https://w3id.org/kim/amb/context.jsonld'],
            type: ['LearningResource'],
            id: contentData.id || '',
            name: name || '',
            description,
            image,
            inLanguage: inLanguage ? [inLanguage] : undefined,
            creator,
            learningResourceType,
            about,
            license: licenseId ? { id: licenseId } : undefined,
            isAccessibleForFree: isAccessibleForFree === 'true'
        };

        console.log('🔍 Extracted resource:', { name: resource.name, hasImage: !!resource.image, hasCreator: !!resource.creator });
        return resource;
    }
}
