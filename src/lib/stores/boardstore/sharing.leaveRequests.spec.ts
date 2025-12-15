import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type NDK from '@nostr-dev-kit/ndk';
import { BoardSharingOperations } from './sharing';

describe('BoardSharingOperations.loadLeaveRequestsForBoard', () => {
	beforeEach(() => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('liefert Map requesterPubkey -> eventInfo (fetchEvents)', async () => {
		const boardRef = '30301:owner-hex:board-123';
		const dTag = `kanban-leave-request:${boardRef}`;

		const ndk = {
			fetchEvents: vi.fn(async () =>
				new Set([
					{ id: 'e1', pubkey: 'user-a', created_at: 123, tags: [['d', dTag]] },
					{ id: 'e2', pubkey: 'user-b', created_at: 456, tags: [['d', dTag], ['p', 'owner-hex']] },
					// wrong d-tag -> ignored
					{ id: 'e3', pubkey: 'user-c', created_at: 789, tags: [['d', 'kanban-leave-request:other']] },
					// missing pubkey/id -> ignored
					{ id: '', pubkey: 'user-d', created_at: 999, tags: [['d', dTag]] },
				])
			)
		} as any as NDK;

		const result = await BoardSharingOperations.loadLeaveRequestsForBoard(boardRef, ndk);
		expect(Object.keys(result).sort()).toEqual(['user-a', 'user-b']);
		expect(result['user-a']).toEqual({ eventId: 'e1', createdAt: 123 });
		expect(result['user-b']).toEqual({ eventId: 'e2', createdAt: 456 });
	});

	it('fällt auf fetchEvent zurück, wenn fetchEvents nicht verfügbar ist', async () => {
		const boardRef = '30301:owner-hex:board-456';
		const dTag = `kanban-leave-request:${boardRef}`;

		const ndk = {
			fetchEvent: vi.fn(async () => ({
				id: 'single',
				pubkey: 'user-x',
				created_at: 111,
				tags: [['d', dTag]]
			}))
		} as any as NDK;

		const result = await BoardSharingOperations.loadLeaveRequestsForBoard(boardRef, ndk);
		expect(result).toEqual({
			'user-x': { eventId: 'single', createdAt: 111 }
		});
	});
});
