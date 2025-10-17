# Changelog: AGENTS.md Erweiterungen

**Datum:** 17. Oktober 2025  
**Version:** 2.0

## Zusammenfassung der Änderungen

Die `AGENTS.md` Spezifikation wurde um **vier kritische Sektionen** erweitert, um die Nostr-Integration, Offline-Funktionalität und das Kommentar-System vollständig zu spezifizieren.

---

## Neue Sektionen

### ✅ V.1 Nostr-Integration (erweitert)

**Was wurde hinzugefügt:**

1. **Event-Mapping Tabelle**
   - Klare Zuordnung: Klasse → Nostr Event Kind
   - Board → 30301, Card → 30302, Comment → 1
   - `publishState` → Custom Tag `["state", "draft|published|archived"]`

2. **Event-Serialisierung Spezifikation**
   - Neue Datei: `src/lib/utils/nostrEvents.ts`
   - Funktionen:
     - `boardToNostrEvent()` / `nostrEventToBoard()`
     - `cardToNostrEvent()` / `nostrEventToCard()`
     - `createCommentEvent()`
   - Vollständige Beispiel-Implementierung für `boardToNostrEvent()`

**Dateien betroffen:**
- NEU: `src/lib/utils/nostrEvents.ts`

---

### ✅ VI. Offline-First Strategie & Synchronisation (NEU)

**Was wurde hinzugefügt:**

1. **Architektur-Diagramm**
   - Visualisierung der Layer: UI → BoardStore → SyncManager → NDK → Relays
   - Klare Separation of Concerns

2. **Sync Manager Implementierung**
   - Neue Datei: `src/lib/stores/syncManager.ts`
   - Features:
     - Event Queue mit IndexedDB Persistenz
     - Online/Offline Detection
     - Automatischer Retry-Mechanismus
     - `publishOrQueue()` API
   - **Vollständige Code-Implementierung** (~150 Zeilen)

3. **BoardStore Integration**
   - Erweiterung um SyncManager
   - Methoden:
     - `publishCardUpdate()`
     - `loadFromNostr()`
     - `subscribeToUpdates()`
   - Live-Subscriptions für Echtzeit-Updates

4. **Conflict Resolution Strategie**
   - Last-Write-Wins (Standard)
   - Alternative: Merge-Strategie
   - Nutzung von Nostr `created_at` Timestamps

5. **publishState Mapping**
   - Custom Tag: `["state", "draft|published|archived"]`
   - Empfehlung: Draft-Events nicht publizieren

**Dateien betroffen:**
- NEU: `src/lib/stores/syncManager.ts`
- ERWEITERT: `src/lib/stores/kanbanStore.ts`

---

### ✅ VII. Kommentar-System Spezifikation (NEU)

**Was wurde hinzugefügt:**

1. **Architektur-Entscheidung**
   - Kommentare als separate Nostr Events (Kind 1)
   - Vorteile dokumentiert (Kompatibilität, Timeline, Reactions)

2. **Event-Struktur**
   - Tags: `e`, `p`, `a`-tag für Card-Referenz
   - Alternative: NIP-22 (Kind 42) erwähnt

3. **Card-Klasse Erweiterung**
   - Neue Properties: `eventId`, `author`
   - Neue Methoden:
     - `loadCommentsFromNostr(ndk)` - Lädt alle Kommentare
     - `addCommentToNostr(ndk, text)` - Erstellt Kommentar auf Nostr
     - `deleteCommentFromNostr(ndk, id)` - Löscht Kommentar (NIP-09)
     - `subscribeToComments(ndk, callback)` - Live-Updates
   - **Vollständige Code-Implementierung** (~100 Zeilen)

4. **BoardStore Integration**
   - Neue Methoden:
     - `addComment(cardId, text)`
     - `deleteComment(cardId, commentId)`
     - `loadComments(cardId)`
   - Fehlerbehandlung mit Fallback

5. **UI-Integration Beispiel**
   - Vollständiges `Card.svelte` Code-Beispiel
   - Comment-Loading mit `$effect`
   - Add/Delete Comment Handling

**Dateien betroffen:**
- ERWEITERT: `src/lib/classes/BoardModel.ts` (Card-Klasse)
- ERWEITERT: `src/lib/stores/kanbanStore.ts`
- ERWEITERT: `src/lib/components/Card.svelte`

---

### ✅ VIII. Test-Suite (umbenannt von VI)

**Was wurde geändert:**

1. **Sektion umbenannt** von "VI" zu "VIII" (Nummerierung angepasst)

2. **Erweiterte Tests hinzugefügt**
   - Nostr Event Serialization Tests
   - Offline Queue Simulation
   - Comment System Tests
   - Vollständige Code-Beispiele

3. **Testabdeckung**
   - Bestehende Tests: Board, Column, Card, AI
   - NEU: Nostr-Events, SyncManager, Comments

**Dateien betroffen:**
- ERWEITERT: `src/lib/utils/testSuite.ts`

---

## Aktualisierte Datei-Liste

Die Tabelle in "V. Zu liefernde Dateien" wurde erweitert um:

| Neue Datei | Beschreibung | Status |
|------------|-------------|--------|
| `src/lib/utils/nostrEvents.ts` | Event Serialization/Deserialization | ❌ |
| `src/lib/stores/syncManager.ts` | Offline-Sync Manager | ❌ |

---

## Technische Details

### Code-Umfang der Erweiterungen

- **Nostr Events:** ~200 Zeilen Code (Serialization)
- **Sync Manager:** ~150 Zeilen Code (Queue, Retry, Online-Detection)
- **Kommentar-System:** ~150 Zeilen Code (Card-Erweiterung + Store-Integration)
- **Tests:** ~50 Zeilen zusätzliche Tests

**Gesamt:** ~550 Zeilen neue Spezifikation

### Neue Dependencies

Keine neuen NPM-Pakete erforderlich. Verwendet bestehende:
- `@nostr-dev-kit/ndk`
- `@nostr-dev-kit/svelte`
- `svelte-persisted-store` (bereits im Projekt)

---

## Architektur-Änderungen

### Vorher (AGENTS.md v1.0):

```
UI Components
    ↓
BoardStore ($state)
    ↓
BoardModel Classes
```

### Nachher (AGENTS.md v2.0):

```
UI Components
    ↓
BoardStore ($state)
    ↓                    ↓
BoardModel Classes    SyncManager
    ↓                    ↓
Nostr Events ←→ Event Queue (IndexedDB)
    ↓
NDK → Nostr Relays
```

---

## Breaking Changes

**Keine Breaking Changes** für bestehenden Code.

Alle Erweiterungen sind **additiv**:
- Neue Dateien hinzugefügt
- Bestehende Klassen erweitert (backward-compatible)
- Neue optionale Methoden

---

## Nächste Schritte für Entwickler

### Phase 1: Nostr Events (1-2 Tage)
1. `src/lib/utils/nostrEvents.ts` implementieren
2. Tests für Serialization schreiben
3. Mit echten Nostr-Events testen

### Phase 2: Sync Manager (2-3 Tage)
1. `src/lib/stores/syncManager.ts` implementieren
2. IndexedDB Queue testen
3. Online/Offline Szenarien testen

### Phase 3: BoardStore Integration (1-2 Tage)
1. `kanbanStore.ts` um Nostr-Publishing erweitern
2. Live-Subscriptions implementieren
3. End-to-End Tests

### Phase 4: Kommentar-System (1-2 Tage)
1. Card-Klasse um Nostr-Methoden erweitern
2. BoardStore Comment-API implementieren
3. UI für Kommentare bauen

### Phase 5: Testing (1 Tag)
1. Erweiterte Test-Suite implementieren
2. Offline-Tests durchführen
3. Multi-Device Sync testen

**Geschätzte Gesamtdauer:** 7-10 Arbeitstage

---

## Dokumentations-Updates

### Neue Dateien erstellt:
- ✅ `NDK.md` - Vollständige NDK-Integration Dokumentation
- ✅ `ANALYSE.md` - Codebase-Analyse & Roadmap
- ✅ `CHANGELOG.md` - Dieses Dokument

### Aktualisierte Dateien:
- ✅ `AGENTS.md` - Erweiterte Spezifikation
- ⏳ `README.md` - Sollte aktualisiert werden mit Hinweisen auf neue Docs

---

## Referenzen

- [AGENTS.md](./AGENTS.md) - Vollständige Spezifikation
- [NDK.md](./NDK.md) - NDK Integration Guide
- [Kanban-NIP.md](./Kanban-NIP.md) - Nostr Event Schema
- [ANALYSE.md](./ANALYSE.md) - Status & Roadmap

---

## Autoren

- **Spezifikation v1.0:** Original-Autor
- **Erweiterungen v2.0:** GitHub Copilot (17. Oktober 2025)

---

## Lizenz

Gleiche Lizenz wie das Hauptprojekt.
