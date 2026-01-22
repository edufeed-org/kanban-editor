/**
 * Agent Module - Zentrale Exports
 * 
 *  ARCHITEKTUR: Tool-Based AI (MCP-Style OpenAI Function Calling)
 * Das alte Phase 1/2 System (Intent Detection, Content Proposal, Structure Generation)
 * wurde entfernt und archiviert. Alle AI-Interaktionen laufen jetzt über Tool-Based Function Calling.
 */

// LLM Request Utilities
export { llmRequest } from './llmRequest';
export type { LLMRequestOptions, LLMReturnType } from './llmRequest';

// Tool-Based AI Types (aktiv genutzt)
export type {
ToolDefinition,
ToolCall,
ToolResult,
LLMToolResponse,
ToolChatMessage
} from './types';

// Re-export AIAction from BoardModel for convenience
export type { AIAction } from '$lib/classes/BoardModel';
