// src/lib/utils/liascriptExport.ts

import type { Board, Column, Card, Comment } from '$lib/classes/BoardModel';

/**
 * Konvertiert ein Board zu LiaScript Markdown
 */
export function boardToLiaScript(board: Board, includeMetadata: boolean = true): string {
	let markdown = '';

	// LiaScript Frontmatter mit Meta-Informationen
	if (includeMetadata) {
		markdown += `<!--\n`;

		// Autor (deduziert aus board.author oder 'Anonym')
		const author = board.authorName || board.author || 'Anonym';
		markdown += `author: ${author}\n`;

		// Datum (aktuelles Datum beim Export)
		const date = new Date().toLocaleDateString('de-DE');
		markdown += `date: ${date}\n`;

		// Version (immer 1.0.0 für initiale Exporte)
		markdown += `version: 1.0.0\n`;

		// CC-Lizenz (aus board.ccLicense oder Default)
		const license = board.ccLicense || 'CC-BY-4.0';
		markdown += `license: ${license}\n`;

		// Tags (aus board.tags falls vorhanden)
		if (board.tags && board.tags.length > 0) {
			markdown += `tags: ${board.tags.join(', ')}\n`;
		}

		// Zusätzliche technische Metadaten
		markdown += `\n`;
		markdown += `comment: Exportiert aus Kanban-Board\n`;
		markdown += `board-id: ${board.id}\n`;
		markdown += `export-timestamp: ${new Date().toISOString()}\n`;

		markdown += `-->\n\n`;
	}

	// H1: Board-Titel
	markdown += `# ${board.name}\n\n`;

	// Board-Beschreibung (falls vorhanden)
	if (board.description) {
		markdown += `${board.description}\n\n`;
	}

	// Tags (falls vorhanden)
	if (board.tags && board.tags.length > 0) {
		markdown += `**Board-Tags:** ${board.tags.map((t) => `#${t}`).join(' ')}\n\n`;
	}

	// Spalten durchlaufen
	for (const column of board.columns) {
		markdown += columnToLiaScript(column);
	}

	return markdown;
}

/**
 * Konvertiert eine Spalte zu LiaScript Markdown
 */
export function columnToLiaScript(column: Column): string {
	let markdown = '';

	// H2: Spalten-Name
	markdown += `## ${column.name}\n\n`;

	// Karten durchlaufen
	for (const card of column.cards) {
		markdown += cardToLiaScript(card);
	}

	return markdown;
}

/**
 * Konvertiert eine Card zu LiaScript Markdown (H3)
 */
export function cardToLiaScript(card: Card): string {
	let markdown = '';

	// H3: Karten-Überschrift
	markdown += `### ${card.heading}\n\n`;

	// Karten-Inhalt (falls vorhanden)
	if (card.content) {
		markdown += `${card.content}\n\n`;
	}

	// Labels (falls vorhanden)
	if (card.labels && card.labels.length > 0) {
		markdown += `**Tags:** ${card.labels.map((l) => `\`${l}\``).join(', ')}\n\n`;
	}

	// Links (falls vorhanden)
	if (card.links && card.links.length > 0) {
		markdown += `**Links:**\n`;
		for (const link of card.links) {
			markdown += `- [${link.title || link.url}](${link.url})\n`;
		}
		markdown += `\n`;
	}

	// Kommentare (falls vorhanden)
	if (card.comments && card.comments.length > 0) {
		markdown += commentsToLiaScript(card.comments);
	}

	return markdown;
}

/**
 * Konvertiert Kommentare zu LiaScript Markdown
 */
export function commentsToLiaScript(comments: Comment[]): string {
	if (!comments || comments.length === 0) {
		return '';
	}

	let markdown = '';

	markdown += `#### Kommentare\n\n`;

	for (const comment of comments) {
		const commentDate = new Date(comment.createdAt);
		const date = commentDate.toLocaleDateString('de-DE');
		const time = commentDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
		const author = comment.authorName || comment.author || 'Anonym';
		markdown += `- **${author}** (${date}, ${time}): ${comment.text}\n`;
	}

	markdown += `\n`;

	return markdown;
}

/**
 * Erzeugt einen Dateinamen für den LiaScript-Export
 */
export function generateLiaScriptFilename(boardName: string): string {
	// Sanitize board name für Dateinamen
	const sanitized = boardName
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	const date = new Date().toISOString().split('T')[0];
	return `${sanitized}-${date}.md`;
}
