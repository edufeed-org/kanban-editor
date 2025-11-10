# Nostr Event Handling, Sync & Conflict Resolution

**Version:** 5.0 (Consolidated)
**Datum:** 10. November 2025
**Status:** ✅ **ACTIVE** - Single Source of Truth
**Zweck:** Dieses Dokument konsolidiert alle Bug-Fixes und Architekturentscheidungen bezüglich Nostr-Event-Handling, Synchronisation und Konfliktlösung. Es ersetzt `BUG-FIX-ECHO-LOOP.md`, `BUG-FIX-LAST-WRITE-WINS.md` und `DND-ROBUSTNESS-FIX.md`.

---

## 🎯 Übersicht & Kernprinzipien

Die Synchronisation des Kanban-Boards über mehrere Browser/Tabs hinweg mittels Nostr erfordert eine robuste Strategie, um Datenverlust und eine inkonsistente UI zu verhindern. Unsere Architektur basiert auf drei Kernprinzipien:

1.  **Last-Write-Wins (LWW):** Das Event mit dem neuesten Zeitstempel (`created_at`) gewinnt immer. Ältere oder gleichzeitige Events werden ignoriert, um zu verhindern, dass veraltete Daten (stale state) aus dem `localStorage` neuere Zustände überschreiben.
2.  **Echo-Prävention:** Eigene, von einem Client publizierte Events, die vom Relay zurückgesendet werden (Echos), werden erkannt und ignoriert, um doppelte Aktionen und UI-Flickern zu vermeiden.
3.  **Snapshot-basierte DnD-Synchronisation:** Bei Drag-and-Drop-Operationen wird vor der Zustandsänderung ein unveränderlicher "Snapshot" aller Kartenpositionen erstellt. Dies verhindert Race Conditions und das "Verschwinden" von Karten, insbesondere bei schnellen Links-nach-Rechts-Verschiebungen.

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

if (localBoard && localBoard.updatedAt) {
    const localTime = new Date(localBoard.updatedAt).getTime();
    const eventTime = boardEvent.created_at * 1000;

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
