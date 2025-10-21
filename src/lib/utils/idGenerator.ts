// src/lib/utils/idGenerator.ts

/**
 * Generiert eine eindeutige, zufällige Hex-ID (wie in Nostr)
 * Nutzt 32 zufällige Bytes (256 bit) für globale Eindeutigkeit
 * @returns 64-character hex string (z.B. "a1b2c3d4e5f6...")
 */
export function generateHexId(): string {
    // Generiere 32 zufällige Bytes (256 bit)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    
    // Konvertiere zu hex string
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Generiert eine eindeutige ID ähnlich einem Nostr d-tag
 * Nutzt hex64 (wie Nostr Event IDs) für globale Eindeutigkeit
 * 
 * @param prefix - Optional prefix (z.B. 'board', 'column', 'card', 'comment')
 * @returns Eindeutige ID (z.B. "board-a1b2c3d4..." oder "comment-e5f6g7h8...")
 */
export function generateDTag(prefix?: 'board' | 'column' | 'card' | 'comment'): string {
    const hexId = generateHexId();
    
    // Mit Prefix (für Boards, Columns, Cards)
    if (prefix === 'board' || prefix === 'column' || prefix === 'card' || prefix === 'comment') {
        return `${prefix}-${hexId}`;
    }
    
    // Ohne Prefix: nur hex
    return hexId;
}

/**
 * Generiert einen zufälligen Nostr Public Key (npub) für Tests
 * In einer echten Anwendung würde dieser von der Nostr-Erweiterung kommen
 */
export function generateMockNpub(): string {
    const prefixes = ['npub1', 'nprofile1', 'naddr1'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomPart = Math.random().toString(36).substring(2, 16);
    return `${prefix}${randomPart}`;
}

/**
 * Erstellt eine ISO 8601 Timestamp für Kommentare und Updates
 */
export function generateTimestamp(): string {
    return new Date().toISOString();
}