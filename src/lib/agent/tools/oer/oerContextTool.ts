/**
 * search_oer_for_card Tool
 * 
 * Sucht kontextbasiert nach OER-Materialien basierend auf einer bestehenden Karte.
 * Extrahiert automatisch Suchbegriffe aus Titel, Beschreibung und Labels.
 * 
 * @see docs/FEATURE/MCP-EDUFEED.md
 */

import { searchOer, type OerSearchParams, type OerSearchResult } from './oerClient.js';
import { setLastSearchResults } from './oerSearchTool.js';
import type { ToolResult, ExecutionContext } from '../toolExecutor.js';

/**
 * Argumente für search_oer_for_card Tool
 */
export interface SearchOerForCardArgs {
    /** ID der Karte, für die OER gesucht werden soll */
    cardId: string;
    /** Optionale zusätzliche Suchbegriffe */
    additionalTerms?: string;
    /** Maximale Anzahl der Ergebnisse (default: 5) */
    maxResults?: number;
    /** Optional: Spezifische OER-Quelle */
    source?: string;
}

/**
 * Führt search_oer_for_card aus
 * Extrahiert Kontext aus der Karte und sucht passende OER-Materialien
 */
export async function executeSearchOerForCard(
    args: SearchOerForCardArgs,
    context: ExecutionContext
): Promise<ToolResult> {
    const { cardId, additionalTerms, maxResults = 5, source } = args;
    
    // Karte aus dem Board finden
    const result = context.board.findCardAndColumn(cardId);
    
    if (!result) {
        return {
            tool_call_id: '',
            tool_name: 'search_oer_for_card',
            success: false,
            error: `❌ Karte mit ID "${cardId}" nicht gefunden.\n\n` +
                'Bitte stelle sicher, dass die Karten-ID korrekt ist.'
        };
    }
    
    const { card, column } = result;
    
    // Suchbegriffe aus der Karte extrahieren
    const searchTerms = extractSearchTerms(card, column.name, additionalTerms);
    
    if (!searchTerms) {
        return {
            tool_call_id: '',
            tool_name: 'search_oer_for_card',
            success: false,
            error: `❌ Keine Suchbegriffe aus der Karte "${card.heading}" extrahierbar.\n\n` +
                'Die Karte hat keinen aussagekräftigen Titel, keine Beschreibung und keine Labels.\n' +
                '💡 Tipp: Füge Labels oder eine Beschreibung zur Karte hinzu.'
        };
    }
    
    try {
        // OER-Suche durchführen
        const searchParams: OerSearchParams = {
            searchTerm: searchTerms,
            pageSize: maxResults
        };
        
        if (source) {
            searchParams.source = source;
        }
        
        const searchResponse = await searchOer(searchParams);

        // Fehler von der API prüfen
        if (searchResponse.error) {
            return {
                tool_call_id: '',
                tool_name: 'search_oer_for_card',
                success: false,
                error: `❌ Fehler bei der OER-Suche: ${searchResponse.error}`
            };
        }
        
        const searchResults = searchResponse.results;
        
        if (searchResults.length === 0) {
            return {
                tool_call_id: '',
                tool_name: 'search_oer_for_card',
                success: true,
                result: {
                    message: formatNoResultsMessage(card.heading, searchTerms),
                    results: [],
                    searchTerms,
                    cardId
                }
            };
        }
        
        // Ergebnisse cachen für add_cards_from_oer
        setLastSearchResults(searchResults);
        
        return {
            tool_call_id: '',
            tool_name: 'search_oer_for_card',
            success: true,
            result: {
                message: formatResultsMessage(card.heading, searchTerms, searchResults),
                results: searchResults,
                searchTerms,
                cardId,
                totalCount: searchResults.length,
                hint: '💡 Nutze `add_cards_from_oer` mit den Nummern der gewünschten Ergebnisse, ' +
                      'um sie als Karten hinzuzufügen.'
            }
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        
        return {
            tool_call_id: '',
            tool_name: 'search_oer_for_card',
            success: false,
            error: `❌ Fehler bei der OER-Suche: ${errorMessage}`
        };
    }
}

/**
 * Extrahiert relevante Suchbegriffe aus einer Karte
 */
function extractSearchTerms(
    card: { heading: string; content?: string; labels?: string[] },
    columnName: string,
    additionalTerms?: string
): string | null {
    const terms: string[] = [];
    
    // 1. Titel (bereinigt)
    const cleanedHeading = cleanText(card.heading);
    if (cleanedHeading && cleanedHeading.length > 2) {
        terms.push(cleanedHeading);
    }
    
    // 2. Labels (falls vorhanden)
    if (card.labels && card.labels.length > 0) {
        // Max 3 Labels verwenden
        const relevantLabels = card.labels
            .slice(0, 3)
            .map(label => cleanText(label))
            .filter(label => label && label.length > 2);
        terms.push(...relevantLabels);
    }
    
    // 3. Spaltenname (kann Kontext geben wie "Mathe", "Deutsch", etc.)
    const cleanedColumn = cleanText(columnName);
    if (cleanedColumn && cleanedColumn.length > 2 && !isGenericColumnName(cleanedColumn)) {
        terms.push(cleanedColumn);
    }
    
    // 4. Zusätzliche Begriffe vom Benutzer
    if (additionalTerms) {
        terms.push(additionalTerms);
    }
    
    // 5. Keywords aus Content extrahieren (falls vorhanden)
    if (card.content) {
        const contentKeywords = extractKeywordsFromContent(card.content);
        terms.push(...contentKeywords.slice(0, 2)); // Max 2 Keywords aus Content
    }
    
    if (terms.length === 0) {
        return null;
    }
    
    // Deduplizieren und zusammenfügen
    const uniqueTerms = [...new Set(terms.filter(Boolean))];
    return uniqueTerms.join(' ');
}

/**
 * Bereinigt Text von Sonderzeichen
 */
function cleanText(text: string): string {
    return text
        .replace(/[^\w\säöüÄÖÜß-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Prüft ob ein Spaltenname generisch ist (und daher nicht hilfreich für die Suche)
 */
function isGenericColumnName(name: string): boolean {
    const genericNames = [
        'todo', 'to do', 'to-do',
        'in progress', 'in-progress', 'in arbeit',
        'done', 'erledigt', 'fertig',
        'backlog', 'offen', 'neu',
        'ideen', 'ideas', 'planung'
    ];
    return genericNames.includes(name.toLowerCase());
}

/**
 * Extrahiert Keywords aus Content (einfache Heuristik)
 */
function extractKeywordsFromContent(content: string): string[] {
    // Entferne Markdown-Syntax
    const cleanedContent = content
        .replace(/#+\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/`[^`]*`/g, '');
    
    // Finde Wörter mit mehr als 4 Zeichen (wahrscheinlich bedeutungsvoll)
    const words = cleanedContent
        .split(/\s+/)
        .map(word => cleanText(word))
        .filter(word => word.length > 4);
    
    // Häufigste Wörter (einfache Heuristik)
    const wordFrequency = new Map<string, number>();
    for (const word of words) {
        if (!isStopWord(word)) {
            wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        }
    }
    
    // Top Keywords nach Häufigkeit
    return [...wordFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);
}

/**
 * Prüft ob ein Wort ein Stop-Word ist (wird ignoriert)
 */
function isStopWord(word: string): boolean {
    const stopWords = [
        'und', 'oder', 'der', 'die', 'das', 'ein', 'eine', 'einer',
        'für', 'mit', 'auf', 'von', 'bei', 'nach', 'aus', 'über',
        'wird', 'werden', 'wurde', 'worden', 'sein', 'sind', 'ist',
        'haben', 'hat', 'hatte', 'können', 'kann', 'könnte',
        'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are'
    ];
    return stopWords.includes(word.toLowerCase());
}

/**
 * Formatiert die Ergebnis-Nachricht
 */
function formatResultsMessage(
    cardTitle: string,
    searchTerms: string,
    results: OerSearchResult[]
): string {
    const lines: string[] = [
        `🔍 **OER-Materialien für "${cardTitle}"**`,
        '',
        `Suchbegriffe: _${searchTerms}_`,
        '',
        `📚 **${results.length} passende Materialien gefunden:**`,
        ''
    ];
    
    results.forEach((result, index) => {
        const num = index + 1;
        lines.push(`**${num}.** ${result.title}`);
        
        if (result.description) {
            const shortDesc = result.description.length > 120
                ? result.description.substring(0, 120) + '...'
                : result.description;
            lines.push(`   ${shortDesc}`);
        }
        
        const metadata: string[] = [];
        if (result.source) metadata.push(`📦 ${result.source}`);
        if (result.license) metadata.push(`📜 ${result.license}`);
        if (result.type) metadata.push(`📄 ${result.type}`);
        
        if (metadata.length > 0) {
            lines.push(`   ${metadata.join(' | ')}`);
        }
        
        lines.push('');
    });
    
    return lines.join('\n');
}

/**
 * Formatiert die "Keine Ergebnisse" Nachricht
 */
function formatNoResultsMessage(cardTitle: string, searchTerms: string): string {
    return [
        `🔍 **OER-Suche für "${cardTitle}"**`,
        '',
        `Suchbegriffe: _${searchTerms}_`,
        '',
        '📭 Keine passenden OER-Materialien gefunden.',
        '',
        '💡 **Tipps:**',
        '• Füge spezifischere Labels zur Karte hinzu',
        '• Nutze `search_oer` mit eigenen Suchbegriffen',
        '• Prüfe verfügbare Quellen mit `list_oer_sources`'
    ].join('\n');
}
