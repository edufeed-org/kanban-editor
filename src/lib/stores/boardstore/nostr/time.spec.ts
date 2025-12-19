import { describe, expect, it } from 'vitest';
import { unknownTimestampToMs } from './time.js';

describe('unknownTimestampToMs', () => {
	it('parses numeric millisecond strings', () => {
		expect(unknownTimestampToMs('1765908093000')).toBe(1765908093000);
	});

	it('parses numeric second strings (10 digits) to ms', () => {
		expect(unknownTimestampToMs('1765908093')).toBe(1765908093 * 1000);
	});

	it('parses ISO timestamps', () => {
		const ms = unknownTimestampToMs('2025-12-16T12:00:00.000Z');
		expect(ms).toBeGreaterThan(0);
	});

	it('returns 0 for non-parsable strings', () => {
		expect(unknownTimestampToMs('not-a-date')).toBe(0);
	});
});
