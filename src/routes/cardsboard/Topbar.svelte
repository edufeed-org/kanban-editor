<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import MenuIcon from "@lucide/svelte/icons/menu";
    import BotIcon from "@lucide/svelte/icons/bot";
    import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
    import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
    import MoonIcon from "@lucide/svelte/icons/moon";
    import SunIcon from "@lucide/svelte/icons/sun";
    import SquareSigmaIcon from "@lucide/svelte/icons/square-sigma";
    import TrashIcon from "@lucide/svelte/icons/trash";
    import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
    import WifiIcon from "@lucide/svelte/icons/wifi";
    import Loader2Icon from "@lucide/svelte/icons/loader-2";
    import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
    import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
    import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { BoardRole } from '$lib/types/sharing';
    import { authStore } from '$lib/index.js';
    import { getSyncManager } from '$lib/stores/syncManager.svelte.js';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ExportButton from '$lib/components/ExportButton.svelte';
    import LiaScriptExportButton from '$lib/components/LiaScriptExportButton.svelte';
    import { toast } from 'svelte-sonner';
    import { ShareButton, VersionHistory } from '$lib/components/board';
    import { publishBoardToEdufeed } from '$lib/utils/ambPublisher';
	
    

    // Props für Sidebar-Toggle, Title und Board-Meta
    let {
        title = 'Kanbanboard',
        onToggleLeftSidebar,
        onToggleRightSidebar,
        boardMeta,
        isMobile = false
    }: {
        title?: string;
        onToggleLeftSidebar?: () => void;
        onToggleRightSidebar?: () => void;
        boardMeta?: { title: string; description: string; tags: string[] };
        isMobile?: boolean;
    } = $props();

    // State für Board-Metadaten Form
    let metaForm = $state({
        title: boardMeta?.title || 'Mein Projekt Board',
        description: boardMeta?.description || '',
        tags: boardMeta?.tags?.join(', ') || '',
        license: 'cc-by-4.0',
        publishState: 'draft' as 'draft' | 'published'
    });

    let dialogOpen = $state(false);
    let previousDialogState = $state(false); // ← NEU: Track previous state
    let isPublishingToEdufeed = $state(false); // Track publishing status
    
    // 🔥 WICHTIG: Nutze $derived vom Store - das ist reactive!
    let currentBoardTitle = $derived(boardStore.boardMeta.name || 'Mein Projekt Board');
    let currentBoardDescription = $derived(boardStore.boardMeta.description || '');
    let currentBoardPublishState = $derived(boardStore.data?.publishState || 'draft');

    // 🔐 Permissions (Owner-only Board Meta)
    let currentUserRole = $derived(boardStore.getCurrentUserRole());
    let canEditBoardMeta = $derived(currentUserRole === BoardRole.OWNER);
    
    // 🔥 Sync Status - reactive derived from SyncManager
    // ✅ ALTERNATIVE APPROACH: Poll SyncManager directly from component with $effect
    // This works better than setInterval in the store because $effect is in component context
    let syncStatus = $state({
        isOnline: true,
        isSyncing: true,
        queuedEvents: 0,
        connectedRelays: 0,
        totalRelays: 0,
        hasRelaySigner: false
    });
    
    // 🔥 NEW: Poll relay status with $effect + setInterval
    // This runs in component context, so Svelte can track state changes properly
    let pollIntervalId: NodeJS.Timeout | undefined;
    
    onMount(() => {
        // ✅ Initial status read - sofort starten ohne Delay!
        try {
            const syncManager = getSyncManager();
            syncStatus = {
                isOnline: syncManager.status.isOnline,
                isSyncing: syncManager.status.isSyncing,
                queuedEvents: syncManager.status.queuedEvents,
                connectedRelays: syncManager.lastConnectedCount,
                totalRelays: syncManager.lastTotalCount,
                hasRelaySigner: syncManager.status.hasRelaySigner
            };
            console.log('[Topbar] Initial sync status:', syncStatus);
        } catch (error) {
            console.warn('[Topbar] SyncManager not ready on mount (will retry)');
        }
    
        // ✅ Poll every 1 second for reactive status updates
        pollIntervalId = setInterval(() => {
            try {
                const syncManager = getSyncManager();
                
                const newStatus = {
                    isOnline: syncManager.status.isOnline,
                    isSyncing: syncManager.status.isSyncing,
                    queuedEvents: syncManager.status.queuedEvents,
                    connectedRelays: syncManager.lastConnectedCount,
                    totalRelays: syncManager.lastTotalCount,
                    hasRelaySigner: syncManager.status.hasRelaySigner
                };
                
                // Log if status changed
                if (newStatus.connectedRelays !== syncStatus.connectedRelays || 
                    newStatus.totalRelays !== syncStatus.totalRelays) {
                    console.log('[Topbar] 🔄 Status updated:', {
                        old: `${syncStatus.connectedRelays}/${syncStatus.totalRelays}`,
                        new: `${newStatus.connectedRelays}/${newStatus.totalRelays}`
                    });
                }
                
                // ✅ CRITICAL: Reassign entire object to trigger reactivity!
                syncStatus = newStatus;
            } catch (error) {
                // SyncManager not initialized yet
            }
        }, 1000); // ← Poll every 1 second for faster UI updates
         
        // ✅ Cleanup on unmount
        return () => {
            if (pollIntervalId) clearInterval(pollIntervalId);
        };
    });
    
    // 🔄 Manual reconnect handler
    async function handleReconnect() {
        try {
            const syncManager = getSyncManager();
            await syncManager.forceReconnect();
        } catch (error) {
            console.error('[Topbar] Reconnect failed:', error);
            toast.error('❌ Reconnect fehlgeschlagen', {
                description: 'Konnte keine Verbindung zu Relays herstellen.',
                duration: 3000
            });
        }
    }

    let canReloadBoardFromNostr = $derived(boardStore.ndkReady && (syncStatus.connectedRelays ?? 0) > 0);

    async function handleReloadBoardFromNostr() {
        if (!canReloadBoardFromNostr) return;

        try {
            const syncManager = getSyncManager();
            await boardStore.forceReloadCurrentBoardFromNostr({
                clearLocalCache: true,
                syncManager
            });

            toast.success('✅ Board neu geladen', {
                description: 'Aktueller Stand wurde von Nostr aktualisiert.',
                duration: 2500
            });
        } catch (error) {
            console.error('[Topbar] Reload from Nostr failed:', error);
            toast.error('❌ Reload fehlgeschlagen', {
                description: error instanceof Error ? error.message : 'Board konnte nicht von Nostr geladen werden.',
                duration: 3500
            });
        }
    }
    
    // Synchronisiere metaForm NUR beim ersten Öffnen (nicht beim Tippen!)
    $effect(() => {
        // Nur triggern wenn Dialog von false → true wechselt (Opening Event!)
        if (dialogOpen && !previousDialogState) {
            // Beim Öffnen: Lade aktuelle Werte vom Store
            metaForm.title = currentBoardTitle;
            metaForm.description = currentBoardDescription;
            metaForm.tags = boardStore.data?.tags?.join(', ') || '';
            metaForm.license = boardStore.data?.ccLicense || 'cc-by-4.0';
            metaForm.publishState = currentBoardPublishState;
            console.log('🔄 Topbar: Dialog geöffnet, metaForm synchronisiert:', {
                title: currentBoardTitle,
                tags: metaForm.tags,
                license: metaForm.license
            });
        }
        // Update previous state NACH dem Check
        previousDialogState = dialogOpen;
    });

    let currentTheme = $state<'light' | 'dark' | 'auto'>('auto');
    
    let relays = $state([
        // { url: 'ws://localhost:7000', type: 'local', enabled: true },
        // { url: 'wss://relay-rpi.edufeed.org/', type: 'public', enabled: true }
    ]);
    
    let webhookUrl = $state('');

    const currentUser = {
        name: 'Max Mustermann',
        email: 'max@example.com',
        avatar: ''
    };

    const ccLicenses = [
        { value: 'cc0', label: 'CC0 1.0 (Public Domain)' },
        { value: 'cc-by-4.0', label: 'CC BY 4.0 (Attribution)' },
        { value: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0 (Attribution-ShareAlike)' },
        { value: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0 (Attribution-NonCommercial)' },
        { value: 'cc-by-nd-4.0', label: 'CC BY-ND 4.0 (Attribution-NoDerivs)' },
        { value: 'cc-by-nc-sa-4.0', label: 'CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)' },
        { value: 'cc-by-nc-nd-4.0', label: 'CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivs)' }
    ];

    function toggleTheme() {
        const themes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark'];
        const currentIndex = themes.indexOf(currentTheme);
        currentTheme = themes[(currentIndex + 1) % themes.length];
        
        if (typeof document !== 'undefined') {
            applyTheme(currentTheme);
        }
    }

    function applyTheme(theme: 'light' | 'dark' | 'auto') {
        let effectiveTheme = theme;

        // Bei 'auto': Systemeinstellungen abfragen
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            effectiveTheme = prefersDark ? 'dark' : 'light';
        }

        // CSS-Klassen anpassen
        if (effectiveTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
        } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
        }
    }

    // Beim Mount: Theme initialisieren und Systemänderungen überwachen
    import { onMount } from 'svelte';
    import * as Field from "$lib/components/ui/field/index.js";
    import LinkIcon from "@lucide/svelte/icons/link";
    import CopyIcon from "@lucide/svelte/icons/copy";
    import CheckIcon from "@lucide/svelte/icons/check";
    import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
    import ImportPopover from '$lib/components/ImportPopover.svelte';
    
    onMount(() => {
        applyTheme(currentTheme);

        // Systemeinstellungen überwachen (falls 'auto' aktiv ist)
        if (currentTheme === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme('auto');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    });

    

    function saveBoardMeta() {
        if (!canEditBoardMeta) {
            // UI sollte den Button bereits deaktivieren; guard als Fallback.
            return;
        }
        // Parse tags from comma-separated string to array
        const tagsArray = metaForm.tags
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        // 1. Aktualisiere alle Board-Metadaten im Store
        boardStore.updateCurrentBoardMeta({
            name: metaForm.title,
            description: metaForm.description,
            tags: tagsArray,
            ccLicense: metaForm.license,
            publishState: metaForm.publishState
        });
        
        console.log('✅ Board-Meta gespeichert:', {
            name: metaForm.title,
            description: metaForm.description,
            tags: tagsArray,
            ccLicense: metaForm.license,
            publishState: metaForm.publishState
        });
        
        // 3. Schließe Dialog
        dialogOpen = false;
        console.log('🔄 currentBoardTitle wird neu berechnet:', currentBoardTitle);
    }

    /**
     * Publishes the current board as a Learning Resource to Edufeed
     * following the AMB (Adaptive Material Bundle) protocol
     */
    async function handlePublishToEdufeed() {
        if (isPublishingToEdufeed) return;
        
        try {
            isPublishingToEdufeed = true;
            
            // Get current board instance
            const board = boardStore.data;
            if (!board) {
                toast.error('Fehler: Kein Board geladen');
                return;
            }

            // Validate board has required metadata
            if (!board.name || board.name.trim() === '') {
                toast.error('Bitte gib dem Board einen Titel');
                return;
            }
            
            // Check if user is authenticated
            if (!authStore.isAuthenticated) {
                toast.error('Bitte melde dich an, um Inhalte zu veröffentlichen');
                return;
            }
            
            const pubkey = authStore.getPubkey();
            if (!pubkey) {
                toast.error('Fehler: Keine Public Key verfügbar');
                return;
            }

            // Show loading toast
            toast.loading('🚀 Board wird als Learning Resource publiziert...');
            
            // Parse tags from form
            const tagsArray = metaForm.tags
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            
            // Publish to Edufeed using AMB protocol
            const result = await publishBoardToEdufeed(board, {
                pubkey,
                title: metaForm.title,
                description: metaForm.description,
                tags: tagsArray,
                license: metaForm.license
            });
            
            // Dismiss loading toast
            toast.dismiss();
            
            if (result.success) {
                toast.success('✅ Board erfolgreich als Learning Resource publiziert!', {
                    description: `Event-ID: ${result.eventId?.substring(0, 16)}...`
                });
                
                console.log('📚 Successfully published to Edufeed:', {
                    eventId: result.eventId,
                    boardId: board.id,
                    ambResource: result.ambResource
                });
            } else {
                toast.error('Fehler beim Veröffentlichen', {
                    description: result.error || 'Unbekannter Fehler'
                });
            }
            
        } catch (error) {
            console.error('❌ Error publishing to Edufeed:', error);
            toast.dismiss();
            toast.error('Fehler beim Veröffentlichen', {
                description: error instanceof Error ? error.message : 'Unbekannter Fehler'
            });
        } finally {
            isPublishingToEdufeed = false;
        }
    }

    async function handleDeleteBoard() {
        const boardId = boardStore.getCurrentBoardId();
        if (!boardId) return;

        const role = await boardStore.getCurrentUserRole();

        if (role === BoardRole.OWNER) {
            if (confirm('⚠️ Willst du das gesamte Board mit ALLEN Spalten und Karten wirklich löschen? Dies kann nicht rückgängig gemacht werden!')) {
                console.log('🗑️ Deleting entire board');
                boardStore.deleteBoard(boardId);
            }
            return;
        }

        if (confirm('🚪 Willst du dieses geteilte Board verlassen? Es wird für dich ausgeblendet und kann später wieder durch Folgen/Einladung sichtbar werden.')) {
            console.log('🚪 Leaving shared board');
            await boardStore.leaveBoard(boardId);
        }
    }

    // ============================================================================
    // SHARE-LINK STATE & FUNCTIONS
    // ============================================================================
    
    let shareDialogOpen = $state(false);
    let shareLink = $state<string | null>(null);
    let shareLinkSize = $state(0);
    let maxShareLinkSize = $state(200000);
    let isGeneratingShareLink = $state(false);
    let copySuccess = $state(false);

    async function generateAndShowShareLink() {
        isGeneratingShareLink = true;
        try {
            const currentBoardId = boardStore.getCurrentBoardId();
            const result = await boardStore.generateShareLink(currentBoardId, true);
            
            // ⚠️ WICHTIG: result.url ist BEREITS vollständig mit encoded token!
            // generateShareLink() gibt z.B. zurück: "http://localhost:5173/cardsboard?import=<ENCODED_TOKEN>"
            // Der Token ist bereits mit encodeURIComponent() in generateShareLink() encoded
            // NICHT nochmal encoden - sonst wird es double-encoded!
            
            const fullUrl = result.url;
            const token = fullUrl.split('?import=')[1] || '';
            
            console.log('🔗 Share-Link Debug:', {
                tokenLength: token.length,
                fullUrl: fullUrl.substring(0, 100) + '...',
                fullUrlLength: fullUrl.length,
                browserLimit: 2048 // Typisches Minimum
            });
            
            shareLink = fullUrl;
            shareLinkSize = result.tokenSize;
            
            // Config laden
            const config = await fetch('/config.json').then(r => r.json()).catch(() => ({ shareTokenMaxSize: 200000 }));
            maxShareLinkSize = config.shareTokenMaxSize || 200000;
            
            console.log('✅ Share-Link generiert:', {
                tokenSize: shareLinkSize,
                maxSize: maxShareLinkSize,
                percent: ((shareLinkSize / maxShareLinkSize) * 100).toFixed(1),
                urlLength: shareLink.length
            });
        } catch (error) {
            console.error('❌ Fehler beim Generieren des Share-Links:', error);
        } finally {
            isGeneratingShareLink = false;
            shareDialogOpen = true;
        }
    }

    function copyShareLinkToClipboard() {
        if (!shareLink) return;
        
        navigator.clipboard.writeText(shareLink).then(() => {
            copySuccess = true;
            console.log('✅ Share-Link in Zwischenablage kopiert');
            
            // Reset success indicator nach 2 Sekunden
            setTimeout(() => {
                copySuccess = false;
            }, 2000);
        }).catch(error => {
            console.error('❌ Fehler beim Kopieren:', error);
        });
    }

    // Berechne visuellen Prozentsatz
    let shareLinkPercent = $derived((shareLinkSize / maxShareLinkSize) * 100);
    let isSizeSafe = $derived(shareLinkPercent < 80);
    let isSizeWarning = $derived(shareLinkPercent >= 80 && shareLinkPercent < 100);
    let isSizeError = $derived(shareLinkPercent >= 100);
    
</script>

<header class="sticky top-0 z-50 w-full max-w-full border-b shrink-0 overflow-x-auto">
    <div class="flex h-14 items-center justify-between gap-0.5 sm:gap-2 px-1.5 sm:px-4 min-w-max">
        <!-- Left Section: Sidebar Trigger + Logo -->
        <div class="flex items-center gap-0.5 sm:gap-2">
            <!-- Left Sidebar Trigger -->
            <Button title="Linke Sidebar ein-/ausblenden"
                variant="default"
                size="icon"
                onclick={onToggleLeftSidebar}
                class="h-8 w-8 bg-secondary"
            >
                {#if isMobile}
                    <MenuIcon class="h-4 w-4" />
                {:else}
                    <PanelLeftIcon class="h-4 w-4" />
                {/if}
                <span class="sr-only">Toggle Left Sidebar</span>
            </Button>
            
            <Separator orientation="vertical" class="min-w-4 hidden sm:block" />
            
            <!-- 🔥 WICHTIG: Zeige Titel direkt vom Store an, nicht über Props! -->
            <span class="font-semibold text-lg hidden md:inline-block">{currentBoardTitle}</span>
            
            <!-- 🟢 Sync Status Indicator -->
            <div 
                class="flex items-center gap-0.5 px-1 sm:px-2 py-0.5 sm:py-1 text-xs rounded bg-secondary/50 hover:bg-secondary"
                class:cursor-pointer={syncStatus.connectedRelays === 0 && !syncStatus.isSyncing}
                title="Relay-Status: {syncStatus.connectedRelays}/{syncStatus.totalRelays} verbunden"
                role="button"
                tabindex={syncStatus.connectedRelays === 0 && !syncStatus.isSyncing ? 0 : -1}
                onclick={syncStatus.connectedRelays === 0 && !syncStatus.isSyncing ? handleReconnect : undefined}
                onkeydown={(e) => {
                    if (syncStatus.connectedRelays === 0 && !syncStatus.isSyncing && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleReconnect();
                    }
                }}
            >
                {#if syncStatus.connectedRelays === 0 && syncStatus.isSyncing === false}
                    <!-- No relays connected: Show error + clickable reconnect -->
                    <WifiOffIcon class="h-3 w-3 text-red-500" />
                    <span class="text-red-600 font-semibold hidden sm:inline">Offline</span>
                    <RefreshCwIcon class="h-3 w-3 text-red-500 ml-1 hidden sm:block" />
                    <span class="text-red-500 text-[10px] hidden sm:inline">Reconnect</span>
                {:else if syncStatus.isSyncing}
                    <!-- Syncing: Show spinner -->
                    <Loader2Icon class="h-3 w-3 animate-spin text-blue-500" />
                    <span class="text-muted-foreground hidden sm:inline">Syncing...</span>
                {:else if syncStatus.queuedEvents > 0}
                    <!-- Queued: Show queued count -->
                    <div class="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span class="text-muted-foreground hidden sm:inline">{syncStatus.queuedEvents} queued</span>
                {:else if syncStatus.totalRelays > 0 && syncStatus.connectedRelays < syncStatus.totalRelays}
                    <!-- Partially connected: Show warning (only if we know total relay count) -->
                    <WifiIcon class="h-3 w-3 text-amber-500" />
                    <span class="text-amber-600 hidden sm:inline">{syncStatus.connectedRelays}/{syncStatus.totalRelays}</span>
                {:else if syncStatus.connectedRelays > 0}
                    <!-- At least one relay connected: Show online -->
                    <CheckCircle2Icon class="h-3 w-3 text-green-500" />
                    <span class="text-muted-foreground hidden sm:inline">Online</span>
                {:else}
                    <!-- Fallback: Unknown state -->
                    <WifiIcon class="h-3 w-3 text-gray-400" />
                    <span class="text-muted-foreground hidden sm:inline">Syncing...</span>
                {/if}
            </div>

            <!-- 🔄 Reload current board from Nostr -->
            <Button
                title={canReloadBoardFromNostr
                    ? 'Aktuelles Board von den Servers neu laden'
                    : 'Reload nur möglich, wenn Nostr bereit ist und mindestens ein Relay verbunden ist'}
                variant="ghost"
                size="icon"
                class="h-8 w-8"
                disabled={!canReloadBoardFromNostr}
                onclick={handleReloadBoardFromNostr}
            >
                <RefreshCwIcon class="h-4 w-4" />
                <span class="sr-only">Board von den Servers neu laden</span>
            </Button>
            
            <!-- Board Meta Settings Button (3 Punkte) -->
            <Dialog.Root bind:open={dialogOpen}>
                {#if authStore.isAuthenticated }
                <Dialog.Trigger 
                    class="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground" 
                    title="Board-Einstellungen"
                >
                    <EllipsisVerticalIcon class="h-4 w-4" />
                </Dialog.Trigger>
                {/if}
                <Dialog.Content class="w-[95vw] sm:w-auto sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <Dialog.Header>
                        <Dialog.Title>Board-Einstellungen</Dialog.Title>
                    </Dialog.Header>
                    <div class="space-y-4 py-4">
                        <div class="space-y-2">
                            <Label for="board-title">Titel</Label>
                            <Input 
                                id="board-title" 
                                bind:value={metaForm.title} 
                                placeholder="Projekt-Titel"
                                readonly={!canEditBoardMeta}
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="board-description">Beschreibung</Label>
                            <Input 
                                id="board-description" 
                                bind:value={metaForm.description} 
                                placeholder="Projekt-Beschreibung"
                                readonly={!canEditBoardMeta}
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label>Veröffentlichungsstatus</Label>
                            <RadioGroup.Root bind:value={metaForm.publishState} disabled={!canEditBoardMeta}>
                                <div class="flex items-center space-x-2">
                                    <RadioGroup.Item value="draft" id="state-draft" />
                                    <Label for="state-draft" class="font-normal">Draft (nur lokal)</Label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <RadioGroup.Item value="published" id="state-published" />
                                    <Label for="state-published" class="font-normal">Veröffentlicht (Nostr)</Label>
                                </div>
                            </RadioGroup.Root>
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="board-tags">Tags (komma-getrennt)</Label>
                            <Input 
                                id="board-tags" 
                                bind:value={metaForm.tags} 
                                placeholder="tag1, tag2, tag3"
                                readonly={!canEditBoardMeta}
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="cc-license">Creative Commons Lizenz</Label>
                            <select 
                                id="cc-license" 
                                bind:value={metaForm.license}
                                disabled={!canEditBoardMeta}
                                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {#each ccLicenses as license}
                                    <option value={license.value}>{license.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    
                    <Dialog.Footer>
                        <div class="flex flex-col gap-3 w-full">
                            <!-- First row: Action buttons (Export, Share, Publish) -->
                            <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
                                <ExportButton />
                                <LiaScriptExportButton />
                                <ImportPopover />
                                <!-- ShareLink Button -->
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    class="h-9 gap-2"
                                    title="Share-Link generieren"
                                    onclick={generateAndShowShareLink}
                                    disabled={isGeneratingShareLink}
                                >
                                    <LinkIcon class="h-4 w-4" />
                                    <span>Share</span>
                                </Button>
                                <!-- Publish to Edufeed Button -->
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    class="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                                    title="Als Learning Resource bei Edufeed veröffentlichen"
                                    onclick={handlePublishToEdufeed}
                                    disabled={isPublishingToEdufeed || !canEditBoardMeta}
                                >
                                    <UploadCloudIcon class="h-4 w-4" />
                                    <span>Edufeed</span>
                                </Button>
                            </div>
                            
                            <!-- Second row: Delete, Cancel, Save -->
                            <div class="flex flex-wrap justify-between w-full gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onclick={handleDeleteBoard} 
                                    class="h-9 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    <TrashIcon class="h-4 w-4" />
                                    <span>Löschen</span>
                                </Button>
                                <div class="flex flex-wrap gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onclick={() => { dialogOpen = false; }} 
                                        class="h-9"
                                    >
                                        Abbrechen
                                    </Button>
                                    <Button 
                                        variant="default" 
                                        size="sm"
                                        onclick={saveBoardMeta} 
                                        class="h-9" 
                                        disabled={!canEditBoardMeta}
                                    >
                                        Speichern
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        

            <!-- AI Summary Button (BotIcon) - Hidden on small screens -->
            <Drawer.Root>
                <Drawer.Trigger 
                    class="hidden md:inline-flex items-center justify-center h-8 w-8 btn bg-secondary" 
                    title="KI-Zusammenfassung"
                >
                    <SquareSigmaIcon class="h-4 w-4" />
                </Drawer.Trigger>
                <Drawer.Content>
                    <Drawer.Header>
                        <Drawer.Title>Board-Zusammenfassung</Drawer.Title>
                    </Drawer.Header>
                    <div class="p-4">
                        <p class="text-sm text-muted-foreground">
                            Hier erscheint die KI-gestützte Zusammenfassung des Boards...
                        </p>
                    </div>
                </Drawer.Content>
            </Drawer.Root>
        </div>
            
        <!-- Right Section: Actions + Right Sidebar Trigger -->
        <div class="flex items-center gap-0.5 sm:gap-2">
            <!-- Settings Dialog -->
            <Dialog.Root>
                <Dialog.Trigger
                    class="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent hover:text-accent-foreground"
                    title="Einstellungen"
                >
                    <SlidersHorizontalIcon class="h-4 w-4" />
                </Dialog.Trigger>
                <Dialog.Content class="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <Dialog.Header>
                        <Dialog.Title>⚙️ Einstellungen</Dialog.Title>
                    </Dialog.Header>
                    <div class="flex-1 overflow-y-auto">
                        <SettingsPanel />
                    </div>
                </Dialog.Content>
            </Dialog.Root>

            <!-- Board Sharing -->
            <ShareButton />
            
            <!-- Version History -->
            <VersionHistory />
            
            <!-- Theme -->
            <Button variant="ghost" size="icon" onclick={toggleTheme} class=" h-8 w-8 btn bg-secondary">
                {#if currentTheme === 'dark'}
                    <SunIcon class="h-4 w-4"/>
                {:else}
                    <MoonIcon class="h-4 w-4"/>
                {/if}
            </Button>
            
            <Separator orientation="vertical" class="min-w-0.5 sm:min-w-3" />
            
            <!-- Right Sidebar Trigger -->
            <Button
                variant="ghost"
                size="icon"
                onclick={onToggleRightSidebar}
                class="  h-8 w-8 bg-secondary"
            >
                {#if isMobile}
                    <BotIcon class="h-4 w-4" />
                {:else}
                    <PanelRightIcon class="h-4 w-4"/>
                {/if}
                <span class="sr-only">Toggle Right Sidebar</span>
            </Button>
        </div>
    </div>
</header>

<!-- Share-Link Dialog -->
<Dialog.Root bind:open={shareDialogOpen}>
    <Dialog.Content class="w-[95vw] sm:w-auto sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>Share-Link für Board</Dialog.Title>
        </Dialog.Header>
        
        <div class="space-y-4 py-4">
            <!-- Board Info -->
            <div class="rounded-lg bg-muted/50 p-3 space-y-2">
                <h3 class="font-semibold text-sm">{currentBoardTitle}</h3>
                <p class="text-xs text-muted-foreground">{currentBoardDescription || 'Keine Beschreibung'}</p>
            </div>

            <!-- Token Size Progress -->
            <div class="space-y-2">
                <div class="flex justify-between text-xs font-medium">
                    <span>Token-Größe</span>
                    <span class:text-green-600={isSizeSafe} class:text-yellow-600={isSizeWarning} class:text-red-600={isSizeError}>
                        {(shareLinkSize / 1024).toFixed(1)} KB / {(maxShareLinkSize / 1024).toFixed(0)} KB ({shareLinkPercent.toFixed(1)}%)
                    </span>
                </div>
                <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                        class="h-full transition-all"
                        class:bg-green-500={isSizeSafe}
                        class:bg-yellow-500={isSizeWarning}
                        class:bg-red-500={isSizeError}
                        style="width: {Math.min(shareLinkPercent, 100)}%"
                    ></div>
                </div>
                {#if isSizeError}
                    <p class="text-xs text-red-600 font-semibold">⚠️ Token zu groß! Board ist zu komplett für einen Share-Link.</p>
                {:else if isSizeWarning}
                    <p class="text-xs text-yellow-600">⚠️ Token nähert sich dem Limit</p>
                {/if}
            </div>

            <!-- Share Link Input -->
            <div class="space-y-2">
                <Label for="share-link-input" class="text-sm font-medium">Share-Link</Label>
                <div class="flex gap-2">
                    <input
                        id="share-link-input"
                        type="text"
                        readonly
                        value={shareLink || 'Generieren...'}
                        class="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-muted-foreground"
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onclick={copyShareLinkToClipboard}
                        disabled={!shareLink || isGeneratingShareLink}
                        class="bg-secondary"
                    >
                        {#if copySuccess}
                            <CheckIcon class="h-4 w-4 text-green-600" />
                        {:else}
                            <CopyIcon class="h-4 w-4" />
                        {/if}
                    </Button>
                </div>
                <p class="text-xs text-muted-foreground">
                    Kopiere den Link und teile ihn mit anderen, um dieses Board zu importieren.
                </p>
            </div>

            <!-- Instructions -->
            <div class="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 space-y-2">
                <p class="text-xs font-semibold text-blue-900 dark:text-blue-300">📋 Wie man den Link nutzt:</p>
                <ol class="text-xs text-blue-800 dark:text-blue-200 list-decimal list-inside space-y-1">
                    <li>Kopiere den Link oben</li>
                    <li>Öffne den Link in einem neuen Browser-Tab</li>
                    <li>Wähle Import-Modus: Merge, New oder Overwrite</li>
                    <li>Das Board wird in dein Konto importiert</li>
                </ol>
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => { shareDialogOpen = false; }}>Schließen</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>