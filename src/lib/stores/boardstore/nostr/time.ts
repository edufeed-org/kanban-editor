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
	if (typeof value === 'string') return isoToMs(value);
	return 0;
}
