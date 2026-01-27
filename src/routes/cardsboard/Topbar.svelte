<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import MenuIcon from "@lucide/svelte/icons/menu";
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';
    import LinkAddPopover from '$lib/components/LinkAddPopover.svelte';
    import { chatStore } from '$lib/stores/chatStore.svelte.js';
    import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
	
    

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

    let currentTheme = $state<'light' | 'dark' | 'auto'>('auto');
    
    // Derived values for displaying board info
    let currentBoardTitle = $derived(boardStore.boardMeta.name || 'Mein Projekt Board');
    let currentBoardDescription = $derived(boardStore.boardMeta.description || '');
    let currentBoardLicense = $derived(boardStore.data?.ccLicense || 'cc-by-4.0');

    // CC License Badge Helper with proper symbols
    function getLicenseInfo(license: string) {
        const licenses: Record<string, { symbol: string; name: string; color: string; url: string }> = {
            'cc0': { 
                symbol: 'CC0',
                name: 'Public Domain Dedication',
                color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700',
                url: 'https://creativecommons.org/publicdomain/zero/1.0/'
            },
            'cc-by-4.0': { 
                symbol: 'CC BY',
                name: 'Attribution 4.0',
                color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                url: 'https://creativecommons.org/licenses/by/4.0/'
            },
            'cc-by-sa-4.0': { 
                symbol: 'CC BY-SA',
                name: 'Attribution-ShareAlike 4.0',
                color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300 dark:border-blue-700',
                url: 'https://creativecommons.org/licenses/by-sa/4.0/'
            },
            'cc-by-nc-4.0': { 
                symbol: 'CC BY-NC',
                name: 'Attribution-NonCommercial 4.0',
                color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                url: 'https://creativecommons.org/licenses/by-nc/4.0/'
            },
            'cc-by-nd-4.0': { 
                symbol: 'CC BY-ND',
                name: 'Attribution-NoDerivatives 4.0',
                color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300 dark:border-purple-700',
                url: 'https://creativecommons.org/licenses/by-nd/4.0/'
            },
            'cc-by-nc-sa-4.0': { 
                symbol: 'CC BY-NC-SA',
                name: 'Attribution-NonCommercial-ShareAlike 4.0',
                color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300 dark:border-amber-700',
                url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/'
            },
            'cc-by-nc-nd-4.0': { 
                symbol: 'CC BY-NC-ND',
                name: 'Attribution-NonCommercial-NoDerivatives 4.0',
                color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700',
                url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/'
            }
        };
        
        return licenses[license] || licenses['cc-by-4.0'];
    }
    
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
    import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
    import ImportPopover from '$lib/components/ImportPopover.svelte';
    import { TrashIcon } from 'lucide-svelte';
    
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


</script>

<header class="sticky top-0 z-50 w-full max-w-full border-b-4 shrink-0 overflow-x-auto">
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
            <div class="flex items-baseline gap-1 hidden md:flex">
                <span class="font-semibold text-lg">{currentBoardTitle}</span>
                
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
            
            <!-- ➕🔗 Link hinzufügen Popover -->
            <LinkAddPopover />
        </div>
            
        <!-- Right Section: Actions + Right Sidebar Trigger -->
        <div class="flex items-center gap-0.5 sm:gap-2">
            <Separator orientation="vertical" class="min-w-0.5 sm:min-w-3" />
            
            <!-- Right Sidebar Trigger -->
            <Button
                variant="ghost"
                size="icon"
                onclick={onToggleRightSidebar}
                class="  h-8 w-8 bg-secondary"
            >
                <PanelRightIcon class="h-4 w-4"/>
                <span class="sr-only">Toggle Right Sidebar</span>
            </Button>
        </div>
    </div>
</header>

