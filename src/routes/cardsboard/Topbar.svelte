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
    import RelayStatusInfo from './RelayStatusInfo.svelte';
    import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { BoardRole } from '$lib/types/sharing';
    import { authStore } from '$lib/index.js';
    import ExportButton from '$lib/components/ExportButton.svelte';
    import LiaScriptExportButton from '$lib/components/LiaScriptExportButton.svelte';
    import { toast } from 'svelte-sonner';
    import { ShareButton, VersionHistory } from '$lib/components/board';
    import { publishBoardToEdufeed } from '$lib/utils/ambPublisher';
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

    let canReloadBoardFromNostr = $derived(boardStore.ndkReady);

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
    import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
    import ImportPopover from '$lib/components/ImportPopover.svelte';
  import { getSyncManager } from '$lib/stores/syncManager.svelte';
  import { RefreshCwIcon, TrashIcon, SquareSigmaIcon, Loader2Icon, CheckCircle2Icon } from 'lucide-svelte';
    
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
                
                // Aktualisiere auch das lokale Form-Feld
                metaForm.description = result.content;
                
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
            <span class="font-semibold text-lg hidden md:inline-block">{currentBoardTitle}</span>
            
            <!-- 🟢 Relay Status Component -->
            <RelayStatusInfo />

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
                    class="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent btn transition hover:border-foreground hover:bg-accent hover:text-accent-foreground" 
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
                                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {#each ccLicenses as license}
                                    <option value={license.value}>{license.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    
                    <Dialog.Footer>
                        <div class="flex flex-col gap-3 w-full">
                            <!-- First row: Action buttons (Export, Import, Publish) -->
                            <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
                                <ImportPopover />
                                <ExportButton />
                                <LiaScriptExportButton />
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
            <!-- Settings Dialog -->
            <Dialog.Root>
                <Dialog.Trigger
                    class="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent btn transition hover:border-foreground hover:bg-accent hover:text-accent-foreground"
                    title="Einstellungen"
                >
                    <SlidersHorizontalIcon class="h-4 w-4" />
                </Dialog.Trigger>
                <Dialog.Content>
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

