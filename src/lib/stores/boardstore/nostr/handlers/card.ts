import type { Board } from '../../../../classes/BoardModel.js';
import { BoardStorage } from '../../storage.js';
import { unixSecondsToMs, unknownTimestampToMs } from '../time.js';

export type CardEventHandlerContext = {
	processedEvents: Set<string>;
	cardDeletionTimestamps: Map<string, number>;
	/** Optional injection for tests; falls back to getSyncManager() at runtime */
	syncManager?: {
		isMyEvent: (eventId: string) => boolean;
		clearMyEvent: (eventId: string) => void;
	};
};

/**
 * Handler für Card-Events (Kind 30302)
 *
 * ⚡ v2.0: Event-Driven Architecture mit direkter Store-API
 * ⚡ v4.1: Optimiert - Silent Skip für bereits verarbeitete Events
 */
export async function handleCardEvent(
	ctx: CardEventHandlerContext,
	cardEvent: any,
	currentBoard: Board,
	boardStore: any
): Promise<void> {
	// ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
	if (ctx.processedEvents.has(cardEvent.id)) {
		return; // Silent skip - Event bereits verarbeitet
	}

	ctx.processedEvents.add(cardEvent.id);

	// ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
	const syncManager =
		ctx.syncManager
		?? (await import('../../../syncManager.svelte.js')).getSyncManager();
	if (syncManager.isMyEvent(cardEvent.id)) {
		// ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
		setTimeout(() => {
			syncManager.clearMyEvent(cardEvent.id);
		}, 5000);

		return;
	}

	try {
		// Deserialisiere Card-Event
		const { nostrEventToCard } = await import('../../../../utils/nostrEvents.js');
		const cardProps = nostrEventToCard(cardEvent);

		// Prefer ms timestamp from custom tag (ts) for deterministic LWW.
		// Fallback to created_at (seconds) when not present.
		const eventTimeMs = (() => {
			const ms = (cardProps as any).updatedAtMs;
			if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) return ms;
			return unixSecondsToMs(cardEvent.created_at);
		})();

		// ⚡ v3.0: BACKGROUND BOARD SYNC FIX
		// Parse boardRef to get target board ID
		// Format: "30301:pubkey:board-id"
		let targetBoardId: string | null = null;

		if (cardProps.boardRef) {
			const parts = cardProps.boardRef.split(':');
			if (parts.length === 3 && parts[0] === '30301') {
				targetBoardId = parts[2];
			} else {
				console.warn(`⚠️ Invalid boardRef format: ${cardProps.boardRef}`);
				return;
			}
		} else {
			console.warn(`⚠️ Card ${cardProps.id} has no boardRef`);
			return;
		}

		// ⚡ v2.0: Timestamp-Based Conflict Resolution
		// Prüfe ob Card später gelöscht wurde
		const deleteTime = ctx.cardDeletionTimestamps.get(cardProps.id!);
		if (deleteTime) {
			if (eventTimeMs < deleteTime) {
				console.log(
					`🗑️ Card ${cardProps.id} was deleted after this update (${new Date(deleteTime).toISOString()}), skip`
				);
				return;
			}
		}

		// ⚡ v4.3: Last-Write-Wins for Cards (same pattern as Board)
		// Compare event timestamp with local card updatedAt
		const result = currentBoard.findCardAndColumn(cardProps.id!);
		if (result && result.card.updatedAt) {
			const localTime = unknownTimestampToMs(result.card.updatedAt);

			if (eventTimeMs < localTime) {
				// Silent skip - lokale Daten sind neuer
				return;
			}

			if (eventTimeMs === localTime) {
				// Deterministic tie-breaker: prefer lexicographically larger event id.
				// This avoids random drops when created_at has second-level resolution.
				const localEventId = result.card.eventId;
				if (typeof localEventId === 'string' && localEventId.length > 0) {
					const incomingId = typeof cardEvent.id === 'string' ? cardEvent.id : '';
					if (incomingId && incomingId <= localEventId) {
						return;
					}
				}
			}

			// Nur bei tatsächlichem Update loggen
			console.log(
				`✅ Card LWW: Apply newer/tie-break (${((eventTimeMs - localTime) / 1000).toFixed(3)}s delta)`
			);
		}

		// columnId ist KRITISCH - ohne geht nichts!
		if (!cardProps.columnId) {
			console.error(`❌ Card ${cardProps.id} hat keine columnId!`);
			return;
		}

		// 🔒 Authorization Guard: Nur Owner + Maintainers dürfen Card-Events anwenden
		const eventPubkey = typeof cardEvent.pubkey === 'string' ? cardEvent.pubkey : '';

		// ⚡ v3.0: CRITICAL - Support Background Board Sync
		// Wenn Card für aktuelles Board → normale Verarbeitung
		// Wenn Card für Background Board → speichere direkt in localStorage
		if (targetBoardId === currentBoard.id) {
			// 🔒 Guard für aktuelles Board
			if (currentBoard.author && eventPubkey) {
				const authorized = typeof currentBoard.isMaintainer === 'function'
					? currentBoard.isMaintainer(eventPubkey)
					: eventPubkey === currentBoard.author;
				if (!authorized) {
					console.debug('[CardEvent] rejected (unauthorized pubkey)', {
						pubkey: eventPubkey.slice(0, 12) + '...',
						boardId: currentBoard.id,
					});
					return;
				}
			}

			console.log(`✅ Card ${cardProps.id} ist für aktuelles Board - normale Verarbeitung`);
			boardStore.upsertCardFromNostr(cardProps);
		} else {
			// 🔒 Guard für Background-Board
			const backgroundBoard = BoardStorage.loadBoard(targetBoardId);
			if (backgroundBoard) {
				if (backgroundBoard.author && eventPubkey) {
					const authorized = typeof backgroundBoard.isMaintainer === 'function'
						? backgroundBoard.isMaintainer(eventPubkey)
						: eventPubkey === backgroundBoard.author;
					if (!authorized) {
						console.debug('[CardEvent] rejected for background board (unauthorized pubkey)', {
							pubkey: eventPubkey.slice(0, 12) + '...',
							boardId: targetBoardId,
						});
						return;
					}
				}

				boardStore.upsertCardToBackgroundBoard(targetBoardId, cardProps);
				backgroundBoard.markAsChanged();
				BoardStorage.saveBoard(backgroundBoard);
			} else {
				// Board existiert lokal nicht — kann nicht validieren, trotzdem speichern
				boardStore.upsertCardToBackgroundBoard(targetBoardId, cardProps);
			}
		}
	} catch (error) {
		console.error(`❌ Error processing card event:`, error);
	}
}
