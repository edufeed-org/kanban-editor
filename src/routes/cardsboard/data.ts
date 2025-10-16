import { writable } from "svelte/store";
import type { Column } from "./types.js";

const boardId = "board-1"; // Die ID des aktuellen Boards

const rawData: Column[] = [
	{
		id: "c1",
		name: "TODO",
		description: "Aufgaben, die noch erledigt werden müssen",
		color: "chart-1",
		items: [
			{
				id: 1,
				name: "item41",
				description: "Erste Aufgabe im TODO mit erweiterten Features und einem tollen Bild!",
				comments: [
					{
						id: "c1",
						text: "Das ist ein Kommentar zu dieser Aufgabe",
						author: "Max Mustermann",
						createdAt: "2024-01-15T10:30:00Z"
					}
				],
				attendees: ["max@example.com", "anna@example.com"],
				labels: ["Bug", "Milestone 2"],
				color: "chart-4",
				publishState: "draft",
				author: "max@example.com",
				image: "https://picsum.photos/400/200?random=1",
				link: "https://example.com/task1"
			},
			{
				id: 2,
				name: "item42",
				description: "Zweite Aufgabe im TODO mit Beispielbild",
				image: "https://picsum.photos/400/200?random=4",
				link: "https://example.com/task42"
			},
			{
				id: 3,
				name: "item43",
				description: "Dritte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=5",
				color: "chart-1"
			},
			{
				id: 4,
				name: "item44",
				description: "Vierte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=6",
				color: "chart-2"
			},
			{
				id: 5,
				name: "item45",
				description: "Fünfte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=7",
				color: "chart-3"
			},
			{
				id: 6,
				name: "item46",
				description: "Sechste Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=8",
				color: "chart-1"
			},
			{
				id: 7,
				name: "item47",
				description: "Siebte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=9",
				color: "chart-4"
			},
			{
				id: 8,
				name: "item48",
				description: "Achte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=10",
				color: "chart-5"
			},
			{
				id: 9,
				name: "item49",
				description: "Neunte Aufgabe im TODO",
				image: "https://picsum.photos/400/200?random=11",
				color: "chart-3",
				publishState: "archived",
				author: "max@example.com"
			}
		]
	},
	{
		id: "c2",
		name: "DOING",
		description: "Aufgaben, die gerade bearbeitet werden",
		color: "chart-2",
		items: [
			{
				id: 10,
				name: "item50",
				description: "Erste Aufgabe in Arbeit mit Kommentaren und einem Arbeitsbild",
				comments: [
					{
						id: "c2",
						text: "Diese Aufgabe ist bereits in Bearbeitung",
						author: "Anna Schmidt",
						createdAt: "2024-01-16T14:20:00Z"
					},
					{
						id: "c3",
						text: "Brauche Hilfe bei der Implementierung",
						author: "Max Mustermann",
						createdAt: "2024-01-17T09:15:00Z"
					}
				],
				attendees: ["anna@example.com"],
				labels: ["Feature", "Urgent"],
				color: "chart-1",
				publishState: "published",
				author: "anna@example.com",
				image: "https://picsum.photos/400/200?random=2",
				link: "https://example.com/task50"
			},
			{
				id: 11,
				name: "item51",
				description: "Zweite Aufgabe in Arbeit mit Arbeitsbild",
				image: "https://picsum.photos/400/200?random=12",
				link: "https://example.com/task51",
				color: "chart-2"
			}
		]
	},
	{
		id: "c3",
		name: "DONE",
		description: "Abgeschlossene Aufgaben",
		color: "chart-3",
		items: [
			{
				id: 13,
				name: "item52",
				description: "Erledigte Aufgabe mit vollständiger Dokumentation und Abschlussbild",
				comments: [
					{
						id: "c4",
						text: "Aufgabe erfolgreich abgeschlossen",
						author: "Projektmanager",
						createdAt: "2024-01-18T16:45:00Z"
					}
				],
				attendees: ["team@example.com"],
				labels: ["Documentation", "Completed"],
				color: "chart-4",
				publishState: "published",
				author: "team@example.com",
				image: "https://picsum.photos/400/200?random=3",
				link: "https://example.com/task52"
			}
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