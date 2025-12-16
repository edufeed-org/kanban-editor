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

	it('wartet bei Shared Boards auf Rekonstruktion (loadBoard=false → reconstructSharedBoard → retry)', async () => {
		const boardId = store.getCurrentBoardId();
		const storageKey = `kanban-${boardId}`;
		localStorage.setItem(storageKey, JSON.stringify({ id: boardId, name: 'Shared (stale)' }));

		vi.spyOn(localStorage, 'removeItem');
		vi.spyOn(store, 'loadBoardsFromNostr').mockImplementation(async () => {
			// Simuliere: Shared Boards werden nicht über loadBoardsFromNostr() rehydrated
		});

		// Simuliere Shared-Board Meta, damit isShared=true wird
		(store as any).cachedSharedBoards = [{ id: boardId, author: 'owner_pubkey_hex', name: 'Shared', userRole: 'editor' }];

		// loadBoard liefert beim ersten Versuch false (weil Cache gelöscht), nach Rekonstruktion true
		const loadBoardSpy = vi
			.spyOn(store, 'loadBoard')
			.mockReturnValueOnce(false)
			.mockReturnValueOnce(true);

		const reconstructSpy = vi
			.spyOn(store as any, 'reconstructSharedBoard')
			.mockResolvedValue(true);

		await expect(
			store.forceReloadCurrentBoardFromNostr({
				clearLocalCache: true,
				syncManager: { lastConnectedCount: 1 }
			})
		).resolves.toBeUndefined();

		expect(reconstructSpy).toHaveBeenCalledWith(boardId);
		expect(loadBoardSpy).toHaveBeenCalledTimes(2);
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
