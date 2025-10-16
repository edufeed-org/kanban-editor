<script lang="ts">
	import { flip } from 'svelte/animate';
    import { dndzone } from 'svelte-dnd-action';
 	import Column from "./Column.svelte";
	import { settingsStore } from '$lib/stores/settingsStore.js';
 	import type { Column as ColumnType, BoardUpdateHandler, ColumnDropHandler, CardItem, PublishState } from "./types.js";

 	const flipDurationMs = 300;

	// Track column heights for alignment
	let columnHeights = $state<{ [key: string]: number }>({});
	let maxColumnHeight = $derived(Math.max(...Object.values(columnHeights), 0));
	let resizeObservers = new Map<string, ResizeObserver>();

	// Subscribe to settings store
	let settings = $state<any>(null);
	let unsubscribe: (() => void) | undefined;
	
	$effect(() => {
		if (!unsubscribe) {
			unsubscribe = settingsStore.subscribe((s) => {
				settings = s;
			});
		}
		return () => unsubscribe?.();
	});

	// Auto-scroll beim Dragging
	let boardElement: HTMLElement | undefined;
	let autoScrollInterval: ReturnType<typeof setInterval> | undefined;
	const SCROLL_SPEED = 15; // Pixel pro Scroll-Intervall
	const EDGE_THRESHOLD = 100; // Pixel vom Rand, wo Auto-Scroll startet

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

   // mutable reference for runes compatibility
   let columns = $state(columns_inner);

	function handleDndConsiderColumns(e: any) {
     columns = e.detail.items;
   }
   function handleDndFinalizeColumns(e: any) {
     onFinalUpdate(e.detail.items);
   }
   	function handleItemFinalize(columnIdx: number, newItems: CardItem[]) {
  		columns[columnIdx].items = newItems;
  		onFinalUpdate([...columns]);
  	}

  	function handleCardAction(cardId: string, action: string) {
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
	 * Auto-Scroll beim Drag: Prüfe Maus-Position und scrolle Board horizontal
	 */
	function handleBoardDragOver(e: DragEvent) {
		if (!boardElement) return;

		const rect = boardElement.getBoundingClientRect();
		const x = e.clientX;

		// Check ob nahe am linken Rand
		if (x < rect.left + EDGE_THRESHOLD) {
			if (!autoScrollInterval) {
				autoScrollInterval = setInterval(() => {
					if (boardElement) {
						boardElement.scrollLeft -= SCROLL_SPEED;
					}
				}, 50);
			}
		}
		// Check ob nahe am rechten Rand
		else if (x > rect.right - EDGE_THRESHOLD) {
			if (!autoScrollInterval) {
				autoScrollInterval = setInterval(() => {
					if (boardElement) {
						boardElement.scrollLeft += SCROLL_SPEED;
					}
				}, 50);
			}
		}
		// Sonst: Stop Auto-Scroll
		else {
			if (autoScrollInterval) {
				clearInterval(autoScrollInterval);
				autoScrollInterval = undefined;
			}
		}
	}

	/**
	 * Cleanup: Auto-Scroll stoppen wenn Drag endet
	 */
	function handleBoardDragEnd() {
		if (autoScrollInterval) {
			clearInterval(autoScrollInterval);
			autoScrollInterval = undefined;
		}
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
		overflow-y: auto; /* allow page to scroll vertically when columns grow */
		flex: 1 1 auto;
		gap: 0.5em;
		padding: 0.5em;
		scroll-behavior: smooth;
		scrollbar-width: thick;  /* Firefox */
		align-items: flex-start; /* columns grow with their content */
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
	use:dndzone={{items:columns, flipDurationMs, type:'column', dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}}} 
	onconsider={handleDndConsiderColumns} 
	onfinalize={handleDndFinalizeColumns}
	ondragover={handleBoardDragOver}
	ondragleave={handleBoardDragEnd}
	ondrop={handleBoardDragEnd}
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
					onSelectCard={onSelectCard}
 						onSidebarAction={handleSidebarAction}
					maxCardsBeforeScroll={settings?.maxCardsBeforeScroll ?? 20}
 					/>
 			</div>
     {/each}
</section>