<script lang="ts">
	import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';
	import Column from "./Column.svelte";
	import type { Column as ColumnType, BoardUpdateHandler, ColumnDropHandler, FolderDragStartHandler, KanbanItem } from "./types.js";

	const flipDurationMs = 300;

  export let columns: ColumnType[];
	// will be called any time a card or a column gets dropped to update the parent data
	export let onFinalUpdate: BoardUpdateHandler;

	let isDraggingFolder = false;

  function handleDndConsiderColumns(e: any) {
    columns = e.detail.items;
  }
  function handleDndFinalizeColumns(e: any) {
    onFinalUpdate(e.detail.items);
  }
 	function handleItemFinalize(columnIdx: number, newItems: KanbanItem[]) {
		columns[columnIdx].items = newItems;
		onFinalUpdate([...columns]);
		isDraggingFolder = false;
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
    {#each columns as {id, name,items}, idx (id)}
  		<div class="column"animate:flip="{{duration: flipDurationMs}}" >
				<Column name={name} items={items} isDraggingFolder={isDraggingFolder} onFolderDragStart={() => (isDraggingFolder = true)} onDrop={(newItems) => handleItemFinalize(idx, newItems)} />
			</div>
    {/each}
</section>