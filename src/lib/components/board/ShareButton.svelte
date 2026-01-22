<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import ShareDialog from "./ShareDialog.svelte";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { BoardRole } from "$lib/types/sharing";
    import { toast } from "svelte-sonner";
    import ShareIcon from "@lucide/svelte/icons/share";
    import HeartIcon from "@lucide/svelte/icons/heart";
    import HeartOffIcon from "@lucide/svelte/icons/heart-off";
    
    // State
    let showShareDialog = $state(false);
    let isLoading = $state(false);
    
    // User Role (reactive)
    let userRole = $derived(boardStore.getCurrentUserRole());
    let isOwnerOrEditor = $derived(
        userRole === BoardRole.OWNER || userRole === BoardRole.EDITOR
    );
    let isViewer = $derived(userRole === BoardRole.VIEWER);
    
    // Follow/Unfollow Handler
    async function handleToggleFollow() {
        const board = boardStore.data;
        if (!board) {
            toast.error('Fehler', { description: 'Kein Board geladen' });
            return;
        }
        
        isLoading = true;
        try {
            if (isViewer) {
                // Unfollow
                await boardStore.unfollowBoard(board.id, board.author || '');
            } else {
                // Follow
                await boardStore.followBoard(board.id, board.author || '');
            }
        } catch (error: any) {
            toast.error('Fehler', { description: error.message || 'Aktion fehlgeschlagen' });
        } finally {
            isLoading = false;
        }
    }
</script>

<!-- Conditional Button based on user role -->
<div class="flex items-center gap-2">
    {#if isOwnerOrEditor}
        <!-- Owner/Editor sehen Share-Button -->
        <Button 
            variant="ghost" 
            size="sm" 
            onclick={() => showShareDialog = true}
            class="gap-2"
            data-testid="share-button"
        >
            <ShareIcon class="h-4 w-4" />
        </Button>
    {:else if isViewer}
        <!-- Viewer sehen Unfollow-Button -->
        <Button 
            variant="ghost" 
            size="sm" 
            onclick={handleToggleFollow}
            disabled={isLoading}
            class="gap-2"
            data-testid="unfollow-button"
        >
            <HeartOffIcon class="h-4 w-4" />
            {isLoading ? 'Lädt...' : 'Entfolgen'}
        </Button>
    {:else}
        <!-- Non-participant sehen Follow-Button -->
        <Button 
            variant="ghost" 
            size="sm" 
            onclick={handleToggleFollow}
            disabled={isLoading}
            class="gap-2"
            data-testid="follow-button"
        >
            <HeartIcon class="h-4 w-4" />
            {isLoading ? 'Lädt...' : 'Folgen'}
        </Button>
    {/if}
</div>

<!-- Share Dialog (nur für Owner/Editor) -->
{#if isOwnerOrEditor}
    <ShareDialog bind:open={showShareDialog} />
{/if}