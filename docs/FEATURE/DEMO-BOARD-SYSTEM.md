# Demo-Board-System für anonyme Benutzer

**Version:** 1.0  
**Datum:** 20. November 2025  
**Feature:** Benutzerbasierte Board-Filterung mit Demo-Funktionalität  
**Status:** ✅ IMPLEMENTIERT  

---

## 📚 Übersicht

Das Demo-Board-System ermöglicht es anonymen Benutzern, die Anwendung auszuprobieren, ohne sich anmelden zu müssen. Gleichzeitig stellt es sicher, dass authentifizierte Benutzer nur ihre eigenen Boards sehen.

### Wichtige Funktionen

1. **Benutzerbasierte Filterung**: Authentifizierte Benutzer sehen nur ihre eigenen Boards
2. **Demo-Board für Anonyme**: Nicht-angemeldete Benutzer erhalten Zugang zu einem Demo-Board
3. **Automatische Migration**: Demo-Boards werden nach dem Login intelligent behandelt
4. **Nahtlose UX**: Übergang von Demo zu echtem Account ist fließend

---

## 🎯 Benutzer-Flows

### Flow 1: Anonymer Benutzer probiert Demo aus

```
1. Benutzer öffnet App (nicht angemeldet)
   ↓
2. BoardsList zeigt "Demo ausprobieren" Button
   ↓
3. Klick erstellt Demo-Session (Demo User)
   ↓
4. Demo-Board wird automatisch erstellt & geladen
   ↓
5. Benutzer kann alle Funktionen testen
```

### Flow 2: Demo-Benutzer meldet sich an (keine eigenen Boards)

```
1. Demo-Benutzer klickt "Anmelden" 
   ↓
2. Login-Prozess (NIP-07, nsec, etc.)
   ↓
3. migrateDemoBoardToRealBoard() wird aufgerufen
   ↓
4. Demo-Board → "Mein erstes Board" (mit neuer ID)
   ↓
5. Benutzer behält alle Demo-Daten
```

### Flow 3: Demo-Benutzer meldet sich an (hat bereits Boards)

```
1. Demo-Benutzer klickt "Anmelden"
   ↓
2. Login-Prozess
   ↓
3. migrateDemoBoardToRealBoard() erkennt: User hat bereits Boards
   ↓
4. Demo-Board wird gelöscht
   ↓
5. Benutzer sieht seine echten Boards
```

---

## 🏗️ Technische Implementierung

### Benutzerbasierte Filterung (`kanbanStore.svelte.ts`)

```typescript
public getAllBoards(): Array<BoardMetadata> {
    const currentUserPubkey = this.getCurrentUserPubkey();
    const isAnonymous = !currentUserPubkey;
    
    // Anonyme Benutzer: Nur Demo-Board
    if (isAnonymous) {
        return this.getDemoBoardsForAnonymousUser();
    }
    
    // Authentifizierte Benutzer: Nur eigene Boards
    const allBoards = BoardStorage.getAllBoardsMetadata(this.boardIds);
    return allBoards.filter(board => 
        this.isUserOwnerOrMaintainer(board.id, currentUserPubkey)
    );
}
```

### Demo-Board-Erstellung

```typescript
private createDemoBoard(): Board {
    const board = new Board({
        id: 'demo-board',
        name: '🎯 Demo-Board - Testen Sie die App!',
        description: 'Willkommen! Dies ist ein Demo-Board...',
        author: 'demo',
        authorName: 'Demo User',
        columns: []
    });
    
    // Beispiel-Spalten und -Karten hinzufügen
    const todoColumn = board.addColumn({ name: '📋 Zu erledigen' });
    todoColumn.addCard({
        heading: '👋 Willkommen im Demo-Board!',
        content: 'Dies ist eine Beispielkarte...'
    });
    
    return board;
}
```

### Post-Login-Migration (`authStore.svelte.ts`)

```typescript
// In allen Login-Methoden (NIP-07, nsec, OIDC):
try {
    const { boardStore } = await import('./kanbanStore.svelte.js');
    boardStore.updateBoardAuthor?.();
    
    // 🆕 DEMO-BOARD MIGRATION
    boardStore.migrateDemoBoardToRealBoard?.();
    
    await boardStore.loadBoardsFromNostrForCurrentUser?.();
    // ...
} catch (error) {
    console.warn('Migration failed:', error);
}
```

---

## 🎨 UI-Änderungen

### BoardsList.svelte

**Für Anonyme Benutzer:**
```svelte
<!-- Demo-Button statt "Neues Board" -->
<Button onclick={handleCreateDemoSession} variant="outline">
    🎯 Demo ausprobieren
</Button>
```

**Für Authentifizierte Benutzer:**
```svelte
<!-- Normaler "Neues Board" Button -->
<Button onclick={handleCreateBoard} variant="default">
    Neues Board
</Button>
```

### Benutzerfreundliche Nachrichten

- **Leer (Anonym)**: "👋 Willkommen! Probieren Sie unsere Demo aus"
- **Leer (Auth)**: "Noch keine Boards" 
- **Demo-Board**: Klar markiert mit 🎯 Icon und Beschreibung

---

## ✅ Acceptance Criteria

- ✅ Anonyme Benutzer sehen nur Demo-Board-Option
- ✅ Authentifizierte Benutzer sehen nur ihre eigenen Boards  
- ✅ Demo-Board ist voll funktionsfähig (Karten, Spalten, etc.)
- ✅ Demo → Echter Account Migration funktioniert nahtlos
- ✅ Bestehende Benutzer verlieren keine Daten
- ✅ Performance: Filterung funktioniert bei 100+ Boards
- ✅ UI: Klare Unterscheidung zwischen Demo und echten Boards

---

## 🔧 Konfiguration

Das Demo-System respektiert die Konfiguration in `config.json`:

```json
{
  "allow_demo_session": {
    "enabled": true
  }
}
```

Bei `enabled: false` wird der Demo-Button nicht angezeigt und Demo-Sessions sind deaktiviert.

---

## 🚀 Zukünftige Erweiterungen

### Phase 2: Enhanced Demo Experience
- Demo-Board mit mehr Beispieldaten
- Interaktive Tutorials
- Geführte Tour durch Features

### Phase 3: Demo Analytics
- Tracking welche Features Benutzer in Demo nutzen
- A/B Testing für Demo-Content
- Conversion-Rate Demo → Anmeldung

### Phase 4: Template-System
- Demo-Boards als Templates für echte Boards
- "Demo als Vorlage verwenden" Option
- Verschiedene Demo-Szenarien (Projekt, Privat, etc.)

---

## 🧪 Tests

### Unit Tests
```typescript
describe('Demo Board System', () => {
  test('Anonymous user sees only demo board', () => {
    authStore.logout(); // Anonymous
    const boards = boardStore.getAllBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].id).toBe('demo-board');
  });
  
  test('Authenticated user sees only own boards', () => {
    authStore.login(); // Mock auth
    const boards = boardStore.getAllBoards();
    expect(boards.every(b => b.author === mockUser.pubkey)).toBe(true);
  });
});
```

### E2E Tests
- Vollständiger Demo-Flow testen
- Migration-Flow testen (Demo → Echter Account)
- Fehlerfälle: Config disabled, Storage-Fehler

---

## 📞 Support

**Bei Problemen:**
1. Prüfe Browser Console auf Fehlermeldungen
2. Verifiziere `config.json` Einstellungen
3. Teste localStorage-Zugriff
4. Prüfe AuthStore-Zustand

**Bekannte Limitations:**
- Demo-Boards sind rein lokal (kein Nostr-Publishing)
- Demo-Session ist 30 Tage gültig
- Ein Demo-Board pro Browser-Session

---

**Implementiert von:** AI Assistant  
**Review:** Pending  
**Deployment:** Ready for Production