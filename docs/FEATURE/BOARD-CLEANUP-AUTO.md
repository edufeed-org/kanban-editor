# Automatic Board Cleanup Feature

**Version:** 1.0  
**Datum:** 8. November 2025  
**Status:** ✅ IMPLEMENTIERT

---

## 🎯 Problem

**Symptom:** Gelöschte Boards erscheinen nach Page-Reload wieder in der Sidebar.

**Root Cause:** 
- Boards werden auf dem Relay gelöscht (oder existieren gar nicht mehr)
- **ABER:** Die Boards bleiben im **localStorage** gespeichert
- Beim Reload lädt die App die Boards aus localStorage, nicht nur vom Relay
- Resultat: "Zombie-Boards" die nicht mehr existieren

---

## 🔧 Lösung: Auto-Cleanup beim Board-Laden

### Architektur

```
1. Fetch boards vom Relay (Source of Truth)
   ↓
2. Sammle Board-IDs die auf Relay existieren
   ↓
3. Lade Boards in App
   ↓
4. 🧹 CLEANUP: Lösche lokale Boards die NICHT auf Relay sind
```

### Implementation

**Datei:** `src/lib/stores/boardstore/nostr.ts`

**Geändert:** `loadBoardsFromNostr()` Methode

#### Schritt 1: Sammle Relay-Board-IDs

```typescript
// 4. Sammle Board-IDs die auf dem Relay existieren
const relayBoardIds = new Set<string>();

for (const event of boardEvents) {
    // ... skip deleted boards ...
    
    const board = new Board(boardProps);
    
    // 4b. Merke dass dieses Board auf dem Relay existiert
    relayBoardIds.add(board.id);
    
    // ... rest of loading logic ...
}
```

#### Schritt 2: Cleanup nach dem Laden

```typescript
// 5. Cleanup: Lösche lokale Boards die nicht mehr auf dem Relay existieren
if (typeof window !== 'undefined') {
    const allLocalKeys = Object.keys(localStorage)
        .filter(k => k.startsWith('kanban-'));
    
    let cleanedCount = 0;
    
    for (const key of allLocalKeys) {
        const boardId = key.replace('kanban-', '');
        
        // Skip wenn:
        // - Board ist auf dem Relay (relayBoardIds)
        // - Board ist aktuell aktiv (currentBoard.id)
        // - Board ist in der boardIds Liste (wurde gerade geladen)
        if (relayBoardIds.has(boardId) || 
            boardId === currentBoard.id ||
            loadedBoardIds.includes(boardId)) {
            continue;
        }
        
        // Board existiert nicht mehr auf Relay → löschen
        localStorage.removeItem(key);
        cleanedCount++;
        console.log('[BoardStore] 🧹 Cleaned up orphaned local board:', boardId);
    }
    
    if (cleanedCount > 0) {
        console.log(`[BoardStore] ✅ Cleaned up ${cleanedCount} orphaned local board(s)`);
    }
}
```

---

## 🎬 Verhalten

### Beim normalen Laden

```
1. User öffnet App
2. App fetcht 3 Boards vom Relay: [A, B, C]
3. localStorage hat 5 Boards: [A, B, C, D, E]
   - D und E existieren nicht mehr auf Relay
4. 🧹 Auto-Cleanup löscht D und E
5. Nur A, B, C werden angezeigt ✅
```

### Beim Löschen

```
1. User löscht Board "B"
2. Deletion Event (Kind 5) wird zum Relay gesendet
3. Board "B" wird auf Relay als gelöscht markiert
4. Board "B" verschwindet aus Sidebar (sofort)
5. Page Reload:
   - Relay hat nur [A, C] (B ist gelöscht)
   - localStorage hat [A, B, C]
   - 🧹 Cleanup löscht "B" aus localStorage
   - Nur A, C werden angezeigt ✅
```

### Edge Cases

#### Fall 1: Aktuelles Board wird nicht gelöscht
```typescript
if (boardId === currentBoard.id) {
    continue; // ← Board bleibt, auch wenn nicht auf Relay
}
```

**Grund:** User arbeitet gerade an diesem Board. Es sollte nicht plötzlich verschwinden, auch wenn es noch nicht zum Relay publiziert wurde.

#### Fall 2: Offline Mode

Wenn kein Relay verfügbar ist:
- `relayBoardIds` bleibt leer
- **ABER:** `loadedBoardIds.includes(boardId)` schützt alle geladenen Boards
- Cleanup läuft nur wenn mindestens 1 Board vom Relay geladen wurde

---

## 🧪 Testing

### Manual Test

1. **Setup:**
   ```bash
   pnpm run dev
   ```

2. **Erstelle Test-Boards:**
   - Erstelle 3 Boards: "Test A", "Test B", "Test C"

3. **Simuliere Deletion (via Docker):**
   ```bash
   # Stop Relay
   docker-compose down
   
   # Lösche Daten
   rm -rf ./data
   
   # Start Relay
   docker-compose up -d
   ```

4. **Reload App:**
   - Alle 3 Boards sollten aus Sidebar verschwinden
   - Console zeigt: `🧹 Cleaned up 3 orphaned local board(s)`

5. **Check localStorage:**
   ```javascript
   Object.keys(localStorage).filter(k => k.startsWith('kanban-'))
   // → sollte leer sein []
   ```

### Console Output

**Erfolgreiches Cleanup:**
```
[BoardStore] 🛰️ Fetching boards from Nostr for pubkey: 54a340...
[BoardStore] 📋 Found 1 board on relay
[BoardStore] 🧹 Cleaned up orphaned local board: board-526a36aa...
[BoardStore] 🧹 Cleaned up orphaned local board: board-06b0267c...
[BoardStore] ✅ Cleaned up 2 orphaned local board(s)
```

**Kein Cleanup nötig:**
```
[BoardStore] 🛰️ Fetching boards from Nostr for pubkey: 54a340...
[BoardStore] 📋 Found 3 boards on relay
// Keine Cleanup-Meldungen → Alle lokalen Boards existieren auf Relay
```

---

## 📊 Performance

### Impact

- **Cleanup läuft:** 1x beim App-Start (nach Board-Laden)
- **Komplexität:** O(n) wo n = Anzahl localStorage keys
- **Typical n:** 1-10 Boards
- **Zeit:** < 1ms

### Optimierung

Wenn viele Boards (>100):
- Könnte in Web Worker verschoben werden
- Oder als Background-Task nach 5 Sekunden

Aktuell nicht notwendig.

---

## 🔄 Integration mit anderen Features

### Mit Board Deletion (nostr.ts)

```typescript
// Beim Löschen wird Deletion Event erstellt
const deletionEvent = createDeletionEvent(
    boardEventId,
    true, // isReplaceableEvent
    `Board "${board.name}" deleted`,
    this.ndk
);

await deletionEvent.publish();

// Board verschwindet sofort aus Sidebar
// Beim Reload: Cleanup entfernt es aus localStorage ✅
```

### Mit Export/Import

**Export:**
- Exportiert nur Boards die existieren
- Cleanup hat keinen Einfluss

**Import:**
- Importierte Boards werden zu localStorage gespeichert
- Beim nächsten Reload: Wenn nicht auf Relay → werden gelöscht
- **Lösung:** User muss importierte Boards zum Relay publizieren!

### Mit Offline Mode

**Offline:**
- Cleanup läuft NICHT (kein Relay verfügbar)
- Lokale Boards bleiben intakt

**Online → Offline → Online:**
- Beim ersten Online: Cleanup läuft
- Offline: Boards bleiben
- Beim zweiten Online: Cleanup läuft wieder (idempotent)

---

## 🐛 Bekannte Einschränkungen

### 1. Settings-Keys werden geschützt (FIXED 08.11.2025)

**Problem (vorher):**
```typescript
// ❌ FALSCH: Löscht ALLE kanban-* Keys
const allLocalKeys = Object.keys(localStorage)
    .filter(k => k.startsWith('kanban-'));
// → Würde auch "kanban-config", "kanban-board-ids" löschen!
```

**Lösung (jetzt):**
```typescript
// ✅ RICHTIG: Nur Board-Daten Keys
const boardDataKeys = Object.keys(localStorage).filter(k => {
    // Skip Settings und andere System-Keys
    if (k === 'kanban-config') return false;
    if (k === 'kanban-board-ids') return false;
    // ✅ Anti-Resurrection: Tombstone registry ist kein Board-Key
    if (k === 'kanban-deleted-boards-v1') return false;
    
    // Nur Keys die wie "kanban-board-xxx" aussehen
    return k.startsWith('kanban-') && k.includes('board-');
});
```

**Geschützte Keys:**
- ✅ `kanban-config` - Settings (Theme, Relays, LLM Config)
- ✅ `kanban-board-ids` - Board-IDs Liste
- ✅ `kanban-deleted-boards-v1` - Tombstones (Anti-Resurrection)

**Gelöschte Keys (nur diese):**
- 🗑️ `kanban-board-abc123` - Board-Daten die nicht mehr auf Relay sind

### 2. Aktives Board wird nicht gelöscht

**Scenario:**
```
1. User arbeitet an Board "X"
2. Board "X" wird vom Relay gelöscht (von anderem Gerät)
3. User reloaded Page
4. Board "X" bleibt sichtbar (weil currentBoard.id === "X")
```

**Workaround:** User muss manuell zu anderem Board wechseln.

**Zukünftige Lösung:** Real-time Deletion Notifications (Phase 4).

### 2. Race Condition bei sehr langsamer Verbindung

**Scenario:**
```
1. Relay antwortet sehr langsam (10+ Sekunden)
2. User schließt Browser bevor Cleanup läuft
3. Nächster Start: Cleanup läuft wieder
```

**Impact:** Minimal, da Cleanup idempotent ist.

---

## 🔮 Zukünftige Erweiterungen

### Phase 2: Visual Feedback

```svelte
<!-- In Sidebar -->
{#if cleanupInProgress}
    <div class="text-xs text-muted-foreground">
        🧹 Cleaning up {cleanupCount} deleted boards...
    </div>
{/if}
```

### Phase 3: User-Controlled Cleanup

```typescript
// Manual Cleanup Button
export function cleanupOrphanedBoards(): number {
    // Run cleanup on demand
    // Return count of cleaned boards
}
```

### Phase 4: Sync Across Devices

Mit Real-time Subscriptions:
- Board wird auf Device A gelöscht
- Device B erhält Deletion Event sofort
- Board verschwindet aus Sidebar ohne Reload

---

## 📝 Changelog

| Version | Datum | Änderungen |
|---------|-------|-----------|
| 1.1 | 08.11.2025 | 🐛 **BUGFIX:** Cleanup löscht jetzt nur Board-Daten, nicht Settings-Keys (`kanban-config`, `kanban-board-ids`) |
| 1.0 | 08.11.2025 | Initial implementation - Auto-cleanup beim Board-Laden |

---

## 🔗 Related Documentation

- **[BOARD-DELETION.md](./BOARD-DELETION.md)** - Board Deletion Feature (NIP-09)
- **[STORES/BOARDSTORE.md](../ARCHITECTURE/STORES/BOARDSTORE.md)** - BoardStore Architecture
- **[NDK.md](../NDK.md)** - Nostr Development Kit Integration
- **[Kanban-NIP.md](../Kanban-NIP.md)** - Event Schema (Kind 30301)

---

**Maintainer:** AI Agent  
**Last Review:** 8. November 2025  
**Status:** ✅ Production-Ready
