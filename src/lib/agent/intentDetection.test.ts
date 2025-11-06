/**
 * Unit Tests für Intent Detection
 */

import { describe, it, expect } from 'vitest';
import { detectUserIntent } from './intentDetection';

describe('detectUserIntent', () => {
	describe('Confirmation Patterns', () => {
		it('should detect simple confirmations', () => {
			expect(detectUserIntent('ja')).toBe('confirmation');
			expect(detectUserIntent('Ja bitte')).toBe('confirmation');
			expect(detectUserIntent('okay')).toBe('confirmation');
			expect(detectUserIntent('OK')).toBe('confirmation');
			expect(detectUserIntent('genau')).toBe('confirmation');
			expect(detectUserIntent('mach das')).toBe('confirmation');
		});

		it('should detect "daraus" confirmations (Bug #4)', () => {
			// 🔴 This is the critical test case from Bug #4
			expect(detectUserIntent('Erstelle daraus das Board')).toBe('confirmation');
			expect(detectUserIntent('Mache daraus ein Board')).toBe('confirmation');
			expect(detectUserIntent('Generiere daraus das Board')).toBe('confirmation');
			expect(detectUserIntent('erstell daraus das board')).toBe('confirmation'); // lowercase
			expect(detectUserIntent('ERSTELLE DARAUS DAS BOARD')).toBe('confirmation'); // uppercase
		});
	});

	describe('Explicit Patterns', () => {
		it('should detect explicit board creation requests', () => {
			expect(detectUserIntent('Erstelle ein Board zur Reformation')).toBe('explicit');
			expect(detectUserIntent('Generiere ein Board für Schulgarten')).toBe('explicit');
			expect(detectUserIntent('Mache ein Board zu Klasse 7')).toBe('explicit');
			expect(detectUserIntent('Lege ein Board an für Projekt X')).toBe('explicit');
		});

		it('should NOT detect "daraus" as explicit', () => {
			// "daraus" should be confirmation, not explicit
			expect(detectUserIntent('Erstelle daraus das Board')).not.toBe('explicit');
		});
	});

	describe('Vague Patterns', () => {
		it('should detect vague requests (no explicit action)', () => {
			expect(detectUserIntent('Reformation 7. Klasse')).toBe('vague');
			expect(detectUserIntent('Wie bauen einen Schöpfungsgarten')).toBe('vague');
			expect(detectUserIntent('Projektplanung für nächste Woche')).toBe('vague');
		});

		it('should NOT detect explicit or confirmation as vague', () => {
			expect(detectUserIntent('Erstelle ein Board')).not.toBe('vague');
			expect(detectUserIntent('ja')).not.toBe('vague');
			expect(detectUserIntent('Erstelle daraus das Board')).not.toBe('vague');
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty strings', () => {
			expect(detectUserIntent('')).toBe('vague');
			expect(detectUserIntent('   ')).toBe('vague'); // only whitespace
		});

		it('should handle case insensitivity', () => {
			expect(detectUserIntent('JA')).toBe('confirmation');
			expect(detectUserIntent('ERSTELLE EIN BOARD')).toBe('explicit');
			expect(detectUserIntent('ERSTELLE DARAUS DAS BOARD')).toBe('confirmation');
		});

		it('should handle extra whitespace', () => {
			expect(detectUserIntent('  ja  ')).toBe('confirmation');
			expect(detectUserIntent('  Erstelle daraus das Board  ')).toBe('confirmation');
		});
	});

	describe('Real-World User Messages (from Bug Reports)', () => {
		it('Bug #4: "Erstelle daraus das Board" after AI proposal', () => {
			// User context:
			// 1. User: "Wie bauen einen Schöpfungsgarten in Klasse 4"
			// 2. AI: Shows markdown proposal
			// 3. User: "Erstelle daraus das Board" ← THIS SHOULD BE confirmation!
			
			const intent = detectUserIntent('Erstelle daraus das Board');
			expect(intent).toBe('confirmation');
		});

		it('First message: "Wie bauen einen Schöpfungsgarten" should be vague', () => {
			const intent = detectUserIntent('Wie bauen einen Schöpfungsgarten in Klasse 4');
			expect(intent).toBe('vague');
		});

		it('Explicit request should work', () => {
			const intent = detectUserIntent('Erstelle ein Board für Schöpfungsgarten Klasse 4');
			expect(intent).toBe('explicit');
		});
	});
});
