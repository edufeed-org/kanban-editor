<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import * as Tabs from "$lib/components/ui/tabs";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardRole, type BoardShare } from "$lib/types/sharing";
    import TrashIcon from "@lucide/svelte/icons/trash";
    
    // Props
    let { open = $bindable(false) } = $props();
    
    // State
    let newUserPubkey = $state('');
    let selectedRole = $state<{ value: BoardRole; label: string }>({ 
        value: BoardRole.EDITOR, 
        label: 'Editor' 
    });
    let participants = $state<BoardShare[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let activeTab = $state('editors'); // 'editors' | 'viewers'
    
    
    let userRole = $state<BoardRole>(BoardRole.VIEWER);
    let canInviteEditors = $derived(userRole === BoardRole.OWNER);
    
    // Aktuelle Rolle des Nutzers laden
    async function loadUserRole() {
        try {
            const role = await boardStore.getCurrentUserRole();
            userRole = role || BoardRole.VIEWER;
        } catch (error) {
            console.error('Fehler beim Laden der Nutzerrolle:', error);
            userRole = BoardRole.VIEWER;
        }
    }
    

    // Alle Teilnehmer laden
    async function loadParticipants() {
        try {
            participants = await boardStore.getBoardParticipants();
        } catch (error) {
            console.error('Fehler beim Laden der Teilnehmer:', error);
            errorMessage = 'Teilnehmer konnten nicht geladen werden';
        }
    }
    
    // Nutzer einladen
    async function handleInviteUser() {
        if (!newUserPubkey.trim()) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            if (selectedRole.value === BoardRole.EDITOR) {
                await boardStore.addEditor(newUserPubkey);
            } else {
                await boardStore.addViewer(newUserPubkey);
            }
            
            newUserPubkey = '';
            await loadParticipants();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Einladen';
        } finally {
            isLoading = false;
        }
    }
    
    // Nutzer entfernen
    async function handleRemoveUser(pubkey: string, role: BoardRole) {
        if (!confirm('Nutzer wirklich entfernen?')) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            if (role === BoardRole.EDITOR) {
                await boardStore.removeEditor(pubkey);
            } else {
                await boardStore.removeViewer(pubkey);
            }
            
            await loadParticipants();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Entfernen';
        } finally {
            isLoading = false;
        }
    }
    
    // Display Name für Pubkey
    function getDisplayName(pubkey: string): string {
        return authStore.getDisplayNameForPubkey?.(pubkey) || 
               `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
    }
    
    // Filtered participants
    let editorsAndOwners = $derived(participants.filter(p => p.role === 'editor' || p.role === 'owner'));
    let viewers = $derived(participants.filter(p => p.role === 'viewer'));
    
    // Bei Dialog-Öffnung laden
    $effect(() => {
        if (open) {
            loadParticipants();
            loadUserRole();
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Board teilen</Dialog.Title>
            <Dialog.Description>
                Verwalte Editoren und Viewer für dieses Board.
            </Dialog.Description>
        </Dialog.Header>
        
        <!-- Einladung -->
        <div class="space-y-4">
            <div class="flex gap-2">
                <Input 
                    bind:value={newUserPubkey}
                    placeholder="Nostr Public Key (npub oder hex)"
                    disabled={isLoading}
                    class="flex-1"
                />
                <select 
                    bind:value={selectedRole}
                    class="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                {#if canInviteEditors}
                    <option value="editor">Editor</option>
                {/if}
                    <option value="viewer">Viewer</option>
                </select>
                <Button 
                    onclick={handleInviteUser}
                    disabled={isLoading || !newUserPubkey.trim()}
                >
                    Einladen
                </Button>
            </div>
            
            {#if errorMessage}
                <p class="text-sm text-destructive">{errorMessage}</p>
            {/if}
        </div>
        
        <!-- Teilnehmer-Liste -->
        <Tabs.Root bind:value={activeTab} class="mt-6">
            <Tabs.List class="grid w-full grid-cols-2">
                <Tabs.Trigger value="editors">
                    Editoren ({editorsAndOwners.length})
                </Tabs.Trigger>
                <Tabs.Trigger value="viewers">
                    Viewer ({viewers.length})
                </Tabs.Trigger>
            </Tabs.List>
            
            <Tabs.Content value="editors" class="mt-4">
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each editorsAndOwners as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {getDisplayName(participant.pubkey)}
                                </span>
                                <Badge variant={participant.role === 'owner' ? 'default' : 'secondary'}>
                                    {participant.role === 'owner' ? 'Owner' : 'Editor'}
                                </Badge>
                            </div>
                            
                            {#if participant.role !== 'owner'}
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onclick={() => handleRemoveUser(participant.pubkey, participant.role)}
                                    disabled={isLoading}
                                >
                                    <TrashIcon class="h-4 w-4" />
                                </Button>
                            {/if}
                        </div>
                    {/each}
                    
                    {#if editorsAndOwners.length === 0}
                        <p class="text-sm text-muted-foreground text-center py-4">
                            Keine Editoren gefunden
                        </p>
                    {/if}
                </div>
            </Tabs.Content>
            
            <Tabs.Content value="viewers" class="mt-4">
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each viewers as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {getDisplayName(participant.pubkey)}
                                </span>
                                <Badge variant="outline">
                                    Viewer
                                </Badge>
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onclick={() => handleRemoveUser(participant.pubkey, participant.role)}
                                disabled={isLoading}
                            >
                                <TrashIcon class="h-4 w-4" />
                            </Button>
                        </div>
                    {/each}
                    
                    {#if viewers.length === 0}
                        <p class="text-sm text-muted-foreground text-center py-4">
                            Keine Viewer gefunden
                        </p>
                    {/if}
                </div>
            </Tabs.Content>
        </Tabs.Root>
        
        <Dialog.Footer>
            <Button variant="outline" onclick={() => open = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>