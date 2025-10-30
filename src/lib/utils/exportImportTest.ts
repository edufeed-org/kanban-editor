// src/lib/utils/exportImportTest.ts
// Quick Test für Export/Import Funktionalität (Phase 1.5D)

import { boardStore } from '../stores/kanbanStore.svelte.js';

/**
 * Testet Export/Import Funktionalität
 */
export function testExportImport() {
    console.clear();
    console.group('📤📥 EXPORT/IMPORT TEST SUITE');

    // Test 1: Export aktuelles Board
    console.group('Test 1: Export Single Board');
    try {
        const jsonString = boardStore.exportBoardAsJson(true);
        const exported = JSON.parse(jsonString);
        
        console.log('✅ Export erfolgreich:');
        console.log('  - Version:', exported.version);
        console.log('  - Board Name:', exported.boardName);
        console.log('  - Columns:', exported.board.columns.length);
        console.log('  - JSON Größe:', jsonString.length, 'bytes');
    } catch (error) {
        console.error('❌ Export fehlgeschlagen:', error);
    }
    console.groupEnd();

    // Test 2: Export alle Boards
    console.group('Test 2: Export All Boards (Backup)');
    try {
        const jsonString = boardStore.exportAllBoardsAsJson();
        const exported = JSON.parse(jsonString);
        
        console.log('✅ Backup erfolgreich:');
        console.log('  - Version:', exported.version);
        console.log('  - Board Count:', exported.boardCount);
        console.log('  - JSON Größe:', jsonString.length, 'bytes');
    } catch (error) {
        console.error('❌ Backup fehlgeschlagen:', error);
    }
    console.groupEnd();

    // Test 3: Import mit MERGE-Mode
    console.group('Test 3: Import in MERGE Mode');
    try {
        // Exportiere aktuelles Board
        const exported = boardStore.exportBoardAsJson(true);
        
        // Importiere es mit MERGE-Mode (neue IDs)
        const result = boardStore.importBoardFromJson(exported, 'merge');
        
        if (result.success && result.board) {
            console.log('✅ Import erfolgreich im MERGE-Mode:');
            console.log('  - Original Board ID:', boardStore.data.id);
            console.log('  - Imported Board ID:', result.board.id);
            console.log('  - IDs unterschiedlich?', boardStore.data.id !== result.board.id);
            console.log('  - Name:', result.board.name);
            console.log('  - Columns:', result.board.columns.length);
        } else {
            console.error('❌ Import fehlgeschlagen:', result.error);
        }
    } catch (error) {
        console.error('❌ Import Test Error:', error);
    }
    console.groupEnd();

    // Test 4: Import mit NEW-Mode
    console.group('Test 4: Import in NEW Mode');
    try {
        const exported = boardStore.exportBoardAsJson(false); // Raw export
        const result = boardStore.importBoardFromJson(exported, 'new');
        
        if (result.success && result.board) {
            console.log('✅ Import erfolgreich im NEW-Mode:');
            console.log('  - Name suffix:', result.board.name.includes('(Imported)'));
            console.log('  - Full Name:', result.board.name);
        } else {
            console.error('❌ Import fehlgeschlagen:', result.error);
        }
    } catch (error) {
        console.error('❌ NEW Mode Test Error:', error);
    }
    console.groupEnd();

    // Test 5: Invalid JSON
    console.group('Test 5: Error Handling - Invalid JSON');
    try {
        const result = boardStore.importBoardFromJson('{ invalid json }', 'merge');
        
        if (!result.success) {
            console.log('✅ Fehlerbehandlung funktioniert:');
            console.log('  - Error:', result.error?.substring(0, 50) + '...');
        }
    } catch (error) {
        console.error('❌ Fehlerbehandlung fehlgeschlagen:', error);
    }
    console.groupEnd();

    // Test 6: Missing Fields
    console.group('Test 6: Error Handling - Missing Fields');
    try {
        const invalid = JSON.stringify({ columns: [] }); // Keine id/name
        const result = boardStore.importBoardFromJson(invalid, 'merge');
        
        if (!result.success) {
            console.log('✅ Validierung funktioniert:');
            console.log('  - Error:', result.error);
        }
    } catch (error) {
        console.error('❌ Validierung fehlgeschlagen:', error);
    }
    console.groupEnd();

    // Test 7: Save Imported Board
    console.group('Test 7: Save Imported Board');
    try {
        const exported = boardStore.exportBoardAsJson(true);
        const importResult = boardStore.importBoardFromJson(exported, 'merge');
        
        if (importResult.success && importResult.board) {
            const savedId = boardStore.saveImportedBoard(importResult.board, false);
            
            console.log('✅ Imported Board gespeichert:');
            console.log('  - Board ID:', savedId);
            console.log('  - In localStorage?', localStorage.getItem(`kanban-${savedId}`) !== null);
            
            // Verifiziere dass das Board geladen werden kann
            const allBoards = boardStore.getAllBoards();
            const found = allBoards.find(b => b.id === savedId);
            console.log('  - In Boards-List?', found !== undefined);
        }
    } catch (error) {
        console.error('❌ Save Imported Board fehlgeschlagen:', error);
    }
    console.groupEnd();

    // Summary
    console.group('📊 TEST SUMMARY');
    console.log('✅ Alle Export/Import Tests durchgeführt');
    console.log('📌 Testen Sie folgende Szenarien manuell:');
    console.log('  1. Export Board: Button in CardDialog (Phase 1.5D)');
    console.log('  2. Backup All: Settings Menu (Phase 1.5D)');
    console.log('  3. Import: Sidebar Popover (Phase 1.5D)');
    console.log('  4. Share Link: URL parameter ?import=<token> (Phase 1.5E)');
    console.groupEnd();

    console.groupEnd();
}

// Browser Console: testExportImport()
if (typeof window !== 'undefined') {
    (window as any).testExportImport = testExportImport;
    console.log('💡 Tipp: testExportImport() aufrufen um Tests auszuführen');
}
