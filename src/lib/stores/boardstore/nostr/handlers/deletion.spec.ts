import { describe, expect, it, vi, beforeEach } from 'vitest';

import { handleDeletionEvent, type DeletionEventHandlerContext } from './deletion';

vi.mock('../../storage.js', () => {
	return {
		BoardStorage: {
			loadBoard: vi.fn(),
			deleteBoard: vi.fn(),
		},
	};
});

vi.mock('../deletionEventsCache.js', () => {
	return {
		saveProcessedDeletions: vi.fn((set: Set<string>) => set),
	};
});

import { saveProcessedDeletions } from '../deletionEventsCache.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BoardStorage } from '../../storage.js';

function createCtx(): DeletionEventHandlerContext {
	return {
		processedEvents: new Set<string>(),
		processedDeletionEvents: new Set<string>(),
		cardDeletionTimestamps: new Map<string, number>(),
		boardDeletionTimestamps: new Map<string, number>(),
	};
}

function createBoardStoreMock(overrides?: {
	boardId?: string;
	findCardResult?: { card?: any; column?: any } | null;
}) {
	const boardId = overrides?.boardId ?? 'board-1';
	const card = overrides?.findCardResult?.card ?? { id: 'card-1', author: 'pubkey-target' };
	const column = overrides?.findCardResult?.column ?? { id: 'col-1' };

	return {
		data: {
			id: boardId,
			findCardAndColumn: vi.fn(() => overrides?.findCardResult ?? ({ card, column } as any)),
		},
		refreshBoardList: vi.fn(),
		switchToAnotherBoardAfterDeletion: vi.fn(),
		deleteCardFromNostr: vi.fn(),
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('handleDeletionEvent (Kind 5) authorization + safety', () => {
	it('skips board deletion when deletion pubkey != a-tag pubkey', async () => {
		const ctx = createCtx();
		const boardStore = createBoardStoreMock();

		const deletionEvent = {
			id: 'del-1',
			kind: 5,
			pubkey: 'pubkey-attacker',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['a', '30301:pubkey-target:board-123']],
		};

		await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

		expect((BoardStorage as any).loadBoard).not.toHaveBeenCalled();
		expect((BoardStorage as any).deleteBoard).not.toHaveBeenCalled();
		expect(boardStore.refreshBoardList).not.toHaveBeenCalled();
		expect(saveProcessedDeletions).not.toHaveBeenCalled();
	});

	it('skips board deletion when local board author mismatches a-tag author', async () => {
		const ctx = createCtx();
		const boardStore = createBoardStoreMock({ boardId: 'board-123' });

		(BoardStorage as any).loadBoard.mockReturnValue({ id: 'board-123', author: 'pubkey-different' });

		const deletionEvent = {
			id: 'del-2',
			kind: 5,
			pubkey: 'pubkey-target',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['a', '30301:pubkey-target:board-123']],
		};

		await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

		expect((BoardStorage as any).deleteBoard).not.toHaveBeenCalled();
		expect(boardStore.refreshBoardList).not.toHaveBeenCalled();
		expect(saveProcessedDeletions).not.toHaveBeenCalled();
	});

	it('deletes local board when pubkey matches and author matches', async () => {
		const ctx = createCtx();
		const boardStore = createBoardStoreMock({ boardId: 'board-123' });

		(BoardStorage as any).loadBoard.mockReturnValue({ id: 'board-123', author: 'pubkey-target' });

		const deletionEvent = {
			id: 'del-3',
			kind: 5,
			pubkey: 'pubkey-target',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['a', '30301:pubkey-target:board-123']],
		};

		await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

		expect((BoardStorage as any).deleteBoard).toHaveBeenCalledWith('board-123');
		expect(boardStore.refreshBoardList).toHaveBeenCalled();
		expect(saveProcessedDeletions).toHaveBeenCalledTimes(1);
	});

	it('skips card deletion when deletion pubkey != a-tag pubkey', async () => {
		const ctx = createCtx();
		const boardStore = createBoardStoreMock({
			findCardResult: { card: { id: 'card-123', author: 'pubkey-target' }, column: { id: 'col-1' } },
		});

		const deletionEvent = {
			id: 'del-4',
			kind: 5,
			pubkey: 'pubkey-attacker',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['a', '30302:pubkey-target:card-123']],
		};

		await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

		expect(boardStore.deleteCardFromNostr).not.toHaveBeenCalled();
		expect(saveProcessedDeletions).not.toHaveBeenCalled();
	});

	it('skips card deletion when card.author mismatches a-tag author', async () => {
		const ctx = createCtx();
		const boardStore = createBoardStoreMock({
			findCardResult: { card: { id: 'card-123', author: 'pubkey-different' }, column: { id: 'col-1' } },
		});

		const deletionEvent = {
			id: 'del-5',
			kind: 5,
			pubkey: 'pubkey-target',
			created_at: Math.floor(Date.now() / 1000),
			tags: [['a', '30302:pubkey-target:card-123']],
		};

		await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

		expect(boardStore.deleteCardFromNostr).not.toHaveBeenCalled();
		expect(saveProcessedDeletions).toHaveBeenCalledTimes(1);
	});

		it('persists deletion id when board is not local but deletion timestamp is tracked (anti-resurrection)', async () => {
			const ctx = createCtx();
			const boardStore = createBoardStoreMock({ boardId: 'board-999' });

			(BoardStorage as any).loadBoard.mockReturnValue(null);

			const deletionEvent = {
				id: 'del-6',
				kind: 5,
				pubkey: 'pubkey-target',
				created_at: Math.floor(Date.now() / 1000),
				tags: [['a', '30301:pubkey-target:board-999']],
			};

			await handleDeletionEvent(ctx as any, deletionEvent as any, boardStore as any);

			// Tombstone should be applied even if board isn't in localStorage
			expect((BoardStorage as any).deleteBoard).toHaveBeenCalledWith('board-999');
			expect(saveProcessedDeletions).toHaveBeenCalledTimes(1);
		});
});
