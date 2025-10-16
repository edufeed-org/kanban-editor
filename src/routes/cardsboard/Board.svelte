<script lang="ts">
	import { flip } from 'svelte/animate';
    import { dndzone } from 'svelte-dnd-action';
 	import Column from "./Column.svelte";
 	import type { Column as ColumnType, BoardUpdateHandler, ColumnDropHandler, CardItem, PublishState } from "./types.js";

 	const flipDurationMs = 300;

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

   export let columns: ColumnType[];
 	// will be called any time a card or a column gets dropped to update the parent data
 	export let onFinalUpdate: BoardUpdateHandler;
	// Selection states
	export let selectedColumn: string | null = null;
	export let selectedCard: string | null = null;
	export let onSelectColumn: ((columnId: string) => void) | undefined = undefined;
	export let onSelectCard: ((cardId: string) => void) | undefined = undefined;

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
        display: flex;
        overflow-x: auto;
        height: 90vh;
        width: 100%;
        gap: 0.5em;
        padding: 0.5em;
        /* margin-bottom: 40px; */
    }
    .column {
        flex: 0 0 280px;  /* Feste Breite, kein Schrumpfen */
        height: 100%;
        padding: 0.5em;
        border-right: 1px solid var(--column-border);
        /* background-color: var(--background); */
    }
</style>

<section class="board" use:dndzone={{items:columns, flipDurationMs, type:'column', dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}}} onconsider={handleDndConsiderColumns} onfinalize={handleDndFinalizeColumns}>
    {#each columns as {id, name, color, items}, idx (id)}
   		<div class="column" animate:flip="{{duration: flipDurationMs}}" >
 				<Column
 						name={name}
 						color={color}
 						items={items}
						columnId={id}
						isSelected={selectedColumn === id}
						onSelect={() => onSelectColumn?.(id)}
 						onDrop={(newItems) => handleItemFinalize(idx, newItems)}
 						onCardAction={handleCardAction}
 						onPublishStateChange={handlePublishStateChange}
						selectedCardId={selectedCard}
						onSelectCard={onSelectCard}
 						onSidebarAction={handleSidebarAction}
 					/>
 			</div>
     {/each}
</section>