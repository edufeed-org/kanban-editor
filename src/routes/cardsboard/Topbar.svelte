<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import MenuIcon from "@lucide/svelte/icons/menu";
    import ShareIcon from "@lucide/svelte/icons/share-2";
    import BellIcon from "@lucide/svelte/icons/bell";
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { BotIcon } from 'lucide-svelte';
    import PublishToEdufeedDialog from './PublishToEdufeedDialog.svelte';
    import { onMount } from 'svelte';
    import { settingsStore } from '$lib/stores/settingsStore.svelte';
    import { toast } from 'svelte-sonner';
    import PencilIcon from '@lucide/svelte/icons/pencil';
    import ShareDialog from '$lib/components/board/ShareDialog.svelte';
    import { BoardRole } from '$lib/types/sharing';
    
    // State für Edufeed-Dialog
    let showEdufeedDialog = $state(false);
    let showEditorRequestsDialog = $state(false);
    let editorRequestsByPubkey = $state<Record<string, { eventId: string; createdAt?: number; reason?: string; role?: string }>>({});
    let editorRequestsLoadToken = $state(0);
    
    // State für Inline-Editing des Board-Titels
    let isEditingTitle = $state(false);
    let editTitleValue = $state('');
    let titleInputRef: HTMLInputElement | null = $state(null);
	
    // Props für Sidebar-Toggle, Title und Board-Meta
    let {
        onToggleLeftSidebar,
        onToggleRightSidebar,
        isMobile = false
    }: {
        onToggleLeftSidebar?: () => void;
        onToggleRightSidebar?: () => void;
        isMobile?: boolean;
    } = $props();

    // Derived values for displaying board info
    let currentBoardTitle = $derived(boardStore.boardMeta.name || 'Mein Projekt Board');
    let currentBoardLicense = $derived(boardStore.data?.ccLicense || 'cc-by-4.0');
    let userRole = $derived(boardStore.getCurrentUserRole());
    let isOwner = $derived(userRole === BoardRole.OWNER);
    let editorRequestCount = $derived(Object.keys(editorRequestsByPubkey).length);

    const greenStyling = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700'
    const yellowStyling = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'

    // CC License Badge Helper with proper symbols
    function getLicenseInfo(license: string) {
        const licenses: Record<string, { symbol: string; name: string; color: string; url: string }> = {
            'cc0': { 
                symbol: 'CC0',
                name: 'Public Domain Dedication',
                color: greenStyling,
                url: 'https://creativecommons.org/publicdomain/zero/1.0/'
            },
            'cc-by-4.0': { 
                symbol: 'CC BY',
                name: 'Attribution 4.0',
                color: greenStyling,
                url: 'https://creativecommons.org/licenses/by/4.0/'
            },
            'cc-by-sa-4.0': { 
                symbol: 'CC BY-SA',
                name: 'Attribution-ShareAlike 4.0',
                color: greenStyling,
                url: 'https://creativecommons.org/licenses/by-sa/4.0/'
            },
            'cc-by-nc-4.0': { 
                symbol: 'CC BY-NC',
                name: 'Attribution-NonCommercial 4.0',
                color: yellowStyling,
                url: 'https://creativecommons.org/licenses/by-nc/4.0/'
            },
            'cc-by-nd-4.0': { 
                symbol: 'CC BY-ND',
                name: 'Attribution-NoDerivatives 4.0',
                color: yellowStyling,
                url: 'https://creativecommons.org/licenses/by-nd/4.0/'
            },
            'cc-by-nc-sa-4.0': { 
                symbol: 'CC BY-NC-SA',
                name: 'Attribution-NonCommercial-ShareAlike 4.0',
                color: yellowStyling,
                url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
            },
            'cc-by-nc-nd-4.0': { 
                symbol: 'CC BY-NC-ND',
                name: 'Attribution-NonCommercial-NoDerivatives 4.0',
                color: yellowStyling,
                url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
            }
        };
        
        return licenses[license] || licenses['cc-by-4.0'];
    }

    onMount(() => {
        settingsStore.setTheme(settingsStore.settings.theme);
    })

    async function loadEditorRequests(): Promise<void> {
        const boardId = boardStore.data?.id;
        const token = ++editorRequestsLoadToken;

        if (!isOwner || !boardId) {
            editorRequestsByPubkey = {};
            return;
        }
        try {
            editorRequestsByPubkey = await boardStore.getEditorRequestsForCurrentBoard();
        } catch (error) {
            console.warn('⚠️ Editor-Requests konnten nicht geladen werden (best-effort):', error);
            editorRequestsByPubkey = {};
        } finally {
            if (token !== editorRequestsLoadToken || boardStore.data?.id !== boardId) {
                return;
            }
        }
    }

    let lastBoardId = $state<string | undefined>(undefined);
    $effect(() => {
        const boardId = boardStore.data?.id;
        const role = userRole;

        if (boardId !== lastBoardId) {
            lastBoardId = boardId;
            editorRequestsByPubkey = {};
            editorRequestsLoadToken++;
        }

        if (role !== BoardRole.OWNER) {
            editorRequestsByPubkey = {};
        }
    });

    // Hintergrund-Refresh für Editor-Requests (Badge ohne Klick)
    $effect(() => {
        const boardId = boardStore.data?.id;
        const role = userRole;
        if (!boardId || role !== BoardRole.OWNER) return;

        // Leicht verzögert laden, damit Board-Load nicht blockiert
        const initialTimer = setTimeout(() => {
            void loadEditorRequests();
        }, 300);

        const intervalId = setInterval(() => {
            void loadEditorRequests();
        }, 30000);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalId);
        };
    });

    function openEditorRequests(): void {
        showEditorRequestsDialog = true;
        void loadEditorRequests();
    }
    
    // Funktionen für Inline-Editing des Board-Titels
    function startEditingTitle() {
        editTitleValue = currentBoardTitle;
        isEditingTitle = true;
        // Focus auf Input nach dem Rendern
        setTimeout(() => titleInputRef?.focus(), 10);
    }
    
    function saveTitle() {
        if (editTitleValue.trim() && editTitleValue !== currentBoardTitle) {
            try {
                boardStore.updateCurrentBoardMeta({ name: editTitleValue.trim() });
                toast.success('Board-Titel gespeichert');
            } catch (error) {
                console.error('❌ Fehler beim Speichern des Titels:', error);
                toast.error('Titel konnte nicht gespeichert werden');
            }
        }
        isEditingTitle = false;
    }
    
    function cancelEditTitle() {
        isEditingTitle = false;
        editTitleValue = currentBoardTitle;
    }
    
    function handleTitleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditTitle();
        }
    }
</script>

<header class="sticky top-0 z-50 w-full max-w-full border-b-2 shrink-0 overflow-x-auto">
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
                    <!-- <MenuIcon class="h-4 w-4" /> -->
                    <PanelLeftIcon class="h-4 w-4" />
                {:else}
                    <PanelLeftIcon class="h-4 w-4" />
                {/if}
                <span class="sr-only">Toggle Left Sidebar</span>
            </Button>
            
            <Separator orientation="vertical" class="min-w-4 hidden sm:block" />
            
            <!-- Mobile: Kompakter Titel (Menü ist in der Sidebar) -->
            {#if isMobile}
                <span class="font-semibold text-sm truncate max-w-[150px] pl-2">
                    {currentBoardTitle}
                </span>
            {/if}
            
            <!-- Desktop: Voller Titel mit Inline-Editing -->
            <div class="hidden md:flex items-baseline gap-1">
                {#if isEditingTitle}
                    <input
                        bind:this={titleInputRef}
                        bind:value={editTitleValue}
                        onblur={saveTitle}
                        onkeydown={handleTitleKeydown}
                        class="font-semibold text-lg bg-transparent border-b-2 border-primary outline-none px-1 min-w-[150px] max-w-[400px]"
                        style="width: {Math.max(150, editTitleValue.length * 10)}px"
                    />
                {:else}
                    <button
                        onclick={startEditingTitle}
                        class="font-semibold text-lg hover:bg-muted px-1 rounded cursor-text transition-colors group flex items-center gap-1"
                        title="Klicken zum Bearbeiten"
                    >
                        {currentBoardTitle}
                        <PencilIcon class="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                {/if}
                
                <!-- CC License Badge (superscript style) -->
                {#if currentBoardLicense}
                    {@const licenseInfo = getLicenseInfo(currentBoardLicense)}
                    <a 
                        href={licenseInfo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9px] font-bold transition-colors hover:opacity-80 relative -top-1 {licenseInfo.color}"
                        title="{licenseInfo.name} - Klicken für Details"
                    >
                        <svg class="h-2 w-2" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                        </svg>
                        <span class="leading-none">{licenseInfo.symbol}</span>
                    </a>
                {/if}
            </div>

        </div>
            
        <!-- Right Section: Actions + Right Sidebar Trigger -->
        <div class="flex items-center gap-0.5 sm:gap-2">
            <!-- Mobile: Icon-only Button -->
            <!-- <Button
                variant="outline"
                size="icon"
                onclick={() => showEdufeedDialog = true}
                class="sm:hidden h-8 w-8"
                title="Board als OER zu Edufeed teilen"
            >
                <ShareIcon class="h-4 w-4" />
            </Button> -->
            
            <Separator orientation="vertical" class="min-w-0.5 sm:min-w-3" />

            {#if isOwner && editorRequestCount > 0}
                <Button
                    variant="ghost"
                    size="icon"
                    onclick={openEditorRequests}
                    class="relative h-8 w-8 bg-secondary"
                    title="Editor-Anfragen"
                >
                    <BellIcon class="h-4 w-4" />
                    <span class="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center px-1">
                        {editorRequestCount > 9 ? '9+' : editorRequestCount}
                    </span>
                    <span class="sr-only">Editor-Anfragen</span>
                </Button>
                <Separator orientation="vertical" class="min-w-0.5 sm:min-w-3" />
            {/if}
            
            <!-- Right Sidebar Trigger -->
            <Button
                variant="ghost"
                size="icon"
                onclick={onToggleRightSidebar}
                class="  h-8 w-8 bg-secondary"
            >
                <BotIcon class="h-4 w-4"/>
                <span class="sr-only">Toggle Right Sidebar</span>
            </Button>
        </div>
    </div>
</header>

<!-- Edufeed Publish Dialog -->
<PublishToEdufeedDialog bind:open={showEdufeedDialog} />

<!-- Owner: Editor-Requests Dialog (öffnet ShareDialog im Editor-Tab) -->
{#if isOwner}
    <ShareDialog
        bind:open={showEditorRequestsDialog}
        initialTab="editors"
        initialEditorRequests={editorRequestsByPubkey}
    />
{/if}

