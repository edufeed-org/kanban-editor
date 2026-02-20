Notwendige Fixes und ToDos für den Kanban Editor
===============================================

## ~~Neuer Task: Sicherheits-Guard fuer Column-Patch-Events (Kind 8571)~~ ✅ DONE (2025-02-20)

- ✅ Guard in `columnOrderPatch.ts` nach Board-Zugehoerigkeits-Check eingefuegt
- ✅ Nutzt `currentBoard.isMaintainer(event.pubkey)` — Owner + Maintainers akzeptiert, Fremde rejected
- ✅ Guard nur aktiv wenn `currentBoard.author` gesetzt (kein Breaking Change fuer lokale Boards)
- ✅ Tests: `columnOrderPatch.authorization.spec.ts` (11 Tests, alle gruen)

## ~~Neuer Task: Sicherheits-Guard fuer Card-Events (Kind 30302)~~ ✅ DONE (2025-02-20)

- ✅ Guard in `card.ts` vor `upsertCardFromNostr()` / `upsertCardToBackgroundBoard()` eingefuegt
- ✅ Current-Board + Background-Board Guards (Background via `BoardStorage.loadBoard()`)
- ✅ Nutzt `board.isMaintainer(event.pubkey)` — Maintainer koennen kollaborativ alle Cards bearbeiten
- ✅ Guard nur aktiv wenn `board.author` gesetzt; Background-Board ohne lokale Kopie → Guard uebersprungen
- ✅ Tests: `card.authorization.spec.ts` (12 Tests, alle gruen)


## Lösungsvorschlag: Sicherheits-Guards für Kind 8571 & Kind 30302

Beide Event-Handler (Column-Patch und Card) nehmen aktuell Events von **jedem** Publisher an. Das Ziel: Inbound-Events nur akzeptieren, wenn `event.pubkey` entweder `board.author` oder in `board.maintainers` enthalten ist. Die bestehende Methode `Board.isMaintainer(pubkey)` (BoardModel.ts) deckt beides ab und wird als zentrale Prüfung genutzt.

**Steps**

### 1. Guard in Column-Patch-Handler einfügen

**Datei:** columnOrderPatch.ts

- **Wo:** Nach dem Board-Zugehörigkeits-Check (~Zeile 54, nach `if (!aOk && !dOk)`) und **vor** dem `boardStore.applyColumnOrderPatchFromNostr()`-Aufruf (~Zeile 105).
- **Was:** Neuer Block, der `currentBoard.isMaintainer(event.pubkey)` prüft. Wenn `currentBoard.author` gesetzt ist (= Nostr-Board) und der Pubkey kein Maintainer ist → `return false` mit Debug-Log.
- **Edge-Case:** Wenn `currentBoard.author` leer/undefined ist (lokales Board ohne Nostr), wird der Guard übersprungen — kein Breaking Change für Offline-Boards.

### 2. Guard in Card-Event-Handler einfügen

**Datei:** card.ts

- **Wo:** Im `try`-Block, **nach** der Ermittlung von `targetBoardId` (~Zeile 79) und **vor** den `upsertCardFromNostr()` / `upsertCardToBackgroundBoard()`-Aufrufen (~Zeile 128-133).
- **Was:** Zwei Pfade je nach Ziel-Board:
  - **Current Board** (`targetBoardId === currentBoard.id`): Prüfe `currentBoard.isMaintainer(cardEvent.pubkey)`.
  - **Background Board** (`targetBoardId !== currentBoard.id`): Lade Board via `BoardStorage.loadBoard(targetBoardId)` und prüfe `loadedBoard.isMaintainer(cardEvent.pubkey)`. Wenn Board nicht ladbar → Guard überspringen (Board existiert lokal nicht, kein Referenz-Author bekannt).
- **Edge-Case:** Wie bei 8571 — Guard nur aktiv wenn `board.author` gesetzt ist.

### 3. Tests für Column-Patch-Guard

**Neue Datei:** `src/lib/stores/boardstore/nostr/handlers/columnOrderPatch.authorization.spec.ts`

Test-Pattern analog zu board.lww-shared.spec.ts: Board-Mock mit `author` + `maintainers`, fake Events mit verschiedenen Pubkeys.

**Test-Cases:**
1. **Owner-Patch wird angewendet** — `event.pubkey === board.author` → `applyColumnOrderPatchFromNostr` wird aufgerufen.
2. **Maintainer-Patch wird angewendet** — `event.pubkey` in `board.maintainers` → wird aufgerufen.
3. **Fremder Pubkey wird verworfen** — `event.pubkey` ist weder Owner noch Maintainer → `return false`, Store-Methode nicht aufgerufen.
4. **Lokales Board (kein author)** — `board.author` ist `undefined` → Guard wird übersprungen, Patch wird angewendet.
5. **LWW-Verhalten intakt** — bestehende Tests in kanbanStore.columnPatch.spec.ts bleiben grün.

### 4. Tests für Card-Guard

**Neue Datei:** `src/lib/stores/boardstore/nostr/handlers/card.authorization.spec.ts`

Gleicher Mock-Ansatz wie card.lww-ms.spec.ts: `createBoardMock` erweitern um `author`, `maintainers` und `isMaintainer()`.

**Test-Cases:**
1. **Owner-Card-Update wird angewendet** — `event.pubkey === board.author` → `upsertCardFromNostr` aufgerufen.
2. **Maintainer-Card-Update wird angewendet** — `event.pubkey` in `board.maintainers` → aufgerufen.
3. **Fremder Pubkey wird verworfen** — weder Owner noch Maintainer → kein Aufruf, kein Error.
4. **Background-Board-Sync respektiert Guard** — Background-Board mit `author` geladen, fremder Pubkey → `upsertCardToBackgroundBoard` nicht aufgerufen.
5. **Lokales Board (kein author)** — Guard übersprungen, Card wird normal verarbeitet.

### 5. TODO.md aktualisieren

Beide Tasks in TODO.md nach Implementierung als erledigt markieren.

**Verification**
- `pnpm run test:unit` — alle bestehenden Tests + neue Guard-Tests grün
- `pnpm run check` — TypeScript-Checks bestehen
- Manuelle Verifikation: In der Browser-Konsole prüfen, dass bei fremden Events ein `[ColumnOrderPatch] rejected` bzw. `[CardEvent] rejected` Debug-Log erscheint

**Decisions**
- **Guard-Platzierung im Handler (nicht im Store):** Konsistent mit dem bestehenden Board-Guard in board.ts. Der Handler ist die richtige Schicht für Autorisierung — der Store bleibt "dumb".
- **`isMaintainer()` statt manueller Prüfung:** Die Methode existiert bereits und deckt Owner + Maintainers ab. Kein neuer Code im Model nötig.
- **Guard nur aktiv wenn `board.author` gesetzt:** Verhindert Breaking Changes für rein lokale Boards ohne Nostr-Anbindung.
- **Background-Board via `BoardStorage.loadBoard()`:** Für Card-Events, die nicht für das aktive Board bestimmt sind, wird das Ziel-Board aus localStorage geladen. Wenn nicht vorhanden → Guard übersprungen (kein Referenz-Author bekannt, kann nicht validieren).


---

## PR Description

### Authorization Guards for Inbound Nostr Events (Kind 8571 & 30302)

**Problem**

Column-Patch-Events (Kind 8571) und Card-Events (Kind 30302) wurden bisher ohne Publisher-Rollencheck verarbeitet. Jeder Nostr-Nutzer, dessen Events die Relay-Filter passieren, konnte potenziell Spalten-Metadaten (Name, Farbe, Reihenfolge) und Card-Inhalte (Titel, Beschreibung, Position, Löschung) im lokalen Client beeinflussen.

Der Board-Event-Handler (Kind 30301) hatte bereits einen Owner-only Guard — dieser PR schliesst die Lücke für die beiden anderen Event-Typen.

**Solution**

Autorisierungs-Guards in beiden Event-Handlern, konsistent mit dem bestehenden Pattern in `board.ts`:

- **Column-Patch (Kind 8571):** Guard in `columnOrderPatch.ts` nach Board-Zugehoerigkeits-Check. Nutzt `currentBoard.isMaintainer(event.pubkey)` — akzeptiert Owner + Maintainers, rejected alle anderen mit Debug-Log.
- **Card (Kind 30302):** Guard in `card.ts` vor `upsertCardFromNostr()` / `upsertCardToBackgroundBoard()`. Zwei Pfade:
  - Current Board: prüft `currentBoard.isMaintainer(eventPubkey)`
  - Background Board: lädt Board via `BoardStorage.loadBoard()`, prüft `backgroundBoard.isMaintainer(eventPubkey)`. Board lokal nicht vorhanden → Guard übersprungen.

Kein neuer Code im Model — die bestehende `Board.isMaintainer(pubkey)` Methode deckt Owner + Maintainers ab.

**Design Decisions**

- Guards nur aktiv wenn `board.author` gesetzt ist → kein Breaking Change für rein lokale Offline-Boards
- Guard-Platzierung im Handler (nicht im Store) — konsistent mit `board.ts`, Handler ist die richtige Autorisierungs-Schicht
- `card.author` wird bewusst **nicht** als harte Sperre erzwungen → Maintainer können kollaborativ alle Cards bearbeiten
- Ungültige Events werden silent mit `console.debug` geloggt (kein Error, kein Apply, kein local persist)

**Changed Files**

| Datei | Änderung |
|-------|----------|
| `src/lib/stores/boardstore/nostr/handlers/columnOrderPatch.ts` | Authorization Guard eingefügt (Owner + Maintainers) |
| `src/lib/stores/boardstore/nostr/handlers/card.ts` | Authorization Guard für Current- und Background-Board eingefügt |
| `src/lib/stores/boardstore/nostr/handlers/columnOrderPatch.authorization.spec.ts` | **Neu** — 11 Tests |
| `src/lib/stores/boardstore/nostr/handlers/card.authorization.spec.ts` | **Neu** — 12 Tests |
| `docs/TO-FIX/TODO.md` | Tasks als erledigt markiert |

**Test Coverage (23 neue Tests)**

Column-Patch Guard (11 Tests):
- Owner-Patch akzeptiert
- Maintainer-Patch akzeptiert
- Fremder Pubkey verworfen
- Lokales Board ohne author → Guard übersprungen
- Leerer author-String → Guard übersprungen
- Fehlender event.pubkey → Guard übersprungen
- Zweiter Maintainer akzeptiert
- Deduplication intakt neben Guard
- Board-Mismatch greift weiterhin vor Guard
- Fallback wenn `isMaintainer` keine Funktion (plain object)
- Stranger rejected mit Fallback

Card Guard (12 Tests):
- Owner-Card-Update akzeptiert
- Maintainer-Card-Update akzeptiert
- Fremder Pubkey verworfen
- Lokales Board ohne author → Guard übersprungen
- Fehlender event.pubkey → Guard übersprungen
- Zweiter Maintainer akzeptiert
- Background-Board: Owner akzeptiert
- Background-Board: Maintainer akzeptiert
- Background-Board: Stranger rejected
- Background-Board ohne author → Guard übersprungen
- Background-Board lokal nicht vorhanden → Guard übersprungen, Event trotzdem gespeichert
- LWW-Skip funktioniert weiterhin neben Guard

**Verification**

```bash
pnpm run test:unit  # 38/38 Handler-Tests grün (inkl. 23 neue)
```

Keine Regressionen in bestehenden Tests (`board.lww-shared.spec.ts`, `card.lww-ms.spec.ts`, `deletion.spec.ts`).