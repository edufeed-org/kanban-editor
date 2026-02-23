/**
 * Tests für v4.4 LWW Fix: Shared Board Sync
 *
 * Bug-Kette:
 * 1. Sub5 setzte updatedAt: undefined → Board constructor default = NOW
 * 2. Operations INSERT path fehlte updatedAt → Board constructor default = NOW
 * 3. LWW-Check blockierte Owner-Events permanent (eventTime <= localTime=NOW)
 *
 * Diese Tests verifizieren, dass Owner-signierte Events auf Shared Boards
 * IMMER akzeptiert werden, auch wenn lokale Timestamps neuer sind.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleBoardEvent, type BoardEventHandlerContext } from './board';
import { Board } from '../../../../classes/BoardModel.js';

// ---- Mocks ----

// Mock authStore (dynamic import in handleBoardEvent)
vi.mock('../../../authStore.svelte.js', () => ({
	authStore: {
		getPubkey: vi.fn(() => 'editor-pubkey'),
	},
}));

// Mock syncManager (dynamic import in handleBoardEvent)
vi.mock('../../../syncManager.svelte.js', () => ({
	getSyncManager: vi.fn(() => ({
		isMyEvent: vi.fn(() => false),
		clearMyEvent: vi.fn(),
	})),
}));

// Mock nostrEvents (dynamic import in handleBoardEvent)
vi.mock('../../../../utils/nostrEvents.js', () => ({
	nostrEventToBoard: vi.fn((event: any) => {
		const dTag = event.tags?.find((t: any) => t[0] === 'd')?.[1] || 'board-1';
		const title = event.tags?.find((t: any) => t[0] === 'title')?.[1] || 'Test Board';
		const pTags = (event.tags || []).filter((t: any) => t[0] === 'p').map((t: any) => t[1]);
		const author = pTags[0] || event.pubkey;
		const maintainers = pTags.slice(1).filter((p: string) => p !== author);
		return {
			id: dTag,
			eventId: event.id,
			name: title,
			author,
			maintainers,
			columns: [],
			updatedAt: event.created_at
				? new Date(event.created_at * 1000).toISOString()
				: undefined,
		};
	}),
}));

// localStorage mock
function createMockLocalStorage() {
	const data = new Map<string, string>();
	const storageObj: any = {
		getItem: (key: string) => data.get(key) || null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
			storageObj[key] = value;
		},
		removeItem: (key: string) => {
			data.delete(key);
			delete storageObj[key];
		},
		clear: () => {
			data.clear();
			Object.keys(storageObj).forEach((k) => {
				if (!['getItem', 'setItem', 'removeItem', 'clear', 'length', 'key'].includes(k)) {
					delete storageObj[k];
				}
			});
		},
		get length() {
			return data.size;
		},
		key: (index: number) => Array.from(data.keys())[index] || null,
	};
	return storageObj as Storage;
}

// ---- Helpers ----

function createCtx(): BoardEventHandlerContext {
	return {
		processedEvents: new Set<string>(),
		boardDeletionTimestamps: new Map<string, number>(),
	};
}

function createBoardEvent(overrides: {
	id?: string;
	pubkey?: string;
	created_at?: number;
	dTag?: string;
	title?: string;
	pTags?: string[];
}) {
	const pTagArrays = (overrides.pTags || ['owner-pubkey']).map((p) => ['p', p]);
	return {
		id: overrides.id || 'event-123',
		kind: 30301,
		pubkey: overrides.pubkey || 'owner-pubkey',
		created_at: overrides.created_at || Math.floor(Date.now() / 1000),
		tags: [
			['d', overrides.dTag || 'board-1'],
			['title', overrides.title || 'Test Board'],
			...pTagArrays,
		],
		content: '',
	};
}

function makeCurrentBoard(id = 'board-1', author = 'owner-pubkey'): Board {
	return new Board({ id, name: 'Current Board', author });
}

// ---- Tests ----

describe('handleBoardEvent LWW - Shared Board Sync (v4.4)', () => {
	let mockStorage: Storage;

	beforeEach(() => {
		mockStorage = createMockLocalStorage();
		globalThis.localStorage = mockStorage;
		(globalThis as any).window = {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('accepts owner-signed event on shared board even when local updatedAt is newer (LWW bypass)', async () => {
		// Simuliere: localStorage hat updatedAt=NOW (Bug: Sub5 hatte undefined → NOW)
		// Owner publiziert ein Update (Event-Timestamp immer < NOW wegen Netzwerk-Latenz)
		const localBoard = new Board({
			id: 'board-1',
			name: 'Old Name',
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey'],
			// updatedAt = NOW (simuliert den alten Bug)
			updatedAt: new Date().toISOString(),
		});

		// Speichere Board in localStorage
		const { BoardStorage } = await import('../../storage.js');
		BoardStorage.saveBoard(localBoard);

		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard();

		// Owner-Event ist 10 Sekunden ALT (also < localStorage NOW)
		const ownerEvent = createBoardEvent({
			id: 'owner-event-1',
			pubkey: 'owner-pubkey',
			created_at: Math.floor(Date.now() / 1000) - 10,
			title: 'Updated Board Name',
			pTags: ['owner-pubkey', 'editor-pubkey'],
		});

		await handleBoardEvent(ctx, ownerEvent as any, currentBoard, boardStore);

		// ⚡ v4.4: Owner-Event MUSS akzeptiert werden trotz ältrem Timestamp!
		expect(boardStore.upsertBoardFromNostr).toHaveBeenCalledTimes(1);
		expect(boardStore.upsertBoardFromNostr).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Updated Board Name' })
		);
	});

	it('rejects stale non-owner event when local data is newer (normal LWW)', async () => {
		// Normaler Fall: Non-owner Event wird korrekt abgelehnt
		const localBoard = new Board({
			id: 'board-1',
			name: 'Current Name',
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey'],
			updatedAt: new Date().toISOString(),
		});

		const { BoardStorage } = await import('../../storage.js');
		BoardStorage.saveBoard(localBoard);

		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard();

		// Non-owner Event mit altem Timestamp
		const editorEvent = createBoardEvent({
			id: 'editor-event-1',
			pubkey: 'some-random-pubkey', // Nicht owner, nicht editor
			created_at: Math.floor(Date.now() / 1000) - 60,
			pTags: ['owner-pubkey', 'editor-pubkey'],
		});

		await handleBoardEvent(ctx, editorEvent as any, currentBoard, boardStore);

		// Non-owner stale event SOLL abgelehnt werden
		expect(boardStore.upsertBoardFromNostr).not.toHaveBeenCalled();
	});

	it('accepts newer event regardless of signer (normal LWW path)', async () => {
		// Event-Timestamp ist NEUER als localStorage → immer akzeptieren
		const oldTimestamp = new Date('2025-01-01T00:00:00.000Z').toISOString();
		const localBoard = new Board({
			id: 'board-1',
			name: 'Old Name',
			author: 'owner-pubkey',
			updatedAt: oldTimestamp,
		});

		const { BoardStorage } = await import('../../storage.js');
		BoardStorage.saveBoard(localBoard);

		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard();

		// Viel neuerer Event-Timestamp
		const event = createBoardEvent({
			id: 'new-event-1',
			pubkey: 'owner-pubkey',
			created_at: Math.floor(new Date('2025-06-01T00:00:00.000Z').getTime() / 1000),
			pTags: ['owner-pubkey'],
		});

		await handleBoardEvent(ctx, event as any, currentBoard, boardStore);

		expect(boardStore.upsertBoardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('skips duplicate events (processedEvents dedup)', async () => {
		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		ctx.processedEvents.add('already-seen-event');

		const currentBoard = makeCurrentBoard();

		const event = createBoardEvent({
			id: 'already-seen-event',
			pubkey: 'owner-pubkey',
		});

		await handleBoardEvent(ctx, event as any, currentBoard, boardStore);

		// Deduplicated → nicht verarbeitet
		expect(boardStore.upsertBoardFromNostr).not.toHaveBeenCalled();
	});

	it('accepts owner event even with equal timestamps (LWW bypass for shared board)', async () => {
		// Gleicher Timestamp: Owner-Event darf nicht blockiert werden auf Shared Boards
		const exactTime = Math.floor(Date.now() / 1000);
		const exactTimeIso = new Date(exactTime * 1000).toISOString();

		const localBoard = new Board({
			id: 'board-1',
			name: 'Local Name',
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey'],
			updatedAt: exactTimeIso,
		});

		const { BoardStorage } = await import('../../storage.js');
		BoardStorage.saveBoard(localBoard);

		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard();

		const ownerEvent = createBoardEvent({
			id: 'equal-time-event',
			pubkey: 'owner-pubkey',
			created_at: exactTime, // Exakt gleicher Timestamp
			title: 'Equal Time Update',
			pTags: ['owner-pubkey', 'editor-pubkey'],
		});

		await handleBoardEvent(ctx, ownerEvent as any, currentBoard, boardStore);

		// ⚡ v4.4: Owner-Event bei gleichem Timestamp auf Shared Board → akzeptieren
		expect(boardStore.upsertBoardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('processes board event without local board (INSERT path, no LWW check)', async () => {
		// Kein Board in localStorage → LWW check wird übersprungen, INSERT
		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard('other-board', 'other-owner');

		const event = createBoardEvent({
			id: 'new-board-event',
			pubkey: 'owner-pubkey',
			dTag: 'board-1',
			title: 'Brand New Board',
			pTags: ['owner-pubkey', 'editor-pubkey'],
		});

		await handleBoardEvent(ctx, event as any, currentBoard, boardStore);

		// Kein lokales Board → kein LWW → wird akzeptiert
		expect(boardStore.upsertBoardFromNostr).toHaveBeenCalledTimes(1);
	});
});

describe('handleBoardEvent - Echo Prevention', () => {
	let mockStorage: Storage;

	beforeEach(() => {
		mockStorage = createMockLocalStorage();
		globalThis.localStorage = mockStorage;
		(globalThis as any).window = {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('skips own events (echo loop prevention)', async () => {
		// Override syncManager mock for this test
		const { getSyncManager } = await import('../../../syncManager.svelte.js');
		(getSyncManager as any).mockReturnValue({
			isMyEvent: vi.fn(() => true), // THIS is my event
			clearMyEvent: vi.fn(),
		});

		const boardStore = {
			upsertBoardFromNostr: vi.fn(),
		};

		const ctx = createCtx();
		const currentBoard = makeCurrentBoard();

		const event = createBoardEvent({
			id: 'my-own-event',
			pubkey: 'editor-pubkey',
		});

		await handleBoardEvent(ctx, event as any, currentBoard, boardStore);

		// Eigene Events → nicht verarbeitet
		expect(boardStore.upsertBoardFromNostr).not.toHaveBeenCalled();
	});
});
