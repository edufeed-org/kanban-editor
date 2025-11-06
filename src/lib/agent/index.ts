/**
 * Agent Module - Zentrale Exports
 * Konsolidiert alle Agent-bezogenen Funktionen
 */

// Types
export type { UserIntent, ContentProposal, StructureProposal, BoardPreview, AIAction, ValidationResult } from './types';

// Intent Detection
export { detectUserIntent, getIntentAwareSystemPrompt } from './intentDetection';

// Content Proposal (Phase 1)
export { parseContentProposal } from './contentProposal';

// Structure Generation (Phase 2)
export {
	STRUCTURE_GENERATION_SYSTEM_PROMPT,
	generateStructurePrompt,
	validateStructureJSON,
	parseStructureProposal,
	structureToActions
} from './structureGeneration';

// Action Processing
export { createBoardPreview, executeActions } from './actionProcessing';
