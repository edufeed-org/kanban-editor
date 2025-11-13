# Board-Sharing & Maintainer-System Architektur

**Version:** 1.0  
**Datum:** 13. November 2025  
**Status:** 📋 **SPEZIFIKATION** - Implementierung geplant in Branch `feature/board-sharing`  
**Zielgruppe:** Entwickler, die Board-Sharing-Features implementieren  
**Phase:** 4.1 Board-Sharing & Permissions

---

## 🎯 Übersicht

Dieses Dokument spezifiziert die Architektur des Board-Sharing-Systems, das es mehreren Nutzern ermöglicht, gemeinsam an einem Kanban-Board zu arbeiten. Das System basiert auf Nostr's dezentralem Protokoll (NIP-51 Contact Lists) und nutzt die bereits implementierte AuthStore-Infrastruktur.

### Projektstatus

**✅ BEREITS VORHANDEN (Phase 1-3):**
- AuthStore: Vollständige Authentifizierung (NIP-07, nsec, OIDC, Demo)
- Board.isMaintainer(pubkey): Permission-Check Logik
- Board.canAddCard(pubkey): Authorization-Logik
- nostrEvents.ts: Serialisierung von p-tags für Maintainers
- Board.maintainers: string[] - Datenstruktur existiert

**❌ ZU IMPLEMENTIEREN (Phase 4.1):**
- BoardStore API-Methoden: addMaintainer(), removeMaintainer(), readBoardShares()
- NIP-51 Contact List Event Integration (Kind 30051)
- BoardRole enum & Permission System (Owner/Editor/Viewer)
- ShareDialog UI-Komponente
- Maintainer-Liste Anzeige im Board

---

## 📐 System-Architektur

### Layer-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (Svelte 5 Components)                             │
│  ├─ ShareDialog.svelte        (Nutzer hinzufügen/entfernen) │
│  ├─ MaintainerList.svelte     (Anzeige aller Maintainer)    │
│  └─ BoardHeader.svelte        (Share-Button Integration)    │
└─────────────────────────────────────────────────────────────┘
                           ↓ Ruft API auf
┌─────────────────────────────────────────────────────────────┐
│  Store Layer (BoardStore API)                               │
│  ├─ addMaintainer(pubkey, role)    → Board-State + Nostr    │
│  ├─ removeMaintainer(pubkey)       → Board-State + Nostr    │
│  ├─ getMaintainers()               → BoardShare[]           │
│  └─ readBoardShares()              → NIP-51 Events laden    │
└─────────────────────────────────────────────────────────────┘
                           ↓ Nutzt
┌─────────────────────────────────────────────────────────────┐
│  Model Layer (Board Klasse)                                 │
│  ├─ maintainers: string[]          (Pubkey-Array)           │
│  ├─ isMaintainer(pubkey)           (Permission-Check)       │
│  └─ canAddCard(pubkey)             (Authorization-Check)    │
└─────────────────────────────────────────────────────────────┘
                           ↓ Serialisiert zu
┌─────────────────────────────────────────────────────────────┐
│  Nostr Layer (NDK Events)                                   │
│  ├─ Board Event (Kind 30301)       → p-tags für Maintainer  │
│  └─ Contact List (Kind 30051)      → p-tags mit Rollen      │
└─────────────────────────────────────────────────────────────┘
                           ↓ Speichert in
┌─────────────────────────────────────────────────────────────┐
│  Storage Layer                                              │
│  ├─ localStorage                   (Board-State lokal)      │
│  └─ Nostr Relays                   (Events dezentral)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Permission System

### BoardRole Enum

```typescript
// src/lib/types/sharing.ts

/**
 * Rollen-Hierarchie für Board-Zugriff
 * Owner > Editor > Viewer
 */
export enum BoardRole {
    OWNER = 'owner',    // Ersteller, kann Maintainer verwalten
    EDITOR = 'editor',  // Kann Karten/Spalten bearbeiten
    VIEWER = 'viewer'   // Nur Lesezugriff
}

/**
 * Beschreibt einen geteilten Board-Zugriff
 */
export interface BoardShare {
    pubkey: string;      // Nostr Public Key (Hex)
    role: BoardRole;     // Zugewiesene Rolle
    addedAt: string;     // ISO 8601 Timestamp
    addedBy?: string;    // Optional: Wer hat eingeladen
}
```

### Berechtigungs-Matrix

| Aktion | Owner | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| **Board löschen** | ✅ | ❌ | ❌ |
| **Maintainer hinzufügen/entfernen** | ✅ | ❌ | ❌ |
| **Board umbenennen** | ✅ | ✅ | ❌ |
| **Spalten erstellen/löschen** | ✅ | ✅ | ❌ |
| **Karten erstellen** | ✅ | ✅ | ❌ |
| **Karten bearbeiten** | ✅ | ✅ | ❌ |
| **Karten verschieben** | ✅ | ✅ | ❌ |
| **Kommentare schreiben** | ✅ | ✅ | ❌ |
| **Board ansehen** | ✅ | ✅ | ✅ |
| **Export** | ✅ | ✅ | ✅ |

### Implementierung in Board-Klasse

```typescript
// src/lib/classes/BoardModel.ts

export class Board {
    public author?: string;              // Creator (immer OWNER)
    public maintainers?: string[];       // Array von Pubkeys
    
    /**
     * Prüft ob Nutzer Maintainer ist
     * Owner (author) ist automatisch Maintainer
     */
    isMaintainer(pubkey?: string): boolean {
        if (!pubkey) return false;
        
        // Author ist immer Maintainer (OWNER-Rolle)
        if (pubkey === this.author) return true;
        
        // Prüfe ob in Maintainer-Liste
        return (this.maintainers || []).includes(pubkey);
    }
    
    /**
     * Prüft ob Nutzer Karten hinzufügen darf
     * Mindestens EDITOR-Rolle erforderlich
     */
    canAddCard(pubkey?: string): boolean {
        if (!pubkey) return false;
        
        // Wenn keine Maintainer: Nur Author
        if ((this.maintainers || []).length === 0) {
            return pubkey === this.author;
        }
        
        // Sonst: Author oder Maintainer
        return this.isMaintainer(pubkey);
    }
    
    /**
     * NEU: Rolle eines Nutzers ermitteln
     */
    getUserRole(pubkey?: string): BoardRole | null {
        if (!pubkey) return null;
        
        // Author ist immer OWNER
        if (pubkey === this.author) {
            return BoardRole.OWNER;
        }
        
        // TODO: Rollen aus NIP-51 Event laden
        // Aktuell: Alle Maintainer sind EDITOR
        if (this.isMaintainer(pubkey)) {
            return BoardRole.EDITOR;
        }
        
        return null; // Kein Zugriff
    }
}
```

---

## 📦 BoardStore API-Methoden

### 1. addMaintainer()

**Zweck:** Fügt einen Nutzer zur Maintainer-Liste hinzu und publiziert Updates.

```typescript
// src/lib/stores/kanbanStore.svelte.ts

export class BoardStore {
    
    /**
     * Fügt einen Maintainer zum aktuellen Board hinzu
     * 
     * @param pubkey - Nostr Public Key (Hex) des neuen Maintainers
     * @param role - Zugewiesene Rolle (OWNER, EDITOR, VIEWER)
     * @throws Error wenn kein Board aktiv oder Nutzer keine Berechtigung
     */
    public async addMaintainer(
        pubkey: string, 
        role: BoardRole = BoardRole.EDITOR
    ): Promise<void> {
        // 1. Validierung
        if (!this.board) {
            throw new Error('Kein aktives Board');
        }
        
        const currentUser = authStore.getPubkey();
        if (!currentUser || this.board.author !== currentUser) {
            throw new Error('Nur der Board-Owner kann Maintainer hinzufügen');
        }
        
        if (this.board.isMaintainer(pubkey)) {
            throw new Error('Nutzer ist bereits Maintainer');
        }
        
        // 2. Lokale State aktualisieren
        if (!this.board.maintainers) {
            this.board.maintainers = [];
        }
        this.board.maintainers = [...this.board.maintainers, pubkey];
        
        // 3. Persistierung
        this.triggerUpdate();           // localStorage
        await this.publishToNostr();    // Board Event (Kind 30301)
        
        // 4. NIP-51 Contact List Event erstellen
        await this.publishBoardShare(pubkey, role);
        
        console.log(`✅ Maintainer hinzugefügt: ${pubkey} (${role})`);
    }
    
    /**
     * Erstellt/Aktualisiert NIP-51 Contact List Event für Board-Sharing
     */
    private async publishBoardShare(
        pubkey: string, 
        role: BoardRole
    ): Promise<void> {
        if (!this.board) return;
        
        const contactListEvent = new NDKEvent(ndk);
        contactListEvent.kind = 30051; // Categorized Contact Lists
        
        contactListEvent.tags = [
            ['d', `board-${this.board.id}`],           // d-tag für Replaceable Event
            ['p', pubkey, '', role],                   // Maintainer mit Rolle in tag[3]
            ['title', `Board: ${this.board.name}`],    // Beschreibung
            ['description', 'Kanban Board Sharing']
        ];
        
        // Alle existierenden Maintainer hinzufügen
        if (this.board.maintainers) {
            this.board.maintainers.forEach(mp => {
                if (mp !== pubkey) { // Nicht doppelt
                    contactListEvent.tags.push(['p', mp, '', BoardRole.EDITOR]);
                }
            });
        }
        
        contactListEvent.content = '';
        
        await contactListEvent.publish();
        console.log('📤 NIP-51 Contact List Event publiziert');
    }
}
```

### 2. removeMaintainer()

**Zweck:** Entfernt einen Nutzer aus der Maintainer-Liste.

```typescript
/**
 * Entfernt einen Maintainer vom aktuellen Board
 * 
 * @param pubkey - Nostr Public Key des zu entfernenden Maintainers
 * @throws Error wenn kein Board aktiv oder Nutzer keine Berechtigung
 */
public async removeMaintainer(pubkey: string): Promise<void> {
    // 1. Validierung
    if (!this.board) {
        throw new Error('Kein aktives Board');
    }
    
    const currentUser = authStore.getPubkey();
    if (!currentUser || this.board.author !== currentUser) {
        throw new Error('Nur der Board-Owner kann Maintainer entfernen');
    }
    
    if (!this.board.isMaintainer(pubkey)) {
        throw new Error('Nutzer ist kein Maintainer');
    }
    
    if (pubkey === this.board.author) {
        throw new Error('Board-Owner kann nicht entfernt werden');
    }
    
    // 2. Lokale State aktualisieren
    this.board.maintainers = this.board.maintainers?.filter(p => p !== pubkey) || [];
    
    // 3. Persistierung
    this.triggerUpdate();           // localStorage
    await this.publishToNostr();    // Board Event aktualisieren
    
    // 4. NIP-51 Event aktualisieren (ohne entfernten Nutzer)
    await this.updateBoardShares();
    
    console.log(`✅ Maintainer entfernt: ${pubkey}`);
}

/**
 * Aktualisiert NIP-51 Event mit aktueller Maintainer-Liste
 */
private async updateBoardShares(): Promise<void> {
    if (!this.board || !this.board.maintainers) return;
    
    const contactListEvent = new NDKEvent(ndk);
    contactListEvent.kind = 30051;
    
    contactListEvent.tags = [
        ['d', `board-${this.board.id}`],
        ['title', `Board: ${this.board.name}`]
    ];
    
    // Alle aktuellen Maintainer hinzufügen
    this.board.maintainers.forEach(pubkey => {
        contactListEvent.tags.push(['p', pubkey, '', BoardRole.EDITOR]);
    });
    
    contactListEvent.content = '';
    await contactListEvent.publish();
}
```

### 3. readBoardShares()

**Zweck:** Lädt alle Board-Shares aus NIP-51 Events.

```typescript
/**
 * Lädt alle Board-Shares aus Nostr (NIP-51)
 * 
 * @returns Array von BoardShare-Objekten mit Rollen
 */
public async readBoardShares(): Promise<BoardShare[]> {
    if (!this.board) return [];
    
    const currentUser = authStore.getPubkey();
    if (!currentUser) return [];
    
    // NIP-51 Event laden
    const event = await ndk.fetchEvent({
        kinds: [30051],
        authors: [currentUser],
        '#d': [`board-${this.board.id}`]
    });
    
    if (!event) {
        console.log('ℹ️ Kein NIP-51 Event gefunden');
        return [];
    }
    
    // p-tags zu BoardShare[] konvertieren
    const shares: BoardShare[] = event.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => ({
            pubkey: tag[1],
            role: (tag[3] || BoardRole.VIEWER) as BoardRole,
            addedAt: new Date(event.created_at! * 1000).toISOString()
        }));
    
    console.log(`✅ ${shares.length} Board-Shares geladen`);
    return shares;
}

/**
 * Lädt Maintainer-Liste und gibt sie formatiert zurück
 */
public getMaintainers(): BoardShare[] {
    if (!this.board || !this.board.maintainers) return [];
    
    // Lokal aus Board-State (für schnelle UI)
    const shares: BoardShare[] = this.board.maintainers.map(pubkey => ({
        pubkey,
        role: pubkey === this.board!.author ? BoardRole.OWNER : BoardRole.EDITOR,
        addedAt: new Date().toISOString() // Approximation, echte Zeit aus NIP-51
    }));
    
    return shares;
}
```

---

## 🎨 UI-Komponenten

### ShareDialog.svelte

**Zweck:** Modal zum Hinzufügen/Entfernen von Maintainern.

```svelte
<!-- src/lib/components/board/ShareDialog.svelte -->

<script lang="ts">
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import * as Select from "$lib/components/ui/select";
    import { Badge } from "$lib/components/ui/badge";
    import { boardStore } from "$lib/stores/kanbanStore.svelte";
    import { authStore } from "$lib/stores/authStore.svelte";
    import { BoardRole, type BoardShare } from "$lib/types/sharing";
    import UserPlusIcon from "@lucide/svelte/icons/user-plus";
    import TrashIcon from "@lucide/svelte/icons/trash";
    import CopyIcon from "@lucide/svelte/icons/copy";
    
    let { open = $bindable(false) } = $props();
    
    // State
    let newUserPubkey = $state('');
    let selectedRole = $state<BoardRole>(BoardRole.EDITOR);
    let maintainers = $state<BoardShare[]>([]);
    let isLoading = $state(false);
    let errorMessage = $state('');
    
    // Maintainer-Liste laden
    async function loadMaintainers() {
        try {
            maintainers = await boardStore.readBoardShares();
            
            // Fallback: Lokal aus Board-State
            if (maintainers.length === 0) {
                maintainers = boardStore.getMaintainers();
            }
        } catch (error) {
            console.error('Fehler beim Laden der Maintainer:', error);
            errorMessage = 'Maintainer konnten nicht geladen werden';
        }
    }
    
    // Nutzer hinzufügen
    async function handleAddMaintainer() {
        if (!newUserPubkey.trim()) {
            errorMessage = 'Bitte Public Key eingeben';
            return;
        }
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.addMaintainer(newUserPubkey, selectedRole);
            newUserPubkey = '';
            await loadMaintainers();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Hinzufügen';
        } finally {
            isLoading = false;
        }
    }
    
    // Nutzer entfernen
    async function handleRemoveMaintainer(pubkey: string) {
        if (!confirm('Maintainer wirklich entfernen?')) return;
        
        isLoading = true;
        errorMessage = '';
        
        try {
            await boardStore.removeMaintainer(pubkey);
            await loadMaintainers();
        } catch (error: any) {
            errorMessage = error.message || 'Fehler beim Entfernen';
        } finally {
            isLoading = false;
        }
    }
    
    // Display Name für Pubkey holen
    function getDisplayName(pubkey: string): string {
        return authStore.getDisplayNameForPubkey(pubkey) || 
               `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
    }
    
    // Bei Dialog-Öffnung Maintainer laden
    $effect(() => {
        if (open) {
            loadMaintainers();
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>Board teilen</Dialog.Title>
            <Dialog.Description>
                Lade Nutzer ein, gemeinsam an diesem Board zu arbeiten.
            </Dialog.Description>
        </Dialog.Header>
        
        <!-- Nutzer hinzufügen -->
        <div class="space-y-4">
            <div class="flex gap-2">
                <Input 
                    bind:value={newUserPubkey}
                    placeholder="Nostr Public Key (npub oder hex)"
                    disabled={isLoading}
                />
                <Select.Root bind:selected={selectedRole}>
                    <Select.Trigger class="w-32">
                        <Select.Value placeholder="Rolle" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value={BoardRole.EDITOR}>Editor</Select.Item>
                        <Select.Item value={BoardRole.VIEWER}>Viewer</Select.Item>
                    </Select.Content>
                </Select.Root>
                <Button 
                    onclick={handleAddMaintainer}
                    disabled={isLoading || !newUserPubkey.trim()}
                >
                    <UserPlusIcon class="h-4 w-4" />
                </Button>
            </div>
            
            {#if errorMessage}
                <p class="text-sm text-destructive">{errorMessage}</p>
            {/if}
        </div>
        
        <!-- Maintainer-Liste -->
        <div class="mt-6 space-y-2">
            <h4 class="text-sm font-medium">Zugriff ({maintainers.length})</h4>
            
            <div class="space-y-2 max-h-60 overflow-y-auto">
                {#each maintainers as maintainer}
                    <div class="flex items-center justify-between p-2 rounded-md border">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium">
                                {getDisplayName(maintainer.pubkey)}
                            </span>
                            <Badge variant={maintainer.role === BoardRole.OWNER ? 'default' : 'secondary'}>
                                {maintainer.role}
                            </Badge>
                        </div>
                        
                        {#if maintainer.role !== BoardRole.OWNER}
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onclick={() => handleRemoveMaintainer(maintainer.pubkey)}
                                disabled={isLoading}
                            >
                                <TrashIcon class="h-4 w-4" />
                            </Button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
        
        <Dialog.Footer>
            <Button variant="outline" onclick={() => open = false}>
                Schließen
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
```

### Integration in BoardHeader

```svelte
<!-- src/routes/cardsboard/Topbar.svelte -->

<script lang="ts">
    import ShareDialog from "$lib/components/board/ShareDialog.svelte";
    import ShareIcon from "@lucide/svelte/icons/share-2";
    
    let showShareDialog = $state(false);
</script>

<header class="...">
    <!-- ... existing content ... -->
    
    <Button 
        variant="outline" 
        size="sm"
        onclick={() => showShareDialog = true}
    >
        <ShareIcon class="h-4 w-4 mr-2" />
        Teilen
    </Button>
    
    <ShareDialog bind:open={showShareDialog} />
</header>
```

---

## 🔄 Nostr Event-Struktur

### Board Event (Kind 30301)

```json
{
  "kind": 30301,
  "created_at": 1699900000,
  "tags": [
    ["d", "board-abc123"],
    ["title", "Sprint Planning"],
    ["description", "Q4 2025 Sprint Board"],
    ["p", "owner-pubkey-hex"],          // Author (OWNER)
    ["p", "maintainer1-pubkey-hex"],    // Maintainer 1 (EDITOR)
    ["p", "maintainer2-pubkey-hex"],    // Maintainer 2 (EDITOR)
    ["col", "col-1", "Backlog", "0"],
    ["col", "col-2", "In Progress", "1"]
  ],
  "content": "",
  "pubkey": "owner-pubkey-hex",
  "id": "...",
  "sig": "..."
}
```

### Contact List Event (Kind 30051) - NEU

```json
{
  "kind": 30051,
  "created_at": 1699900000,
  "tags": [
    ["d", "board-abc123"],                    // d-tag: board-{boardId}
    ["title", "Board: Sprint Planning"],
    ["description", "Kanban Board Sharing"],
    ["p", "maintainer1-pubkey-hex", "", "editor"],   // Role in tag[3]
    ["p", "maintainer2-pubkey-hex", "", "viewer"],
    ["p", "maintainer3-pubkey-hex", "", "editor"]
  ],
  "content": "",
  "pubkey": "owner-pubkey-hex",
  "id": "...",
  "sig": "..."
}
```

**Wichtig:**
- Kind 30051 ist ein **Parametrized Replaceable Event** (NIP-33)
- Der `d-tag` macht es eindeutig pro Board
- Updates überschreiben automatisch alte Versionen
- Rolle wird in `tag[3]` gespeichert (custom extension)

---

## 🧪 Testing-Strategie

### Unit Tests

```typescript
// src/lib/stores/__tests__/boardStore.sharing.spec.ts

import { describe, it, expect, vi } from 'vitest';
import { BoardStore } from '../kanbanStore.svelte';
import { BoardRole } from '$lib/types/sharing';

describe('BoardStore - Maintainer Management', () => {
    
    it('addMaintainer() fügt Pubkey hinzu', async () => {
        const store = new BoardStore();
        await store.createBoard('Test Board');
        
        await store.addMaintainer('test-pubkey-123', BoardRole.EDITOR);
        
        const maintainers = store.getMaintainers();
        expect(maintainers).toHaveLength(1);
        expect(maintainers[0].pubkey).toBe('test-pubkey-123');
        expect(maintainers[0].role).toBe(BoardRole.EDITOR);
    });
    
    it('removeMaintainer() entfernt Pubkey', async () => {
        const store = new BoardStore();
        await store.createBoard('Test Board');
        await store.addMaintainer('test-pubkey-123', BoardRole.EDITOR);
        
        await store.removeMaintainer('test-pubkey-123');
        
        const maintainers = store.getMaintainers();
        expect(maintainers).toHaveLength(0);
    });
    
    it('readBoardShares() lädt NIP-51 Events', async () => {
        // Mock NDK fetchEvent
        vi.mock('@nostr-dev-kit/ndk', () => ({
            fetchEvent: vi.fn().mockResolvedValue({
                kind: 30051,
                tags: [
                    ['p', 'pubkey1', '', 'editor'],
                    ['p', 'pubkey2', '', 'viewer']
                ],
                created_at: 1699900000
            })
        }));
        
        const store = new BoardStore();
        const shares = await store.readBoardShares();
        
        expect(shares).toHaveLength(2);
        expect(shares[0].role).toBe(BoardRole.EDITOR);
    });
});
```

### E2E Tests

```typescript
// e2e/board-sharing.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Board Sharing', () => {
    
    test('Owner kann Maintainer hinzufügen', async ({ page, context }) => {
        // Setup: Login als Owner
        await page.goto('/cardsboard');
        await page.click('[data-testid="share-button"]');
        
        // Maintainer hinzufügen
        await page.fill('[data-testid="pubkey-input"]', 'npub1test...');
        await page.selectOption('[data-testid="role-select"]', 'editor');
        await page.click('[data-testid="add-maintainer-button"]');
        
        // Verify
        await expect(page.locator('[data-testid="maintainer-list"]')).toContainText('npub1test');
    });
    
    test('Editor kann Karten erstellen', async ({ page }) => {
        // TODO: Multi-Browser Setup
    });
});
```

---

## 📊 Implementierungs-Roadmap

### Phase 4.1A: Core API (2-3 Tage)

**Tag 1: Types & BoardStore Methods**
- [ ] `src/lib/types/sharing.ts` erstellen
  - BoardRole enum
  - BoardShare interface
- [ ] BoardStore.addMaintainer() implementieren
- [ ] BoardStore.removeMaintainer() implementieren
- [ ] Unit Tests schreiben

**Tag 2: NIP-51 Integration**
- [ ] publishBoardShare() implementieren
- [ ] updateBoardShares() implementieren
- [ ] readBoardShares() implementieren
- [ ] Event Deserialisierung testen

**Tag 3: Permission System**
- [ ] Board.getUserRole() implementieren
- [ ] canEditBoard(), canDeleteBoard() Methoden
- [ ] Integration mit canAddCard()

### Phase 4.1B: UI Components (2-3 Tage)

**Tag 4: ShareDialog**
- [ ] ShareDialog.svelte erstellen
- [ ] Maintainer-Liste UI
- [ ] Add/Remove Funktionalität

**Tag 5: Integration**
- [ ] Share-Button in Topbar
- [ ] Maintainer-Anzeige im Board-Header
- [ ] Error-Handling & Toasts

**Tag 6: Testing**
- [ ] E2E Tests (Playwright)
- [ ] Manual Testing
- [ ] Bug-Fixes

---

## 🔗 Referenzen

### Spezifikationen
- **NIP-51:** Categorized Contact Lists - https://github.com/nostr-protocol/nips/blob/master/51.md
- **NIP-33:** Parametrized Replaceable Events - https://github.com/nostr-protocol/nips/blob/master/33.md
- **NIP-07:** Browser Extension Signing - https://github.com/nostr-protocol/nips/blob/master/07.md

### Projekt-Dokumentation
- **[ROADMAP.md](../COLLABORATION/ROADMAP.md)** - Phase 4.1 Board-Sharing Timeline
- **[DEVELOPER-TASKS.md](../COLLABORATION/DEVELOPER-TASKS.md)** - Task 11 Implementierung
- **[STORES/AUTHSTORE.md](./STORES/AUTHSTORE.md)** - AuthStore API Referenz
- **[BoardModel.ts](../../src/lib/classes/BoardModel.ts)** - Board, Column, Card Klassen
- **[UX-RULES.md](../UX-RULES.md)** - shadcn-svelte UI Guidelines

### Code-Beispiele
- **[nostrEvents.ts](../../src/lib/utils/nostrEvents.ts)** - Event Serialisierung (p-tags)
- **[operations.ts](../../src/lib/stores/boardstore/operations.ts)** - BoardStore Pattern

---

## 📝 Changelog

| Version | Datum | Änderung |
|---------|-------|----------|
| 1.0 | 13.11.2025 | Initial: Vollständige Architektur-Spezifikation für Board-Sharing |

---

**Status:** 📋 **READY FOR IMPLEMENTATION**  
**Branch:** `feature/board-sharing` (zu erstellen)  
**Geschätzter Aufwand:** 5-6 Tage (2-3 Tage Backend, 2-3 Tage UI)  
**Dependencies:** AuthStore ✅, BoardModel ✅, nostrEvents.ts ✅  
**Nächster Schritt:** Branch erstellen und mit Phase 4.1A starten
