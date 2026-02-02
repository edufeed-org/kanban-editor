<script lang="ts">
    import { getContext } from 'svelte';
    import type NDK from '@nostr-dev-kit/ndk';
    import type { NDKKind } from '@nostr-dev-kit/ndk';
    import { NDKEvent } from '@nostr-dev-kit/ndk';
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Label } from "$lib/components/ui/label";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { settingsStore } from "$lib/stores/settingsStore.svelte";
    import { createBoardNaddr, createBoardNaddrUrl } from "$lib/utils/nostrEvents";
    import { toast } from "svelte-sonner";
    import UsersIcon from "@lucide/svelte/icons/users";
    import { nip19 } from "nostr-tools";

    type CommunityInfo = {
        pubkey: string;
        name: string;
        description?: string;
        relays: string[];
    };

    let { open = $bindable(false) }: { open?: boolean } = $props();

    const ndk = getContext<NDK>('ndk');

    let isLoading = $state(false);
    let isPublishing = $state(false);
    let errorMessage = $state('');
    let communities = $state<CommunityInfo[]>([]);
    let selectedPubkeys = $state<string[]>([]);
    let searchQuery = $state('');
    
    // 🔒 Guard gegen mehrfaches Laden
    let hasLoadedOnce = $state(false);

    let selectedCount = $derived(selectedPubkeys.length);
    let filteredCommunities = $derived.by(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return communities;
        return communities.filter((c) =>
            c.name.toLowerCase().includes(q) ||
            c.pubkey.toLowerCase().includes(q) ||
            (c.description || '').toLowerCase().includes(q)
        );
    });

    function getAllRelayUrls(): string[] {
        return ['wss://relay.edufeed.org'];
    }

    function normalizePubkey(value?: string | null): string | null {
        if (!value) return null;

        if (value.startsWith('npub')) {
            try {
                const decoded = nip19.decode(value);
                if (decoded.type === 'npub' && typeof decoded.data === 'string') {
                    return decoded.data;
                }
                if (decoded.type === 'nprofile' && typeof (decoded.data as any)?.pubkey === 'string') {
                    return (decoded.data as { pubkey: string }).pubkey;
                }
            } catch (error) {
                console.warn('⚠️ Ungültiges npub/nprofile:', value, error);
                return null;
            }
        }

        if (/^[0-9a-f]{64}$/i.test(value)) return value;

        return null;
    }

    function uniqueNormalizedPubkeys(values: Array<string | null | undefined>): string[] {
        const normalized = values
            .map((value) => normalizePubkey(value))
            .filter((value): value is string => Boolean(value));

        const unique: string[] = [];
        for (const value of normalized) {
            if (!unique.includes(value)) unique.push(value);
        }

        return unique;
    }

    function extractCommunityPubkeys(event: NDKEvent | null): string[] {
        if (!event) return [];
        const pubkeys: string[] = [];

        for (const tag of event.tags || []) {
            if (tag[0] === 'a' && tag[1]) {
                const [kind, author] = tag[1].split(':');
                if (kind === '30009' && author) {
                    const normalized = normalizePubkey(author);
                    if (normalized && !pubkeys.includes(normalized)) pubkeys.push(normalized);
                }
            }
        }

        if (pubkeys.length > 0) return pubkeys;

        for (const tag of event.tags || []) {
            if (tag[0] === 'p' && tag[1]) {
                const normalized = normalizePubkey(tag[1]);
                if (normalized && !pubkeys.includes(normalized)) pubkeys.push(normalized);
            }
        }

        return pubkeys;
    }

    $effect(() => {
        if (!open) {
            hasLoadedOnce = false; // Reset when dialog closes
            return;
        }

        // 🔒 KRITISCH: Nur einmal laden, nie mehr!
        if (hasLoadedOnce || isLoading) {
            console.log('⏸️ loadCommunities() bereits aktiv oder abgeschlossen, skipping...');
            return;
        }

        void loadCommunities();
    });

    async function ensureRelayConnected(relayUrl: string): Promise<void> {
        if (!ndk) return;
        try {
            const pool = (ndk as any).pool;
            const existingRelay = pool?.relays?.get?.(relayUrl);
            if (existingRelay) return;

            const relay = await (ndk as any).addExplicitRelay?.(relayUrl);
            if (!relay) return;

            await new Promise<void>((resolve) => {
                const timeout = setTimeout(resolve, 3000);
                relay.on?.('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                if (relay.status === 1) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        } catch (error) {
            console.warn('⚠️ Relay-Connect fehlgeschlagen:', relayUrl, error);
        }
    }

    async function fetchEventWithTimeout(filter: any, timeoutMs = 5000) {
        if (!ndk) return null;
        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), timeoutMs)
        );
        return Promise.race([ndk.fetchEvent(filter), timeoutPromise]);
    }

    async function fetchEventsWithTimeout(filter: any, timeoutMs = 5000) {
        if (!ndk) return null;
        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), timeoutMs)
        );
        return Promise.race([ndk.fetchEvents(filter), timeoutPromise]);
    }

    function selectLatestEvent(events: any): NDKEvent | null {
        if (!events) return null;
        const list = Array.isArray(events) ? events : Array.from(events as Set<NDKEvent>);
        if (list.length === 0) return null;
        return list.reduce((latest: NDKEvent, current: NDKEvent) => {
            const latestTime = latest?.created_at || 0;
            const currentTime = current?.created_at || 0;
            return currentTime > latestTime ? current : latest;
        });
    }

    function resolveBaseUrl(): string {
        if (typeof window === 'undefined') return 'http://localhost:5173';

        const envBase = import.meta.env.BASE_URL || '/';
        let basePath = envBase;

        if (basePath === '.' || basePath === './') {
            basePath = window.location.pathname.replace(/[^/]*$/, '');
        }

        if (!basePath.startsWith('/')) {
            basePath = `/${basePath}`;
        }

        const resolved = new URL(basePath, window.location.origin);
        const normalizedPath = resolved.pathname.replace(/\/$/, '');
        return `${resolved.origin}${normalizedPath}`;
    }

    async function loadCommunities(): Promise<void> {
        if (isLoading) return;
        errorMessage = '';
        communities = [];
        selectedPubkeys = [];

        const userPubkey = normalizePubkey(authStore.getPubkey()) || normalizePubkey(authStore.getNpub());
        if (!userPubkey || !ndk) {
            errorMessage = 'Bitte zuerst einloggen, um Communities zu laden.';
            return;
        }

        isLoading = true;
        hasLoadedOnce = true;
        try {
            const relayUrls = getAllRelayUrls();
            console.log('📡 Suche Membership auf Relay(s):', relayUrls.join(', '));
            await Promise.all(relayUrls.map((url) => ensureRelayConnected(url)));

            console.log('ℹ️ Prüfe Relationships (Kind 30382, n=follow)');
            const relationshipFilter = {
                kinds: [30382 as unknown as NDKKind],
                authors: [userPubkey]
            };
            console.log('🔎 Nostr Relationship Filter:', relationshipFilter);
            const relationshipEvents = await fetchEventsWithTimeout(relationshipFilter, 5000);
            const relList = relationshipEvents ? Array.from(relationshipEvents as Set<NDKEvent>) : [];

            const relationshipPubkeys: string[] = [];
            for (const event of relList) {
                const isFollow = (event.tags || []).some(
                    (t) => (t[0] === 'n' || t[0] === 'relationship') && t[1] === 'follow'
                );
                if (!isFollow) continue;

                const dTag = (event.tags || []).find((t) => t[0] === 'd')?.[1];
                const normalized = normalizePubkey(dTag);
                if (normalized && !relationshipPubkeys.includes(normalized)) {
                    relationshipPubkeys.push(normalized);
                }
            }

            const communityPubkeys = uniqueNormalizedPubkeys(relationshipPubkeys);
            console.log(`✅ Relationships gefunden: ${communityPubkeys.length}`);

            if (communityPubkeys.length === 0) {
                communities = [];
                console.log('ℹ️ Keine Communities gefunden (Relationships leer)');
                return;
            }

            const results: CommunityInfo[] = [];
            for (const pubkey of communityPubkeys) {
                let communityEvent: NDKEvent | null = null;

                // 🔍 Try edufeed ZUERST (wo die Communities sind)
                try {
                    await ensureRelayConnected('wss://relay.edufeed.org');
                    const communityFilter = {
                        kinds: [10222 as unknown as NDKKind],
                        authors: [pubkey]
                    };
                    console.log('🔎 Nostr Community Filter:', communityFilter);
                    const communityEvents = await fetchEventsWithTimeout(communityFilter, 3000);
                    communityEvent = selectLatestEvent(communityEvents);
                    if (communityEvent) {
                        console.log(`✅ Community ${pubkey.slice(0, 8)}… von relay.edufeed.org geladen`);
                    }
                } catch (error) {
                    console.log(`⚠️ Community ${pubkey.slice(0, 8)}… nicht auf edufeed Relay`);
                }

                if (!communityEvent) continue;

                const relays = (communityEvent.tags || [])
                    .filter((t) => t[0] === 'r' && t[1])
                    .map((t) => t[1]);

                const descriptionTag = (communityEvent.tags || []).find((t) => t[0] === 'description');

                let communityName = communityEvent.content || '';
                if (!communityName) {
                    try {
                        const metadataFilter = {
                            kinds: [0 as unknown as NDKKind],
                            authors: [pubkey]
                        };
                        console.log('🔎 Nostr Community Metadata Filter:', metadataFilter);
                        const metadataEvent = await fetchEventWithTimeout(metadataFilter, 3000);
                        if (metadataEvent?.content) {
                            const parsed = JSON.parse(metadataEvent.content);
                            communityName = parsed?.display_name || parsed?.name || '';
                        }
                    } catch (error) {
                        console.log(`⚠️ Community Metadata ${pubkey.slice(0, 8)}… nicht geladen`);
                    }
                }

                results.push({
                    pubkey,
                    name: communityName || `${pubkey.slice(0, 8)}…`,
                    description: descriptionTag?.[1],
                    relays
                });
            }

            communities = results.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            console.error('❌ Fehler beim Laden der Communities:', error);
            errorMessage = 'Communities konnten nicht geladen werden.';
        } finally {
            isLoading = false;
        }
    }

    function toggleSelection(pubkey: string) {
        if (selectedPubkeys.includes(pubkey)) {
            selectedPubkeys = selectedPubkeys.filter((p) => p !== pubkey);
            return;
        }
        selectedPubkeys = [...selectedPubkeys, pubkey];
    }

    async function publishToCommunities(): Promise<void> {
        if (isPublishing) return;
        const board = boardStore.data;

        if (!board || !board.author) {
            toast.error('Board nicht bereit', { description: 'Board muss einen Author haben.' });
            return;
        }

        if (!ndk?.signer) {
            toast.error('Nicht eingeloggt', { description: 'Bitte zuerst einloggen.' });
            return;
        }

        const selected = [...selectedPubkeys];
        if (selected.length === 0) {
            toast.error('Bitte Community auswählen');
            return;
        }

        if (selected.length > 12) {
            toast.error('Maximal 12 Communities erlaubt');
            return;
        }

        isPublishing = true;
        try {
            const relayHints: string[] = settingsStore.settings.relaysPublic || [];
            const naddr = createBoardNaddr(board.id, board.author, relayHints);
            const naddrPath = createBoardNaddrUrl(board.id, board.author, relayHints);
            const baseUrl = resolveBaseUrl();
            const url = `${baseUrl}${naddrPath}`;

            const event = new NDKEvent(ndk);
            event.kind = 30222;

            const tags: string[][] = [
                ['d', board.id],
                ['a', `30301:${board.author}:${board.id}`],
                ['naddr', naddr],
                ['url', url]
            ];

            for (const pubkey of selected) {
                tags.push(['p', pubkey]);
                const relay = communities.find((c) => c.pubkey === pubkey)?.relays?.[0];
                if (relay) tags.push(['r', relay]);
            }

            event.tags = tags;
            const description = board.description ? `\n\n${board.description}` : '';
            event.content = `📊 **${board.name}**${description}\n\n🔗 [Board öffnen](${url})`;

            const relays = await event.publish();
            if (relays.size === 0) {
                throw new Error('Kein Relay hat das Event angenommen.');
            }

            toast.success('In Communities geteilt', {
                description: `${selected.length} Community(s) erfolgreich erreicht.`
            });

            selectedPubkeys = [];
            open = false;
        } catch (error) {
            console.error('❌ Publish fehlgeschlagen:', error);
            toast.error('Teilen fehlgeschlagen');
        } finally {
            isPublishing = false;
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-xl">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <UsersIcon class="h-5 w-5" />
                An Communities teilen
            </Dialog.Title>
            <Dialog.Description>
                Wähle Communities, in denen du Mitglied bist. Es wird ein Kind-30222 Event mit naddr-Link erstellt.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <Label for="community-search">Suche</Label>
                <Input
                    id="community-search"
                    bind:value={searchQuery}
                    placeholder="Community suchen..."
                />
            </div>

            {#if isLoading}
                <div class="text-sm text-muted-foreground">Communities werden geladen…</div>
            {:else if errorMessage}
                <div class="text-sm text-destructive">{errorMessage}</div>
            {:else if communities.length === 0}
                <div class="text-sm text-muted-foreground">
                    Keine Communities gefunden. Stelle sicher, dass du ein Relationship (Kind 30382) mit `relationship=follow` besitzt.
                </div>
            {:else}
                <div class="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {#each filteredCommunities as community (community.pubkey)}
                        <label class="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40 cursor-pointer">
                            <Checkbox
                                checked={selectedPubkeys.includes(community.pubkey)}
                                onCheckedChange={() => toggleSelection(community.pubkey)}
                            />
                            <div class="flex-1">
                                <div class="text-sm font-medium">{community.name}</div>
                                {#if community.description}
                                    <div class="text-xs text-muted-foreground line-clamp-2">
                                        {community.description}
                                    </div>
                                {/if}
                                <div class="text-[10px] text-muted-foreground mt-1">
                                    {community.pubkey.slice(0, 12)}…
                                </div>
                            </div>
                            <div class="text-[10px] text-muted-foreground">
                                {community.relays.length} Relay(s)
                            </div>
                        </label>
                    {/each}
                </div>
            {/if}
        </div>

        <Dialog.Footer class="flex items-center justify-between gap-2">
            <div class="text-xs text-muted-foreground">
                Ausgewählt: {selectedCount} / 12
            </div>
            <div class="flex gap-2">
                <Button variant="outline" onclick={() => { open = false; }}>
                    Abbrechen
                </Button>
                <Button onclick={publishToCommunities} disabled={isPublishing || selectedCount === 0}>
                    Teilen
                </Button>
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
