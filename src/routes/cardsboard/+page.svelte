<script lang="ts">
	import { onMount } from 'svelte';
	import { data } from "./data.js";
	import Board from "./Board.svelte";
	import Topbar from "./Topbar.svelte";
	import HeaderBar from "./HeaderBar.svelte";
	import type { Column, BoardUpdateHandler } from "./types.js";

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
</script>

<div class="flex h-screen flex-col">
	<!-- Topbar -->
	<Topbar />
	
	<!-- Main Layout -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Linke Sidebar -->
		<aside class="w-64 border-r bg-muted/10 p-4 overflow-y-auto">
			<div class="space-y-4">
				<h2 class="text-sm font-semibold">Meine Boards</h2>
				<div class="space-y-2">
					<button class="w-full text-left rounded-md bg-primary/10 px-3 py-2 text-sm hover:bg-primary/20">
						{boardMeta.title}
					</button>
				</div>
				<button class="w-full rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted">
					+ Neues Board
				</button>
			</div>
		</aside>
		
		<!-- Hauptbereich -->
		<main class="flex-1 flex flex-col overflow-hidden">
			<!-- Board Header -->
			<HeaderBar {boardMeta} />
			
			<!-- Board Content -->
			<div class="flex-1 overflow-auto p-4">
				<Board columns={$data} onFinalUpdate={handleBoardUpdated} />
			</div>
		</main>
		
		<!-- Rechte Sidebar (KI & Debug) -->
		<aside class="w-80 border-l bg-muted/10 p-4 overflow-y-auto">
			<div class="space-y-6">
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
				
				<div>
					<h2 class="text-sm font-semibold mb-2">KI-Agent</h2>
					<p class="text-xs text-muted-foreground mb-3">
						Der KI-Agent kann Inhalte organisieren und Verbesserungen vorschlagen.
					</p>
					<button class="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted">
						KI-Agent aktivieren
					</button>
				</div>
			</div>
		</aside>
	</div>
</div>
