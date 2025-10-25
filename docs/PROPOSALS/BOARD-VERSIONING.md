# Board Versioning Proposal

**Status:** Draft  
**Erstellt:** 25. Oktober 2025  
**Autor:** KI-gestützte Entwicklung  
**Ziel:** Automatische Versionierung für Nostr Kanban-Boards

---

## 📋 Übersicht

Dieses Dokument definiert eine **automatische, Nostr-native Versionierungsstrategie** für Kanban-Boards, die:
- ✅ Vollständig dezentral funktioniert
- ✅ Keine manuelle Commit-Eingabe erfordert
- ✅ Relay-effizient ist (single-char tags)
- ✅ Git-inspirierte Features bietet (Snapshots, History, Rollback)
- ✅ Mit bestehenden NIPs kompatibel ist

---

## 🎯 Motivation

### Probleme mit aktueller Kanban-NIP (30301/30302)

1. **Replaceable Events überschreiben sich** → Keine Historie
2. **Keine Versionskontrolle** → Kein Rollback bei Fehlern
3. **Konflikt-Resolution schwierig** → Last-Write-Wins ohne Context
4. **Keine Audit-Trail** → Wer hat wann was geändert?

### Anforderungen

- **Automatisch**: Keine manuellen Commits vom User
- **Transparent**: User merkt nichts von Versionierung
- **Effizient**: Minimaler Relay-Overhead
- **Praktisch**: Snapshots nur bei wichtigen Changes
- **Rollback-fähig**: Kompletter Board-State wiederherstellbar

---

## 🏗️ Architektur

### Drei-Layer Versioning System

```
┌─────────────────────────────────────────────────┐
│  Kind 30301 (Replaceable)                       │
│  → Aktueller Board-State (live)                 │
│  → Mit "v" tag für Version                      │
│  → Mit "pv" tag für Previous Version            │
└─────────────────────────────────────────────────┘
            ↓ Snapshot bei wichtigen Changes
┌─────────────────────────────────────────────────┐
│  Kind 30303 (Non-Replaceable)                   │
│  → Snapshots für Versionspunkte                 │
│  → Rollback-Punkte                              │
│  → Auto-generierte Commit-Messages              │
└─────────────────────────────────────────────────┘
            ↓ Detailliertes Change-Tracking
┌─────────────────────────────────────────────────┐
│  Kind 30304 (Change Events)                     │
│  → Jede Änderung als separates Event            │
│  → Audit-Trail für Compliance                   │
│  → Basis für auto-generierte Commit-Messages    │
└─────────────────────────────────────────────────┘
```

---

## 📊 Event-Struktur

### 1. Board Event (Kind 30301) - mit Versionierung

```javascript
{
    "kind": 30301,
    "created_at": 1730000000,
    "tags": [
        ["d", "project-alpha"],              // Board-ID (NIP-33)
        ["title", "Project Alpha - Sprint 3"],
        ["description", "Board Description"],
        
        // === VERSIONIERUNG (NEU!) ===
        ["v", "42"],                         // ✅ Current Version (PFLICHT)
        ["pv", "41"],                        // ✅ Previous Version
        ["b", "main"],                       // ✅ Branch (optional, für Experimente)
        ["m", "Auto: Added 3 cards, Moved 1 card"], // ✅ Auto-generierte Commit-Message
        
        // Publishing State
        ["pub", "draft"],                    // draft|published|archived
        
        // Columns
        ["col", "col1", "Backlog", "0"],
        ["col", "col2", "In Progress", "1"],
        ["col", "col3", "Testing", "2"],
        ["col", "col4", "Done", "3"],
        
        // Maintainers
        ["p", "<maintainer-pubkey-1>"],
        ["p", "<maintainer-pubkey-2>"]
    ],
    "content": ""
}
```

**Wichtig:**
- `v` (Version): Bei JEDER Änderung automatisch inkrementiert
- `pv` (Previous Version): Link zur vorherigen Version (Git-Style)
- `m` (Message): Auto-generiert aus Change-Events ("Added 3 cards, ...")

---

### 2. Snapshot Event (Kind 30303) - für Rollback

```javascript
{
    "kind": 30303,  // NON-REPLACEABLE!
    "created_at": 1730000000,
    "tags": [
        ["a", "30301:<pubkey>:<board-id>"],  // Board Reference
        
        // === SNAPSHOT METADATA ===
        ["v", "42"],                         // ✅ Version dieses Snapshots
        ["r", "auto"],                       // ✅ Reason: auto|manual|milestone
        ["m", "Auto: Added 3 cards, Moved 1 card"], // ✅ Commit-Message
        ["c", "15"],                         // ✅ Change Count seit letztem Snapshot
        ["t", "1730000000"]                  // ✅ Timestamp (optional)
    ],
    "content": "{...vollständiger Board-State als JSON...}"
}
```

**Content-Struktur:**
```json
{
    "id": "project-alpha",
    "name": "Project Alpha",
    "description": "...",
    "columns": [
        {
            "id": "col1",
            "name": "Backlog",
            "cards": [...]
        }
    ],
    "publishState": "draft",
    "author": "<pubkey>",
    "tags": ["project-management", "sprint-3"]
}
```

**Snapshot-Trigger:**
- ✅ Zeit-basiert: Alle 5 Minuten (konfigurierbar)
- ✅ Change-basiert: Nach 10 Änderungen (konfigurierbar)
- ✅ Significant Changes: Spalte hinzufügen/löschen, Board umbenennen
- ✅ Manuell: User-Trigger via UI-Button

---

### 3. Change Event (Kind 30304) - für Audit Trail

```javascript
{
    "kind": 30304,
    "created_at": 1730000100,
    "tags": [
        ["a", "30301:<pubkey>:<board-id>"],  // Board Reference
        
        // === CHANGE METADATA ===
        ["v", "42"],                         // ✅ Version nach diesem Change
        ["ct", "card_created"],              // ✅ Change Type
        ["ca", "<author-pubkey>"],           // ✅ Change Author
        
        // === CHANGE-SPEZIFISCHE TAGS ===
        ["ci", "card-123"],                  // Card ID (wenn relevant)
        ["cli", "col-2"],                    // Column ID (wenn relevant)
        ["cn", "Task XYZ"]                   // Card Name (optional, für Readability)
    ],
    "content": "Added card 'Task XYZ' to column 'In Progress'"
}
```

**Change Types:**
- `card_created`, `card_updated`, `card_deleted`, `card_moved`
- `column_added`, `column_updated`, `column_deleted`, `column_reordered`
- `board_renamed`, `board_description_updated`
- `comment_added`, `comment_deleted`

---

## 🏷️ Tag-Referenz (Single-Char optimiert)

| Tag | Name | Verwendung | Werte | Event Kinds |
|-----|------|-----------|-------|-------------|
| `v` | Version | Aktuelle/Snapshot Version | Integer als String | 30301, 30303, 30304 |
| `pv` | Previous Version | Link zur vorherigen Version | Integer als String | 30301 |
| `b` | Branch | Git-ähnlicher Branch | String (default: "main") | 30301 |
| `m` | Message | Auto-generierte Commit-Message | String | 30301, 30303 |
| `r` | Reason | Snapshot-Grund | `auto`\|`manual`\|`milestone` | 30303 |
| `c` | Count | Anzahl Changes seit letztem Snapshot | Integer als String | 30303 |
| `t` | Timestamp | Zusätzlicher Timestamp | Unix timestamp | 30303 |
| `ct` | Change Type | Art der Änderung | Siehe Change Types | 30304 |
| `ca` | Change Author | Wer hat geändert | pubkey | 30304 |
| `ci` | Card ID | Betroffene Karte | Card d-tag | 30304 |
| `cli` | Column ID | Betroffene Spalte | Column ID | 30304 |
| `cn` | Card Name | Kartenname (für Readability) | String | 30304 |

**Warum Single-Char Tags?**
- ✅ Relay-Indexierung schneller (`Map<"v", Set<events>>` statt `Map<"version", ...>`)
- ✅ Weniger Bytes pro Event (~50 Bytes Ersparnis pro Event)
- ✅ Bessere Filter-Performance (#v vs #version)
- ✅ NIP-konform (etabliertes Muster wie `a`, `e`, `p`, `d`)

---

## 🔄 Automatische Versionierung

### Konzept: "Silent Versioning"

**User sieht NICHTS, System macht alles automatisch:**

```typescript
// User-Aktion → System-Reaktion
createCard()     → Version: 41 → 42 (silent)
                 → Change Event (30304) erstellt
                 → triggerUpdate() → localStorage
                 → Snapshot-Check
```

### Konfiguration (SettingsStore)

```typescript
export class SettingsStore {
    public versioningSettings = $state({
        // Auto-Versioning aktiviert?
        enabled: true,
        
        // Snapshot-Intervall (Minuten)
        snapshotInterval: 5,
        
        // Änderungs-Threshold für Snapshot
        changesThreshold: 10,
        
        // Notifications zeigen?
        showSnapshotNotifications: false,
        
        // Wie viele Snapshots lokal behalten?
        maxLocalSnapshots: 50,
        
        // Significant Changes Detection
        significantChanges: {
            columnAdded: true,
            columnDeleted: true,
            boardRenamed: true,
            bulkCardMoves: true  // > 10 Karten auf einmal
        }
    });
}
```

---

## 💻 Implementierung

### BoardStore Integration

```typescript
export class BoardStore {
    // === AUTO-VERSIONING STATE ===
    private changesSinceLastSnapshot = $state(0);
    private lastSnapshotTime = $state(Date.now());
    private pendingChanges = $state<Change[]>([]);
    
    // === ZENTRALE CHANGE-RECORDING METHODE ===
    private recordChange(change: Change): void {
        // 1. Version automatisch hochzählen
        const currentVersion = parseInt(this.board.version || "0");
        this.board.version = (currentVersion + 1).toString();
        
        // 2. Change zur Liste hinzufügen
        this.pendingChanges.push({
            ...change,
            timestamp: Date.now(),
            version: this.board.version,
            author: authStore.getPubkey() || 'anonymous'
        });
        
        this.changesSinceLastSnapshot++;
        
        // 3. Normale Persistierung
        this.triggerUpdate();
        
        // 4. Change Event publizieren
        this.publishChangeEvent(change);
        
        // 5. Snapshot-Check
        this.checkSnapshotTriggers();
    }
    
    // === WRAPPER FÜR ALLE BOARD-AKTIONEN ===
    public createCard(columnId: string, heading: string): string {
        const cardId = this._createCard(columnId, heading);
        
        this.recordChange({
            type: 'card_created',
            cardId,
            columnId,
            heading
        });
        
        return cardId;
    }
    
    public moveCard(cardId: string, fromColId: string, toColId: string): void {
        this._moveCard(cardId, fromColId, toColId);
        
        this.recordChange({
            type: 'card_moved',
            cardId,
            from: fromColId,
            to: toColId
        });
    }
    
    // === SNAPSHOT-LOGIK ===
    private checkSnapshotTriggers(): void {
        const settings = settingsStore.versioningSettings;
        if (!settings.enabled) return;
        
        const now = Date.now();
        const timeSinceSnapshot = now - this.lastSnapshotTime;
        
        const shouldSnapshot = 
            // Zeit-basiert
            timeSinceSnapshot >= settings.snapshotInterval * 60 * 1000 ||
            // Change-Count-basiert
            this.changesSinceLastSnapshot >= settings.changesThreshold ||
            // Significant Change erkannt
            this.hasSignificantChanges(this.pendingChanges);
        
        if (shouldSnapshot) {
            this.createAutoSnapshot();
        }
    }
    
    private async createAutoSnapshot(): Promise<void> {
        const version = parseInt(this.board.version || "0");
        const commitMessage = this.generateCommitMessage(this.pendingChanges);
        
        console.log(`📸 Creating auto-snapshot v${version}: ${commitMessage}`);
        
        const snapshotEvent = new NDKEvent(this.ndk);
        snapshotEvent.kind = 30303;
        snapshotEvent.tags = [
            ["a", `30301:${this.board.author}:${this.board.id}`],
            ["v", version.toString()],
            ["r", "auto"],
            ["m", commitMessage],
            ["c", this.changesSinceLastSnapshot.toString()],
            ["t", Date.now().toString()]
        ];
        
        snapshotEvent.content = JSON.stringify(
            this.board.getContextData(true)
        );
        
        await this.syncManager.publishOrQueue(snapshotEvent, 'snapshot');
        
        // Reset
        this.changesSinceLastSnapshot = 0;
        this.lastSnapshotTime = Date.now();
        this.pendingChanges = [];
    }
    
    // === AUTO-GENERIERTE COMMIT-MESSAGES ===
    private generateCommitMessage(changes: Change[]): string {
        if (changes.length === 0) return "Auto-save";
        
        const grouped = this.groupChangesByType(changes);
        const messages: string[] = [];
        
        if (grouped.card_created > 0) {
            messages.push(`Added ${grouped.card_created} card(s)`);
        }
        if (grouped.card_moved > 0) {
            messages.push(`Moved ${grouped.card_moved} card(s)`);
        }
        if (grouped.column_added > 0) {
            messages.push(`Added ${grouped.column_added} column(s)`);
        }
        if (grouped.column_updated > 0) {
            messages.push(`Updated ${grouped.column_updated} column(s)`);
        }
        if (grouped.card_deleted > 0) {
            messages.push(`Deleted ${grouped.card_deleted} card(s)`);
        }
        
        return messages.join(', ') || 'Auto-save';
    }
    
    private groupChangesByType(changes: Change[]): Record<string, number> {
        return changes.reduce((acc, change) => {
            acc[change.type] = (acc[change.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }
    
    // === SIGNIFICANT CHANGES DETECTION ===
    private hasSignificantChanges(changes: Change[]): boolean {
        const settings = settingsStore.versioningSettings.significantChanges;
        
        return changes.some(change => {
            switch (change.type) {
                case 'column_added':
                    return settings.columnAdded;
                case 'column_deleted':
                    return settings.columnDeleted;
                case 'board_renamed':
                    return settings.boardRenamed;
                case 'card_moved':
                    // Bulk-Moves (> 10 Karten)
                    return settings.bulkCardMoves && 
                           this.countChangesOfType(changes, 'card_moved') >= 10;
                default:
                    return false;
            }
        });
    }
    
    private countChangesOfType(changes: Change[], type: string): number {
        return changes.filter(c => c.type === type).length;
    }
}
```

---

## 📖 Version History

### Snapshots laden

```typescript
export class BoardStore {
    public async loadSnapshots(): Promise<Snapshot[]> {
        const snapshots = await this.ndk.fetchEvents({
            kinds: [30303],
            "#a": [`30301:${this.board.author}:${this.board.id}`]
        });
        
        return Array.from(snapshots)
            .map(event => ({
                version: parseInt(this.getTagValue(event, "v") || "0"),
                reason: this.getTagValue(event, "r") || "auto",
                message: this.getTagValue(event, "m") || "No message",
                changeCount: parseInt(this.getTagValue(event, "c") || "0"),
                timestamp: event.created_at!,
                author: event.pubkey,
                content: event.content
            }))
            .sort((a, b) => b.version - a.version); // Neueste zuerst
    }
    
    private getTagValue(event: NDKEvent, tagName: string): string | undefined {
        return event.tags.find(t => t[0] === tagName)?.[1];
    }
}
```

### Rollback zu Version

```typescript
export class BoardStore {
    public async rollbackToVersion(targetVersion: number): Promise<void> {
        // 1. Snapshot für diese Version suchen
        const snapshots = await this.ndk.fetchEvents({
            kinds: [30303],
            "#a": [`30301:${this.board.author}:${this.board.id}`],
            "#v": [targetVersion.toString()]
        });
        
        const snapshot = Array.from(snapshots)[0];
        
        if (!snapshot) {
            throw new Error(`Snapshot for version ${targetVersion} not found`);
        }
        
        // 2. Board-State aus Snapshot wiederherstellen
        const boardData = JSON.parse(snapshot.content);
        this.board = this.reconstructBoard(boardData);
        
        // 3. Als neue Version publizieren (nicht targetVersion überschreiben!)
        const currentVersion = parseInt(this.board.version || "0");
        const newVersion = currentVersion + 1;
        
        await this.publishBoardWithVersion(
            currentVersion,
            newVersion,
            `Rollback to version ${targetVersion}`
        );
        
        this.triggerUpdate();
        
        console.log(`✅ Rolled back to version ${targetVersion} (as v${newVersion})`);
    }
}
```

---

## 🎨 UI-Integration

### Version History Component

```svelte
<!-- VersionHistory.svelte -->
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import HistoryIcon from "@lucide/svelte/icons/history";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    
    let snapshots = $state<Snapshot[]>([]);
    let loading = $state(false);
    
    async function loadHistory() {
        loading = true;
        snapshots = await boardStore.loadSnapshots();
        loading = false;
    }
    
    async function restore(version: number) {
        if (confirm(`Restore board to version ${version}?`)) {
            await boardStore.rollbackToVersion(version);
            open = false;
        }
    }
    
    function formatRelativeTime(timestamp: number): string {
        const seconds = Math.floor((Date.now() / 1000 - timestamp));
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
    
    let open = $state(false);
    
    $effect(() => {
        if (open) loadHistory();
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger asChild let:builder>
        <Button builders={[builder]} variant="ghost" size="sm">
            <HistoryIcon class="mr-2 h-4 w-4" />
            Version History
        </Button>
    </Dialog.Trigger>
    
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>Version History</Dialog.Title>
            <Dialog.Description>
                {snapshots.length} snapshot(s) available
            </Dialog.Description>
        </Dialog.Header>
        
        {#if loading}
            <div class="text-center py-8">Loading...</div>
        {:else}
            <div class="space-y-2">
                {#each snapshots as snapshot}
                    <div class="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <Badge variant="outline">v{snapshot.version}</Badge>
                                    <Badge variant={snapshot.reason === 'manual' ? 'default' : 'secondary'}>
                                        {snapshot.reason}
                                    </Badge>
                                </div>
                                <p class="text-sm font-medium">{snapshot.message}</p>
                                <p class="text-xs text-muted-foreground mt-1">
                                    {formatRelativeTime(snapshot.timestamp)} · 
                                    {snapshot.changeCount} change{snapshot.changeCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                size="sm"
                                onclick={() => restore(snapshot.version)}
                            >
                                <RotateCcwIcon class="mr-2 h-4 w-4" />
                                Restore
                            </Button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>
```

### Manual Snapshot Button

```svelte
<!-- In BoardTopbar.svelte -->
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { toast } from 'svelte-sonner';
    import CameraIcon from "@lucide/svelte/icons/camera";
    
    async function createManualSnapshot() {
        const message = prompt('Snapshot description (optional):');
        
        await boardStore.createManualSnapshot(
            message || 'Manual snapshot'
        );
        
        toast.success('Snapshot created ✅');
    }
</script>

<DropdownMenu.Root>
    <DropdownMenu.Content>
        <DropdownMenu.Item onclick={createManualSnapshot}>
            <CameraIcon class="mr-2 h-4 w-4" />
            Create Snapshot
        </DropdownMenu.Item>
        <DropdownMenu.Item onclick={() => showVersionHistory = true}>
            <HistoryIcon class="mr-2 h-4 w-4" />
            Version History
        </DropdownMenu.Item>
    </DropdownMenu.Content>
</DropdownMenu.Root>
```

---

## 🔍 Relay-Queries

### 1. Aktuelles Board laden (neueste Version)

```javascript
{
    "kinds": [30301],
    "authors": ["<pubkey>"],
    "#d": ["project-alpha"],
    "limit": 1  // Nur neueste
}
```

### 2. Alle Snapshots eines Boards

```javascript
{
    "kinds": [30303],
    "#a": ["30301:<pubkey>:project-alpha"]
}
```

### 3. Changes seit Version X

```javascript
{
    "kinds": [30304],
    "#a": ["30301:<pubkey>:project-alpha"],
    "#v": ["42", "43", "44"]  // Versionen 42-44
}
```

### 4. Significant Changes filtern

```javascript
{
    "kinds": [30304],
    "#a": ["30301:<pubkey>:project-alpha"],
    "#ct": ["column_added", "column_deleted", "board_renamed"]
}
```

---

## 📊 Praktisches Beispiel: User-Flow

### Szenario: Normale Arbeitssitzung

```
Zeit    | User-Aktion                | System-Reaktion
--------|----------------------------|----------------------------------
09:00   | Karte "Task A" erstellt    | v1 → v2 (silent)
09:05   | Karte "Task B" erstellt    | v2 → v3 (silent)
09:10   | Karte "Task A" verschoben  | v3 → v4 (silent)
09:15   | ... 6 weitere Änderungen   | v4 → v10 (silent)
09:20   | 5 Min vergangen            | 📸 Auto-Snapshot v10
        |                            | Message: "Added 2 cards, Moved 1 card, ..."
09:25   | Spalte "Testing" hinzufügen| v10 → v11 (silent)
        |                            | ⚠️ Significant Change!
        |                            | 📸 Auto-Snapshot v11
        |                            | Message: "Added column 'Testing'"
```

**User sieht:**
- Optional: Small notification "Board snapshot created" (wenn aktiviert)
- Ansonsten: Nichts!

---

## 🔒 Konfliktauflösung

### Bei gleichzeitigen Edits von mehreren Maintainern

```typescript
export class BoardStore {
    public async detectConflicts(): Promise<BoardConflict[]> {
        const conflicts: BoardConflict[] = [];
        
        // Alle Board-Events seit letztem Sync
        const events = await this.ndk.fetchEvents({
            kinds: [30301],
            "#d": [this.board.id],
            since: this.lastSyncTimestamp
        });
        
        // Events nach Version sortieren
        const sortedEvents = Array.from(events).sort((a, b) => {
            const vA = parseInt(this.getTagValue(a, "v") || "0");
            const vB = parseInt(this.getTagValue(b, "v") || "0");
            return vB - vA;
        });
        
        // Wenn mehrere Events mit gleicher Version existieren
        const versionGroups = this.groupByVersion(sortedEvents);
        
        for (const [version, eventsInGroup] of versionGroups) {
            if (eventsInGroup.length > 1) {
                // Konflikt! Mehrere Maintainers haben zur gleichen Version publiziert
                const winner = this.resolveConflict(eventsInGroup); // Last-Write-Wins
                
                conflicts.push({
                    version: parseInt(version),
                    events: eventsInGroup,
                    winner: winner,
                    resolution: 'last-write-wins'
                });
            }
        }
        
        return conflicts;
    }
    
    private resolveConflict(events: NDKEvent[]): NDKEvent {
        // Last-Write-Wins basierend auf created_at
        return events.sort((a, b) => b.created_at! - a.created_at!)[0];
    }
}
```

---

## 🎯 Zusammenfassung

### Was macht das System?

| Feature | Beschreibung | User Experience |
|---------|--------------|-----------------|
| **Auto-Increment** | Version +1 bei jeder Änderung | ✅ Unsichtbar |
| **Smart Snapshots** | Alle 5 Min ODER 10 Changes ODER Significant Change | ✅ Optional notification |
| **Auto-Commits** | "Added 3 cards, Moved 1 card, ..." | ✅ Informativ & lesbar |
| **Rollback** | Restore zu beliebiger Version | ✅ Ein Klick |
| **History** | Timeline aller Snapshots | ✅ Klar & verständlich |
| **Audit Trail** | Wer hat wann was geändert | ✅ Compliance-ready |

### Vorteile

- ✅ **Keine manuelle Arbeit**: User muss nichts tun
- ✅ **Vollständige Historie**: Jede Änderung wird getrackt
- ✅ **Rollback-fähig**: Kompletter Board-State wiederherstellbar
- ✅ **Relay-effizient**: Single-char tags, nur Snapshots bei Bedarf
- ✅ **Offline-first**: Funktioniert auch ohne Verbindung
- ✅ **NIP-kompatibel**: Nutzt etablierte Patterns

### Performance

**Pro Board pro Tag (normale Nutzung):**
- Board Events (30301): ~50 (Version-Updates)
- Snapshots (30303): ~96 (alle 5 Min bei 8h Arbeit = 12/h)
- Change Events (30304): ~50 (detailliertes Tracking)

**Total:** ~200 Events/Tag/Board

**Optimierungen:**
- Snapshots nur bei tatsächlichen Changes (nicht bei Inaktivität)
- Change Events optional (können deaktiviert werden für weniger Overhead)
- Alte Snapshots können von Relays gelöscht werden (nur letzte 50 behalten)

---

## 📋 Implementation Roadmap

### Phase 1: Basic Versioning ✅
- [x] `v` tag in Board Events (30301)
- [x] Auto-increment bei Änderungen
- [x] Version in localStorage persistieren

### Phase 2: Snapshots (Meilenstein 2.1)
- [ ] Snapshot Event Kind (30303) definieren
- [ ] Auto-Snapshot bei Zeit/Change-Triggern
- [ ] Manual Snapshot Button in UI
- [ ] Snapshot-Settings in SettingsStore

### Phase 3: History & Rollback (Meilenstein 2.2)
- [ ] Version History Component
- [ ] Snapshots laden & anzeigen
- [ ] Rollback-Funktion implementieren
- [ ] Conflict Detection

### Phase 4: Change Events (Meilenstein 2.3 - Optional)
- [ ] Change Event Kind (30304) definieren
- [ ] Change Tracking in BoardStore
- [ ] Auto-generierte Commit-Messages
- [ ] Audit Trail UI

---

## 🔗 Referenzen

- **Kanban-NIP**: `docs/GUIDES/Kanban-NIP.md`
- **BoardStore**: `docs/ARCHITECTURE/STORES.md`
- **NDK Integration**: `docs/ARCHITECTURE/NDK.md`
- **ROADMAP**: `docs/COLLABORATION/ROADMAP.md`

---

**Status:** Draft → Review erforderlich  
**Next Steps:** Community-Feedback einholen, NIP formalisieren, Implementation starten
