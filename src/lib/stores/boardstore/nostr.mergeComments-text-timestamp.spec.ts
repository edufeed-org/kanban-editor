// Unit tests for enhanced mergeComments() text+timestamp deduplication
// Tests the NEW logic added to prevent duplicate comments for pending local comments
import { describe, it, expect } from 'vitest';
import type { Comment } from '$lib/classes/BoardModel';

/**
 * TEST IMPLEMENTATION: mergeComments() with text+timestamp deduplication
 * 
 * This is a copy of the ACTUAL implementation from nostr.ts (lines 1012-1050)
 * to ensure tests match the production behavior
 */
function mergeComments(localComments: Comment[], remoteComments: Comment[]): Comment[] {
    // Step 1: Create Set of eventIds from local comments
    const localEventIds = new Set<string>(
        localComments
            .filter(c => c.eventId) // Only comments with eventId
            .map(c => c.eventId!)
    );

    // Step 2: Filter remote comments to exclude duplicates
    const newRemoteComments = remoteComments.filter(remote => {
        // 2a. Skip if eventId already exists in local comments
        if (remote.eventId && localEventIds.has(remote.eventId)) {
            return false;
        }

        // 🚀 2b. NEW: Also check for text+timestamp duplicates (for pending local comments)
        // This handles the case where local comment was sent but hasn't received eventId yet
        // If text matches AND timestamp is within 5 seconds → it's the same comment
        const isDuplicate = localComments.some(local => {
            // Skip if local already has eventId (already synced)
            if (local.eventId) return false;

            // Check text match
            if (local.text !== remote.text) return false;

            // Check timestamp proximity (within 5 seconds)
            const localTime = new Date(local.createdAt).getTime();
            const remoteTime = new Date(remote.createdAt).getTime();
            const timeDiff = Math.abs(localTime - remoteTime);

            return timeDiff < 5000; // 5 seconds tolerance
        });

        return !isDuplicate;
    });

    // Step 3: Merge local + new remote comments
    const merged = [...localComments, ...newRemoteComments];

    // Step 4: Sort chronologically by createdAt (oldest first)
    merged.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
    });

    return merged;
}

describe('mergeComments() - Text+Timestamp Deduplication', () => {
    it('should deduplicate when text matches AND timestamp within 5 seconds (local pending)', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Same comment text',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local' // ← No eventId (pending)
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Same comment text', // ← SAME TEXT
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:03.500Z', // ← 3.5 seconds later
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should deduplicate (only 1 comment)
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('local-1'); // Local version kept
    });

    it('should NOT deduplicate when timestamp difference is exactly 5 seconds', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Comment A',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Comment A',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:05.000Z', // ← Exactly 5.0 seconds
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should NOT deduplicate (timeDiff = 5000 is NOT < 5000)
        expect(merged).toHaveLength(2);
    });

    it('should deduplicate when timestamp difference is 4.9 seconds', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Comment B',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Comment B',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:04.900Z', // ← 4.9 seconds
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should deduplicate (4900 < 5000)
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('local-1');
    });

    it('should NOT deduplicate when timestamp difference is 5.1 seconds', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Comment C',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Comment C',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:05.100Z', // ← 5.1 seconds
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should NOT deduplicate (5100 >= 5000)
        expect(merged).toHaveLength(2);
    });

    it('should NOT deduplicate when text is different (even if timestamp matches)', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Different text A',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Different text B', // ← DIFFERENT TEXT
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z', // ← SAME timestamp
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should NOT deduplicate (different text)
        expect(merged).toHaveLength(2);
    });

    it('should NOT check text+timestamp if local comment already has eventId (synced)', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Already synced comment',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                eventId: 'event-local', // ← HAS eventId (already synced)
                syncStatus: 'synced'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Already synced comment', // ← SAME TEXT
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:02.000Z', // ← Within 5 seconds
                eventId: 'event-remote', // ← Different eventId
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should NOT deduplicate via text+timestamp (both have eventId)
        // Will deduplicate via eventId comparison instead
        expect(merged).toHaveLength(2); // Different eventIds = keep both
    });

    it('should handle negative timestamp difference (remote older than local)', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Comment D',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:04.000Z', // ← Later timestamp
                syncStatus: 'local'
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Comment D',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z', // ← Earlier timestamp
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should deduplicate (Math.abs handles negative difference)
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('local-1');
    });

    it('should deduplicate multiple pending local comments with same text', () => {
        const local: Comment[] = [
            {
                id: 'local-1',
                text: 'Pending comment',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local' // No eventId
            },
            {
                id: 'local-2',
                text: 'Pending comment', // ← SAME TEXT
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:02.000Z', // ← 2 seconds later
                syncStatus: 'local' // No eventId
            }
        ];

        const remote: Comment[] = [
            {
                id: 'remote-1',
                text: 'Pending comment',
                author: 'npub1abc',
                createdAt: '2025-01-15T10:00:01.000Z', // ← Between local-1 and local-2
                eventId: 'event-123',
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should keep both local comments (they're pending)
        // Remote matches both, so it's deduplicated
        expect(merged).toHaveLength(2);
        expect(merged.map(c => c.id).sort()).toEqual(['local-1', 'local-2']);
    });

    it('should work correctly with real-world scenario: echo prevention', () => {
        // Real scenario: User posts comment, it's pending locally
        // Then relay echoes it back with eventId
        const local: Comment[] = [
            {
                id: 'comment-abc',
                text: 'This is my new comment!',
                author: 'npub1userxyz',
                createdAt: '2025-01-15T10:00:00.000Z',
                syncStatus: 'local' // ← Just posted, no eventId yet
            }
        ];

        // Relay processes and echoes back with eventId
        const remote: Comment[] = [
            {
                id: 'comment-abc', // ← SAME ID (could be different)
                text: 'This is my new comment!', // ← SAME TEXT
                author: 'npub1userxyz',
                createdAt: '2025-01-15T10:00:00.100Z', // ← 100ms delay
                eventId: 'event-nostr-123', // ← NOW HAS eventId from relay
                syncStatus: 'synced'
            }
        ];

        const merged = mergeComments(local, remote);

        // Should deduplicate (echo prevention)
        expect(merged).toHaveLength(1);
        expect(merged[0].id).toBe('comment-abc');
        expect(merged[0].syncStatus).toBe('local'); // Local version kept
    });
});
