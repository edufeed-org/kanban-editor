<script lang="ts">
import { onMount } from 'svelte';
import Board from "./Board.svelte";
import BoardsList from "./BoardsList.svelte";
import LeftSidebarFooter from "./LeftSidebarFooter.svelte";
import Topbar from "./Topbar.svelte";
import type { Column, BoardUpdateHandler } from "./types.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import * as Resizable from "$lib/components/ui/resizable/index.js";
import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
import { toast } from "svelte-sonner";

	// Suppress passive event listener warnings for dnd-action
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
		
		<!-- Rechte Sidebar (KI & Debug) - nur rendern wenn offen -->
		{#if rightSidebarOpen}
			<Resizable.Pane 
				defaultSize={15} 
				minSize={10} 
				maxSize={40} 
				class="border-l bg-muted/10 overflow-y-auto"
				onResize={(size: number) => { rightSidebarSize = size; }}
			>
				<div class="p-4 space-y-6">
					<div>
						<h2 class="text-sm font-semibold mb-2">Board Status</h2>
						<div class="space-y-1 text-xs text-muted-foreground">
							<p>Spalten: {stats.columnsCount}</p>
							<p>Karten: {stats.cardsCount}</p>
							{#if stats.selectedColumn}
								<p class="text-primary">Spalte: {stats.selectedColumn}</p>
							{/if}
							{#if stats.selectedCard}
								<p class="text-primary">Karte: {stats.selectedCard}</p>
							{/if}
							{#if selectedCardHierarchy}
								<div class="mt-3 pt-3 border-t border-muted">
									<p class="text-xs font-semibold text-foreground mb-2">📍 Kartenhierarchie:</p>
									<div class="space-y-1">
										<p><span class="font-semibold">Board:</span> {selectedCardHierarchy.boardId}</p>
										<p><span class="font-semibold">Spalte:</span> {selectedCardHierarchy.columnName}</p>
										<p><span class="font-semibold">Karte:</span> {selectedCardHierarchy.cardName}</p>
									</div>
								</div>
							{/if}
						</div>
					</div>
					
					<Separator />
					
					<div>
						<h2 class="text-sm font-semibold mb-2">KI-Agent</h2>
						<p class="text-xs text-muted-foreground mb-3">
							Der KI-Agent kann Inhalte organisieren und Verbesserungen vorschlagen.
						</p>
						<Button variant="outline" class="w-full bg-primary" size="sm">
							KI-Agent aktivieren
						</Button>
					</div>
				</div>
			</Resizable.Pane>
		{/if}
	</Resizable.PaneGroup>
</div>