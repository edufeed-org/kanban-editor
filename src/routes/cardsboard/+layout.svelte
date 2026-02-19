<script lang="ts">
/**
 * Shared Layout für /cardsboard/ und /cardsboard/[naddr]/
 * Enthält: Topbar, Left Sidebar (BoardsList), Right Sidebar (AI), Board-Rendering
 * Child-Pages liefern nur Overlays/Dialogs via {@render children()}
 */
import { onMount, onDestroy } from 'svelte';
import Board from "./Board.svelte";
import BoardsList from "./BoardsList.svelte";
import LeftSidebarFooter from "./LeftSidebarFooter.svelte";
import Topbar from "./Topbar.svelte";
import AIPanel from "./AIPanel.svelte";
import type { Column } from "./types.js";
import * as Resizable from "$lib/components/ui/resizable/index.js";
import * as Sheet from "$lib/components/ui/sheet/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
import { aiContextStore, type ContextCard } from '$lib/stores/aiContextStore.svelte.js';
import { showEditorPermissionToast } from '$lib/utils/permissionToast';
import { toast } from "svelte-sonner";
import MenuIcon from '@lucide/svelte/icons/menu';

let { children } = $props();

// Hamburger Menu State für Board-Einstellungen
let hamburgerMenuOpen = $state(false);

// Mobile detection (screens < 768px are considered mobile)
let isMobile = $state(false);

// ==========================================================================
// GLOBAL AI CONTEXT EVENT HANDLER
// Muss global sein, damit es auch funktioniert wenn AIPanel geschlossen ist
// ==========================================================================
function handleGlobalAddCardToContext(e: CustomEvent<ContextCard>) {
	const newCard = e.detail;
	const added = aiContextStore.addCard(newCard);
	if (added) {
		toast.success(`"${newCard.cardName}" zum KI-Kontext hinzugefügt`);
	} else {
		toast.info(`Karte ist bereits im KI-Kontext`);
	}
}

// ============================================================================
// LIFECYCLE: ONMOUNT HOOKS (Browser API calls - only once per component mount)
// ============================================================================

// Hook 0: Globaler Event-Listener für AI-Kontext (funktioniert auch bei geschlossener Sidebar)
onMount(() => {
	window.addEventListener('addCardToAIContext', handleGlobalAddCardToContext as EventListener);
});

onDestroy(() => {
	if (typeof window !== 'undefined') {
		window.removeEventListener('addCardToAIContext', handleGlobalAddCardToContext as EventListener);
	}
});

// Hook 1: Suppress passive event listener warnings for dnd-action
// ✅ CORRECT: onMount for one-time side effects
onMount(() => {
	const originalWarn = console.warn;
	console.warn = function(...args: any[]) {
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

// Hook 4: Mobile detection and responsive listener
onMount(() => {
	const checkMobile = () => {
		isMobile = window.innerWidth < 768;
	};
	
	// Initial check
	checkMobile();
	
	// Listen for resize events
	window.addEventListener('resize', checkMobile);
	
	// Cleanup
	return () => {
		window.removeEventListener('resize', checkMobile);
	};
});

// Konvertiere boardStore.uiData in das Format, das Board.svelte erwartet
let columns = $derived.by(() => {
	return boardStore.uiData;
});

// Aktuelles Board Meta
let currentBoardId = $derived(boardStore.getCurrentBoardId());

// 🔥 WICHTIG: Direkter reaktiver Zugriff für Topbar!
// Damit Svelte erkennt, dass sich der Titel geändert hat
let boardTitle = $derived(boardStore.getCurrentBoardMeta().name);

// Auto-load comments reactively when board changes
let lastCommentLoadBoardId = '';
$effect(() => {
	const bid = currentBoardId;
	if (bid && bid !== lastCommentLoadBoardId) {
		lastCommentLoadBoardId = bid;
		boardStore.loadAllComments()
			.then(() => console.log('✅ All comments loaded'))
			.catch((err: unknown) => console.error('❌ Error loading comments:', err));
	}
});

// Background subscriptions for comment live updates across the whole board
let unsubscribeAllComments: (() => void) | null = null;
$effect(() => {
	const boardId = currentBoardId;
	if (!boardId) return;

	unsubscribeAllComments?.();
	unsubscribeAllComments = boardStore.subscribeToAllComments();

	return () => {
		unsubscribeAllComments?.();
		unsubscribeAllComments = null;
	};
});

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
			showEditorPermissionToast(
				'Du brauchst Editorrechte, um Änderungen durchzuführen.'
			);
			lastToastTime = now;
		} else {
			console.log('⏭️ Toast übersprungen (Debounce)');
		}
	}
}

// Debug Stats
let stats = $derived({
	columnsCount: columns.length,
	cardsCount: columns.reduce((sum: number, col: any) => sum + col.items.length, 0)
});

// Sidebar states
let leftSidebarOpen = $state(true);
let rightSidebarOpen = $state(false);

// Auto-close left sidebar on mobile
$effect(() => {
	if (isMobile) {
		leftSidebarOpen = false;
	}
});

// Toggle-Funktionen
function toggleLeftSidebar() {
	leftSidebarOpen = !leftSidebarOpen;
}

function toggleRightSidebar() {
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
	
	{#if isMobile}
		<!-- Mobile Layout: Sidebars as overlay sheets -->
		<main class="flex flex-1 flex-col overflow-hidden">
			<Topbar
				onToggleLeftSidebar={toggleLeftSidebar}
				onToggleRightSidebar={toggleRightSidebar}
				{isMobile}
			/>
			
			<div class="flex-1 overflow-hidden p-0 min-h-0">
				<Board 
					columns={columns} 
					onFinalUpdate={handleBoardUpdated}
				/>
			</div>
		</main>
		
		<!-- Left Sidebar Sheet (Mobile) -->
		<Sheet.Root bind:open={leftSidebarOpen}>
			<Sheet.Content side="left" class="w-[280px] sm:w-[320px] p-0 [&>button]:hidden flex flex-col">
				<!-- Header mit Titel und Menü-Button -->
				<div class="px-4 py-3 border-b-4 flex items-center justify-between shrink-0">
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8 hamburger-menu-button bg-primary text-primary-foreground"
						title="Board Einstellungen"
						onclick={() => { hamburgerMenuOpen = !hamburgerMenuOpen; }}
					>
						<MenuIcon class="h-4 w-4" />
					</Button>
					<div class="flex items-center gap-2">
						<h2 class="font-semibold">Kanban-Editor</h2>
					</div>
				</div>
				<!-- Content Bereich - flex-1 für den restlichen Platz -->
				<div class="flex-1 flex flex-col overflow-hidden">
					<div class="flex-1 overflow-y-auto min-h-0 p-2">
						<BoardsList {currentBoardId} bind:hamburgerMenuOpen />
					</div>
					<LeftSidebarFooter />
				</div>
			</Sheet.Content>
		</Sheet.Root>
		
		<!-- Right Sidebar Sheet (Mobile) -->
		<Sheet.Root bind:open={rightSidebarOpen}>
			<Sheet.Content side="right" class="w-[320px] sm:w-[380px] p-0">
				<Sheet.Header class="p-4 border-b">
					<Sheet.Title>KI-Assistent</Sheet.Title>
				</Sheet.Header>
				<AIPanel boardId={currentBoardId} />
			</Sheet.Content>
		</Sheet.Root>
		
	{:else}
		<!-- Desktop Layout: Left sidebar fixed, Main+Right resizable -->
		<div class="flex flex-1 overflow-hidden">
			
			<!-- Linke Sidebar (Board-Liste) - feste Breite, außerhalb der PaneGroup -->
			{#if leftSidebarOpen}
				<aside class="w-[320px] border-r-2 bg-background flex flex-col shrink-0">
					<!-- Header mit Titel und Menü-Button -->
					<div class="px-4 py-3 border-b-2 flex items-center justify-between shrink-0">
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 bg-primary text-primary-foreground hamburger-menu-button"
							title="Board Einstellungen"
							onclick={() => { hamburgerMenuOpen = !hamburgerMenuOpen; }}
						>
							<MenuIcon class="h-4 w-4" />
						</Button>
						<div class="flex items-center gap-2">
							<h2 class="font-semibold">Kanban-Editor</h2>
						</div>
					</div>
					<!-- Content Bereich -->
					<div class="flex-1 flex flex-col overflow-hidden">
						<div class="flex-1 overflow-y-auto min-h-0 p-2">
							<BoardsList {currentBoardId} bind:hamburgerMenuOpen />
						</div>
						<LeftSidebarFooter />
					</div>
				</aside>
			{/if}
			
			<!-- Main + Rechte Sidebar als separate PaneGroup -->
			<Resizable.PaneGroup direction="horizontal" class="flex-1 overflow-hidden">
				<!-- Hauptbereich -->
				<Resizable.Pane defaultSize={rightSidebarOpen ? 75 : 100} minSize={50} class="flex flex-col overflow-hidden">
					<main class="flex flex-1 flex-col overflow-hidden min-w-0">
						<Topbar
							onToggleLeftSidebar={toggleLeftSidebar}
							onToggleRightSidebar={toggleRightSidebar}
							{isMobile}
						/>
						
						<div class="flex-1 overflow-hidden p-0 min-h-0">
							<Board 
								columns={columns} 
								onFinalUpdate={handleBoardUpdated}
							/>
						</div>
					</main>
				</Resizable.Pane>
				
				{#if rightSidebarOpen}
					<!-- Handle zwischen Main und rechter Sidebar -->
					<Resizable.Handle withHandle />
					
					<!-- Rechte Sidebar (KI-Agent) - resizable -->
					<Resizable.Pane 
						defaultSize={25} 
						minSize={15} 
						maxSize={50}
						class="bg-background border-l-2"
					>
						<AIPanel boardId={currentBoardId} />
					</Resizable.Pane>
				{/if}
			</Resizable.PaneGroup>
		</div>
	{/if}
</div>

<!-- Child page content (Dialogs, Overlays, ImportPopover etc.) -->
{@render children()}
