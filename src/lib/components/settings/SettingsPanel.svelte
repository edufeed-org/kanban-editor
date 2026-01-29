<!-- 
  ⚙️ SettingsPanel.svelte - Zentrale Einstellungen-UI
  
  SINGLE SOURCE OF TRUTH für alle App-Settings:
  - UI/UX (Theme, Layout, Scrolling)
  - Learning System (Confidence Thresholds)
  - Nostr Relays
  - LLM Configuration
  - Board Defaults
  - MCP Integration
  
  Alle Werte werden aus config.json geladen und in settingsStore gespeichert.
-->

<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import * as Card from '$lib/components/ui/card';
  import * as Tabs from '$lib/components/ui/tabs';
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { Slider } from '$lib/components/ui/slider';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  
  // Props
  let { 
    defaultTab = 'ui',
    showHeader = true,
    showTabs = true
  }: { 
    defaultTab?: 'ui' | 'llm' | 'nostr' | 'defaults';
    showHeader?: boolean;
    showTabs?: boolean;
  } = $props();
  
  // Reactive bindings zu settingsStore
  let settings = $derived(settingsStore.settings);
  
  // Local state für Input-Felder (um typing smooth zu machen)
  let localMaxCards = $state(settingsStore.settings.maxCardsBeforeScroll);
  let localColumnWidth = $state(settingsStore.settings.columnWidth);
  let localLlmModel = $state(settingsStore.settings.llmModel);
  let localLlmBaseUrl = $state(settingsStore.settings.llmBaseUrl);
  let localLlmApiKey = $state(settingsStore.settings.llmApiKey);
  let localSystemPrompt = $state(settingsStore.settings.llmSystemPrompt);
  

  
  // Relays
  let localRelaysPublic = $state(settingsStore.settings.relaysPublic.join('\n'));
  let localRelaysPrivate = $state(settingsStore.settings.relaysPrivate.join('\n'));
  
  // Default Columns
  let localDefaultColumns = $state(settingsStore.settings.defaultColumns.join(', '));
  
  // Sync local → store on blur/change
  function handleMaxCardsChange() {
    settingsStore.setMaxCardsBeforeScroll(localMaxCards);
  }
  
  function handleColumnWidthChange() {
    settingsStore.setColumnWidth(localColumnWidth);
  }
  
  function handleLlmModelChange() {
    settingsStore.setLlmModel(localLlmModel);
  }
  
  function handleLlmBaseUrlChange() {
    settingsStore.setLlmBaseUrl(localLlmBaseUrl);
  }
  
  function handleLlmApiKeyChange() {
    settingsStore.setLlmApiKey(localLlmApiKey);
  }
  
  function handleSystemPromptChange() {
    settingsStore.setLlmSystemPrompt(localSystemPrompt);
  }
  
  function handleRelaysPublicChange() {
    const relays = localRelaysPublic.split('\n').filter(r => r.trim());
    settingsStore.setRelaysPublic(relays);
  }
  
  function handleRelaysPrivateChange() {
    const relays = localRelaysPrivate.split('\n').filter(r => r.trim());
    settingsStore.setRelaysPrivate(relays);
  }
  
  function handleDefaultColumnsChange() {
    const columns = localDefaultColumns.split(',').map(c => c.trim()).filter(c => c);
    settingsStore.setDefaultColumns(columns);
  }
  

  
  // Reset alle Settings
  function handleReset() {
    if (confirm('Wirklich alle Einstellungen zurücksetzen?')) {
      settingsStore.reset();
      
      // Sync local state
      localMaxCards = settings.maxCardsBeforeScroll;
      localColumnWidth = settings.columnWidth;
      localLlmModel = settings.llmModel;
      localLlmBaseUrl = settings.llmBaseUrl;
      localLlmApiKey = settings.llmApiKey;
      localSystemPrompt = settings.llmSystemPrompt;
      localRelaysPublic = settings.relaysPublic.join('\n');
      localRelaysPrivate = settings.relaysPrivate.join('\n');
      localDefaultColumns = settings.defaultColumns.join(', ');
    }
  }
</script>

<div class="w-full max-w-4xl mx-auto p-6 space-y-6">
  
  <!-- Header -->
  {#if showHeader}
  <div class="space-y-2">
    <h2 class="text-3xl font-bold">Einstellungen</h2>
    <p class="text-muted-foreground">
      Verwalte alle App-Einstellungen zentral. Werte werden aus <code>config.json</code> geladen.
    </p>
  </div>
  
  <Separator />
  {/if}
  
  <!-- Tabbed Settings -->
  <Tabs.Root value={defaultTab} class="w-full">
    {#if showTabs}
    <Tabs.List class="grid w-full grid-cols-4">
      <Tabs.Trigger value="ui">UI/UX</Tabs.Trigger>
      <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
      <Tabs.Trigger value="nostr">Nostr</Tabs.Trigger>
      <Tabs.Trigger value="defaults">Defaults</Tabs.Trigger>
    </Tabs.List>
    {/if}
    
    <!-- TAB 1: UI/UX Settings -->
    <Tabs.Content value="ui" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>UI & Layout</Card.Title>
          <Card.Description>Visuelle Einstellungen und Layout-Optionen</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          
          <!-- Theme -->
          <div class="space-y-2">
            <Label>Theme</Label>
            <div class="flex items-center gap-2">
              <Button 
                variant={settings.theme === 'default' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('default')}
                class="flex-1"
              >
                Hell
              </Button>
              <Button 
                variant={settings.theme === 'dark' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('dark')}
                class="flex-1"
              >
                Dunkel
              </Button>
              <Button 
                variant={settings.theme === 'auto' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('auto')}
                class="flex-1"
              >
                Auto
              </Button>
            </div>
          </div>
          
          <Separator />
          
          <!-- Max Cards Before Scroll -->
          <div class="space-y-2">
            <Label for="maxCards">
              Maximale Karten pro Spalte (vor Scrolling)
              <span class="text-muted-foreground ml-2">{localMaxCards}</span>
            </Label>
            <Input 
              id="maxCards"
              type="number"
              min="1"
              max="100"
              bind:value={localMaxCards}
              onchange={handleMaxCardsChange}
              class="w-32"
            />
            <p class="text-sm text-muted-foreground">
              Nach wie vielen Karten soll eine Spalte scrollbar werden?
            </p>
          </div>
          
          <!-- Column Width -->
          <div class="space-y-2">
            <Label for="columnWidth">
              Spaltenbreite (Pixel)
              <span class="text-muted-foreground ml-2">{localColumnWidth}px</span>
            </Label>
            <Input 
              id="columnWidth"
              type="number"
              min="250"
              max="500"
              step="10"
              bind:value={localColumnWidth}
              onchange={handleColumnWidthChange}
              class="w-32"
            />
          </div>
          
          <!-- Align Columns -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Spalten an maximale Höhe ausrichten</Label>
              <p class="text-sm text-muted-foreground">
                Alle Spalten haben die gleiche Höhe wie die höchste Spalte
              </p>
            </div>
            <Switch 
              checked={settings.alignColumnsToMaxHeight}
              onCheckedChange={(checked) => settingsStore.setAlignColumnsToMaxHeight(checked)}
            />
          </div>
          
          <Separator />
          
          <!-- Sidebar Visibility -->
          <div class="space-y-4">
            <Label>Sidebar Sichtbarkeit</Label>
            
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="font-normal">Linke Sidebar (Board-Liste)</Label>
              </div>
              <Switch 
                checked={settings.showLeftSidebar}
                onCheckedChange={() => settingsStore.toggleLeftSidebar()}
              />
            </div>
            
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="font-normal">Rechte Sidebar (KI-Agent)</Label>
              </div>
              <Switch 
                checked={settings.showRightSidebar}
                onCheckedChange={() => settingsStore.toggleRightSidebar()}
              />
            </div>
            
            <!-- Max Boards in Sidebar -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <Label class="font-normal">Max. sichtbare Boards</Label>
                <span class="text-sm text-muted-foreground">{settings.maxBoardsInSidebar}</span>
              </div>
              <Input
                type="number"
                min="1"
                max="50"
                value={settings.maxBoardsInSidebar}
                oninput={(e) => {
                  const value = parseInt(e.currentTarget.value, 10);
                  if (!isNaN(value) && value >= 1 && value <= 50) {
                    settingsStore.setMaxBoardsInSidebar(value);
                  }
                }}
                class="w-24"
              />
              <p class="text-xs text-muted-foreground">
                Wie viele Boards maximal in der Sidebar angezeigt werden (alle durchsuchbar)
              </p>
            </div>
          </div>
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 2: LLM Configuration -->
    <Tabs.Content value="llm" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>🤖 LLM Configuration</Card.Title>
          <Card.Description>OpenAI-kompatible API-Konfiguration</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          
          <!-- LLM Model -->
          <div class="space-y-2">
            <Label for="llmModel">Model Name</Label>
            <Input 
              id="llmModel"
              type="text"
              placeholder="gpt-4-mini, ollama/mistral, ..."
              bind:value={localLlmModel}
              onblur={handleLlmModelChange}
            />
            <p class="text-sm text-muted-foreground">
              API-Name des LLM Models (z.B. "gpt-4-mini", "ollama/mistral")
            </p>
          </div>
          
          <!-- Base URL -->
          <div class="space-y-2">
            <Label for="llmBaseUrl">Base URL</Label>
            <Input 
              id="llmBaseUrl"
              type="text"
              placeholder="http://localhost:11434"
              bind:value={localLlmBaseUrl}
              onblur={handleLlmBaseUrlChange}
            />
            <p class="text-sm text-muted-foreground">
              OpenAI-kompatible API Endpoint (z.B. lokales Ollama oder Remote Provider)
            </p>
          </div>
          
          <!-- API Key -->
          <div class="space-y-2">
            <Label for="llmApiKey">API Key</Label>
            <Input 
              id="llmApiKey"
              type="password"
              placeholder="Leer lassen für lokales Ollama"
              bind:value={localLlmApiKey}
              onblur={handleLlmApiKeyChange}
            />
            <p class="text-sm text-orange-600">
              ⚠️ SECURITY: Nur für lokales Ollama speichern! Remote APIs: .env.local nutzen!
            </p>
          </div>
          
          <Separator />
          
          <!-- System Prompt -->
          <div class="space-y-2">
            <Label for="systemPrompt">System Prompt</Label>
            <Textarea 
              id="systemPrompt"
              bind:value={localSystemPrompt}
              onblur={handleSystemPromptChange}
              rows={6}
              class="font-mono text-sm"
            />
            <p class="text-sm text-muted-foreground">
              Kontext für die KI (definiert Verhalten und Expertise)
            </p>
          </div>
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 3: Nostr Relays -->
    <Tabs.Content value="nostr" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>📡 Nostr Relays</Card.Title>
          <Card.Description>Public & Private Relay-Konfiguration</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          
          <!-- Public Relays -->
          <div class="space-y-2">
            <Label for="relaysPublic">Public Relays</Label>
            <Textarea 
              id="relaysPublic"
              bind:value={localRelaysPublic}
              onblur={handleRelaysPublicChange}
              rows={5}
              placeholder="wss://relay.damus.io&#10;wss://relay.primal.net"
              class="font-mono text-sm"
            />
            <p class="text-sm text-muted-foreground">
              Ein Relay pro Zeile (wss://)
            </p>
          </div>
          
          <!-- Private Relays -->
          <div class="space-y-2">
            <Label for="relaysPrivate">Private Relays (Optional)</Label>
            <Textarea 
              id="relaysPrivate"
              bind:value={localRelaysPrivate}
              onblur={handleRelaysPrivateChange}
              rows={3}
              placeholder="wss://private-relay.example.com"
              class="font-mono text-sm"
            />
            <p class="text-sm text-muted-foreground">
              Private Relays für zusätzliche Redundanz
            </p>
          </div>
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 4: Board Defaults -->
    <Tabs.Content value="defaults" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>🎯 Board & Card Defaults</Card.Title>
          <Card.Description>Standard-Werte für neue Boards und Cards</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          
          <!-- Default Columns -->
          <div class="space-y-2">
            <Label for="defaultColumns">Standard-Spalten</Label>
            <Input 
              id="defaultColumns"
              type="text"
              bind:value={localDefaultColumns}
              onblur={handleDefaultColumnsChange}
              placeholder="To Do, In Progress, Done"
            />
            <p class="text-sm text-muted-foreground">
              Komma-getrennt: Diese Spalten werden bei neuen Boards automatisch erstellt
            </p>
          </div>
          
          <Separator />
          
          <!-- Board Publish State -->
          <div class="space-y-2">
            <Label>Standard Board Publish State</Label>
            <div class="flex items-center gap-2">
              <Button 
                variant={settings.defaultBoardPublishState === 'draft' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('draft')}
                class="flex-1"
              >
                Draft
              </Button>
              <Button 
                variant={settings.defaultBoardPublishState === 'private' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('private')}
                class="flex-1"
              >
                Private
              </Button>
              <Button 
                variant={settings.defaultBoardPublishState === 'published' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('published')}
                class="flex-1"
              >
                Published
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
  </Tabs.Root>
  
  <Separator />
  
  <!-- Footer Actions -->
  <div class="flex items-center flex-col justify-between">
    <Button variant="outline" onclick={handleReset}>
      Alle Einstellungen zurücksetzen
    </Button>
    
    <div class="text-sm text-muted-foreground">
      Änderungen werden automatisch gespeichert
    </div>
  </div>
  
</div>
