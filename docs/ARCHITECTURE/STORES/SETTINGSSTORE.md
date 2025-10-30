# SettingsStore Dokumentation

**Datei:** `src/lib/stores/settingsStore.svelte.ts`  
**Technologie:** Svelte 5 Runes + Config.json Integration  
**Zweck:** Anwendungs-Einstellungen (UI, Relays, LLM, MCP, Defaults)

---

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Settings-Kategorien](#settings-kategorien)
3. [Config.json Integration](#configjson-integration)
4. [Reaktive API](#reaktive-api)
5. [Persistierung](#persistierung)
6. [Best Practices](#best-practices)
7. [Häufige Fehler](#häufige-fehler)

---

## Übersicht

Der `SettingsStore` verwaltet **alle Anwendungs-Einstellungen** und merged sie mit einer optionalen `config.json`-Datei. Er verwendet Svelte 5 Runes für Reaktivität.

### Verantwortlichkeiten

- ✅ **UI/UX Settings** — Theme, Column-Layout, Scroll-Verhalten
- ✅ **Nostr Relays** — Public/Private Relay-URLs
- ✅ **LLM Integration** — OpenAI-kompatible API (Ollama, OpenAI, etc.)
- ✅ **MCP Server URLs** — Model Context Protocol Integration
- ✅ **Board/Card Defaults** — Default-Spalten, PublishState
- ✅ **Sidebar Visibility** — Left/Right Sidebar Toggle

### Verwendung in Komponenten

```typescript
import { settingsStore } from '$lib/stores/settingsStore.svelte';

// Reaktiver Zugriff
let theme = $derived(settingsStore.settings.theme);
let isDark = $derived(settingsStore.isDarkMode);

// Update
settingsStore.setTheme('dark');
settingsStore.setMaxCardsBeforeScroll(30);
```

---

## Settings-Kategorien

### 1. UI/UX Settings

```typescript
interface UISettings {
    maxCardsBeforeScroll: number;      // Default: 20
    alignColumnsToMaxHeight: boolean;  // Default: true
    columnWidth: number;                // Default: 350px
    theme: 'dark' | 'default' | 'auto'; // Default: 'auto'
}
```

**API:**

```typescript
// Theme
settingsStore.setTheme('dark');
settingsStore.isDarkMode  // $derived (auto-berechnet)

// Column-Layout
settingsStore.setMaxCardsBeforeScroll(30);
settingsStore.setAlignColumnsToMaxHeight(false);
settingsStore.setColumnWidth(400);
```

**REGEL 1:** Theme-Änderungen aktualisieren **automatisch** `document.documentElement.classList`.

**Implementation:**

```typescript
private updateTheme(theme: Theme): void {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    
    if (theme === 'dark') {
        root.classList.add('dark');
    } else if (theme === 'auto') {
        if (this.prefersDarkMode()) {
            root.classList.add('dark');
        } else {
            root.classList.add('light');
        }
    }
}

private prefersDarkMode(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
```

---

### 2. Nostr Relay Settings

```typescript
interface RelaySettings {
    relaysPublic: string[];   // Default: ['wss://relay-rpi.edufeed.org', ...]
    relaysPrivate: string[];  // Default: []
}
```

**API:**

```typescript
// Set all relays
settingsStore.setRelaysPublic([
    'wss://relay.damus.io',
    'wss://relay.primal.net'
]);

// Add single relay
settingsStore.addRelayPublic('wss://nos.lol');

// Remove relay
settingsStore.removeRelayPublic('wss://relay.damus.io');
```

**REGEL 2:** Relay-URLs MÜSSEN validiert werden (nur `wss://` oder `ws://` erlaubt).

**Validierung:**

```typescript
private isValidRelayUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch {
        return false;
    }
}

public addRelayPublic(url: string): void {
    const isValid = this.isValidRelayUrl(url);
    const alreadyExists = this.settings.relaysPublic.includes(url);
    
    if (isValid && !alreadyExists) {
        this.settings.relaysPublic = [...this.settings.relaysPublic, url];
        this.saveToStorage();
    }
}
```

---

### 3. LLM Model Integration

```typescript
interface LLMSettings {
    llmModel: string;        // Default: 'ollama/mistral'
    llmBaseUrl: string;      // Default: 'http://localhost:11434'
    llmApiKey: string;       // Default: '' (leer für Ollama)
    llmSystemPrompt: string; // Default: 'Du bist...'
}
```

**API:**

```typescript
settingsStore.setLlmModel('gpt-4-mini');
settingsStore.setLlmBaseUrl('https://api.openai.com/v1');
settingsStore.setLlmApiKey('sk-...');  // ⚠️ Nur für lokales Ollama!
settingsStore.setLlmSystemPrompt('Custom prompt...');

// Check ob konfiguriert
let configured = $derived(settingsStore.isLlmConfigured);
```

**⚠️ SECURITY WARNING:**

```typescript
public setLlmApiKey(key: string): void {
    // Warnung bei Remote-API
    if (!this.settings.llmBaseUrl.includes('localhost') &&
        !this.settings.llmBaseUrl.includes('127.0.0.1')) {
        console.warn(
            '⚠️ WARNING: Storing API keys for remote services is not recommended. ' +
            'Use environment variables instead.'
        );
    }
    
    this.settings = { ...this.settings, llmApiKey: key };
    this.saveToStorage();
}
```

**REGEL 3:** API-Keys für **Remote-Services** NIEMALS in localStorage speichern!

**Best Practice:**
- ✅ Ollama (localhost): API-Key leer lassen
- ✅ OpenAI/Remote: API-Key via `.env` bereitstellen (nicht speichern)
- ❌ OpenAI API-Key in localStorage = **Sicherheitsleck!**

---

### 4. MCP Server Configuration

```typescript
interface MCPSettings {
    mcpUrls: string[];  // Default: []
}
```

**API:**

```typescript
settingsStore.setMcpUrls([
    'http://localhost:8080/mcp',
    'https://my-mcp-server.com/api'
]);

settingsStore.addMcpUrl('http://localhost:3000/mcp');
settingsStore.removeMcpUrl('http://localhost:8080/mcp');

// Check ob aktiviert
let mcpEnabled = $derived(settingsStore.isMcpEnabled);
```

**REGEL 4:** MCP-URLs MÜSSEN validiert werden (`http://` oder `https://`).

---

### 5. Board/Card Defaults

```typescript
interface DefaultSettings {
    defaultColumns: string[];              // Default: ['To Do', 'In Progress', 'Done']
    defaultBoardPublishState: PublishState; // Default: 'draft'
    defaultCardPublishState: PublishState;  // Default: 'draft'
}
```

**API:**

```typescript
settingsStore.setDefaultColumns(['Backlog', 'Sprint', 'Review', 'Done']);
settingsStore.setDefaultBoardPublishState('published');
settingsStore.setDefaultCardPublishState('draft');
```

**Verwendung:**

```typescript
// In BoardStore
public createBoard(name: string) {
    const defaultCols = settingsStore.settings.defaultColumns;
    
    return new Board({
        name,
        publishState: settingsStore.settings.defaultBoardPublishState,
        columns: defaultCols.map(colName => ({ name: colName }))
    });
}
```

**REGEL 5:** BoardStore nutzt `settingsStore.settings.defaultColumns` beim Board-Create.

---

### 6. Sidebar Visibility

```typescript
interface SidebarSettings {
    showLeftSidebar: boolean;   // Default: true
    showRightSidebar: boolean;  // Default: true
}
```

**API:**

```typescript
settingsStore.toggleLeftSidebar();
settingsStore.toggleRightSidebar();

settingsStore.setShowLeftSidebar(false);
settingsStore.setShowRightSidebar(true);

// In Component
let showLeft = $derived(settingsStore.settings.showLeftSidebar);
let showRight = $derived(settingsStore.settings.showRightSidebar);
```

**Verwendung in Topbar:**

```svelte
<script lang="ts">
    import { settingsStore } from '$lib/stores/settingsStore.svelte';
    
    let { showLeft, showRight } = $derived({
        showLeft: settingsStore.settings.showLeftSidebar,
        showRight: settingsStore.settings.showRightSidebar
    });
</script>

<button onclick={() => settingsStore.toggleLeftSidebar()}>
    Toggle Left Sidebar
</button>
```

---

## Config.json Integration

### Dateistruktur

```json
{
  "ui": {
    "maxCardsBeforeScroll": 25,
    "alignColumnsToMaxHeight": false,
    "columnWidth": 400,
    "theme": "dark"
  },
  "nostr": {
    "relaysPublic": [
      "wss://relay-rpi.edufeed.org",
      "wss://relay.primal.net"
    ],
    "relaysPrivate": []
  },
  "llm": {
    "model": "gpt-4-mini",
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "",
    "systemPrompt": "Du bist ein hilfsbereiter KI-Assistant..."
  },
  "mcp": {
    "urls": [
      "http://localhost:8080/mcp"
    ]
  },
  "defaults": {
    "columns": ["Backlog", "Sprint", "Review", "Done"],
    "boardPublishState": "draft",
    "cardPublishState": "draft"
  },
  "sidebar": {
    "showLeft": true,
    "showRight": false
  },
  "allow_demo_session": {
    "enabled": true,
    "max_duration_days": 30
  }
}
```

**Location:**
- Development: `/public/config.json`
- Production: `/static/config.json` → kopiert zu `/build/config.json`

### Loading & Caching

```typescript
/**
 * Lädt config.json und cached sie in localStorage
 * MUSS vor AuthStore-Initialisierung aufgerufen werden!
 */
public async loadAndCacheConfig(): Promise<any> {
    if (typeof window === 'undefined') return null;
    
    // 1. Cache-Check
    const cached = localStorage.getItem('kanban-config');
    if (cached) {
        console.log('✅ Config loaded from cache');
        return JSON.parse(cached);
    }
    
    // 2. Fetch von /config.json
    const response = await fetch('/config.json');
    if (!response.ok) {
        console.warn(`⚠️ config.json not found (${response.status}), using defaults`);
        return null;
    }
    
    const config = await response.json();
    
    // 3. Cache in localStorage
    localStorage.setItem('kanban-config', JSON.stringify(config));
    console.log('✅ Config loaded and cached');
    
    return config;
}
```

**REGEL 6:** Config MUSS vor AuthStore geladen werden (wegen `allow_demo_session`).

**Initialisierung in +layout.svelte:**

```typescript
import { settingsStore } from '$lib/stores/settingsStore.svelte';
import { initializeAuth } from '$lib/stores/authStore.svelte';

onMount(async () => {
    // 1. Config laden (async, cached)
    await settingsStore.loadAndCacheConfig();
    
    // 2. NDK initialisieren
    const ndk = new NDK({...});
    
    // 3. AuthStore initialisieren
    const authStore = initializeAuth(ndk);
});
```

### Merge-Strategie

```typescript
/**
 * Merged config.json in Settings
 * 
 * Smart-Merge:
 * - User hat KEINE Settings → config.json als Defaults
 * - User hat Settings → config.json wird NICHT gemerged (User-Präferenz!)
 * - Force-Overwrite → config.json überschreibt ALLES
 */
private mergeConfigIntoSettings(config: any, forceOverwrite: boolean = false): void {
    const hasUserSettings = localStorage.getItem('kanban-settings') !== null;
    
    if (hasUserSettings && !forceOverwrite) {
        console.log('✅ User-Settings vorhanden → config.json wird NICHT gemerged');
        return;
    }
    
    // Merge UI Settings
    if (config.ui) {
        this.settings = {
            ...this.settings,
            maxCardsBeforeScroll: config.ui.maxCardsBeforeScroll,
            theme: config.ui.theme,
            ...
        };
    }
    
    // Merge Nostr Settings
    if (config.nostr) {
        this.settings = {
            ...this.settings,
            relaysPublic: config.nostr.relaysPublic
        };
    }
    
    // ... weitere Kategorien
    
    this.saveToStorage();
    this.updateTheme(this.settings.theme);
}
```

**REGEL 7:** User-Settings haben **Vorrang** vor config.json (außer Force-Overwrite).

---

## Reaktive API

### $state Pattern

```typescript
export class SettingsStore {
    // Reaktiver State (Svelte 5)
    public settings = $state<SettingsState>(this.loadSettings());
    
    // Berechnete Werte
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
}
```

**REGEL 8:** Berechnete Werte nutzen `$derived` (nicht Getter-Functions).

### Update-Pattern

```typescript
public setTheme(theme: Theme): void {
    // ✅ RICHTIG: Reassignment für Reaktivität
    this.settings = { ...this.settings, theme };
    this.updateTheme(theme);
    this.saveToStorage();
}

// ❌ FALSCH: Mutation ohne Reassignment
public setTheme(theme: Theme): void {
    this.settings.theme = theme;  // ← KEINE Reaktivität!
    this.saveToStorage();
}
```

**REGEL 9:** ALLE Updates MÜSSEN `this.settings = {...}` verwenden (nicht `.theme = ...`).

---

## Persistierung

### localStorage-Keys

```typescript
private static readonly STORAGE_KEY = 'kanban-settings';
private static readonly CONFIG_KEY = 'kanban-config';
```

**REGEL 10:** Settings und Config werden **separat** gespeichert.

### Save & Load

```typescript
private loadSettings(): SettingsState {
    if (typeof window === 'undefined') {
        return { ...DEFAULT_SETTINGS };
    }
    
    try {
        const stored = localStorage.getItem('kanban-settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_SETTINGS, ...parsed };  // ← Merge mit Defaults
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    
    return { ...DEFAULT_SETTINGS };
}

private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem('kanban-settings', JSON.stringify(this.settings));
        console.log('✅ Settings saved');
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}
```

**REGEL 11:** Merge mit Defaults verhindert Fehler bei fehlenden Properties.

### Export/Import

```typescript
// Export (für Backup)
public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
}

// Import (aus JSON-String)
public importSettings(json: string): boolean {
    try {
        const imported = JSON.parse(json);
        this.updateSettings(imported);
        console.log('✅ Settings imported');
        return true;
    } catch (error) {
        console.error('Failed to import:', error);
        return false;
    }
}

// Reset to Defaults
public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToStorage();
    this.updateTheme(DEFAULT_SETTINGS.theme);
    console.log('✅ Settings reset');
}
```

**Verwendung:**

```typescript
// Backup erstellen
const backup = settingsStore.exportSettings();
localStorage.setItem('settings-backup', backup);

// Wiederherstellen
const backup = localStorage.getItem('settings-backup');
settingsStore.importSettings(backup);
```

---

## Best Practices

### ✅ DO

```typescript
// Nutze $derived für berechnete Werte
let isDark = $derived(settingsStore.isDarkMode);

// Nutze Reassignment für Updates
settingsStore.setTheme('dark');  // ← triggert saveToStorage()

// Config vor AuthStore laden
await settingsStore.loadAndCacheConfig();
const authStore = initializeAuth(ndk);

// Validiere User-Input
settingsStore.addRelayPublic('wss://relay.damus.io');  // ← validiert URL
```

### ❌ DON'T

```typescript
// NIEMALS direkt mutieren
settingsStore.settings.theme = 'dark';  // ← KEINE Reaktivität!

// NIEMALS ohne Validierung
settingsStore.settings.relaysPublic.push('invalid-url');

// NIEMALS API-Keys für Remote-Services speichern
settingsStore.setLlmApiKey('sk-...');  // ← Wenn baseUrl remote!

// NIEMALS Config nach AuthStore laden
const authStore = initializeAuth(ndk);
await settingsStore.loadAndCacheConfig();  // ← Zu spät!
```

**REGEL 12:** Config-Loading ist **kritisch** für Demo-Session-Check in AuthStore.

---

## Häufige Fehler

### Fehler 1: Config nicht geladen

**Symptom:** `allow_demo_session` ist immer `false`

```typescript
// ❌ FALSCH: Config wird nach AuthStore geladen
const authStore = initializeAuth(ndk);
await settingsStore.loadAndCacheConfig();

// ✅ RICHTIG
await settingsStore.loadAndCacheConfig();
const authStore = initializeAuth(ndk);
```

**Fix:** Config MUSS vor AuthStore geladen werden!

### Fehler 2: Settings nicht reaktiv

**Symptom:** UI zeigt alte Werte nach Update

```typescript
// ❌ FALSCH: Mutation
settingsStore.settings.theme = 'dark';

// ✅ RICHTIG: Reassignment
settingsStore.settings = { ...settingsStore.settings, theme: 'dark' };
// Oder besser:
settingsStore.setTheme('dark');
```

**Fix:** Nutze IMMER die Setter-Methoden (nicht direkte Mutation)!

### Fehler 3: Theme wird nicht angewendet

**Symptom:** `document.documentElement` hat keine Theme-Klasse

```typescript
// ❌ FALSCH: saveToStorage() ohne updateTheme()
public setTheme(theme: Theme) {
    this.settings = { ...this.settings, theme };
    this.saveToStorage();
}

// ✅ RICHTIG
public setTheme(theme: Theme) {
    this.settings = { ...this.settings, theme };
    this.updateTheme(theme);  // ← ESSENTIAL!
    this.saveToStorage();
}
```

**Fix:** `updateTheme()` MUSS aufgerufen werden!

### Fehler 4: API-Key für Remote-Service gespeichert

**Symptom:** OpenAI API-Key in localStorage (SECURITY-ISSUE!)

```typescript
// ❌ FALSCH: Keine Warnung
settingsStore.setLlmApiKey('sk-...');

// ✅ RICHTIG: Prüfe ob Remote-Service
if (baseUrl.includes('api.openai.com')) {
    console.warn('⚠️ Use environment variables for API keys!');
    // Optional: throw Error statt nur warnen
}
```

**Fix:** Remote-API-Keys NIEMALS speichern (nutze `.env`)!

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 1** | Theme-Updates aktualisieren DOM | 🟠 HIGH |
| **REGEL 3** | API-Keys nur für localhost speichern | 🔴 CRITICAL |
| **REGEL 6** | Config vor AuthStore laden | 🔴 CRITICAL |
| **REGEL 9** | Settings via Reassignment updaten | 🔴 CRITICAL |
| **REGEL 12** | Config-Loading kritisch für AuthStore | 🔴 CRITICAL |

**Ohne diese Regeln: Broken UI & Security-Issues! ⚠️**
