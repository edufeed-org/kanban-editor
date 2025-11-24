<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import ShareDialog from "./ShareDialog.svelte";
    import ShareIcon from "@lucide/svelte/icons/share";
    
    // Props
    let { boardId } = $props<{ boardId: string }>();
    
    // State
    let showShareDialog = $state(false);
</script>

<!-- Share-Button in Header -->
<div class="flex items-center gap-2">
    <Button 
        variant="ghost" 
        size="sm" 
        onclick={() => showShareDialog = true}
        class="gap-2"
        data-testid="share-button"
    >
        <ShareIcon class="h-4 w-4" />
        Teilen
    </Button>
</div>

<!-- Share Dialog -->
<ShareDialog bind:open={showShareDialog}  />