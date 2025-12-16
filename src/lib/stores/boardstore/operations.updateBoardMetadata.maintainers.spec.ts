import { describe, expect, it, vi } from 'vitest';
import { Board } from '$lib/classes/BoardModel.js';
import { BoardOperations } from './operations';

describe('BoardOperations.updateBoardMetadata() - maintainers preservation', () => {
	it('does not clear maintainers when only name/description/tags change', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

		const board = new Board({
			id: 'board-1',
			name: 'Old',
			description: 'Old desc',
			author: 'owner_pubkey',
			maintainers: ['editor_pubkey'],
			tags: ['a'],
			ccLicense: 'cc-by-4.0',
			columns: [],
			publishState: 'published'
		});

		const beforeMaintainers = [...board.maintainers];
		const beforeUpdatedAt = board.updatedAt;

		vi.setSystemTime(new Date('2025-01-01T00:00:01.000Z'));

		BoardOperations.updateBoardMetadata(board, {
			name: 'New',
			description: 'New desc',
			tags: ['x', 'y']
		});

		expect(board.maintainers).toEqual(beforeMaintainers);
		expect(board.updatedAt).not.toBe(beforeUpdatedAt);

		vi.useRealTimers();
	});

	it('normalizes maintainers when explicitly provided (dedupe + exclude owner)', () => {
		const board = new Board({
			id: 'board-2',
			name: 'Board',
			author: 'owner_pubkey',
			maintainers: ['editor_pubkey'],
			columns: []
		});

		BoardOperations.updateBoardMetadata(board, {
			maintainers: ['owner_pubkey', 'editor_pubkey', 'editor_pubkey', '']
		});

		expect(board.maintainers).toEqual(['editor_pubkey']);
	});
});
