import { describe, expect, it } from 'vitest';
import { Board } from '$lib/classes/BoardModel';
import { BoardOperations } from './operations';

function countCards(board: Board): number {
	return board.columns.reduce((sum, col) => sum + col.cards.length, 0);
}

describe('BoardOperations.syncBoardState (defensive merge)', () => {
	it('does not drop cards that are missing from UI payload (DnD glitch safety)', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{
					id: 'col-a',
					name: 'A',
					cards: [{ id: 'c1', heading: 'One' }, { id: 'c2', heading: 'Two' }]
				},
				{
					id: 'col-b',
					name: 'B',
					cards: [{ id: 'c3', heading: 'Three' }]
				}
			]
		});

		const before = countCards(board);

		// UI payload is missing card c2 (simulating transient DnD placeholder/animation bug)
		const uiColumns = [
			{ id: 'col-a', name: 'A', items: [{ id: 'c1', title: 'One' }] },
			{ id: 'col-b', name: 'B', items: [{ id: 'c3', title: 'Three' }] }
		];

		const result = BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any);

		expect(result.newColumnOrder).toEqual(['col-a', 'col-b']);
		expect(countCards(board)).toBe(before);

		const c2 = board.findCardAndColumn('c2');
		expect(c2).not.toBeNull();
		expect(c2?.column.id).toBe('col-a');
	});

	it('preserves columns that are missing from UI payload', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{ id: 'col-a', name: 'A', cards: [{ id: 'c1', heading: 'One' }] },
				{ id: 'col-b', name: 'B', cards: [{ id: 'c2', heading: 'Two' }] }
			]
		});

		// UI payload only contains one column (simulating transient UI issues)
		const uiColumns = [{ id: 'col-a', name: 'A', items: [{ id: 'c1', title: 'One' }] }];

		BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any);

		expect(board.columns.map(c => c.id)).toContain('col-b');
		expect(board.findCardAndColumn('c2')).not.toBeNull();
	});

	it('dedupes duplicate columns in UI payload (prevents duplicate keys / columnOrder corruption)', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{ id: 'col-a', name: 'A', cards: [{ id: 'c1', heading: 'One' }] },
				{ id: 'col-b', name: 'B', cards: [{ id: 'c2', heading: 'Two' }] }
			]
		});

		const uiColumns = [
			{ id: 'col-a', name: 'A', items: [{ id: 'c1', title: 'One' }] },
			{ id: 'col-a', name: 'A (dup)', items: [{ id: 'c1', title: 'One' }] },
			{ id: 'col-b', name: 'B', items: [{ id: 'c2', title: 'Two' }] }
		];

		const result = BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any);

		expect(result.newColumnOrder).toEqual(['col-a', 'col-b']);
		expect(board.columns.map((c) => c.id)).toEqual(['col-a', 'col-b']);
		expect(board.findCardAndColumn('c1')?.column.id).toBe('col-a');
		expect(board.findCardAndColumn('c2')?.column.id).toBe('col-b');
	});

	it('hard-fail: throws (and does not mutate) when cards are missing from UI payload', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{
					id: 'col-a',
					name: 'A',
					cards: [{ id: 'c1', heading: 'One' }, { id: 'c2', heading: 'Two' }]
				},
				{
					id: 'col-b',
					name: 'B',
					cards: [{ id: 'c3', heading: 'Three' }]
				}
			]
		});

		const beforeCount = countCards(board);
		const beforeOrder = board.columns.map(c => c.id);

		// Missing c2
		const uiColumns = [
			{ id: 'col-a', name: 'A', items: [{ id: 'c1', title: 'One' }] },
			{ id: 'col-b', name: 'B', items: [{ id: 'c3', title: 'Three' }] }
		];

		expect(() =>
			BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any, {
				strategy: 'hard-fail'
			})
		).toThrow(/hard-fail/i);

		// Board must be unchanged
		expect(countCards(board)).toBe(beforeCount);
		expect(board.columns.map(c => c.id)).toEqual(beforeOrder);
		expect(board.findCardAndColumn('c2')?.column.id).toBe('col-a');
	});

	it('hard-fail: throws (and does not mutate) when columns are missing from UI payload', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{ id: 'col-a', name: 'A', cards: [{ id: 'c1', heading: 'One' }] },
				{ id: 'col-b', name: 'B', cards: [{ id: 'c2', heading: 'Two' }] }
			]
		});

		const beforeCount = countCards(board);
		const beforeOrder = board.columns.map(c => c.id);

		// Missing col-b
		const uiColumns = [{ id: 'col-a', name: 'A', items: [{ id: 'c1', title: 'One' }] }];

		expect(() =>
			BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any, {
				strategy: 'hard-fail'
			})
		).toThrow(/hard-fail/i);

		// Board must be unchanged
		expect(countCards(board)).toBe(beforeCount);
		expect(board.columns.map(c => c.id)).toEqual(beforeOrder);
		expect(board.findCardAndColumn('c2')?.column.id).toBe('col-b');
	});

	it('hard-fail: ignores svelte-dnd-action placeholder ids (dnd-shadow-placeholder)', () => {
		const board = new Board({
			name: 'Test',
			columns: [
				{
					id: 'col-a',
					name: 'A',
					cards: [{ id: 'c1', heading: 'One' }, { id: 'c2', heading: 'Two' }]
				},
				{
					id: 'col-b',
					name: 'B',
					cards: [{ id: 'c3', heading: 'Three' }]
				}
			]
		});

		const beforeCount = countCards(board);

		// UI payload includes all real cards + a temporary placeholder item
		const uiColumns = [
			{
				id: 'col-a',
				name: 'A',
				items: [
					{ id: 'c1', title: 'One' },
					{ id: 'dnd-shadow-placeholder-1', title: '' },
					{ id: 'c2', title: 'Two' }
				]
			},
			{ id: 'col-b', name: 'B', items: [{ id: 'c3', title: 'Three' }] }
		];

		expect(() =>
			BoardOperations.syncBoardState(board, ['col-a', 'col-b'], uiColumns as any, {
				strategy: 'hard-fail'
			})
		).not.toThrow();

		expect(countCards(board)).toBe(beforeCount);
	});
});
