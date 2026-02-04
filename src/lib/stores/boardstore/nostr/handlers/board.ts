import type { Board } from '../../../../classes/BoardModel.js';
import { BoardStorage } from '../../storage.js';
import { unixSecondsToMs, unknownTimestampToMs } from '../time.js';

export type BoardEventHandlerContext = {
	processedEvents: Set<string>;
	boardDeletionTimestamps: Map<string, number>;
};

/**
 * Handler für Board-Events (Kind 30301)
 *
 * ⚡ v2.0: Event-Driven Architecture mit upsertBoardFromNostr()
 * ⚡ v4.1: Optimiert - Silent Skip für bereits verarbeitete Events
 */
export async function handleBoardEvent(
	ctx: BoardEventHandlerContext,
	boardEvent: any,
	currentBoard: Board,
	boardStore: any
): Promise<void> {
	// ⚡ v4.1: Event-Deduplication (SILENT - kein Log bei Skip)
	if (ctx.processedEvents.has(boardEvent.id)) {
		return; // Silent skip - Event bereits verarbeitet
	}

	ctx.processedEvents.add(boardEvent.id);

	// ⚡ v4.1: Nur bei NEUEN Events loggen
	console.log('📥 Board-Event (new):', boardEvent.id.substring(0, 16));

	// ⚡ CRITICAL: Skip eigene Events (Echo-Loop Prevention!)
	const { getSyncManager } = await import('../../../syncManager.svelte.js');
	const syncManager = getSyncManager();
	if (syncManager.isMyEvent(boardEvent.id)) {
		// ⏰ Delayed Cleanup: Handle multiple echoes within 5-second window
		setTimeout(() => {
			syncManager.clearMyEvent(boardEvent.id);
		}, 5000);

		return;
	}

	try {
		// Deserialisiere Board-Event
		const { nostrEventToBoard } = await import('../../../../utils/nostrEvents.js');
		const boardProps = nostrEventToBoard(boardEvent);

		// Validierung: Board muss eine ID haben
		if (!boardProps.id) {
			console.warn('⚠️ Board-Event hat keine ID - skip');
			return;
		}

		// 🔒 Shared-Board Guard: Nur Owner-signed 30301 akzeptieren
		// verhindert Fork-Boards durch Editor/Viewer Publishes
		if (
			boardProps.id === currentBoard.id &&
			currentBoard.author &&
			boardEvent.pubkey &&
			boardEvent.pubkey !== currentBoard.author
		) {
			return;
		}

		// ⚡ v2.0: Timestamp-Based Conflict Resolution
		// Prüfe ob Board später gelöscht wurde
		const deleteTime = ctx.boardDeletionTimestamps.get(boardProps.id);
		if (deleteTime) {
			const boardTime = unixSecondsToMs(boardEvent.created_at);
			if (boardTime < deleteTime) {
				console.log(`⏭️ Board ${boardProps.id} was deleted after this update, skip`);
				return;
			}
		}

		// ⚡ v4.0: Last-Write-Wins Conflict Resolution
		// Vergleiche Event-Timestamp mit localStorage um stale data zu verhindern
		const localBoard = BoardStorage.loadBoard(boardProps.id);

		if (localBoard && localBoard.updatedAt) {
			const localTime = unknownTimestampToMs(localBoard.updatedAt);
			const eventTime = unixSecondsToMs(boardEvent.created_at); // Nostr timestamps sind in Sekunden

			if (eventTime <= localTime) {
				// ⚡ PERMISSION OVERRIDE: Owner-signed event darf Editor-Entzug durchsetzen
				// auch wenn lokale Daten durch (nicht-publishbare) Viewer-Edits neuer sind.
				const { authStore } = await import('../../../authStore.svelte.js');
				const currentUser = authStore.getPubkey();
				const incomingMaintainers = boardProps.maintainers || [];
				const isOwnerSigned = boardEvent.pubkey && boardProps.author && boardEvent.pubkey === boardProps.author;
				const localHadEditor = !!(currentUser && localBoard.maintainers?.includes(currentUser));
				const incomingRemovedEditor = !!(currentUser && !incomingMaintainers.includes(currentUser));

				if (!(isOwnerSigned && localHadEditor && incomingRemovedEditor)) {
					// Silent skip - lokale Daten sind neuer oder gleich
					return;
				}

				console.log('🧹 Permission override: Owner removed editor, applying board event');
			}

			console.log(`✅ LWW: Apply newer event (${Math.round((eventTime - localTime) / 1000)}s newer)`);
		}

		// ⚡ NEW: Set unseen changes flag if board is NOT currently loaded
		if (boardProps.id !== currentBoard.id) {
			const backgroundBoard = BoardStorage.loadBoard(boardProps.id);
			if (backgroundBoard) {
				backgroundBoard.markAsChanged();
				BoardStorage.saveBoard(backgroundBoard);
			}
		}

		// ⚡ v2.0: Direkte Store-API (SECONDARY action)
		// Unterstützt UPDATE (aktuelles Board) UND INSERT (neues Board)
		boardStore.upsertBoardFromNostr(boardProps);
	} catch (error) {
		console.error(`❌ Error processing board event:`, error);
	}
}
