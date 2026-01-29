<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import ShareDialog from "./ShareDialog.svelte";
    import MenuItem from "../../../routes/cardsboard/MenuItem.svelte";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { BoardRole } from "$lib/types/sharing";
    import { toast } from "svelte-sonner";
    import ShareIcon2 from "@lucide/svelte/icons/share-2";
    import HeartIcon from "@lucide/svelte/icons/heart";
    import EyeOffIcon from "@lucide/svelte/icons/eye-off";
    import HeartOffIcon from "@lucide/svelte/icons/heart-off";
    
    // Props for customization
    let {
        variant = 'default' as 'default' | 'ghost',
        class: className = '',
        showLabel = false
    }: {
        variant?: 'default' | 'ghost';
        class?: string;
        showLabel?: boolean;
    } = $props();
    
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
{#if isOwnerOrEditor}
    <!-- Owner/Editor sehen Share-Button -->
    <MenuItem
        icon={ShareIcon2}
        label="Board teilen"
        onclick={() => showShareDialog = true}
        showBorder={false}
    />
{:else if isViewer}
    <!-- Viewer sehen Unfollow-Button -->
    <MenuItem
        icon={EyeOffIcon}
        label={isLoading ? 'Lädt...' : 'Ausblenden'}
        onclick={handleToggleFollow}
        disabled={isLoading}
        showBorder={false}
    />
{:else}
    <!-- Non-participant sehen Follow-Button -->
    <MenuItem
        icon={HeartIcon}
        label={isLoading ? 'Lädt...' : 'Beobachten'}
        onclick={handleToggleFollow}
        disabled={isLoading}
        showBorder={false}
    />
{/if}

<!-- Share Dialog (nur für Owner/Editor) -->
{#if isOwnerOrEditor}
    <ShareDialog bind:open={showShareDialog} />
{/if}