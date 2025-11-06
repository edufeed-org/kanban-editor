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
  
  // Reactive bindings zu settingsStore
  let settings = $derived(settingsStore.settings);
  
  // Local state für Input-Felder (um typing smooth zu machen)
  let localMaxCards = $state(settingsStore.settings.maxCardsBeforeScroll);
  let localColumnWidth = $state(settingsStore.settings.columnWidth);
  let localLlmModel = $state(settingsStore.settings.llmModel);
  let localLlmBaseUrl = $state(settingsStore.settings.llmBaseUrl);
  let localLlmApiKey = $state(settingsStore.settings.llmApiKey);
  let localSystemPrompt = $state(settingsStore.settings.llmSystemPrompt);
  
  // Learning System local state - for Sliders (type="single" expects number)
  let localConfidenceThreshold = $state(settingsStore.settings.learningConfidenceThreshold);
  let localInitialConfidence = $state(settingsStore.settings.learningInitialConfidence);
  let localConfidenceIncrement = $state(settingsStore.settings.learningConfidenceIncrement);
  let localMinUsageCount = $state(settingsStore.settings.learningMinUsageCount);
  
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
  
  // Learning System $effect - sync Slider changes to store (bind:value auto-updates local vars)
  $effect(() => {
    if (localConfidenceThreshold !== settings.learningConfidenceThreshold) {
      settingsStore.setLearningConfidenceThreshold(localConfidenceThreshold);
    }
  });
  
  $effect(() => {
    if (localInitialConfidence !== settings.learningInitialConfidence) {
      settingsStore.setLearningInitialConfidence(localInitialConfidence);
    }
  });
  
  $effect(() => {
    if (localConfidenceIncrement !== settings.learningConfidenceIncrement) {
      settingsStore.setLearningConfidenceIncrement(localConfidenceIncrement);
    }
  });
  
  $effect(() => {
    if (localMinUsageCount !== settings.learningMinUsageCount) {
      settingsStore.setLearningMinUsageCount(localMinUsageCount);
    }
  });
  
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
      localConfidenceThreshold = settings.learningConfidenceThreshold;
      localInitialConfidence = settings.learningInitialConfidence;
      localConfidenceIncrement = settings.learningConfidenceIncrement;
      localMinUsageCount = settings.learningMinUsageCount;
    }
  }
</script>

<div class="w-full max-w-4xl mx-auto p-6 space-y-6">
  
  <!-- Header -->
  <div class="space-y-2">
    <h2 class="text-3xl font-bold">Einstellungen</h2>
    <p class="text-muted-foreground">
      Verwalte alle App-Einstellungen zentral. Werte werden aus <code>config.json</code> geladen.
    </p>
  </div>
  
  <Separator />
  
  <!-- Tabbed Settings -->
  <Tabs.Root value="ui" class="w-full">
    <Tabs.List class="grid w-full grid-cols-5">
      <Tabs.Trigger value="ui">UI/UX</Tabs.Trigger>
      <Tabs.Trigger value="learning">Learning</Tabs.Trigger>
      <Tabs.Trigger value="llm">LLM</Tabs.Trigger>
      <Tabs.Trigger value="nostr">Nostr</Tabs.Trigger>
      <Tabs.Trigger value="defaults">Defaults</Tabs.Trigger>
    </Tabs.List>
    
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
            <div class="flex items-center gap-4">
              <Button 
                variant={settings.theme === 'default' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('default')}
                class="w-24"
              >
                Hell
              </Button>
              <Button 
                variant={settings.theme === 'dark' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('dark')}
                class="w-24"
              >
                Dunkel
              </Button>
              <Button 
                variant={settings.theme === 'auto' ? 'default' : 'outline'}
                onclick={() => settingsStore.setTheme('auto')}
                class="w-24"
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
                onCheckedChange={(checked) => settingsStore.toggleLeftSidebar()}
              />
            </div>
            
            <div class="flex items-center justify-between">
              <div class="space-y-0.5">
                <Label class="font-normal">Rechte Sidebar (KI-Agent)</Label>
              </div>
              <Switch 
                checked={settings.showRightSidebar}
                onCheckedChange={(checked) => settingsStore.toggleRightSidebar()}
              />
            </div>
          </div>
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 2: Learning System -->
    <Tabs.Content value="learning" class="space-y-4">
      <Card.Root>
        <Card.Header>
          <Card.Title>🧠 Learning System</Card.Title>
          <Card.Description>
            KI-Assistenz lernt aus Ihren Mustern und automatisiert wiederkehrende Aktionen
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          
          <!-- Enable Learning Manager -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>Learning System aktivieren</Label>
              <p class="text-sm text-muted-foreground">
                Cross-Board Learning für Spalten-Strukturen, Labels, etc.
              </p>
            </div>
            <Switch 
              checked={settings.useLearningManager}
              onCheckedChange={(checked) => settingsStore.setUseLearningManager(checked)}
            />
          </div>
          
          {#if settings.useLearningManager}
            <Separator />
            
            <!-- Confidence Threshold -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Confidence Threshold</Label>
                <span class="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {localConfidenceThreshold.toFixed(2)}
                </span>
              </div>
              <Slider 
                type="single"
                bind:value={localConfidenceThreshold}
                min={0}
                max={1}
                step={0.05}
                class="w-full"
              />
              <p class="text-xs text-muted-foreground">
                Ab diesem Wert (0.0-1.0) werden KI-Aktionen automatisch ausgeführt ohne User-Confirmation.
                <strong>Empfohlen: 0.7</strong>
              </p>
            </div>
            
            <!-- Initial Confidence -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Initial Confidence (neue Patterns)</Label>
                <span class="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {localInitialConfidence.toFixed(2)}
                </span>
              </div>
              <Slider 
                type="single"
                bind:value={localInitialConfidence}
                min={0}
                max={1}
                step={0.05}
                class="w-full"
              />
              <p class="text-xs text-muted-foreground">
                Startwert für neu gelernte Patterns. <strong>Empfohlen: 0.3</strong>
              </p>
            </div>
            
            <!-- Confidence Increment -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Confidence Increment (pro Nutzung)</Label>
                <span class="text-sm font-mono bg-muted px-2 py-1 rounded">
                  +{localConfidenceIncrement.toFixed(2)}
                </span>
              </div>
              <Slider 
                type="single"
                bind:value={localConfidenceIncrement}
                min={0.05}
                max={0.3}
                step={0.05}
                class="w-full"
              />
              <p class="text-xs text-muted-foreground">
                Um wie viel steigt Confidence bei jeder erfolgreichen Nutzung. <strong>Empfohlen: 0.15</strong>
              </p>
            </div>
            
            <!-- Min Usage Count -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <Label>Mindest-Nutzungen für "Gelernt"</Label>
                <span class="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {localMinUsageCount}x
                </span>
              </div>
              <Slider 
                type="single"
                bind:value={localMinUsageCount}
                min={1}
                max={10}
                step={1}
                class="w-full"
              />
              <p class="text-xs text-muted-foreground">
                Nach wie vielen Nutzungen gilt ein Pattern als "gelernt"? <strong>Empfohlen: 3</strong>
              </p>
            </div>
            
            <Separator />
            
            <!-- Learning Progress Visualization -->
            <div class="space-y-2">
              <Label>Learning Progress (Beispiel)</Label>
              <div class="bg-muted p-4 rounded-lg space-y-2 text-xs font-mono">
                <div class="flex justify-between">
                  <span>Use 1:</span>
                  <span class="text-orange-500">Confidence {localInitialConfidence.toFixed(2)} (Confirmation nötig)</span>
                </div>
                <div class="flex justify-between">
                  <span>Use 2:</span>
                  <span class="text-orange-500">Confidence {(localInitialConfidence + localConfidenceIncrement).toFixed(2)} (Confirmation nötig)</span>
                </div>
                <div class="flex justify-between">
                  <span>Use 3:</span>
                  <span class={
                    (localInitialConfidence + localConfidenceIncrement * 2) >= localConfidenceThreshold 
                      ? 'text-green-500' 
                      : 'text-orange-500'
                  }>
                    Confidence {(localInitialConfidence + localConfidenceIncrement * 2).toFixed(2)} 
                    {(localInitialConfidence + localConfidenceIncrement * 2) >= localConfidenceThreshold 
                      ? '✓ Auto-Execute!' 
                      : '(Confirmation nötig)'
                    }
                  </span>
                </div>
              </div>
            </div>
            
          {/if}
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 3: LLM Configuration -->
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
          
          <Separator />
          
          <!-- LLM Intent Detection Toggle -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>🤖 LLM-basierte Intent-Erkennung (Experimentell)</Label>
              <p class="text-sm text-muted-foreground">
                Nutzt LLM für flexiblere Bestätigungs-Erkennung ("ja", "ok", "mach das", etc.)
              </p>
              <p class="text-xs text-muted-foreground">
                Deaktiviert: Schnellere regelbasierte Mustererkennung (Standard, 0ms, offline)
              </p>
            </div>
            <Switch 
              checked={settings.llmUseLlmIntent}
              onCheckedChange={(checked) => settingsStore.setLlmUseLlmIntent(checked)}
            />
          </div>
          
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- TAB 4: Nostr Relays -->
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
    
    <!-- TAB 5: Board Defaults -->
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
            <div class="flex items-center gap-4">
              <Button 
                variant={settings.defaultBoardPublishState === 'draft' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('draft')}
                class="w-28"
              >
                Draft
              </Button>
              <Button 
                variant={settings.defaultBoardPublishState === 'private' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('private')}
                class="w-28"
              >
                Private
              </Button>
              <Button 
                variant={settings.defaultBoardPublishState === 'published' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultBoardPublishState('published')}
                class="w-28"
              >
                Published
              </Button>
            </div>
          </div>
          
          <!-- Card Publish State -->
          <div class="space-y-2">
            <Label>Standard Card Publish State</Label>
            <div class="flex items-center gap-4">
              <Button 
                variant={settings.defaultCardPublishState === 'draft' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultCardPublishState('draft')}
                class="w-28"
              >
                Draft
              </Button>
              <Button 
                variant={settings.defaultCardPublishState === 'private' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultCardPublishState('private')}
                class="w-28"
              >
                Private
              </Button>
              <Button 
                variant={settings.defaultCardPublishState === 'published' ? 'default' : 'outline'}
                onclick={() => settingsStore.setDefaultCardPublishState('published')}
                class="w-28"
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
  <div class="flex items-center justify-between">
    <Button variant="outline" onclick={handleReset}>
      Alle Einstellungen zurücksetzen
    </Button>
    
    <div class="text-sm text-muted-foreground">
      Änderungen werden automatisch gespeichert
    </div>
  </div>
  
</div>
