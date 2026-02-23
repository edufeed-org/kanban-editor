/**
 * Unit Tests für LiaScript Export Utilities
 */

import { describe, it, expect } from 'vitest';
import {
	boardToLiaScript,
	columnToLiaScript,
	cardToLiaScript,
	commentsToLiaScript,
	generateLiaScriptFilename,
	stripTeaserSeparator
} from './liascriptExport';
import { Board, Column, Card } from '$lib/classes/BoardModel';
import type { Comment } from '$lib/classes/BoardModel';

describe('liascriptExport', () => {
	describe('stripTeaserSeparator', () => {
		it('sollte Text ohne +++ unverändert zurückgeben', () => {
			expect(stripTeaserSeparator('Vollständiger Text')).toBe('Vollständiger Text');
		});

		it('sollte +++ entfernen und beide Teile zusammenführen', () => {
			const result = stripTeaserSeparator('Teaser-Text\n+++\nVollständiger Rest');
			expect(result).toContain('Teaser-Text');
			expect(result).toContain('Vollständiger Rest');
			expect(result).not.toContain('+++');
		});

		it('sollte +++ am Anfang entfernen und nur den Rest zurückgeben', () => {
			const result = stripTeaserSeparator('+++\nNur dieser Teil');
			expect(result).toBe('Nur dieser Teil');
			expect(result).not.toContain('+++');
		});

		it('sollte +++ am Ende entfernen und nur den Anfang zurückgeben', () => {
			const result = stripTeaserSeparator('Nur dieser Teil\n+++');
			expect(result).toBe('Nur dieser Teil');
			expect(result).not.toContain('+++');
		});

		it('sollte bei leerem String leeren String zurückgeben', () => {
			expect(stripTeaserSeparator('')).toBe('');
		});
	});

	describe('generateLiaScriptFilename', () => {
		it('sollte Board-Name in lowercase konvertieren und Sonderzeichen ersetzen', () => {
			const filename = generateLiaScriptFilename('Mein Test Board!');
			expect(filename).toMatch(/^mein-test-board-\d{4}-\d{2}-\d{2}\.md$/);
		});

		it('sollte ISO-Datum im Format YYYY-MM-DD hinzufügen', () => {
			const filename = generateLiaScriptFilename('Test');
			const today = new Date().toISOString().split('T')[0];
			expect(filename).toContain(today);
		});

		it('sollte Umlaute und Sonderzeichen korrekt behandeln', () => {
			const filename = generateLiaScriptFilename('Überprüfung & Test / Ä Ö Ü');
			expect(filename).toMatch(/^ueberpruefung-test-ae-oe-ue-\d{4}-\d{2}-\d{2}\.md$/);
		});

		it('sollte mehrere Leerzeichen zu einem Bindestrich konsolidieren', () => {
			const filename = generateLiaScriptFilename('Test    Board    Name');
			expect(filename).toMatch(/^test-board-name-\d{4}-\d{2}-\d{2}\.md$/);
		});
	});

	describe('commentsToLiaScript', () => {
		it('sollte leeres Array zu leerem String konvertieren', () => {
			const result = commentsToLiaScript([]);
			expect(result).toBe('');
		});

		it('sollte Kommentare als H4-Liste formatieren', () => {
			const comments: Comment[] = [
				{
					id: 'c1',
					text: 'Erster Kommentar',
					author: 'Alice',
					authorName: 'Alice',
					createdAt: '2025-01-15T10:00:00Z'
				},
				{
					id: 'c2',
					text: 'Zweiter Kommentar',
					author: 'Bob',
					authorName: 'Bob',
					createdAt: '2025-01-15T11:00:00Z'
				}
			];

		const result = commentsToLiaScript(comments);

		expect(result).toContain('#### Kommentare');
		expect(result).toMatch(/\*\*Alice\*\* \(15\.0?1\.2025, \d{1,2}:\d{2}\): Erster Kommentar/); // Flexible Zeit-Formatierung
		expect(result).toMatch(/\*\*Bob\*\* \(15\.0?1\.2025, \d{1,2}:\d{2}\): Zweiter Kommentar/);
	});		it('sollte authorName verwenden wenn vorhanden, sonst author', () => {
			const comments: Comment[] = [
				{
					id: 'c1',
					text: 'Test',
					author: 'npub123',
					authorName: 'Alice Display',
					createdAt: '2025-01-15T10:00:00Z'
				},
				{
					id: 'c2',
					text: 'Test2',
					author: 'npub456',
					createdAt: '2025-01-15T11:00:00Z'
				}
			];

			const result = commentsToLiaScript(comments);

			expect(result).toContain('**Alice Display**');
			expect(result).toContain('**npub456**');
		});
	});

	describe('cardToLiaScript', () => {
		it('sollte Card als H3 mit Heading formatieren', () => {
			const card = new Card({
				heading: 'Test Karte',
				content: 'Inhalt der Karte'
			});

			const result = cardToLiaScript(card);

			expect(result).toContain('### Test Karte');
			expect(result).toContain('Inhalt der Karte');
		});

		it('sollte Labels als Tags formatieren', () => {
			const card = new Card({
				heading: 'Test',
				labels: ['wichtig', 'dringend', 'meeting']
			});

			const result = cardToLiaScript(card);

			expect(result).toContain('**Tags:** `wichtig`, `dringend`, `meeting`');
		});

		it('sollte Links formatieren', () => {
			const card = new Card({
				heading: 'Test',
				links: [
					{ id: 'l1', url: 'https://example.com', title: 'Beispiel' },
					{ id: 'l2', url: 'https://docs.com', title: 'Dokumentation' }
				]
			});

			const result = cardToLiaScript(card);

			expect(result).toContain('**Links:**');
			expect(result).toContain('[Beispiel](https://example.com)');
			expect(result).toContain('[Dokumentation](https://docs.com)');
		});

		it('sollte Kommentare integrieren', () => {
			const card = new Card({
				heading: 'Test',
				comments: [
					{
						id: 'c1',
						text: 'Ein Kommentar',
						author: 'Alice',
						authorName: 'Alice',
						createdAt: '2025-01-15T10:00:00Z'
					}
				]
			});

			const result = cardToLiaScript(card);

			expect(result).toContain('#### Kommentare');
			expect(result).toContain('**Alice**');
			expect(result).toContain('Ein Kommentar');
		});

		it('sollte Karte ohne Content nur mit Heading formatieren', () => {
			const card = new Card({
				heading: 'Nur Titel'
			});

			const result = cardToLiaScript(card);

			expect(result).toContain('### Nur Titel');
			expect(result).not.toContain('undefined');
			expect(result.trim().split('\n').length).toBe(1); // Nur die H3-Zeile
		});
	});

	describe('columnToLiaScript', () => {
		it('sollte Column als H2 mit allen Cards formatieren', () => {
			const column = new Column({
				name: 'Todo',
				cards: [
					{ heading: 'Aufgabe 1', content: 'Beschreibung 1' },
					{ heading: 'Aufgabe 2', content: 'Beschreibung 2' }
				]
			});

			const result = columnToLiaScript(column);

			expect(result).toContain('## Todo');
			expect(result).toContain('### Aufgabe 1');
			expect(result).toContain('### Aufgabe 2');
			expect(result).toContain('Beschreibung 1');
			expect(result).toContain('Beschreibung 2');
		});

		it('sollte leere Column nur mit Header formatieren', () => {
			const column = new Column({
				name: 'Leere Spalte'
			});

			const result = columnToLiaScript(column);

			expect(result).toBe('## Leere Spalte\n\n');
		});
	});

	describe('boardToLiaScript', () => {
		it('sollte Board als H1 mit Metadaten formatieren', () => {
			const board = new Board({
				name: 'Test Board',
				description: 'Eine Testbeschreibung',
				author: 'npub123',
				authorName: 'Alice',
				ccLicense: 'CC-BY-4.0',
				tags: ['bildung', 'test']
			});

			const result = boardToLiaScript(board, true);

			expect(result).toContain('<!--');
			expect(result).toContain('author: Alice');
			expect(result).toContain('license: CC-BY-4.0');
			expect(result).toContain('tags: bildung, test');
			expect(result).toContain('version: 1.0.0');
			expect(result).toContain('# Test Board');
			expect(result).toContain('Eine Testbeschreibung');
		});

		it('sollte ohne Metadaten nur Inhalt formatieren', () => {
			const board = new Board({
				name: 'Simple Board',
				columns: [
					{
						name: 'Column 1',
						cards: [{ heading: 'Card 1' }]
					}
				]
			});

			const result = boardToLiaScript(board, false);

			expect(result).not.toContain('<!--');
			expect(result).not.toContain('author:');
			expect(result).toContain('# Simple Board');
			expect(result).toContain('## Column 1');
			expect(result).toContain('### Card 1');
		});

		it('sollte Standardwerte für fehlende Metadaten verwenden', () => {
			const board = new Board({
				name: 'Board ohne Metadaten'
			});

			const result = boardToLiaScript(board, true);

		expect(result).toContain('author: Anonym');
		expect(result).toContain('license: cc-by-4.0'); // lowercase wie tatsächlich gespeichert
		expect(result).toContain('version: 1.0.0');
		});

		it('sollte authorName vor author bevorzugen', () => {
			const board = new Board({
				name: 'Test',
				author: 'npub123abc',
				authorName: 'Alice Display Name'
			});

			const result = boardToLiaScript(board, true);

			expect(result).toContain('author: Alice Display Name');
			expect(result).not.toContain('npub123abc');
		});

		it('sollte vollständiges Board korrekt strukturieren', () => {
			const board = new Board({
				name: 'Projektverwaltung',
				description: 'Agiles Projektmanagement Board',
				author: 'npub123',
				authorName: 'Project Manager',
				ccLicense: 'CC-BY-NC-4.0',
				tags: ['projekt', 'agile', 'scrum'],
				columns: [
					{
						name: 'Backlog',
						cards: [
							{
								heading: 'Feature A implementieren',
								content: 'Beschreibung von Feature A',
								labels: ['feature', 'high-priority'],
								links: [{ id: 'l1', url: 'https://jira.example.com/PROJ-123', title: 'Ticket' }]
							}
						]
					},
					{
						name: 'In Progress',
						cards: [
							{
								heading: 'Bug Fix B',
								content: 'Fehler im Login beheben',
								labels: ['bug', 'critical'],
								comments: [
									{
										id: 'c1',
										text: 'Ursache identifiziert',
										author: 'Dev1',
										authorName: 'Developer 1',
										createdAt: '2025-01-15T09:00:00Z'
									}
								]
							}
						]
					},
					{
						name: 'Done'
					}
				]
			});

			const result = boardToLiaScript(board, true);

			// Metadaten prüfen
			expect(result).toContain('author: Project Manager');
			expect(result).toContain('license: CC-BY-NC-4.0');
			expect(result).toContain('tags: projekt, agile, scrum');

			// Struktur prüfen
			expect(result).toContain('# Projektverwaltung');
			expect(result).toContain('Agiles Projektmanagement Board');
			expect(result).toContain('## Backlog');
			expect(result).toContain('## In Progress');
			expect(result).toContain('## Done');

			// Cards prüfen
			expect(result).toContain('### Feature A implementieren');
			expect(result).toContain('**Tags:** `feature`, `high-priority`');
			expect(result).toContain('[Ticket](https://jira.example.com/PROJ-123)');
			expect(result).toContain('### Bug Fix B');
			expect(result).toContain('#### Kommentare');
			expect(result).toContain('**Developer 1**');
			expect(result).toContain('Ursache identifiziert');

			// Hierarchie validieren (H1 > H2 > H3 > H4)
			const lines = result.split('\n');
			let hasH1 = false;
			let hasH2 = false;
			let hasH3 = false;
			let hasH4 = false;

			for (const line of lines) {
				if (line.startsWith('# ') && !line.startsWith('## ')) hasH1 = true;
				if (line.startsWith('## ') && !line.startsWith('### ')) hasH2 = true;
				if (line.startsWith('### ') && !line.startsWith('#### ')) hasH3 = true;
				if (line.startsWith('#### ')) hasH4 = true;
			}

			expect(hasH1).toBe(true);
			expect(hasH2).toBe(true);
			expect(hasH3).toBe(true);
			expect(hasH4).toBe(true);
		});

		it('sollte korrekte Datum-Formatierung in Metadaten haben', () => {
			const board = new Board({
				name: 'Test',
				authorName: 'Alice'
			});

			const result = boardToLiaScript(board, true);
			const today = new Date().toLocaleDateString('de-DE');

			expect(result).toContain(`date: ${today}`);
		});

		it('sollte board-id und export-timestamp in Metadaten enthalten', () => {
			const board = new Board({
				id: 'board-123',
				name: 'Test'
			});

			const result = boardToLiaScript(board, true);

			expect(result).toContain('board-id: board-123');
			expect(result).toContain('export-timestamp:');
		});
	});
});
