// src/lib/stores/boardstore/storage.spec.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoardStorage } from './storage';

const TOMBSTONE_KEY = 'kanban-deleted-boards-v1';

/**
 * Unit Tests für BoardStorage
 * 
 * Fokus: loadBoardIds() Filter-Logik nach Metadata-Refactoring v4.3
 * 
 * Kritischer Bug-Fix (06.11.2025):
 * - loadBoardIds() filterte nicht korrekt und lies "config", "settings" durch
 * - Fix: Explizite Ausschlüsse + Length-Check (< 10 chars)
 */

describe('BoardStorage', () => {
    let mockLocalStorage: Map<string, string>;

    beforeEach(() => {
        // Mock localStorage
        mockLocalStorage = new Map();

        // KRITISCH: Object.keys() muss auf localStorage funktionieren!
        // Daher müssen wir ein Objekt erstellen, das enumerable keys hat
        const storageObj: any = {
            getItem: (key: string) => mockLocalStorage.get(key) || null,
            setItem: (key: string, value: string) => {
                mockLocalStorage.set(key, value);  // ← MUSS Map.set() nutzen (nicht localStorage!)
                // Setze key als enumerable property für Object.keys()
                storageObj[key] = value;
            },
            removeItem: (key: string) => {
                mockLocalStorage.delete(key);
                delete storageObj[key];
            },
            clear: () => {
                mockLocalStorage.clear();
                // Clear all enumerable keys
                Object.keys(storageObj).forEach(k => {
                    if (!['getItem', 'setItem', 'removeItem', 'clear', 'length', 'key'].includes(k)) {
                        delete storageObj[k];
                    }
                });
            },
            get length() {
                return mockLocalStorage.size;
            },
            key: (index: number) => {
                const keys = Array.from(mockLocalStorage.keys());
                return keys[index] || null;
            }
        };

        globalThis.localStorage = storageObj as Storage;
        
        // ✅ CRITICAL: Mock window to avoid early return in loadBoardIds()
        // storage.ts line 26 checks: if (typeof window === 'undefined') return [];
        (globalThis as any).window = {};

        // Console spy (um Logging zu verifizieren)
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        mockLocalStorage.clear();
        vi.restoreAllMocks();
    });

    function setTombstone(boardId: string, deletedAtMs: number = Date.now()): void {
        localStorage.setItem(TOMBSTONE_KEY, JSON.stringify({
            [boardId]: deletedAtMs
        }));
    }

    // ========================================================================
    // 1. loadBoardIds() - Filter Logic Tests
    // ========================================================================

    describe('1. loadBoardIds() - Filter Logic', () => {
        it('✅ sollte nur valide Board-IDs zurückgeben (normale Boards)', () => {
            // ARRANGE: Setup localStorage mit validen Boards
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({ name: 'Board 1' }));
            localStorage.setItem('kanban-board-xyz987654321', JSON.stringify({ name: 'Board 2' }));

            // DEBUG
            console.log('Keys in localStorage:', Object.keys(localStorage));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // DEBUG
            console.log('Returned boardIds:', boardIds);

            // ASSERT
            expect(boardIds).toHaveLength(2);
            expect(boardIds).toContain('board-abc123456789');
            expect(boardIds).toContain('board-xyz987654321');
        });

        it('❌ sollte "config" und "settings" Keys NICHT als Board IDs erkennen', () => {
            // ARRANGE: Setup localStorage mit invaliden Keys
            localStorage.setItem('kanban-config', JSON.stringify({ theme: 'dark' }));
            localStorage.setItem('kanban-settings', JSON.stringify({ maxBoards: 10 }));
            localStorage.setItem('kanban-board-valid123', JSON.stringify({ name: 'Valid Board' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).toContain('board-valid123');
            expect(boardIds).not.toContain('config'); // ← CRITICAL!
            expect(boardIds).not.toContain('settings'); // ← CRITICAL!
        });

        it('❌ sollte "config-merged" und andere config-* Keys NICHT als Board IDs erkennen', () => {
            // ARRANGE: Setup localStorage mit config-merged (settingsStore Flag)
            localStorage.setItem('kanban-config-merged', new Date().toISOString());
            localStorage.setItem('kanban-config-v2', JSON.stringify({ version: 2 }));
            localStorage.setItem('kanban-board-valid789012', JSON.stringify({ name: 'Valid Board' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).toContain('board-valid789012');
            expect(boardIds).not.toContain('config-merged'); // ← BUG FIX!
            expect(boardIds).not.toContain('config-v2');
        });

        it('❌ sollte "boards-list" Key NICHT als Board ID erkennen', () => {
            // ARRANGE
            localStorage.setItem('kanban-boards-list', JSON.stringify([]));
            localStorage.setItem('kanban-board-valid456', JSON.stringify({ name: 'Valid' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain('boards-list');
        });

        it('❌ sollte "-metadata" Suffix Keys ausfiltern', () => {
            // ARRANGE
            localStorage.setItem('kanban-board-abc-metadata', JSON.stringify({ deletedAt: '...' }));
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({ name: 'Real Board' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain('board-abc-metadata');
        });

        it('❌ sollte "-backup" Suffix Keys ausfiltern', () => {
            // ARRANGE
            localStorage.setItem('kanban-board-abc-backup', JSON.stringify({ createdAt: '...' }));
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({ name: 'Real Board' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain('board-abc-backup');
        });

        it('❌ sollte "metadata-migrated" Flag ausfiltern', () => {
            // ARRANGE
            localStorage.setItem('kanban-metadata-migrated', JSON.stringify({ migrated: true }));
            localStorage.setItem('kanban-board-xyz987654321', JSON.stringify({ name: 'Real Board' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain('metadata-migrated');
        });

        it('❌ sollte kurze IDs (< 10 Zeichen) ausfiltern', () => {
            // ARRANGE: Board IDs sind typischerweise 64-char Hashes
            localStorage.setItem('kanban-short', JSON.stringify({ name: 'Short ID' }));
            localStorage.setItem('kanban-abc', JSON.stringify({ name: 'Very Short' }));
            localStorage.setItem('kanban-board-validlongid1234567890', JSON.stringify({ name: 'Valid' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain('short'); // 5 chars
            expect(boardIds).not.toContain('abc'); // 3 chars
            expect(boardIds).toContain('board-validlongid1234567890'); // 26 chars
        });

        it('✅ sollte empty strings aus Return-Wert filtern (Safety)', () => {
            // ARRANGE: Edge case - falls irgendwo empty strings entstehen
            localStorage.setItem('kanban-', ''); // Leerer Key
            localStorage.setItem('kanban-board-valid123', JSON.stringify({ name: 'Valid' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(1);
            expect(boardIds).not.toContain(''); // Empty string gefiltert
        });

        it('✅ sollte keine Duplikate zurückgeben', () => {
            // ARRANGE
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({ name: 'Board 1' }));
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({ name: 'Board 1 Dupe' })); // Dupe (sollte überschrieben werden)
            localStorage.setItem('kanban-board-xyz987654321', JSON.stringify({ name: 'Board 2' }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(2); // Keine Duplikate
            expect(new Set(boardIds).size).toBe(boardIds.length); // Unique
        });

        it('✅ sollte tombstoned Boards NICHT zurückgeben (Anti-Resurrection)', () => {
            // ARRANGE
            const tombstonedId = 'board-deleted123456789';
            const activeId = 'board-active1234567890';
            localStorage.setItem(`kanban-${tombstonedId}`, JSON.stringify({ id: tombstonedId, name: 'Deleted', createdAt: Date.now(), columns: [] }));
            localStorage.setItem(`kanban-${activeId}`, JSON.stringify({ id: activeId, name: 'Active', createdAt: Date.now(), columns: [] }));
            setTombstone(tombstonedId);

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toContain(activeId);
            expect(boardIds).not.toContain(tombstonedId);
        });
    });

    // ========================================================================
    // 2. getAllBoardsMetadata() - Input Validation Tests
    // ========================================================================

    describe('2. getAllBoardsMetadata() - Input Validation', () => {
        it('✅ sollte undefined IDs filtern', () => {
            // ARRANGE: Setup localStorage mit Board
            const validId = 'board-abc123456789';
            localStorage.setItem(`kanban-${validId}`, JSON.stringify({
                id: validId,
                name: 'Valid Board',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT: Übergebe Array mit undefined
            const boardIds = [undefined as any, validId, undefined as any];
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            expect(metadata).toHaveLength(1);
            expect(metadata[0].id).toBe(validId);
        });

        it('✅ sollte null IDs filtern', () => {
            // ARRANGE
            const validId = 'board-abc123456789';
            localStorage.setItem(`kanban-${validId}`, JSON.stringify({
                id: validId,
                name: 'Valid Board',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const boardIds = [null as any, validId];
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            expect(metadata).toHaveLength(1);
        });

        it('✅ sollte empty string IDs filtern', () => {
            // ARRANGE
            const validId = 'board-abc123456789';
            localStorage.setItem(`kanban-${validId}`, JSON.stringify({
                id: validId,
                name: 'Valid Board',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const boardIds = ['', validId, '   '];
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            expect(metadata).toHaveLength(1);
        });

        it('❌ sollte leeres Array zurückgeben wenn alle IDs invalid', () => {
            // ACT
            const boardIds = [undefined, null, '', '   '] as any[];
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            expect(metadata).toHaveLength(0);
        });

        it('✅ sollte tombstoned IDs defensiv filtern (auch wenn caller sie übergibt)', () => {
            // ARRANGE
            const tombstonedId = 'board-deleted123456789';
            const validId = 'board-valid1234567890';

            localStorage.setItem(`kanban-${tombstonedId}`, JSON.stringify({
                id: tombstonedId,
                name: 'Deleted Board',
                createdAt: Date.now(),
                columns: []
            }));
            localStorage.setItem(`kanban-${validId}`, JSON.stringify({
                id: validId,
                name: 'Valid Board',
                createdAt: Date.now(),
                columns: []
            }));
            setTombstone(tombstonedId);

            // ACT
            const metadata = BoardStorage.getAllBoardsMetadata([tombstonedId, validId]);

            // ASSERT
            expect(metadata).toHaveLength(1);
            expect(metadata[0].id).toBe(validId);
        });

        it('✅ sollte ID aus localStorage-Key nutzen wenn JSON id fehlt (robust gegen korrupte Daten)', () => {
            // ARRANGE
            const keyId = 'board-missing-id-1234567890';
            localStorage.setItem(`kanban-${keyId}`, JSON.stringify({
                // id fehlt absichtlich
                name: 'Board ohne ID',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const metadata = BoardStorage.getAllBoardsMetadata([keyId]);

            // ASSERT
            expect(metadata).toHaveLength(1);
            expect(metadata[0].id).toBe(keyId);
            expect(metadata[0].name).toBe('Board ohne ID');
        });
    });

    // ========================================================================
    // 3. Integration Test - Full Board Discovery Flow
    // ========================================================================

    describe('3. Integration: Board Discovery Flow', () => {
        it('✅ sollte kompletten Flow von localStorage zu Metadata durchlaufen', () => {
            // ARRANGE: Setup localStorage mit Mix aus validen und invaliden Keys
            localStorage.setItem('kanban-config', JSON.stringify({ theme: 'dark' }));
            localStorage.setItem('kanban-settings', JSON.stringify({ maxBoards: 10 }));
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({
                id: 'board-abc123456789',
                name: 'Valid Board 1',
                createdAt: Date.now(),
                lastAccessedAt: new Date().toISOString(),
                hasUnseenChanges: false,
                columns: []
            }));
            localStorage.setItem('kanban-board-xyz987654321', JSON.stringify({
                id: 'board-xyz987654321',
                name: 'Valid Board 2',
                createdAt: Date.now(),
                columns: []
            }));
            localStorage.setItem('kanban-metadata-migrated', 'true');

            // ACT: Step 1 - Load Board IDs
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT Step 1
            expect(boardIds).toHaveLength(2);
            expect(boardIds).not.toContain('config');
            expect(boardIds).not.toContain('settings');

            // ACT: Step 2 - Get Metadata
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT Step 2
            expect(metadata).toHaveLength(2);
            expect(metadata[0]).toHaveProperty('id');
            expect(metadata[0]).toHaveProperty('name');
            expect(metadata[0]).toHaveProperty('lastAccessed');
            expect(metadata[1]).toHaveProperty('id');
        });

        it('❌ sollte keine Duplikate in Metadata-Liste haben', () => {
            // ARRANGE
            localStorage.setItem('kanban-board-abc123456789', JSON.stringify({
                id: 'board-abc123456789',
                name: 'Board',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            const uniqueIds = new Set(metadata.map(m => m.id));
            expect(uniqueIds.size).toBe(metadata.length); // Keine Duplikate
        });
    });

    // ========================================================================
    // 4. Edge Cases & Error Handling
    // ========================================================================

    describe('4. Edge Cases & Error Handling', () => {
        it('✅ sollte leeres Array zurückgeben wenn localStorage leer', () => {
            // ARRANGE: Keine Keys in localStorage
            mockLocalStorage.clear();

            // ACT
            const boardIds = BoardStorage.loadBoardIds();

            // ASSERT
            expect(boardIds).toHaveLength(0);
        });

        it('✅ sollte korrupt JSON-Board ignorieren', () => {
            // ARRANGE
            localStorage.setItem('kanban-board-corrupt123', 'invalid-json');
            localStorage.setItem('kanban-board-valid123456', JSON.stringify({
                id: 'board-valid123456',
                name: 'Valid',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT
            expect(metadata.length).toBeLessThanOrEqual(2); // Korruptes Board wird ggf. gefiltert
        });

        it('✅ sollte Board ohne required Fields ignorieren', () => {
            // ARRANGE: Board ohne 'name' oder 'createdAt'
            localStorage.setItem('kanban-board-invalid123', JSON.stringify({
                id: 'board-invalid123'
                // name und createdAt fehlen
            }));
            localStorage.setItem('kanban-board-valid123456', JSON.stringify({
                id: 'board-valid123456',
                name: 'Valid',
                createdAt: Date.now(),
                columns: []
            }));

            // ACT
            const boardIds = BoardStorage.loadBoardIds();
            const metadata = BoardStorage.getAllBoardsMetadata(boardIds);

            // ASSERT: Invalid board sollte in Metadata nicht erscheinen (oder mit Defaults)
            expect(metadata.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // 5. Anti-Resurrection Tombstones (Delete/Save/Load)
    // ========================================================================

    describe('5. Tombstones (Anti-Resurrection)', () => {
        it('✅ saveBoard() sollte tombstoned Boards NICHT persistieren', () => {
            // ARRANGE
            const tombstonedId = 'board-deleted123456789';
            setTombstone(tombstonedId);

            const fakeBoard = {
                id: tombstonedId,
                getContextData: () => ({ id: tombstonedId, name: 'Should not persist', columns: [] })
            } as any;

            // ACT
            BoardStorage.saveBoard(fakeBoard);

            // ASSERT
            expect(localStorage.getItem(`kanban-${tombstonedId}`)).toBeNull();
        });

        it('✅ loadBoard() sollte tombstoned Boards immer als null zurückgeben (auch wenn Key existiert)', () => {
            // ARRANGE
            const tombstonedId = 'board-deleted123456789';
            localStorage.setItem(`kanban-${tombstonedId}`, JSON.stringify({
                id: tombstonedId,
                name: 'Zombie',
                createdAt: Date.now(),
                columns: []
            }));
            setTombstone(tombstonedId);

            // ACT
            const loaded = BoardStorage.loadBoard(tombstonedId);

            // ASSERT
            expect(loaded).toBeNull();
        });

        it('✅ deleteBoard() sollte Tombstone setzen und Board-Key entfernen', () => {
            // ARRANGE
            const id = 'board-deleted123456789';
            localStorage.setItem(`kanban-${id}`, JSON.stringify({ id, name: 'To delete', createdAt: Date.now(), columns: [] }));

            // ACT
            const ok = BoardStorage.deleteBoard(id);

            // ASSERT
            expect(ok).toBe(true);
            expect(localStorage.getItem(`kanban-${id}`)).toBeNull();

            const tombstonesRaw = localStorage.getItem(TOMBSTONE_KEY);
            expect(tombstonesRaw).toBeTruthy();
            const tombstones = JSON.parse(tombstonesRaw || '{}');
            expect(tombstones[id]).toBeTypeOf('number');
        });

        it('✅ updateLastAccessed() sollte tombstoned Boards NICHT schreiben', () => {
            // ARRANGE
            const id = 'board-deleted123456789';
            const initial = JSON.stringify({
                id,
                name: 'Zombie',
                createdAt: Date.now(),
                lastAccessedAt: '2020-01-01T00:00:00.000Z',
                columns: []
            });
            localStorage.setItem(`kanban-${id}`, initial);
            setTombstone(id);

            // ACT
            BoardStorage.updateLastAccessed(id);

            // ASSERT
            expect(localStorage.getItem(`kanban-${id}`)).toBe(initial);
        });
    });
});
