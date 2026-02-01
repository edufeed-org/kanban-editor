/**
 * 🎯 AI Context Store - Speichert ausgewählte Karten für den AI-Kontext
 * 
 * Problem: Wenn die rechte Sidebar geschlossen wird (besonders auf Mobile),
 * geht der lokale contextCards State im AIPanel verloren.
 * 
 * Lösung: Globaler Store der unabhängig vom AIPanel-Mount-Status existiert.
 */

export interface ContextCard {
	cardId: string;
	cardName: string;
	columnId: string;
	columnName: string;
}

// Globaler reaktiver State
let contextCards = $state<ContextCard[]>([]);

/**
 * AI Context Store - Verwaltet Karten-Kontext für AI-Anfragen
 */
export const aiContextStore = {
	/**
	 * Alle Kontext-Karten abrufen
	 */
	get cards(): ContextCard[] {
		return contextCards;
	},

	/**
	 * Anzahl der Kontext-Karten
	 */
	get count(): number {
		return contextCards.length;
	},

	/**
	 * Karte zum Kontext hinzufügen (verhindert Duplikate)
	 */
	addCard(card: ContextCard): boolean {
		if (contextCards.some(c => c.cardId === card.cardId)) {
			return false; // Bereits vorhanden
		}
		contextCards = [...contextCards, card];
		return true;
	},

	/**
	 * Karte aus dem Kontext entfernen
	 */
	removeCard(cardId: string): void {
		contextCards = contextCards.filter(c => c.cardId !== cardId);
	},

	/**
	 * Alle Karten aus dem Kontext entfernen
	 */
	clear(): void {
		contextCards = [];
	},

	/**
	 * Prüft ob eine Karte bereits im Kontext ist
	 */
	hasCard(cardId: string): boolean {
		return contextCards.some(c => c.cardId === cardId);
	}
};
