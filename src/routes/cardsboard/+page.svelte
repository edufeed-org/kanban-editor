<script lang="ts">
import { onMount } from 'svelte';
import { data } from "./data.js";
import Board from "./Board.svelte";
import Topbar from "./Topbar.svelte";
import type { Column, BoardUpdateHandler } from "./types.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Resizable from "$lib/components/ui/resizable/index.js";
	import { cn } from "$lib/utils.js";

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

	function handleBoardUpdated(newColumnsData: Column[]) {
		data.set(newColumnsData);
	}

	// State für Selection
	let selectedColumn = $state<string | null>(null);
	let selectedCard = $state<string | null>(null);
	
	function handleSelectColumn(columnId: string) {
		selectedColumn = selectedColumn === columnId ? null : columnId;
		selectedCard = null; // Clear card selection when selecting column
	}
	
	function handleSelectCard(cardId: string) {
		selectedCard = selectedCard === cardId ? null : cardId;
		selectedColumn = null; // Clear column selection when selecting card
	}

	// Helper-Funktion: Findet die vollständige Hierarchie einer Karte
	function getCardHierarchy(cardId: string | null) {
		if (!cardId) return null;

		for (const column of $data) {
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
	// Board-Metadaten
	let boardMeta = $state({
		title: 'Mein Projekt Board',
		description: 'Projektmanagement mit KI-Unterstützung',
		tags: ['development', 'svelte', 'nostr']
	});

	// Debug Stats
	let stats = $derived({
		columnsCount: $data.length,
		cardsCount: $data.reduce((sum, col) => sum + col.items.length, 0),
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
				<div class="p-4 space-y-4">
					<h2 class="text-sm font-semibold">Meine Boards</h2>
					<div class="space-y-2">
						<button class="w-full text-left rounded-md bg-primary/10 px-3 py-2 text-sm hover:bg-primary/20">
							{boardMeta.title}
						</button>
					</div>
					<Separator />
					<button class="w-full rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted">
						+ Neues Board
					</button>
				</div>
			</Resizable.Pane>
			
			<Resizable.Handle withHandle />
		{/if}
		
		<!-- Hauptbereich -->
		<Resizable.Pane defaultSize={70} minSize={40} class="flex flex-col overflow-hidden">
			<main class="flex flex-1 flex-col overflow-hidden min-w-0">
		<!-- Topbar mit integrierten Sidebar-Triggern -->
		<Topbar
			title={boardMeta.title}
			{boardMeta}
			onToggleLeftSidebar={toggleLeftSidebar}
			onToggleRightSidebar={toggleRightSidebar}
		/>			<!-- Board Content - hier ist der einzige Scroll -->
			<div class="flex-1 overflow-auto p-0 min-h-0">
					<Board 
						columns={$data} 
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
						<Button variant="outline" class="w-full" size="sm">
							KI-Agent aktivieren
						</Button>
					</div>
				</div>
			</Resizable.Pane>
		{/if}
	</Resizable.PaneGroup>
</div>