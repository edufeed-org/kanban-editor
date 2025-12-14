# Nostr Event Handling, Sync & Conflict Resolution

**Version:** 5.2 (Consolidated)
**Datum:** 14. Dezember 2025
**Status:** ✅ **ACTIVE** - Single Source of Truth
**Zweck:** Dieses Dokument konsolidiert alle Bug-Fixes und Architekturentscheidungen bezüglich Nostr-Event-Handling, Synchronisation und Konfliktlösung. Es ersetzt `BUG-FIX-ECHO-LOOP.md`, `BUG-FIX-LAST-WRITE-WINS.md` und `DND-ROBUSTNESS-FIX.md`.

---

## 🎯 Übersicht & Kernprinzipien

Die Synchronisation des Kanban-Boards über mehrere Browser/Tabs hinweg mittels Nostr erfordert eine robuste Strategie, um Datenverlust und eine inkonsistente UI zu verhindern. Unsere Architektur basiert auf drei Kernprinzipien:

1.  **Last-Write-Wins (LWW):** Das Event mit dem neuesten Zeitstempel gewinnt.
    - Boards (Kind `30301`): primär über `created_at` (Sekunden).
    - Cards (Kind `30302`): primär über `ts`-Tag (Millisekunden) falls vorhanden; Fallback `created_at`.
    - Bei Zeitgleichheit wird deterministisch per `event.id` getie-breakt, um „Same-Second“-Races zu vermeiden.
2.  **Echo-Prävention:** Eigene, von einem Client publizierte Events, die vom Relay zurückgesendet werden (Echos), werden erkannt und ignoriert, um doppelte Aktionen und UI-Flickern zu vermeiden.
3.  **Snapshot-basierte DnD-Synchronisation:** Bei Drag-and-Drop-Operationen wird vor der Zustandsänderung ein unveränderlicher "Snapshot" aller Kartenpositionen erstellt. Dies verhindert Race Conditions und das "Verschwinden" von Karten, insbesondere bei schnellen Links-nach-Rechts-Verschiebungen.

### Owned Boards vs. Shared Boards (WICHTIG)

Im System existieren zwei Board-Typen, die **beide dauerhaft erhalten bleiben müssen** (Persistenz in `localStorage`, Reload-Rekonstruktion, Nostr Sync):

- **Owned Boards:** Boards, bei denen der aktuelle Nutzer der Owner/Author ist (typisch: `event.pubkey === currentUserPubkey`).
- **Shared Boards:** Boards, bei denen der aktuelle Nutzer als **Maintainer** eingetragen ist.
    - Discovery erfolgt über Board-Events (Kind `30301`), die ein `p`-Tag für den Maintainer enthalten.
    - Wichtig: Shared Boards dürfen niemals durch „Owned-Only“ Cleanup-Logik gelöscht werden.

### Code-Struktur (Facade + Helper)

Damit die öffentliche API stabil bleibt, ist die Implementierung als **Facade** organisiert:

- **Facade:** `src/lib/stores/boardstore/nostr.ts` exportiert weiterhin `NostrIntegration` (alle öffentlichen Methoden bleiben unverändert).
- **Helper-Module:** `src/lib/stores/boardstore/nostr/*` kapseln Querschnittslogik:
    - `auth.ts` – Pubkey/Session-Abfragen
    - `time.ts` – Timestamp-Normalisierung (z.B. ISO ↔ Unix)
    - `commentCache.ts` – lokaler Kommentar-Cache (localStorage)
    - `deletionEventsCache.ts` – Persistenz verarbeiteter Deletion-Events (Size-Cap)

- **Domain-Modul (Events senden):** `src/lib/stores/boardstore/nostr/publish.ts`
    - Board/Card/Comment Publish
    - Deletion-Events (Board/Card/Comment)
    - Snapshot Publish

- **Domain-Modul (Kommentare):** `src/lib/stores/boardstore/nostr/comments.ts`
    - Kommentar-Merge-Strategie (Dedup + chronologische Sortierung)
    - `loadComments()` (Cache-first + Remote-Fetch + Persist)
    - `subscribeToComments()` (Live-Updates + deterministischer Cleanup)

Die Facade `NostrIntegration` delegiert diese „sendet Events“-Wege direkt an `publish.ts` und die Kommentar-Logik an `comments.ts` (Signaturen bleiben stabil, Call-Sites ändern sich nicht).

Die Code-Beispiele unten zeigen teils vereinfachte Logik. In der realen Implementierung werden Zeitstempel-Vergleiche zentral über `time.ts` normalisiert, um String-Vergleiche/Format-Mixups zu vermeiden.

### Subscription Lifecycle (Leak-/Duplikat-Vermeidung)

**Problemklasse:** In einem Multi-Board-/Multi-Tab Setup wird `subscribeToUpdates()` mehrfach aufgerufen (z.B. beim Board-Wechsel oder nach Reconnect). Ohne deterministischen Cleanup entstehen doppelte Listener, veraltete Subscriptions und im Worst-Case „Ghost Updates“.

**Strategie (verbindlich):**

- `NostrIntegration.subscribeToUpdates()` ruft zu Beginn `dispose()` auf und stoppt damit *alle* zuvor gestarteten Board-/Card-/Deletion-/Sharing-Subscriptions.
- Alle in `subscribeToUpdates()` erzeugten Subscriptions werden in einem gemeinsamen Cleanup-Wrapper getrackt (`boardSubscription.stop()`), damit ein einziger Stop alle Listener beendet.
- Kommentar-Subscriptions werden separat pro Card in einer Map getrackt und ebenfalls im zentralen `dispose()` beendet (zusätzlich zur pro-Card Cleanup-Funktion, die `subscribeToComments()` zurückgibt).

**Konsequenz:** Re-Subscribe ist idempotent (kein Memory Leak, keine doppelten Events), und „shared/follower/comment“ verhält sich im Cleanup genauso wie „boards/cards/deletions“.

---

## 🐛 Gelöste Probleme & Implementierungen

### 1. Problem: Datenverlust durch "Stale State" (Last-Write-Wins)

**Symptom:** Ein Nutzer öffnet ein Board in Browser A, das im `localStorage` veraltet ist. In Browser B wird eine Änderung vorgenommen (z.B. Spalte hinzufügen). Browser A publiziert beim Öffnen seinen alten Zustand und überschreibt damit die neuere Änderung von Browser B.

**Lösung: Last-Write-Wins (LWW) Check in `handleBoardEvent`**

Bevor ein eingehendes Board-Event angewendet wird, vergleichen wir dessen Zeitstempel mit dem `updatedAt`-Zeitstempel des Boards im lokalen Speicher.

**Datei:** `src/lib/stores/boardstore/nostr.ts`

```typescript
// in handleBoardEvent(...)
const { BoardStorage } = await import('./storage.js');
const localBoard = BoardStorage.loadBoard(boardProps.id);

// Zeitstempel immer normalisieren (ISO-String | number | undefined → number)
import { unixSecondsToMs, unknownTimestampToMs } from './nostr/time.js';

if (localBoard && localBoard.updatedAt) {
    const localTime = unknownTimestampToMs(localBoard.updatedAt);
    const eventTime = unixSecondsToMs(boardEvent.created_at);

    if (eventTime <= localTime) {
        console.log(`⏭️ LWW: Skip older/equal event`);
        return; // Überschreibe neuere lokale Daten nicht mit altem Event
    }
}

// Nur wenn das Event neuer ist, wird es angewendet
boardStore.upsertBoardFromNostr(boardProps);
```

**Damit dies funktioniert, müssen Timestamps korrekt durchgereicht werden:**

1.  **`nostrEvents.ts` (`nostrEventToBoard`):** Extrahiert `created_at` aus dem Event und wandelt es in einen ISO-String `updatedAt` um.
2.  **`operations.ts` (`upsertBoardFromNostr`):** Aktualisiert den `updatedAt`-Zeitstempel der Board-Instanz aus den `boardProps`.
3.  **`BoardModel.ts`:** Der `Board`-Konstruktor und das `BoardProps`-Interface akzeptieren `updatedAt`.

**Ergebnis:** Veraltete Events werden verworfen, Datenverlust wird verhindert.

### 1a. Problem: Same-Second-Race bei Card-Events (30302) führt zu „verlorenen“ Moves

**Symptom:** Bei schnellen, alternierenden Änderungen in zwei Clients (z.B. Card-Moves/Rank-Updates) können zwei Replaceable Card-Events im selben `created_at`-Sekundenfenster landen. Wenn LWW nur mit Sekundenauflösung vergleicht (`eventTime <= localTime`), wird ein legitimes Update sporadisch als „gleich/älter“ verworfen.

**Root Cause:** `created_at` hat nur Sekundenauflösung, lokale `updatedAt`-Werte sind ISO/Millisekunden. Bei hoher Frequenz entstehen Gleichstände.

**Lösung:** Millisekunden-Zeitstempel in Card-Events + deterministischer Tie-Break

- **Serialization:** `src/lib/utils/nostrEvents.ts` schreibt bei Card-Events zusätzlich `['ts', '<ms>']` und setzt `created_at` konsistent auf `Math.floor(ts/1000)`.
- **Deserialization:** `nostrEventToCard()` bevorzugt `ts` (ms) und reicht ihn als `updatedAt` (ISO) sowie intern als `updatedAtMs` durch.
- **Handler-LWW:** `src/lib/stores/boardstore/nostr/handlers/card.ts` nutzt `eventTimeMs` aus `updatedAtMs` (Fallback `created_at`) und wendet bei Gleichstand einen Tie-Break an:
    - Wenn `eventTimeMs === localTime`: akzeptiere nur, wenn `incomingEvent.id > localCard.eventId` (lexikographisch).

**Ergebnis:** Card-Moves/Rank-Updates werden bei schnellen Multi-Client-Aktionen deterministisch angewendet und nicht mehr „zufällig“ verworfen.

### 1b. Problem: Karten verschwinden nach Board-Metadata-Updates (30301 überschreibt lokale Cards)

**Symptom:** Ein Board-Event (Kind `30301`) enthält primär Metadata/Spaltenstruktur. Wenn dieser Zustand direkt nach `localStorage` persistiert wird, kann es passieren, dass lokale Spalten zwar aktualisiert werden, aber **Cards verloren gehen** (z.B. weil aus dem Event keine Cards rekonstruiert werden und die Persistierung das lokale `cards[]` überschreibt).

**Root Cause:** Persistierung eines „Board-Kontexts“ aus einem reinen Board-Event ohne Merge gegen den bereits lokal vorhandenen Board-State.

**Lösung:** Beim Persistieren von Board-Daten, die aus einem `30301` Event abgeleitet sind, muss eine **Card-Preservation-Merge-Strategie** angewandt werden:

- Spalten werden anhand `column.id` gemerged.
- Wenn das Event keine Cards enthält, werden lokale Cards pro Spalte beibehalten.
- Persistierung schreibt danach erst den gemergten Zustand in `localStorage`.

**Ziel:** Board-Metadata kann aktualisiert werden (Titel, Spaltenname/-farbe, Reihenfolge), ohne dass Cards verschwinden.

### 2. Problem: UI-Flickern durch Event-Echos ("Double-Move")

**Symptom:** Beim Verschieben einer Spalte springt diese kurz an die alte Position zurück und dann erst an die neue. Dies passiert, weil der Client sein eigenes publiziertes Event als fremdes Update interpretiert.

**Lösung: Tracking eigener publizierter Events**

Wir führen ein Set, das die IDs der selbst publizierten Events für eine kurze Zeit speichert. Eingehende Events, deren ID in diesem Set ist, werden als Echo erkannt und ignoriert.

**Datei:** `src/lib/stores/boardstore/nostr.ts`

```typescript
// Echo-Präventions-Logik
export class NostrIntegration {
    // ...
    private myPublishedEvents = new Set<string>();

    private isMyEvent(eventId: string): boolean {
        return this.myPublishedEvents.has(eventId);
    }

    public addMyEvent(eventId: string): void {
        this.myPublishedEvents.add(eventId);
        // Event nach einer Verzögerung aus dem Set entfernen, um Speicherlecks zu vermeiden
        setTimeout(() => {
            this.myPublishedEvents.delete(eventId);
        }, 5000); // 5 Sekunden Fenster
    }
}

// In handleBoardEvent(...)
if (nostr.isMyEvent(boardEvent.id)) {
    console.log('⏩ Echo-Event erkannt, wird ignoriert:', boardEvent.id);
    return;
}
```

**Ergebnis:** Kein UI-Flickern mehr, da Echos ignoriert werden. Die UI reagiert nur noch auf die initiale lokale Änderung und auf echte fremde Events.

### 2b. Problem: Shared Boards verschwinden nach Reload durch unsicheren Cleanup

**Symptom:** Shared Boards (Maintainer-Boards) sind zunächst sichtbar, verschwinden aber nach einem Reload oder nach einer Sync-Phase.

**Root Cause:** Cleanup-Logik, die lokal gespeicherte Boards entfernt, wenn sie nicht in einer „Owned Boards“-Relay-Abfrage enthalten waren.

**Lösung:** Es darf keinen Cleanup geben, der Boards ausschließlich anhand „Owned Boards“-Fetch-Ergebnissen entfernt.

- Deletion von Boards erfolgt ausschließlich über **explizite Deletion-Events (Kind `5`)** oder eine bewusste User-Aktion.
- Shared Boards bleiben persistent, auch wenn ein „owned boards“-Fetch sie naturgemäß nicht zurückliefert.

### 3. Problem: Verschwindende Karten bei Drag & Drop

**Symptom:** Beim schnellen Verschieben von Karten, insbesondere von einer linken in eine rechte Spalte, verschwinden diese manchmal aus der UI.

**Root Cause:** Race Condition. Der Code hat das `board.columns`-Array mutiert, während er noch darüber iteriert hat, um die Karten neu zuzuordnen. Eine von links nach rechts verschobene Karte wurde aus ihrer Ursprungsspalte entfernt, bevor die Zielspalte verarbeitet wurde. Die Karte wurde dann in der (bereits modifizierten) Board-Struktur nicht mehr gefunden.

**Lösung: Snapshot-basierte Synchronisation**

Vor jeder Zustandsänderung wird ein kompletter Snapshot (eine `Map`) aller Karten und ihrer Positionen erstellt. Die Neuordnung der Karten basiert dann auf diesem unveränderlichen Snapshot, nicht auf dem sich ändernden Live-Zustand.

**Datei:** `src/lib/stores/boardstore/operations.ts` (`syncBoardState`)

```typescript
export function syncBoardState(board: Board, uiColumns: UIColumn[]) {
    // 1️⃣ SNAPSHOT: Alle Karten und ihre alten Positionen erfassen, BEVOR etwas geändert wird.
    const cardRegistry = new Map<string, { card: Card; oldColumnId: string }>();
    for (const col of board.columns) {
        for (const card of col.cards) {
            cardRegistry.set(card.id, { card, oldColumnId: col.id });
        }
    }

    const processedCardIds = new Set<string>();

    // 2️⃣ Spalten-Reihenfolge synchronisieren
    board.columns = uiColumns
        .map(uiCol => board.columns.find(c => c.id === uiCol.id))
        .filter((c): c is Column => c !== undefined);

    // 3️⃣ Karten-Positionen synchronisieren (mit Lesezugriff auf den Snapshot)
    for (const uiCol of uiColumns) {
        const col = board.columns.find(c => c.id === uiCol.id);
        if (!col) continue;

        const newCards: Card[] = [];
        for (const uiCard of uiCol.items) {
            if (processedCardIds.has(uiCard.id)) continue; // Duplikate verhindern

            // 🎯 KRITISCH: Lese aus dem immutable Snapshot, nicht aus dem Live-Board!
            const snapshot = cardRegistry.get(uiCard.id);
            if (snapshot) {
                newCards.push(snapshot.card);
                processedCardIds.add(snapshot.card.id);
            }
        }
        col.cards = newCards; // Diese Mutation ist jetzt sicher.
    }
    // ...
}
```

**Zusätzliche Robustheit:**
*   **Debouncing:** DnD-Events werden für 150ms gesammelt, bevor ein Sync- und Publish-Vorgang ausgelöst wird, um Event-Fluten zu vermeiden.
*   **Sequentielles Publishing:** Board-Updates werden immer *vor* den dazugehörigen Karten-Updates publiziert (`await publishBoardAsync()` vor `await publishCardAsync()`).

**Ergebnis:** Drag & Drop ist jetzt robust, schnell und konsistent, unabhängig von der Richtung oder Geschwindigkeit der Verschiebung.

---

## 🔮 Zukünftige Architektur (Geplant für v2.0)

Die aktuelle Architektur ist ein reaktives System, das auf Zustandsänderungen reagiert. Für v2.0 ist eine **Event-Driven Architecture** geplant, bei der Nostr-Events als direkte **Befehle (Commands)** an den Store behandelt werden.

**Konzept:**
*   `Event Kind 30301` (Board) → `boardStore.upsertBoardFromNostr(props)`
*   `Event Kind 30302` (Card) → `boardStore.upsertCardFromNostr(props)`
*   `Event Kind 5` (Deletion) → `boardStore.deleteCardFromNostr(cardId)`

**Vorteil:** Dies würde die Notwendigkeit komplexer Merge-Logik weiter reduzieren und eine noch klarere Trennung zwischen User-Aktionen (Primary Actions, die publizieren) und Nostr-Events (Secondary Actions, die nicht zurück publizieren) schaffen.

**Status:** Die Spezifikation hierfür (`EVENT-DRIVEN-ARCHITECTURE-PLANNED-v2.0.md`) wurde zur besseren Fokussierung auf die aktuellen Aufgaben temporär archiviert.

---

## 📚 Referenzen & Weiterführende Dokumente

*   **Archivierte Dokumente:**
    *   `docs/archive/BUG-FIX-ECHO-LOOP.md`
    *   `docs/archive/BUG-FIX-LAST-WRITE-WINS.md`
    *   `docs/archive/DND-ROBUSTNESS-FIX.md`
    *   `docs/archive/EVENT-DRIVEN-ARCHITECTURE-PLANNED-v2.0.md`
*   **Aktive Architektur-Dokumente:**
    *   `docs/ARCHITECTURE/STORES/BOARDSTORE.md`
    *   `docs/ARCHITECTURE/ECHO-PREVENTION-FLOW.md`
*   **Roadmap:**
    *   `docs/COLLABORATION/ROADMAP.md`
