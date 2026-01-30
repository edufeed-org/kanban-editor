/**
 * URL Content Reader Client (Jina Reader API)
 * 
 * Extrahiert Inhalte von URLs (Webseiten, PDFs, YouTube, etc.)
 * Nutzt den kostenlosen Jina Reader Dienst (r.jina.ai)
 * 
 * Features:
 * - Webseiten → Markdown
 * - PDFs → strukturierter Text
 * - YouTube → Transkript
 * - Optional: API-Key für höhere Limits
 * 
 * @see https://jina.ai/reader
 */

import { settingsStore } from '$lib/stores/settingsStore.svelte.js';

// ============================================================================
// Configuration
// ============================================================================

const JINA_READER_URL = 'https://r.jina.ai';

/**
 * Ermittelt den Jina API-Key aus Settings (optional)
 */
export function getJinaApiKey(): string | null {
    const settings = settingsStore?.settings as any;
    return settings?.jinaApiKey || null;
}

// ============================================================================
// Types
// ============================================================================

export interface UrlContentResult {
    /** Erfolg der Extraktion */
    success: boolean;
    /** Extrahierter Inhalt als Markdown */
    content: string;
    /** Titel der Seite/des Dokuments */
    title: string;
    /** Ursprüngliche URL */
    url: string;
    /** Content-Typ (webpage, pdf, youtube, etc.) */
    type: 'webpage' | 'pdf' | 'youtube' | 'unknown';
    /** Extrahierte Abschnitte/Kapitel (für Strukturierung) */
    sections: ContentSection[];
    /** Fehlertext bei Misserfolg */
    error?: string;
    /** Vorschaubild (falls gefunden) */
    image?: string;
}

export interface ContentSection {
    /** Abschnitts-Überschrift */
    heading: string;
    /** Level der Überschrift (1-6) */
    level: number;
    /** Inhalt des Abschnitts */
    content: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Erkennt den Content-Typ anhand der URL
 */
function detectContentType(url: string): 'webpage' | 'pdf' | 'youtube' | 'unknown' {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com/watch') || lowerUrl.includes('youtu.be/')) {
        return 'youtube';
    }
    
    if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) {
        return 'pdf';
    }
    
    if (lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://')) {
        return 'webpage';
    }
    
    return 'unknown';
}

/**
 * Extrahiert Abschnitte aus Markdown-Content
 * Erkennt Überschriften (# H1, ## H2, etc.) und strukturiert den Inhalt
 */
function extractSections(markdown: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const lines = markdown.split('\n');
    
    let currentSection: ContentSection | null = null;
    let contentBuffer: string[] = [];
    
    for (const line of lines) {
        // Prüfe auf Markdown-Überschrift
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        
        if (headingMatch) {
            // Speichere vorherigen Abschnitt
            if (currentSection) {
                currentSection.content = contentBuffer.join('\n').trim();
                if (currentSection.content || currentSection.heading) {
                    sections.push(currentSection);
                }
            }
            
            // Neuer Abschnitt
            currentSection = {
                heading: headingMatch[2].trim(),
                level: headingMatch[1].length,
                content: ''
            };
            contentBuffer = [];
        } else {
            contentBuffer.push(line);
        }
    }
    
    // Letzten Abschnitt speichern
    if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        if (currentSection.content || currentSection.heading) {
            sections.push(currentSection);
        }
    } else if (contentBuffer.length > 0) {
        // Kein Heading gefunden - alles als einen Abschnitt
        sections.push({
            heading: 'Inhalt',
            level: 1,
            content: contentBuffer.join('\n').trim()
        });
    }
    
    return sections;
}

/**
 * Extrahiert Titel aus Markdown (erste H1 oder erste Zeile)
 */
function extractTitle(markdown: string): string {
    // Suche nach erstem H1
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match) return h1Match[1].trim();
    
    // Fallback: erste nicht-leere Zeile
    const firstLine = markdown.split('\n').find(line => line.trim().length > 0);
    if (firstLine) return firstLine.trim().substring(0, 100);
    
    return 'Unbekannter Titel';
}

/**
 * Extrahiert Bild-URL aus Markdown (erstes Bild)
 */
function extractImage(markdown: string): string | undefined {
    const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
    return imgMatch?.[1];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Liest Inhalt von einer URL mit Jina Reader
 * 
 * @param url - Die zu lesende URL
 * @returns Strukturierter Inhalt mit Abschnitten
 */
export async function fetchUrlContent(url: string): Promise<UrlContentResult> {
    const contentType = detectContentType(url);
    
    if (contentType === 'unknown') {
        return {
            success: false,
            content: '',
            title: '',
            url,
            type: 'unknown',
            sections: [],
            error: 'Unbekannter URL-Typ. Unterstützt werden: Webseiten, PDFs, YouTube-Videos.'
        };
    }
    
    try {
        // Jina Reader API aufrufen
        const jinaUrl = `${JINA_READER_URL}/${url}`;
        const apiKey = getJinaApiKey();
        
        const headers: Record<string, string> = {
            'Accept': 'text/markdown'
        };
        
        // Optional: API-Key für höhere Limits
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        console.log('🔗 [urlClient] Fetching:', url);
        
        const response = await fetch(jinaUrl, { headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
        }
        
        const markdown = await response.text();
        
        if (!markdown || markdown.trim().length === 0) {
            return {
                success: false,
                content: '',
                title: '',
                url,
                type: contentType,
                sections: [],
                error: 'Kein Inhalt konnte extrahiert werden.'
            };
        }
        
        // Strukturiere den Inhalt
        const sections = extractSections(markdown);
        const title = extractTitle(markdown);
        const image = extractImage(markdown);
        
        console.log(`✅ [urlClient] Extracted: "${title}" (${sections.length} sections)`);
        
        return {
            success: true,
            content: markdown,
            title,
            url,
            type: contentType,
            sections,
            image
        };
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        console.error('❌ [urlClient] Error:', errorMessage);
        
        return {
            success: false,
            content: '',
            title: '',
            url,
            type: contentType,
            sections: [],
            error: `Fehler beim Abrufen der URL: ${errorMessage}`
        };
    }
}

/**
 * Prüft ob eine URL erreichbar ist und von Jina unterstützt wird
 */
export async function validateUrl(url: string): Promise<{ valid: boolean; type: string; error?: string }> {
    const type = detectContentType(url);
    
    if (type === 'unknown') {
        return {
            valid: false,
            type: 'unknown',
            error: 'URL-Format wird nicht unterstützt'
        };
    }
    
    // Grundlegende URL-Validierung
    try {
        new URL(url);
    } catch {
        return {
            valid: false,
            type,
            error: 'Ungültige URL'
        };
    }
    
    return { valid: true, type };
}
