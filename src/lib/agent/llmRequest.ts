/**
 * LLM Request Utilities
 * Globale Funktionen für direkte LLM-Anfragen außerhalb der Chat-History
 */

import { settingsStore } from '$lib/stores/settingsStore.svelte';

export type LLMReturnType = 'json' | 'text';

export interface LLMRequestOptions {
	systemPrompt: string;
	userMessage: string;
	returnType?: LLMReturnType;
	temperature?: number;
	maxTokens?: number;
}

/**
 * Helper: Hole API-Config aus SettingsStore
 */
function getApiConfig() {
	const settings = settingsStore.settings;
	
	return {
		endpoint: settings.llmBaseUrl,
		apiKey: settings.llmApiKey,
		model: settings.llmModel
	};
}

/**
 * Globale LLM Request Funktion (NICHT Teil der Chat-History)
 * 
 * @param options - Request-Optionen
 * @returns LLM Response als JSON oder Text
 * 
 * @example
 * const result = await llmRequest({
 *   systemPrompt: "You are a helpful assistant",
 *   userMessage: "What is 2+2?",
 *   returnType: 'json'
 * });
 */
export async function llmRequest<T = any>(
	options: LLMRequestOptions
): Promise<T | string> {
	const {
		systemPrompt,
		userMessage,
		returnType = 'text',
		temperature = 0.1, // Low temperature for consistent results
		maxTokens = 500
	} = options;

	const config = getApiConfig();

	// ✅ Ollama (local) braucht keinen API Key
	const isOllama = config.endpoint.includes('localhost') || config.endpoint.includes('127.0.0.1');
	
	if (!isOllama && !config.apiKey) {
		throw new Error('API Key nicht konfiguriert! Bitte in Einstellungen hinterlegen.');
	}

	// 🔧 Ollama verwendet /api/chat statt OpenAI /v1/chat/completions
	let endpoint = config.endpoint;
	if (isOllama && !endpoint.includes('/api/')) {
		endpoint = endpoint.replace(/\/$/, '') + '/api/chat';
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	let payload: any;
	let parseResponse: (data: any) => string;

	if (isOllama) {
		// ✅ Ollama API Format: https://docs.ollama.com/api/chat
		payload = {
			model: config.model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			stream: false,
			options: {
				temperature,
				num_predict: maxTokens
			}
		};
		
		// Ollama response: { message: { content: "..." } }
		parseResponse = (data) => data.message?.content || '';
	} else {
		// ✅ OpenAI/OpenRouter API Format
		payload = {
			model: config.model,
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			],
			temperature,
			max_tokens: maxTokens,
			...(returnType === 'json' && {
				response_format: { type: 'json_object' }
			})
		};
		
		// ✅ Nur für externe APIs Authorization Header hinzufügen
		if (config.apiKey) {
			headers['Authorization'] = `Bearer ${config.apiKey}`;
		}

		// OpenRouter spezifische Headers
		if (config.endpoint.includes('openrouter.ai')) {
			headers['HTTP-Referer'] = window.location.origin;
			headers['X-Title'] = 'Kanban Editor AI Agent';
		}
		
		// OpenAI response: { choices: [{ message: { content: "..." } }] }
		parseResponse = (data) => data.choices?.[0]?.message?.content || '';
	}

	const response = await fetch(endpoint, {
		method: 'POST',
		headers,
		body: JSON.stringify(payload)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`LLM Request failed (${response.status}): ${errorText}`);
	}

	const data = await response.json();
	const content = parseResponse(data);

	if (!content) {
		throw new Error('LLM returned empty response');
	}

	if (returnType === 'json') {
		try {
			return JSON.parse(content) as T;
		} catch (err) {
			console.error('❌ JSON Parse Error:', content);
			throw new Error(`LLM returned invalid JSON: ${content.substring(0, 100)}`);
		}
	}

	return content;
}
