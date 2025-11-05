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
import type { AIAction } from '../classes/BoardModel.js';
import { settingsStore } from './settingsStore.svelte.js';
import { userPreferencesStore } from './userPreferencesStore.svelte.js';
import { toast } from 'svelte-sonner';

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

	// ============================================================================
	// Learning System - Pattern Hashing & Confidence Management
	// ============================================================================

	/**
	 * Generiert einen Pattern-Hash für eine AI-Action
	 * Format: "type:cardCount_theme"
	 * 
	 * Beispiele:
	 * - "split_card:1_task_breakdown"
	 * - "add_card:0_brainstorming"
	 * - "update_card:1_bug_fix"
	 */
	private generatePatternHash(action: AIAction): string {
		const type = action.type;
		
		// Card Count (wenn vorhanden)
		const cardCount = (action as any).newCards?.length 
			|| (action as any).cards?.length 
			|| (action as any).cardId ? 1 : 0;
		
		// Theme Detection (einfache Keyword-Analyse)
		const theme = this.detectTheme(action);
		
		return `${type}:${cardCount}_${theme}`;
	}

	/**
	 * Detektiert Theme/Kategorie einer Action basierend auf Content
	 * Nutzt einfache Keyword-Matching
	 */
	private detectTheme(action: AIAction): string {
		// Content zusammenfassen (aus allen relevanten Feldern)
		const content = [
			(action as any).heading || '',
			(action as any).content || '',
			(action as any).newCards?.map((c: any) => c.heading).join(' ') || '',
			(action as any).cards?.map((c: any) => c.heading).join(' ') || ''
		].join(' ').toLowerCase();

		// Theme-Kategorien (erweiterbar)
		const themes = {
			task_breakdown: ['aufteilen', 'split', 'subtask', 'breakdown', 'teil'],
			brainstorming: ['idee', 'brainstorm', 'sammeln', 'finden'],
			bug_fix: ['bug', 'fehler', 'fix', 'problem', 'issue'],
			feature_add: ['feature', 'funktion', 'add', 'neu', 'new'],
			refactor: ['refactor', 'umstruktur', 'optimier'],
			documentation: ['doku', 'documentation', 'readme', 'erkl'],
			planning: ['plan', 'strategie', 'roadmap', 'meilenstein'],
			research: ['research', 'recherche', 'analyse', 'untersuch']
		};

		// Finde passendes Theme
		for (const [theme, keywords] of Object.entries(themes)) {
			if (keywords.some(keyword => content.includes(keyword))) {
				return theme;
			}
		}

		return 'general';
	}

	/**
	 * Verarbeitet eine AI-Action mit Learning System
	 * Entscheidet ob Auto-Execute oder User-Confirmation nötig
	 * 
	 * @returns { shouldAutoExecute: boolean, patternHash: string, confidence: number }
	 */
	public async checkActionConfidence(action: AIAction): Promise<{
		shouldAutoExecute: boolean;
		patternHash: string;
		confidence: number;
		usageCount: number;
	}> {
		// Pattern Hash generieren
		const patternHash = this.generatePatternHash(action);

		// Confidence Threshold aus Settings
		const threshold = settingsStore.settings.learningConfidenceThreshold;

		// Gelernte Pattern-Daten holen
		const learned = userPreferencesStore.getLearnedPattern(patternHash);

		if (learned) {
			// Pattern bekannt: Confidence prüfen
			const shouldAutoExecute = learned.confidence >= threshold;

			return {
				shouldAutoExecute,
				patternHash,
				confidence: learned.confidence,
				usageCount: learned.usageCount
			};
		} else {
			// Pattern unbekannt: Initial Confidence
			const initialConfidence = settingsStore.settings.learningInitialConfidence;

			return {
				shouldAutoExecute: initialConfidence >= threshold, // Sehr unwahrscheinlich bei Default 0.3
				patternHash,
				confidence: initialConfidence,
				usageCount: 0
			};
		}
	}

	/**
	 * Registriert eine erfolgreiche Action-Ausführung
	 * Erhöht Confidence für das Pattern
	 * Zeigt Toast-Notification
	 */
	public recordActionSuccess(patternHash: string, isAutoExecute: boolean = false): void {
		const before = userPreferencesStore.getLearnedPattern(patternHash);
		userPreferencesStore.recordPatternSuccess(patternHash);
		const after = userPreferencesStore.getLearnedPattern(patternHash);
		
		if (isAutoExecute) {
			// Auto-Execute Toast
			toast.success('✅ Auto-Execute', {
				description: `Aktion wurde automatisch basierend auf gelernten Präferenzen ausgeführt.`,
				duration: 4000,
			});
		} else if (after) {
			// Pattern Learning Toast
			const threshold = settingsStore.settings.learningConfidenceThreshold;
			
			toast.info('📚 Pattern gelernt', {
				description: `Confidence: ${after.confidence.toFixed(2)} nach ${after.usageCount} Nutzungen`,
				duration: 3000,
			});
			
			// Threshold erreicht?
			if (before && before.confidence < threshold && after.confidence >= threshold) {
				toast.success('🎯 Threshold erreicht!', {
					description: `Diese Aktion wird ab jetzt automatisch ausgeführt.`,
					duration: 5000,
				});
			}
		}
	}

	/**
	 * Registriert eine abgelehnte Action
	 * Reduziert Confidence für das Pattern (optional)
	 */
	public recordActionRejection(patternHash: string): void {
		// Optional: Confidence reduzieren bei Ablehnung
		// userPreferencesStore.decreasePatternConfidence(patternHash);
		
		// Aktuell: Keine Aktion (nur Erfolge werden gelernt)
		console.log(`Action rejected: ${patternHash}`);
	}

	// ============================================================================
	// LLM Integration (OpenAI-kompatible API)
	// ============================================================================

	/**
	 * Sendet eine Nachricht an das konfigurierte LLM
	 * Nutzt OpenAI-kompatible API (funktioniert mit Ollama, OpenAI, etc.)
	 * 
	 * @param userMessage - Die Nachricht des Users
	 * @param boardContext - Optional: Board-Kontext für AI (Karten, Spalten, etc.)
	 * @returns AI Response als String
	 */
	public async sendToLLM(
		userMessage: string,
		boardContext?: any
	): Promise<{ content: string; error?: string }> {
		const settings = settingsStore.settings;

		// Check if LLM is configured
		if (!settings.llmModel || !settings.llmBaseUrl) {
			return {
				content: '',
				error: '❌ LLM nicht konfiguriert. Bitte in Settings LLM-Model und Base URL eintragen.'
			};
		}

		try {
			// Prepare messages for OpenAI-compatible API
			const messages = [
				{
					role: 'system',
					content: settings.llmSystemPrompt
				},
				// Add previous messages for context (last 5)
				...this.messages
					.slice(-5)
					.map((msg) => ({
						role: msg.role === 'user' ? 'user' : 'assistant',
						content: msg.content
					})),
				{
					role: 'user',
					content: boardContext
						? `${userMessage}\n\nBoard Context:\n${JSON.stringify(boardContext, null, 2)}`
						: userMessage
				}
			];

			console.log('🤖 Sending to LLM:', settings.llmBaseUrl, settings.llmModel);

			// Detect if using OpenRouter (check base URL)
			const isOpenRouter = settings.llmBaseUrl.includes('openrouter.ai');
			
			// Build API endpoint URL
			// OpenRouter uses full path, Ollama/OpenAI use /v1/chat/completions
			const apiUrl = isOpenRouter 
				? `${settings.llmBaseUrl}/chat/completions`  // OpenRouter: /api/v1/chat/completions
				: `${settings.llmBaseUrl}/v1/chat/completions`;  // Ollama/OpenAI

			// Call OpenAI-compatible API
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Only add Authorization if API key is present (not needed for local Ollama)
					...(settings.llmApiKey ? { Authorization: `Bearer ${settings.llmApiKey}` } : {}),
					// OpenRouter-specific headers
					...(isOpenRouter ? {
						'HTTP-Referer': 'https://kanban-editor.nostr.tools',
						'X-Title': 'Nostr Kanban Editor'
					} : {})
				},
				body: JSON.stringify({
					model: settings.llmModel,
					messages,
					temperature: 0.7,
					max_tokens: 1000
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ LLM API Error:', response.status, errorText);
				return {
					content: '',
					error: `❌ LLM API Error: ${response.status} - ${errorText}`
				};
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content || '';

			console.log('✅ LLM Response received:', content.slice(0, 100) + '...');

			return { content };
		} catch (error) {
			console.error('❌ LLM Error:', error);
			return {
				content: '',
				error: `❌ Fehler beim Kontaktieren des LLM: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
			};
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const chatStore = new ChatStore();
