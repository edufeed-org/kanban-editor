<script lang="ts">
	import { flip } from 'svelte/animate';
   import { dndzone } from 'svelte-dnd-action';
 	import Card from "./Card.svelte";
 	import * as CardUI from "../../lib/components/ui/card/index.js";
 	import type { CardItem, ColumnDropHandler, PublishState } from "./types.js";

 	const flipDurationMs = 150;

 	// Suppress passive event listener warnings for dnd-action
 	// This is a known issue with svelte-dnd-action library
 	if (typeof window !== 'undefined') {
 			// Override console.warn to suppress the specific passive listener warning
 			const originalWarn = console.warn;
 			console.warn = function(...args) {
 				const message = String(args[0] || '');
 				if (message.includes('non-passive event listener') ||
 					message.includes('Added non-passive event listener') ||
 					message.includes('scroll-blocking') ||
 					message.includes('touchstart') ||
 					message.includes('touchmove')) {
 					return; // Suppress these specific warnings
 				}
 				originalWarn.apply(console, args);
 			};
 		}

 	export let name: string;
 	export let description: string | undefined = undefined;
 	export let items: CardItem[];
 	export let color: string | undefined = undefined;
 	export let onDrop: ColumnDropHandler;
 	export let onCardAction: ((cardId: string, action: string) => void) | undefined = undefined;
 	export let onPublishStateChange: ((cardId: string, newState: PublishState) => void) | undefined = undefined;
 	export let onSidebarAction: ((cardId: string, action: string) => void) | undefined = undefined;

 	function handleDndConsiderCards(e: any) {
 		const { items: newItems } = e.detail;
  	   console.warn("got consider", name);
 		items = newItems;
   }
   function handleDndFinalizeCards(e: any) {
     onDrop(e.detail.items);
   }

   function handleCardAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onCardAction?.(cardId, action);
   }

   function handlePublishStateChange(event: CustomEvent) {
   		const { cardId, newState } = event.detail;
   		onPublishStateChange?.(cardId, newState);
   }

   function handleSidebarAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onSidebarAction?.(cardId, action);
   }

   function getCardColor(colorName: string | undefined): string {
   		return colorName ? `var(--${colorName})` : 'var(--muted)';
   }
</script>

<style>
	.column-wrapper {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.column-header {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.75rem;
	}

	.column-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin-bottom: 0.5rem;
	}

	.color-bar {
		height: 4px;
		width: 100%;
		border-radius: 2px;
	}

	.column-content {
		flex: 1;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.card-wrapper {
		margin-bottom: 0.75rem;
	}

	.card-wrapper:last-child {
		margin-bottom: 0;
	}

	/* Scrollbar styling */
	.column-content::-webkit-scrollbar {
		width: 6px;
	}

	.column-content::-webkit-scrollbar-track {
		background: hsl(var(--muted));
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}
</style>

<div class="column-wrapper">
	<div class="column-header">
		<div class="column-title">{name}</div>
		<div class="color-bar" style="background-color: {getCardColor(color)}"></div>
	</div>

	<div class="column-content" use:dndzone={{items, flipDurationMs}}
	     on:consider|passive={handleDndConsiderCards}
		 on:finalize|passive={handleDndFinalizeCards}>
		{#each items as item (item.id)}
			<div animate:flip="{{duration: flipDurationMs}}" class="card-wrapper">
				<Card
					card={item}
					{onCardAction}
					{onPublishStateChange}
					{onSidebarAction}
				/>
			</div>
		{/each}
   </div>
</div>