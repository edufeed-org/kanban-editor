<script lang="ts">
	import { flip } from 'svelte/animate';
   import { dndzone } from 'svelte-dnd-action';
 	import Card from "./Card.svelte";
 	import HeaderBar from "./HeaderBar.svelte";
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
</script>

<style>
	.wrapper {
		height: 100%;
		width: 100%;
		     /*Notice we make sure this container doesn't scroll so that the title stays on top and the dndzone inside is scrollable*/
        overflow-y: hidden;
	}
	.column-content {
        height: calc(100% - 2.5em);
        /* Notice that the scroll container needs to be the dndzone if you want dragging near the edge to trigger scrolling */
        overflow-y: scroll;
    }
    .column-description {
    	font-size: 0.9em;
    	color: #666;
    	text-align: center;
    	margin-bottom: 0.5em;
    	padding: 0 0.2em;
    }
</style>

<div class='wrapper'>
  	<HeaderBar
  		title={name}
  		showMenu={false}
  		showPublishToggle={false}
  	/>
  	{#if description}
 		<div class="column-description">{description}</div>
 	{/if}
 	<div class="column-content" use:dndzone={{items, flipDurationMs}}
 	    	 on:consider|passive={handleDndConsiderCards}
 			 on:finalize|passive={handleDndFinalizeCards}>
 				{#each items as item (item.id)}
 				       <div animate:flip="{{duration: flipDurationMs}}" >
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