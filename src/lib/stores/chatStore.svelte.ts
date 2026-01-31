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
import { settingsStore } from './settingsStore.svelte.js';

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
	 * @param content - Nachrichtentext
	 * @param role - 'user' oder 'assistant'
	 * @param oerResults - Optional: OER-Suchergebnisse für interaktive Anzeige
	 */
	public addMessage(
		content: string, 
		role: 'user' | 'assistant',
		oerResults?: import('$lib/classes/ChatModel.js').OerResultData[]
	): void {
		if (!this.session) {
			throw new Error('No active session. Call loadSession(boardId) first!');
		}

		this.session.addMessage({ content, role, oerResults });
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
	public async sendToLLMWithSystem(
		userMessage: string,
		systemPrompt: string,
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
			// KRITISCH: Benutze den übergebenen systemPrompt, NICHT settings.llmSystemPrompt!
			const messages = [
				{
					role: 'system',
					content: systemPrompt  // ← CUSTOM System-Prompt!
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

			console.log('🤖 Sending to LLM (with custom system prompt):', settings.llmBaseUrl, settings.llmModel);

			// Detect if using OpenRouter (check base URL)
			const isOpenRouter = settings.llmBaseUrl.includes('openrouter.ai');
			
			// Build API endpoint URL
			const apiUrl = isOpenRouter 
				? `${settings.llmBaseUrl}/chat/completions`
				: `${settings.llmBaseUrl}/v1/chat/completions`;

			// Call OpenAI-compatible API
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(settings.llmApiKey ? { Authorization: `Bearer ${settings.llmApiKey}` } : {}),
					...(isOpenRouter ? {
						'HTTP-Referer': 'https://kanban-editor.nostr.tools',
						'X-Title': 'Nostr Kanban Editor'
					} : {})
				},
				body: JSON.stringify({
					model: settings.llmModel,
					messages,
					temperature: 0.2,  // ← NIEDRIGER für konsistente JSON-Generierung
					max_tokens: 2000  // ← Erhöht für JSON-Generierung
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

			if (!content) {
				console.warn('⚠️ LLM returned empty content');
				return {
					content: '',
					error: 'LLM returned empty response'
				};
			}

			console.log('✅ LLM Response received (length: ' + content.length + ')');
			console.log('📋 Response start:', content.substring(0, 150));

			return { content };
		} catch (error) {
			console.error('❌ LLM Error:', error);
			return {
				content: '',
				error: `❌ Fehler beim Kontaktieren des LLM: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
			};
		}
	}

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

	// ============================================================================
	// Tool-Based LLM Integration (OpenAI Function Calling)
	// ============================================================================

	/**
	 * Sendet eine Nachricht an das LLM mit Tool-Definitionen
	 * Nutzt OpenAI Function Calling Format
	 * 
	 * @param userMessage - Die Nachricht des Users
	 * @param systemPrompt - System-Prompt mit Kontext
	 * @param tools - Tool-Definitionen im OpenAI Format
	 * @returns AI Response mit potentiellen Tool-Calls
	 */
	public async sendToLLMWithTools(
		userMessage: string,
		systemPrompt: string,
		tools: Array<{
			type: 'function';
			function: {
				name: string;
				description: string;
				parameters: any;
			};
		}>
	): Promise<{
		content: string | null;
		tool_calls?: Array<{
			id: string;
			type: 'function';
			function: {
				name: string;
				arguments: string;
			};
		}>;
		error?: string;
	}> {
		const settings = settingsStore.settings;

		// Check if LLM is configured
		if (!settings.llmModel || !settings.llmBaseUrl) {
			return {
				content: null,
				error: '❌ LLM nicht konfiguriert. Bitte in Settings LLM-Model und Base URL eintragen.'
			};
		}

		try {
			// Prepare messages for OpenAI-compatible API
			const messages = [
				{
					role: 'system',
					content: systemPrompt
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
					content: userMessage
				}
			];

			console.log('🔧 Sending to LLM with tools:', settings.llmBaseUrl, settings.llmModel);
			console.log('📋 Available tools:', tools.map(t => t.function.name).join(', '));

			// Detect if using OpenRouter (check base URL)
			const isOpenRouter = settings.llmBaseUrl.includes('openrouter.ai');
			const isOllama = settings.llmBaseUrl.includes('localhost') || settings.llmBaseUrl.includes('127.0.0.1');
			
			// Build API endpoint URL
			const apiUrl = isOpenRouter 
				? `${settings.llmBaseUrl}/chat/completions`
				: `${settings.llmBaseUrl}/v1/chat/completions`;

			// Request body mit Tools
			const requestBody: any = {
				model: settings.llmModel,
				messages,
				temperature: 0.1, // Sehr niedrig für konsistente Tool-Calls
				max_tokens: 4000
			};

			// Tool-Support je nach Provider
			if (isOllama) {
				// Ollama unterstützt tools ab Version 0.4.0
				// Verwende 'required' um Tool-Nutzung zu erzwingen
				requestBody.tools = tools;
				requestBody.tool_choice = 'required';
			} else {
				// OpenAI/OpenRouter - Standard Tool Format
				requestBody.tools = tools;
				requestBody.tool_choice = 'required';
			}

			// Call API
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(settings.llmApiKey ? { Authorization: `Bearer ${settings.llmApiKey}` } : {}),
					...(isOpenRouter ? {
						'HTTP-Referer': 'https://kanban-editor.nostr.tools',
						'X-Title': 'Nostr Kanban Editor'
					} : {})
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('❌ LLM Tool API Error:', response.status, errorText);
				
				// Fallback: Wenn Tool-Calling nicht unterstützt, versuche ohne Tools
				if (response.status === 400 && errorText.includes('tool')) {
					console.warn('⚠️ Tool-Calling nicht unterstützt, Fallback auf Standard-Modus');
					// Hier könnte ein Fallback implementiert werden
				}
				
				return {
					content: null,
					error: `❌ LLM API Error: ${response.status} - ${errorText}`
				};
			}

			const data = await response.json();
			const choice = data.choices?.[0];
			
			if (!choice) {
				return {
					content: null,
					error: 'LLM returned empty response'
				};
			}

			const message = choice.message;
			const toolCalls = message.tool_calls;
			const content = message.content;

			if (toolCalls && toolCalls.length > 0) {
				console.log('🔧 LLM returned tool calls:', toolCalls.map((t: any) => t.function.name).join(', '));
				return {
					content,
					tool_calls: toolCalls
				};
			}

			console.log('💬 LLM returned text response:', content?.substring(0, 100));
			return { content };

		} catch (error) {
			console.error('❌ LLM Tool Error:', error);
			return {
				content: null,
				error: `❌ Fehler beim Kontaktieren des LLM: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
			};
		}
	}
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const chatStore = new ChatStore();
