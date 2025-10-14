import { writable } from "svelte/store";
import type { Column } from "./types.js";

const dataStore = writable<Column[]>([
	{
		id: "c1",
		name: "TODO",
		description: "Aufgaben, die noch erledigt werden müssen",
		items: [
			{ id: 1, name: "item41", description: "Erste Aufgabe im TODO" },
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
			{ id: 10, name: "item50", description: "Erste Aufgabe in Arbeit" },
			{ id: 11, name: "item51", description: "Zweite Aufgabe in Arbeit" }
		]
	},
	{
		id: "c3",
		name: "DONE",
		description: "Abgeschlossene Aufgaben",
		items: [
			{ id: 13, name: "item52", description: "Erledigte Aufgabe" }
		]
	}
]);

export { dataStore as data };