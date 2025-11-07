# Nostr Board Loading & Subscription Implementation Guide

Status: Phase 1 - Board-Metadaten wird geladen. Karten-Persistierung noch nicht implementiert. (🐛 Bug Fixed 07.11.2025 - siehe BUG-FIX-CARD-DELETION-ON-SUBSCRIPTION.md)  
Scope: Automatisches Laden und Live-Aktualisieren von Board-Metadaten (Kind 30301) des angemeldeten Users aus Nostr, integriert mit BoardStore, AuthStore, NDK und SyncManager. **Wichtig:** Karten (Kind 30302) sind architektonisch separate Events - diese Phase behandelt nur Board-Struktur.

## ⚠️ KRITISCHER ARCHITEKTUR-HINWEIS

**Problem Phase 1:** Board-Karten werden in `nostrEvents.ts` deserialisiert, aber:
- Kind 30302 (Card) Events sind **separate Events** (nicht im Board-Event 30301 enthalten!)
- `nostrEventToBoard()` erzeugt `columns: [{ cards: [] }]` - **alle Karten werden gelöscht**
- Wenn Subscription das Board aktualisiert → lokale Karten verschwinden

**Lösung Phase 1 (AKTUELL):**
- ✅ Board-Metadaten (Spalten-Name, Spalten-Ordnung, Board-Name) werden von Nostr synced
- ❌ Karten-Inhalte bleiben **lokal** (nicht via Nostr - noch)
- 🔄 Karten werden NICHT überschrieben durch Subscription (Design)

**Zukünftig Phase 1.2+:**
- Implementierung von Card-Event-Loading (Kind 30302)
- Separate Subscription pro Karte
- Synchronisierung von Karten-Änderungen

Zielsetzung dieser Phase

Diese Anleitung beschreibt präzise, wie die **Board-Metadaten-Synchronisierung** (Kind 30301) konkret im Code umgesetzt wird.

Fokus:

- Beim App-Start und bei Login:
  - Boards (Kind 30301) des Users aus Nostr laden.
  - In `BoardModel`/`BoardStore` übernehmen und in localStorage cachen.
- Laufend:
  - Per Nostr-Subscription auf Board-Updates reagieren.
  - Last-Write-Wins anwenden.
  - Offline-First Verhalten beibehalten.
- Architekturtreue:
  - Write/Queue: SyncManager.
  - Read/Subscribe: BoardStore + NDK + nostrEvents.

Wichtig:

- Diese Datei ist die verbindliche Implementierungsreferenz.
- Alle Code-Änderungen müssen mit [`docs/ARCHITECTURE/STORES/BOARDSTORE.md`](../STORES/BOARDSTORE.md), [`docs/ARCHITECTURE/STORES/SYNCMANAGER.md`](../STORES/SYNCMANAGER.md) und [`docs/DOCUMENTATION-RULES-v3.md`](../DOCUMENTATION-RULES-v3.md) konsistent sein.

---

## 1. Verantwortlichkeiten

High-Level Zuordnung:

- BoardStore (`src/lib/stores/kanbanStore.svelte.ts`):
  - Verwaltung aller Boards (lokal + Nostr).
  - Laden von Board-Events aus Nostr.
  - Starten von Subscriptions auf Board-Events.
  - Auswahl und Aktualisierung des aktiven Boards.
- SyncManager (`src/lib/stores/syncManager.svelte.ts`):
  - Unverändert primär für Writes:
    - `publishOrQueue`
    - Signing
    - Retry
    - Queue-Persistenz.
  - Keine komplexe Read-Logik hier einbauen.
- nostrEvents (`src/lib/utils/nostrEvents.ts`):
  - Serialisierung/Deserialisierung:
    - `boardToNostrEvent`, `nostrEventToBoard`
    - `cardToNostrEvent`, `nostrEventToCard`
  - Basis für Mapping von Nostr-Events zu internen Modellen.
- AuthStore (`src/lib/stores/authStore.svelte.ts`):
  - Liefert:
    - `getPubkey()` / `getPubkeySafe()`
    - `isAuthenticated`
    - Info, wann ein User angemeldet ist.
  - Triggert nach Login relevante Initialisierungen.

Prinzip:

- Reads (Loading, Subscribe) passieren im BoardStore.
- Writes (Publish, Queue) passieren via BoardStore → nostrEvents → SyncManager.

---

## 2. Neue/erweiterte BoardStore-APIs

Die folgenden Methoden werden im `BoardStore` implementiert bzw. erweitert. Pfad: [`src/lib/stores/kanbanStore.svelte.ts`](../../src/lib/stores/kanbanStore.svelte.ts).

### 2.1 `initializeNostr(ndk: NDK)`

Ziel: NDK im BoardStore hinterlegen und die Nostr-Read-/Subscribe-Logik starten.

Implementationsvorgaben:

- Erweitere die bestehende Methode:

- Speichere `this.ndk = ndk`.
- Stelle sicher, dass `initializeSyncManager(ndk, signer?)` aufgerufen wird (wie vorhanden).
- Wenn ein User bereits authentifiziert ist (`authStore.isAuthenticated` und `authStore.getPubkeySafe()` liefert Wert):

  - Rufe `this.loadBoardsFromNostrForCurrentUser()` (neu, s.u.).
  - Rufe `this.subscribeToBoardUpdatesForCurrentUser()` (neu, s.u.).

- Logging:
  - Präzise Logs, z.B.: `[BoardStore] Nostr initialized, starting board loading for user ...`.

### 2.2 `loadBoardsFromNostrForCurrentUser(): Promise<void>`

Ziel: Alle relevanten Kind-30301-Boards des aktuellen Users laden und in BoardStore + localStorage integrieren.

Implementationsdetails:

1. Pre-Checks:

- Falls `!this.ndk`: früh abbrechen mit Log (`Nostr not initialized`).
- Hole sicheren Pubkey:
  - `const pubkey = authStore.getPubkeySafe?.() || authStore.getPubkey?.();`
- Wenn kein Pubkey:
  - Log: `[BoardStore] No pubkey available, skipping Nostr board loading`.
  - Früh return.

2. Events laden:

- Verwende NDK (direkt, nicht SyncManager):

  - Filter (MVP):

    - `kinds: [30301]`
    - `authors: [pubkey]`

  - Optionaler Zusatz (später):

    - Boards, in denen User per `p`-Tag als Maintainer auftaucht:
      - Dazu kann ein zweiter Fetch mit `kinds: [30301], "#p": [pubkey]` erfolgen, falls der NDK das unterstützt.

- Nutze `await this.ndk.fetchEvents(filter)` oder die projektkonforme Variante.

3. Mapping pro Event:

Für jedes gefundene Event:

- Validiere:

  - kind == 30301.
  - `nostrEvents.validateEventTags(event, EVENT_KINDS.BOARD)` falls gewünscht.

- In BoardProps umwandeln:

  - `const boardProps = nostrEventToBoard(event);`

- In `Board` Modell umwandeln:

  - `const board = new Board(boardProps);`

- Persistenz:

  - Schreibe nach localStorage unter:

    - Key: `kanban-${board.id}`

  - Füge `board.id` zu `this.boardIds` hinzu, falls noch nicht enthalten.
  - Nutze das bestehende Pattern:
    - IDs immer über `this.boardIds` + `saveBoardIds()` pflegen.

- Zeitinformation:

  - Nutze `event.created_at` (Unix) als Fallback für:

    - `createdAt`
    - `updatedAt`
    - Oder speichere separat im persistierten JSON, falls bereits Struktur definiert.

4. Aktives Board wählen (nur, wenn sinnvoll):

- Wenn aktuelles `this.board`:

  - Schon aus localStorage geladen ist und konsistent:
    - Nicht ungefragt überschreiben.
- Falls `this.board` ein leeres Default-Board ist (Heuristik, z.B. keine echten Daten oder `author === 'anonymous'`):

  - Wähle das jüngste Nostr-Board (höchstes `created_at`) als aktives Board:
    - `this.board = board;`
    - `this._columnOrder = board.columns.map(c => c.id);`
    - `this.updateTrigger++;`
- MRU-Logik mit `lastAccessedAt` beibehalten:
  - Falls bereits Boards in storage existieren, bevorzuge weiterhin das zuletzt verwendete Board.
  - Nostr-Boards werden in dieses MRU-Schema integriert.

5. Fehlerhandling:

- Keine Exceptions nach oben werfen (außer in Tests explizit erwartet).
- Sauber loggen:
  - `[BoardStore] Error while loading boards from Nostr: ...`
- Fallback:
  - Bei Fehlern einfach bei lokalen Boards bleiben.

### 2.3 `subscribeToBoardUpdatesForCurrentUser(): void`

Ziel: Live-Updates für Board-Metadaten (Kind 30301) aus Nostr abonnieren und in BoardStore spiegeln. **Wichtig:** Nur Metadaten (Spalten-Namen, Spalten-Reihenfolge), NICHT Karten-Inhalte.

Implementationsdetails:

1. Pre-Checks:

- Wenn `!this.ndk`: abbrechen mit Log.
- Wenn kein Pubkey: abbrechen mit Log.
- Subscription-Instanz referenzieren:

  - In `BoardStore` eine private Variable einführen, z.B.:

    - `private boardSubscription: any | null = null;`

  - Bei erneutem Aufruf bestehende Subscription stoppen.

2. Subscription erstellen:

- Filter (MVP):

  - `kinds: [30301]`
  - `authors: [pubkey]`
  - `closeOnEose: false`

- Optional:

  - Ein zweiter Filter für Boards, in denen der User via `p`-Tag Maintainer ist.
  - Kann später ergänzt werden.

3. Event-Handler - **KRITISCH: Karten-Handling**

Für jedes eingehende Event:

- Via `nostrEventToBoard(event)` in BoardProps umwandeln.
  - ⚠️ **Achtung:** Dies gibt `columns: [{ cards: [] }]` zurück (Karten sind separate Kind 30302 Events!)
  - **NICHT** direkt in `this.board` setzen, da lokale Karten verloren gehen würden!

- **Merge-Strategie:**
  
  1. Hole lokales Board aus localStorage:
     ```typescript
     const localData = localStorage.getItem(`kanban-${boardProps.id}`);
     const local = localData ? JSON.parse(localData) : null;
     ```
  
  2. Vergleiche Timestamps (Last-Write-Wins):
     ```typescript
     const remoteCreatedAt = event.created_at 
         ? new Date(event.created_at * 1000).getTime() 
         : 0;
     const localUpdatedAt = local?.updatedAt 
         ? new Date(local.updatedAt).getTime() 
         : 0;
     
     if (remoteCreatedAt <= localUpdatedAt) {
         // Lokal neuer: behalte lokale Version
         return;
     }
     ```
  
  3. **Nur Spalten-Metadaten mergen** (nicht Karten!):
     ```typescript
     const merged = {
         ...local,  // Behalte lokale Daten (z.B. Karten!)
         ...boardProps,  // Update nur Spalten-Metadaten
         columns: boardProps.columns.map((col, idx) => {
             const localCol = local?.columns?.[idx];
             return {
                 ...col,  // Neue Spalten-Metadaten
                 cards: localCol?.cards || [],  // ← KRITISCH: Behalte lokale Karten!
             };
         }),
     };
     ```

- Last-Write-Wins:

  - Ermittle `remoteTimestamp` aus `event.created_at`.
  - Hole lokalen Zustand (falls vorhanden) aus localStorage:
    - `kanban-${boardProps.id}`.
    - Vergleiche `remoteTimestamp` mit lokalem `updatedAt`/`createdAt`.
  - Wenn `remoteTimestamp` > lokal:
    - **Nur Spalten-Metadaten** aus Nostr aktualisieren (siehe Merge-Strategie oben)
  - Wenn lokal neuer ist:
    - Lokale Version behalten (keine Änderung).

- Aktualisierung des aktiven Boards:

  - Wenn das aktualisierte Board das aktuell geladene `this.board.id` ist:
    - `this.board = new Board(mergedProps);` (nicht `boardProps` direkt!)
    - `this._columnOrder = this.board.columns.map(c => c.id);`
    - `this.updateTrigger++;`

4. Cleanup:

- Bei Logout oder NDK-Reset:
  - Subscription stoppen und `boardSubscription = null` setzen.
  - Diese Logik kann in AuthStore- oder Layout-Hooks integriert werden.

---

## 3. Karten (Kind 30302) – Optionale Erweiterung

Für spätere Phasen (nicht zwingend jetzt umzusetzen, aber architektonisch festgelegt):

### 3.1 Laden von Card-Events pro Board

- Nach dem Laden eines Boards (30301):
  - Optional Card-Events (30302) für dieses Board abrufen:

    - Filter:

      - `kinds: [30302]`
      - `#a: [\`30301:${board.author}:${board.id}\`]`

- Mapping:

  - `nostrEventToCard(event)` → `CardProps`.
  - Nutzung von:

    - `Board.upsertCard(targetColumnId, CardProps)` im Model.
    - Oder `boardStore.upsertCard(targetColumnId, CardProps)` als Store-API.

- Last-Write-Wins:
  - Wieder über `event.created_at`.

### 3.2 Subscription für Karten

- Analog zu Boards:
  - Subscription auf 30302 Events für aktuelles Board.
  - Bei Event:
    - `nostrEventToCard` → Upsert ins Board.
    - `triggerUpdate()` aufrufen.

Diese Schritte werden separat spezifiziert, sobald 30301-Flow stabil ist.

---

## 4. Startup- und Login-Sequenz

Verbindliche Abfolge (zu implementieren in Layout/Auth-Integration):

1. App-Start:

- AuthStore initialisiert (Session, NIP-07, etc.).
- NDK wird erstellt und `await ndk.connect()` aufgerufen.
- SyncManager initialisiert:
  - `initializeSyncManager(ndk, initialSigner?)`.
- BoardStore Singleton existiert bereits:
  - `import { boardStore } from '$lib/stores/kanbanStore.svelte';`
- Nostr-Integration im BoardStore:

  - `await boardStore.initializeNostr(ndk);`
  - Diese Methode:
    - Startet SyncManager (bereits vorhanden).
    - Startet `loadBoardsFromNostrForCurrentUser` / `subscribeToBoardUpdatesForCurrentUser`, falls User bekannt.

2. Login (oder Signer-Wechsel):

- AuthStore aktualisiert Signer und Pubkey.
- Ruft:

  - `getSyncManager().updateSigner(newSigner);`
  - `boardStore.updateBoardAuthor();` (für aktuelles Board, wenn `anonymous`).
  - `boardStore.loadBoardsFromNostrForCurrentUser();`
  - `boardStore.subscribeToBoardUpdatesForCurrentUser();`

3. Logout:

- AuthStore setzt Signer/Pubkey zurück.
- Mögliche Actions:
  - `getSyncManager().updateSigner(undefined);`
  - `boardStore` kann optional:
    - Nostr-Subscriptions schließen.
    - Auf lokale Boards beschränken.

---

## 5. Konfliktstrategie

Verbindliche Regeln:

- Replaceable Events (30301/30302):
  - Last-Write-Wins nach `created_at`.
- Lokal vs. Remote:

  - Wenn lokale Daten neuer (z.B. Board offline geändert, noch nicht publiziert):
    - Lokale Version behalten.
    - SyncManager sorgt später für Publish.
  - Wenn Nostr-Event neuer:
    - Lokale Version überschreiben.

- Keine komplexe Merge-Logik in dieser Phase.
- Alle Entscheidungen in BoardStore kapseln, nicht in UI.

---

## 6. Tests (Implementierungshinweise)

Erweiterungen an der Test-Suite (hohe Priorität):

1. Neuer Spec: `src/lib/stores/kanbanStore.nostr-loading.spec.ts`

- Mock-NDK mit:
  - `fetchEvents` für 30301.
  - Optional: Subscription-Mock.
- Tests:

  - `loadBoardsFromNostrForCurrentUser`:
    - Lädt Events und erzeugt `kanban-{id}` Einträge.
    - Aktualisiert `boardIds`.
  - Last-Write-Wins:
    - Zwei Events für dasselbe Board → neueres gewinnt.
  - Kein Pubkey:
    - Funktion beendet sich ohne Änderungen.

2. `syncManager.svelte.spec.ts` (bereits vorhanden):

- Optional verifizieren:
  - `updateSigner` Verhalten im Zusammenspiel mit BoardStore (über Mocks).

3. Dokumentation:

- [`docs/TESTS/STATUS.md`](../TESTS/STATUS.md) aktualisieren:
  - Neue Testszenarien für Nostr-Loading & Subscription.

---

## 7. UX-Integration (Kurz)

- `BoardsList.svelte`:

  - Nutzt `boardStore.getAllBoards()` als Datenquelle.
  - Nostr-Boards erscheinen automatisch, sobald:
    - `loadBoardsFromNostrForCurrentUser` ausgeführt wurde.
  - Ladezustand:
    - Optional: einfacher Loading-State basierend auf Flag im BoardStore (kann bei Bedarf ergänzt werden).

- `cardsboard/+page.svelte`:

  - Stellt sicher, dass:
    - NDK/BoardStore-Initialisierung bereits im Layout erfolgt.
    - Keine direkte Nostr-Logik in der Page implementiert wird.

---

## 8. DoD (Definition of Done) für diese Architektur

Die Implementierung gilt als abgeschlossen, wenn:

- Code:
  - `BoardStore` enthält:
    - `initializeNostr(ndk)`
    - `loadBoardsFromNostrForCurrentUser()`
    - `subscribeToBoardUpdatesForCurrentUser()`
  - Nostr-Boards werden:
    - beim App-Start (bei bekanntem User) geladen,
    - bei Login nachgeladen,
    - via Subscription aktualisiert.
- Tests:
  - Unit-Tests für Loading und (mindestens rudimentäre) Subscription vorhanden.
- Docs:
  - Diese Implementierungsdatei ist konsistent mit:
    - [`BOARDSTORE.md`](../STORES/BOARDSTORE.md)
    - [`SYNCMANAGER.md`](../STORES/SYNCMANAGER.md)
    - ROADMAP & TEST-Status aktualisiert.
- UX:
  - BoardsList zeigt Nostr-Boards.
  - Keine Regression im Offline-First Verhalten.

Diese Anleitung ist die direkte Handlungsgrundlage für den Code-Mode zur Umsetzung des Nostr-Board-Loading- und Subscription-Flows.