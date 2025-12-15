import { describe, expect, it, vi } from 'vitest';

import { Board } from '../../classes/BoardModel';
import { BoardOperations } from './operations';

function createBoardForMoveTest(): Board {
	return new Board({
		id: 'board-1',
		name: 'Test Board',
		author: 'author',
		columns: [
			{ id: 'col-a', name: 'A', cards: [] },
			{ id: 'col-b', name: 'B', cards: [] }
		]
	});
}

describe('BoardOperations.syncBoardState() - updatedAt bump for position changes', () => {
	it('bumps updatedAt only for cards whose column/rank changed', () => {
		vi.useFakeTimers();

		// Initial state
		vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
		const board = createBoardForMoveTest();
		const colA = board.findColumn('col-a')!;
		const colB = board.findColumn('col-b')!;

		// colA has [card-2, card-1]
		colA.addCard({ id: 'card-2', heading: 'Card 2' });
		colA.addCard({ id: 'card-1', heading: 'Card 1' });

		const card2 = colA.findCard('card-2')!;
		const card1 = colA.findCard('card-1')!;

		expect(colA.cards.map(c => c.id)).toEqual(['card-2', 'card-1']);
		expect(colB.cards.map(c => c.id)).toEqual([]);
		const oldUpdatedAtCard1 = card1.updatedAt;
		const oldUpdatedAtCard2 = card2.updatedAt;

		// Simulate DnD/UI state: move card-1 to colB, keep card-2 at rank 0
		vi.setSystemTime(new Date('2025-01-02T00:00:00.000Z'));
		const uiColumns = [
			{ id: 'col-a', items: [{ id: 'card-2' }] },
			{ id: 'col-b', items: [{ id: 'card-1' }] }
		] as any;

		const { movedCardIds } = BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns);

		expect(movedCardIds).toEqual(['card-1']);
		expect(board.findColumn('col-a')!.cards.map(c => c.id)).toEqual(['card-2']);
		expect(board.findColumn('col-b')!.cards.map(c => c.id)).toEqual(['card-1']);

		// Only moved card should get a timestamp bump
		expect(card1.updatedAt).not.toBe(oldUpdatedAtCard1);
		expect(card1.updatedAt).toBe('2025-01-02T00:00:00.000Z');
		expect(card2.updatedAt).toBe(oldUpdatedAtCard2);

		vi.useRealTimers();
	});
});
