# 🚀 Quick Implementation Guide
**For Phase 1.2-1.5 Development** | **Fast Reference**

---

## 📍 TL;DR - Find What You Need

### 🧠 I'm a Project Manager
```
START → ROADMAP.md (See phases & timeline)
       → KONZEPT.md (Stakeholder overview)
```

### 👨‍💻 I'm a Frontend Developer
```
START → UX-RULES.md (Component patterns)
      → STORES.md Section XI (Export/Import UI)
      → AGENTS.md Section IX (shadcn-svelte compliance)
      → PROP-UPDATE-GUIDE.md (Dynamische UI-Änderungen!) ⭐
```

### 🔐 I'm Implementing Authentication
```
START → NOSTR-USER.md (NIP-07 Signer, Session)
      → STORES.md Section I.2 (AuthStore spec)
```

### ⚡ I'm Implementing Offline-First
```
START → STORES.md Section VI (SyncManager + Dexie)
      → README.md "Offline-First Funktionalität" (Examples)
      → Installation: pnpm install dexie @types/dexie
```

### 💾 I'm Implementing Export/Import
```
START → STORES.md Section III (generateShareLink API)
      → README.md "Export & Import" section
      → Installation: pnpm install jsoncrush
```

### 🔌 I'm Working with Nostr Events
```
START → AGENTS.md Section V.1 (Event Mapping)
      → Kanban-NIP.md (Kind 30301/30302/1)
      → NDK.md (Event Publishing)
```

---

## 🎯 Phase Implementation Roadmap

### Phase 1.1: Core (Specs Complete ✅)
```
IMPLEMENT: src/lib/classes/BoardModel.ts
REFERENCE: AGENTS.md Section III (Interfaces & Classes)
TYPES:     Card, Column, Board, Chat classes

IMPLEMENT: src/lib/stores/kanbanStore.ts  
REFERENCE: STORES.md Section I (BoardStore)
TYPES:     BoardStore with Svelte 5 Runes

IMPLEMENT: src/lib/utils/nostrEvents.ts
REFERENCE: AGENTS.md Section V.1 (Event Serialization)
FUNCTIONS: boardToNostrEvent(), cardToNostrEvent(), etc.

⭐ NEW: Dynamic UI Updates
REFERENCE: PROP-UPDATE-GUIDE.md (5-Step Implementation)
LEARN:     How to implement user-editable props with persistence
```

### Phase 1.2: Offline-First (Specs Complete ✅)
```
IMPLEMENT: src/lib/stores/syncManager.ts
REFERENCE: STORES.md Section VI (Complete spec with examples)
KEY CLASS: SyncManager with Dexie IndexedDB
INSTALL:   pnpm install dexie @types/dexie

KEY FEATURES:
  • Event Queue (Dexie)
  • Exponential Backoff (2^n seconds)
  • Dead-Letter Pattern (max 3 retries)
  • Online/Offline Detection
  • Stop-on-First-Error

EXAMPLE QUERY:
  const cardEvents = await db.queuedEvents
    .where('type').equals('card')
    .toArray();  // O(log n) performance!
```

### Phase 1.4: Authentication (Specs Complete ✅)
```
IMPLEMENT: src/lib/stores/authStore.ts
REFERENCE: NOSTR-USER.md (NIP-07 Signer)
           STORES.md Section I.2 (AuthStore spec)
KEY CLASS: AuthStore with user session

REQUIREMENTS:
  • NIP-07 Signer (window.nostr)
  • User public key (npub)
  • Session persistence
  • Refresh token logic
```

### Phase 1.5: Export/Import (Specs Complete ✅)
```
IMPLEMENT: src/lib/components/ExportImportDialog.svelte
REFERENCE: STORES.md Section XI (Full example code)
           README.md "Export & Import" (API reference)
INSTALL:   pnpm install jsoncrush

KEY METHODS:
  • generateShareLink() → jsoncrush-compressed token (71% smaller!)
  • importFromShareLink() → decompress & import with merge modes
  • Merge strategies: 'replace', 'merge', 'new'

SIZE COMPARISON:
  Original:  3.2 KB
  jsoncrush: 0.9 KB (-71% ✅)
```

---

## 💡 Code Snippets (Copy-Paste Ready)

### ✅ Dexie Setup (Phase 1.2)
```typescript
// src/lib/stores/syncManager.ts
import Dexie, { type Table } from 'dexie';

export interface QueuedEventRow {
  id?: number;
  event: string;              // Serialized NDKEvent
  timestamp: number;
  retries: number;            // 0-3
  type: 'board' | 'card' | 'comment';
}

export class KanbanQueueDB extends Dexie {
  queuedEvents!: Table<QueuedEventRow>;

  constructor() {
    super('KanbanQueue');
    this.version(1).stores({
      queuedEvents: '++id, type, retries, createdAt'
    });
  }
}

export const db = new KanbanQueueDB();
```

### ✅ Retry Logic (Phase 1.2)
```typescript
// Exponential Backoff: 2^retries * 1000ms
async syncQueue() {
  for (const queuedEvent of queue) {
    try {
      await this.publishEvent(queuedEvent);
      // Success → Remove from queue
      await db.queuedEvents.delete(queuedEvent.id);
    } catch (error) {
      queuedEvent.retries++;
      
      if (queuedEvent.retries >= 3) {
        // Dead-Letter: Remove after 3 attempts
        await db.queuedEvents.delete(queuedEvent.id);
      } else {
        // Wait before retry: 2^retries * 1000ms
        const waitTime = Math.pow(2, queuedEvent.retries) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        // Retry this event
      }
    }
  }
}
```

### ✅ Share-Link Generation (Phase 1.5)
```typescript
// From jsoncrush import
import { crush, uncrush } from 'jsoncrush';

async generateShareLink(): Promise<string> {
  // 1. Serialize board to JSON
  const boardJson = JSON.stringify(this.board.getContextData(true));
  
  // 2. Compress with jsoncrush (71% smaller!)
  const crushed = crush(boardJson);
  
  // 3. Convert to Base64-URL safe string
  const token = btoa(crushed)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // 4. Return URL-safe token
  return token;
  // Result: eyJiIjoiYm9hcmQtMTIzIiwibCI6IlByb2plY3QgUGhvZW5peCIsImMiOlt7ImkiOiJjb2wtMSI...
}

async importFromShareLink(
  token: string, 
  mode: 'replace' | 'merge' | 'new'
): Promise<{ success: boolean; board: Board }> {
  // 1. Decode Base64-URL token
  const padded = token + '='.repeat((4 - token.length % 4) % 4);
  const compressed = atob(padded
    .replace(/-/g, '+')
    .replace(/_/g, '/'));
  
  // 2. Decompress with jsoncrush
  const boardJson = uncrush(compressed);
  
  // 3. Parse and create Board
  const boardData = JSON.parse(boardJson);
  const importedBoard = new Board(boardData);
  
  // 4. Merge based on mode
  if (mode === 'merge') {
    return this.mergeBoards(this.board, importedBoard);
  } else if (mode === 'replace') {
    this.board = importedBoard;
  }
  
  return { success: true, board: this.board };
}
```

### ✅ BoardStore Integration (Phase 1.1)
```typescript
// src/lib/stores/kanbanStore.ts
import { Board, Chat } from '$lib/classes/BoardModel';
import { SyncManager } from './syncManager';

export class BoardStore {
  private board = $state(new Board({
    name: 'Kanban Board',
    columns: [
      { name: 'To Do' },
      { name: 'In Progress' },
      { name: 'Done' }
    ]
  }));
  
  private syncManager: SyncManager;
  private chat: Chat;

  constructor(ndk: NDK) {
    this.syncManager = new SyncManager(ndk);
    this.chat = new Chat(this.board);
  }

  // Proxy: Move card and sync to Nostr
  async moveCard(cardId: string, fromColId: string, toColId: string) {
    // 1. Local update (instant UI feedback)
    this.board.moveCard(cardId, fromColId, toColId);
    
    // 2. Publish to Nostr (or queue if offline)
    const result = this.board.findCardAndColumn(cardId);
    if (result) {
      const event = cardToNostrEvent(result.card, result.column.name, 0, '...', ndk);
      await this.syncManager.publishOrQueue(event, 'card');
    }
  }

  get syncStatus() {
    return this.syncManager.status;
  }

  async generateShareLink(): Promise<string> {
    return crush(JSON.stringify(this.board.getContextData(true)));
  }

  async importFromShareLink(token: string, mode: 'merge' | 'replace' | 'new') {
    const json = uncrush(atob(token));
    const boardData = JSON.parse(json);
    return this.mergeBoards(this.board, new Board(boardData));
  }
}
```

---

## 🔍 Quick Debugging Checklist

### Offline Mode Not Working?
```typescript
// Check SyncManager status
console.log(boardStore.syncStatus);
// Expected: { isOnline: false, queuedEvents: X, isSyncing: false }

// Check Dexie Queue
const queue = await db.queuedEvents.toArray();
console.log('Queued events:', queue);

// Check Dead-Letter events
const deadLetters = await db.queuedEvents.where('retries').equals(3).toArray();
console.log('Failed events:', deadLetters);
```

### Share-Link Too Large?
```typescript
const token = await boardStore.generateShareLink();
console.log(`Token size: ${token.length} chars`);
// Target: < 3,000 chars (URL-safe)
// If too large: Export fewer columns or cards
```

### Events Not Publishing?
```typescript
// Check NDK connection
console.log('NDK ready:', ndk.pool.relays().size);

// Check Auth status
const user = await ndk.signer?.user();
console.log('Authenticated as:', user?.pubkey);

// Check SyncManager retry logic
const stats = await syncManager.getRetryStats();
console.log('Retry stats:', stats);
// { total: 5, retrying: 2, failed: 1, pending: 2 }
```

---

## 📦 Installation Checklist

### Core Dependencies (Phase 1.1)
```bash
pnpm install
# Includes: svelte, typescript, @nostr-dev-kit/ndk, shadcn-svelte
```

### Offline-First (Phase 1.2)
```bash
pnpm install dexie @types/dexie
```

### Export/Import (Phase 1.5)
```bash
pnpm install jsoncrush
```

### All at Once
```bash
pnpm install dexie jsoncrush @types/dexie
```

---

## 🎨 Component Snippet: Export/Import Dialog

```svelte
<!-- src/lib/components/ExportImportDialog.svelte -->
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Button } from "$lib/components/ui/button";
  import { Textarea } from "$lib/components/ui/textarea";
  import { boardStore } from "$lib/stores/kanbanStore";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import DownloadIcon from "@lucide/svelte/icons/download";

  let open = $state(false);
  let shareToken = $state("");
  let importToken = $state("");

  async function exportBoard() {
    shareToken = await boardStore.generateShareLink();
  }

  async function importBoard() {
    if (!importToken.trim()) return;
    const result = await boardStore.importFromShareLink(importToken, 'merge');
    if (result.success) {
      console.log('✅ Board imported successfully');
      open = false;
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(shareToken);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[500px]">
    <Dialog.Header>
      <Dialog.Title>📤 Board teilen & importieren</Dialog.Title>
    </Dialog.Header>

    <Tabs.Root defaultValue="export">
      <!-- EXPORT TAB -->
      <Tabs.Content value="export" class="space-y-4">
        <Button onclick={exportBoard} class="w-full">
          <DownloadIcon class="mr-2 h-4 w-4" />
          Board als Link exportieren
        </Button>

        {#if shareToken}
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
              Teile diesen komprimierten Link ({shareToken.length} Zeichen):
            </p>
            <div class="flex gap-2">
              <code class="flex-1 p-2 bg-muted rounded text-xs overflow-auto">
                {shareToken.substring(0, 60)}...
              </code>
              <Button size="sm" onclick={copyToClipboard}>
                <CopyIcon class="h-4 w-4" />
              </Button>
            </div>
          </div>
        {/if}
      </Tabs.Content>

      <!-- IMPORT TAB -->
      <Tabs.Content value="import" class="space-y-4">
        <Textarea 
          placeholder="Paste export token here..."
          bind:value={importToken}
          rows={4}
        />
        <Button onclick={importBoard} class="w-full">
          📥 Board importieren
        </Button>
      </Tabs.Content>
    </Tabs.Root>
  </Dialog.Content>
</Dialog.Root>
```

---

## 📞 Finding the Right Documentation

| Question | Document | Section |
|----------|----------|---------|
| "How do I create a Board?" | AGENTS.md | III (Classes) |
| "How do offline updates work?" | STORES.md | VI (SyncManager) |
| "How do I export a board?" | STORES.md | III (Export/Import) |
| "How do I handle user auth?" | NOSTR-USER.md | Full doc |
| "What's the UI pattern?" | UX-RULES.md | Full doc |
| "How do Nostr events work?" | Kanban-NIP.md | Full doc |
| "What's the roadmap?" | ROADMAP.md | Phases 1-5 |
| "I need code examples" | README.md | Multiple sections |

---

## ✨ Final Checklist Before Coding

- ✅ Read the relevant documentation section
- ✅ Install required dependencies: `pnpm install ...`
- ✅ Check STORES.md for type signatures
- ✅ Check README.md for working examples
- ✅ Run test suite: `npm run test:unit`
- ✅ Verify Dexie schema (Phase 1.2+)
- ✅ Check UX-RULES.md for component patterns (Phase 1.1 UI)

---

**Ready to code? Pick a phase above and dive in! 🚀**
