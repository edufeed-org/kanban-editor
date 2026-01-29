/**
 * Create a Base64 data URL from a JSON-serializable object
 */
export function makeDataUrl(obj: unknown): string {
  const json = JSON.stringify(obj);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${base64}`;
}

/**
 * Decode a data URL (application/json) and return parsed JSON
 */
export function decodeDataUrl(dataUrl: string): unknown {
  if (!dataUrl.startsWith('data:')) throw new Error('Not a data URL');
  const [, rest] = dataUrl.split(',');
  const json = decodeURIComponent(escape(atob(rest)));
  return JSON.parse(json);
}

/**
 * Compute SHA-256 hex digest for integrity checks (async, browser-compatible)
 */
export async function sha256Hex(obj: unknown): Promise<string> {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const data = new TextEncoder().encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stub for IPFS upload - returns a placeholder URL. Replace with real implementation.
 */
export async function uploadToIpfsStub(buffer: Buffer): Promise<string> {
  // TODO: implement real IPFS upload or S3 upload
  console.warn('uploadToIpfsStub: called - replace with real uploader');
  return 'ipfs://placeholder';
}
