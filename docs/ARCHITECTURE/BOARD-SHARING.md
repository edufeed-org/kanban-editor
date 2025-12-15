# Board-Sharing & Maintainer-System Architektur

**Version:** 2.3 (Leave: NIP-51 + Leave Request + Owner Marker)  
**Datum:** 15. Dezember 2025  
**Status:** ✅ **TEILWEISE IMPLEMENTIERT** (Follow Sets + Leave Persistenz vorhanden; Owner sieht Leave-Requests im ShareDialog; Owner-Accept/Removal bleibt optional)  
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

---

## 🚪 Board verlassen (Cross-Device)

### Problem
- **Editor:** Kann sich nicht selbst aus den canonical Maintainers entfernen, weil die Mitgliedschaft über Kind `30301` **vom Owner signiert** wird.
- **Viewer:** Kann in der Regel „unfollow“ (NIP-51) ausführen, aber „Leave“ soll trotzdem robust sein (offline, mehrere Geräte).

### Lösung (2 Schritte)

**1) „Leave für mich“ (cross-device, ohne Owner) – NIP-51 Left-Liste**
- Nutzer publiziert eine eigene Liste als Kind `30000` mit `d=kanban-left-boards`.
- Einträge werden als `a`-Tags gespeichert: `30301:<author>:<d>`.
- Beim Laden geteilter Boards wird diese Liste in die lokale Hide-Registry gespiegelt und konsequent gefiltert.

**2) „Bitte entferne mich“ (Owner-Koordination) – Leave-Request Event**
- Nutzer publiziert (best-effort, signer required) ein Leave-Request Event als Kind `30000`:
    - `d=kanban-leave-request:<boardRef>`
    - `a=<boardRef>`
    - `p=<ownerPubkey>`
    - `content='leave'`
- Der Owner kann dieses Event auswerten und das Board-Event (Kind `30301`) ohne den betreffenden `p`-Tag neu publizieren.

### Owner Visibility (UI)

- Der Owner kann Leave-Requests **best-effort** sehen: im ShareDialog (Tab „Editoren“) wird beim betreffenden Editor ein Badge angezeigt.
- Quelle ist ein `kind=30000` Event mit `d=kanban-leave-request:<boardRef>`; die Anzeige ist ein Signal, kein „Hard State“ (Relay-Availability kann variieren).

### Lokale Speicherung (Fallback)
- Zusätzlich wird „Leave/Hide“ lokal in `nostr-kanban-hidden-boards-v1` persistiert.
- Wichtig: author-scoped Keys (`30301:{author}:{d}`) vermeiden false positives bei gleichen `d`-Tags.

### Debugging: Logs (NEU 15.12.2025)

Für das Troubleshooting sind folgende Log-Marker relevant:

- `🚪 Verlasse Board:` → Start des Leave-Flows (immer)
- `🙈 leaveBoard: lokal versteckt + Cache entfernt` → Board ist **sofort** weg in der UI (lokale Hide-Registry + `kanban-{id}` Cache gelöscht)
- `✅ NIP-51 Left-Boards publiziert` → Left-Liste (`kind=30000`, `d=kanban-left-boards`) wurde erfolgreich publiziert (cross-device)
- `ℹ️ NIP-51 Left-Boards: Kein Signer – publish übersprungen (nur lokales Hide)` → erklärt, warum kein NIP-51 Event sichtbar ist (z.B. offline, nicht eingeloggt, Signer fehlt)
- `✅ Leave-Request publiziert` / `ℹ️ Leave-Request: Kein Signer – publish übersprungen` → optionaler Request an Owner (Editor-Fall)
- `📥 NIP-51 Left-Boards geladen (d=kanban-left-boards)` → Sync der Left-Liste beim Start/Load
- `✅ Left-Boards → Hide-Registry sync` → Anzahl neu hinzugefügter/entfernter Einträge in der lokalen Hide-Registry

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

## ⚡ Realtime Appearance (NEU in v2.1)

### Ziel
Wenn ein Owner einen Editor (Maintainer) hinzufügt, soll das Board beim eingeladenen Editor automatisch innerhalb < 1 Sekunde erscheinen – ohne Reload, Polling oder manuelle Aktion.

### Bisheriges Problem
- Vor v2.1 wurde nur nach `authors:[pubkey]` (eigene Boards) subscribed.
- Geteilte Boards, die den Nutzer nur als `p`-Tag enthielten, wurden nicht erfasst.
- Der Editor musste entweder neu laden oder eine manuelle Sync-Funktion auslösen.

### Lösung v2.1
Ergänzende Subscription auf alle Board Events (Kind 30301), die den aktuellen Nutzer als `p`-Tag enthalten – unabhängig vom `author`.

```ts
// In nostr subscribeToUpdates
const sharedSub = ndk.subscribe(
    {
        kinds: [30301],
        '#p': [currentUserPubkey] // Nutzer als Editor/Viewer gelistet
    },
    { closeOnEose: false }
);

sharedSub.on('event', (event) => {
    if (event.pubkey === currentUserPubkey) return; // eigenes Event ignorieren

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const title = event.tags.find(t => t[0] === 'title')?.[1] || 'Unbenannt';
    const description = event.tags.find(t => t[0] === 'description')?.[1] || '';
    const pTags = event.tags.filter(t => t[0] === 'p').map(t => t[1]);
    const userRole = pTags.includes(currentUserPubkey) ? 'editor' : 'viewer';

    boardStore.handleSharedBoardEvent({
        id: dTag,
        name: title,
        description,
        author: event.pubkey,
        userRole
    });
});
```

### Store-Erweiterung
```ts
// kanbanStore.svelte.ts
handleSharedBoardEvent(data: { id:string; name:string; description?:string; author?:string; userRole:'editor'|'viewer' }) {
    const existing = this.cachedSharedBoards.find(b => b.id === data.id);
    if (existing) {
        existing.name = data.name;
        existing.description = data.description;
        existing.author = data.author;
        existing.userRole = data.userRole;
    } else {
        this.cachedSharedBoards = [...this.cachedSharedBoards, data];
    }
    this.triggerUpdate({ publish: false });
}
```

### Reaktive Kette
`sharedSub` Event → `handleSharedBoardEvent()` → Mutation `cachedSharedBoards` → `triggerUpdate()` → `$derived` Recompute → `BoardsList.svelte` zeigt neues Board.

### Acceptance Criteria
| Kriterium | Status |
|-----------|--------|
| Editor sieht neues Board <1s nach Einladung | ✅ |
| Kein Reload / Polling nötig | ✅ |
| Eigene Boards unverändert | ✅ |
| Rollenerkennung (editor/viewer) korrekt | ✅ (Viewer via p-tag; Follow Set kommt später) |

### Offene Punkte
- Automatisches Entfernen bei `removeEditor()` (Replaceable Event Handling)
- Separate Subscription für Viewer via Kind 30000 (Follow Set)
- Dedup / Memory Management bei vielen Shares

### Dokumentation
Changelog Eintrag: "Unreleased - Board-Sharing Realtime Anzeige" (24. Nov 2025)

---

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

---

## ⚡ Realtime Appearance (v2.1)

Ab Version 2.1 erscheint ein neu geteiltes Board automatisch in der Boardliste von eingeladenen Editoren/Viewern – ohne Reload oder Polling.

### Umsetzung
- Zweite Nostr-Subscription in `nostr.ts` auf Kind `30301` mit `#p: [currentUserPubkey]`
- Handler:
    - Parsen von `d`, `title`, `description`, `p` und `col`-Tags
    - `boardStore.upsertBoardFromNostr(boardProps)` → persistiert Board
    - `boardStore.handleSharedBoardEvent(...)` → UI-Cache + `triggerUpdate()`
    - `boardStore.refreshBoardIds()` → optionale ID-Liste aktualisieren
    - Toast via `svelte-sonner` mit Hinweis „Neues Board geteilt“

### Hinweise
- Deduplication über `processedEvents` verhindert Doppelverarbeitung
- Eigene Events werden ignoriert (Echo-Loop Prevention)
- Toast wird nur angezeigt, wenn Board vorher nicht in der Liste war

### Akzeptanzkriterien
- Board taucht bei eingeladenem Nutzer innerhalb < 1s auf
- Keine manuellen Aktionen erforderlich
- Rollenzuordnung stimmt (editor vs viewer, aus `p`-Tags abgeleitet)

