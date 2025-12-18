<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import Image from '@tiptap/extension-image';
	
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
	import UndoIcon from '@lucide/svelte/icons/undo';
	import RedoIcon from '@lucide/svelte/icons/redo';
	
	interface Props {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		onchange?: (content: string) => void;
	}
	
	let { 
		value = '', 
		placeholder = 'Beschreibung eingeben...', 
		disabled = false,
		onchange 
	}: Props = $props();
	
	let element: HTMLElement;
	let editor = $state<Editor | null>(null);
	let isEditorReady = $state(false);
	
	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3]
					}
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
			content: value,
			editable: !disabled,
			onTransaction: () => {
				// Force re-render für reactive updates
				editor = editor;
			},
			onUpdate: ({ editor }) => {
				const html = editor.getHTML();
				if (onchange) {
					onchange(html);
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
	
	// Update content wenn value von außen ändert
	$effect(() => {
		if (editor && value !== editor.getHTML() && !editor.isFocused) {
			editor.commands.setContent(value);
		}
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
	
	function undo() {
		editor?.chain().focus().undo().run();
	}
	
	function redo() {
		editor?.chain().focus().redo().run();
	}
</script>

<div class="border rounded-md overflow-hidden {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
	<!-- Toolbar -->
	{#if isEditorReady && editor}
		<div class="bg-muted/30 border-b p-2 flex flex-wrap gap-1">
			<!-- Text Formatting -->
			<button
				type="button"
				onclick={toggleBold}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('bold') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Fett"
			>
				<BoldIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={toggleItalic}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('italic') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Kursiv"
			>
				<ItalicIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={toggleStrike}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('strike') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Durchgestrichen"
			>
				<StrikethroughIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={toggleCode}
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
				onclick={() => setHeading(1)}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Überschrift 1"
			>
				<Heading1Icon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={() => setHeading(2)}
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
				onclick={toggleBulletList}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('bulletList') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Aufzählung"
			>
				<ListIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={toggleOrderedList}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('orderedList') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Nummerierte Liste"
			>
				<ListOrderedIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={toggleBlockquote}
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
				onclick={addLink}
				class="p-1.5 rounded hover:bg-muted {editor.isActive('link') ? 'bg-muted' : ''}"
				disabled={disabled}
				title="Link einfügen"
			>
				<LinkIcon class="h-4 w-4" />
			</button>
			
			<div class="w-px bg-border mx-1"></div>
			
			<!-- Undo/Redo -->
			<button
				type="button"
				onclick={undo}
				class="p-1.5 rounded hover:bg-muted"
				disabled={disabled || !editor.can().undo()}
				title="Rückgängig"
			>
				<UndoIcon class="h-4 w-4" />
			</button>
			
			<button
				type="button"
				onclick={redo}
				class="p-1.5 rounded hover:bg-muted"
				disabled={disabled || !editor.can().redo()}
				title="Wiederholen"
			>
				<RedoIcon class="h-4 w-4" />
			</button>
		</div>
	{/if}
	
	<!-- Editor Content -->
	<div bind:this={element} class="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none"></div>
</div>

<style>
	:global(.ProseMirror) {
		outline: none;
		min-height: 200px;
	}
	
	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: #adb5bd;
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
	}
	
	:global(.ProseMirror blockquote) {
		border-left: 3px solid #ddd;
		padding-left: 1em;
		margin-left: 0;
		font-style: italic;
	}
	
	:global(.ProseMirror code) {
		background-color: #f4f4f4;
		padding: 0.2em 0.4em;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.9em;
	}
	
	:global(.ProseMirror pre) {
		background-color: #f4f4f4;
		padding: 1em;
		border-radius: 5px;
		overflow-x: auto;
	}
	
	:global(.ProseMirror pre code) {
		background: none;
		padding: 0;
	}
</style>
