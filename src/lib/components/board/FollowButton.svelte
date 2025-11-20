<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardRole } from "$lib/types/sharing";
    import HeartIcon from "@lucide/svelte/icons/heart";
    import HeartOffIcon from "@lucide/svelte/icons/heart-off";
    
    // Props
    let { boardId } = $props<{ boardId: string }>();
    
    // State
    let isFollowing = $state(false);
    let userRole = $state<BoardRole>(BoardRole.VIEWER);
    let isLoading = $state(false);
    let isAuthenticated = $state(false);
    
    // Status laden
    async function loadFollowStatus() {
        try {
            const role = await boardStore.getCurrentUserRole();
            userRole = role || BoardRole.VIEWER;
            isAuthenticated = authStore.isAuthenticated;
            
            // Prüfen ob Nutzer das Board folgt (als Viewer)
            const participants = await boardStore.getBoardParticipants();
            const currentPubkey = authStore.getPubkey();
            
            if (currentPubkey) {
                const userParticipation = participants.find(p => p.pubkey === currentPubkey);
                isFollowing = userParticipation?.role === BoardRole.VIEWER;
            }
        } catch (error) {
            console.error('Fehler beim Laden des Follow-Status:', error);
            userRole = BoardRole.VIEWER;
        }
    }
    
    // Follow/Unfollow
    async function handleToggleFollow() {
        if (!isAuthenticated) {
            // TODO: Login-Dialog öffnen
            alert('Bitte melden Sie sich an, um Boards zu folgen.');
            return;
        }
        
        isLoading = true;
        
        try {
            const currentPubkey = authStore.getPubkey();
            if (!currentPubkey) return;
            
            if (isFollowing) {
                await boardStore.removeViewer(currentPubkey);
                isFollowing = false;
            } else {
                await boardStore.addViewer(currentPubkey);
                isFollowing = true;
            }
        } catch (error: any) {
            console.error('Fehler beim Follow/Unfollow:', error);
            alert(error.message || 'Aktion fehlgeschlagen');
        } finally {
            isLoading = false;
        }
    }
    
    // Initial load
    $effect(() => {
        loadFollowStatus();
    });
    
    // Nur anzeigen wenn Nutzer nicht Owner/Editor ist
    let showFollowButton = $derived(isAuthenticated && 
                         userRole !== BoardRole.OWNER && 
                         userRole !== BoardRole.EDITOR);
</script>

{#if showFollowButton}
    <Button 
        variant={isFollowing ? "default" : "outline"} 
        size="sm" 
        onclick={handleToggleFollow}
        disabled={isLoading}
        class="gap-2"
    >
        {#if isFollowing}
            <HeartIcon class="h-4 w-4" />
            Folge ich
        {:else}
            <HeartOffIcon class="h-4 w-4" />
            Folgen
        {/if}
    </Button>
{/if}