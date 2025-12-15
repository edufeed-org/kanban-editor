import type NDK from '@nostr-dev-kit/ndk';
import type { Board, Comment } from '$lib/classes/BoardModel.js';

import { generateDTag } from '$lib/utils/idGenerator.js';

import { BoardStorage } from '../storage.js';
import { loadCommentsFromStorage, saveCommentsToStorage } from './commentCache.js';
import { unixSecondsToMs, unknownTimestampToMs } from './time.js';

type NDKSubscriptionLike = {
	stop?: () => void;
	on?: (event: string, cb: (event: any) => void) => void;
};

type CommentSubscriptionEntry = {
	sub: NDKSubscriptionLike;
	refCount: number;
	cardRef: string;
	callbacks: Set<() => void>;
};

/**
 * Merges local comments with remote comments from Nostr.
 * - Deduplicates by eventId.
 * - Preserves local unpublished comments.
 * - Also deduplicates pending local comments via text + timestamp proximity.
 */
export function mergeComments(localComments: Comment[], remoteComments: Comment[]): Comment[] {
    // Defensive copies (avoid accidental external mutation)
    const locals = [...(localComments || [])];

	// Step 1: Create Set of eventIds from local comments (for synced comments)
	const localEventIds = new Set<string>(
		locals
			.filter(c => c.eventId)
			.map(c => c.eventId!)
	);

	// Step 1b: Index locals by id for reconcile (local pending -> remote synced)
	const localById = new Map<string, Comment>();
	for (const c of locals) {
		if (c?.id) localById.set(c.id, c);
	}

	// Step 2: Filter remote comments to exclude duplicates
	const newRemoteComments = (remoteComments || []).filter(remote => {
		// 2a. Reconcile by comment.id: local pending comment becomes synced when remote arrives
		const localSameId = remote?.id ? localById.get(remote.id) : undefined;
		if (localSameId) {
			// If local doesn't have eventId yet but remote does -> upgrade local comment
			if (!localSameId.eventId && remote.eventId) {
				localSameId.eventId = remote.eventId;
				localSameId.syncStatus = 'synced' as const;
				// Keep local text unless it's empty
				if (!localSameId.text && remote.text) localSameId.text = remote.text;
				// Keep local author unless it's empty
				if (!localSameId.author && remote.author) localSameId.author = remote.author;
				// Keep earliest createdAt (defensive)
				if (!localSameId.createdAt && remote.createdAt) localSameId.createdAt = remote.createdAt;
			}
			// Remote is not added because it's the same logical comment
			return false;
		}

		// 2a. Skip if eventId already exists in local comments
		if (remote.eventId && localEventIds.has(remote.eventId)) {
			return false;
		}

		// 2b. Also check for text+timestamp duplicates (for pending local comments)
		// This handles the case where local comment was sent but hasn't received eventId yet.
		// If text matches AND timestamp is within 5 seconds → it's the same comment.
		const isDuplicate = locals.some(local => {
			// Skip if local already has eventId (already synced)
			if (local.eventId) return false;

			// Check text match
			if (local.text !== remote.text) return false;

			// Check timestamp proximity (within 5 seconds)
			const localTime = unknownTimestampToMs(local.createdAt);
			const remoteTime = unknownTimestampToMs(remote.createdAt);
			const timeDiff = Math.abs(localTime - remoteTime);

			return timeDiff < 5000;
		});

		return !isDuplicate;
	});

	// Step 3: Merge local + new remote comments
	const merged = [...locals, ...newRemoteComments];

	// Step 4: Sort chronologically by createdAt (oldest first)
	merged.sort((a, b) => {
		const dateA = unknownTimestampToMs(a.createdAt);
		const dateB = unknownTimestampToMs(b.createdAt);
		return dateA - dateB;
	});

	// Step 5: Final dedupe pass (prevents each_key_duplicate / duplicates from earlier bugs)
	const seen = new Set<string>();
	const deduped: Comment[] = [];
	for (const c of merged) {
		if (!c) continue;
		const key = c.eventId ? `event:${c.eventId}` : `id:${c.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(c);
	}

	return deduped;
}

export function stopAllCommentSubscriptions(commentSubscriptions: Map<string, CommentSubscriptionEntry | NDKSubscriptionLike>): void {
	for (const [cardId, entry] of commentSubscriptions.entries()) {
		const sub: NDKSubscriptionLike | undefined =
			(entry as CommentSubscriptionEntry)?.sub ?? (entry as NDKSubscriptionLike);

		if (sub && typeof sub.stop === 'function') {
			try {
				sub.stop();
			} catch {
				// ignore
			}
		}
		commentSubscriptions.delete(cardId);
	}
}

/**
	* Builds the addressable card reference used for Kind 1 comment filtering.
	*
	* IMPORTANT: The exact string must match between publisher and subscriber.
	* Format: "30302:<card-author-pubkey>:<card-d-tag>"
	*/
export function buildCardRef(board: Board, cardId: string, cardAuthor?: string): string {
	const author = cardAuthor || board.author || 'unknown';
	return `30302:${author}:${cardId}`;
}

/**
 * Loads comments for a specific card from Nostr relays and merges with cached/local comments.
 *
 * Retry behavior is preserved: if the card is not yet present in the board,
 * the operation retries up to 5 times with a 500ms delay.
 */
export async function loadComments(
	ndk: NDK | undefined,
	board: Board,
	cardId: string,
	retryCount = 0
): Promise<void> {
	if (!ndk) {
		console.debug('[NostrIntegration] loadComments: NDK not initialized (will retry when ready)');
		return;
	}

	try {
		// 1. Find the card in the board
		const result = board.findCardAndColumn(cardId);
		if (!result) {
			// 🔄 RETRY LOGIC: Card könnte noch vom Relay geladen werden
			if (retryCount < 5) {
				console.debug(
					`[NostrIntegration] loadComments: Card ${cardId} not found yet - retry ${retryCount + 1}/5 in 500ms`
				);

				await new Promise(resolve => setTimeout(resolve, 500));
				return loadComments(ndk, board, cardId, retryCount + 1);
			}

			console.warn(`[NostrIntegration] Card ${cardId} not found in board after ${retryCount} retries`);
			return;
		}

		const { card } = result;

		// 2. Load from cache FIRST (instant access)
		const cachedComments = loadCommentsFromStorage(cardId);
		if (cachedComments.length > 0) {
			console.debug(`💿 Using ${cachedComments.length} cached comment(s) for instant display`);
			const merged = mergeComments(card.comments || [], cachedComments);
			card.comments = merged;
		}

		// 3. Build card reference for Nostr filter
		const cardRef = buildCardRef(board, cardId, card.author);

		console.debug(`[NostrIntegration] 📥 Loading comments for: ${card.heading}`);

		// 4. Fetch Kind 1 (text note) events with #a tag referencing this card
		const events = await ndk.fetchEvents({
			kinds: [1] as number[],
			'#a': [cardRef]
		});

		if (!events || events.size === 0) {
			console.debug('[NostrIntegration] 📭 No remote comments found');
			saveCommentsToStorage(cardId, card.comments || []);
			return;
		}

		console.log(`[NostrIntegration] 📬 Found ${events.size} remote comment(s) for ${card.heading}`);

		// 5. Convert Nostr events to Comment objects
		const remoteComments: Comment[] = Array.from(events).map(event => {
			return {
				id: generateDTag(),
				eventId: event.id!,
				text: event.content,
				author: event.pubkey,
				createdAt: event.created_at
					? new Date(unixSecondsToMs(event.created_at)).toISOString()
					: new Date().toISOString(),
				syncStatus: 'synced' as const
			};
		});

		// 6. Merge with current card comments (already contains cache)
		const localComments = card.comments || [];
		const merged = mergeComments(localComments, remoteComments);

		// 7. Update card with merged comments ONLY if changed
		const hasChanges = JSON.stringify(card.comments) !== JSON.stringify(merged);

		if (hasChanges) {
			card.comments = merged;

			// 8. Save to cache for next time
			saveCommentsToStorage(cardId, merged);

			// 9. Persist to localStorage (WITHOUT triggering Nostr publish)
			BoardStorage.saveBoard(board);

			console.log(`✅ ${remoteComments.length} new comment(s) merged`);
		} else {
			// ⏭️ No changes - still update cache but DON'T save board
			saveCommentsToStorage(cardId, merged);
		}
	} catch (error) {
		console.error('[NostrIntegration] ❌ Error loading comments:', error);
	}
}

/**
 * Subscribes to live Kind 1 comment events for a card.
 *
 * Behavior parity with the previous inline implementation in NostrIntegration:
 * - Retries up to 5x if the card isn't found yet
 * - Deduplicates via processedEvents
 * - Stops existing per-card subscription to prevent duplicates
 * - Persists merged comments to BoardStorage and comment cache
 */
export function subscribeToComments(
	ndk: NDK | undefined,
	processedEvents: Set<string>,
	commentSubscriptions: Map<string, CommentSubscriptionEntry | NDKSubscriptionLike>,
	board: Board,
	cardId: string,
	onUpdate?: () => void,
	retryCount = 0
): () => void {
	// 1. Guard: NDK verfügbar?
	if (!ndk) {
		console.debug('[NostrIntegration] subscribeToComments: NDK not initialized (normal during app startup)');
		return () => {};
	}

	// 2. Guard: Ignore DnD placeholder cards
	if (cardId.includes('dnd-shadow-placeholder')) {
		console.debug(`[NostrIntegration] Skipping DnD placeholder: ${cardId}`);
		return () => {};
	}

	// 3. Finde die Card im Board
	const result = board.findCardAndColumn(cardId);
	if (!result) {
		if (retryCount < 5) {
			if (retryCount === 0) {
				console.debug(`[NostrIntegration] 🔄 subscribeToComments: Card ${cardId} not ready yet, retrying...`);
			}

			let retryCleanup: (() => void) | null = null;
			const retryTimer = setTimeout(() => {
				retryCleanup = subscribeToComments(
					ndk,
					processedEvents,
					commentSubscriptions,
					board,
					cardId,
					onUpdate,
					retryCount + 1
				);
			}, 500);

			return () => {
				clearTimeout(retryTimer);
				if (retryCleanup) {
					retryCleanup();
				}
			};
		}

		console.warn(
			`[NostrIntegration] ⚠️ subscribeToComments: Card ${cardId} not found after ${retryCount} retries`
		);
		return () => {};
	}

	const { card } = result;

	// 4. Build card reference für #a tag filter
	const cardRef = buildCardRef(board, cardId, card.author);

	console.debug(`[NostrIntegration] 📡 Subscribing to comments for: ${cardId.substring(5, 12)}...`);

	// 5. Reuse existing subscription if possible (supports multiple consumers)
	const existingEntry = commentSubscriptions.get(cardId) as CommentSubscriptionEntry | undefined;
	if (existingEntry?.sub && existingEntry.cardRef === cardRef) {
		existingEntry.refCount++;
		if (onUpdate) {
			existingEntry.callbacks.add(onUpdate);
		}

		return () => {
			if (onUpdate) {
				existingEntry.callbacks.delete(onUpdate);
			}

			existingEntry.refCount = Math.max(0, existingEntry.refCount - 1);
			if (existingEntry.refCount === 0) {
				try {
					existingEntry.sub.stop?.();
				} catch (err) {
					console.error('[NostrIntegration] Error stopping comment subscription:', err);
				}
				commentSubscriptions.delete(cardId);
				console.log(`[NostrIntegration] 🛑 Comment subscription stopped for card ${cardId}`);
			}
		};
	}

	// 6. If cardRef changed, stop stale subscription before re-creating
	if (existingEntry?.sub && existingEntry.cardRef !== cardRef) {
		try {
			existingEntry.sub.stop?.();
		} catch {
			// ignore
		}
		commentSubscriptions.delete(cardId);
	}

	// 7. Create NDK subscription für Kind 1 events mit #a tag filter
	const sub = ndk.subscribe(
		{
			kinds: [1],
			'#a': [cardRef]
		},
		{ closeOnEose: false }
	) as unknown as NDKSubscriptionLike;

	sub.on?.('event', async (event: any) => {
		try {
			if (processedEvents.has(event.id)) {
				return;
			}

			processedEvents.add(event.id);

			// Always re-resolve the card from the CURRENT board state.
			// (The board/card references can change after Nostr upserts or reloads.)
			const currentResult = board.findCardAndColumn(cardId);
			if (!currentResult) return;
			const currentCard = currentResult.card;

			// Hard-dedupe: don't insert the same remote event twice
			const existing = (currentCard.comments || []).some(c => c?.eventId === event.id);
			if (existing) return;

			const newComment: Comment = {
				id: generateDTag('comment'),
				eventId: event.id!,
				text: event.content,
				author: event.pubkey,
				createdAt: event.created_at
					? new Date(unixSecondsToMs(event.created_at)).toISOString()
					: new Date().toISOString(),
				syncStatus: 'synced' as const
			};

			const currentComments = currentCard.comments || [];
			const merged = mergeComments(currentComments, [newComment]);
			currentCard.comments = merged;

			BoardStorage.saveBoard(board);
			saveCommentsToStorage(cardId, merged);

			const currentEntry = commentSubscriptions.get(cardId) as CommentSubscriptionEntry | undefined;
			if (currentEntry) {
				for (const cb of currentEntry.callbacks) {
					try {
						cb();
					} catch (err) {
						console.error('[NostrIntegration] Error in onUpdate callback:', err);
					}
				}
			}
		} catch (error) {
			console.error('[NostrIntegration] ❌ Error processing comment event:', error);
		}
	});

	// 8. Store subscription entry in Map for later reuse/cleanup
	const callbacks = new Set<() => void>();
	if (onUpdate) {
		callbacks.add(onUpdate);
	}
	const entry: CommentSubscriptionEntry = {
		sub,
		refCount: 1,
		cardRef,
		callbacks
	};
	commentSubscriptions.set(cardId, entry);

	if (retryCount > 0) {
		console.log(
			`[NostrIntegration] ✅ Comment subscription active for ${cardId.substring(5, 12)}... (after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'})`
		);
	}

	// 9. Return cleanup function
	return () => {
		const current = commentSubscriptions.get(cardId) as CommentSubscriptionEntry | undefined;
		if (!current) return;

		if (onUpdate) {
			current.callbacks.delete(onUpdate);
		}

		current.refCount = Math.max(0, current.refCount - 1);
		if (current.refCount === 0) {
			if (current.sub && typeof current.sub.stop === 'function') {
				try {
					current.sub.stop();
					commentSubscriptions.delete(cardId);
					console.log(`[NostrIntegration] 🛑 Comment subscription stopped for card ${cardId}`);
				} catch (err) {
					console.error('[NostrIntegration] Error stopping comment subscription:', err);
				}
			}
		}
	};
}
