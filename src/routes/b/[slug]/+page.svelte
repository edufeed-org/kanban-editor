<script lang="ts">
    /**
     * Shortlink-Resolver Route: /b/[slug]
     * 
     * Löst einen Kurzlink (z.B. /b/projekt-x) auf:
     * 1. Nimm den Slug aus der URL
     * 2. Warte auf NDK-Bereitschaft
     * 3. Suche Shortlink-Event (Kind 30491) mit d-Tag = slug
     * 4. Lese den naddr aus dem Event
     * 5. Leite zur /cardsboard/[naddr] Route weiter
     */
    import { page } from '$app/stores';
    import { base } from '$app/paths';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { resolveShortlinkBySlug } from '$lib/utils/nostrEvents.js';
    import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
    import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
    import LinkIcon from '@lucide/svelte/icons/link';

    // State
    let status = $state<'loading' | 'error' | 'not-found'>('loading');
    let errorMessage = $state('');
    let loadingStep = $state('Kurzlink auflösen...');
    let resolvedSlug = $state('');

    async function resolveAndRedirect() {
        try {
            const slug = $page.params.slug;
            if (!slug) {
                throw new Error('Kein Kürzel in URL');
            }

            resolvedSlug = slug;
            loadingStep = 'NDK initialisieren...';

            // Warte auf NDK
            let attempts = 0;
            while (!boardStore.ndkReady && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }

            if (!boardStore.ndkReady) {
                throw new Error('NDK konnte nicht initialisiert werden');
            }

            const ndk = boardStore.nostrIntegration?.getNDK();
            if (!ndk) {
                throw new Error('NDK nicht verfügbar');
            }

            // Shortlink-Event von Nostr laden
            loadingStep = `Kurzlink "${slug}" auf Nostr suchen...`;

            const result = await resolveShortlinkBySlug(slug, ndk);

            if (!result) {
                status = 'not-found';
                return;
            }

            loadingStep = 'Weiterleitung zum Board...';

            // Weiterleitung zur naddr-Route
            const naddrPath = `${base}/cardsboard/${result.naddr}`;
            await goto(naddrPath, { replaceState: true });

        } catch (error) {
            console.error('❌ Fehler beim Auflösen des Kurzlinks:', error);
            status = 'error';
            errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        }
    }

    onMount(() => {
        resolveAndRedirect();
    });
</script>

{#if status === 'loading'}
    <div class="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div class="text-center p-8 max-w-md">
            <div class="flex flex-col items-center gap-4">
                <LoaderCircleIcon class="h-12 w-12 animate-spin text-primary" />
                <h1 class="text-xl font-semibold">Kurzlink wird aufgelöst...</h1>
                <p class="text-muted-foreground">{loadingStep}</p>
                {#if resolvedSlug}
                    <div class="mt-2 px-3 py-1.5 bg-muted rounded-md">
                        <code class="text-sm font-mono">/b/{resolvedSlug}</code>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{:else if status === 'not-found'}
    <div class="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div class="text-center p-8 max-w-md">
            <div class="flex flex-col items-center gap-4">
                <LinkIcon class="h-12 w-12 text-muted-foreground" />
                <h1 class="text-xl font-semibold">Kurzlink nicht gefunden</h1>
                <p class="text-muted-foreground">
                    Der Kurzlink <code class="font-mono bg-muted px-1.5 py-0.5 rounded">/b/{resolvedSlug}</code> 
                    konnte auf keinem Nostr-Relay gefunden werden.
                </p>
                <p class="text-sm text-muted-foreground">
                    Mögliche Ursachen: Der Link wurde gelöscht, ist noch nicht publiziert 
                    oder die Relays sind nicht erreichbar.
                </p>
                <a 
                    href="{base}/cardsboard/" 
                    class="mt-4 text-primary hover:underline"
                >
                    Zurück zur Übersicht
                </a>
            </div>
        </div>
    </div>
{:else if status === 'error'}
    <div class="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div class="text-center p-8 max-w-md">
            <div class="flex flex-col items-center gap-4">
                <AlertCircleIcon class="h-12 w-12 text-destructive" />
                <h1 class="text-xl font-semibold text-destructive">Fehler</h1>
                <p class="text-muted-foreground">{errorMessage}</p>
                <a 
                    href="{base}/cardsboard/" 
                    class="mt-4 text-primary hover:underline"
                >
                    Zurück zur Übersicht
                </a>
            </div>
        </div>
    </div>
{/if}
