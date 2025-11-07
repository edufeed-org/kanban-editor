import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatStore } from './chatStore.svelte';
import type { MessageProps, MemoryProps } from '../classes/ChatModel.js';

/**
 * ChatStore Tests
 * 
 * Tests:
 * 1. Session Creation & Loading
 * 2. Message CRUD
 * 3. Memory Search & Ranking
 * 4. Summary Creation
 * 5. AI Context Preparation
 * 6. localStorage Persistence
 */

describe('ChatStore', () => {
	let chatStore: ChatStore;
	let mockLocalStorage: Record<string, string>;
	let originalLocalStorage: Storage;

	beforeEach(() => {
		// Save original localStorage
		originalLocalStorage = window.localStorage;

		// Mock localStorage
		mockLocalStorage = {};
		Object.defineProperty(window, 'localStorage', {
			value: {
				getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
				setItem: vi.fn((key: string, value: string) => {
					mockLocalStorage[key] = value;
				}),
				removeItem: vi.fn((key: string) => {
					delete mockLocalStorage[key];
				}),
				clear: vi.fn(() => {
					mockLocalStorage = {};
				}),
				key: vi.fn(),
				length: 0
			} as Storage,
			writable: true,
			configurable: true
		});

		chatStore = new ChatStore();
	});

	afterEach(() => {
		// Restore original localStorage
		Object.defineProperty(window, 'localStorage', {
			value: originalLocalStorage,
			writable: true,
			configurable: true
		});
	});

	// ============================================================
	// 1. Session Creation & Loading
	// ============================================================

	describe('Session Management', () => {
		it('should create a new session when loading a board for the first time', () => {
			chatStore.loadSession('board-123', 'Test Board');

			const session = chatStore.currentSession;
			expect(session).toBeDefined();
			expect(session?.id).toBe('board-123');
			expect(session?.boardName).toBe('Test Board');
		});

		it('should load existing session from localStorage', () => {
			// Pre-populate localStorage
			const sessionData = {
				id: 'board-123',
				boardId: 'board-123',
				boardName: 'Existing Board',
				messages: [
					{ id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() }
				],
				memories: [],
				summaries: []
			};
			mockLocalStorage['chat-session-board-123'] = JSON.stringify(sessionData);

			chatStore.loadSession('board-123');

			const session = chatStore.currentSession;
			expect(session?.boardName).toBe('Existing Board');
			expect(chatStore.messages.length).toBe(1);
			expect(chatStore.messages[0].content).toBe('Hello');
		});

		it('should save current session before loading a new one', () => {
			chatStore.loadSession('board-1', 'Board 1');
			chatStore.addMessage('Test message', 'user');

			// Switch to different board
			chatStore.loadSession('board-2', 'Board 2');

			// Check if board-1 session was saved
			const savedSession = mockLocalStorage['chat-session-board-1'];
			expect(savedSession).toBeDefined();
			const parsed = JSON.parse(savedSession);
			expect(parsed.messages.length).toBe(1);
		});

		it('should delete a session from localStorage', () => {
			chatStore.loadSession('board-123');
			chatStore.addMessage('Test', 'user');

			chatStore.deleteSession('board-123');

			expect(mockLocalStorage['chat-session-board-123']).toBeUndefined();
			expect(chatStore.isActive).toBe(false);
		});

		it('should list all sessions', () => {
			// Create multiple sessions
			mockLocalStorage['chat-session-board-1'] = JSON.stringify({
				id: 'board-1',
				boardId: 'board-1',
				boardName: 'Board 1',
				messages: [],
				memories: [],
				summaries: []
			});
			mockLocalStorage['chat-session-board-2'] = JSON.stringify({
				id: 'board-2',
				boardId: 'board-2',
				boardName: 'Board 2',
				messages: [],
				memories: [],
				summaries: []
			});
		mockLocalStorage['some-other-key'] = 'not a session';

		// Mock Object.keys
		Object.defineProperty(window.localStorage, 'key', {
			value: (index: number) => Object.keys(mockLocalStorage)[index],
			writable: true
		});
		Object.defineProperty(window.localStorage, 'length', {
			get: () => Object.keys(mockLocalStorage).length
		});			const sessions = chatStore.listAllSessions();
			expect(sessions.length).toBe(2);
			expect(sessions.some((s) => s.boardId === 'board-1')).toBe(true);
			expect(sessions.some((s) => s.boardId === 'board-2')).toBe(true);
		});
	});

	// ============================================================
	// 2. Message CRUD
	// ============================================================

	describe('Message Management', () => {
		beforeEach(() => {
			chatStore.loadSession('test-board', 'Test Board');
		});

		it('should add a user message', () => {
			chatStore.addMessage('Hello AI', 'user');

			expect(chatStore.messages.length).toBe(1);
			expect(chatStore.messages[0].content).toBe('Hello AI');
			expect(chatStore.messages[0].role).toBe('user');
		});

		it('should add an assistant message', () => {
			chatStore.addMessage('Hello human', 'assistant');

			expect(chatStore.messages.length).toBe(1);
			expect(chatStore.messages[0].role).toBe('assistant');
		});

		it('should persist messages to localStorage', () => {
			chatStore.addMessage('Test persistence', 'user');

			const saved = mockLocalStorage['chat-session-test-board'];
			expect(saved).toBeDefined();

			const parsed = JSON.parse(saved);
			expect(parsed.messages.length).toBe(1);
			expect(parsed.messages[0].content).toBe('Test persistence');
		});

		it('should delete a specific message', () => {
			chatStore.addMessage('Message 1', 'user');
			const msgId = chatStore.messages[0].id;
			chatStore.addMessage('Message 2', 'user');

			expect(chatStore.messages.length).toBe(2);

			chatStore.deleteMessage(msgId);

			expect(chatStore.messages.length).toBe(1);
			expect(chatStore.messages[0].content).toBe('Message 2');
		});

		it('should clear all messages', () => {
			chatStore.addMessage('Msg 1', 'user');
			chatStore.addMessage('Msg 2', 'assistant');
			chatStore.addMessage('Msg 3', 'user');

			expect(chatStore.messages.length).toBe(3);

			chatStore.clearMessages();

			expect(chatStore.messages.length).toBe(0);
		});
	});

	// ============================================================
	// 3. Memory Search & Ranking
	// ============================================================

	describe('Memory Management', () => {
		beforeEach(() => {
			chatStore.loadSession('test-board', 'Test Board');
		});

		it('should add a memory', () => {
			chatStore.addMemory('User prefers dark mode', 'fact', 8, 'msg-123');

			expect(chatStore.memories.length).toBe(1);
			expect(chatStore.memories[0].content).toBe('User prefers dark mode');
		});

		it('should search memories by query', () => {
			chatStore.addMemory('User is learning TypeScript', 'fact', 7, 'msg-1');
			chatStore.addMemory('User prefers React over Vue', 'preference', 6, 'msg-2');
			chatStore.addMemory('User works at Acme Corp', 'fact', 9, 'msg-3');

			const results = chatStore.searchMemories('user prefer');

			expect(results.length).toBe(1);
			expect(results[0].content).toBe('User prefers React over Vue');
		});

		it('should rank memories by importance and recency', () => {
			const now = Date.now();

			// Add memories with different importance and access times
			chatStore.addMemory('Low importance, old', 'fact', 3, 'msg-1');
			chatStore.addMemory('High importance, recent', 'fact', 10, 'msg-2');
			chatStore.addMemory('Medium importance, medium recency', 'fact', 6, 'msg-3');

			// Simulate access times by modifying memories directly
			const memories = chatStore.memories;
			if (memories.length >= 3) {
				memories[0].lastAccessed = now - 10000; // 10 seconds ago
				memories[1].lastAccessed = now - 1000; // 1 second ago
				memories[2].lastAccessed = now - 5000; // 5 seconds ago
			}

			const topMemories = chatStore.getTopMemories(2);

			expect(topMemories.length).toBe(2);
			expect(topMemories[0].content).toBe('High importance, recent');
			// Second should be medium importance with medium recency
		});

	it('should update memory lastAccessed when accessed', async () => {
		chatStore.addMemory('Test access tracking', 'fact', 5, 'msg-1');

		const initialLastAccessed = chatStore.memories[0].lastAccessed;

		// Wait a bit to ensure different timestamp
		await new Promise(resolve => setTimeout(resolve, 50));

		// Access via search (this should now update lastAccessed)
		const results = chatStore.searchMemories('test');

		// Verify that the memory was found
		expect(results.length).toBeGreaterThan(0);
		
		// Verify that lastAccessed was updated
		expect(chatStore.memories[0].lastAccessed).toBeGreaterThan(initialLastAccessed);
	});
	});

	// ============================================================
	// 4. Summary Creation
	// ============================================================

	describe('Summary Management', () => {
		beforeEach(() => {
			chatStore.loadSession('test-board', 'Test Board');
		});

		it('should add a conversation summary', () => {
			chatStore.addMessage('Hello', 'user');
			chatStore.addMessage('Hi there!', 'assistant');
			chatStore.addMessage('How are you?', 'user');

			const msgIds = chatStore.messages.map((m) => m.id);

			chatStore.addSummary([0, 2], 'User and assistant exchanged greetings', 50);

			expect(chatStore.summaries.length).toBe(1);
			expect(chatStore.summaries[0].summary).toContain('greetings');
		});
	});

	// ============================================================
	// 5. AI Context Preparation
	// ============================================================

	describe('AI Context Preparation', () => {
		beforeEach(() => {
			chatStore.loadSession('test-board', 'Test Board');
		});

		it('should prepare AI context with recent messages', () => {
			chatStore.addMessage('First message', 'user');
			chatStore.addMessage('Second message', 'assistant');
			chatStore.addMessage('Third message', 'user');

			const context = chatStore.getAIContext();

			expect(context.messages.length).toBe(3);
			expect(context.messages[0].content).toBe('First message');
		});

		it('should include top memories in AI context', () => {
			chatStore.addMemory('Important fact', 'fact', 10, 'msg-1');
			chatStore.addMemory('Less important', 'preference', 3, 'msg-2');

			const context = chatStore.getAIContext();

			expect(context.memories.length).toBeGreaterThan(0);
			expect(context.memories[0].content).toBe('Important fact');
		});

		it('should include full message history when requested', () => {
			// Add many messages
			for (let i = 0; i < 15; i++) {
				chatStore.addMessage(`Message ${i}`, 'user');
			}

			const contextRecent = chatStore.getAIContext(false);
			const contextFull = chatStore.getAIContext(true);

			expect(contextRecent.messages.length).toBeLessThan(15);
			expect(contextFull.messages.length).toBe(15);
		});

		it('should include summaries in AI context', () => {
			chatStore.addSummary([0, 5], 'Previous conversation summary', 100);

			const context = chatStore.getAIContext();

			expect(context.summaries.length).toBe(1);
			expect(context.summaries[0].summary).toContain('Previous conversation');
		});
	});

	// ============================================================
	// 6. localStorage Persistence
	// ============================================================

	describe('Persistence', () => {
	it('should persist session to localStorage on every update', () => {
		chatStore.loadSession('persist-test', 'Persist Test');

		chatStore.addMessage('Test', 'user');

		expect(window.localStorage.setItem).toHaveBeenCalledWith(
			'chat-session-persist-test',
			expect.any(String)
		);
	});		it('should reconstruct session from localStorage correctly', () => {
			// Create session with complex data
			chatStore.loadSession('complex-test', 'Complex Test');
			chatStore.addMessage('Message 1', 'user');
			chatStore.addMemory('Memory 1', 'fact', 8, 'msg-1');
			chatStore.addSummary([0, 0], 'Summary 1', 50);

			// Create new store instance (simulates page reload)
			const newStore = new ChatStore();
			newStore.loadSession('complex-test');

			expect(newStore.messages.length).toBe(1);
			expect(newStore.memories.length).toBe(1);
			expect(newStore.summaries.length).toBe(1);
			expect(newStore.messages[0].content).toBe('Message 1');
		});
	});

	// ============================================================
	// 7. Edge Cases
	// ============================================================

	describe('Edge Cases', () => {
		it('should throw error when adding message without active session', () => {
			expect(() => {
				chatStore.addMessage('No session', 'user');
			}).toThrow('No active session');
		});

		it('should handle corrupted localStorage data gracefully', () => {
			mockLocalStorage['chat-session-corrupted'] = 'not valid JSON';

			// Should create new session instead of crashing
			expect(() => {
				chatStore.loadSession('corrupted');
			}).not.toThrow();

			expect(chatStore.currentSession).toBeDefined();
		});
	});
});
