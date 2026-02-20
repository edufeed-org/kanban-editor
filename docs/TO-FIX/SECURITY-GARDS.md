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