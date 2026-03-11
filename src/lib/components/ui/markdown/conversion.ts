import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
	typographer: true,
	breaks: true
});

const turndown = new TurndownService({
	headingStyle: 'atx',
	bulletListMarker: '-',
	codeBlockStyle: 'fenced',
	emDelimiter: '*',
	strongDelimiter: '**'
});

export function hasMarkdownSyntax(content: string): boolean {
	if (!content) return false;

	const markdownPatterns = /^#{1,6}\s|\*\*|__|\*[^*]+\*|_[^_]+_|^\s*[-*+]\s|^\s*\d+\.\s|```|\[.+\]\(.+\)|^>\s/m;
	return markdownPatterns.test(content);
}

export function isFullyHtml(text: string): boolean {
	if (!text) return false;

	const trimmed = text.trim();
	const startsWithHtml = trimmed.startsWith('<') && /<\/?[a-z][\s\S]*>/i.test(trimmed);
	const containsMarkdownSyntax = /\*\*|__|\[.*\]\(|\#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s/m.test(trimmed);

	if (containsMarkdownSyntax) {
		return false;
	}

	return startsWithHtml;
}

export function normalizeBrTags(text: string): string {
	return text.replace(/<br\s*\/?>/gi, '\n');
}

export function markdownToHtml(content: string): string {
	if (!content) return '';
	if (isFullyHtml(content)) return content;

	return markdown.render(normalizeBrTags(content));
}

export function htmlToMarkdown(html: string): string {
	if (!html || html === '<p></p>') return '';
	return turndown.turndown(html);
}