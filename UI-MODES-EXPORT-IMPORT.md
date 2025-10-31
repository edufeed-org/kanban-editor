# Import / Export von Boards
---

### Phase 1.5: Export/Import via Share-Link (Specs Complete ✅)
```
IMPLEMENT: src/lib/components/ExportImportDialog.svelte
REFERENCE: docs/ARCHITECTURE/STORES/BOARDSTORE.md
           docs\FEATURE\IMPORT-EXPORT.md
           src\lib\stores\kanbanStore.svelte.ts
           
INSTALL:   pnpm install jsoncrush (erledigt)

KEY METHODS:
  • generateShareLink() → jsoncrush-compressed token (71% smaller!)
  • importFromShareLink() → decompress & import with merge modes
  • Merge strategies: 'replace', 'merge', 'new'

SIZE COMPARISON:
  Original:  3.2 KB
  jsoncrush: 0.9 KB (-71% ✅)
```



**URL-Format:** `https://edufeed-org.github.io/kanban-editor/cardsboard?import=<jsoncrush>`

**Implementierung:**
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

---


**Store APIs:**
- [x] `importBoardFromJson(jsonString, mode)`
- [x] `exportBoardAsJson(includeMetadata?: boolean)`
- [ ] `importFromShareLink()` 
      → decompress & import with merge modes
      • Merge strategies: 'replace', 'merge', 'new'`


**UI Komponenten:**
- [ ] 🔗 SharelinkPopover.svelte (Sidebar)

**Integration:**
- [ ] ImportPopover.svelte (Sidebar) verwendbar für importFromShareLink?
---



**Documentation & Tests:**
- [ ] docs\FEATURE\IMPORT-EXPORT.md aktualisieren
- [ ] ROADMAP.md aktualisieren (Phase 1.5)
- [ ] CHANGELOG.md Entry
- [ ] src/lib/stores/kanbanStore.export-import.spec.ts (ergänzen)
- [ ] TESTS/STATUS.md aktualisieren

---

**Status:** ✅ GÜLTIG (nach Benutzer-Korrektionen)  
**Next:** Implementierung Phase 1.5D starten  
**Timeline:** 30.10. - 10.11.2025
