<script lang="ts">
	import { onMount } from 'svelte';
	import { data } from "./data.js";
	import Board from "./Board.svelte";
	import Topbar from "./Topbar.svelte";
	import HeaderBar from "./HeaderBar.svelte";
	import type { Column, BoardUpdateHandler } from "./types.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
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
	}
	
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

	// Sidebar states
	let leftSidebarOpen = $state(true);
	let rightSidebarOpen = $state(true);

</script>

<!-- Topbar mit integrierten Sidebar-Triggern -->
<div class="flex h-screen w-full flex-col overflow-hidden">
	<Topbar 
		onToggleLeftSidebar={() => leftSidebarOpen = !leftSidebarOpen}
		onToggleRightSidebar={() => rightSidebarOpen = !rightSidebarOpen}
	/>
	
	<!-- Main Layout with simple collapsible sidebars -->
	<div class="flex flex-1 overflow-hidden min-h-0">
		<!-- Linke Sidebar -->
		<aside class={cn(
			"border-r bg-muted/10 overflow-y-auto transition-all duration-300 shrink-0",
			leftSidebarOpen ? "w-64" : "w-0"
		)}>
			{#if leftSidebarOpen}
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
			{/if}
		</aside>
		
		<!-- Hauptbereich -->
		<main class="flex flex-1 flex-col overflow-hidden min-w-0">
			<!-- Board Header (jetzt UNTER der Topbar) -->
			<HeaderBar {boardMeta} />
			
			<!-- Board Content - hier ist der einzige Scroll -->
			<div class="flex-1 overflow-auto p-4 min-h-0">
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
		
		<!-- Rechte Sidebar (KI & Debug) -->
		<aside class={cn(
			"border-l bg-muted/10 overflow-y-auto transition-all duration-300 shrink-0",
			rightSidebarOpen ? "w-80" : "w-0"
		)}>
			{#if rightSidebarOpen}
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
			{/if}
		</aside>
	</div>
</div>