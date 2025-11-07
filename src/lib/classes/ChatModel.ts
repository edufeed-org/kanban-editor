// src/lib/classes/ChatModel.ts
// ChatModel für KI-Integration (Phase 3)

import { generateDTag } from '../utils/idGenerator.js';

// Helper für Unix-Timestamps (number, nicht string!)
function generateTimestamp(): number {
	return Date.now();
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';
export type MemoryType = 'entity' | 'preference' | 'fact' | 'context';

export interface MessageProps {
	id?: string;
	role: MessageRole;
	content: string;
	timestamp?: number;
	tokens?: number;
	attachments?: string[];
}

export interface MemoryProps {
	id?: string;
	type: MemoryType;
	content: string;
	source: string;
	importance: number; // 1-10
	createdAt?: number;
	lastAccessed?: number;
}

export interface ConversationSummaryProps {
	id?: string;
	messageRange: [number, number];
	summary: string;
	tokensSaved: number;
	createdAt?: number;
}

export interface ChatSessionProps {
	id?: string;
	boardId?: string;
	boardName?: string;
	messages?: MessageProps[];
	summaries?: ConversationSummaryProps[];
	memories?: MemoryProps[];
	createdAt?: number;
	lastMessageAt?: number;
}

// ============================================================================
// Message Class
// ============================================================================

export class Message {
	public id: string;
	public role: MessageRole;
	public content: string;
	public timestamp: number;
	public tokens: number;
	public attachments: string[];

	constructor(props: MessageProps) {
		this.id = props.id || generateDTag();
		this.role = props.role;
		this.content = props.content;
		this.timestamp = props.timestamp || generateTimestamp();
		this.tokens = props.tokens || 0;
		this.attachments = props.attachments || [];
	}

	getContextData(): MessageProps {
		return {
			id: this.id,
			role: this.role,
			content: this.content,
			timestamp: this.timestamp,
			tokens: this.tokens,
			attachments: this.attachments
		};
	}
}

// ============================================================================
// Memory Class
// ============================================================================

export class Memory {
	public id: string;
	public type: MemoryType;
	public content: string;
	public source: string;
	public importance: number;
	public createdAt: number;
	public lastAccessed: number;

	constructor(props: MemoryProps) {
		this.id = props.id || generateDTag();
		this.type = props.type;
		this.content = props.content;
		this.source = props.source;
		this.importance = props.importance;
		this.createdAt = props.createdAt || generateTimestamp();
		this.lastAccessed = props.lastAccessed || generateTimestamp();
	}

	touch(): void {
		this.lastAccessed = generateTimestamp();
	}

	getContextData(): MemoryProps {
		return {
			id: this.id,
			type: this.type,
			content: this.content,
			source: this.source,
			importance: this.importance,
			createdAt: this.createdAt,
			lastAccessed: this.lastAccessed
		};
	}
}

// ============================================================================
// ConversationSummary Class
// ============================================================================

export class ConversationSummary {
	public id: string;
	public messageRange: [number, number];
	public summary: string;
	public tokensSaved: number;
	public createdAt: number;

	constructor(props: ConversationSummaryProps) {
		this.id = props.id || generateDTag();
		this.messageRange = props.messageRange;
		this.summary = props.summary;
		this.tokensSaved = props.tokensSaved;
		this.createdAt = props.createdAt || generateTimestamp();
	}

	getContextData(): ConversationSummaryProps {
		return {
			id: this.id,
			messageRange: this.messageRange,
			summary: this.summary,
			tokensSaved: this.tokensSaved,
			createdAt: this.createdAt
		};
	}
}

// ============================================================================
// ChatSession Class (Main)
// ============================================================================

export class ChatSession {
	public id: string;
	public boardId: string;
	public boardName: string;
	public messages: Message[];
	public summaries: ConversationSummary[];
	public memories: Memory[];
	public createdAt: number;
	public lastMessageAt: number;

	constructor(props: ChatSessionProps) {
		this.id = props.id || generateDTag();
		this.boardId = props.boardId || this.id;
		this.boardName = props.boardName || 'Unnamed Board';
		this.messages = props.messages?.map((m) => new Message(m)) || [];
		this.summaries = props.summaries?.map((s) => new ConversationSummary(s)) || [];
		this.memories = props.memories?.map((m) => new Memory(m)) || [];
		this.createdAt = props.createdAt || generateTimestamp();
		this.lastMessageAt = props.lastMessageAt || generateTimestamp();
	}

	addMessage(props: MessageProps): Message {
		const message = new Message(props);
		this.messages = [...this.messages, message];
		this.lastMessageAt = generateTimestamp();
		return message;
	}

	deleteMessage(messageId: string): void {
		this.messages = this.messages.filter((m) => m.id !== messageId);
	}

	addSummary(props: ConversationSummaryProps): ConversationSummary {
		const summary = new ConversationSummary(props);
		this.summaries = [...this.summaries, summary];
		return summary;
	}

	addMemory(props: MemoryProps): Memory {
		const memory = new Memory(props);
		this.memories = [...this.memories, memory];
		return memory;
	}

	findMemory(query: string): Memory[] {
		const lowerQuery = query.toLowerCase();
		return this.memories.filter((m) => m.content.toLowerCase().includes(lowerQuery));
	}

	getTopMemories(limit: number = 5): Memory[] {
		return this.memories
			.sort((a, b) => {
				// Sortiere zuerst nach importance (absteigend)
				// Bei gleicher importance: sortiere nach lastAccessed (neuere zuerst)
				if (a.importance !== b.importance) {
					return b.importance - a.importance;
				}
				// Gleiche importance → neuere Memories zuerst
				return b.lastAccessed - a.lastAccessed;
			})
			.slice(0, limit);
	}

	getContextData(): ChatSessionProps {
		return {
			id: this.id,
			boardId: this.boardId,
			boardName: this.boardName,
			messages: this.messages.map((m) => m.getContextData()),
			summaries: this.summaries.map((s) => s.getContextData()),
			memories: this.memories.map((m) => m.getContextData()),
			createdAt: this.createdAt,
			lastMessageAt: this.lastMessageAt
		};
	}
}
