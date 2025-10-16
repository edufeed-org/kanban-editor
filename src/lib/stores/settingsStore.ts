// src/lib/stores/settingsStore.ts

import { writable } from 'svelte/store';

/**
 * Global Settings Store für das Kanban-Board
 * Speichert Präferenzen wie maxCardsBeforeScroll und weitere Board-Settings
 */

export interface SettingsState {
	maxCardsBeforeScroll: number; // Ab dieser Anzahl scrollt eine Spalte intern
	alignColumnsToMaxHeight: boolean; // Alle Spalten auf die Höhe der längsten ausrichten
}

const defaultSettings: SettingsState = {
	maxCardsBeforeScroll: 20,
	alignColumnsToMaxHeight: true
};

function createSettingsStore() {
	// Inizialisiere mit gespeicherten Werten oder Defaults
	let initialSettings = { ...defaultSettings };

	if (typeof window !== 'undefined') {
		try {
			const stored = localStorage.getItem('kanban-settings');
			if (stored) {
				const parsed = JSON.parse(stored) as Partial<SettingsState>;
				initialSettings = { ...initialSettings, ...parsed };
			}
		} catch (e) {
			console.warn('Failed to load settings from localStorage:', e);
		}
	}

	const { subscribe, set, update } = writable<SettingsState>(initialSettings);

	return {
		subscribe,

		/**
		 * Setter für maxCardsBeforeScroll
		 */
		setMaxCardsBeforeScroll(value: number): void {
			if (value < 1) return; // Validation
			update((s) => {
				s.maxCardsBeforeScroll = value;
				saveToLocalStorage(s);
				return s;
			});
		},

		/**
		 * Setter für alignColumnsToMaxHeight
		 */
		setAlignColumnsToMaxHeight(value: boolean): void {
			update((s) => {
				s.alignColumnsToMaxHeight = value;
				saveToLocalStorage(s);
				return s;
			});
		},

		/**
		 * Alle Settings auf einmal updaten
		 */
		updateSettings(partial: Partial<SettingsState>): void {
			update((s) => {
				const updated = { ...s, ...partial };
				saveToLocalStorage(updated);
				return updated;
			});
		},

		/**
		 * Auf Standard-Werte zurücksetzen
		 */
		reset(): void {
			set(defaultSettings);
			saveToLocalStorage(defaultSettings);
		}
	};
}

/**
 * Persistenz: in localStorage speichern
 */
function saveToLocalStorage(settings: SettingsState): void {
	if (typeof window !== 'undefined') {
		try {
			localStorage.setItem('kanban-settings', JSON.stringify(settings));
		} catch (e) {
			console.warn('Failed to save settings to localStorage:', e);
		}
	}
}

/**
 * Singleton-Instanz des SettingsStore
 */
export const settingsStore = createSettingsStore();
