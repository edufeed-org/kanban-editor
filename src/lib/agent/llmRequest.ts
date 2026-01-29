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
	
	console.log('🔧 LLM Config:', { 
		endpoint: config.endpoint, 
		model: config.model, 
		hasApiKey: !!config.apiKey 
	});

	// ✅ Ollama (local) braucht keinen API Key
	const isOllama = config.endpoint.includes('localhost') || config.endpoint.includes('127.0.0.1');
	
	if (!isOllama && !config.apiKey) {
		throw new Error('API Key nicht konfiguriert! Bitte in Einstellungen hinterlegen.');
	}

	// 🔧 URL-Konstruktion basierend auf Provider
	let endpoint = config.endpoint.replace(/\/$/, ''); // Trailing slash entfernen
	
	if (isOllama) {
		// Ollama: /api/chat
		if (!endpoint.includes('/api/')) {
			endpoint = endpoint + '/api/chat';
		}
	} else {
		// OpenAI-kompatible APIs: /v1/chat/completions
		if (!endpoint.includes('/chat/completions')) {
			// Prüfe ob es schon /v1 enthält
			if (endpoint.includes('/v1')) {
				if (!endpoint.endsWith('/chat/completions')) {
					endpoint = endpoint + '/chat/completions';
				}
			} else {
				endpoint = endpoint + '/v1/chat/completions';
			}
		}
	}
	
	console.log('🌐 Final LLM endpoint:', endpoint);

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
		
		// OpenAI response: { choices: [{ message: { content: "...", reasoning?: "...", reasoning_content?: "..." } }] }
		parseResponse = (data) => {
			const message = data.choices?.[0]?.message;
			
			// 1. Prüfe zuerst content (normaler Fall)
			if (message?.content && message.content.trim()) {
				return message.content;
			}
			
			// 2. Für Reasoning-Modelle: Versuche JSON aus reasoning zu extrahieren
			const reasoningText = message?.reasoning || message?.reasoning_content || '';
			if (reasoningText) {
				console.log('⚠️ Reasoning model detected, trying to extract JSON from reasoning...');
				
				// Versuche JSON-Objekt aus dem Reasoning-Text zu finden
				// Das JSON kommt oft am Ende nach dem Denkprozess
				const jsonMatch = reasoningText.match(/\{[\s\S]*"(?:audience|educationalLevel|learningResourceType|tags|teaches|suggestedDescription)"[\s\S]*\}/);
				if (jsonMatch) {
					console.log('✓ Found JSON in reasoning text');
					return jsonMatch[0];
				}
				
				// Fallback: Suche nach letztem JSON-Objekt im Text
				const allJsonMatches = reasoningText.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
				if (allJsonMatches && allJsonMatches.length > 0) {
					// Nimm das letzte (wahrscheinlich das finale Ergebnis)
					const lastJson = allJsonMatches[allJsonMatches.length - 1];
					console.log('✓ Using last JSON object from reasoning');
					return lastJson;
				}
				
				console.warn('⚠️ No JSON found in reasoning, returning raw reasoning (may fail)');
				return reasoningText;
			}
			
			return '';
		};
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

	// Hole zuerst den rohen Text, um bei Fehlern mehr Infos zu haben
	const responseText = await response.text();
	
	let data: any;
	try {
		data = JSON.parse(responseText);
	} catch (parseError) {
		console.error('❌ LLM response is not valid JSON:', responseText.substring(0, 500));
		throw new Error(`LLM returned invalid response (not JSON): ${responseText.substring(0, 200)}`);
	}
	
	const content = parseResponse(data);

	if (!content) {
		console.error('❌ LLM returned empty content. Full response:', data);
		throw new Error('LLM returned empty response');
	}

	console.log('🤖 LLM content received:', content.substring(0, 300));

	if (returnType === 'json') {
		try {
			// Versuch 1: Direktes JSON-Parsing
			return JSON.parse(content) as T;
		} catch (parseError) {
			console.warn('⚠️ Direct JSON parse failed, trying extraction...', {
				content: content.substring(0, 200),
				error: parseError instanceof Error ? parseError.message : 'Unknown'
			});

			// Versuch 2: JSON aus Markdown Code Block extrahieren (```json ... ```)
			const markdownMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
			if (markdownMatch) {
				try {
					const extracted = markdownMatch[1].trim();
					console.log('✓ Extracted JSON from markdown block:', extracted.substring(0, 100));
					return JSON.parse(extracted) as T;
				} catch (mdErr) {
					console.warn('⚠️ Markdown extraction failed:', mdErr);
				}
			}

			// Versuch 3: Erstes JSON-Objekt im Text finden
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				try {
					const extracted = jsonMatch[0];
					console.log('✓ Extracted JSON from text:', extracted.substring(0, 100));
					return JSON.parse(extracted) as T;
				} catch (textErr) {
					console.warn('⚠️ Text JSON extraction failed:', textErr);
				}
			}

			// Alle Fallbacks gescheitert
			console.error('❌ All JSON extraction attempts failed');
			throw new Error(
				`LLM returned invalid JSON. Content: ${content.substring(0, 200)}...`
			);
		}
	}

	return content;
}
