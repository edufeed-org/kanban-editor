/**
 * Intent Detection & System Prompt Generation
 * Erkennt Benutzerabsichten und generiert passende LLM-Prompts
 */

import type { UserIntent } from './types';

/**
 * Erkennt die Absicht des Benutzers aus seiner Nachricht
 * 
 * @param userMessage - Die Benutzernachricht
 * @returns Intent-Typ: 'explicit' | 'confirmation' | 'vague'
 * 
 * @example
 * detectUserIntent("Erstelle ein Board zur Reformation") // → 'explicit'
 * detectUserIntent("Ja bitte") // → 'confirmation'
 * detectUserIntent("Erstelle daraus das Board") // → 'confirmation' (bei bestehendem Vorschlag)
 * detectUserIntent("Reformation 7. Klasse") // → 'vague'
 */
export function detectUserIntent(userMessage: string): UserIntent {
	const lowerMsg = userMessage.toLowerCase().trim();

	// Pattern 1: Confirmation Responses (Simple)
	const confirmationPhrases = [
		'ja',
		'ja bitte',
		'ja gerne',
		'mach das',
		'setze um',
		'los',
		'okay',
		'ok',
		'genau',
		'klar',
		'gerne'
	];

	// Exact match or starts with confirmation phrase
	const isConfirmation = confirmationPhrases.some(
		(phrase) => lowerMsg === phrase || lowerMsg.startsWith(phrase + ' ')
	);

	if (isConfirmation) {
		return 'confirmation';
	}

	// Pattern 1b: Confirmation with "daraus" or "aus dem/der" (bezieht sich auf vorherigen Vorschlag)
	// 🆕 "Erstelle daraus das Board" / "Erstelle aus dem Markdown" / "Generiere aus der Vorlage"
	const hasConfirmationVerb = [
		'erstelle daraus',
		'mache daraus',
		'generiere daraus',
		'baue daraus',
		'lege daraus an',
		'erstell daraus',
		// 🆕 Neue Patterns mit "aus dem/der"
		'erstelle aus dem',
		'erstelle aus der',
		'mache aus dem',
		'generiere aus dem',
		'baue aus dem',
		// 🆕 Pattern mit "die Spalten" / "das Board" (explizite Umsetzung)
		'erstelle die spalten',
		'erstelle das board',
		'generiere die spalten',
		'baue die spalten',
		// 🆕 Pattern mit "nun/jetzt das Board" (Bestätigung mit Zeitbezug)
		'erstelle nun das board',
		'erstelle jetzt das board',
		'mache nun das board',
		'generiere nun das board',
		'baue nun das board',
		'erstelle nun die spalten',
		'erstelle jetzt die spalten',
		// 🆕 Pattern mit "das Board/die Spalten" + "nun/jetzt" (Reihenfolge vertauscht)
		'erstelle das board nun',
		'erstelle das board jetzt',
		'mache das board nun',
		'generiere das board jetzt',
		'erstelle die spalten nun',
		'erstelle die spalten jetzt',
		// 🆕 Pattern mit "Karten für" (explizite Karten-Erstellung)
		'erstelle karten für',
		'generiere karten für',
		'mache karten für',
		'füge karten',
		'erstelle cards',
		'fülle die spalten'
	].some((phrase) => lowerMsg.includes(phrase));

	if (hasConfirmationVerb) {
		return 'confirmation';
	}

	// Pattern 2: Explicit Action Requests (mit "ein Board")
	const explicitVerbs = [
		'erstelle ein board',
		'mache ein board',
		'generiere ein board',
		'lege ein board an',
		'neues board',
		'erstell ein board'
	];

	const hasExplicitVerb = explicitVerbs.some((verb) => lowerMsg.includes(verb));

	if (hasExplicitVerb) {
		return 'explicit';
	}

	// Pattern 3: Vague (everything else)
	return 'vague';
}

/**
 * Generiert intent-spezifische System-Prompts für die LLM
 * 
 * @param intent - Der erkannte Intent-Typ
 * @returns System-Prompt String für die LLM
 */
export function getIntentAwareSystemPrompt(intent: UserIntent): string {
	switch (intent) {
		case 'vague':
			return `Du bist ein Lern-Assistent für Kanban-Board-Erstellung.

Der User hat eine VAGE Anfrage gestellt (nur ein Thema oder Konzept genannt, ohne explizite Aufforderung).

Deine Aufgabe:
1. Fasse kurz zusammen, was du verstanden hast
2. Frage EXPLIZIT: "Soll ich ein Board zu [Thema] erstellen?"
3. Erstelle KEINE Struktur - warte auf Bestätigung

Beispiel:
User: "Reformation 7. Klasse"
Du: "Ich verstehe, du möchtest Materialien zur Reformation für die 7. Klasse strukturieren. Soll ich ein Kanban-Board mit Spalten und Karten zu diesem Thema erstellen?"`;

		case 'explicit':
			return `Du bist ein Experte für die Strukturierung von Lerninhalten in Kanban-Boards.

Der User hat EXPLIZIT eine Aktion angefordert (z.B. "Erstelle ein Board zu...").

Erstelle sofort eine Struktur im Markdown-Format:
# [Thema]
## Spalte 1: [Name]
- Karte: [Titel]
## Spalte 2: [Name]
- Karte: [Titel]
...

Die Struktur sollte pädagogisch sinnvoll sein mit Spalten für verschiedene Lernphasen.`;

		case 'confirmation':
			return `Du bist ein Lern-Assistent.

Der User hat eine BESTÄTIGUNG gegeben (z.B. "Ja bitte", "mach das").

Antworte kurz bestätigend: "Alles klar! Ich erstelle das Board jetzt."
Dann erstelle die Struktur im Markdown-Format:
# [Thema]
## Spalte 1: [Name]
- Karte: [Titel]
...`;
	}
}
