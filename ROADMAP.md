# 🗺️ Roadmap: Nostr-basiertes KI-Kanban-Board

**Version:** 2.0  
**Aktualisiert:** 18. Oktober 2025  
**Status:** In Entwicklung (Phase 1)  
**Projekt-Ziel:** Vollständige Implementierung (priorisiert nach Phasen)

**Förderhinweis:** Die Projektförderung erwartet, dass die Inhalte bis einschließlich Phase 4 umgesetzt werden. Phase 5 ist fakultativ (Nice-to-have).

---

## 📊 Übersicht nach Phasen

| Phase | Priorität | Fokus | Status |
|-------|-----------|-------|--------|
| **Phase 1** | 🔴 Required / Funded | Core Data Model + Nostr Events | **IN PROGRESS** |
| **Phase 2** | 🔴 Required / Funded | UI Components + Offline-First | PLANNED |
| **Phase 3** | 🔴 Required / Funded | KI-Integration | PLANNED |
| **Phase 4** | 🟡 Required / Funded | Kollaboration & Sync | PLANNED |
| **Phase 5** | ⚪ Nice-to-have | Erweiterte Features | PLANNED |

---

## 🔴 Phase 1: Foundation & Core Implementation (Priorität: Hoch)

### Meilenstein 1.1: Nostr Event Publishing (Priorität: Hoch)

**Ziel:** Board und Card Events können publiziert werden  
**Status:** 🔄 IN PROGRESS

#### Zu implementieren:

- [ ] **`src/lib/utils/nostrEvents.ts`** – Event Serialisierung
  - [ ] `boardToNostrEvent(board, ndk): NDKEvent`
  - [ ] `nostrEventToBoard(event): BoardProps`
  - [ ] `cardToNostrEvent(card, columnName, rank, boardRef, ndk): NDKEvent`
  - [ ] `nostrEventToCard(event): CardProps`
  - [ ] `createCommentEvent(text, cardRef, cardEventId, ndk): NDKEvent`

- [ ] **`src/lib/stores/kanbanStore.ts`** – Integration mit NDK
  - [ ] Ersetze `console.log()` mit echtem `event.publish()`
  - [ ] Implementiere `publishToNostr()` Methode
  - [ ] Implementiere `loadFromNostr()` für initiales Laden
  - [ ] Implementiere `subscribeToUpdates()` für Live-Updates

- [ ] **Tests**
  - [ ] Unit-Tests für `nostrEvents.ts`
  - [ ] Integration-Tests mit Mock-NDK
  - [ ] Serialisierungstests (Board → Event → Board Round-Trip)

**Acceptance Criteria:**
- ✅ Board-Events werden mit Kind 30301 publiziert
- ✅ Card-Events werden mit Kind 30302 publiziert
- ✅ `publishState` wird als Custom Tag korrekt gespeichert
- ✅ Events können ohne Fehler zurück deserialisiert werden

---

### Meilenstein 1.2: Offline-First Synchronisation (Priorität: Hoch)

**Ziel:** Events werden gequeued wenn offline, synced wenn online  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **`src/lib/stores/syncManager.ts`** – Offline Event Queue
  - [ ] Event Queue mit `svelte-persisted-store` (IndexedDB)
  - [ ] Online/Offline Status Detection
  - [ ] `publishOrQueue()` API
  - [ ] `syncQueue()` mit Retry-Logik
  - [ ] Conflict Resolution (Last-Write-Wins)

- [ ] **BoardStore Integration**
  - [ ] Ersetze direkte `publish()` mit `syncManager.publishOrQueue()`
  - [ ] Implementiere `moveCard()` mit Sync
  - [ ] Implementiere `addComment()` mit Sync
  - [ ] Exponiere `syncStatus` Getter

- [ ] **Tests**
  - [ ] Offline-Szenarien simulieren
  - [ ] Queue-Persistierung testen
  - [ ] Reconnect-Sync testen
  - [ ] Retry-Mechanismus testen

**Acceptance Criteria:**
- ✅ Events werden in IndexedDB gequeued wenn offline
- ✅ Bei Reconnect werden alle gepufferten Events publiziert
- ✅ Max. 3 Retry-Versuche, dann Event entfernen
- ✅ Queue ist persistent (bleibt über Browser-Neustarts)

---

### Meilenstein 1.5: Board Export / Import (Priorität: Hoch)

**Ziel:** Boards können exportiert, geteilt und wieder importiert werden (Store-Level Export/Import). Dies ist eine förderrelevante Anforderung und muss in Phasen 1-4 umgesetzt werden.

**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **Store-Level Export API** — Serialisiere Board-Zustand (`Board.getContextData(true)`) in ein JSON-Format
- [ ] **Store-Level Import API** — Validiere und importiere serialisierte Boards; prüfe Konflikte und ID-Duplikate
- [ ] **UI: Export/Import Dialog** — Download/Upload JSON, Copy-to-Clipboard, Share-Link-Generator
- [ ] **CLI/Dev Tooling (optional)** — `pnpm run board:export` / `pnpm run board:import`
- [ ] **Tests** — Round-Trip Tests (Export → Import → Vergleich), Validation-Tests, Error Handling

**Acceptance Criteria:**

- ✅ Export erzeugt ein JSON-File mit allen Board-Metadaten, Spalten und Karten (inkl. IDs)
- ✅ Import validiert Struktur und verweigert fehlerhafte Dateien mit klarer Fehlermeldung
- ✅ Import behandelt ID-Konflikte: Option 'merge' (neue IDs für importierte Objekte) oder 'overwrite'
- ✅ Export/Import funktioniert offline (Import aus lokalem File) und online (Share-Link)
- ✅ Round-Trip: Export → Import → Board-Hash/Checksumme stimmt überein

---

---

### Meilenstein 1.3: Kommentar-System Grundlagen (Priorität: Hoch)

**Ziel:** Kommentare werden als Nostr Kind 1 Events gespeichert  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **Card-Klasse erweitern** (`src/lib/classes/BoardModel.ts`)
  - [ ] Nostr-spezifische Properties: `eventId`, `author`
  - [ ] `loadCommentsFromNostr(ndk): Promise<void>`
  - [ ] `addCommentToNostr(ndk, text): Promise<Comment>`
  - [ ] `deleteCommentFromNostr(ndk, commentId): Promise<void>`
  - [ ] `subscribeToComments(ndk, callback): () => void` (Cleanup-Funktion)

- [ ] **BoardStore erweitern**
  - [ ] `addComment(cardId, text): Promise<void>`
  - [ ] `deleteComment(cardId, commentId): Promise<void>`
  - [ ] `loadComments(cardId): Promise<void>`
  - [ ] Auto-subscribe bei Card-Load

- [ ] **Tests**
  - [ ] Comment-Event Creation
  - [ ] Comment-Deletion (NIP-09)
  - [ ] Comment Subscriptions

**Acceptance Criteria:**
- ✅ Kommentare werden als Kind 1 Events publiziert
- ✅ Kommentare haben korrekte Tags (`a`, `p`, `e`)
- ✅ Kommentar-Löschung erzeugt Kind 5 Event
- ✅ Neue Kommentare erscheinen in Echtzeit

---

### Meilenstein 1.4: Benutzerauthentifizierung (Priorität: Hoch)

**Ziel:** Nutzer können sich mit Nostr-Key authentifizieren  
**Status:** 🟡 PLANNED  
**Abhängig von:** [NOSTR-USER.md](./NOSTR-USER.md)

#### Zu implementieren:

- [ ] **`src/lib/stores/userStore.ts`** – Neue Store
  - [ ] `$state` für aktuellen User
  - [ ] `login(signer)` – Nostr-Signer verbinden
  - [ ] `logout()` – Session beenden
  - [ ] `getCurrentUser()` – Npub und Metadaten
  - [ ] `isAuthenticated` Derived Value

- [ ] **NDK Signer Integration**
  - [ ] Browser Extension Signer (NIP-07)
  - [ ] Optional: Test-Signer für Development

- [ ] **Authentifizierter Board-Zugriff**
  - [ ] Events werden mit User-Key signiert
  - [ ] Board-Ownership basierend auf Pubkey
  - [ ] Nur Autor kann publishState ändern

- [ ] **UI Updates**
  - [ ] Login Modal in `+layout.svelte`
  - [ ] User-Menu in Topbar
  - [ ] Pubkey-Anzeige für Transparenz

**Acceptance Criteria:**
- ✅ Nutzer kann mit NIP-07 Extension einloggen
- ✅ User-Pubkey ist in Board-Events (Tag `p`)
- ✅ Events sind mit User-Key signiert
- ✅ Logout löscht Session

---

## 🟡 Phase 2: UI Components & UX Polish (Priorität: Mittel)

### Meilenstein 2.1: UI Komponenten (Priorität: Mittel)

**Ziel:** Kanban-Board mit Drag-and-Drop gemäß AGENTS.md Spec  
**Status:** 🟡 PLANNED

#### Zu implementieren:

Die aktuellen Komponenten in `src/routes/cardsboard/` verwenden ein **eigenes Datenmodell** (`data.ts`). Diese müssen migriert werden zu `BoardModel.ts` + `kanbanStore`.

- [ ] **Komponenten-Refactor**
  - [ ] `src/lib/components/Board.svelte` – Hauptkomponente
    - [ ] Verbindung zu `boardStore.data`
    - [ ] DnD Integration mit `svelte-dnd-action`
  - [ ] `src/lib/components/Column.svelte` – Spalten
    - [ ] Drop-Zone für Cards
    - [ ] Spalten-Bearbeitung
  - [ ] `src/lib/components/Card.svelte` – Karten
    - [ ] Drag-Source
    - [ ] Metadaten-Anzeige (Kommentare, Links, Attendees)
  - [ ] `src/lib/components/Topbar.svelte` – Navigation
  - [ ] `src/lib/components/Sidebar.svelte` – Linke/Rechte Sidebars

- [ ] **Modal/Dialog Komponenten**
  - [ ] `CardDetailDialog.svelte` – Card-Details mit Tabs
    - [ ] Tab 1: Details & Bearbeitung
    - [ ] Tab 2: Kommentare
    - [ ] Tab 3: Links & Ressourcen
    - [ ] Tab 4: Attendees & Sharing
  - [ ] `BoardSettingsSheet.svelte` – Board-Einstellungen
  - [ ] `ShareBoardDialog.svelte` – Sharing-Optionen

- [ ] **Tests**
  - [ ] Component Snapshot Tests
  - [ ] DnD Interaction Tests
  - [ ] Modal Open/Close Tests

**Acceptance Criteria:**
- ✅ Alle Komponenten nutzen `boardStore`
- ✅ Drag-and-Drop funktioniert flüssig
- ✅ Modals öffnen/schließen korrekt
- ✅ Keine Daten-Inkonsistenzen

---

### Meilenstein 2.2: UX Polish & Accessibility (Priorität: Mittel)

**Ziel:** Anwendung erfüllt UX-RULES.md + WCAG 2.1 AA  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **shadcn-svelte Components**
  - [ ] Alle existierenden `div`-based Layouts durch `Card.*` ersetzen
  - [ ] Buttons mit korrekten Varianten (`ghost`, `default`, `outline`)
  - [ ] Forms mit `Field.Root` Struktur
  - [ ] Icons von `@lucide/svelte/icons/` konsistent nutzen

- [ ] **Accessibility**
  - [ ] ARIA-Labels überall
  - [ ] Keyboard Navigation (Tab, Enter, Esc)
  - [ ] Screenreader-Testing
  - [ ] Kontrast-Verhältnisse (WCAG AA)
  - [ ] Focus-Indikatoren sichtbar

- [ ] **Responsive Design**
  - [ ] Mobile-View (< 640px)
  - [ ] Tablet-View (640px - 1024px)
  - [ ] Desktop-View (> 1024px)
  - [ ] Resizable Panels

- [ ] **Dark Mode**
  - [ ] CSS-Variablen für Farben
  - [ ] Dark Mode Toggle
  - [ ] System-Preference erkennen

**Acceptance Criteria:**
- ✅ Alle Komponenten verwenden shadcn-svelte
- ✅ WCAG 2.1 AA validiert
- ✅ Funktioniert auf Mobile, Tablet, Desktop
- ✅ Dark Mode unterstützt

---

### Meilenstein 2.3: Performance & Optimization (Priorität: Mittel)

**Ziel:** App lädt schnell, läuft smooth, keine Memory Leaks  
**Status:** 🟡 PLANNED

#### Zu implementieren:

- [ ] **Loading & Error States**
  - [ ] Skeleton-Loaders für Cards
  - [ ] Error Boundaries für Fehlerbehandlung
  - [ ] Retry-UI für fehlgeschlagene Nostr-Loads
  - [ ] Timeout-Handling (z.B. nach 10s)

- [ ] **Performance**
  - [ ] Virtualisierung für große Card-Listen
  - [ ] Image Lazy-Loading
  - [ ] Bundle-Size Analyse
  - [ ] Lighthouse Score > 90

- [ ] **Caching**
  - [ ] Board-Events in IndexedDB cachen
  - [ ] Card-Events deduplizieren
  - [ ] Cache Invalidation bei Updates

**Acceptance Criteria:**
- ✅ Lighthouse Performance Score > 90
- ✅ Keine visuellen Jank bei 60fps
- ✅ Memory-Leaks ausgeschlossen (Devtools)

---

## ⚪ Phase 3: KI-Integration (Priorität: Geplant)

### Meilenstein 3.1: KI-Context Serialisierung (Priorität: Geplant)

**Ziel:** Board-Zustand kann an KI-API gesendet werden  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Chat-Interface Erweiterung**
  - [ ] `sendPromptToAI(prompt, context?)` vollständig implementieren
  - [ ] Context-Payload erstellen:
    ```typescript
    {
      prompt: string,
      boardContext: Board.getContextData(full=true),
      selectionContext?: Card.getContextData() | Column.getContextData()
    }
    ```
  - [ ] API-Endpoint für KI-Service

- [ ] **Chatbot UI**
  - [ ] `src/lib/components/Chatbot.svelte` – Chat-Interface
    - [ ] Message History anzeigen
    - [ ] Input-Feld mit Send-Button
    - [ ] Loading-Spinner während KI antwortet
    - [ ] Error-Anzeige

- [ ] **Context Window Management**
  - [ ] Token-Counting für große Boards
  - [ ] Kontext-Summarisierung bei Bedarf
  - [ ] Relevante Cards/Columns extrahieren

**Acceptance Criteria:**
- ✅ Prompts mit Kontext werden korrekt formatiert
- ✅ KI erhält vollständigen Board-Zustand
- ✅ Chatbot UI ist responsive

---

### Meilenstein 3.2: OER-Content Discovery (Priorität: Geplant)

**Ziel:** KI kann Materialien im Nostr-Netzwerk finden  
**Status:** ⚪ PLANNED  
**Abhängig von:** [NDK.md](./NDK.md) – OER Event Kind Definition

#### Zu implementieren:

- [ ] **OER Event Schema**
  - [ ] Standard-Kind für OER-Materialien definieren
  - [ ] Tags für Metadaten (Fach, Klassenstufe, Typ, Lizenz)
  - [ ] Content-Index mit Suchbarkeit

- [ ] **Content Search API**
  - [ ] NDK Filter für OER-Material
  - [ ] Suchfunktion nach Keyword, Fach, Klassenstufe
  - [ ] KI-Ranking nach Relevanz

- [ ] **Integration in Chat**
  - [ ] Nutzer: _„Finde Material zu Römisches Reich, Klasse 7"_
  - [ ] KI sucht OER-Events
  - [ ] Ergebnisse als Cards im `Materialideen`-Spalte

- [ ] **Tests**
  - [ ] Mock-OER-Events erstellen
  - [ ] Search-Query Tests
  - [ ] Ranking-Algorithmus Tests

**Acceptance Criteria:**
- ✅ KI kann Materialien finden
- ✅ Suchergebnisse sind relevant
- ✅ Cards werden automatisch hinzugefügt

---

### Meilenstein 3.3: KI-Aktionen (Split-Card, etc.) (Priorität: Geplant)

**Ziel:** KI kann Board-Struktur verändern  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Split-Card Aktion**
  - [ ] KI versteht, dass eine Card zu komplex ist
  - [ ] Vorschlag: _„Teile diese Aufgabe in 3 Teil-Aufgaben"_
  - [ ] Nutzer bestätigt
  - [ ] `Column.splitCard()` wird ausgeführt
  - [ ] Neue Cards erscheinen im Board

- [ ] **Andere KI-Aktionen**
  - [ ] `add_card` – KI schlägt neue Card vor
  - [ ] `update_card` – KI aktualisiert bestehende Card
  - [ ] `move_card` – KI reorganisiert Struktur

- [ ] **Action-Preview**
  - [ ] Nutzer sieht AI-Vorschlag vor Ausführung
  - [ ] Dialog zur Bestätigung
  - [ ] Undo möglich

**Acceptance Criteria:**
- ✅ `processAIAction()` funktioniert für alle Types
- ✅ Nutzer kann Actions vor Ausführung sehen
- ✅ Undo/Redo funktioniert

---

## ⚪ Phase 4: Kollaboration & Sync (Priorität: Geplant)

### Meilenstein 4.1: Board-Sharing & Permissions (Priorität: Geplant)

**Ziel:** Mehrere Nutzer können gemeinsam an Board arbeiten  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Sharing-Modell**
  - [ ] Board-Owner definieren (Pubkey)
  - [ ] Permission-Levels:
    - `view` – Nur lesen
    - `comment` – Lesen + Kommentare
    - `edit` – Lesen + Bearbeiten
    - `admin` – Alles + Nutzer hinzufügen
  - [ ] Permissions als Nostr `p`-Tags speichern

- [ ] **Share Dialog**
  - [ ] Nutzer-Suche nach Npub oder Name
  - [ ] Permission-Zuordnung
  - [ ] Link-Sharing (read-only)
  - [ ] Permission-History

- [ ] **Access Control**
  - [ ] Check vor jeder Aktion
  - [ ] UI-Elements disablen wenn keine Permission
  - [ ] Fehler-Handling wenn Zugriff verweigert

**Acceptance Criteria:**
- ✅ Sharable Links funktionieren
- ✅ Permissions werden enforced
- ✅ Geteilte Boards sind read-only für Viewer

---

### Meilenstein 4.2: Echtzeit-Kollaboration (Priorität: Geplant)

**Ziel:** Mehrere Nutzer sehen Änderungen in Echtzeit  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Live-Subscriptions erweitern**
  - [ ] Mehrere Clients abonnieren gleiches Board
  - [ ] Relays propagieren Updates in Echtzeit
  - [ ] Cursor-Positionen anzeigen (_„Johanna bearbeitet Card #5"_)

- [ ] **Conflict Resolution**
  - [ ] Last-Write-Wins (Standard)
  - [ ] Merge-Strategie für bestimmte Fields
  - [ ] User-Notification bei Konflikten

- [ ] **Operational Transformation (optional für Phase 4+)**
  - [ ] Parallel-Edits ohne Konflikte
  - [ ] Multi-User Undo
  - [ ] Version-Control für Board

**Acceptance Criteria:**
- ✅ Zwei Nutzer können gleichzeitig arbeiten
- ✅ Änderungen erscheinen sofort bei beiden
- ✅ Keine Datenverluste bei Konflikten

---

### Meilenstein 4.3: Offline-First mit Conflict Resolution (Priorität: Geplant)

**Ziel:** App funktioniert offline mit Multi-User Sync  
**Status:** ⚪ PLANNED

#### Zu implementieren:

- [ ] **Lokale Änderungen tracken**
  - [ ] Lamport Clocks für Event-Ordering
  - [ ] Change-Set für Sync-Konflikt-Auflösung

- [ ] **Merge auf Reconnect**
  - [ ] Lokale Changes mit Server-Changes vergleichen
  - [ ] Merge-Strategie anwenden
  - [ ] User-Notification bei Konflikten

- [ ] **Tests**
  - [ ] Zwei Clients offline, dann online
  - [ ] Simultane Änderungen auf selber Card
  - [ ] Lange Offline-Perioden

**Acceptance Criteria:**
- ✅ Offline-Changes werden korrekt synced
- ✅ Konflikte werden aufgelöst
- ✅ Keine Daten verloren

---

## ⚪ Phase 5: Erweiterte Features (Priorität: Geplant)

### Meilenstein 5.1: Materialverwaltung & Depot

**Ziel:** Nutzer haben persönliches Material-Archiv  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Persönlicher Material-Index
- [ ] Volltextsuche über eigene Materials
- [ ] Automatische Kategorisierung (Fach, Klassenstufe)
- [ ] Favoriten & Markierungen
- [ ] Export zu CSV/PDF

---

### Meilenstein 5.2: Gemeinschaften & Communities

**Ziel:** Lehrkräfte organisieren sich in Fachgruppen  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Community-Erstellung und -Verwaltung
- [ ] Shared Material-Repositories
- [ ] Diskussions-Forum (Nostr Kind 42?)
- [ ] Community-Standards & Best Practices
- [ ] Recommendation-System

---

### Meilenstein 5.3: Analyse & Insights

**Ziel:** Dashboard mit Daten über Board-Nutzung  
**Status:** ⚪ PLANNED

#### Features:

- [ ] Board-Statistiken (Anzahl Cards, Spalten, etc.)
- [ ] Activity-Timeline
- [ ] Häufigste Tags und Labels
- [ ] Collaboration-Graph (wer arbeitet mit wem)
- [ ] Performance-Metriken

---

### Meilenstein 5.4: Mobile App

**Ziel:** Native iOS/Android App mit Offline-Sync  
**Status:** ⚪ PLANNED

#### Features:

- [ ] React Native oder Flutter Implementation
- [ ] Alle Board-Features
- [ ] Push-Notifications für Collaboration
- [ ] Camera-Integration für Material-Erfassung

---

### Meilenstein 5.5: Integrationen

**Ziel:** Verbindung mit externen Tools  
**Status:** ⚪ PLANNED

#### Features:

- [ ] LMS Integration (Moodle, Ilias, etc.)
- [ ] Calendar Sync
- [ ] Mail-Digest Notifications
- [ ] Slack/Discord Webhooks
- [ ] Google Drive/OneDrive Attachments

---

## 📋 Kritische Pfade & Dependencies

### Blocker für Phase 2:
1. ✅ Phase 1 Meilensteine 1.1 - 1.4 (Core Implementation)

### Förder-Anforderungen (wichtig)
- Die Fördermittelgeber erwarten die Umsetzung bis einschließlich Phase 4.
- Es muss möglich sein, ein Board (Store) zu exportieren und zu importieren, um Boards zu teilen oder Backup/Restore zu ermöglichen. Implementierung auf Store-Level ist verpflichtend für Phasen-1..4.

### Blocker für Phase 3:
1. ✅ Phase 2 abgeschlossen (UI funktional)
2. 🟡 OER-Event Schema finalisiert (NDK.md)
3. 🟡 KI-API Integration (externe Service)

### Blocker für Phase 4:
1. ✅ Phase 3 abgeschlossen (KI funktional)
2. 🟡 Permissions-System designt
3. 🟡 Conflict Resolution Strategie validiert

---

## 🎯 Definition of Done (DoD)

Jeder Meilenstein ist **nur dann done**, wenn:

- ✅ Code ist geschrieben und reviewed
- ✅ Tests sind geschrieben und grün (> 80% Coverage)
- ✅ Dokumentation ist aktualisiert
- ✅ Keine Breaking Changes für andere Phasen
- ✅ Acceptance Criteria sind erfüllt
- ✅ Ist in `main` Branch merged
- ✅ CHANGELOG.md ist aktualisiert

---

## 🏗️ Technische Schulden & Known Issues

### Phase 1:
- [ ] `data.ts` wird noch verwendet (alte Struktur)
- [ ] NDK Caching nicht optimiert
- [ ] Error Handling minimal

### Phase 2:
- [ ] Component Tests sind gering
- [ ] Mobile Responsiveness incomplete
- [ ] Dark Mode nicht implementiert

### Phase 3+:
- [ ] KI-Ratenlimiting fehlt
- [ ] Keine User Research noch durchgeführt
- [ ] Performance unter Last nicht getestet

---

## 📞 Kontakt & Support

- **Issues & Bugs:** [GitHub Issues](https://github.com/edufeed-org/kanban-editor/issues)
- **Feature Requests:** [GitHub Discussions](https://github.com/edufeed-org/kanban-editor/discussions)
- **Dokumentation:** Siehe `docs/` und verlinkte `.md` Dateien

---

## 📝 Versionshistorie

| Version | Datum | Beschreibung |
|---------|-------|-------------|
| 2.0 | 18.10.2025 | Priorisierte Roadmap mit Meilensteinen |
| 1.0 | 17.10.2025 | Initial Roadmap (in CODE-ANALYSE.md) |

---

**Zuletzt aktualisiert:** 18. Oktober 2025  
**Nächste Überprüfung:** Nach Abschluss von Phase 1
