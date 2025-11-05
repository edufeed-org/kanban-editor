<!--
  🤖 AIPanel.svelte - AI-Agent Interface in rechter Sidebar
  
  Features:
  - Chat-Interface für AI-Interaktion
  - Zeigt AI-Action-Vorschläge
  - Integriert ActionConfirmationDialog
  - Zeigt Learned Patterns Status
-->

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Textarea } from '$lib/components/ui/textarea';
  import { Badge } from '$lib/components/ui/badge';
  import { Separator } from '$lib/components/ui/separator';
  import ActionConfirmationDialog from '$lib/components/ui/ActionConfirmationDialog.svelte';
  import { chatStore } from '$lib/stores/chatStore.svelte.js';
  import { userPreferencesStore } from '$lib/stores/userPreferencesStore.svelte.js';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
  import BrainIcon from '@lucide/svelte/icons/brain';
  import SendIcon from '@lucide/svelte/icons/send';
  import SparklesIcon from '@lucide/svelte/icons/sparkles';
  import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
  import type { AIAction } from '$lib/classes/BoardModel.js';
  
  // Props
  let {
    boardId
  }: {
    boardId: string;
  } = $props();
  
  // Chat State
  let userInput = $state('');
  let isProcessing = $state(false);
  
  // Action Confirmation Dialog State
  let showConfirmDialog = $state(false);
  let pendingAction = $state<AIAction | null>(null);
  let pendingPatternHash = $state('');
  let pendingConfidence = $state(0);
  let pendingUsageCount = $state(0);
  
  // Chat Messages (derived from chatStore)
  let messages = $derived(chatStore.messages);
  
  // 🔥 WICHTIG: Lade Chat-Session wenn boardId sich ändert
  // Guard: Verhindere Endlosschleife durch Tracking der letzten geladenen ID
  let lastLoadedBoardId = $state<string | null>(null);
  
  $effect(() => {
    if (boardId !== lastLoadedBoardId) {
      console.log('🤖 AIPanel: Lade Chat-Session für Board:', boardId);
      chatStore.loadSession(boardId);
      lastLoadedBoardId = boardId;
    }
  });
  
  // Learning Stats (echte Werte von UserPreferencesStore)
  let learnedPatternsCount = $derived(userPreferencesStore.getAllLearnedPatterns().size);
  
  let confidenceThreshold = $derived(
    settingsStore.settings.learningConfidenceThreshold
  );
  
  // Auto-Executable Patterns Count (Patterns mit confidence >= threshold)
  let autoExecutableCount = $derived.by(() => {
    let count = 0;
    for (const [_, pattern] of userPreferencesStore.getAllLearnedPatterns()) {
      if (pattern.confidence >= confidenceThreshold) {
        count++;
      }
    }
    return count;
  })
  
  /**
   * Handle user message send
   */
  async function handleSendMessage() {
    if (!userInput.trim() || isProcessing) return;
    
    const message = userInput.trim();
    userInput = '';
    isProcessing = true;
    
    try {
      // Add user message
      chatStore.addMessage(message, 'user');
      
      // Send to AI (simulated - in real app, this would call your AI API)
      await simulateAIResponse(message);
      
    } catch (error) {
      console.error('AI Error:', error);
      chatStore.addMessage(
        'Entschuldigung, es gab einen Fehler bei der Verarbeitung.',
        'assistant'
      );
    } finally {
      isProcessing = false;
    }
  }
  
  /**
   * Send message to LLM and process response
   */
  async function simulateAIResponse(userMessage: string) {
    console.log('🔍 User Message:', userMessage);
    
    // Get board context for AI
    const boardContext = boardStore.getContextData(false);
    
    // Send to LLM
    const { content, error } = await chatStore.sendToLLM(userMessage, boardContext);
    
    if (error) {
      chatStore.addMessage(error, 'assistant');
      return;
    }
    
    // 🎯 Try to parse JSON response from LLM (supports multiple actions)
    let actions: AIAction[] = [];
    let responseText = content;
    let actionDescription = '';
    
    try {
      // Check if response is JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('📦 Parsed JSON from LLM:', parsed);
        
        // Extract response text
        if (parsed.response) {
          responseText = parsed.response;
        }
        
        // 🆕 Support for multiple actions (array) or single action
        const actionData = parsed.actions || (parsed.action ? [parsed.action] : []);
        
        for (const actionItem of actionData) {
          if (!actionItem || !actionItem.type) continue;
          
          let action: AIAction | null = null;
          const actionType = actionItem.type;
          const details = actionItem.details || {};
          
          switch (actionType) {
            case 'add_column':
              action = {
                type: 'add_column',
                columnName: details.columnName || 'Neue Spalte'
                // Note: color is not used - boardStore.createColumn() always uses 'slate'
              };
              console.log('🎯 Action: add_column', details);
              break;
              
            case 'add_card':
              // 🆕 Smart column selection: Use columnName if provided, otherwise last created column, otherwise first column
              let targetColumnId = details.columnId;
              
              if (!targetColumnId && details.columnName) {
                // Find column by name
                const columns = boardStore.uiData;
                const foundColumn = columns.find(c => c.name === details.columnName);
                targetColumnId = foundColumn?.id;
              }
              
              if (!targetColumnId) {
                // Use last created column (likely from previous action in sequence)
                const columns = boardStore.uiData;
                targetColumnId = columns.length > 0 ? columns[columns.length - 1].id : null;
              }
              
              if (targetColumnId) {
                action = {
                  type: 'add_card',
                  columnId: targetColumnId,
                  heading: details.heading || 'Neue Karte',
                  content: details.content || ''
                };
                console.log('🎯 Action: add_card', details);
              }
              break;
              
            case 'split_card':
              action = {
                type: 'split_card',
                sourceCardId: details.sourceCardId || 'mock-card-id',
                columnId: details.columnId || 'mock-column-id',
                newCards: details.newCards || [
                  { heading: 'Subtask 1' },
                  { heading: 'Subtask 2' },
                  { heading: 'Subtask 3' }
                ]
              };
              console.log('🎯 Action: split_card', details);
              break;
              
            case 'move_card':
              action = {
                type: 'move_card',
                cardId: details.cardId,
                fromColumnId: details.fromColumnId,
                toColumnId: details.toColumnId
              };
              console.log('🎯 Action: move_card', details);
              break;
          }
          
          if (action) {
            actions.push(action);
          }
        }
      }
    } catch (e) {
      console.log('⚠️ No JSON in LLM response, using plain text');
      
      // 🔄 FALLBACK: Try keyword-based detection if no JSON
      const lowerMessage = responseText.toLowerCase();
      const lowerUserMessage = userMessage.toLowerCase();
      
      // Check if user requested board creation
      const userRequestsCreation = (lowerUserMessage.includes('erstell') || 
                                   lowerUserMessage.includes('create') ||
                                   lowerUserMessage.includes('leg') ||
                                   lowerUserMessage.includes('anlegen'));
      
      // Check if this is a multi-column creation (LLM listed columns in RESPONSE)
      // Format 1: **Kolumne X: Name**
      let columnMatches = responseText.match(/\*\*Kolumne \d+: (.+?)\*\*/gi);
      
      // Format 2: **Spalte X: Name**
      if (!columnMatches || columnMatches.length === 0) {
        columnMatches = responseText.match(/\*\*Spalte \d+: (.+?)\*\*/gi);
      }
      
      // Format 3: ### **Spalte X: Name** (with heading)
      if (!columnMatches || columnMatches.length === 0) {
        columnMatches = responseText.match(/###\s+\*\*Spalte \d+: (.+?)\*\*/gi);
      }
      
      // Only auto-create if user explicitly requested it
      if (columnMatches && columnMatches.length > 0 && userRequestsCreation) {
        // Extract all column names from markdown format
        console.log('🎯 FALLBACK: User requested creation, detected multiple columns from list', columnMatches);
        
        for (const match of columnMatches) {
          const nameMatch = match.match(/(?:Kolumne|Spalte) \d+: (.+?)\*\*/i);
          if (nameMatch && nameMatch[1]) {
            const columnName = nameMatch[1].trim();
            actions.push({
              type: 'add_column',
              columnName: columnName
            });
            console.log('🎯 FALLBACK Action: add_column', { columnName });
            
            // Try to extract cards for this column (lines starting with - after the column)
            const columnIndex = responseText.indexOf(match);
            const nextColumnIndex = responseText.indexOf('**Spalte', columnIndex + match.length);
            const columnSection = nextColumnIndex > 0 
              ? responseText.substring(columnIndex, nextColumnIndex)
              : responseText.substring(columnIndex);
            
            // Match lines starting with - (with optional emoji and **bold**)
            const cardLines = columnSection.match(/^-\s+(.+)$/gm);
            if (cardLines && cardLines.length > 0) {
              console.log('🎯 FALLBACK: Found', cardLines.length, 'cards for column', columnName);
              
              for (const cardLine of cardLines) {
                let cardText = cardLine.substring(1).trim(); // Remove "-"
                
                // Remove emoji if present (emoji at start)
                cardText = cardText.replace(/^[^\w\s]+\s*/, '');
                
                // Remove **bold** markdown
                cardText = cardText.replace(/\*\*(.+?)\*\*/g, '$1');
                
                // Remove any remaining markdown or special chars
                cardText = cardText.trim();
                
                if (cardText && cardText.length > 3) {
                  actions.push({
                    type: 'add_card',
                    heading: cardText,
                    content: '',
                    columnName: columnName
                  });
                  console.log('🎯 FALLBACK Action: add_card', { heading: cardText, columnName });
                }
              }
            }
          }
        }
      } else if ((lowerMessage.includes('spalte') || lowerMessage.includes('column')) && 
                 (lowerMessage.includes('erstell') || lowerMessage.includes('create'))) {
        // Single column creation
        let columnName = 'Neue Spalte';
        
        const quotesMatch = userMessage.match(/"([^"]+)"|'([^']+)'|„([^"]+)"|"([^"]+)"/);
        if (quotesMatch) {
          columnName = quotesMatch[1] || quotesMatch[2] || quotesMatch[3] || quotesMatch[4];
        } else {
          // Try to extract after "Spalte" or "namens"
          const afterMatch = userMessage.match(/(?:spalte|column)\s+["']?(\w+)["']?/i) ||
                            userMessage.match(/namens\s+["']?(\w+)["']?/i);
          if (afterMatch) {
            columnName = afterMatch[1];
          }
        }
        
        actions.push({
          type: 'add_column',
          columnName: columnName
        });
        actionDescription = `➕ Spalte hinzufügen: "${columnName}"`;
        console.log('🎯 FALLBACK Action: add_column', { columnName });
      }
      
    }
    
    // Add LLM response text
    chatStore.addMessage(responseText, 'assistant');
    
    // 🆕 Process multiple actions sequentially
    if (actions.length > 0) {
      console.log(`🎯 Processing ${actions.length} action(s)`);
      
      // If multiple actions, show summary message
      if (actions.length > 1) {
        chatStore.addMessage(
          `📋 Ich führe ${actions.length} Aktionen aus: ${actions.map((a, i) => `${i + 1}. ${getActionDescription(a)}`).join(', ')}`,
          'assistant'
        );
      }
      
      // Process first action with confidence check
      const firstAction = actions[0];
      const result = await chatStore.checkActionConfidence(firstAction);
      console.log('🎯 Confidence check result:', result);
      
      // Store remaining actions for sequential execution
      const remainingActions = actions.slice(1);
      
      if (result.shouldAutoExecute && remainingActions.length === 0) {
        // Auto-execute single action
        const desc = getActionDescription(firstAction);
        chatStore.addMessage(
          `✅ Aktion wird automatisch ausgeführt (Confidence: ${Math.round(result.confidence * 100)}%): ${desc}`,
          'assistant'
        );
        
        await executeAction(firstAction);
        chatStore.recordActionSuccess(result.patternHash, true);
      } else if (result.shouldAutoExecute && remainingActions.length > 0) {
        // Auto-execute first, then process remaining
        await executeAction(firstAction);
        chatStore.recordActionSuccess(result.patternHash, true);
        
        // Process remaining actions
        for (const action of remainingActions) {
          await executeAction(action);
        }
        
        chatStore.addMessage(
          `✅ Alle ${actions.length} Aktionen erfolgreich ausgeführt!`,
          'assistant'
        );
      } else {
        // Show confirmation dialog
        const desc = getActionDescription(firstAction);
        chatStore.addMessage(
          `🤔 Ich schlage vor: ${desc}. Confidence: ${Math.round(result.confidence * 100)}%. Möchten Sie bestätigen?`,
          'assistant'
        );
        
        pendingAction = firstAction;
        pendingPatternHash = result.patternHash;
        pendingConfidence = result.confidence;
        pendingUsageCount = result.usageCount;
        showConfirmDialog = true;
        
        // Store remaining actions for later
        if (remainingActions.length > 0) {
          (pendingAction as any)._remainingActions = remainingActions;
        }
        
        console.log('🎯 Confirmation dialog prepared, showing...');
      }
    }
  }
  
  /**
   * Get human-readable description of action
   */
  function getActionDescription(action: AIAction): string {
    switch (action.type) {
      case 'add_column':
        return `➕ Spalte "${(action as any).columnName}"`;
      case 'add_card':
        return `➕ Karte "${(action as any).heading}"`;
      case 'split_card':
        return `📋 Karte aufteilen`;
      case 'move_card':
        return `🔄 Karte verschieben`;
      case 'update_card':
        return `✏️ Karte bearbeiten`;
      default:
        return `🤖 ${action.type}`;
    }
  }
  
  /**
   * Execute AI action via boardStore
   */
  function executeAction(action: AIAction) {
    console.log('🤖 Executing action:', action);
    
    try {
      switch (action.type) {
        case 'add_column': {
          const colName = (action as any).columnName || 'Neue Spalte';
          // Note: boardStore.createColumn() only accepts name parameter
          // color is always set to 'slate' internally
          const colId = boardStore.createColumn(colName);
          console.log('✅ Column created:', colId);
          chatStore.addMessage(
            `✅ Spalte "${colName}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'add_card': {
          const heading = (action as any).heading || 'Neue Karte';
          const content = (action as any).content || '';
          const columnId = (action as any).columnId;
          
          if (!columnId) {
            throw new Error('Spalten-ID fehlt');
          }
          
          const cardId = boardStore.createCard(columnId, heading, content);
          console.log('✅ Card created:', cardId);
          chatStore.addMessage(
            `✅ Karte "${heading}" erfolgreich erstellt!`,
            'assistant'
          );
          break;
        }
        
        case 'split_card': {
          // TODO: Implement split_card when boardStore has this method
          console.log('⚠️ split_card not yet implemented in boardStore');
          chatStore.addMessage(
            '⚠️ Karte aufteilen ist noch nicht implementiert.',
            'assistant'
          );
          break;
        }
        
        case 'update_card': {
          const cardId = (action as any).cardId;
          const updates = (action as any).updates || {};
          
          if (!cardId) {
            throw new Error('Karten-ID fehlt');
          }
          
          boardStore.editCard(cardId, updates);
          console.log('✅ Card updated:', cardId);
          chatStore.addMessage(
            '✅ Karte erfolgreich aktualisiert!',
            'assistant'
          );
          break;
        }
        
        case 'move_card': {
          const cardId = (action as any).cardId;
          const fromColId = (action as any).fromColumnId;
          const toColId = (action as any).toColumnId;
          
          if (!cardId || !fromColId || !toColId) {
            throw new Error('Karten-ID oder Spalten-ID fehlt');
          }
          
          boardStore.moveCard(cardId, fromColId, toColId);
          console.log('✅ Card moved:', cardId);
          chatStore.addMessage(
            '✅ Karte erfolgreich verschoben!',
            'assistant'
          );
          break;
        }
        
        default:
          console.warn('⚠️ Unknown action type:', action.type);
          chatStore.addMessage(
            `⚠️ Aktion "${action.type}" ist nicht implementiert.`,
            'assistant'
          );
      }
      
    } catch (error) {
      console.error('❌ Action execution failed:', error);
      chatStore.addMessage(
        `❌ Fehler beim Ausführen der Aktion: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        'assistant'
      );
    }
  }
  
  /**
   * Handle dialog confirm (Execute & Learn)
   */
  async function handleConfirm() {
    if (!pendingAction) return;
    
    // Execute first action
    await executeAction(pendingAction);
    
    // Record success (triggers toast)
    chatStore.recordActionSuccess(pendingPatternHash, false);
    
    // 🆕 Process remaining actions if any
    const remainingActions = (pendingAction as any)._remainingActions || [];
    if (remainingActions.length > 0) {
      chatStore.addMessage(
        `⏳ Führe ${remainingActions.length} weitere Aktion(en) aus...`,
        'assistant'
      );
      
      for (const action of remainingActions) {
        await executeAction(action);
      }
      
      chatStore.addMessage(
        `✅ Alle ${remainingActions.length + 1} Aktionen erfolgreich ausgeführt!`,
        'assistant'
      );
    }
    
    // Cleanup
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle dialog cancel
   */
  function handleCancel() {
    if (pendingPatternHash) {
      chatStore.recordActionRejection(pendingPatternHash);
    }
    
    chatStore.addMessage(
      'Aktion wurde abgebrochen.',
      'assistant'
    );
    
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle execute once (without learning)
   */
  function handleExecuteOnce() {
    if (!pendingAction) return;
    
    executeAction(pendingAction);
    
    chatStore.addMessage(
      'Aktion einmalig ausgeführt (ohne Learning).',
      'assistant'
    );
    
    pendingAction = null;
    showConfirmDialog = false;
  }
  
  /**
   * Handle Enter key in textarea
   */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }
</script>

<!-- AI Panel Container -->
<div class="flex h-full flex-col overflow-hidden">
  
  <!-- Header -->
  <div class="p-4 border-b">
    <div class="flex items-center gap-2 mb-2">
      <BrainIcon class="h-5 w-5 text-primary" />
      <h2 class="text-sm font-semibold">KI-Agent</h2>
    </div>
    <p class="text-xs text-muted-foreground">
      Intelligente Assistenz mit adaptivem Lernsystem
    </p>
  </div>
  
  <!-- Learning Stats -->
  <div class="px-4 py-3 bg-muted/30 border-b space-y-2">
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Gelernte Patterns:</span>
      <Badge variant="secondary" class="text-xs">
        {learnedPatternsCount}
      </Badge>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Auto-Execute bereit:</span>
      <Badge variant={autoExecutableCount > 0 ? 'default' : 'outline'} class="text-xs">
        {autoExecutableCount}
      </Badge>
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-muted-foreground">Confidence Threshold:</span>
      <span class="font-mono text-foreground">
        {Math.round(confidenceThreshold * 100)}%
      </span>
    </div>
  </div>
  
  <Separator />
  
  <!-- Chat Messages (native scroll) -->
  <div class="flex-1 overflow-y-auto p-4">
    <div class="space-y-4">
      {#if messages.length === 0}
        <!-- Empty State -->
        <div class="flex flex-col items-center justify-center h-full text-center py-12">
          <SparklesIcon class="h-12 w-12 text-muted-foreground mb-4" />
          <p class="text-sm text-muted-foreground mb-2">
            Starten Sie eine Konversation
          </p>
          <p class="text-xs text-muted-foreground">
            Fragen Sie nach Vorschlägen zur<br />Kartenorganisation
          </p>
        </div>
      {:else}
        {#each messages as message}
          <div class="flex gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[85%] rounded-lg px-3 py-2 {
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            }">
              <p class="text-xs whitespace-pre-wrap break-words">
                {message.content}
              </p>
              <p class="text-[10px] mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString('de-DE', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  
  <Separator />
  
  <!-- Input Area -->
  <div class="p-4 border-t bg-background">
    <div class="flex gap-2">
      <Textarea
        bind:value={userInput}
        onkeydown={handleKeyDown}
        placeholder="Fragen Sie den KI-Agent..."
        class="min-h-[60px] resize-none text-sm"
        disabled={isProcessing}
      />
      <Button
        onclick={handleSendMessage}
        disabled={!userInput.trim() || isProcessing}
        size="icon"
        class="shrink-0"
      >
        <SendIcon class="h-4 w-4" />
      </Button>
    </div>
    <p class="text-[10px] text-muted-foreground mt-2">
      Enter zum Senden, Shift+Enter für neue Zeile
    </p>
  </div>
  
</div>

<!-- Action Confirmation Dialog -->
{#if pendingAction}
  <ActionConfirmationDialog
    bind:open={showConfirmDialog}
    action={pendingAction}
    patternHash={pendingPatternHash}
    currentConfidence={pendingConfidence}
    threshold={confidenceThreshold}
    usageCount={pendingUsageCount}
    onConfirm={handleConfirm}
    onCancel={handleCancel}
    onExecuteOnce={handleExecuteOnce}
  />
{/if}
