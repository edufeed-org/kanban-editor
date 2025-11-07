Architektur-Plan für das automatische Laden vorhandener Boards des angemeldeten Users aus Nostr (Kind 30301) beim App-Start

Ziel:
Die bestehende Nostr-Pipeline (publish via SyncManager) wird um einen klar definierten Read-Path erweitert:
- Beim App-Start und Login werden alle relevanten Board-Events (Kind 30301) des Users aus den Relays geladen.
- Diese Events werden mit nostrEventToBoard in BoardModel-Instanzen gemappt.
- Die Boards werden im BoardStore als auswählbare Liste geführt und in localStorage gecached.
- Live-Updates via Nostr-Subscription aktualisieren den BoardStore laufend.
- Offline-First bleibt erhalten: Fallback auf localStorage, Last-Write-Wins über Nostr created_at.

Die folgenden Punkte sind so formuliert, dass ein Code-Mode sie direkt implementieren kann.

1. Verantwortlichkeiten und Konsistenz zu bestehenden Docs

- SyncManager (src/lib/stores/syncManager.svelte.ts:62-572)
  - Bleibt primär für:
    - publishOrQueue (Write-Pfad, Queue, Signing, Retry, Relay-Auswahl).
  - Für das Lesen/Abonnieren wird KEIN schwerer Logikteil in SyncManager verschoben.
  - Optional: kleine Utility-Hilfen für Status, aber Nostr-Reads passieren im BoardStore (oder separatem Reader), um AGENTS.md (Trennung Model/Store/Sync) konsistent zu halten.

- nostrEvents (src/lib/utils/nostrEvents.ts:27-317)
  - Liefert bereits:
    - boardToNostrEvent(board, ndk)
    - nostrEventToBoard(event)
    - cardToNostrEvent / nostrEventToCard
  - Damit ist das Mapping für Board-Discovery vollständig vorbereitet.
  - Wird direkt im BoardStore verwendet.

- BoardStore (src/lib/stores/kanbanStore.svelte.ts)
  - Ist schon:
    - Multi-Board-fähig (boardIds, getAllBoards, loadBoard, createBoard).
    - Nostr-Publishing-fähig (publishBoardAsync, publishCardAsync, publishCommentAsync via SyncManager).
  - Erweiterung:
    - Verantwortlich für Discovery, Import und Auswahl von Boards aus Nostr.
    - Nutzt nostrEvents.nostrEventToBoard und NDK Filter.

Diese Aufteilung folgt AGENTS.md und BOARDSTORE.md:
- Write-Pfad: BoardStore → nostrEvents → SyncManager → Relays.
- Read-Pfad: BoardStore → NDK (Filter/Subscribe) → nostrEvents → BoardModel → BoardStore State.

2. Öffentliche API-Erweiterungen im BoardStore

Ziel: Boards beim App-Start automatisch aus Nostr laden und dem UI zur Auswahl bereitstellen.

Vorgeschlagene Erweiterungen (konzeptionell, nicht als Code):

- boardStore.initializeNostr(ndk: NDK)
  - Existiert bereits (271-280).
  - Ergänzung:
    - Nach ndk-Set:
      - Wenn User authentifiziert:
        - loadBoardsFromNostrForCurrentUser() aufrufen.
        - subscribeToBoardUpdatesForCurrentUser() starten.

- boardStore.loadBoardsFromNostrForCurrentUser(): Promise<void>
  - Aufgaben:
    - Aktuellen User aus authStore holen:
      - pubkey = authStore.getPubkey() oder getPubkeySafe()
      - Falls kein pubkey: abbrechen, nur lokale Boards nutzen.
    - NDK Query:
      - Filter:
        - kinds: [30301]
        - authors: [pubkey] (eigene Boards)
        - Optional: zusätzliche Filter auf p-Tags, um Boards zu finden, bei denen der User Maintainer ist.
      - e.g. ndk.fetchEvents({ kinds: [30301], authors: [pubkey] })
    - Für jedes Event:
      - BoardProps via nostrEventToBoard(event).
      - In Board-Instanz umwandeln (new Board(BoardProps)).
      - In localStorage persistieren:
        - Key: kanban-{board.id}
        - boardIds aktualisieren (wenn neu).
      - created_at / updatedAt aus event.created_at ableiten.
    - Danach:
      - Falls aktuelles this.board noch leer oder nur Default:
        - Wähle ein Board als aktives:
          - Priorität: zuletzt verwendetes aus localStorage (MRU) falls kompatibel,
          - sonst das jüngste Nostr-Board (höchster created_at).
        - this.board = ausgewähltes Board, _columnOrder setzen, triggerUpdate.

- boardStore.getRemoteBoards()
  - Optional: read-only Liste aller aus Nostr geladenen Boards für UI.
  - Kann auf getAllBoards() aufsetzen, da Nostr-Boards beim Import gleich behandelt werden.

- boardStore.subscribeToBoardUpdatesForCurrentUser(): void
  - Aufgaben:
    - Startet eine dauerhafte NDK-Subscription auf:
      - Board-Events (Kind 30301) für den aktuellen User:
        - authors: [pubkey]
      - Optional: Boards, bei denen der User via p-Tag als Maintainer referenziert ist.
    - On event:
      - Ereignis via nostrEventToBoard(Event) in BoardProps wandeln.
      - Local Merge:
        - Falls Board-ID unbekannt:
          - Neues Board registrieren (localStorage + boardIds).
        - Falls bekannt:
          - Last-Write-Wins:
            - Vergleiche event.created_at mit lokalem updatedAt/lastSyncTimestamp.
            - Nur übernehmen, wenn neuer.
          - Board im storage aktualisieren und ggf. aktives Board, falls betroffen.
      - triggerUpdate, damit UI (BoardsList, aktuelles Board) reaktiv aktualisiert.

3. Nostr Board Discovery: Filter und Mapping

Discovery-Strategie für vorhandene Boards:

- Primär: eigene Boards
  - Filter:
    - kinds: [30301]
    - authors: [userPubkey]
  - Alle Events dieses Autors sind Kandidaten für Boards, die der User besitzt.

- Optional: Boards, bei denen User Maintainer/Co-Editor ist
  - Zwei Optionen:
    - a) Clientside Filter:
      - Events für relevante Relays abrufen,
      - in Tags alle p-Tags auswerten,
      - wenn p == userPubkey → Board als Co-Maintainer hinzufügen.
    - b) Selektive Filter (wenn Relays unterstützen):
      - NDK-Filter mit "#p": [userPubkey] zusätzlich testen.
  - Empfehlung: Start mit einfacher Variante:
    - fetchEvents({ kinds: [30301], authors: [userPubkey] })
    - Erweiterung für p-Tag Matching in einem zweiten Schritt.

Mapping mit nostrEvents.nostrEventToBoard:

- boardId:
  - Wird aus d-Tag oder event.id gewonnen.
- columns:
  - Kommen als col-Tags (id, name, order, color).
  - Karten werden separat per 30302 Events geladen (Phase 2).
- publishState, tags, ccLicense, maintainers:
  - Direkt aus den entsprechenden Tags.

BoardStore Import-Regeln (konzeptionell):

- Beim Import eines Nostr-Boards:
  - localStorage:
    - Speichern unter kanban-{board.id}.
  - boardIds:
    - Append, wenn nicht vorhanden.
  - Kein sofortiger UI-Switch:
    - UI wählt explizit oder folgt MRU-Regel.

4. Startup-Sequenz (App-Start automatisches Laden)

Ziel: Automatisch Boards aus Nostr laden, wenn ein User angemeldet ist.

Konzeptuelle Sequenz:

- +layout.svelte / +layout.js
  1. AuthStore initialisieren:
     - authStore lädt Session (z.B. aus localStorage oder NIP07).
  2. NDK initialisieren:
     - ndk.connect() mit konfigurierten Relays.
  3. SyncManager initialisieren:
     - initializeSyncManager(ndk, initialSigner?).
  4. BoardStore initialisieren (Singleton existiert bereits).
  5. boardStore.initializeNostr(ndk):
     - ndk speichern.
     - SyncManager (bereits via initializeSyncManager) ist bereit.
     - Wenn authStore.isAuthenticated:
       - boardStore.loadBoardsFromNostrForCurrentUser().
       - boardStore.subscribeToBoardUpdatesForCurrentUser().

- Login-Änderungen:
  - AuthStore ruft bei Login:
    - getSyncManager().updateSigner(newSigner).
    - boardStore.updateBoardAuthor() falls nötig.
    - boardStore.loadBoardsFromNostrForCurrentUser() erneut:
      - Stellt sicher, dass nach Login die aktuellen Nostr-Boards eingebunden sind.

5. Live-Subscription Architektur

Ziel: Board-Änderungen von anderen Sessions/Devices in Echtzeit reflektieren.

Konzept:

- In boardStore.subscribeToBoardUpdatesForCurrentUser():
  - NDK Subscription:
    - kinds: [30301]
    - authors: [userPubkey] (und optional #p: [userPubkey]).
    - closeOnEose: false.
  - Handler:
    - Für jedes eingehende Event:
      - boardProps = nostrEventToBoard(event).
      - existiert lokales Board mit boardProps.id?
        - Wenn nein:
          - Board neu anlegen (wie beim initialen Import).
        - Wenn ja:
          - Last-Write-Wins anhand event.created_at:
            - Wenn neuer:
              - lokales Board überschreiben (merge mit lokalen Metadaten nur, wenn nötig und definiert).
      - boardIds pflegen.
      - Wenn aktuelles Board betroffen:
        - this.board ersetzen, _columnOrder aktualisieren, triggerUpdate.

- Karten-Subscription (Kind 30302):
  - Geplante Erweiterung (Phase 2), nicht zwingend für jetzige Aufgabe.
  - Architektur bereits angelegt durch nostrEventToCard und upsertCard.

6. Konflikt- und Fallback-Strategie

- Last-Write-Wins:
  - Replaceable Events (30301/30302) folgen Nostr-Semantik:
    - Höchster created_at gewinnt.
  - BoardStore:
    - Beim Import/Update:
      - Vergleicht event.created_at mit lokalem updatedAt (falls vorhanden).
      - Nur aktualisieren, wenn event neuer ist.

- Offline-Fallback:
  - Wenn keine NDK-Verbindung oder kein Signer:
    - Nur lokale Boards aus localStorage nutzen (bestehende BoardStore-Logik).
    - loadBoardsFromNostrForCurrentUser() bricht früh ab.
  - Beim Wechsel zu online + authentifiziert:
    - loadBoardsFromNostrForCurrentUser() erneut ausführen.
    - MRU/Merge-Regeln anwenden.

7. Testspezifikation (High-Level)

Zu ergänzende Tests (in Einklang mit docs/TESTS/STATUS.md):

- syncManager.svelte.spec.ts:
  - Bereits: Queue, Retry, Signing, Offline/Online.
  - Ergänzend (leicht):
    - Sicherstellen, dass updateSigner() korrekt reagiert.
    - Kein direkter Read-Flow nötig, da Boards-Loading im BoardStore liegt.

- Neuer Test: boardStore.nostr-loading.spec.ts (oder Erweiterung bestehender BoardStore Tests)
  - Szenarien:
    - Bei vorhandenem User-Pubkey:
      - Mock NDK.fetchEvents für 30301.
      - Prüfen:
        - nostrEventToBoard wird aufgerufen.
        - boardIds enthält importierte IDs.
        - localStorage Keys kanban-{id} existieren.
    - Last-Write-Wins:
      - Zwei Events für dasselbe Board mit unterschiedlichem created_at.
      - Prüfen, dass die neuere Version im BoardStore landet.
    - Fallback:
      - Kein Pubkey: loadBoardsFromNostrForCurrentUser() ändert nichts.
      - Offline: keine Nostr-Abfragen.

8. UX-Fluss

- BoardsList.svelte:
  - Nutzt boardStore.getAllBoards() (bereits implementiert).
  - Nach Integration von Nostr-Lade-Logik:
    - Liste enthält:
      - Lokale Boards.
      - Aus Nostr importierte Boards.
  - Beim App-Start:
    - MRU-Regel: automatisch das zuletzt genutzte/aktuelle Board aktiv.
- Loading/Fehler:
  - Optional:
    - Kurzer Loading-State während initialem Nostr-Laden.
    - Debug-Anzeige über SyncManager.status.

9. Dokumentations- und DoD-Hinweise

Für eine saubere Umsetzung gemäß AGENTS.md und DOCUMENTATION-RULES-v3:

- BOARDSTORE.md:
  - Abschnitt "Nostr Integration" erweitern:
    - loadBoardsFromNostrForCurrentUser()
    - subscribeToBoardUpdatesForCurrentUser()
    - Startup-Sequenz.
- SYNCMANAGER.md:
  - Klarstellen: Fokus auf Publish/Queue, Read/Subscribe im BoardStore.
- ROADMAP.md:
  - Phase 1.2 / 1.3 aktualisieren: Read-Path implementiert.
- TESTS/STATUS.md:
  - Neue Specs für BoardStore-Nostr-Loading dokumentieren.
- CHANGELOG.md:
  - Eintrag: Nostr Board-Discovery + Auto-Loading.

10. Empfehlung für Implementation-Phase

Für die nächste Phase (Code-Mode):

- Implementation Steps:
  - loadBoardsFromNostrForCurrentUser() im BoardStore ergänzen (unter Nutzung von nostrEvents.nostrEventToBoard).
  - subscribeToBoardUpdatesForCurrentUser() implementieren.
  - initializeNostr(ndk) so erweitern, dass bei vorhandenem User automatisch geladen und subscribed wird.
  - AuthStore-Login Flow so ergänzen, dass nach erfolgreichem Login:
    - SyncManager.updateSigner() aufgerufen wird.
    - boardStore.loadBoardsFromNostrForCurrentUser() erneut ausgeführt wird.
  - Tests für diese Pfade hinzufügen.

Damit ist der Architektur-Plan abgeschlossen, konsistent mit AGENTS.md, den Stores-Dokumenten und der bestehenden Codebasis, und direkt umsetzbar für das automatische Laden vorhandener Boards des angemeldeten Users aus Nostr beim App-Start.