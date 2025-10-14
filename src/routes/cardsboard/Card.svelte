<script lang="ts">
	import type { CardItem, PublishState } from "./types.js";
	import HeaderBar from "./HeaderBar.svelte";
	import CardContent from "./CardContent.svelte";
	import CardFooter from "./CardFooter.svelte";

	export let card: CardItem;
	export let onPublishStateChange: ((cardId: string, newState: PublishState) => void) | undefined = undefined;
	export let onCardAction: ((cardId: string, action: string) => void) | undefined = undefined;
	export let onSidebarAction: ((cardId: string, action: string) => void) | undefined = undefined;

	let showModal = false;
	let showSidebar = false;

	// Ensure minimum 1 attendee (author should always be included)
	$: attendees = card.attendees && card.attendees.length > 0
		? card.attendees
		: (card.author ? [card.author] : []);

	function handleMenuClick() {
		showSidebar = true;
	}

	function handleDoubleClick() {
		showModal = true;
	}

	function handlePublishToggle(event: CustomEvent) {
		const { newState } = event.detail;
		card.publishState = newState;
		// Call callback prop instead of dispatching event
		onPublishStateChange?.(String(card.id), newState);
	}

	function handleFooterAction(event: CustomEvent) {
		const { action } = event.detail;
		onCardAction?.(String(card.id), action);
	}

	function closeModal() {
		showModal = false;
	}

	function closeSidebar() {
		showSidebar = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleDoubleClick();
		}
	}

	function handleSidebarAction(action: string) {
		onSidebarAction?.(String(card.id), action);
		closeSidebar();
	}
</script>

<div
	class="card"
	class:draft={card.publishState === 'draft'}
	class:published={card.publishState === 'published'}
	class:archived={card.publishState === 'archived'}
	on:dblclick={handleDoubleClick}
	on:keydown={handleKeyDown}
	role="button"
	tabindex="0"
	aria-label="Card: {card.name}"
>
	<HeaderBar
		title={card.name}
		publishState={card.publishState || 'draft'}
		showMenu={true}
		showPublishToggle={true}
		on:menuClick={handleMenuClick}
		on:publishToggle={handlePublishToggle}
	/>

	<CardContent {card} />

	<CardFooter
		comments={card.comments || []}
		{attendees}
		author={card.author || ''}
		on:actionClick={handleFooterAction}
	/>
	</div>
	
	<!-- Card Modal for editing/viewing details -->
	{#if showModal}
		<div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0" aria-label="Modal schließen">
			<div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true" aria-labelledby="modal-title-2" tabindex="0">
				<div class="modal-header">
					<h3 id="modal-title-2">{card.name}</h3>
					<button class="close-button" on:click={closeModal} aria-label="Modal schließen">×</button>
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
	
	<!-- Sidebar for quick actions -->
	{#if showSidebar}
		<div class="sidebar-overlay" on:click={closeSidebar} on:keydown={(e) => e.key === 'Escape' && closeSidebar()} role="button" tabindex="0" aria-label="Sidebar schließen">
			<div class="sidebar" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeSidebar()} role="dialog" aria-label="Karten-Aktionen" tabindex="0">
				<div class="sidebar-header">
					<h4>Karte bearbeiten</h4>
					<button class="close-button" on:click={closeSidebar} aria-label="Sidebar schließen">×</button>
				</div>
				<div class="sidebar-content">
					<button class="sidebar-action" on:click={() => handleSidebarAction('delete')}>
						Karte löschen
					</button>
					<button class="sidebar-action" on:click={() => handleSidebarAction('duplicate')}>
						Duplizieren
					</button>
					<button class="sidebar-action" on:click={() => handleSidebarAction('move')}>
						Verschieben
					</button>
					<button class="sidebar-action" on:click={() => handleSidebarAction('color')}>
						Farbe ändern
					</button>
				</div>
			</div>
		</div>
	{/if}

<!-- Card Modal for editing/viewing details -->
{#if showModal}
	<div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0" aria-label="Modal schließen">
		<div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="0">
			<div class="modal-header">
				<h3 id="modal-title">{card.name}</h3>
				<button class="close-button" on:click={closeModal} aria-label="Modal schließen">×</button>
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

				{#if card.comments && card.comments.length > 0}
					<div class="modal-comments">
						<strong>Kommentare ({card.comments.length}):</strong>
						{#each card.comments as comment}
							<div class="comment">
								<div class="comment-author">{comment.author}</div>
								<div class="comment-text">{comment.text}</div>
								<div class="comment-date">{new Date(comment.createdAt).toLocaleDateString()}</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if card.attendees && card.attendees.length > 0}
					<div class="modal-attendees">
						<strong>Teilnehmer ({card.attendees.length}):</strong>
						<div class="attendees-list">
							{#each card.attendees as attendee}
								<span class="attendee">{attendee}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Sidebar for quick actions -->
{#if showSidebar}
	<div class="sidebar-overlay" on:click={closeSidebar} on:keydown={(e) => e.key === 'Escape' && closeSidebar()} role="button" tabindex="0" aria-label="Sidebar schließen">
		<div class="sidebar" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeSidebar()} role="dialog" aria-label="Karten-Aktionen" tabindex="0">
			<div class="sidebar-header">
				<h4>Karte bearbeiten</h4>
				<button class="close-button" on:click={closeSidebar} aria-label="Sidebar schließen">×</button>
			</div>
			<div class="sidebar-content">
				<button class="sidebar-action">Karte löschen</button>
				<button class="sidebar-action">Duplizieren</button>
				<button class="sidebar-action">Verschieben</button>
				<button class="sidebar-action">Farbe ändern</button>
			</div>
		</div>
	</div>
	
	<style>
		.card {
			height: auto;
			min-height: 4em;
			width: 100%;
			margin: 0.4em 0;
			padding: 0.75em;
			display: flex;
			flex-direction: column;
			background-color: #f8f9fa;
			border: 1px solid #dee2e6;
			border-radius: 8px;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
			transition: box-shadow 0.2s ease;
			cursor: pointer;
		}
	
		.card:hover {
			box-shadow: 0 2px 6px rgba(0,0,0,0.15);
		}
	
		.card:focus {
			outline: 2px solid #007bff;
			outline-offset: 2px;
		}
	
		.card.draft {
			border-left: 4px solid #ffc107;
		}
	
		.card.published {
			border-left: 4px solid #28a745;
		}
	
		.card.archived {
			border-left: 4px solid #6c757d;
			opacity: 0.7;
		}
	
	
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
	
		/* Sidebar Styles */
		.sidebar-overlay {
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0, 0, 0, 0.3);
			display: flex;
			justify-content: flex-end;
			z-index: 999;
		}
	
		.sidebar {
			width: 300px;
			height: 100%;
			background: white;
			box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
			overflow-y: auto;
		}
	
		.sidebar-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 1em 1.5em;
			border-bottom: 1px solid #e9ecef;
		}
	
		.sidebar-header h4 {
			margin: 0;
			color: #212529;
		}
	
		.sidebar-content {
			padding: 1em;
		}
	
		.sidebar-action {
			display: block;
			width: 100%;
			padding: 0.75em;
			margin-bottom: 0.5em;
			background: none;
			border: 1px solid #ced4da;
			border-radius: 4px;
			cursor: pointer;
			text-align: left;
			transition: all 0.2s ease;
		}
	
		.sidebar-action:hover {
			background-color: #f8f9fa;
			border-color: #adb5bd;
		}
	
		.sidebar-action:focus {
			outline: 2px solid #007bff;
			outline-offset: 2px;
		}
	</style>
{/if}
