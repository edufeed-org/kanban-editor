# Demo-Board Migration Test

## Problem
Angemeldete User sahen immer noch das Demo-Board, obwohl sie eigene Boards hatten.

## Lösung
1. **Verbesserte Migration-Logik**: `migrateDemoBoardToRealBoard()` entfernt Demo-Board korrekt aus boardIds
2. **Board-Filter**: `getAllBoards()` für authentifizierte User filtert Demo-Board explizit heraus
3. **Auth-Integration**: Neue `onAuthChanged()` Methode ruft Migration und Board-Aktualisierung auf
4. **UI-Integration**: BoardsList ruft `onAuthChanged()` nach Demo-Session-Erstellung auf

## Test-Schritte

### Scenario 1: Neuer User (Demo → First Real Board)
1. **Anonym**: Öffne App → Sollte "🎯 Demo ausprobieren" Button zeigen
2. **Demo erstellen**: Klicke Button → Demo-Board wird geladen
3. **Login**: Login mit NIP-07 oder nsec → Demo-Board wird zu erstem echten Board
4. **Verifizierung**: Board-Name wird zu "🏠 Mein erstes Board", author wird auf pubkey gesetzt

### Scenario 2: Bestehender User (Demo → Gelöscht)
1. **Anonym**: Öffne App → Demo-Board erstellen
2. **Login**: Login mit User der bereits Boards hat
3. **Verifizierung**: Demo-Board verschwindet, User-Boards werden angezeigt
4. **Wechsel**: App lädt automatisch eins der bestehenden User-Boards

## Erwartete Logs

```
🔄 Auth status changed - handling board migration
✅ Demo-Board gelöscht - User hat 2 eigene Boards, gewechselt zu: My Project Board
✅ Auth change handled - board migration complete
```

Oder für neuen User:
```
🔄 Auth status changed - handling board migration
✅ Demo-Board zu echtem Board migriert: demo-board → abc123xyz
✅ Auth change handled - board migration complete
```

## Code-Änderungen

### 1. BoardStore Migration Logic
- `migrateDemoBoardToRealBoard()`: Verbesserte boardIds Management
- `deleteDemoBoard()`: Entfernt Demo-Board aus boardIds und localStorage
- `onAuthChanged()`: Neue öffentliche Methode für Auth-Integration

### 2. Board Filtering
- `getAllBoards()`: Filtert Demo-Board für authentifizierte User heraus
- Verwendet `filteredBoardIds` ohne 'demo-board'

### 3. AuthStore Integration
- Alle Login-Methoden (NIP-07, nsec, OIDC) rufen `onAuthChanged()` auf
- Ersetzt direkte `migrateDemoBoardToRealBoard()` Aufrufe

### 4. UI Integration
- `BoardsList.svelte`: `handleCreateDemoSession()` ruft `onAuthChanged()` auf
- Sichert reaktive Board-Liste-Updates

## Debug Commands

```javascript
// Browser Console - Demo-Board Status prüfen
localStorage.getItem('kanban-demo-board')
localStorage.getItem('kanban-boards-list') 

// BoardStore Status
boardStore.getAllBoards()
boardStore.allBoardIds
authStore.isAuthenticated

// Nach Login - sollte Demo-Board weg sein
boardStore.getAllBoards().find(b => b.id === 'demo-board') // should be undefined
```