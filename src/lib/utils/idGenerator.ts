// src/lib/utils/idGenerator.ts

/**
 * Generiert eine eindeutige ID ähnlich einem Nostr d-tag
 * Kombiniert Timestamp und Zufallszahlen für Eindeutigkeit
 */
export function generateDTag(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${randomPart}`;
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