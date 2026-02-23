// src/lib/utils/liascriptExport.ts

import type { Board, Column, Card, Comment } from '$lib/classes/BoardModel';
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import { nip19 } from '@nostr-dev-kit/ndk';

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
 * Entfernt das +++ Teaser-Trennzeichen aus dem Inhalt für den Export.
 * Der vollständige Text (vor und nach +++) wird zusammengeführt.
 */
export function stripTeaserSeparator(content: string): string {
	const separatorIndex = content.indexOf('+++');
	if (separatorIndex === -1) return content;

	const before = content.substring(0, separatorIndex).trimEnd();
	const after = content.substring(separatorIndex + 3).trimStart();

	if (!before) return after;
	if (!after) return before;
	return `${before}\n\n${after}`;
}

/**
 * Konvertiert eine Card zu LiaScript Markdown (H3)
 */
export function cardToLiaScript(card: Card): string {
	let markdown = '';

	// H3: Karten-Überschrift
	markdown += `### ${card.heading}\n\n`;

	// Karten-Inhalt (falls vorhanden) — +++ Teaser-Trennzeichen entfernen
	if (card.content) {
		markdown += `${stripTeaserSeparator(card.content)}\n\n`;
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

/**
 * Publiziert ein Board als LiaScript-Nostr-Event und gibt einen LiaScript Viewer Link zurück
 * 
 * 📝 FORMAT: Publiziert das Board als Long-form Content (Kind 30023) mit LiaScript-Markdown
 * 🔓 ÖFFENTLICH: Wird immer zu öffentlichen Relays publiziert (unabhängig vom Board publishState)
 * 
 * Optional: Kann das normale Board-Event (Kind 30301) vorher publizieren, falls gewünscht
 * 
 * @param board - Das zu publizierende Board
 * @param boardStore - BoardStore Instanz
 * @returns LiaScript Viewer Link oder null bei Fehler
 */
export async function publishBoardAsLiaScriptToNostr(
	board: Board,
	boardStore: any
): Promise<string | null> {
	try {
		// 1. NDK instanz holen
		const ndk = boardStore.nostrIntegration?.getNDK();
		if (!ndk) {
			console.error('❌ NDK nicht verfügbar');
			return null;
		}

		// 2. Optional: Normales Board-Event publizieren (falls noch nicht geschehen)
		if (!board.eventId && board.publishState !== 'published') {
			console.log('📤 Publiziere zuerst normales Board-Event...');
			boardStore.setPublishState('published');
			await boardStore.publishBoardAndGetEventId();
		}

		// 3. LiaScript-Markdown generieren
		console.log('📝 Generiere LiaScript-Markdown...');
		const markdown = boardToLiaScript(board, true);

		// 4. LiaScript-Event erstellen (Kind 30023: Long-form Content)
		console.log('📤 Erstelle LiaScript-Event...');
		const { NDKEvent } = await import('@nostr-dev-kit/ndk');
		const event = new NDKEvent(ndk);
		
		event.kind = 30023; // Long-form Content (NIP-23)
		event.content = markdown; // LiaScript-Markdown als Content
		

		// Tags für LiaScript-Event
		event.tags = [
			['d', `liascript-${board.id}`], // Eindeutige ID für replaceability
			['title', board.name || 'Kanban Board'],
			['published_at', Math.floor(Date.now() / 1000).toString()],
			['t', 'liascript'], // Tag für LiaScript-Content
		];

		// Optional: Board-Tags hinzufügen
		if (board.tags && board.tags.length > 0) {
			for (const tag of board.tags) {
				event.tags.push(['t', tag]);
			}
		}

		// Optional: Lizenz-Tag
		if (board.ccLicense) {
			event.tags.push(['license', board.ccLicense]);
		}

		// Optional: Referenz zum Original-Board-Event
		if (board.eventId) {
			event.tags.push(['e', board.eventId, '', 'root']); // Referenz zum Board-Event
		}

		// 5. Event zu öffentlichen Relays publizieren
		console.log('📤 Publiziere LiaScript-Event zu öffentlichen Relays...');
		const relays = [...settingsStore.settings.relaysPublic];
		
		if (relays.length === 0) {
			console.error('❌ Keine öffentlichen Relays konfiguriert');
			return null;
		}

		// Event signieren und publizieren
		const publishedRelays = await event.publish();
		
		if (!publishedRelays || publishedRelays.size === 0) {
			console.error('❌ Event konnte nicht publiziert werden');
			return null;
		}

		console.log(`✅ LiaScript-Event publiziert zu ${publishedRelays.size} Relay(s)`);
		console.log('📝 Event-ID:', event.id);

		// 6. LiaScript Viewer Link generieren
		const link = generateLiaScriptViewerLink(event.id!);
		return link;

	} catch (error) {
		console.error('❌ LiaScript Nostr Publishing fehlgeschlagen:', error);
		return null;
	}
}

/**
 * Generiert LiaScript Viewer Link aus Event-ID
 * 
 * @param eventId - Nostr Event-ID (hex format)
 * @returns LiaScript Viewer URL mit nevent encoding
 */
export function generateLiaScriptViewerLink(eventId: string): string {
	// Encode Event-ID als nevent (NIP-19)
	const relays = [
		...settingsStore.settings.relaysPublic,
		...settingsStore.settings.relaysPrivate
	];

	const nevent = nip19.neventEncode({
		id: eventId,
		relays: relays.slice(0, 3) // Max 3 Relays für kürzere Encodierung
	});

	return `https://liascript.github.io/course/?nostr:${nevent}`;
}
