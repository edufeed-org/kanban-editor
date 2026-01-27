/**
 * Text Paste Handler
 * 
 * Verarbeitet Text aus der Zwischenablage:
 * - HTML → Markdown konvertieren
 * - Plain Text → Direkt übernehmen
 * - Markdown → Direkt übernehmen
 */

import type { IPasteHandler, PasteContext, PasteResult, ClipboardData } from '../types.js';

export class TextPasteHandler implements IPasteHandler {
    readonly name = 'Text Handler';
    readonly priority = 0; // Niedrigste Priorität (Fallback)
    
    async canHandle(data: ClipboardData): Promise<boolean> {
        // Text ist der Fallback, aber HTML-only Inhalte sollten auch erkannt werden
        const result = (data.text.trim().length > 0) || (data.html.trim().length > 0);
        console.log('TextPasteHandler.canHandle:', { textLen: data.text.length, htmlLen: data.html.length, result });
        return result;
    }
    
    async handle(data: ClipboardData, context: PasteContext): Promise<PasteResult> {
        try {
            let content: string;
            let isHtml = false;
            
            // Versuche HTML zu extrahieren (für bessere Formatierung)
            if (data.html.trim().length > 0) {
                isHtml = true;
                // Konvertiere HTML zu Markdown
                content = this.htmlToMarkdown(data.html);
            } else {
                // Fallback zu Plain Text
                content = data.text;
            }
            
            if (!content || content.trim().length === 0) {
                return { success: false, type: 'text', error: 'Kein Text gefunden' };
            }
            
            const cardUpdates = this.createCardUpdates(content, context);
            
            return {
                success: true,
                type: 'text',
                cardUpdates,
                debug: isHtml ? 'HTML → Markdown konvertiert' : 'Plain Text übernommen'
            };
        } catch (error) {
            return {
                success: false,
                type: 'text',
                error: `Text-Verarbeitung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    private htmlToMarkdown(html: string): string {
        // Einfache HTML → Markdown Konvertierung
        // Für komplexere Fälle könnte man eine Library wie turndown.js verwenden
        
        let markdown = html;
        
        // Entferne HTML-Kommentare
        markdown = markdown.replace(/<!--[\s\S]*?-->/g, '');
        
        // <strong> / <b> → **bold**
        markdown = markdown.replace(/<(?:strong|b)>(.*?)<\/(?:strong|b)>/gi, '**$1**');
        
        // <em> / <i> → *italic*
        markdown = markdown.replace(/<(?:em|i)>(.*?)<\/(?:em|i)>/gi, '*$1*');
        
        // <a href="...">text</a> → [text](url)
        markdown = markdown.replace(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        
        // <h1-6> → # Heading
        for (let i = 1; i <= 6; i++) {
            const regex = new RegExp(`<h${i}[^>]*>(.*?)<\/h${i}>`, 'gi');
            markdown = markdown.replace(regex, '\n' + '#'.repeat(i) + ' $1\n');
        }
        
        // <p> → Absatz
        markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n');
        
        // <br> → Zeilenumbruch
        markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
        
        // <ul> / <li> → Listen
        markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
        markdown = markdown.replace(/<\/?ul[^>]*>/gi, '\n');
        
        // <code> → `code`
        markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
        
        // <pre> → ```code block```
        markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n');
        
        // Entferne übrige HTML-Tags
        markdown = markdown.replace(/<[^>]+>/g, '');
        
        // Decode HTML-Entities
        markdown = this.decodeHtmlEntities(markdown);
        
        // Bereinige übermäßige Leerzeilen
        markdown = markdown.replace(/\n{3,}/g, '\n\n');
        
        return markdown.trim();
    }
    
    private decodeHtmlEntities(text: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&nbsp;': ' '
        };
        
        return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, match => entities[match] || match);
    }
    
    private createCardUpdates(content: string, context: PasteContext) {
        if (context.target === 'card') {
            // Update existierende Card: Append Text
            return {
                content: `\n\n${content}`
            };
        } else {
            // Neue Card erstellen
            // Versuche erste Zeile als Heading zu extrahieren
            const lines = content.split('\n');
            const firstLine = lines[0].trim();
            const restContent = lines.slice(1).join('\n').trim();
            
            // Wenn erste Zeile kurz ist (< 60 Zeichen), nutze sie als Heading
            if (firstLine.length > 0 && firstLine.length < 60 && !firstLine.startsWith('#')) {
                return {
                    heading: firstLine,
                    content: restContent || content,
                    labels: ['text']
                };
            } else {
                // Nutze erste 50 Zeichen als Heading
                const heading = content.substring(0, 50).trim() + (content.length > 50 ? '...' : '');
                return {
                    heading,
                    content,
                    labels: ['text']
                };
            }
        }
    }
}
