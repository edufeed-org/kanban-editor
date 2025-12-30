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
    import CopyIcon from "@lucide/svelte/icons/copy";
    import CheckIcon from "@lucide/svelte/icons/check";
    import { toast } from "svelte-sonner";
    
    // Props
    let { open = $bindable(false) } = $props();
    
    // State
    let newEditorPubkey = $state('');
    let participants = $state<BoardShare[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let activeTab = $state('share-link'); // 'share-link' | 'editors'
    let shareLink = $state('');
    let linkCopied = $state(false);
    
    let userRole = $state<BoardRole>(BoardRole.VIEWER);
    let canInviteEditors = $derived(userRole === BoardRole.OWNER);

    let leaveRequestsByPubkey = $state<Record<string, { eventId: string; createdAt?: number }>>({});
    
    // Cache for display names
    let displayNameCache = $state<Record<string, string>>({});
    
    // Share-Link generieren
    function generateShareLink(): string {
        const boardId = boardStore.data?.id;
        const boardAuthor = boardStore.data?.author;
        
        if (!boardId || !boardAuthor) return '';
        
        const baseUrl = window.location.origin;
        // Format: /board?id=xxx&author=yyy
        return `${baseUrl}/cardsboard?share=${boardId}&author=${boardAuthor}`;
    }
    
    // Link kopieren
    async function copyShareLink() {
        try {
            await navigator.clipboard.writeText(shareLink);
            linkCopied = true;
            toast.success('Link kopiert!', {
                description: 'Der Share-Link wurde in die Zwischenablage kopiert'
            });
            setTimeout(() => linkCopied = false, 2000);
        } catch {
            toast.error('Fehler beim Kopieren', {
                description: 'Link konnte nicht kopiert werden'
            });
        }
    }
    
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
            // Load display names for all participants
            await loadDisplayNames();
        } catch (error) {
            console.error('Fehler beim Laden der Teilnehmer:', error);
            errorMessage = 'Teilnehmer konnten nicht geladen werden';
        }
    }
    
    // Display names für alle Teilnehmer laden
    async function loadDisplayNames() {
        for (const participant of participants) {
            if (!displayNameCache[participant.pubkey]) {
                try {
                    const profile = await authStore.fetchProfileFromPubkey(participant.pubkey);
                    if (profile?.name || profile?.displayName || profile?.display_name) {
                        // Reassign entire object to trigger reactivity
                        displayNameCache = {
                            ...displayNameCache,
                            [participant.pubkey]: profile.displayName || profile.name || ''
                        };
                    }
                } catch (error) {
                    console.warn('Could not fetch profile for', participant.pubkey, error);
                }
            }
        }
    }

    async function loadLeaveRequestsIfOwner() {
        if (!canInviteEditors) {
            leaveRequestsByPubkey = {};
            return;
        }

        try {
            leaveRequestsByPubkey = await boardStore.getLeaveRequestsForCurrentBoard();
        } catch (error) {
            console.warn('⚠️ Leave-Requests konnten nicht geladen werden (best-effort):', error);
            leaveRequestsByPubkey = {};
        }
    }
    
    // Editor einladen
    async function handleInviteEditor() {
        if (!newEditorPubkey.trim()) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.addEditor(newEditorPubkey);
            newEditorPubkey = '';
            await loadParticipants();
            toast.success('Editor hinzugefügt', {
                description: 'Der Nutzer kann jetzt das Board bearbeiten'
            });
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Einladen';
            toast.error('Fehler', { description: errorMessage });
        } finally {
            isLoading = false;
        }
    }
    
    // Editor entfernen
    async function handleRemoveEditor(pubkey: string) {
        if (!confirm('Editor wirklich entfernen?')) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.removeEditor(pubkey);
            await loadParticipants();
            toast.success('Editor entfernt');
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Entfernen';
            toast.error('Fehler', { description: errorMessage });
        } finally {
            isLoading = false;
        }
    }
    
    // Display Name für Pubkey (reactive derived)
    let participantsWithNames = $derived(
        participants.map(participant => {
            let displayName = '';
            
            // Check cache first
            if (displayNameCache[participant.pubkey]) {
                displayName = displayNameCache[participant.pubkey];
            }
            // Try authStore method (if available)
            else if (authStore.getDisplayNameForPubkey) {
                const name = authStore.getDisplayNameForPubkey(participant.pubkey);
                if (name && name !== participant.pubkey) {
                    displayName = name;
                }
            }
            // Check if it's the current user
            else if (participant.pubkey === authStore.getPubkey()) {
                const userName = authStore.getUserName();
                if (userName) displayName = userName;
            }
            
            // Fallback: shortened pubkey
            if (!displayName) {
                displayName = `${participant.pubkey.slice(0, 8)}...${participant.pubkey.slice(-4)}`;
            }
            
            return {
                ...participant,
                displayName
            };
        })
    );
    
    // Filtered participants
    let editorsAndOwners = $derived(participantsWithNames.filter(p => p.role === 'editor' || p.role === 'owner'));
    
    // Bei Dialog-Öffnung laden
    $effect(() => {
        if (open) {
            loadParticipants();
            loadUserRole();
            shareLink = generateShareLink();
        }
    });


    $effect(() => {
        if (!open) return;

        // Wichtig: erst nach loadUserRole() (async) wissen wir, ob Owner.
        // Dieser Effect läuft erneut, sobald userRole gesetzt wurde.
        const role = userRole;
        if (role === BoardRole.OWNER) {
            void loadLeaveRequestsIfOwner();
        } else {
            leaveRequestsByPubkey = {};
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-lg" data-testid="share-dialog">
        <Dialog.Header>
            <Dialog.Title>Board teilen</Dialog.Title>
            <Dialog.Description>
                Teile dieses Board mit anderen über einen Link oder verwalte Editoren.
            </Dialog.Description>
        </Dialog.Header>
        
        <Tabs.Root bind:value={activeTab} class="mt-4">
            <Tabs.List class="grid w-full grid-cols-2">
                <Tabs.Trigger value="share-link">
                    Share-Link
                </Tabs.Trigger>
                <Tabs.Trigger value="editors">
                    Editoren ({editorsAndOwners.length})
                </Tabs.Trigger>
            </Tabs.List>
            
            <!-- Share-Link Tab -->
            <Tabs.Content value="share-link" class="mt-4 space-y-4">
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">
                        Teile diesen Link mit anderen Nutzern. Sie können dann selbst entscheiden, 
                        ob sie das Board abonnieren möchten.
                    </p>
                    
                    <div class="flex gap-2">
                        <Input 
                            value={shareLink}
                            readonly
                            class="flex-1 font-mono text-xs"
                            data-testid="share-link-input"
                        />
                        <Button 
                            onclick={copyShareLink}
                            variant="outline"
                            class="gap-2"
                        >
                            {#if linkCopied}
                                <CheckIcon class="h-4 w-4" />
                                Kopiert
                            {:else}
                                <CopyIcon class="h-4 w-4" />
                                Kopieren
                            {/if}
                        </Button>
                    </div>
                    
                    <div class="mt-4 p-3 bg-muted rounded-md">
                        <p class="text-sm font-medium mb-2">ℹ️ Wie funktioniert das Teilen?</p>
                        <ul class="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Nutzer öffnet den Link und sieht eine Vorschau des Boards</li>
                            <li>Mit einem Klick auf "Board folgen" wird es zu ihrer Liste hinzugefügt</li>
                            <li>Sie können das Board jederzeit wieder deabonnieren</li>
                            <li>Nur Editoren (siehe nächster Tab) können das Board bearbeiten</li>
                        </ul>
                    </div>
                </div>
            </Tabs.Content>
            
            <!-- Editoren Tab -->
            <Tabs.Content value="editors" class="mt-4">
                {#if canInviteEditors}
                    <div class="space-y-4 mb-4">
                        <div class="flex gap-2">
                            <Input 
                                bind:value={newEditorPubkey}
                                placeholder="Nostr Public Key (npub oder hex)"
                                disabled={isLoading}
                                class="flex-1"
                            />
                            <Button 
                                onclick={handleInviteEditor}
                                disabled={isLoading || !newEditorPubkey.trim()}
                                data-testid="add-editor-button"
                            >
                                Hinzufügen
                            </Button>
                        </div>
                        
                        {#if errorMessage}
                            <p class="text-sm text-destructive text-red-600">{errorMessage}</p>
                        {/if}
                    </div>
                {/if}
                
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each editorsAndOwners as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {participant.displayName}
                                </span>
                                <Badge variant={participant.role === 'owner' ? 'default' : 'secondary'}>
                                    {participant.role === 'owner' ? 'Owner' : 'Editor'}
                                </Badge>

                                {#if participant.role !== 'owner' && canInviteEditors && leaveRequestsByPubkey[participant.pubkey]}
                                    <Badge variant="outline" title="Leave-Request" class="bg-red-400">
                                        Hat das Board verlassen
                                    </Badge>
                                {/if}
                            </div>
                            
                            {#if participant.role !== 'owner' && canInviteEditors}
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onclick={() => handleRemoveEditor(participant.pubkey)}
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
        </Tabs.Root>
        
        <Dialog.Footer>
            <Button variant="outline" onclick={() => open = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>