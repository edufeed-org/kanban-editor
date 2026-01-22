/**
 * Agent Module - Zentrale Exports
 * Konsolidiert alle Agent-bezogenen Funktionen
 * 
 * 🔧 ARCHITEKTUR: Tool-Based AI (MCP-Style OpenAI Function Calling)
 * Das Intent Detection und Learning System wurden entfernt (archiviert).
 * Alle AI-Interaktionen laufen jetzt über Tool-Based Function Calling.
 */

// Types
export type { UserIntent, ContentProposal, StructureProposal, BoardPreview, AIAction, ValidationResult } from './types';

// LLM Request Utilities
export { llmRequest } from './llmRequest';
export type { LLMRequestOptions, LLMReturnType } from './llmRequest';

// Content Proposal (Phase 1)
export { parseContentProposal } from './contentProposal';

// Structure Generation (Phase 2)
export {
	STRUCTURE_GENERATION_SYSTEM_PROMPT,
	analyzeExistingStructure,
	generateStructurePrompt,
	validateStructureJSON,
	validateColumnAlignment,
	parseStructureProposal,
	structureToActions
} from './structureGeneration';

// Action Processing
export { createBoardPreview, executeActions } from './actionProcessing';
