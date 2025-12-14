import type { Board } from '../../../../classes/BoardModel.js';
import { BoardStorage } from '../../storage.js';
import { unixSecondsToMs, unknownTimestampToMs } from '../time.js';

export type CardEventHandlerContext = {
	processedEvents: Set<string>;
	cardDeletionTimestamps: Map<string, number>;
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
	const { getSyncManager } = await import('../../../syncManager.svelte.js');
	const syncManager = getSyncManager();
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
			// ⚠️ Card-Event hat keine updatedAt - nutze Event created_at
			const cardTime = unixSecondsToMs(cardEvent.created_at); // Millisekunden

			if (cardTime < deleteTime) {
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
			const eventTime = unixSecondsToMs(cardEvent.created_at);

			if (eventTime <= localTime) {
				// Silent skip - lokale Daten sind neuer oder gleich
				return;
			}

			// Nur bei tatsächlichem Update loggen
			console.log(`✅ Card LWW: Apply newer (${((eventTime - localTime) / 1000).toFixed(1)}s newer)`);
		}

		// columnId ist KRITISCH - ohne geht nichts!
		if (!cardProps.columnId) {
			console.error(`❌ Card ${cardProps.id} hat keine columnId!`);
			return;
		}

		// ⚡ v3.0: CRITICAL - Support Background Board Sync
		// Wenn Card für aktuelles Board → normale Verarbeitung
		// Wenn Card für Background Board → speichere direkt in localStorage
		if (targetBoardId === currentBoard.id) {
			console.log(`✅ Card ${cardProps.id} ist für aktuelles Board - normale Verarbeitung`);
			boardStore.upsertCardFromNostr(cardProps);
		} else {
			boardStore.upsertCardToBackgroundBoard(targetBoardId, cardProps);

			// ⚡ NEW: Set unseen changes flag for background board
			const backgroundBoard = BoardStorage.loadBoard(targetBoardId);
			if (backgroundBoard) {
				backgroundBoard.markAsChanged();
				BoardStorage.saveBoard(backgroundBoard);
			}
		}
	} catch (error) {
		console.error(`❌ Error processing card event:`, error);
	}
}
