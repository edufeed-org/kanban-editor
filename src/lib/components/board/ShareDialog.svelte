<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Badge } from "$lib/components/ui/badge";
    import * as Tabs from "$lib/components/ui/tabs";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { settingsStore } from "$lib/stores/settingsStore.svelte";
    import { BoardRole, type BoardShare } from "$lib/types/sharing";
    import TrashIcon from "@lucide/svelte/icons/trash";
    import CopyIcon from "@lucide/svelte/icons/copy";
    import CheckIcon from "@lucide/svelte/icons/check";
    import LinkIcon from "@lucide/svelte/icons/link";
    import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
    import { toast } from "svelte-sonner";
    import { createBoardNaddr, createBoardNaddrUrl } from "$lib/utils/nostrEvents";
    import QRCode from 'qrcode';
    
    // Props
    let { open = $bindable(false), initialTab = 'nostr-link', initialEditorRequests = {} } = $props();
    
    // State
    let newEditorPubkey = $state('');
    let participants = $state<BoardShare[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let activeTab = $state('nostr-link'); // 'nostr-link' | 'share-link' | 'editors'
    let linkCopied = $state(false);
    
    // Nostr naddr Link State
    let naddrPath = $state(''); // Relativer Pfad: /cardsboard/naddr...
    let naddrCopied = $state(false);
    let qrCodeDataUrl = $state('');
    
    // Base-URL für vollständige Links (default: Origin + BASE_URL)
    let baseUrl = $state(
        typeof window !== 'undefined'
            ? (() => {
                const envBase = import.meta.env.BASE_URL || '/';
                let basePath = envBase;

                // Vite kann BASE_URL als "./" setzen (z.B. GitHub Pages). Dann aktuelles Path-Segment verwenden.
                if (basePath === '.' || basePath === './') {
                    basePath = window.location.pathname.replace(/[^/]*$/, '');
                }

                // Normalisieren: führenden Slash sicherstellen
                if (!basePath.startsWith('/')) {
                    basePath = `/${basePath}`;
                }

                const resolved = new URL(basePath, window.location.origin);
                const normalizedPath = resolved.pathname.replace(/\/$/, '');
                return `${resolved.origin}${normalizedPath}`;
            })()
            : 'http://localhost:5173'
    );
    
    // Vollständiger naddr-Link (kombiniert baseUrl + naddrPath)
    let naddrLink = $derived(naddrPath ? `${baseUrl}${naddrPath}` : '');
    
    let userRole = $state<BoardRole>(BoardRole.VIEWER);
    let canInviteEditors = $derived(userRole === BoardRole.OWNER);

    let leaveRequestsByPubkey = $state<Record<string, { eventId: string; createdAt?: number }>>({});
    let editorRequestsByPubkey = $state<Record<string, { eventId: string; createdAt?: number; reason?: string; role?: string }>>({});
    let isLoadingEditorRequests = $state(false);
    
    // Cache for display names
    let displayNameCache = $state<Record<string, string>>({});
    
    // Share-Link generieren (Token-basiert mit allen Board-Daten inkl. Karten)
    let isGeneratingLink = $state(false);
    let tokenSize = $state(0);
    let maxTokenSize = $state(200000); // Standard-Maximum
    let lastShareBoardId = $state<string | null>(null);
    let shareConfigLoaded = $state(false);
    let shareConfigLoading = $state(false);
    
    // Berechnete Werte für Token-Größe-Anzeige
    let tokenSizePercent = $derived((tokenSize / maxTokenSize) * 100);
    let tokenSizeKB = $derived((tokenSize / 1024).toFixed(1));
    let maxTokenSizeKB = $derived((maxTokenSize / 1024).toFixed(0));
    let isSizeSafe = $derived(tokenSizePercent < 80);
    let isSizeWarning = $derived(tokenSizePercent >= 80 && tokenSizePercent < 100);
    let isSizeError = $derived(tokenSizePercent >= 100);
    
    // Share-Link Token (ohne Base-URL, wird separat zusammengesetzt)
    let shareToken = $state('');
    
    // Vollständiger Share-Link (kombiniert baseUrl + Token)
    let fullShareLink = $derived(shareToken ? `${baseUrl}${import.meta.env.BASE_URL}cardsboard?import=${shareToken}` : '');
    

    async function loadShareConfig(): Promise<void> {
        if (shareConfigLoaded || shareConfigLoading) return;

        shareConfigLoading = true;
        try {
            const config = await fetch(`${import.meta.env.BASE_URL}config.json`)
                .then(r => r.json())
                .catch(() => ({}));
            if (config?.shareTokenMaxSize) {
                maxTokenSize = config.shareTokenMaxSize;
            }
            shareConfigLoaded = true;
        } catch {
            shareConfigLoaded = true;
        } finally {
            shareConfigLoading = false;
        }
    }

    async function generateShareLinkAsync(): Promise<void> {
        const boardId = boardStore.data?.id;
        if (!boardId || isGeneratingLink) return;

        if (lastShareBoardId === boardId && shareToken && tokenSize > 0) return;
        
        isGeneratingLink = true;
        try {
            await loadShareConfig();

            const result = await boardStore.generateShareLink(boardId, true);
            tokenSize = result.tokenSize;
            lastShareBoardId = boardId;
            
            // Token aus der URL extrahieren (alles nach "?import=")
            const importMatch = result.url.match(/[?&]import=(.+)$/);
            if (importMatch) {
                shareToken = importMatch[1];
            }
        } catch (error) {
            console.error('Fehler beim Generieren des Share-Links:', error);
            toast.error('Link konnte nicht generiert werden');
        } finally {
            isGeneratingLink = false;
        }
    }
    
    // Link kopieren
    async function copyShareLink() {
        try {
            await navigator.clipboard.writeText(fullShareLink);
            linkCopied = true;
            toast.success('Link kopiert!', {
                description: 'Der Share-Link wurde in die Zwischenablage kopiert'
            });
            setTimeout(() => linkCopied = false, 2000);
        } catch {
            toast.error('Fehler beim Kopieren', {
                description: 'Link konnte nicht kopiert werden'
            });
        }
    }
    
    // Aktuelle Rolle des Nutzers laden
    async function loadUserRole() {
        try {
            const role = await boardStore.getCurrentUserRole();
            userRole = role || BoardRole.VIEWER;
        } catch (error) {
            console.error('Fehler beim Laden der Nutzerrolle:', error);
            userRole = BoardRole.VIEWER;
        }
    }
    

    // Alle Teilnehmer laden
    async function loadParticipants() {
        try {
            participants = await boardStore.getBoardParticipants();
            // Load display names for all participants
            await loadDisplayNames();
        } catch (error) {
            console.error('Fehler beim Laden der Teilnehmer:', error);
            errorMessage = 'Teilnehmer konnten nicht geladen werden';
        }
    }
    
    // Display names für alle Teilnehmer laden
    async function loadDisplayNames() {
        const missing = participants.filter(p => !displayNameCache[p.pubkey]);
        if (missing.length === 0) return;

        const results: Array<[string, string] | null> = await Promise.all(
            missing.map(async participant => {
                try {
                    const profile = await authStore.fetchProfileFromPubkey(participant.pubkey);
                    const rawName = profile?.displayName || profile?.name || profile?.display_name || '';
                    const name = rawName ? String(rawName) : '';
                    return name ? [participant.pubkey, name] as const : null;
                } catch (error) {
                    console.warn('Could not fetch profile for', participant.pubkey, error);
                    return null;
                }
            })
        );

        let changed = false;
        const nextCache = { ...displayNameCache };
        for (const entry of results) {
            if (entry && !nextCache[entry[0]]) {
                nextCache[entry[0]] = entry[1];
                changed = true;
            }
        }

        if (changed) {
            displayNameCache = nextCache;
        }
    }

    async function loadLeaveRequestsIfOwner() {
        if (!canInviteEditors) {
            leaveRequestsByPubkey = {};
            return;
        }

        try {
            leaveRequestsByPubkey = await boardStore.getLeaveRequestsForCurrentBoard();
        } catch (error) {
            console.warn('⚠️ Leave-Requests konnten nicht geladen werden (best-effort):', error);
            leaveRequestsByPubkey = {};
        }
    }

    async function loadEditorRequestsIfOwner() {
        if (!canInviteEditors) {
            editorRequestsByPubkey = {};
            return;
        }

        try {
            isLoadingEditorRequests = true;
            editorRequestsByPubkey = await boardStore.getEditorRequestsForCurrentBoard();
        } catch (error) {
            console.warn('⚠️ Editor-Requests konnten nicht geladen werden (best-effort):', error);
            editorRequestsByPubkey = {};
        } finally {
            isLoadingEditorRequests = false;
        }
    }
    
    // Editor einladen
    async function handleInviteEditor(pubkey?: string) {
        const targetPubkey = (pubkey ?? newEditorPubkey).trim();
        if (!targetPubkey) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.addEditor(targetPubkey);
            newEditorPubkey = '';
            await loadParticipants();
            await loadEditorRequestsIfOwner();
            toast.success('Editor hinzugefügt', {
                description: 'Der Nutzer kann jetzt das Board bearbeiten'
            });
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Einladen';
            toast.error('Fehler', { description: errorMessage });
        } finally {
            isLoading = false;
        }
    }
    
    // Editor entfernen
    async function handleRemoveEditor(pubkey: string) {
        if (!confirm('Editor wirklich entfernen?')) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.removeEditor(pubkey);
            await loadParticipants();
            toast.success('Editor entfernt');
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Entfernen';
            toast.error('Fehler', { description: errorMessage });
        } finally {
            isLoading = false;
        }
    }
    
    // Display Name für Pubkey (reactive derived)
    let participantsWithNames = $derived(
        participants.map(participant => {
            let displayName = '';
            
            // Check cache first
            if (displayNameCache[participant.pubkey]) {
                displayName = displayNameCache[participant.pubkey];
            }
            // Try authStore method (if available)
            else if (authStore.getDisplayNameForPubkey) {
                const name = authStore.getDisplayNameForPubkey(participant.pubkey);
                if (name && name !== participant.pubkey) {
                    displayName = name;
                }
            }
            // Check if it's the current user
            else if (participant.pubkey === authStore.getPubkey()) {
                const userName = authStore.getUserName();
                if (userName) displayName = userName;
            }
            
            // Fallback: shortened pubkey
            if (!displayName) {
                displayName = `${participant.pubkey.slice(0, 8)}...${participant.pubkey.slice(-4)}`;
            }
            
            return {
                ...participant,
                displayName
            };
        })
    );
    
    // Filtered participants
    let editorsAndOwners = $derived(participantsWithNames.filter(p => p.role === 'editor' || p.role === 'owner'));

    function getDisplayNameForPubkey(pubkey: string): string {
        const fromCache = displayNameCache[pubkey];
        if (fromCache) return fromCache;

        if (authStore.getDisplayNameForPubkey) {
            const name = authStore.getDisplayNameForPubkey(pubkey);
            if (name && name !== pubkey) return name;
        }

        if (pubkey === authStore.getPubkey()) {
            const userName = authStore.getUserName();
            if (userName) return userName;
        }

        return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
    }

    let editorRequestsList = $derived(
        Object.entries(editorRequestsByPubkey).map(([pubkey, info]) => ({
            pubkey,
            displayName: getDisplayNameForPubkey(pubkey),
            reason: info.reason,
            role: info.role
        }))
    );
    
    // Bei Dialog-Öffnung laden
    $effect(() => {
        if (open) {
            loadParticipants();
            loadUserRole();
            if (Object.keys(initialEditorRequests).length > 0) {
                editorRequestsByPubkey = initialEditorRequests;
            }
        }
    });

    let wasOpen = $state(false);
    $effect(() => {
        if (open && !wasOpen) {
            activeTab = initialTab;
        }
        wasOpen = open;
    });
    
    // Nur den aktiven Tab laden (verhindert langsames Open/Close)
    $effect(() => {
        if (!open) return;
        const tab = activeTab;

        if (tab === 'share-link') {
            void generateShareLinkAsync();
        }

        if (tab === 'nostr-link') {
            void generateNaddrLink();
        }
    });

    // QR-Code nur für Nostr-Link neu generieren
    $effect(() => {
        if (!open || activeTab !== 'nostr-link') return;
        const currentBaseUrl = baseUrl;
        const currentPath = naddrPath;
        if (currentBaseUrl && currentPath) {
            void regenerateQrCode();
        }
    });


    $effect(() => {
        if (!open) return;

        // Wichtig: erst nach loadUserRole() (async) wissen wir, ob Owner.
        // Dieser Effect läuft erneut, sobald userRole gesetzt wurde.
        const role = userRole;
        if (role === BoardRole.OWNER) {
            void loadLeaveRequestsIfOwner();
            void loadEditorRequestsIfOwner();
        } else {
            leaveRequestsByPubkey = {};
            editorRequestsByPubkey = {};
        }
    });
    
    // Nostr naddr-Link generieren
    async function generateNaddrLink() {
        const board = boardStore.data;
        if (!board || !board.author) {
            naddrPath = '';
            qrCodeDataUrl = '';
            return;
        }
        
        try {
            // Relay-Hints aus den öffentlichen Relays holen
            const relayHints: string[] = settingsStore.settings.relaysPublic || [];
            // Hinweis: console.log von $state-Proxies vermeiden
            
            naddrPath = createBoardNaddrUrl(board.id, board.author, relayHints);
            
            // QR-Code mit vollständiger URL generieren
            await regenerateQrCode();
        } catch (error) {
            console.error('Fehler beim Generieren des naddr-Links:', error);
            naddrPath = '';
            qrCodeDataUrl = '';
        }
    }
    
    // QR-Code neu generieren (wenn baseUrl oder naddrPath sich ändert)
    async function regenerateQrCode() {
        if (!naddrLink) {
            qrCodeDataUrl = '';
            return;
        }
        
        try {
            qrCodeDataUrl = await QRCode.toDataURL(naddrLink, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (error) {
            console.error('Fehler beim Generieren des QR-Codes:', error);
            qrCodeDataUrl = '';
        }
    }
    
    // naddr-Link kopieren
    async function copyNaddrLink() {
        try {
            await navigator.clipboard.writeText(naddrLink);
            naddrCopied = true;
            toast.success('Nostr-Link kopiert!', {
                description: 'Der naddr-Link wurde in die Zwischenablage kopiert'
            });
            setTimeout(() => naddrCopied = false, 2000);
        } catch {
            toast.error('Fehler beim Kopieren');
        }
    }
    
    // Im Browser öffnen (neuer Tab)
    function openNaddrInBrowser() {
        if (naddrLink) {
            window.open(naddrLink, '_blank');
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-lg max-h-[90vh] flex flex-col" data-testid="share-dialog">
        <Dialog.Header class="flex-shrink-0">
            <Dialog.Title>Board teilen</Dialog.Title>
            <Dialog.Description>
                Teile dieses Board mit anderen über einen Link oder verwalte Editoren.
            </Dialog.Description>
        </Dialog.Header>
        
        <!-- Scrollbarer Hauptbereich -->
        <div class="flex-1 overflow-y-auto min-h-0 pb-4 pr-3">
        <!-- Base-URL Einstellung (gilt für alle Link-Typen) -->
        <div class="mt-4 space-y-1">
            <label for="base-url-input" class="text-xs font-medium text-muted-foreground">Base-URL (für externe Zugriffe ggf. anpassen)</label>
            <input 
                id="base-url-input"
                type="text"
                bind:value={baseUrl}
                placeholder="https://example.com"
                class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs"
            />
        </div>
        
        <Tabs.Root bind:value={activeTab} class="mt-4">
            <Tabs.List class="grid w-full grid-cols-3">
                <Tabs.Trigger value="nostr-link">
                    Nostr-Link
                </Tabs.Trigger>
                <Tabs.Trigger value="share-link">
                    Share & Fork
                </Tabs.Trigger>
                <Tabs.Trigger value="editors">
                    Editoren ({editorsAndOwners.length})
                </Tabs.Trigger>
            </Tabs.List>
            
            <!-- Nostr-Link Tab (naddr) - jetzt erster Tab -->
            <Tabs.Content value="nostr-link" class="mt-4 space-y-4">
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">
                        Teile die permanente Nostr-Adresse dieses Boards. Empfänger können das Board 
                        direkt über Nostr-Relays laden und sehen immer die aktuelle Version.
                    </p>
                    
                    <!-- QR Code -->
                    {#if qrCodeDataUrl}
                        <div class="flex justify-center py-4">
                            <div class="p-3 bg-white rounded-lg shadow-sm border">
                                <img src={qrCodeDataUrl} alt="QR-Code für Nostr-Link" class="w-48 h-48" />
                            </div>
                        </div>
                        <p class="text-xs text-center text-muted-foreground">
                            Scanne diesen QR-Code, um das Board auf einem anderen Gerät zu öffnen
                        </p>
                    {/if}
                    
                    <div class="flex gap-2">
                        {#if naddrLink}
                            <Input 
                                value={naddrLink}
                                readonly
                                class="flex-1 font-mono text-xs opacity-50"
                                data-testid="naddr-link-input"
                            />
                            <Button 
                                onclick={copyNaddrLink}
                                variant="outline"
                                class="gap-2"
                                title="Link kopieren"
                            >
                                {#if naddrCopied}
                                    <CheckIcon class="h-4 w-4" />
                                {:else}
                                    <CopyIcon class="h-4 w-4" />
                                {/if}
                            </Button>
                            <Button 
                                onclick={openNaddrInBrowser}
                                variant="outline"
                                title="Im Browser öffnen"
                            >
                                <ExternalLinkIcon class="h-4 w-4" />
                            </Button>
                        {:else}
                            <div class="flex-1 p-2 text-sm text-muted-foreground bg-muted rounded-md">
                                ⚠️ Board muss veröffentlicht sein (nicht Privat) und einen Author haben.
                            </div>
                        {/if}
                    </div>
                    
                    <div class="mt-4 p-3 bg-muted rounded-md">
                        <p class="text-sm font-medium mb-2">ℹ️ Was ist ein Nostr-Link (naddr)?</p>
                        <ul class="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li><strong>Permanente Adresse:</strong> Das Board ist über diese URL immer erreichbar</li>
                            <li><strong>Immer aktuell:</strong> Empfänger sehen live die neueste Version</li>
                            <li><strong>Read-only:</strong> Besucher können das Board ansehen, aber nicht bearbeiten</li>
                            <li><strong>Dezentral:</strong> Funktioniert über jeden öffentlichen Nostr-Client/Relay</li>
                        </ul>
                    </div>
                    
                    {#if naddrLink}
                        <div class="mt-3 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                            <p class="text-xs text-green-700 dark:text-green-300">
                                <LinkIcon class="h-3 w-3 inline mr-1" />
                                Dieser Link ist klein (~80 Bytes) und funktioniert in allen Browsern.
                            </p>
                        </div>
                    {/if}
                </div>
            </Tabs.Content>
            
            <!-- Share-Link Tab (jetzt "Share & Fork") -->
            <Tabs.Content value="share-link" class="mt-4 space-y-4">
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">
                        Teile diesen Link mit anderen Nutzern. Der Link enthält alle Board-Daten 
                        - der Empfänger kann das Board forken (eigene Kopie) oder folgen.
                    </p>
                    
                    <div class="flex gap-2">
                        {#if isGeneratingLink}
                            <Input 
                                value="Link wird generiert..."
                                readonly
                                class="flex-1 font-mono text-xs"
                                disabled
                            />
                            <Button variant="outline" disabled class="gap-2">
                                <span class="animate-spin">⏳</span>
                            </Button>
                        {:else}
                            <Input 
                                value={fullShareLink}
                                readonly
                                class="flex-1 font-mono text-xs opacity-50"
                                data-testid="share-link-input"
                            />
                            <Button 
                                onclick={copyShareLink}
                                variant="outline"
                                class="gap-2"
                                disabled={!fullShareLink}
                            >
                                {#if linkCopied}
                                    <CheckIcon class="h-4 w-4" />
                                    Kopiert
                                {:else}
                                    <CopyIcon class="h-4 w-4" />
                                    Kopieren
                                {/if}
                            </Button>
                        {/if}
                    </div>
                    
                    <!-- Token-Größe Progress-Anzeige -->
                    {#if tokenSize > 0}
                        <div class="space-y-2 mt-3">
                            <div class="flex justify-between text-xs font-medium">
                                <span>Token-Größe</span>
                                <span 
                                    class:text-green-600={isSizeSafe} 
                                    class:text-yellow-600={isSizeWarning} 
                                    class:text-red-600={isSizeError}
                                >
                                    {tokenSizeKB} KB / {maxTokenSizeKB} KB ({tokenSizePercent.toFixed(1)}%)
                                </span>
                            </div>
                            <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                                <div
                                    class="h-full transition-all"
                                    class:bg-green-500={isSizeSafe}
                                    class:bg-yellow-500={isSizeWarning}
                                    class:bg-red-500={isSizeError}
                                    style="width: {Math.min(tokenSizePercent, 100)}%"
                                ></div>
                            </div>
                            {#if isSizeError}
                                <p class="text-xs text-red-600 font-semibold">
                                    ⚠️ Token zu groß! Board hat zu viele Daten für einen Share-Link.
                                </p>
                            {:else if isSizeWarning}
                                <p class="text-xs text-yellow-600">
                                    ⚠️ Token nähert sich dem Limit - Link könnte in manchen Browsern nicht funktionieren.
                                </p>
                            {/if}
                        </div>
                    {/if}
                    
                    <div class="mt-4 p-3 bg-muted rounded-md">
                        <p class="text-sm font-medium mb-2">ℹ️ Wie funktioniert das Teilen?</p>
                        <ul class="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li><strong>Fork:</strong> Eigene Kopie erstellen und unabhängig bearbeiten</li>
                            <li><strong>Folgen:</strong> Änderungen des Originals mitverfolgen (nur lesen)</li>
                            <li>Nur Editoren (siehe nächster Tab) können das Original bearbeiten</li>
                        </ul>
                    </div>
                </div>
            </Tabs.Content>
            
            <!-- Editoren Tab -->
            <Tabs.Content value="editors" class="mt-4">
                {#if canInviteEditors}
                    <div class="space-y-4 mb-4">
                        <div class="flex gap-2">
                            <Input 
                                bind:value={newEditorPubkey}
                                placeholder="Nostr Public Key (npub oder hex)"
                                disabled={isLoading}
                                class="flex-1"
                            />
                            <Button 
                                onclick={() => handleInviteEditor()}
                                disabled={isLoading || !newEditorPubkey.trim()}
                                data-testid="add-editor-button"
                            >
                                Hinzufügen
                            </Button>
                        </div>
                        
                        {#if errorMessage}
                            <p class="text-sm text-destructive text-red-600">{errorMessage}</p>
                        {/if}
                    </div>
                {/if}

                {#if canInviteEditors && editorRequestsList.length > 0}
                    <div class="space-y-2 mb-6">
                        <h4 class="text-sm font-medium">Editor-Anfragen</h4>
                        {#each editorRequestsList as request}
                            <div class="flex flex-col gap-2 p-2 rounded-md border">
                                <div class="flex flex-col gap-1">
                                    <span class="text-sm font-medium">
                                        {request.displayName}
                                    </span>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" title="Editor-Anfrage" class="bg-amber-100 text-amber-800">
                                            Editor angefragt
                                        </Badge>
                                        {#if request.role}
                                            <span class="text-xs text-muted-foreground">
                                                Rolle: {request.role}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if request.reason}
                                        <span class="text-xs text-muted-foreground">
                                            „{request.reason}“
                                        </span>
                                    {/if}
                                </div>
                                <div class="flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onclick={() => handleInviteEditor(request.pubkey)}
                                        disabled={isLoading}
                                    >
                                        Als Editor hinzufügen
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else if canInviteEditors && isLoadingEditorRequests}
                    <div class="mb-6 text-sm text-muted-foreground">
                        Editor-Anfragen werden geladen…
                    </div>
                {/if}
                
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each editorsAndOwners as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {participant.displayName}
                                </span>
                                <Badge variant={participant.role === 'owner' ? 'default' : 'secondary'}>
                                    {participant.role === 'owner' ? 'Owner' : 'Editor'}
                                </Badge>

                                {#if participant.role !== 'owner' && canInviteEditors && leaveRequestsByPubkey[participant.pubkey]}
                                    <Badge variant="outline" title="Leave-Request" class="bg-red-400">
                                        Hat das Board verlassen
                                    </Badge>
                                {/if}
                            </div>
                            
                            {#if participant.role !== 'owner' && canInviteEditors}
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onclick={() => handleRemoveEditor(participant.pubkey)}
                                    disabled={isLoading}
                                >
                                    <TrashIcon class="h-4 w-4" />
                                </Button>
                            {/if}
                        </div>
                    {/each}
                    
                    {#if editorsAndOwners.length === 0}
                        <p class="text-sm text-muted-foreground text-center py-4">
                            Keine Editoren gefunden
                        </p>
                    {/if}
                </div>
            </Tabs.Content>
        </Tabs.Root>
        </div>
        
        <Dialog.Footer class="flex-shrink-0">
            <Button variant="outline" onclick={() => open = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>