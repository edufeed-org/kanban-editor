// src/lib/stores/userPreferencesStore.svelte.ts
// UserPreferencesStore - Cross-Board Learning für AI-Agent
// Phase 3.1B - Globale Benutzer-Präferenzen mit Confidence-Scoring

import { generateDTag } from '$lib/utils/idGenerator';
import type {
	TeachingPreference,
	PreferenceCategory,
	PreferencesState,
	PreferencesAIContext,
	LearningSource,
	ImportMode,
	LearnResult,
	AdaptResult
} from '$lib/types/preferences';

/**
 * UserPreferencesStore - Globaler Store für Cross-Board Learning
 * 
 * Zweck: Lernt aus Benutzer-Korrekturen über alle Boards hinweg
 * Pattern: Manual localStorage (wie BoardStore & SettingsStore)
 * 
 * Confidence-Scoring:
 * - Initial: 0.5 (erste Erwähnung)
 * - Wiederholt: +0.1 pro Wiederholung (max 1.0)
 * - Geändert: -0.2 pro Änderung (min 0.3)
 * - Auto-Apply: confidence >= 0.8
 * 
 * @see docs/ARCHITECTURE/STORES/USERPREFERENCESSTORE.md
 */
export class UserPreferencesStore {
	// ========================================
	// 1️⃣ REACTIVE STATE (Svelte 5 Runes)
	// ========================================

	private preferencesState = $state<PreferencesState>(this.loadFromStorage());
	private updateTrigger = $state(0);

	// ========================================
	// 2️⃣ DERIVED REACTIVE VALUES
	// ========================================

	/**
	 * Alle Präferenzen (reaktiv)
	 */
	public preferences = $derived.by(() => {
		this.updateTrigger; // Dependency tracking
		return this.preferencesState.preferences;
	});

	/**
	 * Präferenzen nach Kategorie gruppiert (reaktiv)
	 * 
	 * IMPORTANT für Tests:
	 * - In Svelte-Komponenten: Nutze `store.categorizedPreferences` (reaktiv via $derived)
	 * - In Unit-Tests: Nutze `store.getCategorizedPreferences()` (da $derived nicht auto-evaluiert)
	 */
	public categorizedPreferences = $derived.by(() => {
		this.updateTrigger; // Dependency tracking
		const prefs = this.preferencesState.preferences;

		return {
			structure: prefs.filter((p: TeachingPreference) => p.category === 'structure'),
			workflow: prefs.filter((p: TeachingPreference) => p.category === 'workflow'),
			pedagogy: prefs.filter((p: TeachingPreference) => p.category === 'pedagogy'),
			constraints: prefs.filter((p: TeachingPreference) => p.category === 'constraints'),
			content: prefs.filter((p: TeachingPreference) => p.category === 'content')
		};
	});

	/**
	 * Getter-Methode für Unit-Tests (da $derived nicht außerhalb von Komponenten funktioniert)
	 * 
	 * @returns Präferenzen gruppiert nach Kategorie (ohne Reaktivität)
	 */
	public getCategorizedPreferences() {
		const prefs = this.preferencesState.preferences;

		return {
			structure: prefs.filter((p: TeachingPreference) => p.category === 'structure'),
			workflow: prefs.filter((p: TeachingPreference) => p.category === 'workflow'),
			pedagogy: prefs.filter((p: TeachingPreference) => p.category === 'pedagogy'),
			constraints: prefs.filter((p: TeachingPreference) => p.category === 'constraints'),
			content: prefs.filter((p: TeachingPreference) => p.category === 'content')
		};
	}

	// ========================================
	// 3️⃣ CONSTRUCTOR & INITIALIZATION
	// ========================================

	constructor() {
		// Auto-load from localStorage on instantiation
		this.preferencesState = this.loadFromStorage();
	}

	// ========================================
	// 4️⃣ STORAGE PERSISTENCE (Private)
	// ========================================

	private loadFromStorage(): PreferencesState {
		// Note: In tests, localStorage is mocked via vitest-setup-server.ts
		// In SSR, localStorage doesn't exist - catch block handles it
		try {
			const stored = localStorage.getItem('user-preferences');
			if (!stored) {
				return this.getDefaultState();
			}

			const parsed = JSON.parse(stored) as PreferencesState;

			// Migration logic (wenn Version unterschiedlich)
			if (parsed.version !== '1.0') {
				console.warn('⚠️ UserPreferences version mismatch, using defaults');
				return this.getDefaultState();
			}

			return parsed;
		} catch (error) {
			// Handles both SSR (no localStorage) and corrupted data
			console.error('❌ Failed to load user preferences:', error);
			return this.getDefaultState();
		}
	}

	private saveToStorage(): void {
		// Note: In tests (Node.js), localStorage is mocked via vitest-setup-server.ts
		// In browser, localStorage exists natively
		// No window check needed - if localStorage doesn't exist, catch block handles it
		try {
			const serialized = JSON.stringify(this.preferencesState);
			localStorage.setItem('user-preferences', serialized);
		} catch (error) {
			console.error('❌ Failed to save user preferences:', error);
		}
	}

	private getDefaultState(): PreferencesState {
		return {
			preferences: [],
			version: '1.0'
		};
	}

	private triggerUpdate(): void {
		this.updateTrigger++;
		this.saveToStorage();
	}

	// ========================================
	// 5️⃣ PUBLIC API - LEARNING
	// ========================================

	/**
	 * Lernt eine neue Präferenz oder verstärkt eine bestehende
	 * 
	 * @param category - Präferenz-Kategorie
	 * @param key - Eindeutiger Key (z.B. "DEFAULT_COLUMN_STRUCTURE")
	 * @param value - Wert der Präferenz (flexibel: string[], number, object, etc.)
	 * @param boardId - ID des Boards, aus dem gelernt wurde
	 * @param boardName - Name des Boards (optional, für UX)
	 * @returns LearnResult mit Präferenz & isNew Flag
	 */
	public learnPreference(
		category: PreferenceCategory,
		key: string,
		value: any,
		boardId: string,
		boardName?: string
	): LearnResult {
		const existing = this.preferencesState.preferences.find((p: TeachingPreference) => p.key === key);
		const now = new Date().toISOString();

		if (existing) {
			// Bestehende Präferenz: Prüfe ob Wert gleich ist
			const valueMatches = this.deepEqual(existing.value, value);

			if (valueMatches) {
				// Wert ist identisch → Confidence erhöhen
				const previousConfidence = existing.confidence;
				const newConfidence = existing.confidence + 0.1;
				existing.confidence = newConfidence >= 1.0 ? 1.0 : Math.round(newConfidence * 10) / 10;
				existing.lastUsed = now;
				existing.updatedAt = now;

				// LearningSource hinzufügen (falls nicht bereits vorhanden)
				if (!existing.learnedFrom.some((s: LearningSource) => s.boardId === boardId)) {
					existing.learnedFrom = [
						...existing.learnedFrom,
						{ boardId, boardName, timestamp: now }
					];
				}

				this.triggerUpdate();

				return {
					preference: existing,
					isNew: false,
					previousConfidence
				};
			} else {
				// Wert hat sich geändert → Confidence senken & Wert aktualisieren
				const previousConfidence = existing.confidence;
				existing.confidence = Math.max(0.3, existing.confidence - 0.2);
				existing.value = value;
				existing.lastUsed = now;
				existing.updatedAt = now;

				// LearningSource aktualisieren
				existing.learnedFrom = [
					...existing.learnedFrom,
					{ boardId, boardName, timestamp: now }
				];

				this.triggerUpdate();

				return {
					preference: existing,
					isNew: false,
					previousConfidence
				};
			}
		} else {
			// Neue Präferenz
			const newPreference: TeachingPreference = {
				id: generateDTag(),
				category,
				key,
				value,
				confidence: 0.5, // Initial confidence
				learnedFrom: [{ boardId, boardName, timestamp: now }],
				lastUsed: now,
				createdAt: now,
				updatedAt: now
			};

			this.preferencesState.preferences = [...this.preferencesState.preferences, newPreference];
			this.triggerUpdate();

			return {
				preference: newPreference,
				isNew: true
			};
		}
	}

	/**
	 * Passt eine bestehende Präferenz an (z.B. User korrigiert AI-Vorschlag)
	 * 
	 * @param key - Key der Präferenz
	 * @param newValue - Neuer Wert
	 * @param boardId - Board, in dem die Anpassung erfolgte
	 * @param boardName - Name des Boards (optional)
	 * @returns AdaptResult mit Confidence-Delta
	 */
	public adaptPreference(
		key: string,
		newValue: any,
		boardId: string,
		boardName?: string
	): AdaptResult | null {
		const existing = this.preferencesState.preferences.find((p: TeachingPreference) => p.key === key);
		if (!existing) {
			// Präferenz existiert nicht → kann nicht angepasst werden
			return null;
		}

		const wasAutoApplied = existing.confidence >= 0.8;
		const previousConfidence = existing.confidence;
		const now = new Date().toISOString();

		// Confidence senken (User hat AI-Vorschlag korrigiert)
		existing.confidence = Math.max(0.3, existing.confidence - 0.2);
		existing.value = newValue;
		existing.lastUsed = now;
		existing.updatedAt = now;

		// LearningSource aktualisieren
		existing.learnedFrom = [...existing.learnedFrom, { boardId, boardName, timestamp: now }];

		this.triggerUpdate();

		return {
			preference: existing,
			confidenceDelta: existing.confidence - previousConfidence,
			wasAutoApplied: wasAutoApplied
		};
	}

	// ========================================
	// 6️⃣ PUBLIC API - QUERYING
	// ========================================

	/**
	 * Holt alle Präferenzen einer Kategorie
	 * 
	 * @param category - Kategorie (optional, wenn nicht angegeben: alle)
	 * @param minConfidence - Minimum Confidence (optional, default: 0.0)
	 * @returns Array von Präferenzen
	 */
	public getPreferences(
		category?: PreferenceCategory,
		minConfidence: number = 0.0
	): TeachingPreference[] {
		let prefs = this.preferencesState.preferences;

		if (category) {
			prefs = prefs.filter((p: TeachingPreference) => p.category === category);
		}

		return prefs.filter((p: TeachingPreference) => p.confidence >= minConfidence);
	}

	/**
	 * Holt eine spezifische Präferenz nach Key
	 * 
	 * @param key - Präferenz-Key
	 * @returns Präferenz oder undefined
	 */
	public getPreference(key: string): TeachingPreference | undefined {
		return this.preferencesState.preferences.find((p: TeachingPreference) => p.key === key);
	}

	/**
	 * Erstellt AI-Context für ChatBotStore Integration
	 * 
	 * @param minConfidence - Minimum Confidence (default: 0.7)
	 * @returns PreferencesAIContext Objekt
	 */
	public getAIContext(minConfidence: number = 0.7): PreferencesAIContext {
		const highConfPrefs = this.preferencesState.preferences.filter(
			(p: TeachingPreference) => p.confidence >= minConfidence
		);

		// Gruppiere nach Kategorie
		const structure: Record<string, any> = {};
		const workflow: Record<string, any> = {};
		const pedagogy: Record<string, any> = {};
		const constraints: Record<string, any> = {};
		const content: Record<string, any> = {};

		for (const pref of highConfPrefs) {
			const target =
				pref.category === 'structure'
					? structure
					: pref.category === 'workflow'
						? workflow
						: pref.category === 'pedagogy'
							? pedagogy
							: pref.category === 'constraints'
								? constraints
								: content;

			target[pref.key] = pref.value;
		}

		// Berechne Metriken
		const allPrefs = this.preferencesState.preferences;
		const highConfCount = allPrefs.filter((p: TeachingPreference) => p.confidence >= 0.8).length;
		const avgConfidence =
			allPrefs.length > 0
				? allPrefs.reduce((sum: number, p: TeachingPreference) => sum + p.confidence, 0) / allPrefs.length
				: 0;

		const lastLearned = allPrefs
			.map((p: TeachingPreference) => new Date(p.updatedAt).getTime())
			.reduce((max: number, t: number) => Math.max(max, t), 0);

		return {
			structure,
			workflow,
			pedagogy,
			constraints,
			content,
			meta: {
				totalPreferences: allPrefs.length,
				highConfidenceCount: highConfCount,
				averageConfidence: Math.round(avgConfidence * 100) / 100,
				lastLearned: lastLearned > 0 ? new Date(lastLearned).toISOString() : undefined
			}
		};
	}

	// ========================================
	// 7️⃣ PUBLIC API - MANAGEMENT
	// ========================================

	/**
	 * Löscht eine Präferenz
	 * 
	 * @param key - Key der zu löschenden Präferenz
	 * @returns true wenn gelöscht, false wenn nicht gefunden
	 */
	public deletePreference(key: string): boolean {
		const index = this.preferencesState.preferences.findIndex((p: TeachingPreference) => p.key === key);
		if (index === -1) return false;

		this.preferencesState.preferences = this.preferencesState.preferences.filter(
			(p: TeachingPreference) => p.key !== key
		);
		this.triggerUpdate();
		return true;
	}

	/**
	 * Löscht alle Präferenzen (Factory Reset)
	 */
	public clear(): void {
		this.preferencesState.preferences = [];
		this.triggerUpdate();
	}

	// ========================================
	// 8️⃣ EXPORT / IMPORT
	// ========================================

	/**
	 * Exportiert alle Präferenzen als JSON
	 * 
	 * @returns JSON-String
	 */
	public exportPreferences(): string {
		const exportData = {
			...this.preferencesState,
			lastExport: new Date().toISOString()
		};
		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * Importiert Präferenzen aus JSON
	 * 
	 * @param jsonString - JSON-String vom Export
	 * @param mode - Import-Modus (merge, replace, overwrite)
	 * @returns true bei Erfolg, false bei Fehler
	 */
	public importPreferences(jsonString: string, mode: ImportMode = 'merge'): boolean {
		try {
			const imported = JSON.parse(jsonString) as PreferencesState;

			// Validierung
			if (!imported.preferences || !Array.isArray(imported.preferences)) {
				console.error('❌ Invalid preferences format');
				return false;
			}

			switch (mode) {
				case 'replace':
					// Alle bestehenden ersetzen
					this.preferencesState = imported;
					break;

				case 'overwrite':
					// Nur Präferenzen mit gleichen Keys überschreiben
					for (const importedPref of imported.preferences) {
						const existingIndex = this.preferencesState.preferences.findIndex(
							(p: TeachingPreference) => p.key === importedPref.key
						);
						if (existingIndex !== -1) {
							this.preferencesState.preferences[existingIndex] = importedPref;
						}
					}
					break;

				case 'merge':
				default:
					// Neue hinzufügen, bestehende beibehalten
					for (const importedPref of imported.preferences) {
						const exists = this.preferencesState.preferences.some(
							(p: TeachingPreference) => p.key === importedPref.key
						);
						if (!exists) {
							this.preferencesState.preferences = [
								...this.preferencesState.preferences,
								importedPref
							];
						}
					}
					break;
			}

			this.triggerUpdate();
			return true;
		} catch (error) {
			console.error('❌ Failed to import preferences:', error);
			return false;
		}
	}

	// ========================================
	// 9️⃣ HELPER METHODS (Private)
	// ========================================

	/**
	 * Deep Equality Check für Präferenz-Werte
	 */
	private deepEqual(a: any, b: any): boolean {
		if (a === b) return true;
		if (a == null || b == null) return false;
		if (typeof a !== typeof b) return false;

		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false;
			return a.every((val, idx) => this.deepEqual(val, b[idx]));
		}

		if (typeof a === 'object' && typeof b === 'object') {
			const keysA = Object.keys(a);
			const keysB = Object.keys(b);
			if (keysA.length !== keysB.length) return false;
			return keysA.every((key) => this.deepEqual(a[key], b[key]));
		}

		return false;
	}
}

// ========================================
// 🌐 GLOBAL SINGLETON INSTANCE
// ========================================

export const userPreferencesStore = new UserPreferencesStore();
