/**
 * Tool-Based AI System - Exports
 * 
 * MCP-Style Tool-Based Architektur für KI-gesteuerte Board-Operationen.
 * Ersetzt das alte Phase 1/Phase 2 System.
 */

// Tool Definitions (OpenAI Function Calling Format)
export {
    toolDefinitions,
    getToolDefinitions,
    getToolByName,
    type ToolDefinition
} from './toolDefinitions';

// System Prompt Builder
export {
    buildToolSystemPrompt,
    buildMinimalSystemPrompt
} from './toolSystemPrompt';

// Tool Executor
export {
    executeToolCall,
    executeToolCalls,
    summarizeResults,
    type ToolCall,
    type ToolResult,
    type ExecutionContext
} from './toolExecutor';
