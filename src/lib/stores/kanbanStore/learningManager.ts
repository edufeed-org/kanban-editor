/**
 * Learning Manager für AI-Integration
 * 
 * Verwaltet:
 * - Learning Entries (Benutzer-Feedback)
 * - Memory-Ranking (Relevanz-Bewertung)
 * - Context-Generierung für LLM
 */

import type { Board } from '$lib/classes/BoardModel.js';

export interface LearningEntry {
    id: string;
    timestamp: number;
    context: string;
    userFeedback: string;
    action?: string;
    relevanceScore: number;
}

export interface LearningMemory {
    entries: LearningEntry[];
    maxEntries: number;
}

/**
 * Erstellt eine neue Learning Entry
 */
export function createLearningEntry(
    context: string,
    userFeedback: string,
    action?: string
): LearningEntry {
    return {
        id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        context,
        userFeedback,
        action,
        relevanceScore: 1.0
    };
}

/**
 * Lädt Learning Entries aus localStorage
 */
export function loadLearningMemory(boardId: string): LearningMemory {
    if (typeof window === 'undefined') {
        return { entries: [], maxEntries: 50 };
    }
    
    const stored = localStorage.getItem(`kanban-learning-${boardId}`);
    if (!stored) {
        return { entries: [], maxEntries: 50 };
    }
    
    try {
        const parsed = JSON.parse(stored);
        return {
            entries: parsed.entries || [],
            maxEntries: parsed.maxEntries || 50
        };
    } catch (error) {
        console.error('❌ Fehler beim Laden von Learning Memory:', error);
        return { entries: [], maxEntries: 50 };
    }
}

/**
 * Speichert Learning Memory zu localStorage
 */
export function saveLearningMemory(boardId: string, memory: LearningMemory): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(`kanban-learning-${boardId}`, JSON.stringify(memory));
        console.log('✅ Learning Memory gespeichert:', memory.entries.length, 'Einträge');
    } catch (error) {
        console.error('❌ Fehler beim Speichern von Learning Memory:', error);
    }
}

/**
 * Fügt Learning Entry hinzu (mit Auto-Pruning)
 */
export function addLearningEntry(
    memory: LearningMemory,
    entry: LearningEntry
): LearningMemory {
    const newEntries = [...memory.entries, entry];
    
    // Pruning: Behalte nur maxEntries neueste Einträge
    if (newEntries.length > memory.maxEntries) {
        // Sortiere nach Relevanz * Zeitstempel (neuer = besser)
        const sorted = newEntries.sort((a, b) => {
            const scoreA = a.relevanceScore * (a.timestamp / 1000000000); // Normalisierung
            const scoreB = b.relevanceScore * (b.timestamp / 1000000000);
            return scoreB - scoreA;
        });
        
        // Behalte nur Top-N
        return {
            ...memory,
            entries: sorted.slice(0, memory.maxEntries)
        };
    }
    
    return {
        ...memory,
        entries: newEntries
    };
}

/**
 * Berechnet Relevanz-Score für Entry basierend auf Kontext-Ähnlichkeit
 */
export function calculateRelevanceScore(
    entry: LearningEntry,
    currentContext: string
): number {
    // Einfache Token-basierte Ähnlichkeit
    const entryTokens = new Set(entry.context.toLowerCase().split(/\s+/));
    const contextTokens = new Set(currentContext.toLowerCase().split(/\s+/));
    
    // Jaccard-Ähnlichkeit
    const intersection = new Set([...entryTokens].filter(x => contextTokens.has(x)));
    const union = new Set([...entryTokens, ...contextTokens]);
    
    const similarity = intersection.size / union.size;
    
    // Zeit-Decay: Ältere Entries verlieren Relevanz
    const ageInDays = (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24);
    const timeFactor = Math.exp(-ageInDays / 30); // Exponentieller Decay über 30 Tage
    
    return similarity * timeFactor;
}

/**
 * Holt relevante Learning Entries für aktuellen Kontext
 */
export function getRelevantLearnings(
    memory: LearningMemory,
    currentContext: string,
    limit = 5
): LearningEntry[] {
    // Berechne Relevanz-Scores
    const scoredEntries = memory.entries.map(entry => ({
        ...entry,
        calculatedScore: calculateRelevanceScore(entry, currentContext)
    }));
    
    // Sortiere nach Score
    scoredEntries.sort((a, b) => b.calculatedScore - a.calculatedScore);
    
    // Filtere Entries mit Score > 0.1 und nimm Top N
    return scoredEntries
        .filter(e => e.calculatedScore > 0.1)
        .slice(0, limit)
        .map(e => {
            const { calculatedScore, ...entry } = e;
            return entry;
        });
}

/**
 * Generiert LLM-Context aus Board + Relevanten Learnings
 */
export function generateLLMContext(
    board: Board,
    memory: LearningMemory,
    currentPrompt: string
): {
    boardContext: any;
    relevantLearnings: LearningEntry[];
    contextText: string;
} {
    const boardContext = board.getContextData(true);
    const relevantLearnings = getRelevantLearnings(memory, currentPrompt, 5);
    
    let contextText = `# Board Context\n\n`;
    contextText += `Board: ${board.name}\n`;
    contextText += `Spalten: ${board.columns.length}\n`;
    contextText += `Karten gesamt: ${board.columns.reduce((sum, col) => sum + col.cards.length, 0)}\n\n`;
    
    if (relevantLearnings.length > 0) {
        contextText += `# Relevante Learnings\n\n`;
        for (const learning of relevantLearnings) {
            contextText += `- ${learning.userFeedback}\n`;
            if (learning.action) {
                contextText += `  Action: ${learning.action}\n`;
            }
        }
        contextText += `\n`;
    }
    
    contextText += `# Aktuelle Anfrage\n\n${currentPrompt}`;
    
    return {
        boardContext,
        relevantLearnings,
        contextText
    };
}
