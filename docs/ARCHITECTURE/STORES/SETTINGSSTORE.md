# SettingsStore Dokumentation

**Datei:** `src/lib/stores/settingsStore.svelte.ts`  
**Technologie:** Svelte 5 Runes (Klassen-basierter Store) + `config.json`  
**Pattern:** Manuelles `localStorage` (siehe `STORE-PATTERNS.md`)  
**Zweck:** Anwendungs-Einstellungen (UI, Relays, LLM, Defaults)

---

## 📋 Inhaltsverzeichnis

1. [Architektur & Pattern](#architektur--pattern)
2. [Settings-Kategorien](#settings-kategorien)
3. [Config.json Integration](#configjson-integration)
4. [Reaktive API & Persistierung](#reaktive-api--persistierung)
5. [Best Practices & Fehler](#best-practices--fehler)
6. [API-Referenz](#api-referenz)

---

## Architektur & Pattern

Der `SettingsStore` verwaltet **alle Anwendungs-Einstellungen** und folgt dem **manuellen `localStorage` Pattern**.

**Warum manuelles `localStorage`?**
- **Asynchrone Initialisierung:** Der Store muss eine externe `config.json` laden und mit den gespeicherten Benutzer-Einstellungen mergen.
- **Smart-Merging:** Die Logik, ob `config.json` die Benutzer-Einstellungen überschreiben darf, erfordert manuelle Kontrolle.
- **Validierung:** Jede Einstellung (z.B. Relay-URLs) wird vor dem Speichern validiert.

### Kern-Implementierung (`settingsStore.svelte.ts`)

```typescript
// src/lib/stores/settingsStore.svelte.ts
import { deepmerge } from 'deepmerge-ts';

const SETTINGS_KEY = 'kanban-settings';
const CONFIG_KEY = 'kanban-config';

export class SettingsStore {
    // 1. Reaktiver State mit Svelte 5 Runes
    public settings = $state<SettingsState>(this.loadFromStorage());

    // 2. Abgeleiteter reaktiver State
    public isDarkMode = $derived(/* ... */);
    public isLlmConfigured = $derived(/* ... */);

    constructor() {
        // Initiales Laden und Mergen der Konfiguration
        this.loadAndMergeConfig();
    }

    private loadFromStorage(): SettingsState {
        // Lädt Einstellungen aus localStorage und merged sie mit Defaults
    }

    private saveToStorage(): void {
        // Speichert den 'settings'-State in localStorage
    }
    
    public updateSettings(newSettings: Partial<SettingsState>) {
        this.settings = deepmerge(this.settings, newSettings);
        this.saveToStorage();
    }
}
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

// Nostr Relay Dialog (UI helper, nicht persistent)
settingsStore.openNostrSettingsDialog();
settingsStore.closeNostrSettingsDialog();
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

### Loading & Merging

Der Lade- und Merge-Prozess ist der Hauptgrund für das manuelle `localStorage` Pattern.

```typescript
/**
 * Lädt config.json, cached sie und merged sie mit den User-Settings.
 * MUSS vor AuthStore-Initialisierung aufgerufen werden!
 */
public async loadAndMergeConfig(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
        // 1. Lade config.json (mit Cache-Fallback)
        const response = await fetch('/config.json');
        if (!response.ok) {
            console.warn(`config.json nicht gefunden, verwende nur lokale Einstellungen.`);
            return;
        }
        const config = await response.json();
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

        // 2. Merge-Strategie anwenden
        const userSettingsExist = localStorage.getItem(SETTINGS_KEY) !== null;

        // Nur mergen, wenn keine User-Settings da sind (Initial-Setup)
        if (!userSettingsExist) {
            console.log('Wende config.json als initiale Einstellungen an.');
            this.settings = deepmerge(this.settings, this.mapConfigToState(config));
            this.saveToStorage();
        }
    } catch (error) {
        console.error("Fehler beim Laden der config.json:", error);
    } finally {
        this.updateTheme(this.settings.theme);
    }
}

// Hilfsfunktion zum Mappen der config.json-Struktur zum State
private mapConfigToState(config: any): Partial<SettingsState> {
    return {
        maxCardsBeforeScroll: config.ui?.maxCardsBeforeScroll,
        theme: config.ui?.theme,
        relaysPublic: config.nostr?.relaysPublic,
        // ... weitere Mappings
    };
}
```

**REGEL 6:** `config.json` wird nur beim **ersten Start** als Default angewendet. Danach haben die Benutzer-Einstellungen Vorrang.

**Initialisierung in `+layout.svelte`:**

```typescript
// in onMount
await settingsStore.loadAndMergeConfig();
// ... dann NDK und AuthStore initialisieren
```

---

## Reaktive API & Persistierung

### $state und $derived

```typescript
export class SettingsStore {
    // Reaktiver State (Svelte 5)
    public settings = $state<SettingsState>(this.loadFromStorage());
    
    // Berechnete Werte
    public isDarkMode = $derived(
        this.settings.theme === 'dark' ||
        (this.settings.theme === 'auto' && this.prefersDarkMode())
    );
    
    public isLlmConfigured = $derived(
        !!(this.settings.llmModel && this.settings.llmBaseUrl)
    );
}
```

**REGEL 8:** Berechnete Werte nutzen `$derived` für automatische Reaktivität.

### Update-Pattern & Persistierung

Alle Update-Methoden folgen einem klaren Muster:
1.  Validieren des Inputs.
2.  Aktualisieren des `$state` durch Reassignment.
3.  Aufrufen von `saveToStorage()`.

```typescript
public setTheme(theme: Theme): void {
    // 1. Validierung (implizit durch Typ)
    // 2. Reassignment für Reaktivität
    this.settings = { ...this.settings, theme };
    
    // 3. Nebeneffekte auslösen
    this.updateTheme(theme); 
    this.saveToStorage();
}
```

**REGEL 9:** Jede Änderung am `settings`-Objekt MUSS durch Reassignment (`this.settings = { ... }`) erfolgen und `saveToStorage()` aufrufen.

---

## Persistierung (Manuelles localStorage)

### localStorage-Keys

```typescript
private static readonly STORAGE_KEY = 'kanban-settings';
private static readonly CONFIG_KEY = 'kanban-config';
```

**REGEL 10:** Settings und Config werden **separat** gespeichert, um User-Präferenzen zu erhalten.

### Save & Load

```typescript
private loadFromStorage(): SettingsState {
    if (typeof window === 'undefined') {
        return { ...DEFAULT_SETTINGS };
    }
    
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge mit Defaults, um fehlende Properties abzufangen
            return deepmerge(DEFAULT_SETTINGS, parsed);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
    }
    
    return { ...DEFAULT_SETTINGS };
}

private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
        console.error('Fehler beim Speichern der Einstellungen:', error);
    }
}
```

**REGEL 11:** `deepmerge` mit Defaults stellt sicher, dass der Store auch nach App-Updates mit neuen Settings-Properties stabil bleibt.

### Export/Import & Reset

```typescript
// Export (für Backup)
public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
}

// Import (aus JSON-String)
public importSettings(json: string): boolean {
    try {
        const imported = JSON.parse(json);
        // Statt direkt zu setzen, wird `updateSettings` genutzt,
        // um eine saubere Reaktivität und Speicherung zu gewährleisten.
        this.updateSettings(imported);
        console.log('✅ Einstellungen importiert');
        return true;
    } catch (error) {
        console.error('Fehler beim Import:', error);
        return false;
    }
}

// Reset to Defaults
public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToStorage();
    this.updateTheme(DEFAULT_SETTINGS.theme);
    console.log('✅ Einstellungen zurückgesetzt');
}
```

---

## Best Practices & Fehler

### ✅ DO

```typescript
// Nutze $derived für berechnete Werte
let isDark = $derived(settingsStore.isDarkMode);

// Nutze die Setter-Methoden für Updates
settingsStore.setTheme('dark');

// Lade die Konfiguration vor dem AuthStore
await settingsStore.loadAndMergeConfig();
const authStore = initializeAuth(ndk);
```

### ❌ DON'T

```typescript
// NIEMALS direkt mutieren
settingsStore.settings.theme = 'dark';  // ← KEINE Reaktivität, kein Speichern!

// NIEMALS API-Keys für Remote-Services in localStorage speichern
settingsStore.setLlmApiKey('sk-...');  // ← Wenn baseUrl remote ist!

// NIEMALS die Initialisierungs-Reihenfolge missachten
const authStore = initializeAuth(ndk);
await settingsStore.loadAndMergeConfig();  // ← Zu spät!
```

**REGEL 12:** Die korrekte Initialisierungs-Reihenfolge ist **kritisch** für den Demo-Modus im `AuthStore`.

---

## API-Referenz

Eine vollständige API-Referenz ist in der `SettingsState`-Schnittstelle und den öffentlichen Methoden der `SettingsStore`-Klasse definiert. Die wichtigsten Methoden sind:

- `loadAndMergeConfig(): Promise<void>`
- `setTheme(theme: Theme): void`
- `addRelayPublic(url: string): void`
- `setLlmModel(model: string): void`
- `toggleLeftSidebar(): void`
- `exportSettings(): string`
- `importSettings(json: string): boolean`
- `reset(): void`

---

## Zusammenfassung: Kritische Regeln

| Regel | Beschreibung | Severity |
|-------|--------------|----------|
| **REGEL 3** | API-Keys nur für `localhost` speichern | 🔴 CRITICAL |
| **REGEL 6** | `config.json` wird nur beim ersten Start gemerged | 🟠 HIGH |
| **REGEL 9** | Updates nur via Reassignment + `saveToStorage()` | 🔴 CRITICAL |
| **REGEL 11** | `deepmerge` mit Defaults für Stabilität | 🟠 HIGH |
| **REGEL 12** | Korrekte Init-Reihenfolge (Settings → NDK → Auth) | 🔴 CRITICAL |

**Ohne diese Regeln: Fehlerhafte UI, verlorene Einstellungen & Security-Issues! ⚠️**
