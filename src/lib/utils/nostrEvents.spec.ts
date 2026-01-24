// src/lib/utils/nostrEvents.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    cardToNostrEvent, 
    createCommentEvent, 
    createColumnOrderPatchEvent, 
    nostrEventToCard,
    createBoardNaddr,
    createBoardNaddrUrl,
    decodeBoardNaddr
} from './nostrEvents.js';
import { Card } from '../classes/BoardModel.js';
import type NDK from '@nostr-dev-kit/ndk';

describe('nostrEvents - Card Serialization', () => {
    let mockNdk: NDK;
    
    beforeEach(() => {
        mockNdk = {} as NDK;
    });
    
    describe('cardToNostrEvent', () => {
        it('should include image tag when card has image', () => {
            const card = new Card({
                heading: 'Test Card',
                image: 'https://example.com/image.jpg'
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            const imageTag = event.tags.find(t => t[0] === 'image');
            expect(imageTag).toBeDefined();
            expect(imageTag?.[1]).toBe('https://example.com/image.jpg');
        });
        
        it('should include name tag when card has authorName', () => {
            const card = new Card({
                heading: 'Test Card',
                authorName: 'Johan Amos Comenius'
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            const nameTag = event.tags.find(t => t[0] === 'name');
            expect(nameTag).toBeDefined();
            expect(nameTag?.[1]).toBe('Johan Amos Comenius');
        });
        
        it('should include p-tags with roles for author and attendees', () => {
            const card = new Card({
                heading: 'Test Card',
                author: 'author-pubkey',
                attendees: ['attendee1', 'attendee2']
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            const pTags = event.tags.filter(t => t[0] === 'p');
            
            // Should have author + 2 attendees
            expect(pTags.length).toBe(3);
            
            // Author should have 'author' role
            const authorTag = pTags.find(t => t[1] === 'author-pubkey');
            expect(authorTag?.[3]).toBe('author');
            
            // Attendees should have 'attendee' role
            const attendee1Tag = pTags.find(t => t[1] === 'attendee1');
            expect(attendee1Tag?.[3]).toBe('attendee');
        });
        
        it('should not duplicate author in attendees', () => {
            const card = new Card({
                heading: 'Test Card',
                author: 'author-pubkey',
                attendees: ['author-pubkey', 'attendee1']  // Author auch in attendees
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            const pTags = event.tags.filter(t => t[0] === 'p');
            
            // Should only have author + attendee1 (no duplicate)
            expect(pTags.length).toBe(2);
            
            const authorTags = pTags.filter(t => t[1] === 'author-pubkey');
            expect(authorTags.length).toBe(1);  // Nur einmal
        });
    });
    
    describe('nostrEventToCard - Round-Trip', () => {
        it('should preserve image in round-trip', () => {
            const card = new Card({
                heading: 'Test Card',
                image: 'https://example.com/image.jpg'
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            // Mock event mit id und pubkey
            event.id = 'event-123';
            event.pubkey = 'pubkey-123';
            event.created_at = Math.floor(Date.now() / 1000);
            
            const deserializedCard = nostrEventToCard(event);
            
            expect(deserializedCard.image).toBe('https://example.com/image.jpg');
        });
        
        it('should preserve authorName in round-trip', () => {
            const card = new Card({
                heading: 'Test Card',
                authorName: 'Johan Amos Comenius'
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            event.id = 'event-123';
            event.pubkey = 'pubkey-123';
            event.created_at = Math.floor(Date.now() / 1000);
            
            const deserializedCard = nostrEventToCard(event);
            
            expect(deserializedCard.authorName).toBe('Johan Amos Comenius');
        });
        
        it('should preserve attendees in round-trip', () => {
            const card = new Card({
                heading: 'Test Card',
                author: 'author-pubkey',
                attendees: ['attendee1', 'attendee2']
            });
            
            const event = cardToNostrEvent(
                card,
                'column-id',
                'Column Name',
                0,
                '30301:author:board-id',
                mockNdk
            );
            
            event.id = 'event-123';
            event.pubkey = 'author-pubkey';
            event.created_at = Math.floor(Date.now() / 1000);
            
            const deserializedCard = nostrEventToCard(event);
            
            expect(deserializedCard.attendees).toBeDefined();
            expect(deserializedCard.attendees?.length).toBe(2);
            expect(deserializedCard.attendees).toContain('attendee1');
            expect(deserializedCard.attendees).toContain('attendee2');
        });
    });
});

describe('nostrEvents - Comment Events', () => {
    let mockNdk: NDK;

    beforeEach(() => {
        mockNdk = {} as NDK;
    });

    it('should include a-tag with cardRef and empty marker', () => {
        const event = createCommentEvent(
            'Hello',
            '30302:npub1cardauthor:card-1',
            'card-event-id-123',
            mockNdk
        );

        expect(event.kind).toBe(1);
        expect(event.content).toBe('Hello');
        expect(event.tags).toContainEqual(['a', '30302:npub1cardauthor:card-1', '']);
    });

    it('should derive and include p-tag from cardRef when author is present', () => {
        const event = createCommentEvent(
            'Hello',
            '30302:npub1cardauthor:card-1',
            '',
            mockNdk
        );

        expect(event.tags).toContainEqual(['p', 'npub1cardauthor']);
    });

    it('should not include p-tag when derived author is unknown', () => {
        const event = createCommentEvent(
            'Hello',
            '30302:unknown:card-1',
            '',
            mockNdk
        );

        const pTags = event.tags.filter(t => t[0] === 'p');
        expect(pTags.length).toBe(0);
    });

    it('should include e-tag with reply marker when cardEventId is provided', () => {
        const event = createCommentEvent(
            'Hello',
            '30302:npub1cardauthor:card-1',
            'card-event-id-123',
            mockNdk
        );

        expect(event.tags).toContainEqual(['e', 'card-event-id-123', '', 'reply']);
    });
});

describe('nostrEvents - Column Order Patch Events', () => {
    let mockNdk: NDK;

    beforeEach(() => {
        mockNdk = {} as NDK;
    });

    it('should include d-tag with board id for #d subscriptions', () => {
        const event = createColumnOrderPatchEvent(
            {
                boardId: 'board-123',
                boardAuthor: 'pubkey-owner-hex',
                columnOrder: ['col-a', 'col-b'],
                updatedAtMs: 1700000000000,
            },
            mockNdk
        );

        expect(event.tags).toContainEqual(['d', 'board-123']);
    });

    it('should omit order tag when columnOrder is missing/empty', () => {
        const event = createColumnOrderPatchEvent(
            {
                boardId: 'board-123',
                boardAuthor: 'pubkey-owner-hex',
                // no columnOrder
                updatedAtMs: 1700000000000,
            },
            mockNdk
        );

        const orderTag = event.tags.find((t) => t[0] === 'order');
        expect(orderTag).toBeUndefined();
    });

    it('should include col tag for name patch', () => {
        const event = createColumnOrderPatchEvent(
            {
                boardId: 'board-123',
                boardAuthor: 'pubkey-owner-hex',
                columns: [{ id: 'col-a', name: 'Neu', color: '' }],
                updatedAtMs: 1700000000000,
            },
            mockNdk
        );

        expect(event.tags).toContainEqual(['col', 'col-a', 'Neu', '']);
    });

    it('should include col tag for color-only patch (empty name)', () => {
        const event = createColumnOrderPatchEvent(
            {
                boardId: 'board-123',
                boardAuthor: 'pubkey-owner-hex',
                columns: [{ id: 'col-a', color: 'slate' }],
                updatedAtMs: 1700000000000,
            },
            mockNdk
        );

        expect(event.tags).toContainEqual(['col', 'col-a', '', 'slate']);
    });
});

describe('nostrEvents - naddr Link Generation', () => {
    const testBoardId = 'test-board-123';
    const testAuthorPubkey = 'a'.repeat(64); // 64-char hex pubkey
    const testRelays = ['wss://relay.damus.io', 'wss://nos.lol'];

    describe('createBoardNaddr', () => {
        it('should create a valid naddr string', () => {
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey);
            
            expect(naddr).toBeDefined();
            expect(naddr).toMatch(/^naddr1[a-z0-9]+$/);
        });

        it('should create naddr with relay hints', () => {
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey, testRelays);
            
            expect(naddr).toBeDefined();
            expect(naddr).toMatch(/^naddr1[a-z0-9]+$/);
            // naddr with relays should be longer
            const naddrWithoutRelays = createBoardNaddr(testBoardId, testAuthorPubkey);
            expect(naddr.length).toBeGreaterThan(naddrWithoutRelays.length);
        });

        it('should filter out invalid relay URLs', () => {
            const mixedRelays = ['wss://valid.relay', 'http://invalid', '', 'wss://another.valid'];
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey, mixedRelays);
            
            // Should still create a valid naddr
            expect(naddr).toMatch(/^naddr1[a-z0-9]+$/);
        });
    });

    describe('createBoardNaddrUrl', () => {
        it('should create a URL path starting with /cardsboard/', () => {
            const url = createBoardNaddrUrl(testBoardId, testAuthorPubkey);
            
            expect(url).toMatch(/^\/cardsboard\/naddr1[a-z0-9]+$/);
        });

        it('should include relay hints in URL', () => {
            const url = createBoardNaddrUrl(testBoardId, testAuthorPubkey, testRelays);
            
            expect(url).toMatch(/^\/cardsboard\/naddr1[a-z0-9]+$/);
        });
    });

    describe('decodeBoardNaddr', () => {
        it('should decode a valid naddr and return board info', () => {
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey, testRelays);
            const decoded = decodeBoardNaddr(naddr);
            
            expect(decoded).not.toBeNull();
            expect(decoded?.boardId).toBe(testBoardId);
            expect(decoded?.authorPubkey).toBe(testAuthorPubkey);
            expect(decoded?.kind).toBe(30301);
        });

        it('should include relay hints in decoded result', () => {
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey, testRelays);
            const decoded = decodeBoardNaddr(naddr);
            
            expect(decoded?.relays).toBeDefined();
            expect(decoded?.relays).toContain('wss://relay.damus.io');
            expect(decoded?.relays).toContain('wss://nos.lol');
        });

        it('should return null for invalid naddr', () => {
            const decoded = decodeBoardNaddr('invalid-naddr');
            expect(decoded).toBeNull();
        });

        it('should return null for empty string', () => {
            const decoded = decodeBoardNaddr('');
            expect(decoded).toBeNull();
        });

        it('should handle naddr with naddr1 prefix from URL', () => {
            const naddr = createBoardNaddr(testBoardId, testAuthorPubkey);
            // Simulate extracting from URL path
            const fromUrl = `/cardsboard/${naddr}`.split('/').pop()!;
            const decoded = decodeBoardNaddr(fromUrl);
            
            expect(decoded).not.toBeNull();
            expect(decoded?.boardId).toBe(testBoardId);
        });
    });

    describe('round-trip encoding/decoding', () => {
        it('should preserve board data through encode/decode cycle', () => {
            const originalBoardId = 'my-kanban-board';
            const originalAuthor = 'b'.repeat(64);
            const originalRelays = ['wss://relay1.example.com', 'wss://relay2.example.com'];
            
            const naddr = createBoardNaddr(originalBoardId, originalAuthor, originalRelays);
            const decoded = decodeBoardNaddr(naddr);
            
            expect(decoded?.boardId).toBe(originalBoardId);
            expect(decoded?.authorPubkey).toBe(originalAuthor);
            expect(decoded?.relays).toEqual(originalRelays);
        });

        it('should work with special characters in board ID', () => {
            const specialBoardId = 'board-with-special-chars_123';
            
            const naddr = createBoardNaddr(specialBoardId, testAuthorPubkey);
            const decoded = decodeBoardNaddr(naddr);
            
            expect(decoded?.boardId).toBe(specialBoardId);
        });
    });
});
