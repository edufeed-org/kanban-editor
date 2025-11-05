/**
 * AI Action Generator - Konvertiert LLM-Responses in strukturierte Board-Aktionen
 * 
 * 2-Phase System:
 * Phase 1: Content-Vorschlag (Markdown) → User Bestätigung
 * Phase 2: Struktur-Generation (JSON) → Board-Aktionen
 */

import type { AIAction } from '$lib/classes/BoardModel.js';

export interface ContentProposal {
  type: 'content';
  title: string;
  content: string;
  structure?: string; // Mögliche Struktur-Beschreibung
  canGenerate: boolean; // Ob KI danach Aktionen generieren kann
}

export interface StructureProposal {
  type: 'structure';
  columns: ColumnStructure[];
}

export interface ColumnStructure {
  name: string;
  description?: string;
  cards: CardStructure[];
}

export interface CardStructure {
  heading: string;
  content?: string;
  labels?: string[];
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Phase 1: Parse Content-Vorschlag aus LLM-Response
 * Extrahiert die inhaltliche Antwort ohne sie in Aktionen zu konvertieren
 */
export async function parseContentProposal(llmResponse: string): Promise<ContentProposal> {
  // Entferne Code-Blöcke
  let cleanContent = llmResponse.replace(/```[\s\S]*?```/g, '');
  
  // Extrahiere Titel (erstes ## oder ###)
  const titleMatch = cleanContent.match(/^#{1,3}\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Vorschlag';
  
  // Entferne Titel aus Content
  const contentLines = cleanContent
    .split('\n')
    .filter((line, idx) => !(idx === 0 && line.startsWith('#')));
  const content = contentLines.join('\n').trim();
  
  // Erkenne Struktur-Patterns
  let structure = '';
  const hasSpalten = /spalte|column/i.test(content);
  const hasKarten = /karte|task|card/i.test(content);
  const hasPhasen = /phase|schritt|step|stunde|hour/i.test(content);
  
  if (hasSpalten && hasKarten) {
    structure = 'spalten-mit-karten';
  } else if (hasPhasen) {
    structure = 'phasen';
  } else if (hasKarten) {
    structure = 'nur-karten';
  }
  
  return {
    type: 'content',
    title,
    content,
    structure: structure || undefined,
    canGenerate: structure !== ''
  };
}

/**
 * Phase 2: Generate strukturierte Aktionen aus genehmigtem Vorschlag
 * Gibt NUR den User-Prompt zurück (System-Prompt wird separat übergeben)
 * 
 * KRITISCH: Diese Funktion gibt nur den User-Prompt zurück, nicht das System-Prompt!
 * Das System-Prompt wird direkt in generateBoardStructure() gesetzt via sendToLLMWithSystem()
 */
export function generateStructureFromContent(
  originalContent: string,
  userContext?: { boardName?: string; existingColumns?: string[] }
): string {
  // NUR User-Prompt zurückgeben!
  // System-Prompt wird separat via sendToLLMWithSystem() in AIPanel.svelte gesetzt
  const userPrompt = `Analysiere diesen Lerninhalt und generiere AUSSCHLIESSLICH eine Kanban-Board-Struktur als valides JSON.

Deine Antwort MUSS nur JSON sein - kein Text davor, kein Text danach, keine Markdown-Code-Blöcke!

JSON Format MUSS exakt dieses Schema erfüllen:
{
  "columns": [
    {
      "name": "Spaltenname",
      "description": "Kurze Beschreibung",
      "cards": [
        {
          "heading": "Kartentitel",
          "content": "Optionale detaillierte Beschreibung",
          "labels": ["tag1", "tag2"],
          "priority": "high"
        }
      ]
    }
  ]
}

Lerninhalt zum Strukturieren:
${originalContent}

${userContext?.boardName ? `\nBoard Name: ${userContext.boardName}` : ''}
${userContext?.existingColumns ? `\nExistierenden Spalten beachten: ${userContext.existingColumns.join(', ')}` : ''}

WICHTIG: Antworte NUR mit valide JSON! Keine Erklärungen, keine Markdown!`;

  return userPrompt;
}

/**
 * Parse strukturierte JSON-Antwort zu StructureProposal
 */
export function parseStructureProposal(jsonResponse: string): StructureProposal | null {
  try {
    // Versuche JSON zu extrahieren (falls noch Markdown drumherum ist)
    let json = jsonResponse;
    
    // Wenn JSON in ``` eingewickelt ist
    const codeBlockMatch = jsonResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      json = codeBlockMatch[1];
    }
    
    const parsed = JSON.parse(json);
    
    // Validiere Struktur
    if (!parsed.columns || !Array.isArray(parsed.columns)) {
      console.error('Invalid structure: missing columns array', parsed);
      return null;
    }
    
    // Validiere Spalten
    for (const col of parsed.columns) {
      if (!col.name || !Array.isArray(col.cards)) {
        console.error('Invalid column structure:', col);
        return null;
      }
      
      // Validiere Karten
      for (const card of col.cards) {
        if (!card.heading) {
          console.error('Invalid card: missing heading', card);
          return null;
        }
      }
    }
    
    return {
      type: 'structure',
      columns: parsed.columns
    };
  } catch (e) {
    console.error('Failed to parse structure proposal:', e, jsonResponse);
    return null;
  }
}

/**
 * Konvertiere StructureProposal zu board-Aktionen
 */
export function structureToActions(structure: StructureProposal): AIAction[] {
  const actions: AIAction[] = [];
  const columnMap = new Map<string, string>(); // name → id mapping (wird später gefüllt)
  
  // Phase 1: Spalten erstellen
  for (const col of structure.columns) {
    actions.push({
      type: 'add_column',
      columnName: col.name
    });
    // Nach Erstellung wird die columnId automatisch bekannt
  }
  
  // Phase 2: Karten in Spalten hinzufügen
  // WICHTIG: Diese werden mit columnName ausgeführt, nicht columnId
  // Der ExecutionEngine wird später die columnId zuordnen
  for (const col of structure.columns) {
    for (const card of col.cards) {
      actions.push({
        type: 'add_card',
        heading: card.heading,
        content: card.content || '',
        columnName: col.name, // ← Referenz via Name, nicht ID!
        labels: card.labels || [],
        priority: card.priority || 'medium'
      } as any);
    }
  }
  
  return actions;
}

/**
 * Validiere, dass JSON-Response vom LLM korrekt ist
 * (wird vom ChatStore in einer Retry-Schleife verwendet)
 */
export function validateStructureJSON(jsonString: string): { valid: boolean; error?: string } {
  try {
    // Step 1: Trim whitespace
    let json = jsonString.trim();

    // Step 2: Check if empty
    if (!json || json.length === 0) {
      return { valid: false, error: 'Empty response from LLM' };
    }

    // Step 3: Try to extract from markdown code blocks (falls LLM sie doch liefert)
    const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      json = codeBlockMatch[1].trim();
    }

    // Step 4: Try to find JSON object if wrapped in text (Last resort)
    if (!json.startsWith('{')) {
      const objectMatch = json.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        return { valid: false, error: `Response does not contain JSON object. Starts with: "${json.substring(0, 50)}"` };
      }
      json = objectMatch[0];
    }

    // Step 5: Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(json);
    } catch (parseErr) {
      const msg = parseErr instanceof SyntaxError ? parseErr.message : 'JSON parse error';
      return { valid: false, error: `Invalid JSON: ${msg}` };
    }

    // Step 6: Validate structure
    if (!parsed.columns || !Array.isArray(parsed.columns)) {
      return { valid: false, error: 'Missing or invalid "columns" array' };
    }

    if (parsed.columns.length === 0) {
      return { valid: false, error: 'Columns array is empty' };
    }

    // Step 7: Validate each column and card
    for (let i = 0; i < parsed.columns.length; i++) {
      const col = parsed.columns[i];
      
      if (!col.name || typeof col.name !== 'string') {
        return { valid: false, error: `Column ${i} missing or invalid "name"` };
      }
      
      if (!Array.isArray(col.cards)) {
        return { valid: false, error: `Column "${col.name}" missing or invalid "cards" array` };
      }
      
      if (col.cards.length === 0) {
        return { valid: false, error: `Column "${col.name}" has no cards` };
      }
      
      for (let j = 0; j < col.cards.length; j++) {
        const card = col.cards[j];
        
        if (!card.heading || typeof card.heading !== 'string') {
          return { valid: false, error: `Column "${col.name}" Card ${j} missing or invalid "heading"` };
        }
        
        if (card.heading.length < 3) {
          return { valid: false, error: `Column "${col.name}" Card ${j} heading too short (min 3 chars)` };
        }
      }
    }

    // All validations passed!
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Unexpected error: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }
}

/**
 * Format Fehler für Nutzer
 */
export function formatValidationError(error: string): string {
  return `❌ Struktur-Validierung fehlgeschlagen:\n${error}\n\nBitte versuchen Sie erneut.`;
}
