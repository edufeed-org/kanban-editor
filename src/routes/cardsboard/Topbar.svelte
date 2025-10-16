<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Sheet from '$lib/components/ui/sheet/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
    import UserRoundIcon from "@lucide/svelte/icons/user-round";
    import MoonIcon from "@lucide/svelte/icons/moon";
    import SunIcon from "@lucide/svelte/icons/sun";
    import BotIcon from "@lucide/svelte/icons/bot";
    import MoreVerticalIcon from "@lucide/svelte/icons/more-vertical";
    import SettingsPanel from './SettingsPanel.svelte';

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
        license: 'cc-by-4.0'
    });

    let currentTheme = $state<'light' | 'dark' | 'auto'>('auto');
    
    let relays = $state([
        { url: 'wss://relay.damus.io', type: 'local', enabled: true },
        { url: 'wss://relay.primal.net', type: 'public', enabled: true }
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
        // Aktualisiere die boardMeta (würde normalerweise auch an Nostr gesendet werden)
        if (boardMeta) {
            boardMeta.title = metaForm.title;
            boardMeta.description = metaForm.description;
            boardMeta.tags = metaForm.tags
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
        }
    }
    
</script>

<header class="sticky top-0 z-50 w-full max-w-full border-b bg-background/95 backdrop-blur shrink-0">
    <div class="container flex h-14 items-center justify-between px-4 w-full mx-auto">
        <!-- Left Section: Sidebar Trigger + Logo -->
        <div class="flex items-center gap-2">
            <!-- Left Sidebar Trigger -->
            <Button
                variant="ghost"
                size="icon"
                onclick={onToggleLeftSidebar}
                class="size-9"
            >
                <PanelLeftIcon class="size-4" />
                <span class="sr-only">Toggle Left Sidebar</span>
            </Button>
            
            <Separator orientation="vertical" class="border-1 min-h-4" />
            
            <span class="font-semibold text-lg hidden sm:inline-block">{title}</span>
        </div>

        <!-- Right Section: Actions + Right Sidebar Trigger -->
        <div class="flex items-center gap-2">
            <!-- Settings Panel -->
            <SettingsPanel />

            <!-- AI Summary Button (BotIcon) -->
            <Drawer.Root>
                <Drawer.Trigger class="inline-flex items-center justify-center size-9 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all" title="KI-Zusammenfassung">
                    <BotIcon class="size-4" />
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

            <!-- Board Meta Settings Button (3 Punkte) -->
            <Dialog.Root>
                <Dialog.Trigger class="inline-flex items-center justify-center size-9 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all" title="Board-Einstellungen">
                    <MoreVerticalIcon class="size-4" />
                </Dialog.Trigger>
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
                        <Button variant="outline" onclick={() => {}}>Abbrechen</Button>
                        <Button onclick={saveBoardMeta}>Speichern & An Nostr senden</Button>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Root>

            <!-- Settings -->
            <Sheet.Root>
                <Sheet.Trigger class="inline-flex items-center justify-center size-9 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all">
                    <SlidersHorizontalIcon class="size-4" />
                </Sheet.Trigger>
                <Sheet.Content>
                    <Sheet.Header>
                        <Sheet.Title>Einstellungen</Sheet.Title>
                    </Sheet.Header>
                    <div class="space-y-4 py-4">
                        <div class="space-y-2">
                            <Label for="webhook">Webhook URL</Label>
                            <Input id="webhook" bind:value={webhookUrl} placeholder="https://..." />
                        </div>
                    </div>
                </Sheet.Content>
            </Sheet.Root>

            <!-- Profile -->
            <DropdownMenu.Root>
                <DropdownMenu.Trigger class="inline-flex items-center justify-center size-9 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all">
                    <Avatar class="h-8 w-8">
                        <AvatarFallback><UserRoundIcon class="size-4" /></AvatarFallback>
                    </Avatar>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    <DropdownMenu.Label>{currentUser.name}</DropdownMenu.Label>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item>Profil</DropdownMenu.Item>
                    <DropdownMenu.Item>Abmelden</DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>

            <!-- Theme -->
            <Button variant="ghost" size="icon" onclick={toggleTheme}>
                {#if currentTheme === 'dark'}
                    <SunIcon class="size-4" />
                {:else}
                    <MoonIcon class="size-4" />
                {/if}
            </Button>
            
            <Separator orientation="vertical" class="border-1 min-h-4" />
            
            <!-- Right Sidebar Trigger -->
            <Button
                variant="ghost"
                size="icon"
                onclick={onToggleRightSidebar}
                class="size-9"
            >
                <PanelRightIcon class="size-4" />
                <span class="sr-only">Toggle Right Sidebar</span>
            </Button>
        </div>
    </div>
</header>