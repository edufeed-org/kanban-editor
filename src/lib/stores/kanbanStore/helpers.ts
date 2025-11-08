/**
 * Helper-Funktionen für BoardStore
 * 
 * Enthält Utility-Methoden die von verschiedenen Store-Modulen verwendet werden
 */

import { authStore } from '../authStore.svelte.js';
import { settingsStore } from '../settingsStore.svelte.js';

/**
 * Gibt Author sicher zurück (auch wenn authStore noch nicht initialisiert)
 * 
 * WICHTIG: Während SSR ist authStore noch nicht verfügbar!
 * Der Store wird erst im Browser via +layout.svelte initialisiert.
 */
export function getSafeAuthor(): string {
    try {
        // SSR Check: authStore existiert nur im Browser
        if (typeof window === 'undefined') {
            return 'anonymous';
        }
        
        // Nutze sichere Methode die null zurückgibt statt Error zu werfen
        const pubkey = authStore?.getPubkeySafe();
        
        if (pubkey) {
            console.log('✅ Author gefunden:', pubkey);
            return pubkey;
        }
        
        console.warn('⚠️ authStore nicht initialisiert oder kein User eingeloggt, nutze "anonymous"');
        return 'anonymous';
    } catch (error) {
        // Fallback für unerwartete Fehler
        console.error('❌ Unerwarteter Fehler in getSafeAuthor():', error);
        return 'anonymous';
    }
}

/**
 * Gibt Standard-Farbe basierend auf Spalten-Namen zurück
 */
export function getDefaultColorForColumn(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('to do') || lowerName.includes('todo') || lowerName.includes('backlog')) {
        return 'blue';
    }
    if (lowerName.includes('progress') || lowerName.includes('working') || lowerName.includes('doing')) {
        return 'orange';
    }
    if (lowerName.includes('done') || lowerName.includes('complete') || lowerName.includes('finished')) {
        return 'green';
    }
    if (lowerName.includes('archive') || lowerName.includes('archived')) {
        return 'red';
    }
    return 'slate'; // Default Farbe
}

/**
 * Prüft ob localStorage-Speicherung erlaubt ist
 * - Wenn User eingeloggt: Immer erlaubt
 * - Wenn nicht eingeloggt: Hängt von canUseLocalStorageAnonymously() ab
 */
export function canSaveToStorage(): boolean {
    try {
        // authStore könnte noch nicht initialisiert sein (z.B. beim ersten Import)
        // In dem Fall: Erlaube Speicherung (Fallback zu anonymem Speichern)
        const isAuthenticated = authStore?.isAuthenticated ?? false;
        
        if (isAuthenticated) {
            return true;
        }
        
        // User nicht eingeloggt → prüfe ob anonymes Speichern erlaubt ist
        return canUseLocalStorageAnonymously();
    } catch (error) {
        // authStore noch nicht initialisiert → Fallback zu anonymem Speichern
        console.warn('⚠️ authStore noch nicht verfügbar, nutze Fallback-Logik');
        return canUseLocalStorageAnonymously();
    }
}

/**
 * Prüft ob localStorage für anonyme Nutzung erlaubt ist
 * (z.B. für lokale Tests ohne Auth)
 */
export function canUseLocalStorageAnonymously(): boolean {
    // TODO: Könnte aus Settings kommen (allowAnonymousStorage)
    // Für jetzt: Erlaube localStorage auch ohne Auth (wie bisher)
    return true; // Change to false to enforce auth requirement
}

/**
 * Lädt Board-IDs aus localStorage
 */
export function loadBoardIds(): string[] {
    if (typeof window === 'undefined') return [];
    
    try {
        const stored = localStorage.getItem('kanban-boards-list');
        if (stored) {
            const ids = JSON.parse(stored);
            console.log('📋 Board-IDs geladen:', ids.length);
            return ids;
        }
    } catch (error) {
        console.error('❌ Fehler beim Laden der Board-IDs:', error);
    }
    
    // Neue App - keine alten Boards zu migrieren
    return [];
}

/**
 * Speichert Board-IDs zu localStorage
 */
export function saveBoardIds(boardIds: string[]): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem('kanban-boards-list', JSON.stringify(boardIds));
        console.log('💾 Board-IDs gespeichert:', boardIds.length);
    } catch (error) {
        console.error('❌ Fehler beim Speichern der Board-IDs:', error);
    }
}
