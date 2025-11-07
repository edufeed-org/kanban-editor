/**
 * Agent-spezifische TypeScript Interfaces
 * Zentrale Type-Definitionen für Intent Detection, Proposals und Actions
 * 
 * Note: AIAction is imported from BoardModel.ts to ensure type consistency
 */

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
