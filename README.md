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

- **[AGENTS.md](./AGENTS.md)** - Vollständige Projekt-Spezifikation
- **[NDK.md](./NDK.md)** - NDK Integration & Nostr-Events
- **[Kanban-NIP.md](./Kanban-NIP.md)** - Nostr Event Schema (NIP-30301/30302)
- **[ANALYSE.md](./ANALYSE.md)** - Aktueller Status & Roadmap
- **[CHANGELOG.md](./CHANGELOG.md)** - Änderungshistorie

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

# NDK Svelte Components (optional)
pnpm add @nostr-dev-kit/ndk-svelte-components
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
│   │   └── BoardModel.ts          # Card, Column, Board, Chat Klassen
│   ├── stores/
│   │   ├── kanbanStore.ts         # Hauptstore mit Svelte 5 Runes
│   │   └── syncManager.ts         # Offline-Sync Manager
│   ├── utils/
│   │   ├── idGenerator.ts         # D-Tag Generierung
│   │   ├── nostrEvents.ts         # Event Serialization
│   │   └── testSuite.ts           # Test-Suite
│   └── components/
│       ├── Board.svelte           # Board Container
│       ├── Column.svelte          # Spalten-Komponente
│       ├── Card.svelte            # Karten-Komponente
│       └── Chatbot.svelte         # KI-Interface
└── routes/
    ├── +layout.svelte             # NDK Initialisierung
    └── +page.svelte               # Hauptseite
```

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

## 📈 Roadmap

Siehe [ANALYSE.md](./ANALYSE.md) für die vollständige Roadmap.

**Phase 1:** Nostr Event Publishing (in Arbeit)  
**Phase 2:** UI-Komponenten Migration  
**Phase 3:** Offline-Sync Manager  
**Phase 4:** KI-Integration  
**Phase 5:** Erweiterte Features

## 🤝 Contributing

1. Fork das Repository
2. Feature Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Änderungen committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

## 📄 Lizenz

MIT License - siehe [LICENSE](./LICENSE) für Details.

## 🙏 Credits

- **Nostr:** [Nostr Protocol](https://github.com/nostr-protocol/nostr)
- **NDK:** [@nostr-dev-kit/ndk](https://github.com/nostr-dev-kit/ndk)
- **Kanban-NIP:** [vivganes/kanbanstr](https://github.com/vivganes/kanbanstr)
- **Svelte:** [Svelte 5](https://svelte.dev/)

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/johappel/nostr-cli/issues)
- **Dokumentation:** Siehe `docs/` Ordner
- **Diskussionen:** [GitHub Discussions](https://github.com/johappel/nostr-cli/discussions)

---

**Hinweis:** Dieses Projekt befindet sich in aktiver Entwicklung. Siehe [ANALYSE.md](./ANALYSE.md) für den aktuellen Status.

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [npm](https://www.npmjs.com):

```sh
npm publish
```
