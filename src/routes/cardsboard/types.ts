// TypeScript-Typdefinitionen für das Kanban-Board

export type PublishState = 'draft' | 'published' | 'archived';

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
	image?: string;
	link?: string;
}

export interface Column {
	id: string;
	name: string;
	description?: string;
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