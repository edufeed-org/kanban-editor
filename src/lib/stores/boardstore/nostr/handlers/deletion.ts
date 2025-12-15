import { BoardStorage } from '../../storage.js';
import { saveProcessedDeletions } from '../deletionEventsCache.js';
import { unixSecondsToMs } from '../time.js';

export type DeletionEventHandlerContext = {
	processedEvents: Set<string>;
	processedDeletionEvents: Set<string>;
	cardDeletionTimestamps: Map<string, number>;
	boardDeletionTimestamps: Map<string, number>;
};

function syncSetInPlace(target: Set<string>, source: Set<string>): void {
	if (target === source) return;
	target.clear();
	for (const value of source) {
		target.add(value);
	}
}

/**
 * Handler für Deletion-Events (Kind 5)
 *
 * ⚡ v2.0: Event-Driven Architecture mit Timestamp-Tracking
 *
 * Wird aufgerufen wenn ein Board ODER Card gelöscht wurde (via subscription).
 * Trackt Deletion-Timestamps für Out-of-Order Event-Handling.
 *
 * NIP-09: Replaceable Events (Kind 30301/30302) werden via 'a' tags referenziert
 */
export async function handleDeletionEvent(
	ctx: DeletionEventHandlerContext,
	deletionEvent: any,
	boardStore: any
): Promise<void> {
	// ⚡ OPTIMIZATION: Check persistent deletion event cache FIRST
	if (ctx.processedDeletionEvents.has(deletionEvent.id)) {
		// Silently skip - already processed in previous session
		return;
	}

	// ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
	if (ctx.processedEvents.has(deletionEvent.id)) {
		return; // Silent skip - Event bereits verarbeitet
	}

	ctx.processedEvents.add(deletionEvent.id);

	// ⚡ Track this deletion event persistently
	ctx.processedDeletionEvents.add(deletionEvent.id);
	const persisted = saveProcessedDeletions(ctx.processedDeletionEvents);
	syncSetInPlace(ctx.processedDeletionEvents, persisted);

	try {
		// NIP-09: Parse 'a' tags für replaceable events
		// Format: ['a', '30301:pubkey:board-id'] oder ['a', '30302:pubkey:card-id']
		const aTags = deletionEvent.tags.filter((t: any) => t[0] === 'a');
		const deleteTime = unixSecondsToMs(deletionEvent.created_at); // Millisekunden
		const deletionPubkey: string | undefined = deletionEvent?.pubkey;

		for (const aTag of aTags) {
			const eventRef = aTag[1];

			// NIP-09 Safety: Der Pubkey im 'a'-Tag ist Teil der Ziel-Adressierung.
			// Ein Deletion-Event ist nur gültig, wenn deletionEvent.pubkey === targetPubkey.
			// (sonst könnten fremde Deletions lokale Boards/Card-Instanzen tombstonen)
			const partsForAuth = typeof eventRef === 'string' ? eventRef.split(':') : [];
			const targetPubkey = partsForAuth.length >= 3 ? partsForAuth[1] : undefined;
			if (targetPubkey && deletionPubkey !== targetPubkey) {
				continue;
			}

			// ===== BOARD DELETION =====
			if (eventRef && eventRef.startsWith('30301:')) {
				const parts = eventRef.split(':');
				if (parts.length >= 3) {
					const boardId = parts.slice(2).join(':');
					const boardAuthor = parts[1];

					// ⚡ OPTIMIZATION: Skip if already tracked (prevents duplicate processing)
					if (ctx.boardDeletionTimestamps.has(boardId)) {
						continue;
					}

					// Track deletion timestamp (für Ordering)
					ctx.boardDeletionTimestamps.set(boardId, deleteTime);

					// Check if board exists locally
					const localBoard = BoardStorage.loadBoard(boardId);
					const existsLocally = localBoard !== null;

					// Extra safety: only apply board deletion when local board author matches target.
					// Prevents tombstoning wrong boards when local cache used a different canonical owner.
					if (existsLocally && localBoard?.author && localBoard.author !== boardAuthor) {
						continue;
					}

					if (existsLocally) {
						console.log(`🗑️ Deleting board ${boardId.substring(0, 16)}... (deletion event)`);

						// Delete from localStorage (publish: false to avoid re-publishing deletion event)
						BoardStorage.deleteBoard(boardId);

						// Update board list in store
						boardStore.refreshBoardList();

						// If this was the active board, switch to another board
						if (boardStore.data.id === boardId) {
							boardStore.switchToAnotherBoardAfterDeletion(boardId);
						}
					}
				}
			}

			// ===== CARD DELETION =====
			else if (eventRef && eventRef.startsWith('30302:')) {
				const parts = eventRef.split(':');
				if (parts.length >= 3) {
					const cardId = parts.slice(2).join(':');
					const cardAuthor = parts[1];

					// ⚡ OPTIMIZATION: Skip if already tracked (prevents duplicate processing)
					if (ctx.cardDeletionTimestamps.has(cardId)) {
						continue;
					}

					// 🔍 FILTER: Only process deletions for cards from current board
					const currentBoard = boardStore.data;
					if (!currentBoard) {
						continue;
					}

					// Check if card belongs to current board
					const result = currentBoard.findCardAndColumn(cardId);
					if (!result) {
						continue;
					}

					// Track deletion timestamp (für Ordering)
					ctx.cardDeletionTimestamps.set(cardId, deleteTime);

					// Optional extra safety: if card has an author, require it to match.
					if (result.card?.author && result.card.author !== cardAuthor) {
						continue;
					}

					console.log(`🗑️ Deleting card ${cardId.substring(0, 16)}... from board (deletion event)`);

					// ⚡ v2.0: Direkte Store-API (SECONDARY action)
					boardStore.deleteCardFromNostr(cardId);
				}
			}
		}
	} catch (error) {
		console.error(`❌ Error processing deletion event:`, error);
	}
}
