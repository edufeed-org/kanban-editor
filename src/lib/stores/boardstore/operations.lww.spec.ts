import { describe, it, expect } from 'vitest';
import { Board } from '$lib/classes/BoardModel';
import { BoardOperations } from './operations';

describe('BoardOperations.upsertCardFromNostr (LWW guards)', () => {
	it('does not overwrite a newer local card with an older incoming update', () => {
		const board = new Board({
			name: 'LWW Test Board',
			columns: [
				{
					id: 'col-1',
					name: 'Todo',
					cards: [
						{
							id: 'card-1',
							heading: 'Local New',
							content: 'newer content',
							updatedAt: '2025-12-15T12:00:00.000Z',
							eventId: 'zzzz-local'
						} as any
					]
				}
			]
		});

		const ok = BoardOperations.upsertCardFromNostr(board, {
			id: 'card-1',
			columnId: 'col-1',
			heading: 'Incoming Old',
			content: 'older content',
			updatedAt: '2025-12-15T11:00:00.000Z',
			eventId: 'aaaa-incoming'
		} as any);

		expect(ok).toBe(true);

		const col = board.findColumn('col-1');
		expect(col).toBeTruthy();
		const card = col!.findCard('card-1');
		expect(card).toBeTruthy();
		expect(card!.heading).toBe('Local New');
		expect(card!.content).toBe('newer content');
	});
});
