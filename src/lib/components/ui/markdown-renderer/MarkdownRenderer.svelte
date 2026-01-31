<script lang="ts">
	import MarkdownIt from 'markdown-it';
	import type Token from 'markdown-it/lib/token.mjs';
	import type Renderer from 'markdown-it/lib/renderer.mjs';
	
	interface Props {
		content: string;
		class?: string;
	}
	
	let { content = '', class: className = '' }: Props = $props();
	
	// Markdown-it Instanz mit sinnvollen Optionen
	const md = new MarkdownIt({
		html: true,         // HTML erlauben (für bereits konvertierte Inhalte)
		linkify: true,      // URLs automatisch zu Links konvertieren
		typographer: true,  // Typografische Ersetzungen (Anführungszeichen etc.)
		breaks: true        // Zeilenumbrüche als <br> rendern
	});
	
	// Links in neuem Tab öffnen - mit korrekten Typen
	type RenderRule = (tokens: Token[], idx: number, options: object, env: unknown, self: Renderer) => string;
	
	const defaultRender: RenderRule = md.renderer.rules.link_open || function(
		tokens: Token[], 
		idx: number, 
		options: object, 
		_env: unknown, 
		self: Renderer
	): string {
		return self.renderToken(tokens, idx, options);
	};
	
	md.renderer.rules.link_open = function(
		tokens: Token[], 
		idx: number, 
		options: object, 
		env: unknown, 
		self: Renderer
	): string {
		const token = tokens[idx];
		token.attrSet('target', '_blank');
		token.attrSet('rel', 'noopener noreferrer');
		return defaultRender(tokens, idx, options, env, self);
	};
	
	// Prüfe ob der Content bereits HTML ist
	function isHtml(text: string): boolean {
		if (!text) return false;
		const trimmed = text.trim();
		// Wenn es mit einem HTML-Tag beginnt und strukturiertes HTML enthält
		return trimmed.startsWith('<') && /<\/?[a-z][\s\S]*>/i.test(trimmed);
	}
	
	// Intelligentes Rendering: HTML direkt anzeigen, Markdown konvertieren
	let renderedHtml = $derived.by(() => {
		if (!content) return '';
		// Wenn der Content bereits HTML ist, direkt verwenden
		if (isHtml(content)) {
			return content;
		}
		// Sonst Markdown zu HTML konvertieren
		return md.render(content);
	});
</script>

<div class="markdown-rendered prose prose-sm max-w-none dark:prose-invert {className}">
	{@html renderedHtml}
</div>

<style>
	/* Styling für gerendertes Markdown */
	.markdown-rendered :global(h1) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	.markdown-rendered :global(h2) {
		font-size: 1.3em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	.markdown-rendered :global(h3) {
		font-size: 1.1em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	.markdown-rendered :global(ul),
	.markdown-rendered :global(ol) {
		padding-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		list-style: inherit;
	}
	
	.markdown-rendered :global(ul) {
		list-style-type: disc;
	}
	
	.markdown-rendered :global(ol) {
		list-style-type: decimal;
	}
	
	.markdown-rendered :global(li) {
		display: list-item;
		margin-top: 0.25em;
	}
	
	.markdown-rendered :global(blockquote) {
		border-left: 4px solid hsl(var(--primary));
		padding-left: 1em;
		margin-left: 0;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		font-style: italic;
		color: hsl(var(--foreground));
		background-color: rgba(0, 0, 0, 0.05);
	}
	
	/* Dark mode für blockquote */
	:global(.dark) .markdown-rendered :global(blockquote) {
		background-color: rgba(255, 255, 255, 0.05);
	}
	
	/* Code Styles */
	.markdown-rendered :global(code) {
		background-color: rgba(0, 0, 0, 0.1);
		color: hsl(var(--foreground));
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}
	
	:global(.dark) .markdown-rendered :global(code) {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	.markdown-rendered :global(pre) {
		background-color: rgba(0, 0, 0, 0.1);
		color: hsl(var(--foreground));
		padding: 1em;
		border-radius: 5px;
		overflow-x: auto;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	:global(.dark) .markdown-rendered :global(pre) {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	.markdown-rendered :global(pre code) {
		background: none;
		color: inherit;
		padding: 0;
	}
	
	/* Links */
	.markdown-rendered :global(a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}
	
	.markdown-rendered :global(a:hover) {
		opacity: 0.8;
	}
	
	/* Paragraphs */
	.markdown-rendered :global(p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	.markdown-rendered :global(p:first-child) {
		margin-top: 0;
	}
	
	.markdown-rendered :global(p:last-child) {
		margin-bottom: 0;
	}
	
	/* Horizontal Rule */
	.markdown-rendered :global(hr) {
		border: none;
		border-top: 1px solid hsl(var(--border));
		margin: 1em 0;
		height: 0;
		display: block;
	}
	
	/* Teaser Separator (+++  Marker) */
	.markdown-rendered :global(hr.teaser-separator) {
		border-top: 2px dashed hsl(var(--muted-foreground) / 0.4);
		margin: 1.5em 0;
	}
	
	/* Strong/Bold */
	.markdown-rendered :global(strong) {
		font-weight: 600;
	}
	
	/* Emphasis/Italic */
	.markdown-rendered :global(em) {
		font-style: italic;
	}
</style>
