/**
 * Content Proposal Handling (Phase 1)
 * Parse und Validierung von LLM-Content-Vorschlägen
 */

import type { ContentProposal } from './types';

/**
 * Parse Content-Vorschlag aus LLM-Response
 * Extrahiert die inhaltliche Antwort und prüft ob Board generiert werden kann
 * 
 * @param llmResponse - Die Antwort vom LLM
 * @returns ContentProposal mit content und canGenerate flag
 */
export async function parseContentProposal(llmResponse: string): Promise<ContentProposal> {
	// Entferne Code-Blöcke
	let cleanContent = llmResponse.replace(/```[\s\S]*?```/g, '');

	// Erkenne Struktur-Patterns
	const hasSpalten = /spalte|column/i.test(cleanContent);
	const hasKarten = /karte|task|card/i.test(cleanContent);
	const hasPhasen = /phase|schritt|step|stunde|hour/i.test(cleanContent);
	const hasMarkdownStructure = /^#{2,3}\s+/m.test(cleanContent); // ## oder ###

	// Kann ein Board generiert werden?
	const canGenerate =
		(hasSpalten && hasKarten) || // Spalten mit Karten
		hasPhasen || // Phasen-basiert
		hasMarkdownStructure; // Hat klare Markdown-Struktur

	let reason = '';
	if (!canGenerate) {
		reason = 'Keine erkennbare Board-Struktur (keine Spalten/Karten/Phasen gefunden)';
	}

	return {
		content: cleanContent.trim(),
		canGenerate,
		reason: reason || undefined
	};
}

/**
 * Generiert User-Prompt für Phase 2 (Structure Generation)
 * 
 * @param content - Der genehmigte Content aus Phase 1
 * @param existingColumns - Bestehende Spalten (falls vorhanden)
 * @returns User-Prompt String für LLM
 */
export function generateStructurePrompt(content: string, existingColumns: string[] = []): string {
	const hasExistingColumns = existingColumns.length > 0;

	let prompt = `Erstelle eine Kanban-Board-Struktur basierend auf folgendem Inhalt:\n\n${content}\n\n`;

	if (hasExistingColumns) {
		prompt += `WICHTIG: Das Board hat bereits folgende Spalten:\n${existingColumns.map((col) => `- ${col}`).join('\n')}\n\n`;
		prompt += `Füge NUR neue Karten zu diesen bestehenden Spalten hinzu. Erstelle KEINE neuen Spalten.\n\n`;
	}

	prompt += `Antworte NUR mit einem validen JSON-Objekt im folgenden Format (ohne Code-Blöcke):\n\n`;
	prompt += JSON.stringify(
		{
			title: 'Board Titel',
			description: 'Optional: Board Beschreibung',
			columns: [
				{
					name: 'Spaltenname',
					cards: [
						{
							heading: 'Karten-Titel',
							content: 'Optional: Karten-Beschreibung',
							labels: ['label1', 'label2']
						}
					]
				}
			]
		},
		null,
		2
	);

	return prompt;
}
