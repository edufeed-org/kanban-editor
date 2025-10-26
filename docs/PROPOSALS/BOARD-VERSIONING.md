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

### Two-Layer Snapshot System

```
┌─────────────────────────────────────────────────┐
│  Kind 30301 (Replaceable)                       │
│  → Aktueller Board-State (live)                 │
│  → Spalten, Spalten-Reihenfolge, Metadata      │
│  → Keine Versionstags (kein v/pv)              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Kind 30302 (Replaceable)                       │
│  → Card-Inhalte (heading, content, labels)     │
│  → Mit author-Tag für Multi-User Attribution   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Kind 30303 (Non-Replaceable)                   │
│  → Manuelle Snapshots via UI-Button             │
│  → Komplettes Board-JSON bei User-Click        │
│  → Mit ["v", "version-label"] Tag               │
│  → Rollback zu beliebigem Snapshot             │
└─────────────────────────────────────────────────┘
```

---

## 📊 Event-Struktur

### 1. Board Event (Kind 30301) - Struktur & Spalten

```javascript
{
    "kind": 30301,
    "created_at": 1730000000,
    "tags": [
        ["d", "project-alpha"],              // Board-ID (NIP-33)
        ["title", "Project Alpha"],
        ["description", "Board Description"],
        
        // Publishing State
        ["pub", "private"],                    // private|published|archived
        
        // Columns (aktuelles Layout)
        ["col", "col1", "Backlog", "0"],
        ["col", "col2", "In Progress", "1"],
        ["col", "col3", "Testing", "2"],
        ["col", "col4", "Done", "3"],
        
        // Maintainers / Owners
        ["p", "<maintainer-pubkey-1>"],
        ["p", "<maintainer-pubkey-2>"]
    ],
    "content": ""
}
```

**Wichtig:**
- `d` (d-tag): Board-ID, identifiziert das Board eindeutig
- `col` tags: Definieren aktuelle Spalten-Struktur & Reihenfolge
- Replaceable: Bei Änderungen wird das Event einfach neu publiziert (überschreibt alte Version)
- **Kein v/pv/m Tags** — Versioning nur in 30303 Snapshots!

---

### 2. Snapshot Event (Kind 30303) - Manuelle Speicherung

```javascript
{
    "kind": 30303,  // NON-REPLACEABLE!
    "created_at": 1730000000,
    "tags": [
        ["a", "30301:<pubkey>:<board-id>"],  // Board Reference
        
        // === SNAPSHOT METADATA ===
        ["v", "my-snapshot-label"],          // ✅ User-Beschreibung (z.B. "Before Refactor", "Sprint-3 End" oder automativiert generiert)
        ["r", "manual"],                     // ✅ Grund: manual (User-Click)
        ["t", "1730000000"]                  // ✅ Timestamp (optional)
    ],
    "content": "{...komplettes Board-JSON mit Cards...}"
}
```

**Content-Struktur (Komplettes Board mit Cards):**
```json
{
    "id": "project-alpha",
    "name": "Project Alpha",
    "description": "...",
    "columns": [
        {
            "id": "col1",
            "name": "Backlog",
            "cards": [
                {
                    "id": "card-1",
                    "heading": "Task A",
                    "content": "Description",
                    "author": "<author-pubkey>",
                    "createdAt": "2025-10-26T12:00:00Z"
                }
            ]
        }
    ],
    "publishState": "private",
    "author": "<board-creator-pubkey>"
}
```

**Snapshot-Auslöser:**
- ✅ Manuell: User klickt "Version speichern"-Button in UI
- ✅ User gibt optional ein Label ein (z.B. "Sprint Planning", "Before Cleanup")
- ✅ System publiziert komplettes Board-JSON als 30303
- ✅ Snapshots können jederzeit wiederhergestellt werden (Rollback-Button)


---

## 📊 Multi-User Attribution

Bei Mehrbenutzer-Szenarien (Nostr-Pubkeys):

### 30302 Card mit author-Tag

```javascript
{
    "kind": 30302,
    "created_at": 1730000000,
    "tags": [
        ["d", "card-xyz"],                   // Card-ID
        ["a", "30301:<board-owner>:<board-id>"],  // Board-Referenz
        ["author", "<creator-pubkey>"],      // ✅ Wer hat die Karte erstellt?
        ["modified-by", "<modifier-pubkey>"] // Optional: Letzter Editor
    ],
    "content": "{...Card-Inhalte...}"
}
```

**Multi-User Workflow:**
- Alice erstellt Card → author = Alice's pubkey
- Bob verschiebt Card → 30301/30302 wird aktualisiert (pubkey = Bob)
- Snapshots erfassen Zustand mit author-Tags
- Rollback zu Snapshot X stellt auch die author-Attributionen her

---

## 🏷️ Tag-Referenz

| Tag | Verwendung | Werte | Event Kinds |
|-----|-----------|-------|-------------|
| `d` | Event-ID (Nostr d-tag) | String (z.B. "board-id" oder "card-id") | 30301, 30302 |
| `a` | Referenz zu anderem Event | Format: "kind:pubkey:d-tag" | 30303 (→ 30301) |
| `v` | Snapshot-Label | User-Beschreibung (z.B. "Before Refactor") | 30303 |
| `r` | Snapshot-Grund | `manual` (User-Click) | 30303 |
| `t` | Timestamp | Unix timestamp | 30303 |
| `p` | Pubkey (Maintainer/Author) | Nostr pubkey | 30301, 30302, 30303 |
| `col` | Spalten-Definition | `["col", id, name, order]` | 30301 |
| `title` | Board-Name | String | 30301 |
| `description` | Board-Beschreibung | String | 30301 |
| `pub` | Publish-State | `private` \| `published` \| `archived` | 30301 |
| `author` | Card-Ersteller | Nostr pubkey | 30302 |

**Warum minimale Tags?**
- ✅ Schneller, weniger Bytes pro Event
- ✅ Nur Informationen, die wirklich nötig sind
- ✅ Snapshots enthalten komplette Daten im JSON → keine Tag-Komplexität

---

## 🎯 Snapshot-Management (Manuell via UI)

### Konzept: "Benutzer-kontrollierte Snapshots"

**User klickt "Version speichern"-Button:**

```
User: Klickt "Version speichern"
  ↓
Dialog: "Snapshot-Beschreibung eingeben?"
  ↓ User: "Sprint-3 Planung abgeschlossen"
  ↓
System: Erstellt 30303 Event
  - Tag ["v", "Sprint-3 Planung abgeschlossen"]
  - Content: komplettes Board-JSON
  - Publiziert zu Nostr
  ↓
UI: "✅ Snapshot gespeichert"
```

**Das ist es.** Keine Auto-Snapshots, keine Versionskommandos — einfach ein Button.

---

## 💻 Implementierung

### BoardStore - Snapshot-Methoden

```typescript
export class BoardStore {
    // === MANUELLE SNAPSHOT-ERSTELLUNG ===
    public async createManualSnapshot(label: string): Promise<void> {
        const snapshotEvent = new NDKEvent(this.ndk);
        snapshotEvent.kind = 30303;
        snapshotEvent.tags = [
            ["a", `30301:${this.board.author}:${this.board.id}`],
            ["v", label],  // User-Beschreibung (z.B. "Sprint-3 Planning")
            ["r", "manual"],
            ["t", Math.floor(Date.now() / 1000).toString()]  // Unix timestamp
        ];
        
        // Snapshot-Content: Komplettes Board mit Cards
        snapshotEvent.content = JSON.stringify(
            this.board.getContextData(true)  // true = include all cards
        );
        
        await this.syncManager.publishOrQueue(snapshotEvent, 'snapshot');
        
        console.log(`✅ Snapshot gespeichert: "${label}"`);
    }
    
    // === SNAPSHOTS LADEN ===
    public async loadSnapshots(): Promise<Snapshot[]> {
        const snapshots = await this.ndk.fetchEvents({
            kinds: [30303],
            "#a": [`30301:${this.board.author}:${this.board.id}`]
        });
        
        return Array.from(snapshots)
            .map(event => ({
                label: this.getTagValue(event, "v") || "Unnamed",
                timestamp: event.created_at!,
                author: event.pubkey,
                content: event.content
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // === ROLLBACK ZU SNAPSHOT ===
    public async rollbackToSnapshot(snapshotLabel: string): Promise<void> {
        const snapshots = await this.ndk.fetchEvents({
            kinds: [30303],
            "#a": [`30301:${this.board.author}:${this.board.id}`],
            "#v": [snapshotLabel]
        });
        
        const snapshot = Array.from(snapshots)[0];
        if (!snapshot) {
            throw new Error(`Snapshot "${snapshotLabel}" not found`);
        }
        
        // Board aus Snapshot wiederherstellen
        const boardData = JSON.parse(snapshot.content);
        this.board = this.reconstructBoard(boardData);
        
        // Lokal persistieren
        this.triggerUpdate();
        
        console.log(`✅ Restored from snapshot: "${snapshotLabel}"`);
    }
    
    private getTagValue(event: NDKEvent, tagName: string): string | undefined {
        return event.tags.find(t => t[0] === tagName)?.[1];
    }
}
```

---

## 📖 Snapshots verwalten

### Snapshot-Timeline laden

```typescript
// boardStore.loadSnapshots() gibt sortierte Liste zurück:
[
  { label: "Sprint-3 Planung", timestamp: 1730000000, author: "alice..." },
  { label: "Before Cleanup", timestamp: 1729999999, author: "bob..." },
  { label: "Initial Setup", timestamp: 1729999000, author: "alice..." }
]
```

### Rollback durchführen

```typescript
// User klickt "Restore" bei einem Snapshot
await boardStore.rollbackToSnapshot("Sprint-3 Planung");
// ✅ Board wird zu diesem Snapshot wiederhergestellt
```

---

## 🎨 UI-Integration

### Version History Dialog

```svelte
<!-- VersionHistory.svelte -->
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import HistoryIcon from "@lucide/svelte/icons/history";
    import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
    
    let snapshots = $state([]);
    let loading = $state(false);
    let open = $state(false);
    
    async function loadHistory() {
        loading = true;
        snapshots = await boardStore.loadSnapshots();
        loading = false;
    }
    
    async function restore(label) {
        if (confirm(`Restore to snapshot "${label}"?`)) {
            await boardStore.rollbackToSnapshot(label);
            open = false;
        }
    }
    
    $effect(() => {
        if (open) loadHistory();
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger asChild let:builder>
        <Button builders={[builder]} variant="ghost" size="sm">
            <HistoryIcon class="mr-2 h-4 w-4" />
            Snapshots
        </Button>
    </Dialog.Trigger>
    
    <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-y-auto">
        <Dialog.Header>
            <Dialog.Title>Saved Snapshots</Dialog.Title>
        </Dialog.Header>
        
        {#if loading}
            <div class="text-center py-8">Loading...</div>
        {:else if snapshots.length === 0}
            <div class="text-center py-8 text-muted-foreground">
                No snapshots yet. Click "Save Version" to create one.
            </div>
        {:else}
            <div class="space-y-2">
                {#each snapshots as snap}
                    <div class="border rounded-lg p-3 hover:bg-muted/50 transition-colors flex items-center justify-between">
                        <div>
                            <p class="font-medium">{snap.label}</p>
                            <p class="text-xs text-muted-foreground">
                                {new Date(snap.timestamp * 1000).toLocaleString()}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onclick={() => restore(snap.label)}>
                            <RotateCcwIcon class="mr-2 h-4 w-4" />
                            Restore
                        </Button>
                    </div>
                {/each}
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>
```

### Save Version Button

```svelte
<!-- In BoardTopbar.svelte -->
<script lang="ts">
    import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
    import { Button } from "$lib/components/ui/button";
    import SaveIcon from "@lucide/svelte/icons/save";
    
    async function saveSnapshot() {
        const label = prompt('Snapshot description (e.g., "Sprint-3 Planning"):');
        if (label) {
            await boardStore.createManualSnapshot(label);
            // Toast notification (optional)
        }
    }
</script>

<Button onclick={saveSnapshot} class="gap-2">
    <SaveIcon class="h-4 w-4" />
    Save Version
</Button>
```

---

## ⚔ Conflict Detection & Merge (Phase 2)

### Problem: Konkurrierende Edits

Wenn zwei Clients **gleichzeitig** eine Karte bearbeiten (Anna & Paul), kann das zu Datenverlust führen (Last-Write-Wins überschreibt Annas Arbeit).

**Lösung:** Git-ähnliches Merge-System auf Client-Seite.

### 1️⃣ Ausgangsversion merken

Wenn Anna eine Karte öffnet, speichert ihr Client:

```typescript
interface EditingSession {
  cardId: string;
  baseVersion: NDKEvent;      // Die Version, mit der Anna anfing
  baseTimestamp: number;      // created_at des base Events
  editStartTime: number;      // Wann Anna anfing zu editieren
}
```

### 2️⃣ Vor dem Speichern: Conflict Check

Bevor Anna ihre Änderungen publiziert (30302 Event), führt ihr Client diese Routine aus:

```typescript
async function checkForConflict(cardId: string): Promise<ConflictStatus> {
  // 1. Abfrage: Aktuellste Version vom Relay
  const latestEvent = await ndk.fetchEvent({
    kinds: [30302],
    '#d': [cardId],
    limit: 1
  });
  
  // 2. Vergleich
  if (!latestEvent || latestEvent.created_at === editingSession.baseTimestamp) {
    return { status: 'NO_CONFLICT' };  // Fall A: Niemand hat ändern derweil was geändert
  }
  
  if (latestEvent.created_at > editingSession.baseTimestamp) {
    return {
      status: 'CONFLICT_DETECTED',
      conflictingEvent: latestEvent,  // Pauls Version
      userVersion: annasDraft         // Annas Version
    };
  }
}
```

### 3️⃣ Automatisches Merge (wenn möglich)

```typescript
interface MergeResult {
  merged: boolean;
  conflicts: ConflictingField[];
  mergedContent: string;
}

async function attemptAutoMerge(
  base: CardContent,
  anna: CardContent,
  paul: CardContent
): Promise<MergeResult> {
  const conflicts: ConflictingField[] = [];
  const merged = { ...base };
  
  // Pro Feld: Prüfe ob beide ändern oder nur einer
  
  // Feld: heading
  if (anna.heading !== base.heading && paul.heading !== base.heading) {
    // KONFLIKT: Beide haben heading geändert
    conflicts.push({
      field: 'heading',
      baseVersion: base.heading,
      annaVersion: anna.heading,
      paulVersion: paul.heading
    });
  } else if (anna.heading !== base.heading) {
    // OK: Nur Anna geändert
    merged.heading = anna.heading;
  } else if (paul.heading !== base.heading) {
    // OK: Nur Paul geändert
    merged.heading = paul.heading;
  }
  
  // Feld: content (längerer Text)
  if (anna.content !== base.content && paul.content !== base.content) {
    // KONFLIKT: Beide haben content geändert
    // Versuche 3-way diff/merge (z.B. mit library wie 'diff-match-patch')
    const mergedContent = threeWayMerge(base.content, anna.content, paul.content);
    
    if (mergedContent.conflicts.length === 0) {
      // Auto-merge erfolgreich!
      merged.content = mergedContent.result;
    } else {
      // Konflikte bleiben bestehen
      conflicts.push({
        field: 'content',
        baseVersion: base.content,
        annaVersion: anna.content,
        paulVersion: paul.content,
        mergeResult: mergedContent
      });
    }
  } else if (anna.content !== base.content) {
    merged.content = anna.content;
  } else if (paul.content !== base.content) {
    merged.content = paul.content;
  }
  
  return {
    merged: conflicts.length === 0,
    conflicts,
    mergedContent: merged
  };
}
```

### 4️⃣ Manuelle Konfliktlösung (wenn Auto-Merge fehlschlägt)

Wenn automatisches Merge nicht funktioniert, zeigt der Client ein **Merge-Dialog**:

```svelte
<!-- MergeConflictDialog.svelte -->
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import * as Tabs from "$lib/components/ui/tabs";
  
  export let conflicts: ConflictingField[];
  export let onResolve: (resolution: MergeResolution) => void;
  
  let selectedResolutions: Record<string, 'anna' | 'paul' | 'merged'> = {};
</script>

<Dialog.Root open={true}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>⚠️ Merge-Konflikt erkannt</Dialog.Title>
      <Dialog.Description>
        Paul hat diese Karte in der Zwischenzeit auch bearbeitet.
        Bitte wähle, welche Version du behalten möchtest.
      </Dialog.Description>
    </Dialog.Header>
    
    <Tabs.Root>
      {#each conflicts as conflict (conflict.field)}
        <Tabs.Trigger value={conflict.field}>
          {conflict.field}
        </Tabs.Trigger>
      {/each}
    </Tabs.Root>
    
    {#each conflicts as conflict (conflict.field)}
      <Tabs.Content value={conflict.field}>
        
        <!-- Basis-Version -->
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h4 class="font-semibold text-sm mb-2">Original (Basis)</h4>
            <div class="bg-slate-100 p-3 rounded text-sm font-mono whitespace-pre-wrap">
              {conflict.baseVersion}
            </div>
          </div>
          
          <!-- Anna's Version -->
          <div>
            <h4 class="font-semibold text-sm mb-2">🔵 Deine Änderung</h4>
            <div class="bg-blue-50 p-3 rounded text-sm font-mono whitespace-pre-wrap border-2 border-blue-200">
              {conflict.annaVersion}
            </div>
            <Button
              variant={selectedResolutions[conflict.field] === 'anna' ? 'default' : 'outline'}
              class="mt-2 w-full"
              onclick={() => selectedResolutions[conflict.field] = 'anna'}
            >
              ✓ Deine Version verwenden
            </Button>
          </div>
        </div>
        
        <!-- Paul's Version -->
        <div class="mb-4">
          <h4 class="font-semibold text-sm mb-2">🟢 Pauls Änderung</h4>
          <div class="bg-green-50 p-3 rounded text-sm font-mono whitespace-pre-wrap border-2 border-green-200">
            {conflict.paulVersion}
          </div>
          <Button
            variant={selectedResolutions[conflict.field] === 'paul' ? 'default' : 'outline'}
            class="mt-2 w-full"
            onclick={() => selectedResolutions[conflict.field] = 'paul'}
          >
            ✓ Pauls Version verwenden
          </Button>
        </div>
        
        <!-- Automatisches Merge-Resultat (wenn verfügbar) -->
        {#if conflict.mergeResult?.result}
          <div class="mb-4">
            <h4 class="font-semibold text-sm mb-2">🟣 Auto-Merged Vorschlag</h4>
            <div class="bg-purple-50 p-3 rounded text-sm font-mono whitespace-pre-wrap border-2 border-purple-200">
              {conflict.mergeResult.result}
            </div>
            <Button
              variant={selectedResolutions[conflict.field] === 'merged' ? 'default' : 'outline'}
              class="mt-2 w-full"
              onclick={() => selectedResolutions[conflict.field] = 'merged'}
            >
              ✓ Merged Version verwenden
            </Button>
          </div>
        {/if}
        
      </Tabs.Content>
    {/each}
    
    <Dialog.Footer>
      <Button variant="outline" onclick={() => {}}>Abbrechen (nicht speichern)</Button>
      <Button onclick={() => onResolve(selectedResolutions)}>
        Speichern mit diesen Lösungen
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### 5️⃣ Soft Lock: Ephemeral "Now Editing" Event (Optional)

Um zu vermeiden, dass Paul überhaupt die Karte öffnet, kann Annas Client ein **Ephemeral Event** senden:

```typescript
// Kind 20000-29999: Ephemeral, nicht persistiert
const editingEvent = new NDKEvent(ndk);
editingEvent.kind = 20001;  // "Now Editing" Signal
editingEvent.tags = [
  ["a", `30302:${cardAuthor}:${cardId}`],  // Referenz zur Card
  ["d", `editing-${cardId}`],
  ["expires", String(Math.floor(Date.now() / 1000) + 300)]  // 5 Min TTL
];
editingEvent.content = JSON.stringify({
  user: authStore.getUserName(),
  startedAt: new Date().toISOString(),
  clientId: nanoid()  // Eindeutige Client-ID
});

await editingEvent.publish();
```

**Effect:** Wenn Paul dieselbe Karte öffnet, sieht sein Client dieses Ephemeral Event und zeigt:

```
⚠️ Warnung
Anna bearbeitet diese Karte gerade (gestartet vor 2 Min).
Du kannst trotzdem weiterarbeiten, aber möglicherweise entsteht ein Merge-Konflikt!
```

---

## �🔍 Relay-Queries

### 1. Aktuelles Board laden

```javascript
{
    "kinds": [30301],
    "authors": ["<pubkey>"],
    "#d": ["project-alpha"],
    "limit": 1
}
```

### 2. Alle Snapshots eines Boards laden

```javascript
{
    "kinds": [30303],
    "#a": ["30301:<pubkey>:project-alpha"]
}
```

### 3. Cards eines Boards laden

```javascript
{
    "kinds": [30302],
    "#a": ["30301:<pubkey>:project-alpha"]
}
```

---

## 📊 Praktisches Beispiel: User-Flow

### Szenario: Sprint-Planung mit Snapshots

```
Zeit    | User-Aktion                | System-Reaktion
--------|----------------------------|----------------------------------
09:00   | Erstelle Board "Sprint-3"  | 30301 Event publiziert
09:15   | Füge 20 Karten hinzu       | 20× 30302 Events publiziert
09:30   | Klickt "Save Version"      | Dialog: "Snapshot-Name?"
        | Gibt ein: "Initial Tasks"  | 30303 (komplettes Board) publiziert
09:45   | Bearbeite Spalten-Struktur | 30301 aktualisiert
10:00   | Klickt "Save Version"      | Dialog: "Snapshot-Name?"
        | Gibt ein: "After Cleanup"  | 30303 (neuer Snapshot) publiziert
10:15   | Bemerkt: "Das war falsch!" | Klickt "Snapshots" Dialog
        | Klickt "Restore" → "Initial Tasks" | Board zurückgesetzt zu 09:30
```

**User Experience:**
- ✅ Snapshots nur wenn User will
- ✅ Keine Auto-Prozesse, keine Overhead
- ✅ Einfach: Button drücken, beschreibung eingeben, done

---



## 🎯 Zusammenfassung

### Das System ist simpel

| Feature | Beschreibung | Implementierung |
|---------|--------------|-----------------|
| **30301** | Board-Meta (Spalten, Struktur) | Replaceable Event, kein Versioning |
| **30302** | Card-Inhalte | Replaceable Event, mit author-Tag |
| **30303** | Snapshots (manuell) | Non-replaceable, komplettes JSON, via Button |
| **Rollback** | Snapshot wiederherstellen | Ein-Klick, Snapshot-Dialog |
| **Multi-User** | Attribution via Pubkeys | author-Tags in 30302 + Snapshots |

### Vorteile

- ✅ **Extrem simpel:** Keine Auto-Logik, nur UI-Button
- ✅ **Benutzer-kontrolliert:** Snapshots nur wenn gewollen
- ✅ **Performant:** Keine Event-Flut (30304 raus!)
- ✅ **Dezentral:** Vollständige Snapshots = Nostr-native
- ✅ **Multi-User:** author-Tags für Attribution
- ✅ **Offline-first:** localStorage + Nostr sync

### Performance

**Pro Board pro Tag (normale Nutzung):**
- Board Events (30301): ~20 (Spalten-Changes)
- Card Events (30302): ~100 (Card-Edits)
- Snapshots (30303): ~5-10 (User-manuell)

**Total:** ~125-130 Events/Tag/Board ✅ (vs. ~200+ mit Auto-Versioning)

---

## 📋 Implementation Roadmap

### Phase 1: Foundation (Aktuell) ✅
- [x] Board State Management (BoardModel + Store)
- [x] localStorage Persistence
- [x] Nostr Integration (NDK)
- [ ] **Phase 1.5: Manual Snapshots**
  - [ ] 30303 Event Publishing
  - [ ] "Save Version" Button + Dialog
  - [ ] Snapshot Restore Flow
  - [ ] VersionHistory Component

### Phase 2: Multi-User Collaboration & Conflict Resolution
- [ ] Conflict Detection: Base-Version Check vor Publish
- [ ] Auto-Merge: 3-way Diff für kompatible Changes
- [ ] Manual Merge UI: MergeConflictDialog.svelte (Tabs für Konflikte)
- [ ] Soft Lock: Ephemeral Events (Kind 20001) für "Now Editing"
- [ ] author-Tag Flow (30302 Cards)
- [ ] Snapshot author-Tag
- [ ] User Attribution UI

### Phase 3+: Advanced Features (Future)
- [ ] Merge/Rebase Snapshots
- [ ] Branch Workflows
- [ ] Advanced History Visualization
- [ ] Compliance/Audit Reporting
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
- **Conflict Resolution**: NIP-22 (Channel Messages), Kind 20001 (Ephemeral Events)
- **ROADMAP**: `docs/COLLABORATION/ROADMAP.md`

---

**Status:** Complete (Snapshots + Merge-System definiert)  
**Architecture:** Two-Layer Snapshots + Git-like Merge  
**Next Steps:**
1. **Phase 1.5**: Implementiere "Save Version" Button + Snapshot Publishing
2. **Phase 2**: Conflict Detection + Auto-Merge + Manual Resolution UI
3. **Phase 2.5**: Ephemeral "Now Editing" Events für Soft Locks
