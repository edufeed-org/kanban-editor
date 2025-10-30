# Store-Architektur: Übersicht

**Verzeichnis:** `docs/ARCHITECTURE/STORES/`  
**Letztes Update:** 29. Oktober 2025  
**Status:** Vollständige Dokumentation aller Stores

---

## 📚 Dokumentations-Index

### Implementierte Stores

| Store | Datei | Status | Phase | Dokumentation |
|-------|-------|--------|-------|---------------|
| **BoardStore** | `kanbanStore.svelte.ts` | ✅ Vollständig | Phase 1 | [BOARDSTORE.md](./BOARDSTORE.md) |
| **AuthStore** | `authStore.svelte.ts` | ✅ Vollständig | Phase 1 | [AUTHSTORE.md](./AUTHSTORE.md) |
| **SettingsStore** | `settingsStore.svelte.ts` | ✅ Vollständig | Phase 1 | [SETTINGSSTORE.md](./SETTINGSSTORE.md) |

### Geplante Stores

| Store | Datei | Status | Phase | Dokumentation |
|-------|-------|--------|-------|---------------|
| **SyncManager** | `syncManager.ts` | ⏳ TODO | Phase 1.2 | [SYNCMANAGER.md](./SYNCMANAGER.md) |
| **ChatBotStore** | `chatBotStore.svelte.ts` | ⏳ TODO | Phase 3.1-3.3 | [CHATBOTSTORE.md](./CHATBOTSTORE.md) |

---

## 🎯 Quick Start für Entwickler

### Store nutzen in Komponenten

```svelte
<script lang="ts">
    // Importiere Store
    import { boardStore } from '$lib/stores/kanbanStore.svelte';
    import { authStore } from '$lib/stores/authStore.svelte';
    import { settingsStore } from '$lib/stores/settingsStore.svelte';
    
    // Reaktiver Zugriff via $derived
    let columns = $derived(boardStore.uiData);
    let isLoggedIn = $derived(authStore.isAuthenticated);
    let theme = $derived(settingsStore.settings.theme);
    
    // Store-API aufrufen
    boardStore.createCard(columnId, 'Titel', 'Beschreibung');
    await authStore.loginWithNip07();
    settingsStore.setTheme('dark');
</script>
```

### Wichtigste Regeln (für AI-Agents)

| Regel | Store | Severity |
|-------|-------|----------|
| **IMMER** `triggerUpdate()` nach Board-Änderungen | BoardStore | 🔴 CRITICAL |
| **NIEMALS** Private Keys speichern | AuthStore | 🔴 CRITICAL |
| **IMMER** Settings via Reassignment updaten | SettingsStore | 🔴 CRITICAL |
| **IMMER** Config vor AuthStore laden | SettingsStore | 🔴 CRITICAL |
| **NIEMALS** Board-Klasse direkt mutieren | BoardStore | 🔴 CRITICAL |

---

## 📋 Store-Verantwortlichkeiten

### BoardStore (kanbanStore.svelte.ts)

**Zweck:** Single Source of Truth für alle Board-Daten

**Kernfunktionen:**
- ✅ Multi-Board-Verwaltung (Create, Load, Delete)
- ✅ CRUD-Operationen (Cards, Columns, Comments)
- ✅ Reaktive UI-Anbindung (`$derived.by()`)
- ✅ Auto-Persistierung (localStorage)
- ✅ Autorisierung (Maintainer-basiert)
- ✅ MRU-Reload (Most Recently Used Board)
- ✅ Paste-System Integration

**API-Highlights:**
```typescript
// Board-Verwaltung
boardStore.createBoard(name: string): string
boardStore.loadBoard(boardId: string): boolean
boardStore.getAllBoards(): Array<{ id, name, updatedAt }>
boardStore.deleteBoard(boardId?: string): boolean

// CRUD
boardStore.createCard(columnId, name, description?): string
boardStore.editCard(cardId, updates): void
boardStore.moveCard(cardId, fromColId, toColId): void
boardStore.addComment(cardId, text, author): void

// UI-Events
boardStore.syncBoardState(uiColumns): boolean
boardStore.handleCardPaste(cardId, clipboardData): Promise<PasteResult>

// Reactive Data
boardStore.uiData  // $derived → UIColumn[]
boardStore.boardMeta  // $derived → { id, name, description }
```

**Siehe:** [BOARDSTORE.md](./BOARDSTORE.md)

---

### AuthStore (authStore.svelte.ts)

**Zweck:** Benutzerauthentifizierung via Nostr

**Kernfunktionen:**
- ✅ NIP-07 Browser Extension Login (Production)
- ✅ nsec Private Key Login (Development ONLY)
- ✅ Demo-Modus (Offline Identity)
- ✅ Session-Management (7 Tage Expiration)
- ✅ Profile-Updates (NIP-05 Verifikation)
- ✅ Auto-Restore bei App-Start

**API-Highlights:**
```typescript
// Login
authStore.loginWithNip07(): Promise<NDKUser>
authStore.loginWithNsec(nsec: string): Promise<NDKUser>  // Dev only!
authStore.createDemoSession(): void

// Session
authStore.logout(): Promise<void>
authStore.updateProfile(profileData): Promise<void>

// User-Info
authStore.getPubkey(): string | null
authStore.getNpub(): string | null
authStore.getUserName(): string | null

// Reactive States
authStore.currentUser  // $state → NDKUser | null
authStore.isAuthenticated  // $derived → boolean
authStore.isLoading  // $state → boolean
```

**Security:**
- ❌ **NIEMALS** Private Keys in localStorage speichern!
- ❌ **NIEMALS** nsec-Login in Production verwenden!
- ✅ Session ohne Private Keys (nur pubkey)
- ✅ Auto-Expiration (7 Tage für Nostr, 30 Tage für Demo)

**Siehe:** [AUTHSTORE.md](./AUTHSTORE.md)

---

### SettingsStore (settingsStore.svelte.ts)

**Zweck:** Anwendungs-Einstellungen & config.json Integration

**Kernfunktionen:**
- ✅ UI/UX Settings (Theme, Column-Layout, Scroll)
- ✅ Nostr Relay-Konfiguration
- ✅ LLM-Integration (Ollama, OpenAI, etc.)
- ✅ MCP Server URLs
- ✅ Board/Card Defaults
- ✅ Sidebar Visibility
- ✅ Config.json Merge (Smart-Merge Strategie)

**API-Highlights:**
```typescript
// UI Settings
settingsStore.setTheme('dark' | 'default' | 'auto')
settingsStore.setMaxCardsBeforeScroll(value: number)
settingsStore.setColumnWidth(value: number)

// Nostr Relays
settingsStore.addRelayPublic(url: string)
settingsStore.setRelaysPublic(urls: string[])

// LLM
settingsStore.setLlmModel(model: string)
settingsStore.setLlmBaseUrl(url: string)
settingsStore.setLlmApiKey(key: string)  // ⚠️ Nur für localhost!

// Config
settingsStore.loadAndCacheConfig(): Promise<any>
settingsStore.exportSettings(): string
settingsStore.importSettings(json: string): boolean
settingsStore.reset(): void

// Reactive States
settingsStore.settings  // $state → SettingsState
settingsStore.isDarkMode  // $derived → boolean
settingsStore.isLlmConfigured  // $derived → boolean
```

**Security:**
- ❌ **NIEMALS** API-Keys für Remote-Services speichern!
- ✅ Nur für lokales Ollama (localhost) API-Keys speichern
- ✅ Config-Loading MUSS vor AuthStore erfolgen

**Siehe:** [SETTINGSSTORE.md](./SETTINGSSTORE.md)

---

### SyncManager (syncManager.ts) ⏳ TODO

**Zweck:** Offline-First Event-Queue für Nostr-Synchronisation

**Kernfunktionen (Geplant):**
- ⏳ Automatic Event-Queueing (bei Offline)
- ⏳ Retry-Logik (Exponentieller Backoff)
- ⏳ Dead-Letter Queue (nach 3 Fehlversuchen)
- ⏳ Online/Offline Detection
- ⏳ IndexedDB Persistence (via Dexie)

**API-Highlights (Geplant):**
```typescript
syncManager.publishOrQueue(event: NDKEvent, type): Promise<void>
syncManager.syncQueue(): Promise<void>
syncManager.status  // { isOnline, isSyncing, queuedEvents }
```

**Implementation:**
- Phase 1.2 (ROADMAP.md)
- Dependencies: `dexie` (IndexedDB-Wrapper)

**Siehe:** [SYNCMANAGER.md](./SYNCMANAGER.md)

---

### ChatBotStore (chatBotStore.svelte.ts) ⏳ TODO

**Zweck:** KI-Chatbot für Board-Management & Aufgaben-Splitting

**Kernfunktionen (Geplant):**
- ⏳ Message-History (persistiert)
- ⏳ Board/Card-Context-Sammlung
- ⏳ AI-Actions (`split_card`, `add_card`, etc.)
- ⏳ OpenAI-kompatible API-Integration
- ⏳ Streaming-Support (optional)

**API-Highlights (Geplant):**
```typescript
chatBotStore.sendMessage(prompt, context?): Promise<void>
chatBotStore.clearHistory(): void

chatBotStore.messages  // $derived → ChatMessage[]
chatBotStore.isLoading  // $state → boolean
```

**Implementation:**
- Phase 3.1-3.3 (ROADMAP.md)
- Basis: `Chat`-Klasse aus `BoardModel.ts`

**Siehe:** [CHATBOTSTORE.md](./CHATBOTSTORE.md)

---

## 🔄 Store-Abhängigkeiten

### Initialisierungs-Reihenfolge (KRITISCH!)

```
1. SettingsStore.loadAndCacheConfig()
   ↓
2. NDK initialisieren (mit Relays aus Settings)
   ↓
3. AuthStore initialisieren (braucht config.allow_demo_session)
   ↓
4. BoardStore (braucht AuthStore für Autorisierung)
   ↓
5. SyncManager (braucht NDK + BoardStore)
   ↓
6. ChatBotStore (braucht BoardStore + SettingsStore)
```

**Implementation in +layout.svelte:**

```typescript
import { onMount } from 'svelte';
import NDK from '@nostr-dev-kit/ndk';
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import { initializeAuth } from '$lib/stores/authStore.svelte';
import { boardStore } from '$lib/stores/kanbanStore.svelte';

onMount(async () => {
    // 1. Config laden
    await settingsStore.loadAndCacheConfig();
    
    // 2. NDK initialisieren
    const ndk = new NDK({
        explicitRelayUrls: settingsStore.settings.relaysPublic
    });
    await ndk.connect();
    
    // 3. AuthStore initialisieren
    const authStore = initializeAuth(ndk);
    
    // 4. BoardStore hat bereits Instanz (global Singleton)
    // 5. SyncManager initialisieren (TODO Phase 1.2)
    // boardStore.initializeSyncManager(ndk);
    
    // 6. ChatBotStore hat bereits Instanz (TODO Phase 3.1)
});
```

**REGEL:** Diese Reihenfolge ist **NICHT verhandelbar** — Änderungen führen zu Crashes!

---

## 🛠️ Debugging-Tools

### Browser Console

```javascript
// BoardStore
console.log('Current Board:', boardStore.data);
console.log('UI-Columns:', boardStore.uiData);
console.log('All Boards:', boardStore.getAllBoards());

// AuthStore
console.log('User:', authStore.currentUser);
console.log('Pubkey:', authStore.getPubkey());
console.log('Session:', authStore.getSessionInfo());

// SettingsStore
settingsStore.debugPrintSettings();
console.log('Config:', localStorage.getItem('kanban-config'));
```

### localStorage-Keys

| Key | Store | Inhalt |
|-----|-------|--------|
| `kanban-{boardId}` | BoardStore | Board-Daten (JSON) |
| `kanban-boards-list` | BoardStore | Array von Board-IDs |
| `nostr-user-session` | AuthStore | User-Session (ohne Private Key!) |
| `kanban-settings` | SettingsStore | Alle Settings |
| `kanban-config` | SettingsStore | Cached config.json |

---

## � Verwandte Architektur-Dokumente

- **[REACTIVITY.md](../REACTIVITY.md)** — Svelte 5 Runes ($state, $derived, $effect)
- **[NDK.md](../NDK.md)** — NDK Integration & Event Publishing
- **[AUTH-UI-COMPONENTS.md](../AUTH-UI-COMPONENTS.md)** — LoginSheet, UserHeader, ProfileEditor
- **[UX-RULES.md](../UX-RULES.md)** — shadcn-svelte UI Patterns

---

## �📚 Weitere Ressourcen

### Related Docs

- **[AGENTS.md](../../AGENTS.md)** — BoardModel-Klassen & Chat-System
- **[ROADMAP.md](../../COLLABORATION/ROADMAP.md)** — Phasen & Meilensteine
- **[NOSTR-USER.md](../NOSTR-USER.md)** — Nostr-Authentifizierung Details
- **[NDK.md](../NDK.md)** — NDK Integration Patterns
- **[UX-RULES.md](../UX-RULES.md)** — shadcn-svelte UI-Patterns

### Technische Specs

- **Svelte 5 Runes:** https://svelte-5-preview.vercel.app/docs/runes
- **NDK (Nostr Dev Kit):** https://github.com/nostr-dev-kit/ndk
- **Dexie (IndexedDB):** https://dexie.org/
- **OpenAI API:** https://platform.openai.com/docs/api-reference

---

## ✅ Checkliste für neue Store-Implementierungen

Wenn ein neuer Store erstellt wird:

- [ ] Datei mit `.svelte.ts` Endung (wenn Runes verwendet)
- [ ] `$state` für mutable Data, `$derived` für berechnete Werte
- [ ] Alle Updates via Reassignment (`this.data = { ... }`)
- [ ] localStorage-Persistierung mit SSR-Safety (`typeof window !== 'undefined'`)
- [ ] Dokumentation in `docs/ARCHITECTURE/STORES/{NAME}.md`
- [ ] Eintrag in diesem Index (README.md)
- [ ] Integration in `+layout.svelte` dokumentiert
- [ ] Security-Rules definiert (falls relevant)
- [ ] Häufige Fehler dokumentiert
- [ ] API-Referenz mit TypeScript-Signaturen

---

**Stand:** 29. Oktober 2025  
**Maintainer:** edufeed-org/kanban-editor Team  
**Lizenz:** CC-BY-4.0
