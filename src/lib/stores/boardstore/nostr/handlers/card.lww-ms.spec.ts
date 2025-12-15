import { describe, expect, it, vi } from 'vitest';

import { handleCardEvent } from './card';

function createBoardMock(overrides?: {
	updatedAt?: string;
	eventId?: string;
}) {
	const card = {
		id: 'card-1',
		updatedAt: overrides?.updatedAt ?? new Date('2025-01-01T00:00:00.000Z').toISOString(),
		eventId: overrides?.eventId,
	};
	const column = { id: 'col-1' };

	return {
		id: 'board-1',
		author: 'pubkey',
		__card: card,
		findCardAndColumn: vi.fn(() => ({ card, column })),
	};
}

describe('handleCardEvent LWW (ms ts tag)', () => {
	it('skips when eventTimeMs < local updatedAt (even if created_at looks equal)', async () => {
		const board = createBoardMock({
			updatedAt: new Date('2025-01-01T00:00:00.900Z').toISOString(),
		});
		const boardStore = {
			upsertCardFromNostr: vi.fn(),
			upsertCardToBackgroundBoard: vi.fn(),
		};

		const ctx = {
			processedEvents: new Set<string>(),
			cardDeletionTimestamps: new Map<string, number>(),
			syncManager: {
				isMyEvent: () => false,
				clearMyEvent: () => {},
			},
		};

		const cardEvent = {
			id: 'event-incoming',
			kind: 30302,
			created_at: Math.floor(new Date('2025-01-01T00:00:00.000Z').getTime() / 1000),
			tags: [
				['d', 'card-1'],
				['a', '30301:pubkey:board-1'],
				['s', 'col-1'],
				['rank', '0'],
				['ts', String(new Date('2025-01-01T00:00:00.100Z').getTime())],
			],
			content: '',
		};

		await handleCardEvent(ctx as any, cardEvent as any, board as any, boardStore as any);

		// If LWW skips, handler must not touch store.
		expect(boardStore.upsertCardFromNostr).not.toHaveBeenCalled();
		expect(boardStore.upsertCardToBackgroundBoard).not.toHaveBeenCalled();
	});

	it('applies deterministic tie-break when eventTimeMs === localTime (incoming id must be greater than local eventId)', async () => {
		const sameTime = new Date('2025-01-01T00:00:00.000Z').toISOString();
		const board = createBoardMock({ updatedAt: sameTime, eventId: 'bbb' });
		const boardStore = {
			upsertCardFromNostr: vi.fn(),
			upsertCardToBackgroundBoard: vi.fn(),
		};

		const ctx = {
			processedEvents: new Set<string>(),
			cardDeletionTimestamps: new Map<string, number>(),
			syncManager: {
				isMyEvent: () => false,
				clearMyEvent: () => {},
			},
		};

		const cardEventLowerId = {
			id: 'aaa',
			kind: 30302,
			created_at: Math.floor(new Date(sameTime).getTime() / 1000),
			tags: [
				['d', 'card-1'],
				['a', '30301:pubkey:board-1'],
				['s', 'col-1'],
				['rank', '0'],
				['ts', String(new Date(sameTime).getTime())],
			],
			content: '',
		};

		await handleCardEvent(ctx as any, cardEventLowerId as any, board as any, boardStore as any);
		expect(boardStore.upsertCardFromNostr).not.toHaveBeenCalled();

		const cardEventHigherId = { ...cardEventLowerId, id: 'ccc' };
		await handleCardEvent(ctx as any, cardEventHigherId as any, board as any, boardStore as any);

		// For the tie-break win path, handler should apply update.
		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});
});
