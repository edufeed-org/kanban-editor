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
