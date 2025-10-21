Notizen für Kanban-ähnliches Board

Diese Notizen beziehen sich auf die Konzeption eines Kanban-ähnlichen Boards. Als grundlegende Voraussetzung für die Arbeit daran wird die Klärung der Funktionsweise eines solchen Boards genannt.

Die Funktionalität des Boards soll einem üblichen Kanban Board ähneln.

## Datenhaltung und Systemarchitektur

Ein grundlegendes Merkmal des Systems ist, dass die **Boards** und deren gesamte **Inhalte** primär im **Browser Storage** des Nutzers gespeichert werden. Die Verwaltung ist somit **an den Webbrowser gebunden**.

Um den Austausch und die Sicherung von Board-Inhalten zu ermöglichen, sind **Export**- und **Import**-Funktionen vorgesehen. Die Inhalte sollen bei Bedarf im **JSON**-Format exportiert und importiert werden können. Ein Ziel für den Export/Import könnte beispielsweise ein **Git-Repository** sein, um Versionierung und Kollaboration zu unterstützen.

## Board Dashboard

Bevor ein einzelnes Board betrachtet wird, ist ein übergeordnetes Dashboard vorgesehen, um die Verwaltung mehrerer Boards zu ermöglichen.

Dieses Dashboard dient primär folgenden Zwecken:

*   Neue Boards anzulegen.
*   Vorhandene Boards aufzurufen.
*   Boards zu verwalten.

Kernfunktion des Dashboards ist die Auflistung aller verfügbaren Boards. Diese Auflistung soll visuell ansprechend, idealerweise in Kärtchen- oder Kachelform, erfolgen, um einen schnellen Überblick zu ermöglichen.

Ein deutlich sichtbarer "Plus"-Button soll die einfache und direkte Erstellung neuer Boards ermöglichen.

## Board-Header

Das Board soll über einen dedizierten **Header-Bereich** verfügen. Dieser Header dient der übergeordneten Information und Navigation für das gesamte Board.

Der Header soll folgende Elemente enthalten:

*   Einen **Titel** oder eine Überschrift für das Board.
*   Eine Liste der daran arbeitenden **Autoren**.
*   Eine **Zusammenfassung des Inhalts** des Boards.

**Optionale KI-Integration für die Inhaltszusammenfassung:**

Die **Inhaltszusammenfassung** im Header könnte optional durch eine **KI-Funktion** unterstützt oder angereichert werden (siehe auch Abschnitt "KI-Integration: Konfiguration und Einsatzzwecke"). Diese KI würde den Inhalt aller Spalten und Kärtchen des Boards analysieren und basierend darauf eine **Zusammenfassung** generieren. Zur Auslösung dieser Funktion soll ein dedizierter **KI-Button** bereitgestellt werden, der die automatische Generierung und Aktualisierung des Header-Inhalts (speziell der Zusammenfassung der Boardinhalte) ermöglicht.

## Board Struktur und Spalten

Ein zentrales Element des Boards sind die **Spalten (auch Lanes genannt)**, die vom Benutzer angelegt werden können. Jede Spalte soll eine vom Benutzer definierbare **Überschrift** und einen **Bescheibungstext** (Kontext) erhalten können. Der Beschreibungstext (Zum Beispiel Lernziele) soll nicht angezeigt werden, dient aber als Kontext für die KI-basierte Generierung von weiteren Kärtchen.

Für die Verwaltung der Spalten sind verschiedene Wege vorgesehen:

*   **Verwaltung über das UI (Drei-Punkte-Menü):** Über ein spezifisches Drei-Punkte-Menü pro Spalte sind folgende Optionen verfügbar:
    *   Der Spalte eine Hintergrund **Farbe** aus einer vorgegeben Farbpalette mit Farbverläufen.
    *   Die Überschrift der Spalte festlegen/ändern
    *   Den Kontext / Beschreibungstext der Spalte erstellen oder mit KI generieren lassen, der dann den Prompt Kontext für den **Button: AI: Kärtchen generiern** liefert.
    *   Den **Inhalt der spezifischen Spalte** separat zu **exportieren** oder **auszudrucken**.
    *   Eine Konvertierung des Spalteninhalts in **andere Formate** zu ermöglichen, z.B. **Markdown**.

*   **Verwaltung über die API:** Die einzelnen Spalten und die damit verbundenen Eigenschaften sollen auch über eine **API verwaltbar** sein. Über die API sind folgende Aktionen möglich:
    *   Eine **neue Spalte hinzufügen**.
    *   Die **Farbe der Spalte** festlegen.
    *   Die **Überschrift der Spalte** festlegen.
    *   Die **Kontext Beschreibung der Spalte** festlegen.
    *   Den **Button: AI: Kärtchen generiern**, der automatisch zum Kontext passende Kärtchen generiert.
    *   Die **Exportfunktion** für eine Spalte nutzen.
    *   Die **Importfunktion** von Kärtchen in die bestehende Spalte (zum Beispiel aus einer exportierten Spalte) nutzen.

## Erstellung neuer Kärtchen

Die Erstellung neuer Kärtchen kann auf verschiedene Weisen erfolgen:

*   Über ein **UI-Element** wie einen **Plus-Button** (+). Beim Anlegen über dieses Symbol kann die gewünschte Spalte **manuell ausgewählt** werden. Erfolgt **keine manuelle Auswahl**, wird das Kärtchen **automatisch** der **linken Spalte** des Kanban Boards hinzugefügt.
*   Über eine **API**. Die API-Option ist wichtig, um die Erstellung **in einen externen Workflow-Prozess auszulagern**, z.B. zur Generierung vieler Kärtchen auf einmal. Für die Erstellung via API muss die Schnittstelle die Angabe folgender Kerninformationen ermöglichen: das **Heading** (oder die Überschrift) des neuen Kärtchens, der **Inhalt** sowie die gewünschte **Spalte**, zu der das Kärtchen hinzugefügt werden soll.

Unabhängig vom Auslöser (UI oder API) soll die initiale Erfassung neuer Kärtchen typischerweise die benötigten Informationen strukturiert übermitteln, idealerweise über ein **Modal Window zur Erstellung/Verwaltung von Kärtchen** (siehe Abschnitt "Umgang mit bestehenden Kärtchen" und "Konfiguration des Boards..."). Für die Content-Erstellung in diesem Kontext sind verschiedene Eingabearten vorgesehen: die direkte Eingabe von Text, die Nutzung von ChatGPT (beispielsweise für Inhaltserstellung oder Bildgenerierung basierend auf Chat-Fragen, siehe auch "KI-Integration: Konfiguration und Einsatzzwecke") sowie die Generierung von Bildern.

## Struktur eines einzelnen Kärtchens

Kernkomponenten: einen **Header** für Überschrift, einen dedizierten **Rich-Content-Bereich** für den Inhalt des Kärtchens sowie eine integrierte **Kommentarfunktion** für Diskussionen oder Notizen zum Kärtchen.

## Umgang mit bestehenden Kärtchen

Für die Interaktion mit bestehenden Kärtchen auf dem Board und deren Bearbeitung sind verschiedene Funktionen vorgesehen:

*   **Bewegen von Kärtchen (Drag & Drop):** Jedes Kärtchen muss per Drag & Drop **innerhalb und zwischen den Spalten** bewegt werden können. Hierfür ist ein spezifischer **Drag and Drop Bereich** vorgesehen, der am besten im **Header** des Kärtchens positioniert sein sollte.
*   **Bewegen von Spalten (Drag & Drop):** Jede Spalte muss per Drag & Drop **in der Reihenfolge horizontal** bewegt werden können. Hierfür ist ein spezifischer **Drag and Drop Bereich** vorgesehen, der am besten im **Header** des Kärtchens positioniert sein sollte.
*   **Sichtbarkeit und Status (Verbergen/Inaktiv setzen):** Es soll eine Möglichkeit geben, das Kärtchen durch Klick auf ein **Auge-Icon** **in der aktuellen Spalte als inaktiv** zu markieren (oder zu verbergen). Der Zweck dieser Funktion ist, anzudeuten, dass die Karte **im Workflow dieser Spalte ignoriert** werden soll.
*   **Bearbeitung und weitere Aktionen (via Kärtchen-Modal):** Detaillierte Bearbeitung, erweiterte Konfiguration und zusätzliche Kärtchen-bezogene Aktionen erfolgen über das **Modal Window zur Erstellung/Verwaltung von Kärtchen**. Dieses wird durch das Klicken auf die **drei Punkte** ausgelöst, die sich **oben rechts neben dem Header** des Kärtchens befinden sollen. Dieses Modal dient als primäre Schnittstelle für die Bearbeitung, Verwaltung und Konfiguration von Kärtchen (siehe auch Abschnitt "Konfiguration des Boards...").

Innerhalb dieses über die drei Punkte zugänglichen Modals sind folgende Funktionen und Überlegungen vorgesehen:

*   **Content-Bearbeitung und Eingabe:**
    *   Das Modal Fenster für das Kärtchen Settings  hat ein Inputfeld für das Heading,
    *   Darunter sind zwei Tabs: **Bearbeiten** & **KI Genrator**
    *   In Bearbeiten Tabl muss ein **Texteditor** für die Texteingabe integriert sein. Empfohlen wird ein **WYSIWYG**- **Markdown-Editor** und  **Speichern** Button
    *   Im KI TAB ist ein einfaches Textarea  für den Prompt, darunter Auswahlkästchen für den Kontext und  "Generieren" Button. 
    Die beiden Ankreuzkästen haben die Optionen: **Beschreibungstext** der Spalte und **Alle Kärtchen der Spalte** Die Inhalte werden ebim senden des Promps als Kontext an die chat api des Models verschickt.  Der durch das AI generierte Inhalt ist anschließend im Editor Panel zu sehen.  
    *   Vorschlag für Schaltflächen: "**Senden**" (für Übernahme als Inhalt) und "**Als Prompt verwenden**".

Darüber hinaus sollen über dieses Menü/Modal auch andere Kärtchen-bezogene Aktionen zugänglich sein, wie:
*   Dem Kärtchen eine Hintergrund-**Farbe zuweisen** aus einer Farbpalette.


## Konfiguration des Boards und seiner Elemente

Zusätzlich zu den funktionalen Aspekten wurden auch erweiterte Konfigurationsmöglichkeiten für das Board und seine einzelnen Elemente (Spalten, Kärtchen) definiert.

### Konfigurierbare Eigenschaften des Boards

Neben dem bereits im Header definierten Heading sollen für das Board selbst folgende Eigenschaften festgelegt werden können:

*   Eine **Hintergrundfarbe** oder ein **Hintergrundbild**.
*   Das Festlegen und Modifizieren eines **Custom CSS Style** für das gesamte Board.

### Bedienung und Konfigurations-Oberfläche

Die erweiterte Konfiguration der verschiedenen Board-Elemente soll über dedizierte **Modal Windows** erfolgen:

*   Ein **Modal Window** zur Erstellung und Verwaltung von **Kärtchen**.
*   Ein **Modal Window** zur Verwaltung von **Spalten**.
*   Ein **Modal Window** zur Verwaltung des **Boards**.

Die Bedienung und die grundlegende Funktionalität dieser spezifischen Konfigurations-Modal Windows sind dabei weitgehend **identisch** aufgebaut, um eine konsistente Nutzererfahrung zu gewährleisten.

### Custom Styling 

Innerhalb Modal Windows für die Board Einstellungen soll die Möglichkeit bestehen, einen **individuellen CSS-Style** für das jeweilige Element festzulegen. Dies ermöglicht eine detaillierte optische Anpassung.

### KI-Integration: Konfiguration und Einsatzzwecke

Die Integration von KI-Funktionen ist vorgesehen, um verschiedene Aufgaben zu unterstützen. Für die Nutzung der KI muss der Benutzer die Möglichkeit erhalten, den zu verwendenden **LLM Provider** sowie den entsprechenden **API-Code** zu hinterlegen. Für die Konfiguration der Connection zum BOARD wichtig: BASE_URL, MODEL_NAME, API_KEY. Zusätzlich sollte ein n8n webhook + apikey definiert werden können, dass die Anfragen ein geleicher weise wie ein openAI Chatmodel annimmt und zurückgibt.


Die Hauptzwecke der KI-Integration umfassen:

*   Das **Generieren** von Inhalten (z.B. Kärtchen-Text, Bildbeschreibungen, Vorschläge).
*   Das **Moderiern** von Inhalten (z.B. Überprüfung, Formatierung, Anreicherung, Zusammenfassung ).

Diese konfigurierbare KI-Funktion kann an verschiedenen Stellen im System eingesetzt werden, wie bereits erwähnt für die automatische Inhaltszusammenfassung im Board-Header oder zur Generierung von Inhalten im Kärtchen-Modal.