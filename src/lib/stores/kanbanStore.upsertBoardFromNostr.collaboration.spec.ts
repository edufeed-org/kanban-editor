import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStore } from './kanbanStore.svelte';
import { BoardStorage } from './boardstore/storage';

/**
 * Tests für den Collaboration-Sync Fix (v4.3)
 * 
 * Bug: Wenn ein Board geteilt wird, konnten Owner und Editor
 * gegenseitig keine Änderungen sehen. Root Cause:
 * upsertBoardFromNostr() rief updateTrigger++ statt triggerUpdate() auf,
 * wodurch Board-Metadaten (Maintainers, Columns, Name) NICHT in 
 * localStorage gespeichert wurden.
 */
describe('BoardStore.upsertBoardFromNostr() collaboration sync', () => {
	let store: BoardStore;
	let saveBoardSpy: ReturnType<typeof vi.spyOn>;

	/**
	 * Helper: Stellt sicher, dass das aktuelle Board in boardIds vorhanden ist,
	 * damit die Guards in upsertBoardFromNostr nicht greifen.
	 */
	function ensureBoardInIds(s: BoardStore): string {
		const boardId = (s as any).board.id;
		// Board in boardIds einfügen (falls nicht vorhanden)
		if (!(s as any).boardIds.includes(boardId)) {
			(s as any).boardIds = [...(s as any).boardIds, boardId];
		}
		return boardId;
	}

	beforeEach(() => {
		// Mock fetch für config.json Laden
		(globalThis as any).fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
		localStorage.clear();
		store = new BoardStore();
		// Spy auf BoardStorage.saveBoard um zu verifizieren, dass saveToStorage aufgerufen wird
		saveBoardSpy = vi.spyOn(BoardStorage, 'saveBoard').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it('calls saveToStorage when receiving Nostr board update (Fix 1: persistence)', () => {
		const boardId = ensureBoardInIds(store);

		// Reset spy count (Constructor may have called saveBoard)
		saveBoardSpy.mockClear();

		// Simuliere Nostr-Update mit neuen Metadaten
		store.upsertBoardFromNostr({
			id: boardId,
			name: 'Updated Board Name',
			description: 'New description from collaborator',
			columns: [],
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey-1'],
		} as any);

		// ⚡ FIX VERIFICATION: saveBoard MUSS aufgerufen werden!
		// Vorher wurde nur updateTrigger++ aufgerufen (ohne persist)
		expect(saveBoardSpy).toHaveBeenCalled();
		
		// Board-Metadaten sollten im In-Memory Board aktualisiert sein
		expect((store as any).board.name).toBe('Updated Board Name');
		expect((store as any).board.description).toBe('New description from collaborator');
	});

	it('persists maintainers to board after Nostr update (Fix 1: maintainers)', () => {
		const boardId = ensureBoardInIds(store);
		saveBoardSpy.mockClear();

		// Simuliere: Owner fügt Editor als Maintainer hinzu
		store.upsertBoardFromNostr({
			id: boardId,
			name: (store as any).board.name,
			maintainers: ['editor-pubkey-gina', 'editor-pubkey-bob'],
			columns: [],
		} as any);

		// saveBoard muss aufgerufen werden (Persistierung)
		expect(saveBoardSpy).toHaveBeenCalled();
		
		// Maintainers müssen im In-Memory Board aktualisiert sein
		expect((store as any).board.maintainers).toEqual(['editor-pubkey-gina', 'editor-pubkey-bob']);
	});

	it('restarts subscription when maintainers change (Fix 2)', () => {
		const boardId = ensureBoardInIds(store);

		// Spy auf subscribeToNostrUpdates
		const subscribeSpy = vi.spyOn(store, 'subscribeToNostrUpdates').mockImplementation(() => {});

		// Initial Board hat keine Maintainers
		(store as any).board.maintainers = [];

		// Simuliere: Owner fügt Editor als Maintainer hinzu
		store.upsertBoardFromNostr({
			id: boardId,
			name: (store as any).board.name,
			maintainers: ['editor-pubkey-gina'],
			columns: [],
		} as any);

		// Subscription sollte neu gestartet werden!
		expect(subscribeSpy).toHaveBeenCalledTimes(1);
	});

	it('does NOT restart subscription when maintainers unchanged', () => {
		const boardId = ensureBoardInIds(store);

		// Board hat bereits Maintainer
		(store as any).board.maintainers = ['editor-pubkey-gina'];

		// Spy auf subscribeToNostrUpdates
		const subscribeSpy = vi.spyOn(store, 'subscribeToNostrUpdates').mockImplementation(() => {});

		// Simuliere: Nostr-Update mit GLEICHEN Maintainern
		store.upsertBoardFromNostr({
			id: boardId,
			name: (store as any).board.name,
			maintainers: ['editor-pubkey-gina'],
			columns: [],
		} as any);

		// Subscription sollte NICHT neu gestartet werden
		expect(subscribeSpy).not.toHaveBeenCalled();
	});

	it('updates cachedSharedBoards when board metadata changes (Fix 3)', () => {
		const boardId = ensureBoardInIds(store);

		// Simuliere: Board ist in cachedSharedBoards
		(store as any).cachedSharedBoards = [{
			id: boardId,
			name: 'Old Name',
			description: 'Old desc',
			createdAt: Date.now(),
			isShared: true,
			userRole: 'editor',
			author: 'owner-pubkey',
		}];

		// Simuliere: Nostr-Update mit neuem Namen
		store.upsertBoardFromNostr({
			id: boardId,
			name: 'Updated By Owner',
			description: 'Owner changed this',
			columns: [],
			author: 'owner-pubkey',
		} as any);

		// cachedSharedBoards sollte aktualisiert sein
		const cached = (store as any).cachedSharedBoards.find((b: any) => b.id === boardId);
		expect(cached).toBeDefined();
		expect(cached.name).toBe('Updated By Owner');
		expect(cached.description).toBe('Owner changed this');
	});

	it('does not update cachedSharedBoards when board is not cached', () => {
		const boardId = ensureBoardInIds(store);

		// cachedSharedBoards ist leer
		(store as any).cachedSharedBoards = [];

		// Sollte keinen Fehler werfen
		store.upsertBoardFromNostr({
			id: boardId,
			name: 'Some Update',
			columns: [],
		} as any);

		expect((store as any).cachedSharedBoards.length).toBe(0);
	});

	it('persists column structure from Nostr update (Fix 1: columns)', () => {
		const boardId = ensureBoardInIds(store);
		saveBoardSpy.mockClear();

		// Simuliere: Owner fügt neue Spalten hinzu via Nostr
		store.upsertBoardFromNostr({
			id: boardId,
			name: (store as any).board.name,
			columns: [
				{ id: 'col-todo', name: 'To Do', color: 'blue' },
				{ id: 'col-done', name: 'Done', color: 'green' },
			],
		} as any);

		// saveBoard muss aufgerufen werden (Persistierung)
		expect(saveBoardSpy).toHaveBeenCalled();
		
		// Spalten müssen im In-Memory Board aktualisiert sein
		const columns = (store as any).board.columns;
		expect(columns.length).toBe(2);
		expect(columns[0].name).toBe('To Do');
		expect(columns[1].name).toBe('Done');
	});
});
