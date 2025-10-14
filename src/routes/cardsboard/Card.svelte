<script lang="ts">
	export let name: string;
	export let description: string | undefined = undefined;
</script>

<div class="card">
	<div class="card-title">{name}</div>
	{#if description}
		<div class="card-description">{description}</div>
	{/if}
</div>

<style>
	.card {
		height: auto;
		min-height: 4em;
		width: 100%;
		margin: 0.4em 0;
		padding: 0.5em;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		background-color: #dddddd;
		border: 1px solid #333333;
		border-radius: 4px;
	}
	.card-title {
		font-weight: bold;
		margin-bottom: 0.2em;
	}
	.card-description {
		font-size: 0.9em;
		color: #666;
	}
</style>