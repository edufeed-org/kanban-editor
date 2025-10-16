<script lang="ts">
	import type { CardItem, PublishState } from "./types.js";
	import * as Card from "../../lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import CardEditModal from "../../lib/components/CardEditModal.svelte";
	import CardViewModal from "./CardViewModal.svelte";
	import CardSidebar from "./CardSidebar.svelte";

	let {
		card,
		isSelected = false,
		onSelect,
		onPublishStateChange,
		onCardAction,
		onSidebarAction
	}: {
		card: CardItem;
		isSelected?: boolean;
		onSelect?: () => void;
		onPublishStateChange?: (cardId: string, newState: PublishState) => void;
		onCardAction?: (cardId: string, action: string) => void;
		onSidebarAction?: (cardId: string, action: string) => void;
	} = $props();

	let showModal = $state(false);
	let showSidebar = $state(false);
	let showEditModal = $state(false);
	let showPublishToggle = $state(true);
	let showMenu = $state(true);
	let popoverOpen = $state(false);
	
	// Card editing state
	let editName = $state(card.name);
	let selectedColor = $state(card.color || 'slate');

	const colorOptions = [
		{ value: 'slate', label: 'Slate' },
		{ value: 'red', label: 'Rot' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'yellow', label: 'Gelb' },
		{ value: 'green', label: 'Grün' },
		{ value: 'blue', label: 'Blau' },
		{ value: 'purple', label: 'Lila' }
	];

	// Ensure minimum 1 attendee (author should always be included)
	const attendees = $derived(card.attendees && card.attendees.length > 0
		? card.attendees
		: (card.author ? [card.author] : []));

	function handleMenuClick() {
		popoverOpen = !popoverOpen;
	}

	function handleDoubleClick() {
		showModal = true;
	}

	function handlePublishToggle() {
		const newState = card.publishState === 'draft' ? 'published' : 'draft';
		card.publishState = newState;
		// Call callback prop instead of dispatching event
		onPublishStateChange?.(String(card.id), newState);
	}

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

	function handleButtonAction(event: CustomEvent) {
		const { action } = event.detail;

		if (action === 'edit') {
			openEditModal();
		} else {
			onCardAction?.(String(card.id), action);
		}
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

	function openEditModal() {
		showEditModal = true;
	}

	function closeEditModal() {
		showEditModal = false;
	}

	function handleEditSave(cardId: string, updates: any) {
		// Aktualisiere die lokale Karte
		if (updates.heading) card.name = updates.heading;
		if (updates.content) card.description = updates.content;
		if (updates.color) card.color = updates.color;
		if (updates.labels) card.labels = updates.labels;
		if (updates.publishState) card.publishState = updates.publishState;

		// Informiere die Elternkomponente über die Änderung
		onCardAction?.(cardId, 'updated');
		closeEditModal();
	}

	function handleRename() {
		card.name = editName;
		popoverOpen = false;
		onCardAction?.(String(card.id), 'renamed');
	}

	function handleColorChange() {
		card.color = selectedColor;
		popoverOpen = false;
		onCardAction?.(String(card.id), 'color-changed');
	}

	function handleEditClick() {
		showEditModal = true;
		popoverOpen = false;
	}

	function handleDeleteClick() {
		if (confirm(`Karte "${card.name}" wirklich löschen?`)) {
			onCardAction?.(String(card.id), 'delete');
		}
		popoverOpen = false;
	}
	function getCardColor(colorName: string | undefined): string {
		return colorName ? `var(--${colorName})` : 'var(--muted)';
	}

</script>

<Card.Root 
	class="card {isSelected ? 'border-2 border-primary' : ''}" 
	ondblclick={handleDoubleClick} 
	onclick={onSelect}
	style="border-left: 6px solid {getCardColor(card.color)};">
	<Card.Header>
		<div class="card-header-content">
			<Card.Title>{card.name}</Card.Title>
			<div class="header-actions">
				{#if showPublishToggle}
					<button
						class="publish-toggle"
						class:draft={card.publishState === 'draft'}
						class:published={card.publishState === 'published'}
						class:archived={card.publishState === 'archived'}
						onclick={handlePublishToggle}
						aria-label="Toggle publish state"
						title="Toggle publish state"
					>
						<span class="publish-indicator"></span>
					</button>
				{/if}

				{#if showMenu}
					<Popover.Root bind:open={popoverOpen}>
						<Popover.Trigger class="menu-trigger">
							<span class="menu-dots">⋮</span>
						</Popover.Trigger>
						<Popover.Content align="end" class="w-64">
							<div class="space-y-4">
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Karte umbenennen</h4>
									<Input bind:value={editName} placeholder="Kartenname" />
									<Button size="sm" onclick={handleRename} class="w-full">
										Umbenennen
									</Button>
								</div>
								
								<Separator />
								
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Farbe wählen</h4>
									<RadioGroup.Root bind:value={selectedColor}>
										{#each colorOptions as option}
											<div class="flex items-center space-x-2">
												<RadioGroup.Item value={option.value} id={`card-color-${option.value}-${card.id}`} />
												<Label for={`card-color-${option.value}-${card.id}`}>{option.label}</Label>
											</div>
										{/each}
									</RadioGroup.Root>
									<Button size="sm" onclick={handleColorChange} class="w-full">
										Farbe ändern
									</Button>
								</div>
								
								<Separator />
								
								<Button variant="outline" size="sm" onclick={handleEditClick} class="w-full">
									Karte bearbeiten
								</Button>
								
								<Button variant="destructive" size="sm" onclick={handleDeleteClick} class="w-full">
									Karte löschen
								</Button>
							</div>
						</Popover.Content>
					</Popover.Root>
				{/if}
			</div>
		</div>
	</Card.Header>

	<Card.Content>
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
					onclick={handleImageClick}
					role={card.link ? "button" : ""}
					onkeydown={(e) => e.key === 'Enter' && handleImageClick()}
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
				<button class="link-button" onclick={handleLinkClick}>
					<span class="link-icon">🔗</span>
					<span class="link-text">Link öffnen</span>
				</button>
			</div>
		{/if}
	</Card.Content>

	<Card.Footer>
		<div class="footer-content">
			
				<div class="comments-count">
					<span class="icon-[material-symbols--mode-comment-outline]"></span> {#if (card.comments || []).length > 0}{(card.comments || []).length}{/if}
				</div>
				<div class="attendees-count">
					<span class="icon-[material-symbols--group-outline]"></span> {#if attendees.length > 0}{attendees.length}{/if}
				</div>
			<button class="edit-button" onclick={() => openEditModal()} aria-label="Bearbeiten" title="Bearbeiten">
				<span class="icon-[material-symbols--edit-square-outline]"></span>
			</button>
		</div>
	</Card.Footer>

	<!-- Edit Modal -->
	<CardEditModal
		card={{
			id: String(card.id),
			heading: card.name,
			content: card.description,
			color: card.color,
			comments: card.comments,
			labels: card.labels,
			attendees: card.attendees,
			publishState: card.publishState
		}}
		isOpen={showEditModal}
		onClose={closeEditModal}
		onSave={handleEditSave}
	/>
</Card.Root>
	
	<!-- Card Modal for editing/viewing details -->
	<CardViewModal
		{card}
		isOpen={showModal}
		onClose={closeModal}
	/>
	
	<!-- Sidebar for quick actions -->
	<CardSidebar
		isOpen={showSidebar}
		onClose={closeSidebar}
		onAction={handleSidebarAction}
	/>


	
	<style>
		/* Layout styling for card header */
		.card-header-content {
			display: flex;
			justify-content: space-between;
			align-items: flex-start;
			width: 100%;
		}

		.header-actions {
			display: flex;
			align-items: center;
			gap: 0.5em;
			flex-shrink: 0;
		}

		/* Status indicator styling */
		.publish-toggle {
			width: 16px;
			height: 16px;
			border-radius: 50%;
			border: 2px solid #dee2e6;
			background: white;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease;
			position: relative;
		}

		.publish-toggle:hover {
			border-color: #ced4da;
			transform: scale(1.1);
		}

		.publish-toggle.draft {
			border-color: #ffc107;
			background-color: #fff3cd;
		}

		.publish-toggle.published {
			border-color: #28a745;
			background-color: #d4edda;
		}

		.publish-toggle.archived {
			border-color: #6c757d;
			background-color: #f8f9fa;
		}

		.publish-indicator {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			transition: background-color 0.2s ease;
		}

		.publish-toggle.draft .publish-indicator {
			background-color: #ffc107;
		}

		.publish-toggle.published .publish-indicator {
			background-color: #28a745;
		}

		.publish-toggle.archived .publish-indicator {
			background-color: #6c757d;
		}

		/* Menu button styling */
		.menu-trigger {
			background: none;
			border: none;
			cursor: pointer;
			padding: 0.25em;
			border-radius: 4px;
			transition: background-color 0.2s ease;
			display: flex;
			align-items: center;
			justify-content: center;
		}

		.menu-trigger:hover {
			background-color: #e9ecef;
		}

		.menu-trigger:focus {
			outline: 2px solid #007bff;
			outline-offset: 2px;
		}

		.menu-dots {
			font-size: 1.2em;
			color: #6c757d;
			line-height: 1;
		}

		/* Card content styling */
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

		/* Footer styling */
		.footer-content {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1em;
			flex-grow: 1;
		}

		.comments-count, .attendees-count {
			font-size: 0.8em;
			color: #6c757d;
			display: flex;
			align-items: center;
			gap: 0.25em;
		}

		.edit-button {
			background-color: var(--secondary);
			color: var(--secondary-foreground);
			border: none;
			padding: 0.5em 1em;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.85em;
			transition: background-color 0.2s ease;
			display: flex;
			align-items: center;
			gap: 0.5em;
		}

		
		.edit-button:hover {
			background-color: var(--primary);
			color: var(--secondary);
		}

		.edit-button:focus {
			outline: 2px solid #007bff;
			outline-offset: 2px;
		}

	</style>
