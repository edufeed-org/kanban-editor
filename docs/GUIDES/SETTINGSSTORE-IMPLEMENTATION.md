# 🛠️ SettingsStore Implementation Guide

**Stand:** 24. Oktober 2025  
**Status:** ✅ Production Ready (Phase 1.5)

---

## Quick Start

### 1. Import

```typescript
import { settingsStore } from '$lib/stores/settingsStore.svelte';
```

### 2. In Svelte Komponente nutzen

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  
  // Reactive Werte
  let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);
  let isDarkMode = $derived(settingsStore.isDarkMode);
</script>

<!-- Auf Änderungen reagieren -->
{#if isDarkMode}
  <div class="dark">Dark Mode aktiv</div>
{/if}

<!-- Update Settings -->
<button onclick={() => settingsStore.setMaxCardsBeforeScroll(30)}>
  Set to 30
</button>
```

### 3. localStorage wird automatisch aktualisiert

```
settingsStore.setMaxCardsBeforeScroll(30)
    ↓
settings.maxCardsBeforeScroll = 30  [$state update]
    ↓
saveToStorage()  [automatisch]
    ↓
localStorage.setItem('kanban-settings', JSON.stringify(...))
    ↓
Bei Browser-Reload: Wert wird wiederhergestellt ✅
```

---

## Implementation Patterns

### Pattern 1: Simple Settings UI

**Komponente: `src/lib/components/SettingsPanel.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Field from '$lib/components/ui/field';
  import * as Slider from '$lib/components/ui/slider';

  // Reactive values
  let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);
  let columnWidth = $derived(settingsStore.settings.columnWidth);
  let theme = $derived(settingsStore.settings.theme);
</script>

<div class="settings-panel space-y-4">
  <!-- Max Cards Slider -->
  <Field.Root>
    <Field.Label>Max Cards Before Scroll: {maxCards}</Field.Label>
    <Field.Content>
      <Slider.Root
        value={[maxCards]}
        min={1}
        max={100}
        step={1}
        onValueChange={(v) => settingsStore.setMaxCardsBeforeScroll(v[0])}
      />
    </Field.Content>
  </Field.Root>

  <!-- Column Width Input -->
  <Field.Root>
    <Field.Label>Column Width (px): {columnWidth}</Field.Label>
    <Field.Content>
      <Input
        type="number"
        value={columnWidth}
        min={200}
        max={600}
        onchange={(e) => settingsStore.setColumnWidth(parseInt(e.target.value))}
      />
    </Field.Content>
  </Field.Root>

  <!-- Theme Select -->
  <Field.Root>
    <Field.Label>Theme: {theme}</Field.Label>
    <Field.Content>
      <select
        value={theme}
        onchange={(e) => settingsStore.setTheme(e.target.value)}
      >
        <option value="auto">Auto (System)</option>
        <option value="default">Light</option>
        <option value="dark">Dark</option>
      </select>
    </Field.Content>
  </Field.Root>

  <!-- Reset Button -->
  <Button variant="destructive" size="sm" onclick={() => settingsStore.reset()}>
    Reset to Defaults
  </Button>
</div>
```

### Pattern 2: Theme Switcher (Button Bar)

**Komponente: `src/lib/components/ThemeSwitcher.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import SunIcon from '@lucide/svelte/icons/sun';
  import MoonIcon from '@lucide/svelte/icons/moon';
  import MonitorIcon from '@lucide/svelte/icons/monitor';

  let theme = $derived(settingsStore.settings.theme);
</script>

<ToggleGroup.Root value={theme} onValueChange={(v) => settingsStore.setTheme(v)}>
  <ToggleGroup.Item value="default" aria-label="Light Mode">
    <SunIcon class="h-4 w-4" />
  </ToggleGroup.Item>

  <ToggleGroup.Item value="dark" aria-label="Dark Mode">
    <MoonIcon class="h-4 w-4" />
  </ToggleGroup.Item>

  <ToggleGroup.Item value="auto" aria-label="System Default">
    <MonitorIcon class="h-4 w-4" />
  </ToggleGroup.Item>
</ToggleGroup.Root>
```

### Pattern 3: Relay Configuration

**Komponente: `src/lib/components/RelayManager.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Field from '$lib/components/ui/field';
  import TrashIcon from '@lucide/svelte/icons/trash-2';

  let relays = $derived(settingsStore.settings.relaysPublic);
  let newRelayUrl = $state('');

  function handleAddRelay() {
    if (newRelayUrl.trim()) {
      settingsStore.addRelayPublic(newRelayUrl);
      newRelayUrl = '';
    }
  }

  function handleRemoveRelay(url: string) {
    settingsStore.removeRelayPublic(url);
  }
</script>

<div class="relay-manager space-y-4">
  <h3 class="font-semibold">Public Relays</h3>

  <!-- Add Relay -->
  <div class="flex gap-2">
    <Field.Root class="flex-1">
      <Field.Label hidden>Relay URL</Field.Label>
      <Field.Content>
        <Input
          type="url"
          placeholder="wss://relay.example.com"
          bind:value={newRelayUrl}
          onkeydown={(e) => e.key === 'Enter' && handleAddRelay()}
        />
      </Field.Content>
    </Field.Root>
    <Button onclick={handleAddRelay} variant="outline" size="sm">Add</Button>
  </div>

  <!-- Relay List -->
  <div class="space-y-2">
    {#each relays as relay (relay)}
      <div class="flex items-center justify-between p-2 border rounded bg-muted/30">
        <code class="text-xs">{relay}</code>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => handleRemoveRelay(relay)}
        >
          <TrashIcon class="h-4 w-4 text-destructive" />
        </Button>
      </div>
    {/each}
  </div>
</div>
```

### Pattern 4: LLM Configuration

**Komponente: `src/lib/components/LLMSettings.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import AlertIcon from '@lucide/svelte/icons/alert-circle';
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';

  let isConfigured = $derived(settingsStore.isLlmConfigured);
  let model = $derived(settingsStore.settings.llmModel);
  let baseUrl = $derived(settingsStore.settings.llmBaseUrl);
  let apiKey = $derived(settingsStore.settings.llmApiKey);
  let systemPrompt = $derived(settingsStore.settings.llmSystemPrompt);

  const isLocalOllama = $derived(baseUrl?.includes('localhost'));
</script>

<div class="llm-settings space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="font-semibold">LLM Configuration</h3>
    {#if isConfigured}
      <Badge variant="secondary" class="gap-1">
        <CheckCircleIcon class="h-3 w-3" />
        Configured
      </Badge>
    {:else}
      <Badge variant="destructive" class="gap-1">
        <AlertIcon class="h-3 w-3" />
        Not Configured
      </Badge>
    {/if}
  </div>

  <!-- Security Warning -->
  {#if !isLocalOllama && apiKey}
    <Alert.Root variant="destructive">
      <AlertIcon class="h-4 w-4" />
      <Alert.Title>Security Warning</Alert.Title>
      <Alert.Description>
        You are storing API keys for a remote service. Consider using environment variables instead.
      </Alert.Description>
    </Alert.Root>
  {/if}

  <!-- Model Selection -->
  <Field.Root>
    <Field.Label>Model</Field.Label>
    <Field.Content>
      <Input
        placeholder="gpt-4-mini, ollama/mistral, claude-opus"
        value={model}
        onchange={(e) => settingsStore.setLlmModel(e.target.value)}
      />
    </Field.Content>
    <Field.Description>
      API name of the LLM model (e.g., gpt-4-mini for OpenAI, ollama/mistral for local)
    </Field.Description>
  </Field.Root>

  <!-- Base URL -->
  <Field.Root>
    <Field.Label>Base URL</Field.Label>
    <Field.Content>
      <Input
        type="url"
        placeholder="http://localhost:11434 or https://api.openai.com/v1"
        value={baseUrl}
        onchange={(e) => settingsStore.setLlmBaseUrl(e.target.value)}
      />
    </Field.Content>
    <Field.Description>
      OpenAI-compatible API endpoint
    </Field.Description>
  </Field.Root>

  <!-- API Key (only for local) -->
  {#if isLocalOllama}
    <Field.Root>
      <Field.Label>API Key (optional for local Ollama)</Field.Label>
      <Field.Content>
        <Input
          type="password"
          placeholder="Leave empty for local Ollama"
          value={apiKey}
          onchange={(e) => settingsStore.setLlmApiKey(e.target.value)}
        />
      </Field.Content>
      <Field.Description>
        Only needed if your Ollama instance requires authentication
      </Field.Description>
    </Field.Root>
  {/if}

  <!-- System Prompt -->
  <Field.Root>
    <Field.Label>System Prompt</Field.Label>
    <Field.Content>
      <Textarea
        placeholder="You are a helpful AI assistant..."
        value={systemPrompt}
        rows={4}
        onchange={(e) => settingsStore.setLlmSystemPrompt(e.target.value)}
      />
    </Field.Content>
    <Field.Description>
      Instructions for the AI assistant context
    </Field.Description>
  </Field.Root>

  <!-- Status Info -->
  <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
    <p class="text-sm text-blue-900 dark:text-blue-100">
      {#if isLocalOllama}
        ℹ️ Using local Ollama at {baseUrl}
      {:else}
        ℹ️ Using remote API at {baseUrl}
      {/if}
    </p>
  </div>
</div>
```

### Pattern 5: Settings Dialog (Vollständig)

**Komponente: `src/lib/components/SettingsDialog.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Button } from '$lib/components/ui/button';
  import SettingsIcon from '@lucide/svelte/icons/settings';

  import SettingsPanel from './SettingsPanel.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import RelayManager from './RelayManager.svelte';
  import LLMSettings from './LLMSettings.svelte';

  let open = $state(false);
  let activeTab = $state('general');
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger asChild let:builder>
    <Button builders={[builder]} variant="ghost" size="sm">
      <SettingsIcon class="h-4 w-4" />
      <span class="hidden sm:inline ml-2">Settings</span>
    </Button>
  </Dialog.Trigger>

  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Settings</Dialog.Title>
      <Dialog.Description>
        Configure board appearance, relays, and AI settings
      </Dialog.Description>
    </Dialog.Header>

    <Tabs.Root bind:value={activeTab} class="w-full">
      <Tabs.List class="grid w-full grid-cols-4">
        <Tabs.Trigger value="general">General</Tabs.Trigger>
        <Tabs.Trigger value="theme">Theme</Tabs.Trigger>
        <Tabs.Trigger value="relays">Relays</Tabs.Trigger>
        <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="general" class="mt-4">
        <SettingsPanel />
      </Tabs.Content>

      <Tabs.Content value="theme" class="mt-4">
        <ThemeSwitcher />
      </Tabs.Content>

      <Tabs.Content value="relays" class="mt-4">
        <RelayManager />
      </Tabs.Content>

      <Tabs.Content value="llm" class="mt-4">
        <LLMSettings />
      </Tabs.Content>
    </Tabs.Root>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (open = false)}>Close</Button>
      <Button onclick={() => settingsStore.reset()} variant="destructive" size="sm">
        Reset All
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

---

## Integration in +layout.svelte

```svelte
<!-- src/routes/+layout.svelte -->

<script lang="ts">
  import '../app.css';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import SettingsDialog from '$lib/components/SettingsDialog.svelte';
  import { onMount } from 'svelte';

  interface Props {
    children?: any;
  }

  const { children }: Props = $props();

  // Reactive theme
  let isDarkMode = $derived(settingsStore.isDarkMode);
  let theme = $derived(settingsStore.settings.theme);

  onMount(() => {
    // Apply theme on mount
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  });
</script>

<div class={isDarkMode ? 'dark' : ''}>
  <!-- Topbar -->
  <header class="border-b bg-background/95">
    <div class="container flex h-14 items-center justify-between">
      <h1 class="text-xl font-semibold">Kanban Board</h1>

      <div class="flex items-center gap-2">
        <SettingsDialog />
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="container py-6">
    {@render children?.()}
  </main>
</div>

<style>
  :global(.dark) {
    color-scheme: dark;
  }

  :global(.light) {
    color-scheme: light;
  }
</style>
```

---

## Testing

### Unit Tests (Vitest)

```typescript
// src/lib/stores/settingsStore.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsStore, DEFAULT_SETTINGS } from './settingsStore.svelte';

describe('SettingsStore', () => {
  let store: SettingsStore;

  beforeEach(() => {
    store = new SettingsStore();
    // Clear localStorage
    localStorage.clear();
  });

  it('should initialize with defaults', () => {
    expect(store.settings.maxCardsBeforeScroll).toBe(20);
    expect(store.settings.theme).toBe('auto');
  });

  it('should update maxCardsBeforeScroll', () => {
    store.setMaxCardsBeforeScroll(30);
    expect(store.settings.maxCardsBeforeScroll).toBe(30);
  });

  it('should reject invalid maxCardsBeforeScroll', () => {
    store.setMaxCardsBeforeScroll(0); // Too small
    expect(store.settings.maxCardsBeforeScroll).toBe(20); // Unchanged

    store.setMaxCardsBeforeScroll(101); // Too large
    expect(store.settings.maxCardsBeforeScroll).toBe(20); // Unchanged
  });

  it('should validate relay URLs', () => {
    store.addRelayPublic('invalid-url');
    expect(store.settings.relaysPublic).not.toContain('invalid-url');

    store.addRelayPublic('wss://relay.damus.io');
    expect(store.settings.relaysPublic).toContain('wss://relay.damus.io');
  });

  it('should save to localStorage', () => {
    store.setMaxCardsBeforeScroll(50);

    const stored = JSON.parse(localStorage.getItem('kanban-settings') || '{}');
    expect(stored.maxCardsBeforeScroll).toBe(50);
  });

  it('should restore from localStorage', () => {
    localStorage.setItem(
      'kanban-settings',
      JSON.stringify({ maxCardsBeforeScroll: 40 })
    );

    const newStore = new SettingsStore();
    expect(newStore.settings.maxCardsBeforeScroll).toBe(40);
  });

  it('should toggle sidebars', () => {
    expect(store.settings.showLeftSidebar).toBe(true);

    store.toggleLeftSidebar();
    expect(store.settings.showLeftSidebar).toBe(false);

    store.toggleLeftSidebar();
    expect(store.settings.showLeftSidebar).toBe(true);
  });

  it('should export settings as JSON', () => {
    const json = store.exportSettings();
    const parsed = JSON.parse(json);

    expect(parsed.maxCardsBeforeScroll).toBe(20);
    expect(parsed.theme).toBe('auto');
  });

  it('should import settings from JSON', () => {
    const json = JSON.stringify({
      maxCardsBeforeScroll: 25,
      theme: 'dark'
    });

    const success = store.importSettings(json);
    expect(success).toBe(true);
    expect(store.settings.maxCardsBeforeScroll).toBe(25);
    expect(store.settings.theme).toBe('dark');
  });

  it('should reset to defaults', () => {
    store.setMaxCardsBeforeScroll(50);
    store.setTheme('dark');

    store.reset();

    expect(store.settings.maxCardsBeforeScroll).toBe(DEFAULT_SETTINGS.maxCardsBeforeScroll);
    expect(store.settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });
});
```

### Browser Testing (Playwright)

```typescript
// tests/settings.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should open settings dialog', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('should change theme', async ({ page }) => {
    await page.click('button:has-text("Settings")');
    await page.click('[aria-label="Dark Mode"]');

    // Check if dark class is applied
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('should persist settings', async ({ page }) => {
    // Change setting
    await page.click('button:has-text("Settings")');
    await page.locator('input[type="number"]').fill('30');

    // Reload page
    await page.reload();

    // Setting should persist
    const input = page.locator('input[type="number"]');
    await expect(input).toHaveValue('30');
  });
});
```

---

## Migration von altem Store

**Alt (Svelte 4 writable):**
```typescript
export const settingsStore = writable<SettingsState>(defaultSettings);

// Verwendung:
settingsStore.subscribe(s => {
  console.log(s.maxCardsBeforeScroll);
});

settingsStore.update(s => ({
  ...s,
  maxCardsBeforeScroll: 30
}));
```

**Neu (Svelte 5 Runes):**
```typescript
export const settingsStore = new SettingsStore();

// Verwendung:
let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);

settingsStore.setMaxCardsBeforeScroll(30);
```

**Migration Checklist:**
- [ ] `import { settingsStore }` statt `import { settingsStore } from 'svelte/store'`
- [ ] Ersetze `$settingsStore.property` mit `settingsStore.settings.property`
- [ ] Ersetze `settingsStore.update(...)` mit `settingsStore.setXxx(...)`
- [ ] `$effect` statt `settingsStore.subscribe(...)`
- [ ] Test: Browser DevTools → Application → localStorage → kanban-settings

---

## Common Patterns

### Pattern: Conditional UI based on Settings

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  
  let showSidebar = $derived(settingsStore.settings.showLeftSidebar);
  let isDark = $derived(settingsStore.isDarkMode);
  let maxCards = $derived(settingsStore.settings.maxCardsBeforeScroll);
</script>

{#if showSidebar}
  <aside>Sidebar</aside>
{/if}

<div class={isDark ? 'dark' : 'light'}>
  <div class="max-h-96 overflow-y-auto">
    {#each cards as card (card.id)}
      <Card {card} />
    {/each}
  </div>
</div>

<style>
  div {
    --max-cards: {maxCards};
  }
</style>
```

### Pattern: Settings Dependent Default Values

```typescript
// In boardStore.svelte.ts

import { settingsStore } from '$lib/stores/settingsStore.svelte';

export class BoardStore {
  public createBoard(name: string): string {
    // Nutze Default-Einstellungen
    const board = new Board({
      name,
      columns: settingsStore.settings.defaultColumns.map(colName => ({
        name: colName
      })),
      publishState: settingsStore.settings.defaultBoardPublishState
    });
    
    return board.id;
  }
}
```

---

## FAQ

### Q: Wo wird der Theme persistiert?
**A:** In localStorage unter dem Key `kanban-settings` zusammen mit allen anderen Settings. Theme wird auch sofort in `document.documentElement.classList` aktualisiert.

### Q: Kann ich Settings pro Benutzer speichern?
**A:** Aktuell nein (Phase 1). Phase 3 könnte per-user Settings mit Nostr Profilen verbinden.

### Q: Wie sicher ist die API-Key Speicherung?
**A:** Nur sicher für lokale Services (localhost). Für Remote APIs NIEMALS API Keys speichern - nutzen Sie Environment Variables stattdessen.

### Q: Wie teste ich neue Settings?
**A:** Browser Console: `settingsStore.debugPrintSettings()` zeigt alle aktuellen Werte.

---

**Status:** ✅ PRODUCTION READY  
**Letzte Änderung:** 24. Oktober 2025
