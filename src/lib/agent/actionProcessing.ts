/**
 * Action Processing & Board Preview
 * Konvertiert AIActions zu Board-Operationen und erstellt Previews
 */

import type { BoardPreview } from './types';
import type { AIAction } from '$lib/classes/BoardModel';

/**
 * Erstellt eine Preview-Darstellung der geplanten Board-Änderungen
 * 
 * @param actions - Array von AIActions
 * @returns BoardPreview mit Spalten-Zusammenfassung
 */
export function createBoardPreview(actions: AIAction[]): BoardPreview {
	const columns: Map<
		string,
		{
			name: string;
			cardCount: number;
			cards: string[];
		}
	> = new Map();

	// Process actions sequentially
	for (const action of actions) {
		switch (action.type) {
			case 'add_column':
				const colName = action.details?.name;
				if (colName && !columns.has(colName)) {
					columns.set(colName, {
						name: colName,
						cardCount: 0,
						cards: []
					});
				}
				break;

			case 'add_card':
				const targetCol = action.details?.columnName;
				const cardHeading = action.details?.heading;

				if (targetCol && cardHeading) {
					if (!columns.has(targetCol)) {
						// Create column if it doesn't exist
						columns.set(targetCol, {
							name: targetCol,
							cardCount: 0,
							cards: []
						});
					}

					const col = columns.get(targetCol)!;
					col.cardCount++;
					col.cards.push(cardHeading);
				}
				break;
		}
	}

	const columnArray = Array.from(columns.values());
	const totalCards = columnArray.reduce((sum, col) => sum + col.cardCount, 0);

	return {
		columns: columnArray,
		totalCards
	};
}

/**
 * Führt AIActions auf dem Board aus
 * 
 * @param actions - Array von AIActions
 * @param boardStore - Der BoardStore (reactive)
 * @returns Promise<void>
 */
export async function executeActions(actions: AIAction[], boardStore: any): Promise<void> {
	console.log('🎬 Executing', actions.length, 'actions...');

	for (const action of actions) {
		try {
			switch (action.type) {
				case 'add_column':
					await executeAddColumn(action, boardStore);
					break;

				case 'add_card':
					await executeAddCard(action, boardStore);
					break;

				case 'update_card':
					await executeUpdateCard(action, boardStore);
					break;

				case 'move_card':
					await executeMoveCard(action, boardStore);
					break;

				case 'delete_card':
					await executeDeleteCard(action, boardStore);
					break;

				default:
					console.warn('⚠️  Unknown action type:', action.type);
			}
		} catch (err) {
			console.error('❌ Action failed:', action, err);
		}
	}

	console.log('✅ All actions executed');
}

/**
 * Hilfsfunktionen für Action-Ausführung
 */

async function executeAddColumn(action: AIAction, boardStore: any): Promise<void> {
	const { name, color } = action.details || {};
	if (!name) {
		console.warn('⚠️  add_column: missing name');
		return;
	}

	console.log('➕ Adding column:', name);
	boardStore.createColumn(name, color || 'slate');
}

async function executeAddCard(action: AIAction, boardStore: any): Promise<void> {
	const { columnName, heading, content, labels } = action.details || {};

	if (!columnName || !heading) {
		console.warn('⚠️  add_card: missing columnName or heading');
		return;
	}

	console.log('📝 Adding card:', heading, 'to', columnName);

	// Find column by name
	const column = boardStore.board.columns.find((col: any) => col.name === columnName);
	if (!column) {
		console.warn('⚠️  Column not found:', columnName);
		return;
	}

	boardStore.createCard(column.id, heading, content, labels);
}

async function executeUpdateCard(action: AIAction, boardStore: any): Promise<void> {
	const { cardId, updates } = action.details || {};

	if (!cardId || !updates) {
		console.warn('⚠️  update_card: missing cardId or updates');
		return;
	}

	console.log('✏️ Updating card:', cardId);
	boardStore.editCard(cardId, updates);
}

async function executeMoveCard(action: AIAction, boardStore: any): Promise<void> {
	const { cardId, fromColumnId, toColumnId } = action.details || {};

	if (!cardId || !fromColumnId || !toColumnId) {
		console.warn('⚠️  move_card: missing parameters');
		return;
	}

	console.log('🔀 Moving card:', cardId, 'from', fromColumnId, 'to', toColumnId);
	boardStore.moveCard(cardId, fromColumnId, toColumnId);
}

async function executeDeleteCard(action: AIAction, boardStore: any): Promise<void> {
	const { cardId } = action.details || {};

	if (!cardId) {
		console.warn('⚠️  delete_card: missing cardId');
		return;
	}

	console.log('🗑️ Deleting card:', cardId);
	boardStore.deleteCard(cardId);
}
