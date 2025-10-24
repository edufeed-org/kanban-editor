# ⚙️ SettingsStore Spezifikation

**Version:** 1.0  
**Datum:** 24. Oktober 2025  
**Framework:** Svelte 5 (Runes), TypeScript  
**Status:** ✅ PRODUCTION READY (Phase 1.5)

---

## Executive Summary

Der **SettingsStore** ist das zentrale Verwaltungssystem für alle Konfigurationen des Kanban-Boards:
- **UI/UX Einstellungen** (Theme, Layout, Scroll-Verhalten)
- **Nostr Relays** (öffentlich/privat)
- **LLM Integration** (OpenAI-kompatible APIs oder lokales Ollama)
- **MCP Server** (Model Context Protocol für externe Services)
- **Board/Card Defaults** (Spalten-Vorlagen, Publish States)

**Architektur:**
```
User setzt Theme zu "dark"
    ↓
settingsStore.setTheme('dark')
    ↓
settings.theme = 'dark'  [$state update]
    ↓
isDarkMode $derived aktualisiert sich
    ↓
saveToStorage() speichert in localStorage
    ↓
+layout.svelte liest isDarkMode via $derived
    ↓
document.documentElement.classList.add('dark')
    ↓
UI zeigt Dark Mode ✅
```

---

## I. Datenmodell

### SettingsState Interface

```typescript
export interface SettingsState {
  // ──── UI/UX Settings ────
  maxCardsBeforeScroll: number;      // 1-100, Default: 20
  alignColumnsToMaxHeight: boolean;  // Default: true
  columnWidth: number;               // 200-600px, Default: 350
  theme: Theme;                      // 'dark' | 'default' | 'auto', Default: 'auto'

  // ──── Nostr Relays ────
  relaysPublic: string[];            // wss:// URLs
  relaysPrivate: string[];           // Optional private relays

  // ──── LLM Integration ────
  llmModel: string;                  // z.B. "gpt-5-mini", "ollama/mistral"
  llmBaseUrl: string;                // OpenAI-kompatible API URL
  llmApiKey: string;                 // Nicht für lokale Ollama!
  llmSystemPrompt: string;           // KI System-Prompt

  // ──── MCP Servers ────
  mcpUrls: string[];                 // https:// URLs zu MCP Servern

  // ──── Board/Card Defaults ────
  defaultColumns: string[];          // z.B. ["To Do", "In Progress", "Done"]
  defaultBoardPublishState: PublishState;  // "draft" | "published" | "private"
  defaultCardPublishState: PublishState;   // "draft" | "published" | "private"

  // ──── Sidebar Visibility ────
  showLeftSidebar: boolean;          // Board-Liste
  showRightSidebar: boolean;         // KI-Agent Sidebar
}
```

### Standard-Werte

```typescript
export const DEFAULT_SETTINGS: SettingsState = {
  // UI/UX
  maxCardsBeforeScroll: 20,
  alignColumnsToMaxHeight: true,
  columnWidth: 350,
  theme: 'auto',

  // Nostr
  relaysPublic: [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nos.lol'
  ],
  relaysPrivate: [],

  // LLM
  llmModel: 'ollama/mistral',
  llmBaseUrl: 'http://localhost:11434',
  llmApiKey: '',
  llmSystemPrompt: 'Du bist ein hilfreicher KI-Assistant...',

  // MCP
  mcpUrls: [],

  // Defaults
  defaultColumns: ['To Do', 'In Progress', 'Done'],
  defaultBoardPublishState: 'draft',
  defaultCardPublishState: 'draft',

  // Sidebar
  showLeftSidebar: true,
  showRightSidebar: true
};
```

---

## II. Architektur

### Svelte 5 Runes Pattern

```typescript
export class SettingsStore {
  // ← $state: Reactive settings
  public settings = $state<SettingsState>(this.loadSettings());

  // ← $derived: Automatisch berechnet bei Änderungen
  public isDarkMode = $derived(
    this.settings.theme === 'dark' ||
      (this.settings.theme === 'auto' && this.prefersDarkMode())
  );

  public isLlmConfigured = $derived(
    !!(this.settings.llmModel && this.settings.llmBaseUrl)
  );

  public isMcpEnabled = $derived(
    this.settings.mcpUrls.length > 0
  );

  // Auto-Save auf Änderungen (manuell aufgerufen)
  private saveToStorage(): void { ... }
}
```

### Persistierung

```
Settings geladen
    ↓
localStorage.getItem('kanban-settings') existiert?
    ├─ Ja: Parse JSON + Merge mit Defaults
    └─ Nein: Nutze DEFAULT_SETTINGS
    ↓
settings = $state(...)
    ↓
Benutzer ändert Setting
    ↓
settingsStore.setXxx() aufgerufen
    ↓
settings aktualisiert
    ↓
saveToStorage() → localStorage.setItem()
    ↓
$derived Werte aktualisieren automatisch
```

**SSR-Safety:**
```typescript
private saveToStorage(): void {
  if (typeof window === 'undefined') return;  // Skip on server
  localStorage.setItem(SettingsStore.STORAGE_KEY, JSON.stringify(this.settings));
}
```

---

## III. API Reference

### UI/UX Methods

```typescript
// Theme
settingsStore.setTheme(theme: 'dark' | 'default' | 'auto'): void
settingsStore.isDarkMode: boolean ($derived)

// Layout
settingsStore.setMaxCardsBeforeScroll(value: number): void  // 1-100
settingsStore.setColumnWidth(value: number): void          // 200-600px
settingsStore.setAlignColumnsToMaxHeight(value: boolean): void

// Theme wird auch im DOM aktualisiert
private updateTheme(theme: Theme): void
  // document.documentElement.classList.add('dark')
```

### Relay Management

```typescript
// Setzen
settingsStore.setRelaysPublic(relays: string[]): void
settingsStore.setRelaysPrivate(relays: string[]): void

// Add/Remove
settingsStore.addRelayPublic(url: string): void
settingsStore.removeRelayPublic(url: string): void

// Validation
private isValidRelayUrl(url: string): boolean  // Prüft wss:// oder ws://
```

**Beispiel:**
```typescript
settingsStore.addRelayPublic('wss://custom-relay.example.com');
// → Validiert URL, prüft ob sie nicht schon existiert
// → Speichert in localStorage
```

### LLM Configuration

```typescript
// Konfiguration
settingsStore.setLlmModel(model: string): void           // z.B. "gpt-4-mini"
settingsStore.setLlmBaseUrl(url: string): void           // OpenAI URL
settingsStore.setLlmApiKey(key: string): void            // ⚠️ Security!
settingsStore.setLlmSystemPrompt(prompt: string): void

// Status
settingsStore.isLlmConfigured: boolean ($derived)
  // true wenn llmModel && llmBaseUrl nicht leer
```

**⚠️ SECURITY HINWEIS:**
```typescript
setLlmApiKey(key: string): void {
  // Warnung wenn Remote Service (nicht localhost)
  if (!this.settings.llmBaseUrl.includes('localhost')) {
    console.warn('⚠️ API Keys for remote services should NEVER be stored in localStorage!');
    console.warn('   Use Runtime Input (user enters each time) or Backend-Proxy instead.');
    return;  // ← Nicht speichern!
  }
  
  // Nur für lokales Ollama (kein Key nötig, aber erlaubt)
  this.settings.llmApiKey = key;
  this.saveToStorage();
}
```

**Best Practice (Serverless-aware):**
```
LOCAL OLLAMA (Development):
  ✅ Funktioniert ohne API Key
  ✅ llmBaseUrl: 'http://localhost:11434'
  ✅ llmApiKey: LEER (nicht nötig)

REMOTE OPENAI (Serverless Deployment):
  ❌ API Key NIEMALS in localStorage speichern!
  ✅ Option A: Runtime Input - User gibt Key jedesmal ein
     → Key nur im Memory (wird nach Reload vergessen)
     → Sicherste für Serverless!
  ✅ Option B: Backend-Proxy - Vercel/Netlify Function
     → Backend speichert API Key
     → Frontend hat keinen Zugriff
     → Best für Production

  ⚠️ NICHT GEEIGNET FÜR SERVERLESS:
  ❌ .env.local (wird nur beim Build injiziert, nicht änderbar nach Deploy)
```

### MCP Server Management

```typescript
// Setzen
settingsStore.setMcpUrls(urls: string[]): void

// Add/Remove
settingsStore.addMcpUrl(url: string): void
settingsStore.removeMcpUrl(url: string): void

// Status
settingsStore.isMcpEnabled: boolean ($derived)
  // true wenn mcpUrls.length > 0
```

**Beispiel (n8n MCP Server):**
```typescript
settingsStore.addMcpUrl('https://n8n-server.example.com/mcp');
// → Validiert https:// oder http://
// → settings.mcpUrls wird aktualisiert
// → isMcpEnabled wird true
```

### Board/Card Defaults

```typescript
// Spalten-Template
settingsStore.setDefaultColumns(columns: string[]): void
  // z.B. ['To Do', 'Doing', 'Done']

// Publish States
settingsStore.setDefaultBoardPublishState(state: PublishState): void
settingsStore.setDefaultCardPublishState(state: PublishState): void
  // 'draft' | 'published' | 'private'

// Verwendung in boardStore:
public createBoard(name: string): string {
  const board = new Board({
    name,
    columns: settingsStore.settings.defaultColumns.map(name => ({ name })),
    publishState: settingsStore.settings.defaultBoardPublishState
  });
  // ...
}
```

### Sidebar Visibility

```typescript
// Toggle
settingsStore.toggleLeftSidebar(): void   // true ↔ false
settingsStore.toggleRightSidebar(): void

// Setzen
settingsStore.setShowLeftSidebar(value: boolean): void
settingsStore.setShowRightSidebar(value: boolean): void
```

### Batch Operations

```typescript
// Update mehrere auf einmal
settingsStore.updateSettings(partial: Partial<SettingsState>): void
  
// Export (für Backup)
const json = settingsStore.exportSettings(): string

// Import
const success = settingsStore.importSettings(json: string): boolean

// Reset auf Defaults
settingsStore.reset(): void
```

---

## IV. Verwendung in Komponenten

### Basic Usage (Svelte 5 Runes)

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  
  // Reactive derived values
  let theme = $derived(settingsStore.settings.theme);
  let isDarkMode = $derived(settingsStore.isDarkMode);
  let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);
</script>

{#if isDarkMode}
  <div class="dark">Dark Mode</div>
{:else}
  <div class="light">Light Mode</div>
{/if}

<button onclick={() => settingsStore.setTheme(theme === 'dark' ? 'default' : 'dark')}>
  Toggle Theme
</button>

<input 
  type="range" 
  min="1" 
  max="100" 
  value={maxCards}
  onchange={(e) => settingsStore.setMaxCardsBeforeScroll(parseInt(e.target.value))}
/>
```

### Theme Switcher Component

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  
  let theme = $derived(settingsStore.settings.theme);
</script>

<ToggleGroup.Root value={theme} onValueChange={(v) => settingsStore.setTheme(v)}>
  <ToggleGroup.Item value="default" aria-label="Light Mode">
    <SunIcon class="h-4 w-4" />
  </ToggleGroup.Item>
  
  <ToggleGroup.Item value="dark" aria-label="Dark Mode">
    <MoonIcon class="h-4 w-4" />
  </ToggleGroup.Item>
  
  <ToggleGroup.Item value="auto" aria-label="Auto Mode">
    <MonitorIcon class="h-4 w-4" />
  </ToggleGroup.Item>
</ToggleGroup.Root>
```

### Settings Dialog

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Button } from "$lib/components/ui/button";
  
  let open = $state(false);
  
  let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);
  let relays = $derived(settingsStore.settings.relaysPublic);
  
  function handleSave() {
    // settingsStore wird direkt aktualisiert
    // und via saveToStorage() persisted
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>⚙️ Settings</Dialog.Trigger>
  
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Settings</Dialog.Title>
    </Dialog.Header>
    
    <div class="space-y-4">
      <!-- Max Cards -->
      <Field.Root>
        <Field.Label>Max Cards Before Scroll</Field.Label>
        <Field.Content>
          <Input 
            type="number" 
            value={maxCards}
            onchange={(e) => settingsStore.setMaxCardsBeforeScroll(parseInt(e.target.value))}
          />
        </Field.Content>
      </Field.Root>
      
      <!-- LLM Config -->
      <Field.Root>
        <Field.Label>LLM Model</Field.Label>
        <Field.Content>
          <Input 
            value={settingsStore.settings.llmModel}
            onchange={(e) => settingsStore.setLlmModel(e.target.value)}
          />
        </Field.Content>
      </Field.Root>
    </div>
    
    <Dialog.Footer>
      <Button onclick={handleSave}>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

---

## V. localStorage Format

```json
{
  "kanban-settings": {
    "maxCardsBeforeScroll": 20,
    "alignColumnsToMaxHeight": true,
    "columnWidth": 350,
    "theme": "auto",
    "relaysPublic": [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://nos.lol"
    ],
    "relaysPrivate": [],
    "llmModel": "ollama/mistral",
    "llmBaseUrl": "http://localhost:11434",
    "llmApiKey": "",
    "llmSystemPrompt": "Du bist ein hilfreicher KI-Assistant...",
    "mcpUrls": [],
    "defaultColumns": ["To Do", "In Progress", "Done"],
    "defaultBoardPublishState": "draft",
    "defaultCardPublishState": "draft",
    "showLeftSidebar": true,
    "showRightSidebar": true
  }
}
```

---

## VI. Integration mit anderen Stores

### Integration mit AuthStore

```typescript
// SettingsStore ist unabhängig von AuthStore
// Aber: Standardwerte könnten benutzer-spezifisch werden (Phase 3)

// Beispiel für Zukunft:
// Wenn Benutzer A login: lade settings/user-A.json
// Wenn Benutzer B login: lade settings/user-B.json
```

### Integration mit BoardStore

```typescript
// In kanbanStore.svelte.ts

public createBoard(name: string): string {
  // ← Nutze SettingsStore für Defaults!
  const defaultColumns = settingsStore.settings.defaultColumns.map(colName => ({
    name: colName
  }));
  
  const board = new Board({
    name,
    columns: defaultColumns,
    publishState: settingsStore.settings.defaultBoardPublishState
  });
  
  // ...
}

public createCard(columnId: string, name: string): string {
  // ← Card-Default nutzen
  const card = new Card({
    heading: name,
    publishState: settingsStore.settings.defaultCardPublishState
  });
  
  // ...
}
```

### Integration mit +layout.svelte

```svelte
<!-- src/routes/+layout.svelte -->

<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { onMount } from 'svelte';
  
  // Reactive theme
  let isDarkMode = $derived(settingsStore.isDarkMode);
  
  onMount(() => {
    // Apply theme on mount
    settingsStore['updateTheme'](settingsStore.settings.theme);
  });
</script>

<!-- Class bindet sich automatisch an isDarkMode -->
<div class:dark={isDarkMode}>
  <slot />
</div>

<style>
  :global(.dark) {
    color-scheme: dark;
  }
</style>
```

---

## VII. Migrations Guide

### Von Svelte 4 `writable` zu Svelte 5 Runes

**Alt (Svelte 4):**
```typescript
export const settingsStore = writable<SettingsState>(defaultSettings);

// Verwendung:
$settingsStore.maxCardsBeforeScroll = 30;
```

**Neu (Svelte 5):**
```typescript
export const settingsStore = new SettingsStore();

// Verwendung:
settingsStore.setMaxCardsBeforeScroll(30);
settingsStore.settings.maxCardsBeforeScroll  // ← Readonly, nur via Methoden ändern!
```

**Vorteile der Runes-Version:**
- ✅ Type-safe Getter/Setter
- ✅ Automatische Validierung
- ✅ Auto-Save in localStorage
- ✅ Keine `writable()` Boilerplate
- ✅ $derived für berechnete Werte

---

## VIII. Debugging

```typescript
// Print alle aktuelle Settings
settingsStore.debugPrintSettings();
// Output:
// ⚙️ SettingsStore Debug
// Current Settings: { maxCardsBeforeScroll: 20, ... }
// isDarkMode: true
// isLlmConfigured: true
// isMcpEnabled: false
// Stored in localStorage: {...JSON...}
```

---

## IX. Roadmap

| Phase | Feature | Status | Deadline |
|-------|---------|--------|----------|
| 1.5 | Basis-Settings (UI, Theme) | ✅ Done | Okt 2025 |
| 2.1 | Settings UI Dialog | 🟡 TODO | Nov 2025 |
| 2.2 | LLM Configuration | 🟡 TODO | Nov 2025 |
| 2.3 | Relay Management UI | 🟡 TODO | Nov 2025 |
| 3.1 | Per-User Settings | ⏳ Planned | 2026 |
| 3.2 | Settings Backup/Restore | ⏳ Planned | 2026 |

---

## X. Security Considerations

### ⚠️ API Key Handling (CRITICAL!)

**REGEL: API Keys gehören NIEMALS in localStorage!**

```typescript
// ❌ FALSCH: API Key speichern
localStorage.setItem('kanban-settings', JSON.stringify({
  llmApiKey: 'sk-proj-abc123def456...'  // ← SICHERHEITSLECK!
}));
// Hacker kann es via DevTools auslesen!

// ✅ RICHTIG: API Key NICHT speichern
// Option 1: Runtime Input (User gibt Key ein) ← BEST FOR SERVERLESS!
const apiKey = prompt('OpenAI API Key eingeben:');  // ← Im Memory, nicht gespeichert
const response = await fetch('...', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});  // ← apiKey wird nach Request verworfen
// Nach Browser-Reload: Key vergessen, muss erneut eingegeben werden ✅

// Option 2: Backend-Proxy (Vercel/Netlify Functions) ← BEST FOR PRODUCTION
// Frontend → Backend (mit Session) → OpenAI API
// Backend speichert Key in Env Vars, nicht Frontend!
// Siehe: https://vercel.com/docs/functions/serverless-functions

// Option 3: Environment Variable (.env.local) ← NUR FÜR DEV, NICHT SERVERLESS!
// ⚠️ Achtung: .env.local wird nur beim Build injiziert!
// ❌ Nach Deploy können Secrets nicht mehr geändert werden
// ❌ Nur geeignet für self-hosted Backends mit Hot-Reload
```

**Settings-Speicherung:**
```typescript
// localStorage darf speichern:
llmModel: 'gpt-4-mini'        // ✅ OK (Public)
llmBaseUrl: 'https://...'      // ✅ OK (Public)
llmApiKey: ''                  // ✅ LEER! Nie gefüllt speichern!

// Für Ollama (lokal):
llmModel: 'ollama/mistral'     // ✅ OK
llmBaseUrl: 'http://localhost:11434'  // ✅ OK
llmApiKey: ''                  // ✅ LEER! Ollama braucht keinen Key!
```

### ✅ Best Practices für verschiedene Deployments

#### 1. **Lokales Ollama** (Development)
```
Deployment: Lokal + Serverless
- ✅ Kein API Key nötig (läuft lokal auf Port 11434)
- ✅ llmBaseUrl: `http://localhost:11434`
- ✅ llmApiKey: IMMER LEER
- ✅ Funktioniert offline ✅
```

#### 2. **Remote OpenAI (Serverless z.B. GitHub Pages, Vercel Static)**
```
Deployment: Serverless / Static Hosted
⚠️ .env.local funktioniert NICHT - wird nur bei Build injiziert!
❌ FALSCH: VITE_OPENAI_API_KEY in .env.local → hardcoded nach Deploy
✅ RICHTIG: Runtime Input Pattern
```

**Option A: Runtime Input (EMPFOHLEN für Serverless)**
```typescript
// User gibt API Key im Dialog ein (nur im Memory!)
const apiKey = prompt('OpenAI API Key eingeben:');
// → Wird nach Browser-Reload automatisch vergessen
// → Sicher, weil Key nie in localStorage
// → Benutzer gibt Key jedes Mal neu ein (oder aus Passwort-Manager)
```

**Option B: Backend-Proxy (EMPFOHLEN für Production)**
```typescript
// Frontend hat keinen API Key!
// Frontend → Backend (Vercel/Netlify Function) → OpenAI API
// Backend hat Secret in Env Vars (Vercel Project Settings)
// Siehe: https://vercel.com/docs/concepts/projects/environment-variables
```

#### 3. **Self-Hosted Backend (mit Hot-Reload)**
```typescript
// Nur hier ist .env.local sinnvoll!
VITE_OPENAI_API_KEY=sk-proj-abc123...  // ← .env.local
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
// Backend kann .env.local neuladen ohne neu zu deployen
```

#### 4. **Frontend Security Checklist**
- ❌ NIEMALS API Keys in localStorage
- ❌ NIEMALS API Keys in Build-Output (via .env bei Serverless)
- ❌ NIEMALS API Keys in Source Code commiten
- ✅ Nur Public Config speichern (URLs, Model Names, Theme)
- ✅ Sensitive Data: Runtime Input oder Backend-Proxy
- ✅ Für .env: NUR wenn self-hosted mit Hot-Reload

#### 5. **Entscheidungsbaum**
```
Wo wird die App gehostet?
├─ Lokal (localhost:5173)
│  └─ → Runtime Input OK, auch .env.local OK
│
├─ Serverless (GitHub Pages, Vercel Static, Netlify Static)
│  └─ → ⚠️ .env.local NICHT geeignet!
│     ├─ Option A: Runtime Input (User gibt Key ein)
│     └─ Option B: Backend-Proxy (mit Vercel Functions)
│
└─ Self-Hosted (Node.js Server)
   └─ → .env.local funktioniert mit Hot-Reload
```

---

**Status:** ✅ PRODUCTION READY  
**Letzte Änderung:** 24. Oktober 2025
