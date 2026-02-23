<script lang="ts">
	import { flip } from 'svelte/animate';
    import { onMount } from 'svelte';
    import { dndzone } from 'svelte-dnd-action';
 	import Column from "./Column.svelte";
 	import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
 	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import { BoardRole } from '$lib/types/sharing';
	import { showEditorPermissionToast } from '$lib/utils/permissionToast';
 	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
 	import { toast } from "svelte-sonner";
 	import type { Column as ColumnType, BoardUpdateHandler, CardItem } from "./types.js";

 	const flipDurationMs = 300;
	// Sicherer Flip-Wrapper: Vermeidet Fehler bei ungültigen Größen (NaN-Werte)
	type FlipParams = {
		delay?: number;
		duration?: number | ((len: number) => number);
		easing?: (t: number) => number;
	};

	function safeFlip(
		node: Element,
		{ from, to }: { from: DOMRect; to: DOMRect },
		params?: FlipParams
	) {
		const valid =
			Number.isFinite(from.width) &&
			Number.isFinite(from.height) &&
			Number.isFinite(to.width) &&
			Number.isFinite(to.height) &&
			from.width > 0 &&
			from.height > 0 &&
			to.width > 0 &&
			to.height > 0;

		if (!valid) {
			return { duration: 0 };
		}

		return flip(node, { from, to }, params);
	}

	// Track column heights for alignment
	let columnHeights = $state<{ [key: string]: number }>({});
	let maxColumnHeight = $derived(Math.max(...Object.values(columnHeights), 0));
	let resizeObservers = new Map<string, ResizeObserver>();

	// Board Element Referenz (für potentielle zukünftige Features)
	let boardElement: HTMLElement | undefined;

	// Direkt auf settingsStore.settings zugreifen (Svelte 5 Runes)
	let settings = $derived(settingsStore.settings);

	// Sticky button - nur zeigen wenn scrollable button nicht sichtbar ist
	let showStickyButton = $state(false);
	let scrollableButtonElement = $state<HTMLElement | undefined>(undefined);

	function isEditableElement(el: Element | null): boolean {
		if (!el) return false;
		const tag = el.tagName.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return true;
		if (el instanceof HTMLElement && el.isContentEditable) return true;
		if (el.closest('[contenteditable="true"], .ProseMirror, .tiptap')) return true;
		return false;
	}

	function isEditableTarget(event: ClipboardEvent): boolean {
		// 1. Wenn ein anderer Handler (z.B. TipTap/ProseMirror) das Event bereits
		//    verarbeitet hat, nicht nochmal verarbeiten
		if (event.defaultPrevented) return true;

		// 2. Prüfe event.target (direktes Ziel des Events)
		if (event.target instanceof Element && isEditableElement(event.target)) return true;

		// 3. Prüfe document.activeElement (zuverlässiger als event.target,
		//    z.B. wenn Cursor am Anfang einer leeren Zeile in TipTap steht
		//    und event.target ein Wrapper-Element ist)
		if (isEditableElement(document.activeElement)) return true;

		return false;
	}

	async function handleGlobalPaste(event: ClipboardEvent) {
		if (readOnly) return;
		if (isEditableTarget(event)) return;
		if (!columns.length) {
			toast.error('Paste fehlgeschlagen', {
				description: 'Keine Spalten verfügbar.'
			});
			return;
		}

		const columnId = columns[0]?.id;
		if (!columnId) return;
		if (!event.clipboardData) return;

		event.preventDefault();
		const result = await boardStore.handleColumnPaste(columnId, event.clipboardData);
		if (!result.success) {
			console.warn('❌ Paste fehlgeschlagen:', result);
			toast.error('Paste fehlgeschlagen', {
				description: result.debug ? `${result.error} (${result.debug})` : result.error
			});
		}
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		const handler = (event: ClipboardEvent) => {
			handleGlobalPaste(event);
		};
		window.addEventListener('paste', handler);
		return () => {
			window.removeEventListener('paste', handler);
		};
	});

	// Prüfe ob Board horizontal scrollt (zu viele Spalten)
	// Verwende IntersectionObserver für saubere Sticky-Button Logik
	$effect(() => {
		if (!scrollableButtonElement) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				// Sticky button nur zeigen wenn scrollable button NICHT sichtbar ist
				showStickyButton = !entry.isIntersecting;
			},
			{
				root: boardElement,
				threshold: 0.1
			}
		);

		observer.observe(scrollableButtonElement);

		return () => {
			observer.disconnect();
		};
	});
	
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
	readOnly = false
   }: {
	columns: ColumnType[];
	onFinalUpdate: BoardUpdateHandler;
	readOnly?: boolean;
   } = $props();

   // Lokaler State für dndzone: Wird von dndzone mutiert
   let columns = $state([...columns_inner]);
   let isDragging = $state(false);
   let isLocalDnD = $state(false);  // ← NEU: Flag für lokale DnD-Operationen

	 // Wenn der Store einen DnD-Sync hard-fail abbricht, ist der lokale DnD-State
	 // potentiell inkonsistent (UI zeigt Move, Store hat ihn nicht übernommen).
	 // Reset auf Parent/Store-Stand, damit Drag&Drop sofort wieder nutzbar ist.
	 let lastDnDSyncAbortToken = $state(0);
	 $effect(() => {
		 const token = boardStore.dndSyncAbortToken;
		 if (token !== lastDnDSyncAbortToken) {
			 lastDnDSyncAbortToken = token;
			 isDragging = false;
			 isLocalDnD = false;
			 columns = [...columns_inner];
			 console.warn('↩️ Board.svelte: DnD reset after sync hard-fail');
		 }
	 });
   
   // WICHTIG: Synchronisiere columns mit columns_inner (vom Parent)
   // Das ist essentiell für die Reaktivität!
   // Wenn Parent columns_inner ändert (z.B. neue Spalte), muss columns aktualisiert werden
   $effect(() => {
     // ⚡ Nur während DnD blockieren (isDragging ODER isLocalDnD)
     // Sobald isLocalDnD = false → Parent-Änderungen werden wieder synchronisiert
     if (!isDragging && !isLocalDnD) {
       // Vergleiche ob sich die Spalten-Reihenfolge oder IDs geändert haben
       const parentIds = columns_inner.map(c => c.id).join(',');
       const localIds = columns.map(c => c.id).join(',');
       
       if (parentIds !== localIds) {
         console.log('🔄 Board.svelte: Spalten vom Parent synchronisieren', {
           parentIds,
           localIds
         });
         // Aktualisiere mit Spalten vom Parent (neue Reihenfolge ODER neue/gelöschte Spalten)
         columns = [...columns_inner];
       }
     }
   });

	function handleDndConsiderColumns(e: any) {
     isDragging = true;
     isLocalDnD = true;  // ← NEU: Markiere lokale DnD-Operation

		// ⚡ IMPORTANT: svelte-dnd-action kann bei verschachtelten Strukturen (Column.items)
		// transiente/partielle Payloads liefern. Für UI-Rendering akzeptieren wir das,
		// aber für Store-Sync (onFinalUpdate) rekonstruieren wir später eine vollständige Payload.
		// ⚠️ Zusätzlich: niemals Duplikate in die keyed {#each}-Liste lassen (sonst each_key_duplicate).
		const incoming = (e.detail?.items ?? []) as any[];
		const seenIds = new Set<string>();
		const deduped: ColumnType[] = [];
		for (const col of incoming) {
			const rawId = col?.id;
			const id = rawId ? String(rawId) : '';
			if (!id) continue;
			if (id.includes('svelte-dnd-action-shadow') || id.includes('shadow')) continue;
			if (seenIds.has(id)) continue;
			seenIds.add(id);
			deduped.push(col);
		}
		columns = deduped;
  	}

   	function handleDndFinalizeColumns(e: any) {
     isDragging = false;
     const finalItems = e.detail.items;

		// Helper: Stelle sicher, dass das Payload für den Store vollständige Columns inkl. items enthält.
		// Beim Spalten-Reorder brauchen wir semantisch nur die Reihenfolge; Cards dürfen dabei nie „verschwinden“.
		const buildFullColumnsPayload = (items: any[]): ColumnType[] => {
			const idsInOrder = (items ?? [])
				.map((c: any) => String(c?.id ?? ''))
				.filter((id: string) => id && !id.includes('svelte-dnd-action-shadow') && !id.includes('shadow'));

			const seen = new Set<string>();
			const uniqueIds = idsInOrder.filter((id: string) => {
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			});

			const result: ColumnType[] = [];
			for (const id of uniqueIds) {
				// Prefer local state (während DnD aktualisiert), fallback to parent snapshot.
				const source = columns.find((c) => String(c.id) === id) || columns_inner.find((c) => String(c.id) === id);
				if (source) result.push(source);
			}
			return result;
		};
     
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
     
		// ⚡ CRITICAL: Für den Store-Sync IMMER vollständige Columns mit items liefern.
		// Sonst triggert BoardOperations.syncBoardState(strategy='hard-fail') zu Recht den Abort.
		const fullPayload = buildFullColumnsPayload(deduplicated);
		if (fullPayload.length === 0) {
			console.error('❌ Column DnD finalize: empty payload after normalization; aborting onFinalUpdate');
			// UI in einen sicheren Zustand zurücksetzen
			columns = [...columns_inner];
			isLocalDnD = false;
			return;
		}

     if (deduplicated.length !== finalItems.length) {
       console.error(`❌ ${finalItems.length - deduplicated.length} Duplikat(e) gefunden und entfernt`);
     }

		columns = fullPayload;
		onFinalUpdate(fullPayload);
     
     // ⚡ CRITICAL: Warte auf Nostr-Roundtrip, dann erlaube wieder Parent-Sync
     // Grund: onFinalUpdate() → executeSyncBoardState() → publishToNostr() → Echo zurück
     // → triggerUpdate() → uiData neu → würde $effect triggern!
     // Nostr-Roundtrip + delayed cleanup (5s) kann länger dauern
     // In Browser A: Blockiert $effect während eigener Roundtrip
     // In Browser B: Kein isLocalDnD, akzeptiert sofort fremde Updates ✅
     setTimeout(() => {
       isLocalDnD = false;
       console.log('🔓 Board.svelte: isLocalDnD = false (allow parent sync again)');
     }, 2000);  // ← Erhöht auf 2 Sekunden für sicheren Roundtrip
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
	}
	
	function handleCardAction(cardId: string, action: string) {
  		console.log('Card action:', cardId, action);
  		// Handle card actions like complete, edit, etc.
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
		overflow-y: hidden;
		flex: 1 1 auto;
		gap: 0.5em;
		padding: 0.5em;
		/* scroll-behavior: smooth; */ /* Deaktiviert für schnelleres Auto-Scroll während Drag */
		scrollbar-width: thick;  /* Firefox */
		align-items: stretch;  /* Spalten dehnen sich vertikal */
		height: 100%;
		width: 100%;
		position: relative; /* Enables absolute positioning for sticky button */
		background: var(--board-bg, none); /* Subtle theme gradient (active in rpi) */
	}

    /* Dickes Scrollbar in Chrome/Edge/Safari */
    .board::-webkit-scrollbar {
        height: 16px;
    }

    .board::-webkit-scrollbar-track {
        background: var(--muted);
        border-radius: 4px;
    }

    .board::-webkit-scrollbar-thumb {
        background: var(--muted-foreground);
        border-radius: 4px;
    }

    .board::-webkit-scrollbar-thumb:hover {
        background: var(--foreground);
    }

	.column {
		flex: 0 0 320px;  /* fixed width */
		display: flex;
		flex-direction: column;
		padding: 0.5em;
		border-right: 1px solid var(--column-border);
		/* background-color: var(--background); */
		align-items: stretch;
		height: 100%;  /* Nutze volle verfügbare Höhe vom Parent */
		max-height: 100%;
		overflow: hidden;
	}

	.add-column-button {
		flex: 0 0 280px;
		height: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		margin-left: 0.5em;
		margin-top: 4rem;
	}

	.add-column-button button {
		width: 250px;
		height: 64px;
		/* border: 2px dotted var(--accent); */
		border-radius: var(--radius-md);
		background: var(--muted);
		color: var(--foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: all 0.2s ease;
		font-size: 0.9rem;
	}

	.add-column-button button:hover {
		background: var(--accent);
		color: var(--primary-foreground);
		transform: scale(1.05);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	/* Sticky button - appears when scrollable button is not visible */
	.sticky-add-column {
		position: sticky;
		right: 0.5rem;
		top: 50vh;
		transform: translateY(-50%);
		margin-left: auto;
		z-index: 100;
		transition: opacity 0.2s ease, transform 0.2s ease;
		pointer-events: none; /* Allow clicks through the container */
		align-self: center;
	}
	
	.sticky-add-column button {
		pointer-events: auto; /* Re-enable clicks on the button itself */
	}

	.sticky-add-column button {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-md);
		/* border: 1px solid var(--accent); */
		background: var(--muted);
		color: var(--foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.sticky-add-column button:hover {
		background: var(--accent);
		transform: scale(1.1);
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
		color: var(--primary-foreground);
	}

	/* Hide sticky button on mobile screens */
	@media (max-width: 768px) {
		.sticky-add-column {
			display: none;
		}
	}
	
</style>

<section 
	class="board" 
	aria-label="Kanban Board mit Spalten"
	bind:this={boardElement}
	use:dndzone={{items:columns, flipDurationMs, type:'column', dragDisabled: readOnly, dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}, delayTouchStart: 300}} 
	onconsider={handleDndConsiderColumns} 
	onfinalize={handleDndFinalizeColumns}
>
    {#each columns as {id, name, color, items}, idx (id)}
		<div 
			class="column" 
			animate:safeFlip={{ duration: flipDurationMs }}
			use:observeColumnHeight={id}
			style={settings?.alignColumnsToMaxHeight && maxColumnHeight > 0 ? `min-height: ${maxColumnHeight}px;` : ''}
		>
 				<Column
 						name={name}
 						color={color}
 						items={items}
					columnId={id}
 						onDrop={(newItems) => handleItemFinalize(idx, newItems)}
 						onCardAction={handleCardAction}
 						onSidebarAction={handleSidebarAction}
					maxCardsBeforeScroll={settings?.maxCardsBeforeScroll ?? 20}
					readOnly={readOnly}
 					/>
 			</div>
     {/each}
	<!-- Add Column Button - scrolls with board content -->
	{#if !readOnly}
	<div class="add-column-button" bind:this={scrollableButtonElement}>
		<button
			title="Neue Spalte hinzufügen"
			aria-label="Neue Spalte hinzufügen"
			onclick={() => {
				console.log('➕ Adding new column...');
				try {
					boardStore.createColumn('Neue Spalte');
				} catch (error) {
					console.error('❌ Fehler beim Erstellen der Spalte:', error);
					showEditorPermissionToast(
						'Du brauchst Editorrechte, um Spalten zu erstellen.'
					);
				}
			}}
		>
			<SquarePlusIcon class="h-4.5 w-4.5" /> <span class="ml-2">Spalte hinzufügen</span>
		</button>
	</div>
	{/if}
	
	<!-- Sticky Add Column Button - only visible when scrollable button is out of view -->
	{#if !readOnly && showStickyButton}
		<div class="sticky-add-column">
			<button
				title="Neue Spalte hinzufügen"
				aria-label="Neue Spalte hinzufügen"
				onclick={() => {
					console.log('➕ Adding new column (sticky)...');
					try {
						boardStore.createColumn('Neue Spalte');
						// Scroll to the end to show the new column
						if (boardElement) {
							setTimeout(() => {
								if (boardElement) {
									boardElement.scrollLeft = boardElement.scrollWidth;
								}
							}, 100);
						}
					} catch (error) {
						console.error('❌ Fehler beim Erstellen der Spalte:', error);
						showEditorPermissionToast(
							'Du brauchst Editorrechte, um Spalten zu erstellen.'
						);
					}
				}}
			>
				<SquarePlusIcon class="h-6 w-6" />
			</button>
		</div>
	{/if}
</section>