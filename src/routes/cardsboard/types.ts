// TypeScript-Typdefinitionen für das Kanban-Board

export interface CardItem {
	id: number | string;
	name: string;
	description?: string;
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