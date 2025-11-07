/**
 * Agent Module - Zentrale Exports
 * Konsolidiert alle Agent-bezogenen Funktionen
 */

// Types
export type { UserIntent, ContentProposal, StructureProposal, BoardPreview, AIAction, ValidationResult } from './types';

// Intent Detection
export { detectUserIntent, getIntentAwareSystemPrompt } from './intentDetection';

// LLM-basierte Intent Detection (Alternative - kontext-bewusst)
export { llmDetectIntention, detectIntentViaLLM } from './llmIntentDetection';
export type { IntentDetectionResult } from './llmIntentDetection';

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
