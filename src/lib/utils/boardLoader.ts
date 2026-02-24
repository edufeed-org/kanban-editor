/**
 * boardLoader.ts
 * 
 * Shared utility for loading boards from Nostr sources
 * Used by both demo board loading and viewer board loading
 * to ensure consistent behavior
 */

import type NDK from '@nostr-dev-kit/ndk';
import { NDKRelay } from '@nostr-dev-kit/ndk';
import { Board, Card, type CardProps } from '$lib/classes/BoardModel.js';
import { generateDTag } from './idGenerator.js';

export interface BoardLoadOptions {
    /**
     * If true, generates new IDs for board, columns, and cards (for demo board copy)
     * If false, keeps original IDs (for viewer mode)
     */
    generateNewIds: boolean;
    
    /**
     * Override for board ID (e.g., 'demo-board')
     */
    overrideBoardId?: string;
    
    /**
     * Override for author (e.g., '0000...0000' for demo)
     */
    overrideAuthor?: string;
    
    /**
     * Override for author name
     */
    overrideAuthorName?: string;
}

/**
 * Connect to relay hints from naddr
 */
async function connectToRelayHints(ndk: NDK, relays: string[]): Promise<void> {
    if (relays.length === 0) {
        console.log('ℹ️ No relay hints in naddr');
        return;
    }

    console.log(`🔌 Connecting to ${relays.length} relay hints:`, relays);
    
    for (const relayUrl of relays) {
        try {
            // Check if relay is already connected
            const existingRelay = ndk.pool.relays.get(relayUrl);
            if (existingRelay?.connectivity?.status === 1) {
                console.log(`✅ Relay already connected: ${relayUrl}`);
                continue;
            }
            
            // NDKRelay requires 3 arguments: url, authPolicy, ndk
            const relay = new NDKRelay(relayUrl, undefined, ndk);
            ndk.pool.addRelay(relay, true);
            console.log(`🔌 Relay added: ${relayUrl}`);
        } catch (error) {
            console.warn(`⚠️ Could not connect to relay: ${relayUrl}`, error);
        }
    }
    
    // Wait briefly for relays to connect
    await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Load a board from Nostr by pubkey and identifier
 * 
 * @param ndk - NDK instance
 * @param pubkey - Author's public key
 * @param identifier - Board d-tag identifier
 * @param relays - Optional relay hints
 * @param options - Loading options (new IDs vs original IDs)
 * @returns Loaded board or null
 */
export async function loadBoardFromNostr(
    ndk: NDK,
    pubkey: string,
    identifier: string,
    relays: string[] = [],
    options: BoardLoadOptions = { generateNewIds: false }
): Promise<Board | null> {
    console.log('🚀 [boardLoader] Starting board load:', { 
        pubkey: pubkey.slice(0, 8) + '...', 
        identifier, 
        relays: relays.length,
        generateNewIds: options.generateNewIds 
    });
    
    try {
        // Connect to relay hints if provided
        if (relays.length > 0) {
            console.log('🔌 [boardLoader] Connecting to relay hints...');
            await connectToRelayHints(ndk, relays);
        }
        
        // Load board event
        console.log('🔍 [boardLoader] Fetching board event...');
        
        const filter = {
            kinds: [30301],
            authors: [pubkey],
            '#d': [identifier]
        };

        const boardEvent = await ndk.fetchEvent(filter);
        
        if (!boardEvent) {
            console.error('❌ [boardLoader] Board event not found');
            return null;
        }

        console.log('✅ [boardLoader] Board event found:', boardEvent.id);

        // Convert event to board
        console.log('📦 [boardLoader] Converting event to board...');
        const { nostrEventToBoard } = await import('./nostrEvents.js');
        const boardProps = nostrEventToBoard(boardEvent);
        
        if (!boardProps || !boardProps.id) {
            console.error('❌ [boardLoader] Invalid board props after conversion');
            return null;
        }
        
        console.log(`📋 Board has ${boardProps.columns?.length || 0} columns:`, 
            boardProps.columns?.map(c => `${c.name} (${c.id})`) || []);

        // Apply ID overrides if specified
        if (options.generateNewIds) {
            console.log('🆔 [boardLoader] Generating new IDs for demo board...');
            boardProps.id = options.overrideBoardId || generateDTag();
            
            // Generate new IDs for columns
            if (boardProps.columns) {
                const oldToNewColumnIds = new Map<string, string>();
                boardProps.columns = boardProps.columns.map(col => {
                    const newId = generateDTag();
                    oldToNewColumnIds.set(col.id || '', newId);
                    return {
                        ...col,
                        id: newId,
                        cards: [] // Cards will be added separately
                    };
                });
                console.log(`✅ [boardLoader] Generated ${boardProps.columns.length} new column IDs`);
            }
        }
        
        // Apply author overrides
        if (options.overrideAuthor) {
            boardProps.author = options.overrideAuthor;
        }
        if (options.overrideAuthorName) {
            boardProps.authorName = options.overrideAuthorName;
        }
        
        // Ensure publishState is set
        if (!boardProps.publishState) {
            boardProps.publishState = 'private';
        }

        // Create board instance
        console.log('🏗️ [boardLoader] Creating board instance...');
        const board = new Board(boardProps);
        console.log(`✅ [boardLoader] Board created with ${board.columns.length} columns`);

        // Load cards for the board
        const aTagValue = `30301:${pubkey}:${identifier}`;
        const cardFilter = {
            kinds: [30302],
            '#a': [aTagValue]
        };

        console.log('🔍 [boardLoader] Loading card events for:', aTagValue);
        const cardEvents = await ndk.fetchEvents(cardFilter);
        const cardEventArray = Array.from(cardEvents);
        
        console.log(`✅ [boardLoader] ${cardEventArray.length} card events found`);

        if (cardEventArray.length === 0) {
            console.log('ℹ️ [boardLoader] No cards to load, returning empty board');
            return board;
        }

        // Convert events to cards and add them to board
        console.log('📦 [boardLoader] Converting card events...');
        const { nostrEventToCard } = await import('./nostrEvents.js');
        
        for (const cardEvent of cardEventArray) {
            try {
                const cardProps = nostrEventToCard(cardEvent as any) as CardProps & { columnName?: string };
                if (!cardProps.id) {
                    console.warn('⚠️ [boardLoader] Skipping card without ID');
                    continue;
                }

                // Find or create column (columnName comes from nostrEventToCard)
                const columnName = cardProps.columnName || 'To Do';
                let column = board.columns.find(c => c.name === columnName);
                
                if (!column) {
                    // Column doesn't exist in board event, create it
                    console.log(`📁 [boardLoader] Creating missing column: ${columnName}`);
                    column = board.addColumn({ name: columnName });
                }

                // Generate new IDs for demo board copy
                if (options.generateNewIds) {
                    cardProps.id = generateDTag();
                    if (options.overrideAuthor) {
                        cardProps.author = options.overrideAuthor;
                    }
                    if (options.overrideAuthorName) {
                        cardProps.authorName = options.overrideAuthorName;
                    }
                }

                // Check if card already exists (only relevant for non-demo boards)
                const existingCard = column.findCard(cardProps.id);
                if (existingCard && !options.generateNewIds) {
                    // Update existing card (Last-Write-Wins)
                    const existingTime = existingCard.updatedAt ? new Date(existingCard.updatedAt).getTime() : 0;
                    const newTime = cardProps.updatedAt ? new Date(cardProps.updatedAt).getTime() : 0;
                    
                    if (newTime > existingTime) {
                        existingCard.update(cardProps);
                    }
                } else {
                    // Add new card
                    // CRITICAL: Use push() not addCard() to avoid array reassignment issues
                    const card = new Card(cardProps);
                    column.cards.push(card);
                }
            } catch (error) {
                console.warn('⚠️ [boardLoader] Error processing card event:', error);
            }
        }

        // ⚡ CRITICAL: Sort cards by rank per column!
        // ndk.fetchEvents() returns a Set without guaranteed order.
        // Without sorting, card order depends on which relay responds first
        // → different order on different browsers.
        console.log('🔄 [boardLoader] Sorting cards by rank...');
        for (const column of board.columns) {
            column.cards.sort((a: any, b: any) => {
                const rankA = a.rank ?? Number.MAX_SAFE_INTEGER;
                const rankB = b.rank ?? Number.MAX_SAFE_INTEGER;
                return rankA - rankB;
            });
        }
        
        const totalCards = board.columns.reduce((sum, col) => sum + col.cards.length, 0);
        console.log(`✅ [boardLoader] Board loaded successfully: ${board.columns.length} columns, ${totalCards} cards`);
        
        return board;
    } catch (error) {
        console.error('❌ [boardLoader] Error loading board from Nostr:', error);
        console.error('❌ [boardLoader] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        return null;
    }
}
