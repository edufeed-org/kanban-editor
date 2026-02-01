<script lang="ts">
    import { flip } from 'svelte/animate';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
    import * as Popover from '$lib/components/ui/popover/index.js';
    import { slide } from 'svelte/transition';
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
    import { authStore } from '$lib/index.js';
    import { BoardRole } from '$lib/types/sharing';
    import { toast } from 'svelte-sonner';

    import MenuItem from './MenuItem.svelte';
    import SubmenuItem from './SubmenuItem.svelte';
    import SettingsDialog from './SettingsDialog.svelte';

    import SquarePlusIcon from '@lucide/svelte/icons/square-plus';
    import TrashIcon from '@lucide/svelte/icons/trash';
    import LoaderIcon from '@lucide/svelte/icons/loader';
    import CircleIcon from '@lucide/svelte/icons/circle';
    import SearchIcon from '@lucide/svelte/icons/search';
    import MenuIcon from '@lucide/svelte/icons/menu';
    import SettingsIcon from '@lucide/svelte/icons/settings';
    import UserIcon from '@lucide/svelte/icons/user';
    import { ProfileEditor } from '$lib/components/auth/index.js';
    import { ShareButton } from '$lib/components/board';
    import PaletteIcon from '@lucide/svelte/icons/palette';
    import BotIcon from '@lucide/svelte/icons/bot';
    import WifiIcon from '@lucide/svelte/icons/wifi';
    import FileTextIcon from '@lucide/svelte/icons/file-text';
    import BookIcon from '@lucide/svelte/icons/book';
    import InfoIcon from '@lucide/svelte/icons/info';
    import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
    import RelayStatusInfo from './RelayStatusInfo.svelte';
    import DownloadIcon from '@lucide/svelte/icons/download';
    import UploadIcon from '@lucide/svelte/icons/upload';
    import LiaScriptExportDialog from '$lib/components/LiaScriptExportDialog.svelte';
    import PublishToEdufeedDialog from './PublishToEdufeedDialog.svelte';
    import SendIcon from '@lucide/svelte/icons/send';
    import PackageOpenIcon from '@lucide/svelte/icons/package-open';
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
    
    // App Settings Dialog States
    let uiSettingsOpen = $state(false);
    let llmSettingsOpen = $state(false);
    let nostrSettingsOpen = $state(false);
    let defaultsSettingsOpen = $state(false);
    
    // Import & Export States
    let importExportPopoverOpen = $state(false);
    let liaScriptExportDialogOpen = $state(false);
    let publishToEdufeedDialogOpen = $state(false);
    let importDialogOpen = $state(false);
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
        
        // Füge isShared: false zu eigenen Boards hinzu
        const enrichedOwnBoards = ownBoards.map(board => ({
            ...board,
            isShared: false,
            userRole: 'owner'
        }));
        
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
        
        // Konvertiere zu Array und sortiere nach lastAccessed (neueste zuerst)
        const uniqueBoards = Array.from(boardMap.values()).sort((a, b) => {
            const timeA = a.lastAccessed || a.updatedAt || a.createdAt || 0;
            const timeB = b.lastAccessed || b.updatedAt || b.createdAt || 0;
            return timeB - timeA; // Neueste zuerst
        });
        
        return uniqueBoards;
    });

    // Event: Neues Board erstellen
    async function handleCreateBoard() {
        isCreating = true;
        try {
            const newBoardId = boardStore.createBoard('Neues Board');
            boardStore.loadBoard(newBoardId);
            currentBoardId = newBoardId;

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
        const isShared = targetBoard?.isShared || false;
        const userRole = targetBoard?.userRole || 'owner';
        
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
        <div transition:slide={{ duration: 200 }} class="bg-muted/50 border-b -mx-2 -mt-2 mb-1 max-h-[60vh] overflow-y-auto editor-menu bg-[var(--card)]">
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
                <Popover.Content side="right" align="start" class="w-56 p-1">
                    <div class="space-y-0">
                        <SubmenuItem 
                            icon={UploadIcon} 
                            label="Von JSON importieren" 
                            onclick={() => { 
                                importDialogOpen = true;
                                importExportPopoverOpen = false;
                                hamburgerMenuOpen = false;
                            }}
                        />
                        
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
                        
                        <SubmenuItem 
                            icon={SendIcon} 
                            label="An edufeed.org senden" 
                            onclick={async () => { 
                                importExportPopoverOpen = false;
                                hamburgerMenuOpen = false;
                                publishToEdufeedDialogOpen = true;
                            }}
                        />
                        
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
                </Popover.Content>
            </Popover.Root>
            
            <!-- 3. Teilen (Share) -->
            <ShareButton 
                variant="default"
                class="w-full flex justify-start gap-3 px-4 py-2.5 text-sm hover:bg-accent transition-colors" 
                showLabel={true}
            />
            
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
            
            <!-- 5. Board löschen -->
            <MenuItem 
                icon={TrashIcon} 
                label="Board löschen" 
                variant="danger"
                onclick={() => {
                    if (!currentBoardId) {
                        toast.error('Kein Board ausgewählt');
                        return;
                    }
                    
                    const targetBoard = filteredBoards.find(b => b.id === currentBoardId);
                    const isShared = targetBoard?.isShared || false;
                    const userRole = targetBoard?.userRole || 'owner';
                    
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
                        } else {
                            currentBoardId = '';
                        }
                    } catch (error) {
                        console.error('❌ Fehler beim Löschen/Verlassen:', error);
                        toast.error('Fehler beim Löschen des Boards');
                    }
                }}
                disabled={!currentBoardId || !authStore.isAuthenticated}
                showBorder={false}
            />
            
            <!-- Separator 1 -->
            <div class="border-t"></div>
            
            <!-- 5. Applikation Submenu -->
            <Popover.Root>
                <Popover.Trigger class="w-full">
                    <MenuItem 
                        icon={SettingsIcon} 
                        label="Applikation" 
                        onclick={() => {}}
                        showBorder={false}
                        showChevron={true}
                    />
                </Popover.Trigger>
                <Popover.Content side="right" align="start" class="w-64 p-1">
                    <div class="space-y-0">
                        <SubmenuItem 
                            icon={PaletteIcon} 
                            label="UI & Layout" 
                            onclick={() => { 
                                uiSettingsOpen = true;
                                hamburgerMenuOpen = false;
                            }}
                        />
                        
                        <SubmenuItem 
                            icon={BotIcon} 
                            label="KI-Anbindung" 
                            onclick={() => { 
                                llmSettingsOpen = true;
                                hamburgerMenuOpen = false;
                            }}
                        />
                        
                        <SubmenuItem 
                            icon={WifiIcon} 
                            label="Nostr Relays" 
                            onclick={() => { 
                                nostrSettingsOpen = true;
                                hamburgerMenuOpen = false;
                            }}
                        />
                        
                        <SubmenuItem 
                            icon={FileTextIcon} 
                            label="Standard-Werte" 
                            onclick={() => { 
                                defaultsSettingsOpen = true;
                                hamburgerMenuOpen = false;
                            }}
                        />
                    </div>
                </Popover.Content>
            </Popover.Root>
            
            <!-- Separator 2 -->
            <div class="border-t"></div>
            
            <!-- 6. User Nostr-Profil -->
            <MenuItem 
                icon={UserIcon} 
                label="User Nostr-Profil" 
                onclick={() => { 
                    profileEditorOpen = true;
                    hamburgerMenuOpen = false;
                }}
                disabled={!authStore.isAuthenticated}
                showBorder={false}
            />
            
            <!-- Separator 3 -->
            <div class="border-t"></div>
            
            <!-- 7. Wissenswertes Submenu -->
            <Popover.Root>
                <Popover.Trigger class="w-full">
                    <MenuItem 
                        icon={FileTextIcon} 
                        label="Wissenswertes" 
                        onclick={() => {}}
                        showBorder={false}
                        showChevron={true}
                    />
                </Popover.Trigger>
                <Popover.Content side="right" align="start" class="w-48 p-1">
                    <div class="space-y-0">
                        <SubmenuItem 
                            icon={FileTextIcon} 
                            label="Source Code" 
                            onclick={() => { 
                                window.open(settingsStore.settings.sourceCodeUrl, '_blank');
                                hamburgerMenuOpen = false;
                            }}
                        />
                        <SubmenuItem 
                            icon={BookIcon} 
                            label="Dokumentation" 
                            onclick={() => { 
                                window.open(settingsStore.settings.documentationUrl, '_blank');
                                hamburgerMenuOpen = false;
                            }}
                        />
                        <SubmenuItem 
                            icon={InfoIcon} 
                            label="Über" 
                            onclick={() => { 
                                window.open(settingsStore.settings.aboutUrl, '_blank');
                                hamburgerMenuOpen = false;
                            }}
                        />
                    </div>
                </Popover.Content>
            </Popover.Root>
        </div>
    {/if}
    
    <h2 class="text-lg font-semibold upper">Meine Boards</h2>

    <div class="m-2 flex-shrink-0">
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
                    class="w-full rounded-md px-3 py-2.5 text-sm transition-all group relative
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
                                <span class="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] flex-shrink-0">
                                    {board.userRole === 'editor' ? '✏️' : '👁️'}
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
                    
                    <!-- Delete Button (nur für eigene Boards oder wenn User Owner ist) -->
                    {#if !board.isShared || board.userRole === 'owner'}
                        <div
                            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <button
                                onclick={(e) => handleDeleteBoard(board.id, e)}
                                class="p-1 rounded transition-colors
                                    {isActive 
                                        ? 'hover:bg-primary-foreground/20 text-primary-foreground' 
                                        : 'hover:bg-destructive hover:text-destructive-foreground'}"
                                title={board.isShared ? 'Board verlassen' : 'Board löschen'}
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
        variant="default"
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
                    {#each ccLicenses as license}
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

<!-- UI/UX Settings Dialog -->
<SettingsDialog bind:open={uiSettingsOpen} title="UI & Layout Einstellungen" icon={PaletteIcon} tab="ui" />

<!-- LLM Settings Dialog -->
<SettingsDialog bind:open={llmSettingsOpen} title="LLM Einstellungen" icon={BotIcon} tab="llm" />

<!-- Nostr Relay Settings Dialog -->
<Dialog.Root bind:open={nostrSettingsOpen}>
    <Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <WifiIcon class="h-5 w-5" />
                Nostr Relay Einstellungen
            </Dialog.Title>
        </Dialog.Header>
        <div class="py-4 space-y-4">
            <!-- Relay Status Component -->
            <div class="pb-4 border-b">
                <RelayStatusInfo />
            </div>
            
            <!-- Settings Panel -->
            <SettingsPanel defaultTab="nostr" showHeader={false} showTabs={false} />
        </div>
    </Dialog.Content>
</Dialog.Root>

<!-- Defaults Settings Dialog -->
<SettingsDialog bind:open={defaultsSettingsOpen} title="Standard-Werte" icon={FileTextIcon} tab="defaults" />

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
                        const result = await boardStore.importBoardFromJson(jsonString, importMode);
                        if (result.success) {
                            toast.success(`Board erfolgreich importiert: ${result.board?.name}`);
                            importDialogOpen = false;
                            importFile = null;
                            if (result.board?.id) {
                                boardStore.loadBoard(result.board.id);
                            }
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

<style>
    div {
        --apply-flex: true;
    }
</style>
