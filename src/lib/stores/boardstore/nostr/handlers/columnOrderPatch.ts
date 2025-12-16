import { EVENT_KINDS } from '$lib/utils/nostrEvents.js';
import { unixSecondsToMs, unknownTimestampToMs } from '../time.js';

export async function handleColumnOrderPatchEvent(
	ctx: {
		processedEvents: Set<string>;
	},
	event: any,
	currentBoard: any,
	boardStore: any
): Promise<void> {
	if (!event || event.kind !== EVENT_KINDS.COLUMN_ORDER_PATCH) return;
	if (!event.id || typeof event.id !== 'string') return;
	if (ctx.processedEvents.has(event.id)) {
		console.log('[ColumnOrderPatch] ⏭️ ignored (already processed)', { id: event.id });
		return;
	}
	ctx.processedEvents.add(event.id);

	const tags: any[] = Array.isArray(event.tags) ? event.tags : [];

	const aTag = tags.find((t) => Array.isArray(t) && t[0] === 'a' && typeof t[1] === 'string');
	const orderTag = tags.find((t) => Array.isArray(t) && t[0] === 'order');
	const updatedMsTag = tags.find(
		(t) => Array.isArray(t) && t[0] === 'updated_at_ms' && typeof t[1] === 'string'
	);

	const boardId = typeof currentBoard?.id === 'string' ? currentBoard.id : '';
	if (!boardId) {
		console.warn('[ColumnOrderPatch] ⚠️ missing currentBoard.id; ignoring event', { id: event.id });
		return;
	}

	// Optional sanity: ensure this patch is for the current board id.
	// Accept either:
	// - a-tag suffix match (30301:<author>:<d>)
	// - d-tag exact match (d=<boardId>)
	const dTag = tags.find((t) => Array.isArray(t) && t[0] === 'd' && typeof t[1] === 'string');
	const aOk = aTag?.[1] && typeof aTag[1] === 'string' ? String(aTag[1]).endsWith(`:${boardId}`) : false;
	const dOk = dTag?.[1] && typeof dTag[1] === 'string' ? String(dTag[1]) === boardId : false;
	if (!aOk && !dOk) {
		console.log('[ColumnOrderPatch] ⛔ ignored (board mismatch)', {
			id: event.id,
			currentBoardId: boardId,
			a: aTag?.[1],
			d: dTag?.[1],
		});
		return;
	}

	const columnOrder: string[] = Array.isArray(orderTag) ? orderTag.slice(1).filter((v) => typeof v === 'string') : [];
	if (columnOrder.length === 0) {
		console.warn('[ColumnOrderPatch] ⚠️ empty order; ignoring', { id: event.id, boardId });
		return;
	}

	let eventTimeMs = updatedMsTag?.[1] ? unknownTimestampToMs(updatedMsTag[1]) : 0;
	if (!(eventTimeMs > 0)) {
		eventTimeMs = typeof event.created_at === 'number' ? unixSecondsToMs(event.created_at) : Date.now();
	}

	if (typeof boardStore?.applyColumnOrderPatchFromNostr === 'function') {
		console.log('[ColumnOrderPatch] ✅ applying', {
			id: event.id,
			boardId,
			eventTimeMs,
			publisherPubkey: typeof event.pubkey === 'string' ? event.pubkey : undefined,
			orderLen: columnOrder.length,
		});
		boardStore.applyColumnOrderPatchFromNostr({
			boardId,
			columnOrder,
			eventTimeMs,
			publisherPubkey: typeof event.pubkey === 'string' ? event.pubkey : undefined,
		});
	}
}
