<script lang="ts">
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import LinkIcon from '@lucide/svelte/icons/link';
    import PlusIcon from '@lucide/svelte/icons/plus';
    import Loader2Icon from '@lucide/svelte/icons/loader-2';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';

    let { columnId }: { columnId: string } = $props();

    let url = $state('');
    let isLoading = $state(false);

    async function handleSubmit() {
        if (!url.trim()) {
            toast.error('Bitte eine URL eingeben');
            return;
        }

        isLoading = true;

        try {
            // Simuliere ClipboardData mit der URL
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', url.trim());

            const result = await boardStore.handleColumnPaste(columnId, dataTransfer);

            if (result.success) {
                toast.success('Karte erstellt', {
                    description: `${result.type} wurde verarbeitet`
                });
                // Reset
                url = '';
            } else {
                toast.error('Fehler beim Erstellen', {
                    description: result.error || 'Unbekannter Fehler'
                });
            }
        } catch (error) {
            console.error('[LinkAddPopover] Error:', error);
            toast.error('Fehler', {
                description: error instanceof Error ? error.message : 'Unbekannter Fehler'
            });
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter' && !isLoading) {
            event.preventDefault();
            handleSubmit();
        }
    }
</script>

<div class="space-y-4">
    <div class="space-y-2">
        <h4 class="font-medium text-sm">Link hinzufügen</h4>
        <p class="text-xs text-muted-foreground">
            Füge eine URL ein, um eine neue Karte zu erstellen.
        </p>
    </div>

    <div class="space-y-3">
        <!-- URL Input -->
        <div class="space-y-2">
            <Label for="link-url">URL</Label>
            <Input
                id="link-url"
                type="url"
                placeholder="https://..."
                bind:value={url}
                onkeydown={handleKeydown}
                disabled={isLoading}
            />
        </div>

        <!-- Submit Button -->
        <Button
            class="w-full"
            onclick={handleSubmit}
            disabled={isLoading || !url.trim()}
        >
            {#if isLoading}
                <Loader2Icon class="h-4 w-4 mr-2 animate-spin" />
                Verarbeite...
            {:else}
                <PlusIcon class="h-4 w-4 mr-2" />
                Karte erstellen
            {/if}
        </Button>
    </div>
</div>
