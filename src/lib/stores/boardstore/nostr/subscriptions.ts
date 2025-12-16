import type { Board } from '../../../classes/BoardModel.js';
import type NDK from '@nostr-dev-kit/ndk';
import { unixSecondsToMs, unknownTimestampToMs } from './time.js';
import { EVENT_KINDS } from '$lib/utils/nostrEvents.js';
import { handleBoardEvent } from './handlers/board.js';
import { handleCardEvent } from './handlers/card.js';
import { handleColumnOrderPatchEvent } from './handlers/columnOrderPatch.js';
import { handleDeletionEvent } from './handlers/deletion.js';
import { BoardSharingOperations } from '../sharing.js';
import { isBoardTombstoned } from '../deletedBoards.js';

export type SubscriptionLike = {
	stop: () => void;
};

export function disposeSubscriptions(subscriptions: SubscriptionLike[]): SubscriptionLike {
	let stopped = false;
	return {
		stop: () => {
			if (stopped) return;
			stopped = true;
			for (const subscription of subscriptions) {
				try {
					subscription.stop();
				} catch {
					// ignore
				}
			}
		},
	};
}

export type SubscribeToUpdatesArgs = {
	ndk: NDK;
	pubkey: string;
	currentBoard: Board;
	boardStore: any;
	processedEvents: Set<string>;
	processedDeletionEvents: Set<string>;
	cardDeletionTimestamps: Map<string, number>;
	boardDeletionTimestamps: Map<string, number>;
};

export function shouldToastNewSharedBoard(args: {
	boardId: string;
	boardAuthor?: string;
	boardStore: any;
}): boolean {
	const { boardId, boardAuthor, boardStore } = args;

	// Wenn das Board lokal als gelöscht markiert ist (tombstone), ist ein "Neues Board geteilt" Toast immer falsch.
	// Das verhindert Ghost-Toasts auch dann, wenn Deletion-Events erst NACH dem 30301 Replay eintreffen.
	if (isBoardTombstoned(boardId)) {
		return false;
	}

	// Wenn der User dieses Board bereits verlassen/versteckt hat, ist ein "Neues Board geteilt" Toast irritierend.
	// Wichtig: author-scoped check (byAddress) + Legacy-Fallback (byId).
	if (
		BoardSharingOperations.isBoardHidden(boardId, boardAuthor) ||
		BoardSharingOperations.isBoardHidden(boardId)
	) {
		return false;
	}

	const existingShared =
		typeof boardStore?.filterSharedBoards === 'function' ? boardStore.filterSharedBoards('') : [];
	const alreadyThere = Array.isArray(existingShared) && existingShared.some((b: any) => b.id === boardId);
	return !alreadyThere;
}

/**
 * Baut Board/Card/Deletion/Sharing/Follower Subscriptions auf.
 *
 * Wichtig: Kommentar-Subscriptions werden separat via `nostr/comments.ts` gehandhabt.
 */
export function subscribeToUpdates(args: SubscribeToUpdatesArgs): SubscriptionLike {
	const {
		ndk,
		pubkey,
		currentBoard,
		boardStore,
		processedEvents,
		processedDeletionEvents,
		cardDeletionTimestamps,
		boardDeletionTimestamps,
	} = args;

	console.log('[BoardStore] 🛰️ Subscribing to board, card AND deletion events (Collaboration v3.0)');

	// ⚡ OPTIMIZATION: Filtere alte Deletion Events aus (nur letzte 7 Tage)
	const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

	// 1️⃣ Subscription für eigene Board-Events (Kind 30301)
	const ownBoardsSub = ndk.subscribe(
		{
			kinds: [30301] as number[],
			authors: [pubkey],
			since: sevenDaysAgo,
		} as any,
		{ closeOnEose: false }
	);

	ownBoardsSub.on('event', async (event: any) => {
		if (event.kind === 30301) {
			await handleBoardEvent(
				{ processedEvents, boardDeletionTimestamps },
				event,
				currentBoard,
				boardStore
			);
		}
	});

	// 2️⃣ Subscription für Card-Events des AKTUELLEN Boards (Kind 30302)
	// Cards referenzieren Boards via `a`-Tag: `30301:<author>:<d>`.
	// Für Robustheit (v.a. nach Reset / Shared Boards) abonnieren wir beide Kandidaten:
	// - owner/canonical author (currentBoard.author)
	// - eigener pubkey (pubkey)
	const boardRefAuthors = Array.from(
		new Set([currentBoard.author, pubkey].filter((v): v is string => typeof v === 'string' && v.length > 0))
	);
	const boardRefs = boardRefAuthors.map((author) => `30301:${author}:${currentBoard.id}`);
	const cardsSub = ndk.subscribe(
		{
			kinds: [30302] as number[],
			'#a': boardRefs,
			since: sevenDaysAgo,
		} as any,
		{ closeOnEose: false }
	);

	cardsSub.on('event', async (event: any) => {
		if (event.kind === 30302) {
			await handleCardEvent(
				{ processedEvents, cardDeletionTimestamps },
				event,
				currentBoard,
				boardStore
			);
		}
	});

	// 2b️⃣ Subscription für Column-Order Patches (Kind 8571)
	// Wird von Editoren verwendet, um Column-Order zu synchronisieren, ohne 30301 zu publizieren.
	// Column-order patches (Kind 8571): subscribe via canonical `a` ref AND a fallback `d=<boardId>`.
	// Using multiple filters makes this robust against boardRef/author timing issues.
	console.info('[BoardStore] 🧩 ColumnOrderPatch subscribe', {
		kind: EVENT_KINDS.COLUMN_ORDER_PATCH,
		boardId: currentBoard.id,
		boardAuthor: currentBoard.author,
		viewerPubkey: pubkey,
		boardRefs,
		sevenDaysAgo,
	});
	const columnOrderPatchSub = ndk.subscribe(
		[
			{
				kinds: [EVENT_KINDS.COLUMN_ORDER_PATCH],
				'#a': boardRefs,
				since: sevenDaysAgo,
			},
			{
				kinds: [EVENT_KINDS.COLUMN_ORDER_PATCH],
				'#d': [currentBoard.id],
				since: sevenDaysAgo,
			},
		] as any,
		{ closeOnEose: false }
	);

	// ⚠️ UX/Perf: Relays können beim Subscribe viele historische Patch-Events replayen.
	// Wenn wir die alle nacheinander anwenden, "springt" die UI durch alte Orders.
	// Daher: während initialem Catch-up puffern wir nur das NEUESTE Patch-Event und wenden es nach EOSE einmal an.
	let columnOrderPatchCatchUpActive = true;
	let columnOrderPatchCatchUpReceived = 0;
	let bufferedLatestPatch: { event: any; eventTimeMs: number } | null = null;
	const getPatchEventTimeMs = (event: any): number => {
		const tags: any[] = Array.isArray(event?.tags) ? event.tags : [];
		const updatedMsTag = tags.find((t) => Array.isArray(t) && t[0] === 'updated_at_ms')?.[1];
		const updatedMs = unknownTimestampToMs(updatedMsTag);
		if (updatedMs > 0) return updatedMs;
		return unixSecondsToMs(event?.created_at);
	};

	// EOSE: Ende des initialen Replays. Danach live anwenden.
	(columnOrderPatchSub as any).on?.('eose', async () => {
		columnOrderPatchCatchUpActive = false;
		if (bufferedLatestPatch?.event) {
			const applied = await handleColumnOrderPatchEvent(
				{ processedEvents },
				bufferedLatestPatch.event,
				currentBoard,
				boardStore
			);
			console.info('[BoardStore] 🧩 ColumnOrderPatch catch-up done', {
				currentBoardId: currentBoard.id,
				received: columnOrderPatchCatchUpReceived,
				applied,
				id: bufferedLatestPatch.event.id,
				eventTimeMs: bufferedLatestPatch.eventTimeMs,
			});
		} else if (columnOrderPatchCatchUpReceived > 0) {
			console.info('[BoardStore] 🧩 ColumnOrderPatch catch-up done', {
				currentBoardId: currentBoard.id,
				received: columnOrderPatchCatchUpReceived,
				applied: false,
			});
		}
		bufferedLatestPatch = null;
		columnOrderPatchCatchUpReceived = 0;
	});

	columnOrderPatchSub.on('event', async (event: any) => {
		if (event.kind === EVENT_KINDS.COLUMN_ORDER_PATCH) {
			// Catch-up: nur das neueste Event puffern, nicht alles anwenden.
			if (columnOrderPatchCatchUpActive) {
				columnOrderPatchCatchUpReceived++;
				const eventTimeMs = getPatchEventTimeMs(event);
				if (!bufferedLatestPatch || eventTimeMs >= bufferedLatestPatch.eventTimeMs) {
					bufferedLatestPatch = { event, eventTimeMs };
				}
				return;
			}
			const applied = await handleColumnOrderPatchEvent({ processedEvents }, event, currentBoard, boardStore);
			if (applied) {
				const eventTimeMs = getPatchEventTimeMs(event);
				console.info('[BoardStore] 🧩 ColumnOrderPatch applied (live)', {
					currentBoardId: currentBoard.id,
					id: event.id,
					eventTimeMs,
				});
			} else {
				// Sehr häufig (No-op, LWW, Duplikate, Board mismatch) → bewusst nur debug.
				console.debug('[BoardStore] ColumnOrderPatch ignored (live)', {
					currentBoardId: currentBoard.id,
					id: event?.id,
				});
			}
		}
	});

	// 3️⃣ Subscription für Deletion-Events (Kind 5)
	// ⚡ OPTIMIZATION: Wir subscriben NICHT global auf alle Kind-5 Events.
	// Stattdessen scopen wir auf relevante Autoren (mich + owner + maintainers),
	// damit `nostr-processed-deletions` nicht durch irrelevante Deletes wächst.
	const deletionAuthors = Array.from(
		new Set(
			[
				pubkey,
				currentBoard.author,
				...(Array.isArray((currentBoard as any).maintainers) ? (currentBoard as any).maintainers : []),
			].filter((v): v is string => typeof v === 'string' && v.length > 0)
		)
	);
	const deletionsSub = ndk.subscribe(
		{
			kinds: [5] as number[],
			since: sevenDaysAgo,
			...(deletionAuthors.length > 0 ? { authors: deletionAuthors } : {}),
		} as any,
		{ closeOnEose: false }
	);

	deletionsSub.on('event', async (event: any) => {
		if (event.kind === 5) {
			await handleDeletionEvent(
				{ processedEvents, processedDeletionEvents, cardDeletionTimestamps, boardDeletionTimestamps },
				event,
				boardStore
			);
		}
	});

	const subscriptions: SubscriptionLike[] = [ownBoardsSub, cardsSub, columnOrderPatchSub, deletionsSub];

	// 4️⃣ Shared Board Updates vom Owner
	if (currentBoard.author && currentBoard.author !== pubkey) {
		console.log('[BoardStore] 🤝 Subscribing to shared board updates from owner:', currentBoard.author);

		const sharedBoardSub = ndk.subscribe(
			{
				kinds: [30301] as number[],
				authors: [currentBoard.author],
				'#d': [currentBoard.id],
				since: sevenDaysAgo,
			} as any,
			{ closeOnEose: false }
		);

		sharedBoardSub.on('event', async (event: any) => {
			if (event.kind === 30301) {
				await handleBoardEvent(
					{ processedEvents, boardDeletionTimestamps },
					event,
					currentBoard,
					boardStore
				);
			}
		});

		subscriptions.push(sharedBoardSub);
	}

	// 5️⃣ Geteilte Boards Discovery (Kind 30301 mit #p)
	const sharedSub = ndk.subscribe(
		{
			kinds: [30301] as number[],
			'#p': [pubkey],
			since: sevenDaysAgo,
		} as any,
		{ closeOnEose: false }
	);

	subscriptions.push(sharedSub);

	sharedSub.on('event', async (event: any) => {
		try {
			if (event.kind !== 30301) return;
			if (event.pubkey === pubkey) return;
			if (processedEvents.has(event.id)) return;

			const dTag = event.tags.find((t: any) => t[0] === 'd')?.[1];
			const title = event.tags.find((t: any) => t[0] === 'title')?.[1];
			const description = event.tags.find((t: any) => t[0] === 'description')?.[1];
			if (!dTag || !title) return;

			const pTagsAll = event.tags.filter((t: any) => t[0] === 'p').map((t: any) => t[1]);
			// Wichtig: Für parametrized replaceable events ist die kanonische Adresse immer
			//   30301:<event.pubkey>:<d>
			// Daher MUSS der Owner/Author hier event.pubkey sein (p-tag Reihenfolge ist nicht garantiert).
			const canonicalOwner = event.pubkey;

			let userRole = 'viewer';
			if (canonicalOwner === pubkey) {
				userRole = 'owner';
			} else if (pTagsAll.includes(pubkey)) {
				userRole = 'editor';
			}

			const columnTags = event.tags.filter((t: any) => t[0] === 'col');
			const columns = columnTags.map((t: any) => ({
				id: t[1],
				name: t[2] || 'Column',
				color: t[4] || undefined,
				cards: [],
			}));

			const boardProps = {
				id: dTag,
				eventId: event.id,
				name: title,
				description: description || undefined,
				columns,
				author: canonicalOwner,
				maintainers: pTagsAll.filter((p: string) => p !== canonicalOwner),
				createdAt: event.created_at ? unixSecondsToMs(event.created_at) : Date.now(),
				updatedAt: undefined,
			};

			if (typeof boardStore?.upsertBoardFromNostr === 'function') {
				boardStore.upsertBoardFromNostr(boardProps);
			}

			if (typeof boardStore?.handleSharedBoardEvent === 'function') {
				boardStore.handleSharedBoardEvent({
					id: dTag,
					name: title,
					description: description || undefined,
					createdAt: event.created_at ? unixSecondsToMs(event.created_at) : Date.now(),
					updatedAt: event.created_at ? unixSecondsToMs(event.created_at) : undefined,
					isShared: true,
					userRole,
					author: canonicalOwner,
				});
			}

			if (typeof boardStore?.refreshBoardIds === 'function') {
				boardStore.refreshBoardIds();
			}

			try {
				if (shouldToastNewSharedBoard({ boardId: dTag, boardAuthor: canonicalOwner, boardStore })) {
					const { toast } = await import('svelte-sonner');
					const ownerShort = `${event.pubkey.slice(0, 8)}...${event.pubkey.slice(-4)}`;
					toast.success('Neues Board geteilt', {
						description: `${ownerShort} hat "${title}" mit dir geteilt`,
					});
				}
			} catch {
				// Toast ist best-effort
			}

			processedEvents.add(event.id);
		} catch (error) {
			console.warn('⚠️ Fehler beim Verarbeiten eines Shared Board Events:', error);
		}
	});

	// 6️⃣ Follow Set Events (Kind 30000)
	const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
	const followerSub = ndk.subscribe(
		{
			kinds: [30000] as number[],
			'#p': [pubkey],
			since: oneDayAgo,
		} as any,
		{ closeOnEose: false }
	);

	subscriptions.push(followerSub);

	followerSub.on('event', async (event: any) => {
		try {
			if (event.kind !== 30000) return;
			if (processedEvents.has(event.id)) return;

			const dTag = event.tags.find((t: any) => t[0] === 'd')?.[1];
			if (!dTag || !dTag.startsWith('board-followers-')) return;

			const boardId = dTag.replace('board-followers-', '');
			const boardAuthor = event.pubkey;

			console.log(
				`🔔 Kind 30000 Follow Set Event erhalten: Board ${boardId} vom Author ${boardAuthor}`
			);
			console.log(
				`📋 Viewer Liste im Event:`,
				event.tags.filter((t: any) => t[0] === 'p').map((t: any) => t[1])
			);

			processedEvents.add(event.id);

			try {
				let boardEvent = null;
				try {
					boardEvent = (await Promise.race([
						ndk.fetchEvent({
							kinds: [30301],
							authors: [boardAuthor],
							'#d': [boardId],
						} as any),
						new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
					])) as any;

					if (boardEvent) {
						console.log(`✅ Board ${boardId} gefetcht nach Follow Set`);
					} else {
						console.log(
							`ℹ️ Board ${boardId} nicht sofort verfügbar - kommt via normale Subscription`
						);
					}
				} catch {
					console.log(`ℹ️ Board ${boardId} Fetch Timeout - kommt via normale Subscription`);
				}

				if (boardEvent) {
					const eventDTag = boardEvent.tags.find((t: any) => t[0] === 'd')?.[1];
					const title = boardEvent.tags.find((t: any) => t[0] === 'title')?.[1];
					const description = boardEvent.tags.find((t: any) => t[0] === 'description')?.[1];

					console.log(`📦 Board Event Details: id=${eventDTag}, title=${title}`);

					if (eventDTag && title) {
						const pTags = boardEvent.tags
							.filter((t: any) => t[0] === 'p')
							.map((t: any) => t[1]);
						let userRole = 'viewer';

						const { authStore } = await import('$lib/stores/authStore.svelte.js');
						const currentUserPubkey =
							typeof authStore?.getPubkey === 'function' ? authStore.getPubkey() : null;

						if (currentUserPubkey && pTags.includes(currentUserPubkey)) {
							userRole = 'editor';
						}

						console.log(`👤 Bestimmte Role: ${userRole} (p-tags: ${pTags.length})`);

						if (typeof boardStore?.handleSharedBoardEvent === 'function') {
							boardStore.handleSharedBoardEvent({
								id: eventDTag,
								name: title,
								description: description || undefined,
								createdAt: boardEvent.created_at
									? unixSecondsToMs(boardEvent.created_at)
									: Date.now(),
								updatedAt: boardEvent.created_at
									? unixSecondsToMs(boardEvent.created_at)
									: undefined,
								isShared: true,
								userRole,
								author: boardAuthor,
							});
							console.log(`✅ Board zu Shared Cache hinzugefügt: ${title} (${userRole})`);
						}

						try {
							if (
								shouldToastNewSharedBoard({
									boardId: eventDTag,
									boardAuthor,
									boardStore,
								})
							) {
								const { toast } = await import('svelte-sonner');
								const ownerShort = `${boardAuthor.slice(0, 8)}...${boardAuthor.slice(-4)}`;
								toast.success('Neues Board geteilt', {
									description: `${ownerShort} hat "${title}" mit dir als ${userRole} geteilt`,
								});
								console.log(`🎉 Toast angezeigt: Board ${title} (${userRole})`);
							} else {
								console.log(`ℹ️ Board ${title} existiert bereits in Liste`);
							}
						} catch {
							// Toast best-effort
							console.warn('ℹ️ Toast konnte nicht angezeigt werden (best-effort)');
						}
					} else {
						console.warn(
							`⚠️ Board Event fehlen kritische Tags: dTag=${eventDTag}, title=${title}`
						);
					}
				} else {
					console.warn(`❌ Board Event konnte nach 3 Versuchen nicht geholt werden`);
				}
			} catch (fetchErr) {
				console.warn(
					`⚠️ Fehler beim Verarbeiten des Follow Set Events für Board ${boardId}:`,
					fetchErr
				);
			}
		} catch (error) {
			console.warn('⚠️ Unerwarteter Fehler beim Verarbeiten eines Follow Set Events:', error);
		}
	});

	return disposeSubscriptions(subscriptions);
}
