import { writable } from "svelte/store";
import type { Column } from "./types.js";

const dataStore = writable<Column[]>([
	{
		id: "c1",
		name: "TODO",
		description: "Aufgaben, die noch erledigt werden müssen",
		items: [
			{
				id: 1,
				name: "item41",
				description: "Erste Aufgabe im TODO mit erweiterten Features",
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
				color: "blue",
				publishState: "draft",
				author: "max@example.com"
			},
			{ id: 2, name: "item42", description: "Zweite Aufgabe im TODO" },
			{ id: 3, name: "item43", description: "Dritte Aufgabe im TODO" },
			{ id: 4, name: "item44", description: "Vierte Aufgabe im TODO" },
			{ id: 5, name: "item45", description: "Fünfte Aufgabe im TODO" },
			{ id: 6, name: "item46", description: "Sechste Aufgabe im TODO" },
			{ id: 7, name: "item47", description: "Siebte Aufgabe im TODO" },
			{ id: 8, name: "item48", description: "Achte Aufgabe im TODO" },
			{ id: 9, name: "item49", description: "Neunte Aufgabe im TODO" }
		]
	},
	{
		id: "c2",
		name: "DOING",
		description: "Aufgaben, die gerade bearbeitet werden",
		items: [
			{
				id: 10,
				name: "item50",
				description: "Erste Aufgabe in Arbeit mit Kommentaren",
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
				publishState: "published",
				author: "anna@example.com"
			},
			{ id: 11, name: "item51", description: "Zweite Aufgabe in Arbeit" }
		]
	},
	{
		id: "c3",
		name: "DONE",
		description: "Abgeschlossene Aufgaben",
		items: [
			{
				id: 13,
				name: "item52",
				description: "Erledigte Aufgabe mit vollständiger Dokumentation",
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
				color: "green",
				publishState: "published",
				author: "team@example.com"
			}
		]
	}
]);

export { dataStore as data };