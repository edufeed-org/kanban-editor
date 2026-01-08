# Manual Testing Guide für Kanban Board

**Datum:** 07. Januar 2026  
**Zielgruppe:** QA Tester, Beta Tester, Entwickler  
**Seite:** [edufeed-org.github.io/kanban-editor/cardsboard](https://edufeed-org.github.io/kanban-editor/cardsboard)
**Wo soll ich berichten:** [github.com/edufeed-org/kanban-editor/issues/new/choose](https://github.com/edufeed-org/kanban-editor/issues/new/choose)

---

## 📋 Inhaltsverzeichnis

1. [Testumgebung & Setup](#testumgebung--setup)
2. [Funktionale Tests](#funktionale-tests)
3. [Accessibility Tests](#accessibility-tests)
4. [Browser-Kompatibilität](#browser-kompatibilität)
5. [Mobile & Responsive Tests](#mobile--responsive-tests)
6. [Fehlerberichterstattung](#fehlerberichterstattung)
7. [Sicherheitstests (nur für Devs)](#sicherheitstests-nur-fur-devs)

---

## ✅ Funktionale Tests

### 1. Board Management

#### 1.1 Demo Board System (Anonyme User)
- [ ] **Test:** Als anonymer User (ohne Login) App öffnen
- [ ] **Fragen:**: Hat Anonymer Benutzer genügend den Schmack, wie es ist, die App zu benutzen? Welcher Funktionalitäten würden einen dazu führen, sich einzuloggen? Was funktioniert nicht gut?

**Sich einloggen und:**

#### 1.2 Board erstellen
- [ ] **Aktion:** Klick auf "Neues Board erstellen"
- [ ] **Erwartung:** Neues Board ist verfügbar
 
#### 1.3 Board bearbeiten
- [ ] **Aktion:** Klick auf Board-Einstellungen (drei-Punkte-Icon in Topbar)
- [ ] **Test:** Name ändern, Beschreibung ändern, Tags hinzufügen
- [ ] **Erwartung:** Änderungen werden sofort gespeichert (ohne Reload verloren)
- [ ] **Erwartung:** Nach Browser-Reload sind Änderungen noch da

#### 1.4 Board löschen
- [ ] **Aktion:** "Board löschen" im Settings-Dialog
- [ ] **Erwartung:** Bestätigungs-Dialog erscheint
- [ ] **Test:** Bestätigen
- [ ] **Erwartung:** Board verschwindet aus Liste
- [ ] **Erwartung:** Nach Browser-Reload ist Board nicht mehr da

#### 1.5 Board wechseln
- [ ] **Test:** Mehrere Boards erstellen, zwischen Boards wechseln
- [ ] **Erwartung:** Board-Wechsel lädt korrektes Board

---

### 2. Spalten Management

#### 2.1 Spalte erstellen
- [ ] **Aktion:** "Spalte hinzufügen" Button klicken
- [ ] **Test:** Spalten-Name eingeben
- [ ] **Erwartung:** Neue Spalte erscheint rechts vom letzten

#### 2.2 Spalte umbenennen
- [ ] **Aktion:** Klick auf Spalten-Header
- [ ] **Test:** Neuer Name eingeben, Enter/Speichern
- [ ] **Erwartung:** Name wird sofort aktualisiert, bleibt nach Reload

#### 2.3 Spalte löschen
- [ ] **Aktion:** Spalte-Löschen
- [ ] **Erwartung:** Bestätigungs-Dialog bei nicht-leerer Spalte
- [ ] **Erwartung:** Spalte + alle Karten werden gelöscht

#### 2.4 Spalten verschieben (Drag & Drop)
- [ ] **Test:** Spalte per Drag & Drop verschieben
- [ ] **Erwartung:** Visuelles Feedback während Drag
- [ ] **Erwartung:** Nach Drop ist neue Reihenfolge persistiert
- [ ] **Erwartung:** Nach Browser-Reload ist Reihenfolge korrekt

#### 2.5 Spalten-Farben
- [ ] **Test:** Farbe einer Spalte ändern (Color-Picker)
- [ ] **Erwartung:** Spalten-Header zeigt neue Farbe
- [ ] **Erwartung:** Farbe bleibt nach Reload erhalten

---

### 3. Karten Management

#### 3.1 Karte erstellen
- [ ] **Aktion:** "Karte hinzufügen" Button in Spalte
- [ ] **Erwartung:** Neue Karte erscheint am Ende der Spalte
- [ ] **Erwartung:** Karte hat korrekte Metadaten (Autor, Datum)

#### 3.2 Karte bearbeiten
- [ ] **Aktion:** Klick auf Karte → CardDialog öffnet sich
- [ ] **Test:** Titel, Beschreibung, Labels, Links bearbeiten
- [ ] **Erwartung:** Alle Änderungen werden gespeichert
- [ ] **Erwartung:** Änderungen sind sofort in Card-Preview sichtbar
- [ ] **Erwartung:** Nach Reload sind Änderungen noch da

#### 3.3 Karte verschieben (Drag & Drop)
- [ ] **Test:** Karte innerhalb derselben Spalte verschieben
- [ ] **Erwartung:** Position wird sofort aktualisiert
- [ ] **Test:** Karte zwischen Spalten verschieben
- [ ] **Erwartung:** Karte erscheint in Ziel-Spalte
- [ ] **Erwartung:** Nach Reload ist Karte an neuer Position

#### 3.4 Karte löschen
- [ ] **Aktion:** Karten löschen (Anm.: Verschiedene Wege dafür)
- [ ] **Erwartung:** Bestätigungs-Dialog erscheint
- [ ] **Test:** Bestätigen
- [ ] **Erwartung:** Karte verschwindet aus Board

#### 3.5 Karten-Farben
- [ ] **Test:** Farbe einer Karte ändern
- [ ] **Erwartung:** Karten-Preview zeigt neue Farbe (Border/Background)
- [ ] **Erwartung:** Farbe bleibt nach Reload

#### 3.6 Karten-Image, Url
- [ ] **Test:** URL zu einem Bild in "Image" Feld eingeben
- [ ] **Erwartung:** Bild wird in Card-Preview angezeigt (Thumbnail)
- [ ] **Erwartung:** Klick auf Bild öffnet Vollansicht (Lightbox)
- [ ] **Test:** Ungültige URL eingeben
- [ ] **Erwartung:** Placeholder oder Fehler-Icon wird angezeigt

#### 3.7 Karten-Image, OER-Finder
- [ ] **Test:** Bild über OER-Finder auswählen
- [ ] **Erwartung:** Bild wird in Card-Preview angezeigt (Thumbnail)
- [ ] **Erwartung:** Klick auf Bild öffnet Vollansicht (Lightbox)

---

### 4. Kommentar-System

#### 4.1 Kommentar hinzufügen
- [ ] **Aktion:** Karte öffnen → "Kommentare" Tab → Text eingeben → "Senden"
- [ ] **Erwartung:** Kommentar erscheint mit Autor + Timestamp
- [ ] **Erwartung:** Karten-Footer zeigt Kommentar-Count (💬 icon + Zahl)

#### 4.2 Kommentar löschen
- [ ] **Aktion:** Trash-Icon bei eigenem Kommentar
- [ ] **Erwartung:** Bestätigungs-Dialog erscheint
- [ ] **Test:** Bestätigen
- [ ] **Erwartung:** Kommentar verschwindet

---

### 5. Export / Import

#### 5.1 Board exportieren
- [ ] **Aktion:** "Export" Button in Topbar/Settings
- [ ] **Erwartung:** JSON-Datei wird heruntergeladen
- [ ] **Test:** Datei öffnen, Struktur prüfen
- [ ] **Erwartung:** Vollständige Board-Daten (Spalten, Karten, Kommentare, etc.)

#### 5.2 Board importieren (Merge Mode)
- [ ] **Aktion:** "Import" Button klicken → JSON-Datei auswählen → "Merge" Mode
- [ ] **Test:** Importieren
- [ ] **Erwartung:** Board wird mit neuen IDs importiert (keine Konflikte)
- [ ] **Erwartung:** Bestehende Boards bleiben unverändert

#### 5.3 Board importieren (New Mode)
- [ ] **Test:** Import mit "New" Mode
- [ ] **Erwartung:** Board wird importiert mit "(Imported)" Suffix im Namen
- [ ] **Erwartung:** Neue IDs werden generiert

#### 5.4 Board importieren (Overwrite Mode)
- [ ] **Test:** Import mit "Overwrite" Mode
- [ ] **Test:** Bestätigen
- [ ] **Erwartung:** Bestehendes Board wird ersetzt

#### 5.5 Backup/Restore (Alle Boards)
- [ ] **Test:** Alle Boards exportieren (Backup)
- [ ] **Test:** Alle Boards löschen, dann Backup importieren
- [ ] **Erwartung:** Alle Boards werden wiederhergestellt

---

### 6. Share-Link System

Anm.: Das Wort "Share" ist irrenführend, da es auch die Teilen-Funktionalität gibt. Welchen anderen Begriff könnte man stattdessen verwenden?

#### 6.1 Share-Link erstellen
- [ ] **Aktion:** "Share" Button in Board-Einstellungen (drei Punkte in Topbar)
- [ ] **Erwartung:** Link wird in Zwischenablage kopiert
- [ ] **Erwartung:** Progress-Bar zeigt Token-Size (<80% = OK)

#### 6.2 Share-Link verwenden
- [ ] **Test:** Link in neuen Browser-Tab öffnen
- [ ] **Erwartung:** Import-Dialog öffnet sich automatisch
- [ ] **Test:** Import-Mode wählen, Importieren
- [ ] **Erwartung:** Board wird korrekt importiert

#### 6.3 Share-Link bei zu großem Board
- [ ] **Test:** Board mit 100+ Karten erstellen, Share-Link generieren
- [ ] **Erwartung:** Warnung wenn Token-Size >80%
- [ ] **Erwartung:** Fehler wenn Token-Size >100% (zu groß für URL)

---

### 7. Board Snapshots / Versionshistorie

#### 7.1 Snapshot erstellen
- [ ] **Aktion:** "Snapshot erstellen" Button
- [ ] **Test:** Label + Kommentar eingeben
- [ ] **Erwartung:** Snapshot wird gespeichert mit Timestamp

#### 7.2 Snapshot wiederherstellen
- [ ] **Aktion:** Snapshot-History öffnen → "Restore" Button
- [ ] **Erwartung:** Board wird auf Snapshot-Zustand zurückgesetzt
- [ ] **Erwartung:** Änderungen seit Snapshot gehen verloren (Warnung vorher!)

#### 7.3 Snapshot löschen
- [ ] **Test:** Snapshot aus History löschen
- [ ] **Erwartung:** Snapshot verschwindet, Board bleibt unverändert

---

### 8. KI-Integration

#### 8.1 Setup 
- [ ] **Aktion:** Board-Einstellungen öffnen -> LLM
- [ ] **Aktion:** Url der API von KI eingeben
- [ ] **Aktion:** API-Schlüssel des Kontos bei der KI eingeben (siehe Dokumentation der entsprechenden KI) 

#### 8.2 Chat mit KI
- [ ] **Aktion:** Rechte Sidebar öffnen → KI-Chat-Panel
- [ ] **Test:** Nachricht eingeben (z.B. "Erstelle 3 Karten für Projektplanung")
- [ ] **Erwartung:** KI antwortet mit strukturiertem Vorschlag
- [ ] **Erwartung:** "Aktion ausführen" Button erscheint bei Action-Antworten

#### 8.3 Split-Card Aktion
- [ ] **Aktion:** Komplexe Karte öffnen → "Mit KI bearbeiten"
- [ ] **Test:** Prompt eingeben (z.B. "Teile diese Aufgabe auf")
- [ ] **Erwartung:** KI schlägt mehrere Teil-Karten vor
- [ ] **Test:** "Anwenden" klicken
- [ ] **Erwartung:** Original-Karte wird gelöscht, neue Karten erscheinen

#### 8.4 OER-Material Discovery
- [ ] **Test:** "Finde Material zu Thema" eingeben
- [ ] **Erwartung:** KI sucht Nostr-Netzwerk nach relevanten OER-Events
- [ ] **Erwartung:** Suchergebnisse werden als Karten vorgeschlagen

---

### 9. Nostr-Synchronisation

#### 9.1 Live-Updates
- [ ] **Test:** Zwei Browser-Fenster öffnen, gleiches Board laden
- [ ] **Test:** In Browser 1 eine Karte verschieben
- [ ] **Erwartung:** Browser 2 zeigt Update in Echtzeit (wenige Sekunden)

#### 9.2 Offline-Sync
- [ ] **Test:** Internetverbindung deaktivieren (DevTools → Network → Offline)
- [ ] **Test:** Karte erstellen/bearbeiten
- [ ] **Erwartung:** Änderung funktioniert lokal
- [ ] **Test:** Internetverbindung reaktivieren
- [ ] **Erwartung:** Gepufferte Events werden automatisch publiziert
- [ ] **Erwartung:** Console zeigt "🔄 Syncing X queued event(s)"

#### 9.3 Konflikt-Resolution (Last-Write-Wins)
- [ ] **Test:** In zwei Browsern dieselbe Karte gleichzeitig bearbeiten
- [ ] **Test:** Browser 1 speichert zuerst, Browser 2 danach
- [ ] **Erwartung:** Browser 2's Änderungen überschreiben Browser 1
- [ ] **Erwartung:** Keine Fehler-Meldungen, reibungsloser Merge

---

### 10. Board-Sharing & Permissions

#### 10.1 Board teilen
- [ ] **Aktion:** "Share Board" Dialog öffnen
- [ ] **Test:** User pubkey eingeben, Rolle wählen (Editor/Viewer)
- [ ] **Test:** "Hinzufügen" klicken
- [ ] **Erwartung:** User wird zur Maintainer-Liste hinzugefügt

#### 10.2 Berechtigungen als Editor
- [ ] **Test:** Als Editor einloggen, Board öffnen
- [ ] **Erwartung:** Kann Karten bearbeiten/erstellen/löschen
- [ ] **Erwartung:** Kann KEINE Board-Settings ändern (Name, Sharing)

#### 10.3 Berechtigungen als Viewer
- [ ] **Test:** Als Viewer einloggen, Board öffnen
- [ ] **Erwartung:** Kann Board ansehen, aber NICHTS bearbeiten
- [ ] **Erwartung:** Alle Edit-Buttons sind disabled

#### 10.4 Owner-Rechte
- [ ] **Erwartung:** Nur Owner kann Board löschen
- [ ] **Erwartung:** Nur Owner kann andere User hinzufügen/entfernen
- [ ] **Erwartung:** Nur Owner kann Board-Settings ändern

**Wichtig:** Auch hier die Synchronisierung testen!

---

## ♿ Accessibility Tests

### 11. Keyboard Navigation

#### 11.1 Tab-Reihenfolge
- [ ] **Test:** TAB-Taste drücken, durch UI navigieren
- [ ] **Erwartung:** Logische Reihenfolge (Topbar → Spalten → Karten)
- [ ] **Erwartung:** Fokus-Indikator ist sichtbar (Border/Outline)

#### 11.2 Tastatur-Shortcuts
- [ ] **Test:** `Enter` auf fokussierter Karte
- [ ] **Erwartung:** CardDialog öffnet sich
- [ ] **Test:** `ESC` in offenem Dialog
- [ ] **Erwartung:** Dialog schließt sich
- [ ] **Test:** `Ctrl+S` / `Cmd+S` im Dialog
- [ ] **Erwartung:** Änderungen werden gespeichert

#### 11.3 Drag & Drop mit Tastatur
- [ ] **Test:** Karte fokussieren, `Space` drücken (Drag-Mode)
- [ ] **Test:** Pfeiltasten zum Verschieben
- [ ] **Test:** `Space` erneut zum Droppen
- [ ] **Erwartung:** Karte wird verschoben ohne Maus

### 12. Screen Reader Support

#### 12.1 ARIA-Labels
- [ ] **Test:** Screen Reader aktivieren (NVDA/JAWS/VoiceOver)
- [ ] **Erwartung:** Alle interaktiven Elemente haben beschreibende Labels
- [ ] **Test:** Button ohne sichtbaren Text (nur Icon)
- [ ] **Erwartung:** Screen Reader sagt beschreibenden Text (z.B. "Karte löschen")

#### 12.2 Landmark-Regionen
- [ ] **Erwartung:** `<header>` für Topbar, `<main>` für Board-Bereich
- [ ] **Erwartung:** `<nav>` für Board-Liste (Sidebar)
- [ ] **Erwartung:** Screen Reader kann zwischen Regionen springen

#### 12.3 Dynamische Inhalte
- [ ] **Test:** Neue Karte erstellen
- [ ] **Erwartung:** Screen Reader kündigt "Neue Karte hinzugefügt" an (aria-live)
- [ ] **Test:** Fehler-Meldung erscheint
- [ ] **Erwartung:** Screen Reader liest Fehler-Text vor (aria-live="assertive")

### 13. Kontrast & Lesbarkeit

#### 13.1 Farbkontrast (WCAG AA)
- [ ] **Test:** Browser-Extension "axe DevTools" oder "WAVE" nutzen
- [ ] **Erwartung:** Text-zu-Hintergrund Kontrast mindestens 4.5:1 (WCAG AA)
- [ ] **Test:** Spalten-/Karten-Farben prüfen
- [ ] **Erwartung:** Auch bei hellen Farben ist Text lesbar

#### 13.2 Dark Mode
- [ ] **Test:** Dark Mode aktivieren (Settings oder System-Preference)
- [ ] **Erwartung:** Alle Farben sind invertiert, Text bleibt lesbar
- [ ] **Erwartung:** Keine "blendenden" weißen Elemente auf schwarzem Grund

#### 13.3 Schriftgrößen
- [ ] **Test:** Browser-Zoom auf 200%
- [ ] **Erwartung:** UI bleibt funktional, kein Überlauf
- [ ] **Test:** System-Schriftgröße erhöhen (Accessibility-Settings)
- [ ] **Erwartung:** Text skaliert mit

### 14. Fokus-Management

#### 14.1 Dialog-Fokus
- [ ] **Test:** Dialog öffnen
- [ ] **Erwartung:** Fokus springt automatisch ins erste Input-Feld
- [ ] **Test:** Dialog schließen (ESC oder Button)
- [ ] **Erwartung:** Fokus kehrt zum auslösenden Element zurück

#### 14.2 Skip-Links
- [ ] **Test:** Seite laden, sofort TAB drücken
- [ ] **Erwartung:** "Skip to main content" Link erscheint
- [ ] **Test:** Skip-Link aktivieren
- [ ] **Erwartung:** Fokus springt direkt zum Board (Main-Content)

---

## 🌐 Browser-Kompatibilität

### 15. Desktop Browser Tests

#### 15.1 Chrome/Chromium (120+)
- [ ] **Test:** Alle funktionalen Tests durchführen
- [ ] **Erwartung:** 100% funktional

#### 15.2 Firefox (120+)
- [ ] **Test:** Alle funktionalen Tests durchführen
- [ ] **Erwartung:** 100% funktional

#### 15.3 Safari (17+)
- [ ] **Test:** Alle funktionalen Tests durchführen
- [ ] **Erwartung:** 100% funktional

#### 15.4 Edge (120+)
- [ ] **Test:** Alle funktionalen Tests durchführen
- [ ] **Erwartung:** 100% funktional (Chromium-basiert)

### 16. Mobile Browser Tests

#### 16.1 Mobile Chrome (Android)
- [ ] **Test:** Touch-Gesten (Tap, Long-Press, Swipe)
- [ ] **Erwartung:** Drag & Drop funktioniert mit Touch
- [ ] **Erwartung:** Keine horizontalen Scrollbars

#### 16.2 Mobile Safari (iOS)
- [ ] **Test:** Touch-Gesten
- [ ] **Erwartung:** Alle Interaktionen funktionieren
- [ ] **Test:** Landscape & Portrait Mode
- [ ] **Erwartung:** UI passt sich an

---

## 📱 Mobile & Responsive Tests

### 17. Bildschirmauflösungen

#### 17.1 Tablet (768×1024)
- [ ] **Erwartung:** 2-Spalten-Layout oder Scroll
- [ ] **Erwartung:** Sidebars als Drawer (Hamburger-Menu)

#### 17.2 Mobile (375×667)
- [ ] **Erwartung:** 1-Spalte mit horizontalem Scroll
- [ ] **Erwartung:** Hamburger-Menu für Navigation
- [ ] **Erwartung:** Touch-optimierte Buttons (min. 44×44px)

### 18. Touch-Interaktionen

#### 18.1 Card Drag & Drop
- [ ] **Test:** Long-Press auf Karte, dann ziehen
- [ ] **Erwartung:** Karte lässt sich bewegen
- [ ] **Erwartung:** Visuelles Feedback (Shadow, Opacity)

#### 18.2 Pinch-to-Zoom
- [ ] **Test:** Zwei-Finger-Zoom-Geste
- [ ] **Erwartung:** Seite zoomt (Browser-Standard)
- [ ] **Erwartung:** Keine Beeinträchtigung der UI-Funktionalität

#### 18.3 Swipe-Gesten
- [ ] **Test:** Swipe von links (wenn Sidebar-Drawer implementiert)
- [ ] **Erwartung:** Sidebar öffnet sich
- [ ] **Test:** Swipe zurück
- [ ] **Erwartung:** Sidebar schließt sich

### 19. Orientation Changes

#### 19.1 Landscape → Portrait
- [ ] **Test:** Device rotieren
- [ ] **Erwartung:** UI passt sich sofort an (kein Reload)
- [ ] **Erwartung:** Keine Layout-Brüche oder Überlauf

#### 19.2 Portrait → Landscape
- [ ] **Test:** Device rotieren
- [ ] **Erwartung:** Mehr Spalten sichtbar bei Landscape
- [ ] **Erwartung:** Sidebars passen sich an

---

## Sonstiges

Die wichtigsten Features sollen am meinsten getestet werden.

Weitere Tests (die nicht oben aufgelistet wurden) und Auffälligkeiten sind willkommen.


---


## 🔒 Sicherheitstests (Nur für devs)

### 20. Authentication Security

#### 20.1 Private Key Handling
- [ ] **KRITISCH:** Private Keys (nsec) dürfen NIE in localStorage gespeichert werden
- [ ] **Test:** localStorage nach Login inspizieren
- [ ] **Erwartung:** Nur pubkey ist gespeichert, KEIN nsec/privkey
- [ ] **Test:** Console-Logs überprüfen
- [ ] **Erwartung:** Keine Private Keys in Console geloggt

#### 20.2 Session Expiration
- [ ] **Test:** Session-Timestamp in localStorage prüfen
- [ ] **Erwartung:** Session läuft nach 7 Tagen ab
- [ ] **Test:** Timestamp manuell auf >7 Tage setzen
- [ ] **Erwartung:** App fordert Re-Login

### 21. XSS Prevention

#### 21.1 User Input Sanitization
- [ ] **Test:** HTML-Code in Karten-Titel eingeben (z.B. `<script>alert('XSS')</script>`)
- [ ] **Erwartung:** Script wird NICHT ausgeführt, als Text angezeigt
- [ ] **Test:** HTML in Kommentaren eingeben
- [ ] **Erwartung:** HTML wird escaped oder sanitized

#### 21.2 URL Validation
- [ ] **Test:** Malicious URL in Card-Image eingeben (z.B. `javascript:alert()`)
- [ ] **Erwartung:** URL wird blocked oder ignoriert
- [ ] **Test:** Data-URL eingeben (z.B. `data:image/svg+xml...`)
- [ ] **Erwartung:** Data-URLs sollten erlaubt oder explizit gefiltert sein

### 22. Content Security Policy (CSP)

#### 22.1 CSP Headers
- [ ] **Test:** DevTools → Network → Response Headers prüfen
- [ ] **Erwartung:** `Content-Security-Policy` Header ist gesetzt
- [ ] **Erwartung:** Keine `unsafe-inline` oder `unsafe-eval` für scripts

### 23. Relay Security

#### 23.1 HTTPS-Only Relays
- [ ] **Test:** Relay-URLs in Settings prüfen
- [ ] **Erwartung:** Alle Relay-URLs beginnen mit `wss://` (NICHT `ws://`. Ausnahme: localhost)
- [ ] **Test:** Versuchen, `ws://` URL hinzuzufügen
- [ ] **Erwartung:** Fehler oder automatische Konvertierung zu `wss://`