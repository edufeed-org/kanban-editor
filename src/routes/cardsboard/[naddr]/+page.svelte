<script lang="ts">
    /**
     * naddr Route: Lade Board aus Nostr und zeige es inline
     * 
     * Die URL bleibt als permanenter Share-Link erhalten:
     * 1. Dekodiere naddr aus URL
     * 2. Verbinde mit Relay-Hints
     * 3. Lade Board + Cards von Nostr
     * 4. Speichere in BoardStore (localStorage)
     * 5. Board wird über das gemeinsame +layout.svelte angezeigt (kein Redirect)
     * 
     * Dadurch funktioniert alles normal: Sidebar, Topbar, Bearbeitung (wenn Owner)
     * Die naddr-URL kann direkt als Share-Link weitergegeben werden.
     */
    import { page } from '$app/stores';
    import { base } from '$app/paths';
    import { onMount } from 'svelte';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { authStore } from '$lib/stores/authStore.svelte.js';
    import { Board, Card, Column, type CardProps } from '$lib/classes/BoardModel.js';
    import { BoardStorage } from '$lib/stores/boardstore/storage.js';
    import type NDK from '@nostr-dev-kit/ndk';
    import { NDKEvent, NDKRelay, nip19 } from '@nostr-dev-kit/ndk';
    import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
    import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
    import FollowBoardDialog from '$lib/components/board/FollowBoardDialog.svelte';

    // State
    let status = $state<'loading' | 'error' | 'success'>('loading');
    let errorMessage = $state('');
    let loadingStep = $state('naddr dekodieren...');
    let showFollowDialog = $state(false);
    let followBoardId = $state('');
    let followBoardAuthor = $state('');

    interface NaddrData {
        kind: number;
        pubkey: string;
        identifier: string;
        relays: string[];
    }

    /**
     * Dekodiere naddr String zu Komponenten
     */
    function decodeNaddr(naddrString: string): NaddrData | null {
        try {
            // Entferne "naddr1" prefix wenn vorhanden (für URL-Kompatibilität)
            const cleanNaddr = naddrString.startsWith('naddr1') ? naddrString : `naddr1${naddrString}`;
            
            const decoded = nip19.decode(cleanNaddr);
            
            if (decoded.type !== 'naddr') {
                console.error('Invalid naddr type:', decoded.type);
                return null;
            }
            
            const data = decoded.data as {
                kind: number;
                pubkey: string;
                identifier: string;
                relays?: string[];
            };
            
            return {
                kind: data.kind,
                pubkey: data.pubkey,
                identifier: data.identifier,
                relays: data.relays || []
            };
        } catch (error) {
            console.error('Failed to decode naddr:', error);
            return null;
        }
    }

    /**
     * Verbinde zu Relay-Hints aus naddr
     */
    async function connectToRelayHints(ndk: NDK, relays: string[]): Promise<void> {
        if (relays.length === 0) {
            console.log('ℹ️ Keine Relay-Hints im naddr');
            return;
        }

        console.log(`🔌 Verbinde zu ${relays.length} Relay-Hints:`, relays);
        
        for (const relayUrl of relays) {
            try {
                // Prüfe ob Relay bereits verbunden
                const existingRelay = ndk.pool.relays.get(relayUrl);
                if (existingRelay?.connectivity?.status === 1) {
                    console.log(`✅ Relay bereits verbunden: ${relayUrl}`);
                    continue;
                }
                
                // NDKRelay erfordert 3 Argumente: url, authPolicy, ndk
                const relay = new NDKRelay(relayUrl, undefined, ndk);
                ndk.pool.addRelay(relay, true);
                console.log(`🔌 Relay hinzugefügt: ${relayUrl}`);
            } catch (error) {
                console.warn(`⚠️ Konnte nicht zu Relay verbinden: ${relayUrl}`, error);
            }
        }
        
        // Kurz warten damit Relays verbinden können
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    /**
     * Lade Board von Nostr
     */
    async function loadBoardFromNostr(
        ndk: NDK,
        pubkey: string,
        identifier: string
    ): Promise<Board | null> {
        loadingStep = 'Board von Nostr laden...';
        
        const filter = {
            kinds: [30301],
            authors: [pubkey],
            '#d': [identifier]
        };

        console.log('🔍 Suche Board Event:', filter);

        const event = await ndk.fetchEvent(filter);
        
        if (!event) {
            console.error('❌ Kein Board Event gefunden');
            return null;
        }

        console.log('✅ Board Event gefunden:', event.id);

        // Konvertiere Event zu Board
        const { nostrEventToBoard } = await import('$lib/utils/nostrEvents.js');
        const boardProps = nostrEventToBoard(event);
        
        if (!boardProps.id) {
            console.error('❌ Board Props ungültig');
            return null;
        }

        return new Board(boardProps);
    }

    /**
     * Lade Cards für Board von Nostr
     */
    async function loadCardsFromNostr(
        ndk: NDK,
        board: Board,
        pubkey: string,
        identifier: string
    ): Promise<void> {
        loadingStep = 'Cards laden...';
        
        // Addressable Reference für das Board
        const aTagValue = `30301:${pubkey}:${identifier}`;
        
        const filter = {
            kinds: [30302],
            '#a': [aTagValue]
        };

        console.log('🔍 Suche Card Events für:', aTagValue);

        const events = await ndk.fetchEvents(filter);
        const cardEvents = Array.from(events);
        
        console.log(`✅ ${cardEvents.length} Card Events gefunden`);

        if (cardEvents.length === 0) return;

        // Konvertiere Events zu Cards und füge sie dem Board hinzu
        const { nostrEventToCard } = await import('$lib/utils/nostrEvents.js');
        
        for (const event of cardEvents) {
            try {
                const cardProps = nostrEventToCard(event) as CardProps & { columnName?: string };
                if (!cardProps.id) continue;

                // Finde oder erstelle Spalte (columnName kommt via @ts-ignore aus nostrEventToCard)
                const columnName = cardProps.columnName || 'To Do';
                let column = board.columns.find(c => c.name === columnName);
                
                if (!column) {
                    // Spalte existiert nicht im Board Event, erstelle sie
                    column = board.addColumn({ name: columnName });
                    console.log(`📁 Spalte erstellt: ${columnName}`);
                }

                // Prüfe ob Card bereits existiert
                const existingCard = column.findCard(cardProps.id);
                if (existingCard) {
                    // Update existierende Card (LWW)
                    const existingTime = existingCard.updatedAt ? new Date(existingCard.updatedAt).getTime() : 0;
                    const newTime = cardProps.updatedAt ? new Date(cardProps.updatedAt).getTime() : 0;
                    
                    if (newTime > existingTime) {
                        existingCard.update(cardProps);
                    }
                } else {
                    // Füge neue Card hinzu
                    const card = new Card(cardProps);
                    column.cards.push(card);
                }
            } catch (error) {
                console.warn('⚠️ Fehler beim Verarbeiten von Card Event:', error);
            }
        }

        // Sortiere Cards nach Rank (gespeichert in cardProps während Erstellung)
        // Hinweis: Card-Instanzen haben kein rank Property, aber die Position ist durch Einfügereihenfolge bestimmt
    }

    /**
     * Hauptlogik: Lade Board und leite weiter
     */
    async function loadAndRedirect() {
        try {
            // 1. Warte auf NDK
            loadingStep = 'NDK initialisieren...';
            
            // Warte bis boardStore.ndkReady true ist
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

            // 2. Dekodiere naddr
            loadingStep = 'naddr dekodieren...';
            const naddrParam = $page.params.naddr;
            
            if (!naddrParam) {
                throw new Error('Kein naddr Parameter in URL');
            }

            const naddrData = decodeNaddr(naddrParam);
            
            if (!naddrData) {
                throw new Error('Ungültiger naddr - konnte nicht dekodiert werden');
            }

            if (naddrData.kind !== 30301) {
                throw new Error(`Ungültiger Event Kind: ${naddrData.kind} (erwartet: 30301)`);
            }

            console.log('📋 naddr dekodiert:', {
                kind: naddrData.kind,
                pubkey: naddrData.pubkey.slice(0, 16) + '...',
                identifier: naddrData.identifier,
                relays: naddrData.relays
            });

            // 3. Verbinde zu Relay-Hints
            loadingStep = 'Verbinde zu Relays...';
            await connectToRelayHints(ndk, naddrData.relays);

            // ✅ Eingeloggt: Share-Link bleibt, Dialog steuert Follow/Fork
            const currentUserPubkey = authStore.getPubkey();
            if (currentUserPubkey) {
                followBoardId = naddrData.identifier;
                followBoardAuthor = naddrData.pubkey;
                showFollowDialog = true;
                status = 'success';
                return;
            }

            // 3b. Versuche zuerst AMB (30142) zu finden, die ['a', <naddr>] oder ['a', address] enthält
            loadingStep = 'Suche AMB Snapshot...';
            const aTagCandidates: string[] = [];
            // include naddr (ensure prefix)
            const cleanNaddr = naddrParam.startsWith('naddr1') ? naddrParam : `naddr1${naddrParam}`;
            aTagCandidates.push(cleanNaddr);
            // include address string fallback
            const addressString = `30301:${naddrData.pubkey}:${naddrData.identifier}`;
            aTagCandidates.push(addressString);

            for (const aCandidate of aTagCandidates) {
                try {
                    const ambFilter = { kinds: [30142], '#a': [aCandidate] };
                    const ambEvent = await ndk.fetchEvent(ambFilter);
                    if (ambEvent) {
                        console.log('✅ Found AMB event via a-tag:', aCandidate, ambEvent.id);
                        // Check for snapshot-eventid tag
                        const snapshotTag = ambEvent.tags.find(t => t[0] === 'snapshot-eventid')?.[1];
                        if (snapshotTag) {
                            loadingStep = 'Snapshot laden...';
                            const snapshotEvent = await ndk.fetchEvent({ ids: [snapshotTag] });
                            if (snapshotEvent) {
                                try {
                                    const snapshotJson = JSON.parse(snapshotEvent.content);
                                    // Import into store and redirect
                                    BoardStorage.saveBoard(new Board(snapshotJson));
                                    boardStore.refreshBoardIds();
                                    boardStore.loadBoard(snapshotJson.id);
                                    status = 'success';
                                    return;
                                } catch (err) {
                                    console.warn('Fehler beim Parsen des Snapshot-Inhalts:', err);
                                }
                            }
                        }
                        // If AMB found but no snapshot-eventid, try other candidates or fallback to 30301
                    }
                } catch (err) {
                    console.warn('Error while searching AMB for a-tag', aCandidate, err);
                }
            }

            // 4. Prüfe ob Board bereits lokal existiert
            const boardId = naddrData.identifier;
            const existingBoard = BoardStorage.loadBoard(boardId);
            
            if (existingBoard) {
                console.log('✅ Board bereits lokal vorhanden, lade direkt');
                loadingStep = 'Board wird geöffnet...';
                
                // Lade das Board im Store
                boardStore.loadBoard(boardId);
                
                status = 'success';
                return;
            }

            // 5. Lade Board von Nostr
            const board = await loadBoardFromNostr(
                ndk,
                naddrData.pubkey,
                naddrData.identifier
            );

            if (!board) {
                throw new Error('Board konnte nicht von Nostr geladen werden');
            }

            // 6. Lade Cards
            await loadCardsFromNostr(
                ndk,
                board,
                naddrData.pubkey,
                naddrData.identifier
            );

            // 7. Speichere Board lokal
            loadingStep = 'Board speichern...';
            BoardStorage.saveBoard(board);

            // ✅ Wenn User eingeloggt ist und nicht Owner: Board als geteiltes Viewer-Board cachen
            const viewerPubkey = authStore.getPubkey();
            if (viewerPubkey && board.author && board.author !== viewerPubkey) {
                const updatedAtMs = board.updatedAt ? new Date(board.updatedAt).getTime() : undefined;
                boardStore.handleSharedBoardEvent({
                    id: board.id,
                    name: board.name,
                    description: board.description,
                    createdAt: new Date(board.createdAt).getTime(),
                    updatedAt: updatedAtMs,
                    isShared: true,
                    userRole: 'viewer',
                    author: board.author
                });
            }
            
            // Board-IDs neu laden damit es in der Liste erscheint
            boardStore.refreshBoardIds();

            // 8. Lade das Board im Store
            loadingStep = 'Board wird geöffnet...';
            boardStore.loadBoard(board.id);

            // 9. Board ist geladen — Layout rendert es automatisch
            status = 'success';
            console.log('✅ Board geladen und gespeichert, URL bleibt als Share-Link');

        } catch (error) {
            console.error('❌ Fehler beim Laden:', error);
            status = 'error';
            errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
        }
    }

    onMount(() => {
        loadAndRedirect();
    });
</script>

<!-- Loading/Error Overlay (position: fixed, überlagert das Board aus dem Layout) -->
{#if status === 'loading'}
    <div class="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div class="text-center p-8 max-w-md">
            <div class="flex flex-col items-center gap-4">
                <LoaderCircleIcon class="h-12 w-12 animate-spin text-primary" />
                <h1 class="text-xl font-semibold">Board wird geladen...</h1>
                <p class="text-muted-foreground">{loadingStep}</p>
            </div>
        </div>
    </div>
{:else if status === 'error'}
    <div class="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div class="text-center p-8 max-w-md">
            <div class="flex flex-col items-center gap-4">
                <AlertCircleIcon class="h-12 w-12 text-destructive" />
                <h1 class="text-xl font-semibold text-destructive">Fehler beim Laden</h1>
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

<FollowBoardDialog bind:open={showFollowDialog} boardId={followBoardId} boardAuthor={followBoardAuthor} />
