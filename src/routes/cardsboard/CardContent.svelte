<script lang="ts">
	import type { CardItem } from "./types.js";

	export let card: CardItem;

	function handleImageClick() {
		if (card.link) {
			window.open(card.link, '_blank', 'noopener,noreferrer');
		}
	}

	function handleLinkClick() {
		if (card.link) {
			window.open(card.link, '_blank', 'noopener,noreferrer');
		}
	}
</script>

<div class="card-content">
	<!-- Labels Section -->
	{#if card.labels && card.labels.length > 0}
		<div class="card-labels">
			{#each card.labels as label}
				<span class="label">{label}</span>
			{/each}
		</div>
	{/if}

	<!-- Image Section -->
	{#if card.image}
		<div class="card-image-container">
			<img
				src={card.image}
				alt={card.name}
				class="card-image"
				on:click={handleImageClick}
				role={card.link ? "button" : ""}
				on:keydown={(e) => e.key === 'Enter' && handleImageClick()}
			/>
		</div>
	{/if}

	<!-- Description Section (Markdown Content) -->
	{#if card.description}
		<div class="card-description">
			{card.description}
		</div>
	{/if}

	<!-- Link Section -->
	{#if card.link}
		<div class="card-link">
			<button class="link-button" on:click={handleLinkClick}>
				<span class="link-icon">🔗</span>
				<span class="link-text">Link öffnen</span>
			</button>
		</div>
	{/if}
</div>

<style>
	.card-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.75em;
	}

	.card-labels {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25em;
		margin-bottom: 0.5em;
	}

	.label {
		background-color: #e9ecef;
		color: #495057;
		padding: 0.2em 0.5em;
		border-radius: 12px;
		font-size: 0.75em;
		font-weight: 500;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-image-container {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.card-image {
		max-width: 100%;
		max-height: 200px;
		border-radius: 6px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		cursor: pointer;
	}

	.card-image:hover {
		transform: scale(1.02);
		box-shadow: 0 4px 8px rgba(0,0,0,0.15);
	}

	.card-image:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	.card-description {
		font-size: 0.9em;
		color: #495057;
		line-height: 1.4;
		flex: 1;
	}

	.card-link {
		margin-top: auto;
	}

	.link-button {
		display: flex;
		align-items: center;
		gap: 0.5em;
		background: none;
		border: 1px solid #007bff;
		color: #007bff;
		padding: 0.5em 1em;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85em;
		transition: all 0.2s ease;
		width: 100%;
		justify-content: center;
	}

	.link-button:hover {
		background-color: #007bff;
		color: white;
	}

	.link-button:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}

	.link-icon {
		font-size: 0.9em;
	}

	.link-text {
		font-weight: 500;
	}
</style>