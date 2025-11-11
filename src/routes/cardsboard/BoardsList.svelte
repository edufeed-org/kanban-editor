<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { authStore } from '$lib/index.js';

    import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
    import TrashIcon from '@lucide/svelte/icons/trash';
    import LoaderIcon from '@lucide/svelte/icons/loader';
    import CircleIcon from '@lucide/svelte/icons/circle';
    import SquareArrowRight from '@lucide/svelte/icons/square-arrow-right';
    import ImportPopover from '$lib/components/ImportPopover.svelte';

    // Props
    let { currentBoardId = '' }: { currentBoardId?: string } = $props();

    // State
    let searchQuery = $state('');
    let isCreating = $state(false);
    let isLoading = $state(false);

    // Abgeleitete Boards-Liste (mit Filterung)
    let filteredBoards = $derived.by(() => {
        // ⚡ KRITISCH: updateTrigger für Reaktivität!
        // Ohne dies wird die Liste nicht aktualisiert bei neuen Boards von Nostr
        const trigger = boardStore.updateTrigger;
        
        const results = boardStore.filterBoards(searchQuery);
        console.log(`🔍 Filtered boards: ${results.length} (query: "${searchQuery}", trigger: ${trigger})`);
        return results;
    });

    // Event: Neues Board erstellen
    async function handleCreateBoard() {
        isCreating = true;
        try {
            const newBoardId = boardStore.createBoard('Neues Board');
            console.log('✅ Board erstellt:', newBoardId);
            
            // Lade das neue Board
            boardStore.loadBoard(newBoardId);
            currentBoardId = newBoardId;
            
            // Optional: Reset Suchfeld
            searchQuery = '';
        } catch (error) {
            console.error('❌ Fehler beim Erstellen:', error);
        } finally {
            isCreating = false;
        }
    }

    // Event: Board auswählen/laden
    async function handleSelectBoard(boardId: string) {
        if (boardId === currentBoardId) {
            console.log('📌 Board bereits aktiv:', boardId);
            return;
        }
        
        isLoading = true;
        try {
            const success = boardStore.loadBoard(boardId);
            if (success) {
                currentBoardId = boardId;
                console.log('✅ Board geladen:', boardId);
            }
        } catch (error) {
            console.error('❌ Fehler beim Laden:', error);
        } finally {
            isLoading = false;
        }
    }

    // Event: Board löschen
    async function handleDeleteBoard(boardId: string, event: Event) {
        event.stopPropagation();
        
        if (!confirm('⚠️ Dieses Board wirklich löschen? Die Aktion kann nicht rückgängig gemacht werden!')) {
            return;
        }
        
        try {
            boardStore.deleteBoard(boardId);
            console.log('🗑️ Board gelöscht:', boardId);
            
            // Wenn das gelöschte Board das aktuelle war, wird loadBoard() automatisch ein anderes laden
            if (boardId === currentBoardId) {
                const remaining = boardStore.getAllBoards();
                if (remaining.length > 0) {
                    currentBoardId = remaining[0].id;
                }
            }
        } catch (error) {
            console.error('❌ Fehler beim Löschen:', error);
        }
    }

    // Formatierung: Datum
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Gestern';
        } else {
            return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
        }
    }
</script>

<div class="flex flex-col gap-3 h-full overflow-hidden">
    {#if authStore.isAuthenticated }
    <!-- Neues Board Button -->
    <Button
        onclick={handleCreateBoard}
        disabled={isCreating}
        class="w-full gap-2"
        variant="default"
    >
        {#if isCreating}
            <LoaderIcon class="h-4 w-4 animate-spin" />
        {:else}
            <SquarePlusIcon class="h-4 w-4" />
        {/if}
        Neues Board
    </Button>

    <Separator />
    {/if}

    <!-- Suchfeld -->
    <div class="m-2 flex-shrink-0">
        <Input
            type="text"
            placeholder="Boards suchen..."
            bind:value={searchQuery}
            class="h-9"
        />
    </div>

    <!-- Boards-Liste -->
    <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
        {#if filteredBoards.length === 0}
            <div class="flex items-center justify-center h-32 text-xs text-muted-foreground">
                {#if searchQuery.trim()}
                    Keine Boards gefunden
                {:else}
                    Noch keine Boards
                {/if}
            </div>
        {:else}
            {#each filteredBoards as board (board.id)}
                {@const isActive = currentBoardId === board.id}
                <div
                    class="w-full rounded-md px-3 py-2 text-sm transition-all group relative
                        {isActive
                            ? 'active-board'
                            : ''}"
                >
                    <button
                        onclick={() => handleSelectBoard(board.id)}
                        disabled={isLoading}
                        class="w-full text-left pr-10"
                        title={isActive ? '✅ Aktives Board' : 'Board laden'}
                    >
                        <!-- Board Name mit Unseen Changes Badge -->
                        <div class="font-medium truncate flex items-center gap-2 board-title">
                            {#if isActive}
                                <!-- Active indicator icon -->
                                <!-- <SquareArrowRight class="active-board-indicator"/> -->
                            {/if}
                            {board.name}
                            {#if board.hasUnseenChanges && !isActive}
                                <CircleIcon 
                                    class="h-2 w-2 fill-accent text-accent animate-pulse flex-shrink-0" 
                                    
                                />
                            {/if}
                        </div>
                        
                        <!-- Description (optional) -->
                        {#if board.description}
                            <div class="text-xs opacity-75 truncate">
                                {board.description}
                            </div>
                        {/if}
                        
                        <!-- Erstellungs-Datum -->
                        <div class="text-xs opacity-60 mt-1">
                            {formatDate(board.createdAt)}
                        </div>
                    </button>
                    
                    <!-- Delete Button (als absolute positioned overlay) -->
                    <div
                        class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <button
                            onclick={(e) => handleDeleteBoard(board.id, e)}
                            class="p-1 rounded transition-colors
                                {isActive 
                                    ? 'hover:bg-primary-foreground/20 text-primary-foreground' 
                                    : 'hover:bg-destructive hover:text-destructive-foreground'}"
                            title="Board löschen"
                            type="button"
                        >
                            <TrashIcon class="h-4 w-4" />
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
    <!-- Import Popover -->
    <ImportPopover />

</div>

<style>
    div {
        --apply-flex: true;
    }
</style>
