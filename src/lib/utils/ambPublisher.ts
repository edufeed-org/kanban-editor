// src/lib/utils/ambPublisher.ts
/**
 * AMB (Adaptive Material Bundle) Publisher Service
 * Converts Kanban boards to AMB Learning Resources and publishes them to Nostr
 */

import { ambToNostr, type AmbLearningResource } from '@edufeed-org/amb-nostr-converter';
import type { Board } from '$lib/classes/BoardModel';
import { getSyncManager } from '$lib/stores/syncManager.svelte';
import NDK, { NDKEvent } from '@nostr-dev-kit/ndk';

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
        type: ['LearningResource', 'Course'], // Kanban boards as courses
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
            // @ts-expect-error - accessing private property for now
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
        
        // Create event for publishing
        const ndkEvent = new NDKEvent(ndk);
        ndkEvent.kind = nostrEvent.kind;
        ndkEvent.content = nostrEvent.content;
        ndkEvent.tags = nostrEvent.tags;
        ndkEvent.created_at = nostrEvent.created_at;
        
        // Sign the event
        await ndkEvent.sign();
        
        // Publish via sync manager (handles offline queue)
        await syncManager.publishOrQueue(ndkEvent, 'board');
        
        console.log('✅ Published AMB Learning Resource to Nostr:', {
            eventId: ndkEvent.id,
            kind: ndkEvent.kind,
            boardId: board.id,
            resourceId: ambResource.id
        });
        
        return {
            success: true,
            eventId: ndkEvent.id,
            ambResource
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
