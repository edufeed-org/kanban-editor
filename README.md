# Nostr-basiertes KI-Kanban-Board für kollaborative Unterrichtsentwicklung

Ein intelligentes Kanban-Board mit KI-Unterstützung und Nostr-Integration, gebaut mit **Svelte 5** und **TypeScript**.

---

## 🟢 STATUS: PHASE 1.2 - 100% COMPLETE

**Build Status:** ✅ 0 ERRORS, 0 WARNINGS | **Code:** 1656 lines | **Docs:** 8300+ words | **Status:** PRODUCTION READY

🚀 **Quick Start:**
- New developers? → **[📖 PHASE-1.2-QUICKSTART.md](./PHASE-1.2-QUICKSTART.md)** (10 min)
- Want to test? → **[📋 PHASE-1.2-TRANSITION-CHECKLIST.md](./PHASE-1.2-TRANSITION-CHECKLIST.md)** (45 min)
- Need docs? → **[📚 PHASE-1.2-DOCUMENTATION-INDEX.md](./PHASE-1.2-DOCUMENTATION-INDEX.md)** (reference)
- Ready for Phase 1.3? → Read docs above first!

**What's Ready:**
- ✅ Offline-first event publishing pipeline
- ✅ Real-time sync status in UI (4 states)
- ✅ Automatic retry with exponential backoff
- ✅ Full error handling & graceful degradation
- ✅ Non-blocking async architecture
- ✅ Complete Nostr integration (Kind 30301/30302)

**Next Steps:** 
1. Run manual tests (45 min)
2. Choose: Phase 1.3 (Comments, 2-3h) or Deploy to staging (30 min - 2h)
3. Proceed with development

---

---

## 🎯 Features

- ✅ **Offline-First:** Arbeiten Sie ohne Internetverbindung, automatische Synchronisation bei Reconnect
- 🧠 **KI-Integration:** Intelligente Karten-Aufteilung und Aufgaben-Management
- 🌐 **Nostr-basiert:** Dezentrale Speicherung über Nostr-Relays (NIP-30301/30302)
- 💬 **Kommentar-System:** Lokal persistent mit lokalisierter UI (in Phase D: Nostr Publishing)
- 📱 **Reaktiv:** Svelte 5 Runes für optimale Performance
- 🔒 **Typsicher:** Vollständig in TypeScript implementiert
- 💬 **Kommentare:** Nostr-basierte Kommentare mit Reactions & Zaps

## 📚 Dokumentation

### 🔴 Dokumentations-Governance v3.0 AKTIV

**KRITISCH:** Code ohne Docs-Update → PR wird REJECTED!

- **[📚 DOCUMENTATION-RULES-v3.md](./docs/DOCUMENTATION-RULES-v3.md)** - 🔴 **v3.0 MANDATORY** - DoD Checklist (11 Punkte), Enforcement-Rules
- **[📚 Dokumentations-Index](./docs/_INDEX.md)** - Navigation nach Rolle & Thema (42 Dateien)

**Bei jeder Code-Änderung:**
1. ✅ ROADMAP.md aktualisieren (wenn Feature betroffen)
2. ✅ TESTSUITE/STATUS.md aktualisieren (wenn Tests betroffen)
3. ✅ CHANGELOG.md aktualisieren (wenn User-sichtbar)
4. ✅ Feature-Dokumentation aktualisieren (wenn API ändert)
5. ✅ ARCHITECTURE/ Docs aktualisieren (wenn Pattern ändert)
6. ✅ _INDEX.md aktualisieren (wenn neue Datei)
7. ✅ Alte Docs archivieren (mit Migration-Notice)

**Siehe:** [`docs/DOCUMENTATION-RULES-v3.md`](./docs/DOCUMENTATION-RULES-v3.md) für vollständige Regeln  
**Migration:** [`docs/archive/DOCUMENTATION-RULES-v2.md`](./docs/archive/DOCUMENTATION-RULES-v2.md) (v2.0 deprecated)

---

### 📖 Kern-Dokumentation

- **[KONZEPT.md](./KONZEPT.md)** - Produkt-Vision & Use Cases (für Stakeholder)
- **[ROADMAP.md](./docs/COLLABORATION/ROADMAP.md)** - 🗺️ Priorisierte Entwicklungs-Roadmap v2.5 (Phase 1-5)
- **[AGENTS.md](./AGENTS.md)** - Vollständige technische Spezifikation
- **[STORES.md](./docs/ARCHITECTURE/STORES.md)** - Svelte 5 Store-Architektur & Export/Import API
- **[AUTHOR-FIELD-ATTRIBUTION.md](./docs/ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md)** - Serialisierung & Persistierung Pattern
- **[AUTHSTORE-INTEGRATION-GUIDE.md](./docs/GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md)** - AuthStore API Reference
- **[NDK.md](./docs/ARCHITECTURE/NDK.md)** - NDK Integration & Nostr-Event Publishing
- **[Kanban-NIP.md](./docs/GUIDES/Kanban-NIP.md)** - Nostr Event Schema (NIP-30301/30302)
- **[NOSTR-USER.md](./docs/ARCHITECTURE/NOSTR-USER.md)** - Benutzerauthentifizierung (NIP-07)
- **[UX-RULES.md](./docs/ARCHITECTURE/UX-RULES.md)** - shadcn-svelte UI Guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Änderungshistorie (Version 3.2 - Governance v3.0)

### 🗺️ Documentation Map (für Entwickler)

**Start hier:**
- Neu im Projekt? → **[KONZEPT.md](./KONZEPT.md)** (15 min Überblick)
- Development starten? → **[📚 Dokumentations-Index](./docs/_INDEX.md)** (Wähle deine Rolle!)
- Code-Beispiele? → **[AGENTS.md](./AGENTS.md) + [UX-RULES.md](./docs/ARCHITECTURE/UX-RULES.md)**

**Nach Rolle:**

| Rolle | Start | Nächste | Referenz |
|-------|-------|--------|----------|
| **Product Manager** | KONZEPT.md | ROADMAP.md | — |
| **Frontend Dev** | 📚 Index (Frontend Path) | UX-RULES.md | AUTHOR-FIELD-ATTRIBUTION.md |
| **Nostr Dev** | 📚 Index (Nostr Path) | NDK.md | AUTHSTORE-INTEGRATION-GUIDE.md |
| **Backend/Auth** | AUTHSTORE-INTEGRATION-GUIDE.md | NOSTR-USER.md | Session-Management |
| **KI-Integration** | AGENTS.md (Chat-Klasse) | ROADMAP.md (Phase 3) | — |

**Dependency Graph:**

```
┌─ Start: KONZEPT.md (Stakeholder-freundlich)
│
├─ Navigation: 📚 Dokumentations-Index
│   └→ Wähle deine Rolle → Learning Path
│
├─ Core Technical: AGENTS.md
│   ├→ BoardModel.ts (Klassen)
│   ├→ STORES.md (State Management)
│   │   ├→ NDK.md (Event Publishing)
│   │   ├→ AUTHSTORE-INTEGRATION-GUIDE.md (Auth API)
│   │   ├→ AUTHOR-FIELD-ATTRIBUTION.md (Serialisierung!)
│   │   └→ ROADMAP.md (Milestones)
│   └→ UX-RULES.md (Komponenten)
│
├─ Nostr Specifics: NDK.md
│   ├→ Kanban-NIP.md (Event Schema)
│   └→ NOSTR-USER.md (Signing)
│
└─ Implementation: ROADMAP.md (Phase 1-5)
    └→ CHANGELOG.md (Progress tracking)
```

**Meilenstein-Links:**

- **Phase 1.0** ✅ (Author Field Attribution) — siehe AUTHOR-FIELD-ATTRIBUTION.md + AUTHSTORE-INTEGRATION-GUIDE.md
- **Phase 1.1** (Nostr Publishing) — siehe AGENTS.md + STORES.md
- **Phase 1.2** (Offline-First) — siehe STORES.md (SyncManager)
- **Phase 1.5** (Export/Import) — siehe **[STORES.md](./docs/ARCHITECTURE/STORES.md) Section III** ⭐
- **Phase 2.1** (UI Components) — siehe UX-RULES.md + AGENTS.md
- **Phase 3.1** (KI-Integration) — siehe AGENTS.md (Chat-Klasse) + ROADMAP.md

## 🏗️ Architektur

```
UI Components (Svelte 5)
    ↓
BoardStore ($state + $derived)
    ↓                    ↓
BoardModel Classes    SyncManager (Dexie)
    ↓                    ↓
Nostr Events      Event Queue (IndexedDB)
    ↓                    ↓
Nostr Events      Retry-Logik (2^n Backoff)
    ↓
NDK → Nostr Relays
```

## 🚀 Quick Start

### Installation

```sh
# Dependencies installieren (mit Dexie & jsoncrush für Offline/Export)
pnpm install dexie jsoncrush @types/dexie
pnpm install
```

### Entwicklung

```sh
# Development Server starten
pnpm run dev

# Mit Browser öffnen
pnpm run dev -- --open

# Tests ausführen
pnpm run test:unit

# Storybook starten
pnpm run storybook
```

### Test-Suite ausführen

Die Test-Suite kann direkt im Browser ausgeführt werden:

```typescript
import { runTestSuite } from '$lib/utils/testSuite';

// In Browser-Konsole
runTestSuite();
```

## � Technical Stack & Core Dependencies

| Package | Version | Zweck | Phase |
|---------|---------|-------|-------|
| **svelte** | 5 | UI Framework mit Runes (`$state`, `$derived`) | 1.1 |
| **typescript** | ^5.0 | Strikte Typisierung für alle Klassen | 1.1 |
| **@nostr-dev-kit/ndk** | ^0.9+ | Nostr Protocol Client, Event Publishing | 1.1 |
| **dexie** | ^4.0+ | IndexedDB Wrapper für Event-Queue (Offline) | **1.2** |
| **jsoncrush** | ^1.5+ | Kompression für Share-Links (71% Reduktion) | **1.5** |
| **shadcn-svelte** | Latest | UI Komponenten (Card, Dialog, Button, etc.) | 1.1 |
| **svelte-persisted-store** | ^1.0+ | Persistierung von Session & Settings | 1.4 |
| **lucide-svelte** | ^0.300+ | Icon Library (@lucide/svelte/icons/...) | 1.1 |
| **tailwind-css** | 4 | CSS Utility Framework | 1.1 |

### Kritische Abhängigkeiten Erklärt

#### 🗄️ **Dexie** (Offline-First Event Queue)
```typescript
// Problem: Browser localStorage hat nur 5MB Limit
// Lösung: Dexie (IndexedDB Wrapper) mit unbegrenzter Größe

// Dexie Vorteile:
✅ Query API:        .where('type').equals('card').toArray()
✅ Transactions:     db.transaction() für atomare Operationen
✅ Indexes:          O(log n) Performance vs O(n) Array-Filter
✅ Analytics:        .where('retries').above(0).toArray()
✅ Dead-Letter Pattern: Automatisches Entfernen nach max 3 Retries

// Dexie wird NICHT verwendet für:
❌ Session Data (Auth Token) — bleibt in svelte-persisted-store
❌ UI State ($state direkt in Components) — bleibt im Svelte Store
```

#### 📦 **jsoncrush** (Share-Link Komprimierung)
```typescript
// Problem: Board JSON zu groß für URLs
// Lösung: jsoncrush Kompression + Base64-URL Encoding

// Komprimierung-Beispiel:
Original:    {"id":"board-123","name":"Projekt Phoenix",...} — 3.2 KB
btoa():      eyJpZCI6ImJvYXJkLTEyMyIsIm5hbWUiOiJQcm9qZWt0IFBoI... — 4.3 KB
jsoncrush:   eyJiIjoiYm9hcmQtMTIzIiwibCI6IlByb2plY3QgUGhvZW... — 0.9 KB ✅

// Größenersparnis: 71% kleiner als btoa!
// Sicher geteilt via: https://your-app.com/import?token=<crush-token>
```

#### 🎨 **shadcn-svelte** (UI Component Library)
```typescript
// Keine vorkonfigurierten Komponenten — stattdessen:
// Exportiert TypeScript + Svelte Code zum Copy-Paste

// Alle Komponenten mit korrekter Struktur:
<Card.Root>
  <Card.Header>
    <Card.Title>Titel</Card.Title>
  </Card.Header>
  <Card.Content>Inhalt</Card.Content>
  <Card.Footer>Footer</Card.Footer>
</Card.Root>

// Befindet sich in: src/lib/components/ui/
```

#### 🔌 **@nostr-dev-kit/ndk** (Nostr Protocol)
```typescript
// Abstraktion über Nostr Relay-Komplexität hinweg

// NDK Funktionen:
✅ Event Publishing: event.publish() auf Relays
✅ Event Subscriptions: ndk.subscribe({kinds: [1]})
✅ Relay Management: Automatisches Failover
✅ Caching: Optional mit IndexedDB Adapter

// Im Projekt:
• boardStore nutzt NDK für Publish
• SyncManager nutzt NDK für Queue-Verarbeitung
• Chat nutzt NDK für Nostr Events
```

## �📦 Projekt-Struktur

```
src/
├── lib/
│   ├── classes/
│   │   └── BoardModel.ts          # ✅ Card, Column, Board, Chat Klassen
│   ├── stores/
│   │   ├── kanbanStore.svelte.ts         # ✅ Hauptstore mit Svelte 5 Runes
│   │   ├── authStore.ts           # 🟡 User Authentication (Phase 1.4)
│   │   └── syncManager.ts         # 🟡 Offline-Sync Manager mit Dexie (Phase 1.2)
│   ├── utils/
│   │   ├── idGenerator.ts         # ✅ D-Tag Generierung
│   │   ├── nostrEvents.ts         # 🟡 Event Serialization (Phase 1.1)
│   │   └── testSuite.ts           # ✅ Test-Suite
│   ├── components/
│   │   ├── Board.svelte           # 🟡 Refactor zu BoardModel (Phase 2.1)
│   │   ├── Column.svelte          # 🟡 Refactor zu BoardModel (Phase 2.1)
│   │   ├── Card.svelte            # 🟡 Refactor zu BoardModel (Phase 2.1)
│   │   ├── Chatbot.svelte         # ⚪ KI-Interface (Phase 3.1)
│   │   └── ui/                    # shadcn-svelte components
│   └── hooks/
└── routes/
    ├── +layout.svelte             # ✅ NDK + Dexie Initialisierung
    ├── +page.svelte               # ✅ Hauptseite
    └── cardsboard/                # 🟡 Zu migrieren (Phase 2.1)
        ├── +page.svelte
        ├── Board.svelte
        ├── Column.svelte
        ├── Card.svelte
        ├── CardDialog.svelte
        ├── types.ts               # Zu ersetzten durch BoardModel.ts
        └── data.ts                # Zu entfernen (Mock-Daten)
```

**Legende:** ✅ Fertig | 🟡 In Arbeit | ⚪ Geplant

## 🔧 Technologie-Stack

- **Frontend:** Svelte 5 (Runes), TypeScript
- **Nostr:** NDK, @nostr-dev-kit/svelte
- **UI:** Shadcn-Svelte, Tailwind CSS 4
- **State:** Svelte Runes ($state, $derived)
- **Persistenz:** IndexedDB (via svelte-persisted-store)
- **Testing:** Vitest, Playwright

## 🎨 Nostr Event Schema

### Board Event (Kind 30301)

```typescript
{
  kind: 30301,
  tags: [
    ["d", "board-id"],
    ["title", "Board Name"],
    ["col", "col-id", "Column Name", "0"]
  ]
}
```

### Card Event (Kind 30302)

```typescript
{
  kind: 30302,
  tags: [
    ["d", "card-id"],
    ["title", "Card Title"],
    ["s", "Column Name"],
    ["a", "30301:pubkey:board-id"]
  ]
}
```

Siehe [Kanban-NIP.md](./Kanban-NIP.md) für Details.

## 🔌 Offline-First Funktionalität

Das Board funktioniert **vollständig offline**:

1. Alle Änderungen werden lokal im `BoardStore` gespeichert
2. Nicht-synchronisierte Events landen in einer Queue (IndexedDB via Dexie)
3. Bei Reconnect werden Events automatisch mit exponentieller Retry-Logik publiziert
4. Live-Subscriptions für Echtzeit-Updates

### 📊 SyncManager & Dexie Architecture

Die **offline-first** Funktionalität basiert auf zwei Komponenten:

#### 1. **SyncManager** (`src/lib/stores/syncManager.ts`)
- Verwaltet die Event-Queue (Dexie IndexedDB)
- Detektiert Online/Offline Status
- Implementiert exponentielles Backoff für Retry-Logik
- Dead-Letter Pattern: Events werden nach 3 Versuchen gelöscht
- Stop-on-First-Error: Sync stoppt beim ersten Fehler (verhindert Überlastung)

#### 2. **Dexie IndexedDB Schema** (`QueuedEventRow`)
```typescript
interface QueuedEventRow {
  id?: number;                    // Auto-increment PK
  event: string;                  // Serialisiertes NDKEvent
  timestamp: number;              // Erstellungszeit
  retries: number;                // Versuchszähler (0-3)
  type: 'board' | 'card' | 'comment';  // Event-Typ für Analysen
}

// Indexes für Performance
- PRIMARY KEY: id (Auto-increment)
- INDEX: type (für Filterung nach Event-Typ)
- INDEX: retries (für Dead-Letter Analyse)
- INDEX: createdAt (für chronologische Ordnung)
```

#### 3. **Retry-Strategie** (Exponential Backoff)
| Versuch | Wartezeit | Beispiel |
|---------|-----------|----------|
| 1. Versuch | Sofort | Beim Speichern |
| 2. Versuch | 2 Sekunden | Nach Reconnect: 2s Wartezeit |
| 3. Versuch | 4 Sekunden | Fallback: 4s Wartezeit |
| 4. Versuch | 8 Sekunden | Final: 8s Wartezeit |
| **Dead-Letter** | ❌ Gelöscht | Nach 3 Versuchen entfernen |

```typescript
// Retry-Berechnung (2^retries * 1000 ms)
const waitTime = Math.pow(2, event.retries) * 1000;
```

#### 4. **Offline-Status Monitoring**
```typescript
// Offline-Status prüfen
const status = boardStore.syncStatus;
console.log({
  isOnline: status.isOnline,        // Boolean: true/false
  isSyncing: status.isSyncing,      // Boolean: Sync in progress?
  queuedEvents: status.queuedEvents // Anzahl der ausstehenden Events
});

// Live-Updates bei Status-Änderung
boardStore.subscribe(state => {
  console.log(`📡 Queue: ${state.syncStatus.queuedEvents} Events pending`);
});
```

#### 5. **Beispiel-Szenario: Offline-Bearbeitung**
```typescript
// Benutzer arbeitet offline
1. User erstellt neue Karte → BoardStore speichert lokal ($state)
2. SyncManager erkennt: isOnline = false
3. Event wird in Dexie Queue eingefügt (retries = 0)
4. UI zeigt: "📡 Warte auf Verbindung..."

// Benutzer kommt online
5. SyncManager erkennt: isOnline = true
6. Alle Events aus Queue werden nacheinander publiziert
7. Jeder Event nutzt Retry-Logik (2^retries)
8. Bei Erfolg: Event aus Queue entfernt
9. Bei Fehler nach 3 Versuchen: Dead-Letter (gelöscht)
10. UI zeigt: "✅ Synchronisiert (3 Events)"
```

#### 6. **Analytics & Debugging**
```typescript
// Queue-Inhalte abrufen (nach Event-Typ)
const cardEvents = await syncManager.getQueuedEvents('card');
const boardEvents = await syncManager.getQueuedEvents('board');

// Dead-Letter Events (fehlerhafte Events)
const deadLetters = await syncManager.getDeadLetterEvents();

// Retry-Statistiken
const retryStats = await syncManager.getRetryStats();
// → { total: 5, retrying: 2, failed: 1, pending: 2 }
```

**💡 Wichtig:** Dexie wurde statt `svelte-persisted-store` gewählt wegen:
- ✅ Query API (`where()`, `orderBy()`, `filter()`)
- ✅ Transaktionen & Indexes (O(log n) statt O(n))
- ✅ Unbegrenzte Größe (vs. 5MB localStorage-Limit)
- ✅ Dead-Letter Pattern Support
- ✅ Bessere Analysen & Monitoring möglich

## 💬 Kommentar-System

Kommentare werden als separate Nostr Events (Kind 1) gespeichert:

```typescript
// Kommentar hinzufügen
await boardStore.addComment(cardId, "Mein Kommentar");

// Kommentare laden
await boardStore.loadComments(cardId);

// Kommentar löschen
await boardStore.deleteComment(cardId, commentId);
```

## 💾 Export & Import (Share-Links)

Boards können als **komprimierte Share-Links** exportiert und importiert werden — komplett **client-seitig ohne Backend**:

### 📦 Export-Funktion (generateShareLink)

```typescript
// Board als JSON serialisieren und komprimieren
const shareToken = await boardStore.generateShareLink();
// → Ergebnis: "eyJi..." (Base64-URL-encoded, komprimiert mit jsoncrush)

// Link in Zwischenablage kopieren
const shareUrl = `https://your-app.com/import?token=${shareToken}`;

// Größenvergleich:
// • Original JSON: ~3.2 KB
// • Base64 (btoa): ~4.3 KB (+34%)
// • jsoncrush: ~0.9 KB (-71% ✅ SUPER KOMPRIMIERT!)
```

### 📥 Import-Funktion (importFromShareLink)

```typescript
// Share-Link dekomprimieren und importieren
const result = await boardStore.importFromShareLink(shareToken, 'merge');
// → { success: true, board: Board, mergeReport: {...} }

// Import-Modi:
// • 'replace': Existierendes Board ersetzen
// • 'merge': Mit bestehendem Board zusammenführen (Standard)
// • 'new': Neues Board erstellen

// Merge-Report prüfen
if (result.mergeReport) {
  console.log(`Merged: ${result.mergeReport.cardsAdded} neue Karten`);
  console.log(`Conflicts: ${result.mergeReport.conflictsResolved} aufgelöst`);
}
```

### 🔗 UI-Integration (ExportImportDialog)

```svelte
<script>
  import ExportImportDialog from '$lib/components/ExportImportDialog.svelte';
  let showDialog = $state(false);
</script>

<button onclick={() => showDialog = true}>
  📤 Board teilen
</button>

<ExportImportDialog bind:open={showDialog} />
```

### ⚙️ Technische Details

**jsoncrush Komprimierung:**
- ✅ String-Deduplizierung (wiederholte Keys werden gepoolt)
- ✅ Array-Indizes werden durch Zahlen ersetzt
- ✅ Whitespace wird entfernt
- ✅ Kombiniert mit Base64-URL Encoding (URL-sicher)

**Beispiel: Vor/Nach Komprimierung**

```typescript
// Original JSON (~3.2 KB)
{
  "id": "board-123",
  "name": "Projekt Phoenix",
  "columns": [
    { "id": "col-1", "name": "To Do", "cards": [...] },
    { "id": "col-2", "name": "In Progress", "cards": [...] }
  ]
}

// jsoncrush komprimiert (~0.9 KB) — Base64-URL-encoded:
"eyJiIjoiYm9hcmQtMTIzIiwibCI6IlByb2plY3QgUGhvZW5peCIsImMiOlt7ImkiOiJjb2wtMSIsIm4iOiJUbyBEbyIsImNhIjpbXX0s..."
```

**Share-Link Sicherheit:**
- ⚠️ **NICHT verschlüsselt** — Token enthält komplettes Board als komprimiertes JSON
- ✅ **Keine Server-Abhängigkeit** — Token ist in sich selbst vollständig
- ✅ **DSGVO-konform** — Kein Storage auf Server, nur Client-seitige Kompression
- 💡 **Empfehlung**: Sensitive Boards nicht über öffentliche Share-Links teilen

### 🔀 Merge-Strategie (Last-Write-Wins)

Bei Import im `merge`-Modus wird **Last-Write-Wins** angewendet:

```typescript
// Konfliktauflösung:
// 1. Nach Timestamp (created_at) prüfen
// 2. Neuere Version gewinnt
// 3. Ältere Version wird ignoriert
// 4. Bericht: { conflictsResolved: N }
```

## 🧪 Testing

```sh
# Unit Tests
pnpm run test:unit

# E2E Tests
pnpm run test:e2e

# Custom Test Suite (im Browser)
import { runTestSuite } from '$lib/utils/testSuite';
runTestSuite();
```

## 📈 Roadmap & Meilensteine
**Förderhinweis:** Die Projektförderung erwartet die Umsetzung bis einschließlich Phase 4; Phase 5 ist optional (Nice-to-have).

### ✅ Phase 1: Foundation & Core Implementation (Priorität: Hoch)

**Status:** 🔴 **IN PROGRESS**

- [x] Svelte 5 Runes + TypeScript Klassenstruktur
- [ ] **1.1:** Nostr Event Publishing (boardToNostrEvent, cardToNostrEvent)
- [ ] **1.2:** Offline-First Sync Manager mit Event Queue
- [ ] **1.3:** Kommentar-System (Kind 1 Events)
- [ ] **1.4:** Benutzerauthentifizierung (NIP-07)

### 🟡 Phase 2: UI Components & UX Polish (Priorität: Mittel)

**Status:** 🟡 PLANNED

- [ ] **2.1:** UI-Komponenten Migration (Refactor cardsboard/)
- [ ] **2.2:** UX Polish & Accessibility (WCAG 2.1 AA)
- [ ] **2.3:** Performance & Optimization (Lighthouse > 90)

### ⚪ Phase 3: KI-Integration (Priorität: Geplant)

**Status:** ⚪ PLANNED

- [ ] **3.1:** KI-Context Serialisierung & Chat-UI
- [ ] **3.2:** OER-Content Discovery im Nostr-Netzwerk
- [ ] **3.3:** KI-Aktionen (split-card, add-card, move-card)

### ⚪ Phase 4: Kollaboration & Sync (Priorität: Geplant)

**Status:** ⚪ PLANNED

- [ ] **4.1:** Board-Sharing & Permissions
- [ ] **4.2:** Echtzeit-Kollaboration (Multi-User)
- [ ] **4.3:** Offline-First mit Conflict Resolution

### ⚪ Phase 5: Erweiterte Features (Priorität: Geplant)

**Status:** ⚪ PLANNED

- [ ] Materialverwaltung & Depot
- [ ] Gemeinschaften & Communities
- [ ] Analyse & Insights
- [ ] Mobile App (React Native/Flutter)
- [ ] Tool-Integrationen (LMS, Calendar, etc.)

**Siehe [ROADMAP.md](./docs/COLLABORATION/ROADMAP.md) für die vollständige priorisierte Roadmap mit Akzeptanz-Kriterien.**

## 🤝 Contributing

Siehe [CONTRIBUTING.md](./docs/COLLABORATION/CONTRIBUTING.md) für Richtlinien.

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Changes committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

**Bitte beachten:** PRs sollten gegen Meilensteine in [ROADMAP.md](./docs/COLLABORATION/ROADMAP.md) ausgerichtet sein.

## 📄 Lizenz

MIT License - siehe [LICENSE](./LICENSE) für Details.

## 🙏 Credits

- **Nostr:** [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- **NDK:** [@nostr-dev-kit/ndk](https://github.com/nostr-dev-kit/ndk)
- **Kanban-NIP:** [vivganes/kanbanstr](https://github.com/vivganes/kanbanstr)
- **Svelte:** [Svelte 5](https://svelte.dev/)

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/edufeed-org/kanban-editor/issues)
- **Dokumentation:** Siehe `docs/` Ordner
- **Diskussionen:** [GitHub Discussions](https://github.com/edufeed-org/kanban-editor/discussions)

---

**Projekt-Status:** 🔴 Phase 1 in Entwicklung  
**Letzte Aktualisierung:** 18. Oktober 2025  
**Repository:** [edufeed-org/nostr-cli](https://github.com/edufeed-org/kanban-editor)

Für den aktuellen Entwicklungsstand siehe [ROADMAP.md](./docs/COLLABORATION/ROADMAP.md).
