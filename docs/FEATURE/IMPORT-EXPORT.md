# Feature: Import & Export (Phase 1.5D)

Kurzbeschreibung
----------------
Dieses Feature ermöglicht das Exportieren einzelner Boards oder aller Boards (Backup) als JSON-Dateien sowie das Importieren von Boards in drei Modi (merge, new, overwrite). Ziel ist ein einfacher, offline-fähiger Datentransfer (Download/Upload) und eine sichere Import-Validierung.

Kernfunktionen (Store APIs)
---------------------------
- exportBoardAsJson(includeMetadata?: boolean): string
  - Exportiert ein einzelnes Board. Optionaler Metadaten-Wrapper (version, exportedAt, exportedBy).

- exportAllBoardsAsJson(): string
  - Exportiert alle Boards in einem Backup-JSON mit `boards`-Array und Metadaten.

- importBoardFromJson(jsonString, mode: 'merge'|'new'|'overwrite') => { success, board?, error? }
  - Validiert Struktur, unterstützt drei Modi:
    - merge: neue IDs generieren (Konfliktfrei)
    - new: wie merge, Name mit "(Imported)" Suffix
    - overwrite: existierendes Board durch den Inhalt ersetzen

- saveImportedBoard(board, overwriteExisting?: boolean) => string
  - Persistiert das importierte Board in localStorage und registriert die Board-ID.

Export-Format (Kurz)
--------------------
Single-Export (mit Metadaten):
```json
{
  "version":"1.0",
  "exportedAt":"2025-10-31",
  "exportedBy":"kanban-editor",
  "board": { /* Board.getContextData(true) */ }
}
```
Backup-Export:
```json
{
  "version":"1.0",
  "exportedAt":"...",
  "boardCount": 3,
  "boards": [ /* array of boards */ ]
}
```

UI-Integration
--------------
- `ExportButton.svelte` (CardDialog Topbar)
  - ruft `boardStore.exportBoardAsJson(true)` und startet Datei-Download {BoardName}_{date}.json

- `Topbar` Settings → "Backup All Boards"
  - ruft `boardStore.exportAllBoardsAsJson()` und startet Download `boards-backup-{date}.json`

- `ImportPopover.svelte` (Left Sidebar / BoardsList)
  - File input (accept=".json"), Mode-Radio (merge | new | overwrite)
  - Auto-Detect: erkennt Backup vs Single (prüft `boards`-Array)
  - Führt für Backups `restoreAllBoardsFromBackup()` aus bzw. für Single-Import `importBoardFromJson()` und `saveImportedBoard()`

Tests & Qualität
----------------
- Unit Tests (Vitest):
  - `src/lib/stores/kanbanStore.export-import.spec.ts` — 28 Tests (Backup detection, export, import modes, batch restore, round-trip, edge cases)
  - `src/lib/components/ImportPopover.svelte.spec.ts` — 47 Tests (File selection, UI logic, help text, accessibility)
- Status: Alle Tests passing (Stand: 31.10.2025).

Sicherheits- und Edge-Case-Behandlung
------------------------------------
- Validierung vor Import: id + name Pflicht
- Fehlerbehandlung: klare Error-Messages bei Invalid JSON, fehlenden Feldern, Unknown Mode
- ID-Regenerierung (generateDTag) im `merge`/`new` Modus, um ID-Konflikte zu vermeiden

Akzeptanzkriterien
------------------
- Export erzeugt gültiges JSON, öffnet nicht den Editor und lädt Datei herunter
- Backup enthält korrekte Anzahl an Boards
- Import in jedem Modus führt zu erwartetem Ergebnis (neue IDs oder Überschreiben)
- UI zeigt eindeutige Success / Error Meldungen
- Unit Tests für alle Kernpfade sind grün

Bekannte nächste Schritte (Kurz)
-------------------------------
- Integration: Einbau `ExportButton` in `CardDetailsDialog.svelte` (Topbar)
- Integration: Topbar → Backup All Menu Item
- Integration: BoardsList → `ImportPopover`
- Phase 1.5E: Share-Link Modus (jsoncrush Kompression + `?import=` URL)

Referenzen
----------
- IMPLEMENTATION-LOG-PHASE-1-5D.md
- INTEGRATION-CHECKLIST-PHASE-1-5D.md
- UI-MODES-EXPORT-IMPORT.md
- Tests: `src/lib/stores/kanbanStore.export-import.spec.ts`, `src/lib/components/ImportPopover.svelte.spec.ts`

Datum / Autor
-------------
31.10.2025 — automatisches Feature-Doc (aus Implementations-Log & Checklisten)
