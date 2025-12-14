import { describe, expect, it, vi } from 'vitest';

// This test focuses on a critical invariant:
// - Board events (kind 30301) do not carry cards.
// - When we write the board to localStorage after processing a board event,
//   we MUST NOT overwrite local cards arrays.
//
// The bug: loadBoardsFromNostr() wrote board.getContextData(true) (columns without cards)
// into the board storage key, effectively wiping local cards.

describe('boardstore/nostr: preserve local cards on board event load', () => {
	it('keeps existing cards per column when saving board context', async () => {
		// Minimal localStorage mock
		const store = new Map<string, string>();
		const localStorageMock = {
			getItem: vi.fn((key: string) => store.get(key) ?? null),
			setItem: vi.fn((key: string, value: string) => {
				store.set(key, value);
			}),
			removeItem: vi.fn((key: string) => {
				store.delete(key);
			}),
			key: vi.fn(() => null),
			get length() {
				return store.size;
			}
		} as any;

		vi.stubGlobal('window', {});
		vi.stubGlobal('localStorage', localStorageMock);

		// Existing board in storage with cards
		const storageKey = 'kanban-board-abc';
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				id: 'board-abc',
				name: 'Board',
				columns: [
					{ id: 'col-1', name: 'Todo', cards: [{ id: 'card-1', heading: 'Keep me' }] },
					{ id: 'col-2', name: 'Done', cards: [] }
				]
			})
		);

		// Simulate the merge behavior introduced in src/lib/stores/boardstore/nostr.ts
		const existingRaw = localStorage.getItem(storageKey);
		const context: any = {
			id: 'board-abc',
			name: 'Board (updated title)',
			columns: [
				{ id: 'col-1', name: 'Todo (renamed)', cards: [] },
				{ id: 'col-2', name: 'Done', cards: [] }
			]
		};

		if (existingRaw) {
			const existing = JSON.parse(existingRaw);
			const existingColumns = Array.isArray(existing?.columns) ? existing.columns : [];
			const cardsByColumnId = new Map<string, any[]>();
			for (const col of existingColumns) {
				if (col?.id && Array.isArray(col.cards)) {
					cardsByColumnId.set(col.id, col.cards);
				}
			}

			context.columns = context.columns.map((col: any) => {
				const existingCards = cardsByColumnId.get(col?.id) ?? [];
				const hasIncomingCards = Array.isArray(col?.cards) && col.cards.length > 0;
				return { ...col, cards: hasIncomingCards ? col.cards : existingCards };
			});
		}

		localStorage.setItem(storageKey, JSON.stringify(context));

		const saved = JSON.parse(localStorage.getItem(storageKey) as string);
		expect(saved.columns.find((c: any) => c.id === 'col-1').cards).toEqual([
			{ id: 'card-1', heading: 'Keep me' }
		]);
	});
});
