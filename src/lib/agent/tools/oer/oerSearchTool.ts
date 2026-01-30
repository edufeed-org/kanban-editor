/**
 * OER Search Tool Implementation
 * 
 * Führt search_oer Tool-Aufrufe aus und cached Ergebnisse
 * für nachfolgende add_cards_from_oer Aufrufe.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 */

import { searchOer, type OerSearchParams, type OerSearchResult } from './oerClient.js';
import type { ToolResult, ExecutionContext } from '../toolExecutor.js';

// ============================================================================
// Result Cache
// ============================================================================

/**
 * Cache für letzte Suchergebnisse
 * Wird von add_cards_from_oer verwendet, um per Index auf Ergebnisse zuzugreifen
 */
let lastSearchResults: OerSearchResult[] = [];

/**
 * Gibt die letzten Suchergebnisse zurück
 */
export function getLastSearchResults(): OerSearchResult[] {
    return lastSearchResults;
}

/**
 * Setzt die Suchergebnisse (für search_oer_for_card)
 */
export function setLastSearchResults(results: OerSearchResult[]): void {
    lastSearchResults = results;
}

/**
 * Löscht den Ergebnis-Cache
 */
export function clearSearchCache(): void {
    lastSearchResults = [];
}

// ============================================================================
// Types (exported for use in other tools)
// ============================================================================

/**
 * Argumente für search_oer Tool
 */
export interface SearchOerArgs {
    query: string;
    type?: string;
    source?: string;
    license?: string;
    educational_level?: string;
    limit?: number;
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Führt das search_oer Tool aus
 * 
 * @param args - Tool-Argumente
 * @param ctx - Execution Context (optional, für Board-Kontext)
 * @returns Tool-Ergebnis mit formatierten Suchergebnissen
 */
export async function executeSearchOer(
    args: SearchOerArgs,
    ctx?: ExecutionContext
): Promise<ToolResult> {
    console.log('🔍 [search_oer] Suche:', args.query);
    
    // Parameter aufbereiten
    // WICHTIG: Die OER Finder API benötigt eine source, sonst 0 Ergebnisse!
    const params: OerSearchParams = {
        searchTerm: args.query,
        source: args.source || 'rpi-virtuell',  // Default: rpi-virtuell
        pageSize: Math.min(args.limit || 10, 20)  // Max 20 Ergebnisse
    };

    // API-Aufruf
    const response = await searchOer(params);

    // Fehlerbehandlung
    if (response.error) {
        return {
            tool_call_id: '',
            tool_name: 'search_oer',
            success: false,
            error: `❌ OER-Suche fehlgeschlagen: ${response.error}`
        };
    }

    // Keine Ergebnisse
    if (response.results.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'search_oer',
            success: true,
            result: {
                message: `Keine OER-Materialien gefunden für "${args.query}". Versuche andere Suchbegriffe.`,
                results: [],
                totalCount: 0
            }
        };
    }

    // Ergebnisse im Cache speichern (für add_cards_from_oer)
    lastSearchResults = response.results;

    // Formatierte Ausgabe für den Chat
    const formattedResults = response.results.map((r, index) => ({
        number: index + 1,
        title: r.title,
        description: r.description?.substring(0, 150) + (r.description && r.description.length > 150 ? '...' : ''),
        type: r.type,
        source: r.source,
        license: r.licenseShort || r.license,
        url: r.url,
        image: r.image
    }));

    // Menschenlesbare Zusammenfassung
    const summary = formatSearchResultsForChat(formattedResults, args.query, response.totalCount);

    return {
        tool_call_id: '',
        tool_name: 'search_oer',
        success: true,
        result: {
            message: summary,
            results: formattedResults,
            totalCount: response.totalCount,
            query: args.query,
            hint: 'Nutze add_cards_from_oer um Ergebnisse als Karten hinzuzufügen, z.B. "Füge Material 1 und 3 zur Spalte Material hinzu"'
        }
    };
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formatiert Suchergebnisse für die Chat-Ausgabe
 */
function formatSearchResultsForChat(
    results: Array<{
        number: number;
        title: string;
        description: string;
        type: string;
        source: string;
        license?: string;
        url: string;
        image?: string;
    }>,
    query: string,
    totalCount: number
): string {
    const lines: string[] = [];
    
    lines.push(`📚 **${results.length} OER-Materialien** gefunden für "${query}":`);
    lines.push('');
    
    for (const r of results) {
        lines.push(`**${r.number}. ${r.title}**`);
        if (r.description) {
            lines.push(`   ${r.description}`);
        }
        lines.push(`   📎 ${r.type} | 🏷️ ${r.source}${r.license ? ` | ⚖️ ${r.license}` : ''}`);
        lines.push('');
    }
    
    if (totalCount > results.length) {
        lines.push(`_(${totalCount - results.length} weitere Ergebnisse verfügbar)_`);
        lines.push('');
    }
    
    lines.push('💡 **Tipp:** Sage z.B. "Füge Material 1 und 3 zur Spalte Material hinzu"');
    
    return lines.join('\n');
}
