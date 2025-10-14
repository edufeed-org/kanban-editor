// TypeScript-Typdefinitionen für das Kanban-Board

export interface CardItem {
	id: number | string;
	name: string;
}

export interface FolderItem {
	id: number | string;
	name: string;
	items: CardItem[];
}

export type KanbanItem = CardItem | FolderItem;

export interface Column {
	id: string;
	name: string;
	items: KanbanItem[];
}

export interface DnDEvent {
	detail: {
		items: KanbanItem[];
		info: {
			id: number | string;
			trigger: string;
		};
	};
}

// Typ für die Board-Update-Funktion
export type BoardUpdateHandler = (newColumnsData: Column[]) => void;

// Typ für die Column-Drop-Funktion
export type ColumnDropHandler = (newItems: KanbanItem[]) => void;

// Typ für die Folder-Drag-Start-Funktion
export type FolderDragStartHandler = () => void;