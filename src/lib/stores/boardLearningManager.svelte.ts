// src/lib/stores/boardLearningManager.svelte.ts

import type { BoardStore } from './kanbanStore.svelte.js';
import { userPreferencesStore, type LearnResult } from './userPreferencesStore.svelte.js';

/**
 * BoardLearningManager - Extension für BoardStore
 * 
 * Erweitert BoardStore um Learning-Funktionalität (optional aktivierbar).
 * Nutzt Composition Pattern: LearningManager hat Referenz zu BoardStore,
 * BoardStore bleibt clean und fokussiert auf Core-Funktionalität.
 * 
 * @example
 * ```typescript
 * // In Component:
 * import { boardLearningManager } from '$lib/stores/boardLearningManager.svelte.js';
 * 
 * // Lerne Spalten-Struktur
 * const result = boardLearningManager.learnColumnStructure('col-123');
 * 
 * // Erstelle Spalte mit Template
 * const { columnId, templateApplied } = boardLearningManager.createColumnWithTemplate('Materialien');
 * ```
 */
export class BoardLearningManager {
    private boardStore: BoardStore;
    private enabled = $state(true); // Kann zur Laufzeit deaktiviert werden
    
    constructor(boardStore: BoardStore) {
        this.boardStore = boardStore;
    }
    
    /**
     * Aktiviert/Deaktiviert Learning zur Laufzeit
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        console.log(`🎓 BoardLearningManager ${enabled ? 'aktiviert' : 'deaktiviert'}`);
    }
    
    /**
     * Gibt an ob Learning aktuell aktiv ist
     */
    public get isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Lernt die Kartenstruktur einer Spalte
     * 
     * Extrahiert aus allen Karten der Spalte:
     * - Häufigste Labels (content category)
     * - Durchschnittliche Länge der Beschreibungen (content category)
     * 
     * @param columnId - ID der Spalte aus der gelernt werden soll
     * @returns LearnResult mit gelernten Preferences oder Fehler
     * 
     * @example
     * ```typescript
     * // Nach dem Erstellen mehrerer Material-Karten in "Materialien"-Spalte:
     * const result = boardLearningManager.learnColumnStructure('col-mat-123');
     * 
     * if (result.success) {
     *   console.log('Gelernt:', result.count, 'Preferences');
     *   // Nächste "Materialien"-Spalte wird automatisch mit Template gefüllt
     * }
     * ```
     */
    public learnColumnStructure(columnId: string): LearnResult | { success: false; error: string } {
        if (!this.enabled) {
            return { success: false, error: 'Learning Manager ist deaktiviert' };
        }
        
        const column = this.boardStore.findColumn(columnId);
        if (!column) {
            return { success: false, error: `Column ${columnId} not found` };
        }
        
        // Extrahiere Kartentitel aus der Spalte
        const cardTitles = column.cards.map(card => card.heading);
        
        if (cardTitles.length === 0) {
            return { success: false, error: 'Column has no cards to learn' };
        }
        
        const boardId = this.boardStore.getCurrentBoardId();
        const boardName = this.boardStore.data.name;
        
        // Rufe UserPreferencesStore API auf (learnCardTemplate für card titles)
        const result = userPreferencesStore.learnCardTemplate(
            column.name,
            cardTitles,
            boardId,
            boardName
        );
        
        const confidence = 'preference' in result ? result.preference.confidence : 'N/A';
        console.log(`📚 Learned column structure: "${column.name}" with ${cardTitles.length} cards (confidence: ${confidence})`);
        
        return result;
    }
    
    /**
     * Lernt die Struktur aller Spalten im aktuellen Board
     * 
     * Ruft learnColumnStructure() für jede Spalte auf.
     * Nützlich um am Ende einer Planungssession das gesamte Board zu "trainieren".
     * 
     * @returns Array mit Ergebnissen pro Spalte
     * 
     * @example
     * ```typescript
     * // Am Ende der Planung: Lerne von allen Spalten
     * const results = boardLearningManager.learnBoardStructure();
     * 
     * results.forEach(({ columnName, result }) => {
     *   if (result.success) {
     *     console.log(`✅ ${columnName}: ${result.count} Preferences gelernt`);
     *   }
     * });
     * ```
     */
    public learnBoardStructure(): Array<{ columnName: string; result: LearnResult | { success: false; error: string } }> {
        if (!this.enabled) {
            return [];
        }
        
        const board = this.boardStore.data;
        console.log(`🎓 Lerne Struktur von gesamtem Board: ${board.name}`);
        
        return board.columns.map(column => ({
            columnName: column.name,
            result: this.learnColumnStructure(column.id)
        }));
    }
    
    /**
     * Erstellt eine neue Spalte und wendet optional ein gelerntes Template an
     * 
     * Workflow:
     * 1. Prüfe ob es gelernte Preferences für diese Spalten-Name gibt (minConfidence 0.7)
     * 2. Erstelle Spalte via BoardStore
     * 3. Wenn Template gefunden: Erstelle automatisch Beispiel-Karten mit gelernten Labels
     * 
     * @param columnName - Name der neuen Spalte (z.B. "Materialien")
     * @param applyTemplate - Wenn true, werden gelernte Karten-Templates angewendet
     * @param minConfidence - Mindest-Confidence für Template-Anwendung (default 0.7)
     * @returns Ergebnis mit columnId und Info ob Template angewendet wurde
     * 
     * @example
     * ```typescript
     * // Lehrer erstellt mehrmals "Materialien"-Spalte
     * // Beim 3. Mal (Confidence 0.7):
     * const result = boardLearningManager.createColumnWithTemplate('Materialien', true);
     * 
     * if (result.templateApplied) {
     *   console.log(`🎯 Template angewendet! ${result.cardIds.length} Karten erstellt`);
     *   console.log(`Confidence: ${result.confidence}`);
     * }
     * ```
     */
    public createColumnWithTemplate(
        columnName: string,
        applyTemplate: boolean = false,
        minConfidence: number = 0.7
    ): {
        columnId: string;
        templateApplied?: boolean;
        cardIds?: string[];
        confidence?: number;
    } {
        // 1. Erstelle Spalte (immer, unabhängig von Learning)
        const columnId = this.boardStore.createColumn(columnName);
        
        // 2. Wenn Learning deaktiviert oder Template nicht gewünscht: Stop here
        if (!this.enabled || !applyTemplate) {
            return { columnId, templateApplied: false };
        }
        
        // 3. Hole gelerntes Template für diese Spalte
        const template = userPreferencesStore.getCardTemplate(columnName, minConfidence);
        
        if (!template || template.length === 0) {
            console.log(`ℹ️ No template found for column "${columnName}" (min confidence: ${minConfidence})`);
            return { columnId, templateApplied: false };
        }
        
        // 4. Wende das Template an: Erstelle Karten aus gelernten Titeln
        const cardIds: string[] = [];
        for (const cardTitle of template) {
            try {
                const cardId = this.boardStore.createCard(columnId, cardTitle);
                cardIds.push(cardId);
            } catch (error) {
                console.warn(`⚠️ Failed to create card "${cardTitle}":`, error);
            }
        }
        
        // 5. Hole die Konfidenz des Templates
        const pref = userPreferencesStore.getPreference(
            `COLUMN_CARDS_${columnName.toUpperCase().replace(/\s+/g, '_')}`
        );
        const confidence = pref?.confidence ?? 0;
        
        console.log(`✨ Applied template to "${columnName}": ${cardIds.length} cards created (confidence: ${confidence})`);
        
        return {
            columnId,
            templateApplied: true,
            cardIds,
            confidence
        };
    }
}

// ============================================================================
// GLOBALE INSTANZ (wird lazy initialisiert von boardStore)
// ============================================================================

/**
 * Globale LearningManager-Instanz
 * 
 * Wird automatisch von boardStore initialisiert wenn useLearningManager=true.
 * Kann auch manuell deaktiviert werden zur Laufzeit.
 * 
 * @example
 * ```typescript
 * // Deaktiviere Learning
 * boardLearningManager.setEnabled(false);
 * 
 * // Aktiviere wieder
 * boardLearningManager.setEnabled(true);
 * ```
 */
export let boardLearningManager: BoardLearningManager | null = null;

/**
 * Initialisiert den globalen LearningManager
 * (wird von boardStore.constructor aufgerufen wenn config.useLearningManager=true)
 */
export function initializeLearningManager(boardStore: BoardStore): void {
    if (boardLearningManager) {
        console.warn('⚠️ LearningManager bereits initialisiert');
        return;
    }
    
    boardLearningManager = new BoardLearningManager(boardStore);
    console.log('✅ BoardLearningManager initialisiert');
}

/**
 * 🧪 TEST-UTILITY: Setzt den LearningManager zurück
 * 
 * ⚠️ NUR FÜR TESTS NUTZEN!
 * Erlaubt Tests, den globalen Singleton-State zwischen Tests zu clearen.
 * 
 * @example
 * ```typescript
 * // In vitest test:
 * import { resetLearningManagerForTesting } from '$lib/stores/boardLearningManager.svelte.js';
 * 
 * beforeEach(() => {
 *   localStorage.clear();
 *   userPreferencesStore.clear();
 *   resetLearningManagerForTesting();  // ← Reset global state
 *   
 *   store = new BoardStore();
 *   initializeLearningManager(store);  // ← Now initializes fresh manager
 * });
 * ```
 */
export function resetLearningManagerForTesting(): void {
	boardLearningManager = null;
	// Removed debug log - only needed during development
}