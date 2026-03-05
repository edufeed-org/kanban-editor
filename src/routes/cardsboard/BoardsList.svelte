<script lang="ts">
    import { flip } from 'svelte/animate';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
    import * as Popover from '$lib/components/ui/popover/index.js';
    import { slide } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { authStore } from '$lib/index.js';
    import { BoardRole } from '$lib/types/sharing';
    import { toast } from 'svelte-sonner';
    import { createBoardNaddrUrl } from '$lib/utils/nostrEvents.js';

    import MenuItem from './MenuItem.svelte';
    import SubmenuItem from './SubmenuItem.svelte';

    import { ProfileEditor } from '$lib/components/auth/index.js';
    import ShareDialog from '$lib/components/board/ShareDialog.svelte';
    import ShareToCommunitiesDialog from '$lib/components/board/ShareToCommunitiesDialog.svelte';
    import VersionHistory from '$lib/components/board/VersionHistory.svelte';
    import { DownloadIcon, FileTextIcon, UploadIcon, PackageOpenIcon, 
        UserPlusIcon, LinkIcon, PencilIcon, EyeIcon, BookIcon, InfoIcon,
        GlobeIcon, SendIcon, SquarePlusIcon, TrashIcon,
        LoaderIcon, CircleIcon, SearchIcon, Share2Icon, UsersIcon, HouseIcon, 
        CircleQuestionMarkIcon} from '@lucide/svelte/icons';
    import LiaScriptExportDialog from '$lib/components/LiaScriptExportDialog.svelte';
    import PublishToEdufeedDialog from './PublishToEdufeedDialog.svelte';
    import FAQDialog from './FAQDialog.svelte';
    import PublicBoardsDialog from './PublicBoardsDialog.svelte';
    import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
    // Sicherer Flip-Wrapper: Vermeidet Fehler bei ungültigen Größen (NaN-Werte)
    type FlipParams = {
        delay?: number;
        duration?: number | ((len: number) => number);
        easing?: (t: number) => number;
    };

    function safeFlip(
        node: Element,
        { from, to }: { from: DOMRect; to: DOMRect },
        params?: FlipParams
    ) {
        const valid =
            Number.isFinite(from.width) &&
            Number.isFinite(from.height) &&
            Number.isFinite(to.width) &&
            Number.isFinite(to.height) &&
            from.width > 0 &&
            from.height > 0 &&
            to.width > 0 &&
            to.height > 0;

        if (!valid) {
            return { duration: 0 };
        }

        return flip(node, { from, to }, params);
    }

    // Props
    let { 
        currentBoardId = '', 
        hamburgerMenuOpen = $bindable(false)
    }: { 
        currentBoardId?: string;
        hamburgerMenuOpen?: boolean;
    } = $props();

    // State
    let searchQuery = $state('');
    let isCreating = $state(false);
    let isLoading = $state(false);
    
    // Board Settings Dialog State
    let settingsDialogOpen = $state(false);
    let previousDialogState = $state(false);
    
    // Profile Editor Dialog State
    let profileEditorOpen = $state(false);
    
    let sharePopoverOpen = $state(false);
    let shareToCommunitiesOpen = $state(false);
    let shareEditorsOpen = $state(false);
    let shareLinksOpen = $state(false);
    
    // Import & Export States
    let importExportPopoverOpen = $state(false);
    let liaScriptExportDialogOpen = $state(false);
    let publishToEdufeedDialogOpen = $state(false);
    let importDialogOpen = $state(false);
    
    // Wissenswertes States
    let wissenswertesPopoverOpen = $state(false);
    let faqDialogOpen = $state(false);
    let publicBoardsDialogOpen = $state(false);
    let importFile = $state<File | null>(null);
    let importMode = $state<'merge' | 'new' | 'overwrite'>('merge');
    
    // Board Settings Form
    let metaForm = $state({
        title: '',
        description: '',
        tags: '',
        license: 'cc-by-4.0',
        publishState: 'private' as 'private' | 'published'
    });
    
    // Derived values for board settings
    let currentBoardTitle = $derived(boardStore.boardMeta.name || 'Mein Projekt Board');
    let currentBoardDescription = $derived(boardStore.boardMeta.description || '');
    let currentBoardPublishState = $derived(boardStore.data?.publishState || 'private');
    let currentBoardLicense = $derived(boardStore.data?.ccLicense || 'cc-by-4.0');
    let currentUserRole = $derived(boardStore.getCurrentUserRole());
    let canEditBoardMeta = $derived(currentUserRole === BoardRole.OWNER);
    
    // CC License options
    const ccLicenses = [
        { value: 'cc0', label: 'CC0 1.0 (Public Domain)' },
        { value: 'cc-by-4.0', label: 'CC BY 4.0 (Attribution)' },
        { value: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0 (Attribution-ShareAlike)' },
        { value: 'cc-by-nc-4.0', label: 'CC BY-NC 4.0 (Attribution-NonCommercial)' },
        { value: 'cc-by-nd-4.0', label: 'CC BY-ND 4.0 (Attribution-NoDerivs)' },
        { value: 'cc-by-nc-sa-4.0', label: 'CC BY-NC-SA 4.0 (Attribution-NonCommercial-ShareAlike)' },
        { value: 'cc-by-nc-nd-4.0', label: 'CC BY-NC-ND 4.0 (Attribution-NonCommercial-NoDerivs)' }
    ];

    // ⚠️ FIXED: Trigger shared boards loading in $effect (not in $derived!)
    // This prevents state_unsafe_mutation error
    $effect(() => {
        // Trigger when user logs in/out
        const user = authStore.currentUser;
        if (user) {
            boardStore.triggerLoadSharedBoards();
        }
    });
    
    // Sync form data when dialog opens
    $effect(() => {
        if (settingsDialogOpen && !previousDialogState) {
            metaForm.title = currentBoardTitle;
            metaForm.description = currentBoardDescription;
            metaForm.tags = boardStore.data?.tags?.join(', ') || '';
            metaForm.license = currentBoardLicense;
            metaForm.publishState = currentBoardPublishState;
        }
        previousDialogState = settingsDialogOpen;
    });

    // Abgeleitete Boards-Liste (mit Filterung + geteilte Boards)
    let filteredBoards = $derived.by(() => {
        // ⚡ KRITISCH: updateTrigger für Reaktivität!
        // Ohne dies wird die Liste nicht aktualisiert bei neuen Boards von Nostr
        boardStore.updateTrigger;
        
        // Eigene Boards + Boards bei denen User Maintainer/Follower ist
        const ownBoards = boardStore.filterBoards(searchQuery);
        const sharedBoards = boardStore.filterSharedBoards(searchQuery);
        
        // Eigene Boards anreichern: Prüfe ob Board dem aktuellen User gehört
        // getAllBoards() gibt auch Boards zurück bei denen User Maintainer (Editor) ist!
        const currentPubkey = authStore.getPubkey();
        const enrichedOwnBoards = ownBoards.map(board => {
            const isOwner = !board.author || board.author === currentPubkey;
            return {
                ...board,
                isShared: !isOwner,
                userRole: isOwner ? 'owner' : 'editor'
            };
        });
        
        // Kombiniere beide Listen und entferne Duplikate
        // ⚠️ WICHTIG: Bei Duplikaten (Board ist sowohl own als auch shared) bevorzuge shared-Metadaten
        // Dies verhindert dass Editor-Klicks fälschlich deleteBoard() auslösen
        const boardMap = new Map();
        
        // Füge erst eigene Boards hinzu
        for (const board of enrichedOwnBoards) {
            boardMap.set(board.id, board);
        }
        
        // Überschreibe mit shared boards (damit isShared/userRole korrekt sind)
        for (const board of sharedBoards) {
            boardMap.set(board.id, board);
        }

        // ✅ Aktives Fremd-Board einfügen wenn es nicht in boardMap ist (z.B. nach Seiten-Reload).
        // Nach einem Reload ist cachedSharedBoards leer (onAuthChanged clears it) und die Nostr-
        // Abfrage noch nicht abgeschlossen. Das Board ist aber in localStorage vorhanden und wird
        // vom Store geladen – es fehlt nur in der Sidebar-Liste.
        const activeBoardId = boardStore.data?.id;
        const activeBoard = boardStore.data;
        if (
            activeBoardId &&
            activeBoardId === currentBoardId &&
            !boardMap.has(activeBoardId) &&
            activeBoard?.author &&
            activeBoard.author !== authStore.getPubkey()
        ) {
            const lastAccTimestamp = activeBoard.lastAccessedAt
                ? new Date(activeBoard.lastAccessedAt).getTime()
                : undefined;
            const updatedTimestamp = activeBoard.updatedAt
                ? new Date(activeBoard.updatedAt).getTime()
                : undefined;
            const createdTimestamp = activeBoard.createdAt
                ? new Date(activeBoard.createdAt).getTime()
                : Date.now();
            // Ermittle die echte Rolle aus dem geladenen Board (korrekt für Editor/Viewer)
            const activeBoardRole = boardStore.getCurrentUserRole();
            const activeBoardRoleStr = activeBoardRole === 'owner' ? 'owner'
                : activeBoardRole === 'editor' ? 'editor'
                : 'viewer';
            boardMap.set(activeBoardId, {
                id: activeBoardId,
                name: activeBoard.name,
                description: activeBoard.description,
                createdAt: createdTimestamp,
                updatedAt: updatedTimestamp,
                lastAccessed: lastAccTimestamp,
                isShared: true,
                userRole: activeBoardRoleStr,
                author: activeBoard.author
            });
        }
        
        // Konvertiere zu Array und sortiere nach lastAccessed (neueste zuerst)
        const uniqueBoards = Array.from(boardMap.values()).sort((a, b) => {
            const timeA = a.lastAccessed || a.updatedAt || a.createdAt || 0;
            const timeB = b.lastAccessed || b.updatedAt || b.createdAt || 0;
            return timeB - timeA; // Neueste zuerst
        });
        
        return uniqueBoards;
    });

    /**
     * Navigiere zur naddr-URL des aktuellen Boards.
     * Nutzt replaceState damit kein neuer History-Eintrag pro Board-Wechsel entsteht.
     */
    function navigateToBoardUrl() {
        const board = boardStore.data;
        
        // Demo-Board Check: Keine naddr-URL für Demo-Boards erstellen
        const isDemoBoard = board?.id === 'demo-board' || 
                           board?.author === 'demo' || 
                           board?.author === '0000000000000000000000000000000000000000000000000000000000000000';
        
        if (isDemoBoard) {
            // Demo-Board: Bleibe auf /cardsboard/ (keine naddr)
            goto('/cardsboard/', { replaceState: true });
        } else if (board?.author) {
            try {
                const naddrUrl = createBoardNaddrUrl(board.id, board.author);
                goto(naddrUrl, { replaceState: true });
            } catch (error) {
                console.warn('⚠️ Konnte naddr-URL nicht erstellen:', error);
                // Fallback: Bleibe auf /cardsboard/
                goto('/cardsboard/', { replaceState: true });
            }
        } else {
            // Kein Author (z.B. lokales Board ohne Nostr-Pubkey) → einfache URL
            goto('/cardsboard/', { replaceState: true });
        }
    }

    // Event: Neues Board erstellen
    async function handleCreateBoard() {
        isCreating = true;
        try {
            const newBoardId = boardStore.createBoard('Neues Board');
            boardStore.loadBoard(newBoardId);
            currentBoardId = newBoardId;
            navigateToBoardUrl();

            searchQuery = '';
        } catch (error) {
            console.error('❌ Fehler beim Erstellen:', error);
        } finally {
            isCreating = false;
        }
    }

    // Event: Board auswählen/laden
    async function handleSelectBoard(boardId: string) {
        if (boardId === currentBoardId) {
            console.log('📌 Board bereits aktiv:', boardId);
            return;
        }
        
        isLoading = true;
        try {
            const success = boardStore.loadBoard(boardId);
            if (success) {
                currentBoardId = boardId;
                navigateToBoardUrl();
                console.log('✅ Board geladen:', boardId);
            }
        } catch (error) {
            console.error('❌ Fehler beim Laden:', error);
        } finally {
            isLoading = false;
        }
    }

    // Event: Board löschen oder verlassen
    async function handleDeleteBoard(boardId: string, event: Event) {
        event.stopPropagation();
        
        // Finde das Board in der gefilterten Liste um isShared und userRole zu prüfen
        const targetBoard = filteredBoards.find(b => b.id === boardId);
        
        // Fallback: Wenn Board nicht in filteredBoards, prüfe ob es ein Fremd-Board ist
        const isShared = targetBoard?.isShared ?? (boardStore.data?.id === boardId && boardStore.data?.author !== authStore.getPubkey() && !!boardStore.data?.author);
        const storeRole = boardId === boardStore.data?.id ? boardStore.getCurrentUserRole() : null;
        const userRole = targetBoard?.userRole ?? (storeRole === 'owner' ? 'owner' : storeRole === 'editor' ? 'editor' : storeRole === 'viewer' ? 'viewer' : 'owner');
        
        const actionText = isShared 
            ? (userRole === 'owner' ? 'Board löschen' : 'Board verlassen')
            : 'Board löschen';
            
        const warningText = isShared && userRole !== 'owner'
            ? '⚠️ Dieses Board wirklich verlassen? Sie verlieren den Zugang!'
            : '⚠️ Dieses Board wirklich löschen? Die Aktion kann nicht rückgängig gemacht werden!';
        
        if (!confirm(warningText)) {
            return;
        }
        
        try {
            if (isShared && userRole !== 'owner') {
                // Board verlassen: Nutzer aus Maintainer/Follower Liste entfernen
                await boardStore.leaveBoard(boardId);
                console.log('🚪 Board verlassen:', boardId);
            } else {
                // Normales Löschen (eigenes Board oder Owner von geteiltem Board)
                const ok = boardStore.deleteBoard(boardId);
                if (ok) {
                    console.log('🗑️ Board gelöscht:', boardId);
                } else {
                    console.log('🚫 Board NICHT gelöscht (fehlende Berechtigung oder Schutz-Guard):', boardId);
                }
            }
            
            // Wenn das gelöschte Board das aktuelle war, wird loadBoard() automatisch ein anderes laden
            if (boardId === currentBoardId) {
                const remaining = boardStore.getAllBoards();
                if (remaining.length > 0) {
                    currentBoardId = remaining[0].id;
                }
            }
        } catch (error) {
            console.error('❌ Fehler beim Löschen/Verlassen:', error);
        }
    }

    // Formatierung: Datum
    function formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Gestern';
        } else {
            return date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
        }
    }
    
    // Board Settings: Save handler
    function handleSaveBoardSettings() {
        if (!canEditBoardMeta) {
            toast.error('Keine Berechtigung', {
                description: 'Nur der Board-Owner kann Metadaten bearbeiten.'
            });
            return;
        }
        
        try {
            // Update board metadata
            boardStore.updateCurrentBoardMeta({
                name: metaForm.title,
                description: metaForm.description,
                tags: metaForm.tags.split(',').map(t => t.trim()).filter(Boolean),
                ccLicense: metaForm.license,
                publishState: metaForm.publishState
            });
            
            toast.success('✅ Board-Einstellungen gespeichert');
            settingsDialogOpen = false;
        } catch (error) {
            console.error('❌ Fehler beim Speichern:', error);
            toast.error('Fehler beim Speichern der Einstellungen');
        }
    }
</script>

<div class="flex flex-col gap-3 h-full overflow-hidden p-2">
    
    <!-- Expandable Menu (Dropdown-Style) -->
    {#if hamburgerMenuOpen}
        <div transition:slide={{ duration: 200 }} class="border-b rounded -mx-0 -mt-2 mb-1 max-h-[40vh] overflow-y-auto bg-[var(--card)]">
            <!-- 1. Eigenschaften (Board Settings) -->
            <MenuItem 
                icon={PackageOpenIcon} 
                label="Eigenschaften" 
                onclick={() => { 
                    settingsDialogOpen = true;
                    hamburgerMenuOpen = false;
                }}
                disabled={!authStore.isAuthenticated}
                showBorder={false}
            />
            
            <!-- 2. Import & Export Menu Item with Popover Submenu -->
            <Popover.Root bind:open={importExportPopoverOpen}>
                <Popover.Trigger class="w-full">
                    <MenuItem 
                        icon={DownloadIcon} 
                        label="Import & Export" 
                        onclick={() => {}}
                        showBorder={false}
                        showChevron={true}
                    />
                </Popover.Trigger>
                <Popover.Content side="right" align="start" class="w-56 p-0">
                    <div class="space-y-0">
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem 
                                icon={UploadIcon} 
                                label="Von JSON importieren" 
                                onclick={() => { 
                                    importDialogOpen = true;
                                    importExportPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem 
                                icon={DownloadIcon} 
                                label="Als JSON downloaden" 
                                onclick={() => { 
                                    try {
                                        const jsonString = boardStore.exportBoardAsJson(true);
                                        const blob = new Blob([jsonString], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const boardName = boardStore.data?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'board';
                                        const dateStr = new Date().toISOString().split('T')[0];
                                        const filename = `${boardName}_${dateStr}.json`;
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = filename;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        toast.success('Board als JSON exportiert');
                                        importExportPopoverOpen = false;
                                        hamburgerMenuOpen = false;
                                    } catch (error) {
                                        console.error('❌ Export fehlgeschlagen:', error);
                                        toast.error('Export fehlgeschlagen');
                                    }
                                }}
                            />
                        </div>
                        
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem 
                                icon={FileTextIcon} 
                                label="Als Liascript exportieren" 
                                onclick={() => { 
                                    liaScriptExportDialogOpen = true;
                                    importExportPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Root>
            
            <!-- 3. Teilen (Share) -->
            <Popover.Root bind:open={sharePopoverOpen}>
                <Popover.Trigger class="w-full">
                    <MenuItem 
                        icon={Share2Icon} 
                        label="Teilen" 
                        onclick={() => {}}
                        showBorder={false}
                        showChevron={true}
                    />
                </Popover.Trigger>
                <Popover.Content side="right" align="start" class="w-56 p-0">
                    <div class="space-y-0">
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={UserPlusIcon}
                                label="Schreibrechte zuweisen"
                                onclick={() => {
                                    shareEditorsOpen = true;
                                    sharePopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={LinkIcon}
                                label="Link für Beobachter"
                                onclick={() => {
                                    shareLinksOpen = true;
                                    sharePopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem 
                                icon={UsersIcon} 
                                label="In Communities teilen" 
                                onclick={() => { 
                                    shareToCommunitiesOpen = true;
                                    sharePopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem 
                                icon={SendIcon} 
                                label="An Edufeed senden" 
                                onclick={() => { 
                                    publishToEdufeedDialogOpen = true;
                                    sharePopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Root>
            
            <!-- 4. Board duplizieren -->
            <MenuItem 
                icon={SquarePlusIcon} 
                label="Board duplizieren" 
                onclick={() => {
                    if (!currentBoardId) {
                        toast.error('Kein Board ausgewählt');
                        return;
                    }
                    
                    hamburgerMenuOpen = false;
                    
                    try {
                        const newBoardId = boardStore.duplicateBoard(currentBoardId);
                        if (newBoardId) {
                            // Switch to the duplicated board
                            window.location.href = `/cardsboard?board=${newBoardId}`;
                        }
                    } catch (error) {
                        console.error('❌ Fehler beim Duplizieren:', error);
                        toast.error('Fehler beim Duplizieren des Boards');
                    }
                }}
                showBorder={false}
            />

            <!-- 4b. Versionen -->
            <VersionHistory />
            
            <!-- 5. Board löschen / verlassen -->
            <MenuItem 
                icon={TrashIcon} 
                label={(() => {
                    const targetBoard = filteredBoards.find(b => b.id === currentBoardId);
                    const isShared = targetBoard?.isShared ?? (boardStore.data?.author !== authStore.getPubkey() && !!boardStore.data?.author);
                    const userRole = targetBoard?.userRole ?? boardStore.getCurrentUserRole() ?? 'owner';
                    return isShared && userRole !== 'owner' ? 'Board verlassen' : 'Board löschen';
                })()}
                variant="danger"
                onclick={() => {
                    if (!currentBoardId) {
                        toast.error('Kein Board ausgewählt');
                        return;
                    }
                    
                    const targetBoard = filteredBoards.find(b => b.id === currentBoardId);
                    const isShared = targetBoard?.isShared ?? (boardStore.data?.author !== authStore.getPubkey() && !!boardStore.data?.author);
                    // Fallback: getCurrentUserRole() wenn Board noch nicht in filteredBoards (z.B. direkt nach Reload)
                    const storeRole = boardStore.getCurrentUserRole();
                    const userRole = targetBoard?.userRole ?? (storeRole === 'owner' ? 'owner' : storeRole === 'editor' ? 'editor' : 'viewer');
                    
                    const warningText = isShared && userRole !== 'owner'
                        ? '⚠️ Dieses Board wirklich verlassen? Sie verlieren den Zugang!'
                        : '⚠️ Dieses Board wirklich löschen? Die Aktion kann nicht rückgängig gemacht werden!';
                    
                    if (!confirm(warningText)) {
                        return;
                    }
                    
                    hamburgerMenuOpen = false;
                    
                    try {
                        if (isShared && userRole !== 'owner') {
                            boardStore.leaveBoard(currentBoardId);
                            console.log('🚪 Board verlassen:', currentBoardId);
                            toast.success('Board erfolgreich verlassen');
                        } else {
                            const ok = boardStore.deleteBoard(currentBoardId);
                            if (ok) {
                                console.log('🗑️ Board gelöscht:', currentBoardId);
                                toast.success('Board erfolgreich gelöscht');
                            } else {
                                console.log('🚫 Board NICHT gelöscht (fehlende Berechtigung):', currentBoardId);
                                toast.error('Fehler: Board konnte nicht gelöscht werden');
                                return;
                            }
                        }
                        
                        // Switch to another board
                        const remaining = boardStore.getAllBoards();
                        if (remaining.length > 0) {
                            const newBoardId = remaining[0].id;
                            boardStore.loadBoard(newBoardId);
                            currentBoardId = newBoardId;
                            navigateToBoardUrl();
                        } else {
                            currentBoardId = '';
                            goto('/cardsboard/', { replaceState: true });
                        }
                    } catch (error) {
                        console.error('❌ Fehler beim Löschen/Verlassen:', error);
                        toast.error('Fehler beim Löschen des Boards');
                    }
                }}
                disabled={!currentBoardId || !authStore.isAuthenticated}
                showBorder={false}
            />
            
            <!-- 6. Wissenswertes -->
            <Popover.Root bind:open={wissenswertesPopoverOpen}>
                <Popover.Trigger class="w-full">
                    <MenuItem 
                        icon={FileTextIcon} 
                        label="Wissenswertes" 
                        onclick={() => {}}
                        showBorder={false}
                        showChevron={true}
                    />
                </Popover.Trigger>
                <Popover.Content side="right" align="start" class="w-56 p-0">
                    <div class="space-y-0">
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={HouseIcon}
                                label="Willkommen"
                                onclick={() => {
                                    goto('/willkommen', {});
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={GlobeIcon}
                                label="Öffentliche Boards"
                                onclick={() => {
                                    publicBoardsDialogOpen = true;
                                    wissenswertesPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="border-t"></div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={FileTextIcon}
                                label="Source Code"
                                onclick={() => {
                                    window.open(settingsStore.settings.sourceCodeUrl, "_blank");
                                    wissenswertesPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={BookIcon}
                                label="Dokumentation"
                                onclick={() => {
                                    window.open(settingsStore.settings.documentationUrl, "_blank");
                                    wissenswertesPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={InfoIcon}
                                label="Über"
                                onclick={() => {
                                    window.open(settingsStore.settings.aboutUrl, "_blank");
                                    wissenswertesPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                        <div class="border-t"></div>
                        <div class="px-1 py-1 editor-menu-item rounded-sm cursor-pointer transition-colors">
                            <SubmenuItem
                                icon={CircleQuestionMarkIcon}
                                label="FAQ"
                                onclick={() => {
                                    faqDialogOpen = true;
                                    wissenswertesPopoverOpen = false;
                                    hamburgerMenuOpen = false;
                                }}
                            />
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Root>
        </div>
    {/if}
    
    <h2 class="text-lg font-semibold upper">Meine Boards</h2>

    <div class="m-0 flex-shrink-0">
        <div class="relative">
            <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                type="text"
                placeholder="Boards suchen..."
                bind:value={searchQuery}
                class="h-9 pl-9"
            />
        </div>
    </div>

    <!-- Boards-Liste -->
    <div class="flex-1 overflow-y-auto space-y-2 min-h-0">
        {#if filteredBoards.length === 0 && !authStore.isAuthenticated}
            <div class="flex flex-col items-center justify-center h-32 text-xs text-muted-foreground text-center space-y-2">
                <p>👋 Willkommen!</p>
                <p>Probieren Sie unsere Demo aus</p>
                <p>oder melden Sie sich an.</p>
            </div>
        {:else if filteredBoards.length === 0}
            <div class="flex items-center justify-center h-32 text-xs text-muted-foreground">
                {#if searchQuery.trim()}
                    Keine Boards gefunden
                {:else}
                    Noch keine Boards
                {/if}
            </div>
        {:else}
            {#each filteredBoards as board (board.id)}
                {@const isActive = currentBoardId === board.id}
                <div
                    animate:safeFlip={{ duration: 300 }}
                    class="w-full rounded-md border border-border px-1 py-1 text-sm transition-all group relative bg-[var(--card)] hover:bg-[var(--card-hover)] shadow-sm
                        {isActive
                            ? 'active-board'
                            : ''}"
                >
                    <button
                        onclick={() => handleSelectBoard(board.id)}
                        disabled={isLoading}
                        class="w-full text-left pr-10 p-1.5"
                        title={`${board.name}${isActive ? ' (✅ Aktives Board)' : ''}`}
                    >
                        <!-- Board Name mit Unseen Changes Badge -->
                        <div class="font-medium flex items-start gap-2 board-title text-sm md:text-base leading-snug">
                            {#if isActive}
                                <!-- Active indicator icon -->
                                <!-- <SquareArrowRight class="active-board-indicator"/> -->
                            {/if}
                            {board.name}
                            
                            <!-- Shared Board Indicator -->
                            {#if board.isShared}
                                <span class="inline-flex items-center px-1 py-1 border bg-muted text-muted-foreground rounded flex-shrink-0 transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                                    {#if board.userRole === 'editor'}
                                        <PencilIcon class="h-3 w-3" />
                                    {:else}
                                        <EyeIcon class="h-3 w-3" />
                                    {/if}
                                </span>
                            {/if}
                            
                            {#if board.hasUnseenChanges && !isActive}
                                <CircleIcon 
                                    class="h-2 w-2 fill-accent text-accent animate-pulse flex-shrink-0" 
                                    
                                />
                            {/if}
                        </div>
                        
                        <!-- Description (optional) -->
                        {#if board.description}
                            <div class="text-xs opacity-75 line-clamp-2 leading-snug">
                                {board.description}
                            </div>
                        {/if}
                        
                        <!-- Erstellungs-Datum -->
                        <div class="text-xs opacity-60 mt-1">
                            {formatDate(board.createdAt)}
                        </div>
                    </button>
                    
                    <!-- Delete/Leave Button -->
                    {#if !board.isShared || board.userRole === 'owner' || board.userRole === 'editor'}
                        <div
                            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <button
                                onclick={(e) => handleDeleteBoard(board.id, e)}
                                class="p-1 rounded transition-colors trash"
                                    
                                title={board.isShared && board.userRole !== 'owner' ? 'Board verlassen' : 'Board löschen'}
                                type="button"
                            >
                                <TrashIcon class="h-4 w-4" />
                            </button>
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>

    <Button
        onclick={authStore.isAuthenticated ? handleCreateBoard : null}
        disabled={authStore.isAuthenticated ? false : true}
        class="w-full gap-2 h-auto py-2 whitespace-normal"
        variant="ghost"
        data-testid="create-board-button"
    >
        {#if isCreating}
            <LoaderIcon class="h-4 w-4 animate-spin flex-shrink-0" />
        {:else}
            <SquarePlusIcon class="h-4 w-4 flex-shrink-0" />
        {/if}
        <span class="break-words text-left">Neues Board</span>
    </Button>
</div>

<!-- Board Settings Dialog -->
<Dialog.Root bind:open={settingsDialogOpen}>
    <Dialog.Content class="w-[95vw] sm:w-auto sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>Board-Einstellungen</Dialog.Title>
            <Dialog.Description>
                {#if !canEditBoardMeta}
                    <span class="text-xs text-muted-foreground">Nur der Board-Owner kann diese Einstellungen bearbeiten.</span>
                {/if}
            </Dialog.Description>
        </Dialog.Header>
        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <Label for="board-title">Titel</Label>
                <Input
                    id="board-title"
                    bind:value={metaForm.title}
                    placeholder="Projekt-Titel"
                    readonly={!canEditBoardMeta}
                />
            </div>
            
            <div class="space-y-2">
                <Label for="board-description">Beschreibung</Label>
                <textarea
                    id="board-description"
                    bind:value={metaForm.description}
                    placeholder="Projekt-Beschreibung"
                    readonly={!canEditBoardMeta}
                    rows="4"
                    class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                ></textarea>
            </div>
            
            <div class="space-y-2">
                <Label>Veröffentlichungsstatus</Label>
                <RadioGroup.Root bind:value={metaForm.publishState} disabled={!canEditBoardMeta}>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="private" id="state-private" />
                        <Label for="state-private" class="font-normal">Privat (nur lokal)</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="published" id="state-published" />
                        <Label for="state-published" class="font-normal">Veröffentlicht (Nostr)</Label>
                    </div>
                </RadioGroup.Root>
            </div>
            
            <div class="space-y-2">
                <Label for="board-tags">Tags (komma-getrennt)</Label>
                <Input
                    id="board-tags"
                    bind:value={metaForm.tags}
                    placeholder="tag1, tag2, tag3"
                    readonly={!canEditBoardMeta}
                />
            </div>
            
            <div class="space-y-2">
                <Label for="cc-license">Creative Commons Lizenz</Label>
                <select
                    id="cc-license"
                    bind:value={metaForm.license}
                    class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canEditBoardMeta}
                >
                    {#each ccLicenses as license (license.value)}
                        <option value={license.value}>{license.label}</option>
                    {/each}
                </select>
            </div>
        </div>
        
        <Dialog.Footer>
            <Button
                variant="outline"
                onclick={() => { settingsDialogOpen = false; }}
            >
                Abbrechen
            </Button>
            <Button
                onclick={handleSaveBoardSettings}
                disabled={!canEditBoardMeta}
            >
                Speichern
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- Profile Editor Dialog -->
<ProfileEditor open={profileEditorOpen} onClose={() => profileEditorOpen = false} />

<!-- Import Dialog -->
<Dialog.Root bind:open={importDialogOpen}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>Board importieren</Dialog.Title>
            <Dialog.Description>
                Wählen Sie eine JSON-Datei zum Importieren
            </Dialog.Description>
        </Dialog.Header>
        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <Label>Import-Modus</Label>
                <RadioGroup.Root bind:value={importMode}>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="merge" id="mode-merge" />
                        <Label for="mode-merge" class="font-normal">Zusammenführen (neue IDs)</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="new" id="mode-new" />
                        <Label for="mode-new" class="font-normal">Als neue Kopie</Label>
                    </div>
                    <div class="flex items-center space-x-2">
                        <RadioGroup.Item value="overwrite" id="mode-overwrite" />
                        <Label for="mode-overwrite" class="font-normal">Überschreiben (Vorsicht!)</Label>
                    </div>
                </RadioGroup.Root>
            </div>
            <div class="space-y-2">
                <Label for="import-file">JSON-Datei</Label>
                <Input
                    id="import-file"
                    type="file"
                    accept=".json"
                    onchange={(e) => {
                        const input = e.target as HTMLInputElement;
                        importFile = input.files?.[0] || null;
                    }}
                />
            </div>
        </div>
        <Dialog.Footer>
            <Button
                variant="outline"
                onclick={() => { importDialogOpen = false; importFile = null; }}
            >
                Abbrechen
            </Button>
            <Button
                onclick={async () => {
                    if (!importFile) {
                        toast.error('Bitte wählen Sie eine Datei');
                        return;
                    }
                    try {
                        const jsonString = await importFile.text();
                        const result = boardStore.importBoardFromJson(jsonString, importMode);
                        if (result.success && result.board) {
                            // 🔥 CRITICAL: Board MUSS zuerst gespeichert werden!
                            // importBoardFromJson() gibt das Board nur im Speicher zurück.
                            // saveImportedBoard() speichert es in localStorage + setzt es als aktives Board.
                            const overwrite = importMode === 'overwrite';
                            boardStore.saveImportedBoard(result.board, overwrite);
                            
                            toast.success(`Board erfolgreich importiert: ${result.board.name}`);
                            importDialogOpen = false;
                            importFile = null;
                            navigateToBoardUrl();
                        } else {
                            toast.error(`Import fehlgeschlagen: ${result.error}`);
                        }
                    } catch (error) {
                        console.error('Import error:', error);
                        toast.error('Import fehlgeschlagen');
                    }
                }}
                disabled={!importFile}
            >
                Importieren
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- LiaScript Export Dialog -->
<LiaScriptExportDialog bind:open={liaScriptExportDialogOpen} />

<!-- Publish to Edufeed Dialog -->
<PublishToEdufeedDialog bind:open={publishToEdufeedDialogOpen} />

<!-- Share to Communities Dialog -->
<ShareToCommunitiesDialog bind:open={shareToCommunitiesOpen} />

            <!-- Share Dialogs (Links / Editoren) -->
            <ShareDialog bind:open={shareLinksOpen} mode="links" initialTab="nostr-link" />
            <ShareDialog bind:open={shareEditorsOpen} mode="editors" initialTab="editors" />

<!-- FAQ Dialog -->
<FAQDialog bind:open={faqDialogOpen} />

<!-- Public Boards Dialog -->
{#if publicBoardsDialogOpen}
    <PublicBoardsDialog bind:open={publicBoardsDialogOpen} />
{/if}

<style>
    div {
        --apply-flex: true;
    }
    
</style>
