/**
 * URL Content Import Tool Implementation
 * 
 * Importiert Inhalt von URLs (Webseiten, PDFs, YouTube) und erstellt
 * automatisch Karten/Spalten im Board basierend auf der Struktur.
 * 
 * Strukturierungsmodi:
 * - auto: Intelligente Strukturierung basierend auf Überschriften
 * - single-column: Alle Abschnitte in eine Spalte
 * - multi-column: Hauptabschnitte werden zu Spalten
 * 
 * @see docs/FEATURE/URL-CONTENT-IMPORT.md
 */

import { fetchUrlContent, type UrlContentResult, type ContentSection } from './urlClient.js';
import type { ToolResult, ExecutionContext } from '../toolExecutor.js';

// ============================================================================
// Types
// ============================================================================

export interface ImportUrlContentArgs {
    /** URL der Quelle (Webseite, PDF, YouTube) */
    url: string;
    /** Strukturierungsmodus */
    structureMode?: 'auto' | 'single-column' | 'multi-column';
    /** Optional: Bestehende Zielspalte (Name) */
    targetColumn?: string;
    /** Optional: Name für neue Spalte (bei single-column) */
    columnName?: string;
    /** Max. Zeichen pro Karte (für lange Abschnitte) */
    maxCardLength?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Kürzt Text auf maximale Länge (mit Word-Boundary)
 */
function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return (lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

/**
 * Erstellt einen Slug aus einem Titel (für Spalten-Namen)
 */
function createSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9äöüß\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 30);
}

/**
 * Gruppiert Sections nach Top-Level Headings (für multi-column)
 */
function groupSectionsByTopLevel(sections: ContentSection[]): Map<string, ContentSection[]> {
    const groups = new Map<string, ContentSection[]>();
    let currentGroup: string = 'Einleitung';
    
    for (const section of sections) {
        if (section.level === 1 || section.level === 2) {
            currentGroup = section.heading || 'Abschnitt';
            if (!groups.has(currentGroup)) {
                groups.set(currentGroup, []);
            }
        }
        
        const group = groups.get(currentGroup) || [];
        group.push(section);
        groups.set(currentGroup, group);
    }
    
    return groups;
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Führt das import_url_content Tool aus
 */
export async function executeImportUrlContent(
    args: ImportUrlContentArgs,
    ctx: ExecutionContext
): Promise<ToolResult> {
    console.log('🔗 [import_url_content] URL:', args.url);
    
    // 1. URL-Inhalt abrufen
    const result = await fetchUrlContent(args.url);
    
    if (!result.success) {
        return {
            tool_call_id: '',
            tool_name: 'import_url_content',
            success: false,
            error: `❌ ${result.error}`
        };
    }
    
    // Keine Sections gefunden
    if (result.sections.length === 0) {
        return {
            tool_call_id: '',
            tool_name: 'import_url_content',
            success: false,
            error: '❌ Kein strukturierter Inhalt gefunden. Der URL-Inhalt konnte nicht verarbeitet werden.'
        };
    }
    
    // 2. Strukturierungsmodus bestimmen
    const mode = args.structureMode || determineAutoMode(result);
    const maxCardLength = args.maxCardLength || 2000;
    
    console.log(`📊 [import_url_content] Mode: ${mode}, Sections: ${result.sections.length}`);
    
    // 3. Board-Operationen ausführen
    const createdCards: string[] = [];
    const createdColumns: string[] = [];
    
    try {
        if (mode === 'multi-column') {
            // Gruppiere nach Top-Level Headings → Spalten
            const groups = groupSectionsByTopLevel(result.sections);
            
            for (const [groupName, sections] of groups) {
                // Spalte erstellen
                const columnId = ctx.boardStore?.createColumn(groupName);
                if (columnId) {
                    createdColumns.push(groupName);
                    
                    // Karten für jeden Unterabschnitt
                    for (const section of sections) {
                        if (section.content.trim()) {
                            const cardId = ctx.boardStore?.createCard(
                                columnId,
                                section.heading || 'Inhalt',
                                truncateText(section.content, maxCardLength)
                            );
                            if (cardId) createdCards.push(section.heading || 'Inhalt');
                        }
                    }
                }
            }
        } else {
            // single-column: Alle in eine Spalte
            const columnName = args.columnName || args.targetColumn || `Import: ${result.title.substring(0, 30)}`;
            
            // Bestehende Spalte finden oder neue erstellen
            let targetColumnId: string | undefined;
            
            if (args.targetColumn) {
                const existingColumn = ctx.board.columns.find(
                    c => c.name.toLowerCase() === args.targetColumn!.toLowerCase()
                );
                targetColumnId = existingColumn?.id;
            }
            
            if (!targetColumnId) {
                targetColumnId = ctx.boardStore?.createColumn(columnName);
                if (targetColumnId) createdColumns.push(columnName);
            }
            
            if (targetColumnId) {
                // Erste Karte: Übersicht mit Link zur Quelle
                const overviewCard = ctx.boardStore?.createCard(
                    targetColumnId,
                    `📄 ${result.title}`,
                    `**Quelle:** [${result.url}](${result.url})\n\n**Typ:** ${result.type}\n\n---\n\n*Importiert aus URL*`
                );
                if (overviewCard) createdCards.push(`📄 ${result.title}`);
                
                // Karten für jeden Abschnitt
                for (const section of result.sections) {
                    if (section.content.trim()) {
                        const cardId = ctx.boardStore?.createCard(
                            targetColumnId,
                            section.heading || 'Inhalt',
                            truncateText(section.content, maxCardLength)
                        );
                        if (cardId) createdCards.push(section.heading || 'Inhalt');
                    }
                }
            }
        }
        
        ctx.triggerUpdate();
        
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
        return {
            tool_call_id: '',
            tool_name: 'import_url_content',
            success: false,
            error: `❌ Fehler beim Erstellen der Karten: ${errorMsg}`
        };
    }
    
    // 4. Erfolgs-Nachricht formatieren
    const summary = formatImportSummary(result, createdColumns, createdCards, mode);
    
    return {
        tool_call_id: '',
        tool_name: 'import_url_content',
        success: true,
        result: {
            message: summary,
            url: result.url,
            title: result.title,
            type: result.type,
            columnsCreated: createdColumns.length,
            cardsCreated: createdCards.length,
            mode
        }
    };
}

/**
 * Bestimmt automatisch den besten Strukturierungsmodus
 */
function determineAutoMode(result: UrlContentResult): 'single-column' | 'multi-column' {
    const topLevelSections = result.sections.filter(s => s.level <= 2);
    
    // Multi-column wenn:
    // - Mindestens 2 Top-Level Überschriften
    // - PDF oder längerer Inhalt
    if (topLevelSections.length >= 3 || (result.type === 'pdf' && topLevelSections.length >= 2)) {
        return 'multi-column';
    }
    
    return 'single-column';
}

/**
 * Formatiert die Erfolgs-Nachricht für den Chat
 */
function formatImportSummary(
    result: UrlContentResult,
    columns: string[],
    cards: string[],
    mode: string
): string {
    const typeEmoji = {
        'webpage': '🌐',
        'pdf': '📄',
        'youtube': '🎬',
        'unknown': '❓'
    }[result.type] || '📄';
    
    let summary = `${typeEmoji} **Import erfolgreich!**\n\n`;
    summary += `**Titel:** ${result.title}\n`;
    summary += `**Quelle:** [${result.url}](${result.url})\n`;
    summary += `**Typ:** ${result.type}\n\n`;
    
    if (columns.length > 0) {
        summary += `**Erstellte Spalten (${columns.length}):**\n`;
        columns.forEach(col => summary += `- ${col}\n`);
        summary += '\n';
    }
    
    summary += `**Erstellte Karten:** ${cards.length}\n`;
    
    if (cards.length <= 5) {
        cards.forEach(card => summary += `- ${card}\n`);
    } else {
        cards.slice(0, 3).forEach(card => summary += `- ${card}\n`);
        summary += `- ... und ${cards.length - 3} weitere\n`;
    }
    
    summary += `\n*Modus: ${mode}*`;
    
    return summary;
}
