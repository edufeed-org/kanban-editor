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

    // Abgeleitete Boards-Liste (mit Filterung + geteilte Boards)
    let filteredBoards = $derived.by(() => {
        // ⚡ KRITISCH: updateTrigger für Reaktivität!
        // Ohne dies wird die Liste nicht aktualisiert bei neuen Boards von Nostr
        const trigger = boardStore.updateTrigger;
        
        // Eigene Boards + Boards bei denen User Maintainer/Follower ist
        const ownBoards = boardStore.filterBoards(searchQuery);
        const sharedBoards = boardStore.filterSharedBoards(searchQuery);
        
        // Füge isShared: false zu eigenen Boards hinzu
        const enrichedOwnBoards = ownBoards.map(board => ({
            ...board,
            isShared: false,
            userRole: 'owner'
        }));
        
        // Kombiniere beide Listen und entferne Duplikate
        const allBoards = [...enrichedOwnBoards, ...sharedBoards];
        const uniqueBoards = allBoards.filter((board, index, self) => 
            index === self.findIndex(b => b.id === board.id)
        );
        
        // console.log(`🔍 Filtered boards: ${uniqueBoards.length} (own: ${ownBoards.length}, shared: ${sharedBoards.length}, query: "${searchQuery}", trigger: ${trigger})`);
        return uniqueBoards;
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

    // Event: Demo-Session für anonyme Benutzer erstellen
    async function handleCreateDemoSession() {
        isCreating = true;
        try {
            // Demo-Session erstellen
            authStore.createDemoSession();
            console.log('✅ Demo-Session erstellt');
            
            // ⚡ FIX: Triggere Board-Migration und Liste-Update
            boardStore.onAuthChanged();
            
            // Demo-Board sollte jetzt automatisch geladen werden
            const demoBoards = boardStore.getAllBoards();
            if (demoBoards.length > 0) {
                const demoBoardId = demoBoards[0].id;
                boardStore.loadBoard(demoBoardId);
                currentBoardId = demoBoardId;
                console.log('✅ Demo-Board geladen:', demoBoardId);
            }
        } catch (error) {
            console.error('❌ Fehler beim Erstellen der Demo-Session:', error);
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

    // Event: Board löschen oder verlassen
    async function handleDeleteBoard(boardId: string, event: Event) {
        event.stopPropagation();
        
        // Finde das Board in der gefilterten Liste um isShared und userRole zu prüfen
        const targetBoard = filteredBoards.find(b => b.id === boardId);
        const isShared = targetBoard?.isShared || false;
        const userRole = targetBoard?.userRole || 'owner';
        
        const actionText = isShared 
            ? (userRole === 'owner' ? 'Board löschen' : 'Board verlassen')
            : 'Board löschen';
            
        const warningText = isShared && userRole !== 'owner'
            ? '⚠️ Dieses Board wirklich verlassen? Sie verlieren den Zugang!'
            : '⚠️ Dieses Board wirklich löschen? Die Aktion kann nicht rückgängig gemacht werden!';
        
        if (!confirm(warningText)) {
            return;
        }
        
        try {
            if (isShared && userRole !== 'owner') {
                // Board verlassen: Nutzer aus Maintainer/Follower Liste entfernen
                await boardStore.leaveBoard(boardId);
                console.log('🚪 Board verlassen:', boardId);
            } else {
                // Normales Löschen (eigenes Board oder Owner von geteiltem Board)
                boardStore.deleteBoard(boardId);
                console.log('🗑️ Board gelöscht:', boardId);
            }
            
            // Wenn das gelöschte Board das aktuelle war, wird loadBoard() automatisch ein anderes laden
            if (boardId === currentBoardId) {
                const remaining = boardStore.getAllBoards();
                if (remaining.length > 0) {
                    currentBoardId = remaining[0].id;
                }
            }
        } catch (error) {
            console.error('❌ Fehler beim Löschen/Verlassen:', error);
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
    <!-- Neues Board Button für authentifizierte Benutzer -->
    {#if authStore.isAuthenticated }
        <Button
            onclick={handleCreateBoard}
            disabled={isCreating}
            class="w-full gap-2"
            variant="default"
            data-testid="create-board-button"
        >
            {#if isCreating}
                <LoaderIcon class="h-4 w-4 animate-spin" />
            {:else}
                <SquarePlusIcon class="h-4 w-4" />
            {/if}
            Neues Board
        </Button>

        <Separator />
    {:else}
        <!-- Demo-Board Button für anonyme Benutzer -->
        <Button
            onclick={handleCreateDemoSession}
            disabled={isCreating}
            class="w-full gap-2"
            variant="outline"
            data-testid="demo-board-button"
        >
            {#if isCreating}
                <LoaderIcon class="h-4 w-4 animate-spin" />
            {:else}
                <CircleIcon class="h-4 w-4" />
            {/if}
            🎯 Demo ausprobieren
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
        {#if filteredBoards.length === 0 && !authStore.isAuthenticated}
            <div class="flex flex-col items-center justify-center h-32 text-xs text-muted-foreground text-center space-y-2">
                <p>👋 Willkommen!</p>
                <p>Probieren Sie unsere Demo aus</p>
                <p>oder melden Sie sich an.</p>
            </div>
        {:else if filteredBoards.length === 0}
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
                            
                            <!-- Shared Board Indicator -->
                            {#if board.isShared}
                                <span class="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] flex-shrink-0">
                                    {board.userRole === 'editor' ? '✏️' : '👁️'}
                                </span>
                            {/if}
                            
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
                    
                    <!-- Delete Button (nur für eigene Boards oder wenn User Owner ist) -->
                    {#if !board.isShared || board.userRole === 'owner'}
                        <div
                            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <button
                                onclick={(e) => handleDeleteBoard(board.id, e)}
                                class="p-1 rounded transition-colors
                                    {isActive 
                                        ? 'hover:bg-primary-foreground/20 text-primary-foreground' 
                                        : 'hover:bg-destructive hover:text-destructive-foreground'}"
                                title={board.isShared ? 'Board verlassen' : 'Board löschen'}
                                type="button"
                            >
                                <TrashIcon class="h-4 w-4" />
                            </button>
                        </div>
                    {/if}
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
