<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardSharingOperations } from "$lib/stores/boardstore/sharing";
    import { Board, type BoardProps } from "$lib/classes/BoardModel";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { getContext } from "svelte";
    import type NDK from "@nostr-dev-kit/ndk";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import CalendarIcon from "@lucide/svelte/icons/calendar";
    import UserIcon from "@lucide/svelte/icons/user";
    
    // Get NDK from context (set in +layout.svelte)
    const ndk = getContext<NDK>('ndk');
    
    // Props
    let { 
        open = $bindable(false),
        boardId,
        boardAuthor
    }: { 
        open?: boolean;
        boardId: string;
        boardAuthor: string;
    } = $props();
    
    // State
    let isLoading = $state(false);
    let boardPreview = $state<Board | null>(null);
    let errorMessage = $state('');
    
    // Board-Vorschau laden von Nostr
    async function loadBoardPreview() {
        if (!boardId || !boardAuthor) {
            errorMessage = 'Board-ID oder Autor fehlt';
            return;
        }
        
        if (!ndk) {
            errorMessage = 'NDK nicht initialisiert - bitte warten';
            return;
        }
        
        isLoading = true;
        errorMessage = '';
        
        try {
            console.log(`🔍 Lade Board-Vorschau: ${boardId} von ${boardAuthor}`);
            
            // Board Event von Nostr laden
            const boardProps = await BoardSharingOperations.fetchBoardFromNostr(
                boardId,
                boardAuthor,
                ndk
            );
            
            if (!boardProps) {
                errorMessage = 'Board nicht gefunden';
                boardPreview = null;
                return;
            }
            
            // Board-Instanz erstellen für Vorschau
            boardPreview = new Board(boardProps);
            console.log('✅ Board-Vorschau geladen:', boardPreview);
            
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Laden der Board-Vorschau';
            console.error('❌ Fehler beim Laden der Board-Vorschau:', error);
        } finally {
            isLoading = false;
        }
    }
    
    // Board folgen
    async function handleFollowBoard() {
        if (!boardId || !boardAuthor) {
            toast.error('Fehler', { description: 'Board-Daten unvollständig' });
            return;
        }
        
        // Prüfen ob User eingeloggt ist
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            toast.error('Nicht eingeloggt', {
                description: 'Bitte zuerst einloggen um dem Board zu folgen'
            });
            return;
        }
        
        isLoading = true;
        errorMessage = '';
        
        try {
            // Board folgen UND laden (in einem Schritt)
            const success = await boardStore.followAndLoadBoard(boardId, boardAuthor);
            
            if (!success) {
                throw new Error('Board konnte nicht geladen werden');
            }
            
            toast.success('Board gefolgt!', {
                description: 'Das Board wurde geöffnet'
            });
            
            // Zum Board navigieren (Board ist bereits geladen!)
            open = false;
            goto('/cardsboard');
            
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Folgen des Boards';
            toast.error('Fehler', { description: errorMessage });
            console.error('❌ Fehler beim Folgen:', error);
        } finally {
            isLoading = false;
        }
    }
    
    // Bei Dialog-Öffnung laden
    $effect(() => {
        if (open) {
            loadBoardPreview();
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>Board folgen</Dialog.Title>
            <Dialog.Description>
                Möchtest du diesem Board folgen? Es wird dann in deiner Board-Liste erscheinen.
            </Dialog.Description>
        </Dialog.Header>
        
        {#if isLoading}
            <div class="flex items-center justify-center py-8">
                <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        {:else if errorMessage}
            <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <p class="text-sm text-destructive">{errorMessage}</p>
            </div>
        {:else if boardPreview}
            <!-- Board-Vorschau -->
            <Card.Root class="mt-4">
                <Card.Header>
                    <Card.Title>{boardPreview.name}</Card.Title>
                    {#if boardPreview.description}
                        <Card.Description>{boardPreview.description}</Card.Description>
                    {/if}
                </Card.Header>
                
                <Card.Content class="space-y-3">
                    <!-- Board-Metadaten -->
                    <div class="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div class="flex items-center gap-2">
                            <UserIcon class="h-4 w-4" />
                            <span>Erstellt von: {authStore.getDisplayNameForPubkey?.(boardAuthor) || boardAuthor.slice(0, 8) + '...'}</span>
                        </div>
                        
                        {#if boardPreview.columns}
                            <div class="flex items-center gap-2">
                                <EyeIcon class="h-4 w-4" />
                                <span>{boardPreview.columns.length} Spalten</span>
                            </div>
                        {/if}
                        
                        {#if boardPreview.updatedAt}
                            <div class="flex items-center gap-2">
                                <CalendarIcon class="h-4 w-4" />
                                <span>Aktualisiert: {new Date(boardPreview.updatedAt).toLocaleDateString('de-DE')}</span>
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Spalten-Vorschau -->
                    {#if boardPreview.columns && boardPreview.columns.length > 0}
                        <div class="space-y-2">
                            <p class="text-sm font-medium">Spalten:</p>
                            <div class="flex flex-wrap gap-2">
                                {#each boardPreview.columns as column}
                                    <Badge variant="outline">{column.name}</Badge>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </Card.Content>
            </Card.Root>
        {:else}
            <div class="p-8 text-center text-muted-foreground">
                <p>Board-Vorschau wird geladen...</p>
            </div>
        {/if}
        
        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={() => open = false} disabled={isLoading}>
                Abbrechen
            </Button>
            <Button onclick={handleFollowBoard} disabled={isLoading || !!errorMessage}>
                {isLoading ? 'Folge...' : 'Board folgen'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
