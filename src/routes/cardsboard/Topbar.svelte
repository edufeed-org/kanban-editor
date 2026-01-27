<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import MenuIcon from "@lucide/svelte/icons/menu";
    import BotIcon from "@lucide/svelte/icons/bot";
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
    import { TrashIcon, SquareSigmaIcon, Loader2Icon, CheckCircle2Icon } from 'lucide-svelte';
    
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

    // ============================================================================
    // 🤖 AI SUMMARY STATE & FUNCTIONS
    // ============================================================================
    
    let aiSummary = $state<string | null>(null);
    let isGeneratingAiSummary = $state(false);
    let aiSummaryError = $state<string | null>(null);
    
    /**
     * Generiert eine KI-Zusammenfassung des Boards
     * - Erster Absatz: Ein Satz als Kurzbeschreibung
     * - Zweiter Teil: Detaillierte Beschreibung der Inhalte und des Anliegens
     */
    async function generateAiSummary() {
        if (isGeneratingAiSummary) return;
        
        const settings = settingsStore.settings;
        if (!settings.llmModel || !settings.llmBaseUrl) {
            aiSummaryError = '❌ LLM nicht konfiguriert. Bitte in Settings LLM-Model und Base URL eintragen.';
            return;
        }
        
        isGeneratingAiSummary = true;
        aiSummaryError = null;
        aiSummary = null;
        
        try {
            // Get board context
            const boardContext = boardStore.getContextData(true);
            const columnCount = boardContext.columns?.length || 0;
            const cardCount = boardContext.columns?.reduce((sum: number, c: any) => sum + (c.cards?.length || 0), 0) || 0;
            
            // Build a detailed board description for the prompt
            let boardDetails = `Board: "${boardContext.name || 'Unbenannt'}"\n`;
            boardDetails += `Beschreibung: ${boardContext.description || 'Keine'}\n`;
            boardDetails += `Spalten: ${columnCount}, Karten: ${cardCount}\n\n`;
            
            if (boardContext.columns && boardContext.columns.length > 0) {
                boardDetails += 'Struktur:\n';
                for (const column of boardContext.columns) {
                    boardDetails += `\n## ${column.name} (${column.cards?.length || 0} Karten)\n`;
                    if (column.cards && column.cards.length > 0) {
                        for (const card of column.cards) {
                            boardDetails += `- ${card.heading}`;
                            if (card.content) boardDetails += `: ${card.content.substring(0, 100)}${card.content.length > 100 ? '...' : ''}`;
                            boardDetails += '\n';
                        }
                    }
                }
            }
            
            const systemPrompt = `Du bist ein Assistent, der Kanban-Boards zusammenfasst.

Deine Aufgabe ist es, eine prägnante Zusammenfassung in Markdown zu erstellen:

1. **Erster Absatz**: EIN einziger Satz, der das Board kurz und prägnant beschreibt.

2. **Zweiter Teil**: Eine detaillierte Beschreibung der Inhalte, der Struktur und des Anliegens des Boards. Erkläre die Spalten, wichtige Karten und den Gesamtzweck.

Antworte NUR mit der Markdown-Zusammenfassung, ohne zusätzliche Erklärungen.`;
            
            const userMessage = `Erstelle eine Zusammenfassung für folgendes Board:\n\n${boardDetails}`;
            
            // Use chatStore's LLM method (without tools for simple text generation)
            const result = await chatStore.sendToLLMWithTools(userMessage, systemPrompt, []);
            
            if (result.error) {
                aiSummaryError = result.error;
            } else if (result.content) {
                aiSummary = result.content;
                
                // Speichere die KI-Zusammenfassung als Board-Beschreibung
                boardStore.updateCurrentBoardMeta({
                    description: result.content
                });
                
                console.log('✅ KI-Zusammenfassung als Board-Beschreibung gespeichert');
                toast.success('✅ Zusammenfassung gespeichert', {
                    description: 'Die KI-Zusammenfassung wurde als Board-Beschreibung übernommen.',
                    duration: 3000
                });
            } else {
                aiSummaryError = '❌ Keine Antwort vom LLM erhalten.';
            }
            
        } catch (error) {
            console.error('❌ Error generating AI summary:', error);
            aiSummaryError = error instanceof Error ? error.message : 'Unbekannter Fehler';
        } finally {
            isGeneratingAiSummary = false;
        }
    }
    
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

            <!-- AI Summary Button (BotIcon) - Hidden on small screens -->
            <Drawer.Root>
                <Drawer.Trigger 
                    class="hidden md:inline-flex items-center justify-center h-8 w-8 btn bg-secondary" 
                    title="KI-Zusammenfassung"
                >
                    <SquareSigmaIcon class="h-4 w-4" />
                </Drawer.Trigger>
                <Drawer.Content>
                    <Drawer.Header class="flex items-center justify-between pr-4">
                        <Drawer.Title>Board-Zusammenfassung</Drawer.Title>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={generateAiSummary}
                            disabled={isGeneratingAiSummary}
                            title="KI-Zusammenfassung generieren"
                            class="h-8 gap-2"
                        >
                            {#if isGeneratingAiSummary}
                                <Loader2Icon class="h-4 w-4 animate-spin" />
                            {:else}
                                <BotIcon class="h-4 w-4" />
                            {/if}
                            <span class="hidden sm:inline">KI generieren</span>
                        </Button>
                    </Drawer.Header>
                    <div class="p-4 space-y-4">
                        <!-- Manuelle Beschreibung -->
                        <div>
                            <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Beschreibung</h3>
                            {#if currentBoardDescription}
                                <div class="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
                                    {@html currentBoardDescription
                                        .replace(/\n\n/g, '</p><p class="mt-2">')
                                        .replace(/\n/g, '<br />')
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                        .replace(/^## (.+)$/gm, '<h4 class="font-semibold text-foreground mt-3 mb-1">$1</h4>')
                                        .replace(/^### (.+)$/gm, '<h5 class="font-medium text-foreground mt-2 mb-1">$1</h5>')
                                        .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
                                    }
                                </div>
                            {:else}
                                <p class="text-sm text-muted-foreground">Keine Beschreibung vorhanden</p>
                            {/if}
                        </div>
                        
                        <!-- AI Summary Section -->
                        {#if aiSummaryError}
                            <div class="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                                <p class="text-sm text-destructive">{aiSummaryError}</p>
                            </div>
                        {/if}
                        
                        {#if isGeneratingAiSummary}
                            <div class="rounded-lg bg-muted p-4">
                                <div class="flex items-center gap-2">
                                    <Loader2Icon class="h-4 w-4 animate-spin text-muted-foreground" />
                                    <p class="text-sm text-muted-foreground italic">KI generiert Zusammenfassung...</p>
                                </div>
                            </div>
                        {:else if aiSummary}
                            <div class="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
                                <div class="flex items-center gap-2">
                                    <CheckCircle2Icon class="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <p class="text-sm text-green-700 dark:text-green-300">
                                        Die Zusammenfassung wurde erfolgreich erstellt und als Beschreibung gespeichert.
                                    </p>
                                </div>
                            </div>
                        {/if}
                    </div>
                </Drawer.Content>
            </Drawer.Root>
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

