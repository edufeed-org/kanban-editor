/**
 * Agent-spezifische TypeScript Interfaces
 * Zentrale Type-Definitionen für Intent Detection, Proposals und Actions
 * 
 * Note: AIAction is imported from BoardModel.ts to ensure type consistency
 */

// ============================================================================
// Legacy Types (für alte Phase 1/Phase 2 Architektur - DEPRECATED)
// ============================================================================

export type UserIntent = 'explicit' | 'confirmation' | 'vague';

export interface ContentProposal {
	content: string; // Markdown content from LLM
	canGenerate: boolean; // Can we generate a board from this?
	reason?: string; // Why can/can't we generate
}

export interface StructureProposal {
	title: string;
	description?: string;
	columns: Array<{
		name: string;
		cards: Array<{
			heading: string;
			content?: string;
			labels?: string[];
		}>;
	}>;
}

export interface BoardPreview {
	columns: Array<{
		name: string;
		cardCount: number;
		cards: string[]; // Card headings
	}>;
	totalCards: number;
}

// Re-export AIAction from BoardModel.ts for consistency
export type { AIAction } from '$lib/classes/BoardModel';

export interface ValidationResult {
	valid: boolean;
	error?: string;
	data?: any;
}

// ============================================================================
// Tool-Based AI Types (neue MCP-Style Architektur)
// ============================================================================

/**
 * OpenAI Function Calling Format - Tool Definition
 */
export interface ToolDefinition {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			properties: Record<string, {
				type: string;
				description: string;
				enum?: string[];
				items?: { type: string };
			}>;
			required: string[];
		};
	};
}

/**
 * Tool-Call aus LLM Response
 */
export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string; // JSON string
	};
}

/**
 * Ergebnis einer Tool-Ausführung
 */
export interface ToolResult {
	tool_call_id: string;
	tool_name: string;
	success: boolean;
	result?: any;
	error?: string;
}

/**
 * LLM Response mit Tool Calls (OpenAI Format)
 */
export interface LLMToolResponse {
	id: string;
	choices: Array<{
		message: {
			role: 'assistant';
			content: string | null;
			tool_calls?: ToolCall[];
		};
		finish_reason: 'stop' | 'tool_calls' | 'length';
	}>;
}

/**
 * Chat Message für Tool-Based Konversation
 */
export interface ToolChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string | null;
	tool_calls?: ToolCall[];
	tool_call_id?: string; // Für tool-role messages
	name?: string; // Tool name für tool-role messages
}
