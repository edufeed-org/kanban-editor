import { describe, it, expect } from 'vitest';
import { makeDataUrl, decodeDataUrl, sha256Hex } from './ambEncoding';

describe('ambEncoding', () => {
  it('roundtrips JSON via data URL', () => {
    const obj = { a: 1, b: 'test', nested: { x: true } };
    const dataUrl = makeDataUrl(obj);
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:application/json;base64,')).toBe(true);
    const parsed = decodeDataUrl(dataUrl);
    expect(parsed).toEqual(obj);
  });

  it('computes stable sha256 hex', async () => {
    const obj = { foo: 'bar' };
    const h1 = await sha256Hex(obj);
    const h2 = await sha256Hex(obj);
    expect(h1).toBe(h2);
    expect(typeof h1).toBe('string');
    expect(h1.length).toBeGreaterThan(0);
  });
});
