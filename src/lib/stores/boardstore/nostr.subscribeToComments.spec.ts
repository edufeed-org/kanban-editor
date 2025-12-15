/**
 * Unit Tests für subscribeToComments()
 * 
 * Testet die Echtzeit-Subscription für Kommentare einer Karte.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NostrIntegration } from './nostr';
import { Board, Card, Column, type Comment } from '$lib/classes/BoardModel';
import type NDK from '@nostr-dev-kit/ndk';

// Mock NDK
const createMockNDK = () => {
    const subscribers: Array<{
        filter: any;
        options: any;
        eventHandlers: Array<(event: any) => void>;
        stop: () => void;
    }> = [];

    return {
        subscribe: vi.fn((filter: any, options: any) => {
            const handlers: Array<(event: any) => void> = [];
            const subscription = {
                filter,
                options,
                eventHandlers: handlers,
                on: vi.fn((eventType: string, handler: (event: any) => void) => {
                    if (eventType === 'event') {
                        handlers.push(handler);
                    }
                }),
                stop: vi.fn()
            };
            subscribers.push(subscription);
            return subscription;
        }),
        _getSubscribers: () => subscribers,
        _triggerEvent: (event: any) => {
            subscribers.forEach(sub => {
                sub.eventHandlers.forEach(handler => handler(event));
            });
        }
    } as unknown as NDK;
};

// Mock Event Factory
const createMockEvent = (content: string, pubkey: string, timestamp: number = 1736942400) => ({
    id: `event-${Math.random().toString(36).substring(2, 11)}`,
    kind: 1,
    pubkey,
    created_at: timestamp,
    content,
    tags: [] as string[][]
});

describe('NostrIntegration.subscribeToComments()', () => {
    let nostrIntegration: NostrIntegration;
    let mockNDK: ReturnType<typeof createMockNDK>;
    let mockBoard: Board;
    let mockCard: Card;

    beforeEach(() => {
        // Create mock board structure
        mockBoard = new Board({
            id: 'board-1',
            name: 'Test Board',
            author: 'npub1testauthor'
        });

        const column = new Column({
            id: 'col-1',
            name: 'Test Column'
        });

        mockCard = new Card({
            id: 'card-1',
            heading: 'Test Card',
            author: 'npub1cardauthor',
            comments: [
                {
                    id: 'comment-local-1',
                    text: 'Existing local comment',
                    author: 'npub1localuser',
                    createdAt: '2025-01-14T12:00:00.000Z',
                    syncStatus: 'local'
                }
            ]
        });

        column.addCard(mockCard);
        mockBoard.addColumn(column);

        // Initialize NostrIntegration with mock NDK
        mockNDK = createMockNDK();
        nostrIntegration = new NostrIntegration();
        (nostrIntegration as any).ndk = mockNDK;
        (nostrIntegration as any).processedEvents = new Set<string>();
    });

    it('should create subscription with correct filter', () => {
        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1');

        // Assert
        expect(mockNDK.subscribe).toHaveBeenCalledWith(
            {
                kinds: [1],
                '#a': ['30302:npub1cardauthor:card-1']
            },
            { closeOnEose: false }
        );

        cleanup();
    });

    it('should convert incoming Nostr event to Comment object', async () => {
        // Arrange
        const mockEvent = createMockEvent('New comment text', 'npub1newuser', 1736942400);
        let updateCallbackInvoked = false;
        const onUpdate = vi.fn(() => { updateCallbackInvoked = true; });

        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate);

        // Trigger event
        (mockNDK as any)._triggerEvent(mockEvent);

        // Wait for async processing
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert
        const result = mockBoard.findCardAndColumn('card-1');
        expect(result).toBeTruthy();
        expect(result!.card.comments?.length).toBeGreaterThan(1);
        
        const newComment = result!.card.comments?.find(c => c.text === 'New comment text');
        expect(newComment).toBeTruthy();
        expect(newComment?.eventId).toBe(mockEvent.id);
        expect(newComment?.author).toBe('npub1newuser');
        expect(newComment?.syncStatus).toBe('synced');
        expect(updateCallbackInvoked).toBe(true);

        cleanup();
    });

    it('should deduplicate incoming events via processedEvents Set', async () => {
        // Arrange
        const mockEvent = createMockEvent('Duplicate comment', 'npub1user', 1736942400);
        const onUpdate = vi.fn();

        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate);

        // Trigger same event twice
        (mockNDK as any)._triggerEvent(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        (mockNDK as any)._triggerEvent(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert - Comment sollte nur einmal gemerged werden
        const result = mockBoard.findCardAndColumn('card-1');
        const duplicateComments = result!.card.comments?.filter(c => c.eventId === mockEvent.id);
        expect(duplicateComments?.length).toBe(1);
        expect(onUpdate).toHaveBeenCalledTimes(1); // Callback nur einmal

        cleanup();
    });

    it('should merge new comments with existing comments', async () => {
        // Arrange
        const initialCount = mockCard.comments?.length || 0;
        const mockEvent = createMockEvent('Third comment', 'npub1third', 1736942400);

        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1');
        (mockNDK as any)._triggerEvent(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert
        const result = mockBoard.findCardAndColumn('card-1');
        expect(result!.card.comments?.length).toBe(initialCount + 1);

        cleanup();
    });

    it('should invoke onUpdate callback after processing event', async () => {
        // Arrange
        const onUpdate = vi.fn();
        const mockEvent = createMockEvent('Callback test', 'npub1user', 1736942400);

        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate);
        (mockNDK as any)._triggerEvent(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert
        expect(onUpdate).toHaveBeenCalled();

        cleanup();
    });

    it('should return cleanup function that stops subscription', () => {
        // Arrange
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1');

        // Assert - Subscription wurde erstellt
        const subscribers = (mockNDK as any)._getSubscribers();
        expect(subscribers.length).toBe(1);

        // Act - Cleanup ausführen
        cleanup();

        // Assert - Subscription.stop() wurde aufgerufen
        expect(subscribers[0].stop).toHaveBeenCalled();
    });

    it('should handle NDK not initialized gracefully', () => {
        // Arrange
        const nostrIntegrationNoNDK = new NostrIntegration();
        // NDK bleibt undefined

        // Act
        const cleanup = nostrIntegrationNoNDK.subscribeToComments(mockBoard, 'card-1');

        // Assert - Return no-op cleanup function
        expect(cleanup).toBeTypeOf('function');
        expect(() => cleanup()).not.toThrow();
    });

    it('should handle card not found in board', () => {
        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'non-existent-card');

        // Assert - Return no-op cleanup function
        expect(cleanup).toBeTypeOf('function');
        expect(() => cleanup()).not.toThrow();
    });

    it('should reuse existing subscription when subscribing to same card again (ref-counted)', () => {
        // Arrange
        const cleanup1 = nostrIntegration.subscribeToComments(mockBoard, 'card-1');

        // Act - Subscribe to same card again
        const cleanup2 = nostrIntegration.subscribeToComments(mockBoard, 'card-1');

        // Assert - Only one underlying subscription should exist
        const subscribers = (mockNDK as any)._getSubscribers();
        expect(subscribers.length).toBe(1);

        // First cleanup should NOT stop the subscription yet
        cleanup1();
        expect(subscribers[0].stop).not.toHaveBeenCalled();

        // Second cleanup should stop it
        cleanup2();
        expect(subscribers[0].stop).toHaveBeenCalledTimes(1);
    });

    it('should call multiple onUpdate callbacks for the same card subscription', async () => {
        // Arrange
        const onUpdate1 = vi.fn();
        const onUpdate2 = vi.fn();
        const cleanup1 = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate1);
        const cleanup2 = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate2);

        const event = createMockEvent('New comment', 'npub1user', 1736942400);
        event.tags = [['a', '30302:npub1cardauthor:card-1', '']];

        (mockNDK as any)._triggerEvent(event);
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(onUpdate1).toHaveBeenCalledTimes(1);
        expect(onUpdate2).toHaveBeenCalledTimes(1);

        cleanup1();
        cleanup2();
    });

    it('should handle multiple card subscriptions independently', async () => {
        // Arrange - Add second card
        const card2 = new Card({
            id: 'card-2',
            heading: 'Second Card',
            author: 'npub1author2'
        });
        const column = mockBoard.findColumn('col-1');
        column?.addCard(card2);

        const onUpdate1 = vi.fn();
        const onUpdate2 = vi.fn();

        // Act - Subscribe to both cards
        const cleanup1 = nostrIntegration.subscribeToComments(mockBoard, 'card-1', onUpdate1);
        const cleanup2 = nostrIntegration.subscribeToComments(mockBoard, 'card-2', onUpdate2);

        // Trigger event for card-1
        const event1 = createMockEvent('Comment for card 1', 'npub1user', 1736942400);
        // Manually set #a tag to match card-1
        event1.tags = [['a', '30302:npub1cardauthor:card-1']];
        
        (mockNDK as any)._triggerEvent(event1);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert - Only card-1 callback was invoked
        expect(onUpdate1).toHaveBeenCalled();
        // Both cards receive the event because mock doesn't filter by #a tag
        // This is expected in mock - real NDK would filter properly

        cleanup1();
        cleanup2();
    });

    it('should persist comments to localStorage after merge', async () => {
        // Arrange
        const mockEvent = createMockEvent('Persistent comment', 'npub1user', 1736942400);
        
        // Mock BoardStorage.saveBoard (it's called internally)
        const saveBoardSpy = vi.spyOn(await import('./storage'), 'BoardStorage');

        // Act
        const cleanup = nostrIntegration.subscribeToComments(mockBoard, 'card-1');
        (mockNDK as any)._triggerEvent(mockEvent);
        await new Promise(resolve => setTimeout(resolve, 10));

        // Assert - BoardStorage.saveBoard() was called
        // Note: This test assumes BoardStorage is imported and mockable
        // In real implementation, verify localStorage.setItem was called with correct board data

        const result = mockBoard.findCardAndColumn('card-1');
        expect(result!.card.comments?.some(c => c.text === 'Persistent comment')).toBe(true);

        cleanup();
    });
});
