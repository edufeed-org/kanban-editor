# Nostr-basiertes KI-Kanban-Board

Ein intelligentes Kanban-Board mit KI-Unterstützung und Nostr-Integration, gebaut mit **Svelte 5** und **TypeScript**.

## 🎯 Features

- ✅ **Offline-First:** Arbeiten Sie ohne Internetverbindung, automatische Synchronisation bei Reconnect
- 🧠 **KI-Integration:** Intelligente Karten-Aufteilung und Aufgaben-Management
- 🌐 **Nostr-basiert:** Dezentrale Speicherung über Nostr-Relays (NIP-30301/30302)
- 📱 **Reaktiv:** Svelte 5 Runes für optimale Performance
- 🔒 **Typsicher:** Vollständig in TypeScript implementiert
- 💬 **Kommentare:** Nostr-basierte Kommentare mit Reactions & Zaps

## 📚 Dokumentation

- **[KONZEPT.md](./KONZEPT.md)** - Produkt-Vision & Use Cases (für Stakeholder)
- **[ROADMAP.md](./ROADMAP.md)** - 🗺️ Priorisierte Entwicklungs-Roadmap (Phase 1-5)
- **[AGENTS.md](./AGENTS.md)** - Vollständige technische Spezifikation
- **[STORES.md](./STORES.md)** - Svelte 5 Store-Architektur & Export/Import API
- **[CODE-ANALYSE.md](./CODE-ANALYSE.md)** - Aktueller Codebase-Status (17.10.2025)
- **[NDK.md](./NDK.md)** - NDK Integration & Nostr-Event Publishing
- **[Kanban-NIP.md](./Kanban-NIP.md)** - Nostr Event Schema (NIP-30301/30302)
- **[NOSTR-USER.md](./NOSTR-USER.md)** - Benutzerauthentifizierung (NIP-07)
- **[UX-RULES.md](./UX-RULES.md)** - shadcn-svelte UI Guidelines
- **[CHANGELOG.md](./CHANGELOG.md)** - Änderungshistorie

### 🗺️ Documentation Map (für Entwickler)

**Start hier:**
- Neu im Projekt? → **[KONZEPT.md](./KONZEPT.md)** (15 min Überblick)
- Development starten? → **[AGENTS.md](./AGENTS.md) → [STORES.md](./STORES.md)**

**Nach Rolle:**

| Rolle | Start | Nächste | Referenz |
|-------|-------|--------|----------|
| **Product Manager** | KONZEPT.md | ROADMAP.md | — |
| **Frontend Dev** | AGENTS.md | UX-RULES.md, STORES.md | Komponenten- Referenz |
| **Nostr Dev** | NDK.md | Kanban-NIP.md | nostrEvents.ts |
| **Backend/Auth** | NOSTR-USER.md | NDK.md | Session-Management |
| **KI-Integration** | AGENTS.md (Chat-Klasse) | ROADMAP.md (Phase 3) | — |

**Dependency Graph:**

```
┌─ Start: KONZEPT.md (Stakeholder-freundlich)
│
├─ Core Technical: AGENTS.md
│   ├→ BoardModel.ts (Klassen)
│   ├→ STORES.md (State Management)
│   │   ├→ NDK.md (Event Publishing)
│   │   ├→ NOSTR-USER.md (Auth)
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

- **Phase 1.1** (Nostr Publishing) — siehe AGENTS.md + STORES.md
- **Phase 1.2** (Offline-First) — siehe STORES.md (SyncManager)
- **Phase 1.5** (Export/Import) — siehe **[STORES.md](./STORES.md) Section III** ⭐
- **Phase 2.1** (UI Components) — siehe UX-RULES.md + AGENTS.md
- **Phase 3.1** (KI-Integration) — siehe AGENTS.md (Chat-Klasse) + ROADMAP.md

## 🏗️ Architektur

```
UI Components (Svelte 5)
    ↓
BoardStore ($state + $derived)
    ↓                    ↓
BoardModel Classes    SyncManager
    ↓                    ↓
Nostr Events      Event Queue (IndexedDB)
    ↓
NDK → Nostr Relays
```

## 🚀 Quick Start

### Installation

```sh
# Dependencies installieren
pnpm install
```

### Entwicklung

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

## 📦 Projekt-Struktur

```
src/
├── lib/
│   ├── classes/
│   │   └── BoardModel.ts          # ✅ Card, Column, Board, Chat Klassen
│   ├── stores/
│   │   ├── kanbanStore.ts         # ✅ Hauptstore mit Svelte 5 Runes
│   │   ├── userStore.ts           # 🟡 User Authentication (Phase 1.4)
│   │   └── syncManager.ts         # 🟡 Offline-Sync Manager (Phase 1.2)
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
    ├── +layout.svelte             # ✅ NDK Initialisierung
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
2. Nicht-synchronisierte Events landen in einer Queue (IndexedDB)
3. Bei Reconnect werden Events automatisch publiziert
4. Live-Subscriptions für Echtzeit-Updates

```typescript
// Offline-Status prüfen
const status = boardStore.syncStatus;
console.log(status.isOnline, status.queuedEvents);
```

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

**Siehe [ROADMAP.md](./ROADMAP.md) für die vollständige priorisierte Roadmap mit Akzeptanz-Kriterien.**

## 🤝 Contributing

Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) für Richtlinien.

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Changes committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

**Bitte beachten:** PRs sollten gegen Meilensteine in [ROADMAP.md](./ROADMAP.md) ausgerichtet sein.

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
**Repository:** [johappel/nostr-cli](https://github.com/edufeed-org/kanban-editor)

Für den aktuellen Entwicklungsstand siehe [CODE-ANALYSE.md](./CODE-ANALYSE.md) und [ROADMAP.md](./ROADMAP.md).
