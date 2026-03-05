<script lang="ts">
	import { boardStore, type CardItem } from "$lib/stores/kanbanStore.svelte.js";
	import * as Card from "../../lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CardDetailsDialog from "./CardDetailsDialog.svelte";
	import CardSidebar from "./CardSidebar.svelte";
	import MarkdownRenderer from '$lib/components/ui/markdown-renderer/MarkdownRenderer.svelte';
	import MessageSquareIcon from "@lucide/svelte/icons/message-square";
	import LinkIcon from "@lucide/svelte/icons/link";

	let {
		card,
		onCardAction,
		onSidebarAction,
		readOnly = false
	}: {
		card: CardItem;
		onCardAction?: (cardId: string, action: string) => void;
		onSidebarAction?: (cardId: string, action: string) => void;
		readOnly?: boolean;
	} = $props();

	let showModal = $state(false);
	let showSidebar = $state(false);
	let showPopover = $state(false);
	
	// Global popover state management - ensures only one popover is open at a time
	let currentOpenPopover = $state<string | null>(null);
	const popoverId = `popover-${card.id}`;
	
	// 🆕 VERHALT: CardDetailsDialog bleibt IMMER selected solange offen
	// Der Dialog wird von Card.svelte gesteuert, nicht vom User-Click
	let isDialogOpen = $state(false);
	
	// Card local state (nicht die Prop direkt mutieren!)
	let localName = $state(card.name);
	let localColor = $state(card.color || 'slate');
	let localImage = $state(card.image || '');
	
	// Lokale Kommentare Anzahl State - wird von der $effect aktualisiert!
	let localComments = $state(card.comments || []);
	
	// Card editing state (lokale Kopie für Formulare)
	let editName = $state(card.name);
	let selectedColor = $state(card.color || 'slate');
	let newLabelInput = $state('');
	
	// Long-press für Mobile (AI-Kontext hinzufügen)
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPress = $state(false);
	const LONG_PRESS_DURATION = 500; // 500ms
	
	function addToAIContext() {
		// Column-Name aus dem Store holen
		const columnId = card.columnId;
		const columns = boardStore.uiData;
		const column = columns.find(c => c.id === columnId);
		const columnName = column?.name || 'Unbekannt';
		
		// Dispatch CustomEvent um Karte zum AI-Kontext hinzuzufügen
		const event = new CustomEvent('addCardToAIContext', {
			detail: {
				cardId: card.id,
				cardName: localName,
				columnId: columnId,
				columnName: columnName
			},
			bubbles: true,
			composed: true
		});
		window.dispatchEvent(event);
	}
	
	function handleTouchStart(e: TouchEvent) {
		longPressTimer = setTimeout(() => {
			isLongPress = true;
			addToAIContext();
			// Haptic feedback (falls unterstützt)
			if (navigator.vibrate) navigator.vibrate(50);
		}, LONG_PRESS_DURATION);
	}
	
	function handleTouchEnd() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		// Reset nach kurzem Delay
		setTimeout(() => { isLongPress = false; }, 100);
	}
	
	function handleTouchMove() {
		// Bei Bewegung Long-Press abbrechen
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}
	let localLabels = $state(card.labels || []);
	
	// ✅ FIX: Lokale State für author-bezogene Felder (reaktiv!)
	let localAuthor = $state(card.author);
	let localAuthorName = $state(card.authorName);
	let localAttendees = $state(card.attendees || []);

	// 🔧 FIX: AvatarStack erwartet PUBKEYS, nicht Display-Namen!
	// Ensure minimum 1 attendee (author pubkey should always be included)
	const attendees = $derived(localAttendees && localAttendees.length > 0
		? localAttendees
		: (localAuthor ? [localAuthor] : []));

	// 🆕 Teaser-Logik: Text vor '+++' als Vorschau, sonst vollständiger Text
	const descriptionTeaser = $derived.by(() => {
		const desc = card.description;
		if (!desc) return '';
		
		// Einfache Suche nach +++ (egal wo)
		const separatorIndex = desc.indexOf('+++');
		if (separatorIndex > 0) {
			return desc.substring(0, separatorIndex).trim();
		}
		
		// +++ am Anfang = kein Teaser
		if (separatorIndex === 0) {
			return '';
		}
		
		// Kein Trennzeichen gefunden - vollständigen Text
		return desc;
	});

	// the nostr pubkey of the author of the card
	// Converting to array provides more consistency and reusability for UI components
	let authors = $derived(localAuthor ? [localAuthor] : []);

	// ============================================================================
	// POPOVER MANAGEMENT: Ensure only one popover is open at a time
	// ============================================================================
	function handlePopoverOpenChange(open: boolean) {
		if (open) {
			// Close any other open popover
			const event = new CustomEvent('closeOtherPopovers', {
				detail: { popoverId },
				bubbles: true,
				composed: true
			});
			window.dispatchEvent(event);
			showPopover = true;
		} else {
			showPopover = false;
		}
	}
	
	// Listen for close events from other popovers
	$effect(() => {
		const handleClose = (event: Event) => {
			const customEvent = event as CustomEvent<{ popoverId: string }>;
			if (customEvent.detail.popoverId !== popoverId && showPopover) {
				showPopover = false;
			}
		};
		
		window.addEventListener('closeOtherPopovers', handleClose);
		
		return () => {
			window.removeEventListener('closeOtherPopovers', handleClose);
		};
	});
	
	// ============================================================================
	// EXTERNAL DIALOG OPEN TRIGGER: Listen for 'openCardDialog' events
	// ============================================================================
	$effect(() => {
		const handleOpenDialog = (event: Event) => {
			const customEvent = event as CustomEvent<{ cardId: string }>;
			if (customEvent.detail.cardId === String(card.id)) {
				isDialogOpen = true;
			}
		};
		
		window.addEventListener('openCardDialog', handleOpenDialog);
		
		return () => {
			window.removeEventListener('openCardDialog', handleOpenDialog);
		};
	});

	// ============================================================================
	// KEYBOARD NAVIGATION: Global listener for Enter/Space on focused card
	// Workaround for dndzone blocking keyboard events
	// ============================================================================
	$effect(() => {
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			// Check if this card is currently focused
			const activeElement = document.activeElement;
			if (!activeElement) return;
			
			const cardElement = activeElement.closest(`[data-card-id="${card.id}"]`);
			if (!cardElement) return;
			
			// Check if we're in an input/textarea
			const target = event.target as HTMLElement;
			const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
			if (isInput) return;
			
			// Open dialog on Enter or Space
			if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
				event.preventDefault();
				event.stopPropagation();
				console.log('⌨️  Opening card dialog via global keyboard listener:', card.id);
				isDialogOpen = true;
				return;
			}
			
			// Arrow key navigation for moving cards
			if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
				event.preventDefault();
				event.stopPropagation();
				
				// Get all columns and find current card position
				const columns = boardStore.uiData;
				let currentColumnIndex = -1;
				let currentCardIndex = -1;
				let currentColumn = null;
				
				for (let i = 0; i < columns.length; i++) {
					const col = columns[i];
					const cardIndex = col.items.findIndex(item => String(item.id) === String(card.id));
					if (cardIndex !== -1) {
						currentColumnIndex = i;
						currentCardIndex = cardIndex;
						currentColumn = col;
						break;
					}
				}
				
				if (currentColumnIndex === -1 || !currentColumn) return;
				
				// Helper function to restore focus with multiple attempts
				const restoreFocus = (cardId: string, maxAttempts = 10) => {
					let attempts = 0;
					const tryFocus = () => {
						const movedCard = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement;
						if (movedCard && movedCard !== document.activeElement) {
							movedCard.focus();
							console.log(`⌨️  Card refocused (attempt ${attempts + 1})`);
						} else if (!movedCard && attempts < maxAttempts) {
							attempts++;
							requestAnimationFrame(tryFocus);
						}
					};
					requestAnimationFrame(() => requestAnimationFrame(tryFocus));
				};
				
				// Handle Up/Down - move within same column
				if (event.key === 'ArrowUp' && currentCardIndex > 0) {
					// Move card up (swap with previous card)
					const newItems = [...currentColumn.items];
					[newItems[currentCardIndex - 1], newItems[currentCardIndex]] = 
						[newItems[currentCardIndex], newItems[currentCardIndex - 1]];
					
					const updatedColumn = { ...currentColumn, items: newItems };
					const newColumns = [...columns];
					newColumns[currentColumnIndex] = updatedColumn;
					
					boardStore.syncBoardState(newColumns);
					console.log('⌨️  Card moved up');
					restoreFocus(String(card.id));
				} 
				else if (event.key === 'ArrowDown' && currentCardIndex < currentColumn.items.length - 1) {
					// Move card down (swap with next card)
					const newItems = [...currentColumn.items];
					[newItems[currentCardIndex], newItems[currentCardIndex + 1]] = 
						[newItems[currentCardIndex + 1], newItems[currentCardIndex]];
					
					const updatedColumn = { ...currentColumn, items: newItems };
					const newColumns = [...columns];
					newColumns[currentColumnIndex] = updatedColumn;
					
					boardStore.syncBoardState(newColumns);
					console.log('⌨️  Card moved down');
					restoreFocus(String(card.id));
				}
				// Handle Left - move to previous column
				else if (event.key === 'ArrowLeft' && currentColumnIndex > 0) {
					const targetColumn = columns[currentColumnIndex - 1];
					boardStore.moveCard(String(card.id), currentColumn.id, targetColumn.id);
					console.log('⌨️  Card moved to previous column');
					restoreFocus(String(card.id));
				}
				// Handle Right - move to next column
				else if (event.key === 'ArrowRight' && currentColumnIndex < columns.length - 1) {
					const targetColumn = columns[currentColumnIndex + 1];
					boardStore.moveCard(String(card.id), currentColumn.id, targetColumn.id);
					console.log('⌨️  Card moved to next column');
					restoreFocus(String(card.id));
				}
			}
		};
		
		window.addEventListener('keydown', handleGlobalKeyDown, true); // Use capture phase
		
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown, true);
		};
	});

	// ============================================================================
	// PROP-UPDATE-GUIDE.md Schritt 3: $effect für UI-Synchronisation
	// ============================================================================
	$effect(() => {
		const uiColumns = boardStore.uiData; // ← Dependency tracking
		// Silent sync - no log spam
		
		// Finde die aktuelle Karte im Store
		for (const col of uiColumns) {
			const updatedCard = col.items.find(c => String(c.id) === String(card.id));
			if (updatedCard) {
				// Silent sync - card found
				// Aktualisiere LOKALE State-Variablen (nicht die Prop!)
				// Das verhindert ownership_invalid_mutation Warnungen
				
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
					// Silent sync
					localImage = updatedCard.image || '';
				}
				
				// Aktualisiere auch die Anzahl der Kommentare
				// Vergleiche die Länge oder das JSON, um zu erkennen ob sich etwas geändert hat
				const commentsJSON = JSON.stringify(updatedCard.comments || []);
				const localCommentsJSON = JSON.stringify(localComments);
				
				if (commentsJSON !== localCommentsJSON) {
					// Silent sync
					localComments = updatedCard.comments || [];
				}
				
				// ✅ FIX: Aktualisiere author-bezogene Felder für sofortige Reaktivität
				if (updatedCard.author !== localAuthor) {
					// Silent sync
					localAuthor = updatedCard.author;
				}
				
				if (updatedCard.authorName !== localAuthorName) {
					// Silent sync
					localAuthorName = updatedCard.authorName;
				}
				
				// Aktualisiere attendees (wenn vorhanden)
				const attendeesJSON = JSON.stringify(updatedCard.attendees || []);
				const localAttendeesJSON = JSON.stringify(localAttendees);
				
				if (attendeesJSON !== localAttendeesJSON) {
					localAttendees = updatedCard.attendees || [];
				}				
				// Update labels
				const labelsJSON = JSON.stringify(updatedCard.labels || []);
				const localLabelsJSON = JSON.stringify(localLabels);
				
				if (labelsJSON !== localLabelsJSON) {
					localLabels = updatedCard.labels || [];
				}				
				// ✅ FIX: Aktualisiere links für sofortige Reaktivität
				const linksJSON = JSON.stringify(updatedCard.links || []);
				const cardLinksJSON = JSON.stringify(card.links || []);
				
				if (linksJSON !== cardLinksJSON) {
					// Triggere Prop-Update durch Reassignment
					card = { ...card, links: updatedCard.links };
				}
				
				break; // Karte gefunden, keine weitere Suche nötig
			}
		}
	});

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
			labels: updates.labels,
			links: updates.links // ← ✅ FIXED: links waren missing!
		});

		// WICHTIG: Triggere ein CardUpdated Event, damit Column.svelte die Items neuladen kann
		// Das ist notwendig, weil Column.svelte nur die items Prop hat und nicht direkt
		// auf die neuen Werte vom Board zugreifen kann
		onCardAction?.(String(cardId), 'cardUpdated');
		
		// Lokale Karte wird automatisch durch uiData Reaktivität aktualisiert
		closeModal();
	}

	function handleRenameChange() {
		// 🎯 DIREKT SPEICHERN beim Input ändern (real-time mit oninput)
		if (editName !== card.name) {
			boardStore.editCard(String(card.id), { heading: editName });
		}
	}

	function handleEditClick() {
		showModal = true;
		showPopover = false; // Close popover when opening edit dialog
	}

	function handleDeleteClick() {
		if (confirm(`Karte "${card.name}" wirklich löschen?`)) {
			boardStore.removeCard(String(card.id));
		}
	}
	
	function handleAddLabel() {
		const trimmedLabel = newLabelInput.trim();
		if (trimmedLabel && !localLabels.includes(trimmedLabel)) {
			const updatedLabels = [...localLabels, trimmedLabel];
			localLabels = updatedLabels;
			boardStore.editCard(String(card.id), { labels: updatedLabels });
			newLabelInput = '';
		}
	}
	
	function handleRemoveLabel(labelToRemove: string) {
		const updatedLabels = localLabels.filter(label => label !== labelToRemove);
		localLabels = updatedLabels;
		boardStore.editCard(String(card.id), { labels: updatedLabels });
	}
	
	function handleLabelKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleAddLabel();
		}
	}
	
	function getCardColor(colorName: string | undefined): string {
		return colorName ? `var(--color-${colorName})` : 'var(--muted)';
	}

</script>

<!-- Wichtig: Äußerer Container mit dndzone-kompatiblem Markup -->
<Card.Root
	class="card p-1 transition-all duration-200 cursor-pointer border border-border shadow-[3px_3px_5px_rgba(0,0,0,0.12)] hover:shadow-[3px_3px_7px_rgba(0,0,0,0.24)] {isLongPress ? 'ring-2 ring-primary scale-[1.02]' : ''}"
	data-card-id={card.id}
	data-card-root
	style="border-bottom: 5px solid {getCardColor(localColor)};"
	tabindex={0}
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	ontouchmove={handleTouchMove}
	ontouchcancel={handleTouchEnd}
	onclick={(e) => {
		// CTRL+Klick (oder CMD auf Mac) fügt zum AI-Kontext hinzu
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			e.stopPropagation();
			addToAIContext();
			return;
		}
		
		// Long-Press wurde bereits behandelt
		if (isLongPress) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		
		// Nur bei interaktiven Elementen blockieren (Button, Input, Links, etc.)
		const target = e.target as HTMLElement;
		const isInteractive = target.closest('button, input, [role="button"], a, [role="link"], .popover-trigger');
		if (isInteractive) {
			return;
		}
		e.stopPropagation();
		// Klick auf Card öffnet direkt CardDetailsDialog
		isDialogOpen = true;
	}}
	onkeydown={(e) => {
		// Open card dialog with Enter or Space key
		if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
			// Check if we're not in an input/textarea
			const target = e.target as HTMLElement;
			const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
			if (isInput) {
				return;
			}
			
			e.preventDefault();
			e.stopPropagation();
			console.log('⌨️  Opening card dialog via keyboard');
			isDialogOpen = true;
		}
	}}
>
	<Card.Header class="px-1 py-1">
		<div class="card-header-content gap-0">
			<div class="flex flex-col gap-0 flex-1">
				<!-- Card Title mit Comment Badge -->
				<div class="flex items-center justify-between border-b pb-2">
					<Card.Title class="text-sm flex-1">{localName}</Card.Title>
					
					
				</div>
				
				{#if localLabels && localLabels.length > 0 || localComments.length > 0}
					<div class="flex items-center justify-between gap-2 mt-2 mb-0">
						<div class="flex flex-wrap gap-1 flex-1 min-w-0">
							{#each localLabels.slice(0, 2) as label}
								<Badge variant="secondary" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
									{label}
								</Badge>
							{/each}
							{#if localLabels.length > 2}
								<Badge variant="outline" class="text-xs px-1.5 py-0.5">
									+{localLabels.length - 2}
								</Badge>
							{/if}
						</div>
						
						<!-- 🚀 NEW: Comment Count Badge -->
						{#if localComments.length > 0}
							<Badge 
								variant="secondary" 
								class="gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 flex-shrink-0"
							>
								<MessageSquareIcon class="h-3 w-3" />
								{localComments.length}
							</Badge>
						{/if}
					</div>
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
					
				/>
			</div>
		{/if}

		<!-- Description Section (Markdown Content) -->
		{#if card.description}
			<div class="card-description" class:line-clamp-3={descriptionTeaser === card.description}>
				<MarkdownRenderer content={descriptionTeaser} class="prose-sm prose-card" />
			</div>
		{/if}

		<!-- Links Section -->
		{#if card.links && card.links.length > 0}
			<div class="space-y-2 mt-2">
				{#each card.links as link}
					<Button 
						variant="link" 
						size="sm"
						tabindex={-1}
						onclick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							window.open(link.url, '_blank', 'noopener,noreferrer');
						}}
						class="w-full justify-start gap-2 text-xs btn-transparent hover:bg-accent/20"
					>
						<LinkIcon class="h-3 w-3 flex-shrink-0" />
						<span class="truncate">{link.title}</span>
					</Button>
				{/each}
			</div>
		{:else if card.link}
			<!-- Fallback für altes Format (nur card.link) -->
			<Button variant="outline" tabindex={-1} onclick={handleLinkClick}>
				<LinkIcon class="mr-2 h-4 w-4" /> Link öffnen
			</Button>
		{/if}
	</Card.Content>

	<CardDetailsDialog
		cardId={card.id}
		bind:open={isDialogOpen}
		{readOnly}
		onEditMode={readOnly ? undefined : () => {
			isDialogOpen = false;
			showModal = true;
		}}
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

	.card-image-container {
		width: 100%;
		overflow: hidden;
		border-radius: 6px;
	}

	.card-image {
		width: 100%;
		height: 120px;
		object-fit: cover;
			cursor: pointer;
		}

		.card-image:hover {
			transform: scale(1.02);
			box-shadow: 3px 6px 12px rgba(0,0,0,0.22);
		}

		.card-image:focus {
			outline: 2px solid var(--accent);
		}

		.card-description {
			font-size: 0.9em;
			color: var(--foreground);
			line-height: 1.4;
			flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	/* Line-clamp nur wenn KEIN Teaser gefunden wurde (Fallback) */
	.card-description.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}
	
</style>