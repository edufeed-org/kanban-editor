// src/lib/stores/boardstore/learning.ts
// Learning-Integration (Delegation zu BoardLearningManager)

import { Board } from '../../classes/BoardModel.js';
import { boardLearningManager } from '../boardLearningManager.svelte.js';

export class BoardLearning {
    /**
     * Lernt Spaltenstruktur
     */
    public static learnColumnStructure(board: Board, columnId: string): any {
        if (!boardLearningManager) {
            console.warn('⚠️ BoardLearningManager nicht verfügbar');
            return { success: false, error: 'Learning manager not available' };
        }
        return boardLearningManager.learnColumnStructure(columnId);
    }

    /**
     * Lernt Board-Struktur
     */
    public static learnBoardStructure(board: Board): any {
        if (!boardLearningManager) {
            console.warn('⚠️ BoardLearningManager nicht verfügbar');
            return { success: false, error: 'Learning manager not available' };
        }
        return boardLearningManager.learnBoardStructure();
    }

    /**
     * Erstellt Spalte mit Template
     */
    public static createColumnWithTemplate(
        board: Board, 
        templateName: string
    ): { columnId: string; templateApplied?: boolean; cardIds?: string[]; confidence?: number } | null {
        if (!boardLearningManager) {
            console.warn('⚠️ BoardLearningManager nicht verfügbar');
            return null;
        }
        return boardLearningManager.createColumnWithTemplate(templateName, true);
    }
}
