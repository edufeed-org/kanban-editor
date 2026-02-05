// src/lib/stores/boardstore/deletedCards.ts
// Persistente "Tombstones" für gelöschte Cards.
// Ziel: Verhindert Card-Resurrection durch Nostr-Events nach Reload.

const DELETED_CARDS_KEY = 'kanban-deleted-cards-v1';
const MAX_ENTRIES = 5000;

export type DeletedCardsMap = Record<string, Record<string, number>>; // boardId -> (cardId -> deletedAt ms)

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
		if (typeof window !== 'undefined' && (window as any).localStorage) {
			return (window as any).localStorage as Storage;
		}
	} catch {
		// ignore
	}

	try {
		const candidate = (globalThis as any)?.localStorage;
		return candidate ? (candidate as Storage) : null;
	} catch {
		return null;
	}
}

export function loadDeletedCards(): DeletedCardsMap {
	const storage = getLocalStorage();
	if (!storage) return {};
	const raw = storage.getItem(DELETED_CARDS_KEY);
	const data = safeParseJson<DeletedCardsMap>(raw, {});

	const normalized: DeletedCardsMap = {};
	for (const [boardId, cardMap] of Object.entries(data)) {
		if (!boardId || typeof cardMap !== 'object' || cardMap === null) continue;
		const next: Record<string, number> = {};
		for (const [cardId, deletedAt] of Object.entries(cardMap as Record<string, number>)) {
			if (!cardId) continue;
			const ts = typeof deletedAt === 'number' ? deletedAt : Number(deletedAt);
			if (!Number.isFinite(ts) || ts <= 0) continue;
			next[cardId] = ts;
		}
		if (Object.keys(next).length > 0) {
			normalized[boardId] = next;
		}
	}

	return normalized;
}

export function saveDeletedCards(map: DeletedCardsMap): void {
	const storage = getLocalStorage();
	if (!storage) return;
	try {
		const entries: Array<[string, Record<string, number>]> = [];
		for (const [boardId, cardMap] of Object.entries(map)) {
			const cards = Object.entries(cardMap)
				.filter(([id, ts]) => Boolean(id) && Number.isFinite(ts) && ts > 0)
				.sort((a, b) => b[1] - a[1])
				.slice(0, MAX_ENTRIES);
			if (cards.length > 0) {
				entries.push([boardId, Object.fromEntries(cards)]);
			}
		}
		storage.setItem(DELETED_CARDS_KEY, JSON.stringify(Object.fromEntries(entries)));
	} catch {
		// Best-effort
	}
}

export function isCardTombstoned(boardId: string, cardId: string): boolean {
	if (!getLocalStorage()) return false;
	if (!boardId || !cardId) return false;
	const map = loadDeletedCards();
	return map[boardId]?.[cardId] !== undefined;
}

export function tombstoneCard(boardId: string, cardId: string, deletedAtMs: number = Date.now()): void {
	if (!getLocalStorage()) return;
	if (!boardId || !cardId) return;
	const map = loadDeletedCards();
	const boardMap = map[boardId] ?? {};
	boardMap[cardId] = Number.isFinite(deletedAtMs) ? deletedAtMs : Date.now();
	map[boardId] = boardMap;
	saveDeletedCards(map);
}

export function clearCardTombstone(boardId: string, cardId: string): void {
	if (!getLocalStorage()) return;
	if (!boardId || !cardId) return;
	const map = loadDeletedCards();
	if (!map[boardId]) return;
	delete map[boardId][cardId];
	if (Object.keys(map[boardId]).length === 0) {
		delete map[boardId];
	}
	saveDeletedCards(map);
}

export function clearBoardCardTombstones(boardId: string): void {
	if (!getLocalStorage()) return;
	if (!boardId) return;
	const map = loadDeletedCards();
	if (!map[boardId]) return;
	delete map[boardId];
	saveDeletedCards(map);
}

export function clearAllCardTombstones(): void {
	const storage = getLocalStorage();
	if (!storage) return;
	try {
		storage.removeItem(DELETED_CARDS_KEY);
	} catch {
		// Best-effort
	}
}
