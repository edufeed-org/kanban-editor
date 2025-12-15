import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStore } from './kanbanStore.svelte';

describe('BoardStore.forceReloadCurrentBoardFromNostr()', () => {
	let store: BoardStore;

	beforeEach(() => {
		// Minimaler SSR/Config Guard: verhindert noisy fetch Fehler aus initializeLearningManagerIfEnabled()
		(globalThis as any).fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));

		localStorage.clear();
		store = new BoardStore();

		// Für diese Tests simulieren wir, dass Nostr initialisiert ist
		(store as any).ndkReady = true;
		(store as any).nostrIntegration = {
			getNDK: () => ({})
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('löscht lokalen Cache und triggert Reload-Pipeline', async () => {
		const boardId = store.getCurrentBoardId();
		const storageKey = `kanban-${boardId}`;
		const existing = localStorage.getItem(storageKey) ?? JSON.stringify({ id: boardId, name: 'Test' });
		localStorage.setItem(storageKey, existing);

		const removeSpy = vi.spyOn(localStorage, 'removeItem');
		const loadBoardsSpy = vi.spyOn(store, 'loadBoardsFromNostr').mockImplementation(async () => {
			// Simuliere, dass Nostr-Laden den Cache wieder befüllt
			localStorage.setItem(storageKey, existing);
		});
		const loadBoardSpy = vi.spyOn(store, 'loadBoard').mockReturnValue(true);

		await store.forceReloadCurrentBoardFromNostr({
			clearLocalCache: true,
			syncManager: { lastConnectedCount: 1 }
		});

		expect(removeSpy).toHaveBeenCalledWith(storageKey);
		expect(loadBoardsSpy).toHaveBeenCalledTimes(1);
		expect(loadBoardSpy).toHaveBeenCalledWith(boardId, { skipLastAccessed: true });
	});

	it('wirft, wenn ndkReady=false', async () => {
		(store as any).ndkReady = false;
		await expect(store.forceReloadCurrentBoardFromNostr({ syncManager: { lastConnectedCount: 1 } }))
			.rejects
			.toThrow(/nicht initialisiert/i);
	});

	it('wirft, wenn keine Relays verbunden sind (und löscht nicht)', async () => {
		const boardId = store.getCurrentBoardId();
		const storageKey = `kanban-${boardId}`;

		const removeSpy = vi.spyOn(localStorage, 'removeItem');

		await expect(store.forceReloadCurrentBoardFromNostr({ syncManager: { lastConnectedCount: 0 } }))
			.rejects
			.toThrow(/Keine Relay-Verbindung/i);

		expect(removeSpy).not.toHaveBeenCalledWith(storageKey);
	});
});
