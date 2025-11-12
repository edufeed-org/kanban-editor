// src/lib/utils/nostrEvents.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cardToNostrEvent, nostrEventToCard } from './nostrEvents.js';
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
