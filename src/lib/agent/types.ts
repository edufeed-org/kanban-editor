/**
 * Agent-spezifische TypeScript Interfaces
 * Zentrale Type-Definitionen für Tool-Based AI System
 * 
 * Note: AIAction is imported from BoardModel.ts to ensure type consistency
 */

// Re-export AIAction from BoardModel.ts for consistency
export type { AIAction } from '$lib/classes/BoardModel';

// ============================================================================
// Tool-Based AI Types (MCP-Style OpenAI Function Calling)
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
