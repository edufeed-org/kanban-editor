<script lang="ts">
import { onMount } from 'svelte';
import { replaceState } from '$app/navigation';
import Board from "./Board.svelte";
import BoardsList from "./BoardsList.svelte";
import LeftSidebarFooter from "./LeftSidebarFooter.svelte";
import Topbar from "./Topbar.svelte";
import ImportPopover from "$lib/components/ImportPopover.svelte";
import AIPanel from "./AIPanel.svelte";
import type { Column, BoardUpdateHandler } from "./types.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import * as Resizable from "$lib/components/ui/resizable/index.js";
import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
import { toast } from "svelte-sonner";

	// Reference to ImportPopover component for share-link preview
	let importPopoverComponent: any;

	// ============================================================================
	// LIFECYCLE: ONMOUNT HOOKS (Browser API calls - only once per component mount)
	// ============================================================================

	// Hook 1: Suppress passive event listener warnings for dnd-action
	// ✅ CORRECT: onMount for one-time side effects
	onMount(() => {
		const originalWarn = console.warn;
		console.warn = function(...args) {
			const message = String(args[0] || '');
			if (message.includes('non-passive event listener') ||
				message.includes('Added non-passive event listener') ||
				message.includes('scroll-blocking') ||
				message.includes('touchstart') ||
				message.includes('touchmove')) {
				return;
			}
			originalWarn.apply(console, args);
		};
	});

	// Hook 2: Handle share-link import via ?import=<token> parameter
	// ✅ CORRECT: onMount for URL parameter detection (runs ONCE)
	// ❌ DO NOT USE $effect.root here - would re-run on every store update!
	// ⚠️ FIX: Wait for ImportPopover component to mount before proceeding (polling mechanism)
	onMount(async () => {
		try {
			const params = new URL(window.location.href).searchParams;
			const token = params.get('import');
			
			if (token) {
				// ⏳ Wait for ImportPopover component to mount (race condition fix)
				// Problem: onMount runs BEFORE template components are mounted
				// Solution: Poll until importPopoverComponent is defined (max 5 seconds)
				let attempts = 0;
				const maxAttempts = 50; // 100ms * 50 = 5 seconds
				
				while (!importPopoverComponent && attempts < maxAttempts) {
					await new Promise(resolve => setTimeout(resolve, 100));
					attempts++;
				}
				
				if (importPopoverComponent) {
					// ✅ NOW safe to proceed - component is mounted
					console.log('🔗 Share-Link erkannt, zeige Preview-Dialog...');
					const success = await importPopoverComponent.showShareLinkImportDialog(token);
					
					if (success) {
						// Clean up URL param only after successful dialog show
						// Use SvelteKit's replaceState instead of history.replaceState
						replaceState(window.location.pathname + window.location.hash, {});
					} else {
						toast.error('Fehler beim Parsen des Share-Link-Tokens');
					}
				} else {
					console.error('❌ ImportPopover component nicht gefunden (timeout nach 5s)');
					toast.error('Fehler: Import-Komponente nicht bereit');
				}
			}
		} catch (e) {
			console.error('Fehler beim Verarbeiten des Import-Tokens:', e);
		}
	});

	// Konvertiere boardStore.uiData in das Format, das Board.svelte erwartet
	let columns = $derived.by(() => {
		return boardStore.uiData;
	});

	// Aktuelles Board Meta
	let currentBoardId = $derived(boardStore.getCurrentBoardId());
	let boardMeta = $derived(boardStore.getCurrentBoardMeta());
	
	// 🔥 WICHTIG: Direkter reaktiver Zugriff für Topbar!
	// Damit Svelte erkennt, dass sich der Titel geändert hat
	let boardTitle = $derived(boardStore.getCurrentBoardMeta().name);

	// Debounce-State für Toast-Benachrichtigungen
	let lastToastTime = 0;
	const TOAST_DEBOUNCE_MS = 1000; // 1 Sekunde

	function handleBoardUpdated(newColumnsData: Column[]) {
		// Synchronisiere kompletten Board-State: Spalten UND Karten-Positionen
		console.log('📋 handleBoardUpdated - Synchronisiere Board-State');
		const success = boardStore.syncBoardState(newColumnsData);
		
		// Wenn keine Berechtigung: Zeige Toast-Warnung (mit Debounce)
		if (!success) {
			const now = Date.now();
			// Zeige Toast nur, wenn letzter Toast > 1 Sekunde her ist
			if (now - lastToastTime > TOAST_DEBOUNCE_MS) {
				toast.error('Keine Berechtigung', {
					description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Änderungen durchzuführen.'
				});
				lastToastTime = now;
			} else {
				console.log('⏭️ Toast übersprungen (Debounce)');
			}
		}
	}

	// State für Selection
	let selectedColumn = $state<string | null>(null);
	let selectedCard = $state<string | null>(null);
	
	function handleSelectColumn(columnId: string) {
		selectedColumn = selectedColumn === columnId ? null : columnId;
		selectedCard = null; // Clear card selection when selecting column
	}
	
	function handleSelectCard(cardId: string) {
		console.log('🎯 handleSelectCard called:', cardId, 'current selectedCard:', selectedCard);
		// Toggle: Wenn gleiche Karte, deselektieren; sonst selektieren
		selectedCard = selectedCard === cardId ? null : cardId;
		selectedColumn = null; // Clear column selection when selecting card
		console.log('✅ selectedCard now:', selectedCard);
	}

	// Helper-Funktion: Findet die vollständige Hierarchie einer Karte
	function getCardHierarchy(cardId: string | null) {
		if (!cardId) return null;

		for (const column of columns) {
			const card = column.items.find(item => String(item.id) === String(cardId));
			if (card) {
				return {
					boardId: card.boardId || "board-1",
					columnId: card.columnId || column.id,
					columnName: column.name,
					cardId: card.id,
					cardName: card.name
				};
			}
		}
		return null;
	}

	// Abgeleitete Hierarchie-Info
	let selectedCardHierarchy = $derived(getCardHierarchy(selectedCard));

	// Debug Stats
	let stats = $derived({
		columnsCount: columns.length,
		cardsCount: columns.reduce((sum, col) => sum + col.items.length, 0),
		selectedColumn,
		selectedCard
	});

	// Sidebar states - jetzt mit Größen
	let leftSidebarOpen = $state(true);
	let rightSidebarOpen = $state(true);
	let leftSidebarSize = $state(15);
	let rightSidebarSize = $state(15);
	
	// Funktionen zum Toggle mit Größenänderung
	function toggleLeftSidebar() {
		if (leftSidebarOpen) {
			leftSidebarSize = 0;
		} else {
			leftSidebarSize = 15;
		}
		leftSidebarOpen = !leftSidebarOpen;
	}
	
	function toggleRightSidebar() {
		if (rightSidebarOpen) {
			rightSidebarSize = 0;
		} else {
			rightSidebarSize = 15;
		}
		rightSidebarOpen = !rightSidebarOpen;
	}

</script>

<style>
	/* Verhindere jegliches Scrolling auf der Seite */
	:global(html, body) {
		overflow: hidden !important;
		height: 100vh;
	}
</style>

<div class="flex h-screen w-full flex-col overflow-hidden">
	
	<!-- Main Layout with resizable sidebars -->
	<Resizable.PaneGroup direction="horizontal" class="flex-1 overflow-hidden">
		<!-- Linke Sidebar - nur rendern wenn offen -->
		{#if leftSidebarOpen}
			<Resizable.Pane 
				defaultSize={15} 
				minSize={10} 
				maxSize={40} 
				class="border-r bg-muted/10 overflow-y-auto"
				onResize={(size: number) => { leftSidebarSize = size; }}
			>
				<div class="p-4 h-full flex flex-col overflow-hidden">
					<h2 class="text-sm font-semibold mb-4">Meine Boards</h2>
					<div class="flex-1 overflow-y-auto min-h-0">
						<BoardsList {currentBoardId} />
					</div>
					<LeftSidebarFooter />
				</div>
			</Resizable.Pane>
			
			<Resizable.Handle withHandle />
		{/if}
		
		<!-- Hauptbereich -->
		<Resizable.Pane defaultSize={70} minSize={40} class="flex flex-col overflow-hidden">
			<main class="flex flex-1 flex-col overflow-hidden min-w-0">
		<!-- Topbar mit integrierten Sidebar-Triggern -->
		<Topbar
			title={boardTitle}
			boardMeta={{
				title: boardTitle,
				description: '',
				tags: []
			}}
			onToggleLeftSidebar={toggleLeftSidebar}
			onToggleRightSidebar={toggleRightSidebar}
		/>			<!-- Board Content - KEIN Scroll hier, nur im Board selbst -->
			<div class="flex-1 overflow-hidden p-0 min-h-0">
					<Board 
						columns={columns} 
						onFinalUpdate={handleBoardUpdated}
						{selectedColumn}
						{selectedCard}
						onSelectColumn={handleSelectColumn}
						onSelectCard={handleSelectCard}
					/>
				</div>
			</main>
		</Resizable.Pane>
		
		<!-- Handle zwischen Main und rechter Sidebar -->
		{#if rightSidebarOpen}
			<Resizable.Handle withHandle />
		{/if}
		
		<!-- Rechte Sidebar (KI-Agent) - nur rendern wenn offen -->
		{#if rightSidebarOpen}
			<Resizable.Pane 
				defaultSize={20} 
				minSize={15} 
				maxSize={50} 
				class="border-l bg-background"
				onResize={(size: number) => { rightSidebarSize = size; }}
			>
				<AIPanel boardId={currentBoardId} />
			</Resizable.Pane>
		{/if}
	</Resizable.PaneGroup>
</div>

<!-- ImportPopover Component (hidden, used for share-link preview) -->
<ImportPopover bind:this={importPopoverComponent} />