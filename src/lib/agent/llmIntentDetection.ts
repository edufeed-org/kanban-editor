/**
 * LLM-basierte Intent Detection (Alternative zu regelbasiertem Pattern-Matching)
 * 
 * Nutzt LLM um Benutzer-Intention aus Kontext zu erkennen
 */

import { llmRequest } from './llmRequest';
import type { UserIntent } from './types';

export interface IntentDetectionResult {
	intent: UserIntent;
	confidence: number; // 0.0 - 1.0
	reason: string;
}

/**
 * Erkennt Benutzer-Intention via LLM (kontext-bewusst)
 * 
 * @param systemMessages - Letzte N System-Nachrichten (AI Responses)
 * @param userMessage - Aktuelle User-Nachricht
 * @returns Intent mit Konfidenz und Begründung
 * 
 * @example
 * const intent = await llmDetectIntention(
 *   ['AI: Ich kann ein Board zu Reformation erstellen...'],
 *   'ja bitte'
 * );
 * // → { intent: 'confirmation', confidence: 0.95, reason: 'User confirms previous proposal' }
 */
export async function llmDetectIntention(
	systemMessages: string[],
	userMessage: string
): Promise<IntentDetectionResult> {
	const systemPrompt = `Du bist ein Experte für Intent-Erkennung in Kanban-Board-Erstellungs-Anfragen.

Deine Aufgabe ist es, die Intention des Benutzers zu erkennen basierend auf:
1. Den letzten AI-Antworten (Kontext)
2. Der aktuellen User-Nachricht

**Intent-Typen:**

1. **explicit** - User fordert EXPLIZIT eine neue Board-Erstellung an
   - Beispiele: "Erstelle ein Board zu Reformation", "Mache ein Board über Medienkompetenz"
   - Merkmale: Enthält "erstelle EIN board" oder ähnlich

2. **confirmation** - User bestätigt einen vorherigen Vorschlag ODER fordert Umsetzung an
   - Beispiele: 
     * "ja", "ja bitte", "mach das", "los"
     * "erstelle daraus das Board", "erstelle nun das Board"
     * "erstelle Karten für die Spalten", "fülle die Spalten"
   - Merkmale: Bezieht sich auf vorherigen Vorschlag ODER fordert direkte Umsetzung

3. **vague** - User nennt nur ein Thema OHNE explizite Aufforderung
   - Beispiele: "Reformation 7. Klasse", "Medienkompetenz"
   - Merkmale: Kein Verb, keine klare Aufforderung

**Wichtig:**
- Wenn AI bereits einen Vorschlag gemacht hat und User bestätigt → "confirmation"
- Wenn User direkt "erstelle das Board/Karten/Spalten" sagt → "confirmation"
- Wenn User "erstelle EIN Board zu X" sagt → "explicit"

Antworte NUR mit JSON (kein Markdown, keine Erklärung):
{
  "intent": "explicit" | "confirmation" | "vague",
  "confidence": 0.0 - 1.0,
  "reason": "kurze Begründung (1 Satz)"
}`;

	const contextInfo = systemMessages.length > 0 
		? `Kontext (letzte ${systemMessages.length} AI-Antworten):\n${systemMessages.map((msg, i) => `${i + 1}. ${msg.substring(0, 200)}`).join('\n')}\n\n`
		: 'Kein vorheriger Kontext.\n\n';

	const userPrompt = `${contextInfo}Aktuelle User-Nachricht: "${userMessage}"

Was ist die Intention?`;

	try {
		const result = await llmRequest<IntentDetectionResult>({
			systemPrompt,
			userMessage: userPrompt,
			returnType: 'json',
			temperature: 0.1, // Sehr niedrig für konsistente Ergebnisse
			maxTokens: 150
		});

		// Type Guard: llmRequest kann string ODER T zurückgeben
		if (typeof result === 'string') {
			console.warn('⚠️ LLM returned string instead of JSON:', result);
			throw new Error('LLM returned text instead of JSON');
		}

		// Validiere Result
		if (!['explicit', 'confirmation', 'vague'].includes(result.intent)) {
			console.warn('⚠️ LLM returned invalid intent:', result.intent, '→ Fallback: vague');
			return {
				intent: 'vague',
				confidence: 0.5,
				reason: `Invalid LLM response: ${result.intent}`
			};
		}

		if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
			result.confidence = 0.8; // Default confidence
		}

		console.log('🤖 LLM Intent Detection:', result);
		return result;

	} catch (err) {
		console.error('❌ LLM Intent Detection failed:', err);
		
		// Fallback: Regelbasierte Detection (existing function)
		const { detectUserIntent } = await import('./intentDetection');
		const fallbackIntent = detectUserIntent(userMessage);
		
		return {
			intent: fallbackIntent,
			confidence: 0.6,
			reason: `LLM failed, using rule-based fallback: ${err instanceof Error ? err.message : 'Unknown error'}`
		};
	}
}

/**
 * Wrapper für einfache Intent-Detektion (ohne expliziten Kontext)
 * 
 * @param userMessage - User-Nachricht
 * @param previousAIResponse - Optional: Letzte AI-Antwort
 * @returns Intent-String (kompatibel mit bestehendem Code)
 */
export async function detectIntentViaLLM(
	userMessage: string,
	previousAIResponse?: string
): Promise<UserIntent> {
	const systemMessages = previousAIResponse ? [previousAIResponse] : [];
	const result = await llmDetectIntention(systemMessages, userMessage);
	return result.intent;
}
