import { writable } from "svelte/store";
import type { Column } from "./types.js";

const boardId = "board-1"; // Die ID des aktuellen Boards

const rawData: Column[] = [
	{
		id: "c1",
		name: "TODO — Aufgaben, geplant für die nächste Iteration",
		description: "Aufgaben, die noch erledigt werden müssen und priorisiert werden sollten",
		color: "chart-1",
		items: [
			{
				id: 1,
				name: "Definiere Klassenstruktur und Interfaces für das neue Kanban-System mit KI-Integration",
				description: "Erstelle die TypeScript-Klassen für Card, Column, Board sowie eine saubere Serialisierung für KI-Kontexte.",
				comments: [
					{
						id: "c1-1",
						text: "Das ist ein Kommentar zu dieser Aufgabe",
						author: "Max Mustermann",
						createdAt: "2024-01-15T10:30:00Z"
					}
				],
				attendees: ["max@example.com", "anna@example.com"],
				labels: ["Architecture", "Milestone 2"],
				color: "chart-4",
				publishState: "draft",
				author: "max@example.com",
				image: "https://picsum.photos/400/200?random=1",
				link: "https://example.com/task1"
			},
			{
				id: 2,
				name: "Svelte Stores und Runes: Zustand und Persistenz sauber aufsetzen",
				description: "Implementiere $state-basierte Stores für das Board und Chat; optionales Local-Storage-Persistenz.",
				image: "https://picsum.photos/400/200?random=4",
				link: "https://example.com/task42"
			},
			{
				id: 3,
				name: "Erarbeite Drag-and-Drop-Strategie und API für Verschiebungen zwischen Spalten",
				description: "Konzeption für Drag-and-Drop sowie Routen der Aktionen, Event-Publish für Nostr/Events",
				image: "https://picsum.photos/400/200?random=5",
				color: "chart-1"
			},
			{
				id: 4,
				name: "Schreibe umfassende Dokumentation zur Board-Architektur und Persistenz",
				description: "Dokumentation, Beispiele und README für Entwickler und Endanwender.",
				image: "https://picsum.photos/400/200?random=6",
				color: "chart-2"
			},
			{
				id: 5,
				name: "Longform: Detaillierte Spezifikation für KI-Aktionen (split, move, add, update)",
				description: "Schreibe die Spezifikation inklusive Datenschema für AIAction-Payloads.",
				color: "chart-3"
			}
		]
	},
	{
		id: "c2",
		name: "IN PROGRESS — Aktive Implementierungsschritte",
		description: "Aufgaben, die gerade bearbeitet werden oder sich im Review befinden",
		color: "chart-2",
		items: [
			{
				id: 6,
				name: "Implementiere Card-Komponenten mit Kontextmenü, KI-Button und Modal-Dialogen",
				description: "UI-Komponenten bauen, Events anbinden, Accessibility beachten",
				comments: [
					{
						id: "c2-1",
						text: "Brauche Feedback zur Modal-Interaktion",
						author: "Anna Schmidt",
						createdAt: "2024-01-16T14:20:00Z"
					}
				],
				attendees: ["anna@example.com"],
				labels: ["Feature", "UI"],
				color: "chart-1",
				publishState: "published",
				author: "anna@example.com",
				image: "https://picsum.photos/400/200?random=2",
				link: "https://example.com/task50"
			},
			{
				id: 7,
				name: "Optimierung: Performance beim Rendern vieler Karten (virtualization, memoization)",
				description: "Analyse und Implementierung möglicher Performance-Verbesserungen ohne Breaking Changes",
				color: "chart-2"
			}
		]
	},
	{
		id: "c3",
		name: "REVIEW — Zur Überprüfung und Code-Review vorgesehen",
		description: "Aufgaben, die Review benötigen bevor sie in Done landen",
		color: "chart-3",
		items: [
			{
				id: 8,
				name: "Abschluss: Unit- und Integrationstests für Board-Logik schreiben",
				description: "Erstelle eine einfache Test-Suite ohne externes Framework, die Kernfunktionen validiert.",
				comments: [
					{
						id: "c3-1",
						text: "Testfälle für split_card sind kritisch",
						author: "Projektmanager",
						createdAt: "2024-01-18T16:45:00Z"
					}
				],
				labels: ["Testing", "Important"],
				color: "chart-4",
				publishState: "published",
				author: "team@example.com"
			}
		]
	},
	// Neue zusätzliche Spalten (4)
	{
		id: "c4",
		name: "BACKLOG — Ideen, Wünsche und mögliche Zukunftsaufgaben",
		description: "Hier sammeln wir Vorschläge und Ideen, die später priorisiert werden können",
		color: "chart-5",
		items: [
			{ id: 9, name: "Langfristige Idee: Offline-Unterstützung und Sync-Strategie für dezentrale Relays", description: "Konzept für Offline-first UX und Konfliktauflösung beim späteren Sync." },
			{ id: 10, name: "Research: Optionen für dezentralen Storage (IPFS, Nostr-Events, etc.)", description: "Bewertung verschiedener Ansätze hinsichtlich Datenschutz und Kosten." },
			{ id: 11, name: "Feature-Vorschlag: Benachrichtigungen via Nostr-Push für Board-Updates", description: "Entwurf für opt-in Benachrichtigungen für Teammitglieder." }
		]
	},
	{
		id: "c5",
		name: "BLOCKED — Aufgaben mit externen Abhängigkeiten oder Hindernissen",
		description: "Tasks, die nicht weitergehen können, bis externe Probleme gelöst sind",
		color: "chart-1",
		items: [
			{ id: 12, name: "Integration: Externer Auth-Service ermöglicht keine Test-Accounts", description: "Warten auf Freischaltung von Test-Accounts durch den externen Provider." },
			{ id: 13, name: "Klärung: Rechtliche Fragen zur Speicherung von Nutzerdaten in Events", description: "Juristische Prüfung nötig bevor wir persistente Daten in Events speichern." }
		]
	},
	{
		id: "c6",
		name: "QA — Qualitätssicherung und manuelle Tests",
		description: "Exploratives Testen, Bug-Reports und reproduzierbare Testfälle",
		color: "chart-2",
		items: [
			{ id: 14, name: "Manuelles Testskript: Kern-Workflows durchspielen (Add/Move/Split/Delete)", description: "Schritt-für-Schritt-Anleitung für QA-Engineers." },
			{ id: 15, name: "Erstelle reproduzierbare Testdaten mit verschiedenen PublishState-Kombinationen", description: "Dataset zum Testen von Archiving- und Publish-Workflows." }
		]
	},
	{
		id: "c7",
		name: "ARCHIVE — Archivierte oder langfristig abgeschlossene Aufgaben",
		description: "Alte Tickets, abgeschlossene Epics und archivierte Ideen",
		color: "chart-3",
		items: [
			{ id: 16, name: "Alt: Prototyp-Implementierung aus 2023 (nur Referenz, nicht produktiv)", description: "Archivierte Implementierung, dient als Referenz." },
			{ id: 17, name: "Alt: Experimentelle UI-Iteration - zurückgezogen", description: "Ergebnis eines UI-Experiments, weitere Nutzung fraglich." },
			{ id: 18, name: "Dokumentation: Historie der Designentscheidungen und Gründe für Refactorings", description: "Zusammenfassung der wichtigsten Entscheidungen." }
		]
	}
];

// Helper-Funktion: Reichert alle Karten mit columnId und boardId an
function enrichCardsWithMetadata(columns: Column[], bId: string): Column[] {
	return columns.map(column => ({
		...column,
		items: column.items.map(card => ({
			...card,
			columnId: column.id,
			boardId: bId
		}))
	}));
}

// Daten mit Metadaten anreichern
const enrichedData = enrichCardsWithMetadata(rawData, boardId);

const dataStore = writable(enrichedData);

export { dataStore as data };