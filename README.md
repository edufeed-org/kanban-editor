# Nostr-basiertes KI-Kanban-Board für kollaborative Unterrichtsentwicklung

Ein intelligentes Kanban-Board mit KI-Unterstützung und Nostr-Integration, gebaut mit **Svelte 5** und **TypeScript**.

---

## 📊 PROJECT STATUS (31. Januar 2026)

**🎉 ALLE PHASEN ABGESCHLOSSEN - PROJEKT PRODUCTION READY!**

| Phase | Status | Highlights | Code-Lines | Tests | Docs |
|-------|--------|-----------|-----------|-------|------|
| **Phase 1** | ✅ 100% | Author, Publishing, Comments, Merge, Export/Import, Demo Boards | 2500+ | 350+ | ✅ |
| **Phase 2** | ✅ 100% | UI Components, Settings, Dark Mode, Responsive Design | 1500+ | 100+ | ✅ |
| **Phase 3** | ✅ 100% | Tool-Based AI, OER Discovery, URL Import, 12 Tools | 3000+ | 700+ | ✅ |
| **Phase 4** | ✅ 100% | Kollaboration, Soft-Locks, 3-Way Merge, Live-Sync | 1500+ | 150+ | ✅ |

### 🎯 PROJEKT ABGESCHLOSSEN: 31.01.2026
### ⚡ NEXT: Testphase & Community Feedback (01.02. - 28.02.2026)

**READ FIRST:**
1. **[🗺️ ROADMAP.md](./docs/COLLABORATION/ROADMAP.md)** ⭐ **v3.22** - Alle Meilensteine COMPLETE!
2. **[📚 Dokumentations-Index](./docs/_INDEX.md)** - Navigation nach Rolle & Thema (55+ Dateien)
3. **[🤖 Agent README](./docs/ARCHITECTURE/AGENT/README.md)** ⭐ **NEW** - Tool-Based AI System v3.0

---

## 🎯 Features

- ✅ **Offline-First:** Arbeiten Sie ohne Internetverbindung, automatische Synchronisation bei Reconnect
- 🤖 **Tool-Based KI-System:** 12 Tools für Board-Manipulation via OpenAI Function Calling
- 🔍 **OER Discovery:** Durchsuche Open Educational Resources (WLO, Serlo, OER-Hörnchen) direkt im Board
- 🔗 **URL Import:** Füge Karten aus Nostr Events, Webseiten und naddr-Links hinzu
- 🧠 **Intelligente Karten-Aufteilung:** Automatische Card-Struktur und Aufgaben-Management via LLM
- 🌐 **Nostr-basiert:** Dezentrale Speicherung über Nostr-Relays (NIP-30301/30302)
- 👥 **Echtzeit-Kollaboration:** Multi-User Editing mit Soft-Locks und 3-Way Merge
- 💬 **Kommentar-System:** Nostr-basierte Kommentare (Kind 1 Events)
- 📱 **Reaktiv:** Svelte 5 Runes für optimale Performance
- 🔒 **Typsicher:** Vollständig in TypeScript implementiert
- 🎨 **Demo-Boards:** Sofortiger Start für anonyme Nutzer mit vorkonfigurierten Boards

## 📚 Dokumentation

### 🔴 Dokumentations-Governance v3.0 AKTIV

**KRITISCH:** Code ohne Docs-Update → PR wird REJECTED!

- **[📚 DOCUMENTATION-RULES-v3.md](./docs/DOCUMENTATION-RULES-v3.md)** - 🔴 **v3.0 MANDATORY** - DoD Checklist (11 Punkte), Enforcement-Rules
- **[📚 Dokumentations-Index](./docs/_INDEX.md)** - Navigation nach Rolle & Thema (52/52 Dateien verlinkt!)
- **[📚 Phase 3.0 KI-Developer Path](./docs/_INDEX.md#-kientwickler-learning-path)** - 11 neue KI-Integration Ressourcen

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
- **[ROADMAP.md](./docs/COLLABORATION/ROADMAP.md)** - 🗺️ Priorisierte Entwicklungs-Roadmap v3.0 (Phase 1-5, Phase 3.0 Complete!)
- **[AGENTS.md](./AGENTS.md)** - Vollständige technische Spezifikation
- **[STORES.md](./docs/ARCHITECTURE/STORES.md)** - Svelte 5 Store-Architektur & Export/Import API
- **[AUTHOR-FIELD-ATTRIBUTION.md](./docs/ARCHITECTURE/AUTHOR-FIELD-ATTRIBUTION.md)** - Serialisierung & Persistierung Pattern
- **[AUTHSTORE-INTEGRATION-GUIDE.md](./docs/GUIDES/AUTHSTORE-INTEGRATION-GUIDE.md)** - AuthStore API Reference
- **[NDK.md](./docs/ARCHITECTURE/NDK.md)** - NDK Integration & Nostr-Event Publishing
- **[Kanban-NIP.md](./docs/GUIDES/Kanban-NIP.md)** - Nostr Event Schema (NIP-30301/30302)
- **[NOSTR-USER.md](./docs/ARCHITECTURE/NOSTR-USER.md)** - Benutzerauthentifizierung (NIP-07)
- **[UX-RULES.md](./docs/ARCHITECTURE/UX-RULES.md)** - shadcn-svelte UI Guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Änderungshistorie (✅ Version 5.0 - Alle Phasen Complete!)

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
- **Phase 1.5** (Export/Import) — siehe **[STORES.md](./docs/ARCHITECTURE/STORES.md) Section III** ✅
- **Phase 2** (UI Components) — siehe UX-RULES.md + AGENTS.md ✅
- **Phase 3** (Tool-Based KI) — siehe **[Agent README](./docs/ARCHITECTURE/AGENT/README.md)** ✅
- **Phase 4** (Kollaboration) — siehe **[BOARD-SHARING.md](./docs/ARCHITECTURE/BOARD-SHARING.md)** ✅

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

```

### Preview (Production Build)

`preview` servt den generierten Static-Output aus `build/` (inkl. `/_app/immutable/...`).

```sh
# Build + Preview auf http://127.0.0.1:4173
pnpm run preview

# Für CI/Container (bindet an 0.0.0.0:4173)
pnpm run preview:ci
```

Falls Port `4173` belegt ist, bricht der Preview-Start ab (kein Auto-Port-Fallback).

### Lokales Relay

1. `docker compose up # füge -d dazu, um das Terminal freizuhaben`
   - Falls du bereits läuft: nach Config-Änderungen einmal neu starten: `docker compose restart`
2. Ändere `./static/config.json` so
```json
  "nostr": {
    "relaysPublic": [
      "ws://localhost:7000"
    ],
    "relaysPrivate": []
```
3. **Wichtig (Column-Reorder als Editor):** Der lokale Relay nutzt eine `event_kind_allowlist` in `docker-relay-config.toml`.
   - Für den Column-Order Patch muss Kind `8571` erlaubt sein, sonst siehst du beim Publish: `Not enough relays received the event (0 published, 1 required)`.
3. `pnpm dev`
4. Um zu testen, ob es funktioniert, gib ins Terminal rein: `$ websocat ws://localhost:7000`

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
│   │   ├── authStore.svelte.ts    # ✅ User Authentication
│   │   ├── chatStore.svelte.ts    # ✅ AI Chat mit Message History
│   │   ├── settingsStore.svelte.ts # ✅ Theme, Relays, LLM Config
│   │   └── syncManager.svelte.ts  # ✅ Offline-Sync Manager mit Dexie
│   ├── utils/
│   │   ├── softLockManager.svelte.ts # ✅ Soft Locks mit Kind 20001
│   │   ├── mergeEngine.ts         # ✅ 3-Way Merge Algorithm
│   │   ├── cardEditingFlow.ts     # ✅ Conflict Detection
│   │   ├── idGenerator.ts         # ✅ D-Tag Generierung
│   │   └── nostrEvents.ts         # ✅ Event Serialization
│   ├── agent/                     # ✅ Tool-Based AI System
│   │   ├── index.ts               # Public API Exports
│   │   ├── types.ts               # ToolDefinition, ToolCall, ToolResult
│   │   ├── llmRequest.ts          # LLM API Wrapper
│   │   └── tools/                 # 12 Tools für Board-Manipulation
│   │       ├── toolDefinitions.ts # OpenAI Function Calling Schemas
│   │       ├── toolExecutor.ts    # Tool Dispatcher
│   │       ├── toolSystemPrompt.ts # Kontextbewusster System Prompt
│   │       ├── oer/               # OER Discovery Tools
│   │       └── url/               # URL Import Tools
│   ├── components/
│   │   ├── Board.svelte           # ✅ DnD Container mit Store-Sync
│   │   ├── Column.svelte          # ✅ $effect Auto-Sync
│   │   ├── Card.svelte            # ✅ Mit CardDialog Integration
│   │   ├── AIPanel.svelte         # ✅ KI-Interface mit Tool Calls
│   │   └── ui/                    # shadcn-svelte components
│   └── hooks/
└── routes/
    ├── +layout.svelte             # ✅ NDK + Dexie Initialisierung
    ├── +page.svelte               # ✅ Landing Page mit Auth
    └── cardsboard/                # ✅ Kanban-Board Route
        ├── +page.svelte           # ✅ Board-Page mit Sidebar-Layout
        ├── Board.svelte           # ✅ DnD Container
        ├── Column.svelte          # ✅ Spalten mit $effect Sync
        ├── Card.svelte            # ✅ Karten mit Metadaten
        ├── CardDialog.svelte      # ✅ Edit Modal
        ├── CardDetailsDialog.svelte # ✅ View Modal mit Kommentaren
        ├── AIPanel.svelte         # ✅ KI-Chat Interface
        └── Topbar.svelte          # ✅ Navigation + Share-Link
```

**Status:** ✅ Alle Komponenten Production Ready

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

**🎉 ALLE FÖRDERPHASEN ABGESCHLOSSEN (31.01.2026)**

### ✅ Phase 1: Foundation & Core Implementation

**Status:** ✅ **COMPLETE**

- [x] **1.0:** Svelte 5 Runes + TypeScript Klassenstruktur
- [x] **1.1:** Nostr Event Publishing (Last-Write-Wins, Echo-Loop Prevention)
- [x] **1.2:** Offline-First Sync Manager mit Dexie Queue
- [x] **1.3:** Kommentar-System (Kind 1 Events mit Nostr Publishing)
- [x] **1.4:** Benutzerauthentifizierung (NIP-07, nsec, OIDC)
- [x] **1.5:** Export/Import (JSON, Share-Links mit jsoncrush)
- [x] **1.6:** Demo Board System für anonyme Nutzer

### ✅ Phase 2: UI Components & UX Polish

**Status:** ✅ **COMPLETE**

- [x] **2.1:** UI-Komponenten mit BoardStore Integration
- [x] **2.2:** shadcn-svelte Design System
- [x] **2.3:** Dark Mode + Settings Panel
- [x] **2.4:** Responsive Design (Mobile, Tablet, Desktop)

### ✅ Phase 3: KI-Integration (Tool-Based)

**Status:** ✅ **COMPLETE**

- [x] **3.0:** Tool-Based AI Architecture (OpenAI Function Calling)
- [x] **3.1:** 12 Board-Manipulation Tools
- [x] **3.2:** OER-Content Discovery (WLO, Serlo, OER-Hörnchen Integration)
- [x] **3.3:** URL Import Tools (Nostr Events, Webseiten, naddr)
- [x] **3.4:** AIPanel mit Chat-Interface

### ✅ Phase 4: Kollaboration & Sync

**Status:** ✅ **COMPLETE**

- [x] **4.1:** Board-Sharing mit Maintainers (p-tags)
- [x] **4.2:** SoftLockManager (Kind 20001 Ephemeral Events)
- [x] **4.3:** MergeEngine (3-Way Merge Algorithm)
- [x] **4.4:** CardEditingFlow (Conflict Detection)
- [x] **4.5:** Live-Sync via Nostr Subscriptions
- [x] **4.6:** Column-Order Patch (Kind 8571)

### 🟡 Phase 5: Erweiterte Features (Optional)

**Status:** 🟡 **FUTURE**

- [ ] Materialverwaltung & Depot
- [ ] Gemeinschaften & Communities
- [ ] Analyse & Insights Dashboard
- [ ] Mobile App (PWA Ready)
- [ ] LMS-Integrationen (Moodle, Ilias)

**Siehe [ROADMAP.md](./docs/COLLABORATION/ROADMAP.md) für Details zu allen Meilensteinen.**

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

**Projekt-Status:** ✅ Phase 1-4 COMPLETE | 🧪 Testphase ab 01.02.2026  
**Letzte Aktualisierung:** 31. Januar 2026  
**Repository:** [edufeed-org/kanban-editor](https://github.com/edufeed-org/kanban-editor)  
**Version:** 5.0 (Production Ready)

Für Details siehe [ROADMAP.md](./docs/COLLABORATION/ROADMAP.md) und [CHANGELOG.md](./CHANGELOG.md).
