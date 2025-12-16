export function unixSecondsToMs(value: number | undefined | null): number {
	if (!value || !Number.isFinite(value)) return 0;
	return value * 1000;
}

export function isoToMs(value: unknown): number {
	if (typeof value !== 'string') return 0;
	const ms = new Date(value).getTime();
	return Number.isFinite(ms) ? ms : 0;
}

export function unknownTimestampToMs(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		// Handle numeric timestamps (common for tags like updated_at_ms).
		// - 13 digits: milliseconds
		// - 10 digits: seconds
		if (/^\d+$/.test(trimmed)) {
			const num = Number(trimmed);
			if (!Number.isFinite(num)) return 0;
			if (trimmed.length === 10) return num * 1000;
			return num;
		}
		return isoToMs(trimmed);
	}
	return 0;
}
