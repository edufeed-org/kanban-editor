/**
 * demoBoardLoader.ts
 * 
 * Einfacher Loader für Demo-Daten aus data.ts
 * Kann direkt in der Browser-Console aufgerufen werden mit:
 * 
 *   window.add_democontent()
 * 
 * Beispielinhalte werden über Board.addColumn(), Column.addCard() und Card.addComment() 
 * ins aktive Board eingefügt
 */

import { boardStore } from '../stores/kanbanStore.svelte.js';

// Demo-Daten (Subset aus data.ts)
const DEMO_DATA = [
	{
		columnName: 'TODO — Aufgaben',
		description: 'Aufgaben, die noch erledigt werden müssen',
		color: 'chart-1',
		cards: [
			{
				heading: 'Definiere Klassenstruktur für Kanban-System',
				content: 'Erstelle TypeScript-Klassen für Card, Column, Board mit sauberer Serialisierung für KI-Kontexte.',
				comments: [
					{ text: 'Das ist ein Kommentar zu dieser Aufgabe', author: 'Max Mustermann' },
					{ text: 'Priorität: Hoch', author: 'Anna Schmidt' }
				],
				labels: ['Architecture', 'Milestone 2'],
				color: 'chart-4'
			},
			{
				heading: 'Svelte Stores und Runes: Zustand aufsetzen',
				content: 'Implementiere $state-basierte Stores für Board und Chat; LocalStorage-Persistenz.',
				labels: ['State-Management'],
				color: 'chart-3'
			},
			{
				heading: 'Erarbeite Drag-and-Drop-Strategie',
				content: 'Konzeption für DnD sowie Verschiebungen zwischen Spalten und Event-Publishing für Nostr.',
				labels: ['UI', 'DnD'],
				color: 'chart-1'
			}
		]
	},
	{
		columnName: 'IN PROGRESS — Aktive Arbeiten',
		description: 'Aufgaben, die gerade bearbeitet werden',
		color: 'chart-2',
		cards: [
			{
				heading: 'Implementiere Card-Komponenten mit Modal-Dialogen',
				content: 'UI-Komponenten bauen, Events anbinden, Accessibility beachten',
				comments: [
					{ text: 'Brauche Feedback zur Modal-Interaktion', author: 'Anna Schmidt' }
				],
				labels: ['Feature', 'UI'],
				color: 'chart-1'
			},
			{
				heading: 'Performance-Optimierung beim Rendering',
				content: 'Analyse und Implementierung möglicher Performance-Verbesserungen',
				labels: ['Performance'],
				color: 'chart-2'
			}
		]
	},
	{
		columnName: 'DONE — Abgeschlossene Aufgaben',
		description: 'Abgeschlossene Arbeiten',
		color: 'chart-3',
		cards: [
			{
				heading: 'Unit- und Integrationstests für Board-Logik schreiben',
				content: 'Erstelle eine einfache Test-Suite ohne externes Framework.',
				comments: [
					{ text: 'Testfälle für split_card sind kritisch', author: 'Projektmanager' }
				],
				labels: ['Testing', 'Important'],
				color: 'chart-4'
			}
		]
	}
];

/**
 * Lädt Demo-Daten ins aktuell aktive Board
 * Globale Funktion für Browser-Console
 */
export function add_democontent(): void {
	console.group('🚀 Demo-Content wird geladen...');
	
	try {
		let columnCount = 0;
		let cardCount = 0;
		let commentCount = 0;

		// Iteriere über Demo-Spalten
		for (const demoColumn of DEMO_DATA) {
			console.group(`📋 Spalte: ${demoColumn.columnName}`);

			// 1. Spalte erstellen via boardStore.addColumn() - NICHT board.addColumn()
			const column = boardStore.addColumn({
				name: demoColumn.columnName,
				color: demoColumn.color
			});

			columnCount++;
			console.log(`✅ Spalte erstellt: "${demoColumn.columnName}" (ID: ${column.id})`);

			// WICHTIG: Trigger Update nach Spalten-Erstellung!
			// Das inkrementiert updateTrigger und triggert $derived
			(boardStore as any)['triggerUpdate']?.();

			// 2. Karten zur Spalte hinzufügen VIA BOARDSTORE, nicht column.addCard()!
			if (demoColumn.cards && demoColumn.cards.length > 0) {
				console.group(`  ${demoColumn.cards.length} Karten`);

				for (const demoCard of demoColumn.cards) {
					// ✅ RICHTIG: Über boardStore.addCard() aufrufen
					// Das triggert automatisch updateTrigger
					boardStore.addCard(column.id, {
						heading: demoCard.heading,
						content: demoCard.content,
						color: demoCard.color,
						labels: demoCard.labels || [],
						publishState: 'draft'
					});

					cardCount++;
					console.log(`  ✅ Karte: "${demoCard.heading}"`);

					// 3. Kommentare zur Karte hinzufügen
					if (demoCard.comments && demoCard.comments.length > 0) {
						console.group(`    ${demoCard.comments.length} Kommentare`);

						for (const demoComment of demoCard.comments) {
							// Kommentare hinzufügen über boardStore (die erste Karte in der Spalte)
							const card = column.cards[column.cards.length - 1];
							if (card) {
								card.addComment(demoComment.text, demoComment.author);
								commentCount++;
								console.log(`    ✅ Kommentar: "${demoComment.text}"`);
							}
						}

						console.groupEnd();
					}

					// Trigger nach jeder Karte!
					(boardStore as any)['triggerUpdate']?.();
				}

				console.groupEnd();
			}

			console.groupEnd();
		}

		// Zusammenfassung
		console.log('%c═══════════════════════════════════════', 'color: #00ff00; font-weight: bold');
		console.log('%c✨ Demo-Content erfolgreich geladen!', 'color: #00ff00; font-weight: bold');
		console.log('%c═══════════════════════════════════════', 'color: #00ff00; font-weight: bold');
		console.table({
			'Spalten erstellt': columnCount,
			'Karten hinzugefügt': cardCount,
			'Kommentare hinzugefügt': commentCount
		});

		// Zeige aktuellen Board-State
		const boardData = boardStore.getContextData(true);
		console.log('📊 Aktueller Board-State:', boardData);

		console.groupEnd();

	} catch (error) {
		console.error('❌ Fehler beim Laden der Demo-Daten:', error);
		console.groupEnd();
		throw error;
	}
}

/**
 * Löscht alle Spalten und Karten aus dem Board (Reset)
 */
export function reset_board(): void {
	console.warn('🗑️ Board wird zurückgesetzt...');
	
	const board = boardStore['data'];
	const columnIds = [...board.columns].map(c => c.id);
	
	for (const colId of columnIds) {
		boardStore.deleteColumnWithCards(colId);
	}
	
	console.log('✅ Board wurde zurückgesetzt');
}

/**
 * Zeigt den aktuellen Board-State
 */
export function show_board(): void {
	const data = boardStore.getContextData(true);
	console.log('📊 Board-State:', data);
	console.table(data.columns.map((col: any) => ({
		Spalte: col.name,
		Karten: col.cards.length,
		'Karten-IDs': col.cards.map((c: any) => c.id).join(', ')
	})));
}

/**
 * Zeigt alle Karten mit ihren Kommentaren
 */
export function show_cards(): void {
	const data = boardStore.getContextData(true);
	console.log('🎴 Alle Karten im Board:');
	
	data.columns.forEach((col: any) => {
		console.group(`📋 Spalte: ${col.name}`);
		col.cards.forEach((card: any) => {
			console.group(`  🏷️ ${card.heading}`);
			console.log(`  ID: ${card.id}`);
			console.log(`  Inhalt: ${card.content}`);
			if (card.comments && card.comments.length > 0) {
				console.group(`  💬 ${card.comments.length} Kommentare:`);
				card.comments.forEach((comment: any) => {
					console.log(`    • ${comment.author}: "${comment.text}"`);
				});
				console.groupEnd();
			}
			console.groupEnd();
		});
		console.groupEnd();
	});
}

/**
 * Zählt alle Elemente im Board
 */
export function count_board(): void {
	const data = boardStore.getContextData(true);
	
	let totalCards = 0;
	let totalComments = 0;
	
	data.columns.forEach((col: any) => {
		totalCards += col.cards.length;
		col.cards.forEach((card: any) => {
			totalComments += (card.comments?.length || 0);
		});
	});
	
	console.table({
		'Spalten': data.columns.length,
		'Karten': totalCards,
		'Kommentare': totalComments
	});
}

// ============================================================================
// GLOBALE FUNKTIONEN REGISTRIEREN (Window-Objekt)
// ============================================================================

// Nur in Browser-Umgebung verfügbar
if (typeof window !== 'undefined') {
	(window as any).add_democontent = add_democontent;
	(window as any).reset_board = reset_board;
	(window as any).show_board = show_board;
	(window as any).show_cards = show_cards;
	(window as any).count_board = count_board;
	
	console.log('%c✅ Demo-Board-Funktionen registriert', 'color: #00ff00');
	console.log('%cVerfügbare Funktionen:', 'color: #00ff00');
	console.log('  • window.add_democontent()    - Lädt Demo-Daten ins Board');
	console.log('  • window.reset_board()        - Löscht alle Spalten & Karten');
	console.log('  • window.show_board()         - Zeigt Board-Übersicht');
	console.log('  • window.show_cards()         - Zeigt alle Karten mit Kommentaren');
	console.log('  • window.count_board()        - Zählt Elemente');
}

export type { }; // Ensure this is treated as a module
