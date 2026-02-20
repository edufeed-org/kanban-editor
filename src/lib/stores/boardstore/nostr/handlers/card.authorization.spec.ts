/**
 * Tests für Sicherheits-Guard in handleCardEvent()
 *
 * Validiert, dass Card-Events (Kind 30302) nur akzeptiert werden,
 * wenn event.pubkey entweder board.author oder in board.maintainers ist.
 *
 * Deckt ab:
 * - Owner-Card-Update wird angewendet
 * - Maintainer-Card-Update wird angewendet
 * - Fremder Pubkey wird verworfen
 * - Background-Board-Sync respektiert den Guard
 * - Lokale Boards ohne author → Guard übersprungen
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCardEvent } from './card';

const OWNER_PUBKEY = 'owner-pubkey-hex-0000';
const EDITOR_PUBKEY = 'editor-pubkey-hex-1111';
const STRANGER_PUBKEY = 'stranger-pubkey-hex-9999';

// Mock BoardStorage for background board tests
vi.mock('../../storage.js', () => {
	let _mockBoard: any = null;
	return {
		BoardStorage: {
			loadBoard: vi.fn(() => _mockBoard),
			saveBoard: vi.fn(),
			__setMockBoard: (board: any) => { _mockBoard = board; },
		},
	};
});

function createBoard(overrides?: {
	author?: string;
	maintainers?: string[];
	cardUpdatedAt?: string;
	cardEventId?: string;
}) {
	const author = overrides?.author ?? OWNER_PUBKEY;
	const maintainers = overrides?.maintainers ?? [EDITOR_PUBKEY];

	return {
		id: 'board-1',
		author,
		maintainers,
		isMaintainer(pubkey: string): boolean {
			if (!pubkey) return false;
			return pubkey === author || maintainers.includes(pubkey);
		},
		findCardAndColumn: vi.fn(() => {
			if (overrides?.cardUpdatedAt) {
				return {
					card: {
						id: 'card-1',
						updatedAt: overrides.cardUpdatedAt,
						eventId: overrides.cardEventId,
					},
					column: { id: 'col-1' },
				};
			}
			return null;
		}),
	};
}

function createBackgroundBoard(overrides?: {
	author?: string;
	maintainers?: string[];
}) {
	const author = overrides?.author ?? OWNER_PUBKEY;
	const maintainers = overrides?.maintainers ?? [EDITOR_PUBKEY];
	return {
		id: 'bg-board-1',
		author,
		maintainers,
		isMaintainer(pubkey: string): boolean {
			if (!pubkey) return false;
			return pubkey === author || maintainers.includes(pubkey);
		},
		markAsChanged: vi.fn(),
	};
}

function createCardEvent(pubkey: string, overrides?: {
	id?: string;
	boardRef?: string;
	columnId?: string;
}) {
	const boardRef = overrides?.boardRef ?? `30301:${OWNER_PUBKEY}:board-1`;
	return {
		id: overrides?.id ?? `card-event-${pubkey.slice(0, 8)}-${Date.now()}`,
		kind: 30302,
		pubkey,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['d', 'card-1'],
			['a', boardRef],
			['s', overrides?.columnId ?? 'col-1'],
			['rank', '0'],
			['ts', String(Date.now())],
		],
		content: 'Card content',
	};
}

function createCtx() {
	return {
		processedEvents: new Set<string>(),
		cardDeletionTimestamps: new Map<string, number>(),
		syncManager: {
			isMyEvent: vi.fn(() => false),
			clearMyEvent: vi.fn(),
		},
	};
}

function createBoardStore() {
	return {
		upsertCardFromNostr: vi.fn(),
		upsertCardToBackgroundBoard: vi.fn(),
	};
}

describe('handleCardEvent Authorization Guard', () => {
	let ctx: ReturnType<typeof createCtx>;
	let boardStore: ReturnType<typeof createBoardStore>;
	let BoardStorageMock: any;

	beforeEach(async () => {
		ctx = createCtx();
		boardStore = createBoardStore();
		// Access the mock to control background board
		BoardStorageMock = await import('../../storage.js');
		(BoardStorageMock.BoardStorage as any).__setMockBoard(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// --- Current Board Tests ---

	it('accepts card event from board owner', async () => {
		const board = createBoard();
		const event = createCardEvent(OWNER_PUBKEY);

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('accepts card event from maintainer', async () => {
		const board = createBoard();
		const event = createCardEvent(EDITOR_PUBKEY);

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('rejects card event from unauthorized pubkey', async () => {
		const board = createBoard();
		const event = createCardEvent(STRANGER_PUBKEY);

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardFromNostr).not.toHaveBeenCalled();
		expect(boardStore.upsertCardToBackgroundBoard).not.toHaveBeenCalled();
	});

	it('skips guard for local boards without author', async () => {
		const board = createBoard({ author: '' });
		const event = createCardEvent(STRANGER_PUBKEY);

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		// Guard skipped → event accepted regardless of pubkey
		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('skips guard when event.pubkey is missing', async () => {
		const board = createBoard();
		const event = createCardEvent(OWNER_PUBKEY);
		delete (event as any).pubkey;

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		// publisherPubkey is '' → guard condition is false → skip guard
		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});

	it('accepts second maintainer', async () => {
		const secondEditor = 'editor-2-pubkey';
		const board = createBoard({ maintainers: [EDITOR_PUBKEY, secondEditor] });
		const event = createCardEvent(secondEditor);

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardFromNostr).toHaveBeenCalledTimes(1);
	});

	// --- Background Board Tests ---

	it('accepts card event for background board from owner', async () => {
		const board = createBoard(); // current board
		const bgBoard = createBackgroundBoard();
		(BoardStorageMock.BoardStorage as any).__setMockBoard(bgBoard);

		const event = createCardEvent(OWNER_PUBKEY, {
			boardRef: `30301:${OWNER_PUBKEY}:bg-board-1`,
		});

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardToBackgroundBoard).toHaveBeenCalledTimes(1);
		expect(bgBoard.markAsChanged).toHaveBeenCalledTimes(1);
	});

	it('accepts card event for background board from maintainer', async () => {
		const board = createBoard();
		const bgBoard = createBackgroundBoard();
		(BoardStorageMock.BoardStorage as any).__setMockBoard(bgBoard);

		const event = createCardEvent(EDITOR_PUBKEY, {
			boardRef: `30301:${OWNER_PUBKEY}:bg-board-1`,
		});

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardToBackgroundBoard).toHaveBeenCalledTimes(1);
	});

	it('rejects card event for background board from stranger', async () => {
		const board = createBoard();
		const bgBoard = createBackgroundBoard();
		(BoardStorageMock.BoardStorage as any).__setMockBoard(bgBoard);

		const event = createCardEvent(STRANGER_PUBKEY, {
			boardRef: `30301:${OWNER_PUBKEY}:bg-board-1`,
		});

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		expect(boardStore.upsertCardToBackgroundBoard).not.toHaveBeenCalled();
	});

	it('skips guard for background board without author', async () => {
		const board = createBoard();
		const bgBoard = createBackgroundBoard({ author: '' });
		(BoardStorageMock.BoardStorage as any).__setMockBoard(bgBoard);

		const event = createCardEvent(STRANGER_PUBKEY, {
			boardRef: `30301:${OWNER_PUBKEY}:bg-board-1`,
		});

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		// Guard skipped → event accepted
		expect(boardStore.upsertCardToBackgroundBoard).toHaveBeenCalledTimes(1);
	});

	it('allows background board sync when board not found locally', async () => {
		const board = createBoard();
		// BoardStorage.loadBoard returns null (no mock board set)
		(BoardStorageMock.BoardStorage as any).__setMockBoard(null);

		const event = createCardEvent(STRANGER_PUBKEY, {
			boardRef: `30301:someone:unknown-board`,
		});

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		// Board not found locally → can't validate → still accepted
		expect(boardStore.upsertCardToBackgroundBoard).toHaveBeenCalledTimes(1);
	});

	// --- LWW still works alongside guard ---

	it('LWW skip still works for authorized users', async () => {
		// Board with an existing card that has a newer timestamp
		const board = createBoard({
			cardUpdatedAt: new Date('2030-01-01T00:00:00Z').toISOString(),
		});
		const event = createCardEvent(OWNER_PUBKEY);
		// Event created_at is "now" which is before 2030 → LWW should skip

		await handleCardEvent(ctx as any, event as any, board as any, boardStore);

		// Even though owner is authorized, LWW rejects because local is newer
		expect(boardStore.upsertCardFromNostr).not.toHaveBeenCalled();
	});
});
