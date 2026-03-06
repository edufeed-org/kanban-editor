<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import Image from '@tiptap/extension-image';
	import {
		hasMarkdownSyntax,
		htmlToMarkdown,
		markdownToHtml
	} from '$lib/components/ui/markdown/conversion.js';
	
	// Icons
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import CodeIcon from '@lucide/svelte/icons/code';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import QuoteIcon from '@lucide/svelte/icons/quote';
	import Heading1Icon from '@lucide/svelte/icons/heading-1';
	import Heading2Icon from '@lucide/svelte/icons/heading-2';
	import LinkIcon from '@lucide/svelte/icons/link';
	
	interface Props {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		fullHeight?: boolean;
		onchange?: (content: string) => void;
	}
	
	let { 
		value = '', 
		placeholder = 'Beschreibung eingeben...', 
		disabled = false,
		fullHeight = false,
		onchange 
	}: Props = $props();
	
	let element: HTMLElement;
	let editor = $state<Editor | null>(null);
	let isEditorReady = $state(false);
	
	// Track last value to prevent unnecessary updates
	let lastExternalValue = $state(value);
	let isInternalUpdate = false;
	
	// Prüfe ob der Inhalt Markdown ist (nicht bereits HTML)
	function isMarkdown(content: string): boolean {
		if (!content) return false;
		// Wenn es mit < beginnt und HTML-Tags enthält, ist es wahrscheinlich HTML
		if (content.trim().startsWith('<') && /<\/?[a-z][\s\S]*>/i.test(content)) {
			return false;
		}

		return hasMarkdownSyntax(content);
	}
	
	// Paste-Handler für Markdown-Inhalt
	function handlePaste(event: ClipboardEvent) {
		if (!editor || disabled) return;
		
		const clipboardData = event.clipboardData;
		if (!clipboardData) return;
		
		// Prüfe ob HTML-Inhalt vorhanden ist (formatierter Text aus anderen Apps)
		const htmlContent = clipboardData.getData('text/html');
		if (htmlContent) {
			// Lass TipTap den HTML-Inhalt normal verarbeiten
			return;
		}
		
		// Nur Plain-Text → Prüfe ob es Markdown ist
		const plainText = clipboardData.getData('text/plain');
		if (plainText && isMarkdown(plainText)) {
			// Verhindere Standard-Paste
			event.preventDefault();
			
			// Konvertiere Markdown zu HTML und füge ein
			const html = markdownToHtml(plainText);
			editor.commands.insertContent(html);
		}
		// Sonst: Normales Paste-Verhalten für Plain-Text
	}
	
	onMount(() => {
		// Konvertiere initialen Wert von Markdown zu HTML für den Editor
		const initialContent = markdownToHtml(value);
		
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					},
					// Deaktiviere Link in StarterKit falls vorhanden (verwenden eigene Link-Extension)
					link: false
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'text-primary underline hover:text-primary/80'
					}
				}),
				Placeholder.configure({
					placeholder
				}),
				Image.configure({
					HTMLAttributes: {
						class: 'max-w-full h-auto rounded-md'
					}
				})
			],
			content: initialContent,
			editable: !disabled,
			// Removed onTransaction - was causing unnecessary re-renders
			// The toolbar buttons use editor?.isActive() which works without it
			onUpdate: ({ editor: ed }) => {
				// Mark as internal update to prevent $effect loop
				isInternalUpdate = true;
				
				// Konvertiere HTML zu Markdown beim Speichern!
				const html = ed.getHTML();
				const markdown = htmlToMarkdown(html);
				lastExternalValue = markdown;
				
				if (onchange) {
					onchange(markdown);
				}
				
				// Reset flag after microtask
				queueMicrotask(() => {
					isInternalUpdate = false;
				});
			},
			editorProps: {
				handlePaste: (view, event) => {
					// Custom Paste-Handler für Markdown
					const clipboardData = event.clipboardData;
					if (!clipboardData) return false;
					
					// HTML vorhanden? → Standard-Verarbeitung
					const htmlContent = clipboardData.getData('text/html');
					if (htmlContent) return false;
					
					// Plain-Text prüfen
					const plainText = clipboardData.getData('text/plain');
					if (plainText && isMarkdown(plainText)) {
						// Markdown zu HTML konvertieren und einfügen
						const html = markdownToHtml(plainText);
						editor?.commands.insertContent(html);
						return true; // Event wurde behandelt
					}
					
					return false; // Standard-Verarbeitung
				}
			}
		});
		
		isEditorReady = true;
	});
	
	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});
	
	// Update content wenn value von außen ändert (nicht von internen Updates)
	$effect(() => {
		// Skip if this is our own update or editor isn't ready
		if (!editor || isInternalUpdate) return;
		
		// Skip if value hasn't actually changed from external source
		if (value === lastExternalValue) return;
		
		// Only update if editor is not focused (user not typing)
		if (editor.isFocused) return;
		
		// Update tracking
		lastExternalValue = value;
		
		// Convert and set content
		const htmlContent = markdownToHtml(value);
		editor.commands.setContent(htmlContent, { emitUpdate: false });
	});
	
	// Update editable state wenn disabled ändert
	$effect(() => {
		if (editor) {
			editor.setEditable(!disabled);
		}
	});
	
	function toggleBold() {
		editor?.chain().focus().toggleBold().run();
	}
	
	function toggleItalic() {
		editor?.chain().focus().toggleItalic().run();
	}
	
	function toggleStrike() {
		editor?.chain().focus().toggleStrike().run();
	}
	
	function toggleCode() {
		editor?.chain().focus().toggleCode().run();
	}
	
	function toggleBulletList() {
		editor?.chain().focus().toggleBulletList().run();
	}
	
	function toggleOrderedList() {
		editor?.chain().focus().toggleOrderedList().run();
	}
	
	function toggleBlockquote() {
		editor?.chain().focus().toggleBlockquote().run();
	}
	
	function setHeading(level: 1 | 2) {
		editor?.chain().focus().toggleHeading({ level }).run();
	}
	
	function addLink() {
		const url = window.prompt('URL eingeben:');
		if (url) {
			editor?.chain().focus().setLink({ href: url }).run();
		}
	}
</script>

<div class="markdown-editor-wrapper border rounded-md overflow-hidden {fullHeight ? 'h-full flex flex-col full-height-mode' : ''} {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
	<!-- Toolbar -->
	{#if isEditorReady && editor && !disabled}
		<div class="bg-muted/30 border-b p-2 flex flex-wrap gap-1 {fullHeight ? 'sticky top-0 z-10 flex-shrink-0' : ''}">
			<!-- Text Formatting -->
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleBold(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('bold') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Fett"
			>
				<BoldIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleItalic(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('italic') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Kursiv"
			>
				<ItalicIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleStrike(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('strike') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Durchgestrichen"
			>
				<StrikethroughIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleCode(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('code') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Inline Code"
			>
				<CodeIcon class="h-4 w-4" />
			</button>
			
			<div class="w-px bg-border mx-1"></div>
			
			<!-- Headings -->
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); setHeading(1); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Überschrift 1"
			>
				<Heading1Icon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); setHeading(2); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Überschrift 2"
			>
				<Heading2Icon class="h-4 w-4" />
			</button>
			
			<div class="w-px bg-border mx-1"></div>
			
			<!-- Lists -->
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleBulletList(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('bulletList') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Aufzählung"
			>
				<ListIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleOrderedList(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('orderedList') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Nummerierte Liste"
			>
				<ListOrderedIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); toggleBlockquote(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('blockquote') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Zitat"
			>
				<QuoteIcon class="h-4 w-4" />
			</button>
			
			<div class="w-px bg-border mx-1"></div>
			
			<!-- Link -->
			<button
				type="button"
				onmousedown={(e) => { e.preventDefault(); addLink(); }}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('link') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Link einfügen"
			>
				<LinkIcon class="h-4 w-4" />
			</button>
		</div>
	{/if}
	
	<!-- Editor Content -->
	<div bind:this={element} class="prose prose-sm dark:prose-invert max-w-none p-4 {fullHeight ? 'flex-1 min-h-[300px] overflow-y-auto' : 'min-h-[200px] max-h-[400px] overflow-y-hidden'}" aria-label="Beschreibung" ></div>
</div>

<style>
	:global(.ProseMirror) {
		outline: none;
		min-height: 200px;
		max-height: 400px;
		overflow-y: auto;
	}
	
	/* Full-Height-Mode: ProseMirror füllt verfügbaren Platz */
	:global(.full-height-mode .ProseMirror) {
		min-height: 280px;
		max-height: unset;
		height: auto;
		overflow-y: auto;
	}
	
	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: var(--muted-foreground);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
	
	:global(.ProseMirror h1) {
		font-size: 1.5em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	:global(.ProseMirror h2) {
		font-size: 1.3em;
		font-weight: bold;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
	}
	
	:global(.ProseMirror ul, .ProseMirror ol) {
		padding-left: 1.5em;
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		list-style: inherit;
	}
	
	:global(.ProseMirror ul) {
		list-style-type: disc;
	}
	
	:global(.ProseMirror ol) {
		list-style-type: decimal;
	}
	
	:global(.ProseMirror li) {
		display: list-item;
	}
	
	:global(.ProseMirror blockquote) {
		border-left: 4px solid var(--primary);
		padding-left: 1em;
		margin-left: 0;
		font-style: italic;
		color: var(--foreground);
		background-color: rgba(0, 0, 0, 0.05);
	}
	
	/* Dark mode anpassung für blockquote */
	:global(.dark .ProseMirror blockquote) {
		background-color: rgba(255, 255, 255, 0.05);
	}
	
	/* Code Styles - deutlich sichtbarer Hintergrund */
	:global(.ProseMirror code) {
		background-color: rgba(0, 0, 0, 0.1);
		color: var(--foreground);
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}
	
	/* Dark mode anpassung */
	:global(.dark .ProseMirror code) {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	:global(.ProseMirror pre) {
		background-color: rgba(0, 0, 0, 0.1);
		color: var(--foreground);
		padding: 1em;
		border-radius: 5px;
		overflow-x: auto;
	}
	
	/* Dark mode anpassung */
	:global(.dark .ProseMirror pre) {
		background-color: rgba(255, 255, 255, 0.1);
	}
	
	:global(.ProseMirror pre code) {
		background: none;
		color: inherit;
		padding: 0;
	}
</style>
