# 🔄 REFACTORING: Metadata-System eliminieren - Boards als Single Source of Truth

**Status:** ⏳ PLANNED  
**Priorität:** 🔴 HIGH  
**Erstellt:** 10. November 2025  
**Verantwortlich:** Separate Chat-Session  
**Abhängigkeiten:** Tasks 1-7 müssen abgeschlossen sein

---

## 📋 Problem-Beschreibung

### Aktuelle Architektur (Problematisch)

```
localStorage:
├── kanban-boards-metadata          // ⚠️ REDUNDANT - 95% duplicated data!
│   └── Array<{
│         id: string;               // ❌ DUPLICATE (in board)
│         name: string;             // ❌ DUPLICATE (in board)
│         description: string;      // ❌ DUPLICATE (in board)
│         lastAccessed: string;     // ✅ UNIQUE (only here)
│         author: string;           // ❌ DUPLICATE (in board)
│         publishState: string;     // ❌ DUPLICATE (in board)
│         hasUnseenChanges: boolean // ✅ UNIQUE (only here)
│       }>
│
├── kanban-{boardId}                // Full board data
│   └── {
│         id: string;
│         name: string;             // DUPLICATE!
│         description: string;      // DUPLICATE!
│         author: string;           // DUPLICATE!
│         publishState: string;     // DUPLICATE!
│         createdAt: string;
│         updatedAt: string;
│         columns: [...],
│         cards: [...]
│       }
└── (multiple boards)
```

### Redundanz-Analyse

**7 Felder** in `kanban-boards-metadata`:
- **5 Felder (71%)** sind in jedem Board dupliziert: `id`, `name`, `description`, `author`, `publishState`
- **2 Felder (29%)** sind unique: `lastAccessed`, `hasUnseenChanges`
- **Ergebnis:** 95% der Daten sind redundant!

### Probleme der aktuellen Architektur

1. **❌ Duplicate Entries** - Race Conditions führen zu Duplikaten im Array
2. **❌ Sync Issues** - Änderungen am Board werden nicht immer zu Metadata übertragen
3. **❌ Fragility** - Deleting metadata löscht ALLE Boards aus der Liste
4. **❌ No Auto-Discovery** - Boards von Nostr erscheinen nicht automatisch
5. **❌ Maintenance Burden** - Zwei Stellen müssen synchron gehalten werden
6. **❌ Complexity** - Mehr Code für Metadata-Management als nötig

### User-Testing Befunde

**Test 1: Board-Duplikate**
```
Symptom: Klick auf "Neues Board 3 test" → duplicate "Neues Board" erscheint
Root Cause: kanban-boards-metadata Array enthält Duplikate
Fix: Set-based deduplication (✅ Task 7)
```

**Test 2: Metadata-Deletion**
```
Symptom: User löscht kanban-boards-metadata → ALLE Boards verschwinden
Expected: Boards sollten aus localStorage Keys wiederhergestellt werden
Reality: loadBoardIds() liest NUR aus metadata, nicht aus Storage
Impact: Fragile Architektur - Ein gelöschter Key bricht gesamte App
```

---

## 🎯 Ziel der Refactoring

**Metadata komplett eliminieren und durch Board-eigene Felder ersetzen.**

### Neue Architektur (Ziel-Zustand)

```
localStorage:
├── kanban-{boardId}                // ✅ SINGLE SOURCE OF TRUTH
│   └── {
│         id: string;
│         name: string;
│         description: string;
│         author: string;
│         publishState: string;
│         createdAt: string;
│         updatedAt: string;
│         lastAccessedAt: string;     // ✅ NEW (moved from metadata)
│         hasUnseenChanges: boolean;  // ✅ NEW (moved from metadata)
│         columns: [...],
│         cards: [...]
│       }
└── (multiple boards)
```

**KEIN `kanban-boards-metadata` mehr!**

### Vorteile

✅ **Single Source of Truth** - Boards enthalten alle ihre eigenen Daten  
✅ **Keine Duplikate** - Sync-Probleme unmöglich  
✅ **Auto-Discovery** - Boards von Nostr erscheinen automatisch  
✅ **Robustheit** - Kein einzelner Key kann alles brechen  
✅ **Einfacherer Code** - Weniger Komplexität, weniger Fehlerquellen  
✅ **Bessere Performance** - Kein separates Metadata-Array zu pflegen  

### Risiken

⚠️ **Migration Complexity** - Alte Daten müssen sorgfältig übertragen werden  
⚠️ **Performance** - Header-Daten aus jedem Board laden (vs. ein Metadata-File)  
⚠️ **Backward Compatibility** - Bestehende User brauchen Migration  

---

## 🛠️ Implementierungs-Plan

### Phase 1: Board-Model erweitern

**Datei:** `src/lib/classes/BoardModel.ts`

```typescript
// ✅ SCHRITT 1: Neue Felder zur Board-Klasse hinzufügen

export interface BoardProps {
    // ... existing fields
    lastAccessedAt?: string;     // ✅ NEW: ISO 8601 timestamp
    hasUnseenChanges?: boolean;  // ✅ NEW: Nostr change indicator
}

export class Board {
    // ... existing properties
    public lastAccessedAt: string;
    public hasUnseenChanges: boolean;
    
    constructor(props: BoardProps) {
        // ... existing initialization
        this.lastAccessedAt = props.lastAccessedAt || new Date().toISOString();
        this.hasUnseenChanges = props.hasUnseenChanges ?? false;
    }
    
    // ✅ Update getContextData() to include new fields
    getContextData(full: boolean = false): any {
        return {
            // ... existing fields
            lastAccessedAt: this.lastAccessedAt,
            hasUnseenChanges: this.hasUnseenChanges,
        };
    }
    
    // ✅ NEW: Helper methods
    public updateLastAccessed(): void {
        this.lastAccessedAt = new Date().toISOString();
    }
    
    public markAsChanged(): void {
        this.hasUnseenChanges = true;
    }
    
    public clearChanges(): void {
        this.hasUnseenChanges = false;
    }
}
```

**Acceptance Criteria:**
- [ ] Board interface hat lastAccessedAt + hasUnseenChanges
- [ ] Constructor setzt Default-Werte
- [ ] getContextData() serialisiert neue Felder
- [ ] Helper-Methoden funktionieren

---

### Phase 2: Storage-Layer umschreiben

**Datei:** `src/lib/stores/boardstore/storage.ts`

#### Schritt 2.1: loadBoardIds() - Extract IDs from localStorage Keys

```typescript
// ❌ VORHER: Liest aus kanban-boards-metadata
public static loadBoardIds(): string[] {
    const metadataKey = 'kanban-boards-metadata';
    const stored = localStorage.getItem(metadataKey);
    if (stored) {
        const metadata = JSON.parse(stored);
        return metadata.map((m: any) => m.id);
    }
    return [];
}

// ✅ NACHHER: Extrahiert IDs aus localStorage Keys
public static loadBoardIds(): string[] {
    if (typeof window === 'undefined') return [];
    
    try {
        // Get all localStorage keys
        const allKeys = Object.keys(localStorage);
        
        // Filter for board keys: "kanban-{id}" but NOT "kanban-boards-metadata"
        const boardKeys = allKeys.filter(key => {
            return key.startsWith('kanban-') && 
                   !key.includes('-metadata') &&
                   !key.includes('-backup');
        });
        
        // Extract board IDs from keys
        const boardIds = boardKeys.map(key => key.replace('kanban-', ''));
        
        console.log(`📋 Board-IDs gefunden aus localStorage Keys: ${boardIds.length} Boards`);
        return boardIds;
        
    } catch (error) {
        console.warn('⚠️ Fehler beim Laden der Board-IDs:', error);
        return [];
    }
}
```

**Acceptance Criteria:**
- [ ] Findet alle Board-Keys automatisch
- [ ] Filtert metadata/backup Keys aus
- [ ] Funktioniert mit leeren localStorage
- [ ] Boards von Nostr werden erkannt

#### Schritt 2.2: getAllBoardsMetadata() - Load from Boards

```typescript
// ❌ VORHER: Liest aus kanban-boards-metadata
public static getAllBoardsMetadata(boardIds: string[]): Array<{
    id: string;
    name: string;
    // ... 5 weitere Felder
}> {
    const metadataKey = 'kanban-boards-metadata';
    const stored = localStorage.getItem(metadataKey);
    // ... komplexe Mapping-Logik
}

// ✅ NACHHER: Liest Header direkt aus jedem Board
public static getAllBoardsMetadata(boardIds: string[]): Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt?: number;
    lastAccessed?: number;
    hasUnseenChanges?: boolean;
    author?: string;
    publishState?: string;
}> {
    return boardIds.map(id => {
        try {
            const boardKey = `kanban-${id}`;
            const stored = localStorage.getItem(boardKey);
            
            if (!stored) {
                console.warn(`⚠️ Board ${id} nicht gefunden in localStorage`);
                return null;
            }
            
            const boardData = JSON.parse(stored);
            
            // Return LIGHTWEIGHT metadata (no columns/cards!)
            return {
                id: boardData.id,
                name: boardData.name,
                description: boardData.description,
                createdAt: this.parseTimestamp(boardData.createdAt),
                updatedAt: this.parseTimestamp(boardData.updatedAt),
                lastAccessed: this.parseTimestamp(boardData.lastAccessedAt), // ✅ From board!
                hasUnseenChanges: boardData.hasUnseenChanges ?? false,        // ✅ From board!
                author: boardData.author,
                publishState: boardData.publishState
            };
            
        } catch (error) {
            console.error(`❌ Fehler beim Laden von Board ${id}:`, error);
            return null;
        }
    }).filter(meta => meta !== null);
}
```

**Performance-Optimierung:**
- Nur Header-Daten laden (nicht Columns/Cards)
- JSON.parse nur bis zur ersten Ebene
- Caching möglich (falls Performance-Problem)

**Acceptance Criteria:**
- [ ] Lädt nur Header-Daten (nicht volle Boards)
- [ ] lastAccessed + hasUnseenChanges kommen aus Board
- [ ] Fehlerhafte Boards werden übersprungen
- [ ] Performance ist akzeptabel (<100ms für 20 Boards)

#### Schritt 2.3: saveBoard() - Include new fields

```typescript
public static saveBoard(board: Board): void {
    if (typeof window === 'undefined') return;
    
    const boardKey = `kanban-${board.id}`;
    const data = board.getContextData(true); // ✅ Includes lastAccessedAt + hasUnseenChanges
    
    localStorage.setItem(boardKey, JSON.stringify(data));
    console.log(`💾 Board gespeichert: ${board.name} (ID: ${board.id})`);
    
    // ⚠️ OLD CODE TO REMOVE: Don't update metadata anymore!
    // BoardOperations.addBoardToMetadataList({ ... });
}
```

**Acceptance Criteria:**
- [ ] Neue Felder werden gespeichert
- [ ] Kein Metadata-Update mehr
- [ ] Bestehende Boards werden nicht beschädigt

---

### Phase 3: Operations-Layer vereinfachen

**Datei:** `src/lib/stores/boardstore/operations.ts`

#### Schritt 3.1: Eliminiere addBoardToMetadataList()

```typescript
// ❌ DELETE THIS METHOD (Lines ~654-700):
private static addBoardToMetadataList(metadata: {
    id: string;
    name: string;
    description?: string;
    lastAccessed: string;
    author?: string;
    publishState: PublishState;
    hasUnseenChanges?: boolean;
}): void {
    // ... 50 Zeilen Code die gelöscht werden können!
}
```

**Alle Aufrufe entfernen:**
- `BoardOperations.addBoardToMetadataList()` hat ~8 Aufrufe
- Ersetze durch direktes `BoardStorage.saveBoard(board)`

**Acceptance Criteria:**
- [ ] Methode komplett gelöscht
- [ ] Alle Aufrufe entfernt
- [ ] Keine Build-Errors

#### Schritt 3.2: Eliminiere setHasUnseenChanges()

```typescript
// ❌ DELETE THIS METHOD (Lines ~715-737):
public static setHasUnseenChanges(boardId: string, value: boolean): void {
    // ... Metadata-Manipulation
}

// ❌ DELETE THIS METHOD (Lines ~737-749):
public static clearHasUnseenChanges(boardId: string): void {
    this.setHasUnseenChanges(boardId, false);
}
```

**Ersetze durch Board-Methoden:**
```typescript
// ✅ STATTDESSEN: Direkt am Board-Objekt
const board = BoardStorage.loadBoard(boardId);
board.markAsChanged();  // or board.clearChanges()
BoardStorage.saveBoard(board);
```

**Acceptance Criteria:**
- [ ] Methoden gelöscht
- [ ] Alle Aufrufe ersetzt durch Board-Methoden
- [ ] Tracking funktioniert weiterhin

#### Schritt 3.3: Update updateLastAccessed()

```typescript
// ❌ VORHER: Schreibt zu Metadata
public static updateLastAccessed(boardId: string): void {
    // ... Metadata update
}

// ✅ NACHHER: Schreibt zu Board
public static updateLastAccessed(boardId: string): void {
    const board = BoardStorage.loadBoard(boardId);
    if (!board) return;
    
    board.updateLastAccessed();
    BoardStorage.saveBoard(board);
    
    console.log(`🕒 Last accessed updated: ${board.name}`);
}
```

**Acceptance Criteria:**
- [ ] Schreibt zu Board statt Metadata
- [ ] Performance akzeptabel
- [ ] Funktioniert mit loadBoard()

---

### Phase 4: KanbanStore anpassen

**Datei:** `src/lib/stores/kanbanStore.svelte.ts`

#### Schritt 4.1: loadBoard() - Update Board fields

```typescript
public loadBoard(boardId: string): boolean {
    const board = BoardStorage.loadBoard(boardId);
    
    if (!board) {
        console.error(`❌ Board ${boardId} nicht gefunden`);
        return false;
    }
    
    this.board = board;
    this._columnOrder = board.columns.map(c => c.id);
    
    // ✅ Update lastAccessed + clear changes IN BOARD
    board.updateLastAccessed();
    board.clearChanges();
    BoardStorage.saveBoard(board); // Persist changes
    
    this.updateTrigger++;
    this.loadCardsFromNostr(board);
    
    console.log(`📂 Board geladen: ${board.name}`);
    return true;
}
```

**Acceptance Criteria:**
- [ ] Board wird direkt aktualisiert
- [ ] Keine Metadata-Calls mehr
- [ ] Persistierung funktioniert

#### Schritt 4.2: getAllBoards() - Use new structure

```typescript
public getAllBoards(): Array<{
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt?: number;
    lastAccessed?: number;      // ✅ From board.lastAccessedAt
    hasUnseenChanges?: boolean; // ✅ From board.hasUnseenChanges
}> {
    const boardIds = BoardStorage.loadBoardIds(); // ✅ From localStorage keys
    const metadata = BoardStorage.getAllBoardsMetadata(boardIds); // ✅ From boards
    
    return metadata.map(meta => ({
        id: meta.id,
        name: meta.name,
        description: meta.description,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        lastAccessed: meta.lastAccessed,      // ✅ Already correct!
        hasUnseenChanges: meta.hasUnseenChanges // ✅ Already correct!
    }));
}
```

**Acceptance Criteria:**
- [ ] Return type unverändert
- [ ] Daten kommen aus Boards
- [ ] Funktioniert mit filterBoards()

---

### Phase 5: Nostr-Handler anpassen

**Datei:** `src/lib/stores/boardstore/nostr.ts`

#### Schritt 5.1: handleBoardEvent() - Mark Board as changed

```typescript
// ❌ VORHER:
const { BoardOperations } = await import('./operations.js');
if (boardProps.id !== currentBoard.id) {
    BoardOperations.setHasUnseenChanges(boardProps.id, true);
}

// ✅ NACHHER:
const { BoardStorage } = await import('./storage.js');
if (boardProps.id !== currentBoard.id) {
    const board = BoardStorage.loadBoard(boardProps.id);
    if (board) {
        board.markAsChanged();
        BoardStorage.saveBoard(board);
    }
}
```

**Acceptance Criteria:**
- [ ] Boards werden als geändert markiert
- [ ] Kein Metadata-Update
- [ ] UI zeigt Badge

#### Schritt 5.2: handleCardEvent() - Same pattern

```typescript
// ❌ VORHER:
const { BoardOperations } = await import('./operations.js');
BoardOperations.setHasUnseenChanges(targetBoardId, true);

// ✅ NACHHER:
const board = BoardStorage.loadBoard(targetBoardId);
if (board) {
    board.markAsChanged();
    BoardStorage.saveBoard(board);
}
```

**Acceptance Criteria:**
- [ ] Card-Updates setzen Flag
- [ ] Funktioniert für Background-Boards
- [ ] Performance OK

---

### Phase 6: Migration & Cleanup

#### Schritt 6.1: Migration Script

**Datei:** `src/lib/stores/boardstore/migration.ts` (NEU)

```typescript
/**
 * Migriert alte Metadata-Struktur zu Board-Feldern
 * Wird EINMALIG beim ersten Load ausgeführt
 */
export class MetadataMigration {
    private static MIGRATION_FLAG = 'kanban-metadata-migrated';
    
    public static needsMigration(): boolean {
        return localStorage.getItem(this.MIGRATION_FLAG) !== 'true' &&
               localStorage.getItem('kanban-boards-metadata') !== null;
    }
    
    public static migrate(): void {
        console.log('🔄 Starting metadata migration...');
        
        try {
            // 1. Load old metadata
            const metadataKey = 'kanban-boards-metadata';
            const stored = localStorage.getItem(metadataKey);
            
            if (!stored) {
                console.log('✅ No metadata to migrate');
                this.markMigrated();
                return;
            }
            
            const metadata = JSON.parse(stored);
            console.log(`📋 Found ${metadata.length} boards in metadata`);
            
            // 2. Update each board
            let migrated = 0;
            let failed = 0;
            
            metadata.forEach((meta: any) => {
                try {
                    const boardKey = `kanban-${meta.id}`;
                    const boardStored = localStorage.getItem(boardKey);
                    
                    if (!boardStored) {
                        console.warn(`⚠️ Board ${meta.id} not found in storage`);
                        failed++;
                        return;
                    }
                    
                    const boardData = JSON.parse(boardStored);
                    
                    // 3. Add new fields from metadata
                    boardData.lastAccessedAt = meta.lastAccessed || boardData.updatedAt || boardData.createdAt;
                    boardData.hasUnseenChanges = meta.hasUnseenChanges ?? false;
                    
                    // 4. Save updated board
                    localStorage.setItem(boardKey, JSON.stringify(boardData));
                    migrated++;
                    
                } catch (error) {
                    console.error(`❌ Migration failed for board ${meta.id}:`, error);
                    failed++;
                }
            });
            
            console.log(`✅ Migration complete: ${migrated} boards migrated, ${failed} failed`);
            
            // 5. Backup old metadata (safety!)
            localStorage.setItem('kanban-boards-metadata-backup', stored);
            
            // 6. Remove old metadata
            localStorage.removeItem(metadataKey);
            console.log('🗑️ Old metadata removed (backup created)');
            
            // 7. Mark as migrated
            this.markMigrated();
            
        } catch (error) {
            console.error('❌ CRITICAL: Migration failed:', error);
            throw error;
        }
    }
    
    private static markMigrated(): void {
        localStorage.setItem(this.MIGRATION_FLAG, 'true');
    }
    
    public static cleanupBackup(): void {
        // Call this after confirming migration worked
        localStorage.removeItem('kanban-boards-metadata-backup');
        console.log('🧹 Backup removed');
    }
}
```

**Aufruf in kanbanStore Constructor:**
```typescript
constructor() {
    if (MetadataMigration.needsMigration()) {
        MetadataMigration.migrate();
    }
    // ... rest of initialization
}
```

**Acceptance Criteria:**
- [ ] Migration läuft automatisch beim ersten Load
- [ ] Backup wird erstellt
- [ ] Alte Metadata wird gelöscht
- [ ] Flag verhindert Duplikat-Migration

#### Schritt 6.2: Code Cleanup

**Zu löschen:**
1. ❌ `operations.ts`: `addBoardToMetadataList()` (~50 Zeilen)
2. ❌ `operations.ts`: `setHasUnseenChanges()` (~15 Zeilen)
3. ❌ `operations.ts`: `clearHasUnseenChanges()` (~5 Zeilen)
4. ❌ Alle Aufrufe dieser Methoden (~15+ Stellen)

**Zu behalten:**
- ✅ `updateLastAccessed()` (aber umschreiben zu Board)
- ✅ `deleteBoard()` (keine Änderung nötig)

**Acceptance Criteria:**
- [ ] Alle alten Metadata-Methoden gelöscht
- [ ] Build erfolgt ohne Errors
- [ ] Keine toten Code-Referenzen

---

## 🧪 Testing-Plan

### Unit Tests

**Datei:** `src/lib/stores/kanbanStore.spec.ts`

```typescript
describe('Metadata Refactoring', () => {
    
    test('loadBoardIds() findet Boards aus localStorage Keys', () => {
        localStorage.setItem('kanban-abc', JSON.stringify({...}));
        localStorage.setItem('kanban-def', JSON.stringify({...}));
        
        const ids = BoardStorage.loadBoardIds();
        expect(ids).toEqual(['abc', 'def']);
    });
    
    test('getAllBoardsMetadata() lädt aus Boards, nicht Metadata', () => {
        const metadata = BoardStorage.getAllBoardsMetadata(['abc']);
        expect(metadata[0].lastAccessed).toBeDefined();
        expect(metadata[0].hasUnseenChanges).toBeDefined();
    });
    
    test('Board.updateLastAccessed() aktualisiert Board', () => {
        const board = new Board({name: 'Test'});
        const before = board.lastAccessedAt;
        
        board.updateLastAccessed();
        
        expect(board.lastAccessedAt).not.toBe(before);
    });
    
    test('Board.markAsChanged() setzt Flag', () => {
        const board = new Board({name: 'Test'});
        expect(board.hasUnseenChanges).toBe(false);
        
        board.markAsChanged();
        
        expect(board.hasUnseenChanges).toBe(true);
    });
    
    test('Migration transferiert Daten korrekt', () => {
        // Setup old metadata
        localStorage.setItem('kanban-boards-metadata', JSON.stringify([
            {id: 'abc', lastAccessed: '2024-01-01', hasUnseenChanges: true}
        ]));
        localStorage.setItem('kanban-abc', JSON.stringify({
            id: 'abc', name: 'Test'
        }));
        
        MetadataMigration.migrate();
        
        const board = BoardStorage.loadBoard('abc');
        expect(board.lastAccessedAt).toBe('2024-01-01');
        expect(board.hasUnseenChanges).toBe(true);
        expect(localStorage.getItem('kanban-boards-metadata')).toBeNull();
    });
});
```

### Integration Tests

1. **Board-Erstellung**: Neues Board hat lastAccessedAt
2. **Board-Laden**: loadBoard() updated lastAccessedAt + cleared hasUnseenChanges
3. **Nostr-Update**: Board wird als geändert markiert
4. **Sortierung**: filterBoards() sortiert nach lastAccessedAt
5. **UI-Badge**: hasUnseenChanges zeigt Badge
6. **Migration**: Alte User-Daten werden korrekt übertragen

### Manuelle Tests

**Scenario 1: Frische Installation**
- [ ] Kein Metadata vorhanden
- [ ] Boards werden aus Nostr geladen
- [ ] Board-Liste wird korrekt angezeigt

**Scenario 2: Migration von Alt zu Neu**
- [ ] User hat alte Metadata-Struktur
- [ ] Migration läuft automatisch
- [ ] Alle Boards sind sichtbar
- [ ] lastAccessed + hasUnseenChanges funktionieren

**Scenario 3: Nostr-Sync**
- [ ] Board wird auf anderem Device geändert
- [ ] hasUnseenChanges wird gesetzt
- [ ] Badge wird angezeigt
- [ ] Load Board cleared Badge

**Scenario 4: Performance**
- [ ] 50+ Boards im localStorage
- [ ] Board-Liste lädt in <1 Sekunde
- [ ] Keine UI-Freezes

---

## 📁 Betroffene Dateien

### Zu ändern (6 Files)

1. **src/lib/classes/BoardModel.ts**
   - Neue Felder: `lastAccessedAt`, `hasUnseenChanges`
   - Helper-Methoden: `updateLastAccessed()`, `markAsChanged()`, `clearChanges()`
   - `getContextData()` erweitern

2. **src/lib/stores/boardstore/storage.ts**
   - `loadBoardIds()`: Rewrite (localStorage Keys)
   - `getAllBoardsMetadata()`: Rewrite (load from Boards)
   - `saveBoard()`: Kein Metadata-Update mehr

3. **src/lib/stores/boardstore/operations.ts**
   - DELETE: `addBoardToMetadataList()`
   - DELETE: `setHasUnseenChanges()`
   - DELETE: `clearHasUnseenChanges()`
   - UPDATE: `updateLastAccessed()`

4. **src/lib/stores/kanbanStore.svelte.ts**
   - `loadBoard()`: Update Board direkt
   - `getAllBoards()`: Unverändert (Daten kommen aus Boards)

5. **src/lib/stores/boardstore/nostr.ts**
   - `handleBoardEvent()`: Nutze `board.markAsChanged()`
   - `handleCardEvent()`: Nutze `board.markAsChanged()`

6. **src/lib/stores/boardstore/migration.ts** (NEU)
   - Migration Script
   - Backup-Logik
   - Cleanup-Funktion

### Zu testen (2 Files)

7. **src/lib/stores/kanbanStore.spec.ts**
   - Unit Tests für neue Logik
   - Migration Tests

8. **src/routes/cardsboard/BoardsList.svelte**
   - Manuelle UI-Tests

### Zu dokumentieren (2 Files)

9. **docs/CHANGELOG.md**
   - Breaking Change Notification
   - Migration Guide

10. **docs/ARCHITECTURE/STORES/BOARDSTORE.md**
    - Neue Architektur beschreiben
    - Removed Methods dokumentieren

---

## 📅 Timeline & Aufwand-Schätzung

| Phase | Aufgabe | Aufwand | Verantwortlich |
|-------|---------|---------|----------------|
| 1 | Board-Model erweitern | 1-2h | Dev |
| 2 | Storage-Layer umschreiben | 2-3h | Dev |
| 3 | Operations-Layer vereinfachen | 1-2h | Dev |
| 4 | KanbanStore anpassen | 1h | Dev |
| 5 | Nostr-Handler anpassen | 1h | Dev |
| 6 | Migration Script | 2-3h | Dev |
| 7 | Testing | 2-3h | Dev + QA |
| 8 | Documentation | 1h | Dev |
| **TOTAL** | | **11-17h** | **~2-3 Tage** |

---

## ✅ Definition of Done

- [ ] **Code Complete**
  - [ ] Alle 6 Dateien geändert
  - [ ] Migration Script funktioniert
  - [ ] Build erfolgt ohne Errors
  - [ ] Keine Compiler-Warnings

- [ ] **Tests Pass**
  - [ ] Alle Unit Tests grün
  - [ ] Integration Tests grün
  - [ ] Manuelle Tests bestanden
  - [ ] Performance akzeptabel

- [ ] **Migration Verified**
  - [ ] Alte User-Daten werden übertragen
  - [ ] Keine Daten verloren
  - [ ] Backup erstellt
  - [ ] Cleanup funktioniert

- [ ] **Documentation Updated**
  - [ ] CHANGELOG.md aktualisiert
  - [ ] ARCHITECTURE docs aktualisiert
  - [ ] Migration Guide geschrieben
  - [ ] Code-Kommentare vollständig

- [ ] **User Acceptance**
  - [ ] Board-Liste funktioniert
  - [ ] Sortierung korrekt
  - [ ] Badges funktionieren
  - [ ] Keine Regressions

---

## 🔗 Referenzen

### Verwandte Dokumente

- **Tasks 1-7**: Basis-Implementation (bereits erledigt)
- **docs/ARCHITECTURE/STORES/BOARDSTORE.md**: Aktuelle Architektur
- **docs/TO-FIX/TODO.md**: Todo-Liste mit Tasks 1-9
- **docs/COLLABORATION/ROADMAP.md**: Projekt-Roadmap

### Verwandte Issues

- Bug: Board-Duplikate (✅ Fixed in Task 7)
- Issue: Metadata-Deletion bricht App (🔄 This Refactoring fixes it)

### Code-Referenzen

- `src/lib/classes/BoardModel.ts` - Lines 1-500
- `src/lib/stores/boardstore/storage.ts` - Lines 30-60, 300-380
- `src/lib/stores/boardstore/operations.ts` - Lines 654-749

---

## 📞 Support & Fragen

**Bei Fragen:**
1. Lies diese Dokumentation vollständig
2. Checke verwandte Dokumente
3. Prüfe bestehende Tests
4. Öffne neue Chat-Session mit diesem Dokument als Kontext

**Wichtige Hinweise:**
- ⚠️ Backup erstellen BEVOR Migration läuft
- ⚠️ Tests MÜSSEN grün sein vor Merge
- ⚠️ Performance MUSS gemessen werden (50+ Boards)
- ⚠️ User-Kommunikation bei Breaking Changes

---

**Erstellt:** 10. November 2025  
**Letzte Änderung:** 10. November 2025  
**Status:** ⏳ READY FOR IMPLEMENTATION
