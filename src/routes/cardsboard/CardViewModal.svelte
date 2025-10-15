<script lang="ts">
	import type { CardItem } from "./types.js";

	export let card: CardItem;
	export let isOpen: boolean;
	export let onClose: () => void;

	// Ensure minimum 1 attendee (author should always be included)
	$: attendees = card.attendees && card.attendees.length > 0
		? card.attendees
		: (card.author ? [card.author] : []);

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}
</script>

{#if isOpen}
	<div
		class="modal-overlay"
		onclick={onClose}
		onkeydown={handleKeyDown}
		role="button"
		tabindex="0"
		aria-label="Modal schließen"
	>
		<div
			class="modal"
			onclick={() => {}}
			onkeydown={handleKeyDown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title-2"
			tabindex="0"
		>
			<div class="modal-header">
				<h3 id="modal-title-2">{card.name}</h3>
				<button class="close-button" onclick={onClose} aria-label="Modal schließen">×</button>
			</div>
			<div class="modal-content">
				{#if card.description}
					<p>{card.description}</p>
				{/if}

				{#if card.labels && card.labels.length > 0}
					<div class="modal-labels">
						<strong>Labels:</strong>
						{#each card.labels as label}
							<span class="modal-label">{label}</span>
						{/each}
					</div>
				{/if}

				<div class="modal-comments">
					<strong>Kommentare ({(card.comments || []).length}):</strong>
					{#if (card.comments || []).length > 0}
						{#each card.comments as comment}
							<div class="comment">
								<div class="comment-author">{comment.author}</div>
								<div class="comment-text">{comment.text}</div>
								<div class="comment-date">{new Date(comment.createdAt).toLocaleDateString()}</div>
							</div>
						{/each}
					{:else}
						<p class="no-comments">Keine Kommentare vorhanden</p>
					{/if}
				</div>

				<div class="modal-attendees">
					<strong>Teilnehmer ({attendees.length}):</strong>
					<div class="attendees-list">
						{#each attendees as attendee}
							<span class="attendee">{attendee}</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1em 1.5em;
		border-bottom: 1px solid #e9ecef;
	}

	.modal-header h3 {
		margin: 0;
		color: #212529;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 1.5em;
		cursor: pointer;
		color: #6c757d;
		padding: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.close-button:hover {
		background-color: #e9ecef;
	}

	.modal-content {
		padding: 1.5em;
	}

	.modal-labels, .modal-comments, .modal-attendees {
		margin-bottom: 1.5em;
	}

	.modal-label {
		display: inline-block;
		background-color: #e9ecef;
		color: #495057;
		padding: 0.25em 0.75em;
		border-radius: 12px;
		font-size: 0.85em;
		margin: 0.25em;
	}

	.comment {
		background-color: #f8f9fa;
		padding: 0.75em;
		border-radius: 6px;
		margin-bottom: 0.75em;
	}

	.comment-author {
		font-weight: 600;
		color: #495057;
		font-size: 0.85em;
		margin-bottom: 0.25em;
	}

	.comment-text {
		color: #212529;
		margin-bottom: 0.25em;
	}

	.comment-date {
		font-size: 0.75em;
		color: #6c757d;
	}

	.no-comments {
		color: #6c757d;
		font-style: italic;
		margin: 0.5em 0;
	}

	.attendees-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em;
		margin-top: 0.5em;
	}

	.attendee {
		background-color: #e9ecef;
		color: #495057;
		padding: 0.25em 0.5em;
		border-radius: 12px;
		font-size: 0.85em;
	}
</style>