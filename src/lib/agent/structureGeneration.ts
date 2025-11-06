/**
 * Structure Generation (Phase 2)
 * LLM-Response Parsing, Validierung und Konvertierung zu Board Actions
 */

import type { StructureProposal, ValidationResult } from './types';
import type { AIAction } from '$lib/classes/BoardModel';

/**
 * System-Prompt für Phase 2 (Structure Generation)
 * 
 * WICHTIG: Unterstützt jetzt intelligente Integration mit bestehenden Boards
 */
export const STRUCTURE_GENERATION_SYSTEM_PROMPT = `Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.

Deine Aufgabe:
1. Analysiere den Lerninhalt gründlich
2. Prüfe ob bereits Board-Spalten existieren
3. Entscheide intelligent:
   - Bei BESTEHENDEN Spalten: Füge Karten zu passenden Spalten hinzu
   - Bei LEEREM Board: Erstelle logische neue Spalten (z.B. "Einführung", "Vertiefung", "Übung")
   - Bei GEMISCHTEM Fall: Kombiniere geschickt (nutze bestehende + ergänze bei Bedarf)

Spalten-Strategien:
- Status-Boards (Todo/Doing/Done): Karten nach Workflow verteilen
- Themen-Boards (Einführung/Vertiefung/Übung): Karten nach Lern-Phase zuordnen  
- Zeit-Boards (Stunde 1/2/3): Karten chronologisch verteilen

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt (OHNE Markdown Code-Blöcke wie \`\`\`json).

Format:
{
  "title": "Board Titel",
  "description": "Kurze Beschreibung",
  "columns": [
    {
      "name": "Spaltenname (NUTZE BESTEHENDE wenn vorhanden!)",
      "cards": [
        {
          "heading": "Karten-Titel (präzise, min 3 Zeichen)",
          "content": "Detaillierte Beschreibung (optional, aber empfohlen)",
          "labels": ["label1", "label2"]
        }
      ]
    }
  ]
}

KRITISCHE REGELN:
- Keine Code-Blöcke (\`\`\`)
- Nur valides JSON
- Wenn bestehende Spalten genannt sind: NUTZE DIESE (keine neuen erstellen!)
- Jede Spalte hat mindestens 1 Karte
- Jede Karte hat aussagekräftiges "heading"
- Labels helfen bei Kategorisierung (z.B. "video", "übung", "lesen")

Bei bestehenden Spalten:
- Ordne Karten intelligent zu (basierend auf Spalten-Namen)
- Verteile Karten gleichmäßig (keine Spalte leer lassen)
- Respektiere die bestehende Struktur (z.B. nicht "Todo" in "Done" Spalte)`;

/**
 * Analysiert bestehende Board-Struktur und gibt Kontext zurück
 * 
 * @param existingColumns - Array von Spalten-Namen
 * @returns Strukturierter Kontext für LLM
 */
export function analyzeExistingStructure(existingColumns: string[]): {
	hasColumns: boolean;
	columnCount: number;
	strategy: 'create_new' | 'add_to_existing' | 'mixed';
	instructions: string;
} {
	if (!existingColumns || existingColumns.length === 0) {
		return {
			hasColumns: false,
			columnCount: 0,
			strategy: 'create_new',
			instructions: 'Erstelle neue Spalten für die Board-Struktur.'
		};
	}

	// Analysiere bestehende Spalten-Namen für Muster
	const hasPhases = existingColumns.some((col) =>
		/phase|schritt|step|etappe/i.test(col)
	);
	const hasStatus = existingColumns.some((col) =>
		/todo|doing|done|backlog|progress|review/i.test(col)
	);
	const hasTopics = existingColumns.some((col) =>
		/einführung|vertiefung|übung|material|ressource/i.test(col)
	);

	let strategy: 'create_new' | 'add_to_existing' | 'mixed' = 'add_to_existing';
	let instructions = '';

	if (hasPhases || hasStatus) {
		// Status-Board → Füge Karten zu bestehenden Spalten hinzu
		strategy = 'add_to_existing';
		instructions = `WICHTIG: Das Board hat bereits ${existingColumns.length} Spalten (${existingColumns.join(', ')}). 
ERSTELLE KEINE NEUEN SPALTEN! Füge die neuen Karten zu den BESTEHENDEN Spalten hinzu.
Verteile die Karten sinnvoll auf die vorhandenen Spalten basierend auf deren Namen.`;
	} else if (hasTopics && existingColumns.length < 5) {
		// Themen-Board mit wenigen Spalten → Mixed Strategy
		strategy = 'mixed';
		instructions = `Das Board hat bereits ${existingColumns.length} Spalten (${existingColumns.join(', ')}). 
Du kannst:
1. Neue Karten zu bestehenden Spalten hinzufügen, ODER
2. Neue thematische Spalten erstellen, wenn der Inhalt neue Themen abdeckt.
Entscheide intelligent basierend auf dem Lerninhalt.`;
	} else {
		// Viele Spalten oder unklares Muster → Nur Karten hinzufügen
		strategy = 'add_to_existing';
		instructions = `WICHTIG: Das Board hat bereits ${existingColumns.length} Spalten (${existingColumns.join(', ')}). 
ERSTELLE KEINE NEUEN SPALTEN! Füge die neuen Karten zu den BESTEHENDEN Spalten hinzu.`;
	}

	return {
		hasColumns: true,
		columnCount: existingColumns.length,
		strategy,
		instructions
	};
}

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
	// Analysiere bestehende Struktur
	const existingColumns = userContext?.existingColumns || [];
	const structureAnalysis = analyzeExistingStructure(existingColumns);

	// Basis-Prompt
	let prompt = `Analysiere diesen Lerninhalt und generiere eine Kanban-Board-Struktur als valides JSON.\n\n`;

	// Kontext: Bestehende Struktur
	if (structureAnalysis.hasColumns) {
		prompt += `📊 BESTEHENDE BOARD-STRUKTUR:\n`;
		prompt += `Das Board hat bereits ${structureAnalysis.columnCount} Spalten:\n`;
		prompt += existingColumns.map((col, idx) => `${idx + 1}. "${col}"`).join('\n');
		prompt += '\n\n';
		prompt += `🎯 STRATEGIE:\n${structureAnalysis.instructions}\n\n`;
	}

	// Board-Name als Kontext
	if (userContext?.boardName) {
		prompt += `📋 Board Name: "${userContext.boardName}"\n\n`;
	}

	// Hauptinhalt
	prompt += `📚 LERNINHALT:\n${originalContent}\n\n`;

	// JSON-Format
	prompt += `📝 JSON FORMAT (exakt so!):\n`;
	prompt += `{\n`;
	prompt += `  "title": "Board Titel",\n`;
	prompt += `  "description": "Kurze Beschreibung",\n`;
	prompt += `  "columns": [\n`;
	prompt += `    {\n`;
	prompt += `      "name": "Spaltenname"${structureAnalysis.hasColumns ? ' (NUTZE BESTEHENDE!)' : ''},\n`;
	prompt += `      "cards": [\n`;
	prompt += `        {\n`;
	prompt += `          "heading": "Karten-Titel (min 3 Zeichen)",\n`;
	prompt += `          "content": "Detaillierte Beschreibung (optional)",\n`;
	prompt += `          "labels": ["label1", "label2"]\n`;
	prompt += `        }\n`;
	prompt += `      ]\n`;
	prompt += `    }\n`;
	prompt += `  ]\n`;
	prompt += `}\n\n`;

	// Kritische Regeln
	prompt += `⚠️ KRITISCHE REGELN:\n`;
	prompt += `1. Antworte NUR mit JSON (keine Markdown-Blöcke wie \`\`\`json)\n`;
	prompt += `2. Keine Erklärungen vor oder nach dem JSON\n`;
	prompt += `3. Jede Spalte braucht mindestens 1 Karte\n`;
	prompt += `4. Jede Karte braucht ein "heading" (min 3 Zeichen)\n`;

	if (structureAnalysis.strategy === 'add_to_existing') {
		prompt += `5. ⚠️ ERSTELLE KEINE NEUEN SPALTEN - nutze nur: ${existingColumns.join(', ')}\n`;
	}

	return prompt;
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
 * Validiert, dass generierte Spalten mit bestehenden übereinstimmen (falls gefordert)
 * 
 * @param generatedColumns - Generierte Spalten vom LLM
 * @param existingColumns - Bestehende Spalten auf dem Board
 * @param strategy - Erwartete Strategie
 * @returns ValidationResult mit Hinweisen auf Probleme
 */
export function validateColumnAlignment(
	generatedColumns: Array<{ name: string }>,
	existingColumns: string[],
	strategy: 'create_new' | 'add_to_existing' | 'mixed'
): ValidationResult {
	// Keine bestehenden Spalten → alles OK
	if (!existingColumns || existingColumns.length === 0) {
		return { valid: true };
	}

	const generatedNames = generatedColumns.map((c) => c.name.toLowerCase().trim());
	const existingNames = existingColumns.map((c) => c.toLowerCase().trim());

	// Bei "add_to_existing": Alle generierten Spalten MÜSSEN in existingColumns sein
	if (strategy === 'add_to_existing') {
		const invalidColumns = generatedNames.filter((name) => !existingNames.includes(name));

		if (invalidColumns.length > 0) {
			return {
				valid: false,
				error: `WARNUNG: LLM hat neue Spalten erstellt, obwohl nur bestehende genutzt werden sollten:\n` +
					`Neue Spalten: ${invalidColumns.join(', ')}\n` +
					`Erwartete Spalten: ${existingColumns.join(', ')}\n\n` +
					`Die Karten werden trotzdem hinzugefügt, aber in neuen Spalten.`
			};
		}
	}

	// Bei "mixed": OK wenn mindestens 1 bestehende Spalte genutzt wird
	if (strategy === 'mixed') {
		const usedExisting = generatedNames.filter((name) => existingNames.includes(name));

		if (usedExisting.length === 0 && generatedNames.length > 0) {
			return {
				valid: true, // Nicht blockieren, aber warnen
				error: `HINWEIS: LLM hat keine der bestehenden Spalten genutzt (${existingColumns.join(', ')}).\n` +
					`Dies ist bei 'mixed' Strategie OK, aber möglicherweise suboptimal.`
			};
		}
	}

	return { valid: true };
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
