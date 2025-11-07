// src/lib/types/preferences.ts
// TypeScript Types für UserPreferencesStore
// Phase 3.1B - Cross-Board Learning System

/**
 * Präferenz-Kategorien für strukturierte Organisation
 */
export type PreferenceCategory =
	| 'structure' // Board/Spalten-Struktur
	| 'workflow' // Arbeitsabläufe (z.B. "Start immer mit Brainstorming")
	| 'pedagogy' // Didaktische Prinzipien
	| 'constraints' // Einschränkungen (z.B. max. Spalten, Karten-Limits)
	| 'content'; // Inhalts-Präferenzen (z.B. Labels, Farben)

/**
 * Quelle einer gelernten Präferenz (für Tracking & Confidence)
 */
export interface LearningSource {
	boardId: string;
	boardName?: string;
	timestamp: string; // ISO 8601
}

/**
 * Einzelne Benutzer-Präferenz mit Confidence-Score
 */
export interface TeachingPreference {
	id: string; // Unique ID für die Präferenz
	category: PreferenceCategory;
	key: string; // z.B. "DEFAULT_COLUMN_STRUCTURE" oder "FACH_MATHEMATIK_LABELS"
	value: any; // Flexibel: string[], number, object, etc.
	confidence: number; // 0.0 - 1.0 (0.5 = erste Erwähnung, 1.0 = etabliert)
	learnedFrom: LearningSource[]; // Alle Boards, die diese Präferenz zeigten
	lastUsed: string; // ISO 8601 - Wann wurde diese Präferenz zuletzt angewandt?
	createdAt: string; // ISO 8601
	updatedAt: string; // ISO 8601
}

/**
 * Gesamter Preferences-State (für localStorage)
 */
export interface PreferencesState {
	preferences: TeachingPreference[];
	version: string; // z.B. "1.0" für Migrations-Kompatibilität
	lastExport?: string; // ISO 8601 - Letzter Export-Zeitstempel
	learnedPatterns?: Record<string, {
		confidence: number;
		usageCount: number;
		lastUsed: string;
		patternHash: string;
	}>; // Gelernte AI-Action Patterns (ChatStore Integration - Phase 3)
}

/**
 * AI-Kontext-Format für ChatBotStore Integration
 */
export interface PreferencesAIContext {
	structure: Record<string, any>; // Struktur-Präferenzen
	workflow: Record<string, any>; // Workflow-Präferenzen
	pedagogy: Record<string, any>; // Didaktische Prinzipien
	constraints: Record<string, any>; // Einschränkungen
	content: Record<string, any>; // Inhalts-Präferenzen
	meta: {
		totalPreferences: number;
		highConfidenceCount: number; // confidence >= 0.8
		averageConfidence: number;
		lastLearned?: string; // ISO 8601
	};
}

/**
 * Import-Mode für importPreferences()
 */
export type ImportMode =
	| 'merge' // Neue Präferenzen hinzufügen, bestehende beibehalten
	| 'replace' // Alle bestehenden Präferenzen ersetzen
	| 'overwrite'; // Nur Präferenzen mit gleichen Keys überschreiben

/**
 * Ergebnis einer Learn-Operation
 */
export interface LearnResult {
	preference: TeachingPreference;
	isNew: boolean; // true = neu gelernt, false = bestehende aktualisiert
	previousConfidence?: number; // Confidence vor dem Update (falls nicht neu)
}

/**
 * Ergebnis einer Adapt-Operation
 */
export interface AdaptResult {
	preference: TeachingPreference;
	confidenceDelta: number; // Änderung der Confidence (positiv oder negativ)
	wasAutoApplied: boolean; // true wenn confidence >= 0.8 vor Änderung
}

/**
 * Pattern-Detection Result (für interne Verwendung)
 */
export interface PatternMatch {
	key: string;
	matchedValue: any;
	similarity: number; // 0.0 - 1.0
}
