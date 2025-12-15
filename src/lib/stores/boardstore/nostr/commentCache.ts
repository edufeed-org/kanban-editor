import type { Comment } from '../../../classes/BoardModel.js';

const COMMENTS_STORAGE_PREFIX = 'nostr-comments-';

function getKey(cardId: string): string {
	return `${COMMENTS_STORAGE_PREFIX}${cardId}`;
}

/**
 * 🚀 Phase 3: Save comments to localStorage cache
 * Provides instant access to comments without network delay
 */
export function saveCommentsToStorage(cardId: string, comments: Comment[]): void {
	try {
		const data = JSON.stringify(comments);
		localStorage.setItem(getKey(cardId), data);
		console.debug(`💾 Saved ${comments.length} comment(s) to cache`);
	} catch (error) {
		console.warn('[NostrIntegration] ⚠️ Failed to save comments to cache:', error);
	}
}

/**
 * 🚀 Phase 3: Load comments from localStorage cache
 * Returns cached comments instantly, no network delay
 */
export function loadCommentsFromStorage(cardId: string): Comment[] {
	try {
		const data = localStorage.getItem(getKey(cardId));
		if (!data) return [];

		const comments = JSON.parse(data) as Comment[];
		console.debug(`💿 Loaded ${comments.length} comment(s) from cache`);
		return comments;
	} catch (error) {
		console.warn('[NostrIntegration] ⚠️ Failed to load comments from cache:', error);
		return [];
	}
}

/**
 * 🚀 Phase 3: Clear comments cache for a card
 */
export function clearCommentsCache(cardId: string): void {
	try {
		localStorage.removeItem(getKey(cardId));
		console.log(`🗑️ Cleared comment cache for card ${cardId}`);
	} catch (error) {
		console.warn('[NostrIntegration] ⚠️ Failed to clear cache:', error);
	}
}
