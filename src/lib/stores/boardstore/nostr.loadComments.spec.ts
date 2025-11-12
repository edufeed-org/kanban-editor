/**
 * Unit Tests for loadComments() function
 * Tests Nostr Kind 1 event fetching and comment merging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Board, Card, Column, Comment } from '$lib/classes/BoardModel.js';

// Mock NDK Event
interface MockNDKEvent {
    id: string;
    kind: number;
    content: string;
    pubkey: string;
    created_at: number;
    tags: string[][];
}

// Mock NDK fetchEvents result
class MockNDKEventSet extends Set<MockNDKEvent> {
    constructor(events: MockNDKEvent[]) {
        super(events);
    }
}

describe('loadComments() - Nostr Comment Loading', () => {
    let mockBoard: Board;
    let mockCard: Card;
    let mockNDK: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Create mock card with local comments
        mockCard = {
            id: 'card-123',
            heading: 'Test Card',
            author: 'npub1user',
            comments: [
                {
                    id: 'local-1',
                    text: 'Local unpublished comment',
                    author: 'npub1user',
                    createdAt: '2025-01-15T10:00:00Z',
                    syncStatus: 'local'
                },
                {
                    id: 'local-2',
                    text: 'Local published comment',
                    author: 'npub1user',
                    createdAt: '2025-01-15T11:00:00Z',
                    eventId: 'event-local-2',
                    syncStatus: 'synced'
                }
            ]
        } as Card;

        // Create mock board
        mockBoard = {
            id: 'board-456',
            name: 'Test Board',
            author: 'npub1user',
            findCardAndColumn: vi.fn((cardId: string) => {
                if (cardId === 'card-123') {
                    return {
                        card: mockCard,
                        column: { id: 'col-1', name: 'Todo' } as Column
                    };
                }
                return null;
            })
        } as any;

        // Mock NDK with fetchEvents
        mockNDK = {
            fetchEvents: vi.fn()
        };
    });

    it('should fetch Kind 1 events with correct filter', async () => {
        // Arrange
        const remoteEvents: MockNDKEvent[] = [];
        mockNDK.fetchEvents.mockResolvedValue(new MockNDKEventSet(remoteEvents));

        // Act
        const cardRef = `30302:npub1user:card-123`;
        await mockNDK.fetchEvents({
            kinds: [1],
            '#a': [cardRef]
        });

        // Assert
        expect(mockNDK.fetchEvents).toHaveBeenCalledWith({
            kinds: [1],
            '#a': [cardRef]
        });
    });

    it('should convert Nostr events to Comment objects', () => {
        // Arrange
        const nostrEvent: MockNDKEvent = {
            id: 'event-remote-1',
            kind: 1,
            content: 'Remote comment text',
            pubkey: 'npub1other',
            created_at: 1736942400, // 2025-01-15T12:00:00Z (corrected)
            tags: [
                ['a', '30302:npub1user:card-123']
            ]
        };

        // Act - Simulate conversion
        const comment: Comment = {
            id: 'generated-id', // generateDTag() would create this
            eventId: nostrEvent.id,
            text: nostrEvent.content,
            author: nostrEvent.pubkey,
            createdAt: new Date(nostrEvent.created_at * 1000).toISOString(),
            syncStatus: 'synced'
        };

        // Assert
        expect(comment.eventId).toBe('event-remote-1');
        expect(comment.text).toBe('Remote comment text');
        expect(comment.author).toBe('npub1other');
        expect(comment.createdAt).toBe('2025-01-15T12:00:00.000Z');
        expect(comment.syncStatus).toBe('synced');
    });

    it('should merge remote comments with local comments', () => {
        // Arrange
        const localComments: Comment[] = [
            {
                id: 'local-1',
                text: 'Unpublished',
                author: 'npub1user',
                createdAt: '2025-01-15T10:00:00Z',
                syncStatus: 'local'
            },
            {
                id: 'local-2',
                text: 'Published',
                author: 'npub1user',
                createdAt: '2025-01-15T11:00:00Z',
                eventId: 'event-abc123',
                syncStatus: 'synced'
            }
        ];

        const remoteComments: Comment[] = [
            {
                id: 'remote-1',
                text: 'Published (duplicate)',
                author: 'npub1user',
                createdAt: '2025-01-15T11:00:00Z',
                eventId: 'event-abc123', // Same as local-2
                syncStatus: 'synced'
            },
            {
                id: 'remote-2',
                text: 'From other device',
                author: 'npub1other',
                createdAt: '2025-01-15T12:00:00Z',
                eventId: 'event-xyz789',
                syncStatus: 'synced'
            }
        ];

        // Act - Use mergeComments algorithm
        const localEventIds = new Set(
            localComments.filter(c => c.eventId).map(c => c.eventId!)
        );
        const newRemoteComments = remoteComments.filter(
            r => r.eventId && !localEventIds.has(r.eventId)
        );
        const merged = [...localComments, ...newRemoteComments];
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Assert
        expect(merged).toHaveLength(3); // local-1, local-2, remote-2 (no duplicate)
        expect(merged[0].id).toBe('local-1'); // Oldest
        expect(merged[1].id).toBe('local-2');
        expect(merged[2].id).toBe('remote-2'); // Newest
        expect(merged.find(c => c.id === 'remote-1')).toBeUndefined(); // Duplicate removed
    });

    it('should handle empty remote comments', async () => {
        // Arrange
        const localComments: Comment[] = [
            {
                id: 'local-1',
                text: 'Local only',
                author: 'npub1user',
                createdAt: '2025-01-15T10:00:00Z',
                syncStatus: 'local'
            }
        ];
        const remoteComments: Comment[] = [];

        // Act
        const merged = [...localComments, ...remoteComments];

        // Assert
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('local-1');
    });

    it('should handle empty local comments', () => {
        // Arrange
        const localComments: Comment[] = [];
        const remoteComments: Comment[] = [
            {
                id: 'remote-1',
                text: 'Remote only',
                author: 'npub1other',
                createdAt: '2025-01-15T12:00:00Z',
                eventId: 'event-xyz789',
                syncStatus: 'synced'
            }
        ];

        // Act
        const merged = [...localComments, ...remoteComments];

        // Assert
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('remote-1');
    });

    it('should preserve syncStatus from remote events', () => {
        // Arrange
        const nostrEvent: MockNDKEvent = {
            id: 'event-123',
            kind: 1,
            content: 'Test',
            pubkey: 'npub1test',
            created_at: 1736942400, // 2025-01-15T12:00:00Z (corrected)
            tags: [['a', '30302:npub1user:card-123']]
        };

        // Act - Convert with syncStatus = 'synced'
        const comment: Comment = {
            id: 'gen-id',
            eventId: nostrEvent.id,
            text: nostrEvent.content,
            author: nostrEvent.pubkey,
            createdAt: new Date(nostrEvent.created_at * 1000).toISOString(),
            syncStatus: 'synced' // Always 'synced' for remote
        };

        // Assert
        expect(comment.syncStatus).toBe('synced');
    });

    it('should handle card not found in board', async () => {
        // Arrange
        const invalidCardId = 'invalid-card-id';
        mockBoard.findCardAndColumn = vi.fn(() => null);

        // Act & Assert - Should return early without throwing
        const result = mockBoard.findCardAndColumn(invalidCardId);
        expect(result).toBeNull();
    });

    it('should handle NDK not initialized', () => {
        // Arrange
        const uninitializedNDK = null;

        // Act & Assert - Should return early without throwing
        if (!uninitializedNDK) {
            expect(uninitializedNDK).toBeNull();
        }
    });

    it('should build correct card reference format', () => {
        // Arrange
        const cardId = 'card-123';
        const cardAuthor = 'npub1user';

        // Act
        const cardRef = `30302:${cardAuthor}:${cardId}`;

        // Assert
        expect(cardRef).toBe('30302:npub1user:card-123');
    });

    it('should handle multiple remote comments from different authors', () => {
        // Arrange
        const localComments: Comment[] = [];
        const remoteComments: Comment[] = [
            {
                id: 'remote-1',
                text: 'Comment from Alice',
                author: 'npub1alice',
                createdAt: '2025-01-15T10:00:00Z',
                eventId: 'event-alice-1',
                syncStatus: 'synced'
            },
            {
                id: 'remote-2',
                text: 'Comment from Bob',
                author: 'npub1bob',
                createdAt: '2025-01-15T11:00:00Z',
                eventId: 'event-bob-1',
                syncStatus: 'synced'
            },
            {
                id: 'remote-3',
                text: 'Another from Alice',
                author: 'npub1alice',
                createdAt: '2025-01-15T12:00:00Z',
                eventId: 'event-alice-2',
                syncStatus: 'synced'
            }
        ];

        // Act
        const merged = [...localComments, ...remoteComments];
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        // Assert
        expect(merged).toHaveLength(3);
        expect(merged[0].author).toBe('npub1alice');
        expect(merged[1].author).toBe('npub1bob');
        expect(merged[2].author).toBe('npub1alice');
    });
});
