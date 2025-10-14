<script lang="ts">
	import type { Comment } from "./types.js";
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let comments: Comment[] = [];
	export let attendees: string[] = [];
	export let showComments: boolean = true;
	export let showAttendees: boolean = true;
	export let showActions: boolean = true;

	// Ensure minimum 1 attendee (author should always be included)
	export let author: string = '';

	$: displayAttendees = attendees.length > 0 ? attendees : (author ? [author] : []);

	function handleActionClick(action: string) {
		dispatch('actionClick', { action });
	}
</script>

<div class="card-footer">
	<div class="footer-left">
		{#if showComments}
			<div class="footer-item comments">
				<span class="icon">💬</span>
				<span class="count">{comments.length}</span>
			</div>
		{/if}

		{#if showAttendees}
			<div class="footer-item attendees">
				<span class="icon">👥</span>
				<span class="count">{displayAttendees.length}</span>
			</div>
		{/if}
	</div>

	<div class="footer-center">
		<!-- Labels wurden in CardContent verschoben -->
	</div>

	{#if showActions}
		<div class="footer-actions">
			<button
				class="action-btn"
				on:click|passive={() => handleActionClick('complete')}
				aria-label="Mark as complete"
				title="Mark as complete"
			>
				✓
			</button>
			<button
				class="action-btn"
				on:click|passive={() => handleActionClick('edit')}
				aria-label="Edit card"
				title="Edit card"
			>
				✏️
			</button>
		</div>
	{/if}
</div>

<style>
	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		margin-top: auto;
		padding-top: 0.75em;
		border-top: 1px solid #e9ecef;
		min-height: 2em;
	}

	.footer-left {
		display: flex;
		align-items: center;
		gap: 1em;
	}

	.footer-center {
		display: flex;
		justify-content: center;
		flex: 1;
	}

	.footer-actions {
		display: flex;
		gap: 0.25em;
	}

	.footer-item {
		display: flex;
		align-items: center;
		gap: 0.25em;
		font-size: 0.8em;
		color: #6c757d;
	}

	.icon {
		font-size: 0.9em;
		opacity: 0.8;
	}

	.count {
		font-weight: 500;
		min-width: 1em;
		text-align: center;
	}


	.action-btn {
		background: none;
		border: 1px solid #ced4da;
		border-radius: 4px;
		padding: 0.25em 0.5em;
		cursor: pointer;
		font-size: 0.8em;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
	}

	.action-btn:hover {
		background-color: #e9ecef;
		border-color: #adb5bd;
	}

	.action-btn:focus {
		outline: 2px solid #007bff;
		outline-offset: 2px;
	}
</style>