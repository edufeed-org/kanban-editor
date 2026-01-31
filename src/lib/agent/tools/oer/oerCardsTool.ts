/**
 * OER Cards Tool Implementation
 * 
 * Erstellt Karten aus OER-Suchergebnissen.
 * Nutzt den Ergebnis-Cache aus oerSearchTool.ts.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 */

import { getLastSearchResults } from './oerSearchTool.js';
import { getOerDetails, type OerSearchResult } from './oerClient.js';
import type { ToolResult, ExecutionContext } from '../toolExecutor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Argumente für add_cards_from_oer Tool
 */
export interface AddCardsFromOerArgs {
    /** IDs oder Nummern der OER-Materialien (z.B. ["1", "3", "5"]) */
    oer_ids: string[];
    /** Name der Zielspalte */
    column_name: string;
    /** Metadaten in Beschreibung einbinden (default: true) */
    include_metadata?: boolean;
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Führt das add_cards_from_oer Tool aus
 * Erstellt Karten aus OER-Suchergebnissen in einer Zielspalte.
 * 
 * @param args - Tool-Argumente
 * @param ctx - Execution Context mit Board-Referenz
 * @returns Tool-Ergebnis mit erstellten Karten
 */
export async function executeAddCardsFromOer(
    args: AddCardsFromOerArgs,
    ctx: ExecutionContext
): Promise<ToolResult> {
    console.log('📦 [add_cards_from_oer] Erstelle Karten:', args);
    
    // Validierung
    if (!args.oer_ids || args.oer_ids.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: 'Keine OER-IDs angegeben. Führe zuerst search_oer aus.'
        };
    }
    
    if (!args.column_name) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: 'Keine Zielspalte angegeben.'
        };
    }
    
    // Spalte finden oder erstellen
    let column = ctx.board.columns.find(
        c => c.name.toLowerCase().trim() === args.column_name.toLowerCase().trim()
    );
    
    if (!column && ctx.boardStore?.createColumn) {
        // Spalte erstellen wenn nicht vorhanden
        console.log(`📋 Erstelle Spalte "${args.column_name}"`);
        const colId = ctx.boardStore.createColumn(args.column_name);
        column = ctx.board.findColumn(colId);
    }
    
    if (!column) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: `Spalte "${args.column_name}" nicht gefunden und konnte nicht erstellt werden.`
        };
    }
    
    // Ergebnisse aus Cache holen
    const cachedResults = getLastSearchResults();
    
    if (cachedResults.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: 'Keine Suchergebnisse im Cache. Führe zuerst search_oer aus.'
        };
    }
    
    // IDs auflösen (können Nummern oder echte IDs sein)
    const selectedResults: OerSearchResult[] = [];
    const notFound: string[] = [];
    
    for (const idOrNumber of args.oer_ids) {
        // Prüfe ob es eine Nummer ist (1, 2, 3...)
        const num = parseInt(idOrNumber, 10);
        
        if (!isNaN(num) && num >= 1 && num <= cachedResults.length) {
            // Nummer: Index in Cache (1-basiert)
            selectedResults.push(cachedResults[num - 1]);
        } else {
            // Echte ID: In Cache suchen
            const result = cachedResults.find(r => r.id === idOrNumber);
            if (result) {
                selectedResults.push(result);
            } else {
                notFound.push(idOrNumber);
            }
        }
    }
    
    if (selectedResults.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: `Keine gültigen OER-Ergebnisse gefunden. Verfügbar: 1-${cachedResults.length}`
        };
    }
    
    // Karten erstellen
    const includeMetadata = args.include_metadata !== false;
    const createdCards: Array<{ heading: string; columnName: string }> = [];
    const errors: string[] = [];
    
    for (const oer of selectedResults) {
        try {
            // Content zusammenbauen
            const content = formatOerAsCardContent(oer, includeMetadata);
            
            // Karte erstellen via BoardStore API
            if (ctx.boardStore?.createCard) {
                ctx.boardStore.createCard(column.id, oer.title, content);
            } else {
                // Fallback: Direkte Board-Mutation
                column.addCard({
                    heading: oer.title,
                    content: content,
                    links: oer.url ? [{ id: crypto.randomUUID(), url: oer.url, title: 'Zur Ressource' }] : [],
                    labels: oer.keywords?.slice(0, 5) || [],
                    image: oer.image
                });
                ctx.triggerUpdate();
            }
            
            createdCards.push({ heading: oer.title, columnName: column.name });
            console.log(`✅ Karte erstellt: "${oer.title}"`);
            
        } catch (error) {
            console.error(`❌ Fehler bei Karte "${oer.title}":`, error);
            errors.push(oer.title);
        }
    }
    
    // Ergebnis zusammenfassen
    if (createdCards.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'add_cards_from_oer',
            success: false,
            error: `Keine Karten erstellt. Fehler: ${errors.join(', ')}`
        };
    }
    
    const message = formatCreatedCardsMessage(createdCards, notFound, errors);
    
    return {
        tool_call_id: '',
        tool_name: 'add_cards_from_oer',
        success: true,
        result: {
            message,
            cardsCreated: createdCards.length,
            cards: createdCards,
            notFound: notFound.length > 0 ? notFound : undefined,
            errors: errors.length > 0 ? errors : undefined
        }
    };
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formatiert OER-Ergebnis als Karten-Content
 */
function formatOerAsCardContent(
    oer: OerSearchResult,
    includeMetadata: boolean
): string {
    const lines: string[] = [];
    
    // Beschreibung
    if (oer.description) {
        lines.push(oer.description);
        lines.push('');
    }
    
    // Link
    if (oer.url) {
        lines.push(`🔗 **Link:** [Zur Ressource](${oer.url})`);
    }
    
    // Metadaten (optional)
    if (includeMetadata) {
        lines.push('');
        lines.push('---');
        lines.push('');
        
        if (oer.type) {
            lines.push(`📎 **Typ:** ${oer.type}`);
        }
        if (oer.creator || oer.publisher) {
            lines.push(`👤 **Autor:** ${oer.creator || oer.publisher}`);
        }
        if (oer.licenseShort || oer.license) {
            lines.push(`⚖️ **Lizenz:** ${oer.licenseShort || oer.license}`);
        }
        if (oer.source) {
            lines.push(`🏷️ **Quelle:** ${oer.source}`);
        }
        if (oer.educationalLevel) {
            lines.push(`🎓 **Bildungsstufe:** ${oer.educationalLevel}`);
        }
    }
    
    return lines.join('\n');
}

/**
 * Formatiert Nachricht über erstellte Karten
 */
function formatCreatedCardsMessage(
    createdCards: Array<{ heading: string; columnName: string }>,
    notFound: string[],
    errors: string[]
): string {
    const lines: string[] = [];
    
    lines.push(`✅ **${createdCards.length} Karte(n)** zur Spalte "${createdCards[0]?.columnName}" hinzugefügt:`);
    lines.push('');
    
    for (const card of createdCards) {
        lines.push(`• ${card.heading}`);
    }
    
    if (notFound.length > 0) {
        lines.push('');
        lines.push(`⚠️ Nicht gefunden: ${notFound.join(', ')}`);
    }
    
    if (errors.length > 0) {
        lines.push('');
        lines.push(`❌ Fehler bei: ${errors.join(', ')}`);
    }
    
    return lines.join('\n');
}
