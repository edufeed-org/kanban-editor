import { describe, expect, it } from 'vitest';

import { PermissionChecks } from './permissionCheck';
import { BoardRole } from '$lib/types/sharing';

describe('PermissionChecks.canEditBoardMeta()', () => {
	it('allows owner for normal boards', () => {
		expect(PermissionChecks.canEditBoardMeta(BoardRole.OWNER, 'board-1')).toBe(true);
	});

	it('denies editor for normal boards', () => {
		expect(PermissionChecks.canEditBoardMeta(BoardRole.EDITOR, 'board-1')).toBe(false);
	});

	it('allows everyone for demo-board', () => {
		expect(PermissionChecks.canEditBoardMeta(null, 'demo-board')).toBe(true);
		expect(PermissionChecks.canEditBoardMeta(BoardRole.EDITOR, 'demo-board')).toBe(true);
	});
});

describe('PermissionChecks.canPublishBoard()', () => {
	it('allows owner for normal boards', () => {
		expect(PermissionChecks.canPublishBoard(BoardRole.OWNER, 'board-1')).toBe(true);
	});

	it('denies editor for normal boards', () => {
		expect(PermissionChecks.canPublishBoard(BoardRole.EDITOR, 'board-1')).toBe(false);
	});

	it('allows everyone for demo-board', () => {
		expect(PermissionChecks.canPublishBoard(null, 'demo-board')).toBe(true);
		expect(PermissionChecks.canPublishBoard(BoardRole.EDITOR, 'demo-board')).toBe(true);
	});
});
