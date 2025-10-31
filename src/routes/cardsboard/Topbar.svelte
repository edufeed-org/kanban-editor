<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Sheet from '$lib/components/ui/sheet/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import { Label } from '$lib/components/ui/label/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
    import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
    import UserRoundIcon from "@lucide/svelte/icons/user-round";
    import MoonIcon from "@lucide/svelte/icons/moon";
    import SunIcon from "@lucide/svelte/icons/sun";
    import BotIcon from "@lucide/svelte/icons/bot";
    import SquareSigmaIcon from "@lucide/svelte/icons/square-sigma";
    import TrashIcon from "@lucide/svelte/icons/trash";
    import SettingsPanel from './SettingsPanel.svelte';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { authStore } from '$lib/index.js';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import ExportButton from '$lib/components/ExportButton.svelte';
	
    

    // Props für Sidebar-Toggle, Title und Board-Meta
    let {
        title = 'Kanbanboard',
        onToggleLeftSidebar,
        onToggleRightSidebar,
        boardMeta
    }: {
        title?: string;
        onToggleLeftSidebar?: () => void;
        onToggleRightSidebar?: () => void;
        boardMeta?: { title: string; description: string; tags: string[] };
    } = $props();

    // State für Board-Metadaten Form
    let metaForm = $state({
        title: boardMeta?.title || 'Mein Projekt Board',
        description: boardMeta?.description || '',
        tags: boardMeta?.tags?.join(', ') || '',
        license: 'cc-by-4.0',
        publishState: 'draft' as 'draft' | 'published' | 'archived'
    });

    let dialogOpen = $state(false);
    let previousDialogState = $state(false); // ← NEU: Track previous state
    
    // 🔥 WICHTIG: Nutze $derived vom Store - das ist reactive!
    let currentBoardTitle = $derived(boardStore.boardMeta.name || 'Mein Projekt Board');
    let currentBoardDescription = $derived(boardStore.boardMeta.description || '');
    let currentBoardPublishState = $derived(boardStore.data?.publishState || 'draft');
    
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
        { url: 'ws://localhost:4869', type: 'local', enabled: true },
        { url: 'wss://relay-rpi.edufeed.org/', type: 'public', enabled: true }
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
    import SheetDescription from '$lib/components/ui/sheet/sheet-description.svelte';
    
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

    function handleRelayToggle(index: number) {
        relays[index].enabled = !relays[index].enabled;
    }

    function saveBoardMeta() {
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
            ccLicense: metaForm.license
        });
        
        // 2. Aktualisiere publishState separat
        boardStore.setPublishState(metaForm.publishState);
        
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

    function handleDeleteBoard() {
        if (confirm('⚠️ Willst du das gesamte Board mit ALLEN Spalten und Karten wirklich löschen? Dies kann nicht rückgängig gemacht werden!')) {
            console.log('🗑️ Deleting entire board');
            boardStore.deleteBoard();
        }
    }

    function downloadAllBoardsAsJson() {
        try {
            const json = boardStore.exportAllBoardsAsJson();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const now = new Date();
            const timestamp = now.toISOString().split('T')[0];
            link.href = url;
            link.download = `boards-backup-${timestamp}.json`;
            link.click();
            URL.revokeObjectURL(url);
            console.log('✅ Alle Boards heruntergeladen!');
        } catch (error) {
            console.error('❌ Fehler beim Herunterladen:', error);
        }
    }
    
</script>

<header class="sticky top-0 z-50 w-full max-w-full border-b shrink-0">
    <div class="container flex h-14 items-center justify-between px-4 w-full mx-auto">
        <!-- Left Section: Sidebar Trigger + Logo -->
        <div class="flex items-center gap-2">
            <!-- Left Sidebar Trigger -->
            <Button title="Linke Sidebar ein-/ausblenden"
                variant="default"
                size="icon"
                onclick={onToggleLeftSidebar}
                class="h-8 w-8 bg-secondary"
            >
                <PanelLeftIcon class="h-4 w-4" />
                <span class="sr-only">Toggle Left Sidebar</span>
            </Button>
            
            <Separator orientation="vertical" class="min-w-4" />
            
            <!-- 🔥 WICHTIG: Zeige Titel direkt vom Store an, nicht über Props! -->
            <span class="font-semibold text-lg hidden sm:inline-block">{currentBoardTitle}</span>
            
            <!-- Board Meta Settings Button (3 Punkte) -->
            <Dialog.Root bind:open={dialogOpen}>
                {#if authStore.isAuthenticated }
                <Dialog.Trigger 
                    class="inline-flex items-center justify-center h-8 w-8 btn bg-secondary" 
                    title="Board-Einstellungen"
                >
                    <EllipsisVerticalIcon class="h-4 w-4 pointer-events-none bg-transparent" />
                </Dialog.Trigger>
                {/if}
                <Dialog.Content class="max-w-md">
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
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="board-description">Beschreibung</Label>
                            <Input 
                                id="board-description" 
                                bind:value={metaForm.description} 
                                placeholder="Projekt-Beschreibung"
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label>Veröffentlichungsstatus</Label>
                            <RadioGroup.Root bind:value={metaForm.publishState}>
                                <div class="flex items-center space-x-2">
                                    <RadioGroup.Item value="draft" id="state-draft" />
                                    <Label for="state-draft" class="font-normal">Draft (nur lokal)</Label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <RadioGroup.Item value="published" id="state-published" />
                                    <Label for="state-published" class="font-normal">Veröffentlicht (Nostr)</Label>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <RadioGroup.Item value="archived" id="state-archived" />
                                    <Label for="state-archived" class="font-normal">Archiviert</Label>
                                </div>
                            </RadioGroup.Root>
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="board-tags">Tags (komma-getrennt)</Label>
                            <Input 
                                id="board-tags" 
                                bind:value={metaForm.tags} 
                                placeholder="tag1, tag2, tag3"
                            />
                        </div>
                        
                        <div class="space-y-2">
                            <Label for="cc-license">Creative Commons Lizenz</Label>
                            <select 
                                id="cc-license" 
                                bind:value={metaForm.license}
                                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {#each ccLicenses as license}
                                    <option value={license.value}>{license.label}</option>
                                {/each}
                            </select>
                        </div>
                    </div>
                    
                    <Dialog.Footer>
                        <div class="flex justify-between w-full">
                            <div class="flex gap-2">
                                <Button variant="outline" onclick={handleDeleteBoard} class="h-9 w-9 bg-destructive btn">
                                    <TrashIcon class="h-4 w-4" />
                                </Button>
                                <ExportButton />
                            </div>
                            <div  class="flex gap-2">
                                <Button variant="outline" onclick={() => { dialogOpen = false; }} class="bg-secondary">Abbrechen</Button>
                                <Button variant="default" onclick={saveBoardMeta} class="bg-primary border">Speichern</Button>
                                
                            </div>
                        </div>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>
        

            <!-- AI Summary Button (BotIcon) -->
            <Drawer.Root>
                <Drawer.Trigger 
                    class="inline-flex items-center justify-center h-8 w-8 btn bg-secondary" 
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
        <div class="flex items-center gap-2">
            <!-- Settings Panel -->
            <SettingsPanel />

            <!-- Backup All Boards Button -->
            <Button 
                variant="default"
                size="icon"
                onclick={downloadAllBoardsAsJson}
                title="Alle Boards als Backup herunterladen"
                class="h-8 w-8 bg-secondary btn"
            >
                <DownloadIcon class="h-4 w-4" />
            </Button>

            <!-- AI Settings Sheet -->
            <Sheet.Root>
                <Sheet.Trigger 
                    class="inline-flex items-center justify-center h-8 w-8 btn bg-secondary"
                >
                    <BotIcon class="h-4 w-4"/>
                </Sheet.Trigger>
                <Sheet.Content>
                    <Sheet.Header>
                        <Sheet.Title>AI- Einstellungen</Sheet.Title>
                    </Sheet.Header>
                    <hr class="border-2">
                    <div class="p-4 space-y-4">
                        <Field.Group class="space-y-4 border-b pb-4">
                            <Field.Set>
                                <Field.Label class="text-sm font-semibold mb-2">Nostr Relays</Field.Label>
                                    {#each relays as relay}
                                        <div class="flex items-start gap-3">
                                            <Checkbox bind:checked={relay.enabled} id={relay.url} />
                                            <Label for={relay.url} class="ml-2">{relay.url}</Label>
                                        </div>
                                    {/each}
                            </Field.Set>
                        </Field.Group>
                        <Field.Group  class="space-y-4 border-b pb-4">
                            <Field.Set>
                                <Field.Label for="n8n-url" class="text-sm font-semibold">n8n Webhook Url</Field.Label>
                                <Field.Content>
                                    <Input id="n8n-url" bind:value={webhookUrl} placeholder="https://..." />
                                </Field.Content>
                            </Field.Set>
                        </Field.Group>
                    </div>
                </Sheet.Content>
            </Sheet.Root>
            
            <!-- Theme -->
            <Button variant="ghost" size="icon" onclick={toggleTheme} class=" h-8 w-8 btn bg-secondary">
                {#if currentTheme === 'dark'}
                    <SunIcon class="h-4 w-4"/>
                {:else}
                    <MoonIcon class="h-4 w-4"/>
                {/if}
            </Button>
            
            <Separator orientation="vertical" class="min-w-3" />
            
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