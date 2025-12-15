// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoardSharingOperations } from '../sharing.js';
import { tombstoneBoard } from '../deletedBoards.js';
import { shouldToastNewSharedBoard } from './subscriptions.js';

describe('shouldToastNewSharedBoard()', () => {
	beforeEach(() => {
		BoardSharingOperations.clearAllHiddenBoards();
		try {
			localStorage.clear();
		} catch {
			// ignore
		}
	});

	it('unterdrückt Toast für hidden/left Boards (author-scoped)', () => {
		BoardSharingOperations.hideBoard('board-1', 'owner-hex', 'left');

		const boardStore = {
			filterSharedBoards: vi.fn(() => []),
		};

		expect(
			shouldToastNewSharedBoard({ boardId: 'board-1', boardAuthor: 'owner-hex', boardStore })
		).toBe(false);
	});

	it('unterdrückt Toast wenn Board bereits in Shared-Liste ist', () => {
		const boardStore = {
			filterSharedBoards: vi.fn(() => [{ id: 'board-2' }]),
		};

		expect(shouldToastNewSharedBoard({ boardId: 'board-2', boardAuthor: 'owner-hex', boardStore })).toBe(
			false
		);
	});

	it('unterdrückt Toast wenn Board tombstoned ist', () => {
		tombstoneBoard('board-4');

		const boardStore = {
			filterSharedBoards: vi.fn(() => []),
		};

		expect(shouldToastNewSharedBoard({ boardId: 'board-4', boardAuthor: 'owner-hex', boardStore })).toBe(false);
	});

	it('erlaubt Toast wenn Board nicht hidden und noch nicht gelistet ist', () => {
		const boardStore = {
			filterSharedBoards: vi.fn(() => []),
		};

		expect(shouldToastNewSharedBoard({ boardId: 'board-3', boardAuthor: 'owner-hex', boardStore })).toBe(true);
	});
});
