// TypeScript-Typdefinitionen für das Kanban-Board

export type PublishState = 'draft' | 'published';

// ============================================================================
// SNAPSHOT TYPES (Phase 1.5 - Board Versioning)
// ============================================================================

/**
 * Snapshot Reason - Warum wurde der Snapshot erstellt?
 */
export type SnapshotReason = 'manual' | 'auto_save' | 'before_import' | 'before_restore';

/**
 * Board Snapshot - Eine gespeicherte Version eines Boards
 * 
 * Wird als Kind 30303 Nostr Event gespeichert (non-replaceable)
 */
export interface BoardSnapshot {
	/** Unique identifier (Nostr event ID) */
	id: string;
	/** User-provided label/description */
	label: string;
	/** When the snapshot was created (Unix timestamp) */
	timestamp: number;
	/** Why this snapshot was created */
	reason: SnapshotReason;
	/** The complete board data at time of snapshot */
	boardData: BoardSnapshotData;
	/** Nostr pubkey of snapshot creator */
	createdBy?: string;
	/** Number of cards in this snapshot */
	cardCount: number;
	/** Number of columns in this snapshot */
	columnCount: number;
}

/**
 * Serialized board data stored in snapshot content
 */
export interface BoardSnapshotData {
	id: string;
	name: string;
	description?: string;
	columns: SnapshotColumn[];
	publishState?: PublishState;
	author?: string;
	maintainers?: string[];
	tags?: string[];
	ccLicense?: string;
}

/**
 * Column data within a snapshot
 */
export interface SnapshotColumn {
	id: string;
	name: string;
	color?: string;
	cards: SnapshotCard[];
}

/**
 * Card data within a snapshot
 */
export interface SnapshotCard {
	id: string;
	heading: string;
	content?: string;
	color?: string;
	labels?: string[];
	comments?: Comment[];
	author?: string;
	image?: string;
	link?: string;
	publishState?: PublishState;
}

// ============================================================================
// EXISTING TYPES
// ============================================================================

export interface Comment {
	id: string;
	text: string;
	author: string;
	createdAt: string;
}

export interface CardItem {
	id: number | string;
	name: string;
	description?: string;
	comments?: Comment[];
	attendees?: string[];
	labels?: string[];
	color?: string;
	publishState?: PublishState;
	author?: string;
	authorName?: string; // Display name (readable), author = pubkey (Nostr)
	image?: string;
	link?: string;
	// Metadaten für Nachverfolgung der Kartenhierarchie
	columnId?: string; // ID der Spalte, zu der diese Karte gehört
	boardId?: string; // ID des Boards, zu dem diese Karte gehört
}

export interface Column {
	id: string;
	name: string;
	description?: string;
	color?: string;
	items: CardItem[];
}

export interface DnDEvent {
	detail: {
		items: CardItem[];
		info: {
			id: number | string;
			trigger: string;
		};
	};
}

// Typ für die Board-Update-Funktion
export type BoardUpdateHandler = (newColumnsData: Column[]) => void;

// Typ für die Column-Drop-Funktion
export type ColumnDropHandler = (newItems: CardItem[]) => void;