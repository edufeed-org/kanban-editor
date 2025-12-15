// src/lib/stores/boardstore/deletedBoards.ts
// Persistente "Tombstones" für gelöschte Boards.
// Ziel: Verhindert Board-Resurrection durch Nostr/Background-Saves + localStorage Key-Scan.

const DELETED_BOARDS_KEY = 'kanban-deleted-boards-v1';
const MAX_ENTRIES = 500;

export type DeletedBoardsMap = Record<string, number>; // boardId -> deletedAt (ms)

function safeParseJson<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function getLocalStorage(): Storage | null {
	try {
		// Browser normal: window.localStorage
		if (typeof window !== 'undefined' && (window as any).localStorage) {
			return (window as any).localStorage as Storage;
		}
	} catch {
		// Some environments can throw on localStorage access (e.g. privacy modes)
	}

	try {
		// Tests / non-browser: globalThis.localStorage
		const candidate = (globalThis as any)?.localStorage;
		return candidate ? (candidate as Storage) : null;
	} catch {
		return null;
	}
}

export function loadDeletedBoards(): DeletedBoardsMap {
	const storage = getLocalStorage();
	if (!storage) return {};
	const raw = storage.getItem(DELETED_BOARDS_KEY);
	const data = safeParseJson<DeletedBoardsMap>(raw, {});

	// Defensive: nur string->number erlauben
	const normalized: DeletedBoardsMap = {};
	for (const [boardId, deletedAt] of Object.entries(data)) {
		if (!boardId) continue;
		const ts = typeof deletedAt === 'number' ? deletedAt : Number(deletedAt);
		if (!Number.isFinite(ts) || ts <= 0) continue;
		normalized[boardId] = ts;
	}
	return normalized;
}

export function saveDeletedBoards(map: DeletedBoardsMap): void {
	const storage = getLocalStorage();
	if (!storage) return;
	try {
		const entries = Object.entries(map)
			.filter(([id, ts]) => Boolean(id) && Number.isFinite(ts) && ts > 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, MAX_ENTRIES);

		const trimmed: DeletedBoardsMap = Object.fromEntries(entries);
		storage.setItem(DELETED_BOARDS_KEY, JSON.stringify(trimmed));
	} catch {
		// Best-effort: Tombstones sind eine Schutzschicht, aber dürfen keine Crash-Quelle sein.
	}
}

export function isBoardTombstoned(boardId: string): boolean {
	if (!getLocalStorage()) return false;
	if (!boardId) return false;
	const map = loadDeletedBoards();
	return map[boardId] !== undefined;
}

export function getBoardDeletedAtMs(boardId: string): number | null {
	if (!boardId) return null;
	const map = loadDeletedBoards();
	return map[boardId] ?? null;
}

export function tombstoneBoard(boardId: string, deletedAtMs: number = Date.now()): void {
	if (!getLocalStorage()) return;
	if (!boardId) return;
	const map = loadDeletedBoards();
	map[boardId] = Number.isFinite(deletedAtMs) ? deletedAtMs : Date.now();
	saveDeletedBoards(map);
}

export function clearBoardTombstone(boardId: string): void {
	if (!getLocalStorage()) return;
	if (!boardId) return;
	const map = loadDeletedBoards();
	if (map[boardId] === undefined) return;
	delete map[boardId];
	saveDeletedBoards(map);
}

export function clearAllBoardTombstones(): void {
	const storage = getLocalStorage();
	if (!storage) return;
	try {
		storage.removeItem(DELETED_BOARDS_KEY);
	} catch {
		// Best-effort
	}
}
