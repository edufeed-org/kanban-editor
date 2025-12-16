import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStore } from './kanbanStore.svelte';

describe('BoardStore.applyColumnOrderPatchFromNostr() - column meta patches', () => {
	let store: BoardStore;

	beforeEach(() => {
		// Minimaler SSR/Config Guard: verhindert noisy fetch Fehler aus optionalen Init-Pfaden
		(globalThis as any).fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));

		localStorage.clear();
		store = new BoardStore();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('applies name patch without order', () => {
		const boardId = store.getCurrentBoardId();
		const board = (store as any).board;
		const col = board.columns[0];

		const ok = store.applyColumnOrderPatchFromNostr({
			boardId,
			columnOrder: [],
			columnUpdates: [{ id: col.id, namePresent: true, colorPresent: false, name: 'Renamed' }],
			eventTimeMs: 1000,
		});

		expect(ok).toBe(true);
		expect(col.name).toBe('Renamed');
	});

	it('no-ops when patch has no effective changes but advances LWW timestamp', () => {
		const boardId = store.getCurrentBoardId();
		const board = (store as any).board;
		const col = board.columns[0];

		store.applyColumnOrderPatchFromNostr({
			boardId,
			columnOrder: [],
			columnUpdates: [{ id: col.id, namePresent: true, colorPresent: false, name: 'Renamed' }],
			eventTimeMs: 1000,
		});

		const ok2 = store.applyColumnOrderPatchFromNostr({
			boardId,
			columnOrder: [],
			columnUpdates: [{ id: col.id, namePresent: true, colorPresent: false, name: 'Renamed' }],
			eventTimeMs: 2000,
		});

		expect(ok2).toBe(false);
		expect((store as any).lastColumnOrderPatchAtMs).toBe(2000);
	});
});
