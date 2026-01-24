<script lang="ts">
/**
 * NAddr-basierte Board-Ansicht
 * 
 * URL-Format: /cardsboard/naddr1...
 * 
 * Lädt ein Board von Nostr basierend auf dem NIP-19 naddr Parameter.
 * Jeder User mit Relay-Zugang kann das Board anzeigen (Read-Only View).
 * 
 * Der naddr enthält:
 * - kind: 30301 (Kanban Board)
 * - pubkey: Board-Autor
 * - identifier (d-tag): Board-ID
 * - relays: Optional relay hints
 */
import { onMount, getContext } from 'svelte';
import { goto } from '$app/navigation';
import { nip19 } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import Board from "../Board.svelte";
import Topbar from "../Topbar.svelte";
import type { Column } from "../types.js";
import { Board as BoardClass, type BoardProps, type CardProps, type ColumnProps } from '$lib/classes/BoardModel.js';
import { nostrEventToBoard, nostrEventToCard } from '$lib/utils/nostrEvents.js';
import { Button } from "$lib/components/ui/button/index.js";
import LoaderIcon from "@lucide/svelte/icons/loader";
import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
import HomeIcon from "@lucide/svelte/icons/home";
import UserPlusIcon from "@lucide/svelte/icons/user-plus";
import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
import { toast } from "svelte-sonner";
import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
import { authStore } from '$lib';

// Page data from +page.ts
let { data } = $props();

// Get NDK from context (initialized in +layout.svelte)
const ndk = getContext<NDK>('ndk');

// State
let loading = $state(true);
let error = $state<string | null>(null);
let board = $state<BoardClass | null>(null);
let boardAuthor = $state<string>('');
let boardId = $state<string>('');
let relayHints = $state<string[]>([]);

// Derived: Convert Board to UI format
let columns = $derived.by((): Column[] => {
    if (!board) return [];
    
    return board.columns.map((col, colIndex) => ({
        id: col.id,
        name: col.name,
        color: col.color,
        items: col.cards.map((card, cardIndex) => ({
            id: card.id,
            name: card.heading, // CardItem uses 'name' not 'title'
            description: card.content || '',
            color: card.color,
            labels: card.labels || [],
            comments: card.comments || [],
            attendees: card.attendees || [],
            publishState: card.publishState || 'published',
            author: card.author,
            image: card.image,
            link: card.links?.[0]?.url // First link if exists
        }))
    }));
});

let boardTitle = $derived(board?.name || 'Board wird geladen...');

// Check if current user is the board owner or maintainer
let canEdit = $derived.by(() => {
    const currentPubkey = authStore.getPubkey();
    if (!currentPubkey || !board) return false;
    
    // Owner can always edit
    if (board.author === currentPubkey) return true;
    
    // Maintainers can edit
    if (board.maintainers?.includes(currentPubkey)) return true;
    
    return false;
});

// Decode naddr and load board on mount
onMount(async () => {
    const naddrParam = data.naddr;
    
    if (!naddrParam) {
        error = 'Keine naddr in der URL gefunden';
        loading = false;
        return;
    }
    
    try {
        // 1. Decode NIP-19 naddr
        console.log('🔍 Dekodiere naddr:', naddrParam);
        const decoded = decodeNaddr(naddrParam);
        
        if (!decoded) {
            error = 'Ungültiges naddr Format';
            loading = false;
            return;
        }
        
        boardId = decoded.identifier;
        boardAuthor = decoded.pubkey;
        relayHints = decoded.relays || [];
        
        console.log('✅ naddr dekodiert:', { boardId, boardAuthor, relayHints });
        
        // 2. Wait for NDK to be ready
        if (!ndk) {
            error = 'Nostr-Verbindung nicht verfügbar';
            loading = false;
            return;
        }
        
        // 3. Load board from Nostr
        await loadBoardFromNostr();
        
    } catch (e) {
        console.error('❌ Fehler beim Laden des Boards:', e);
        error = e instanceof Error ? e.message : 'Unbekannter Fehler';
        loading = false;
    }
});

/**
 * Decode NIP-19 naddr to extract board info
 */
function decodeNaddr(naddr: string): { kind: number; pubkey: string; identifier: string; relays?: string[] } | null {
    try {
        // Remove 'nostr:' prefix if present
        const cleanNaddr = naddr.replace(/^nostr:/, '');
        
        const decoded = nip19.decode(cleanNaddr);
        
        if (decoded.type !== 'naddr') {
            console.error('❌ Nicht ein naddr:', decoded.type);
            return null;
        }
        
        const data = decoded.data as { kind: number; pubkey: string; identifier: string; relays?: string[] };
        
        // Validate it's a Kanban Board (Kind 30301)
        if (data.kind !== 30301) {
            console.warn('⚠️ Unerwarteter Event-Kind:', data.kind, '(erwartet: 30301)');
            // Still proceed - could be a different addressable event type
        }
        
        return data;
        
    } catch (e) {
        console.error('❌ naddr Dekodierung fehlgeschlagen:', e);
        return null;
    }
}

/**
 * Load board and cards from Nostr relays
 */
async function loadBoardFromNostr(): Promise<void> {
    try {
        console.log('📡 Lade Board von Nostr...', { boardId, boardAuthor });
        
        // 1. Fetch Board Event (Kind 30301)
        const boardFilter = {
            kinds: [30301],
            authors: [boardAuthor],
            '#d': [boardId]
        };
        
        const boardEvent = await ndk.fetchEvent(boardFilter);
        
        if (!boardEvent) {
            throw new Error('Board nicht gefunden. Möglicherweise existiert es nicht oder das Relay ist nicht erreichbar.');
        }
        
        console.log('✅ Board Event geladen:', boardEvent.id);
        
        // 2. Convert to Board object
        const boardProps = nostrEventToBoard(boardEvent);
        board = new BoardClass(boardProps);
        
        console.log('✅ Board erstellt:', board.name, 'mit', board.columns.length, 'Spalten');
        
        // 3. Fetch Card Events (Kind 30302) for this board
        const boardRef = `30301:${boardAuthor}:${boardId}`;
        
        const cardFilter = {
            kinds: [30302],
            '#a': [boardRef]
        };
        
        console.log('📡 Lade Cards mit Filter:', cardFilter);
        
        const cardEvents = await ndk.fetchEvents(cardFilter);
        
        console.log(`✅ ${cardEvents.size} Card Events gefunden`);
        
        // 4. Process cards and add to columns
        const cardsByColumn = new Map<string, CardProps[]>();
        
        for (const event of cardEvents) {
            try {
                const cardProps = nostrEventToCard(event);
                
                // Find column name from 's' tag
                const columnTag = event.tags.find((t: string[]) => t[0] === 's');
                const columnName = columnTag?.[1] || 'Unbekannt';
                
                // Find column by name
                const column = board.columns.find(c => c.name === columnName);
                if (column) {
                    if (!cardsByColumn.has(column.id)) {
                        cardsByColumn.set(column.id, []);
                    }
                    cardsByColumn.get(column.id)!.push(cardProps);
                } else {
                    console.warn('⚠️ Spalte nicht gefunden für Card:', columnName);
                }
                
            } catch (e) {
                console.error('❌ Fehler beim Verarbeiten einer Card:', e);
            }
        }
        
        // 5. Add cards to columns (sorted by rank if available)
        for (const column of board.columns) {
            const cards = cardsByColumn.get(column.id) || [];
            
            // Sort by rank tag if present
            cards.sort((a, b) => {
                const rankA = (a as any).rank ?? 999;
                const rankB = (b as any).rank ?? 999;
                return rankA - rankB;
            });
            
            // Add cards to column
            for (const cardProps of cards) {
                column.addCard(cardProps);
            }
        }
        
        console.log('✅ Board vollständig geladen mit', 
            board.columns.reduce((sum, col) => sum + col.cards.length, 0), 'Cards');
        
        // 6. Load comments for all cards
        await loadAllComments();
        
        loading = false;
        
    } catch (e) {
        console.error('❌ Fehler beim Laden des Boards:', e);
        throw e;
    }
}

/**
 * Load comments for all cards in the board
 */
async function loadAllComments(): Promise<void> {
    if (!board) return;
    
    try {
        // Collect all card refs for comment loading
        const cardRefs: string[] = [];
        
        for (const column of board.columns) {
            for (const card of column.cards) {
                const cardRef = `30302:${card.author || boardAuthor}:${card.id}`;
                cardRefs.push(cardRef);
            }
        }
        
        if (cardRefs.length === 0) return;
        
        console.log('📡 Lade Kommentare für', cardRefs.length, 'Cards...');
        
        // Fetch comment events (Kind 1 with 'a' tag referencing cards)
        const commentFilter = {
            kinds: [1],
            '#a': cardRefs
        };
        
        const commentEvents = await ndk.fetchEvents(commentFilter);
        
        console.log(`✅ ${commentEvents.size} Kommentare geladen`);
        
        // Add comments to cards
        for (const event of commentEvents) {
            try {
                const aTag = event.tags.find((t: string[]) => t[0] === 'a');
                if (!aTag) continue;
                
                const cardRef = aTag[1];
                const cardId = cardRef.split(':')[2]; // Format: 30302:pubkey:cardId
                
                // Find card and add comment
                for (const column of board.columns) {
                    const card = column.findCard(cardId);
                    if (card) {
                        card.addComment(event.content, event.pubkey);
                        break;
                    }
                }
                
            } catch (e) {
                console.error('❌ Fehler beim Verarbeiten eines Kommentars:', e);
            }
        }
        
    } catch (e) {
        console.error('❌ Fehler beim Laden der Kommentare:', e);
    }
}

/**
 * Follow/Add this board to user's board list
 */
async function followBoard(): Promise<void> {
    if (!board || !boardId || !boardAuthor) {
        toast.error('Board-Daten nicht verfügbar');
        return;
    }
    
    try {
        // Import and use BoardSharingOperations
        const { BoardSharingOperations } = await import('$lib/stores/boardstore/sharing.js');
        
        await BoardSharingOperations.followBoard(boardId, boardAuthor, ndk);
        
        toast.success('Board wurde hinzugefügt!', {
            description: 'Du findest es jetzt in deiner Board-Liste.'
        });
        
        // Navigate to the board in normal view
        goto('/cardsboard');
        
    } catch (e) {
        console.error('❌ Fehler beim Folgen des Boards:', e);
        toast.error('Fehler beim Hinzufügen', {
            description: e instanceof Error ? e.message : 'Unbekannter Fehler'
        });
    }
}

/**
 * Go back to main board view
 */
function goHome(): void {
    goto('/cardsboard');
}

/**
 * Copy shareable link to clipboard
 */
async function copyShareLink(): Promise<void> {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast.success('Link kopiert!');
}

// Read-only handler - no changes allowed for non-editors
function handleBoardUpdated(newColumns: Column[]): void {
    if (!canEdit) {
        toast.info('Nur Lesen', {
            description: 'Du kannst dieses Board nur ansehen, nicht bearbeiten.'
        });
        return;
    }
    
    // If user can edit, sync changes
    // Note: This would need integration with the actual board sync
    console.log('📝 Board-Update (canEdit=true) - TODO: Implement edit sync');
}
</script>

<div class="flex h-screen w-full flex-col overflow-hidden">
    {#if loading}
        <!-- Loading State -->
        <div class="flex h-full items-center justify-center">
            <div class="flex flex-col items-center gap-4">
                <LoaderIcon class="h-8 w-8 animate-spin text-muted-foreground" />
                <p class="text-muted-foreground">Board wird geladen...</p>
                {#if boardId}
                    <p class="text-xs text-muted-foreground/60">ID: {boardId}</p>
                {/if}
            </div>
        </div>
        
    {:else if error}
        <!-- Error State -->
        <div class="flex h-full items-center justify-center p-4">
            <div class="max-w-md rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div class="flex items-center gap-2 text-destructive">
                    <AlertCircleIcon class="h-4 w-4" />
                    <h3 class="font-semibold">Board nicht gefunden</h3>
                </div>
                <p class="mt-2 text-sm text-muted-foreground">
                    {error}
                </p>
                <div class="mt-4 flex gap-2">
                    <Button variant="outline" onclick={goHome}>
                        <HomeIcon class="mr-2 h-4 w-4" />
                        Zur Startseite
                    </Button>
                </div>
            </div>
        </div>
        
    {:else if board}
        <!-- Board View -->
        <main class="flex flex-1 flex-col overflow-hidden">
            <!-- Custom Topbar for shared view -->
            <header class="flex h-14 items-center justify-between border-b bg-background px-4">
                <div class="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onclick={goHome}>
                        <HomeIcon class="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 class="text-lg font-semibold">{boardTitle}</h1>
                        {#if board.description}
                            <p class="text-xs text-muted-foreground line-clamp-1">{board.description}</p>
                        {/if}
                    </div>
                </div>
                
                <div class="flex items-center gap-2">
                    <!-- Read-only indicator -->
                    {#if !canEdit}
                        <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            Nur Lesen
                        </span>
                    {/if}
                    
                    <!-- Copy Link -->
                    <Button variant="outline" size="sm" onclick={copyShareLink}>
                        <ExternalLinkIcon class="mr-2 h-4 w-4" />
                        Link kopieren
                    </Button>
                    
                    <!-- Follow Board (if not owner) -->
                    {#if !canEdit && authStore.isAuthenticated}
                        <Button variant="default" size="sm" onclick={followBoard}>
                            <UserPlusIcon class="mr-2 h-4 w-4" />
                            Board folgen
                        </Button>
                    {/if}
                </div>
            </header>
            
            <!-- Board Content -->
            <div class="flex-1 overflow-hidden p-0 min-h-0">
                <Board 
                    columns={columns} 
                    onFinalUpdate={handleBoardUpdated}
                    readOnly={!canEdit}
                />
            </div>
        </main>
    {/if}
</div>
