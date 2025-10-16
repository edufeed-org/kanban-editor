<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Sheet from '$lib/components/ui/sheet/index.js';
    import * as Drawer from '$lib/components/ui/drawer/index.js';
    import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar/index.js';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
    import PanelRightIcon from "@lucide/svelte/icons/panel-right";
    import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
    import UserRoundIcon from "@lucide/svelte/icons/user-round";
    import MoonIcon from "@lucide/svelte/icons/moon";
    import SunIcon from "@lucide/svelte/icons/sun";
    import BotIcon from "@lucide/svelte/icons/bot";

    


    // Props für Sidebar-Toggle und Title
    let {
        title = 'Kanbanboard',
        onToggleLeftSidebar,
        onToggleRightSidebar
    }: {
        title?: string;
        onToggleLeftSidebar?: () => void;
        onToggleRightSidebar?: () => void;
    } = $props();

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