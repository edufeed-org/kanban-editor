<script lang="ts">
	import { boardStore, type CardItem } from "$lib/stores/kanbanStore.svelte.js";
	import type { PublishState } from "$lib/classes/BoardModel.js";
	import * as Card from "../../lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import CardDialog from "./CardDialog.svelte";
	import CardViewDialog from "./CardViewDialog.svelte";
	import CardSidebar from "./CardSidebar.svelte";
	import PencilLineIcon from "@lucide/svelte/icons/pencil";
	import FullscreenIcon from "@lucide/svelte/icons/fullscreen";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import TrashIcon from "@lucide/svelte/icons/trash";
	import UsersIcon from "@lucide/svelte/icons/users";
	import LinkIcon from "@lucide/svelte/icons/link";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";


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
	let showViewModal = $state(false);
	let showSidebar = $state(false);
	
	// 🔥 WICHTIG: showPublishToggle hängt vom Board-publishState ab!
	let boardPublishState = $derived(boardStore.data?.publishState || 'draft');
	let showPublishToggle = $derived(boardPublishState === 'published');
	let showMenu = $state(true);
	
	// Card local state (nicht die Prop direkt mutieren!)
	let localName = $state(card.name);
	let localColor = $state(card.color || 'slate');
	let localPublishState = $state(card.publishState);
	
	// Card editing state (lokale Kopie für Formulare)
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

	// ============================================================================
	// PROP-UPDATE-GUIDE.md Schritt 3: $effect für UI-Synchronisation
	// ============================================================================
	$effect(() => {
		const uiColumns = boardStore.uiData; // ← Dependency tracking
		
		// Finde die aktuelle Karte im Store
		for (const col of uiColumns) {
			const updatedCard = col.items.find(c => String(c.id) === String(card.id));
			if (updatedCard) {
				// Aktualisiere LOKALE State-Variablen (nicht die Prop!)
				// Das verhindert ownership_invalid_mutation Warnungen
				if (updatedCard.publishState !== localPublishState) {
					console.log('🔄 Card publishState updated:', updatedCard.publishState);
					localPublishState = updatedCard.publishState;
				}
				
				// Aktualisiere auch andere lokale Props die sich ändern können
				if (updatedCard.name !== localName) {
					localName = updatedCard.name;
					editName = updatedCard.name;
				}
				
				if (updatedCard.color !== localColor) {
					localColor = updatedCard.color || 'slate';
					selectedColor = updatedCard.color || 'slate';
				}
				
				break; // Karte gefunden, keine weitere Suche nötig
			}
		}
	});

	function handlePublishToggle() {
		const newState = localPublishState === 'draft' ? 'published' : 'draft';
		
		// ✅ WICHTIG: Speichere im BoardStore (PROP-UPDATE-GUIDE.md Schritt 1-2)
		boardStore.setCardPublishState(String(card.id), newState);
		
		// Callback für zusätzliche UI-Logik (optional)
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
			showModal = true;
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

	// function handleKeyDown(event: KeyboardEvent) {
	// 	if (event.key === 'Enter' || event.key === ' ') {
	// 		event.preventDefault();
	// 		handleDoubleClick();
	// 	}
	// }

	function handleSidebarAction(action: string) {
		onSidebarAction?.(String(card.id), action);
		closeSidebar();
	}

	function handleEditSave(cardId: string, updates: any) {
		// Speichere die Änderungen im BoardStore
		boardStore.editCard(cardId, {
			name: updates.heading,
			description: updates.content,
			color: updates.color,
			labels: updates.labels
		});

		// WICHTIG: Triggere ein CardUpdated Event, damit Column.svelte die Items neuladen kann
		// Das ist notwendig, weil Column.svelte nur die items Prop hat und nicht direkt
		// auf die neuen Werte vom Board zugreifen kann
		onCardAction?.(String(cardId), 'cardUpdated');
		
		// Lokale Karte wird automatisch durch uiData Reaktivität aktualisiert
		closeModal();
	}

	function handleRename() {
		boardStore.editCard(String(card.id), { name: editName });
	}

	function handleColorChange() {
		boardStore.editCard(String(card.id), { color: selectedColor });
	}

	function handleEditClick() {
		showModal = true;
	}

	function handleDeleteClick() {
		if (confirm(`Karte "${card.name}" wirklich löschen?`)) {
			boardStore.removeCard(String(card.id));
		}
	}
	function getCardColor(colorName: string | undefined): string {
		return colorName ? `var(--${colorName})` : 'var(--muted)';
	}

</script>

<!-- Wichtig: Äußerer Container mit dndzone-kompatiblem Markup -->
<Card.Root
	class="card p-1 transition-all duration-200 {isSelected ? 'border-2 border-primary shadow-lg scale-105' : 'border border-border hover:shadow-md'}"
	data-card-id={card.id}
	data-card-root
	style="border-bottom: 6px solid {getCardColor(localColor)};"
	role="button"
	tabindex={0}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onSelect?.();
		}
	}}
	onclick={(e) => {
		// Nur bei interaktiven Elementen blockieren (Button, Links, etc.)
		// ABER NICHT auf der Root selbst!
		const target = e.target as HTMLElement;
		const isInteractive = target.closest('button:not([data-card-root]), [role="button"]:not([data-card-root]), a, [role="link"]');
		if (isInteractive) {
			return;
		}
		e.stopPropagation();
		console.log('🖱️ Card.Root onclick - calling onSelect');
		onSelect?.();
	}}
>
	<Card.Header class="px-1">
		<div class="card-header-content">
			<Card.Title>{card.name}</Card.Title>
			<div class="header-actions">
				{#if card.author}
					<div class="author-info" title={card.author}>
						<span class="author-label">von</span>
						<code class="author-npub">{card.author.slice(0, 8)}...</code>
					</div>
				{/if}
				{#if showPublishToggle}
					<button
						class="publish-toggle"
						class:draft={localPublishState === 'draft'}
						class:published={localPublishState === 'published'}
						class:archived={localPublishState === 'archived'}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handlePublishToggle();
						}}
						aria-label="Toggle publish state"
						title="Toggle publish state"
						type="button"
					>
						<span class="publish-indicator"></span>
					</button>
				{/if}

				{#if showMenu}
					<Popover.Root>
						<Popover.Trigger
								class="popover-trigger h-9 w-5 hover:bg-accent group"
								onclick={(e) => {
									e.stopPropagation();
								}}
								type="button"
								aria-label="Karten-Aktionen"
							>
								<EllipsisVerticalIcon class="h-4 w-4 pointer-events-none bg-transparent" />
							</Popover.Trigger>
						<Popover.Content align="end" class="w-64" onclick={(e) => {
							e.stopPropagation();
						}}>
							<div class="space-y-4">
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Karte umbenennen</h4>
									<Input bind:value={editName} placeholder="Kartenname" />
									<Button size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleRename(); }} class="w-full">
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
									<Button size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleColorChange(); }} class="w-full">
										Farbe ändern
									</Button>
								</div>
								
								<Separator />
								
								<Button variant="outline" size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(); }} class="w-full">
									Karte bearbeiten
								</Button>
								
								<Button variant="destructive" size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(); }} class="w-full">
									Karte löschen
								</Button>
							</div>
						</Popover.Content>
					</Popover.Root>
				{/if}
			</div>
		</div>
	</Card.Header>

	<Card.Content class="px-1">
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
			<Button variant="link" href="/dashboard" onclick={handleLinkClick}><LinkIcon /> Link öffnen</Button>
		{/if}
	</Card.Content>

	<Card.Footer class="px-1">
		<div class="footer-content">
			<div class="comments-count group">
				<MessageSquareIcon /> {#if (card.comments || []).length > 0}{(card.comments || []).length}{/if}
			</div>
			<div class="attendees-count group">
				<UsersIcon /> {#if attendees.length > 0}{attendees.length}{/if}
			</div>
			<button 
				class="view-button group" 
				onclick={(e) => { e.preventDefault(); e.stopPropagation(); showViewModal = true; }} 
				aria-label="Anzeigen" 
				title="Anzeigen"
				type="button"
			>
				<FullscreenIcon />
			</button>
			<button 
				class="edit-button dark:hover:text-white" 
				onclick={(e) => { e.preventDefault(); e.stopPropagation(); showModal = true; }} 
				aria-label="Bearbeiten" 
				title="Bearbeiten"
				type="button"
			>
				<PencilLineIcon class="h-4 w-4" />
			</button>
		</div>
	</Card.Footer>
	<!-- Card View Dialog (Read-Only View with Tabs) -->
	<CardViewDialog
		cardId={card.id}
		isOpen={showViewModal}
		onClose={() => (showViewModal = false)}
	/>
	
	<!-- Card Dialog (View & Edit with Tabs) -->
	<CardDialog
		card={{
			id: String(card.id),
			heading: card.name,
			content: card.description,
			color: localColor,
			comments: card.comments,
			labels: card.labels,
			attendees: card.attendees,
			publishState: localPublishState
		}}
		isOpen={showModal}
		onClose={closeModal}
		onSave={handleEditSave}
	/>
</Card.Root>
	
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

		/* Author info styling */
		.author-info {
			display: flex;
			align-items: center;
			gap: 0.35em;
			font-size: 0.7em;
			color: var(--muted-foreground);
			background-color: var(--muted);
			padding: 0.25em 0.4em;
			border-radius: 3px;
		}

		.author-label {
			font-weight: 500;
		}

		.author-npub {
			font-family: monospace;
			font-size: 0.85em;
			color: var(--foreground);
		}

		/* Status indicator styling */
		.publish-toggle {
			width: 16px;
			height: 16px;
			border-radius: 50%;
			border: 2px solid var(--muted-foreground);
			background: unset;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease;
			position: relative;
			opacity: 0.4;
		}

		.publish-toggle:hover {
			border-color: var(--chart-1);
			background-color: var(--chart-2);
			transform: scale(1.1);
			opacity: 1;
		}

		.publish-toggle.draft {
			opacity: 0.1;
		}

		.publish-toggle.published {
			border-color: var(--chart-1);
			background-color: var(--chart-2);
		}

		.publish-toggle.archived {
			border-color: var(--border);
			background-color: black;
			opacity: 1;
		}

		.publish-indicator {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			transition: background-color 0.2s ease;
		}

		.publish-toggle.draft .publish-indicator {
			background-color: var(--muted-foreground);
		}

		.publish-toggle.published .publish-indicator {
			background-color: var(--chart-2);
		}

		.publish-toggle.archived .publish-indicator {
			background-color: var(--color-fuchsia-950);
		}
		
		/* Card content styling */
		.card-labels {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25em;
			margin-bottom: 0.5em;
		}

		.label {
			background-color: var(--input);
			color: var(--foreground);
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
			outline: 2px solid var(--ring);
			outline-offset: 2px;
		}

		.card-description {
			font-size: 0.9em;
			color: var(--foreground);
			line-height: 1.4;
			flex: 1;
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
			color: var(--muted-foreground);
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
			color: var(--secondary-foreground);
		}

		.edit-button:focus {
			outline: 2px solid #007bff;
			outline-offset: 2px;
		}
		
		/* Ensure buttons and interactive elements can't interfere with drag */
		button {
			pointer-events: auto;
		}

	</style>
