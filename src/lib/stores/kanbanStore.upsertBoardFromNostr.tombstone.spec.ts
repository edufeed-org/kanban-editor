import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStore } from './kanbanStore.svelte';
import { tombstoneBoard } from './boardstore/deletedBoards';

describe('BoardStore.upsertBoardFromNostr() tombstone guard', () => {
	let store: BoardStore;

	beforeEach(() => {
		// Mock fetch für config.json Laden
		(globalThis as any).fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));

		localStorage.clear();
		store = new BoardStore();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('erstellt kein lokales Board neu, wenn die ID tombstoned ist (anti-resurrection)', () => {
		const resurrectId = 'board-tombstoned-1';

		// Simuliere: Board war in der Liste (stale boardIds), wurde aber gelöscht
		tombstoneBoard(resurrectId);
		(store as any).boardIds = [resurrectId];

		store.upsertBoardFromNostr({
			id: resurrectId,
			name: 'Should Not Resurrect',
			columns: [],
			author: 'pubkey-owner',
		} as any);

		expect(localStorage.getItem(`kanban-${resurrectId}`)).toBeNull();
		expect((store as any).boardIds.includes(resurrectId)).toBe(true);
	});
});
