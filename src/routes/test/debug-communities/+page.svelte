<script lang="ts">
    import { getContext, onMount } from 'svelte';
    import type NDK from '@nostr-dev-kit/ndk';
    import type { NDKKind } from '@nostr-dev-kit/ndk';

    let ndk: NDK | null = $state(null);

    onMount(() => {
        ndk = getContext<NDK>('ndk') ?? null;
    });

    let events: any[] = $state([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let selectedRelay = $state('wss://relay.edufeed.org');

    const relayOptions = [
        'wss://relay.edufeed.org',
        'ws://localhost:7000',
        'wss://nos.lol',
        'wss://relay.primal.net'
    ];

    async function fetchAllCommunities() {
        if (!ndk) {
            errorMessage = 'NDK nicht initialisiert. Bitte aktualisieren Sie die Seite.';
            return;
        }

        isLoading = true;
        errorMessage = '';
        events = [];

        try {
            console.log(`🔍 Fetching ALL Kind 10222 events from ${selectedRelay}...`);

            const relays = Array.from(ndk.pool?.relays.values() || []);
            if (relays.length === 0) {
                throw new Error(`Keine Relays konfiguriert. Bitte check +layout.svelte`);
            }
            
            // Get first relay for query
            const relay = relays[0];

            await relay.connect();
            console.log(`✅ Verbunden zu ${selectedRelay}`);

            const filter = {
                kinds: [10222 as unknown as NDKKind]
            };

            console.log('📡 Query:', filter);

            const fetchedEvents = await ndk.fetchEvents(filter);
            
            events = (Array.from(fetchedEvents) as any[])
                .map((e) => ({
                    id: e.id,
                    pubkey: e.pubkey,
                    kind: e.kind,
                    created_at: e.created_at,
                    tags: e.tags,
                    content: e.content,
                    sig: e.sig?.substring(0, 16) + '...'
                }))
                .sort((a, b) => b.created_at - a.created_at);

            console.log(`✅ ${events.length} Kind 10222 Events gefunden!`);
            console.table(events);
        } catch (error) {
            console.error('❌ Fehler:', error);
            errorMessage = `Fehler: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            isLoading = false;
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        console.log('📋 Kopiert!');
    }

    function formatDate(timestamp: number): string {
        return new Date(timestamp * 1000).toLocaleString('de-DE');
    }
</script>

{#if typeof window !== 'undefined'}
    <div class="p-8 max-w-6xl mx-auto space-y-6">
        <!-- Header -->
        <div>
            <h1 class="text-3xl font-bold mb-2">🔍 Debug: Kind 10222 Events</h1>
            <p class="text-muted-foreground">Alle Community Metadata Events vom Relay</p>
        </div>

        <!-- Relay Selection -->
        <div class="border rounded-lg p-6">
            <div class="space-y-4">
                <div>
                    <label for="relay-selector" class="text-sm font-medium">Relay auswählen:</label>
                    <div id="relay-selector" class="flex gap-2 mt-2 flex-wrap">
                        {#each relayOptions as relay}
                            <button
                                class="px-3 py-2 rounded-md text-sm font-medium transition-colors {selectedRelay === relay ? 'bg-primary text-primary-foreground' : 'border bg-background hover:bg-accent'}"
                                onclick={() => { selectedRelay = relay; }}
                                disabled={isLoading}
                            >
                                {relay.replace('wss://', '').replace('ws://', '')}
                            </button>
                        {/each}
                    </div>
                </div>

                <button
                    onclick={fetchAllCommunities}
                    disabled={isLoading}
                    class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                    {isLoading ? '⏳ Lädt...' : '🚀 Alle Kind 10222 Events laden'}
                </button>
            </div>
        </div>

        <!-- Error Message -->
        {#if errorMessage}
            <div class="p-4 bg-destructive/20 text-destructive rounded-md border border-destructive/30">
                {errorMessage}
            </div>
        {/if}

        <!-- Results Summary -->
        {#if events.length > 0}
            <div class="grid grid-cols-3 gap-4">
                <div class="p-4 border rounded-lg">
                    <p class="text-sm text-muted-foreground">Total Events</p>
                    <p class="text-2xl font-bold">{events.length}</p>
                </div>
                <div class="p-4 border rounded-lg">
                    <p class="text-sm text-muted-foreground">Unique Authors</p>
                    <p class="text-2xl font-bold">{new Set(events.map(e => e.pubkey)).size}</p>
                </div>
                <div class="p-4 border rounded-lg">
                    <p class="text-sm text-muted-foreground">Newest Event</p>
                    <p class="text-xs">{events[0] ? formatDate(events[0].created_at) : '–'}</p>
                </div>
            </div>
        {/if}

        <!-- Events Table -->
        {#if events.length > 0}
            <div class="border rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-muted">
                        <tr>
                            <th class="px-4 py-2 text-left font-medium">ID</th>
                            <th class="px-4 py-2 text-left font-medium">Pubkey</th>
                            <th class="px-4 py-2 text-left font-medium">Created</th>
                            <th class="px-4 py-2 text-left font-medium">Tags</th>
                            <th class="px-4 py-2 text-left font-medium">Content</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        {#each events as event (event.id)}
                            <tr class="hover:bg-muted/50">
                                <td class="px-4 py-2 font-mono text-xs">{event.id.substring(0, 8)}...</td>
                                <td class="px-4 py-2 font-mono text-xs">
                                    <button onclick={() => copyToClipboard(event.pubkey)} class="text-blue-500 hover:underline">
                                        {event.pubkey.substring(0, 12)}...
                                    </button>
                                </td>
                                <td class="px-4 py-2 text-xs">{formatDate(event.created_at)}</td>
                                <td class="px-4 py-2 text-xs">{event.tags.length} tags</td>
                                <td class="px-4 py-2 text-xs max-w-xs truncate">{event.content || '(empty)'}</td>
                                <td class="px-4 py-2">
                                    <button
                                        onclick={() => {
                                            console.log('📋 Event:', event);
                                            copyToClipboard(JSON.stringify(event, null, 2));
                                        }}
                                        class="px-2 py-1 text-xs border rounded hover:bg-muted"
                                    >
                                        Log
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}

        <!-- JSON Export -->
        {#if events.length > 0}
            <div class="border rounded-lg p-6">
                <h2 class="text-lg font-bold mb-4">📋 JSON Export:</h2>
                <textarea
                    readonly
                    class="w-full h-64 bg-muted p-4 rounded font-mono text-xs border"
                    value={JSON.stringify(events, null, 2)}
                ></textarea>
                <button
                    onclick={() => copyToClipboard(JSON.stringify(events, null, 2))}
                    class="mt-3 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90"
                >
                    📋 Copy JSON
                </button>
            </div>
        {/if}

        <!-- Empty State -->
        {#if !isLoading && events.length === 0}
            <div class="text-center py-12 text-muted-foreground">
                <p class="text-lg">👉 Klick oben um Kind 10222 Events zu laden</p>
            </div>
        {/if}
    </div>
{/if}


<style>
    :global(body) {
        background-color: var(--background);
    }
</style>
