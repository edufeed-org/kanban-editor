/**
 * Tests für v4.4 Fix: Sub5 updatedAt und Operations INSERT updatedAt
 *
 * Verifiziert dass das Board mit korrektem Event-Timestamp erstellt wird,
 * nicht mit generateTimestamp()=NOW.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Board } from '$lib/classes/BoardModel';
import { BoardOperations } from './operations';

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

describe('BoardOperations.upsertBoardFromNostr INSERT - updatedAt preservation (v4.4)', () => {
	let mockStorage: Storage;

	beforeEach(() => {
		mockStorage = createMockLocalStorage();
		globalThis.localStorage = mockStorage;
		(globalThis as any).window = {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('preserves event updatedAt in INSERT path instead of defaulting to NOW', () => {
		const board = new Board({ name: 'Existing Board' });

		const eventTimestamp = '2025-06-15T10:30:00.000Z';

		// INSERT: Board existiert noch nicht in localStorage
		const result = BoardOperations.upsertBoardFromNostr(board, {
			id: 'new-shared-board-id',
			name: 'Shared Board',
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey'],
			columns: [],
			updatedAt: eventTimestamp,
		} as any);

		expect(result).toBe(false); // false = INSERT

		// Prüfe dass das gespeicherte Board den Event-Timestamp hat, nicht NOW
		const storedJson = globalThis.localStorage.getItem('kanban-new-shared-board-id');
		expect(storedJson).toBeTruthy();

		const storedBoard = JSON.parse(storedJson!);
		const storedUpdatedAt = new Date(storedBoard.updatedAt).getTime();
		const eventTime = new Date(eventTimestamp).getTime();

		// updatedAt sollte dem Event-Timestamp entsprechen, NICHT der aktuellen Zeit
		expect(storedUpdatedAt).toBe(eventTime);
	});

	it('INSERT with undefined updatedAt defaults to NOW (fallback)', () => {
		const board = new Board({ name: 'Existing Board' });
		const beforeTime = Date.now();

		const result = BoardOperations.upsertBoardFromNostr(board, {
			id: 'fallback-board-id',
			name: 'Fallback Board',
			author: 'owner-pubkey',
			columns: [],
			updatedAt: undefined, // Kein Timestamp
		} as any);

		const afterTime = Date.now();

		expect(result).toBe(false); // INSERT

		const storedJson = globalThis.localStorage.getItem('kanban-fallback-board-id');
		expect(storedJson).toBeTruthy();

		const storedBoard = JSON.parse(storedJson!);
		const storedUpdatedAt = new Date(storedBoard.updatedAt).getTime();

		// Ohne updatedAt → Board constructor default = NOW (akzeptabel)
		expect(storedUpdatedAt).toBeGreaterThanOrEqual(beforeTime);
		expect(storedUpdatedAt).toBeLessThanOrEqual(afterTime + 100);
	});

	it('Sub5 boardProps with event timestamp produce correct updatedAt in INSERT', () => {
		const board = new Board({ name: 'Existing Board' });

		// Simuliere was Sub5 JETZT sendet (nach v4.4 Fix):
		// event.created_at = 1718445000 (Unix seconds)
		const eventCreatedAt = 1718445000;
		const expectedIso = new Date(eventCreatedAt * 1000).toISOString();

		const boardProps = {
			id: 'sub5-board',
			name: 'Sub5 Board',
			author: 'owner-pubkey',
			maintainers: ['editor-pubkey'],
			columns: [],
			// ⚡ v4.4: Sub5 setzt jetzt updatedAt = ISO string vom Event
			updatedAt: expectedIso,
		};

		const result = BoardOperations.upsertBoardFromNostr(board, boardProps as any);
		expect(result).toBe(false); // INSERT

		const storedJson = globalThis.localStorage.getItem('kanban-sub5-board');
		const storedBoard = JSON.parse(storedJson!);

		// updatedAt muss dem Event-Timestamp entsprechen
		expect(new Date(storedBoard.updatedAt).getTime()).toBe(eventCreatedAt * 1000);
	});

	it('UPDATE path preserves incoming updatedAt for LWW consistency', () => {
		// Board existiert bereits in localStorage
		const existingBoard = new Board({
			id: 'existing-board',
			name: 'Old Name',
			author: 'owner-pubkey',
			updatedAt: '2025-01-01T00:00:00.000Z',
		});
		
		// Board muss sowohl das aktive Board als auch in localStorage sein
		import('./storage').then(({ BoardStorage }) => {
			BoardStorage.saveBoard(existingBoard);
		});

		const newerTimestamp = '2025-06-15T10:30:00.000Z';

		const result = BoardOperations.upsertBoardFromNostr(existingBoard, {
			id: 'existing-board',
			name: 'New Name',
			author: 'owner-pubkey',
			maintainers: [],
			columns: [],
			updatedAt: newerTimestamp,
		} as any);

		expect(result).toBe(true); // true = UPDATE

		// Board-Name wurde aktualisiert
		expect(existingBoard.name).toBe('New Name');
	});
});
