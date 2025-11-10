/**
 * Relay Selection Utility
 * 
 * Determines which relays to use based on PublishState and Settings
 * 
 * Rules:
 * - 'published' → Public + Private relays (vollständiges Backup auf Private!)
 *   - Fallback: Nur Public wenn keine Private konfiguriert
 *   - Fallback: Nur Private wenn keine Public konfiguriert
 *   - Warnung: Wenn beide leer → local-only
 * 
 * - 'private' → ALWAYS private relays
 *   - Warnung wenn keine Private Relays → local-only Fallback
 * 
 * - 'draft' → Depends on draftPublishingMode setting:
 *   - 'private-relays' → Use private relays (default)
 *   - 'local-only' → Return empty array (no Nostr publishing)
 *   - 'public-relays' → Use public relays (not recommended for privacy)
 *   - Warnung wenn keine entsprechenden Relays konfiguriert → local-only Fallback
 * 
 * @module relaySelection
 */

import type { PublishState, DraftPublishingMode } from '$lib/stores/settingsStore.svelte';

export interface RelaySelectionOptions {
  publishState: PublishState;
  draftPublishingMode: DraftPublishingMode;
  relaysPublic: string[];
  relaysPrivate: string[];
}

/**
 * Get target relays for publishing based on PublishState and settings
 * 
 * @param options - Configuration options
 * @returns Array of relay URLs to publish to (empty array = don't publish to Nostr)
 * 
 * @example
 * // Published content → public relays
 * getTargetRelays({
 *   publishState: 'published',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → ['wss://relay.damus.io']
 * 
 * @example
 * // Draft content with private-relays mode → private relays
 * getTargetRelays({
 *   publishState: 'draft',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → ['wss://private.relay']
 * 
 * @example
 * // Draft content with local-only mode → no publishing
 * getTargetRelays({
 *   publishState: 'draft',
 *   draftPublishingMode: 'local-only',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: []
 * })
 * // → []
 */
/**
 * Get target relays for publishing based on PublishState and settings
 * 
 * @param options - Configuration options
 * @returns Array of relay URLs to publish to (empty array = don't publish to Nostr)
 * 
 * @example
 * // Published content → public + private relays (vollständiges Backup!)
 * getTargetRelays({
 *   publishState: 'published',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → ['wss://relay.damus.io', 'wss://private.relay']
 * 
 * @example
 * // Draft content with private-relays mode → private relays only
 * getTargetRelays({
 *   publishState: 'draft',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → ['wss://private.relay']
 * 
 * @example
 * // Draft content with local-only mode → no publishing
 * getTargetRelays({
 *   publishState: 'draft',
 *   draftPublishingMode: 'local-only',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: []
 * })
 * // → []
 */
export function getTargetRelays(options: RelaySelectionOptions): string[] {
  const { publishState, draftPublishingMode, relaysPublic, relaysPrivate } = options;

  // Rule 1: 'published' → Public + Private relays (vollständiges Backup!)
  if (publishState === 'published') {
    const targetRelays = [
      ...relaysPublic,
      ...relaysPrivate
    ];
    
    // Deduplizierung falls gleiche Relays in beiden Listen
    const uniqueRelays = [...new Set(targetRelays)];
    
    if (uniqueRelays.length === 0) {
      console.error('[RelaySelection] ⚠️ CRITICAL: No relays configured for published content! Event will be local-only.');
      return [];
    }
    
    if (relaysPublic.length === 0) {
      console.warn('[RelaySelection] ⚠️ No public relays configured! Published content will only go to private relays.');
    }
    
    if (relaysPrivate.length === 0) {
      console.warn('[RelaySelection] ⚠️ No private relays configured! Published content has no backup on private relays.');
    }
    
    console.log(`[RelaySelection] publishState=published → Using ${uniqueRelays.length} relay(s): ${relaysPublic.length} public + ${relaysPrivate.length} private`);
    return uniqueRelays;
  }

  // Rule 2: 'private' → ALWAYS private relays
  if (publishState === 'private') {
    if (relaysPrivate.length === 0) {
      console.error('[RelaySelection] ⚠️ CRITICAL: No private relays configured for private content! Event will be local-only.');
      return [];
    }
    console.log('[RelaySelection] publishState=private → Using private relays');
    return relaysPrivate;
  }

  // Rule 3: 'draft' → Depends on draftPublishingMode
  if (publishState === 'draft') {
    switch (draftPublishingMode) {
      case 'private-relays':
        if (relaysPrivate.length === 0) {
          console.warn('[RelaySelection] ⚠️ No private relays configured! Draft will be local-only.');
          return [];
        }
        console.log('[RelaySelection] publishState=draft + mode=private-relays → Using private relays');
        return relaysPrivate;

      case 'local-only':
        console.log('[RelaySelection] publishState=draft + mode=local-only → No Nostr publishing');
        return [];

      case 'public-relays':
        if (relaysPublic.length === 0) {
          console.warn('[RelaySelection] ⚠️ No public relays configured! Draft will be local-only.');
          return [];
        }
        console.warn('[RelaySelection] ⚠️ publishState=draft + mode=public-relays → Using public relays (NOT RECOMMENDED for privacy!)');
        return relaysPublic;

      default:
        // Fallback to private-relays if mode is invalid
        console.warn(`[RelaySelection] Unknown draftPublishingMode: ${draftPublishingMode}, falling back to private-relays`);
        if (relaysPrivate.length === 0) {
          console.warn('[RelaySelection] ⚠️ No private relays configured! Draft will be local-only.');
          return [];
        }
        return relaysPrivate;
    }
  }

  // Fallback: Unknown publishState → no publishing
  console.error(`[RelaySelection] Unknown publishState: ${publishState}, returning empty array`);
  return [];
}

/**
 * Check if event should be published to Nostr
 * 
 * @param publishState - Event's publish state
 * @param draftPublishingMode - Current draft publishing mode setting
 * @returns true if event should be published to Nostr, false if local-only
 * 
 * @example
 * shouldPublishToNostr('published', 'private-relays') // → true
 * shouldPublishToNostr('draft', 'local-only') // → false
 * shouldPublishToNostr('draft', 'private-relays') // → true
 */
export function shouldPublishToNostr(
  publishState: PublishState,
  draftPublishingMode: DraftPublishingMode
): boolean {
  // Published and private always publish to Nostr
  if (publishState === 'published' || publishState === 'private') {
    return true;
  }

  // Draft depends on mode
  if (publishState === 'draft') {
    return draftPublishingMode !== 'local-only';
  }

  // Unknown publishState → don't publish
  return false;
}

/**
 * Get human-readable description of relay selection
 * 
 * @param options - Configuration options
 * @returns Description string for UI display
 * 
 * @example
 * getRelaySelectionDescription({
 *   publishState: 'published',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → "Published content → 2 relay(s) (1 public + 1 private backup)"
 * 
 * @example
 * getRelaySelectionDescription({
 *   publishState: 'draft',
 *   draftPublishingMode: 'private-relays',
 *   relaysPublic: ['wss://relay.damus.io'],
 *   relaysPrivate: ['wss://private.relay']
 * })
 * // → "Draft content → 1 private relay(s)"
 */
export function getRelaySelectionDescription(options: RelaySelectionOptions): string {
  const { publishState, draftPublishingMode, relaysPublic, relaysPrivate } = options;
  const targetRelays = getTargetRelays(options);

  if (targetRelays.length === 0) {
    return 'Content will NOT be published to Nostr (local-only)';
  }

  if (publishState === 'published') {
    const publicCount = relaysPublic.length;
    const privateCount = relaysPrivate.length;
    const totalCount = targetRelays.length;
    
    if (publicCount > 0 && privateCount > 0) {
      return `Published content → ${totalCount} relay(s) (${publicCount} public + ${privateCount} private backup)`;
    } else if (publicCount > 0) {
      return `Published content → ${totalCount} public relay(s) ⚠️ (no private backup!)`;
    } else {
      return `Published content → ${totalCount} private relay(s) only ⚠️ (no public relays!)`;
    }
  }

  if (publishState === 'private') {
    return `Private content → ${targetRelays.length} private relay(s)`;
  }

  if (publishState === 'draft') {
    switch (draftPublishingMode) {
      case 'private-relays':
        return `Draft content → ${targetRelays.length} private relay(s)`;
      case 'public-relays':
        return `Draft content → ${targetRelays.length} public relay(s) ⚠️ (not private!)`;
      default:
        return 'Draft content → local-only';
    }
  }

  return 'Unknown publish state';
}
