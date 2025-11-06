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
 * Generiert User-Prompt für Phase 2 (Structure Generation)
 * 
 * WICHTIG: Gibt NUR den User-Prompt zurück!
 * System-Prompt wird separat übergeben (STRUCTURE_GENERATION_SYSTEM_PROMPT)
 * 
 * @param originalContent - Der genehmigte Content aus Phase 1
 * @param userContext - Optionaler Kontext (boardName, existingColumns)
 * @returns User-Prompt String für LLM
 */
export function generateStructurePrompt(
	originalContent: string,
	userContext?: { boardName?: string; existingColumns?: string[] }
): string {
	const userPrompt = `Analysiere diesen Lerninhalt und generiere AUSSCHLIESSLICH eine Kanban-Board-Struktur als valides JSON.

Deine Antwort MUSS nur JSON sein - kein Text davor, kein Text danach, keine Markdown-Code-Blöcke!

JSON Format MUSS exakt dieses Schema erfüllen:
{
  "title": "Board Titel",
  "description": "Optional: Board Beschreibung",
  "columns": [
    {
      "name": "Spaltenname",
      "cards": [
        {
          "heading": "Kartentitel",
          "content": "Optionale detaillierte Beschreibung",
          "labels": ["tag1", "tag2"]
        }
      ]
    }
  ]
}

Lerninhalt zum Strukturieren:
${originalContent}

${userContext?.boardName ? `\nBoard Name: ${userContext.boardName}` : ''}
${userContext?.existingColumns ? `\nExistierenden Spalten beachten: ${userContext.existingColumns.join(', ')}` : ''}

WICHTIG: Antworte NUR mit validem JSON! Keine Erklärungen, keine Markdown!`;

	return userPrompt;
}

/**
 * Validiert JSON-Response von LLM (mit Auto-Extraktion)
 * 
 * Versucht automatisch JSON aus verschiedenen Formaten zu extrahieren:
 * - Pure JSON
 * - JSON in Markdown Code-Blöcken (```json ... ```)
 * - JSON eingebettet in Text
 * 
 * @param jsonString - JSON String vom LLM (möglicherweise mit Markdown)
 * @returns ValidationResult mit valid flag und optional error/data
 */
export function validateStructureJSON(jsonString: string): ValidationResult {
	try {
		// Step 1: Trim whitespace
		let json = jsonString.trim();

		// Step 2: Check if empty
		if (!json || json.length === 0) {
			return { valid: false, error: 'Empty response from LLM' };
		}

		// Step 3: Try to extract from markdown code blocks
		const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
		if (codeBlockMatch) {
			json = codeBlockMatch[1].trim();
		}

		// Step 4: Try to find JSON object if wrapped in text (Last resort)
		if (!json.startsWith('{')) {
			const objectMatch = json.match(/\{[\s\S]*\}/);
			if (!objectMatch) {
				return {
					valid: false,
					error: `Response does not contain JSON object. Starts with: "${json.substring(0, 50)}"`
				};
			}
			json = objectMatch[0];
		}

		// Step 5: Parse JSON
		let parsed;
		try {
			parsed = JSON.parse(json);
		} catch (parseErr) {
			const msg = parseErr instanceof SyntaxError ? parseErr.message : 'JSON parse error';
			return { valid: false, error: `Invalid JSON: ${msg}` };
		}

		// Step 6: Validate required structure
		if (!parsed.columns || !Array.isArray(parsed.columns)) {
			return { valid: false, error: 'Missing or invalid "columns" array' };
		}

		if (parsed.columns.length === 0) {
			return { valid: false, error: 'Columns array is empty (need at least 1 column)' };
		}

		// Step 7: Validate each column and card
		for (let i = 0; i < parsed.columns.length; i++) {
			const col = parsed.columns[i];

			if (!col.name || typeof col.name !== 'string') {
				return { valid: false, error: `Column ${i} missing or invalid "name"` };
			}

			if (!Array.isArray(col.cards)) {
				return { valid: false, error: `Column "${col.name}" missing or invalid "cards" array` };
			}

			if (col.cards.length === 0) {
				return { valid: false, error: `Column "${col.name}" has no cards (need at least 1)` };
			}

			for (let j = 0; j < col.cards.length; j++) {
				const card = col.cards[j];

				if (!card.heading || typeof card.heading !== 'string') {
					return {
						valid: false,
						error: `Column "${col.name}" Card ${j} missing or invalid "heading"`
					};
				}

				if (card.heading.length < 3) {
					return {
						valid: false,
						error: `Column "${col.name}" Card ${j} heading too short (min 3 chars)`
					};
				}
			}
		}

		// All validations passed!
		return { valid: true, data: parsed };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : 'Unexpected error';
		return { valid: false, error: `Validation error: ${errorMsg}` };
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
