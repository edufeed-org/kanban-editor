// src/lib/utils/nostrEvents.ts
/**
 * Nostr Event Serialisierung & Deserialisierung
 *
 * Mappt zwischen:
 * - BoardModel Klassen (Board, Column, Card) ← Internal Model
 * - Nostr Events (Kind 30301, 30302, 1) ← External (Nostr Relays)
 *
 * Event Kinds:
 * - 30301: Board Event (Parametrized Replaceable)
 * - 30302: Card Event (Parametrized Replaceable)
 * - 1: Comment Event (Regular Note)
 * - 5: Event Deletion (NIP-09)
 *
 * Status: Phase 1.1 ROADMAP (Nostr Publishing)
 */

import { NDKEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import type { Board, Column, Card, Comment } from '../classes/BoardModel.js';
import type { BoardProps, CardProps, ColumnProps } from '../classes/BoardModel.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const EVENT_KINDS = {
  BOARD: 30301, // Board definition (replaceable)
  CARD: 30302, // Card definition (replaceable)
  COMMENT: 1, // Text note (regular)
  DELETION: 5, // Event deletion (NIP-09)
  SOFT_LOCK: 20001, // "Now editing" soft lock (ephemeral)
} as const;

// ============================================================================
// BOARD EVENT SERIALIZATION (Kind 30301)
// ============================================================================

/**
 * Konvertiert ein Board zu einem Nostr Event (Kind 30301)
 *
 * Event Structure:
 * ```
 * {
 *   kind: 30301,
 *   tags: [
 *     ["d", "board-id"],  // d-tag: unique identifier
 *     ["title", "Board Name"],
 *     ["description", "..."],
 *     ["state", "draft|published|archived"],
 *     ["col", "col-id", "Column Name", "order", "color"],
 *     ["col", "col-id-2", "Column Name 2", "order", "color"],
 *     ["p", "maintainer-pubkey"],  // co-editors (NIP-51)
 *     ["t", "tag1", "tag2"],  // tags for categorization
 *   ],
 *   content: "", // Empty or markdown description
 * }
 * ```
 */
export function boardToNostrEvent(board: Board, ndk: NDK): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.BOARD;

  // Build tags
  const tags: string[][] = [
    ['d', board.id],
    ['title', board.name],
  ];

  // Optional fields
  if (board.description) {
    tags.push(['description', board.description]);
  }

  if (board.publishState) {
    tags.push(['state', board.publishState]);
  }

  // Add columns as tags
  board.columns.forEach((column, index) => {
    tags.push([
      'col',
      column.id,
      column.name,
      String(index),
      column.color || '',
    ]);
  });

  // Add author (p-tag) - only if available
  if (board.author) {
    // Convert display name to hex pubkey if needed (TODO: implement if storing names)
    tags.push(['p', board.author]);
  }

  // Add maintainers (co-editors)
  if (board.maintainers && board.maintainers.length > 0) {
    board.maintainers.forEach(pubkey => {
      tags.push(['p', pubkey]);
    });
  }

  // Add board tags
  if (board.tags && board.tags.length > 0) {
    tags.push(['t', ...board.tags]);
  }

  // Add CC License
  if (board.ccLicense) {
    tags.push(['license', board.ccLicense]);
  }

  event.tags = tags;
  event.content = board.description || ''; // Optional markdown description

  return event;
}

/**
 * Konvertiert ein Nostr Event zurück zu BoardProps
 */
export function nostrEventToBoard(event: NDKEvent): BoardProps {
  const tags = event.tags || [];

  // Extract d-tag (unique ID)
  const dTag = tags.find(t => t[0] === 'd');
  const id = dTag ? dTag[1] : event.id || '';

  // Store event ID for potential deletion reference
  const eventId = event.id;

  // Title / name
  const titleTag = tags.find(t => t[0] === 'title');
  const name = titleTag ? titleTag[1] : 'Unnamed Board';

  // Description (fallback: event.content)
  const descTag = tags.find(t => t[0] === 'description');
  const description = descTag ? descTag[1] : event.content || '';

  // Publish state
  const stateTag = tags.find(t => t[0] === 'state');
  const publishState = stateTag ? (stateTag[1] as any) : 'draft';

  // p-tags (NIP-51 compliant): all are maintainers/editors except event publisher
  // Previous implementation incorrectly set author = event.pubkey (publisher),
  // which caused ownership to jump to the editor when an editor published an update.
  const pTags = tags.filter(t => t[0] === 'p').map(t => t[1]);
  const author = event.pubkey; // Event publisher is always the owner
  
  // Maintainers = all distinct p-tags (editors who can edit the board)
  const maintainers = pTags.filter(pubkey => pubkey !== author);
  
  // NOTE: Followers (viewers) come from separate Kind 30000 Follow Set events (NIP-51)
  // They should NOT be in the Kind 30301 event p-tags
  const followers: string[] = [];

  // Columns
  const colTags = tags.filter(t => t[0] === 'col');
  const columns: ColumnProps[] = colTags.map(colTag => ({
    id: colTag[1],
    name: colTag[2] || 'Untitled',
    color: colTag[4] || undefined,
    cards: [],
  }));

  // Board tags
  const tTag = tags.find(t => t[0] === 't');
  const boardTags = tTag ? tTag.slice(1) : [];

  // License
  const licenseTag = tags.find(t => t[0] === 'license');
  const ccLicense = licenseTag ? licenseTag[1] : 'cc-by-4.0';

  // Timestamp (Last-Write-Wins)
  const eventTimestamp = event.created_at || Math.floor(Date.now() / 1000);
  const updatedAt = new Date(eventTimestamp * 1000).toISOString();

  return {
    id,
    eventId,
    name,
    description,
    columns,
    publishState,
    author,
    maintainers: maintainers.length > 0 ? maintainers : undefined,
    followers: followers.length > 0 ? followers : undefined, // Populated from Kind 30000 Follow Set
    tags: boardTags,
    ccLicense,
    createdAt: eventTimestamp,
    updatedAt,
  };
}

// ============================================================================
// CARD EVENT SERIALIZATION (Kind 30302)
// ============================================================================

/**
 * Konvertiert eine Card zu einem Nostr Event (Kind 30302)
 *
 * Event Structure:
 * ```
 * {
 *   kind: 30302,
 *   tags: [
 *     ["d", "card-id"],  // d-tag: unique identifier
 *     ["a", "30301:board-author:board-id"],  // Reference to board
 *     ["s", "column-id"],  // PRIMARY: Column-ID (laut Kanban-NIP)
 *     ["col_label", "Column Name"],  // SECONDARY: Human-readable name
 *     ["title", "Card Title"],
 *     ["description", "..."],
 *     ["state", "draft|published|archived"],
 *     ["rank", "0"],  // Position in column
 *     ["image", "https://..."],  // Optional image
 *     ["p", "author-pubkey"],  // Card author
 *     ["label", "tag1", "tag2"],  // Card labels
 *   ],
 *   content: "", // Full description as markdown
 * }
 * ```
 * 
 * ⚠️ WICHTIG: columnId UND columnName müssen übergeben werden!
 * - columnId → s-Tag (PRIMARY, für eindeutige Zuordnung)
 * - columnName → col_label-Tag (SECONDARY, für Anzeige)
 */
export function cardToNostrEvent(
  card: Card,
  columnId: string,    // ⚠️ GEÄNDERT: War vorher columnName
  columnName: string,  // ⚠️ NEU: Für col_label Tag
  rank: number,
  boardRef: string, // Format: "30301:author-pubkey:board-id"
  ndk: NDK
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.CARD;

  const tags: string[][] = [
    ['d', card.id],
    ['a', boardRef], // Reference to board
    ['s', columnId], // PRIMARY: Column-ID (laut Kanban-NIP!)
    ['col_label', columnName], // SECONDARY: Human-readable name
    ['title', card.heading],
    ['rank', String(rank)],
  ];

  // Optional fields
  if (card.content) {
    tags.push(['description', card.content]);
  }

  if (card.publishState) {
    tags.push(['state', card.publishState]);
  }

  if (card.color) {
    tags.push(['color', card.color]);
  }

  // Image (Kartenbild-URL)
  if (card.image) {
    tags.push(['image', card.image]);
  }

  // Author (p-tag mit Role)
  if (card.author) {
    tags.push(['p', card.author, '', 'author']);
  }

  // Author Display Name (NIP-39 Pattern)
  if (card.authorName) {
    tags.push(['name', card.authorName]);
  }

  // Attendees (p-tags mit Role)
  if (card.attendees && card.attendees.length > 0) {
    card.attendees.forEach(attendee => {
      if (attendee !== card.author) {  // Nicht doppeln
        tags.push(['p', attendee, '', 'attendee']);
      }
    });
  }

  // Labels
  if (card.labels && card.labels.length > 0) {
    card.labels.forEach(label => {
      tags.push(['label', label]);
    });
  }

  // Links
  if (card.links && card.links.length > 0) {
    card.links.forEach(link => {
      tags.push(['r', link.url, link.title || '']);
    });
  }

  // Comments count (informational)
  if (card.comments && card.comments.length > 0) {
    tags.push(['comment-count', String(card.comments.length)]);
  }

  event.tags = tags;
  event.content = card.content || ''; // Markdown description

  return event;
}

/**
 * Konvertiert ein Nostr Event zurück zu CardProps
 * 
 * ⚠️ WICHTIG: Gibt auch Nostr-Metadaten zurück (rank, columnId, boardRef)
 * Diese sind KRITISCH für Echtzeit-Synchronisation!
 */
export function nostrEventToCard(event: NDKEvent): CardProps {
  const tags = event.tags || [];

  // Extract d-tag
  const dTag = tags.find(t => t[0] === 'd');
  const id = dTag ? dTag[1] : event.id || '';

  // Extract title
  const titleTag = tags.find(t => t[0] === 'title');
  const heading = titleTag ? titleTag[1] : 'Untitled';

  // Extract description
  const descTag = tags.find(t => t[0] === 'description');
  const content = descTag ? descTag[1] : event.content || '';

  // Extract state
  const stateTag = tags.find(t => t[0] === 'state');
  const publishState = stateTag ? (stateTag[1] as any) : 'draft';

  // Extract color
  const colorTag = tags.find(t => t[0] === 'color');
  const color = colorTag ? colorTag[1] : undefined;

  // Extract image
  const imageTag = tags.find(t => t[0] === 'image');
  const image = imageTag ? imageTag[1] : undefined;

  // Extract author (primary creator)
  const author = event.pubkey;

  // Extract author display name (NIP-39)
  const nameTag = tags.find(t => t[0] === 'name');
  const authorName = nameTag ? nameTag[1] : undefined;

  // Extract attendees (all p-tags with 'attendee' role, excluding author)
  const pTags = tags.filter(t => t[0] === 'p');
  const attendees = pTags
    .filter(t => t[3] === 'attendee')  // Nur attendee-Role
    .map(t => t[1]);

  // Extract labels
  const labelTags = tags.filter(t => t[0] === 'label');
  const labels = labelTags.map(t => t[1]);

  // Extract links
  const linkTags = tags.filter(t => t[0] === 'r');
  const links = linkTags.map(t => ({
    id: `link-${t[1]}`, // Generate ID
    url: t[1],
    title: t[2] || '',
  }));

  // ⚠️ NEU: Extract Nostr-Metadaten für Synchronisation
  // Board-Referenz (Format: "30301:pubkey:board-id")
  const aTag = tags.find(t => t[0] === 'a');
  const boardRef = aTag ? aTag[1] : undefined;

  // Column-ID (MUSS Column-ID sein, NICHT Name!)
  const sTag = tags.find(t => t[0] === 's');
  const columnId = sTag ? sTag[1] : undefined;
  
  // Column-Name (Fallback für Spalten-Matching wenn ID nicht passt)
  const colLabelTag = tags.find(t => t[0] === 'col_label');
  const columnName = colLabelTag ? colLabelTag[1] : undefined;

  // Position in der Spalte
  const rankTag = tags.find(t => t[0] === 'rank');
  const rank = rankTag ? parseInt(rankTag[1], 10) : undefined;

  return {
    id,
    eventId: event.id, // ← NEU: Actual event ID from Nostr
    heading,
    content,
    color,
    image, // ← NEU: Kartenbild-URL
    authorName, // ← NEU: Display Name
    labels: labels.length > 0 ? labels : undefined,
    links: links.length > 0 ? links : undefined,
    attendees: attendees.length > 0 ? attendees : undefined, // ← NEU: Zugeordnete User
    publishState,
    author,
    // ⚠️ NOSTR-METADATEN: Für Echtzeit-Sync
    boardRef,
    columnId,
    rank,
    // ⚡ v4.3: Extract timestamps from Nostr event for LWW and Merge-System
    createdAt: event.created_at,  // Unix timestamp (number)
    updatedAt: event.created_at 
      ? new Date(event.created_at * 1000).toISOString()  // ISO string for comparison
      : new Date().toISOString(),  // Fallback to NOW if no timestamp
    // @ts-ignore - columnName ist nicht in CardProps, aber wir brauchen es für Fallback-Matching
    columnName,
  };
}

// ============================================================================
// COMMENT EVENT SERIALIZATION (Kind 1)
// ============================================================================

/**
 * Erstellt ein Kommentar-Event (Kind 1 - Text Note)
 *
 * Event Structure:
 * ```
 * {
 *   kind: 1,
 *   tags: [
 *     ["a", "30302:card-author:card-id"],  // Reference to card
 *     ["e", "card-event-id", "", "reply"],  // Reference to event ID
 *     ["p", "card-author"],  // Mention card author
 *   ],
 *   content: "Comment text here",
 * }
 * ```
 */
export function createCommentEvent(
  text: string,
  cardRef: string, // Format: "30302:author-pubkey:card-id"
  cardEventId: string, // Event ID of the card
  ndk: NDK
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.COMMENT;

  const tags: string[][] = [
    ['a', cardRef], // Reference to replaceable card event
  ];

  // If we have the event ID, add reply reference
  if (cardEventId) {
    tags.push(['e', cardEventId, '', 'reply']);
  }

  event.tags = tags;
  event.content = text;

  return event;
}

/**
 * Erstellt einen Deletions-Event (Kind 5 - NIP-09)
 * Wird verwendet um Kommentare oder Cards zu löschen
 * 
 * @param targetIdentifier - Für regular events (Kind 1): die Event-ID
 *                          - Für replaceable events (Kind 30301/30302): "kind:pubkey:d-tag"
 * @param isReplaceableEvent - true für Kind 30301/30302 (nutzt 'a' tags), false für Kind 1 (nutzt 'e' tags)
 * @param reason - Optional: Grund für die Löschung
 * @param ndk - NDK instance
 */
export function createDeletionEvent(
  targetIdentifier: string,
  isReplaceableEvent: boolean = false,
  reason?: string,
  ndk?: NDK,
  eventId?: string  // ← NEU: Optionale tatsächliche Event-ID
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.DELETION;

  // NIP-09: Für replaceable events 'a' tags nutzen, für regular events 'e' tags
  if (isReplaceableEvent) {
    event.tags = [['a', targetIdentifier]];
    
    // ⚠️ NIP-09: 'k' tag für den Kind des zu löschenden Events SOLLTE hinzugefügt werden
    // Format: "30302:pubkey:d-tag" → Kind ist "30302"
    const kind = targetIdentifier.split(':')[0];
    if (kind) {
      event.tags.push(['k', kind]);
    }
    
    // ⚠️ FIX: Manche Relays brauchen AUCH die Event-ID ('e' tag)
    // für replaceable events, um sie zu löschen!
    if (eventId) {
      event.tags.push(['e', eventId]);
    }
  } else {
    event.tags = [['e', targetIdentifier]];
    
    // Für regular events ist der Kind nicht aus der ID extrahierbar
    // (müsste separat übergeben werden)
  }
  
  event.content = reason || 'Event deleted';

  return event;
}

/**
 * Erstellt einen Soft-Lock Event (Kind 20001)
 * Ephemeral event dass anzeigt wer gerade eine Karte bearbeitet
 */
export function createSoftLockEvent(
  cardId: string,
  cardEventId: string,
  ttlSeconds: number = 300, // 5 minutes default
  ndk?: NDK
): NDKEvent {
  const event = new NDKEvent(ndk);
  event.kind = EVENT_KINDS.SOFT_LOCK;

  event.tags = [
    ['d', `lock-${cardId}`],
    ['e', cardEventId],
    ['expiration', String(Math.floor(Date.now() / 1000) + ttlSeconds)],
  ];
  event.content = `Now editing card: ${cardId}`;

  return event;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extrahiert die Board-Referenz aus einem Card-Event
 * Format: "30301:author-pubkey:board-id"
 */
export function extractBoardRef(cardEvent: NDKEvent): string | null {
  const aTag = cardEvent.tags?.find(t => t[0] === 'a');
  return aTag ? aTag[1] : null;
}

/**
 * Extrahiert die Column/Sektion aus einem Card-Event
 */
export function extractColumnName(cardEvent: NDKEvent): string | null {
  const sTag = cardEvent.tags?.find(t => t[0] === 's');
  return sTag ? sTag[1] : null;
}

/**
 * Extrahiert die Rank (Position) aus einem Card-Event
 */
export function extractRank(cardEvent: NDKEvent): number {
  const rankTag = cardEvent.tags?.find(t => t[0] === 'rank');
  return rankTag ? parseInt(rankTag[1], 10) : 0;
}

/**
 * Validiert ob ein Event gültig signiert ist
 */
export function validateEventSignature(event: NDKEvent): boolean {
  if (!event.sig || !event.pubkey) {
    console.warn('Event missing signature or pubkey');
    return false;
  }

  // TODO: Implement proper signature validation
  // For now just check that signature exists
  return true;
}

/**
 * Validiert ob die erforderlichen Tags vorhanden sind
 */
export function validateEventTags(event: NDKEvent, kind: number): boolean {
  const tags = event.tags || [];

  switch (kind) {
    case EVENT_KINDS.BOARD:
      // Must have d-tag and title
      return tags.some(t => t[0] === 'd') && tags.some(t => t[0] === 'title');

    case EVENT_KINDS.CARD:
      // Must have d-tag, a-tag (board ref), and title
      return (
        tags.some(t => t[0] === 'd') &&
        tags.some(t => t[0] === 'a') &&
        tags.some(t => t[0] === 'title')
      );

    case EVENT_KINDS.COMMENT:
      // Must have a-tag or e-tag
      return tags.some(t => t[0] === 'a' || t[0] === 'e');

    default:
      return true;
  }
}

export type { BoardProps, CardProps, ColumnProps };
