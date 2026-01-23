<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Card from "$lib/components/ui/card";
    import * as RadioGroup from "$lib/components/ui/radio-group";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Label } from "$lib/components/ui/label";
    import { Separator } from "$lib/components/ui/separator";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardSharingOperations } from "$lib/stores/boardstore/sharing";
    import { Board } from "$lib/classes/BoardModel";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { getContext } from "svelte";
    import type NDK from "@nostr-dev-kit/ndk";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import CalendarIcon from "@lucide/svelte/icons/calendar";
    import UserIcon from "@lucide/svelte/icons/user";
    import CopyIcon from "@lucide/svelte/icons/copy";
    import CopyPlusIcon from "@lucide/svelte/icons/copy-plus";
    import { resolve } from "$app/paths";
    
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
    
    // Import-Modus: 'watch' = folgen ohne Kopie, 'fork' = eigene Kopie erstellen
    type ImportMode = 'watch' | 'fork';
    let selectedMode = $state<ImportMode>('fork');
    
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
    
    // Board folgen ODER forken
    async function handleAction() {
        if (!boardId || !boardAuthor) {
            toast.error('Fehler', { description: 'Board-Daten unvollständig' });
            return;
        }
        
        // Prüfen ob User eingeloggt ist
        const currentUser = authStore.getPubkey();
        if (!currentUser) {
            toast.error('Nicht eingeloggt', {
                description: 'Bitte zuerst einloggen'
            });
            return;
        }
        
        isLoading = true;
        errorMessage = '';
        
        try {
            if (selectedMode === 'watch') {
                // Board folgen UND laden (in einem Schritt)
                const success = await boardStore.followAndLoadBoard(boardId, boardAuthor);
                
                if (!success) {
                    throw new Error('Board konnte nicht geladen werden');
                }
                
                toast.success('Board gefolgt!', {
                    description: 'Das Board wurde geöffnet'
                });
            } else {
                // Fork: Eigene Kopie erstellen
                if (!boardPreview) {
                    throw new Error('Board-Vorschau nicht geladen');
                }
                
                // Board als JSON serialisieren und mit 'new' Modus importieren
                // Das setzt automatisch den aktuellen User als Owner
                const boardJson = JSON.stringify(boardPreview.getContextData(true));
                const result = boardStore.importBoardFromJson(boardJson, 'new');
                
                if (!result.success || !result.board) {
                    throw new Error(result.error || 'Fehler beim Erstellen der Kopie');
                }
                
                // Board speichern
                boardStore.saveImportedBoard(result.board, false);
                
                toast.success('Board geforkt!', {
                    description: 'Eine eigene Kopie wurde erstellt'
                });
            }
            
            // Zum Board navigieren
            open = false;
            goto(resolve('/cardsboard', {}));
            
        } catch (error: any) {
            errorMessage = error.message || 'Fehler';
            toast.error('Fehler', { description: errorMessage });
            console.error('❌ Fehler:', error);
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
            <Dialog.Title>Board importieren</Dialog.Title>
            <Dialog.Description>
                Wähle wie du mit diesem Board arbeiten möchtest.
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
                            <span>Erstellt von: {authStore.getDisplayNameForPubkey?.(boardAuthor) || boardAuthor.slice(0, 8) + '...' + boardAuthor.slice(-4)}</span>
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
            
            <!-- Import-Modus Auswahl -->
            <div class="mt-4 space-y-3">
                <Label class="text-sm font-medium">Import-Modus:</Label>
                <RadioGroup.Root bind:value={selectedMode} class="space-y-2">
                    <!-- Fork Option (Standard) -->
                    <label for="mode-fork" class="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroup.Item value="fork" id="mode-fork" class="mt-0.5" />
                        <div class="flex-1">
                            <span class="font-medium flex items-center gap-2">
                                <CopyPlusIcon class="h-4 w-4" />
                                Eigene Kopie erstellen (Fork)
                            </span>
                            <p class="text-xs text-muted-foreground mt-1">
                                Erstellt eine vollständige Kopie. Du wirst Owner und kannst frei bearbeiten.
                            </p>
                        </div>
                    </label>
                    
                    <Separator class="my-2" />
                    
                    <!-- Watch Option -->
                    <label for="mode-watch" class="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                        <RadioGroup.Item value="watch" id="mode-watch" class="mt-0.5" />
                        <div class="flex-1">
                            <span class="font-medium flex items-center gap-2">
                                <EyeIcon class="h-4 w-4" />
                                Nur Beobachten
                            </span>
                            <p class="text-xs text-muted-foreground mt-1">
                                Board folgen (read-only). Änderungen des Owners erscheinen automatisch.
                            </p>
                        </div>
                    </label>
                </RadioGroup.Root>
            </div>
        {:else}
            <div class="p-8 text-center text-muted-foreground">
                <p>Board-Vorschau wird geladen...</p>
            </div>
        {/if}
        
        <Dialog.Footer class="gap-2">
            <Button variant="outline" onclick={() => open = false} disabled={isLoading}>
                Abbrechen
            </Button>
            <Button onclick={handleAction} disabled={isLoading || !!errorMessage || !boardPreview}>
                {#if isLoading}
                    Verarbeite...
                {:else if selectedMode === 'fork'}
                    Board forken
                {:else}
                    Board folgen
                {/if}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
