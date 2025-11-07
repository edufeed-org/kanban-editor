# NIP-Vorschlag: Erweiterung von Kanban-Boards mit Community-Funktionen

**Status:** Vorschlag  
**Bezug:** Baut auf dem bestehenden `Kanban-NIP.md` auf.

## 1. Motivation

Das existierende `Kanban-NIP.md` definiert eine robuste, in sich geschlossene Methode zur Erstellung von Kanban-Boards auf Nostr, inklusive einer einfachen Zugriffskontrolle über "Maintainer"-Listen (`p`-Tags).

Für größere Teams, öffentliche Projekte oder komplexere Anwendungsfälle wird jedoch eine flexiblere und granularere Rechteverwaltung benötigt. Dieses Dokument beschreibt, wie ein Kanban-Board durch die Integration von Community-Konzepten (inspiriert von Communikey und NIP-58 Badges) erweitert werden kann, um ein vollwertiges Kollaborationstool mit Rollen und Rechten zu werden.

## 2. Kernkonzept: Das Board als Community

Die zentrale Idee ist, dass die Identität eines Kanban-Boards – sein `pubkey` – gleichzeitig als Identität für eine zugehörige Community dient.

- **`kind: 30301` (Board-Event):** Definiert die **Struktur** des Boards (Titel, Spalten etc.), wie im ursprünglichen NIP beschrieben.
- **`kind: 10222` (Community-Event):** Definiert die **sozialen Regeln** und Zugriffsrechte für das Board (Wer darf was?).

Beide Events werden vom selben `pubkey` (`BOARD_PUBKEY`) veröffentlicht und sind somit untrennbar miteinander verbunden.

### Verknüpfungsmechanismus

Ein Client verknüpft ein Board mit seiner Community, indem er den `pubkey` des `kind: 30301` Events als Referenz nimmt und nach einem `kind: 10222` Event vom selben Autor sucht.

## 3. Implementierung: Rollenbasierte Zugriffskontrolle

Anstatt einer einfachen "Maintainer"-Liste ermöglicht dieser Ansatz die Definition beliebiger Rollen (z.B. Admin, Editor, Viewer) mittels **NIP-58 Badges**.

### Schritt 1: Rollen als Badges definieren (`kind: 30009`)

Der Board-Admin (der `BOARD_PUBKEY`) definiert für jede Rolle ein Badge.

**Beispiel: Definition des "editor"-Badges**
```json
{
    "kind": 30009,
    "pubkey": "<BOARD_PUBKEY>",
    "tags": [
        ["d", "editor"],
        ["name", "Editor"],
        ["description", "Kann Karten auf diesem Board erstellen und bearbeiten"]
    ]
}
```

### Schritt 2: Berechtigungen festlegen (`kind: 10222`)

Das Community-Event legt fest, welche Rolle (welches Badge) für welche Aktion erforderlich ist.

**Beispiel: Nur "Editoren" dürfen Karten erstellen**
```json
{
    "kind": 10222,
    "pubkey": "<BOARD_PUBKEY>",
    "tags": [
        // ... andere Community-Tags
        ["content", "Kanban Card"],
        ["k", "30302"], // Das Karten-Kind aus dem Kanban-NIP
        // Die folgende "a"-Tag ist die Regel:
        ["a", "30009:<BOARD_PUBKEY>:editor"] // Erfordert das "editor"-Badge
    ]
}
```

### Schritt 3: Rollen an Benutzer vergeben (`kind: 8`)

Der Admin verleiht die Rollen, indem er `kind: 8` (Badge Award) Events veröffentlicht.

**Beispiel: Alice und Bob werden zu Editoren ernannt**
```json
{
    "kind": 8,
    "pubkey": "<BOARD_PUBKEY>",
    "tags": [
        // Verweist auf die Badge-Definition
        ["a", "30009:<BOARD_PUBKEY>:editor"],
        // Verleiht das Badge an die folgenden pubkeys
        ["p", "<alice_pubkey>"],
        ["p", "<bob_pubkey>"]
    ]
}
```

## 4. Client-Workflow zur Rechteprüfung

Um zu prüfen, ob ein Benutzer eine Aktion ausführen darf, muss ein Client folgenden Prozess durchlaufen:

1.  **Board laden (`kind: 30301`)** -> `BOARD_PUBKEY` extrahieren.
2.  **Community-Regeln laden (`kind: 10222`)** -> Die für die Aktion erforderliche Badge-Definition (`a`-Tag) finden.
3.  **Badge-Inhaber finden (`kind: 8`)** -> Alle `pubkey`s sammeln, denen dieses Badge verliehen wurde.
4.  **Prüfen:** Ist der `pubkey` des aktuellen Benutzers in der Liste der Badge-Inhaber?

### Abwärtskompatibilität (Fallback)

Zur Wahrung der Abwärtskompatibilität sollten Clients, die dieses NIP implementieren, immer zuerst nach einem `kind: 10222` Event suchen. Wird keines gefunden, greifen die im ursprünglichen `Kanban-NIP.md` definierten Regeln (die `p`-Tag-Liste der Maintainer im `kind: 30301` Event).

## 5. Beispiel-Implementierung mit NDK

Das Nostr Development Kit (NDK) vereinfacht diesen komplexen Abfrageprozess erheblich. Das folgende TypeScript-Beispiel zeigt den vollständigen Workflow.

```typescript
import NDK, { NDKEvent, NostrEvent } from "@nostr-dev-kit/ndk";

// Annahme: Diese Konstante ist bekannt (z.B. aus der URL)
const BOARD_PUBKEY = "dein-board-pubkey-hier";

// 1. NDK initialisieren
const ndk = new NDK({
    explicitRelayUrls: ["wss://relay.damus.io", "wss://relay.primal.net"],
});

async function fetchBoardData(boardPubkey: string) {
    console.log(`Starte Abfrage für Board mit Pubkey: ${boardPubkey}`);

    // 2. Board-Struktur (kind: 30301) abfragen
    const boardEvent = await ndk.fetchEvent({
        kinds: [30301],
        authors: [boardPubkey],
    });

    if (!boardEvent) {
        console.error("Board nicht gefunden!");
        return;
    }
    const boardTitle = boardEvent.tags.find(t => t[0] === 'title')?.[1] || "Unbenanntes Board";
    const boardDIdentifier = boardEvent.tags.find(t => t[0] === 'd')?.[1];
    console.log(`Board gefunden: "${boardTitle}"`);

    // 3. Community-Regeln (kind: 10222) für erweiterte Rechte abfragen
    const communityRulesEvent = await ndk.fetchEvent({
        kinds: [10222],
        authors: [boardPubkey],
    });

    let editorPubkeys = new Set<string>();

    if (communityRulesEvent) {
        console.log("Erweiterte Community-Regeln (kind: 10222) gefunden...");
        // 4. Finde die Regel für "editor"-Badges
        const editorBadgeTag = communityRulesEvent.tags.find(
            (t) => t[0] === "a" && t[1].endsWith(":editor")
        );

        if (editorBadgeTag) {
            const editorBadgeIdentifier = editorBadgeTag[1];
            console.log(`Editor-Rolle erfordert Badge: ${editorBadgeIdentifier}`);

            // 5. Finde alle Events, die dieses Badge verleihen (kind: 8)
            const badgeAwardEvents = await ndk.fetchEvents({
                kinds: [8],
                "#a": [editorBadgeIdentifier],
            });

            for (const event of badgeAwardEvents) {
                event.tags.filter(t => t[0] === 'p').forEach(t => editorPubkeys.add(t[1]));
            }
            console.log(`Gefundene Editoren (${editorPubkeys.size}):`, Array.from(editorPubkeys));
        }
    } else {
        // Fallback-Logik
        console.log("Keine Community-Regeln gefunden. Nutze 'p'-Tags aus dem Board als Fallback.");
        boardEvent.tags.filter(t => t[0] === 'p').forEach(t => editorPubkeys.add(t[1]));
        console.log(`Gefundene Maintainer (${editorPubkeys.size}):`, Array.from(editorPubkeys));
    }

    // 6. Lade alle Karten (kind: 30302), die zu diesem Board gehören
    if (!boardDIdentifier) return;
    const boardAddress = `30301:${boardPubkey}:${boardDIdentifier}`;
    const cardEvents = await ndk.fetchEvents({
        kinds: [30302],
        "#a": [boardAddress],
    });

    console.log(`
--- ERGEBNIS ---`);
    console.log(`Board: ${boardTitle}`);
    console.log(`Editoren/Maintainer: ${editorPubkeys.size}`);
    console.log(`Anzahl der Karten: ${cardEvents.size}`);
}

// Verbindung aufbauen und die Funktion ausführen
ndk.connect().then(() => {
    console.log("NDK verbunden.");
    fetchBoardData(BOARD_PUBKEY).catch(console.error);
});
```

## 6. Vorteile dieses Ansatzes

- **Granulare Rollenverwaltung:** Ermöglicht die Definition beliebig vieler Rollen (Admin, Editor, Viewer, Commenter etc.).
- **Skalierbarkeit:** Die Verwaltung von Mitgliedern in großen Teams oder über mehrere Boards hinweg wird erheblich vereinfacht.
- **Interoperabilität:** Badges können potenziell auch von anderen Clients oder Diensten erkannt und genutzt werden.
- **Flexibilität:** Rollen können vergeben und entzogen werden, ohne das Kern-Event des Boards (`kind: 30301`) ändern zu müssen.
