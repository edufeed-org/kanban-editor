/**
 * Nostr-Synchronisation für BoardStore
 * 
 * Enthält alle Nostr-bezogenen Operationen:
 * - publishBoardAsync, publishCardAsync
 * - subscribeToBoardUpdates
 * - handleBoardEvent, handleCardEvent
 */

import type NDK from '@nostr-dev-kit/ndk';
import type { Board } from '$lib/classes/BoardModel.js';
import { authStore } from '../authStore.svelte.js';
import { reconstructBoard } from './boardOperations.js';

/**
 * Published ein Board zu Nostr (Kind 30301)
 */
export async function publishBoardAsync(board: Board, ndk?: NDK): Promise<void> {
    if (!ndk) {
        console.warn('⚠️ NDK nicht initialisiert - Board kann nicht publiziert werden');
        return;
    }

    try {
        const { boardToNostrEvent } = await import('$lib/utils/nostrEvents.js');
        const event = boardToNostrEvent(board, ndk);
        
        console.log('[SyncManager] 📤 Publishing Board Event (30301)...');
        const relays = await event.publish();
        
        if (relays.size === 0) {
            throw new Error('No relays accepted the board event');
        }
        
        console.log(`[SyncManager] ✅ Board Event published to ${relays.size} relay(s)`);
    } catch (error) {
        console.error('[SyncManager] ❌ Error publishing board:', error);
        throw error;
    }
}

/**
 * Published eine Card zu Nostr (Kind 30302)
 */
export async function publishCardAsync(
    board: Board,
    cardId: string,
    ndk?: NDK
): Promise<void> {
    if (!ndk) {
        console.warn('⚠️ NDK nicht initialisiert - Card kann nicht publiziert werden');
        return;
    }

    try {
        const result = board.findCardAndColumn(cardId);
        if (!result) {
            console.warn(`⚠️ Card ${cardId} nicht gefunden - kann nicht publiziert werden`);
            return;
        }

        const { card, column } = result;
        const rank = column.cards.indexOf(card);
        const boardRef = `30301:${board.author}:${board.id}`;

        const { cardToNostrEvent } = await import('$lib/utils/nostrEvents.js');
        const event = cardToNostrEvent(card, column.name, rank, boardRef, ndk);
        
        console.log(`[SyncManager] 📤 Publishing Card Event (30302) for card ${cardId}...`);
        const relays = await event.publish();
        
        if (relays.size === 0) {
            throw new Error('No relays accepted the card event');
        }
        
        console.log(`[SyncManager] ✅ Card Event published to ${relays.size} relay(s)`);
    } catch (error) {
        console.error('[SyncManager] ❌ Error publishing card:', error);
        throw error;
    }
}

/**
 * Verarbeitet Board Events (Kind 30301) aus der Subscription
 */
export async function handleBoardEvent(
    event: any,
    boardIds: string[],
    onBoardUpdate: (boardId: string, board: Board) => void,
    onBoardIdsUpdate: (boardIds: string[]) => void
): Promise<void> {
    try {
        const { nostrEventToBoard } = await import('$lib/utils/nostrEvents.js');
        const boardProps = nostrEventToBoard(event);
        const boardId = boardProps.id;
        const storageKey = `kanban-${boardId}`;

        // Last-Write-Wins: Compare timestamps
        let acceptRemote = true;
        let mergedSource: any = boardProps;

        if (typeof window !== 'undefined') {
            const existingRaw = window.localStorage.getItem(storageKey);
            if (existingRaw) {
                try {
                    const existing = JSON.parse(existingRaw);
                    const localTs = existing.updatedAt
                        ? new Date(existing.updatedAt).getTime()
                        : existing.createdAt
                            ? new Date(existing.createdAt).getTime()
                            : 0;
                    const remoteTs = event.created_at ? event.created_at * 1000 : Date.now();

                    if (localTs && localTs > remoteTs) {
                        acceptRemote = false;
                        mergedSource = existing;
                    }
                } catch {
                    acceptRemote = true;
                }
            }
        }

        if (!acceptRemote) {
            // Only register board ID, don't update
            if (boardId && !boardIds.includes(boardId)) {
                const newBoardIds = [...boardIds, boardId];
                onBoardIdsUpdate(newBoardIds);
            }
            return;
        }

        // Merge Strategy: Update board metadata, preserve local cards
        const storedData = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
        const existingData = storedData;
        const remoteColumns = boardProps.columns || [];
        
        const mergedColumns = remoteColumns.map((remoteCol) => {
            const existingCol = existingData.columns?.find((col: any) => col.id === remoteCol.id);
            return {
                ...remoteCol,
                cards: existingCol?.cards || [],
            };
        });
        
        const mergedProps = {
            ...boardProps,
            columns: mergedColumns,
        };
        
        // Save merged board
        const contextBoard = reconstructBoard(mergedProps);
        const context = contextBoard.getContextData(true) as any;
        window.localStorage.setItem(storageKey, JSON.stringify(context));

        // Register board ID
        if (boardId && !boardIds.includes(boardId)) {
            const newBoardIds = [...boardIds, boardId];
            onBoardIdsUpdate(newBoardIds);
        }

        // Notify about board update (nur wenn boardId vorhanden)
        if (boardId) {
            onBoardUpdate(boardId, contextBoard);
        }
        
    } catch (err) {
        console.error('[BoardStore] ❌ Error processing board event:', err);
    }
}

/**
 * Verarbeitet Card Events (Kind 30302) aus der Subscription
 */
export async function handleCardEvent(
    event: any,
    onCardUpdate: (boardId: string) => void
): Promise<void> {
    try {
        const { nostrEventToCard } = await import('$lib/utils/nostrEvents.js');
        const cardProps = nostrEventToCard(event);
        
        // Extract board ID from 'a' tag
        const aTag = event.tags.find((t: any) => t[0] === 'a');
        if (!aTag) return;
        
        const boardRef = aTag[1];
        const boardId = boardRef.split(':')[2];
        
        // Load board from localStorage
        const storageKey = `kanban-${boardId}`;
        const storedRaw = localStorage.getItem(storageKey);
        if (!storedRaw) return;
        
        const storedData = JSON.parse(storedRaw);
        
        // Extract target column from 's' tag
        const sTag = event.tags.find((t: any) => t[0] === 's');
        const targetColumnName = sTag ? sTag[1] : null;
        const targetColumn = storedData.columns?.find((c: any) => c.name === targetColumnName);
        
        if (!targetColumn) {
            console.warn('[BoardStore] ⚠️ Target column not found:', targetColumnName);
            return;
        }
        
        // Upsert: Update existing or insert new card
        const existingCardIndex = targetColumn.cards?.findIndex((c: any) => c.id === cardProps.id) ?? -1;
        
        if (existingCardIndex >= 0) {
            targetColumn.cards[existingCardIndex] = cardProps;
            console.log('[BoardStore] ✅ Card updated in localStorage:', cardProps.id);
        } else {
            if (!targetColumn.cards) targetColumn.cards = [];
            targetColumn.cards.push(cardProps);
            console.log('[BoardStore] ✅ Card inserted in localStorage:', cardProps.id);
        }
        
        // Save back to localStorage
        localStorage.setItem(storageKey, JSON.stringify(storedData));
        
        // Notify about card update
        onCardUpdate(boardId);
        
    } catch (error) {
        console.error('[BoardStore] ❌ Error handling card event:', error);
    }
}

/**
 * Startet Subscription für Board- und Card-Updates
 */
export function subscribeToBoardUpdates(
    ndk: NDK,
    onBoardEvent: (event: any) => void,
    onCardEvent: (event: any) => void
): any {
    const pubkey = authStore.getPubkey();
    if (!pubkey) {
        console.warn('[BoardStore] ⚠️ Cannot subscribe without pubkey');
        return null;
    }
    
    console.log('[BoardStore] 🛰️ Subscribing to board AND card updates for pubkey:', pubkey);
    
    const sub = ndk.subscribe(
        {
            kinds: [30301, 30302] as number[],
            authors: [pubkey]
        } as any,
        { closeOnEose: false }
    );
    
    sub.on('event', async (event: any) => {
        if (event.kind === 30301) {
            onBoardEvent(event);
        } else if (event.kind === 30302) {
            onCardEvent(event);
        }
    });
    
    return sub;
}
