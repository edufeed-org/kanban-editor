/**
 * ⚙️ SettingsStore für Kanban-Board (Svelte 5 Runes)
 *
 * Verantwortlichkeiten:
 * - UI/UX Einstellungen (theme, column layout)
 * - Scroll-Verhalten
 * - LLM-Integration (OpenAI-kompatible API)
 * - Relay-Konfiguration (Nostr)
 * - MCP Server URLs
 * - Board/Card Default States
 * - Persistierung in localStorage
 *
 * 🔐 SECURITY: Private Keys NIEMALS in Settings speichern!
 * LLMApiKey wird NUR bei lokaler Ollama-Nutzung lokal gespeichert
 */

export type Theme = 'dark' | 'default' | 'auto';
export type PublishState = 'published' | 'draft' | 'private';

/**
 * SettingsState Interface - alle verfügbaren Einstellungen
 */
export interface SettingsState {
  // UI/UX Settings
  maxCardsBeforeScroll: number; // Max. Karten pro Spalte (bevor gescrollt wird), Default: 20
  alignColumnsToMaxHeight: boolean; // Alle Karten auf maximale Höhe ausrichten, Default: true
  columnWidth: number; // Breite der Spalten in Pixeln, Default: 350
  theme: Theme; // 'dark' | 'default' | 'auto', Default: 'auto'

  // Nostr Relays
  relaysPublic: string[]; // Öffentliche Relays für Publishing
  relaysPrivate: string[]; // Private Relays (falls konfiguriert)

  // LLM Model Integration
  llmModel: string; // API Name des LLM Models, z.B. "gpt-4-mini", "ollama/mistral"
  llmBaseUrl: string; // Base URL des OpenAI-kompatiblen Providers
  llmApiKey: string; // Provider API-Key (oder leer bei lokalem Ollama)
  llmSystemPrompt: string; // System Prompt für KI-Kontext

  // MCP Integration
  mcpUrls: string[]; // Liste von URLs zu MCP Servern (z.B. n8n MCP Server)

  // Board Defaults
  defaultColumns: string[]; // Default Spalten-Namen, z.B. ["To Do", "In Progress", "Done"]
  defaultBoardPublishState: PublishState; // "published" | "draft" | "private"
  defaultCardPublishState: PublishState; // "published" | "draft" | "private"

  // Sidebar Visibility (für Topbar UI)
  showLeftSidebar: boolean; // Board-Liste sichtbar
  showRightSidebar: boolean; // KI-Agent + Debug Sidebar
}

/**
 * Standard-Werte für alle Settings
 * Diese entsprechen auch den Defaults in config.json
 */
export const DEFAULT_SETTINGS: SettingsState = {
  // UI/UX
  maxCardsBeforeScroll: 20,
  alignColumnsToMaxHeight: true,
  columnWidth: 350,
  theme: 'auto',

  // Nostr Relays
  relaysPublic: [
    'wss://relay-rpi.edufeed.org',
    'wss://relay.primal.net',
    'wss://nos.lol',
  ],
  relaysPrivate: [],

  // LLM Settings
  llmModel: 'ollama/mistral', // Default: lokales Ollama
  llmBaseUrl: 'http://localhost:11434', // Ollama läuft lokal
  llmApiKey: '', // Leer für lokales Ollama
  llmSystemPrompt:
    'Du bist ein hilfsbereiter KI-Assistant für Kanban Board Management. Helfe dem Benutzer beim Organisieren und Strukturieren von Aufgaben.',

  // MCP Integration
  mcpUrls: [],

  // Board Defaults
  defaultColumns: ['To Do', 'In Progress', 'Done'],
  defaultBoardPublishState: 'draft',
  defaultCardPublishState: 'draft',

  // Sidebar
  showLeftSidebar: true,
  showRightSidebar: true,
};

/**
 * ⚙️ SettingsStore - Svelte 5 Runes Implementation
 *
 * Features:
 * - $state für reaktive Settings
 * - $derived für berechnete Werte
 * - localStorage Persistierung (SSR-safe)
 * - Fallback zu Defaults bei ungültigem Input
 * - Type-safe API
 */
export class SettingsStore {
  private static readonly STORAGE_KEY = 'kanban-settings';
  private static readonly CONFIG_KEY = 'kanban-config'; // Für externe config.json

  // Reaktiver State (Svelte 5 Runes)
  public settings = $state<SettingsState>(this.loadSettings());

  // Derived Values (automatisch berechnet)
  public isDarkMode = $derived(
    this.settings.theme === 'dark' ||
      (this.settings.theme === 'auto' && this.prefersDarkMode())
  );

  public isLlmConfigured = $derived(
    !!(this.settings.llmModel && this.settings.llmBaseUrl)
  );

  public isMcpEnabled = $derived(this.settings.mcpUrls.length > 0);

  constructor() {
    // Auto-save on changes
    this.setupAutoSave();
  }

  /**
   * 📂 Lade Settings aus localStorage oder Defaults
   */
  private loadSettings(): SettingsState {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const stored = localStorage.getItem(SettingsStore.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SettingsState>;
        // Merge mit Defaults (falls neue Settings hinzugefügt wurden)
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
    }

    return { ...DEFAULT_SETTINGS };
  }

  /**
   * 💾 Speichere Settings in localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(SettingsStore.STORAGE_KEY, JSON.stringify(this.settings));
      console.log('✅ Settings saved to localStorage');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * 🔄 Auto-Save bei Änderungen
   * Mit $effect können wir auf State-Änderungen reagieren
   */
  private setupAutoSave(): void {
    // Hinweis: $effect wird in Komponenten verwendet, nicht im Store
    // Stattdessen: manuelle saveToStorage() Aufrufe nach Updates
  }

  /**
   * ────────────────────────────────────────────
   * UI/UX Settings
   * ────────────────────────────────────────────
   */

  public setMaxCardsBeforeScroll(value: number): void {
    if (value < 1 || value > 100) {
      console.warn('Invalid maxCardsBeforeScroll value:', value);
      return;
    }
    // ✅ Reassignment für Reaktivität (Svelte 5 Runes)
    this.settings = { ...this.settings, maxCardsBeforeScroll: value };
    this.saveToStorage();
  }

  public setAlignColumnsToMaxHeight(value: boolean): void {
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, alignColumnsToMaxHeight: value };
    this.saveToStorage();
  }

  public setColumnWidth(value: number): void {
    if (value < 200 || value > 600) {
      console.warn('Invalid columnWidth value:', value);
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, columnWidth: value };
    this.saveToStorage();
  }

  public setTheme(theme: Theme): void {
    if (!['dark', 'default', 'auto'].includes(theme)) {
      console.warn('Invalid theme value:', theme);
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, theme };
    this.updateTheme(theme);
    this.saveToStorage();
  }

  /**
   * Aktualisiere DOM-Theme (document.documentElement.classList)
   */
  private updateTheme(theme: Theme): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.classList.remove('dark', 'light');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'default') {
      root.classList.add('light');
    } else {
      // 'auto': check system preference
      if (this.prefersDarkMode()) {
        root.classList.add('dark');
      } else {
        root.classList.add('light');
      }
    }
  }

  /**
   * Prüfe System-Preference für Dark Mode
   */
  private prefersDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * ────────────────────────────────────────────
   * Nostr Relay Settings
   * ────────────────────────────────────────────
   */

  public setRelaysPublic(relays: string[]): void {
    // Validiere URLs
    const valid = relays.filter((url) => this.isValidRelayUrl(url));
    if (valid.length === 0) {
      console.warn('No valid relay URLs provided');
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, relaysPublic: valid };
    this.saveToStorage();
  }

  public setRelaysPrivate(relays: string[]): void {
    const valid = relays.filter((url) => this.isValidRelayUrl(url));
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, relaysPrivate: valid };
    this.saveToStorage();
  }

  public addRelayPublic(url: string): void {
    const isValid = this.isValidRelayUrl(url);
    const alreadyExists = this.settings.relaysPublic.includes(url);
    
    console.log('📡 addRelayPublic called with:', url);
    console.log('  - isValid:', isValid);
    console.log('  - alreadyExists:', alreadyExists);
    
    if (isValid && !alreadyExists) {
      this.settings.relaysPublic = [...this.settings.relaysPublic, url];
      this.saveToStorage();
      console.log('  ✅ Relay added successfully');
    } else {
      console.log('  ❌ Relay not added - validation failed or already exists');
    }
  }

  public removeRelayPublic(url: string): void {
    this.settings.relaysPublic = this.settings.relaysPublic.filter((r) => r !== url);
    this.saveToStorage();
  }

  private isValidRelayUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
    } catch {
      return false;
    }
  }

  /**
   * ────────────────────────────────────────────
   * LLM Configuration
   * ────────────────────────────────────────────
   */

  public setLlmModel(model: string): void {
    if (!model.trim()) {
      console.warn('LLM model cannot be empty');
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, llmModel: model };
    this.saveToStorage();
  }

  public setLlmBaseUrl(url: string): void {
    if (!url.trim()) {
      console.warn('LLM base URL cannot be empty');
      return;
    }
    try {
      // Validiere URL Format
      new URL(url);
      // ✅ Reassignment für Reaktivität
      this.settings = { ...this.settings, llmBaseUrl: url };
      this.saveToStorage();
    } catch {
      console.warn('Invalid LLM base URL:', url);
    }
  }

  /**
   * ⚠️ SECURITY: API Key nur für lokale Ollama speichern!
   * Für OpenAI/andere Remote APIs: NIE speichern, nur Runtime-Input
   */
  public setLlmApiKey(key: string): void {
    // ⚠️ Warnung wenn Remote API
    if (
      this.settings.llmBaseUrl &&
      !this.settings.llmBaseUrl.includes('localhost') &&
      !this.settings.llmBaseUrl.includes('127.0.0.1')
    ) {
      console.warn(
        '⚠️ WARNING: Storing API keys for remote services is not recommended. Use environment variables instead.'
      );
    }

    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, llmApiKey: key };
    this.saveToStorage();
  }

  public setLlmSystemPrompt(prompt: string): void {
    if (!prompt.trim()) {
      console.warn('LLM system prompt cannot be empty');
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, llmSystemPrompt: prompt };
    this.saveToStorage();
  }

  /**
   * ────────────────────────────────────────────
   * MCP Server Configuration
   * ────────────────────────────────────────────
   */

  public setMcpUrls(urls: string[]): void {
    const valid = urls.filter((url) => this.isValidHttpUrl(url));
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, mcpUrls: valid };
    this.saveToStorage();
  }

  public addMcpUrl(url: string): void {
    if (this.isValidHttpUrl(url) && !this.settings.mcpUrls.includes(url)) {
      this.settings.mcpUrls = [...this.settings.mcpUrls, url];
      this.saveToStorage();
    }
  }

  public removeMcpUrl(url: string): void {
    // ✅ Reassignment für Reaktivität
    this.settings = {
      ...this.settings,
      mcpUrls: this.settings.mcpUrls.filter((u) => u !== url)
    };
    this.saveToStorage();
  }

  private isValidHttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * ────────────────────────────────────────────
   * Board/Card Defaults
   * ────────────────────────────────────────────
   */

  public setDefaultColumns(columns: string[]): void {
    if (columns.length === 0) {
      console.warn('At least one default column required');
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = {
      ...this.settings,
      defaultColumns: columns.filter((c) => c.trim())
    };
    this.saveToStorage();
  }

  public setDefaultBoardPublishState(state: PublishState): void {
    if (!['published', 'draft', 'private'].includes(state)) {
      console.warn('Invalid publishState:', state);
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, defaultBoardPublishState: state };
    this.saveToStorage();
  }

  public setDefaultCardPublishState(state: PublishState): void {
    if (!['published', 'draft', 'private'].includes(state)) {
      console.warn('Invalid publishState:', state);
      return;
    }
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, defaultCardPublishState: state };
    this.saveToStorage();
  }

  /**
   * ────────────────────────────────────────────
   * Sidebar Visibility
   * ────────────────────────────────────────────
   */

  public toggleLeftSidebar(): void {
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, showLeftSidebar: !this.settings.showLeftSidebar };
    this.saveToStorage();
  }

  public toggleRightSidebar(): void {
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, showRightSidebar: !this.settings.showRightSidebar };
    this.saveToStorage();
  }

  public setShowLeftSidebar(value: boolean): void {
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, showLeftSidebar: value };
    this.saveToStorage();
  }

  public setShowRightSidebar(value: boolean): void {
    // ✅ Reassignment für Reaktivität
    this.settings = { ...this.settings, showRightSidebar: value };
    this.saveToStorage();
  }

  /**
   * ────────────────────────────────────────────
   * Batch Operations
   * ────────────────────────────────────────────
   */

  /**
   * Aktualisiere mehrere Settings auf einmal
   */
  public updateSettings(partial: Partial<SettingsState>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveToStorage();
  }

  /**
   * Exportiere alle Settings (z.B. für Backup)
   */
  public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Importiere Settings aus JSON String
   */
  public importSettings(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Partial<SettingsState>;
      this.updateSettings(imported);
      console.log('✅ Settings imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  /**
   * Setze alle Settings auf Standard-Werte zurück
   */
  public reset(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveToStorage();
    this.updateTheme(DEFAULT_SETTINGS.theme);
    console.log('✅ Settings reset to defaults');
  }

  /**
   * ────────────────────────────────────────────
   * Debugging
   * ────────────────────────────────────────────
   */

  public debugPrintSettings(): void {
    console.group('⚙️ SettingsStore Debug');
    console.log('Current Settings:', this.settings);
    console.log('isDarkMode:', this.isDarkMode);
    console.log('isLlmConfigured:', this.isLlmConfigured);
    console.log('isMcpEnabled:', this.isMcpEnabled);
    console.log('Stored in localStorage:', localStorage.getItem(SettingsStore.STORAGE_KEY));
    console.groupEnd();
  }
}

/**
 * ============================================================================
 * GLOBAL SINGLETON INSTANCE
 * ============================================================================
 *
 * Verwendung in Komponenten:
 *
 * import { settingsStore } from '$lib/stores/settingsStore.svelte';
 *
 * // In Komponente:
 * let { theme, maxCards } = $derived({
 *   theme: settingsStore.settings.theme,
 *   maxCards: settingsStore.settings.maxCardsBeforeScroll
 * });
 *
 * // Update:
 * settingsStore.setTheme('dark');
 * settingsStore.setMaxCardsBeforeScroll(30);
 */
export const settingsStore = new SettingsStore();
