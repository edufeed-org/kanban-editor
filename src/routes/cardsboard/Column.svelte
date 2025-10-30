<script lang="ts">
	import { flip } from 'svelte/animate';
    import { dndzone } from 'svelte-dnd-action';
 	import Card from "./Card.svelte";
 	import * as CardUI from "../../lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
 	import type { CardItem, ColumnDropHandler, PublishState } from "./types.js";
	import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import { authStore } from "$lib/index.js";
	import { toast } from "svelte-sonner";
	

 	const flipDurationMs = 150;

 	// Suppress passive event listener warnings for dnd-action
 	// This is a known issue with svelte-dnd-action library
 	if (typeof window !== 'undefined') {
 			// Override console.warn to suppress the specific passive listener warning
 			const originalWarn = console.warn;
 			console.warn = function(...args) {
 				const message = String(args[0] || '');
 				if (message.includes('non-passive event listener') ||
 					message.includes('Added non-passive event listener') ||
 					message.includes('scroll-blocking') ||
 					message.includes('touchstart') ||
 					message.includes('touchmove')) {
 					return; // Suppress these specific warnings
 				}
 				originalWarn.apply(console, args);
 			};
 		}

	let {
		name,
		items,
		color,
		columnId,
		isSelected = false,
		onSelect,
		onDrop,
		onCardAction,
		onPublishStateChange,
		onSidebarAction,
		selectedCardId,
		onSelectCard
 	, maxCardsBeforeScroll = 20
 	}: {
		name: string;
		items: CardItem[];
		color?: string;
		columnId?: string;
		isSelected?: boolean;
		onSelect?: () => void;
		onDrop: ColumnDropHandler;
		onCardAction?: (cardId: string, action: string) => void;
		onPublishStateChange?: (cardId: string, newState: PublishState) => void;
		onSidebarAction?: (cardId: string, action: string) => void;
		selectedCardId?: string | null;
		onSelectCard?: (cardId: string) => void;
		maxCardsBeforeScroll?: number;
	} = $props();

	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
	import PlusIcon from '@lucide/svelte/icons/plus';

	// Local state for column editing
	let isEditing = $state(false);
	let editName = $state(name);
	let selectedColor = $state(color || 'slate');
	let popoverOpen = $state(false);

	const colorOptions = [
		{ value: 'slate', label: 'Slate', cssVar: '--color-slate' },
		{ value: 'blue', label: 'Blau', cssVar: '--color-blue' },
		{ value: 'green', label: 'Grün', cssVar: '--color-green' },
		{ value: 'orange', label: 'Orange', cssVar: '--color-orange' },
		{ value: 'red', label: 'Rot', cssVar: '--color-red' },
		{ value: 'purple', label: 'Lila', cssVar: '--color-purple' }
	];

	// WICHTIG: Überwache DnD Status um $effect während Drag zu pausieren
	// Verhindert Race Conditions zwischen svelte-dnd-action und BoardStore Updates
	let isDraggingCards = $state(false);

	// WICHTIG: Überwache BoardStore Updates für Spalten-Eigenschaften (Name, Farbe)
	// Synchronisiert automatisch wenn die Spalte im Store geändert wird
	$effect(() => {
		// Zugriff auf boardStore.uiData triggert Reaktivität
		const uiColumns = boardStore.uiData;
		
		// Suche unsere Column in den neuen UI-Daten
		const updatedColumn = uiColumns.find(c => c.id === columnId);
		if (updatedColumn) {
			// Aktualisiere Name wenn sich geändert hat
			if (updatedColumn.name !== name) {
				console.log('🔄 Column.svelte: Name vom BoardStore aktualisiert', {
					columnId,
					oldName: name,
					newName: updatedColumn.name
				});
				name = updatedColumn.name;
				editName = name; // Auch editName aktualisieren für Consistency
			}
			
			// Aktualisiere Farbe wenn sich geändert hat
			if (updatedColumn.color !== color) {
				console.log('🔄 Column.svelte: Farbe vom BoardStore aktualisiert', {
					columnId,
					oldColor: color,
					newColor: updatedColumn.color
				});
				color = updatedColumn.color;
				selectedColor = color || 'slate'; // Auch selectedColor aktualisieren
			}
		}
	});

	// WICHTIG: Überwache BoardStore Updates und aktualisiere Items automatisch
	// Das ist notwendig, weil Card-Bearbeitungen (CardDialog) nicht sofort in der UI
	// sichtbar sind, bis Column.svelte die neuen Items vom BoardStore lädt
	// ABER: Pausiere während DnD um zu verhindern, dass Items während des Drags überschrieben werden
	$effect(() => {
		// Wenn gerade Drag stattfindet, update NICHT
		if (isDraggingCards) {
			return;
		}
		
		// Zugriff auf boardStore.uiData triggert Reaktivität
		const uiColumns = boardStore.uiData;
		
		// Suche unsere Column in den neuen UI-Daten
		const updatedColumn = uiColumns.find(c => c.id === columnId);
		if (updatedColumn) {
			// Vergleiche Items - wenn sie unterschiedlich sind, aktualisiere
			const itemsChanged = updatedColumn.items.length !== items.length ||
				updatedColumn.items.some((newItem, idx) => {
					const oldItem = items[idx];
					return !oldItem || newItem.id !== oldItem.id || 
						newItem.name !== oldItem.name ||
						newItem.description !== oldItem.description;
				});
			
			if (itemsChanged) {
				console.log('🔄 Column.svelte: Items vom BoardStore aktualisiert', {
					columnId,
					oldCount: items.length,
					newCount: updatedColumn.items.length
				});
				items = updatedColumn.items;
			}
		}
	});

 	function handleDndConsiderCards(e: any) {
 		const { items: newItems } = e.detail;
  	   console.warn("got consider", name);
  	   isDraggingCards = true;
 		items = newItems;
   }
   
   function handleDndFinalizeCards(e: any) {
     const newItems = e.detail.items;
     // Setze isDraggingCards zurück NACH kurzer Verzögerung
     // um zu erlauben, dass die BoardStore Updates verarbeitet werden
     isDraggingCards = false;
     
     // Für jetzt: einfach an den Parent callback übergeben
     // Die Karten-Bewegung zwischen Spalten wird von Board.svelte gehandhabt
     onDrop(newItems);
   }

   function handleCardAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onCardAction?.(cardId, action);
   }

   function handlePublishStateChange(event: CustomEvent) {
   		const { cardId, newState } = event.detail;
   		onPublishStateChange?.(cardId, newState);
   }

   function handleSidebarAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onSidebarAction?.(cardId, action);
   }

   function getCardColor(colorName: string | undefined): string {
   		return colorName ? `var(--color-${colorName})` : 'var(--muted)';
   }

	function handleRenameChange() {
		// 🎯 DIREKT SPEICHERN beim Input ändern (onchange/onblur)
		if (editName !== name && columnId) {
			console.log('📝 Column name changed:', { old: name, new: editName });
			try {
				boardStore.updateColumn(columnId, { name: editName });
			} catch (error) {
				console.error('❌ Fehler beim Umbenennen:', error);
				toast.error('Keine Berechtigung', {
					description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Spalten umzubenennen.'
				});
				// Setze den Namen zurück
				editName = name;
			}
		}
	}

	function handleDelete() {
		if (confirm(`Spalte "${name}" und alle ${items.length} Karten wirklich löschen?`)) {
			if (columnId) {
				console.log('🗑️ Deleting column:', { columnId, name, cardsCount: items.length });
				try {
					boardStore.deleteColumnWithCards(columnId);
				} catch (error) {
					console.error('❌ Fehler beim Löschen:', error);
					toast.error('Keine Berechtigung', {
						description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Spalten zu löschen.'
					});
				}
			}
		}
		popoverOpen = false;
	}

	function handleHeaderClick(e: MouseEvent) {
		// Only select column when clicking on the header itself, not on the popover trigger
		if ((e.target as HTMLElement).closest('.popover-trigger-ignore')) {
			return;
		}
		e.stopPropagation();
		onSelect?.();
	}
</script>

<style>
	.column-wrapper {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.column-header {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.75rem;
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.column-header:hover {
		opacity: 0.8;
	}

	.column-header:focus {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.column-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--foreground);
		margin-bottom: 0.5rem;
	}

	.color-bar {
		height: 1px;
		width: 100%;
		border-radius: 2px;
	}

	.column-content {
		flex: 0 0 auto; /* do not scroll individually - let column grow */
		padding-right: 0.5rem;
		min-height: 100px; /* Minimum dropzone height when empty */
		border-radius: var(--radius-md);
		padding-bottom: 10px;
	}

	/* When many cards are present we allow the column to use an inner scroll */
	.column-content.scrollable {
		flex: 1 1 auto;
		overflow-y: auto;
		max-height: 70vh; /* reasonable cap so footer remains reachable */
	}

	.column-footer {
		flex: 0 0 auto;
		padding: 0.5rem;
		border-top: 1px dashed var(--muted);
		min-height: 24px;
		background: linear-gradient(180deg, transparent, rgba(0,0,0,0.01));
	}
	.add-card-button {
		border: 1px dotted var(--muted-foreground);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--muted-foreground);
		transition: all 0.2s ease;
		font-size: 1rem;
	}
	

	.add-card-button:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: var(--primary)/10;
	}

	
		

	/* Hover style handled via pointer events on the element (no separate .hover selector to satisfy Svelte) */

	.card-wrapper {
		margin-bottom: 0.75rem;
	}

	.card-wrapper:last-child {
		margin-bottom: 0;
	}

	/* Scrollbar styling */
	.column-content::-webkit-scrollbar {
		width: 6px;
	}

	.column-content::-webkit-scrollbar-track {
		background: var(--muted);
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb {
		background: var(--muted-foreground);
		opacity: 0.3;
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb:hover {
		opacity: 0.5;
	}

	/* Color Circle Picker Styles */
	.color-circle {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		flex-shrink: 0;
	}

	.color-circle:hover {
		transform: scale(1.1);
		box-shadow: 0 0 12px rgba(0, 0, 0, 0.2);
	}

	.color-circle.selected {
		border-color: white;
		box-shadow: 0 0 0 3px var(--accent), 0 0 12px rgba(0, 0, 0, 0.3);
	}

	.color-circle .checkmark {
		width: 1.25rem;
		height: 1.25rem;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
	}
</style>

<div 
	class="column-wrapper {isSelected ? 'border-2 border-ring rounded-sm p-1' : ''}" 
>
	<div class="column-header" onclick={handleHeaderClick} onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleHeaderClick(e as unknown as MouseEvent);
		}
	}} role="button" tabindex="0">
		<div class="flex items-center justify-between w-full">
			<div class="column-title">{name}</div>
			
			<!-- Header Toolbar: Add Card + Menu -->
			<div class="flex items-center gap-1">
				{#if authStore.isAuthenticated }
				<!-- Add Card Button -->
				<Button 
					variant="default" 
					size="sm" 
					class="btn"
					title="Neue Karte am Anfang"
					onclick={(e) => {
						e.stopPropagation();
						if (columnId) {
							try {
								const newCardId = boardStore.createCard(columnId, 'Neue Karte', 'Bitte bearbeiten...');
								const newCard: CardItem = {
									id: newCardId,
									name: 'Neue Karte',
									description: 'Bitte bearbeiten...',
								};
								// Neue Karte AM ANFANG einfügen
								onDrop([newCard, ...items]);
								// ✨ Neue Karte automatisch selektieren (mit Verzögerung damit UI aktualisiert wird)
								setTimeout(() => {
									onSelectCard?.(String(newCardId));
									console.log('✨ Neue Karte selektiert:', newCardId);
								}, 0);
							} catch (error) {
								console.error('❌ Fehler beim Erstellen der Karte:', error);
								toast.error('Keine Berechtigung', {
									description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Karten zu erstellen.'
								});
							}
						}
					}}
				>
					<SquarePlusIcon class="h-4 w-4" />
				</Button>
				{/if}
				<!-- Spalten-Aktionen Popover -->
				<Popover.Root bind:open={popoverOpen}>
					{#if authStore.isAuthenticated }
					<Popover.Trigger title="Spalten-Optionen"
						class="popover-trigger-ignore inline-flex items-center justify-center h-8 w-8 btn transition-all"
					>
						<EllipsisVerticalIcon class="h-4 w-4 pointer-events-none bg-transparent" />
					</Popover.Trigger>
					{/if}
					<Popover.Content align="end" class="w-64">
						<div class="space-y-4">
							<div class="space-y-2">
								<h4 class="font-medium text-sm">Spalte umbenennen</h4>
								<Input 
									bind:value={editName} 
									placeholder="Spaltenname"
									onchange={handleRenameChange}
									onblur={handleRenameChange}
								/>
							</div>
							
							<Separator />
							
							<div class="space-y-2">
								<h4 class="font-medium text-sm">Farbe wählen</h4>
								<div class="flex flex-wrap gap-3">
									{#each colorOptions as option}
										<button
											class="color-circle"
											class:selected={selectedColor === option.value}
											style="background-color: var({option.cssVar})"
											onclick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												selectedColor = option.value;
												// 🎯 DIREKT SPEICHERN ohne auf Button zu warten!
												if (columnId) {
													boardStore.updateColumn(columnId, { color: option.value });
													popoverOpen = false;
												}
											}}
											title={option.label}
											aria-label={option.label}
										>
											{#if selectedColor === option.value}
												<svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
													<polyline points="20 6 9 17 4 12"></polyline>
												</svg>
											{/if}
										</button>
									{/each}
								</div>
							</div>
							
							<Separator />
							
							<Button variant="destructive" size="sm" onclick={handleDelete} class="w-full">
								Spalte löschen
							</Button>
						</div>
					</Popover.Content>
				</Popover.Root>
			</div>
		</div>
		<div class="color-bar" style="background-color: {getCardColor(color)}"></div>
	</div>

	<div class={`column-content ${items.length > (maxCardsBeforeScroll || 20) ? 'scrollable' : ''}`} use:dndzone={{items, flipDurationMs, dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}}}
	     onconsider={handleDndConsiderCards}
		 onfinalize={handleDndFinalizeCards}>
		{#each items as item (item.id)}
			<div animate:flip="{{duration: flipDurationMs}}" class="card-wrapper">
				<Card
					card={item}
					isSelected={selectedCardId === String(item.id)}
					onSelect={() => {
						console.log('🖱️ Card clicked:', item.id, 'selectedCardId:', selectedCardId);
						onSelectCard?.(String(item.id));
					}}
					{onCardAction}
					{onPublishStateChange}
					{onSidebarAction}
				/>
			</div>
		{/each}
	</div>

	<!-- Footer: nur noch visueller Separator -->
	<div class="column-footer"></div>
</div>