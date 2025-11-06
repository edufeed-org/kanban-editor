/**
 * LLM-basierte Intent Detection Tests
 * 
 * NOTE: Diese Tests sind OPTIONAL und erfordern eine funktionierende LLM-API!
 * Sie sollten nur lokal ausgeführt werden, nicht in CI/CD.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { llmDetectIntention, detectIntentViaLLM } from './llmIntentDetection';
import { settingsStore } from '$lib/stores/settingsStore.svelte';

// Skip tests if no API configured
const isLlmConfigured = () => {
	const settings = settingsStore.settings;
	return !!(settings.llmBaseUrl && settings.llmModel);
};

describe.skipIf(!isLlmConfigured())('llmDetectIntention (LLM-based Intent Detection)', () => {
	beforeAll(() => {
		console.log('⚠️ Running LLM tests requires configured API in settings!');
	});

	describe('Explicit Intents', () => {
		it('should detect explicit board creation request', async () => {
			const result = await llmDetectIntention(
				[],
				'Erstelle ein Board zur Reformation in der 7. Klasse'
			);

			expect(result.intent).toBe('explicit');
			expect(result.confidence).toBeGreaterThan(0.8);
			expect(result.reason).toBeTruthy();
		}, 10000); // 10s timeout

		it('should detect explicit with different phrasing', async () => {
			const result = await llmDetectIntention(
				[],
				'Mache ein Kanban-Board über Medienkompetenz'
			);

			expect(result.intent).toBe('explicit');
			expect(result.confidence).toBeGreaterThan(0.7);
		}, 10000);
	});

	describe('Confirmation Intents', () => {
		it('should detect simple confirmation with context', async () => {
			const result = await llmDetectIntention(
				['Ich kann ein Board zur Reformation mit Spalten Todo, In Progress, Done erstellen.'],
				'ja bitte'
			);

			expect(result.intent).toBe('confirmation');
			expect(result.confidence).toBeGreaterThan(0.9);
		}, 10000);

		it('should detect "daraus" confirmation', async () => {
			const result = await llmDetectIntention(
				['Hier ist ein Vorschlag: # Medienkurrikulum\n## Spalten\n- Ziele\n- Inhalte'],
				'erstelle daraus das Board'
			);

			expect(result.intent).toBe('confirmation');
			expect(result.confidence).toBeGreaterThan(0.85);
		}, 10000);

		it('should detect "erstelle das board jetzt" as confirmation', async () => {
			const result = await llmDetectIntention(
				['Das Board könnte folgende Struktur haben: ...'],
				'erstelle das board jetzt'
			);

			expect(result.intent).toBe('confirmation');
			expect(result.confidence).toBeGreaterThan(0.8);
		}, 10000);

		it('should detect "erstelle Karten für" as confirmation', async () => {
			const result = await llmDetectIntention(
				['Das Board hat leere Spalten Ziele und Inhalte'],
				'erstelle Karten für die leeren Spalten'
			);

			expect(result.intent).toBe('confirmation');
			expect(result.confidence).toBeGreaterThan(0.75);
		}, 10000);
	});

	describe('Vague Intents', () => {
		it('should detect vague topic mention', async () => {
			const result = await llmDetectIntention(
				[],
				'Reformation 7. Klasse'
			);

			expect(result.intent).toBe('vague');
			expect(result.confidence).toBeGreaterThan(0.7);
		}, 10000);

		it('should detect vague without explicit action', async () => {
			const result = await llmDetectIntention(
				[],
				'Medienkompetenz Grundschule'
			);

			expect(result.intent).toBe('vague');
		}, 10000);
	});

	describe('detectIntentViaLLM (Simple Wrapper)', () => {
		it('should work without context', async () => {
			const intent = await detectIntentViaLLM('Erstelle ein Board zu Klimawandel');
			expect(intent).toBe('explicit');
		}, 10000);

		it('should work with previous AI response', async () => {
			const intent = await detectIntentViaLLM(
				'ja',
				'Soll ich ein Board zu Reformation erstellen?'
			);
			expect(intent).toBe('confirmation');
		}, 10000);
	});

	describe('Edge Cases & Fallback', () => {
		it('should handle empty messages', async () => {
			const result = await llmDetectIntention([], '');
			
			// Should fallback to rule-based
			expect(['explicit', 'confirmation', 'vague']).toContain(result.intent);
			expect(result.confidence).toBeGreaterThan(0);
		}, 10000);

		it('should validate confidence range', async () => {
			const result = await llmDetectIntention([], 'test message');
			
			expect(result.confidence).toBeGreaterThanOrEqual(0);
			expect(result.confidence).toBeLessThanOrEqual(1);
		}, 10000);
	});
});
