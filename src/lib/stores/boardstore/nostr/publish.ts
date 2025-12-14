import type NDK from '@nostr-dev-kit/ndk';
import type { Board, Card, Comment } from '$lib/classes/BoardModel.js';
import { toast } from 'svelte-sonner';

import { authStore } from '$lib/stores/authStore.svelte.js';
import { getSyncManager } from '$lib/stores/syncManager.svelte.js';
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

import { BoardStorage } from '../storage.js';

import {
	boardToNostrEvent,
	cardToNostrEvent,
	createCommentEvent,
	createDeletionEvent
} from '$lib/utils/nostrEvents.js';
import { getTargetRelays } from '$lib/utils/relaySelection.js';
import { buildCardRef } from './comments.js';

export async function publishBoard(ndk: NDK | undefined, board: Board): Promise<string | null> {
	if (!ndk) return null;

	try {
		const event = boardToNostrEvent(board, ndk);
		const publishState = board.publishState || 'draft';
		const normalizedState = (publishState === 'archived' ? 'private' : publishState) as
			| 'published'
			| 'draft'
			| 'private';

		const targetRelays = getTargetRelays({
			publishState: normalizedState,
			draftPublishingMode: settingsStore.settings.draftPublishingMode,
			relaysPublic: settingsStore.settings.relaysPublic,
			relaysPrivate: settingsStore.settings.relaysPrivate
		});

		// ⚠️ SICHERHEITS-CHECK: Warne wenn Draft nicht publiziert werden kann
		if (normalizedState === 'draft' && targetRelays.length === 0) {
			const mode = settingsStore.settings.draftPublishingMode;

			if (mode === 'private-relays') {
				toast.warning('🔒 Keine privaten Relays konfiguriert', {
					description:
						'Board-Änderungen werden nur lokal gespeichert. Gehe zu Einstellungen → Nostr → Private Relays um Synchronisation zu aktivieren.',
					duration: 6000
				});
				console.warn(
					'[NostrIntegration] 🔒 Draft board cannot be published - no private relays configured'
				);
			}
			// Falls local-only: Kein Toast (das ist erwartetes Verhalten)
		}

		const syncManager = getSyncManager();
		const publishedEvent = await syncManager.publishOrQueue(
			event,
			'board',
			'normal',
			normalizedState,
			targetRelays
		);

		// ⚡ NEU: Event-ID erfassen nach erfolgreichem Publish!
		if (publishedEvent?.id) {
			board.eventId = publishedEvent.id;
			console.log(`[NostrIntegration] 🔑 Board Event-ID: ${board.eventId}`);

			// ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
			const { BoardStorage } = await import('../storage.js');
			await BoardStorage.saveBoard(board);

			// ⚡ RÜCKGABE: Event-ID für LiaScript-Link-Generierung
			return publishedEvent.id;
		}

		return null;
	} catch (error) {
		console.error(`❌ Error publishing board:`, error);
		return null;
	}
}

/**
 * Publiziert Card zu Nostr
 *
 * ⚠️ WICHTIG: Sendet Column-ID UND Name (laut Kanban-NIP)
 * - s-Tag: Column-ID (PRIMARY)
 * - col_label-Tag: Column-Name (SECONDARY)
 * - rank: Position in der Spalte
 */
export async function publishCard(ndk: NDK | undefined, board: Board, cardId: string): Promise<void> {
	if (!ndk) return;

	try {
		const result = board.findCardAndColumn(cardId);
		if (!result) {
			console.warn(`⚠️ Card ${cardId} not found for publishing`);
			return;
		}

		const { card, column } = result;

		// ⚠️ FIX: rank ist die Position der Karte IN der Spalte (nicht columnIndex!)
		const rank = column.cards.indexOf(card);

		// ⚠️ FIX: boardRef muss Kind 30301 sein (nicht 30302!)
		const boardRef = `30301:${board.author || 'unknown'}:${board.id}`;

		// ⚠️ GEÄNDERT: Jetzt columnId UND columnName übergeben
		const event = cardToNostrEvent(
			card,
			column.id, // ⚠️ Column-ID (nicht Name!)
			column.name, // ⚠️ Column-Name (für Display)
			rank, // ⚠️ Position in Spalte
			boardRef,
			ndk
		);

		const publishState = card.publishState || 'draft';
		const normalizedState = (publishState === 'archived' ? 'private' : publishState) as
			| 'published'
			| 'draft'
			| 'private';

		const targetRelays = getTargetRelays({
			publishState: normalizedState,
			draftPublishingMode: settingsStore.settings.draftPublishingMode,
			relaysPublic: settingsStore.settings.relaysPublic,
			relaysPrivate: settingsStore.settings.relaysPrivate
		});

		const syncManager = getSyncManager();
		const publishedEvent = await syncManager.publishOrQueue(
			event,
			'card',
			'normal',
			normalizedState,
			targetRelays
		);

		// ⚡ NEU: Event-ID erfassen nach erfolgreichem Publish!
		if (publishedEvent?.id) {
			card.eventId = publishedEvent.id;

			// ⚡ KRITISCH: Speichere eventId SOFORT zu localStorage!
			const { BoardStorage } = await import('../storage.js');
			await BoardStorage.saveBoard(board);
		}
	} catch (error) {
		console.error(`❌ Error publishing card ${cardId}:`, error);
	}
}

/**
 * Publiziert Comment zu Nostr
 */
export async function publishComment(
	ndk: NDK | undefined,
	board: Board,
	cardId: string,
	commentId: string
): Promise<void> {
	if (!ndk) return;

	try {
		const result = board.findCardAndColumn(cardId);
		if (!result) {
			console.warn(`⚠️ Card ${cardId} not found for comment publishing`);
			return;
		}

		const { card } = result;
		const comment = card.comments?.find(c => c.id === commentId);
		if (!comment) {
			console.warn(`⚠️ Comment ${commentId} not found`);
			return;
		}

		// Set status to 'syncing' before publishing
		comment.syncStatus = 'syncing';

		const cardRef = buildCardRef(board, cardId, card.author);
		// IMPORTANT: `e`-tag should reference the actual Nostr event id of the card (not the d-tag)
		const event = createCommentEvent(comment.text, cardRef, card.eventId || '', ndk);
		const publishState = card.publishState || 'draft';
		const normalizedState = (publishState === 'archived' ? 'private' : publishState) as
			| 'published'
			| 'draft'
			| 'private';

		const targetRelays = getTargetRelays({
			publishState: normalizedState,
			draftPublishingMode: settingsStore.settings.draftPublishingMode,
			relaysPublic: settingsStore.settings.relaysPublic,
			relaysPrivate: settingsStore.settings.relaysPrivate
		});

		const syncManager = getSyncManager();
		await syncManager.publishOrQueue(event, 'comment', 'normal', normalizedState, targetRelays);

		// ✅ CAPTURE EVENT-ID after publishing
		// Note: syncManager.publishOrQueue() signs and publishes the event
		// The event.id is available after signing
		if (event.id) {
			comment.eventId = event.id;
			comment.syncStatus = 'synced';

			// Persist to localStorage
			BoardStorage.saveBoard(board);

			console.log(`✅ Comment ${commentId} published with eventId: ${event.id}`);
		} else {
			// If eventId not available, mark as failed
			comment.syncStatus = 'failed';
			console.warn(`⚠️ Comment ${commentId} published but eventId not available`);
		}
	} catch (error) {
		console.error(`❌ Error publishing comment:`, error);

		// Mark as failed on error
		const result = board.findCardAndColumn(cardId);
		if (result) {
			const comment = result.card.comments?.find(c => c.id === commentId);
			if (comment) {
				comment.syncStatus = 'failed';
				BoardStorage.saveBoard(board);
			}
		}
	}
}

/**
 * ⚡ NEU: Löscht einen Comment auf Nostr (Kind 5 Deletion Event)
 * Wird bei kaskadierender Card-Löschung aufgerufen
 */
export async function deleteComment(ndk: NDK | undefined, comment: Comment, card: Card): Promise<void> {
	if (!ndk) {
		console.warn('[NostrIntegration] deleteComment: NDK nicht initialisiert');
		return;
	}

	// Nur published comments (mit eventId) können auf Nostr gelöscht werden
	if (!comment.eventId) {
		console.log(`[NostrIntegration] ⏭️ Comment ${comment.id} ist lokal, keine Nostr-Löschung nötig`);
		return;
	}

	try {
		console.log(
			`[NostrIntegration] 🗑️ Deleting comment on Nostr: ${comment.text.substring(0, 50)}... (${comment.eventId})`
		);

		// Erstelle Deletion Event (Kind 5)
		// Comments sind reguläre Events (Kind 1), nicht replaceable
		const deletionEvent = createDeletionEvent(
			comment.eventId, // Event-ID des Comments
			false, // isReplaceableEvent = false für Kind 1
			`Comment deleted`,
			ndk,
			comment.eventId // Actual event ID
		);

		// Bestimme Target-Relays basierend auf Card's publishState
		const publishState = card.publishState || 'draft';
		const normalizedState = (publishState === 'archived' ? 'private' : publishState) as
			| 'published'
			| 'draft'
			| 'private';

		const targetRelays = getTargetRelays({
			publishState: normalizedState,
			draftPublishingMode: settingsStore.settings.draftPublishingMode,
			relaysPublic: settingsStore.settings.relaysPublic,
			relaysPrivate: settingsStore.settings.relaysPrivate
		});

		const syncManager = getSyncManager();
		await syncManager.publishOrQueue(deletionEvent, 'comment', 'high', normalizedState, targetRelays);

		console.log(`✅ Comment deletion event queued for ${targetRelays.length} relay(s)`);
	} catch (error) {
		console.error(`❌ Error deleting comment on Nostr:`, error);
	}
}

/**
 * Löscht ein Board auf Nostr durch Senden eines NIP-09 Deletion Events
 * @param board - Board das gelöscht werden soll
 */
export async function deleteBoard(ndk: NDK | undefined, board: Board): Promise<void> {
	if (!ndk) {
		console.warn('[NostrIntegration] deleteBoard: NDK nicht initialisiert');
		return;
	}

	try {
		// 0. ⚡ KASKADIERENDE LÖSCHUNG: Lösche zuerst alle Cards (inkl. Comments)
		console.log(
			`[NostrIntegration] 🗑️ Cascading delete: Deleting ${board.getAllCards().length} card(s) in board "${board.name}"`
		);

		const allCards = board.getAllCards();
		for (const card of allCards) {
			await deleteCard(ndk, card);
			console.log(`  ✓ Deleted card: ${card.heading}`);
		}

		console.log(`✅ All ${allCards.length} card(s) deleted`);

		// 1. Bestimme die Event-ID des Board-Events
		// Format für addressable events: "30301:<author-pubkey>:<d-tag>"
		const boardEventId = `30301:${board.author || 'unknown'}:${board.id}`;

		console.log(`[NostrIntegration] 🗑️ Deleting board on Nostr: ${board.name} (${boardEventId})`);

		// 2. Erstelle Deletion Event (Kind 5)
		// ⚡ NEU: Include actual event ID if available!
		const deletionEvent = createDeletionEvent(
			boardEventId,
			true, // isReplaceableEvent = true für Kind 30301
			`Board "${board.name}" deleted`,
			ndk,
			board.eventId // ← NEU: Actual event ID for relay deletion!
		);

		// 🔍 DEBUG: Log deletion event details (BEFORE signing)
		console.log('[NostrIntegration] 📋 Board Deletion Event Details:');
		console.log('  Kind:', deletionEvent.kind);
		console.log('  Board Author:', board.author);
		console.log('  Board Event ID:', board.eventId || 'NOT SET');
		console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
		console.log('  Content:', deletionEvent.content);
		console.log('  Target Board ID:', boardEventId);
		console.log('  ⚠️ Note: Event will be signed by SyncManager before publishing');

		// 3. Publiziere auf ALLEN Relays (sowohl public als private)
		// Grund: Board könnte auf beiden Relay-Sets existieren
		const allRelays = [...settingsStore.settings.relaysPublic, ...settingsStore.settings.relaysPrivate].filter(
			(v, i, a) => a.indexOf(v) === i
		); // Deduplizieren

		const syncManager = getSyncManager();
		await syncManager.publishOrQueue(
			deletionEvent,
			'board',
			'high', // Hohe Priorität für Löschungen
			'published', // Lösch-Events immer auf published relays
			allRelays
		);

		// ⚡ NIP-09: Relay handled board deletion automatically
		// Keine lokale localStorage-Tracking mehr nötig!

		console.log(`✅ Board deletion event queued for ${allRelays.length} relay(s)`);
	} catch (error) {
		console.error(`❌ Error deleting board on Nostr:`, error);
	}
}

/**
 * Löscht eine Card auf Nostr durch Senden eines NIP-09 Deletion Events
 * @param card - Card die gelöscht werden soll
 */
export async function deleteCard(ndk: NDK | undefined, card: Card): Promise<void> {
	if (!ndk) {
		console.warn('[NostrIntegration] deleteCard: NDK nicht initialisiert');
		return;
	}

	try {
		// 0. ⚡ KASKADIERENDE LÖSCHUNG: Lösche zuerst alle Comments der Card
		if (card.comments && card.comments.length > 0) {
			console.log(
				`[NostrIntegration] 🗑️ Cascading delete: Deleting ${card.comments.length} comment(s) for card "${card.heading}"`
			);

			for (const comment of card.comments) {
				await deleteComment(ndk, comment, card);
				console.log(`  ✓ Deleted comment: ${comment.text.substring(0, 50)}...`);
			}

			console.log(`✅ All ${card.comments.length} comment(s) deleted`);
		}

		// 1. Bestimme die Event-ID des Card-Events
		// Format für addressable events: "30302:<author-pubkey>:<d-tag>"
		const cardEventIdentifier = `30302:${card.author || 'unknown'}:${card.id}`;

		console.log(`[NostrIntegration] 🗑️ Deleting card on Nostr: ${card.heading} (${cardEventIdentifier})`);

		// 2. WICHTIG: Versuche zuerst, das Event vom Relay zu fetchen, um die echte Event-ID zu bekommen
		let actualEventId: string | undefined = undefined;
		try {
			const existingEvent = await ndk.fetchEvent({
				kinds: [30302] as number[],
				authors: [card.author || ''],
				'#d': [card.id]
			});

			if (existingEvent?.id) {
				actualEventId = existingEvent.id;
				console.log(`[NostrIntegration] 🎯 Found actual event ID: ${actualEventId}`);
			} else {
				console.warn(`[NostrIntegration] ⚠️ Card event not found on relay - deletion may not work`);
			}
		} catch (fetchError) {
			console.warn('[NostrIntegration] ⚠️ Could not fetch card event:', fetchError);
		}

		// 3. Erstelle Deletion Event (Kind 5)
		// NIP-09: Replaceable events (Kind 30302) brauchen 'a' tags UND möglicherweise 'e' tags
		const deletionEvent = createDeletionEvent(
			cardEventIdentifier,
			true, // isReplaceableEvent = true für Kind 30302
			`Card "${card.heading}" deleted`,
			ndk,
			actualEventId // ← NEU: Übergebe echte Event-ID falls vorhanden
		);

		// 🔍 DEBUG: Log deletion event details (BEFORE signing)
		console.log('[NostrIntegration] 📋 Card Deletion Event Details:');
		console.log('  Kind:', deletionEvent.kind);
		console.log('  Card Author:', card.author);
		console.log('  Tags:', JSON.stringify(deletionEvent.tags, null, 2));
		console.log('  Content:', deletionEvent.content);
		console.log('  Target Card Identifier:', cardEventIdentifier);
		console.log('  Actual Event ID:', actualEventId || 'NOT FOUND');
		console.log('  ⚠️ Note: Event will be signed by SyncManager before publishing');

		// 3. Bestimme Target-Relays basierend auf Card's publishState
		const publishState = card.publishState || 'draft';
		const normalizedState = (publishState === 'archived' ? 'private' : publishState) as
			| 'published'
			| 'draft'
			| 'private';

		const targetRelays = getTargetRelays({
			publishState: normalizedState,
			draftPublishingMode: settingsStore.settings.draftPublishingMode,
			relaysPublic: settingsStore.settings.relaysPublic,
			relaysPrivate: settingsStore.settings.relaysPrivate
		});

		const syncManager = getSyncManager();
		await syncManager.publishOrQueue(deletionEvent, 'card', 'high', normalizedState, targetRelays);

		console.log(`✅ Card deletion event queued for ${targetRelays.length} relay(s)`);
	} catch (error) {
		console.error(`❌ Error deleting card on Nostr:`, error);
	}
}

/**
 * 🔖 Creates and publishes a manual snapshot of the current board state
 */
export async function publishSnapshot(
	ndk: NDK | undefined,
	board: Board,
	label: string,
	reason: 'manual' | 'auto_save' | 'before_import' | 'before_restore' = 'manual'
): Promise<string | null> {
	if (!ndk) {
		console.error('[NostrIntegration] ❌ NDK not initialized for snapshot');
		return null;
	}

	try {
		const { NDKEvent } = await import('@nostr-dev-kit/ndk');
		const snapshotEvent = new NDKEvent(ndk);

		// Kind 30303 is non-replaceable - each snapshot is a unique record
		snapshotEvent.kind = 30303;

		// Get board author (canonical owner)
		const boardAuthor = board.author || authStore.getPubkey() || '';
		const timestamp = Math.floor(Date.now() / 1000);

		// Build tags according to BOARD-VERSIONING.md spec
		snapshotEvent.tags = [
			['a', `30301:${boardAuthor}:${board.id}`], // Reference to board
			['v', label], // User label/description
			['r', reason], // Snapshot reason
			['t', timestamp.toString()] // Unix timestamp
		];

		// Content is the complete board JSON
		const boardData = board.getContextData(true); // full = true for all details
		snapshotEvent.content = JSON.stringify(boardData);

		// 📌 SNAPSHOTS always go to private relay (they are personal backups)
		const privateRelays = settingsStore.settings.relaysPrivate || [];

		// Fallback: If no private relays configured, use default local relay (matching config.json)
		const targetRelays = privateRelays.length > 0 ? privateRelays : ['ws://localhost:7000'];

		console.log(`[NostrIntegration] 📡 Snapshot target relays:`, targetRelays);

		// Publish via SyncManager
		const syncManager = getSyncManager();
		await syncManager.publishOrQueue(snapshotEvent, 'board', 'normal', 'private', targetRelays);

		console.log(`✅ [NostrIntegration] Snapshot "${label}" published for board ${board.id}`);
		console.log(
			`   📊 Cards: ${boardData.columns?.reduce((sum: number, col: any) => sum + (col.cards?.length || 0), 0) || 0}`
		);
		console.log(`   📁 Columns: ${boardData.columns?.length || 0}`);

		// Return a pseudo-ID (actual ID is assigned by relay after signing)
		return `snapshot-${board.id}-${timestamp}`;
	} catch (error) {
		console.error('[NostrIntegration] ❌ Failed to publish snapshot:', error);
		toast.error('Snapshot konnte nicht gespeichert werden');
		return null;
	}
}
