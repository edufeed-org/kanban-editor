/**
 * list_oer_sources Tool
 * 
 * Listet alle verfügbaren OER-Quellen auf.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 */

import { listOerSources, type OerSource } from './oerClient.js';
import type { ToolResult } from '../toolExecutor.js';

/**
 * Argumente für list_oer_sources Tool
 */
export interface ListOerSourcesArgs {
    // Keine Argumente erforderlich
}

/**
 * Führt list_oer_sources aus und gibt formatierte Quellen-Liste zurück
 */
export async function executeListOerSources(
    _args: ListOerSourcesArgs
): Promise<ToolResult> {
    try {
        const sources = await listOerSources();
        
        if (sources.length === 0) {
            return {
                tool_call_id: '',
                tool_name: 'list_oer_sources',
                success: true,
                result: {
                    message: '📚 Keine OER-Quellen verfügbar.\n\n' +
                        'Die OER Finder API ist möglicherweise nicht erreichbar oder ' +
                        'es sind keine Quellen konfiguriert.',
                    sources: []
                }
            };
        }
        
        const formattedSources = formatSourcesMessage(sources);
        
        return {
            tool_call_id: '',
            tool_name: 'list_oer_sources',
            success: true,
            result: {
                message: formattedSources,
                sources: sources,
                totalCount: sources.length
            }
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        
        return {
            tool_call_id: '',
            tool_name: 'list_oer_sources',
            success: false,
            error: `❌ Fehler beim Abrufen der OER-Quellen: ${errorMessage}\n\n` +
                'Mögliche Ursachen:\n' +
                '• OER Finder API nicht erreichbar\n' +
                '• Netzwerkfehler\n' +
                '• Ungültige API-URL in den Einstellungen'
        };
    }
}

/**
 * Formatiert die Quellen-Liste für die Chat-Ausgabe
 */
function formatSourcesMessage(sources: OerSource[]): string {
    const lines: string[] = [
        `📚 **${sources.length} OER-Quellen verfügbar:**`,
        ''
    ];
    
    for (const source of sources) {
        lines.push(`**${source.id}** - ${source.name}`);
        
        if (source.description) {
            lines.push(`   ${source.description}`);
        }
        
        if (source.url) {
            lines.push(`   🔗 ${source.url}`);
        }
        
        lines.push('');
    }
    
    lines.push('---');
    lines.push('💡 **Tipp:** Nutze `search_oer` mit dem `source`-Parameter, um gezielt in einer Quelle zu suchen.');
    lines.push('   Beispiel: "Suche nach Mathematik-Materialien auf WirLernenOnline"');
    
    return lines.join('\n');
}
