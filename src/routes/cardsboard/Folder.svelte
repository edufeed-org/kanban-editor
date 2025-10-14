<script lang="ts">
	import { flip } from "svelte/animate";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { data } from "./data.js";
	import Card from "./Card.svelte";
	import type { FolderItem, CardItem } from "./types.js";

	const flipDurationMs = 150;

	export let folder: FolderItem;

	export let dropFromOthersDisabled = false;
	$: console.log(dropFromOthersDisabled);

	function handleConsider(e: any) {
		const { items, info: { id, trigger } } = e.detail;

		folder.items = items;
	}

	function handleFinalize(e: any) {
		folder.items = e.detail.items;
	}
</script>

<div class="wrapper">
	<div>
		{folder.name}
	</div>
	<div class="drop-zone" use:dndzone={{items: folder.items, flipDurationMs, dropFromOthersDisabled}} on:consider={handleConsider} on:finalize={handleFinalize}>
		{#each folder.items as item (item.id)}
		<div animate:flip={{duration: flipDurationMs}}>
			<Card name={item.name} />
		</div>
		{/each}
	</div>
</div>

<style>
	.wrapper {
		margin: 0.4em 0;
		padding: 0.5rem;
		background-color: white;
		border: 1px solid;
	}

	.drop-zone {
		min-height: 3rem;
	}
</style>