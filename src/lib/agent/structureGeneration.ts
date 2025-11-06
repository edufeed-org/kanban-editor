/**
 * Structure Generation (Phase 2)
 * LLM-Response Parsing, Validierung und Konvertierung zu Board Actions
 */

import type { StructureProposal, ValidationResult } from './types';
import type { AIAction } from '$lib/classes/BoardModel';

/**
 * System-Prompt für Phase 2 (Structure Generation)
 */
export const STRUCTURE_GENERATION_SYSTEM_PROMPT = `Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.

Deine Aufgabe:
1. Analysiere den Lerninhalt
2. Strukturiere ihn in logische Spalten (z.B. "Einführung", "Vertiefung", "Übung", "Reflexion")
3. Erstelle konkrete Karten mit Aufgaben/Materialien pro Spalte

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (OHNE Markdown Code-Blöcke wie \`\`\`json).

Format:
{
  "title": "Board Titel",
  "description": "Kurze Beschreibung",
  "columns": [
    {
      "name": "Spaltenname",
      "cards": [
        {
          "heading": "Karten-Titel",
          "content": "Karten-Beschreibung (optional)",
          "labels": ["label1", "label2"]
        }
      ]
    }
  ]
}

WICHTIG:
- Keine Code-Blöcke (\`\`\`)
- Nur valides JSON
- Mindestens 2 Spalten
- Jede Spalte hat mindestens 1 Karte`;

/**
 * Validiert JSON-Response von LLM
 * 
 * @param jsonString - JSON String vom LLM
 * @returns ValidationResult mit valid flag und optional error/data
 */
export function validateStructureJSON(jsonString: string): ValidationResult {
	try {
		const data = JSON.parse(jsonString);

		// Required fields
		if (!data.title || typeof data.title !== 'string') {
			return { valid: false, error: 'Fehlendes Feld: title' };
		}

		if (!data.columns || !Array.isArray(data.columns)) {
			return { valid: false, error: 'Fehlendes Feld: columns (muss Array sein)' };
		}

		if (data.columns.length < 1) {
			return { valid: false, error: 'Mindestens 1 Spalte erforderlich' };
		}

		// Validate columns
		for (const col of data.columns) {
			if (!col.name || typeof col.name !== 'string') {
				return { valid: false, error: 'Spalte fehlt "name" Feld' };
			}

			if (!col.cards || !Array.isArray(col.cards)) {
				return { valid: false, error: `Spalte "${col.name}" fehlt "cards" Array` };
			}

			// Validate cards
			for (const card of col.cards) {
				if (!card.heading || typeof card.heading !== 'string') {
					return { valid: false, error: `Karte in "${col.name}" fehlt "heading"` };
				}
			}
		}

		return { valid: true, data };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'JSON Parse Error';
		return { valid: false, error: errorMsg };
	}
}

/**
 * Parse Structure Proposal aus validiertem JSON
 * 
 * @param jsonData - Validiertes JSON-Objekt
 * @returns StructureProposal
 */
export function parseStructureProposal(jsonData: any): StructureProposal {
	return {
		title: jsonData.title,
		description: jsonData.description,
		columns: jsonData.columns.map((col: any) => ({
			name: col.name,
			cards: col.cards.map((card: any) => ({
				heading: card.heading,
				content: card.content,
				labels: card.labels || []
			}))
		}))
	};
}

/**
 * Konvertiert StructureProposal zu AIActions
 * 
 * @param proposal - Das geparste Structure Proposal
 * @returns Array von AIActions
 */
export function structureToActions(proposal: StructureProposal): AIAction[] {
	const actions: AIAction[] = [];

	// Create columns
	for (const column of proposal.columns) {
		actions.push({
			type: 'add_column',
			details: {
				name: column.name,
				color: 'slate' // Default color
			}
		});

		// Create cards in column
		for (const card of column.cards) {
			actions.push({
				type: 'add_card',
				details: {
					columnName: column.name,
					heading: card.heading,
					content: card.content || '',
					labels: card.labels || []
				}
			});
		}
	}

	return actions;
}
