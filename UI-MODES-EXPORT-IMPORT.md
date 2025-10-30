# 📤📥 Export/Import Architektur: Zwei Modi

**Version:** 1.0 (FINAL - nach Benutzer-Korrektionen)  
**Dokumentiert:** 30. Oktober 2025  
**Status:** ✅ APPROVED - Benutzer-korrekte Architektur  
**Gouvernanz:** DOCUMENTATION-RULES-v3.0 + AGENTS.md



---

## Übersicht: Zwei Export/Import Modi

| Aspekt | Modus 1: Direct File | Modus 2: Share Link |
|--------|----------------------|-------------------|
| **Phase** | 1.5D (SOFORT) | 1.5E (Später) |
| **Mechanismus** | Download/Upload JSON | URL-Parameter |
| **Kompr.** | Keine (3-5 KB) | jsoncrush (71% kleiner) |
| **Where: Export** | CardDialog (1A) + Settings (1B) | Button → Link Generator |
| **Where: Import** | Sidebar Popover | Auto-triggered via URL |

---

## MODUS 1: Direct File Export/Import (Phase 1.5D - SOFORT)

### 1.1 Single Board Export (CardDialog)

**Platzierung:** CardDialog Topbar (rechts)  
**Komponente:** ExportButton.svelte  
**Dateiname:** `{BoardName}_2025-10-30.json`

```svelte
<!-- src/lib/components/ExportButton.svelte -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import { boardStore } from "$lib/stores/kanbanStore.svelte";

  function downloadBoardAsJson() {
    const jsonString = boardStore.exportBoardAsJson(true);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${boardStore.board.name}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
</script>

<Button size="sm" variant="ghost" onclick={downloadBoardAsJson} title="Export Board">
  <DownloadIcon class="h-4 w-4" />
</Button>
```

**Integration:** `src/routes/cardsboard/CardViewDialog.svelte` → Topbar Header

---

### 1.2 Backup All Boards (Topbar → Settings)

**Platzierung:** Topbar Settings Menu  
**Komponente:** Settings Dropdown Item  
**Dateiname:** `boards-backup-2025-10-30.json`

```svelte
<!-- In Topbar Settings Dropdown -->
<DropdownMenu.Item onclick={backupAllBoards}>
  <DownloadIcon class="h-4 w-4 mr-2" />
  Backup All Boards
</DropdownMenu.Item>

<script>
  function backupAllBoards() {
    const jsonString = boardStore.exportAllBoardsAsJson();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `boards-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
</script>
```

**Integration:** `src/routes/cardsboard/Topbar.svelte` → Settings Menu

---

### 1.3 Import Popover (Left Sidebar)

**Platzierung:** BoardsList.svelte unter Board-Liste  
**Komponente:** ImportPopover.svelte  
**Modi:** merge (neue IDs), new (separates Board), overwrite (VORSICHT)

```svelte
<!-- src/lib/components/ImportPopover.svelte -->
<script lang="ts">
  import { Popover } from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import { boardStore } from "$lib/stores/kanbanStore.svelte";

  let open = $state(false);
  let importMode = $state('merge');
  let selectedFile: File | null = $state(null);
  let isLoading = $state(false);
  let errorMsg = $state('');

  function handleFileSelect(e) {
    selectedFile = e.target.files?.[0] || null;
    errorMsg = '';
  }

  async function confirmImport() {
    if (!selectedFile) {
      errorMsg = 'Datei auswählen';
      return;
    }

    isLoading = true;
    try {
      const jsonString = await selectedFile.text();
      const result = await boardStore.importBoardFromJson(jsonString, importMode);

      if (result.success) {
        boardStore.board = result.board!;
        boardStore.triggerUpdate();
        open = false;
      } else {
        errorMsg = result.error || 'Import failed';
      }
    } catch (error) {
      errorMsg = error.message;
    } finally {
      isLoading = false;
    }
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger asChild let:builder>
    <Button builders={[builder]} size="sm" variant="outline">
      <UploadIcon class="h-4 w-4 mr-2" />
      Import
    </Button>
  </Popover.Trigger>

  <Popover.Content class="w-80">
    <div class="space-y-3">
      <h4 class="font-semibold">📥 Import Board</h4>

      <input type="file" accept=".json" onchange={handleFileSelect} />

      <div class="space-y-2">
        <label class="text-sm font-medium">Mode:</label>
        <div class="space-y-1">
          <label class="flex items-center gap-2">
            <input type="radio" value="merge" bind:group={importMode} />
            � Merge (neue IDs)
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" value="new" bind:group={importMode} />
            ✨ New Board
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" value="overwrite" bind:group={importMode} />
            ⚠️ Overwrite
          </label>
        </div>
      </div>

      {#if errorMsg}
        <div class="p-2 bg-red-100 text-red-700 text-sm rounded">
          {errorMsg}
        </div>
      {/if}

      <Button onclick={confirmImport} disabled={!selectedFile || isLoading} class="w-full">
        {isLoading ? 'Importing...' : 'Import'}
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
```

**Integration:** `src/routes/cardsboard/BoardsList.svelte` → unter Board-Liste

---

## MODUS 2: Share Link (Phase 1.5E - Later)

**URL-Format:** `https://edufeed-org.github.io/kanban-editor/cardsboard?import=<jsoncrush>`

**Implementierung (später):**
```typescript
// Store-Methode (Phase 1.5E)
public generateShareLink(boardId: string): string {
  const board = this.findBoard(boardId);
  const json = JSON.stringify(board.getContextData(true));
  const compressed = compress(json); // jsoncrush
  return `https://.../cardsboard?import=${compressed}`;
}

// URL-Handler (+page.svelte)
$effect(() => {
  const token = $page.url.searchParams.get('import');
  if (token) {
    const json = decompress(token);
    showImportPopover(json);
    window.history.replaceState({}, '', '/cardsboard');
  }
});
```

---

## BoardStore API Implementierung

```typescript
// src/lib/stores/kanbanStore.svelte.ts

export class BoardStore {
  /**
   * Single Board Export mit Metadaten
   */
  public exportBoardAsJson(includeMetadata = true): string {
    const data = this.board.getContextData(true);
    
    if (includeMetadata) {
      return JSON.stringify({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'kanban-editor',
        board: data
      }, null, 2);
    }
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Alle Boards exportieren (Backup)
   */
  public exportAllBoardsAsJson(): string {
    const allBoards = this.boards.map(b => b.getContextData(true));
    
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      boardCount: allBoards.length,
      boards: allBoards
    }, null, 2);
  }

  /**
   * Board importieren
   * @param jsonString - JSON-String
   * @param mode - 'merge' (neue IDs), 'new' (separates), 'overwrite' (replace)
   */
  public async importBoardFromJson(
    jsonString: string,
    mode: 'merge' | 'new' | 'overwrite' = 'merge'
  ): Promise<{ success: boolean; board?: Board; error?: string }> {
    try {
      const importData = JSON.parse(jsonString);
      const boardData = importData.board || importData;

      if (!boardData.id || !boardData.name) {
        return { success: false, error: 'Invalid board structure' };
      }

      let newBoard: Board;

      if (mode === 'merge' || mode === 'new') {
        // Generiere neue IDs für alle
        newBoard = new Board({
          ...boardData,
          id: generateDTag(),
          name: mode === 'new' 
            ? `${boardData.name} (Imported)`
            : boardData.name
        });

        newBoard.columns = (boardData.columns || []).map(col => {
          const newCol = new Column({
            ...col,
            id: generateDTag()
          });
          newCol.cards = (col.cards || []).map(card =>
            new Card({ ...card, id: generateDTag() })
          );
          return newCol;
        });
      } else if (mode === 'overwrite') {
        newBoard = new Board(boardData);
      }

      return { success: true, board: newBoard };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

---

## Implementierungs-Checkliste (Phase 1.5D)

**Store APIs:**
- [ ] `exportBoardAsJson(includeMetadata?)`
- [ ] `exportAllBoardsAsJson()`
- [ ] `importBoardFromJson(jsonString, mode)`

**UI Komponenten:**
- [ ] ExportButton.svelte (CardDialog)
- [ ] ImportPopover.svelte (Sidebar)
- [ ] Topbar Export-All Option

**Integration:**
- [ ] CardViewDialog.svelte: Add ExportButton in Topbar
- [ ] Topbar.svelte: Add Backup-All to Settings
- [ ] BoardsList.svelte: Add ImportPopover

**Documentation & Tests:**
- [ ] Browser Console Tests
- [ ] ROADMAP.md aktualisieren (Phase 1.5D)
- [ ] CHANGELOG.md Entry
- [ ] TESTSUITE/STATUS.md aktualisieren

---

**Status:** ✅ GÜLTIG (nach Benutzer-Korrektionen)  
**Next:** Implementierung Phase 1.5D starten  
**Timeline:** 30.10. - 10.11.2025
