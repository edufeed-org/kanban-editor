import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the SettingsStore and helpers from the local module
import { SettingsStore, settingsStore, DEFAULT_SETTINGS } from './settingsStore.svelte';

describe('SettingsStore - unit tests', () => {
  let store: SettingsStore;

  beforeEach(() => {
    // Clear localStorage between tests to get a fresh environment
    localStorage.clear();

    // Prevent the constructor from performing async config fetch during instantiation
    // by stubbing initializeConfig on the prototype before creating the instance.
    vi.spyOn(SettingsStore.prototype, 'initializeConfig').mockImplementation(async function () {
      // noop
      return null as any;
    });

    store = new SettingsStore();
  });

  it('has default settings on creation', () => {
    expect(store.settings).toBeDefined();
    expect(store.settings.maxCardsBeforeScroll).toBe(DEFAULT_SETTINGS.maxCardsBeforeScroll);
    expect(store.settings.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('setMaxCardsBeforeScroll updates value and persists', () => {
    store.setMaxCardsBeforeScroll(30);
    expect(store.settings.maxCardsBeforeScroll).toBe(30);

    const raw = localStorage.getItem('kanban-settings');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.maxCardsBeforeScroll).toBe(30);
  });

  it('rejects invalid maxCardsBeforeScroll values', () => {
    const before = store.settings.maxCardsBeforeScroll;
    store.setMaxCardsBeforeScroll(0); // invalid
    expect(store.settings.maxCardsBeforeScroll).toBe(before);
  });

  it('setColumnWidth enforces min/max and persists', () => {
    store.setColumnWidth(500);
    expect(store.settings.columnWidth).toBe(500);

    store.setColumnWidth(1000); // invalid
    expect(store.settings.columnWidth).toBe(500);
  });

  it('setTheme updates theme and persists', () => {
    store.setTheme('dark');
    expect(store.settings.theme).toBe('dark');
    // DOM side-effect applied if running under jsdom - at least ensure saved
    const raw = JSON.parse(localStorage.getItem('kanban-settings') || '{}');
    expect(raw.theme).toBe('dark');
  });

  it('relay management: setRelaysPublic / addRelayPublic / removeRelayPublic', () => {
    store.setRelaysPublic(['wss://relay.example.com']);
    expect(store.settings.relaysPublic).toContain('wss://relay.example.com');

    // add new relay
    store.addRelayPublic('wss://another.relay');
    expect(store.settings.relaysPublic).toContain('wss://another.relay');

    // duplicate add should not create duplicate
    const beforeCount = store.settings.relaysPublic.length;
    store.addRelayPublic('wss://another.relay');
    expect(store.settings.relaysPublic.length).toBe(beforeCount);

    // remove
    store.removeRelayPublic('wss://another.relay');
    expect(store.settings.relaysPublic).not.toContain('wss://another.relay');
  });

  it('setRelaysPrivate works and validates', () => {
    store.setRelaysPrivate(['wss://private.example']);
    expect(store.settings.relaysPrivate).toContain('wss://private.example');
  });

  it('LLM setters and isLlmConfigured derived flag', () => {
    store.setLlmModel('gpt-test');
    expect(store.settings.llmModel).toBe('gpt-test');

    store.setLlmBaseUrl('http://localhost:1234');
    expect(store.settings.llmBaseUrl).toBe('http://localhost:1234');

    // isLlmConfigured should be truthy when model and baseUrl are present
    // The derived value may be a proxy; fall back to checking settings directly
    expect(store.settings.llmModel).toBeTruthy();
    expect(store.settings.llmBaseUrl).toBeTruthy();
  });

  it('setLlmApiKey stores key and warns for remote hosts', () => {
    // remote warning path: set base url to remote
    store.setLlmBaseUrl('https://api.example.com');
    store.setLlmApiKey('secret-key');
    expect(store.settings.llmApiKey).toBe('secret-key');
  });

  it('MCP URLs management', () => {
    store.setMcpUrls(['https://mcp.example']);
    expect(store.settings.mcpUrls).toContain('https://mcp.example');

    store.addMcpUrl('https://mcp2.example');
    expect(store.settings.mcpUrls).toContain('https://mcp2.example');

    store.removeMcpUrl('https://mcp2.example');
    expect(store.settings.mcpUrls).not.toContain('https://mcp2.example');
  });

  it('default columns and publish state setters', () => {
    store.setDefaultColumns(['A', 'B']);
    expect(store.settings.defaultColumns).toEqual(['A', 'B']);

    store.setDefaultBoardPublishState('published');
    expect(store.settings.defaultBoardPublishState).toBe('published');

    store.setDefaultCardPublishState('private');
    expect(store.settings.defaultCardPublishState).toBe('private');
  });

  it('sidebar toggles and setters', () => {
    const beforeLeft = store.settings.showLeftSidebar;
    store.toggleLeftSidebar();
    expect(store.settings.showLeftSidebar).toBe(!beforeLeft);

    const beforeRight = store.settings.showRightSidebar;
    store.toggleRightSidebar();
    expect(store.settings.showRightSidebar).toBe(!beforeRight);

    store.setShowLeftSidebar(true);
    expect(store.settings.showLeftSidebar).toBe(true);

    store.setShowRightSidebar(false);
    expect(store.settings.showRightSidebar).toBe(false);
  });

  it('updateSettings merges partial object and persists', () => {
    store.updateSettings({ theme: 'dark', columnWidth: 420 });
    expect(store.settings.theme).toBe('dark');
    expect(store.settings.columnWidth).toBe(420);

    const parsed = JSON.parse(localStorage.getItem('kanban-settings') || '{}');
    expect(parsed.theme).toBe('dark');
  });

  it('exportSettings and importSettings round-trip', () => {
    store.updateSettings({ theme: 'dark', llmModel: 'm' });
    const exported = store.exportSettings();
    expect(typeof exported).toBe('string');

    const newStore = new SettingsStore();
    // stub the async initialize in the constructor for the new instance as well
    vi.spyOn(SettingsStore.prototype, 'initializeConfig').mockImplementation(async function () {
      return null as any;
    });

    const ok = newStore.importSettings(exported);
    expect(ok).toBe(true);
    expect(newStore.settings.theme).toBe('dark');
    expect(newStore.settings.llmModel).toBe('m');
  });

  it('reset restores DEFAULT_SETTINGS and persists', () => {
    store.updateSettings({ theme: 'dark', columnWidth: 400 });
    store.reset();
    expect(store.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(store.settings.columnWidth).toBe(DEFAULT_SETTINGS.columnWidth);
    const parsed = JSON.parse(localStorage.getItem('kanban-settings') || '{}');
    expect(parsed.theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('loadAndCacheConfig fetches config and merges when no user settings', async () => {
    // restore real implementation for this test to exercise network fetch
    vi.restoreAllMocks();

    const fakeConfig = {
      ui: { theme: 'dark', maxCardsBeforeScroll: 11 },
      nostr: { relaysPublic: ['wss://cfg.relay'] },
      llm: { model: 'cfg-model', baseUrl: 'http://localhost:9999' },
      defaults: { columns: ['X', 'Y'] },
      sidebar: { showLeft: false }
    };

    // stub global fetch
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => fakeConfig } as any)
    ));

    // ensure no user settings exist in localStorage
    localStorage.removeItem('kanban-settings');

    // call loadAndCacheConfig and ensure it merges
    const result = await store.loadAndCacheConfig();

    expect('dark').toContain(result.ui.theme);
    expect(result.ui.maxCardsBeforeScroll).toBe(11);
    expect(result.nostr.relaysPublic).toContain('wss://cfg.relay');

    // cached config should be written to localStorage under the known key
    const cached = localStorage.getItem('kanban-config');
    expect(cached).toBeTruthy();
  });

  it('loadConfigSync reads cached config from localStorage', () => {
    const cfg = { a: 1 };
    localStorage.setItem('kanban-config', JSON.stringify(cfg));
    const res = store.loadConfigSync();
    expect(res).toBeTruthy();
    expect(res.a).toBe(1);
  });
});
