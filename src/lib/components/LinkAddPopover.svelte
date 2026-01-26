<script lang="ts">
    import * as Popover from '$lib/components/ui/popover/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import LinkIcon from '@lucide/svelte/icons/link';
    import PlusIcon from '@lucide/svelte/icons/plus';
    import Loader2Icon from '@lucide/svelte/icons/loader-2';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';

    let open = $state(false);
    let url = $state('');
    let isLoading = $state(false);
    let selectedColumnId = $state<string | undefined>(undefined);

    // Spalten aus dem Store
    let columns = $derived(boardStore.uiData);

    // Erste Spalte als Default
    $effect(() => {
        if (columns.length > 0 && !selectedColumnId) {
            selectedColumnId = columns[0].id;
        }
    });

    async function handleSubmit() {
        if (!url.trim()) {
            toast.error('Bitte eine URL eingeben');
            return;
        }

        if (!selectedColumnId) {
            toast.error('Bitte eine Spalte auswählen');
            return;
        }

        isLoading = true;

        try {
            // Simuliere ClipboardData mit der URL
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', url.trim());

            const result = await boardStore.handleColumnPaste(selectedColumnId, dataTransfer);

            if (result.success) {
                toast.success('Karte erstellt', {
                    description: `${result.type} wurde verarbeitet`
                });
                // Reset & Schließen
                url = '';
                open = false;
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

<Popover.Root bind:open>
    <Popover.Trigger>
        <Button variant="outline" size="sm" class="gap-1.5 h-8">
            <PlusIcon class="h-3.5 w-3.5" />
            <LinkIcon class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Link</span>
        </Button>
    </Popover.Trigger>
    <Popover.Content class="w-80" align="end">
        <div class="space-y-4">
            <div class="space-y-2">
                <h4 class="font-medium leading-none">Link hinzufügen</h4>
                <p class="text-sm text-muted-foreground">
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

                <!-- Column Selection -->
                <div class="space-y-2">
                    <Label for="link-column">Spalte</Label>
                    <select
                        id="link-column"
                        bind:value={selectedColumnId}
                        disabled={isLoading}
                        class="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {#each columns as column (column.id)}
                            <option value={column.id} class="bg-background text-foreground">{column.name}</option>
                        {/each}
                    </select>
                </div>

                <!-- Submit Button -->
                <Button
                    class="w-full"
                    onclick={handleSubmit}
                    disabled={isLoading || !url.trim() || !selectedColumnId}
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
    </Popover.Content>
</Popover.Root>
