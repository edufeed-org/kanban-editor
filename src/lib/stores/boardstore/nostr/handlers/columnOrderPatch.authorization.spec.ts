/**
 * Tests für Sicherheits-Guard in handleColumnOrderPatchEvent()
 *
 * Validiert, dass Column-Patch-Events (Kind 8571) nur akzeptiert werden,
 * wenn event.pubkey entweder board.author oder in board.maintainers ist.
 *
 * Guard-Logik: currentBoard.isMaintainer(event.pubkey)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleColumnOrderPatchEvent } from './columnOrderPatch';

// Mock EVENT_KINDS
vi.mock('$lib/utils/nostrEvents.js', () => ({
	EVENT_KINDS: { COLUMN_ORDER_PATCH: 8571 },
}));

const OWNER_PUBKEY = 'owner-pubkey-hex-0000';
const EDITOR_PUBKEY = 'editor-pubkey-hex-1111';
const STRANGER_PUBKEY = 'stranger-pubkey-hex-9999';

function createBoard(overrides?: { author?: string; maintainers?: string[] }) {
	const author = overrides && 'author' in overrides ? overrides.author : OWNER_PUBKEY;
	const maintainers = overrides?.maintainers ?? [EDITOR_PUBKEY];
	return {
		id: 'board-1',
		author,
		maintainers,
		isMaintainer(pubkey: string): boolean {
			if (!pubkey) return false;
			return pubkey === author || maintainers.includes(pubkey);
		},
	};
}

function createPatchEvent(pubkey: string, id?: string) {
	return {
		id: id ?? `patch-event-${pubkey.slice(0, 8)}`,
		kind: 8571,
		pubkey,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['a', `30301:${OWNER_PUBKEY}:board-1`],
			['d', 'board-1'],
			['order', 'col-1', 'col-2'],
			['updated_at_ms', String(Date.now())],
		],
	};
}

function createCtx() {
	return { processedEvents: new Set<string>() };
}

function createBoardStore() {
	return {
		applyColumnOrderPatchFromNostr: vi.fn(() => true),
	};
}

describe('handleColumnOrderPatchEvent Authorization Guard', () => {
	let ctx: ReturnType<typeof createCtx>;
	let boardStore: ReturnType<typeof createBoardStore>;

	beforeEach(() => {
		ctx = createCtx();
		boardStore = createBoardStore();
	});

	it('accepts patch from board owner', async () => {
		const board = createBoard();
		const event = createPatchEvent(OWNER_PUBKEY);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('accepts patch from maintainer (editor)', async () => {
		const board = createBoard();
		const event = createPatchEvent(EDITOR_PUBKEY);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('rejects patch from unauthorized pubkey', async () => {
		const board = createBoard();
		const event = createPatchEvent(STRANGER_PUBKEY);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(false);
		expect(boardStore.applyColumnOrderPatchFromNostr).not.toHaveBeenCalled();
	});

	it('skips guard for local boards without author (author undefined)', async () => {
		const board = createBoard({ author: undefined as any });
		const event = createPatchEvent(STRANGER_PUBKEY);

		// Adjust a-tag so board-mismatch check passes
		event.tags[0] = ['a', `30301:someone:board-1`];

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		// Guard skipped because board.author is falsy → patch accepted
		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('skips guard for local boards without author (author empty string)', async () => {
		const board = createBoard({ author: '' });
		const event = createPatchEvent(STRANGER_PUBKEY);

		event.tags[0] = ['a', `30301:someone:board-1`];

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('skips guard when event.pubkey is missing', async () => {
		const board = createBoard();
		const event = createPatchEvent(OWNER_PUBKEY);
		delete (event as any).pubkey;

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		// publisherPubkey is '' → guard condition (currentBoard.author && publisherPubkey) is false → skip
		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('accepts second maintainer in list', async () => {
		const secondEditor = 'editor-2-pubkey-hex';
		const board = createBoard({ maintainers: [EDITOR_PUBKEY, secondEditor] });
		const event = createPatchEvent(secondEditor);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('existing dedup still works alongside guard', async () => {
		const board = createBoard();
		const event = createPatchEvent(OWNER_PUBKEY, 'same-id');

		// First call: accepted
		const result1 = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);
		expect(result1).toBe(true);

		// Second call: deduplicated (already processed)
		const result2 = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);
		expect(result2).toBe(false);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('board-mismatch check still fires before guard', async () => {
		const board = createBoard();
		const event = createPatchEvent(OWNER_PUBKEY);
		// Wrong board reference
		event.tags = [
			['a', '30301:someone:different-board'],
			['d', 'different-board'],
			['order', 'col-1'],
		];

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(false);
		expect(boardStore.applyColumnOrderPatchFromNostr).not.toHaveBeenCalled();
	});

	it('works with fallback when isMaintainer is not a function', async () => {
		// Board without isMaintainer method (plain object)
		const board = {
			id: 'board-1',
			author: OWNER_PUBKEY,
		};
		const event = createPatchEvent(OWNER_PUBKEY);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(true);
		expect(boardStore.applyColumnOrderPatchFromNostr).toHaveBeenCalledTimes(1);
	});

	it('rejects stranger even with fallback when isMaintainer is not a function', async () => {
		const board = {
			id: 'board-1',
			author: OWNER_PUBKEY,
		};
		const event = createPatchEvent(STRANGER_PUBKEY);

		const result = await handleColumnOrderPatchEvent(ctx, event, board, boardStore);

		expect(result).toBe(false);
		expect(boardStore.applyColumnOrderPatchFromNostr).not.toHaveBeenCalled();
	});
});
