<script lang="ts">
import { onMount } from 'svelte';
import { replaceState } from '$app/navigation';
import Board from "./Board.svelte";
import BoardsList from "./BoardsList.svelte";
import LeftSidebarFooter from "./LeftSidebarFooter.svelte";
import Topbar from "./Topbar.svelte";
import ImportPopover from "$lib/components/ImportPopover.svelte";
import FollowBoardDialog from "$lib/components/board/FollowBoardDialog.svelte";
import AIPanel from "./AIPanel.svelte";
import type { Column } from "./types.js";
import * as Resizable from "$lib/components/ui/resizable/index.js";
import * as Sheet from "$lib/components/ui/sheet/index.js";
import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
import { toast } from "svelte-sonner";
import { authStore } from '$lib';

	// Reference to ImportPopover component for share-link preview
	let importPopoverComponent: any;
	
	// Share-Link Dialog State
	let showFollowDialog = $state(false);
	let shareLinkBoardId = $state<string>('');
	let shareLinkBoardAuthor = $state<string>('');
	
	// Mobile detection (screens < 768px are considered mobile)
	let isMobile = $state(false);

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
			const shareBoardId = params.get('share');
			const shareAuthor = params.get('author');
			
			// Share-Link Detection: ?share={boardId}&author={authorPubkey}
			if (shareBoardId && shareAuthor) {
				console.log('🔗 Board Share-Link erkannt:', shareBoardId);
				shareLinkBoardId = shareBoardId;
				shareLinkBoardAuthor = shareAuthor;
				showFollowDialog = true;
				
				// Clean up URL parameters
				replaceState(window.location.pathname + window.location.hash, {});
				return;
			}
			
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

	// Hook 3: Auto-load comments for all cards when board is ready
	// 🚀 Phase 4B: UX Improvement - Batch-load all comments automatically
	// ✅ CORRECT: onMount for initial data loading (runs ONCE)
	onMount(async () => {
		try {
			// Wait a bit for board to be fully loaded from storage
			// (boardStore.uiData is reactive and loads from localStorage in constructor)
			await new Promise(resolve => setTimeout(resolve, 500));
			
			const boardId = boardStore.getCurrentBoardId();
			if (boardId) {
				console.log('🚀 Auto-loading comments for all cards in board...');
				await boardStore.loadAllComments();
				console.log('✅ All comments loaded automatically');
			}
		} catch (error) {
			console.error('❌ Error auto-loading comments:', error);
		}
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
				toast.error('Keine Berechtigung', {
					description: 'Du musst angemeldet sein und Maintainer dieses Boards sein, um Änderungen durchzuführen.'
				});
				lastToastTime = now;
			} else {
				console.log('⏭️ Toast übersprungen (Debounce)');
			}
		}
	}



	// Debug Stats
	let stats = $derived({
		columnsCount: columns.length,
		cardsCount: columns.reduce((sum, col) => sum + col.items.length, 0)
	});

	// Sidebar states - jetzt mit Größen
	let leftSidebarOpen = $state(true);
	let rightSidebarOpen = $state(false);
	let leftSidebarSize = $state(20);
	let rightSidebarSize = $state(15);
	
	// Auto-close sidebars on mobile
	$effect(() => {
		if (isMobile) {
			leftSidebarOpen = false;
		}
	});
	
	// Funktionen zum Toggle mit Größenänderung
	function toggleLeftSidebar() {
		if (leftSidebarOpen) {
			leftSidebarSize = 0;
		} else {
			leftSidebarSize = 20;
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
	
	{#if isMobile}
		<!-- Mobile Layout: Sidebars as overlay sheets -->
		<main class="flex flex-1 flex-col overflow-hidden">
			<Topbar
				title={boardTitle}
				boardMeta={{
					title: boardTitle,
					description: '',
					tags: []
				}}
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
			<Sheet.Content side="left" class="w-[280px] sm:w-[320px] p-0">
				<div class="p-4 h-full flex flex-col overflow-hidden">
					<Sheet.Header class="mb-4">
						<Sheet.Title>Meine Boards</Sheet.Title>
					</Sheet.Header>
					<div class="flex-1 overflow-y-auto min-h-0">
						<BoardsList {currentBoardId} />
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
		<!-- Desktop Layout: Resizable sidebars -->
		<Resizable.PaneGroup direction="horizontal" class="flex-1 overflow-hidden">
			<!-- Linke Sidebar - nur rendern wenn offen -->
			{#if leftSidebarOpen}
				<Resizable.Pane 
					defaultSize={20} 
					minSize={15} 
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
					<Topbar
						title={boardTitle}
						boardMeta={{
							title: boardTitle,
							description: '',
							tags: []
						}}
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
	{/if}
</div>

<!-- ImportPopover Component (hidden, used for share-link preview) -->
<ImportPopover bind:this={importPopoverComponent} />

<!-- FollowBoardDialog Component (shown when user opens share link) -->
<FollowBoardDialog 
	bind:open={showFollowDialog}
	boardId={shareLinkBoardId}
	boardAuthor={shareLinkBoardAuthor}
/>