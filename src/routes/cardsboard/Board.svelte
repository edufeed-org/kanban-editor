<script lang="ts">
	import { flip } from 'svelte/animate';
    import { dndzone } from 'svelte-dnd-action';
 	import Column from "./Column.svelte";
 	import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
 	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
 	import { Button } from "$lib/components/ui/button/index.js";
 	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
 	import { authStore } from '$lib/index.js';
 	import { toast } from "svelte-sonner";
 	import type { Column as ColumnType, BoardUpdateHandler, ColumnDropHandler, CardItem, PublishState } from "./types.js";

 	const flipDurationMs = 300;

	// Track column heights for alignment
	let columnHeights = $state<{ [key: string]: number }>({});
	let maxColumnHeight = $derived(Math.max(...Object.values(columnHeights), 0));
	let resizeObservers = new Map<string, ResizeObserver>();

	// Board Element Referenz (für potentielle zukünftige Features)
	let boardElement: HTMLElement | undefined;

	// Direkt auf settingsStore.settings zugreifen (Svelte 5 Runes)
	let settings = $derived(settingsStore.settings);
	
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
	columns: columns_inner,
	onFinalUpdate,
	selectedColumn = null,
	selectedCard = null,
	onSelectColumn = undefined,
	onSelectCard = undefined
   }: {
	columns: ColumnType[];
	onFinalUpdate: BoardUpdateHandler;
	selectedColumn?: string | null;
	selectedCard?: string | null;
	onSelectColumn?: ((columnId: string) => void) | undefined;
	onSelectCard?: ((cardId: string) => void) | undefined;
   } = $props();

   // Lokaler State für dndzone: Wird von dndzone mutiert
   let columns = $state([...columns_inner]);
   let isDragging = $state(false);
   
   // WICHTIG: Synchronisiere columns mit columns_inner (vom Parent)
   // Das ist essentiell für die Reaktivität!
   // Wenn Parent columns_inner ändert (z.B. neue Spalte), muss columns aktualisiert werden
   $effect(() => {
     // Wenn nicht gerade Dragging, synchronisiere mit Parent-Änderungen
     if (!isDragging) {
       // Vergleiche ob sich die Spalten-Reihenfolge oder IDs geändert haben
       const parentIds = columns_inner.map(c => c.id).join(',');
       const localIds = columns.map(c => c.id).join(',');
       
       if (parentIds !== localIds) {
         console.log('🔄 Board.svelte: Spalten vom Parent synchronisieren', {
           parentIds,
           localIds
         });
         // Aktualisiere mit Spalten vom Parent (aber in lokaler Reihenfolge)
         columns = [...columns_inner];
       }
     }
   });

	function handleDndConsiderColumns(e: any) {
     isDragging = true;
     columns = e.detail.items;
   }
   function handleDndFinalizeColumns(e: any) {
     isDragging = false;
     const finalItems = e.detail.items;
     
     // SICHERHEIT: Filtere Duplikate bevor sie an den Parent gesendet werden
     const seenIds = new Set<string>();
     const deduplicated = finalItems.filter((col: any) => {
       if (seenIds.has(col.id)) {
         console.warn(`⚠️ Duplikat erkannt: ${col.id} - wird entfernt`);
         return false;
       }
       seenIds.add(col.id);
       return true;
     });
     
     if (deduplicated.length !== finalItems.length) {
       console.error(`❌ ${finalItems.length - deduplicated.length} Duplikat(e) gefunden und entfernt`);
       columns = deduplicated;
       onFinalUpdate(deduplicated);
     } else {
       columns = finalItems;
       onFinalUpdate(finalItems);
     }
   }
	function handleItemFinalize(columnIdx: number, newItems: CardItem[]) {
		// Immutable update: Erstelle neues columns Array
		const updatedColumns = columns.map((col, idx) => 
			idx === columnIdx 
				? { ...col, items: newItems }
				: col
		);
		columns = updatedColumns;
		onFinalUpdate(updatedColumns);
	}  	function handleCardAction(cardId: string, action: string) {
  		console.log('Card action:', cardId, action);
  		// Handle card actions like complete, edit, etc.
  	}

  	function handlePublishStateChange(cardId: string, newState: PublishState) {
  		console.log('Publish state change:', cardId, newState);
  		// Find and update the card's publish state
  		for (const column of columns) {
  			const card = column.items.find(item => String(item.id) === cardId);
  			if (card) {
  				card.publishState = newState;
  				onFinalUpdate([...columns]);
  				break;
  			}
  		}
  	}

  	function handleSidebarAction(cardId: string, action: string) {
  		console.log('Sidebar action:', cardId, action);
  		// Handle sidebar actions like delete, duplicate, etc.
  	}

	/**
	 * Svelte Action: Überwache Column-Höhen mit ResizeObserver
	 */
	function observeColumnHeight(element: HTMLElement, columnId: string) {
		// Falls schon Observer für diese Column existiert, löschen
		if (resizeObservers.has(columnId)) {
			resizeObservers.get(columnId)?.disconnect();
		}

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				columnHeights[columnId] = entry.contentRect.height;
			}
		});

		observer.observe(element);
		resizeObservers.set(columnId, observer);

		// Return destroy function für Svelte Action Cleanup
		return {
			destroy() {
				observer.disconnect();
				resizeObservers.delete(columnId);
			}
		};
	}

</script>

<style>
	.board {
		display: flex;
		flex-direction: row;
		overflow-x: auto;
		overflow-y: auto;
		flex: 1 1 auto;
		gap: 0.5em;
		padding: 0.5em;
		/* scroll-behavior: smooth; */ /* Deaktiviert für schnelleres Auto-Scroll während Drag */
		scrollbar-width: thick;  /* Firefox */
		align-items: flex-start;
		height: 100%;
		width: 100%;
		position: relative;
	}

    /* Dickes Scrollbar in Chrome/Edge/Safari */
    .board::-webkit-scrollbar {
        height: 16px;
    }

    .board::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
    }

    .board::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, #666, #444);
        border-radius: 4px;
    }

    .board::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(to bottom, #333, #000);
    }

	.column {
		flex: 0 0 320px;  /* fixed width */
		display: flex;
		flex-direction: column;
		padding: 0.5em;
		border-right: 1px solid var(--column-border);
		/* background-color: var(--background); */
		align-items: stretch;
	}

	
</style>

<section 
	class="board" 
	aria-label="Kanban Board mit Spalten"
	bind:this={boardElement}
	use:dndzone={{items:columns, flipDurationMs, type:'column', dragDisabled: false, dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}}} 
	onconsider={handleDndConsiderColumns} 
	onfinalize={handleDndFinalizeColumns}
>
    {#each columns as {id, name, color, items}, idx (id)}
   		<div 
			class="column" 
			animate:flip="{{duration: flipDurationMs}}"
			use:observeColumnHeight={id}
			style={settings?.alignColumnsToMaxHeight && maxColumnHeight > 0 ? `min-height: ${maxColumnHeight}px;` : ''}
		>
 				<Column
 						name={name}
 						color={color}
 						items={items}
					columnId={id}
					isSelected={selectedColumn === id}
					onSelect={() => onSelectColumn?.(id)}
 						onDrop={(newItems) => handleItemFinalize(idx, newItems)}
 						onCardAction={handleCardAction}
 						onPublishStateChange={handlePublishStateChange}
					selectedCardId={selectedCard}
					onSelectCard={(cardId) => onSelectCard?.(cardId)}
 						onSidebarAction={handleSidebarAction}
					maxCardsBeforeScroll={settings?.maxCardsBeforeScroll ?? 20}
 					/>
 			</div>
     {/each}
	{#if authStore.isAuthenticated }
	<!-- Add Column Button - ähnlich wie Column Footer -->
	<div class="addcolumn" title="Neue Spalte hinzufügen" style="justify-content: center; padding: 1rem;">
		<Button
			variant="outline"
			size="lg"
			class="add-column-button w-full h-full min-h-[48px]  btn bg-secondary"
			aria-label="Neue Spalte hinzufügen"
			onclick={() => {
				console.log('➕ Adding new column...');
				try {
					boardStore.createColumn('Neue Spalte');
				} catch (error) {
					console.error('❌ Fehler beim Erstellen der Spalte:', error);
					toast.error('Keine Berechtigung', {
						description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Spalten zu erstellen.'
					});
				}
			}}
		>
			<SquarePlusIcon class="mr-2 h-5 w-5" />
			Neue Spalte hinzufügen
		</Button>
	</div>
	{/if}
</section>