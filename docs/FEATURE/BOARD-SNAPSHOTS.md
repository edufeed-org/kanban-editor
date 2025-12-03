# Board Versioning / Snapshots Feature

**Status:** ✅ Vollständig Implementiert (Phase 1.5C)  
**Erstellt:** 28. Dezember 2024  
**Aktualisiert:** 3. Dezember 2025  
**Basiert auf:** `docs/PROPOSALS/BOARD-VERSIONING.md`

---

## 📋 Übersicht

Das Board Versioning Feature ermöglicht es Benutzern, **manuelle Snapshots** ihrer Kanban-Boards zu erstellen und bei Bedarf zu früheren Versionen zurückzukehren. Snapshots werden als **Kind 30303 Nostr Events** gespeichert (non-replaceable).

---

## ✨ Features

### 1. Manuelles Speichern von Versionen
- Button "Versionen" in der Topbar öffnet den VersionHistory-Dialog
- User kann ein Label/eine Beschreibung eingeben (z.B. "Vor großem Umbau")
- Snapshot wird als Kind 30303 Event auf Nostr Relays veröffentlicht

### 2. Versionshistorie anzeigen
- Liste aller gespeicherten Snapshots sortiert nach Datum (neueste zuerst)
- Anzeige von:
  - Label/Beschreibung
  - Zeitstempel (relativ und absolut)
  - Anzahl der Spalten und Karten
  - Erstellungsgrund (manuell, automatisch, vor Import, Backup)

### 3. Wiederherstellen einer Version
- "Wiederherstellen" Button pro Snapshot
- Bestätigungs-Dialog mit Warnung
- **Automatisches Backup** des aktuellen Zustands vor der Wiederherstellung
- Board wird vollständig auf den Snapshot-Zustand zurückgesetzt

---

## 🏗️ Technische Architektur

### Event-Struktur (Kind 30303)

```javascript
{
    kind: 30303,  // Non-replaceable - jeder Snapshot ist permanent
    tags: [
        ["a", "30301:<author>:<board-id>"],  // Referenz zum Board
        ["v", "User-Label"],                   // Benutzer-Beschreibung
        ["r", "manual"],                       // Grund (manual|auto_save|before_import|before_restore)
        ["t", "1735392000"]                    // Unix-Timestamp
    ],
    content: "{...komplettes Board-JSON...}"  // Board.getContextData(true)
}
```

### Komponenten-Übersicht

```
src/
├── lib/
│   ├── stores/
│   │   ├── kanbanStore.svelte.ts          ← Snapshot-Methoden hinzugefügt
│   │   │   ├── createManualSnapshot()
│   │   │   ├── loadSnapshots()
│   │   │   ├── rollbackToSnapshot()
│   │   │   └── createAutoSnapshot()
│   │   │
│   │   └── boardstore/
│   │       └── nostr.ts                   ← NostrIntegration erweitert
│   │           ├── publishSnapshot()
│   │           ├── loadSnapshots()
│   │           ├── fetchSnapshotByLabel()
│   │           └── fetchSnapshotById()
│   │
│   ├── components/
│   │   └── board/
│   │       ├── index.ts                   ← Export hinzugefügt
│   │       └── VersionHistory.svelte      ← NEU: Dialog-Komponente
│   │
│   └── utils/
│       └── nostrEvents.ts                 ← EVENT_KINDS.SNAPSHOT (30303)
│
└── routes/
    └── cardsboard/
        ├── Topbar.svelte                  ← VersionHistory importiert
        └── types.ts                       ← Snapshot-Typen definiert
```

---

## 📖 API-Referenz

### BoardStore Methoden

#### `createManualSnapshot(label: string): Promise<boolean>`
Erstellt einen manuellen Snapshot des aktuellen Board-Zustands.

```typescript
await boardStore.createManualSnapshot('Vor großem Umbau');
```

#### `loadSnapshots(): Promise<BoardSnapshot[]>`
Lädt alle Snapshots für das aktuelle Board von Nostr Relays.

```typescript
const snapshots = await boardStore.loadSnapshots();
// Returns: Array<{ id, label, timestamp, reason, cardCount, columnCount, createdBy, boardData }>
```

#### `rollbackToSnapshot(snapshotId: string): Promise<boolean>`
Stellt das Board auf einen früheren Snapshot wieder her.

```typescript
// Erstellt automatisch ein Backup vor der Wiederherstellung!
await boardStore.rollbackToSnapshot('snapshot-event-id');
```

#### `createAutoSnapshot(reason: 'before_import' | 'auto_save'): Promise<boolean>`
Erstellt einen automatischen Snapshot (z.B. vor Import-Operationen).

```typescript
await boardStore.createAutoSnapshot('before_import');
```

---

## 🎨 UI-Komponente

### VersionHistory.svelte

Die Komponente besteht aus:

1. **Trigger-Button** (in Topbar)
   - Icon: History
   - Label: "Versionen"

2. **Dialog**
   - Header: "Versionshistorie"
   - Input für neues Snapshot-Label
   - "Speichern" Button

3. **Snapshot-Liste**
   - Karten pro Snapshot mit:
     - Label (fett)
     - Badge für Grund (Manuell, Auto, Backup, Vor Import)
     - Metadaten (Datum, Spalten, Karten, Ersteller)
     - "Wiederherstellen" Button
   - Bestätigungs-Dialog für Wiederherstellung

---

## 📝 Verwendungsbeispiele

### Beispiel 1: Vor größeren Änderungen sichern

```typescript
// Im Code (z.B. vor Import)
await boardStore.createManualSnapshot('Backup vor großem Import');

// Dann Import durchführen...
await boardStore.importBoardFromJson(jsonData, 'merge');
```

### Beispiel 2: Snapshot per UI erstellen

1. Klicke auf "Versionen" in der Topbar
2. Gib ein Label ein (z.B. "Version 1.0 - Fertig für Review")
3. Klicke "Speichern"
4. Toast zeigt Bestätigung

### Beispiel 3: Zu einem früheren Stand zurückkehren

1. Klicke auf "Versionen" in der Topbar
2. Finde den gewünschten Snapshot in der Liste
3. Klicke "Wiederherstellen"
4. Bestätige die Warnung
5. Board wird zurückgesetzt, Toast zeigt Bestätigung

---

## 🔐 Sicherheit & Datenschutz

- Snapshots werden auf denselben Relays gespeichert wie das Board
- Die publishState des Boards (draft/published/archived) wird für Relay-Auswahl verwendet
- Automatische Backups vor Wiederherstellung verhindern Datenverlust
- Snapshot-Content ist das komplette Board-JSON (inkl. aller Karten und Metadaten)

---

## 🚀 Zukünftige Erweiterungen (Phase 2+)

- [ ] Auto-Save Snapshots bei bestimmten Trigger-Events
- [ ] Snapshot-Diff Ansicht (was hat sich geändert?)
- [ ] Snapshot-Suche nach Label
- [ ] Export einzelner Snapshots als JSON
- [ ] Benachrichtigungen bei Snapshot-Erstellung durch andere Maintainer

---

## 📚 Verwandte Dokumentation

- [Board Versioning Proposal](./PROPOSALS/BOARD-VERSIONING.md) - Ursprünglicher Design-Vorschlag
- [Export/Import Feature](./FEATURE/IMPORT-EXPORT.md) - Board-Export/Import
- [Merge System](./FEATURE/MERGE-SYSTEM.md) - Konfliktauflösung
- [ROADMAP](./COLLABORATION/ROADMAP.md) - Projekt-Roadmap

---

**Implementiert am:** 28. Dezember 2024  
**Getestet mit:** svelte-check (0 Fehler)  
**Basiert auf:** Phase 1.5 BOARD-VERSIONING.md Proposal
