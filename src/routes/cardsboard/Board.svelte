<script lang="ts">
	import { flip } from 'svelte/animate';
   import { dndzone } from 'svelte-dnd-action';
 	import Column from "./Column.svelte";
 	import type { Column as ColumnType, BoardUpdateHandler, ColumnDropHandler, CardItem, PublishState } from "./types.js";

 	const flipDurationMs = 300;

   export let columns: ColumnType[];
 	// will be called any time a card or a column gets dropped to update the parent data
 	export let onFinalUpdate: BoardUpdateHandler;

   function handleDndConsiderColumns(e: any) {
     columns = e.detail.items;
   }
   function handleDndFinalizeColumns(e: any) {
     onFinalUpdate(e.detail.items);
   }
   	function handleItemFinalize(columnIdx: number, newItems: CardItem[]) {
  		columns[columnIdx].items = newItems;
  		onFinalUpdate([...columns]);
  	}

  	function handleCardAction(cardId: string, action: string) {
  		console.log('Card action:', cardId, action);
  		// Handle card actions like complete, edit, etc.
  	}

  	function handlePublishStateChange(cardId: string, newState: PublishState) {
  		console.log('Publish state change:', cardId, newState);
  		// Find and update the card's publish state
  		for (const column of columns) {
  			const card = column.items.find(item => String(item.id) === cardId);
  			if (card) {
  				card.publishState = newState;
  				onFinalUpdate([...columns]);
  				break;
  			}
  		}
  	}

  	function handleSidebarAction(cardId: string, action: string) {
  		console.log('Sidebar action:', cardId, action);
  		// Handle sidebar actions like delete, duplicate, etc.
  	}
</script>

<style>
    .board {
        height: 90vh;
        width: 100%;
        padding: 0.5em;
        margin-bottom: 40px;
    }
    .column {
        height: 100%;
        width: 250px;
        padding: 0.5em;
        margin: 1em;
        float: left;
        border: 1px solid #333333;
				background-color: white;
    }
</style>

<section class="board" use:dndzone={{items:columns, flipDurationMs, type:'column'}} on:consider={handleDndConsiderColumns} on:finalize={handleDndFinalizeColumns}>
    {#each columns as {id, name, description, items}, idx (id)}
   		<div class="column"animate:flip="{{duration: flipDurationMs}}" >
 				<Column
 						name={name}
 						description={description}
 						items={items}
 						onDrop={(newItems) => handleItemFinalize(idx, newItems)}
 						onCardAction={handleCardAction}
 						onPublishStateChange={handlePublishStateChange}
 						onSidebarAction={handleSidebarAction}
 					/>
 			</div>
     {/each}
</section>