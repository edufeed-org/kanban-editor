const DELETION_EVENTS_STORAGE_KEY = 'nostr-processed-deletions';
const MAX_EVENTS = 1000;

/**
 * ⚡ OPTIMIZATION: Load processed deletion events from localStorage
 * Prevents re-processing deletion events after app restart
 */
export function loadProcessedDeletions(): Set<string> {
	try {
		const stored = localStorage.getItem(DELETION_EVENTS_STORAGE_KEY);
		if (!stored) return new Set();

		const deletions = JSON.parse(stored) as string[];
		console.log(`💿 Loaded ${deletions.length} processed deletion event(s) from cache`);
		return new Set(deletions);
	} catch (error) {
		console.warn('[NostrIntegration] ⚠️ Failed to load processed deletions:', error);
		return new Set();
	}
}

/**
 * ⚡ OPTIMIZATION: Save processed deletion events to localStorage
 * Limits to last 1000 events to prevent unbounded growth
 */
export function saveProcessedDeletions(processedDeletionEvents: Set<string>): Set<string> {
	try {
		// Limit to last 1000 deletion events (FIFO)
		const deletions = Array.from(processedDeletionEvents);
		const limited = deletions.slice(-MAX_EVENTS);

		localStorage.setItem(DELETION_EVENTS_STORAGE_KEY, JSON.stringify(limited));
		return new Set(limited);
	} catch (error) {
		console.warn('[NostrIntegration] ⚠️ Failed to save processed deletions:', error);
		return processedDeletionEvents;
	}
}
