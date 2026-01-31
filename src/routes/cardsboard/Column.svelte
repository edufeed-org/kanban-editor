<script lang="ts">
	import { flip } from 'svelte/animate';
    import { dndzone } from 'svelte-dnd-action';
 	import Card from "./Card.svelte";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
 	import type { CardItem, ColumnDropHandler } from "./types.js";
	import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import { toast } from "svelte-sonner";
	import LinkAddPopover from '$lib/components/LinkAddPopover.svelte';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';	

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
		onDrop,
		onCardAction,
		onSidebarAction,
		maxCardsBeforeScroll = 20,
		readOnly = false
 	}: {
		name: string;
		items: CardItem[];
		color?: string;
		columnId?: string;
		onDrop: ColumnDropHandler;
		onCardAction?: (cardId: string, action: string) => void;
		onSidebarAction?: (cardId: string, action: string) => void;
		maxCardsBeforeScroll?: number;
		readOnly?: boolean;
	} = $props();

	// Local state for column editing
	let editName = $state(name);
	let selectedColor = $state(color || 'slate');
	let popoverOpen = $state(false);
	
	// State für Inline-Editing des Column-Titels
	let isEditingTitle = $state(false);
	let titleInputRef: HTMLInputElement | null = $state(null);
	
	// Global popover state management - ensures only one popover is open at a time
	const popoverId = `column-popover-${columnId}`;

	const colorOptions = [
		{ value: 'slate', label: 'Slate', cssVar: '--color-slate' },
		{ value: 'blue', label: 'Blau', cssVar: '--color-blue' },
		{ value: 'green', label: 'Grün', cssVar: '--color-green' },
		{ value: 'orange', label: 'Orange', cssVar: '--color-orange' },
		{ value: 'red', label: 'Rot', cssVar: '--color-red' },
		{ value: 'purple', label: 'Lila', cssVar: '--color-purple' }
	];

	// ============================================================================
	// POPOVER MANAGEMENT: Ensure only one popover is open at a time
	// ============================================================================
	function handlePopoverOpenChange(open: boolean) {
		if (open) {
			// Close any other open popover (columns and cards)
			const event = new CustomEvent('closeOtherPopovers', {
				detail: { popoverId },
				bubbles: true,
				composed: true
			});
			window.dispatchEvent(event);
			popoverOpen = true;
		} else {
			popoverOpen = false;
		}
	}
	
	// Listen for close events from other popovers
	$effect(() => {
		const handleClose = (event: Event) => {
			const customEvent = event as CustomEvent<{ popoverId: string }>;
			if (customEvent.detail.popoverId !== popoverId && popoverOpen) {
				popoverOpen = false;
			}
		};
		
		window.addEventListener('closeOtherPopovers', handleClose);
		
		return () => {
			window.removeEventListener('closeOtherPopovers', handleClose);
		};
	});

	// WICHTIG: Überwache DnD Status um $effect während Drag zu pausieren
	// Verhindert Race Conditions zwischen svelte-dnd-action und BoardStore Updates
	let isDraggingCards = $state(false);

	// WICHTIG: Konsolidierter Effect für ALLE BoardStore Updates (Name, Farbe, Items)
	// Synchronisiert automatisch wenn die Spalte im Store geändert wird
	// Pausiere während DnD um Race Conditions zu verhindern
	$effect(() => {
		// Wenn gerade Drag stattfindet, update NICHT
		if (isDraggingCards) {
			return;
		}
		
		// Zugriff auf boardStore.uiData triggert Reaktivität
		const uiColumns = boardStore.uiData;
		
		// Suche unsere Column in den neuen UI-Daten
		const updatedColumn = uiColumns.find(c => c.id === columnId);
		
		// ⚠️ CRITICAL: Wenn Column nicht gefunden → NICHTS tun!
		// Das verhindert, dass Items gelöscht werden bei Store-Updates
		if (!updatedColumn) {
			console.warn('⚠️ Column.svelte: Column not found in uiData', { columnId });
			return;
		}
		
		// 1. Aktualisiere Name wenn sich geändert hat
		if (updatedColumn.name !== name) {
			console.log('🔄 Column.svelte: Name vom BoardStore aktualisiert', {
				columnId,
				oldName: name,
				newName: updatedColumn.name
			});
			name = updatedColumn.name;
			editName = name; // Auch editName aktualisieren für Consistency
		}
		
		// 2. Aktualisiere Farbe wenn sich geändert hat
		if (updatedColumn.color !== color) {
			console.log('🔄 Column.svelte: Farbe vom BoardStore aktualisiert', {
				columnId,
				oldColor: color,
				newColor: updatedColumn.color
			});
			color = updatedColumn.color;
			selectedColor = color || 'slate'; // Auch selectedColor aktualisieren
		}
		
		// 3. Aktualisiere Items wenn sich geändert haben
		// ⚠️ CRITICAL: Nur wenn wirklich unterschiedlich (verhindert unnötige Re-Renders)
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
	});

 	function handleDndConsiderCards(e: any) {
 		const { items: newItems } = e.detail;
  	    // console.warn("got consider", name);
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
		isEditingTitle = false;
	}
	
	// Funktionen für Inline-Editing des Column-Titels
	function startEditingColumnTitle(e: MouseEvent) {
		if (readOnly) return;
		e.stopPropagation();
		editName = name;
		isEditingTitle = true;
		setTimeout(() => titleInputRef?.focus(), 10);
	}
	
	function handleColumnTitleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleRenameChange();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editName = name;
			isEditingTitle = false;
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

</script>

<style>
	.column-wrapper {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		max-height: 100%;
		overflow: hidden;
		position: relative; /* Wichtig für position: absolute des fixed Buttons */
	}

	.column-header {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.75rem;
		cursor: pointer;
		transition: opacity 0.2s ease;
		flex-shrink: 0;
	}

	.column-header:hover {
		opacity: 0.8;
	}

	.column-header:focus-visible {
		outline: 2px solid var(--accent);
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
		flex: 1 1 auto;
		overflow-y: auto;
		overflow-x: hidden;
		padding-right: 0.5rem;
		min-height: 50px;
		border-radius: var(--radius-md);
		padding-bottom: 10px;
	}

	/* Add-Card-Button: Sticky am unteren Rand wenn gescrollt wird */
	.add-card-button {
		border-radius: var(--radius-md);
		border: 2px dotted var(--accent);
		background: var(--muted);
		color: var(--foreground);
		transition: all 0.2s ease;
		font-size: 0.9rem;
		cursor: pointer;
		width: 100%;
		margin-top: 0.5rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		
		/* Sticky: Klebt am unteren Rand wenn Container scrollbar ist */
		position: sticky;
		bottom: -10px;
		z-index: 5;
	}

	.add-card-button:hover {
		background: var(--accent);
		color: var(--primary-foreground);
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
	class="column-wrapper" 
>
	<div class="column-header">
		<div class="flex items-center justify-between w-full">
			<!-- Drag Handle + Title -->
			<div class="flex items-center gap-2 flex-1" data-dnd-handle>
				<svg class="h-4 w-4 text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 24 24" title="Spalte verschieben">
					<path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
				</svg>
				{#if isEditingTitle && !readOnly}
					<input
						bind:this={titleInputRef}
						bind:value={editName}
						onblur={handleRenameChange}
						onkeydown={handleColumnTitleKeydown}
						onpointerdown={(e) => e.stopPropagation()}
						class="column-title bg-transparent border-b-2 border-primary outline-none px-1 min-w-[80px]"
					/>
				{:else}
					<button
						onclick={startEditingColumnTitle}
						onpointerdown={(e) => e.stopPropagation()}
						class="column-title hover:bg-muted/50 px-1 rounded cursor-text transition-colors text-left"
						title={readOnly ? name : "Klicken zum Bearbeiten"}
						disabled={readOnly}
					>
						{name}
					</button>
				{/if}
			</div>
			
			<!-- Header Toolbar: Menu (click-only, no drag) -->
			<div 
				class="flex items-center gap-1" 
				role="toolbar" 
				tabindex="0"
				aria-label="Spalten-Aktionen"
				onpointerdown={(e) => e.stopPropagation()} 
				onmousedown={(e) => e.stopPropagation()}
			>
				{#if !readOnly}
				<!-- Spalten-Aktionen Popover -->
				<Popover.Root bind:open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
					<Popover.Trigger 
						title="Spalten-Optionen"
						class="popover-trigger-ignore inline-flex items-center justify-center h-8 w-8 btn transition-all"
						onclick={(e) => {
							console.log('🖱️ Popover trigger clicked');
							e.stopPropagation();
						}}
					>
						<EllipsisVerticalIcon class="h-4 w-4 pointer-events-none bg-transparent" />
					</Popover.Trigger>
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
							
							<!-- Link hinzufügen -->
							<LinkAddPopover columnId={columnId || ''} />
							
							<Separator />
							
							<Button variant="destructive" size="sm" onclick={handleDelete} class="w-full btn">
								<TrashIcon class="h-4 w-4"  />
								Spalte löschen
							</Button>
						</div>
					</Popover.Content>
				</Popover.Root>
				{/if}
			</div>
		</div>
		<div class="color-bar" style="background-color: {getCardColor(color)}"></div>
	</div>

	<div 
		class="column-content" 
		use:dndzone={{items, flipDurationMs, dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}, dragDisabled: readOnly, delayTouchStart: 300}}
		onconsider={handleDndConsiderCards}
		onfinalize={handleDndFinalizeCards}
	>
		{#each items as item (item.id)}
			<div animate:flip="{{duration: flipDurationMs}}" class="card-wrapper">
				<Card
					card={item}
					{onCardAction}
					{onSidebarAction}
					{readOnly}
				/>
			</div>
		{/each}
		
		<!-- Add Card Button: Direkt unter der letzten Karte (oder oben wenn keine Karten) -->
		{#if !readOnly}
		<button 
			class="add-card-button flex items-center gap-2.5 px-4 py-5 rounded-md"
			onclick={(e) => {
				e.stopPropagation();
				if (columnId) {
					const newCardId = boardStore.createCard(columnId, 'Neue Karte', '');
					if (newCardId) {
						// ✨ Neue Karte: Dialog öffnen
						setTimeout(() => {
							const event = new CustomEvent('openCardDialog', {
								detail: { cardId: String(newCardId) },
								bubbles: true,
								composed: true
							});
							window.dispatchEvent(event);
							console.log('✨ Neue Karte erstellt und Dialog-Event gesendet:', newCardId);
						}, 150);
					}
				}
			}}
		>
			<SquarePlusIcon class="h-4.5 w-4.5" />
			<span>Karte hinzufügen</span>
		</button>
		{/if}
	</div>
</div>