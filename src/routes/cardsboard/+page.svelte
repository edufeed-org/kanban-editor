<script lang="ts">
	import { data } from "./data.js";
	import Board from "./Board.svelte";
	import type { Column, BoardUpdateHandler } from "./types.js";

	function handleBoardUpdated(newColumnsData: Column[]) {
		// if you wanted to update a database or a server, this is where you would do it
		data.set(newColumnsData);
	}
</script>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
	}
	h2, h5 {
		margin-bottom:0.4em;

	}
</style>

<h2>
	Board
</h2>
<h5>
	(svelte-dnd-action example)
</h5>
<p>
	This is an exmaple for a board with draggable columns and items. <br />
	Notice that the scroll position is not maintained if you first scroll down in the first column and then drag it. This is because I wanted to keep this example super clear. To maintain scroll position you will need to save it per column. See <a href="https://svelte.dev/repl/eb2f5988bd2f46488810606c1fb13392?version=3.29.4">this example</a>.
</p>
<br/><hr/><br/>
<Board columns={$data} onFinalUpdate={handleBoardUpdated}/>