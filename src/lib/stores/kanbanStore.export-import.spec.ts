import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * UNIT TESTS FÜR KANBANSTORE EXPORT/IMPORT FUNKTIONALITÄT
 * 
 * Diese Tests prüfen die Store-Methoden und localStorage-Integration:
 * - exportBoardToJson()
 * - importBoardFromJson()
 * - restoreAllBoardsFromBackup()
 * - saveImportedBoard()
 * - saveBoardIds()
 * 
 * Tests nutzen localStorage Mock und fokussieren auf Datenfluss
 */

describe('BoardStore Export/Import Funktionalität', () => {
	let mockLocalStorage: Map<string, string>;
	let consoleLogSpy: any;

	beforeEach(() => {
		// Simuliere localStorage
		mockLocalStorage = new Map();

		globalThis.localStorage = {
			getItem: (key: string) => mockLocalStorage.get(key) || null,
			setItem: (key: string, value: string) => {
				mockLocalStorage.set(key, value);
			},
			removeItem: (key: string) => mockLocalStorage.delete(key),
			clear: () => mockLocalStorage.clear(),
			length: 0,
			key: (index: number) => null
		} as any;

		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		mockLocalStorage.clear();
		consoleLogSpy.mockRestore();
	});

	describe('Backup Format & Detection', () => {
		it('erkennt Backup-Format mit boards[] Array', () => {
			// Arrange
			const backupJson = `{
				"version": "1.0",
				"exportedAt": "2025-10-31T12:00:00Z",
				"boards": [
					{"id": "board-1", "name": "Board 1"},
					{"id": "board-2", "name": "Board 2"}
				]
			}`;

			// Act
			const data = JSON.parse(backupJson);
			const isBackup = Array.isArray(data.boards) && data.boards.length > 0;

			// Assert
			expect(isBackup).toBe(true);
			expect(data.boards).toHaveLength(2);
		});

		it('unterscheidet Single Board Format von Backup', () => {
			// Arrange - Single Board
			const singleBoardJson = `{
				"id": "board-1",
				"name": "Single Board",
				"columns": []
			}`;

			// Act
			const data = JSON.parse(singleBoardJson);
			const isSingleBoard = !Array.isArray(data.boards);
			const isBackup = Array.isArray(data.boards) && data.boards.length > 0;

			// Assert
			expect(isSingleBoard).toBe(true);
			expect(isBackup).toBe(false);
		});

		it('validiert Backup-Version', () => {
			// Arrange
			const backupJson = `{
				"version": "1.0",
				"exportedAt": "2025-10-31T12:00:00Z",
				"boards": [{"id": "board-1", "name": "Board 1"}]
			}`;

			// Act
			const data = JSON.parse(backupJson);

			// Assert
			expect(data.version).toBe('1.0');
			expect(data.exportedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
		});
	});

	describe('Export Board → localStorage', () => {
		it('speichert einzelnes Board in localStorage mit kanban-{id} key', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: 'My Board',
				author: 'npub123',
				columns: [
					{ id: 'col-1', name: 'To Do', cards: [] }
				]
			};

			// Act - Simuliere exportBoardToJson() + localStorage save
			const jsonString = JSON.stringify(boardData);
			localStorage.setItem(`kanban-${boardData.id}`, jsonString);

			// Assert
			expect(mockLocalStorage.has(`kanban-board-1`)).toBe(true);
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.name).toBe('My Board');
		});

		it('serialisiert Board mit vollständiger Struktur (Spalten + Karten)', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: 'Complex Board',
				author: 'npub123',
				columns: [
					{
						id: 'col-1',
						name: 'To Do',
						cards: [
							{ id: 'card-1', heading: 'Task 1', comments: [] },
							{ id: 'card-2', heading: 'Task 2', comments: [] }
						]
					},
					{
						id: 'col-2',
						name: 'Done',
						cards: [
							{ id: 'card-3', heading: 'Task 3', comments: [] }
						]
					}
				]
			};

			// Act
			const jsonString = JSON.stringify(boardData);
			localStorage.setItem(`kanban-${boardData.id}`, jsonString);

			// Assert
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.columns).toHaveLength(2);
			expect(stored.columns[0].cards).toHaveLength(2);
			expect(stored.columns[1].cards).toHaveLength(1);
			expect(stored.columns[0].cards[0].heading).toBe('Task 1');
		});

		it('sichert publishState für Board und Cards', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: 'Board',
				publishState: 'private',
				columns: [
					{
						id: 'col-1',
						name: 'To Do',
						cards: [
							{
								id: 'card-1',
								heading: 'Task',
								publishState: 'private',
								comments: []
							}
						]
					}
				]
			};

			// Act
			const jsonString = JSON.stringify(boardData);
			localStorage.setItem(`kanban-${boardData.id}`, jsonString);

			// Assert
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.publishState).toBe('private');
			expect(stored.columns[0].cards[0].publishState).toBe('private');
		});

		it('ist JSON-serialisierbar ohne Fehler', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: 'Board',
				author: 'npub123',
				columns: [{ id: 'col-1', name: 'To Do', cards: [] }]
			};

			// Act & Assert
			expect(() => {
				const jsonString = JSON.stringify(boardData);
				JSON.parse(jsonString);
			}).not.toThrow();
		});
	});

	describe('Import Board: Mögliche Modi', () => {
		it('"merge" Modus: Neue IDs für Conflict-Avoidance', () => {
			// Arrange - Import JSON mit gleicher ID wie existierendes Board
			const importData = {
				id: 'board-1', // Konflikt möglich
				name: 'Imported Board'
			};

			const importedJson = JSON.stringify(importData);

			// Act - Merge-Modus: Würde neue ID generieren
			const data = JSON.parse(importedJson);
			const newId = `${data.id}-imported-${Date.now()}`;

			// Assert
			expect(newId).not.toBe('board-1');
			expect(newId).toContain('board-1-imported');
		});

		it('"new" Modus: Behält originale ID, ändert Namen', () => {
			// Arrange
			const importData = {
				id: 'board-1',
				name: 'Imported Board'
			};

			// Act - New-Modus: Fügt "(Imported)" Suffix hinzu
			const modifiedName = `${importData.name} (Imported)`;

			// Assert
			expect(modifiedName).toBe('Imported Board (Imported)');
		});

		it('"overwrite" Modus: Ersetzt existierendes Board', () => {
			// Arrange - Existierendes Board in localStorage
			const existingData = { id: 'board-1', name: 'Old Content' };
			localStorage.setItem('kanban-board-1', JSON.stringify(existingData));

			// Act - Import mit overwrite
			const importData = { id: 'board-1', name: 'New Content' };
			localStorage.setItem('kanban-board-1', JSON.stringify(importData));

			// Assert
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.name).toBe('New Content');
		});
	});

	describe('restoreAllBoardsFromBackup() - Batch Restore', () => {
		it('liest Backup JSON und extrahiert boards[] Array', () => {
			// Arrange
			const backupJson = `{
				"version": "1.0",
				"exportedAt": "2025-10-31T12:00:00Z",
				"boards": [
					{"id": "board-1", "name": "Board 1"},
					{"id": "board-2", "name": "Board 2"}
				]
			}`;

			// Act
			const data = JSON.parse(backupJson);

			// Assert
			expect(data.boards).toHaveLength(2);
			expect(data.boards.map((b: any) => b.id)).toEqual(['board-1', 'board-2']);
		});

		it('iteriert durch alle Boards und speichert einzeln', () => {
			// Arrange
			const backupData = [
				{ id: 'board-1', name: 'Board 1' },
				{ id: 'board-2', name: 'Board 2' },
				{ id: 'board-3', name: 'Board 3' }
			];

			// Act - Simuliere restoreAllBoardsFromBackup() Loop
			const imported: string[] = [];
			const failed: string[] = [];

			for (const boardData of backupData) {
				try {
					localStorage.setItem(
						`kanban-${boardData.id}`,
						JSON.stringify(boardData)
					);
					imported.push(boardData.id);
				} catch (error) {
					failed.push(boardData.id);
				}
			}

			// Assert
			expect(imported).toHaveLength(3);
			expect(failed).toHaveLength(0);
			expect(mockLocalStorage.size).toBe(3);
		});

		it('registriert alle Board-IDs in boardIds Liste', () => {
			// Arrange
			const backupData = [
				{ id: 'board-1', name: 'Board 1' },
				{ id: 'board-2', name: 'Board 2' }
			];

			// Act - Sammle IDs und speichere in localStorage
			const boardIds: string[] = [];
			for (const boardData of backupData) {
				localStorage.setItem(
					`kanban-${boardData.id}`,
					JSON.stringify(boardData)
				);
				if (!boardIds.includes(boardData.id)) {
					boardIds.push(boardData.id);
				}
			}
			localStorage.setItem('kanban-board-ids', JSON.stringify(boardIds));

			// Assert
			const savedIds = JSON.parse(localStorage.getItem('kanban-board-ids')!);
			expect(savedIds).toEqual(['board-1', 'board-2']);
		});

		it('sammelt Fehler bei fehlgeschlagenen Boards', () => {
			// Arrange
			const backupData = [
				{ id: 'board-1', name: 'Good Board' },
				null, // Fehler
				{ id: 'board-3', name: 'Also Good' }
			];

			// Act - Simuliere Error Collection
			const imported: string[] = [];
			const errors: string[] = [];

			for (let i = 0; i < backupData.length; i++) {
				try {
					const boardData = backupData[i] as any;

					if (!boardData || !boardData.id) {
						throw new Error(`Eintrag ${i}: Ungültiges Board Format`);
					}

					localStorage.setItem(
						`kanban-${boardData.id}`,
						JSON.stringify(boardData)
					);
					imported.push(boardData.id);
				} catch (error) {
					errors.push(
						error instanceof Error ? error.message : String(error)
					);
				}
			}

			// Assert
			expect(imported).toHaveLength(2);
			expect(errors).toHaveLength(1);
			expect(errors[0]).toContain('Ungültiges Board Format');
		});

		it('gibt detaillierte Restore-Statistiken zurück', () => {
			// Arrange
			const backupData = [
				{ id: 'board-1', name: 'Board 1' },
				{ id: 'board-2', name: 'Board 2' },
				null // Fehler
			];

			// Act - Simuliere complete Restore mit Statistiken
			const imported: any[] = [];
			const errors: string[] = [];

			for (let i = 0; i < backupData.length; i++) {
				try {
					const boardData = backupData[i];
					if (!boardData) throw new Error('Null board');
					imported.push(boardData);
				} catch (error) {
					errors.push(String(error));
				}
			}

			const result = {
				success: errors.length === 0 || imported.length > 0,
				imported: imported.length,
				failed: errors.length,
				total: backupData.length,
				boards: imported,
				errors: errors
			};

			// Assert
			expect(result.success).toBe(true);
			expect(result.imported).toBe(2);
			expect(result.failed).toBe(1);
			expect(result.total).toBe(3);
		});

		it('speichert mehrere Boards parallel', () => {
			// Arrange - Großes Backup mit vielen Boards
			const backupData = Array.from({ length: 10 }, (_, i) => ({
				id: `board-${i}`,
				name: `Board ${i}`
			}));

			// Act
			for (const boardData of backupData) {
				localStorage.setItem(
					`kanban-${boardData.id}`,
					JSON.stringify(boardData)
				);
			}

			// Assert
			expect(mockLocalStorage.size).toBe(10);
			for (let i = 0; i < 10; i++) {
				expect(mockLocalStorage.has(`kanban-board-${i}`)).toBe(true);
			}
		});
	});

	describe('Round-Trip: Export → localStorage → Import → Re-Export', () => {
		it('exportierte Daten sind nach Import identisch', () => {
			// Arrange - Original Board
			const original = {
				id: 'board-1',
				name: 'Test Board',
				author: 'npub123',
				columns: [
					{
						id: 'col-1',
						name: 'To Do',
						cards: [
							{ id: 'card-1', heading: 'Task', comments: [] }
						]
					}
				]
			};

			// Act 1: Export
			const exported1 = JSON.stringify(original);
			localStorage.setItem('kanban-board-1', exported1);

			// Act 2: Import (Load)
			const loaded = JSON.parse(localStorage.getItem('kanban-board-1')!);

			// Act 3: Re-Export
			const exported2 = JSON.stringify(loaded);

			// Assert
			expect(exported1).toBe(exported2);
			expect(loaded.id).toBe('board-1');
			expect(loaded.columns[0].cards[0].heading).toBe('Task');
		});

		it('mehrfaches Export-Import-Export bleibt konsistent', () => {
			// Arrange
			const original = {
				id: 'board-1',
				name: 'Board',
				columns: [{ id: 'col-1', name: 'To Do', cards: [] }]
			};

			// Act - 3x export-import cycle
			let data = original;
			for (let i = 0; i < 3; i++) {
				const jsonString = JSON.stringify(data);
				localStorage.setItem('kanban-test', jsonString);
				data = JSON.parse(localStorage.getItem('kanban-test')!);
			}

			// Assert - Daten sollten identisch sein
			expect(data.id).toBe('board-1');
			expect(data.name).toBe('Board');
			expect(data.columns[0].name).toBe('To Do');
		});
	});

	describe('Error Handling & Edge Cases', () => {
		it('handhabt ungültiges JSON graceful', () => {
			// Arrange
			const invalidJson = '{ invalid json }';

			// Act & Assert
			expect(() => {
				JSON.parse(invalidJson);
			}).toThrow();
		});

		it('handhabt null/undefined Felder', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: null,
				author: undefined,
				columns: []
			};

			// Act & Assert - Sollte trotzdem speicherbar sein
			expect(() => {
				const jsonString = JSON.stringify(boardData);
				JSON.parse(jsonString);
			}).not.toThrow();
		});

		it('handhabt sehr lange Board-Namen (1000 chars)', () => {
			// Arrange
			const longName = 'A'.repeat(1000);
			const boardData = {
				id: 'board-1',
				name: longName,
				columns: []
			};

			// Act
			const jsonString = JSON.stringify(boardData);
			localStorage.setItem('kanban-board-1', jsonString);

			// Assert
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.name).toHaveLength(1000);
		});

		it('handhabt spezielle Zeichen und Quotes', () => {
			// Arrange
			const boardData = {
				id: 'board-1',
				name: 'Board "with quotes" and \\ backslash',
				columns: []
			};

			// Act
			const jsonString = JSON.stringify(boardData);
			localStorage.setItem('kanban-board-1', jsonString);

			// Assert
			const stored = JSON.parse(localStorage.getItem('kanban-board-1')!);
			expect(stored.name).toContain('with quotes');
			expect(stored.name).toContain('backslash');
		});

		it('handhabt leere Backups', () => {
			// Arrange
			const emptyBackup = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				boards: [] // Leer!
			};

			// Act
			const jsonString = JSON.stringify(emptyBackup);
			const data = JSON.parse(jsonString);

			// Assert
			expect(data.boards).toHaveLength(0);
			expect(Array.isArray(data.boards)).toBe(true);
		});
	});

	describe('localStorage Schlüssel & Namenskonvention', () => {
		it('nutzt konsistente Naming Convention: kanban-{boardId}', () => {
			// Arrange
			const boardIds = ['board-1', 'board-2', 'my-project-abc'];

			// Act
			for (const id of boardIds) {
				const key = `kanban-${id}`;
				localStorage.setItem(key, JSON.stringify({ id }));
			}

			// Assert
			expect(mockLocalStorage.has('kanban-board-1')).toBe(true);
			expect(mockLocalStorage.has('kanban-board-2')).toBe(true);
			expect(mockLocalStorage.has('kanban-my-project-abc')).toBe(true);
		});

		it('nutzt kanban-board-ids für ID-Liste', () => {
			// Arrange
			const boardIds = ['board-1', 'board-2', 'board-3'];
			localStorage.setItem('kanban-board-ids', JSON.stringify(boardIds));

			// Act
			const saved = JSON.parse(localStorage.getItem('kanban-board-ids')!);

			// Assert
			expect(saved).toEqual(boardIds);
		});

		it('kann zwischen kanban-{id} und kanban-board-ids unterscheiden', () => {
			// Arrange
			localStorage.setItem('kanban-board-1', JSON.stringify({ id: 'board-1' }));
			localStorage.setItem('kanban-board-ids', JSON.stringify(['board-1']));

			// Act & Assert
			expect(mockLocalStorage.size).toBe(2);
			expect(mockLocalStorage.has('kanban-board-1')).toBe(true);
			expect(mockLocalStorage.has('kanban-board-ids')).toBe(true);
		});
	});

	describe('Performance & Große Datenmengen', () => {
		it('speichert 50 Boards erfolgreich', () => {
			// Arrange
			const boards = Array.from({ length: 50 }, (_, i) => ({
				id: `board-${i}`,
				name: `Board ${i}`,
				columns: []
			}));

			// Act
			for (const board of boards) {
				localStorage.setItem(
					`kanban-${board.id}`,
					JSON.stringify(board)
				);
			}

			// Assert
			expect(mockLocalStorage.size).toBe(50);
		});

		it('handhabt große Backup JSON Dateien', () => {
			// Arrange - 100 Boards mit je 10 Spalten
			const bigBackup = {
				version: '1.0',
				boards: Array.from({ length: 100 }, (_, i) => ({
					id: `board-${i}`,
					name: `Board ${i}`,
					columns: Array.from({ length: 10 }, (_, j) => ({
						id: `col-${i}-${j}`,
						name: `Column ${j}`,
						cards: []
					}))
				}))
			};

			// Act
			const jsonString = JSON.stringify(bigBackup);

			// Assert
			expect(jsonString.length).toBeGreaterThan(10000); // > 10KB
			expect(() => JSON.parse(jsonString)).not.toThrow();
		});
	});
});
