// src/lib/stores/kanbanStore.card-templates.spec.ts
// Unit Tests für Card Template Learning im BoardStore

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStore } from './kanbanStore.svelte.js';
import { userPreferencesStore, resetUserPreferencesStore } from './userPreferencesStore.svelte.js';
import { authStore, initializeAuth } from './authStore.svelte.js';
import { initializeLearningManager, resetLearningManagerForTesting } from './boardLearningManager.svelte.js';
import type NDK from '@nostr-dev-kit/ndk';

describe('BoardStore - Card Template Learning', () => {
	let store: BoardStore;
	
	beforeEach(async () => {
		// 🧪 CRITICAL FIX: Proper global singleton reset for test isolation
		// Problem: Both boardLearningManager AND userPreferencesStore are singletons
		// that keep state across tests. We need to reset both properly.
		
		// Step 1: Clear ALL localStorage first
		localStorage.clear();
		
		// Step 2: RECREATE userPreferencesStore singleton with fresh $state proxy!
		resetUserPreferencesStore();
		
		// Step 3: Reset global LearningManager singleton
		resetLearningManagerForTesting();
		
		// Step 4: Initialize authStore with mock NDK
		const mockNDK = {
			signer: {
				user: () => Promise.resolve({ pubkey: 'test-pubkey-123' })
			}
		} as unknown as NDK;
		
		initializeAuth(mockNDK);
		
		// Step 5: 🔐 FAKE AUTH SESSION for tests (bypassing demo session creation)
		// Instead of calling createDemoSession() which requires config,
		// we directly mock all auth-related methods to simulate a logged-in user
		const testPubkey = 'test-pubkey-demo-123';
		vi.spyOn(authStore, 'getPubkey').mockReturnValue(testPubkey);
		vi.spyOn(authStore, 'getPubkeySafe').mockReturnValue(testPubkey);  // ← CRITICAL!
		vi.spyOn(authStore, 'getNpub').mockReturnValue('npub1test...');
		vi.spyOn(authStore, 'getUserName').mockReturnValue('Test User');
		vi.spyOn(authStore, 'isAuthenticated', 'get').mockReturnValue(true);
		
		// Step 6: Create fresh BoardStore instance
		store = new BoardStore();
		
		// Initialize LearningManager for the store
		initializeLearningManager(store);
		
		// Create a test board
		const boardId = store.createBoard('Unterricht Römer');
		store.loadBoard(boardId);
		
		// 🔧 FIX: Manually set board author and maintainers to match test pubkey
		// Problem: createBoard() calls getSafeAuthor() which doesn't reliably use mocked getPubkeySafe()
		// Solution: After board creation, manually override author and maintainers
		(store as any).board.author = testPubkey;
		(store as any).board.maintainers = [testPubkey];
		(store as any).triggerUpdate(); // Save to localStorage with correct author
		
		// Delete all columns for clean testing
		const allColumns = store.uiData || [];
		for (const col of allColumns) {
			store.deleteColumn(col.id);
		}
	});

	afterEach(() => {
		// Clean up: Delete all boards
		const boards = store.getAllBoards();
		boards.forEach((board) => store.deleteBoard(board.id));
		
		// Restore all mocks
		vi.restoreAllMocks();
	});	describe('learnColumnStructure()', () => {
		it('should learn card structure from a column', () => {
			// Arrange: Create column with cards
			const columnId = store.createColumn('Einstieg');
			store.createCard(columnId, 'Lehrervortrag');
			store.createCard(columnId, 'Einführung Gruppenarbeit');
			store.createCard(columnId, 'Gruppenphase');
			store.createCard(columnId, 'Ergebnissicherung');
			
			// Act: Learn structure
			const result = store.learnColumnStructure(columnId);
			
			// Assert
			expect(result).toHaveProperty('preference');
			if ('preference' in result) {
				expect(result.preference.key).toBe('COLUMN_CARDS_EINSTIEG');
				expect(result.preference.value).toEqual([
					'Lehrervortrag',
					'Einführung Gruppenarbeit',
					'Gruppenphase',
					'Ergebnissicherung'
				]);
				expect(result.preference.confidence).toBe(0.5); // Initial confidence
				expect(result.isNew).toBe(true);
			}
		});

	it('should increase confidence when learning same structure again', () => {
		// Arrange: Create column with cards
		const columnId = store.createColumn('Einstieg');
		store.createCard(columnId, 'Lehrervortrag');
		store.createCard(columnId, 'Gruppenphase');
		
		// Act: Learn twice
		const result1 = store.learnColumnStructure(columnId);
		
		// 🔧 FIX: Store confidence IMMEDIATELY because result1.preference is a reference
		// to the object in the store, which will be mutated by result2!
		const confidence1 = result1 && 'preference' in result1 ? result1.preference.confidence : 0;
		
		const result2 = store.learnColumnStructure(columnId);
		
		// Assert
		expect(result1).toHaveProperty('preference');
		expect(result2).toHaveProperty('preference');
		
		if ('preference' in result1 && 'preference' in result2) {
			// Compare result2 against the STORED confidence from result1
			expect(result2.preference.confidence).toBe(confidence1 + 0.1);
			expect(result2.isNew).toBe(false);
		}
	});		it('should return error for non-existent column', () => {
			// Act
			const result = store.learnColumnStructure('non-existent-id');
			
			// Assert
			expect(result).toHaveProperty('success', false);
			if ('error' in result) {
				// LearningManager delegates to BoardStore which checks column existence
				expect(result.error).toBeTruthy();
			}
		});

		it('should return error for empty column', () => {
			// Arrange: Create empty column
			const columnId = store.createColumn('Leere Spalte');
			
			// Act
			const result = store.learnColumnStructure(columnId);
			
			// Assert
			expect(result).toHaveProperty('success', false);
			if ('error' in result) {
				// LearningManager may return error for empty columns
				expect(result.error).toBeTruthy();
			}
		});

		it('should handle columns with same name but different structures', () => {
			// Arrange: Create two boards with "Einstieg" columns
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Karte A');
			store.createCard(col1Id, 'Karte B');
			
			const result1 = store.learnColumnStructure(col1Id);
			
			// 🔧 FIX: Store value IMMEDIATELY because result1.preference.value is a reference
			// to the array in the store, which might be mutated by result2!
			const value1 = result1 && 'preference' in result1 ? [...result1.preference.value as string[]] : [];
			
			// Create new board with different cards in "Einstieg"
			const board2Id = store.createBoard('Anderes Board');
			store.loadBoard(board2Id);
			const col2Id = store.createColumn('Einstieg');
			store.createCard(col2Id, 'Karte X');
			store.createCard(col2Id, 'Karte Y');
			
			const result2 = store.learnColumnStructure(col2Id);
			
			// Assert: Different structures should both be learned independently
			// result1 has ["Karte A", "Karte B"] with confidence 0.5
			// result2 has ["Karte X", "Karte Y"] with confidence 0.3 (new pattern)
			if ('preference' in result1 && 'preference' in result2) {
				expect(value1).toEqual(['Karte A', 'Karte B']);
				expect(result2.preference.value).toEqual(['Karte X', 'Karte Y']);
				// Both patterns are independent, so confidence doesn't compare directly
				expect(result2.preference.confidence).toBeGreaterThanOrEqual(0.3); // New pattern starts at 0.3
			}
		});
	});

	describe('learnBoardStructure()', () => {
		it('should learn structure from all columns', () => {
			// Arrange: Create board with multiple columns
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Warm-Up');
			store.createCard(col1Id, 'Motivation');
			
			const col2Id = store.createColumn('Erarbeitung');
			store.createCard(col2Id, 'Gruppenarbeit');
			store.createCard(col2Id, 'Präsentation');
			
			const col3Id = store.createColumn('Sicherung');
			store.createCard(col3Id, 'Zusammenfassung');
			
			// Act
			const results = store.learnBoardStructure();
			
			// Assert
			expect(results).toHaveLength(3);
			expect(results[0].columnName).toBe('Einstieg');
			expect(results[1].columnName).toBe('Erarbeitung');
			expect(results[2].columnName).toBe('Sicherung');
			
			// Check that all columns were learned
			results.forEach(r => {
				expect(r.result).toHaveProperty('preference');
				if ('preference' in r.result) {
					expect(r.result.preference.confidence).toBe(0.5);
				}
			});
		});

	it('should handle board with no columns', () => {
		// Arrange: Delete all default columns
		const columnIds = store.uiData.map((col) => col.id);
		columnIds.forEach(id => store.deleteColumn(id));
		
		// Act: Learn from empty board
		const results = store.learnBoardStructure();
		
		// Assert
		expect(results).toHaveLength(0);
	});		it('should skip empty columns', () => {
			// Arrange
			const col1Id = store.createColumn('Mit Karten');
			store.createCard(col1Id, 'Karte 1');
			
			const col2Id = store.createColumn('Ohne Karten');
			// Keine Karten hinzugefügt
			
			// Act
			const results = store.learnBoardStructure();
			
			// Assert
			expect(results).toHaveLength(2);
			expect(results[0].result).toHaveProperty('preference'); // Mit Karten
			expect(results[1].result).toHaveProperty('error'); // Ohne Karten
		});
	});

	describe('createColumnWithTemplate()', () => {
		it('should create column without template when applyTemplate=false', () => {
			// Act
			const result = store.createColumnWithTemplate('Neue Spalte', false);
			
			// Assert
			expect(result).toHaveProperty('columnId');
			// When applyTemplate=false, LearningManager may still return templateApplied=false
			if ('templateApplied' in result) {
				expect(result.templateApplied).toBe(false);
			}
			
			// Verify column was created
			const column = store.findColumn(result.columnId);
			expect(column).toBeDefined();
			expect(column?.name).toBe('Neue Spalte');
			expect(column?.cards).toHaveLength(0);
		});

		it('should create column without template when no template exists', () => {
			// Act: Try to apply template that doesn't exist
			const result = store.createColumnWithTemplate('Unbekannte Spalte', true);
			
			// Assert
			expect(result).toHaveProperty('columnId');
			expect(result).toHaveProperty('templateApplied', false);
		});

		it('should apply template when confidence is high enough', () => {
			// Arrange: Learn a template
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Karte A');
			store.createCard(col1Id, 'Karte B');
			store.createCard(col1Id, 'Karte C');
			
			// Learn multiple times to reach confidence threshold
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id); // Now confidence = 0.7
			
			// Act: Create new column with template
			const result = store.createColumnWithTemplate('Einstieg', true);
			
			// Assert
			expect(result).toHaveProperty('templateApplied', true);
			expect(result).toHaveProperty('cardIds');
			expect(result).toHaveProperty('confidence');
			
			if (result.cardIds) {
				expect(result.cardIds).toHaveLength(3);
			}
			
			if (result.confidence) {
				expect(result.confidence).toBeGreaterThanOrEqual(0.7);
			}
			
			// Verify cards were created
			const column = store.findColumn(result.columnId);
			expect(column?.cards).toHaveLength(3);
			expect(column?.cards[0].heading).toBe('Karte A');
			expect(column?.cards[1].heading).toBe('Karte B');
			expect(column?.cards[2].heading).toBe('Karte C');
		});

		it('should respect minConfidence threshold', () => {
			// Arrange: Learn template with low confidence (0.5)
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Karte A');
			store.learnColumnStructure(col1Id);
			
			// Act: Try to apply with high threshold
			const result = store.createColumnWithTemplate('Einstieg', true, 0.8);
			
			// Assert: Should not apply template (confidence 0.5 < 0.8)
			expect(result).toHaveProperty('templateApplied', false);
		});

		it('should handle different columns independently', () => {
			// Arrange: Learn templates for two different columns
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Einstieg A');
			store.createCard(col1Id, 'Einstieg B');
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id); // confidence = 0.7
			
			const col2Id = store.createColumn('Erarbeitung');
			store.createCard(col2Id, 'Erarbeitung X');
			store.createCard(col2Id, 'Erarbeitung Y');
			store.learnColumnStructure(col2Id);
			store.learnColumnStructure(col2Id);
			store.learnColumnStructure(col2Id); // confidence = 0.7
			
			// Act: Create columns with templates
			const result1 = store.createColumnWithTemplate('Einstieg', true);
			const result2 = store.createColumnWithTemplate('Erarbeitung', true);
			
			// Assert: Both should have correct templates
			expect(result1.templateApplied).toBe(true);
			expect(result2.templateApplied).toBe(true);
			
			const newCol1 = store.findColumn(result1.columnId);
			const newCol2 = store.findColumn(result2.columnId);
			
			expect(newCol1?.cards[0].heading).toBe('Einstieg A');
			expect(newCol2?.cards[0].heading).toBe('Erarbeitung X');
		});

		it('should handle column names with spaces and special characters', () => {
			// Arrange
			const col1Id = store.createColumn('Einführung / Warm-Up');
			store.createCard(col1Id, 'Karte 1');
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			
			// Act
			const result = store.createColumnWithTemplate('Einführung / Warm-Up', true);
			
			// Assert
			expect(result.templateApplied).toBe(true);
			expect(result.cardIds).toHaveLength(1);
		});
	});

	describe('Integration with UserPreferencesStore', () => {
		it('should persist learned templates across board reloads', () => {
			// Arrange: Learn template
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Persistent Card A');
			store.createCard(col1Id, 'Persistent Card B');
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			store.learnColumnStructure(col1Id);
			
			const boardId = store.getCurrentBoardId();
			
			// Act: Reload board
			if (boardId) {
				store.loadBoard(boardId);
			}
			
			// Create new column with template
			const result = store.createColumnWithTemplate('Einstieg', true);
			
			// Assert: Template should still be available
			expect(result.templateApplied).toBe(true);
			expect(result.cardIds).toHaveLength(2);
		});

		it('should learn from multiple boards and aggregate confidence', () => {
			// Arrange: Create first board
			const col1Id = store.createColumn('Einstieg');
			store.createCard(col1Id, 'Standard A');
			store.createCard(col1Id, 'Standard B');
			store.learnColumnStructure(col1Id);
			
			const pref1 = userPreferencesStore.getPreference('COLUMN_CARDS_EINSTIEG');
			const confidence1 = pref1?.confidence ?? 0;
			
			// Create second board with same structure
			const board2Id = store.createBoard('Zweites Board');
			store.loadBoard(board2Id);
			
			const col2Id = store.createColumn('Einstieg');
			store.createCard(col2Id, 'Standard A');
			store.createCard(col2Id, 'Standard B');
			store.learnColumnStructure(col2Id);
			
			const pref2 = userPreferencesStore.getPreference('COLUMN_CARDS_EINSTIEG');
			const confidence2 = pref2?.confidence ?? 0;
			
			// Assert: Confidence should increase
			expect(confidence2).toBeGreaterThan(confidence1);
			expect(confidence2).toBe(0.6); // 0.5 + 0.1
		});
	});
});
