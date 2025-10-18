# Mitwirken am Projekt Edufeed-Kanban-Editor

👋 Hallo und vielen Dank für dein Interesse, an diesem Projekt mitzuwirken! Wir freuen uns über jede Unterstützung, sei es durch Code, Bug-Reports oder Verbesserungsvorschläge.

Unser Ziel ist es, eine dezentrale, KI-gestützte Anwendung für die kollaborative Unterrichtsentwicklung zu schaffen, die auf dem offenen Nostr-Protokoll basiert. Jeder Beitrag, der uns diesem Ziel näher bringt, ist wertvoll.

## Unsere Philosophie

Um zu verstehen, worauf wir Wert legen, hier unsere Leitprinzipien:

*   **Offline-First:** Die Anwendung muss jederzeit auch ohne Internetverbindung nutzbar sein.
*   **Dezentral und Zensurresistent:** Wir setzen auf Nostr, um die Hoheit über die Daten bei den Nutzern zu belassen. Es gibt keinen zentralen Server.
*   **Hervorragende User Experience:** Die Komplexität des Protokolls wird hinter einer schnellen, intuitiven und barrierearmen Benutzeroberfläche versteckt.
*   **Strenge Typisierung und klare Strukturen:** Wir nutzen TypeScript und klassenbasierte Modelle, um den Code wartbar und robust zu halten.

## Technischer Stack

Um mitwirken zu können, solltest du dich mit den folgenden Technologien auskennen:

*   **Framework:** Svelte 5 (mit Runes)
*   **Sprache:** TypeScript (im Strict-Modus)
*   **UI-Komponenten:** [shadcn-svelte](https://www.shadcn-svelte.com/)
*   **Protokoll:** Nostr (Erfahrung mit `nostr-dev-kit/ndk` ist ein großes Plus)
*   **Styling:** Tailwind CSS

## Loslegen – Deine Entwicklungsumgebung einrichten

1.  **Forke das Repository:** Erstelle eine eigene Kopie des Projekts auf GitHub.
2.  **Klone deinen Fork:**
    ```bash
    git clone https://github.com/DEIN-BENUTZERNAME/[projektname].git
    cd [projektname]
    ```3.  **Installiere die Abhängigkeiten:** Wir verwenden `pnpm` als Paketmanager.
    ```bash
    pnpm install
    ```
4.  **Starte den Entwicklungsserver:**
    ```bash
    pnpm dev
    ```
    Die Anwendung ist jetzt unter `http://localhost:5173` erreichbar.

## Projektstruktur – Wo finde ich was?

Um dich schnell zurechtzufinden, hier ein Überblick über die wichtigsten Verzeichnisse:

*   `src/lib/classes/BoardModel.ts`: **Das Herzstück der Anwendung.** Hier sind die Klassen `Board`, `Column`, `Card` und `Chat` definiert, die die gesamte Geschäftslogik kapseln.
*   `src/lib/stores/`: Hier liegen die globalen Svelte-Stores, die den Zustand der Anwendung verwalten.
    *   `kanbanStore.ts`: Verwaltet die aktive `Board`-Instanz.
    *   `syncManager.ts`: **(Gesucht!)** Kümmert sich um die Offline-Synchronisation.
*   `src/routes/cardsboard/`: Enthält alle Svelte-Komponenten für das Kanban-Board.
    *   `+page.svelte`: Das Hauptlayout der Seite.
    *   `Board.svelte`, `Column.svelte`, `Card.svelte`: Die UI-Komponenten, die die Daten aus den Klassen darstellen.
*   `src/lib/utils/`: Beinhaltet Hilfsfunktionen.
    *   `nostrEvents.ts`: **(Gesucht!)** Enthält die Logik zur Umwandlung unserer Klassen in Nostr-Events und zurück.
    *   `testSuite.ts`: Eine einfache Test-Suite, um die Kernlogik ohne externes Framework zu überprüfen.

## Wie du helfen kannst – Unsere Roadmap

Wir suchen aktuell vor allem Unterstützung in den folgenden Bereichen. Dies sind die wichtigsten fehlenden Bausteine, um die Anwendung voll funktionsfähig zu machen.

### 🎯 **Priorität 1: Nostr-Integration (`nostrEvents.ts`)**

Hier wird die Kernlogik implementiert, um unsere Board-Daten in Nostr-Events (gemäß dem definierten **Kanban-NIP**) zu übersetzen und umgekehrt.

*   **Aufgabe:** Implementiere die Funktionen in `src/lib/utils/nostrEvents.ts`:
    *   `boardToNostrEvent(board: Board): NDKEvent`
    *   `nostrEventToBoard(event: NDKEvent): BoardProps`
    *   `cardToNostrEvent(card: Card, ...): NDKEvent`
    *   `nostrEventToCard(event: NDKEvent): CardProps`
    *   `createCommentEvent(...)`
*   **Wo anfangen?** Schau dir die Spezifikation in der `AGENTS.md` (Abschnitt V.1) an. Dort findest du eine Beispiel-Implementierung und die genauen Anforderungen.

### 🎯 **Priorität 2: Offline-First Sync Manager (`syncManager.ts`)**

Diese Komponente ist entscheidend für die Offline-Fähigkeit. Sie verwaltet eine Warteschlange von Events, die gesendet werden müssen, sobald wieder eine Internetverbindung besteht.

*   **Aufgabe:** Entwickle die `SyncManager`-Klasse in `src/lib/stores/syncManager.ts`.
    *   Implementiere eine Event-Warteschlange (z.B. mit `svelte-persisted-store`).
    *   Erkenne den Online-/Offline-Status des Browsers.
    *   Implementiere eine `publishOrQueue`-Methode, die Events entweder direkt sendet oder in die Warteschlange einreiht.
    *   Integriere den `SyncManager` in den `BoardStore`, sodass jede Änderung (z.B. `moveCard`) automatisch zur Synchronisation vorgemerkt wird.
*   **Wo anfangen?** Die Architektur und eine detaillierte Vorlage für die Klasse findest du in `AGENTS.md` (Abschnitt VI).

### Weitere Möglichkeiten

*   **Verbesserung der UI/UX:** Findest du Stellen in der Benutzeroberfläche, die man intuitiver gestalten kann? Halte dich dabei an die Design-Patterns von `shadcn-svelte`.
*   **Bug-Reports:** Wenn du einen Fehler findest, erstelle bitte ein [Issue](https://github.com/DEIN-REPO/issues) und beschreibe so genau wie möglich, wie man ihn reproduzieren kann.
*   **Dokumentation:** Klare Dokumentation ist Gold wert. Wenn etwas unklar ist, hilf uns, es besser zu erklären.

## Unser Workflow: Von der Idee zum Merge

1.  **Finde eine Aufgabe:** Wähle ein offenes Issue oder eine der oben genannten Prioritäten. Gib im Issue kurz Bescheid, dass du daran arbeiten möchtest.
2.  **Erstelle einen Branch:** Erstelle einen aussagekräftigen Branch für dein Feature oder deinen Fix.
    ```bash
    git checkout -b feat/implement-nostr-serialization
    ```
3.  **Schreibe deinen Code:** Halte dich an die Coding-Konventionen (siehe unten).
4.  **Teste deine Änderungen:** Führe die Test-Suite aus, um sicherzustellen, dass die Kernfunktionalität weiterhin intakt ist. Erweitere die Suite gerne um Tests für deine neuen Funktionen.
    ```typescript
    // Du kannst die Suite z.B. über einen Test-Button in der UI aufrufen.
    import { runTestSuite } from '$lib/utils/testSuite';
    runTestSuite();
    ```
5.  **Committe deine Änderungen:** Wir folgen den [Conventional Commits](https://www.conventionalcommits.org/). Dies hilft uns, den Änderungsprozess nachzuvollziehen.
    *   `feat:` für neue Features (`feat(nostr): implement board serialization`)
    *   `fix:` für Bugfixes (`fix(ui): correct card dialog layout`)
    *   `docs:` für Änderungen an der Dokumentation
6.  **Erstelle einen Pull Request:** Pushe deinen Branch und erstelle einen Pull Request gegen den `main`-Branch des Haupt-Repositories. Beschreibe in der PR-Beschreibung, was du geändert hast und warum.

Vielen Dank, dass du deine Zeit und deine Fähigkeiten in dieses Projekt investierst! Gemeinsam können wir etwas Großartiges schaffen. 🚀