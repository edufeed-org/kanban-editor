// src/lib/stores/userPreferencesStore.spec.ts
// Unit Tests für UserPreferencesStore
// Phase 3.1B - Cross-Board Learning System

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserPreferencesStore } from './userPreferencesStore.svelte';
import type { PreferenceCategory, ImportMode } from '$lib/types/preferences';

describe('UserPreferencesStore', () => {
	let store: UserPreferencesStore;

	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear();
		store = new UserPreferencesStore();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('1. Initialization & Storage', () => {
		it('should initialize with empty preferences', () => {
			expect(store.preferences).toEqual([]);
		});

		it('should load from localStorage if exists', () => {
			// Setup: Save data to localStorage
			const mockData = {
				preferences: [
					{
						id: 'pref-1',
						category: 'structure' as PreferenceCategory,
						key: 'TEST_KEY',
						value: 'test-value',
						confidence: 0.5,
						learnedFrom: [{ boardId: 'board-1', timestamp: '2025-11-03T10:00:00Z' }],
						lastUsed: '2025-11-03T10:00:00Z',
						createdAt: '2025-11-03T10:00:00Z',
						updatedAt: '2025-11-03T10:00:00Z'
					}
				],
				version: '1.0'
			};
			localStorage.setItem('user-preferences', JSON.stringify(mockData));

			// Create new store (should load from localStorage)
			const newStore = new UserPreferencesStore();
			expect(newStore.preferences.length).toBe(1);
			expect(newStore.preferences[0].key).toBe('TEST_KEY');
		});

		it('should use default state on corrupted localStorage', () => {
			localStorage.setItem('user-preferences', 'invalid-json');
			const newStore = new UserPreferencesStore();
			expect(newStore.preferences).toEqual([]);
		});
	});

	describe('2. learnPreference() - New Preference', () => {
		it('should create new preference with confidence 0.5', () => {
			const result = store.learnPreference(
				'structure',
				'DEFAULT_COLUMNS',
				['Backlog', 'In Progress', 'Done'],
				'board-123',
				'Test Board'
			);

			expect(result.isNew).toBe(true);
			expect(result.preference.confidence).toBe(0.5);
			expect(result.preference.key).toBe('DEFAULT_COLUMNS');
			expect(result.preference.category).toBe('structure');
			expect(result.preference.value).toEqual(['Backlog', 'In Progress', 'Done']);
			expect(result.preference.learnedFrom).toHaveLength(1);
			expect(result.preference.learnedFrom[0].boardId).toBe('board-123');
		});

		it('should persist to localStorage', () => {
			store.learnPreference('structure', 'TEST_KEY', 'test-value', 'board-1');

			const stored = localStorage.getItem('user-preferences');
			expect(stored).toBeTruthy();

			const parsed = JSON.parse(stored!);
			expect(parsed.preferences).toHaveLength(1);
			expect(parsed.preferences[0].key).toBe('TEST_KEY');
		});
	});

	describe('3. learnPreference() - Repeat Same Value', () => {
		it('should increase confidence by 0.1 on repeat', () => {
			// First learning
			const result1 = store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-1');
			expect(result1.preference.confidence).toBe(0.5);

			// Second learning (same value)
			const result2 = store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-2');
			expect(result2.isNew).toBe(false);
			expect(result2.preference.confidence).toBe(0.6);
			expect(result2.previousConfidence).toBe(0.5);
		});

		it('should cap confidence at 1.0', () => {
			// Learn 6 times (0.5 + 0.1*6 = 1.1, but capped at 1.0)
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			store.learnPreference('structure', 'KEY', 'value', 'board-2');
			store.learnPreference('structure', 'KEY', 'value', 'board-3');
			store.learnPreference('structure', 'KEY', 'value', 'board-4');
			store.learnPreference('structure', 'KEY', 'value', 'board-5');
			const result = store.learnPreference('structure', 'KEY', 'value', 'board-6');

			expect(result.preference.confidence).toBe(1.0);
		});

		it('should add new learning source on repeat', () => {
			store.learnPreference('structure', 'KEY', 'value', 'board-1', 'Board 1');
			store.learnPreference('structure', 'KEY', 'value', 'board-2', 'Board 2');

			const pref = store.getPreference('KEY')!;
			expect(pref.learnedFrom).toHaveLength(2);
			expect(pref.learnedFrom[0].boardId).toBe('board-1');
			expect(pref.learnedFrom[1].boardId).toBe('board-2');
		});

		it('should not duplicate learning sources', () => {
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			store.learnPreference('structure', 'KEY', 'value', 'board-1'); // Same board again

			const pref = store.getPreference('KEY')!;
			expect(pref.learnedFrom).toHaveLength(1);
		});
	});

	describe('4. learnPreference() - Value Changed', () => {
		it('should decrease confidence by 0.2 when value changes', () => {
			// First learning
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-1');

			// Second learning with different value
			const result = store.learnPreference('structure', 'COLUMNS', ['X', 'Y'], 'board-2');

			expect(result.isNew).toBe(false);
			expect(result.preference.confidence).toBe(0.3); // 0.5 - 0.2
			expect(result.preference.value).toEqual(['X', 'Y']);
		});

		it('should not go below confidence 0.3', () => {
			store.learnPreference('structure', 'KEY', 'value1', 'board-1');
			store.learnPreference('structure', 'KEY', 'value2', 'board-2'); // 0.3
			const result = store.learnPreference('structure', 'KEY', 'value3', 'board-3'); // Should stay 0.3

			expect(result.preference.confidence).toBe(0.3);
		});

		it('should use deep equality for value comparison', () => {
			store.learnPreference('structure', 'KEY', { a: 1, b: [2, 3] }, 'board-1');

			// Same object, different reference
			const result = store.learnPreference(
				'structure',
				'KEY',
				{ a: 1, b: [2, 3] },
				'board-2'
			);

			expect(result.preference.confidence).toBe(0.6); // Increased, not decreased
		});
	});

	describe('5. adaptPreference()', () => {
		it('should adapt existing preference with confidence decrease', () => {
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-1');

			const result = store.adaptPreference('COLUMNS', ['X', 'Y', 'Z'], 'board-2');

			expect(result).toBeTruthy();
			expect(result!.preference.value).toEqual(['X', 'Y', 'Z']);
			expect(result!.preference.confidence).toBe(0.3); // 0.5 - 0.2
			expect(result!.confidenceDelta).toBe(-0.2);
			expect(result!.wasAutoApplied).toBe(false);
		});

		it('should detect auto-apply status (confidence >= 0.8)', () => {
			// Learn enough times to reach 0.8
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			store.learnPreference('structure', 'KEY', 'value', 'board-2');
			store.learnPreference('structure', 'KEY', 'value', 'board-3');
			store.learnPreference('structure', 'KEY', 'value', 'board-4'); // confidence = 0.8

			const result = store.adaptPreference('KEY', 'new-value', 'board-5');

			expect(result!.wasAutoApplied).toBe(true);
		});

		it('should return null for non-existent preference', () => {
			const result = store.adaptPreference('NON_EXISTENT', 'value', 'board-1');
			expect(result).toBeNull();
		});
	});

	describe('6. getPreferences() - Filtering', () => {
		beforeEach(() => {
			// Setup multiple preferences
			store.learnPreference('structure', 'KEY_1', 'value1', 'board-1');
			store.learnPreference('workflow', 'KEY_2', 'value2', 'board-1');
			store.learnPreference('structure', 'KEY_3', 'value3', 'board-1');

			// Increase confidence for KEY_1
			store.learnPreference('structure', 'KEY_1', 'value1', 'board-2');
			store.learnPreference('structure', 'KEY_1', 'value1', 'board-3'); // confidence = 0.7
		});

		it('should filter by category', () => {
			const structurePrefs = store.getPreferences('structure');
			expect(structurePrefs).toHaveLength(2);
			expect(structurePrefs.every((p) => p.category === 'structure')).toBe(true);
		});

		it('should filter by minConfidence', () => {
			const highConfPrefs = store.getPreferences(undefined, 0.6);
			expect(highConfPrefs).toHaveLength(1);
			expect(highConfPrefs[0].key).toBe('KEY_1');
		});

		it('should combine category and minConfidence filters', () => {
			const result = store.getPreferences('structure', 0.6);
			expect(result).toHaveLength(1);
			expect(result[0].key).toBe('KEY_1');
		});

		it('should return all preferences without filters', () => {
			const all = store.getPreferences();
			expect(all).toHaveLength(3);
		});
	});

	describe('7. getAIContext()', () => {
		beforeEach(() => {
			// Setup preferences
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-1');
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-2');
			store.learnPreference('workflow', 'START_WITH', 'brainstorm', 'board-1');
			store.learnPreference('pedagogy', 'PRINCIPLE', 'constructivism', 'board-1');
		});

		it('should group preferences by category', () => {
			const context = store.getAIContext(0.0);

			expect(context.structure).toHaveProperty('COLUMNS');
			expect(context.workflow).toHaveProperty('START_WITH');
			expect(context.pedagogy).toHaveProperty('PRINCIPLE');
		});

		it('should only include high-confidence preferences', () => {
			const context = store.getAIContext(0.7); // Only COLUMNS has confidence >= 0.7

			expect(context.structure.COLUMNS).toEqual(['A', 'B']);
			expect(Object.keys(context.workflow)).toHaveLength(0);
			expect(Object.keys(context.pedagogy)).toHaveLength(0);
		});

		it('should calculate meta statistics', () => {
			const context = store.getAIContext(0.0);

			expect(context.meta.totalPreferences).toBe(3);
			expect(context.meta.highConfidenceCount).toBe(0); // None >= 0.8
			expect(context.meta.averageConfidence).toBeGreaterThan(0);
			expect(context.meta.lastLearned).toBeTruthy();
		});

		it('should detect high confidence preferences', () => {
			// Increase one preference to 0.8
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-3');
			store.learnPreference('structure', 'COLUMNS', ['A', 'B'], 'board-4'); // confidence = 0.8

			const context = store.getAIContext(0.0);
			expect(context.meta.highConfidenceCount).toBe(1);
		});
	});

	describe('8. deletePreference()', () => {
		it('should delete existing preference', () => {
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			expect(store.preferences).toHaveLength(1);

			const deleted = store.deletePreference('KEY');
			expect(deleted).toBe(true);
			expect(store.preferences).toHaveLength(0);
		});

		it('should return false for non-existent key', () => {
			const deleted = store.deletePreference('NON_EXISTENT');
			expect(deleted).toBe(false);
		});

		it('should persist deletion to localStorage', () => {
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			store.deletePreference('KEY');

			const stored = localStorage.getItem('user-preferences');
			const parsed = JSON.parse(stored!);
			expect(parsed.preferences).toHaveLength(0);
		});
	});

	describe('9. clear()', () => {
		it('should clear all preferences', () => {
			store.learnPreference('structure', 'KEY_1', 'value1', 'board-1');
			store.learnPreference('workflow', 'KEY_2', 'value2', 'board-1');
			expect(store.preferences).toHaveLength(2);

			store.clear();
			expect(store.preferences).toHaveLength(0);
		});

		it('should persist clear to localStorage', () => {
			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			store.clear();

			const stored = localStorage.getItem('user-preferences');
			const parsed = JSON.parse(stored!);
			expect(parsed.preferences).toHaveLength(0);
		});
	});

	describe('10. Export/Import', () => {
		beforeEach(() => {
			store.learnPreference('structure', 'KEY_1', 'value1', 'board-1');
			store.learnPreference('workflow', 'KEY_2', 'value2', 'board-1');
		});

		it('should export preferences as JSON', () => {
			const exported = store.exportPreferences();
			expect(exported).toBeTruthy();

			const parsed = JSON.parse(exported);
			expect(parsed.preferences).toHaveLength(2);
			expect(parsed.version).toBe('1.0');
			expect(parsed.lastExport).toBeTruthy();
		});

		it('should import with "replace" mode', () => {
			store.learnPreference('structure', 'KEY_3', 'value3', 'board-1');
			expect(store.preferences).toHaveLength(3);

			const exported = store.exportPreferences();
			store.clear();
			store.learnPreference('structure', 'KEY_4', 'value4', 'board-1');

			const success = store.importPreferences(exported, 'replace');
			expect(success).toBe(true);
			expect(store.preferences).toHaveLength(3); // Replaced with exported data
		});

		it('should import with "merge" mode', () => {
			const exported = store.exportPreferences();
			store.learnPreference('structure', 'KEY_3', 'value3', 'board-1'); // Add new

			const success = store.importPreferences(exported, 'merge');
			expect(success).toBe(true);
			expect(store.preferences).toHaveLength(3); // 2 old + 1 new
		});

		it('should import with "overwrite" mode', () => {
			// Change existing preference
			store.adaptPreference('KEY_1', 'modified-value', 'board-2');

			const exported = store.exportPreferences();

			// Create new store with same key but different value
			store.clear();
			store.learnPreference('structure', 'KEY_1', 'different-value', 'board-3');
			store.learnPreference('structure', 'KEY_3', 'value3', 'board-3');

			const success = store.importPreferences(exported, 'overwrite');
			expect(success).toBe(true);

			const key1 = store.getPreference('KEY_1');
			expect(key1!.value).toBe('modified-value'); // Overwritten

			const key3 = store.getPreference('KEY_3');
			expect(key3).toBeTruthy(); // Still exists (not overwritten, not in import)
		});

		it('should reject invalid JSON', () => {
			const success = store.importPreferences('invalid-json', 'merge');
			expect(success).toBe(false);
		});

		it('should reject invalid structure', () => {
			const invalidJson = JSON.stringify({ foo: 'bar' }); // Missing preferences array
			const success = store.importPreferences(invalidJson, 'merge');
			expect(success).toBe(false);
		});
	});

	describe('11. Reactive Properties ($derived)', () => {
		it('should update categorizedPreferences via getter method', () => {
			// NOTE: In unit tests, $derived doesn't auto-recompute like in Svelte components.
			// We use getCategorizedPreferences() which is a non-reactive getter for testing.
			// In real Svelte components, store.categorizedPreferences works reactively!
			
			expect(store.getCategorizedPreferences().structure).toHaveLength(0);

			store.learnPreference('structure', 'KEY', 'value', 'board-1');
			expect(store.getCategorizedPreferences().structure).toHaveLength(1);

			store.learnPreference('workflow', 'KEY2', 'value2', 'board-1');
			expect(store.getCategorizedPreferences().workflow).toHaveLength(1);
		});

		it('should reflect all 5 categories', () => {
			store.learnPreference('structure', 'K1', 'v1', 'board-1');
			store.learnPreference('workflow', 'K2', 'v2', 'board-1');
			store.learnPreference('pedagogy', 'K3', 'v3', 'board-1');
			store.learnPreference('constraints', 'K4', 'v4', 'board-1');
			store.learnPreference('content', 'K5', 'v5', 'board-1');

			// Use getter method for testing (non-reactive)
			const categorized = store.getCategorizedPreferences();
			expect(categorized.structure).toHaveLength(1);
			expect(categorized.workflow).toHaveLength(1);
			expect(categorized.pedagogy).toHaveLength(1);
			expect(categorized.constraints).toHaveLength(1);
			expect(categorized.content).toHaveLength(1);
		});
	});

	describe('12. Deep Equality', () => {
		it('should detect equal arrays', () => {
			store.learnPreference('structure', 'KEY', [1, 2, 3], 'board-1');
			const result = store.learnPreference('structure', 'KEY', [1, 2, 3], 'board-2');

			expect(result.preference.confidence).toBe(0.6); // Increased (equal)
		});

		it('should detect unequal arrays', () => {
			store.learnPreference('structure', 'KEY', [1, 2, 3], 'board-1');
			const result = store.learnPreference('structure', 'KEY', [1, 2, 4], 'board-2');

			expect(result.preference.confidence).toBe(0.3); // Decreased (not equal)
		});

		it('should detect equal objects', () => {
			store.learnPreference('structure', 'KEY', { a: 1, b: 2 }, 'board-1');
			const result = store.learnPreference('structure', 'KEY', { a: 1, b: 2 }, 'board-2');

			expect(result.preference.confidence).toBe(0.6); // Increased
		});

		it('should detect unequal objects', () => {
			store.learnPreference('structure', 'KEY', { a: 1, b: 2 }, 'board-1');
			const result = store.learnPreference('structure', 'KEY', { a: 1, b: 3 }, 'board-2');

			expect(result.preference.confidence).toBe(0.3); // Decreased
		});

		it('should handle nested structures', () => {
			const value1 = { a: { b: [1, 2, { c: 3 }] } };
			const value2 = { a: { b: [1, 2, { c: 3 }] } };

			store.learnPreference('structure', 'KEY', value1, 'board-1');
			const result = store.learnPreference('structure', 'KEY', value2, 'board-2');

			expect(result.preference.confidence).toBe(0.6); // Equal
		});
	});
});
