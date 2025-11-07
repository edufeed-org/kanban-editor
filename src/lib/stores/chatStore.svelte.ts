// src/lib/stores/chatStore.svelte.ts
// Manual localStorage Pattern für Multi-Board Chat-Sessions

import {
	ChatSession,
	type MessageProps,
	type MemoryProps,
	type Message,
	type Memory,
	type ConversationSummary
} from '../classes/ChatModel.js';

/**
 * ChatStore - Verwaltet KI-Chat-Sessions für jedes Board
 * 
 * Pattern: Manual localStorage (dynamische Keys: chat-session-${boardId})
 * Phase: 3 (KI-Integration)
 * 
 * Features:
 * - 1 Chat-Session pro Board
 * - Message-History mit Timestamps
 * - Memory-System für AI-Context
 * - Conversation Summaries für lange Chats
 */
export class ChatStore {
	// ============================================================================
	// State (Svelte 5 Runes)
	// ============================================================================

	private currentBoardId = $state<string | null>(null);
	private session = $state<ChatSession | null>(null);
	private updateTrigger = $state(0);

	// ============================================================================
	// Derived Values (Reaktiv für UI)
	// ============================================================================

	public messages = $derived.by(() => {
		this.updateTrigger; // ← Dependency tracking
		return this.session?.messages || [];
	});

	public memories = $derived.by(() => {
		this.updateTrigger;
		return this.session?.memories || [];
	});

	public summaries = $derived.by(() => {
		this.updateTrigger;
		return this.session?.summaries || [];
	});

	public isActive = $derived(!!this.session);

	public currentSession = $derived(this.session ? this.session.getContextData() : null);

	// ============================================================================
	// Storage Methods (Manual localStorage)
	// ============================================================================

	private getStorageKey(boardId: string): string {
		return `chat-session-${boardId}`;
	}

	private loadFromStorage(boardId: string): ChatSession {
		const key = this.getStorageKey(boardId);
		const stored = localStorage.getItem(key);

		if (stored) {
			try {
				const data = JSON.parse(stored);
				return new ChatSession(data);
			} catch (error) {
				console.error('Failed to parse chat session:', error);
			}
		}

		// Neue Session erstellen
		return new ChatSession({
			id: boardId,
			boardId,
			boardName: 'Board ' + boardId.slice(0, 8)
		});
	}

	private saveToStorage(): void {
		if (!this.session || !this.currentBoardId) return;

		const key = this.getStorageKey(this.currentBoardId);
		const data = this.session.getContextData();
		localStorage.setItem(key, JSON.stringify(data));
	}

	private triggerUpdate(): void {
		this.updateTrigger++; // ← Triggert $derived
		this.saveToStorage(); // ← Persistiert sofort
	}

	// ============================================================================
	// Public API - Session Management
	// ============================================================================

	/**
	 * Lädt oder erstellt eine Chat-Session für ein Board
	 */
	public loadSession(boardId: string, boardName?: string): void {
		// Alte Session speichern
		if (this.session && this.currentBoardId) {
			this.saveToStorage();
		}

		// Neue Session laden
		this.currentBoardId = boardId;
		this.session = this.loadFromStorage(boardId);

		// Board-Name aktualisieren falls übergeben
		if (boardName && this.session) {
			this.session.boardName = boardName;
		}

		this.updateTrigger++; // UI neu rendern
	}

	/**
	 * Löscht eine Chat-Session
	 */
	public deleteSession(boardId: string): void {
		const key = this.getStorageKey(boardId);
		localStorage.removeItem(key);

		// Falls aktuelle Session: zurücksetzen
		if (this.currentBoardId === boardId) {
			this.currentBoardId = null;
			this.session = null;
			this.updateTrigger++;
		}
	}

	/**
	 * Listet alle verfügbaren Chat-Sessions
	 */
	public listAllSessions(): { boardId: string; lastMessageAt: number; messageCount: number }[] {
		const sessions: { boardId: string; lastMessageAt: number; messageCount: number }[] = [];

		// Alle localStorage Keys durchsuchen
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith('chat-session-')) {
				const boardId = key.replace('chat-session-', '');
				try {
					const stored = localStorage.getItem(key);
					if (stored) {
						const data = JSON.parse(stored);
						sessions.push({
							boardId,
							lastMessageAt: data.lastMessageAt || 0,
							messageCount: data.messages?.length || 0
						});
					}
				} catch (error) {
					console.error(`Failed to parse session ${boardId}:`, error);
				}
			}
		}

		// Sortiere nach letzter Aktivität
		return sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
	}

	// ============================================================================
	// Public API - Messages
	// ============================================================================

	/**
	 * Fügt eine neue Message hinzu
	 */
	public addMessage(content: string, role: 'user' | 'assistant'): void {
		if (!this.session) {
			throw new Error('No active session. Call loadSession(boardId) first!');
		}

		this.session.addMessage({ content, role });
		this.triggerUpdate();
	}

	/**
	 * Löscht eine Message
	 */
	public deleteMessage(messageId: string): void {
		if (!this.session) return;

		this.session.deleteMessage(messageId);
		this.triggerUpdate();
	}

	/**
	 * Löscht alle Messages der aktuellen Session
	 */
	public clearMessages(): void {
		if (!this.session) return;

		this.session.messages = [];
		this.triggerUpdate();
	}

	// ============================================================================
	// Public API - Memories
	// ============================================================================

	/**
	 * Fügt ein Memory hinzu
	 */
	public addMemory(
		content: string,
		type: 'entity' | 'preference' | 'fact' | 'context',
		importance: number,
		source: string
	): void {
		if (!this.session) return;

		this.session.addMemory({ content, type, importance, source });
		this.triggerUpdate();
	}

	/**
	 * Sucht Memories nach Query und aktualisiert lastAccessed
	 */
	public searchMemories(query: string): MemoryProps[] {
		if (!this.session) return [];

		const results = this.session.findMemory(query);
		
		// Update lastAccessed für alle gefundenen Memories
		results.forEach((m: Memory) => m.touch());
		
		// Trigger update nur wenn Memories gefunden wurden
		if (results.length > 0) {
			this.triggerUpdate();
		}
		
		return results.map((m: Memory) => m.getContextData());
	}

	/**
	 * Holt die wichtigsten Memories (für AI-Context)
	 */
	public getTopMemories(limit: number = 5): MemoryProps[] {
		if (!this.session) return [];

		return this.session.getTopMemories(limit).map((m: Memory) => m.getContextData());
	}

	// ============================================================================
	// Public API - Summaries
	// ============================================================================

	/**
	 * Erstellt eine Conversation Summary
	 * @param messageRange [startIndex, endIndex]
	 * @param summaryText Vom AI generiert
	 */
	public addSummary(messageRange: [number, number], summaryText: string, tokensSaved: number): void {
		if (!this.session) return;

		this.session.addSummary({
			messageRange,
			summary: summaryText,
			tokensSaved
		});
		this.triggerUpdate();
	}

	// ============================================================================
	// Public API - Context für AI
	// ============================================================================

	/**
	 * Bereitet Context für AI-API vor
	 * Kombiniert Messages + Top Memories + Summaries
	 */
	public getAIContext(includeFullHistory: boolean = false): {
		messages: MessageProps[];
		memories: MemoryProps[];
		summaries: any[];
	} {
		if (!this.session) {
			return { messages: [], memories: [], summaries: [] };
		}

		const messages = includeFullHistory
			? this.session.messages.map((m: Message) => m.getContextData())
			: this.session.messages.slice(-10).map((m: Message) => m.getContextData()); // Letzte 10

		const memories = this.session.getTopMemories(5).map((m: Memory) => m.getContextData());

		const summaries = this.session.summaries.map((s: ConversationSummary) => s.getContextData());

		return { messages, memories, summaries };
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const chatStore = new ChatStore();
