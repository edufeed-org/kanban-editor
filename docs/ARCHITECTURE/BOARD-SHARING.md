# Board-Sharing & Maintainer-System Architektur

**Version:** 2.0 (Korrigiert)  
**Datum:** 18. November 2025  
**Status:** 📋 **SPEZIFIKATION** - Implementierung geplant  
**Zielgruppe:** Entwickler, die Board-Sharing-Features implementieren  
**Phase:** 4.1 Board-Sharing & Permissions

---

## 🎯 Übersicht

Dieses Dokument spezifiziert die korrekte Architektur des Board-Sharing-Systems mit **2-Layer Berechtigungen**:

1. **Layer 1: Board Maintainers (Editor)** - Können Board bearbeiten
2. **Layer 2: Board Followers (Viewer)** - Können Board nur anschauen

Das System basiert auf dem **Kanban-NIP Standard** für Editor-Rechte und **NIP-51 Follow Sets** für Viewer-Rechte.

### Projektstatus

**✅ BEREITS VORHANDEN (Phase 1-3):**
- AuthStore: Vollständige Authentifizierung (NIP-07, nsec, OIDC, Demo)
- Board.isMaintainer(pubkey): Permission-Check Logik
- Board.canAddCard(pubkey): Authorization-Logik
- nostrEvents.ts: Serialisierung von p-tags für Maintainers
- Board.maintainers: string[] - Datenstruktur existiert

**❌ ZU IMPLEMENTIEREN (Phase 4.1):**
- NIP-51 Follow Sets für Viewer (Kind 30000)
- BoardStore API: addEditor(), removeEditor(), addViewer(), removeViewer()
- UI-Integration: Linke Sidebar für Editor-Einladung, Follow-Button für Viewer
- ShareDialog UI-Komponente
- Erweiterte Permission-Checks (isViewer, isEditor, getUserRole)

---

## 📐 System-Architektur

### 2-Layer Board-Sharing Model

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (Svelte 5 Components)                             │
│  ├─ Linke Sidebar: "Als Editor einladen"                    │
│  ├─ Board Header: "Follow" Button (Viewer)                  │
│  ├─ ShareDialog.svelte    (Erweiterte Optionen)            │
│  └─ MaintainerList.svelte (Anzeige aller Editor)           │
└─────────────────────────────────────────────────────────────┘
                           ↓ Ruft API auf
┌─────────────────────────────────────────────────────────────┐
│  Store Layer (BoardStore API)                               │
│  ├─ addEditor(pubkey)      → Kind 30301 p-tag              │
│  ├─ removeEditor(pubkey)   → Kind 30301 p-tag update      │
│  ├─ addViewer(pubkey)      → Kind 30000 Follow Set         │
│  ├─ removeViewer(pubkey)   → Kind 30000 Follow Set         │
│  └─ getBoardParticipants() → Kombiniert beide Layer        │
└─────────────────────────────────────────────────────────────┘
                           ↓ Nutzt
┌─────────────────────────────────────────────────────────────┐
│  Model Layer (Board Klasse)                                 │
│  ├─ maintainers: string[]     (Editor aus Kind 30301)      │
│  ├─ followers: string[]       (Viewer aus Kind 30000)      │
│  ├─ isEditor(pubkey)          → Permission-Check           │
│  ├─ isViewer(pubkey)          → Permission-Check           │
│  └─ getUserRole(pubkey)       → OWNER/EDITOR/VIEWER        │
└─────────────────────────────────────────────────────────────┘
                           ↓ Serialisiert zu
┌─────────────────────────────────────────────────────────────┐
│  Nostr Layer (NDK Events)                                   │
│  ├─ Board Event (Kind 30301)    → p-tags für Editor       │
│  └─ Follow Set (Kind 30000)     → p-tags für Viewer       │
└─────────────────────────────────────────────────────────────┘
                           ↓ Speichert in
┌─────────────────────────────────────────────────────────────┐
│  Storage Layer                                              │
│  ├─ localStorage               (Board-State lokal)         │
│  └─ Nostr Relays               (Events dezentral)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 2-Layer Permission System

### Berechtigungs-Matrix

| Aktion | Owner | Editor (Maintainer) | Viewer (Follower) |
|--------|:-----:|:-------------------:|:-----------------:|
| **Board löschen** | ✅ | ❌ | ❌ |
| **Editor einladen/entfernen** | ✅ | ❌ | ❌ |
| **Board umbenennen** | ✅ | ✅ | ❌ |
| **Spalten erstellen/löschen** | ✅ | ✅ | ❌ |
| **Karten erstellen/bearbeiten** | ✅ | ✅ | ❌ |
| **Board ansehen** | ✅ | ✅ | ✅ |
| **Export** | ✅ | ✅ | ✅ |
| **Kommentare schreiben** | ✅ | ✅ | ❌ |
| **Live-Updates erhalten** | ✅ | ✅ | ✅ |

### Korrekte Implementierung in Board-Klasse

```typescript
// src/lib/classes/BoardModel.ts

export class Board {
    public author?: string;              // Creator (immer OWNER)
    public maintainers?: string[] = [];  // Editor (Kind 30301 p-tags)
    public followers?: string[] = [];    // Viewer (Kind 30000 Follow Set)
    
    /**
     * Prüft ob Nutzer Editor ist (Owner oder Maintainer)
     */
    isEditor(pubkey?: string): boolean {
        if (!pubkey) return false;
        // Owner (author) ist automatisch Editor
        if (pubkey === this.author) return true;
        // Prüfe Maintainer-Liste
        return (this.maintainers || []).includes(pubkey);
    }
    
    /**
     * Prüft ob Nutzer Viewer ist (in Follow Set)
     */
    isViewer(pubkey?: string): boolean {
        if (!pubkey) return false;
        // Viewer-Check (inklusive Editor automatisch)
        return this.isEditor(pubkey) || (this.followers || []).includes(pubkey);
    }
    
    /**
     * Ermittelt die Rolle eines Nutzers
     */
    getUserRole(pubkey?: string): BoardRole | null {
        if (!pubkey) return null;
        
        // Owner
        if (pubkey === this.author) {
            return BoardRole.OWNER;
        }
        
        // Editor (Maintainer)
        if (this.isEditor(pubkey)) {
            return BoardRole.EDITOR;
        }
        
        // Viewer (Follower)
        if (this.isViewer(pubkey)) {
            return BoardRole.VIEWER;
        }
        
        return null; // Kein Zugriff
    }
    
    /**
     * Prüft ob Nutzer Karten hinzufügen darf
     * Mindestens EDITOR-Rolle erforderlich
     */
    canAddCard(pubkey?: string): boolean {
        return this.isEditor(pubkey);
    }
    
    /**
     * Prüft ob Nutzer Board bearbeiten darf
     * Mindestens EDITOR-Rolle erforderlich
     */
    canEditBoard(pubkey?: string): boolean {
        return this.isEditor(pubkey);
    }
    
    /**
     * Prüft ob Nutzer Board löschen darf
     * Nur OWNER kann löschen
     */
    canDeleteBoard(pubkey?: string): boolean {
        return pubkey === this.author;
    }
}
```

---

## 📦 BoardStore API-Methoden

### 1. addEditor() - Als Editor einladen

**Zweck:** Fügt einen Nutzer als Editor (Maintainer) zum Board hinzu.

```typescript
// src/lib/stores/kanbanStore.svelte.ts

export class BoardStore {
    
    /**
     * Fügt einen Editor (Maintainer) zum Board hinzu
     * 
     * @param pubkey - Nostr Public Key (Hex) des neuen Editors
     * @throws Error wenn kein Board aktiv oder Nutzer keine Berechtigung
     */
    public async addEditor(pubkey: string): Promise<void> {
        // 1. Validierung
        if (!this.board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = this.authStore.getPubkey();
        if (!currentUser || !this.board.canEditBoard(currentUser)) {
            throw new Error('Nur Editoren können neue Editoren einladen');
        }
        
        if (this.board.isEditor(pubkey)) {
            throw new Error('Nutzer ist bereits Editor');
        }
        
        // 2. Lokale State aktualisieren
        if (!this.board.maintainers) {
            this.board.maintainers = [];
        }
        this.board.maintainers = [...this.board.maintainers, pubkey];
        
        // 3. Persistierung
        this.triggerUpdate();           // localStorage
        await this.publishToNostr();    // Board Event (Kind 30301)
        
        console.log(`✅ Editor hinzugefügt: ${pubkey}`);
    }
}
```

### 2. removeEditor() - Editor entfernen

```typescript
/**
 * Entfernt einen Editor vom Board
 */
public async removeEditor(pubkey: string): Promise<void> {
    // 1. Validierung
    if (!this.board) {
        throw new Error('Kein aktives Board');
    }
    
    const currentUser = this.authStore.getPubkey();
    if (!currentUser || !this.board.canDeleteBoard(currentUser)) {
        throw new Error('Nur der Owner kann Editoren entfernen');
    }
    
    if (pubkey === this.board.author) {
        throw new Error('Board-Owner kann nicht entfernt werden');
    }
    
    if (!this.board.isEditor(pubkey)) {
        throw new Error('Nutzer ist kein Editor');
    }
    
    // 2. Lokale State aktualisieren
    this.board.maintainers = this.board.maintainers?.filter(p => p !== pubkey) || [];
    
    // 3. Persistierung
    this.triggerUpdate();           // localStorage
    await this.publishToNostr();    // Board Event aktualisieren
    
    console.log(`✅ Editor entfernt: ${pubkey}`);
}
```

### 3. addViewer() - Als Viewer einladen (Follow)

```typescript
/**
 * Fügt einen Viewer (Follower) zum Board hinzu
 * Nutzt NIP-51 Follow Sets (Kind 30000)
 */
public async addViewer(pubkey: string): Promise<void> {
    // 1. Validierung
    if (!this.board) {
        throw new Error('Kein aktives Board');
    }
    
    const currentUser = this.authStore.getPubkey();
    if (!currentUser || !this.board.canEditBoard(currentUser)) {
        throw new Error('Nur Editoren können Viewer einladen');
    }
    
    if (this.board.isViewer(pubkey)) {
        throw new Error('Nutzer ist bereits Viewer');
    }
    
    // 2. NIP-51 Follow Set Event erstellen/aktualisieren
    await this.updateBoardFollowers();
    
    // 3. Lokale State aktualisieren (für UI)
    if (!this.board.followers) {
        this.board.followers = [];
    }
    this.board.followers = [...this.board.followers, pubkey];
    
    // 4. Persistierung
    this.triggerUpdate();
    
    console.log(`✅ Viewer hinzugefügt: ${pubkey}`);
}

/**
 * Erstellt/Aktualisiert NIP-51 Follow Set Event für Viewer
 */
private async updateBoardFollowers(): Promise<void> {
    if (!this.board) return;
    
    const followEvent = new NDKEvent(this.ndk);
    followEvent.kind = 30000; // Follow Sets
    followEvent.tags = [
        ['d', `board-followers-${this.board.id}`],
        ['title', `Board Followers: ${this.board.name}`],
        ['description', 'Users following this Kanban board']
    ];
    
    // Alle Viewer hinzufügen (inklusive Editoren)
    const allViewers = new Set([
        ...(this.board.maintainers || []),
        ...(this.board.followers || [])
    ]);
    
    allViewers.forEach(pubkey => {
        followEvent.tags.push(['p', pubkey]);
    });
    
    followEvent.content = '';
    await followEvent.publish();
    console.log('📤 NIP-51 Follow Set Event aktualisiert');
}
```

### 4. removeViewer() - Viewer entfernen (Unfollow)

```typescript
/**
 * Entfernt einen Viewer vom Board
 */
public async removeViewer(pubkey: string): Promise<void> {
    // 1. Validierung
    if (!this.board) {
        throw new Error('Kein aktives Board');
    }
    
    const currentUser = this.authStore.getPubkey();
    if (!currentUser || !this.board.canEditBoard(currentUser)) {
        throw new Error('Nur Editoren können Viewer entfernen');
    }
    
    if (!this.board.isViewer(pubkey)) {
        throw new Error('Nutzer ist kein Viewer');
    }
    
    // 2. Lokale State aktualisieren
    // Editoren können nicht als Viewer entfernt werden
    if (!this.board.isEditor(pubkey)) {
        this.board.followers = this.board.followers?.filter(p => p !== pubkey) || [];
    }
    
    // 3. NIP-51 Event aktualisieren
    await this.updateBoardFollowers();
    
    // 4. Persistierung
    this.triggerUpdate();
    
    console.log(`✅ Viewer entfernt: ${pubkey}`);
}
```

### 5. getBoardParticipants() - Alle Teilnehmer laden

```typescript
/**
 * Lädt alle Board-Teilnehmer (Editoren + Viewer)
 */
public async getBoardParticipants(): Promise<BoardShare[]> {
    const participants: BoardShare[] = [];
    
    // Owner hinzufügen
    if (this.board?.author) {
        participants.push({
            pubkey: this.board.author,
            role: BoardRole.OWNER,
            addedAt: new Date().toISOString()
        });
    }
    
    // Editoren hinzufügen
    this.board?.maintainers?.forEach(pubkey => {
        participants.push({
            pubkey,
            role: BoardRole.EDITOR,
            addedAt: new Date().toISOString()
        });
    });
    
    // Viewer hinzufügen
    this.board?.followers?.forEach(pubkey => {
        // Nur hinzufügen wenn nicht bereits Editor
        if (!this.board?.maintainers?.includes(pubkey)) {
            participants.push({
                pubkey,
                role: BoardRole.VIEWER,
                addedAt: new Date().toISOString()
            });
        }
    });
    
    return participants;
}
```

---

## 🎨 UI-Komponenten & Integration

### 1. Linke Sidebar: Editor-Einladung

**Standort:** `src/routes/cardsboard/LeftSidebarFooter.svelte`

```svelte
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Dialog from "$lib/components/ui/dialog";
    import UserPlusIcon from "@lucide/svelte/icons/user-plus";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    
    // State für Editor-Einladung
    let showInviteEditor = $state(false);
    let editorPubkey = $state('');
    let isInviting = $state(false);
    let errorMessage = $state('');
    
    // Prüfen ob current User Editor einladen darf
    $: currentUserRole = boardStore.board?.getUserRole(authStore.getPubkey());
    $: canInviteEditor = currentUserRole === 'owner' || currentUserRole === 'editor';
    
    async function handleInviteEditor() {
        if (!editorPubkey.trim()) return;
        
        isInviting = true;
        errorMessage = '';
        
        try {
            await boardStore.addEditor(editorPubkey);
            editorPubkey = '';
            showInviteEditor = false;
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Einladen';
        } finally {
            isInviting = false;
        }
    }
</script>

{#if canInviteEditor}
    <div class="border-t pt-4 mt-4">
        <h3 class="text-sm font-medium mb-2">Editor einladen</h3>
        
        <Dialog.Root bind:open={showInviteEditor}>
            <Dialog.Trigger asChild>
                <Button size="sm" class="w-full">
                    <UserPlusIcon class="h-4 w-4 mr-2" />
                    Als Editor einladen
                </Button>
            </Dialog.Trigger>
            <Dialog.Content>
                <Dialog.Header>
                    <Dialog.Title>Als Editor einladen</Dialog.title>
                    <Dialog.Description>
                        Der eingeladene Nutzer kann das Board vollständig bearbeiten.
                    </Dialog.Description>
                </Dialog.Header>
                
                <div class="space-y-4">
                    <Input 
                        bind:value={editorPubkey}
                        placeholder="Nostr Public Key (npub oder hex)"
                        disabled={isInviting}
                    />
                    
                    {#if errorMessage}
                        <p class="text-sm text-destructive">{errorMessage}</p>
                    {/if}
                    
                    <div class="flex gap-2">
                        <Button 
                            onclick={handleInviteEditor}
                            disabled={isInviting || !editorPubkey.trim()}
                            class="flex-1"
                        >
                            {isInviting ? 'Einladen...' : 'Einladen'}
                        </Button>
                        <Button 
                            variant="outline" 
                            onclick={() => showInviteEditor = false}
                            disabled={isInviting}
                        >
                            Abbrechen
                        </Button>
                    </div>
                </div>
            </Dialog.Content>
        </Dialog.Root>
    </div>
{/if}
```

### 2. Board Header: Follow-Button (Viewer)

**Standort:** `src/routes/cardsboard/Topbar.svelte`

```svelte
<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import EyeOffIcon from "@lucide/svelte/icons/eye-off";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    
    // State für Follow/Unfollow
    let isFollowing = $state(false);
    let isUpdating = $state(false);
    
    // Prüfen ob current User dem Board folgt
    $: currentUserPubkey = authStore.getPubkey();
    $: currentUserRole = boardStore.board?.getUserRole(currentUserPubkey);
    $: isFollowing = currentUserRole !== null; // Owner, Editor oder Viewer
    
    async function handleFollowUnfollow() {
        if (!currentUserPubkey || !boardStore.board) return;
        
        isUpdating = true;
        
        try {
            if (isFollowing) {
                // Unfollow (nur für Viewer, nicht für Editor)
                if (currentUserRole === 'viewer') {
                    await boardStore.removeViewer(currentUserPubkey);
                }
            } else {
                // Follow als Viewer
                await boardStore.addViewer(currentUserPubkey);
            }
        } catch (error) {
            console.error('Follow/Unfollow error:', error);
        } finally {
            isUpdating = false;
        }
    }
</script>

<header class="h-16 border-b bg-background flex items-center px-4 gap-4">
    <!-- ... existing content ... -->
    
    <!-- Follow/Unfollow Button -->
    <div class="flex items-center gap-2">
        {#if isFollowing}
            <Badge variant="secondary">
                {currentUserRole === 'owner' ? 'Owner' : 
                 currentUserRole === 'editor' ? 'Editor' : 'Viewer'}
            </Badge>
            
            {#if currentUserRole === 'viewer'}
                <Button 
                    variant="outline" 
                    size="sm"
                    onclick={handleFollowUnfollow}
                    disabled={isUpdating}
                >
                    <EyeOffIcon class="h-4 w-4 mr-2" />
                    {isUpdating ? 'Entfernen...' : 'Nicht mehr folgen'}
                </Button>
            {/if}
        {:else}
            <Button 
                variant="outline" 
                size="sm"
                onclick={handleFollowUnfollow}
                disabled={isUpdating}
            >
                <EyeIcon class="h-4 w-4 mr-2" />
                {isUpdating ? 'Folgen...' : 'Board folgen'}
            </Button>
        {/if}
    </div>
</header>
```

### 3. ShareDialog (Erweiterte Optionen)

**Standort:** `src/lib/components/board/ShareDialog.svelte`

```svelte
<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import { Badge } from "$lib/components/ui/badge";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardRole, type BoardShare } from "$lib/types/sharing";
    import UserPlusIcon from "@lucide/svelte/icons/user-plus";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import TrashIcon from "@lucide/svelte/icons/trash";
    
    let { open = $bindable(false) } = $props();
    
    // State
    let newUserPubkey = $state('');
    let selectedRole = $state<BoardRole>(BoardRole.EDITOR);
    let participants = $state<BoardShare[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    let activeTab = $state('editors'); // 'editors' | 'viewers'
    
    // Alle Teilnehmer laden
    async function loadParticipants() {
        try {
            participants = await boardStore.getBoardParticipants();
        } catch (error) {
            console.error('Fehler beim Laden der Teilnehmer:', error);
            errorMessage = 'Teilnehmer konnten nicht geladen werden';
        }
    }
    
    // Nutzer einladen
    async function handleInviteUser() {
        if (!newUserPubkey.trim()) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            if (selectedRole === BoardRole.EDITOR) {
                await boardStore.addEditor(newUserPubkey);
            } else {
                await boardStore.addViewer(newUserPubkey);
            }
            
            newUserPubkey = '';
            await loadParticipants();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Einladen';
        } finally {
            isLoading = false;
        }
    }
    
    // Nutzer entfernen
    async function handleRemoveUser(pubkey: string, role: BoardRole) {
        if (!confirm('Nutzer wirklich entfernen?')) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            if (role === BoardRole.EDITOR) {
                await boardStore.removeEditor(pubkey);
            } else {
                await boardStore.removeViewer(pubkey);
            }
            
            await loadParticipants();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Entfernen';
        } finally {
            isLoading = false;
        }
    }
    
    // Display Name für Pubkey
    function getDisplayName(pubkey: string): string {
        return authStore.getDisplayNameForPubkey(pubkey) || 
               `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
    }
    
    // Bei Dialog-Öffnung laden
    $effect(() => {
        if (open) {
            loadParticipants();
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Board teilen</Dialog.Title>
            <Dialog.Description>
                Verwalte Editoren und Viewer für dieses Board.
            </Dialog.Description>
        </Dialog.Header>
        
        <!-- Einladung -->
        <div class="space-y-4">
            <div class="flex gap-2">
                <Input 
                    bind:value={newUserPubkey}
                    placeholder="Nostr Public Key"
                    disabled={isLoading}
                />
                <Select.Root bind:selected={selectedRole}>
                    <Select.Trigger class="w-32">
                        <Select.Value placeholder="Rolle" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value={BoardRole.EDITOR}>
                            <UserPlusIcon class="h-4 w-4 mr-2" />
                            Editor
                        </Select.Item>
                        <Select.Item value={BoardRole.VIEWER}>
                            <EyeIcon class="h-4 w-4 mr-2" />
                            Viewer
                        </Select.Item>
                    </Select.Content>
                </Select.Root>
                <Button 
                    onclick={handleInviteUser}
                    disabled={isLoading || !newUserPubkey.trim()}
                >
                    Einladen
                </Button>
            </div>
            
            {#if errorMessage}
                <p class="text-sm text-destructive">{errorMessage}</p>
            {/if}
        </div>
        
        <!-- Teilnehmer-Liste -->
        <Tabs bind:value={activeTab} class="mt-6">
            <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="editors">
                    Editoren ({participants.filter(p => p.role === 'editor' || p.role === 'owner').length})
                </TabsTrigger>
                <TabsTrigger value="viewers">
                    Viewer ({participants.filter(p => p.role === 'viewer').length})
                </TabsTrigger>
            </TabsList>
            
            <TabsContent value="editors" class="mt-4">
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each participants.filter(p => p.role === 'editor' || p.role === 'owner') as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {getDisplayName(participant.pubkey)}
                                </span>
                                <Badge variant={participant.role === 'owner' ? 'default' : 'secondary'}>
                                    {participant.role}
                                </Badge>
                            </div>
                            
                            {#if participant.role !== 'owner'}
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onclick={() => handleRemoveUser(participant.pubkey, participant.role)}
                                    disabled={isLoading}
                                >
                                    <TrashIcon class="h-4 w-4" />
                                </Button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </TabsContent>
            
            <TabsContent value="viewers" class="mt-4">
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    {#each participants.filter(p => p.role === 'viewer') as participant}
                        <div class="flex items-center justify-between p-2 rounded-md border">
                            <div class="flex items-center gap-2">
                                <span class="text-sm font-medium">
                                    {getDisplayName(participant.pubkey)}
                                </span>
                                <Badge variant="outline">
                                    {participant.role}
                                </Badge>
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onclick={() => handleRemoveUser(participant.pubkey, participant.role)}
                                disabled={isLoading}
                            >
                                <TrashIcon class="h-4 w-4" />
                            </Button>
                        </div>
                    {/each}
                </div>
            </TabsContent>
        </Tabs>
        
        <Dialog.Footer>
            <Button variant="outline" onclick={() => open = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
```

---

## 🔄 Korrekte Nostr Event-Struktur

### Board Event (Kind 30301) - Editor (Maintainer)

```json
{
  "kind": 30301,
  "created_at": 1699900000,
  "tags": [
    ["d", "board-abc123"],
    ["title", "Sprint Planning"],
    ["description", "Q4 2025 Sprint Board"],
    ["p", "owner-pubkey-hex"],          // Owner/Author
    ["p", "maintainer1-pubkey-hex"],    // Editor 1
    ["p", "maintainer2-pubkey-hex"],    // Editor 2
    ["col", "col-1", "Backlog", "0"],
    ["col", "col-2", "In Progress", "1"]
  ],
  "content": "",
  "pubkey": "owner-pubkey-hex",
  "id": "...",
  "sig": "..."
}
```

### Follow Set Event (Kind 30000) - Viewer (Follower)

```json
{
  "kind": 30000,
  "created_at": 1699900000,
  "tags": [
    ["d", "board-followers-abc123"],    // d-tag für Follow Set
    ["title", "Board Followers: Sprint Planning"],
    ["description", "Users following this Kanban board"],
    ["p", "owner-pubkey-hex"],          // Owner (automatisch Viewer)
    ["p", "maintainer1-pubkey-hex"],    // Editor (automatisch Viewer)
    ["p", "viewer1-pubkey-hex"],        // Viewer 1
    ["p", "viewer2-pubkey-hex"]         // Viewer 2
  ],
  "content": "",
  "pubkey": "owner-pubkey-hex",
  "id": "...",
  "sig": "..."
}
```

**Wichtig:**
- Kind 30000 ist ein **Standard Follow Set** aus NIP-51
- p-tags in Follow Set = **Viewer-Rechte** (nur anschauen)
- Owner und Editor sind **automatisch Viewer** (inclusion)

---

## 🧪 Testing-Strategie

### Unit Tests

```typescript
// src/lib/stores/__tests__/boardStore.sharing.spec.ts

import { describe, it, expect, vi } from 'vitest';
import { BoardStore } from '../kanbanStore.svelte';
import { BoardRole } from '$lib/types/sharing';

describe('BoardStore - 2-Layer Board Sharing', () => {
    
    it('addEditor() fügt Editor hinzu', async () => {
        const store = new BoardStore();
        await store.createBoard('Test Board');
        
        await store.addEditor('test-editor-pubkey');
        
        const board = store.board!;
        expect(board.isEditor('test-editor-pubkey')).toBe(true);
        expect(board.isViewer('test-editor-pubkey')).toBe(true);
    });
    
    it('addViewer() fügt Viewer hinzu', async () => {
        const store = new BoardStore();
        await store.createBoard('Test Board');
        
        await store.addViewer('test-viewer-pubkey');
        
        const board = store.board!;
        expect(board.isViewer('test-viewer-pubkey')).toBe(true);
        expect(board.isEditor('test-viewer-pubkey')).toBe(false);
    });
    
    it('getUserRole() ermittelt korrekte Rollen', async () => {
        const store = new BoardStore();
        await store.createBoard('Test Board');
        
        // Owner
        expect(store.board!.getUserRole(store.board!.author)).toBe(BoardRole.OWNER);
        
        // Editor
        await store.addEditor('editor-pubkey');
        expect(store.board!.getUserRole('editor-pubkey')).toBe(BoardRole.EDITOR);
        
        // Viewer
        await store.addViewer('viewer-pubkey');
        expect(store.board!.getUserRole('viewer-pubkey')).toBe(BoardRole.VIEWER);
    });
});
```

### E2E Tests

```typescript
// e2e/board-sharing.spec.ts

import { test, expect } from '@playwright/test';

test.describe('2-Layer Board Sharing', () => {
    
    test('Editor-Einladung in linker Sidebar', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Editor einladen über linke Sidebar
        await page.click('[data-testid="invite-editor-button"]');
        await page.fill('[data-testid="editor-pubkey-input"]', 'npub1test...');
        await page.click('[data-testid="invite-editor-submit"]');
        
        // Verify Editor ist hinzugefügt
        await expect(page.locator('[data-testid="share-dialog"]')).toContainText('Editor');
    });
    
    test('Follow/Unfollow Button im Header', async ({ page }) => {
        await page.goto('/cardsboard');
        
        // Board folgen
        await page.click('[data-testid="follow-board-button"]');
        
        // Verify Badge zeigt Viewer
        await expect(page.locator('[data-testid="user-role-badge"]')).toContainText('Viewer');
        
        // Unfollow
        await page.click('[data-testid="unfollow-board-button"]');
        
        // Verify Button zeigt "Folgen" wieder
        await expect(page.locator('[data-testid="follow-board-button"]')).toContainText('Board folgen');
    });
});
```


## 🔗 Referenzen

### Spezifikationen
- **Kanban-NIP:** Board Events (Kind 30301) mit p-tags für Maintainer
- **NIP-51:** Follow Sets (Kind 30000) für Viewer/Follower
- **NIP-07:** Browser Extension Signing
- **NIP-33:** Parametrized Replaceable Events

### Projekt-Dokumentation
- **[Kanban-NIP.md](../GUIDES/Kanban-NIP.md)** - Korrekter Standard für Board-Sharing
- **[ROADMAP.md](../COLLABORATION/ROADMAP.md)** - Phase 4.1 Timeline
- **[DEVELOPER-TASKS.md](../COLLABORATION/DEVELOPER-TASKS.md)** - Task 11 Implementierung
- **[BoardModel.ts](../../src/lib/classes/BoardModel.ts)** - Core Klassen
- **[UX-RULES.md](../UX-RULES.md)** - shadcn-svelte UI Guidelines

### Code-Beispiele
- **[nostrEvents.ts](../../src/lib/utils/nostrEvents.ts)** - Event Serialisierung
- **[operations.ts](../../src/lib/stores/boardstore/operations.ts)** - BoardStore Pattern
- **[syncManager.svelte.ts](../../src/lib/stores/syncManager.svelte.ts)** - Nostr Sync

---

## 📝 Changelog

| Version | Datum | Änderung |
|---------|-------|----------|
| 2.0 | 18.11.2025 | Korrigiert: 2-Layer System (Kind 30301 + Kind 30000) |
| 1.0 | 13.11.2025 | Initial: Fehlerhafte NIP-51 Spezifikation |

---

**Status:** 📋 **READY FOR IMPLEMENTATION**  
**Branch:** `feature/board-sharing-v2` (zu erstellen)  
**Dependencies:** AuthStore ✅, BoardModel ✅, nostrEvents.ts ✅  
**Kernkorrektur:** Verwendung von Kind 30000 (Follow Sets) statt nicht-existentem Kind 30051  
**Nächster Schritt:** Branch erstellen und mit Phase 4.1A starten
