// src/lib/utils/ambPublisher.ts
/**
 * AMB (Adaptive Material Bundle) Publisher Service
 * Converts Kanban boards to AMB Learning Resources and publishes them to Nostr
 */

import { ambToNostr, type AmbLearningResource } from '@edufeed-org/amb-nostr-converter';
import type { Board } from '$lib/classes/BoardModel';
import { getSyncManager } from '$lib/stores/syncManager.svelte';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { makeDataUrl, sha256Hex } from '$lib/utils/ambEncoding';
import { cardToNostrEvent } from '$lib/utils/nostrEvents';

/**
 * Edufeed-specific relays for AMB event publishing
 * These relays are required for events to appear on edufeed.org
 */
const EDUFEED_RELAYS = [
    'wss://relay.edufeed.org',
    'wss://amb-relay.edufeed.org'
];

export interface AmbPublishOptions {
    /**
     * Nostr public key (hex format) of the publisher
     */
    pubkey: string;
    
    /**
     * Optional: Override the board title
     */
    title?: string;
    
    /**
     * Optional: Override the board description
     */
    description?: string;
    
    /**
     * Optional: Override tags
     */
    tags?: string[];
    
    /**
     * Optional: Override license
     */
    license?: string;
}

export interface AmbPublishResult {
    success: boolean;
    eventId?: string;
    error?: string;
    ambResource?: AmbLearningResource;
    /** nevent1 encoded ID with relay hints for direct lookup */
    neventUrl?: string;
    /** naddr1 encoded address for the AMB resource */
    naddrUrl?: string;
}

/**
 * Converts a Kanban Board to an AMB Learning Resource
 */
export function boardToAmbResource(
    board: Board,
    options: Partial<AmbPublishOptions> = {}
): AmbLearningResource {
    // Extract board metadata
    const boardData = board.getContextData(true);
    
    // Build the creator information
    const creator: any[] = [];
    if (board.author) {
        creator.push({
            type: 'Person',
            id: `nostr:${board.author}`, // Nostr pubkey as identifier
            name: board.authorName || board.author.substring(0, 8) + '...'
        });
    }
    
    // Map CC license to full URL
    const licenseUrl = mapCCLicenseToUrl(options.license || boardData.ccLicense || 'cc-by-4.0');
    
    // Build keywords from board tags and column names
    const keywords: string[] = [
        ...(options.tags || boardData.tags || []),
        ...boardData.columns.map(col => col.name)
    ];
    
    // Generate a unique ID for the resource
    const resourceId = `nostr:kanban:${board.id}`;
    
    // Build the AMB Learning Resource
    const ambResource: AmbLearningResource = {
        '@context': ['https://w3id.org/kim/amb/context.jsonld'],
        id: resourceId,
        type: ['LearningResource', 'kanbanBoard'], 
        name: options.title || boardData.name || 'Untitled Board',
        creator: creator.length > 0 ? creator : undefined,
        description: options.description || boardData.description || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
        license: {
            id: licenseUrl
        },
        // Additional metadata
        dateCreated: board.createdAt 
            ? (typeof board.createdAt === 'number' 
                ? new Date(board.createdAt * 1000).toISOString() 
                : new Date(board.createdAt).toISOString())
            : undefined,
        dateModified: boardData.updatedAt,
    };
    
    return ambResource;
}

/**
 * Publishes a board as an AMB Learning Resource to Nostr
 */
export async function publishBoardToEdufeed(
    board: Board,
    options: AmbPublishOptions
): Promise<AmbPublishResult> {
    try {
        // Enforce publish-state: only published boards may be shared to Edufeed
        const boardDataCheck = board.getContextData(true);
        if (boardDataCheck.publishState !== 'published') {
            return {
                success: false,
                error: "Das Board muss 'Veröffentlicht' sein, um auf Edufeed zu teilen. Setze den Veröffentlichungsstatus in den Boardeinstellungen auf \"veröffentlicht\" und versuche es erneut."
            };
        }
        // Convert board to AMB resource
        const ambResource = boardToAmbResource(board, options);
        
        // Convert AMB to Nostr event
        const result = ambToNostr(ambResource, {
            pubkey: options.pubkey
        });
        
        if (!result.success || !result.data) {
            return {
                success: false,
                error: 'Failed to convert AMB resource to Nostr event'
            };
        }
        
        // Get the Nostr event
        const nostrEvent = result.data;
        
        // Create NDKEvent for publishing
        const syncManager = getSyncManager();
        
        // Get NDK instance - syncManager should expose it or we get it from settings
        let ndk: NDK | null = null;
        try {
            // Try to access NDK through syncManager's public interface
            ndk = syncManager.ndk;
        } catch {
            return {
                success: false,
                error: 'NDK not accessible'
            };
        }
        
        if (!ndk) {
            return {
                success: false,
                error: 'NDK not initialized'
            };
        }
        
        // Publish snapshot (30303) with full board JSON, attach snapshot id + checksum to AMB tags
        try {
            const boardContext = board.getContextData(true);
            const snapshotEvent = new NDKEvent(ndk);
            snapshotEvent.kind = 30303;
            snapshotEvent.content = JSON.stringify(boardContext);
            // Include both 'd' tag (for replaceable events) and 'a' tag (for VersionHistory query)
            const boardAddressRef = `30301:${options.pubkey}:${board.id}`;
            snapshotEvent.tags = [
                ['d', board.id],
                ['a', boardAddressRef],  // Required for loadSnapshots() to find this snapshot
                ['v', 'Edufeed Publish'],  // Label for VersionHistory
                ['r', 'publish']  // Reason: published to Edufeed
            ];
            await snapshotEvent.sign();
            // Publish snapshot to Edufeed relays
            await syncManager.publishOrQueue(snapshotEvent, 'board', 'high', 'published', EDUFEED_RELAYS);

            const snapshotId = snapshotEvent.id;
            const snapshotSha = await sha256Hex(boardContext);

            // Ensure tags array exists and attach snapshot info
            nostrEvent.tags = nostrEvent.tags || [];
            if (snapshotId) {
                nostrEvent.tags.push(['snapshot-eventid', snapshotId]);
                nostrEvent.tags.push(['sha256', snapshotSha]);
            }
        } catch (err) {
            console.warn('Could not publish snapshot event:', err);
        }

        // ⚡ WICHTIG: Alle Cards auf Edufeed-Relays publizieren!
        // Ohne Cards erscheint das Board leer, da nur AMB + Board-Event nicht ausreichen.
        try {
            console.log('[AMBPublisher] 📤 Publishing all cards to Edufeed relays...');
            const boardRef = `30301:${options.pubkey}:${board.id}`;
            let publishedCardsCount = 0;
            
            for (const column of board.columns) {
                for (const card of column.cards) {
                    try {
                        const rank = column.cards.indexOf(card);
                        const cardEvent = cardToNostrEvent(
                            card,
                            column.id,
                            column.name,
                            rank,
                            boardRef,
                            ndk
                        );
                        
                        await syncManager.publishOrQueue(
                            cardEvent,
                            'card',
                            'normal',
                            'published',
                            EDUFEED_RELAYS
                        );
                        publishedCardsCount++;
                    } catch (cardErr) {
                        console.warn(`[AMBPublisher] ⚠️ Could not publish card ${card.id}:`, cardErr);
                    }
                }
            }
            console.log(`[AMBPublisher] ✅ Published ${publishedCardsCount} cards to Edufeed relays`);
        } catch (err) {
            console.warn('[AMBPublisher] ⚠️ Could not publish cards:', err);
        }

        // Attach board address tag ('a') as naddr if possible, otherwise as address string
        try {
            const naddr = nip19.naddrEncode({ kind: 30301, pubkey: options.pubkey, identifier: board.id, relays: [] });
            nostrEvent.tags = nostrEvent.tags || [];
            nostrEvent.tags.push(['a', naddr]);
        } catch (err) {
            nostrEvent.tags = nostrEvent.tags || [];
            nostrEvent.tags.push(['a', `30301:${options.pubkey}:${board.id}`]);
        }

        // Mark resource as published for downstream consumers
        nostrEvent.tags = nostrEvent.tags || [];
        nostrEvent.tags.push(['pub', 'published']);

        // Create NDKEvent for AMB and publish
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = nostrEvent.kind;
        ndkEvent.content = nostrEvent.content;
        ndkEvent.tags = nostrEvent.tags;
        ndkEvent.created_at = nostrEvent.created_at;

        // Sign the event
        await ndkEvent.sign();

        // Publish via sync manager to Edufeed relays
        await syncManager.publishOrQueue(ndkEvent, 'board', 'high', 'published', EDUFEED_RELAYS);

        console.log('✅ Published AMB Learning Resource to Nostr:', {
            eventId: ndkEvent.id,
            kind: ndkEvent.kind,
            boardId: board.id,
            resourceId: ambResource.id
        });

        // Generate URLs with relay hints for easy sharing
        let neventUrl: string | undefined;
        let naddrUrl: string | undefined;
        
        if (ndkEvent.id) {
            try {
                const nevent = nip19.neventEncode({
                    id: ndkEvent.id,
                    relays: EDUFEED_RELAYS,
                    author: options.pubkey
                });
                neventUrl = `https://njump.edufeed.org/${nevent}`;
            } catch (e) {
                console.warn('Could not encode nevent:', e);
            }
        }
        
        try {
            // d-tag for AMB is the resource ID (same as ambResource.id)
            const dTag = nostrEvent.tags?.find(t => t[0] === 'd')?.[1] || ambResource.id;
            const naddr = nip19.naddrEncode({
                kind: 30142,
                pubkey: options.pubkey,
                identifier: dTag,
                relays: EDUFEED_RELAYS
            });
            naddrUrl = `https://njump.edufeed.org/${naddr}`;
        } catch (e) {
            console.warn('Could not encode naddr:', e);
        }

        console.log('🔗 Share URLs:', { neventUrl, naddrUrl });

        return {
            success: true,
            eventId: ndkEvent.id,
            ambResource,
            neventUrl,
            naddrUrl
        };
        
    } catch (error) {
        console.error('❌ Error publishing to Edufeed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Maps Creative Commons license codes to full URLs
 */
function mapCCLicenseToUrl(license: string): string {
    const licenseMap: Record<string, string> = {
        'cc-by-4.0': 'https://creativecommons.org/licenses/by/4.0/',
        'cc-by-sa-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'cc-by-nc-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
        'cc-by-nc-sa-4.0': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        'cc-by-nd-4.0': 'https://creativecommons.org/licenses/by-nd/4.0/',
        'cc-by-nc-nd-4.0': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        'cc0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    };
    
    return licenseMap[license] || licenseMap['cc-by-4.0'];
}
