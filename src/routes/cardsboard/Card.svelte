<script lang="ts">
	import { boardStore, type CardItem } from "$lib/stores/kanbanStore.svelte.js";
	import type { PublishState } from "$lib/classes/BoardModel.js";
	import * as Card from "../../lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CardDialog from "./CardDialog.svelte";
	import CardViewDialog from "./CardViewDialog.svelte";
	import CardSidebar from "./CardSidebar.svelte";
	import AvatarStack from "./AvatarStack.svelte";
	import ColorSelector from "./ColorSelector.svelte";
	import PublishStateToggle from "./PublishStateToggle.svelte";
	import EditIcon from '@lucide/svelte/icons/edit';
	import FullscreenIcon from "@lucide/svelte/icons/fullscreen";
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import UserIcon from "@lucide/svelte/icons/user";
	import LinkIcon from "@lucide/svelte/icons/link";
	import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
	import { authStore } from "$lib/index.js";
    import TrashIcon from "@lucide/svelte/icons/trash";

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
	
	// 🔥 WICHTIG: showPublishToggle hängt vom Board-publishState ab!
	let boardPublishState = $derived(boardStore.data?.publishState || 'draft');
	let showPublishToggle = $derived(boardPublishState === 'published');
	let showMenu = $state(true);
	
	// 🆕 VERHALT: CardViewDialog bleibt IMMER selected solange offen
	// Der Dialog wird von Card.svelte gesteuert, nicht vom User-Click
	let isDialogOpen = $state(false);
	
	// Card local state (nicht die Prop direkt mutieren!)
	let localName = $state(card.name);
	let localColor = $state(card.color || 'slate');
	let localImage = $state(card.image || '');
	let localPublishState = $state(card.publishState);
	
	// Lokale Kommentare Anzahl State - wird von der $effect aktualisiert!
	let localComments = $state(card.comments || []);
	
	// Card editing state (lokale Kopie für Formulare)
	let editName = $state(card.name);
	let selectedColor = $state(card.color || 'slate');
	
	// ✅ FIX: Lokale State für author-bezogene Felder (reaktiv!)
	let localAuthor = $state(card.author);
	let localAuthorName = $state(card.authorName);
	let localAttendees = $state(card.attendees || []);

	// 🔧 FIX: AvatarStack erwartet PUBKEYS, nicht Display-Namen!
	// Ensure minimum 1 attendee (author pubkey should always be included)
	const attendees = $derived(localAttendees && localAttendees.length > 0
		? localAttendees
		: (localAuthor ? [localAuthor] : []));

	// the nostr pubkey of the author of the card
	// Converting to array provides more consistency and reusability for UI components
	let authors = $derived(localAuthor ? [localAuthor] : []);

	// ============================================================================
	// PROP-UPDATE-GUIDE.md Schritt 3: $effect für UI-Synchronisation
	// ============================================================================
	$effect(() => {
		const uiColumns = boardStore.uiData; // ← Dependency tracking
		console.log('🔍 Card.svelte $effect triggered for card:', card.id, 'found in', uiColumns.length, 'columns');
		
		// Finde die aktuelle Karte im Store
		for (const col of uiColumns) {
			const updatedCard = col.items.find(c => String(c.id) === String(card.id));
			if (updatedCard) {
				console.log('  ✓ Card found in column:', col.id);
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
				
				if (updatedCard.image !== localImage) {
					console.log('🔄 Card image updated:', updatedCard.image);
					localImage = updatedCard.image || '';
				}
				
				// Aktualisiere auch die Anzahl der Kommentare
				// Vergleiche die Länge oder das JSON, um zu erkennen ob sich etwas geändert hat
				const commentsJSON = JSON.stringify(updatedCard.comments || []);
				const localCommentsJSON = JSON.stringify(localComments);
				
				if (commentsJSON !== localCommentsJSON) {
					console.log('🔄 Card comments updated:', (updatedCard.comments || []).length, 'comments');
					localComments = updatedCard.comments || [];
				}
				
				// ✅ FIX: Aktualisiere author-bezogene Felder für sofortige Reaktivität
				if (updatedCard.author !== localAuthor) {
					console.log('🔄 Card author updated:', updatedCard.author);
					localAuthor = updatedCard.author;
				}
				
				if (updatedCard.authorName !== localAuthorName) {
					console.log('🔄 Card authorName updated:', updatedCard.authorName);
					localAuthorName = updatedCard.authorName;
				}
				
				// Aktualisiere attendees (wenn vorhanden)
				const attendeesJSON = JSON.stringify(updatedCard.attendees || []);
				const localAttendeesJSON = JSON.stringify(localAttendees);
				
				if (attendeesJSON !== localAttendeesJSON) {
					console.log('🔄 Card attendees updated:', (updatedCard.attendees || []).length, 'attendees');
					localAttendees = updatedCard.attendees || [];
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
			heading: updates.heading,
			content: updates.content,
			image: updates.image,
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

	function handleRenameChange() {
		// 🎯 DIREKT SPEICHERN beim Input ändern (onchange/onblur)
		if (editName !== card.name) {
			console.log('📝 Card name changed:', { old: card.name, new: editName });
			boardStore.editCard(String(card.id), { heading: editName });
		}
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
		return colorName ? `var(--color-${colorName})` : 'var(--muted)';
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
	<Card.Header class="px-1 py-1">
		<div class="card-header-content gap-0">
			<div class="flex flex-col gap-0 flex-1">
				<Card.Title class="text-sm border-b pb-2">{card.name}</Card.Title>
				
				{#if card.labels && card.labels.length > 0}
					<div class="flex flex-wrap gap-1 mt-2 mb-0">
						{#each card.labels.slice(0, 2) as label}
							<Badge variant="secondary" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
								{label}
							</Badge>
						{/each}
						{#if card.labels.length > 2}
							<Badge variant="outline" class="text-xs px-1.5 py-0.5">
								+{card.labels.length - 2}
							</Badge>
						{/if}
					</div>
				{/if}
			</div>
			
			<div class="header-actions">
				{#if showPublishToggle}
					<PublishStateToggle value={localPublishState || 'draft'} onToggle={handlePublishToggle} />
				{/if}

				{#if showMenu}
					<Popover.Root>
						<Popover.Trigger
								class="popover-trigger w-6 h-6 pl-1 bg-secondary btn text-center hover:bg-accent group btn"
								onclick={(e) => {
									e.stopPropagation();
								}}
								type="button"
								aria-label="Karten-Aktionen"
							>
								<EllipsisVerticalIcon/>
							</Popover.Trigger>
						<Popover.Content align="end" class="w-64" onclick={(e) => {
							e.stopPropagation();
						}}>
							<div class="space-y-4">
								{#if card.author && card.authorName}
									<div class="space-y-2">
										<h4 class="font-medium text-sm">Erstellt von</h4>
										<div class="flex items-center gap-2 p-2 bg-muted rounded">
											<UserIcon class="h-4 w-4 text-muted-foreground" />
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">{card.authorName}</p>
												<code class="text-xs text-muted-foreground">{card.author.slice(0, 8)}…</code>
											</div>
										</div>
									</div>
									<Separator />
								{/if}
								
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Karte umbenennen</h4>
									<Input 
										bind:value={editName} 
										placeholder="Kartenname"
										onchange={handleRenameChange}
										onblur={handleRenameChange}
									/>
								</div>
								
								<Separator />
								
								<ColorSelector selectedColor={selectedColor} onColorChange={(colorValue) => {
									selectedColor = colorValue;
									boardStore.editCard(String(card.id), { color: colorValue });
								}} />
								
								<Separator />
								
								{#if authStore.isAuthenticated }
								<Button variant="outline" size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(); }} class="w-full">
									Karte bearbeiten
								</Button>

								<Button variant="destructive" size="sm" onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(); }} class="w-full btn">
									<TrashIcon class="h-4 w-4" />
									Karte löschen
								</Button>
								{/if}
							</div>
						</Popover.Content>
					</Popover.Root>
				{/if}
			</div>
		</div>
	</Card.Header>

	<Card.Content class="px-1 py-1">
		<!-- Image Section -->
		{#if localImage}
			<div class="card-image-container mb-2">
				<img
					src={localImage}
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
			<Button variant="outline" onclick={handleLinkClick}><LinkIcon class="mr-2 h-4 w-4" /> Link öffnen</Button>
		{/if}
	</Card.Content>

	<Card.Footer class="border-t border-border [.border-t]:pt-0 px-0">
		<div class="footer-content">
			<!-- Links anorden -->
			<div class="flex items-center gap-2 scale-80">
				<div class="comments-count">
					<Button
						variant="default"
						size="sm"
						class="btn"
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); isDialogOpen = true; }}
						aria-label="Anzeigen"
						title="Anzeigen"
					>
						<MessageSquareIcon class="mr-2 h-4 w-4" /> {#if localComments.length > 0}{localComments.length}{/if}
					</Button>
				</div>
				{#if attendees.length > 0}
					<AvatarStack {attendees} maxVisible={3} />
				{/if}
			</div>
			
			<!-- Rechts anorden -->
			<div class="flex gap-2 scale-80">
				<Button
					variant="default"
					size="icon"
					class="btn"
					onclick={(e) => { e.preventDefault(); e.stopPropagation(); isDialogOpen = true; }}
					aria-label="Anzeigen"
					title="Anzeigen"
				>
					<FullscreenIcon />
				</Button>
				{#if authStore.isAuthenticated }
				<Button
					variant="default"
					size="sm"
					class="btn"
					onclick={(e) => { e.preventDefault(); e.stopPropagation(); showModal = true; }}
					aria-label="Bearbeiten"
					title="Bearbeiten"
				>
					<EditIcon class="mr-2 h-4 w-4" />
					Bearbeiten
				</Button>
				{/if}
			</div>
		</div>
	</Card.Footer>
	<!-- Card View Dialog (Read-Only View with Tabs) -->
	<!-- CardViewDialog mit bind:open für automatisches Selection -->
	<CardViewDialog
		cardId={card.id}
		bind:open={isDialogOpen}
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
		
		.card-image-container {
			width: 100%;
			display: flex;
			justify-content: center;
		}

		.card-image {
			max-width: 100%;
			max-height: 80px;
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
			display: -webkit-box;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		
		/* Footer styling */
		.footer-content {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1em;
			flex-grow: 1;

		}
		
		.comments-count {
			font-size: 0.8em;
			color: var(--muted-foreground);
			display: flex;
			align-items: center;
			gap: 0.25em;
		}

		
	
	</style>