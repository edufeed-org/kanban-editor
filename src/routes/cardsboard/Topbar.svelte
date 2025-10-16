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

    // Props für Sidebar-Toggle
    let {
        onToggleLeftSidebar,
        onToggleRightSidebar
    }: {
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
        const themes: Array<'light' | 'dark' | 'auto'> = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(currentTheme);
        currentTheme = themes[(currentIndex + 1) % themes.length];
        
        if (typeof document !== 'undefined') {
            if (currentTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else if (currentTheme === 'light') {
                document.documentElement.classList.remove('dark');
            }
        }
    }

    function handleRelayToggle(index: number) {
        relays[index].enabled = !relays[index].enabled;
    }
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur shrink-0">
    <div class="container flex h-14 items-center justify-between px-4">
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
            
            <Separator orientation="vertical" class="h-6" />
            
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span class="font-semibold text-lg hidden sm:inline-block">Kanban Board</span>
        </div>

        <!-- Right Section: Actions + Right Sidebar Trigger -->
        <div class="flex items-center gap-2">
            <!-- Settings -->
            <Sheet.Root>
                <Sheet.Trigger class="inline-flex items-center justify-center size-9 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all">
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6"/>
                    </svg>
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
                        <AvatarFallback>MM</AvatarFallback>
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
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="4"/>
                </svg>
            </Button>
            
            <Separator orientation="vertical" class="h-6" />
            
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