import type { Board } from '../../../classes/BoardModel.js';
import type NDK from '@nostr-dev-kit/ndk';
import { unixSecondsToMs } from './time.js';
import { handleBoardEvent } from './handlers/board.js';
import { handleCardEvent } from './handlers/card.js';
import { handleDeletionEvent } from './handlers/deletion.js';

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
	const boardRef = `30301:${currentBoard.author || pubkey}:${currentBoard.id}`;
	const cardsSub = ndk.subscribe(
		{
			kinds: [30302] as number[],
			'#a': [boardRef],
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

	// 3️⃣ Subscription für Deletion-Events (Kind 5)
	const deletionsSub = ndk.subscribe(
		{
			kinds: [5] as number[],
			since: sevenDaysAgo,
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

	const subscriptions: SubscriptionLike[] = [ownBoardsSub, cardsSub, deletionsSub];

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
			const canonicalOwner = pTagsAll.length > 0 ? pTagsAll[0] : event.pubkey;

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
				const existingShared =
					typeof boardStore?.filterSharedBoards === 'function' ? boardStore.filterSharedBoards('') : [];
				const alreadyThere =
					Array.isArray(existingShared) && existingShared.some((b: any) => b.id === dTag);
				if (!alreadyThere) {
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
							const existingShared =
								typeof boardStore?.filterSharedBoards === 'function'
									? boardStore.filterSharedBoards('')
									: [];
							const alreadyThere =
								Array.isArray(existingShared) &&
								existingShared.some((b: any) => b.id === eventDTag);
							if (!alreadyThere) {
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
