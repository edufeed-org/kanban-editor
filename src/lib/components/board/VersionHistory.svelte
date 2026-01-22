<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { Spinner } from '$lib/components/ui/spinner/index.js';
    import HistoryIcon from "@lucide/svelte/icons/history";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    import SaveIcon from "@lucide/svelte/icons/save";
    import CalendarIcon from "@lucide/svelte/icons/calendar";
    import UserIcon from "@lucide/svelte/icons/user";
    import FolderIcon from "@lucide/svelte/icons/folder";
    import FileIcon from "@lucide/svelte/icons/file";
    import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
    import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { authStore } from '$lib/stores/authStore.svelte.js';
    import { toast } from 'svelte-sonner';

    // ========================================================================
    // HELPERS
    // ========================================================================

    function generateDefaultLabel(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    // ========================================================================
    // STATE
    // ========================================================================

    let dialogOpen = $state(false);
    let isLoading = $state(false);
    let isSaving = $state(false);
    let isRestoring = $state(false);
    let snapshotLabel = $state('');
    let confirmRestoreId = $state<string | null>(null);
    let loadError = $state<string | null>(null);

    let snapshots = $state<Array<{
        id: string;
        label: string;
        timestamp: number;
        reason: string;
        cardCount: number;
        columnCount: number;
        createdBy: string;
        boardData: any;
    }>>([]);

    // ========================================================================
    // EFFECTS
    // ========================================================================

    // Load snapshots and set default label when dialog opens
    $effect(() => {
        if (dialogOpen) {
            // Set default label with current timestamp
            snapshotLabel = generateDefaultLabel();
            loadSnapshots();
        }
    });

    // ========================================================================
    // METHODS
    // ========================================================================

    async function loadSnapshots() {
        // Check if board is connected to relays first
        if (!boardStore.ndkReady) {
            loadError = 'Nostr-Verbindung noch nicht bereit. Bitte warte einen Moment.';
            return;
        }
        
        isLoading = true;
        loadError = null;
        
        // Timeout wrapper to prevent infinite loading
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Versionen wurden nicht gefunden')), 7000);
        });
        
        try {
            // Race between loading snapshots and timeout
            snapshots = await Promise.race([
                boardStore.loadSnapshots(),
                timeoutPromise
            ]);
            console.log(`✅ Loaded ${snapshots.length} snapshots`);
            loadError = null;
        } catch (error) {
            console.error('Failed to load snapshots:', error);
            const errorMessage = error instanceof Error ? error.message : 'Versionen konnten nicht geladen werden';
            // Show error inline instead of toast
            loadError = `${errorMessage}. Bitte versuche es später erneut oder prüfe die Nostr-Verbindung.`;
            // Ensure snapshots array is still accessible even on error
            snapshots = [];
        } finally {
            isLoading = false;
        }
    }

    async function createSnapshot() {
        if (!snapshotLabel.trim()) {
            toast.error('Bitte gib eine Beschreibung ein');
            return;
        }

        // Check if NDK is ready before attempting to save
        if (!boardStore.ndkReady) {
            toast.error('Nostr-Verbindung nicht bereit', {
                description: 'Bitte warte, bis die Verbindung hergestellt ist.'
            });
            return;
        }

        isSaving = true;
        try {
            const success = await boardStore.createManualSnapshot(snapshotLabel.trim());
            
            if (success) {
                toast.success('Version gespeichert', {
                    description: `"${snapshotLabel}" wurde erfolgreich gespeichert.`
                });
                snapshotLabel = generateDefaultLabel(); // Reset to new timestamp
                // Reload snapshots to show the new one
                await loadSnapshots();
            } else {
                toast.error('Version konnte nicht gespeichert werden', {
                    description: 'Nostr-Verbindung prüfen oder später erneut versuchen.'
                });
            }
        } catch (error) {
            console.error('Failed to create snapshot:', error);
            toast.error('Fehler beim Speichern der Version');
        } finally {
            isSaving = false;
        }
    }

    async function restoreSnapshot(snapshotId: string, label: string) {
        isRestoring = true;
        try {
            const success = await boardStore.rollbackToSnapshot(snapshotId);
            
            if (success) {
                toast.success('Version wiederhergestellt', {
                    description: `Das Board wurde auf "${label}" zurückgesetzt.`
                });
                confirmRestoreId = null;
                dialogOpen = false;
            } else {
                toast.error('Version konnte nicht wiederhergestellt werden');
            }
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
            toast.error('Fehler beim Wiederherstellen');
        } finally {
            isRestoring = false;
        }
    }

    function formatDate(timestamp: number): string {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatRelativeTime(timestamp: number): string {
        const now = Date.now() / 1000;
        const diff = now - timestamp;
        
        if (diff < 60) return 'gerade eben';
        if (diff < 3600) return `vor ${Math.floor(diff / 60)} Minuten`;
        if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Stunden`;
        if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tagen`;
        
        return formatDate(timestamp);
    }

    function getReasonBadge(reason: string): { text: string; variant: 'default' | 'secondary' | 'outline' } {
        switch (reason) {
            case 'manual':
                return { text: 'Manuell', variant: 'default' };
            case 'auto_save':
                return { text: 'Auto', variant: 'secondary' };
            case 'before_import':
                return { text: 'Vor Import', variant: 'outline' };
            case 'before_restore':
                return { text: 'Backup', variant: 'outline' };
            default:
                return { text: reason, variant: 'secondary' };
        }
    }

    function truncatePubkey(pubkey: string): string {
        if (!pubkey || pubkey.length < 12) return pubkey || 'Unbekannt';
        return `${pubkey.slice(0, 6)}...${pubkey.slice(-4)}`;
    }

    function canRestoreSnapshot(snapshotCreator: string): boolean {
        const currentUser = authStore.getPubkey();
        
        // Both anonymous (or no creator info)
        if ((!currentUser || currentUser === 'anonymous') && 
            (!snapshotCreator || snapshotCreator === 'anonymous')) {
            return true;
        }
        
        // Same user
        if (currentUser && snapshotCreator && currentUser === snapshotCreator) {
            return true;
        }
        
        return false;
    }
</script>

<!-- Trigger Button -->
<Button 
    variant="ghost" 
    size="sm" 
    class="gap-2"
    onclick={() => dialogOpen = true}
>
    <HistoryIcon class="h-4 w-4" />
    <span class="hidden sm:inline">Versionen</span>
</Button>

<!-- Version History Dialog -->
<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <HistoryIcon class="h-5 w-5" />
                Versionshistorie
            </Dialog.Title>
            <Dialog.Description class="text-left">
                Speichere Versionen deines Boards und stelle frühere Zustände wieder her.
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex-1 overflow-y-auto">
            <!-- Create New Snapshot Section -->
            <div class="space-y-3 p-4 bg-muted/30 rounded-lg mb-4">
                <div class="flex items-center gap-2 text-sm font-medium">
                    <SaveIcon class="h-4 w-4" />
                    Neue Version speichern
                </div>
                
                <!-- NDK Status Warning -->
                {#if !boardStore.ndkReady}
                    <div class="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-950/50 px-3 py-2 rounded-md">
                        <AlertTriangleIcon class="h-4 w-4" />
                        <span>Nostr-Verbindung wird hergestellt...</span>
                    </div>
                {/if}
                
                <div class="flex gap-2">
                    <Input 
                        bind:value={snapshotLabel}
                        placeholder="z.B. 'Vor großem Umbau' oder 'Version 1.0'"
                        class="flex-1"
                        disabled={isSaving || !boardStore.ndkReady}
                        onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && createSnapshot()}
                    />
                    <Button 
                        onclick={createSnapshot}
                        disabled={isSaving || !snapshotLabel.trim() || !boardStore.ndkReady}
                        class="gap-2"
                    >
                        {#if isSaving}
                            <Spinner size="sm" />
                        {:else}
                            <SaveIcon class="h-4 w-4" />
                        {/if}
                        Speichern
                    </Button>
                </div>
            </div>

            <Separator />

            <!-- Snapshots List -->
            <div class="space-y-2 mt-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-sm font-medium">Gespeicherte Versionen</h3>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onclick={loadSnapshots}
                        disabled={isLoading}
                    >
                        {#if isLoading}
                            <Spinner size="sm" />
                        {:else}
                            Aktualisieren
                        {/if}
                    </Button>
                </div>

                {#if isLoading}
                    <div class="flex items-center justify-center py-8">
                        <Spinner size="lg" />
                        <span class="ml-2 text-muted-foreground">Lade Versionen...</span>
                    </div>
                {:else if loadError}
                    <div class="flex flex-col items-center justify-center py-8 text-destructive">
                        <AlertTriangleIcon class="h-12 w-12 mb-4 opacity-50" />
                        <p class="text-center font-medium">Fehler beim Laden</p>
                        <p class="text-center text-sm mt-2 max-w-md">{loadError}</p>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onclick={loadSnapshots}
                            class="mt-4"
                        >
                            Erneut versuchen
                        </Button>
                    </div>
                {:else if snapshots.length === 0}
                    <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <HistoryIcon class="h-12 w-12 mb-4 opacity-50" />
                        <p class="text-center">Noch keine Versionen gespeichert.</p>
                        <p class="text-center text-sm">Erstelle oben eine neue Version.</p>
                    </div>
                {:else}
                    <div class="space-y-2">
                        {#each snapshots.filter(s => canRestoreSnapshot(s.createdBy)) as snapshot (snapshot.id)}
                            {@const badge = getReasonBadge(snapshot.reason)}
                            <div class="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="font-medium truncate">{snapshot.label}</span>
                                            <Badge variant={badge.variant} class="text-xs">
                                                {badge.text}
                                            </Badge>
                                        </div>
                                        
                                        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span class="flex items-center gap-1" title={formatDate(snapshot.timestamp)}>
                                                <CalendarIcon class="h-3 w-3" />
                                                {formatRelativeTime(snapshot.timestamp)}
                                            </span>
                                            <span class="flex items-center gap-1">
                                                <FolderIcon class="h-3 w-3" />
                                                {snapshot.columnCount} Spalten
                                            </span>
                                            <span class="flex items-center gap-1">
                                                <FileIcon class="h-3 w-3" />
                                                {snapshot.cardCount} Karten
                                            </span>
                                            <span class="flex items-center gap-1" title={snapshot.createdBy}>
                                                <UserIcon class="h-3 w-3" />
                                                {truncatePubkey(snapshot.createdBy)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div class="flex-shrink-0">
                                        {#if confirmRestoreId === snapshot.id}
                                            <!-- Confirmation Dialog -->
                                            <div class="flex items-center gap-2">
                                                <Button 
                                                    variant="destructive" 
                                                    size="sm"
                                                    onclick={() => restoreSnapshot(snapshot.id, snapshot.label)}
                                                    disabled={isRestoring}
                                                    class="gap-1"
                                                >
                                                    {#if isRestoring}
                                                        <Spinner size="sm" />
                                                    {:else}
                                                        <CheckCircle2Icon class="h-3 w-3" />
                                                    {/if}
                                                    Ja
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onclick={() => confirmRestoreId = null}
                                                    disabled={isRestoring}
                                                >
                                                    Nein
                                                </Button>
                                            </div>
                                        {:else}
                                            <Button 
                                                variant="outline" 
                                                size="sm"
                                                onclick={() => confirmRestoreId = snapshot.id}
                                                class="gap-1"
                                            >
                                                <RotateCcwIcon class="h-3 w-3" />
                                                Wiederherstellen
                                            </Button>
                                        {/if}
                                    </div>
                                </div>
                                
                                {#if confirmRestoreId === snapshot.id}
                                    <div class="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive flex items-start gap-2">
                                        <AlertTriangleIcon class="h-4 w-4 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <strong>Achtung:</strong> Diese Aktion erstellt automatisch ein Backup 
                                            des aktuellen Zustands und ersetzt dann alle Daten mit dieser Version.
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <Dialog.Footer class="mt-4">
            <Button variant="outline" onclick={() => dialogOpen = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
