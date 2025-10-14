<script lang="ts">
	import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';
	import Card from "./Card.svelte";
	import type { CardItem, ColumnDropHandler } from "./types.js";

	const flipDurationMs = 150;

	export let name: string;
	export let description: string | undefined = undefined;
	export let items: CardItem[];
	export let onDrop: ColumnDropHandler;

	function handleDndConsiderCards(e: any) {
		const { items: newItems } = e.detail;
	   console.warn("got consider", name);
		items = newItems;
  }
  function handleDndFinalizeCards(e: any) {
    onDrop(e.detail.items);
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
    .column-title {
    min-height: 2.5em;
     font-weight: bold;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
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
 	<div class="column-title">
		{name}
	</div>
	{#if description}
		<div class="column-description">{description}</div>
	{/if}
	<div class="column-content" use:dndzone={{items, flipDurationMs}}
     	 on:consider={handleDndConsiderCards}
			 on:finalize={handleDndFinalizeCards}>
				{#each items as item (item.id)}
				       <div animate:flip="{{duration: flipDurationMs}}" >
				          <Card name={item.name} description={item.description} />
				        </div>
				    {/each}
    </div>
</div>